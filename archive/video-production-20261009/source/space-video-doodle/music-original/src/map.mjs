// Annotated arrangement map (doodle style) for the editor: sections, hit points, waveform, per-bar loudness, spectrogram.
// usage: node map.mjs   -> /tmp/space-video-doodle/music-original/png/arrangement-map.png
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');

const ROOT = '/tmp/space-video-doodle/music-original';
const beats = JSON.parse(fs.readFileSync(`${ROOT}/beats.json`, 'utf8'));
const data = JSON.parse(fs.readFileSync(`${ROOT}/analysis/_mapdata.json`, 'utf8'));
const spec = fs.readFileSync(`${ROOT}/analysis/_spec_strip.png`).toString('base64');
const font = (n) => `url(data:font/ttf;base64,${fs.readFileSync(`/tmp/music-space-font-cache/${n}.ttf`).toString('base64')})`;

const W = 2400, H = 1500;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Logo;src:${font('logo')}}
@font-face{font-family:Display;src:${font('display')}}
@font-face{font-family:Marker;src:${font('marker')}}
@font-face{font-family:Hand;src:${font('hand')}}
@font-face{font-family:Digits;src:${font('digits')}}
html,body{margin:0;background:#f7efdf}
canvas{display:block}
</style></head><body><canvas id="c" width="${W}" height="${H}"></canvas>
<script>
const beats = ${JSON.stringify(beats)};
const data = ${JSON.stringify(data)};
const C = {paper:'#f7efdf', card:'#fffaf0', deep:'#efe3c8', ink:'#1c1b1a', ink2:'#3d3a36', ink3:'#6b655c', pink:'#ff5c8a', pinkS:'#ffd0dd', mint:'#5fdcc0', mintS:'#c9f3e8', yellow:'#ffd447', yellowS:'#fff0b8', sky:'#74b9ff', skyS:'#d6e9ff'};
async function go(){
  await Promise.all(['64px Logo','40px Display','30px Marker','26px Hand','26px Digits'].map(f=>document.fonts.load(f, 'Music Space 同一刻另一面 0123456789 冷开场标题痛点如果产品出场时刻揭晓交换已接受社交换调升调副歌收尾片尾大和弦配乐原创合成无采样')));
  const cv = document.getElementById('c'), g = cv.getContext('2d');
  g.fillStyle = C.paper; g.fillRect(0,0,${W},${H});
  g.fillStyle = 'rgba(28,27,26,0.13)';
  for (let y=12; y<${H}; y+=26) for (let x=12; x<${W}; x+=26) { g.beginPath(); g.arc(x,y,1.6,0,6.283); g.fill(); }
  const X0 = 110, X1 = ${W} - 60, T = beats.total_s;
  const X = t => X0 + (X1 - X0) * t / T;
  const wob = (s) => (Math.sin(s*12.9898)*43758.5453)%1*1.5;
  function box(x,y,w,h,fill,shadow=C.ink,r=10,sh=5,lw=3){
    g.fillStyle = shadow; rr(x+sh,y+sh,w,h,r); g.fill();
    g.fillStyle = fill; rr(x,y,w,h,r); g.fill();
    g.lineWidth = lw; g.strokeStyle = C.ink; rr(x,y,w,h,r); g.stroke();
  }
  function rr(x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.lineTo(x+w-r,y+wob(x)); g.quadraticCurveTo(x+w,y,x+w,y+r); g.lineTo(x+w+wob(y),y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h); g.lineTo(x+r,y+h+wob(w)); g.quadraticCurveTo(x,y+h,x,y+h-r); g.lineTo(x+wob(h),y+r); g.quadraticCurveTo(x,y,x+r,y); g.closePath(); }
  function txt(s,x,y,font,fill=C.ink,align='left',shadow=null,off=4){ g.font=font; g.textAlign=align; g.textBaseline='alphabetic'; if(shadow){g.fillStyle=shadow; g.fillText(s,x+off,y+off);} g.fillStyle=fill; g.fillText(s,x,y); }
  const mmss = t => { const m = Math.floor(t/60), s = t - 60*m; return m + ':' + (s<10?'0':'') + s.toFixed(1); };

  // ---------------- header
  txt('Same Moment, Other Side', 70, 112, '86px Logo', C.ink, 'left', C.pink, 6);
  txt('同一刻，另一面 · Music Space 比赛视频原创配乐', 74, 178, '46px Display', C.ink, 'left', C.mint, 3);
  const chips = [['124 BPM · 4/4 · 2:56', C.yellow], ['D 大调 → 副歌升到 E 大调', C.mintS], ['100% 代码合成 · 无采样', C.pinkS], ['−16 LUFS · 真峰值 ' + beats.master.true_peak_dbtp.toFixed(1) + ' dBTP', C.skyS]];
  let cx = 1290;
  chips.forEach(([s,fill],i)=>{ g.font='30px Marker'; const w = g.measureText(s).width + 40; g.save(); g.translate(cx, 72 + (i%2)*62); g.rotate((i%2?1:-1)*0.012); box(0,0,w,48,fill,C.ink,24,4,2.5); txt(s, 20, 34, '30px Marker'); g.restore(); if(i%2) cx += Math.max(w, 0) + 30; else cx += 0; if(i===1) cx = 1290 + 520; });

  // ---------------- section band
  const colors = {HOOK:C.yellow, TITLE:C.pink, PAIN:C.deep, WHATIF:C.pinkS, GROOVE_A:C.mint, AI:C.sky, REVEAL:C.pinkS, GROOVE_B:C.mint, BREAK:C.yellow, LIFT:C.pink, TAG:C.yellow, END:C.skyS};
  const zh = {HOOK:'冷开场', TITLE:'标题', PAIN:'痛点', WHATIF:'如果…', GROOVE_A:'产品出场', AI:'AI 时刻', REVEAL:'揭晓+铺垫', GROOVE_B:'交换已接受+社交', BREAK:'换调', LIFT:'升调副歌', TAG:'收', END:'片尾大和弦'};
  const yS = 262, hS = 120;
  beats.sections.forEach((s,i)=>{
    const x = X(s.start_s), w = X(s.end_s) - X(s.start_s) - 6;
    box(x, yS + (i%2)*10, w, hS, colors[s.name] || C.card, C.ink, 12, 5, 2.5);
    const big = w > 90;
    if (!big) {
      txt(zh[s.name], x + w / 2 + 3, yS - 14, '26px Display', C.ink, 'center');
      txt(String(s.first_bar), x + w / 2, yS + (i%2)*10 + 70, '20px Digits', C.ink2, 'center');
    } else {
      g.save(); g.beginPath(); g.rect(x, yS-10, w, hS+30); g.clip();
      txt(zh[s.name], x + 10, yS + (i%2)*10 + 44, '34px Display');
      txt(s.name.replace('_',' '), x + 10, yS + (i%2)*10 + 78, '22px Marker', C.ink2);
      txt('bar ' + s.first_bar + (s.last_bar>s.first_bar? '–' + s.last_bar : ''), x + 10, yS + (i%2)*10 + 106, '20px Digits', C.ink3);
      g.restore();
    }
  });

  // ---------------- ruler
  const yR = 440;
  g.strokeStyle = C.ink; g.lineWidth = 2.5; g.beginPath(); g.moveTo(X0, yR); g.lineTo(X1, yR); g.stroke();
  beats.bar_starts_s.forEach((t,i)=>{ const bar = i+1; const big = (bar-1)%4===0; g.lineWidth = big?2.5:1.2; g.beginPath(); g.moveTo(X(t), yR); g.lineTo(X(t), yR + (big?16:8)); g.stroke(); if (big) txt(String(bar), X(t)+3, yR + 36, '19px Digits', C.ink2); });
  for (let t=0; t<=T; t+=10){ txt(mmss(t).replace('.0',''), X(t), yR - 8, '19px Digits', C.ink3, 'center'); }

  // ---------------- waveform
  const yW = 680, hW = 140;
  const pk = data.wave.peak, rms = data.wave.rms, n = pk.length;
  g.fillStyle = 'rgba(28,27,26,0.85)';
  for (let i=0;i<n;i++){ const x = X(i/n*data.wave.seconds), a = pk[i]*hW*1.35; g.fillRect(x, yW - a, (X1-X0)/n + 0.6, 2*a); }
  g.fillStyle = C.pink;
  for (let i=0;i<n;i++){ const x = X(i/n*data.wave.seconds), a = rms[i]*hW*1.35; g.fillRect(x, yW - a, (X1-X0)/n + 0.6, 2*a); }
  txt('波形（墨）+ RMS（粉）', X1, yW + hW + 24, '24px Marker', C.ink2, 'right');

  // ---------------- per-bar loudness curve
  const yL = 1010, hL = 140;  // -26 .. -12 LUFS
  box(X0-20, yL - hL - 20, X1 - X0 + 40, hL + 40, C.card, C.ink, 14, 5, 2);
  const LY = v => yL - (Math.max(-28, Math.min(-12, v)) + 28) / 16 * hL;
  [-24,-20,-16,-12].forEach(v=>{ g.strokeStyle='rgba(28,27,26,0.2)'; g.lineWidth=1; g.setLineDash([6,6]); g.beginPath(); g.moveTo(X0, LY(v)); g.lineTo(X1, LY(v)); g.stroke(); g.setLineDash([]); txt(v + ' LUFS', X0 - 14, LY(v) + 7, '17px Digits', C.ink3, 'right'); });
  g.strokeStyle = C.ink; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath();
  data.bar_lufs.forEach((v,i)=>{ const t0 = beats.bar_starts_s[i], t1 = (beats.bar_starts_s[i+1] ?? beats.total_s); const y = LY(v); if(i===0) g.moveTo(X(t0), y); else g.lineTo(X(t0), y); g.lineTo(X(t1), y); });
  g.stroke();
  txt('每小节响度（短时，LUFS）', X0, yL - hL - 30, '24px Marker', C.ink2);

  // ---------------- spectrogram strip
  const img = new Image(); img.src = 'data:image/png;base64,${spec}';
  await img.decode();
  const yP = 1100, hP = 300;
  g.drawImage(img, X0, yP, X1 - X0, hP);
  g.lineWidth = 3; g.strokeStyle = C.ink; g.strokeRect(X0, yP, X1 - X0, hP);
  txt('频谱 30 Hz – 20 kHz（对数）', X0, yP - 12, '24px Marker', C.ink2);

  // ---------------- hit markers
  const keys = ['hard_stop_stab','title_impact','drop','ai_chime','reveal','build_gap','payoff','break','lift','tag','end_card'];
  const zhh = {hard_stop_stab:'急停', title_impact:'标题重击', drop:'DROP 产品出场', ai_chime:'AI 叮', reveal:'揭晓', build_gap:'空一拍', payoff:'交换已接受！', break:'换调', lift:'升调副歌', tag:'收尾重音', end_card:'片尾大和弦'};
  const fills = {hard_stop_stab:C.card, title_impact:C.pink, drop:C.mint, ai_chime:C.sky, reveal:C.pinkS, build_gap:C.card, payoff:C.pink, break:C.yellow, lift:C.pink, tag:C.yellow, end_card:C.skyS};
  let lane = 0, lastX = -1e9;
  beats.hits.filter(h=>keys.includes(h.name)).forEach((h,i)=>{
    const x = X(h.time_s);
    g.strokeStyle = C.ink; g.lineWidth = 2.5; g.setLineDash([10,7]);
    g.beginPath(); g.moveTo(x, 500); g.lineTo(x, yP + hP); g.stroke(); g.setLineDash([]);
    const label = zhh[h.name] + ' ' + mmss(h.time_s);
    g.font = '24px Marker'; const w = g.measureText(label).width + 26;
    lane = (x - lastX < w + 20) ? (lane + 1) % 3 : 0; lastX = x;
    const ly = 506 + lane * 40;
    const lx = Math.min(x - 8, X1 - w);
    g.save(); g.translate(lx, ly); g.rotate(((i%3)-1)*0.015);
    box(0, 0, w, 34, fills[h.name] || C.card, C.ink, 17, 3, 2);
    txt(label, 13, 26, '24px Marker'); g.restore();
  });
  // sticker pops as small stars on the ruler
  beats.hits.filter(h=>h.name==='sticker_pop' || h.name==='tagline_pop' || h.name==='final_ding').forEach(h=>{
    const x = X(h.time_s), y = yR + 54; g.fillStyle = C.yellow; g.strokeStyle = C.ink; g.lineWidth = 2;
    g.beginPath(); for(let k=0;k<10;k++){ const r = k%2? 5 : 12, a = -Math.PI/2 + k*Math.PI/5; g.lineTo(x + r*Math.cos(a), y + r*Math.sin(a)); } g.closePath(); g.fill(); g.stroke();
  });
  txt('★ = 贴纸弹出提示（glock 叮叮，tagline / sticker_pop / final_ding）', X1, ${H} - 34, '24px Hand', C.ink2, 'right');
  txt('Music Space · 原创配乐（代码合成，无采样）· beats.json 含全部小节、命中点、鼓点与口哨音符时间', X0, ${H} - 34, '24px Hand', C.ink2);
  document.title = 'done';
}
go();
</script></body></html>`;

fs.writeFileSync(`${ROOT}/analysis/_map.html`, html);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('file://' + `${ROOT}/analysis/_map.html`);
  await page.waitForFunction(() => document.title === 'done', null, { timeout: 60000 });
  await page.locator('#c').screenshot({ path: `${ROOT}/png/arrangement-map.png` });
  console.log('wrote', `${ROOT}/png/arrangement-map.png`);
} finally {
  await browser.close();
}
