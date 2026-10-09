// Renders the room with an in-browser patched three-scene.js (repo untouched) to validate the proposed framing fix.
// Usage: node validate.cjs <variant: none|A|AC> WxH[,WxH...]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-20';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const variant = process.argv[2] || 'AC';
const vps = (process.argv[3] || '768x1024').split(',').map(s => s.split('x').map(Number));
function patch(src) {
  let n = 0; const rep = (a, b) => { if (!src.includes(a)) throw Error('missing: ' + a.slice(0, 60)); src = src.replace(a, b); n++; };
  if (variant === 'none') return src;
  const minimal = variant === 'AC2';
  rep('const portraitAspect=width/height<.85;', 'const portraitAspect=width/height<1;');
  if (!minimal) rep('const portraitAspect=width/height<.85,cols=', 'const portraitAspect=width/height<1,cols=');
  rep('stagePrintLayout(width/height<.85)', 'stagePrintLayout(width/height<1)');
  if (variant === 'AC' || minimal) rep('return {position:new THREE.Vector3(...overview.position),target:new THREE.Vector3(...overview.target)};',
    'const target=new THREE.Vector3(...overview.target),back=new THREE.Vector3(...overview.position).sub(target),right=new THREE.Vector3(back.z,0,-back.x).normalize();let distance=back.length();back.normalize();const half=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*(width/height)*.88;for(const person of livePeople.values()){const q=person.root.position.clone().setY(1.5).sub(target);distance=Math.max(distance,(Math.abs(q.dot(right))+.5)/half+q.dot(back));}window.__V20_FIT__={distance,aspect:width/height,n:livePeople.size};return {position:target.clone().addScaledVector(back,distance),target};');
  return src;
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  const results = [];
  for (const [w, h] of vps) {
    const name = `fix${variant}-${w}x${h}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w <= 900 ? 2 : 1, isMobile: w < 1100, hasTouch: w < 1100 });
    let patched = 0;
    await ctx.route(u => new URL(u).pathname.endsWith('/avatar/three-scene.js'), async route => {
      const resp = await route.fetch(); const body = patch(await resp.text()); patched++;
      await route.fulfill({ response: resp, body, headers: { ...resp.headers(), 'content-length': String(Buffer.byteLength(body)) } });
    });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden, null, { timeout: 60000 }).catch(() => {});
    await sleep(2500);
    const snap = label => page.evaluate(label => { const qa = window.__SPACE_EVENT_QA__?.(), c = document.querySelector('#world canvas').getBoundingClientRect();
      return { label, n: qa?.members?.length, cam: qa?.camera?.camera?.position?.map(v => +v.toFixed(2)), aspect: +(c.width / c.height).toFixed(3), fit: window.__V20_FIT__ || null,
        tags: [...document.querySelectorAll('#hotspots .hotspot')].filter(n => n.dataset.kind === 'person').map(n => n.textContent.trim().replace(/·示例 · .*/, '') + (n.hidden ? '[HIDDEN]' : '@' + Math.round(n.getBoundingClientRect().left + n.getBoundingClientRect().width / 2 - c.left) + '/' + Math.round(c.width))) }; }, label);
    const s = [await snap('lobby')]; await page.screenshot({ path: `${OUT}/shots/${name}-lobby.png` });
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 });
    await sleep(4000); s.push(await snap('room4')); await page.screenshot({ path: `${OUT}/shots/${name}-room4.png` });
    if (process.env.WAIT5) { for (let i = 0; i < 30; i++) { await sleep(500); if ((await page.evaluate(() => window.__SPACE_EVENT_QA__?.().members.length)) >= 5) break; } await sleep(2000); s.push(await snap('room5')); await page.screenshot({ path: `${OUT}/shots/${name}-room5.png` }); }
    results.push({ name, patched, errors, s }); console.log(JSON.stringify({ name, patched, errors, s }));
    await ctx.close();
  }
  await browser.close(); console.log('done');
})().catch(e => { console.error('ERR', e); process.exit(1); });
