/**
 * What the static build tells a visitor about itself: the About panel and the block that replaces the invitation in the room panel.
 *
 *   aboutMarkup({ build, castNames, persistent, channel, readOnly, ai }) -> HTML
 *   roomInviteMarkup({ isShowcase })                                      -> HTML (no code, no QR, no link: nothing can be shared)
 *
 * Everything dynamic (the build stamp, the channel, the names) is escaped here. `ai` is the on-device model's state
 * ('on' | 'unsupported' | 'page' | 'failed', see aiState in web/js/photo-insight.js) and defaults to asking it right now:
 * when the model cannot run, the AI section says why in the one sentence the rest of the product uses.
 *
 * The 0.16 prototype is mentioned only as 早期原型, in the version section, and never linked from here.
 */
import { escape as esc } from '../../avatar/model.js';
import { aiState, AI_OFF_LINES } from '../../js/photo-insight.js';
import { SAME_MOMENT_MS } from '../../js/moment.js';
import { MEMORY_ONLY_NOTE, READ_ONLY_NOTE, RESET_CONFIRM } from './copy.js';

export const ABOUT_SECTIONS = Object.freeze([
  ['what', '这是什么'], ['cast', '同场的人'], ['photos', '照片'], ['ai', 'AI'], ['rules', '规则'], ['data', '数据'], ['version', '版本'],
]);

const section = (id, title, body) => `<section class="demo-about-section" data-about="${id}"><h3>${title}</h3>${body}</section>`;

/** 2026-10-06T02:15:30.123Z -> 2026-10-06 02:15 UTC; anything else is shown as it came (escaped). */
function stamp(value) {
  const text = String(value ?? '');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}${/Z$/.test(text) ? ' UTC' : ''}` : text;
}

function versionLine({ build, channel }) {
  const parts = [];
  if (build?.version) parts.push(`版本 <code>${esc(build.version)}</code>`);
  if (build?.commit) parts.push(`提交 <code>${esc(build.commit)}</code>`);
  if (build?.builtAt) parts.push(`构建于 <code>${esc(stamp(build.builtAt))}</code>`);
  if (channel) parts.push(`渠道 <code>${esc(channel)}</code>`);
  if (channel === 'preview') parts.push('<strong class="demo-about-channel">预览版</strong>：发布前的测试副本，不是最终版本');
  return parts.length ? parts.join(' · ') : '这次构建没有留下版本信息';
}

export function aboutMarkup({ build, castNames = [], persistent = true, channel = '', readOnly = false, ai = aiState() } = {}) {
  const names = (Array.isArray(castNames) ? castNames : []).filter(item => typeof item === 'string' && item);
  const cast = names.length ? `同场的 ${names.length} 位角色：${names.map(item => esc(item)).join('、')}，都是虚构的` : '同场的几位角色都是虚构的';
  const minutes = SAME_MOMENT_MS / 60_000;
  const offLine = ai === 'on' ? '' : `<p class="fine">${esc(AI_OFF_LINES[ai] || AI_OFF_LINES.unsupported)}</p>`;
  return `<small class="eyebrow">示例站 · 回声现场（虚构）</small><h2>关于这个示例</h2>`
    + `<p class="demo-about-lead"><strong>真的：</strong>房间规则、「同一刻」的规则判断、存在你浏览器里的数据，以及（浏览器支持时）在本机运行的 AI 视角建议。<strong>模拟的：</strong>同场的人。</p>`
    + `<div class="demo-about">`
    + section('what', '这是什么', '<p>这个页面里的房间服务就运行在你的浏览器里：SQLite 被编译成 WebAssembly，执行的是 Music Space 房间服务的同一份规则代码。没有服务器，没有账号，什么都不会上传。</p>')
    + section('cast', '同场的人', `<p>${cast}，由这个页面自动回复，不是真人。他们遵守和真人一样的规则：招呼要双方都愿意，交换要照片的主人同意，选了安静参与的人不能被招呼。他们的回应是固定的规则，不是 AI：比如你提议交换的视角和 TA 自己的一样，TA 会婉拒。他们不会学习，页面也不会记录或发送任何关于你的信息。</p>`)
    + section('photos', '照片', '<p>示例现场里的照片，是 2026 年 9 月 26 日生成的虚构演唱会 AI 图像的裁切，不是真实现场。你放的照片只留在这个浏览器里，不会上传；放进去时会缩小，并去掉照片里的位置信息。</p>')
    + section('ai', 'AI', `<p>AI 只做一件事：在你放照片时，建议它拍的是舞台、人海、身边、细节中的哪一面。没把握时它会说「不确定」，选择永远由你做。</p>`
      + `<p>模型是 TinyCLIP-ViT-8M/16 的图像塔（MIT 许可，int8，8.8 MB），连同 onnxruntime-web 的 WASM 在你的设备上运行，所有文件都来自本站。</p>`
      + `<p>第一次使用要下载约 10 MB：进入示例现场后在后台开始，浏览器要求省流量时则不下载。它只在公开的演唱会照片上测过，结果不能当作产品的准确率。</p>${offLine}`)
    + section('rules', '规则', `<p>「同一刻」是两张照片的拍摄时间相差不超过 ${minutes} 分钟。拍摄时间取自照片自带的 EXIF 信息，或者你自己填写的时间。配对、分组和理由都是规则计算，不是 AI。</p>`)
    + section('data', '数据', `<p>数据存在这个浏览器的 IndexedDB 里。清除网站数据，或点下面的「重置示例」，都会把它们抹掉；换一台设备也看不到。真正的多人房间需要完整的房间服务，这个示例做不到。同时打开第二个标签页时，那里是只读的。</p>`
      + (persistent ? '' : `<p class="demo-about-warn" role="note">这个浏览器没有让这里保存数据：${esc(MEMORY_ONLY_NOTE)}。</p>`)
      + (readOnly ? `<p class="demo-about-warn" role="note">这个标签页是只读的：${esc(READ_ONLY_NOTE)}。重置请在先打开的那个标签页里做。</p>` : '')
      + `<p class="fine">点「重置示例」会先让你确认一次；确认后清除这个浏览器里的示例数据（昵称、小人、照片、交换），并重新布置示例现场。</p>`
      + `<button type="button" class="quiet demo-reset" data-demo-reset data-confirm="${esc(RESET_CONFIRM)}"${readOnly ? ' disabled' : ''}>重置示例</button>`)
    + section('version', '版本', `<p class="demo-about-stamp">${versionLine({ build, channel })}</p><p class="fine">更早的 0.16 版本称为早期原型，只有本地双角色示例，不属于这个示例。</p>`)
    + `</div>`;
}

/**
 * Replaces the invitation block (code, QR, copy link, NFC) of the room panel. A browser-local room has nothing to invite anyone to:
 * no code, no QR, no link, and it says so. `isShowcase` is the fictional room (the cast is in it); any other room is the visitor's own.
 */
export function roomInviteMarkup({ isShowcase = true } = {}) {
  const lead = isShowcase
    ? '<strong>这是只在这个浏览器里的示例现场。</strong>没有可以分享出去的入口，别的设备进不来；同场的示例角色都是自动回复的虚构角色。'
    : '<strong>这是你在这个浏览器里自己开的房间。</strong>只有你自己，示例角色不会来；没有可以分享出去的入口，别的设备也进不来。';
  return `<div class="demo-room-note"><p>${lead}</p><p class="fine">真正的多人房间需要完整的房间服务。你放的照片和做的选择只留在这个浏览器里。</p><button type="button" class="quiet" data-open="about">关于这个示例</button></div>`;
}
