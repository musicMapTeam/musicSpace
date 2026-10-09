const s = await get('phone');
const p = s.page;
const out = { tries: [] };
const sc = () => p.evaluate(() => { const c = document.querySelector('.corner-panel .community-scroll'); const i = document.querySelector('.corner-panel form[data-corner-edit] input[name=note]'); return c ? { top: Math.round(c.scrollTop), max: c.scrollHeight - c.clientHeight, inputY: Math.round(i.getBoundingClientRect().y) } : null; });
for (const target of [400, 500, 560, 610, 680]) {
  const discard = p.locator('.corner-panel button', { hasText: '放弃改动' });
  if (await discard.count()) { await discard.first().click(); await sleep(600); }
  await p.evaluate(t => { document.activeElement?.blur?.(); document.querySelector('.corner-panel .community-scroll').scrollTop = t; }, target);
  await sleep(300);
  const before = await sc();
  await H.freezeKeep(s);
  s.startRecording('/tmp/space-video-doodle/prod/capture/P2P3-rc2/probe/tmp-typing.mp4');
  await s.frames(2);
  const b = await p.locator('.corner-panel form[data-corner-edit] input[name=note]').boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down(); await s.frames(3); await p.mouse.up(); await s.frames(2);
  const seq = [];
  for (const ch of [...'返场']) { await p.keyboard.insertText(ch); seq.push((await sc()).top); await s.frames(3); }
  await s.stopRecording();
  await s.unfreeze();
  await sleep(300);
  out.tries.push({ target, before, seq });
}
const discard = p.locator('.corner-panel button', { hasText: '放弃改动' });
if (await discard.count()) { await discard.first().click(); await sleep(600); }
return out;
