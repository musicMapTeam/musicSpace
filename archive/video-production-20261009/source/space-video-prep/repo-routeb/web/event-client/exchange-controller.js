import { createEventApiClient, EventClientError } from './api.js';

export const EXCHANGE_STORAGE_PREFIX = 'music-space-event-exchanges:v1:';
const SESSION_KEY = 'music-space-avatar-session:v1';
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const statuses = new Set(['pending', 'accepted', 'declined', 'cancelled', 'revoked', 'expired']);
const terminal = value => !['pending', 'accepted'].includes(value);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const fail = (message, code = 'INVALID_INPUT') => { throw new EventClientError(message, { code }); };
const errorValue = e => ({ message: e.message || '操作未完成', code: e.code || 'CLIENT_ERROR', status: e.status || 0, retryable: Boolean(e.retryable), uncertain: Boolean(e.uncertain), operationId: e.operationId || null });
const sessionValue = value => value && TOKEN.test(value.token) && ID.test(value.user?.id) ? { token: value.token, actorId: value.user.id } : null;
const positive = value => Number.isSafeInteger(value) && value > 0;
function createPayload(value) {
  if (!value || ![value.recipientId, value.offeredPhotoId, value.requestedPhotoId].every(id => ID.test(id)) || value.offeredPhotoId === value.requestedPhotoId || !positive(value.offeredRevision) || !positive(value.requestedRevision)) fail('请核对双方的两张照片及版本。');
  if (value.offerPreviewConsent !== true || value.offerOriginalConsent !== true) fail('请明确同意预览，以及对方接受后的指定原图分享。', 'EXCHANGE_CONSENT_REQUIRED');
  if (typeof value.offeredPreviewDataUrl !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.offeredPreviewDataUrl) || value.offeredPreviewDataUrl.length > 43715) fail('请从选中的照片生成限尺寸 JPEG 预览。', 'INVALID_PREVIEW');
  return Object.fromEntries(['recipientId', 'offeredPhotoId', 'requestedPhotoId', 'offeredRevision', 'requestedRevision', 'offerPreviewConsent', 'offerOriginalConsent', 'offeredPreviewDataUrl'].map(key => [key, value[key]]));
}
function validOperation(op) {
  if (!op || ![op.id, op.key, op.actorId].every(id => ID.test(id)) || typeof op.bodyJson !== 'string' || op.bodyJson.length > 45000) return false;
  try {
    const data = JSON.parse(op.bodyJson);
    if (op.type === 'create') return ID.test(op.roomId) && op.path === `/rooms/${op.roomId}/exchanges` && data.recipientId !== op.actorId && JSON.stringify(createPayload(data)) === op.bodyJson;
    return ['accept', 'decline', 'cancel', 'revoke'].includes(op.type) && ID.test(op.exchangeId) && op.path === `/exchanges/${op.exchangeId}/${op.type}` && positive(data.revision)
      && JSON.stringify(op.type === 'accept' ? { revision: data.revision, exchangeConsent: true } : { revision: data.revision }) === op.bodyJson;
  } catch { return false; }
}

/** Explicit, DOM-free directed exchanges. Canonical reads authorize image loads;
 * mutation receipts prove only that the exact operation previously committed.
 * No constructor request, automatic send, polling, object URL, or token in state. */
