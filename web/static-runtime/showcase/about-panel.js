/**
 * What the static build tells a visitor about Music Space: the About panel and the block that replaces the invitation in the room panel.
 *
 *   aboutMarkup({ build, persistent, channel, readOnly, ai }) -> HTML
 *   roomInviteMarkup()                                        -> HTML (no code, no QR, no link: a room in this page cannot be shared)
 *
 * The About panel carries the one sentence of the whole product that says what the online edition is made of (user decision
 * 2026-10-07: here and nowhere else). It names no cast, no photo source, no rule internals and no storage engine, and it links nowhere.
 * The version line shows the release a visitor would name (0.22.0, no pre-release tag); the whole build stamp (version, commit, build time,
 * channel) is kept in data-* attributes of that line for QA, not on screen. Everything dynamic (the build stamp, the channel) is escaped here. `ai` is the on-device model's state ('on' | 'unsupported' | 'page' |
 * 'failed', see aiState in web/js/photo-insight.js) and defaults to asking it right now: when the model can run, the AI section says when
 * it downloads; when it cannot, it says why in the one sentence the rest of the product uses. A `castNames` option is accepted and ignored.
 */
import { escape as esc } from '../../avatar/model.js';
import { aiState, AI_OFF_LINES } from '../../js/photo-insight.js';
import { MEMORY_ONLY_NOTE, READ_ONLY_NOTE, RESET_CONFIRM } from './copy.js';

export const ABOUT_SECTIONS = Object.freeze([
  ['what', '这是什么'], ['livehouse', '给 Livehouse'], ['ai', 'AI'], ['privacy', '隐私'], ['data', '在线版'], ['version', '版本'],
]);

const TITLES = Object.fromEntries(ABOUT_SECTIONS);
const section = (id, body) => `<section class="demo-about-section" data-about="${id}"><h3>${TITLES[id]}</h3>${body}</section>`;

/** 2026-10-06T02:15:30.123Z -> 2026-10-06 02:15 UTC; anything else is shown as it came (escaped). */
function stamp(value) {
  const text = String(value ?? '');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}${/Z$/.test(text) ? ' UTC' : ''}` : text;
}

/** The 「版本 …」 part wraps whole and keeps the 「 · 」 after it (a no-break space before it). */
const part = html => `<span class="nowrap">${html}</span>`;

/** The release a visitor would name: 0.22.0-rc.2 -> 0.22.0 (a pre-release or build suffix is for QA, see stampData). */
export const releaseOf = version => String(version ?? '').replace(/[-+].*$/, '');

function versionLine({ build, channel }) {
  const parts = [];
  if (build?.version) parts.push(part(`版本 <code>${esc(releaseOf(build.version) || build.version)}</code>`));
  if (channel === 'preview') parts.push('<strong class="demo-about-channel">预览版</strong>：发布前的测试副本，不是最终版本');
  return parts.length ? parts.join('\u00a0· ') : '这次构建没有留下版本信息';
}

/** The whole build stamp, for QA: data-version (as built, e.g. 0.22.0-rc.2), data-commit, data-built-at (UTC) and data-channel. */
function stampData({ build, channel }) {
  const fields = [['version', build?.version], ['commit', build?.commit], ['built-at', build?.builtAt ? stamp(build.builtAt) : ''], ['channel', channel]];
  return fields.filter(([, value]) => value).map(([name, value]) => ` data-${name}="${esc(value)}"`).join('');
}

export function aboutMarkup({ build, persistent = true, channel = '', readOnly = false, ai = aiState() } = {}) {
  const model = ai === 'on'
    ? '第一次进入现场后，模型（约 10 MB）会在后台下载；开了省流量，就等你放照片时再下载。'
    : esc(AI_OFF_LINES[ai] || AI_OFF_LINES.unsupported);
  return `<small class="eyebrow">同一刻，另一面</small><h2>关于 Music Space</h2>`
    + `<p class="demo-about-lead">同一晚，你拍了舞台，TA 拍了人海。Music\u00a0Space 让这两面在同一个房间里相遇。</p>`
    + `<div class="demo-about">`
    + section('what', '<p>同场的人带着手绘小人，走进同一个三维 Livehouse 房间。放一张今晚的照片，照片墙会把同一刻、拍到另一面的照片排在一起；双方都同意，就能交换。还能向同场的人招手、私聊，一起玩专辑世界杯。散场后，回顾和纪念卡都留着。</p>')
    + section('livehouse', '<p>为每一场演出开一个房间，乐迷带着小人入场。散场后，乐迷留在你的乐迷社群里，下一场的预告也直接发在那里。</p>')
    + section('ai', `<p>放照片时，AI 在你的设备上建议它拍的是舞台、人海、身边还是细节；没把握就说「不确定」，由你来选。</p><p class="fine">${model}</p>`)
    + section('privacy', '<p>不用真名，也不用手机号。照片给谁看由你决定，放进来时会缩小、去掉位置信息。交换照片、成为朋友，都要双方同意。</p>')
    + section('data', '<p>在线版里的场地、观众和照片是演示内容，观众会自动回复。</p>'
      + (persistent ? '' : `<p class="demo-about-warn" role="note">${esc(MEMORY_ONLY_NOTE)}。</p>`)
      + (readOnly ? `<p class="demo-about-warn" role="note">${esc(READ_ONLY_NOTE)}。要重新开始，请回到先打开的那个标签页。</p>` : '')
      + `<button type="button" class="quiet demo-reset" data-demo-reset data-confirm="${esc(RESET_CONFIRM)}"${readOnly ? ' disabled' : ''}>重新开始</button>`)
    + section('version', `<p class="demo-about-stamp"${stampData({ build, channel })}>${versionLine({ build, channel })}</p>`)
    + `</div>`;
}

/**
 * Replaces the invitation block (code, QR, copy link, NFC) of the room panel: a room that lives in this page has nothing to invite anyone
 * to, so the block is only the way to About. The same for the show's room and a room the visitor opened; options are accepted and ignored.
 */
export function roomInviteMarkup() {
  return '<div class="demo-room-note"><button type="button" class="quiet" data-open="about">关于 Music Space</button></div>';
}
