// Node event-room build of the current tree into a throw-away dist (the repo's dist/ is left alone).
import base from '/Users/alakazan/workplace/tme/musicSpace/vite.event.config.js';
import {sharedThree} from '/Users/alakazan/workplace/tme/musicSpace/scripts/build/shared-three.mjs';
const OUT = '/tmp/space-doodle/fix/build/node-root/dist';
export default {...base, plugins: [sharedThree({outDir: `${OUT}/shared/three-0.186.1`}), ...base.plugins.slice(1)], build: {...base.build, outDir: `${OUT}/event-room`}};
