// Static build of the event room as the root page of the GitHub Pages site (https://musicmapteam.github.io/musicSpace/ and, from
// the same bytes, /musicSpace/preview/). `npm run build:pages` (scripts/pages/build.mjs) runs this first, then
// vite.static-map.config.js, then adds classic/, ai/ and demo/. STATIC_OUT overrides the output directory (default dist-pages).
// There is deliberately no channel switch: root and preview are the same bytes and the page derives its channel from its URL.
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {fileURLToPath} from 'node:url';
import {readFileSync, readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {sharedThree} from './scripts/build/shared-three.mjs';
import {staticHtmlPlugin, staticCopyPlugin, buildInfo} from './scripts/build/static-html-plugin.mjs';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const OUT = resolve(process.env.STATIC_OUT || here('./dist-pages'));
const build = buildInfo();
// The migrations the in-page room service applies (web/static-runtime/profile.js reads them with import.meta.glob).
const migrationFiles = readdirSync(here('./runtime-preview/drizzle')).filter(name => name.endsWith('.sql')).sort();
const licenseText = name => {
  const text = readFileSync(here(`./web/assets/licenses/${name}`), 'utf8');
  if (text.includes('-->')) throw new Error(`${name} would end its HTML comment early`);
  return text;
};

export default defineConfig({
  root: here('./web/event-room'),
  base: './',
  define: {__SPACE_BUILD__: JSON.stringify(build)},
  resolve: {alias: [
    // The workers (runtime-preview/src) import node:crypto and node:buffer; the browser gets pure-JS equivalents.
    {find: /^node:crypto$/, replacement: here('./web/static-runtime/shims/node-crypto.js')},
    {find: /^node:buffer$/, replacement: here('./web/static-runtime/shims/node-buffer.js')},
    // The static profile replaces the Node-server profile (web/event-room/runtime-profile.js).
    {find: /^\.\/runtime-profile\.js$/, replacement: here('./web/static-runtime/profile.js')},
  ]},
  plugins: [
    sharedThree({publicPath: './shared/three-0.186.1/', outDir: join(OUT, 'shared/three-0.186.1')}),
    staticCopyPlugin(),
    viteSingleFile(),
    {
      name: 'retain-static-licenses',
      enforce: 'post',
      generateBundle(_, bundle) {
        for (const file of ['three-MIT.txt', 'sakura-crossing-MIT.txt', 'qrcode-generator-MIT.txt', 'sql.js-MIT.txt']) bundle['index.html'].source += `\n<!-- ${file}\n${licenseText(file)}\n-->\n`;
      },
    },
    staticHtmlPlugin({page: 'root', build}),
    {
      name: 'static-profile-guard',
      apply: 'build',
      enforce: 'post',
      // The page is only the demo if the in-page room service is in it. If the ./runtime-profile.js alias stops matching (app.js changes its
      // import) or the migration glob finds nothing, the build would still succeed and ship a page whose /api calls go to the network and
      // fail: refuse that here, with the reason. (Strings, not identifiers: they survive minification.)
      generateBundle(_, bundle) {
        const html = String(bundle['index.html']?.source ?? '');
        const missing = [
          ['__SPACE_STATIC__', 'the boot (web/static-runtime/boot.js): the QA handle'],
          ['music-space-static', 'the IndexedDB database name of the boot'],
          ['_static_migrations', 'the runtime (web/static-runtime/runtime.js): its migration ledger'],
          ...migrationFiles.map(name => [name, `migration ${name} (import.meta.glob of runtime-preview/drizzle/*.sql)`]),
        ].filter(([marker]) => !html.includes(marker));
        if (missing.length) this.error(`static profile guard: the built page lacks ${missing.map(([, what]) => what).join('; ')}. Is ./runtime-profile.js still aliased to web/static-runtime/profile.js?`);
      },
    },
    {
      name: 'static-sql-wasm',
      apply: 'build',
      // sql.js is imported as sql.js/dist/sql-wasm-browser.js (the default entry has require() calls and Node detection); its
      // wasm is served from sql/ next to the page, with the licence text beside it. Written, not copied: no executable bit.
      closeBundle() {
        mkdirSync(join(OUT, 'sql'), {recursive: true});
        writeFileSync(join(OUT, 'sql/sql-wasm.wasm'), readFileSync(here('./node_modules/sql.js/dist/sql-wasm-browser.wasm')));
        writeFileSync(join(OUT, 'sql/LICENSE-sql.js-MIT.txt'), readFileSync(here('./web/assets/licenses/sql.js-MIT.txt')));
      },
    },
  ],
  build: {outDir: OUT, emptyOutDir: true, assetsInlineLimit: 10000000, chunkSizeWarningLimit: 8000},
});
