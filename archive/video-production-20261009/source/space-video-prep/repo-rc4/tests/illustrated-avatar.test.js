import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderAvatarSvg, avatarSvgDataUrl, normalizeIllustratedLook, illustratedLookKey, ILLUSTRATED_VIEWS, ILLUSTRATED_SIZE, ILLUSTRATED_INVENTORY } from '../web/illustrated-avatar/index.js';
import { DEFAULT_AVATAR, safeAvatar, TEMPLATES } from '../web/avatar/model.js';

const geometry = svg => svg.replace(/data-[a-z-]+="[^"]*"/g,'').replace(/<title>.*?<\/title>/g,'');
const pathData = svg => [...svg.matchAll(/\bd="([^"]*)"/g)].map(match => match[1]);
const geometryLayer = (svg, key) => svg.match(new RegExp(`<g data-layer="${key}"[^>]*>([\\s\\S]*?)</g>`))?.[1];

test('adapter preserves the existing v2 schema and legacy migration', () => {
  assert.deepEqual(normalizeIllustratedLook(),DEFAULT_AVATAR);
  for (const input of [{},{outfit:3,hair:2,accessory:'glasses'},{version:2,hair:7,top:4,eyewear:5},{...DEFAULT_AVATAR,shoes:99,skin:-8,accessory:'javascript:alert(1)'}]) {
    assert.deepEqual(normalizeIllustratedLook(input),safeAvatar(input));
  }
  const input = structuredClone(DEFAULT_AVATAR); renderAvatarSvg(input); assert.deepEqual(input,DEFAULT_AVATAR);
});

