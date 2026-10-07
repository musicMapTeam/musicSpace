import catalogue from '../assets/data/hf-collaborations.json';
import { icon } from './icons.js';
import { importLegacyMapMusic, listenHTML, sourcesHTML } from './map.js';
import { songs } from './map-data.js';
import { getSavedMusic, toggleSavedMusic, removeSavedMusic, subscribeSavedMusic } from './music-library.js';

const hfSnapshot = track => ({ id: track.id, title: track.title, artists: [...track.artists], source: catalogue.source.url, dataset: 'hf' });

function importPreviousSaves(api) {
  try { importLegacyMapMusic(api); }
  catch { api.toast('留下的歌暂时没同步'); }
}

// 留下 / 移除, as in the record shop: the same words wherever a song is kept or let go.
function updateSaveButton(button, track, saved) {
  button.innerHTML = icon(saved ? 'check' : 'plus');
  button.classList.toggle('is-saved', saved);
  button.setAttribute('aria-pressed', String(saved));
  button.setAttribute('aria-label', `${saved ? '移除' : '留下'}《${track.title}》`);
  button.title = saved ? '已留下，点击移除' : '留下这首歌';
}

/** Where an open-catalogue row comes from: its row in the Hugging Face snapshot (the citation stays one tap away, in the row). */
function hfCite(track) {
  const row = catalogue.tracks.find(item => item.id === track.id)?.source?.recordNumber;
  const cite = document.createElement('p'); cite.className = 'open-catalogue__cite';
  const link = document.createElement('a'); link.href = catalogue.source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.textContent = row ? `Hugging Face 数据集第 ${row.toLocaleString('en-US')} 行 ↗` : 'Hugging Face 数据集 ↗';
  cite.append('来源：', link);
  return cite;
}

/** One song row. The 开放曲库 toggles 留下 / 移除 with an icon; 留下的歌 (`removeOnly`) says 移除 in words.
 *  `listen` is the 去 QQ 音乐听 line of a real recording; it sits under the row and never keeps or removes. */
function musicRow(track, index, { saved, detail, onSave, removeOnly = false, listen = '' }) {
  const row = document.createElement('article'); row.className = `open-catalogue__record${listen ? ' has-listen' : ''}`; row.dataset.musicId = track.id;
  const info = document.createElement('details');
  const summary = document.createElement('summary');
  const number = document.createElement('span'); number.className = 'open-catalogue__number'; number.textContent = String(index + 1).padStart(2, '0');
  const copy = document.createElement('span'); copy.className = 'open-catalogue__copy';
  const title = document.createElement('strong'); title.textContent = track.title;
  const artists = document.createElement('small'); artists.textContent = track.artists.join(' · ');
  copy.append(title, artists); summary.append(number, copy); info.append(summary, detail);
  const actions = document.createElement('div'); actions.className = 'music-row__actions';
  const save = document.createElement('button'); save.type = 'button'; save.dataset.musicSave = track.id;
  if (removeOnly) {
    save.className = 'button button--quiet music-row__remove';
    save.textContent = '移除';
    save.setAttribute('aria-label', `移除《${track.title}》`);
  } else {
    save.className = 'icon-button music-row__save';
    updateSaveButton(save, track, saved);
  }
  save.addEventListener('click', onSave);
  actions.append(save); row.append(info, actions);
  if (listen) {
    const line = document.createElement('div'); line.className = 'music-row__listen';
    line.innerHTML = listen; row.append(line);
  }
  return row;
}

