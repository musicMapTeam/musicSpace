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
 * Throws when the browser refuses the write, so callers can report a failed save. Signing out stores null rather than
 * removing the key, because only an absent key may adopt a Map-era identity: one the server dropped must not come back.
 */
export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session ?? null));
}
