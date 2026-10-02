import { createEventApiClient, EventClientError } from './api.js';

export const SESSION_KEY = 'music-space-avatar-session:v1';
export const EVENT_STORAGE_KEY = 'music-space-event-client:v1';
export const EVENT_OPERATION_PREFIX = 'music-space-event-operation:v2:';
const ID = /^[0-9a-f-]{36}$/;
const RECAP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const CODE = /^[A-Z2-7]{12}$/;
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (message, code = 'INVALID_INPUT') => { throw new EventClientError(message, { code }); };
const summaryError = error => ({ message: error.message, code: error.code || 'CLIENT_ERROR', status: error.status || 0, retryable: Boolean(error.retryable), uncertain: Boolean(error.uncertain), retryAfter: error.retryAfter || null, operationId: error.operationId || null });
const signatures = {
  establishIdentity: ['avatar', 'POST', /^\/session$/], saveProfile: ['avatar', 'PUT', /^\/profile$/],
  createRoom: ['event', 'POST', /^\/rooms$/], joinRoom: ['event', 'POST', /^\/rooms\/[A-Z2-7]{12}\/join$/],
  uploadPhoto: ['event', 'POST', /^\/rooms\/[0-9a-f-]{36}\/photos$/],
  setParticipation: ['event','PATCH', /^\/rooms\/[0-9a-f-]{36}\/participation$/],
  setPhotoVisibility: ['event', 'PATCH', /^\/photos\/[0-9a-f-]{36}$/], removePhoto: ['event', 'DELETE', /^\/photos\/[0-9a-f-]{36}$/],
  withdrawPhoto: ['event', 'POST', /^\/photos\/[0-9a-f-]{36}\/withdraw$/],
  leaveRoom: ['event', 'POST', /^\/rooms\/[0-9a-f-]{36}\/leave$/], closeRoom: ['event', 'POST', /^\/rooms\/[0-9a-f-]{36}\/close$/],
  sendGreeting: ['event', 'POST', /^\/rooms\/[0-9a-f-]{36}\/greetings$/],
  acceptGreeting: ['event', 'POST', /^\/greetings\/[0-9a-f-]{36}\/accept$/], rejectGreeting: ['event', 'POST', /^\/greetings\/[0-9a-f-]{36}\/reject$/], cancelGreeting: ['event', 'POST', /^\/greetings\/[0-9a-f-]{36}\/cancel$/],
  removeFriend: ['event', 'DELETE', /^\/friends\/[0-9a-f-]{36}$/], blockUser: ['event', 'POST', /^\/blocks\/[0-9a-f-]{36}$/], unblockUser: ['event', 'DELETE', /^\/blocks\/[0-9a-f-]{36}$/],
};
const socialTypes = new Set(['sendGreeting', 'acceptGreeting', 'rejectGreeting', 'cancelGreeting', 'removeFriend', 'blockUser', 'unblockUser']);
const socialKinds = ['incoming', 'outgoing', 'friends', 'blocks'];
const emptySocial = () => ({ actorId: null, incoming: [], outgoing: [], friends: [], blocks: [], nextCursors: { incoming: null, outgoing: null, friends: null, blocks: null }, focusedPeer: null, loaded: false, stale: false });
const emptyRecap = () => ({ actorId: null, roomId: null, room: null, photos: { items: [], nextCursor: null }, friends: { items: [], nextCursor: null }, photosCursor: null, friendsCursor: null, loaded: false });
function validOperation(op) {
  const rule = signatures[op?.type];
  if (!rule || !ID.test(op.id) || !ID.test(op.key) || ![null, 'string'].includes(op.actorId === null ? null : typeof op.actorId) || (op.actorId && !ID.test(op.actorId)) || op.namespace !== rule[0] || op.method !== rule[1] || !rule[2].test(op.path) || typeof op.bodyJson !== 'string' || op.bodyJson.length > 430 * 1024) return false;
  try {
    const data = JSON.parse(op.bodyJson);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if(op.type==='setParticipation')return ['quiet','open'].includes(data.mode)&&Number.isSafeInteger(data.revision)&&data.revision>0&&ID.test(op.target)&&op.path===`/rooms/${op.target}/participation`;
    if (!socialTypes.has(op.type)) return true; // Keep the original saved operation format compatible.
    const target = op.target;
    if (!ID.test(op.actorId) || !target || !ID.test(target.userId) || target.userId === op.actorId) return false;
    if (op.type === 'sendGreeting') return ID.test(target.roomId) && op.path === `/rooms/${target.roomId}/greetings` && data.recipientId === target.userId;
    if (['acceptGreeting', 'rejectGreeting', 'cancelGreeting'].includes(op.type)) {
      if (!ID.test(target.greetingId) || op.path !== `/greetings/${target.greetingId}/${op.type.replace('Greeting', '')}`) return false;
    } else if (op.path !== `/${op.type === 'removeFriend' ? 'friends' : 'blocks'}/${target.userId}`) return false;
    return op.type === 'blockUser' ? Object.keys(data).length === 0 : Number.isSafeInteger(data.revision) && data.revision > 0 && data.revision === target.revision;
  } catch { return false; }
}

/** DOM-independent, explicit-action controller. It never starts network activity
 * in its constructor, schedules polling, uploads drafts, or substitutes identity.
 * State and return values exclude bearer credentials and idempotency keys.
 */
