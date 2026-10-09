// Shared helpers for the Route B (static, in-browser runtime) capture scripts.
// Written against the Route B wave-1 CODE (strings/selectors in ui.mjs are read from the repo), but never run against a booted Route B page:
// the repo checkpoint 1915e23 still has the wave-1 stub profile (web/static-runtime/profile.js), T9b/T10 are wave 2.  open() refuses the stub with a clear message.
// usage of a shot:  export const meta = {...}; export async function run({ browser, base }) {...}
import { Session, sleep } from '../rec.mjs';
import { UI } from './ui.mjs';
export { UI, sleep };
export const OUT = id => `/tmp/space-video-prep/clips/routeb/${id}.mp4`;
export const SAMPLES_DIR = '/tmp/space-video-prep/photos/pack';

/** locator by visible text / accessible name; strings match exactly-ish, RegExps as given */
export const btn = (p, re) => p.getByRole('button', { name: re }).first();
export const txt = (p, re) => p.getByText(re).first();

/** fresh visitor: new browser context (empty IndexedDB / localStorage / Cache Storage) on the static site.  `base` is the APP ROOT url incl. trailing slash.
 *  Fails fast (20 s after the page script reports ready) when the page is not the real Route B build: the status line never reads 「示例现场 · 在本页运行」. */
export async function open(browser, base, { width, height, dpr, cursor = 'arrow', name = 'visitor', css = '' } = {}) {
  const s = await Session.open(browser, { url: base, width, height, dpr, cursor, name, css });
  await s.page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready' || /示例现场 · 在本页运行/.test(document.body.innerText), null, { timeout: 60000 });
  try {
    await s.page.waitForFunction(() => /示例现场 · 在本页运行/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 20000 });
  } catch {
    const seen = await s.page.evaluate(() => ({ status: document.querySelector('#render-status')?.innerText, join: document.querySelector('#join')?.innerText, boot: window.__SPACE_BOOT__ }));
    await s.close();
    throw new Error(`not the Route B build (status line never became 「示例现场 · 在本页运行」): ${JSON.stringify(seen)}.  The wave-1 stub profile has no showcase; wait for T9b/T10 or serve a later build.`);
  }
  await sleep(600);
  return s;
}
/** real-time: landing -> entry panel -> enter the showcase room (not recorded).  Returns when the room (cast) is on screen.
 *  With a wardrobe preset the identity is saved first (the entry form then shows the saved name read-only); without one the nickname is typed into the entry form. */
export async function enterShowcase(s, { nickname = '阿宁', preset = null } = {}) {
  const p = s.page;
  await btn(p, UI.enter).click(); await sleep(500);
  if (preset !== null) {
    await btn(p, UI.wardrobeOpen).click(); await sleep(700); await p.locator('.wardrobe-examples summary').click().catch(() => {}); await sleep(250);
    await p.locator(`.wardrobe button[data-preset="${preset}"]`).click().catch(() => {}); await sleep(350); await btn(p, UI.wardrobeSave).click(); await sleep(1200);
  }
  const nick = p.locator(UI.nickname).first();
  if (await nick.count() && !(await nick.getAttribute('readonly'))) { await nick.fill(nickname); }
  const consent = p.locator(UI.consentEntry).first(); if (await consent.count() && !(await consent.isChecked())) await consent.check();
  await p.locator('#panel form[data-form=demo-entry] button[type=submit]').click();           // 「进入示例现场」 (same label as the landing button)
  await p.waitForFunction(() => /回声现场/.test(document.body.innerText), null, { timeout: 30000 });
  await sleep(1500);
  return s;
}
/** real-time: wait until the on-device model has produced a verdict once (so the recorded take never shows the 10 MB download) - picks a sample, waits for the AI line, closes the panel */
export async function warmModel(s, { max = 120000 } = {}) {
  const p = s.page;
  await openSample(s, 'sample-crowd');
  await p.waitForFunction(re => new RegExp(re).test(document.querySelector('#panel')?.innerText || ''), UI.aiSure.source + '|' + UI.aiUnsure.source, { timeout: max }).catch(() => console.log('WARN: no AI verdict while warming (model may be unavailable: the shot then shows the manual path)'));
  await p.locator(UI.panelClose).click().catch(() => {}); await sleep(500);
}
/** real-time: put a bundled sample on the form: the tour card's button when the card is showing, else the sample list inside the upload panel */
export async function openSample(s, id = 'sample-crowd') {
  const p = s.page; const card = p.locator(UI.tourSample(id)).first();
  if (await card.isVisible().catch(() => false)) { await card.click(); }
  else {
    const first = p.locator('#room-first-photo');
    if (await first.isVisible().catch(() => false)) { await first.click(); await sleep(700); }
    await p.locator(UI.samplePhoto(id)).first().click();
  }
  await sleep(700);
}
export async function closePanel(s) { const x = s.page.locator(UI.panelClose); if (await x.isVisible().catch(() => false)) { await x.click(); await sleep(500); } }
/** the NPC autopilot reacts after ~2.5-5 s of VIRTUAL time; while the clock is frozen we have to step frames for that time to pass */
export async function waitText(s, re, { max = 600 } = {}) { return s.until(r => new RegExp(r).test(document.body.innerText), { arg: re.source, max }); }
