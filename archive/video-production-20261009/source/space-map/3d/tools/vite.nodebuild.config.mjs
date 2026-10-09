// The Node build of the map (vite.map.config.js) into /tmp: same plugins, but three is copied to /tmp instead of the repo's dist/.
import base from '/Users/alakazan/workplace/tme/musicSpace/vite.map.config.js';
import {sharedThree} from '/Users/alakazan/workplace/tme/musicSpace/scripts/build/shared-three.mjs';
const OUT = '/tmp/space-map/3d/node-tree';
export default {
  ...base,
  cacheDir: '/tmp/space-map/3d/.vite-nodebuild',
  plugins: [sharedThree({ outDir: `${OUT}/shared/three-0.186.1` }), ...base.plugins.flat().filter(plugin => plugin?.name !== 'space-shared-three')],
  build: { ...base.build, outDir: `${OUT}/music-map` },
};