test('standalone SVG has an accessible escaped name, transparent default and stable dimensions', () => {
  const svg = renderAvatarSvg(DEFAULT_AVATAR,{label:'Lin <script>" & friends',width:480,height:1000});
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 240 500" width="480" height="1000"/);
  assert.match(svg,/role="img" aria-label="Lin &lt;script&gt;&quot; &amp; friends"/);
  assert.match(svg,/<title>Lin &lt;script&gt;&quot; &amp; friends<\/title>/);
  assert.doesNotMatch(svg,/<script|<foreignObject|<image|<style|href=|filter=|url\((?!#)/i);
  assert.doesNotMatch(svg,/<ellipse cx="117" cy="477"/);
  assert.match(renderAvatarSvg(DEFAULT_AVATAR,{shadow:true}),/<ellipse cx="117" cy="477"/);
  assert.equal(ILLUSTRATED_SIZE.feetY,477);
});

test('four actual view drawings, back has no facial layer or front print', () => {
  const views = ILLUSTRATED_VIEWS.map(view=>renderAvatarSvg(DEFAULT_AVATAR,{view}));
  assert.equal(new Set(views.map(geometry)).size,4);
  for (const view of ['front','quarter','side']) {
    const svg = renderAvatarSvg(DEFAULT_AVATAR,{view});
    assert.match(svg,/data-layer="features"/);
    assert.match(svg,new RegExp(`data-layer="face" data-part="${view}"`));
  }
  const back = renderAvatarSvg(DEFAULT_AVATAR,{view:'back'});
  assert.doesNotMatch(back,/data-layer="(?:face|features)"/);
  assert.notEqual(geometryLayer(back,'top'),geometryLayer(views[0],'top'));
  assert.notEqual(geometryLayer(back,'bottom'),geometryLayer(views[0],'bottom'));
  assert.equal(renderAvatarSvg(DEFAULT_AVATAR,{view:'unknown'}),renderAvatarSvg(DEFAULT_AVATAR,{view:'quarter'}));
});

test('no eyewear removes frames and temples in every direction without replacing face or expression',()=>{
  for(const view of ILLUSTRATED_VIEWS) for(const skin of [0,4]) for(const expression of ['neutral','smile','wink','focused']) {
    const look={...DEFAULT_AVATAR,skin,expression},bare=renderAvatarSvg({...look,eyewear:0},{view}),framed=renderAvatarSvg({...look,eyewear:1},{view});
    assert.equal(geometryLayer(bare,'eyewear'),'');
    assert.ok(geometryLayer(framed,'eyewear'));
    for(const part of ['face','features','hair-front','hair-back']) assert.equal(geometryLayer(bare,part),geometryLayer(framed,part));
    if(view!=='back') assert.ok(geometryLayer(bare,'features'),'a bare face still has eyes and facial marks');
  }
});

test('new looks include three bare presets; changing defaults never rewrites an explicit saved eyewear choice',()=>{
  assert.equal(DEFAULT_AVATAR.eyewear,0);
  assert.equal(TEMPLATES.filter(t=>t.avatar.eyewear===0).length,3);
  assert.equal(TEMPLATES.filter(t=>t.avatar.eyewear>0).length,3);
  for(let eyewear=0;eyewear<6;eyewear++) {
    const saved={...DEFAULT_AVATAR,eyewear};
    assert.deepEqual(normalizeIllustratedLook(JSON.parse(JSON.stringify(saved))),saved);
  }
  assert.equal(safeAvatar({version:1,outfit:0,accessory:'glasses'}).eyewear,1);
});

for (const [key, options] of Object.entries(ILLUSTRATED_INVENTORY)) {
  test(`${key}: each inventory option has independently different geometry`,()=>{
    assert.equal(new Set(options.map(o=>o.value)).size,options.length);
    for (const view of ILLUSTRATED_VIEWS) {
      const svgs=options.map(o=>geometry(renderAvatarSvg({...DEFAULT_AVATAR,[key]:o.value},{view})));
      assert.equal(new Set(svgs).size,options.length,`${key} in ${view} must not be metadata-only`);
    }
  });
}

test('changing garments preserves face and other selected modules', () => {
  const before = renderAvatarSvg(DEFAULT_AVATAR);
  for (const key of ['top','bottom','shoes']) {
    const after=renderAvatarSvg({...DEFAULT_AVATAR,[key]:2});
    assert.equal(geometryLayer(after,'face'),geometryLayer(before,'face'));
    assert.equal(geometryLayer(after,'features'),geometryLayer(before,'features'));
    assert.equal(geometryLayer(after,'hair-front'),geometryLayer(before,'hair-front'));
    for (const other of ['top','bottom','shoes'].filter(k=>k!==key)) assert.equal(geometryLayer(after,other),geometryLayer(before,other));
  }
});

test('cropped garments have a skin-filled torso beneath them', () => {
  for(const view of ILLUSTRATED_VIEWS) {
    const svg=renderAvatarSvg({...DEFAULT_AVATAR,top:5},{view});
    assert.ok(svg.indexOf('data-layer="torso"')<svg.indexOf('data-layer="top"'));
    assert.match(geometryLayer(svg,'torso'),/fill="#f6dbc0"/);
  }
});

test('all options across all four views produce bounded self-contained valid path tokens', () => {
  let checked=0;
  for(const view of ILLUSTRATED_VIEWS) for(const [key,items] of Object.entries(ILLUSTRATED_INVENTORY)) for(const option of items) {
    const svg=renderAvatarSvg({...DEFAULT_AVATAR,[key]:option.value},{view});
    assert.ok(svg.length<25000);
    assert.doesNotMatch(svg,/undefined|NaN|Infinity/);
    for(const d of pathData(svg)) assert.match(d,/^[\s,.\d+\-eEMmZzLlHhVvCcSsQqTtAa]+$/,d);
    checked++;
  }
  assert.equal(checked,144);
});

test('data URLs round trip without extra network resources; cache keys include look and direction', () => {
  assert.equal(decodeURIComponent(avatarSvgDataUrl(DEFAULT_AVATAR).split(',')[1]),renderAvatarSvg(DEFAULT_AVATAR));
  assert.notEqual(illustratedLookKey(DEFAULT_AVATAR,'front'),illustratedLookKey(DEFAULT_AVATAR,'back'));
  assert.notEqual(illustratedLookKey(DEFAULT_AVATAR),illustratedLookKey({...DEFAULT_AVATAR,top:2}));
});

test('all six outfit presets retain the same identity and produce distinct full-body art', () => {
  const faces=TEMPLATES.map(t=>geometryLayer(renderAvatarSvg(t.avatar),'face'));
  assert.equal(new Set(faces).size,1);
  assert.equal(new Set(TEMPLATES.map(t=>geometry(renderAvatarSvg(t.avatar)))).size,6);
});

test('review boards are reproducible standalone vector artifacts', () => {
  for(const name of ['views','presets','components']) {
    const board=readFileSync(new URL(`../web/illustrated-avatar/review-${name}.svg`,import.meta.url),'utf8');
    assert.match(board,/^<svg/);
    assert.doesNotMatch(board,/<image|href=/);
    assert.match(board,/data-illustrated-avatar="1"/);
  }
});


test('four poses change actual upper-body stance, with sleeve-safe waving and singing gestures', () => {
  for(const view of ILLUSTRATED_VIEWS) {
    const poses=['listen','sway','wave','sing'].map(pose=>renderAvatarSvg({...DEFAULT_AVATAR,pose},{view}));
    assert.equal(new Set(poses.map(geometry)).size,4);
    assert.match(poses[2],/data-layer="arms" data-part="wave"/);
    assert.match(poses[3],/data-layer="gesture-prop" data-part="microphone"/);
    for(const svg of poses) for(const reference of svg.matchAll(/url\(#([^)]*)\)/g)) assert.ok(svg.includes(`id="${reference[1]}"`));
  }
});
