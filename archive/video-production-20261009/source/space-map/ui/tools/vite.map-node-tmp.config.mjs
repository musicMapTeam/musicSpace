// The Node map build (vite.map.config.js) into /tmp, its shared three copy too: dist/ belongs to another workflow.
import base from '/Users/alakazan/workplace/tme/musicSpace/vite.map.config.js';
import {sharedThree} from '/Users/alakazan/workplace/tme/musicSpace/scripts/build/shared-three.mjs';
export default {
  ...base,
  cacheDir: '/tmp/space-map/ui/vite-cache-node',
  plugins: [sharedThree({outDir: '/tmp/space-map/ui-node/site/shared/three-0.186.1'}), ...base.plugins.filter(plugin => plugin?.name !== 'space-shared-three')],
  build: {...base.build, outDir: '/tmp/space-map/ui-node/site/music-map'},
};
