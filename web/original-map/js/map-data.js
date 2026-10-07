import { REAL_CATALOGUE_VERSION, realArtists, realSongs, realEdges } from './map-catalogue.js';

// One catalogue: the credited vocal collaborations of map-catalogue.js. Catalogue growth only adds ids, so stored sessions stay
// valid without a version bump. The invented 0.15 example catalogue (its singers, songs and curated tags) is gone; map.js drops any
// stored record that still points at it (prepareStoredMap).
export const MAP_DATA_VERSION = 'catalogues-2026-09-v1';

export const catalogues = {
  // rounds: fixed, reproducible 寻声 puzzles (start → target), each checked to be ≥ 2 co steps apart.
  // The first pair is the default round; later pairs are only appended so a stored roundCursor keeps its meaning.
  real: { id: 'real', version: REAL_CATALOGUE_VERSION, start: 'real-jay', target: 'real-gem', hasStyle: false,
    rounds: [
      ['real-fei', 'real-gem'], ['real-amei', 'real-stefanie'], ['real-cindy', 'real-jam'], ['real-gary', 'real-jinsha'], ['real-charlene', 'real-fei'],
      // 2026-09-28 expansion (references/research/2026-09-28/network-expansion.md): 4–6 songs apart.
      ['real-fei', 'real-yichun'], ['real-cheer', 'real-sandy'], ['real-qingfeng', 'real-yoga'], ['real-jolin', 'real-yichun'],
      ['real-lara', 'real-qingfeng'], ['real-andrew', 'real-asi'], ['real-jackson', 'real-sandy'],
    ] },
};
export const artists = [...realArtists];
export const artistById = Object.fromEntries(artists.map(artist => [artist.id, artist]));
export const songs = { ...realSongs };
export const edges = [...realEdges];

export const artistName = id => artistById[id]?.name || '未收录的歌手';
export const datasetForArtist = id => artistById[id]?.dataset;
export const artistsInDataset = dataset => artists.filter(artist => artist.dataset === dataset);
export const otherArtist = (edge, id) => edge.a === id ? edge.b : edge.a;
export const getNeighbors = (id, mode = 'co', dataset = datasetForArtist(id)) => edges.filter(edge => edge.dataset === dataset && edge.mode === mode && (edge.a === id || edge.b === id));

export function isReachable(start, target, dataset = datasetForArtist(start)) {
  if (!dataset || datasetForArtist(target) !== dataset) return false;
  const visited = new Set([start]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    if (id === target) return true;
    for (const edge of getNeighbors(id, 'co', dataset)) {
      const next = otherArtist(edge, id);
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}
