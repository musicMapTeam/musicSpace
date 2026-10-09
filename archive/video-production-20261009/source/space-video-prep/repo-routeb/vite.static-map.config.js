// Static build of the original Map as music-map/ of the GitHub Pages site: same single-file output as vite.map.config.js, but its
// three.js import is page-relative ('../shared/three-0.186.1/', one directory below the site root) and its "back to the scene"
// button reads the space-event-room hint. Run second by scripts/pages/build.mjs; it writes only OUT/music-map and OUT/shared.
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {sharedThree} from './scripts/build/shared-three.mjs';
import {staticHtmlPlugin, buildInfo} from './scripts/build/static-html-plugin.mjs';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const OUT = resolve(process.env.STATIC_OUT || here('./dist-pages'));
const build = buildInfo();

export default defineConfig({
  root: here('./web/original-map'),
  base: './',
  define: {__SPACE_BUILD__: JSON.stringify(build)},
  resolve: {alias: [
    {find: /^node:crypto$/, replacement: here('./web/static-runtime/shims/node-crypto.js')},
    {find: /^node:buffer$/, replacement: here('./web/static-runtime/shims/node-buffer.js')},
  ]},
  plugins: [
    sharedThree({publicPath: '../shared/three-0.186.1/', outDir: join(OUT, 'shared/three-0.186.1')}),
    viteSingleFile(),
    {
      name: 'map-notices',
      enforce: 'post',
      generateBundle(_, bundle) {
        for (const file of ['three-MIT.txt', 'sakura-crossing-MIT.txt', 'gsap-notice.txt', 'overlayscrollbars-MIT.txt', 'phosphor-MIT.txt', 'qrcode-generator-MIT.txt']) bundle['index.html'].source += `\n<!-- ${file}\n${readFileSync(here(`./web/original-map/assets/licenses/${file}`), 'utf8')}\n-->\n`;
      },
    },
    staticHtmlPlugin({page: 'map', build}),
  ],
  build: {outDir: join(OUT, 'music-map'), emptyOutDir: true, assetsInlineLimit: 10000000, chunkSizeWarningLimit: 8000},
});
