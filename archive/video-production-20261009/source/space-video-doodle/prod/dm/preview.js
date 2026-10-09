// Interactive look at a scene in a normal browser (NOT the render path): /dm/stage.html?map=flipping-in&scene=act-A2&preview=1
// Space = play/pause with the music bed, arrows = +-1 beat (shift: +-1 bar), the slider scrubs.  Frames are drawn with DM.render()
// on the music's clock, so timing is what the render will be (the render itself is frame-exact; this view may drop frames).
const map = DM.map(); const fps = DM.cfg.fps;
const bar = document.createElement('div');
bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:56px;background:#1c1b1a;color:#fffaf0;font:16px/56px monospace;display:flex;gap:14px;align-items:center;padding:0 16px;z-index:999999';
bar.innerHTML = `<button id="pv-play" style="font:16px monospace">play</button><input id="pv-pos" type="range" min="0" max="${map.end_s}" step="0.001" value="0" style="flex:1"><span id="pv-t"></span>`;
document.body.appendChild(bar);
const audio = new Audio(`/audio/beds/${map.id}.m4a`); audio.preload = 'auto';
const pos = bar.querySelector('#pv-pos'), lab = bar.querySelector('#pv-t'), play = bar.querySelector('#pv-play');
let t = +(new URLSearchParams(location.search).get('t') || 0), playing = false, busy = false;
const show = async tt => { if (busy) return; busy = true; t = Math.max(0, Math.min(map.end_s, tt)); await DM.render(Math.round(t * fps)); pos.value = t; const p = DM.pos(t); lab.textContent = `${p.sb}:${p.beat.toFixed(2)}  ${t.toFixed(2)} s`; busy = false; };
const loop = async () => { if (!playing) return; await show(audio.currentTime); requestAnimationFrame(loop); };
play.onclick = () => { playing = !playing; play.textContent = playing ? 'pause' : 'play'; if (playing) { audio.currentTime = t; audio.play(); loop(); } else audio.pause(); };
pos.oninput = () => { audio.currentTime = +pos.value; show(+pos.value); };
addEventListener('keydown', e => {
  if (e.key === ' ') { e.preventDefault(); play.onclick(); }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const d = (e.shiftKey ? DM.barS() : DM.beatS()) * (e.key === 'ArrowRight' ? 1 : -1); audio.currentTime = t + d; show(t + d); }
});
show(t);
