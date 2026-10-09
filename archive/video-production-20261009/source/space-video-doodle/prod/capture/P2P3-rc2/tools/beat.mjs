// Beat-exact taps for the frame-stepped rig (output frames at 60 fps; the rig's virtual clock advances 16 ms per frame).
// The tap target is the mouseup frame: the first captured frame that can show the product's reaction.  The doodle tap ring
// (rig cursor 'touch') starts 3 frames earlier, on mousedown.
export const WORK_BPM = +(process.env.WORK_BPM || 123);           // Wax Lyricist "Flipping In" (working track)
export const beatFrames = (bpm = WORK_BPM) => 3600 / bpm;          // 29.27 frames at 123 BPM
export const PRESS_FRAMES = 3;

/** a JSON-able record of what happened at which output frame */
export function makeLog(s) {
  const log = [];
  const add = (label, extra = {}) => { const f = s.sink ? s.sink.frames : null; log.push({ label, frame: f, t: f == null ? null : +(f / 60).toFixed(3), ...extra }); return f; };
  return { log, add };
}

/** press at (upAt - 3), release at upAt (output frame index).  Pointer is moved in the same frame as the press (no hover dwell). */
export async function tapAt(s, locator, upAt, { label = 'tap', L, dx = 0, dy = 0 } = {}) {
  const loc = typeof locator === 'string' ? s.page.locator(locator) : locator;
  const wait = upAt - PRESS_FRAMES - s.sink.frames;
  if (wait < 0) throw new Error(`tapAt ${label}: target frame ${upAt} already passed (now ${s.sink.frames})`);
  await s.frames(wait);                                     // measure only now: sheets may still have been moving
  const b = await loc.first().boundingBox();
  if (!b) throw new Error('tapAt: no box for ' + label);
  const x = b.x + b.width / 2 + dx, y = b.y + b.height / 2 + dy;
  await s.page.mouse.move(x, y); s.mouse = { x, y };
  const down = s.sink.frames;
  await s.page.mouse.down(); await s.frames(PRESS_FRAMES); await s.page.mouse.up();
  const up = s.sink.frames;
  if (L) L.add(label, { down, up, x: Math.round(x), y: Math.round(y) });
  return { down, up };
}

/** next frame on the beat grid that starts at frame `origin`, at least `minAhead` frames from now */
export function nextBeat(s, origin, { bpm = WORK_BPM, minAhead = PRESS_FRAMES + 1, sub = 1 } = {}) {
  const bf = beatFrames(bpm) / sub;
  const now = s.sink.frames;
  let k = Math.ceil((now + minAhead - origin) / bf);
  if (k < 0) k = 0;
  return Math.round(origin + k * bf);
}
export const onBeat = (origin, k, { bpm = WORK_BPM, sub = 1 } = {}) => Math.round(origin + k * beatFrames(bpm) / sub);
