import { createEventApiClient, EventClientError } from './api.js';

export const CHAT_STORAGE_KEY = 'music-space-event-chat:v1';
export const CHAT_OPERATION_PREFIX = 'music-space-event-chat-operation:v2:';
export const CHAT_DRAFT_PREFIX = 'music-space-event-chat-draft:v2:';
const SESSION_KEY = 'music-space-avatar-session:v1';
const ID = /^[0-9a-f-]{36}$/, TOKEN = /^[A-Za-z0-9_-]{43}$/;
const hideReceipts = (messages, actor, available) => messages.map(m => !available && m.senderId === actor ? { ...m, readAt: null } : m);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const fail = (message, code = 'INVALID_INPUT') => { throw new EventClientError(message, { code }); };
const errorJSON = e => ({ message: e.message || '操作未完成', code: e.code || 'CLIENT_ERROR', status: e.status || 0, retryable: Boolean(e.retryable), uncertain: Boolean(e.uncertain), retryAfter: e.retryAfter || null, operationId: e.operationId || null });
const validText = text => typeof text === 'string' && Boolean(text.trim()) && [...text].length <= 1000 && !/[\p{Cs}\u0000-\u0008\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(text);
const validSession = value => value && TOKEN.test(value.token) && ID.test(value.user?.id) ? { token: value.token, user: { id: value.user.id } } : null;
const draftKey = (actor, peer) => `${actor}:${peer}`;
function validOperation(op) {
  if (!op || !ID.test(op.id) || !ID.test(op.key) || !ID.test(op.actorId) || !ID.test(op.peerId) || op.actorId === op.peerId || !['send', 'read'].includes(op.type)) return false;
  return op.type === 'send' ? validText(op.text) : Array.isArray(op.messageIds) && op.messageIds.length > 0 && op.messageIds.length <= 50 && op.messageIds.every(id => ID.test(id)) && new Set(op.messageIds).size === op.messageIds.length;
}

/** Explicit-action, DOM-free private chat. No polling or read acknowledgment is
 * started here. Outbox targets, payloads and keys are frozen before transmission. */
export function createChatController(options = {}) {
  let storage = options.storage;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  const api = options.api || createEventApiClient(options), listeners = new Set(), reads = new Map(), operations = new Map(), running = new Map(), drafts = new Map(), unsavedDrafts=new Set(),permissions = new Map(), confirmedReads = new Set();
  let disposed = false, session = null, identityEpoch = 0, navigationEpoch = 0, writeEpoch = 0, sequence = 0, unreadSequence = 0, verifiedToken = null;
  const state = { actorId: null, identityStatus: 'missing', list: { items: [], nextCursor: null, loaded: false, totalUnreadCount: 0 }, current: null, draft: '', error: null,
    storage: { ok: true, refreshRecovery: true, message: null }, lastResult: null };
  const sourceSession = options.getSession || (() => { try { return JSON.parse(storage?.getItem(SESSION_KEY) || 'null'); } catch { return null; } });
  const summaries = () => [...operations.values()].filter(op => op.actorId === state.actorId).map(op => ({ id: op.id, type: op.type, peerId: op.peerId,
    ...(op.type === 'send' ? { text: op.text } : { messageIds: op.messageIds }), status: op.status, error: op.error || null, durable: op.durable !== false }));
  function getState() { return freeze(clone({ ...state, outbox: summaries(), loading: [...reads.keys(), ...[...running.keys()].filter(id => operations.get(id)?.actorId === state.actorId).map(id => 'operation:' + id)] })); }
  function emit() { if (!disposed) for (const listener of listeners) { try { listener(getState()); } catch { /* View failures never alter a write outcome. */ } } }
  function assertLive() { if (disposed) fail('聊天控制器已关闭。', 'DISPOSED'); }
  function storageFailure() { state.storage = { ok: false, refreshRecovery: false, message: '浏览器存储不可用，暂时不能发送' }; }
  const operationKey=op=>CHAT_OPERATION_PREFIX+op.actorId+':'+op.id;
  const storedDraftKey=draft=>CHAT_DRAFT_PREFIX+draft.actorId+':'+draft.peerId;
  function persistedOperationDone(op){try{return JSON.parse(storage?.getItem(operationKey(op))||'null')?.done===true;}catch{return false;}}
  function persist(operation=null, completed=null, changedDraft=null) {
    if (disposed) return false;
    try {
      if (!storage?.setItem || !storage?.key || !Number.isSafeInteger(storage.length)) throw Error('Missing storage');
      storage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ version: 1, drafts: [...drafts.values()], operations: [...operations.values()].map(({ durable, ...op }) => op) }));
      if(operation&&!persistedOperationDone(operation)){const {durable,...saved}=operation;storage.setItem(operationKey(operation),JSON.stringify({version:1,operation:saved}));}
      // A tiny settled marker prevents another tab's stale legacy snapshot or
      // failed late retry from resurrecting this exact operation. No text/key.
      if(completed)storage.setItem(operationKey(completed),JSON.stringify({version:1,done:true,actorId:completed.actorId,id:completed.id,peerId:completed.peerId,draftToken:completed.finishDraft?completed.draftToken||null:null}));
      if(changedDraft)storage.setItem(storedDraftKey(changedDraft),JSON.stringify({version:1,draft:changedDraft}));
      state.storage = { ok: true, refreshRecovery: true, message: null }; for (const op of operations.values()) op.durable = true; return true;
    } catch { storageFailure(); for (const op of operations.values()) op.durable = false; return false; }
  }
  try {
    const saved = JSON.parse(storage?.getItem(CHAT_STORAGE_KEY) || 'null');
    if (saved?.version === 1) {
      for (const item of (Array.isArray(saved.drafts) ? saved.drafts : []).slice(0, 200)) if (ID.test(item.actorId) && ID.test(item.peerId) && typeof item.text === 'string' && [...item.text].length <= 1000) drafts.set(draftKey(item.actorId, item.peerId), { actorId: item.actorId, peerId: item.peerId, text: item.text, version: Number.isSafeInteger(item.version) ? item.version : 0,token:ID.test(item.token)?item.token:globalThis.crypto.randomUUID() });
      for (const op of (Array.isArray(saved.operations) ? saved.operations : []).slice(0, 100)) if (validOperation(op) && ![...operations.values()].some(old => old.actorId === op.actorId && old.peerId === op.peerId && old.type === op.type)) operations.set(op.id, { id: op.id, key: op.key, actorId: op.actorId, peerId: op.peerId, type: op.type, ...(op.type === 'send' ? { text: op.text, draftVersion: op.draftVersion,draftToken:op.draftToken||null } : { messageIds: [...op.messageIds] }), mayHaveCommitted: op.mayHaveCommitted ?? op.status !== 'failed', status: op.status === 'failed' ? 'failed' : 'uncertain', error: op.error && typeof op.error === 'object' ? errorJSON(op.error) : null, durable: true });
    }
  } catch { storageFailure(); }
  function readJournal({migrate=false}={}){
    try{
      if(!storage?.key||!Number.isSafeInteger(storage.length))return;
      if(migrate){for(const op of operations.values())if(storage.getItem(operationKey(op))===null)storage.setItem(operationKey(op),JSON.stringify({version:1,operation:op}));for(const draft of drafts.values())if(storage.getItem(storedDraftKey(draft))===null)storage.setItem(storedDraftKey(draft),JSON.stringify({version:1,draft}));}
      const completedTokens=new Set();
      for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(CHAT_OPERATION_PREFIX)&&!key?.startsWith(CHAT_DRAFT_PREFIX))continue;let record;try{record=JSON.parse(storage.getItem(key)||'null');}catch{storageFailure();continue;}if(record?.version!==1)continue;
        if(key.startsWith(CHAT_OPERATION_PREFIX)){
          if(record.done&&ID.test(record.actorId)&&ID.test(record.id)&&key===CHAT_OPERATION_PREFIX+record.actorId+':'+record.id){operations.delete(record.id);if(ID.test(record.peerId)&&ID.test(record.draftToken))completedTokens.add(record.actorId+':'+record.peerId+':'+record.draftToken);}
          else if(validOperation(record.operation)&&key===operationKey(record.operation)&&!running.has(record.operation.id)){const op=record.operation;operations.set(op.id,{...op,status:op.status==='failed'?'failed':'uncertain',mayHaveCommitted:op.mayHaveCommitted!==false,durable:true});}
        }else{const draft=record.draft;if(draft&&ID.test(draft.actorId)&&ID.test(draft.peerId)&&ID.test(draft.token)&&Number.isSafeInteger(draft.version)&&draft.version>=0&&typeof draft.text==='string'&&[...draft.text].length<=1000&&key===storedDraftKey(draft)&&!unsavedDrafts.has(draftKey(draft.actorId,draft.peerId)))drafts.set(draftKey(draft.actorId,draft.peerId),clone(draft));}
      }
      // Success never overwrites a newer cross-tab draft. It settles only the
      // submitted draft token; the next explicit edit writes its own token.
      for(const [key,draft]of drafts)if(completedTokens.has(key+':'+draft.token))drafts.set(key,{...draft,text:''});
    }catch{storageFailure();}
  }
  readJournal({migrate:true});
  function clearPrivate() {
    navigationEpoch++; writeEpoch++; verifiedToken = null; for (const read of reads.values()) read.abort(); reads.clear(); permissions.clear(); confirmedReads.clear();
    state.list = { items: [], nextCursor: null, loaded: false, totalUnreadCount: 0 }; unreadSequence = 0; state.current = null; state.draft = ''; state.lastResult = null;
  }
  function syncIdentity(value) {
    assertLive(); const observed = validSession(sourceSession());
    // Null explicitly hides an invalid/logged-out identity. A non-null value
    // from a delayed app callback cannot overrule the current credential source.
    const supplied = arguments.length ? validSession(value) : observed;
    const found = supplied && (supplied.token !== observed?.token || supplied.user.id !== observed?.user.id) ? observed : supplied;
    const changed = found?.token !== session?.token || found?.user.id !== session?.user.id || state.identityStatus === 'invalid';
    if (changed) { identityEpoch++; clearPrivate(); readJournal(); }
    session = found; state.actorId = found?.user.id || null; state.identityStatus = found ? 'ready' : 'missing'; state.error = null; emit();
    return getState();
  }
  syncIdentity();
  function identity() {
    assertLive(); const current = validSession(sourceSession());
    if (current?.token !== session?.token || current?.user.id !== session?.user.id) { syncIdentity(current); fail('身份已变化，请重新打开对话', 'IDENTITY_CHANGED'); }
    if (!session || state.identityStatus !== 'ready') fail('请先确认你的小人身份', 'IDENTITY_REQUIRED');
    return { token: session.token, actorId: session.user.id, epoch: identityEpoch };
  }
  function sameIdentity(actor) {
    if (disposed) return false;
    // Observe storage/getSession even when this request's cached epoch is old:
    // another tab may have replaced B again while an older A request finished.
    const current = validSession(sourceSession());
    if (current?.token !== session?.token || current?.user.id !== session?.user.id) syncIdentity(current);
    return actor.epoch === identityEpoch && actor.token === session?.token && actor.actorId === state.actorId;
  }
  function detachedOperation(op) {
    // The request may already be committed. Keep its frozen key/payload for the
    // original identity; do not clear its draft/outbox or write stale storage
    // over the new identity's data. The durable 'running' record restores as
    // uncertain after reload, and no response payload is exposed to the new UI.
    op.status = 'uncertain';
    op.error = errorJSON(new EventClientError('身份已变化，请刷新页面', { code: 'IDENTITY_CHANGED', retryable: true, uncertain: true, operationId: op.id }));
    return { operationId: op.id, applied: false };
  }
  function handleError(error, actor, applicable = true) {
    if (sameIdentity(actor) && (error.status === 401 || error.code === 'ACTOR_MISMATCH')) { identityEpoch++; clearPrivate(); state.identityStatus = 'invalid'; }
    if (!disposed && applicable && actor.actorId === state.actorId) state.error = errorJSON(error);
    emit();
  }
  function actorResponse(data, actor) { if (data.actorId !== actor.actorId) fail('身份不一致，请刷新页面', 'ACTOR_MISMATCH'); verifiedToken = actor.token; }
  function messageValue(m, actor, peer) {
    if (!m || !ID.test(m.id) || typeof m.text !== 'string' || !((m.senderId === actor && m.recipientId === peer) || (m.senderId === peer && m.recipientId === actor))) fail('消息响应无效。', 'INVALID_RESPONSE');
    return { id: m.id, senderId: m.senderId, recipientId: m.recipientId, text: m.text, createdAt: m.createdAt, readAt: m.readAt || null };
  }
  function chatValue(chat, actor, peer = chat?.userId) {
    if (!chat || !ID.test(chat.id) || !ID.test(peer) || chat.userId !== peer || chat.peer?.id !== peer || peer === actor || typeof chat.canSend !== 'boolean' || typeof chat.receiptsAvailable !== 'boolean') fail('对话响应无效。', 'INVALID_RESPONSE');
    return { id: chat.id, userId: peer, peer: { id: peer, name: chat.peer.name, avatar: clone(chat.peer.avatar) }, canSend: chat.canSend, receiptsAvailable: chat.receiptsAvailable,
      unreadCount: chat.unreadCount, lastMessage: chat.lastMessage ? messageValue(chat.lastMessage, actor, peer) : null, updatedAt: chat.updatedAt };
  }
  function permission(peer, value, ticket) {
    const previous = permissions.get(peer); if (previous && ticket < previous.ticket) return previous.value;
    permissions.set(peer, { value, ticket });
    if (state.current?.peerId === peer && state.current.chat) { state.current.chat.canSend = value; if (!value) { state.current.chat.receiptsAvailable = false; state.current.messages = state.current.messages.map(m => m.senderId === state.actorId ? { ...m, readAt: null } : m); if (state.current.chat.lastMessage?.senderId === state.actorId) state.current.chat.lastMessage.readAt = null; } }
    for (const chat of state.list.items) if (chat.userId === peer) { chat.canSend = value; if (!value) { chat.receiptsAvailable = false; if (chat.lastMessage?.senderId === state.actorId) chat.lastMessage.readAt = null; } }
    return value;
  }
  function applyChat(chat, ticket) { chat.canSend = permission(chat.userId, chat.canSend, ticket); if (!chat.canSend) { chat.receiptsAvailable = false; if (chat.lastMessage?.senderId === state.actorId) chat.lastMessage.readAt = null; } return chat; }
  async function read(label, path, apply, { scoped = false } = {}) {
    const actor = identity(), nav = navigationEpoch, writes = writeEpoch, ticket = ++sequence, abort = new AbortController();
    reads.get(label)?.abort(); reads.set(label, abort); emit();
    try {
      const data = await api.request(path, { token: actor.token, signal: abort.signal });
      if (!sameIdentity(actor) || abort.signal.aborted || reads.get(label) !== abort || (scoped && nav !== navigationEpoch) || writes !== writeEpoch) return { applied: false };
      actorResponse(data, actor); apply(data, actor, ticket); state.error = null; emit(); return { ...clone(data), applied: true };
    } catch (error) {
      if (!sameIdentity(actor)) return { applied: false };
      const applicable = !abort.signal.aborted && (!scoped || nav === navigationEpoch);
      if (applicable) handleError(error, actor); throw error;
    } finally { if (reads.get(label) === abort) reads.delete(label); emit(); }
  }
  function applyUnread(data, ticket) {
    if (!Number.isSafeInteger(data.totalUnreadCount) || data.totalUnreadCount < 0) fail('未读消息总数无效。', 'INVALID_RESPONSE');
    if (ticket >= unreadSequence) { unreadSequence = ticket; state.list.totalUnreadCount = data.totalUnreadCount; }
  }
  function list({ cursor } = {}) {
    if (cursor && !ID.test(cursor)) fail('对话分页位置无效。');
    return read('chats', '/chats' + (cursor ? '?cursor=' + cursor : ''), (data, actor, ticket) => {
      if (!Array.isArray(data.chats)) fail('对话列表无效。', 'INVALID_RESPONSE');
      const chats = data.chats.map(item => applyChat(chatValue(item, actor.actorId), ticket)); applyUnread(data, ticket);
      state.list = { items: cursor ? merge(state.list.items, chats, 'id') : chats, nextCursor: data.nextCursor, loaded: true, totalUnreadCount: state.list.totalUnreadCount };
    });
  }
  function peerId(value) { const id = typeof value === 'string' ? value : value?.userId || value?.id; if (!ID.test(id) || id === state.actorId) fail('对话对象无效。'); return id; }
  function merge(old, incoming, key = 'id') { const rows = [...old], positions = new Map(rows.map((m, i) => [m[key], i])); for (const m of incoming) { if (positions.has(m[key])) rows[positions.get(m[key])] = m; else { positions.set(m[key], rows.length); rows.push(m); } } return rows; }
  function loadMessages(kind = 'initial') {
    const actor = identity(), current = state.current; if (!current) fail('请先打开对话。', 'CHAT_REQUIRED');
    const peer = current.peerId, cursor = kind === 'older' ? current.olderCursor : null;
    if (kind === 'older' && !cursor) return Promise.resolve({ applied: false });
    return read('messages', `/chats/${peer}/messages${cursor ? '?before=' + cursor : ''}`, (data, who, ticket) => {
      if (state.current?.peerId !== peer || !Array.isArray(data.messages)) return;
      const chat = applyChat(chatValue(data.chat, who.actorId, peer), ticket), incoming = data.messages.map(m => messageValue(m, who.actorId, peer));
      const previous = state.current;
      // Default latest-page refresh also refreshes read receipts. Keep loaded old
      // pages and their older cursor; never infer chronological order from UUIDs.
      const messages = kind === 'older' ? merge(incoming, previous.messages.filter(m => !incoming.some(fresh => fresh.id === m.id))) : kind === 'refresh' && previous.messages.length ? merge(previous.messages, incoming) : incoming;
      state.current = { peerId: peer, chat, messages: hideReceipts(messages, who.actorId, chat.receiptsAvailable), olderCursor: kind === 'refresh' && previous.loaded && previous.messages.length ? previous.olderCursor : data.olderCursor,
        newerCursor: data.newerCursor, loaded: true };
      const known = state.list.items.findIndex(item => item.userId === peer); if (known >= 0) state.list.items[known] = chat;
    }, { scoped: true }).catch(error => {
      if (state.current?.peerId === peer && actor.epoch === identityEpoch && error.status === 404) { permission(peer, false, ++sequence); if (state.current.chat) state.current.chat.canSend = false; state.current.loaded = false; emit(); }
      throw error;
    });
  }
  async function refresh() {
    identity(); if (!state.current) fail('请先打开对话。', 'CHAT_REQUIRED');
    const peer = state.current.peerId, nav = navigationEpoch, anchor = state.current.messages.at(-1)?.id;
    let needsCatchup = false;
    // The usual poll is one latest-page request: it updates receipts as well as
    // messages. Only a >page-sized gap needs extra after-cursor catch-up reads.
    const first = await read('messages', `/chats/${peer}/messages`, (data, actor, ticket) => {
      if (state.current?.peerId !== peer || !Array.isArray(data.messages)) return;
      const chat = applyChat(chatValue(data.chat, actor.actorId, peer), ticket), incoming = data.messages.map(m => messageValue(m, actor.actorId, peer));
      const previous = state.current;
      needsCatchup = Boolean(anchor && data.olderCursor && incoming.length && !incoming.some(m => m.id === anchor));
      state.current = { peerId: peer, chat, messages: hideReceipts(needsCatchup ? previous.messages : merge(previous.messages, incoming), actor.actorId, chat.receiptsAvailable),
        olderCursor: previous.messages.length ? previous.olderCursor : data.olderCursor, newerCursor: data.newerCursor, loaded: true };
      const known = state.list.items.findIndex(item => item.userId === peer); if (known >= 0) state.list.items[known] = chat;
    }, { scoped: true });
    if (!first.applied || !needsCatchup) return first;
    let cursor = anchor;
    while (cursor) {
      let next = null;
      const result = await read('messages', `/chats/${peer}/messages?after=${cursor}`, (data, actor, ticket) => {
        if (state.current?.peerId !== peer || !Array.isArray(data.messages)) return;
        const chat = applyChat(chatValue(data.chat, actor.actorId, peer), ticket);
        state.current.chat = chat;
        state.current.messages = hideReceipts(merge(state.current.messages, data.messages.map(m => messageValue(m, actor.actorId, peer))), actor.actorId, chat.receiptsAvailable);
        state.current.newerCursor = data.newerCursor; next = data.newerCursor;
      }, { scoped: true });
      if (!result.applied || nav !== navigationEpoch || state.current?.peerId !== peer) return { applied: false };
      cursor = next;
    }
    return { applied: true };
  }
  function open(value) {
    identity();readJournal(); const peer = peerId(value); navigationEpoch++; reads.get('messages')?.abort();
    state.current = { peerId: peer, chat: null, messages: [], olderCursor: null, newerCursor: null, loaded: false };
    state.draft = drafts.get(draftKey(state.actorId, peer))?.text || ''; state.error = null; emit(); return loadMessages();
  }
  function setDraft(text) {
    identity(); if (!state.current) fail('请先打开对话。', 'CHAT_REQUIRED');
    if (typeof text !== 'string' || [...text].length > 1000) fail('草稿最多1000个字。');
    const key = draftKey(state.actorId, state.current.peerId), previous = drafts.get(key);
    const draft={ actorId: state.actorId, peerId: state.current.peerId, text, version: (previous?.version || 0) + 1,token:globalThis.crypto.randomUUID() };drafts.set(key,draft);state.draft=text;if(persist(null,null,draft))unsavedDrafts.delete(key);else unsavedDrafts.add(key);emit();
  }
  async function verifyActor(actor) {
    if (verifiedToken === actor.token) return;
    const data = await api.request('/chats', { token: actor.token }); if (!sameIdentity(actor)) fail('身份已改变。', 'IDENTITY_CHANGED'); actorResponse(data, actor);
  }
  function run(op) {
    const actor = identity(); if (op.actorId !== actor.actorId) fail('不能用另一个身份重试原消息。', 'IDENTITY_CHANGED');
    if (running.has(op.id)) return running.get(op.id);
    if(persistedOperationDone(op)){readJournal();emit();return Promise.resolve({operationId:op.id,applied:false,settledElsewhere:true});}
    const nav = navigationEpoch, priorPermission = permissions.get(op.peerId)?.ticket ?? 0, priorUncertain = op.mayHaveCommitted === true; let postDispatched = false;
    writeEpoch++; op.status = 'running'; op.error = null; persist(op); state.error = null;
    const promise = (async () => {
      try {
        await verifyActor(actor);
        if (!sameIdentity(actor)) fail('身份已改变。', 'IDENTITY_CHANGED');
        op.mayHaveCommitted = true;
        if (!persist(op)) fail('浏览器存储不可用，请稍后重试', 'STORAGE_REQUIRED');
        postDispatched = true;
        const data = await api.request(`/chats/${op.peerId}/${op.type === 'send' ? 'messages' : 'read'}`, { method: 'POST', token: actor.token, key: op.key,
          bodyJson: JSON.stringify(op.type === 'send' ? { text: op.text } : { messageIds: op.messageIds }) });
        if (!sameIdentity(actor)) return detachedOperation(op);
        let message;
        if (op.type === 'send') { message = messageValue(data.message, actor.actorId, op.peerId); if (message.senderId !== actor.actorId || message.text !== op.text || typeof data.canSend !== 'boolean') fail('发送回执无效。', 'INVALID_RESPONSE'); }
        else if (!Array.isArray(data.acknowledged) || JSON.stringify(data.acknowledged) !== JSON.stringify(op.messageIds)) fail('已读确认回执无效。', 'INVALID_RESPONSE');
        operations.delete(op.id);
        if (op.type === 'send') {
          const key = draftKey(op.actorId, op.peerId), draft = drafts.get(key);
          if (draft?.version === op.draftVersion && draft.text === op.text && (!op.draftToken||draft.token===op.draftToken)) { drafts.set(key, { ...draft, text: '', version: draft.version + 1 }); if (state.actorId === op.actorId && state.current?.peerId === op.peerId) state.draft = ''; }
        }
        const draftStorageKey=draftKey(op.actorId,op.peerId),pendingDraft=drafts.get(draftStorageKey);
        // The earlier send may finish after a later edit temporarily failed to
        // save. Recover that explicit edit before claiming refresh recovery;
        // never write the automatically cleared submitted draft over another tab.
        const recoveredDraft=op.type==='send'&&unsavedDrafts.has(draftStorageKey)&&pendingDraft?.token!==op.draftToken?pendingDraft:null;
        const stored=persist(null,{...op,finishDraft:op.type==='send'},recoveredDraft);
        if(op.type==='send'){const key=draftKey(op.actorId,op.peerId);if(stored)unsavedDrafts.delete(key);else if(drafts.get(key)?.text==='')unsavedDrafts.add(key);}
        if (sameIdentity(actor)) {
          if (op.type === 'read') op.messageIds.forEach(id => confirmedReads.add(id));
          if (op.type === 'send') {
            const currentTicket = permissions.get(op.peerId)?.ticket ?? 0;
            if (data.canSend === false || currentTicket === priorPermission) permission(op.peerId, data.canSend, ++sequence);
          }
          state.lastResult = { type: op.type, operationId: op.id, peerId: op.peerId, ...(message ? { messageId: message.id, saved: true } : { acknowledged: [...data.acknowledged] }) }; state.error = null; emit();
          if (nav === navigationEpoch && state.current?.peerId === op.peerId) await refresh().catch(() => {});
          if (op.type === 'read') await read('unread', '/chats', (data, who, ticket) => applyUnread(data, ticket)).catch(() => {});
        }
        return sameIdentity(actor) ? { ...clone(data), ...(op.type === 'send' ? { canSend: permissions.get(op.peerId)?.value ?? data.canSend } : {}), operationId: op.id, applied: nav === navigationEpoch } : { operationId: op.id, applied: false };
      } catch (error) {
        if (!sameIdentity(actor)) return detachedOperation(op);
        if(persistedOperationDone(op)){readJournal();state.error=null;emit();return {operationId:op.id,applied:false,settledElsewhere:true};}
        if (!error.code) error = new EventClientError('结果未确认，可以重发原消息', { code: 'NETWORK', retryable: true, uncertain: true });
        if (error.code === 'INVALID_RESPONSE') { error.retryable = true; error.uncertain = true; }
        const definitivePostRejection = postDispatched && !error.uncertain && error.status >= 400 && error.status < 500 && ![401, 403, 429].includes(error.status);
        if (priorUncertain && !definitivePostRejection) { error.uncertain = true; error.retryable = true; }
        op.mayHaveCommitted = error.uncertain && (priorUncertain || postDispatched);
        error.operationId = op.id; op.status = error.uncertain ? 'uncertain' : 'failed'; op.error = errorJSON(error); persist(op);
        if (sameIdentity(actor) && op.type === 'send' && [403, 404, 409].includes(error.status)) permission(op.peerId, false, ++sequence);
        handleError(error, actor, sameIdentity(actor)); throw error;
      } finally { running.delete(op.id); emit(); }
    })();
    running.set(op.id, promise); emit(); return promise;
  }
  function queue(type, payload) {
    const actor = identity(), current = state.current; if (!current?.loaded) fail('请先载入当前对话。', 'CHAT_REQUIRED');
    const existing = [...operations.values()].find(op => op.actorId === actor.actorId && op.peerId === current.peerId && op.type === type);
    if (existing) { if (running.has(existing.id)) return running.get(existing.id); fail('还有待确认的消息，请先重试', 'OPERATION_PENDING'); }
    const op = { id: globalThis.crypto.randomUUID(), key: globalThis.crypto.randomUUID(), actorId: actor.actorId, peerId: current.peerId, type, ...payload, mayHaveCommitted: false, status: 'uncertain', error: null };
    operations.set(op.id, op);
    const key=draftKey(actor.actorId,current.peerId),pendingDraft=type==='send'&&unsavedDrafts.has(key)?drafts.get(key):null;
    if (!persist(op,null,pendingDraft)) { operations.delete(op.id); emit(); fail('浏览器存储不可用，草稿还在', 'STORAGE_REQUIRED'); }
    if(pendingDraft)unsavedDrafts.delete(key);
    return run(op);
  }
  function send() {
    identity(); const current = state.current; if (!current?.loaded || !current.chat?.canSend) fail('现在不能发消息，请刷新', 'CHAT_UNAVAILABLE');
    if (!validText(state.draft)) fail('请输入1至1000个字', 'INVALID_MESSAGE');
    const draft = drafts.get(draftKey(state.actorId, current.peerId)); return queue('send', { text: state.draft, draftVersion: draft?.version || 0,draftToken:draft?.token||null });
  }
  function acknowledge(ids) {
    identity(); const current = state.current;
    if (!current?.loaded || !Array.isArray(ids) || ids.length < 1 || ids.length > 50 || new Set(ids).size !== ids.length || ids.some(id => !current.messages.some(m => m.id === id && m.recipientId === state.actorId))) fail('只能确认当前对话中实际显示的收到消息。', 'INVALID_READ_ACK');
    const unread = ids.filter(id => !confirmedReads.has(id) && !current.messages.find(m => m.id === id).readAt); if (!unread.length) return Promise.resolve({ acknowledged: [], applied: true });
    return queue('read', { messageIds: [...unread] });
  }
  function retry(id) { identity(); const op = operations.get(id); if (!op) fail('这个操作已不存在', 'OPERATION_NOT_FOUND'); return run(op); }
  function discard(id) {
    identity(); const op = operations.get(id); if (!op || op.actorId !== state.actorId || running.has(id) || op.status !== 'failed' || op.error?.uncertain) fail('结果未确认，请重试', 'OPERATION_UNCERTAIN');
    operations.delete(id); persist(null,op); state.error = null; emit();
  }
  function close() { assertLive(); navigationEpoch++; reads.get('messages')?.abort(); state.current = null; state.draft = ''; state.error = null; emit(); }
  return { getState, subscribe(listener) { assertLive(); listeners.add(listener); listener(getState()); return () => listeners.delete(listener); }, syncIdentity, list, open, older: () => loadMessages('older'), refresh, setDraft, send, retry, acknowledge, discard, close,
    // Mutations/drafts persist when changed. Pagehide must not restore an old
    // tab's snapshot after another tab replaces or clears the browser store.
    dispose() { if (disposed) return; disposed = true; identityEpoch++; navigationEpoch++; for (const read of reads.values()) read.abort(); reads.clear(); listeners.clear(); } };
}