export function createEventController(options = {}) {
  let storage = options.storage;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  const api = createEventApiClient(options), uuid = () => globalThis.crypto.randomUUID();
  const listeners = new Set(), reads = new Map(), running = new Map(), operations = new Map(), photoChanges = new Map(), roomChanges = new Map(), hiddenPeers = new Set(), socialPeerChanges = new Map();
  let writeSequence = 0, socialGeneration = 0, photoPrivacyGeneration = 0, socialReadSequence = 0, socialSnapshotSequence = 0, socialPeerRequestSequence = 0, recapGeneration = 0, recapReadSequence = 0;
  let disposed = false, identitySuperseded = false, generation = 0, identityGeneration = 0, session = null, meta = { lastActorId: null };
  const state = { connection: 'unknown', identity: { status: 'missing', user: null }, route: { kind: 'home', target: null },
    room: null, preview: null, members: [], photos: [], social: emptySocial(), recap: emptyRecap(), myRooms: { items: [], nextCursor: null }, myPhotos: { items: [], nextCursor: null },
    drafts: { profile: null, room: null, photo: null }, draftVersions: { profile: 0, room: 0, photo: 0 }, dirty: { profile: false, room: false, photo: false },
    storage: { ok: true, refreshRecovery: true, message: null }, error: null, lastResult: null };
  const pendingSummary = op => ({ id: op.id, type: op.type, target: op.target, actorId: op.actorId, status: op.status, durable: op.durable !== false, error: op.error || null });
  const visibleOperation=op=>op&&((op.actorId&&op.actorId===session?.user.id)||(!op.actorId&&state.identity.status!=='ready'&&op.replacesActorId===(session?.user.id||meta.lastActorId||null)));
  function getState() { return freeze(clone({ ...state, loading: [...reads.keys(), ...[...running.keys()].filter(id => operations.get(id)?.status === 'running'&&visibleOperation(operations.get(id))).map(id => 'operation:' + id)], pending: [...operations.values()].filter(visibleOperation).map(pendingSummary) })); }
  function emit() { if (!disposed) for (const listener of listeners) { try { listener(getState()); } catch { /* A view callback must not change an operation's outcome. */ } } }
  function storageFailure() { state.storage = { ok: false, refreshRecovery: false, message: '本机存储不可用或已满。当前草稿仍在，但不能保证刷新后恢复。' }; }
  const operationKey = op => EVENT_OPERATION_PREFIX + op.id;
  const savedOperation = ({ id, key, type, namespace, method, path, bodyJson, actorId, replacesActorId, target, draftKind, draftVersion, status, error }) => ({ id, key, type, namespace, method, path, bodyJson, actorId, replacesActorId, target, draftKind, draftVersion, status, error });
  function operationDone(op) { try { const row=JSON.parse(storage?.getItem(operationKey(op))||'null');return row?.version===1&&row.done===true&&row.id===op.id; } catch { return false; } }
  function persist(operation=null, completed=null) {
    if (disposed||identitySuperseded) return false;
    if(syncStoredIdentity())return false;
    try {
      if (!storage?.setItem || !storage?.key || !Number.isSafeInteger(storage.length)) throw Error();
      storage.setItem(EVENT_STORAGE_KEY, JSON.stringify({ version: 1, meta, drafts: state.drafts, draftVersions: state.draftVersions, dirty: state.dirty,
        operations: [...operations.values()].map(savedOperation) }));
      if(operation&&!operationDone(operation))storage.setItem(operationKey(operation),JSON.stringify({version:1,operation:savedOperation(operation)}));
      if(completed)storage.setItem(operationKey(completed),JSON.stringify({version:1,done:true,id:completed.id,actorId:completed.actorId}));
      for(const op of operations.values())if(storage.getItem(operationKey(op))===null)storage.setItem(operationKey(op),JSON.stringify({version:1,operation:savedOperation(op)}));
      state.storage = { ok: true, refreshRecovery: true, message: null };
      for (const op of operations.values()) op.durable = true;
      return true;
    } catch { storageFailure(); for (const op of operations.values()) op.durable = false; return false; }
  }
  function readSession() {
    try {
      if (!storage?.getItem) throw Error();
      const raw = storage.getItem(SESSION_KEY);
      if (raw === null) return { value: null, status: meta.lastActorId ? 'lost' : 'missing' };
      let value; try { value = JSON.parse(raw); } catch { return { value: null, status: 'corrupt' }; }
      if (!value || !TOKEN.test(value.token) || !ID.test(value.user?.id) || !value.user?.avatar || typeof value.user.name !== 'string') return { value: null, status: 'corrupt' };
      return { value: { token: value.token, user: clone(value.user) }, status: 'unverified' };
    } catch { storageFailure(); return { value: null, status: 'storage-error' }; }
  }
  try {
    const saved = JSON.parse(storage?.getItem(EVENT_STORAGE_KEY) || 'null');
    if (saved?.version === 1) {
      if (ID.test(saved.meta?.lastActorId)) meta.lastActorId = saved.meta.lastActorId;
      for (const kind of ['profile', 'room', 'photo']) {
        if (saved.drafts?.[kind] && typeof saved.drafts[kind] === 'object') state.drafts[kind] = clone(saved.drafts[kind]);
        if (Number.isSafeInteger(saved.draftVersions?.[kind]) && saved.draftVersions[kind] >= 0) state.draftVersions[kind] = saved.draftVersions[kind];
        state.dirty[kind] = Boolean(saved.dirty?.[kind]);
      }
      for (const op of (Array.isArray(saved.operations) ? saved.operations : []).slice(0, 8)) if (validOperation(op)) operations.set(op.id, { ...op, status: op.status === 'failed' ? 'failed' : 'uncertain', durable: true, routeGeneration: -1, identityGeneration: -1 });
    }
  } catch { storageFailure(); }
  { const found = readSession(); session = found.value; state.identity = { status: found.status, user: clone(session?.user || null) };if(session&&meta.lastActorId!==session.user.id)clearVisibleDrafts(); }
  function readOperations({migrate=false}={}) {
    try {
      if(!storage?.key||!Number.isSafeInteger(storage.length))throw Error();
      if(migrate)for(const op of operations.values())if(storage.getItem(operationKey(op))===null)storage.setItem(operationKey(op),JSON.stringify({version:1,operation:savedOperation(op)}));
      for(let i=0;i<storage.length;i++){
        const key=storage.key(i);if(!key?.startsWith(EVENT_OPERATION_PREFIX))continue;
        let row;try{row=JSON.parse(storage.getItem(key)||'null');}catch{storageFailure();continue;}
        if(row?.version!==1)continue;
        if(row.done===true&&ID.test(row.id)&&key===EVENT_OPERATION_PREFIX+row.id){operations.delete(row.id);continue;}
        const op=row.operation;if(validOperation(op)&&key===operationKey(op)&&!running.has(op.id))operations.set(op.id,{...op,status:op.status==='failed'?'failed':'uncertain',durable:true,routeGeneration:-1,identityGeneration:-1});
      }
    }catch{storageFailure();}
  }
  readOperations({migrate:true});
  function assertLive() { if (disposed) fail('控制器已关闭。', 'DISPOSED');if(identitySuperseded)fail('浏览器身份已变化，请重新载入以核对新会话。','IDENTITY_CHANGED'); }
  function invalidateRecap() { recapGeneration++; recapReadSequence++; reads.get('recap')?.abort(); reads.delete('recap'); }
  function clearRoomRecap() { invalidateRecap(); state.recap = emptyRecap(); emit(); return getState(); }
  function clearPrivate() { invalidateRecap(); state.recap = emptyRecap(); socialGeneration++; hiddenPeers.clear(); socialPeerChanges.clear(); state.social = emptySocial(); photoChanges.clear(); roomChanges.clear(); state.room = null; state.members = []; state.photos = []; state.myRooms = { items: [], nextCursor: null }; state.myPhotos = { items: [], nextCursor: null }; }
  function report(error, token, applicable = true) {
    if (token && token === session?.token && error.status === 401) { state.identity.status = 'invalid'; identityGeneration++; for (const abort of reads.values()) abort.abort(); clearPrivate(); }
    if (applicable) {
      state.error = summaryError(error);
      if (['NETWORK', 'TIMEOUT'].includes(error.code) || error.status >= 500) state.connection = 'offline';
    }
    emit();
  }
  function clearVisibleDrafts(){
    state.drafts={profile:null,room:null,photo:null};state.dirty={profile:false,room:false,photo:false};
    for(const kind of ['profile','room','photo'])state.draftVersions[kind]++;
  }
  // Other tabs share the anonymous browser identity. Once credentials change,
  // this controller becomes read/write-inert; a new controller verifies them.
  function syncStoredIdentity() {
    if(disposed||identitySuperseded)return false;const found=readSession();
    if(session?.token===found.value?.token&&session?.user.id===found.value?.user.id)return false;
    identitySuperseded=true;identityGeneration++;generation++;
    for(const abort of reads.values())abort.abort();reads.clear();
    for(const {abort} of running.values())abort.abort();clearPrivate();
    session=found.value;state.identity={status:found.status,user:null,requiresReload:true};
    state.route={kind:'home',target:null};state.preview=null;state.lastResult=null;state.error=null;clearVisibleDrafts();
    emit();return true;
  }
  function storedIdentityMatches() {return !syncStoredIdentity();}
  function identity() {
    assertLive();
    if (!storedIdentityMatches()) fail('浏览器身份已丢失或改变。请重新检查身份；昵称不能找回旧记录。', 'IDENTITY_CHANGED');
    if (state.identity.status !== 'ready') fail('请先连接并确认当前浏览器身份。不会自动替换旧身份。', 'IDENTITY_REQUIRED');
    return { token: session.token, user: clone(session.user), epoch: identityGeneration };
  }
  function navigate(kind, target) {
    generation++; reads.get('navigation')?.abort(); reads.delete('navigation'); reads.get('socialPeer')?.abort(); reads.delete('socialPeer');
    invalidateRecap(); state.recap = emptyRecap();
    state.route = { kind, target }; state.room = null; state.preview = null; state.members = []; state.photos = []; state.error = null; emit();
    return generation;
  }
  function matches(op) { return op.routeGeneration === generation && op.identityGeneration === identityGeneration && (!op.actorId || op.actorId === session?.user.id); }
  async function read(label, request, apply, valid = () => true, token) {
    assertLive(); reads.get(label)?.abort(); const abort = new AbortController(); reads.set(label, abort); state.error = null; emit();
    try {
      const result = await request(abort.signal);
      if(token&&syncStoredIdentity())return {applied:false};
      if (reads.get(label) !== abort || abort.signal.aborted || !valid() || disposed || identitySuperseded) return { applied: false };
      state.connection = 'connected'; apply(result); emit(); return { ...result, applied: true };
    } catch (error) { if(token)syncStoredIdentity();if (reads.get(label) === abort && !abort.signal.aborted && valid() && !disposed) report(error, token); throw error; }
    finally { if (reads.get(label) === abort) { reads.delete(label); emit(); } }
  }
  function setDraft(kind, value) {
    assertLive(); if (!['profile', 'room', 'photo'].includes(kind)) fail('草稿类型无效。');
    state.drafts[kind] = clone(value); state.draftVersions[kind]++; state.dirty[kind] = true; persist(); emit(); return getState();
  }
  async function connect() {
    assertLive();syncStoredIdentity();assertLive();const found=readSession();
    // Rechecking an already verified, unchanged credential is a transport
    // recovery, not an identity replacement. A real401 still clears it below.
    const keepVerified = state.identity.status === 'ready' && session?.token && session.token === found.value?.token && session.user.id === found.value?.user.id;
    if (session?.token !== found.value?.token) { identityGeneration++; clearPrivate(); }
    session = found.value; state.identity = { status: keepVerified ? 'ready' : found.status, user: clone(session?.user || null) }; state.connection = 'connecting'; const epoch = identityGeneration, token = session?.token;
    return read('connect', async signal => {
      await api.request('/health', { signal });
      if (!syncStoredIdentity()&&epoch === identityGeneration && token === session?.token) { state.connection = 'connected'; emit(); }
      return token ? { user: (await api.request('/session', { namespace: 'avatar', token, signal })).user } : {};
    }, result => {
      if (token) {
        if (result.user.revision < session.user.revision) return;
        session.user = clone(result.user); state.identity = { status: 'ready', user: clone(result.user) }; meta.lastActorId = result.user.id;
        try { storage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { storageFailure(); }
        if (!state.dirty.profile) state.drafts.profile = { name: result.user.name, avatar: clone(result.user.avatar) };
        persist();
      }
    }, () => epoch === identityGeneration && token === session?.token, token);
  }
  async function previewRoom(value) {
    const code = String(value).trim().toUpperCase(); if (!CODE.test(code)) fail('请输入 12 位现场邀请码。');
    const gen = navigate('preview', code);
    return read('navigation', signal => api.request('/preview/' + code, { signal }), result => { state.preview = result.preview; }, () => gen === generation);
  }
  function reconcilePhotos(incoming, since, roomId = null) {
    const result = new Map(incoming.map(p => [p.id, p]));
    for (const [id, change] of photoChanges) {
      if (change.sequence <= since) continue;
      if (!change.photo) result.delete(id);
      else if (!roomId || change.photo.roomId === roomId) result.set(id, clone(change.photo));
    }
    return [...result.values()];
  }
  function roomResponse(result, since) {
    if (state.room?.id !== result.room.id || state.room.revision <= result.room.revision) state.room = result.room;
    state.members = result.members.filter(member => !hiddenPeers.has(member.id)); state.photos = reconcilePhotos(result.photos, since, result.room.id).filter(photo => !hiddenPeers.has(photo.ownerId));
  }
  async function openRoom(id) {
    if (!ID.test(id)) fail('现场编号无效。'); const actor = identity(), gen = navigate('room', id), since = writeSequence;
    return read('navigation', signal => api.request('/rooms/' + id, { token: actor.token, signal }), result => roomResponse(result, since), () => gen === generation && actor.epoch === identityGeneration, actor.token);
  }
  async function refreshRoom() {
    const id = state.route.target; if (state.route.kind !== 'room' || !ID.test(id)) fail('请先选择一个现场。', 'TARGET_REQUIRED');
    const actor = identity(), gen = generation, since = writeSequence;
    return read('navigation', signal => api.request('/rooms/' + id, { token: actor.token, signal }), result => roomResponse(result, since), () => gen === generation && actor.epoch === identityGeneration, actor.token).catch(error => {
      if (gen === generation && error.status === 404) { state.room = null; state.members = []; state.photos = []; emit(); } throw error;
    });
  }
  function validateRecap(result, roomId, actorId, cursors) {
    const validPage = (page, kind) => page && Array.isArray(page.items) && page.items.length <= 24
      && (page.nextCursor === null || RECAP_ID.test(page.nextCursor))
      && new Set(page.items.map(item => item?.id)).size === page.items.length
      && page.items.every((item, index) => item && RECAP_ID.test(item.id) && item.roomId === roomId
        && (!cursors[kind] || item.id > cursors[kind]) && (!index || item.id > page.items[index - 1].id)
        && Number.isSafeInteger(item.revision) && item.revision > 0
        && (kind === 'photos' ? RECAP_ID.test(item.ownerId) && ['private', 'members'].includes(item.visibility)
          && (item.ownerId === actorId || result.room.joined && item.visibility === 'members')
          : RECAP_ID.test(item.userId) && item.userId !== actorId && item.peer?.id === item.userId && typeof item.peer.name === 'string' && item.peer.avatar && typeof item.peer.avatar === 'object'))
      && (page.nextCursor === null || page.items.length === 24 && page.nextCursor === page.items.at(-1).id);
    if (result.actorId !== actorId || !result.room || result.room.id !== roomId || typeof result.room.joined !== 'boolean'
      || !validPage(result.photos, 'photos') || !validPage(result.friends, 'friends')) fail('回顾服务返回了无法核对的身份、现场或分页内容。', 'INVALID_RESPONSE');
  }
  async function loadRoomRecap(roomId, { photosCursor = null, friendsCursor = null } = {}) {
    if (!RECAP_ID.test(roomId) || [photosCursor, friendsCursor].some(cursor => cursor !== null && !RECAP_ID.test(cursor))) fail('现场回顾或分页位置无效。');
    const actor = identity(), changed = state.recap.roomId !== roomId || state.recap.photosCursor !== photosCursor || state.recap.friendsCursor !== friendsCursor;
    if (changed) { invalidateRecap(); state.recap = { ...emptyRecap(), actorId: actor.user.id, roomId, photosCursor, friendsCursor }; }
    else { reads.get('recap')?.abort(); reads.delete('recap'); }
    const epoch = recapGeneration, sequence = ++recapReadSequence;
    const valid = () => actor.epoch === identityGeneration && epoch === recapGeneration && sequence === recapReadSequence && state.recap.roomId === roomId;
    const query = [photosCursor && `photosCursor=${photosCursor}`, friendsCursor && `friendsCursor=${friendsCursor}`].filter(Boolean).join('&');
    return read('recap', signal => api.request(`/rooms/${roomId}/recap${query ? '?' + query : ''}`, { token: actor.token, signal }), result => {
      validateRecap(result, roomId, actor.user.id, { photos: photosCursor, friends: friendsCursor });
      // Replace only this page. Global library/room reconciliation would append
      // writes from a different page and destroy the server's cursor boundary.
      state.recap = { actorId: result.actorId, roomId, room: result.room,
        photos: { ...result.photos, items: result.photos.items.filter(photo => !hiddenPeers.has(photo.ownerId)) },
        friends: { ...result.friends, items: result.friends.items.filter(friend => !hiddenPeers.has(friend.userId)) },
        photosCursor, friendsCursor, loaded: true };
    }, valid, actor.token).catch(error => {
      if (valid() && [403, 404].includes(error.status)) { invalidateRecap(); state.recap = emptyRecap(); emit(); }
      throw error;
    });
  }
  function refreshRoomRecap() {
    if (!state.recap.roomId) fail('请先选择要回顾的现场。', 'TARGET_REQUIRED');
    return loadRoomRecap(state.recap.roomId, { photosCursor: state.recap.photosCursor, friendsCursor: state.recap.friendsCursor });
  }
  function reconcileRooms(incoming, since) {
    const result = new Map(incoming.map(room => [room.id, room]));
    for (const [id, change] of roomChanges) if (change.sequence > since) {
      if (change.room) result.set(id, clone(change.room)); else result.delete(id);
    }
    return [...result.values()];
  }
  async function loadList(kind, { cursor = null } = {}) {
    if (cursor && !ID.test(cursor)) fail('分页位置无效。'); const actor = identity(), label = kind === 'rooms' ? 'myRooms' : 'myPhotos', since = writeSequence;
    return read(label, signal => api.request('/' + kind + (cursor ? '?cursor=' + cursor : ''), { token: actor.token, signal }), result => {
      const items = cursor ? [...state[label].items, ...result[kind]] : result[kind];
      state[label] = { items: kind === 'photos' ? reconcilePhotos([...new Map(items.map(item => [item.id, item])).values()], since) : reconcileRooms([...new Map(items.map(item => [item.id, item])).values()], since), nextCursor: result.nextCursor };
    }, () => actor.epoch === identityGeneration, actor.token);
  }
  function invalidateSocial() {
    socialGeneration++;
    for (const label of ['social', 'socialPeer']) { reads.get(label)?.abort(); reads.delete(label); }
    socialPeerChanges.clear(); state.social.stale = true;
  }
  function hidePeer(userId) {
    if (!hiddenPeers.has(userId)) { photoPrivacyGeneration++; invalidateRecap(); }
    hiddenPeers.add(userId);
    state.members = state.members.filter(member => member.id !== userId);
    state.photos = state.photos.filter(photo => photo.ownerId !== userId);
    state.social.incoming = state.social.incoming.filter(item => item.senderId !== userId);
    state.social.outgoing = state.social.outgoing.filter(item => item.recipientId !== userId);
    state.social.friends = state.social.friends.filter(item => item.userId !== userId);
    state.recap.photos.items = state.recap.photos.items.filter(photo => photo.ownerId !== userId);
    state.recap.friends.items = state.recap.friends.items.filter(friend => friend.userId !== userId);
  }
  function retainRecapFriends(allowed) {
    const remaining = state.recap.friends.items.filter(allowed);
    if (remaining.length !== state.recap.friends.items.length) { invalidateRecap(); state.recap.friends.items = remaining; }
  }
  async function loadSocial({ kind = null, cursor = null } = {}) {
    if (kind !== null && !socialKinds.includes(kind) || cursor !== null && (!kind || !ID.test(cursor))) fail('社交列表分页位置无效。');
    const actor = identity(), epoch = socialGeneration, sequence = ++socialReadSequence;
    return read('social', signal => api.request('/social' + (cursor ? `?${kind}Cursor=${cursor}` : ''), { token: actor.token, signal }), result => {
      if (result.actorId !== actor.user.id || socialKinds.some(key => !Array.isArray(result[key])) || !result.nextCursors) fail('社交服务返回了无法核对的身份或列表。', 'INVALID_RESPONSE');
      const lists = Object.fromEntries(socialKinds.map(key => [key, result[key]]));
      if (cursor) {
        const keyOf = item => kind === 'blocks' ? item.userId : item.id;
        const combined = new Map(state.social[kind].map(item => [keyOf(item), item]));
        for (const item of result[kind]) { const current = combined.get(keyOf(item)); if (!current || current.revision <= item.revision) combined.set(keyOf(item), item); }
        lists[kind] = [...combined.values()];
      }
      // A newer canonical peer read can disprove an older global snapshot.
      // Overlay only those reads, never revive a cached page absent from a new snapshot.
      for (const [userId, change] of socialPeerChanges) if (change.sequence > sequence) {
        for (const key of socialKinds) lists[key] = [...lists[key].filter(item => item.peer.id !== userId), ...change.lists[key]];
      }
      socialSnapshotSequence = sequence;
      state.social = { actorId: result.actorId, ...lists, nextCursors: result.nextCursors, focusedPeer: state.social.focusedPeer, loaded: true, stale: false };
      if (!cursor && !result.nextCursors.friends) retainRecapFriends(friend => lists.friends.some(current => current.userId === friend.userId && current.id === friend.id));
      // A complete first block page can release conservative hides after an
      // unblock/replay. An unfinished page must not unhide unseen blocked peers.
      if (!cursor && !result.nextCursors.blocks) {
        const blocked = new Set(state.social.blocks.map(block => block.userId));
        for (const id of hiddenPeers) if (!blocked.has(id)) hiddenPeers.delete(id);
      }
      for (const block of state.social.blocks) hidePeer(block.userId);
    }, () => actor.epoch === identityGeneration && epoch === socialGeneration && storedIdentityMatches(), actor.token).catch(error => {
      if (actor.epoch === identityGeneration && epoch === socialGeneration && error.code !== 'ABORTED') { state.social.stale = true; emit(); }
      throw error;
    });
  }
  async function loadSocialPeer(userId) {
    const actor = identity();
    if (!ID.test(userId) || userId === actor.user.id) fail('请选择另一位观众。');
    const epoch = socialGeneration, gen = generation, sequence = ++socialReadSequence;
    socialPeerRequestSequence = sequence;
    const valid = () => actor.epoch === identityGeneration && epoch === socialGeneration && gen === generation && sequence === socialPeerRequestSequence && sequence >= socialSnapshotSequence && storedIdentityMatches();
    if (state.social.focusedPeer?.id !== userId) state.social.focusedPeer = null;
    const merge = (peer, lists) => {
      for (const kind of socialKinds) state.social[kind] = [...state.social[kind].filter(item => item.peer.id !== userId), ...lists[kind]];
      state.social.actorId = actor.user.id; state.social.focusedPeer = peer;
      socialPeerChanges.set(userId, { sequence, lists: clone(lists) });
      retainRecapFriends(friend => friend.userId !== userId || lists.friends.some(current => current.id === friend.id));
      if (lists.blocks.length) hidePeer(userId); else hiddenPeers.delete(userId);
    };
    return read('socialPeer', signal => api.request('/social/peers/' + userId, { token: actor.token, signal }), result => {
      if (result.actorId !== actor.user.id || result.peer?.id !== userId || socialKinds.some(kind => !Array.isArray(result[kind]) || result[kind].length > 1 || result[kind].some(item => item.peer?.id !== userId))) fail('社交服务返回了无法核对的成员资料。', 'INVALID_RESPONSE');
      merge(result.peer, Object.fromEntries(socialKinds.map(kind => [kind, result[kind]])));
    }, valid, actor.token).catch(error => {
      // A no-longer-visible peer cannot retain an actionable cached relation.
      // A removed/rejected but visible peer returns 200 and keeps its header.
      if (error.status === 404 && valid() && !disposed) {
        merge(null, Object.fromEntries(socialKinds.map(kind => [kind, []]))); hidePeer(userId); emit();
      }
      throw error;
    });
  }
  async function reconcileSocialOperation(op, result = null) {
    if (op.actorId !== session?.user.id || state.identity.status !== 'ready' || !storedIdentityMatches()) return false;
    const actorEpoch = identityGeneration;
    invalidateSocial();
    // Receipts are idempotent historical facts, not current relationship state.
    // Apply only a conservative block hide before fetching canonical state.
    if (op.type === 'blockUser' && result?.block) hidePeer(op.target.userId);
    if (op.type === 'removeFriend' && result) { invalidateRecap(); state.recap.friends.items = state.recap.friends.items.filter(friend => friend.userId !== op.target.userId); }
    emit();
    const jobs = [loadSocial()];
    if (state.route.kind === 'room' && state.room?.id === state.route.target) jobs.push(refreshRoom());
    if (state.recap.roomId) jobs.push(refreshRoomRecap());
    await Promise.allSettled(jobs);
    return actorEpoch === identityGeneration && op.actorId === session?.user.id && state.identity.status === 'ready';
  }
  function socialItem(kind, id, revision) {
    identity();
    const found = state.social[kind].find(item => (kind === 'friends' || kind === 'blocks' ? item.userId : item.id) === id);
    if ((!state.social.loaded && state.social.focusedPeer?.id !== found?.peer?.id) || state.social.actorId !== session.user.id || !found) fail('请先读取这条招呼、朋友或屏蔽记录。', 'SOCIAL_REQUIRED');
    if (!Number.isSafeInteger(revision) || revision !== found.revision) fail('这条社交记录已变化，请重新确认。', 'REVIEW_STALE');
    return found;
  }
  function peerTarget(userId) {
    const actor = identity();
    if (!ID.test(userId) || userId === actor.user.id) fail('请选择另一位观众。');
    const member = state.members.find(item => item.id === userId);
    const item = [...state.social.incoming, ...state.social.outgoing, ...state.social.friends, ...state.social.blocks].find(item => item.peer?.id === userId);
    const peer = member || item?.peer || state.recap.friends.items.find(friend => friend.userId === userId)?.peer || (state.social.focusedPeer?.id === userId ? state.social.focusedPeer : null);
    if (!peer) fail('请先读取要操作的这位观众。', 'PERSON_REQUIRED');
    return { userId, name: peer.name };
  }
  function requireTarget(id) { if (state.route.kind !== 'room' || state.route.target !== id || state.room?.id !== id) fail('现场已经切换，请重新确认本次操作的目标。', 'TARGET_CHANGED'); }
  function photo(id, revision, { recap = false } = {}) {
    const recapPhotos = recap && state.recap.loaded && state.recap.actorId === state.identity.user?.id ? state.recap.photos.items.filter(item => item.roomId === state.recap.roomId) : [];
    const found = [...state.photos, ...state.myPhotos.items, ...recapPhotos].filter(p => p.id === id).sort((a, b) => b.revision - a.revision)[0];
    if (!found || found.ownerId !== state.identity.user?.id) fail('请先读取自己的这张照片。', 'PHOTO_REQUIRED');
    if (!Number.isInteger(revision) || revision !== found.revision) fail('照片版本已变化，请重新确认。', 'REVIEW_STALE');
    return found;
  }
  function capture(type, path, body, target, draftKind = null) {
    assertLive(); const bootstrap = type === 'establishIdentity', actor = bootstrap ? null : identity();
    readOperations();
    const bodyJson = JSON.stringify(clone(body)), rule = signatures[type];
    const replacesActorId = bootstrap ? session?.user.id || meta.lastActorId || null : null;
    const existing = [...operations.values()].find(op => op.type === type && op.path === path && op.bodyJson === bodyJson && op.actorId === (actor?.user.id || null) && op.replacesActorId === replacesActorId && op.status !== 'failed');
    if (existing) { existing.routeGeneration = generation; existing.identityGeneration = identityGeneration; return existing; }
    if (operations.size >= 8) fail('请先重试或处理尚未确认的操作。', 'PENDING_LIMIT');
    const op = { id: uuid(), key: uuid(), type, namespace: rule[0], method: rule[1], path, bodyJson, actorId: actor?.user.id || null, replacesActorId,
      target, draftKind, draftVersion: draftKind ? state.draftVersions[draftKind] : null, status: 'prepared', error: null, durable: true,
      routeGeneration: generation, identityGeneration };
    operations.set(op.id, op); persist(op); emit(); return op;
  }
  function operationIdentity(op) {
    if (op.type === 'establishIdentity') {
      if ((session?.user.id || meta.lastActorId || null) !== op.replacesActorId || state.identity.status === 'ready') fail('身份已经改变。旧操作不能建立或替换当前身份，请重新确认。', 'IDENTITY_CHANGED');
      return undefined;
    }
    const actor = identity();
    if (actor.user.id !== op.actorId) fail('此操作属于之前的身份，不能改用当前身份重试。草稿仍在，请重新确认一个新操作。', 'IDENTITY_CHANGED');
    return actor.token;
  }
  function clearSubmittedDraft(op) {
    if (!op.draftKind || state.draftVersions[op.draftKind] !== op.draftVersion) return;
    const payload = JSON.parse(op.bodyJson), draft = state.drafts[op.draftKind];
    const reviewed = op.type === 'saveProfile' ? { name: payload.name, avatar: payload.avatar } : op.type === 'uploadPhoto' ? { roomId: op.target, dataUrl: payload.dataUrl, visibility: payload.visibility } : op.type === 'createRoom' ? { title: payload.title, venue: payload.venue || '', songId: payload.songId } : payload;
    if (same(draft, reviewed)) state.dirty[op.draftKind] = false;
  }
  function recapMutation(op, result) {
    if (!state.recap.roomId || state.recap.roomId !== op.target) return;
    if (result.photo && result.photo.roomId === op.target && result.photo.ownerId === op.actorId) {
      invalidateRecap();
      const previous = photoChanges.get(result.photo.id);
      const current = [...state.photos, ...state.myPhotos.items, ...state.recap.photos.items].filter(item => item.id === result.photo.id).sort((a, b) => b.revision - a.revision)[0];
      if (previous?.photo === null || (previous?.photo?.revision || 0) > result.photo.revision || (current?.revision || 0) > result.photo.revision) return;
      state.recap.photos.items = state.recap.photos.items.map(item => item.id === result.photo.id ? result.photo : item);
    }
    if (op.type === 'removePhoto') { invalidateRecap(); state.recap.photos.items = state.recap.photos.items.filter(item => item.id !== result.photoId); }
    if (op.type === 'closeRoom' && result.room?.id === op.target) {
      invalidateRecap(); if (state.recap.room && state.recap.room.revision <= result.room.revision) state.recap.room = result.room;
    }
    if (op.type === 'leaveRoom') {
      invalidateRecap(); if (state.recap.room) state.recap.room = { ...state.recap.room, joined: false };
      state.recap.photos.items = state.recap.photos.items.filter(item => item.ownerId === op.actorId).map(item => item.visibility === 'members' ? { ...item, visibility: 'private', revision: item.revision + 1 } : item);
    }
  }
  async function adopt(op, result) {
    if(syncStoredIdentity()||identitySuperseded)return false;
    const applicable = matches(op);
    if (op.type === 'establishIdentity') {
      if ((session?.user.id || meta.lastActorId || null) !== op.replacesActorId || state.identity.status === 'ready') return false;
      const priorActor=session?.user.id||meta.lastActorId;
      // Identity durability is required: retrying the same bootstrap key can recover
      // this exact capability if saving the response was interrupted or failed.
      try { storage.setItem(SESSION_KEY, JSON.stringify({ token: result.token, user: result.user })); } catch { storageFailure(); throw new EventClientError('身份已经建立，但浏览器未能保存。请保留原操作重试，不要新建另一份身份。', { code: 'IDENTITY_NOT_SAVED', retryable: true, uncertain: true }); }
      session = { token: result.token, user: clone(result.user) }; identityGeneration++; meta.lastActorId = result.user.id;
      state.identity = { status: 'ready', user: clone(result.user) }; clearPrivate();if(priorActor&&priorActor!==result.user.id)clearVisibleDrafts();
      if (!state.dirty.profile) state.drafts.profile = { name: result.user.name, avatar: clone(result.user.avatar) };
      return true;
    }
    if (op.actorId !== session?.user.id || state.identity.status !== 'ready') return false;
    if (op.type === 'saveProfile' && result.user.revision >= session.user.revision) { session.user = clone(result.user); state.identity.user = clone(result.user); try { storage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { storageFailure(); } }
    if (socialTypes.has(op.type)) return reconcileSocialOperation(op, result);
    if(op.type==='setParticipation'){invalidateSocial();const jobs=[loadSocial()];if(state.route.kind==='room'&&state.room?.id===op.target)jobs.push(refreshRoom());await Promise.allSettled(jobs);return applicable&&matches(op);}
    // Privacy changes still apply to an independently opened recap when a
    // same-identity mutation completes after navigation moved elsewhere.
    recapMutation(op, result);
    if (!applicable) return false;
    if (result.photo) {
      const previous = photoChanges.get(result.photo.id);
      const current = [...state.photos, ...state.myPhotos.items, ...state.recap.photos.items].filter(p => p.id === result.photo.id).sort((a, b) => b.revision - a.revision)[0];
      if (previous?.photo === null || (previous?.photo?.revision || 0) > result.photo.revision || (current?.revision || 0) > result.photo.revision) return false;
      photoChanges.set(result.photo.id, { photo: clone(result.photo), sequence: ++writeSequence });
      state.photos = state.photos.filter(p => p.id !== result.photo.id); if (state.room?.id === result.photo.roomId) state.photos.push(result.photo);
      state.myPhotos.items = state.myPhotos.items.map(p => p.id === result.photo.id ? result.photo : p);
    }
    if (op.type === 'removePhoto') { photoChanges.set(result.photoId, { photo: null, sequence: ++writeSequence }); state.photos = state.photos.filter(p => p.id !== result.photoId); state.myPhotos.items = state.myPhotos.items.filter(p => p.id !== result.photoId); }
    if (op.type === 'closeRoom') {
      roomChanges.set(result.room.id, { room: clone(result.room), sequence: ++writeSequence });
      if (state.room?.id === result.room.id) state.room = result.room;
      state.myRooms.items = state.myRooms.items.map(r => r.id === result.room.id ? result.room : r);
    }
    if (op.type === 'leaveRoom') {
      const oldRoom = state.room?.id === op.target ? state.room : state.myRooms.items.find(r => r.id === op.target);
      roomChanges.set(op.target, { room: oldRoom ? { ...oldRoom, joined: false } : null, sequence: ++writeSequence });
      for (const p of [...state.photos, ...state.myPhotos.items]) if (p.roomId === op.target && p.ownerId === op.actorId && p.visibility === 'members') photoChanges.set(p.id, { photo: { ...p, visibility: 'private', revision: p.revision + 1 }, sequence: ++writeSequence });
      state.myRooms.items = state.myRooms.items.map(r => r.id === op.target ? { ...r, joined: false } : r);
      if (oldRoom && !state.myRooms.items.some(r => r.id === op.target)) state.myRooms.items.unshift({ ...oldRoom, joined: false });
      state.myPhotos.items = state.myPhotos.items.map(p => p.roomId === op.target && p.visibility === 'members' ? { ...p, visibility: 'private', revision: p.revision + 1 } : p);
      if (state.route.target === op.target) navigate('home', null);
    }
    return true;
  }
  function execute(op) {
    assertLive(); if (running.has(op.id)) return running.get(op.id).promise;
    if(operationDone(op)){readOperations();emit();return Promise.resolve({operationId:op.id,applied:false,settledElsewhere:true});}
    const priorUncertain = ['uncertain','cancelled'].includes(op.status) || Boolean(op.error?.uncertain);
    let token; try { token = operationIdentity(op); } catch (error) { error.operationId = op.id; report(error); return Promise.reject(error); }
    if (!persist(op)) {
      const error = new EventClientError('浏览器无法保存原操作的重试信息，请先恢复本机存储。当前草稿仍在，尚未发送新的请求。', { code: 'STORAGE_REQUIRED', retryable: true, operationId: op.id }); report(error); return Promise.reject(error);
    }
    if (socialTypes.has(op.type)) invalidateSocial();
    const abort = new AbortController(); op.status = 'running'; op.error = null; state.error = null;
    if(!persist(op)){const error=new EventClientError('发送状态无法保存，请恢复本机存储后用原操作重试。',{code:'STORAGE_REQUIRED',retryable:true,operationId:op.id});report(error);return Promise.reject(error);}
    const entry = { abort, promise: null };
    entry.promise = (async () => {
      try {
        const result = await api.request(op.path, { namespace: op.namespace, method: op.method, bodyJson: op.bodyJson, token, key: op.key, signal: abort.signal });
        if(syncStoredIdentity()||identitySuperseded)throw new EventClientError('身份已变化，原操作保留给原身份确认。',{code:'IDENTITY_CHANGED',retryable:true,uncertain:true});
        if (abort.signal.aborted || disposed) throw new EventClientError('已停止等待。原操作仍可重试。', { code: 'ABORTED', retryable: true, uncertain: true });
        const applied = await adopt(op, result);
        if (op.type === 'establishIdentity' ? applied : op.actorId === session?.user.id) clearSubmittedDraft(op);
        operations.delete(op.id); if (!socialTypes.has(op.type) || !state.social.stale) state.connection = 'connected'; state.lastResult = { operationId: op.id, type: op.type, target: op.target, applied };
        persist(null,op); emit();
        if (applied && matches(op) && ['createRoom', 'joinRoom'].includes(op.type)) { try { await openRoom(result.room.id); } catch { /* Mutation succeeded; read failure is separately visible and retryable. */ } }
        const { token: _secret, ...publicResult } = result;
        return { ...publicResult, operationId: op.id, applied };
      } catch (error) {
        if(!disposed&&!identitySuperseded&&operationDone(op)){readOperations();emit();return {operationId:op.id,applied:false,settledElsewhere:true};}
        error.operationId = op.id;
        // Authentication/rate rejection of a retry can happen before the server
        // reaches the original idempotency receipt. It does not resolve an
        // earlier lost response. A first-attempt complete429 is still failed.
        if(priorUncertain&&(error.status<400||error.status>=500||[401,403,429].includes(error.status))){error.uncertain=true;error.retryable=true;}
        // A complete 429 response is a confirmed rejection. Being retryable
        // later is different from not knowing whether a write committed.
        op.status = op.status === 'cancelled' ? 'cancelled' : error.uncertain ? 'uncertain' : 'failed'; op.error = summaryError(error);
        persist(op);
        if (socialTypes.has(op.type) && [404, 409].includes(error.status)) await reconcileSocialOperation(op);
        if(op.type==='setParticipation'&&[404,409].includes(error.status)&&op.actorId===session?.user.id){invalidateSocial();const jobs=[loadSocial()];if(state.route.kind==='room'&&state.room?.id===op.target)jobs.push(refreshRoom());await Promise.allSettled(jobs);}
        syncStoredIdentity();report(error, token, socialTypes.has(op.type) ? op.actorId === session?.user.id : matches(op)); throw error;
      } finally { running.delete(op.id); emit(); }
    })();
    running.set(op.id, entry); emit(); return entry.promise;
  }
  function retainDraft(kind, value) { if (!state.dirty[kind] || state.drafts[kind] === null) setDraft(kind, value); }
  function establishIdentity(profile, { replaceInvalid = false } = {}) {
    assertLive();
    if (state.identity.status === 'ready' || state.identity.status === 'unverified') fail('当前已有浏览器身份，请先连接核对，不会自动新建。', 'IDENTITY_EXISTS');
    if (state.identity.status !== 'missing' && !replaceInvalid) fail('旧身份不能凭昵称恢复。新身份无法带回旧记录；请明确确认新建。', 'IDENTITY_REPLACEMENT_REQUIRED');
    if (!profile?.name || !profile.avatar) fail('请明确选择昵称和分身。');
    retainDraft('profile', { name: profile.name, avatar: clone(profile.avatar) });
    return execute(capture('establishIdentity', '/session', { name: profile.name, avatar: clone(profile.avatar) }, 'identity', 'profile'));
  }
  function saveProfile(profile, { revision } = {}) {
    const actor = identity(); if (revision !== actor.user.revision) fail('身份资料版本已变化，请重新确认。', 'REVIEW_STALE');
    retainDraft('profile', { name: profile.name, avatar: clone(profile.avatar) });
    return execute(capture('saveProfile', '/profile', { name: profile.name, avatar: clone(profile.avatar), revision }, 'identity', 'profile'));
  }
  function createRoom(payload) {
    identity(); if (payload?.joinConsent !== true) fail('请确认向本场成员展示昵称和分身。', 'JOIN_CONSENT_REQUIRED');
    retainDraft('room', { title: payload.title, venue: payload.venue || '', songId: payload.songId });
    navigate('create', null);
    return execute(capture('createRoom', '/rooms', { title: payload.title, venue: payload.venue || '', songId: payload.songId, joinConsent: true,participation:payload.participation||'quiet' }, 'create', 'room'));
  }
  function joinRoom(value, { joinConsent,participation='quiet' } = {}) {
    const code = String(value).trim().toUpperCase(); identity();
    if (state.route.kind !== 'preview' || state.route.target !== code || state.preview?.code !== code) fail('现场已经切换，请先查看这个邀请码的预览。', 'TARGET_CHANGED');
    if (joinConsent !== true) fail('请确认向本场成员展示昵称和分身。', 'JOIN_CONSENT_REQUIRED');
    return execute(capture('joinRoom', '/rooms/' + code + '/join', { joinConsent: true,participation }, code));
  }
  function setParticipation(mode,{roomId=state.room?.id,revision}={}){requireTarget(roomId);const actor=identity(),member=state.members.find(m=>m.id===actor.user.id);if(!['quiet','open'].includes(mode)||!member||revision!==member.participationRevision)fail('参与方式已变化，请重新确认。','REVIEW_STALE');return execute(capture('setParticipation',`/rooms/${roomId}/participation`,{mode,revision},roomId));}
  function uploadPhoto(dataUrl, value, { roomId = state.room?.id } = {}) {
    requireTarget(roomId); if (!['private', 'members'].includes(value)) fail('请明确选择仅自己可见或向本场成员展示。', 'VISIBILITY_REQUIRED');
    retainDraft('photo', { roomId, dataUrl, visibility: value });
    return execute(capture('uploadPhoto', `/rooms/${roomId}/photos`, { dataUrl, visibility: value }, roomId, 'photo'));
  }
  function setPhotoVisibility(id, value, { revision } = {}) { const found = photo(id, revision, { recap: value === 'private' }); if (!['private', 'members'].includes(value)) fail('照片可见范围无效。'); return execute(capture('setPhotoVisibility', '/photos/' + found.id, { revision, visibility: value }, found.roomId)); }
  function removePhoto(id, { revision } = {}) { const found = photo(id, revision, { recap: true }); return execute(capture('removePhoto', '/photos/' + found.id, { revision }, found.roomId)); }
  function withdrawPhoto(id, { revision } = {}) { const found = photo(id, revision, { recap: true }); return execute(capture('withdrawPhoto', '/photos/' + found.id + '/withdraw', { revision }, found.roomId)); }
  function leaveRoom(roomId = state.room?.id) { requireTarget(roomId); return execute(capture('leaveRoom', `/rooms/${roomId}/leave`, {}, roomId)); }
  function closeRoom(roomId = state.room?.id, { revision } = {}) {
    const room = state.room?.id === roomId ? state.room : state.myRooms.items.find(r => r.id === roomId);
    if (!room || room.role !== 'host' || revision !== room.revision) fail('请先读取自己创建的现场并确认当前版本。', 'REVIEW_STALE');
    return execute(capture('closeRoom', `/rooms/${roomId}/close`, { revision }, roomId));
  }
  function sendGreeting(recipientId, { roomId = state.room?.id } = {}) {
    requireTarget(roomId); const target = peerTarget(recipientId);
    if (!state.room.joined || state.room.status !== 'open' || !state.members.some(member => member.id === recipientId)) fail('请先进入双方都在的开放现场。', 'PERSON_REQUIRED');
    if(state.members.find(m=>m.id===state.identity.user.id)?.participation!=='open'||state.members.find(m=>m.id===recipientId)?.participation!=='open')fail('双方都选择愿意打招呼后，才可发起新联系。','PARTICIPATION_QUIET');
    return execute(capture('sendGreeting', `/rooms/${roomId}/greetings`, { recipientId }, { ...target, roomId }));
  }
  function respondGreeting(type, id, { revision } = {}) {
    const found = socialItem(type === 'cancelGreeting' ? 'outgoing' : 'incoming', id, revision);
    if (found.status !== 'pending') fail('这条招呼已经处理，请刷新后再确认。', 'REVIEW_STALE');
    const target = { userId: found.peer.id, name: found.peer.name, roomId: found.roomId, greetingId: found.id, revision };
    return execute(capture(type, `/greetings/${id}/${type.replace('Greeting', '')}`, { revision }, target));
  }
  function removeFriend(userId, { revision } = {}) {
    const found = socialItem('friends', userId, revision);
    return execute(capture('removeFriend', `/friends/${userId}`, { revision }, { userId, name: found.peer.name, roomId: found.roomId, revision }));
  }
  function blockUser(userId) { return execute(capture('blockUser', `/blocks/${userId}`, {}, peerTarget(userId))); }
  function unblockUser(userId, { revision } = {}) {
    const found = socialItem('blocks', userId, revision);
    return execute(capture('unblockUser', `/blocks/${userId}`, { revision }, { userId, name: found.peer.name, revision }));
  }
  async function fetchPhotoBlob(id, { signal, recapRoomId = null } = {}) {
    const actor = identity(), gen = generation, privacyEpoch = photoPrivacyGeneration, recapEpoch = recapGeneration;
    const validRecap = () => recapRoomId === null || state.recap.loaded && state.recap.actorId === actor.user.id && state.recap.roomId === recapRoomId
      && state.recap.photos.items.some(photo => photo.id === id && photo.roomId === recapRoomId && !hiddenPeers.has(photo.ownerId));
    if (recapRoomId !== null && (!RECAP_ID.test(recapRoomId) || !validRecap())) fail('这张照片已不在当前现场回顾中。', 'TARGET_CHANGED');
    try {
      const blob = await api.photoBlob(id, { token: actor.token, signal });
      syncStoredIdentity();
      if (gen !== generation || actor.epoch !== identityGeneration || disposed || privacyEpoch !== photoPrivacyGeneration || recapRoomId !== null && (recapEpoch !== recapGeneration || !validRecap())) fail('现场或可见范围已变化，旧照片不会展示。', 'TARGET_CHANGED');
      return blob;
    } catch (error) { syncStoredIdentity();report(error, actor.token, gen === generation && actor.epoch === identityGeneration); throw error; }
  }
  function retry(id) { const op = operations.get(id); if (!op) fail('原操作已完成或不存在。', 'OPERATION_NOT_FOUND'); return execute(op); }
  function cancel(id) {
    const op = operations.get(id); if (!visibleOperation(op)) return;
    if (op.status === 'failed' && !op.error?.uncertain) {operations.delete(id);persist(null,op);}
    else { op.status = 'cancelled'; running.get(id)?.abort.abort();persist(op); }
    emit();
  }
  function cancelNavigation() { navigate('home', null); }
  function reviewOperation(id) {
    const op = operations.get(id); if (!visibleOperation(op)) return null;
    return freeze({ ...pendingSummary(op), payload: JSON.parse(op.bodyJson) });
  }
  function dispose() { if (disposed) return; disposed = true; generation++; identityGeneration++; for (const abort of reads.values()) abort.abort(); for (const entry of running.values()) entry.abort.abort(); listeners.clear(); }
  return { getState, subscribe(listener) { assertLive(); listeners.add(listener); listener(getState()); return () => listeners.delete(listener); },
    connect, syncStoredIdentity, establishIdentity, saveProfile, setDraft, previewRoom, createRoom, joinRoom, openRoom, refreshRoom, setParticipation, uploadPhoto, setPhotoVisibility, removePhoto, withdrawPhoto,
    leaveRoom, closeRoom, loadMyRooms: options => loadList('rooms', options), loadMyPhotos: options => loadList('photos', options), loadRoomRecap, refreshRoomRecap, clearRoomRecap, fetchPhotoBlob,
    loadSocial, loadSocialPeer, sendGreeting, acceptGreeting: (id, options) => respondGreeting('acceptGreeting', id, options), rejectGreeting: (id, options) => respondGreeting('rejectGreeting', id, options),
    cancelGreeting: (id, options) => respondGreeting('cancelGreeting', id, options), removeFriend, blockUser, unblockUser,
    retry, cancel, cancelNavigation, reviewOperation, dispose };
}
