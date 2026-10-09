import { launch, newPage, sleep, ensureDir, rimraf, fs } from './lib.mjs';
import { hostCreatesRoom } from './flows.mjs';
import { Stepper } from './stepper.mjs';

const FPS = Number(process.argv[2] || 30);
const FORMAT = process.argv[3] || 'png';
const DPR = Number(process.argv[4] || 1);
const OUT = '/tmp/space-video-prep/capture/runs/stepper-' + FPS + '-' + FORMAT + '-dpr' + DPR;
rimraf(OUT); ensureDir(OUT);

const browser = await launch();
const { page } = await newPage(browser, { dpr: DPR });
await Stepper.install(page);
await hostCreatesRoom(page, { name: '阿遥', title: '返场夜', venue: '月台 Livehouse' });
await sleep(1500);
const st = new Stepper(page, { fps: FPS, outDir: OUT, format: FORMAT });
await st.freeze();
const t0 = Date.now();
await st.record(0.5, { name: 'f' });                       // idle
await page.click('[data-view=photos]');                    // camera glides to the photo wall
await st.record(2.0, { name: 'f' });
await page.click('[data-view=person]');
await st.record(2.0, { name: 'f' });
await page.click('[data-view=overview]');
await st.record(2.0, { name: 'f' });
const wall = (Date.now() - t0) / 1000;
const tm = st.timings.sort((a, b) => a - b);
console.log(JSON.stringify({ fps: FPS, format: FORMAT, dpr: DPR, frames: st.n, virtual_s: +(st.n / FPS).toFixed(2), wall_s: +wall.toFixed(1), wall_per_frame_ms: +(wall * 1000 / st.n).toFixed(0), shot_p50_ms: tm[tm.length >> 1], shot_p95_ms: tm[Math.floor(tm.length * .95)] }));
// frames are named a/b/c/d + index; concat in order
const files = fs.readdirSync(OUT).filter(f => /\.(png|jpg)$/.test(f)).sort((x, y) => Number(x.replace(/\D/g, '')) - Number(y.replace(/\D/g, '')));
fs.writeFileSync(OUT + '/list.txt', files.map(f => `file '${OUT}/${f}'\nduration ${1 / FPS}`).join('\n'));
await browser.close();
