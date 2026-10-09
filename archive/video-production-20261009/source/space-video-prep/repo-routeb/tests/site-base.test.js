import test from 'node:test';
import assert from 'node:assert/strict';
import {siteRoot, siteUrl, eventRoomUrl, eventRoomReturn} from '../web/shared/site-base.js';

// A document with just what site-base reads: baseURI and querySelector('meta[name="…"]').content.
const docOf = (baseURI, metas = {}) => ({
  baseURI,
  querySelector(selector) {
    const name = /^meta\[name="([^"]+)"\]$/.exec(selector)?.[1];
    return name && name in metas ? {content: metas[name]} : null;
  },
});
const PAGES = 'https://musicmapteam.github.io';
const roomHints = {'space-site-root': './', 'space-event-room': './'};
const mapHints = {'space-site-root': '../', 'space-event-room': '../'};

test('a page without hints (the Node room server) has its root at "/" and its room at /event-room/', () => {
  const doc = docOf('http://127.0.0.1:8787/event-room/?room=ABC123#overview');
  assert.equal(siteRoot(doc).href, 'http://127.0.0.1:8787/');
  assert.equal(siteUrl('music-map/', doc), 'http://127.0.0.1:8787/music-map/');
  assert.equal(siteUrl('/music-map/', doc), 'http://127.0.0.1:8787/music-map/', 'leading slashes do not escape the root');
  assert.equal(siteUrl('', doc), 'http://127.0.0.1:8787/');
  assert.equal(siteUrl(undefined, doc), 'http://127.0.0.1:8787/');
  assert.equal(eventRoomUrl(doc), 'http://127.0.0.1:8787/event-room/');
  // the Map page of the same server
  assert.equal(eventRoomUrl(docOf('http://127.0.0.1:8787/music-map/#/explore')), 'http://127.0.0.1:8787/event-room/');
});

test('the room at the site root: "./" hints resolve to the page directory, never the query or hash', () => {
  const doc = docOf(`${PAGES}/musicSpace/?v=3&room=ABC123#overview`, roomHints);
  assert.equal(siteRoot(doc).href, `${PAGES}/musicSpace/`);
  assert.equal(siteUrl('music-map/', doc), `${PAGES}/musicSpace/music-map/`);
  assert.equal(siteUrl('sql/sql-wasm.wasm', doc), `${PAGES}/musicSpace/sql/sql-wasm.wasm`);
  assert.equal(siteUrl('demo/manifest.json?x=1', doc), `${PAGES}/musicSpace/demo/manifest.json?x=1`);
  assert.equal(siteUrl('/music-map/', doc), `${PAGES}/musicSpace/music-map/`, 'a leading slash does not climb out of /musicSpace/');
  assert.equal(siteUrl('', doc), `${PAGES}/musicSpace/`);
  assert.equal(eventRoomUrl(doc), `${PAGES}/musicSpace/`);
  // the same page given as .../index.html, and without a trailing slash on the directory
  assert.equal(siteRoot(docOf(`${PAGES}/musicSpace/index.html`, roomHints)).href, `${PAGES}/musicSpace/`);
});

test('the same build under /preview/ stays inside /preview/', () => {
  const doc = docOf(`${PAGES}/musicSpace/preview/?room=ZZZ999`, roomHints);
  assert.equal(siteUrl('music-map/', doc), `${PAGES}/musicSpace/preview/music-map/`);
  assert.equal(siteUrl('ai/tc8/vision.onnx', doc), `${PAGES}/musicSpace/preview/ai/tc8/vision.onnx`);
  assert.equal(eventRoomUrl(doc), `${PAGES}/musicSpace/preview/`);
});

test('the Map one directory down: "../" hints lead back to the site root and to the room', () => {
  const root = docOf(`${PAGES}/musicSpace/music-map/#/explore`, mapHints);
  assert.equal(siteRoot(root).href, `${PAGES}/musicSpace/`);
  assert.equal(eventRoomUrl(root), `${PAGES}/musicSpace/`);
  const preview = docOf(`${PAGES}/musicSpace/preview/music-map/?x=1#/explore`, mapHints);
  assert.equal(siteRoot(preview).href, `${PAGES}/musicSpace/preview/`);
  assert.equal(eventRoomUrl(preview), `${PAGES}/musicSpace/preview/`);
});

