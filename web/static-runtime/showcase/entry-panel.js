/**
 * The entry panel of the static build: how a visitor walks into the show's room.
 *
 *   entryMarkup({ state, esc, avatarSvg, defaults }) -> HTML of form[data-form='demo-entry']
 *   enter({ name, avatar, participation, consent }, controller, { ready, roomCode }) -> the join result
 *
 * app.js renders the markup into the panel body and, on submit, calls profile.demo.enter(values, controller) (demo-hooks.js binds
 * `ready` and `roomCode`). The markup reuses the classes the server panels already use (eyebrow, quick-identity, participation-choices,
 * consent, primary, quiet, fine), so web/event-room's own CSS styles it.
 *
 * defaults = { name, avatar, preparing, participation? }. `preparing` is true while the in-page world is still being built:
 * the submit button is disabled then (re-render the panel when the world is ready). The form names nobody: who is in the room is
 * for the room to show (one of the people arrives only after the visitor).
 */
import { escape } from '../../avatar/model.js';

const PARTICIPATION = Object.freeze({
  open: ['愿意打招呼', '别人可以向我招手'],
  quiet: ['安静参与', '照片照常分享，不接新招呼'],
});

const choice = (value, checked) => `<label><input type="radio" name="participation" value="${value}"${checked ? ' checked' : ''}><span>${PARTICIPATION[value][0]}<small>${PARTICIPATION[value][1]}</small></span></label>`;

export function entryMarkup({ state = {}, esc = escape, avatarSvg, defaults = {} } = {}) {
  // A browser that already holds an identity keeps it: enter() does not create another, so the form shows who will walk in.
  const known = state?.identity?.status === 'ready' ? state.identity.user : null;
  const name = known?.name ?? defaults.name ?? '';
  const avatar = known?.avatar ?? defaults.avatar;
  const preparing = Boolean(defaults.preparing);
  const open = defaults.participation !== 'quiet';
  const figure = typeof avatarSvg === 'function' && avatar ? avatarSvg(avatar, { view: 'quarter', width: 92, height: 192 }) : '';
  return `<form data-form="demo-entry" class="demo-entry"><small class="eyebrow">月台 Livehouse · 回声现场</small><h2>带上小人，进入现场</h2>`
    + `<p>进去后先放一张今晚的照片，看看你拍到的是哪一面。</p>`
    + `<div class="quick-identity"><div aria-hidden="true">${figure}</div><div><label>大家怎么叫你<input name="name" maxlength="18" value="${esc(name)}" autocomplete="nickname" required${known ? ' readonly' : ''}></label>`
    + `<p class="fine">${known ? '已经有你的小人了，直接带它进去。' : '入场后随时能换装。'}</p>`
    + `<button type="button" class="quiet" data-open="wardrobe">现在换个造型 ↗</button></div></div>`
    + `<fieldset class="participation-choices"><legend>这一场，我想怎样参与</legend>${choice('open', open)}${choice('quiet', !open)}</fieldset>`
    // The consent, the button and the line that says why the button may still be disabled stay together: the sheet pins them to its bottom.
    + `<div class="demo-entry-actions"><label class="consent"><input name="consent" type="checkbox" required><span>我愿意向本场成员展示我的<span class="nowrap">昵称和小人</span></span></label>`
    + `<button class="primary" type="submit"${preparing ? ' disabled' : ''}>进入现场</button>`
    + `<p class="fine demo-entry-status" role="status">${preparing ? '正在布置现场…' : ''}</p></div>`
    + `<button type="button" class="quiet" data-open="about">关于 Music Space</button>`
    // One span is the summary's one flex item (the chevron is the other); 「开个房」 never breaks on a narrow phone.
    + `<details class="demo-entry-more"><summary><span>我是 Livehouse / 主办方，<span class="nowrap">开个房</span></span></summary><p class="fine">为每一场演出开一个房间；散场后，乐迷留在你的乐迷社群里。</p><button type="button" class="quiet" data-open="create">开一个房间</button></details></form>`;
}

const fail = (message, code) => Object.assign(new Error(message), { code });

/**
 * Walk the visitor into the show's room through the real client: identity (only when this browser has none), preview, join.
 * Refuses without an explicit consent === true and calls nothing then. Every error from the client is thrown as it is, and nothing
 * is retried here: a second attempt is the person's tap.
 */
export async function enter(values, controller, { ready, roomCode } = {}) {
  if (values?.consent !== true) throw fail('请先勾选同意，再进入现场。', 'JOIN_CONSENT_REQUIRED');
  // No API call may start before the in-page room exists (the client gives up on a request after 20 s).
  await (typeof ready === 'function' ? ready() : ready);
  const code = typeof roomCode === 'function' ? roomCode() : roomCode;
  if (!code) throw fail('现场还在布置，请稍后再试。', 'SHOWCASE_NOT_READY');
  const participation = values.participation === 'quiet' ? 'quiet' : 'open';
  if (controller.getState().identity.status !== 'ready') await controller.establishIdentity({ name: String(values.name ?? '').trim(), avatar: values.avatar });
  await controller.previewRoom(code);
  return controller.joinRoom(code, { joinConsent: true, participation });
}
