import { readCaptureTime } from '/tmp/space-video-prep/repo-rc4/web/js/ai/exif-time.js';
import fs from 'node:fs';
for (const f of fs.readdirSync('/tmp/space-video-prep/photos/pack').filter(f => f.endsWith('.jpg'))) {
  const b = new Blob([fs.readFileSync('/tmp/space-video-prep/photos/pack/' + f)]);
  const t = await readCaptureTime(b);
  console.log(f.padEnd(24), t && { local: t.local, offset: t.offset, source: t.source, epochMs: t.epochMs });
}