export function mountOpenCatalogue(api) {
  importPreviousSaves(api);
  const abort = new AbortController();
  const dialog = document.createElement('dialog');
  dialog.className = 'open-catalogue';
  dialog.setAttribute('aria-labelledby', 'open-catalogue-title');
  dialog.innerHTML = `<span class="ds-tape open-catalogue__tape" aria-hidden="true"></span><header><div><span class="open-catalogue__eyebrow">THE OPEN CRATE</span><h2 id="open-catalogue-title">开放曲库<span>${catalogue.tracks.length}</span></h2></div><button class="icon-button" data-crate-close aria-label="关闭开放曲库">${icon('x')}</button></header>
    <label class="open-catalogue__search">${icon('magnifying-glass')}<input type="search" placeholder="搜歌曲、艺人" aria-label="搜索开放曲库"></label>
    <p class="open-catalogue__note">共同署名，不一定是合唱</p><div class="open-catalogue__list"></div>
    <footer><span data-crate-count role="status"></span><button type="button" class="open-catalogue__sources" data-about-sources aria-haspopup="dialog">数据来源</button></footer>`;
  document.body.append(dialog);
  const list = dialog.querySelector('.open-catalogue__list');
  function render(query = '') {
    const search = query.trim().toLocaleLowerCase();
    const tracks = catalogue.tracks.filter(track => [track.title, ...track.artists].join(' ').toLocaleLowerCase().includes(search));
    const savedIds = new Set(getSavedMusic().map(track => track.id));
    list.replaceChildren();
    tracks.forEach((track, index) => {
      const detail = document.createElement('div'); detail.className = 'open-catalogue__detail';
      const album = document.createElement('p'); album.textContent = `专辑《${track.album}》`;
      detail.append(album, hfCite(track));
      const snapshot = hfSnapshot(track);
      list.append(musicRow(snapshot, index, {
        saved: savedIds.has(track.id), detail,
        onSave() {
          try { api.toast(toggleSavedMusic(snapshot) ? '已留下' : '已移除'); }
          catch { api.toast('没存上，浏览器存储不可用'); }
        },
      }));
    });
    if (!tracks.length) { const empty = document.createElement('p'); empty.className = 'open-catalogue__empty'; empty.textContent = '没找到，换个词试试。'; list.append(empty); }
    dialog.querySelector('[data-crate-count]').textContent = `${tracks.length} 首`;
  }
  const unsubscribe = subscribeSavedMusic(tracks => {
    const savedIds = new Set(tracks.map(track => track.id));
    list.querySelectorAll('[data-music-save]').forEach(button => {
      const track = catalogue.tracks.find(item => item.id === button.dataset.musicSave);
      updateSaveButton(button, track, savedIds.has(track.id));
    });
  });
  dialog.querySelector('input').addEventListener('input', event => render(event.target.value));
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-crate-close]')) dialog.close();
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-catalogue]') && !dialog.open) dialog.showModal();
  }, { signal: abort.signal });
  render();
  return () => { unsubscribe(); abort.abort(); dialog.remove(); };
}

/** Compact collection used by the app's unified records surface. */
export function mountSavedMusic(container, api) {
  importPreviousSaves(api);
  function render() {
    const tracks = getSavedMusic();
    container.innerHTML = `<section class="saved-music" aria-label="留下的歌"><header class="saved-music__heading"><h2>留下的歌</h2><span>${tracks.length} 首</span></header><div class="saved-music__list"></div></section>`;
    const list = container.querySelector('.saved-music__list');
    if (!tracks.length) {
      list.innerHTML = `<div class="saved-music__empty"><span class="ds-deco ds-music saved-music__doodle" aria-hidden="true"></span><p>遇到喜欢的歌，就留在这里。</p><button type="button" class="button button--primary" data-music-explore>去唱片店 ${icon('arrow-right')}</button></div>`;
      list.querySelector('button').addEventListener('click', () => api.navigate('explore')); return;
    }
    tracks.forEach((track, index) => {
      const detail = document.createElement('div'); detail.className = 'open-catalogue__detail';
      const date = new Date(track.savedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      const line = document.createElement('p'); line.textContent = `${track.dataset === 'hf' ? '开放曲库 · ' : ''}${date} 留下`;
      detail.append(line);
      // A kept recording of the duet catalogue carries the same 来源 chip as in the record shop, beside 去 QQ 音乐听 (in
      // sight, not inside the folded row); an open-catalogue row keeps its dataset row in the fold.
      const song = track.dataset === 'real' ? songs[track.id] : null;
      if (track.dataset === 'hf') detail.append(hfCite(track));
      list.append(musicRow(track, index, {
        saved: true, detail, removeOnly: true, listen: song?.dataset === 'real' ? listenHTML(song, icon) + sourcesHTML(song) : '',
        onSave() {
          try {
            removeSavedMusic(track.id); api.toast('已移除');
            const buttons = [...container.querySelectorAll('[data-music-save]')];
            (buttons[Math.min(index, buttons.length - 1)] || container.querySelector('[data-music-explore]'))?.focus({ preventScroll: true });
          } catch { api.toast('没移除成功，浏览器存储不可用'); }
        },
      }));
    });
  }
  const unsubscribe = subscribeSavedMusic(render);
  render(); return unsubscribe;
}
