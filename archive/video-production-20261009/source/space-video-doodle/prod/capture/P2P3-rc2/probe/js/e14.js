const s = await get('phone');
const p = s.page;
const out = {};
const sv = p.locator('.corner-panel form[data-corner-save]');
await sv.locator('input[name=save]').check();
await sv.locator('button[type=submit]').click();
await sleep(1500);
out.afterSave = await H.text(p, '.corner-panel');
out.forms = await p.evaluate(() => [...document.querySelectorAll('.corner-panel form')].map(f => ({ attrs: [...f.attributes].map(a => a.name).join(' '), fields: [...f.querySelectorAll('input,textarea,select,button')].map(e => `${e.tagName} name=${e.name || ''} :: ${(e.closest('label')?.innerText || e.textContent || '').trim().slice(0, 40)}`) })));
const ex = p.locator('.corner-panel form', { has: p.locator('input[name=export]') });
if (await ex.count()) {
  await ex.locator('input[name=export]').check();
  await ex.locator('button[type=submit]').click();
  await p.waitForSelector('.corner-panel img.corner-result-preview', { timeout: 30000 });
  await sleep(1500);
  out.preview = await p.evaluate(() => { const i = document.querySelector('.corner-panel img.corner-result-preview'); return i && { src: i.src.slice(0, 60), w: i.naturalWidth, h: i.naturalHeight }; });
  out.afterExport = await H.text(p, '.corner-panel');
  await shot(p, 'e14-preview');
  const dl = p.waitForEvent('download', { timeout: 30000 });
  await p.locator('.corner-panel [data-corner-download]').click();
  const d = await dl;
  out.suggested = d.suggestedFilename();
  await d.saveAs('/tmp/space-video-doodle/prod/capture/P2P3-rc2/probe/corner-probe.png');
  await sleep(800);
  out.afterDownload = await H.text(p, '.corner-panel');
}
out.audit = await H.audit(p);
return out;
