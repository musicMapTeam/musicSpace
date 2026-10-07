// 音乐探索 (web/original-map): every duet keeps all of its citations behind one 「来源」 disclosure, and a 寻声 round in play never
// lets that disclosure name a singer the player has not met.
import test from 'node:test';
import assert from 'node:assert/strict';

const { sourcesHTML, shownLabel, listenHTML } = await import('../web/original-map/js/map.js');
const { realSongs, realArtists, realEdges } = await import('../web/original-map/js/map-catalogue.js');

const songs = Object.values(realSongs);
const attr = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
const text = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const names = artist => [artist.name, ...(artist.aliases || [])].filter(name => name.length > 1);

test('every recording of the catalogue has a 来源 disclosure: a native details/summary button labelled with its song', () => {
  assert.equal(songs.length, realEdges.length);
  for (const song of songs) {
    const html = sourcesHTML(song);
    assert.match(html, /^<details class="map-sources"><summary>来源<span class="sr-only">：《/, song.id);
    assert.ok(html.includes(`：《${text(song.title)}》</span></summary>`), `${song.id}: the summary names its song for screen readers`);
    assert.ok(!html.includes(' open'), `${song.id}: folded by default`);
    assert.match(sourcesHTML(song, { open: true }), /^<details class="map-sources" open data-sources-focus>/, `${song.id}: can open unfolded`);
  }
});

test('folded, never deleted: the vocal source, its evidence, every credit source, the QQ page or its reason, and the access dates', () => {
  for (const song of songs) {
    const html = sourcesHTML(song);
    assert.ok(html.includes(`href="${attr(song.sourceUrl)}"`), `${song.id}: vocal source link`);
    assert.ok(html.includes(text(song.sourceLabel)), `${song.id}: vocal source label`);
    assert.ok(html.includes(text(song.evidence)), `${song.id}: evidence sentence`);
    assert.ok(html.includes(`访问于 <span class="map-num">${song.checkedAt}</span>`), `${song.id}: date the source was read`);
    for (const source of song.creditSources) {
      assert.ok(html.includes(`href="${attr(source.url)}"`), `${song.id}: credit source ${source.id}`);
      assert.ok(html.includes(text(source.label)), `${song.id}: credit source label ${source.id}`);
    }
    // every credited person and role that is not the two singers' own 演唱 credit is listed under the source that supports it
    for (const credit of song.credits) {
      if (credit.role === '演唱' && song.artists.includes(credit.artistId)) continue;
      assert.ok(html.includes(text(credit.name)), `${song.id}: credit ${credit.name}`);
      assert.ok(html.includes(text(credit.role)), `${song.id}: role ${credit.role}`);
    }
    const qq = song.listenLinks[0];
    if (qq) {
      assert.ok(html.includes(`href="${attr(qq.url)}"`), `${song.id}: QQ same-recording page`);
      if (!qq.creditMatches) assert.ok(html.includes(text(`QQ 音乐署名：${qq.credit}`)), `${song.id}: QQ's own credit`);
    } else assert.ok(html.includes(text(song.listenReason)), `${song.id}: why there is no QQ link`);
    // a recording label whose parenthesis records an open check is printed whole here (the main UI prints it without)
    if (song.recordingLabel !== shownLabel(song)) assert.ok(html.includes(text(song.recordingLabel)), `${song.id}: full recording label`);
    assert.ok(html.includes('只列有出处的署名，参与者可能更多。'), `${song.id}: the scope of the credits`);
    assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, (html.match(/<a /g) || []).length, `${song.id}: every source opens in a new tab, without opener`);
  }
});

test('during a 寻声 round the disclosure keeps to the two singers: no credit source, no reason, no other singer named', () => {
  for (const song of songs) {
    const html = sourcesHTML(song, { fogged: true });
    // what a reader sees or hears (a link's address may carry a label's own words, e.g. a label's blog post title)
    const visible = html.replace(/<[^>]*>/g, ' ');
    assert.ok(html.includes(`href="${attr(song.sourceUrl)}"`), `${song.id}: the vocal source stays`);
    for (const source of song.creditSources.filter(item => item.id !== 'vocal')) assert.ok(!html.includes(`href="${attr(source.url)}"`), `${song.id}: credit source ${source.id} held back`);
    if (song.listenReason) assert.ok(!html.includes(text(song.listenReason)), `${song.id}: reason held back`);
    for (const artist of realArtists.filter(item => !song.artists.includes(item.id))) {
      for (const name of names(artist)) {
        // 五月天阿信 is 阿信's own alias: only flag a name that is not part of a pair singer's alias
        const inPairAlias = song.artists.some(id => names(realArtists.find(item => item.id === id)).some(alias => alias.includes(name)));
        if (!inPairAlias) assert.ok(!visible.includes(name), `${song.id}: names ${name} outside the pair`);
      }
    }
    assert.ok(!html.includes('只列有出处的署名'), `${song.id}: no credits, so no scope line`);
  }
});

test('the main UI prints a version line without an open-check parenthesis and never the word 核对', () => {
  for (const song of songs) {
    const label = shownLabel(song);
    assert.ok(label.length > 0, song.id);
    assert.ok(!label.includes('核对'), `${song.id}: ${label}`);
    assert.ok((song.recordingLabel || song.versionLabel).startsWith(label.replace(/（.*$/, '')), `${song.id}: same label, only shortened`);
  }
});

test('去 QQ 音乐听 only where the same recording has a page; otherwise a quiet stamp, the reason waits in 来源', () => {
  const icon = () => '<svg></svg>';
  for (const song of songs) {
    const html = listenHTML(song, icon);
    if (song.listenLinks.length) {
      assert.ok(html.includes(`href="${attr(song.listenLinks[0].url)}"`), song.id);
      assert.ok(html.includes('去 QQ 音乐听'), song.id);
      assert.ok(html.includes(`aria-label="在 QQ 音乐打开《${text(song.title)}》同一录音（新窗口）"`), song.id);
    } else {
      assert.equal(html, '<div class="map-listen is-none"><span class="map-listen__none">暂无 QQ 音乐链接</span></div>', song.id);
    }
  }
});

test('a citation that answers with raw data (a JSON endpoint) is tagged 数据接口 unless its label says 接口; pages never are', () => {
  const ENDPOINT = /^https:\/\/(?:c\.y\.qq\.com\/lyric\/|u\.y\.qq\.com\/cgi-bin\/|music\.163\.com\/api\/|api\.deezer\.com\/)/;
  const TAG = '<small class="map-sources__kind">数据接口</small>';
  let tagged = 0;
  for (const song of songs) {
    const html = sourcesHTML(song);
    for (const source of [{ url: song.sourceUrl, label: song.sourceLabel }, ...song.creditSources]) {
      const end = html.indexOf('</a>', html.indexOf(`href="${attr(source.url)}"`)) + 4;
      const expected = ENDPOINT.test(source.url) && !source.label.includes('接口');
      assert.equal(html.startsWith(TAG, end), expected, `${song.id}: ${source.label}`);
      if (expected) tagged++;
    }
    assert.equal((html.match(/map-sources__kind/g) || []).length, [song.sourceUrl, ...song.creditSources.filter(item => item.id !== 'vocal').map(item => item.url)].filter((url, index) => ENDPOINT.test(url) && ![song.sourceLabel, ...song.creditSources.filter(item => item.id !== 'vocal').map(item => item.label)][index].includes('接口')).length, song.id);
  }
  assert.ok(tagged >= 3, 'the NetEase and Deezer endpoints are tagged');
});