export function createExchangeController(options = {}) {
  let storage = options.storage;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  const api = options.api || createEventApiClient(options), listeners = new Set(), reads = new Map(), running = new Map(), operations = new Map(), known = new Map();
  const sourceSession = options.getSession || (() => { try { return JSON.parse(storage?.getItem(SESSION_KEY) || 'null'); } catch { return null; } });
  let disposed = false, session = null, identityEpoch = 0, navigationEpoch = 0, privacyEpoch = 0, mutationEpoch = 0;
  const state = { actorId: null, identityStatus: 'missing', list: { items: [], cursor: null, nextCursor: null, loaded: false }, current: null, error: null, lastResult: null,
    storage: { ok: true, refreshRecovery: true, message: null } };
  function getState() { return freeze(clone({ ...state, pending: [...operations.values()].filter(op => op.actorId === state.actorId).map(op => ({ id: op.id, type: op.type, actorId: op.actorId,
    roomId: op.roomId || null, exchangeId: op.exchangeId || null, status: op.status, error: op.error || null, durable: op.durable !== false,
    ...(op.type === 'create' ? { recipientId: JSON.parse(op.bodyJson).recipientId, offeredPhotoId: JSON.parse(op.bodyJson).offeredPhotoId, requestedPhotoId: JSON.parse(op.bodyJson).requestedPhotoId } : {}) })),
    loading: [...reads.keys(), ...[...running.keys()].filter(id => operations.get(id)?.actorId === state.actorId).map(id => 'operation:' + id)] })); }
  function emit() { if (!disposed) for (const listener of listeners) { try { listener(getState()); } catch { /* UI cannot change operation outcomes. */ } } }
  function assertLive() { if (disposed) fail('交换已关闭。', 'DISPOSED'); }
  function storageFailure() { state.storage = { ok: false, refreshRecovery: false, message: '无法保存原操作的重试编号。恢复本机存储后才能发送。' }; }
  function loadOperations(actorId) {
    if (!actorId) return;
    try {
      const prefix = EXCHANGE_STORAGE_PREFIX + actorId + ':';
      const keys = Array.from({ length: storage?.length || 0 }, (_, index) => storage.key(index)).filter(key => key?.startsWith(prefix));
      for (const key of keys) {
        const saved = JSON.parse(storage.getItem(key) || 'null'), op = saved?.operation;
        if (saved?.version === 1 && validOperation(op) && op.actorId === actorId && key === prefix + op.id && !operations.has(op.id)) operations.set(op.id, { ...op, mayHaveCommitted: op.mayHaveCommitted !== false, status: op.status === 'failed' ? 'failed' : 'uncertain', error: op.error || null, durable: true });
      }
    } catch { storageFailure(); }
  }
  function abortReads() { for (const abort of reads.values()) abort.abort(); reads.clear(); }
  function syncIdentity(value) {
    assertLive(); const observed = sessionValue(sourceSession()), supplied = arguments.length ? sessionValue(value) : observed;
    const found = supplied && (supplied.token !== observed?.token || supplied.actorId !== observed?.actorId) ? observed : supplied;
    if (found?.token !== session?.token || found?.actorId !== session?.actorId || state.identityStatus === 'invalid') {
      identityEpoch++; navigationEpoch++; privacyEpoch++; mutationEpoch++; abortReads(); known.clear();
      state.list = { items: [], cursor: null, nextCursor: null, loaded: false }; state.current = null; state.lastResult = null; state.error = null;
      session = found; state.actorId = found?.actorId || null; state.identityStatus = found ? 'ready' : 'missing'; loadOperations(state.actorId);
    }
    emit(); return getState();
  }
  function sameIdentity(actor) {
    if (disposed) return false;
    const found = sessionValue(sourceSession());
    if (found?.token !== session?.token || found?.actorId !== session?.actorId) syncIdentity();
    return actor.epoch === identityEpoch && actor.token === session?.token && actor.actorId === state.actorId;
  }
  function identity() {
    assertLive(); const found = sessionValue(sourceSession());
    if (found?.token !== session?.token || found?.actorId !== session?.actorId) { syncIdentity(); fail('浏览器身份已变化，请重新打开交换。', 'IDENTITY_CHANGED'); }
    if (!session || state.identityStatus !== 'ready') fail('请先核对当前浏览器身份。', 'IDENTITY_REQUIRED');
    return { ...session, epoch: identityEpoch };
  }
  function persist(actor, op = null, removeId = null) {
    if (!sameIdentity(actor)) return false;
    try {
      if (!storage?.setItem || !storage?.removeItem || !storage?.key || !Number.isSafeInteger(storage.length)) throw Error('Missing storage');
      // One atomic localStorage item per frozen operation. Concurrent tabs never
      // replace a shared outbox document and lose another tab's retry key.
      const prefix = EXCHANGE_STORAGE_PREFIX + actor.actorId + ':';
      if (removeId) storage.removeItem(prefix + removeId);
      else if (op) { const { durable, ...saved } = op; storage.setItem(prefix + op.id, JSON.stringify({ version: 1, operation: saved })); op.durable = true; }
      state.storage = { ok: true, refreshRecovery: true, message: null }; return true;
    } catch { storageFailure(); if (op) op.durable = false; return false; }
  }
  function report(error, actor) {
    if (!sameIdentity(actor)) return;
    if (error.status === 401 || error.code === 'ACTOR_MISMATCH') { identityEpoch++; navigationEpoch++; privacyEpoch++; abortReads(); known.clear(); state.current = null; state.list = { items: [], cursor: null, nextCursor: null, loaded: false }; state.identityStatus = 'invalid'; }
    state.error = errorValue(error); emit();
  }
  function rowValue(row, actorId) {
    if (!row || ![row.id, row.roomId, row.senderId, row.recipientId, row.offeredPhotoId, row.requestedPhotoId].every(id => ID.test(id)) || row.senderId === row.recipientId || row.offeredPhotoId === row.requestedPhotoId
      || ![row.senderId, row.recipientId].includes(actorId) || ![row.revision, row.offeredRevision, row.requestedRevision].every(positive) || !statuses.has(row.status)
      || !Number.isFinite(Date.parse(row.createdAt)) || !Number.isFinite(Date.parse(row.expiresAt)) || row.peer?.id !== (row.senderId === actorId ? row.recipientId : row.senderId) || typeof row.peer.name !== 'string' || !row.peer.avatar) fail('交换响应无法核对。', 'INVALID_RESPONSE');
    return Object.fromEntries(['id', 'roomId', 'senderId', 'recipientId', 'offeredPhotoId', 'requestedPhotoId', 'offeredRevision', 'requestedRevision', 'status', 'revision', 'createdAt', 'updatedAt', 'expiresAt', 'acceptedAt', 'endedAt', 'endReason', 'peer'].map(key => [key, clone(row[key])]));
  }
  function actorResponse(data, actor) { if (data.actorId !== actor.actorId) fail('服务返回的身份与当前身份不一致。', 'ACTOR_MISMATCH'); }
  function adopt(row) {
    const previous = known.get(row.id);
    if (previous && (previous.revision > row.revision || previous.revision === row.revision && terminal(previous.status) && !terminal(row.status))) return clone(previous);
    known.set(row.id, clone(row)); return row;
  }
  async function read(label, path, apply, { scoped = false } = {}) {
    const actor = identity(), nav = navigationEpoch, privacy = privacyEpoch, writes = mutationEpoch, abort = new AbortController();
    reads.get(label)?.abort(); reads.set(label, abort); emit();
    try {
      const data = await api.request(path, { token: actor.token, signal: abort.signal });
      if (!sameIdentity(actor) || reads.get(label) !== abort || abort.signal.aborted || privacy !== privacyEpoch || writes !== mutationEpoch || scoped && nav !== navigationEpoch) return { applied: false };
      actorResponse(data, actor); apply(data, actor); state.error = null; emit(); return { applied: true };
    } catch (error) { if (!sameIdentity(actor)) return { applied: false }; if (!abort.signal.aborted && (!scoped || nav === navigationEpoch)) report(error, actor); throw error; }
    finally { if (reads.get(label) === abort) reads.delete(label); emit(); }
  }
  function list({ cursor = null } = {}) {
    if (cursor !== null && !ID.test(cursor)) fail('分页位置无效。');
    return read('exchanges', '/exchanges' + (cursor ? '?cursor=' + cursor : ''), (data, actor) => {
      if (!Array.isArray(data.exchanges) || data.exchanges.length > 24 || data.nextCursor !== null && !ID.test(data.nextCursor)) fail('交换分页响应无效。', 'INVALID_RESPONSE');
      const rows = data.exchanges.map(row => rowValue(row, actor.actorId));
      if (new Set(rows.map(row => row.id)).size !== rows.length || data.nextCursor !== null && (rows.length !== 24 || data.nextCursor !== rows.at(-1).id)) fail('交换分页响应无效。', 'INVALID_RESPONSE');
      state.list = { items: rows.map(adopt), cursor, nextCursor: data.nextCursor, loaded: true };
      const current = state.current, updated = current && rows.find(row => row.id === current.id);
      if (updated && current.exchange && (updated.revision > current.exchange.revision || terminal(updated.status))) { state.current = { ...current, exchange: adopt(updated), confirmed: false }; privacyEpoch++; }
    });
  }
  function loadCurrent() {
    const id = state.current?.id; if (!id) fail('请先打开一项交换。', 'EXCHANGE_REQUIRED');
    return read('exchange', `/exchanges/${id}`, (data, actor) => {
      const row = rowValue(data.exchange, actor.actorId); if (row.id !== id) fail('交换编号不一致。', 'INVALID_RESPONSE');
      state.current = { id, exchange: adopt(row), confirmed: true };
    }, { scoped: true }).catch(error => { if (state.current?.id === id && [403, 404].includes(error.status)) { state.current = { id, exchange: null, confirmed: false }; privacyEpoch++; emit(); } throw error; });
  }
  function open(id) {
    identity(); if (!ID.test(id)) fail('交换编号无效。'); navigationEpoch++; abortReads(); state.current = { id, exchange: null, confirmed: false }; state.error = null; emit(); return loadCurrent();
  }
  function close() { assertLive(); navigationEpoch++; abortReads(); state.current = null; state.error = null; emit(); }
  function invalidatePermissions({ peerId = null, photoId = null, roomId = null, pendingOnly = false } = {}) {
    assertLive(); privacyEpoch++; mutationEpoch++; abortReads();
    const matches = row => row && (!peerId || row.peer.id === peerId) && (!photoId || [row.offeredPhotoId, row.requestedPhotoId].includes(photoId)) && (!roomId || row.roomId === roomId) && (!pendingOnly || row.status === 'pending');
    if (matches(state.current?.exchange)) state.current.confirmed = false;
    state.list.loaded = false; emit();
  }
  function detached(op) { op.status = 'uncertain'; op.error = errorValue(new EventClientError('身份已变化，原操作留给原身份确认。', { code: 'IDENTITY_CHANGED', retryable: true, uncertain: true })); return { operationId: op.id, applied: false }; }
  function validateReceipt(op, data, actor) {
    const row = rowValue(data.exchange, actor.actorId), payload = JSON.parse(op.bodyJson);
    if (op.type === 'create' ? row.senderId !== actor.actorId || row.roomId !== op.roomId || row.recipientId !== payload.recipientId || row.offeredPhotoId !== payload.offeredPhotoId || row.requestedPhotoId !== payload.requestedPhotoId || row.offeredRevision !== payload.offeredRevision || row.requestedRevision !== payload.requestedRevision : row.id !== op.exchangeId) fail('操作回执与原选择不一致。', 'INVALID_RESPONSE');
    return row.id;
  }
  function run(op) {
    const actor = identity(); if (op.actorId !== actor.actorId) fail('只能由原身份重试原操作。', 'IDENTITY_CHANGED');
    if (running.has(op.id)) return running.get(op.id).promise;
    const nav = navigationEpoch, abort = new AbortController(), priorUncertain = op.mayHaveCommitted === true; let postDispatched = false;
    mutationEpoch++; privacyEpoch++; abortReads(); if (state.current) state.current.confirmed = false;
    op.status = 'running'; op.error = null;
    if (!persist(actor, op)) { op.status = 'uncertain'; emit(); fail('原操作尚不能可靠保存，请恢复本机存储后重试。', 'STORAGE_REQUIRED'); }
    const entry = { abort, promise: null };
    entry.promise = (async () => {
      try {
        // Verify the token's actor before a write; a forged local profile cannot
        // make this controller send an operation under another authenticated ID.
        const check = await api.request('/exchanges', { token: actor.token, signal: abort.signal });
        if (!sameIdentity(actor)) return detached(op); actorResponse(check, actor);
        op.mayHaveCommitted = true;
        if (!persist(actor, op)) fail('原操作的发送状态不能保存，请恢复本机存储后重试。', 'STORAGE_REQUIRED');
        postDispatched = true;
        const data = await api.request(op.path, { method: 'POST', token: actor.token, key: op.key, bodyJson: op.bodyJson, signal: abort.signal });
        if (!sameIdentity(actor)) return detached(op);
        const exchangeId = validateReceipt(op, data, actor); operations.delete(op.id); persist(actor, null, op.id);
        const receipt = { operationId: op.id, type: op.type, exchangeId, committed: true, permissionConfirmed: false };
        state.lastResult = receipt; state.error = null; emit();
        if (nav === navigationEpoch) {
          state.current = { id: exchangeId, exchange: null, confirmed: false };
          try { await loadCurrent(); } catch { /* Receipt is real; current permission remains unconfirmed. */ }
          if (!sameIdentity(actor)) return { operationId: op.id, applied: false };
          receipt.permissionConfirmed = state.current?.id === exchangeId && state.current.confirmed;
        }
        emit(); return { ...clone(receipt), applied: nav === navigationEpoch };
      } catch (error) {
        if (!sameIdentity(actor)) return detached(op);
        if (!error.code) error = new EventClientError('连接没有确认结果，可用原操作重试。', { code: 'NETWORK', retryable: true, uncertain: true });
        if (error.code === 'INVALID_RESPONSE') { error.retryable = true; error.uncertain = true; }
        // A failed preflight says nothing about an earlier POST whose response
        // was lost. Preserve that original key until its own result is known.
        const definitivePostRejection = postDispatched && !error.uncertain && error.status >= 400 && error.status < 500 && ![401, 403, 429].includes(error.status);
        if (priorUncertain && !definitivePostRejection) { error.uncertain = true; error.retryable = true; }
        op.mayHaveCommitted = error.uncertain && (priorUncertain || postDispatched);
        error.operationId = op.id; op.status = error.uncertain ? 'uncertain' : 'failed'; op.error = errorValue(error); persist(actor, op); report(error, actor); throw error;
      } finally { running.delete(op.id); emit(); }
    })();
    running.set(op.id, entry); emit(); return entry.promise;
  }
  function queue(type, path, payload, target) {
    const actor = identity(), bodyJson = JSON.stringify(payload); loadOperations(actor.actorId);
    const existing = [...operations.values()].find(op => op.actorId === actor.actorId && (type === 'create' ? op.type === 'create' && op.roomId === target.roomId && JSON.parse(op.bodyJson).recipientId === payload.recipientId : op.exchangeId === target.exchangeId));
    if (existing) { if (existing.type === type && existing.bodyJson === bodyJson && running.has(existing.id)) return running.get(existing.id).promise; fail('已有待确认操作，请先确认原操作。', 'OPERATION_PENDING'); }
    if ([...operations.values()].filter(op => op.actorId === actor.actorId).length >= 8) fail('请先处理待确认操作。', 'OPERATION_PENDING');
    const op = { id: globalThis.crypto.randomUUID(), key: globalThis.crypto.randomUUID(), actorId: actor.actorId, type, path, bodyJson, ...target, mayHaveCommitted: false, status: 'uncertain', error: null };
    operations.set(op.id, op); if (!persist(actor, op)) { operations.delete(op.id); emit(); fail('重试编号无法保存，尚未发送。', 'STORAGE_REQUIRED'); } return run(op);
  }
  function create(roomId, payload) { const actor = identity(); if (!ID.test(roomId)) fail('现场编号无效。'); const data = createPayload(payload); if (data.recipientId === actor.actorId) fail('不能与自己交换。'); return queue('create', `/rooms/${roomId}/exchanges`, data, { roomId }); }
  function respond(action, { revision, exchangeConsent = false } = {}) {
    const actor = identity(), current = state.current, row = current?.exchange;
    const existing = [...operations.values()].find(op => op.actorId === actor.actorId && op.exchangeId === current?.id && op.type === action && JSON.parse(op.bodyJson).revision === revision);
    if (existing && running.has(existing.id) && (action !== 'accept' || exchangeConsent === true)) return running.get(existing.id).promise;
    if (!['accept', 'decline', 'cancel', 'revoke'].includes(action) || !current?.confirmed || !row || row.revision !== revision) fail('请重新读取并核对这项交换。', 'REVIEW_STALE');
    if (row.status !== (action === 'revoke' ? 'accepted' : 'pending') || action === 'cancel' && row.senderId !== actor.actorId || ['accept', 'decline'].includes(action) && row.recipientId !== actor.actorId) fail('当前不能进行这项操作。', 'EXCHANGE_UNAVAILABLE');
    if (action === 'accept' && exchangeConsent !== true) fail('请明确同意交换这两张指定照片。', 'EXCHANGE_CONSENT_REQUIRED');
    return queue(action, `/exchanges/${row.id}/${action}`, { revision, ...(action === 'accept' ? { exchangeConsent: true } : {}) }, { exchangeId: row.id });
  }
  function imageScope(kind, photoId) {
    const current = state.current, row = current?.exchange;
    if (!current?.confirmed || !row || (kind === 'preview' ? row.status !== 'pending' : kind !== 'photo' || row.status !== 'accepted' || ![row.offeredPhotoId, row.requestedPhotoId].includes(photoId))) fail('当前尚无可确认的照片访问权限。', 'EXCHANGE_UNAVAILABLE');
    return { id: row.id, revision: row.revision, status: row.status };
  }
  function imageKey({ kind = 'photo', photoId = null } = {}) { const actor = identity(), scope = imageScope(kind, photoId); return `${actor.actorId}:${scope.id}:${scope.revision}:${privacyEpoch}:${kind}:${photoId || ''}`; }
  async function fetchImage({ kind = 'photo', photoId = null, signal } = {}) {
    const actor = identity(), scope = imageScope(kind, photoId), key = imageKey({ kind, photoId }), nav = navigationEpoch, label = 'image:' + globalThis.crypto.randomUUID(), abort = new AbortController();
    const cancel = () => abort.abort(); if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true }); reads.set(label, abort);
    try {
      const blob = await api.request(`/exchanges/${scope.id}/${kind === 'preview' ? 'preview' : `photos/${photoId}/image`}`, { token: actor.token, signal: abort.signal, blob: true });
      if (!sameIdentity(actor) || abort.signal.aborted || nav !== navigationEpoch || key !== imageKey({ kind, photoId })) fail('身份或访问范围已变化，不展示旧照片。', 'TARGET_CHANGED');
      return blob;
    } catch (error) { if (sameIdentity(actor) && state.current?.id === scope.id && [403, 404].includes(error.status)) { state.current.confirmed = false; privacyEpoch++; emit(); } throw error; }
    finally { reads.delete(label); signal?.removeEventListener('abort', cancel); }
  }
  syncIdentity();
  return { getState, syncIdentity, list, open, refresh: loadCurrent, refreshList: () => list({ cursor: state.list.cursor }), create, respond, close, invalidatePermissions, imageKey, fetchImage,
    subscribe(listener) { assertLive(); listeners.add(listener); listener(getState()); return () => listeners.delete(listener); },
    retry(id) { const op = operations.get(id); if (!op) fail('原操作不存在。', 'OPERATION_NOT_FOUND'); return run(op); },
    stopWaiting(id) { identity(); const op = operations.get(id); if (op?.actorId === state.actorId) running.get(id)?.abort.abort(); },
    discard(id) { const actor = identity(), op = operations.get(id); if (!op || op.actorId !== actor.actorId || running.has(id) || op.status !== 'failed' || op.error?.uncertain) fail('结果未确认，请保留原操作。', 'OPERATION_UNCERTAIN'); operations.delete(id); persist(actor, null, id); emit(); },
    dispose() { if (disposed) return; disposed = true; identityEpoch++; navigationEpoch++; abortReads(); listeners.clear(); },
  };
}
