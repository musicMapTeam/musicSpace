import { formatTaken } from './moment.js';

/**
 * 那晚的歌单, drawn the same way in the local demo and in a room: one row per distinct song, in the order it was on stage.
 * A row for a song someone typed carries a QQ Music SEARCH link (new tab, no referrer) and a copy button; a row for the demo's
 * fictional song is marked 示例 and has neither, because there is nothing real to look up. The list never claims to know which
 * recording was sung: the note under it says so.
 */
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

/**
 * @param {Array} songs   buildSetlist() output
 * @param {object} options { eventDate, icon }  icon(name) returns SVG markup
 */
export function setlistBody(songs, { eventDate = '', icon = () => '' } = {}) {
  if (!songs.length) {
    return '<p class="song-list__empty">还没有歌。在卡上写下「这一刻在唱的歌」，会按拍摄时间排进这里。</p>';
  }
  const searchable = songs.some(song => !song.example);
  const row = song => {
    const when = song.at === null
      ? '<span class="song-list__time is-unknown">时间不详</span>'
      : `<time class="song-list__time" datetime="${escape(new Date(song.at).toISOString())}">${escape(formatTaken(song.at, eventDate))}</time>`;
    const side = song.example
      ? '<span class="song-list__tag">示例</span>'
      : `<button type="button" class="song-list__copy" data-copy-song="${escape(song.title)}" aria-label="复制歌名《${escape(song.title)}》">复制歌名</button>`;
    const link = song.example
      ? ''
      : `<a class="song-list__link" href="${escape(song.url)}" target="_blank" rel="noopener noreferrer">在 QQ 音乐搜索《${escape(song.title)}》${icon('arrow-up-right')}</a>`;
    return `<li class="song-list__item${song.example ? ' is-example' : ''}">${when}<strong class="song-list__title">《${escape(song.title)}》</strong>${side}<small class="song-list__names">${escape(song.names.join('、'))}${song.example ? ' · 虚构的示例曲目' : ''}</small>${link}</li>`;
  };
  return `<ol class="song-list">${songs.map(row).join('')}</ol><p class="song-list__note">${searchable ? 'QQ 音乐链接只是按歌名搜索，不保证是当晚唱的那个版本；手机上打开后如果没有带出歌名，可以先复制再粘贴。' : '示例曲目是虚构的，没有链接。在自己的卡上写下「这一刻在唱的歌」，会按拍摄时间排进这里。'}</p>`;
}

/** Copy text to the clipboard. Secure pages use the Clipboard API; a plain-http LAN page falls back to the old selection trick. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* not a secure page, or the browser said no: try the fallback */ }
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
  document.body.append(box);
  box.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  box.remove();
  return copied;
}

/** One listener per page for every 「复制歌名」 button inside `root`. */
export function bindSetlistCopy(root, signal, toast) {
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy-song]');
    if (!button || !root.contains(button)) return;
    const copied = await copyText(button.dataset.copySong);
    toast(copied ? '歌名已复制，可以粘贴到 QQ 音乐搜索' : '没能自动复制，可以长按歌名手动复制');
  }, { signal });
}
