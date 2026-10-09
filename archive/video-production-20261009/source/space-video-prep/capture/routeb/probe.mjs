// Quick look at a Route B build: prints status / headings / buttons / inputs and saves a screenshot per call.
// usage: SPACE_BASE=http://127.0.0.1:8800/musicSpace/ node routeb/probe.mjs [--enter] [--shot name]
import { launch } from '../rec.mjs';
import { open, enterShowcase, UI } from './rb.mjs';
const base = process.env.SPACE_BASE; if (!base) { console.error('set SPACE_BASE to the app root URL (with trailing slash)'); process.exit(2); }
const browser = await launch();
const s = await open(browser, base, { cursor: false });
const dump = async label => {
  const info = await s.page.evaluate(() => ({
    status: document.querySelector('#render-status')?.innerText, title: document.title,
    buttons: [...document.querySelectorAll('button,[role=button],a.button')].filter(b => b.offsetParent).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 60),
    inputs: [...document.querySelectorAll('input,select,textarea')].filter(b => b.offsetParent).map(b => `${b.tagName.toLowerCase()}[${b.type || ''}${b.name ? ' name=' + b.name : ''}]`).slice(0, 30),
    headings: [...document.querySelectorAll('h1,h2,h3,.eyebrow')].filter(b => b.offsetParent).map(b => b.innerText.trim().replace(/\s+/g, ' ')).slice(0, 20),
    panel: (document.querySelector('#panel')?.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
    boot: window.__SPACE_BOOT__,
  }));
  console.log(`--- ${label}\n${JSON.stringify(info, null, 1)}`);
  await s.still(`/tmp/space-video-prep/stills/routeb-probe-${label}.png`);
};
await dump('landing');
if (process.argv.includes('--enter')) { await enterShowcase(s); await dump('room'); }
await s.close(); await browser.close();