test('empty or blank hints behave like no hints; hints are trimmed', () => {
  const base = 'http://localhost:4783/musicSpace/preview/';
  assert.equal(siteRoot(docOf(base, {'space-site-root': ''})).href, 'http://localhost:4783/');
  assert.equal(siteRoot(docOf(base, {'space-site-root': '   '})).href, 'http://localhost:4783/');
  assert.equal(eventRoomUrl(docOf(base, {'space-event-room': ''})), 'http://localhost:4783/event-room/');
  assert.equal(siteRoot(docOf(base, {'space-site-root': ' ./ '})).href, base);
});

test('without a document the helpers fall back to location, then to localhost', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    delete globalThis.location;
    assert.equal(siteUrl('music-map/'), 'http://localhost/music-map/');
    assert.equal(eventRoomUrl(), 'http://localhost/event-room/');
    globalThis.location = {href: 'http://127.0.0.1:5182/event-room/?x=1'};
    assert.equal(siteUrl('music-map/'), 'http://127.0.0.1:5182/music-map/');
    assert.equal(siteRoot().href, 'http://127.0.0.1:5182/');
  } finally {
    if (saved) Object.defineProperty(globalThis, 'location', saved); else delete globalThis.location;
  }
});

test('the Map returns only to the event room itself, on this origin', () => {
  // Pages root
  const doc = docOf(`${PAGES}/musicSpace/music-map/#/explore`, mapHints);
  const loc = {href: `${PAGES}/musicSpace/music-map/#/explore`};
  const home = `${PAGES}/musicSpace/`;
  const allowed = [['/musicSpace/', home], ['/musicSpace/?room=ABC123', `${home}?room=ABC123`], ['/musicSpace/?room=ABC123#overview', `${home}?room=ABC123#overview`], ['/musicSpace/index.html?room=A', `${home}index.html?room=A`], [`${PAGES}/musicSpace/?room=A`, `${home}?room=A`]];
  for (const [candidate, expected] of allowed) assert.equal(eventRoomReturn(candidate, doc, loc), expected, candidate);
  const refused = ['https://evil.example/musicSpace/', '//evil.example/musicSpace/', '/\\evil.example/musicSpace/', '/musicSpace/classic/', '/musicSpace/music-map/', '/musicSpace/preview/', '/musicSpace/preview/?room=A', '/musicSpace', '/event-room/', 'javascript:alert(1)', 'data:text/html,x', '?room=A', '', '   ', null, undefined, 42, {href: '/musicSpace/'}, ['/musicSpace/']];
  for (const candidate of refused) assert.equal(eventRoomReturn(candidate, doc, loc), home, String(candidate));
});

test('the same check under /preview/ and on the Node server', () => {
  const previewDoc = docOf(`${PAGES}/musicSpace/preview/music-map/`, mapHints), previewLoc = {href: `${PAGES}/musicSpace/preview/music-map/`};
  assert.equal(eventRoomReturn('/musicSpace/preview/?room=A', previewDoc, previewLoc), `${PAGES}/musicSpace/preview/?room=A`);
  assert.equal(eventRoomReturn('/musicSpace/?room=A', previewDoc, previewLoc), `${PAGES}/musicSpace/preview/`, 'the other channel is not this room');
  // Node server: exactly what the old startsWith("/event-room/") accepted for real room addresses
  const nodeDoc = docOf('http://127.0.0.1:8787/music-map/#/explore'), nodeLoc = {href: 'http://127.0.0.1:8787/music-map/#/explore'};
  assert.equal(eventRoomReturn('/event-room/?room=ABC123#photos', nodeDoc, nodeLoc), 'http://127.0.0.1:8787/event-room/?room=ABC123#photos');
  assert.equal(eventRoomReturn('/event-room/', nodeDoc, nodeLoc), 'http://127.0.0.1:8787/event-room/');
  assert.equal(eventRoomReturn('//evil.example/event-room/', nodeDoc, nodeLoc), 'http://127.0.0.1:8787/event-room/');
  assert.equal(eventRoomReturn('/music-map/', nodeDoc, nodeLoc), 'http://127.0.0.1:8787/event-room/');
  assert.equal(eventRoomReturn(undefined, nodeDoc, nodeLoc), 'http://127.0.0.1:8787/event-room/');
});
