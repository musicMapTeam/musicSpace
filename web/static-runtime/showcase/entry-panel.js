/**
 * The entry panel of the static build: how a visitor joins the fictional room.
 *
 *   entryMarkup({ state, esc, avatarSvg, defaults }) -> HTML of form[data-form='demo-entry']
 *   enter({ name, avatar, participation, consent }, controller, { ready, roomCode }) -> the join result
 *
 * app.js renders the markup into the panel body and, on submit, calls profile.demo.enter(values, controller) (demo-hooks.js binds
 * `ready` and `roomCode`). The markup reuses the classes the server panels already use (eyebrow, quick-identity, participation-choices,
 * consent, primary, quiet, fine), so web/event-room's own CSS styles it.
 *
 * defaults = { name, avatar, preparing, participation?, castNames? }. `preparing` is true while the in-page world is still being built:
 * the submit button is disabled then (re-render the panel when the world is ready).
 */
import { escape } from '../../avatar/model.js';

const PARTICIPATION = Object.freeze({
  open: ['愿意打招呼', '别人可以招手；成为朋友仍需我明确接受。'],
  quiet: ['安静参与', '照样保存和分享照片，不接收新招呼。'],
});

const choice = (value, checked) => `<label><input type="radio" name="participation" value="${value}"${checked ? ' checked' : ''}><span>${PARTICIPATION[value][0]}<small>${PARTICIPATION[value][1]}</small></span></label>`;

export function entryMarkup({ state = {}, esc = escape, avatarSvg, defaults = {} } = {}) {
  // A browser that already holds an identity keeps it: enter() does not create another, so the form shows who will walk in.
  const known = state?.identity?.status === 'ready' ? state.identity.user : null;
  const name = known?.name ?? defaults.name ?? '';
  const avatar = known?.avatar ?? defaults.avatar;
  const preparing = Boolean(defaults.preparing);
  const open = defaults.participation !== 'quiet';
  const names = (Array.isArray(defaults.castNames) ? defaults.castNames : []).filter(item => typeof item === 'string' && item);
  const figure = typeof avatarSvg === 'function' && avatar ? avatarSvg(avatar, { view: 'quarter', width: 92, height: 192 }) : '';
  const who = names.length ? `同场的${names.map(item => esc(item)).join('、')}` : '同场的几位示例角色';
  return `<form data-form="demo-entry" class="demo-entry"><small class="eyebrow">示例现场 · 回声现场（虚构）</small><h2>带上小人，进入示例现场</h2>`
    + `<p>${who}都是虚构的，由这个页面自动回复，不是真人。进去后先放一张你的照片，看看你拍到的是哪一面。</p>`
    + `<div class="quick-identity"><div aria-hidden="true">${figure}</div><div><label>大家怎么叫你<input name="name" maxlength="18" value="${esc(name)}" autocomplete="nickname" required${known ? ' readonly' : ''}></label>`
    + `<p class="fine">${known ? '这个浏览器里已经有你的小人，会直接带着它进去。' : '先用这个小人，入场后随时能逐件换装。'}</p>`
    + `<button type="button" class="quiet" data-open="wardrobe">现在换个造型 ↗</button></div></div>`
    + `<fieldset class="participation-choices"><legend>这一场，我想怎样参与</legend>${choice('open', open)}${choice('quiet', !open)}</fieldset>`
    // The consent, the button and the line that says why the button may still be disabled stay together: the sheet pins them to its bottom.
    + `<div class="demo-entry-actions"><label class="consent"><input name="consent" type="checkbox" required><span>我愿意向本场成员（示例角色）展示我的昵称和小人。数据只存在这个浏览器里。</span></label>`
    + `<button class="primary" type="submit"${preparing ? ' disabled' : ''}>进入示例现场</button>`
    + `<p class="fine demo-entry-status" role="status">${preparing ? '正在布置示例现场…' : ''}</p></div>`
    + `<p class="fine">没有服务器，也没有账号：这个示例完全在你的浏览器里运行，选择只存在这里。</p>`
    + `<button type="button" class="quiet" data-open="about">关于这个示例</button>`
    + `<details class="demo-entry-more"><summary>自己开个房</summary><p class="fine">也可以在这个浏览器里自己开一个房间：只有你自己，示例角色不会来。</p><button type="button" class="quiet" data-open="create">自己开个房</button></details></form>`;
}

const fail = (message, code) => Object.assign(new Error(message), { code });

/**
 * Walk the visitor into the fictional room through the real client: identity (only when this browser has none), preview, join.
 * Refuses without an explicit consent === true and calls nothing then. Every error from the client is thrown as it is, and nothing
 * is retried here: a second attempt is the person's tap.
 */
export async function enter(values, controller, { ready, roomCode } = {}) {
  if (values?.consent !== true) throw fail('请先勾选：我愿意向本场成员（示例角色）展示我的昵称和小人。', 'JOIN_CONSENT_REQUIRED');
  // No API call may start before the in-page room exists (the client gives up on a request after 20 s).
  await (typeof ready === 'function' ? ready() : ready);
  const code = typeof roomCode === 'function' ? roomCode() : roomCode;
  if (!code) throw fail('示例现场还没有布置好，请稍后再试。', 'SHOWCASE_NOT_READY');
  const participation = values.participation === 'quiet' ? 'quiet' : 'open';
  if (controller.getState().identity.status !== 'ready') await controller.establishIdentity({ name: String(values.name ?? '').trim(), avatar: values.avatar });
  await controller.previewRoom(code);
  return controller.joinRoom(code, { joinConsent: true, participation });
}
