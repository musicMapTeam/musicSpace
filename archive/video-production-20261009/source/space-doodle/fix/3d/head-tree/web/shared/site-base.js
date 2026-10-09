/**
 * Where the site's root is, for every URL a page builds itself (another page, a model file, a wasm file).
 *
 * The Node room server serves each app at its own root-absolute path (/event-room/, /music-map/), so a page without hints
 * has its root at "/" and nothing changes. A static build (GitHub Pages under /musicSpace/ and /musicSpace/preview/) writes
 * <meta name="space-site-root" content="./"> (or "../" for a page one directory down) and
 * <meta name="space-event-room" content="./">, so every link is relative to the page and works under any prefix.
 * Hints resolve against document.baseURI; a query string or hash on the page never reaches the result.
 *
 * No dependencies: this file is bundled into the event room, the Map and (through them) the static build.
 */
const baseOf = doc => doc?.baseURI || globalThis.location?.href || 'http://localhost/';
const hintOf = (doc, name) => doc?.querySelector?.(`meta[name="${name}"]`)?.content?.trim() || '';

/** The site root as a URL object: the space-site-root hint, else "/" on the page's own origin. */
export function siteRoot(doc = globalThis.document) {
  return new URL(hintOf(doc, 'space-site-root') || '/', baseOf(doc));
}

/** An absolute URL for a path below the site root, e.g. siteUrl('music-map/') or siteUrl('sql/sql-wasm.wasm'). */
export const siteUrl = (path = '', doc = globalThis.document) => new URL(String(path).replace(/^\/+/, ''), siteRoot(doc)).href;

/**
 * The event-room entry, the target of the Map's "back to the scene" bar: '/event-room/' on the Node server, the page that
 * carries the room (the site root of a static build) when the space-event-room hint is present.
 */
export function eventRoomUrl(doc = globalThis.document) {
  return new URL(hintOf(doc, 'space-event-room') || '/event-room/', baseOf(doc)).href;
}

/**
 * Where the Map's "back to the scene" button may go. The scene stored its own address when it opened the Map; that address is
 * honoured only when it is on this origin and is the event room itself (its path equals the path of eventRoomUrl(), with or
 * without a trailing index.html), so a tampered session value cannot turn the button into a redirect. Anything else, or nothing,
 * means the event room's entry. Returns an absolute URL.
 */
export function eventRoomReturn(candidate, doc = globalThis.document, loc = globalThis.location) {
  const home = eventRoomUrl(doc);
  if (typeof candidate !== 'string' || !candidate) return home;
  try {
    const here = new URL(loc?.href || baseOf(doc)), room = new URL(home, here), target = new URL(candidate, here);
    const roomPath = room.pathname;
    return target.origin === here.origin && (target.pathname === roomPath || target.pathname === `${roomPath}index.html`) ? target.href : home;
  } catch {
    return home;
  }
}
