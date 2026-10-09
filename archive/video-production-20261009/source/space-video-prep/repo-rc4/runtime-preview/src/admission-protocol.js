/** Invitations locate a preview. They never carry identity or consent. */
export const INVITE_CODE = /^[A-Z2-7]{12}$/;
export const NEARBY_SERVICE = '6d757369-6373-4070-9163-652d696e7669';
export const NEARBY_URL = '6d757369-6373-4070-9163-652d75726c31';
const bad = () => { throw new Error('请使用当前 Music Space 的有效邀请链接或 12 位邀请码。'); };
export function invitation(value, { base, kind = 'room', allowCode = true } = {}) {
  if (!['room', 'community'].includes(kind)) bad();
  if (typeof value !== 'string' || value.length > 2048 || /[\p{Cc}\u2028\u2029]/u.test(value)) bad();
  const text = value.trim(), code = text.toUpperCase();
  if (allowCode && INVITE_CODE.test(code)) return { kind, code };
  let url, origin; try { url = new URL(text); origin = new URL(base); } catch { bad(); }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin.origin || url.pathname !== origin.pathname || url.username || url.password || url.hash) bad();
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 1 || !['room', 'community'].includes(keys[0])) bad();
  const actualKind = keys[0], actualCode = url.searchParams.get(actualKind);
  if (actualKind !== kind || !INVITE_CODE.test(actualCode)) bad();
  return { kind: actualKind, code: actualCode };
}
export function invitationUrl(base, { kind, code }) {
  if (!['room', 'community'].includes(kind) || !INVITE_CODE.test(code)) bad();
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) bad();
  url.search = ''; url.hash = ''; url.searchParams.set(kind, code);
  return url.href;
}
export function previewPath({ kind, code }) {
  if (!INVITE_CODE.test(code)) bad();
  if (kind === 'room') return '/preview/' + code;
  if (kind === 'community') return '/communities/preview/' + code;
  bad();
}
export function nfcInvitation(base, target) {
  const url = invitationUrl(base, target);
  if (new URL(url).protocol !== 'https:') throw new Error('NFC 标签需要可由手机访问的 HTTPS 邀请地址；本机 HTTP 仍可复制链接或二维码。');
  return { records: [{ recordType: 'url', data: url }] };
}
/** Native transports use these aliases; legacy clients remain compatible. */
export function admissionRoute(path, method) {
  const match = /^\/admission\/(room|community)\/([A-Z2-7]{12})\/(preview|join)$/.exec(path);
  if (!match) return path;
  const [, kind, code, action] = match;
  if (action === 'preview' && method === 'GET') return previewPath({ kind, code });
  if (kind === 'room' && action === 'join' && method === 'POST') return '/rooms/' + code + '/join';
  return path;
}
