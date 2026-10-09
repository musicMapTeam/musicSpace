// Where the shop sign (the marquee board on the roof) and the cabinet land on screen in the 我的发现 view, for the current
// shots or for trial shots (TRIAL='{"portrait":{"records":{...}},"desktop":{...}}'). Needs the TEMP-DEBUG hooks.
const { launch, MAP, mkdir } = require('./lib.cjs');
const OUT = mkdir(process.env.OUT || '/tmp/space-map/shots/fix/signprobe');
const TRIAL = process.env.TRIAL ? JSON.parse(process.env.TRIAL) : null;
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['390x844', '360x740', '320x568', '430x932', '768x1024', '820x1180', '1024x1366', '1024x768', '1440x900'])
  .map(s => s.split('x').map(Number));
(async () => {
  const browser = await launch();
  for (const [w, h] of sizes) {
    const touch = w <= 1024 && h > w;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    await page.goto(MAP + '#/records', { waitUntil: 'load' });
    await page.waitForSelector('#sakura-world canvas', { timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => globalThis.__mapDebug, null, { timeout: 20000 });
    await page.waitForTimeout(2500);
    if (TRIAL || process.env.UNION) {
      await page.evaluate(({ trial, union }) => {
        if (trial) for (const [set, shots] of Object.entries(trial)) Object.assign(globalThis.__mapShots[set], shots);
        if (union) {
          const { model, THREE, boundsForShot } = globalThis.__mapDebug; const sign = new THREE.Box3();
          for (const child of model.roof.children) if (Math.abs(child.position.y - 3.293) < .01 && child.position.z > 2.0) sign.expandByObject(child);
          boundsForShot('records').union(sign);
        }
        globalThis.__mapDebug.director.reframe(true);
      }, { trial: TRIAL, union: !!process.env.UNION });
      await page.waitForTimeout(800);
    }
    const r = await page.evaluate(() => {
      const { camera, model, THREE, size } = globalThis.__mapDebug;
      const { width, height } = size();
      camera.updateMatrixWorld();
      const screenBox = box => {
        const pts = [];
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const v = new THREE.Vector3(x, y, z).project(camera); pts.push([(v.x + 1) * width / 2, (1 - v.y) * height / 2, v.z]);
        }
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        return [Math.round(Math.min(...xs)), Math.round(Math.min(...ys)), Math.round(Math.max(...xs)), Math.round(Math.max(...ys)), pts.every(p => p[2] < 1 && p[2] > -1)];
      };
      const sign = new THREE.Box3();
      model.roof.updateMatrixWorld(true);
      for (const child of model.roof.children) if (Math.abs(child.position.y - 3.293) < .01 && child.position.z > 2.0) sign.expandByObject(child);
      const shelf = new THREE.Box3().setFromObject(model.shelf);
      const brand = document.querySelector('.app-studio-shell .brand').getBoundingClientRect();
      const tools = document.querySelector('.masthead-tools').getBoundingClientRect();
      const cap = document.querySelector('.world-caption').getBoundingClientRect();
      const main = document.querySelector('.main-content').getBoundingClientRect();
      const layout = globalThis.__mapDebug.framing.get('records');
      const eye = camera.position.toArray().map(v => +v.toFixed(2));
      return { sign: screenBox(sign), shelf: screenBox(shelf), eye, fov: camera.fov, rect: [layout.rect.left, layout.rect.top, layout.rect.right, layout.rect.bottom].map(Math.round),
        mast: Math.round(Math.max(brand.bottom, tools.bottom, cap.bottom)), main: [main.left, main.top, main.right, main.bottom].map(Math.round) };
    });
    // the sign is a problem when any of it is on screen and its top is above the masthead's bottom
    const [sl, st, sr, sb] = r.sign; const onScreen = sr > 0 && sl < w && sb > 0 && st < h;
    const verdict = !onScreen ? 'sign OFF screen' : st < r.mast ? `sign UNDER MASTHEAD (top ${st} < ${r.mast})` : 'sign fully below the masthead';
    console.log(`${w}x${h}`, verdict, JSON.stringify(r));
    await page.screenshot({ path: `${OUT}/${w}x${h}.png` });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
