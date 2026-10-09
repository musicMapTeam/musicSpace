// Production (Pages) build of the prototype copy, modelled on the repo's vite.static-map.config.js. Output only under /tmp.
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {sharedThree} from '/Users/alakazan/workplace/tme/musicSpace/scripts/build/shared-three.mjs';
import {staticHtmlPlugin, buildInfo} from '/Users/alakazan/workplace/tme/musicSpace/scripts/build/static-html-plugin.mjs';
const REPO = '/Users/alakazan/workplace/tme/musicSpace';
const PROTO = '/tmp/space-map/proto/base';
const OUT = '/tmp/space-map/proto/build-base/musicSpace';
const build = buildInfo({root: REPO});
export default defineConfig({
  root: PROTO + '/web/original-map', base: './', cacheDir: PROTO + '/.vite-build-cache', logLevel: 'warn',
  define: {__SPACE_BUILD__: JSON.stringify(build)},
  resolve: {alias: [
    {find: /^node:crypto$/, replacement: REPO + '/web/static-runtime/shims/node-crypto.js'},
    {find: /^node:buffer$/, replacement: REPO + '/web/static-runtime/shims/node-buffer.js'},
  ]},
  plugins: [
    sharedThree({publicPath: '../shared/three-0.186.1/', outDir: join(OUT, 'shared/three-0.186.1')}),
    viteSingleFile(),
    {name: 'map-notices', enforce: 'post', generateBundle(_, bundle) { for (const file of ['three-MIT.txt', 'sakura-crossing-MIT.txt', 'gsap-notice.txt', 'overlayscrollbars-MIT.txt', 'phosphor-MIT.txt', 'qrcode-generator-MIT.txt']) bundle['index.html'].source += '\n<!-- ' + file + '\n' + readFileSync(REPO + '/web/original-map/assets/licenses/' + file, 'utf8') + '\n-->\n'; }},
    staticHtmlPlugin({page: 'map', build}),
  ],
  build: {outDir: join(OUT, 'music-map'), emptyOutDir: true, assetsInlineLimit: 10000000, chunkSizeWarningLimit: 8000},
});
