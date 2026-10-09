/**
 * What Music Space keeps in this browser, and the one time it reads anything it did not write.
 *
 * Space is served from the same origin as the separate Music Map product (musicmapteam.github.io), and localStorage
 * is shared by origin, not by path. Map owns 'music-map-space:v1' and strips any `space` field it finds there, so Space
 * must never write that key or 'music-map-live:v1'. It keeps its own keys instead and only READS the old ones,
 * once, to carry a 0.15 save over. The old keys are never changed or removed: they belong to Map.
 */
export const STATE_KEY = 'music-space:v1';
const SESSION_KEY = 'music-space-live:v1';
const LEGACY_STATE_KEY = 'music-map-space:v1';
const LEGACY_SESSION_KEY = 'music-map-live:v1';

const parse = raw => { try { return JSON.parse(raw); } catch { return null; } };
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Why the browser refused a write, and what to tell the visitor. 'quota' means this save is too big for the space the
 * browser gives the site (a photo is what makes it big); 'blocked' means the browser will not keep anything at all
 * (site data switched off, a sandboxed frame, some private modes), so a refresh loses the record.
 */
export const STORAGE_ADVICE = {
  quota: '照片太大，换一张或减少照片后重试',
  blocked: '浏览器禁止了本地存储，刷新后记录会丢失',
};

/** Classifies whatever a failed localStorage read or write threw: 'quota' or 'blocked'. */
export function storageFailureKind(error) {
  const name = String(error?.name || '');
  // Chromium and Safari: QuotaExceededError (code 22); Firefox: NS_ERROR_DOM_QUOTA_REACHED (code 1014).
  const full = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || error?.code === 22 || error?.code === 1014;
  return full ? 'quota' : 'blocked';
}

/**
 * Called once at boot, before anything reads state. A key is adopted only while Space's own key is absent, so a later
 * boot never overwrites what Space saved; if the write fails (storage full or blocked) Space simply starts clean.
 */
export function adoptLegacyStorage(isValidSpace) {
  try {
    if (localStorage.getItem(STATE_KEY) === null) {
      const old = parse(localStorage.getItem(LEGACY_STATE_KEY));
      if (isObject(old) && old.version === 1 && isValidSpace(old.space)) {
        localStorage.setItem(STATE_KEY, JSON.stringify({ version: old.version, view: 'space', actor: old.actor === 'b' ? 'b' : 'a', space: old.space }));
      }
    }
  } catch { /* Nothing to carry over, or storage is unavailable. */ }
  try {
    if (localStorage.getItem(SESSION_KEY) === null) {
      const raw = localStorage.getItem(LEGACY_SESSION_KEY);
      const token = parse(raw)?.token;
      if (typeof token === 'string' && token) localStorage.setItem(SESSION_KEY, raw);
    }
  } catch { /* The visitor just signs in again. */ }
}

/** The saved room identity, or null when there is none or the browser will not say. */
export function readSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
    return saved?.token ? saved : null;
  } catch { return null; }
}

/**
 * Throws when the browser refuses the write, so callers can report a failed save (storageFailureKind says why).
 * Signing out stores null rather than removing the key, because only an absent key may adopt a Map-era identity:
 * one the server dropped must not come back.
 */
export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session ?? null));
}
