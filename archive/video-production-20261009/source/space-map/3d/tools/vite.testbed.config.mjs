// Stable 3D testbed: the map's UI files from git HEAD (night UI, untouched by the parallel UI work), the 3D files
// symlinked from the working tree. Fonts from the event room's public dir at /fonts/doodle/ (like ../fonts/doodle/ on Pages).
import {viteSingleFile} from '/Users/alakazan/workplace/tme/musicSpace/node_modules/vite-plugin-singlefile/dist/esm/index.js';
import {sharedThree} from '/Users/alakazan/workplace/tme/musicSpace/scripts/build/shared-three.mjs';
const TB = '/tmp/space-map/3d/testbed';
const REPO = '/Users/alakazan/workplace/tme/musicSpace';
export default {
  root: `${TB}/web/original-map`, base: './', cacheDir: '/tmp/space-map/3d/.vite-testbed',
  publicDir: `${REPO}/web/event-room/public`,
  plugins: [{
    // QA only (testbed, never the repo): expose the scene's own draw() for frame timing.
    name: 'testbed-perf-hook', enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/sakura-scene.js')) return null;
      const anchor = '  return { setView, setContent, setMusic: music.setMusic,';
      if (!code.includes(anchor)) throw new Error('perf hook anchor missing');
      return code.replace(anchor, '  globalThis.__MAP3D__ = { draw, renderer, scene, camera, pipeline, director, get doodle() { return doodle; }, get width() { return width; }, get height() { return height; } };\n' + anchor);
    },
  }, sharedThree({ publicPath: '../shared/three-0.186.1/', outDir: '/tmp/space-map/3d/build-testbed/shared/three-0.186.1' }), viteSingleFile(), {
    name: 'testbed-doodle-fonts',
    transformIndexHtml: { order: 'post', handler: (html, ctx) => html.includes('fonts/doodle/fonts.css') ? html : html.replace('</head>', `<link rel="stylesheet" href="${ctx.server ? '/' : '../'}fonts/doodle/fonts.css"></head>`) },
  }],
  server: { host: '127.0.0.1', strictPort: true, hmr: false, fs: { allow: [TB, REPO, '/private/tmp/space-map/3d/testbed'] } },
  build: { outDir: '/tmp/space-map/3d/build-testbed/music-map', emptyOutDir: true, assetsInlineLimit: 10000000, chunkSizeWarningLimit: 8000 },
};
