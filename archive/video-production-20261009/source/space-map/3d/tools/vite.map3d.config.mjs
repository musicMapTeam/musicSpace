// Local-only HMR dev server for the 3D Doodle work on web/original-map (not in the repo).
// Run: node_modules/.bin/vite --config /tmp/space-map/3d/tools/vite.map3d.config.mjs --port <free port>  ->  http://127.0.0.1:<port>/
// Fonts: the event room's public dir is served at /fonts/doodle/ (the page links it in dev only, like the Pages tree's ../fonts/doodle/).
import base from '/Users/alakazan/workplace/tme/musicSpace/vite.map.config.js';
export default {
  ...base,
  cacheDir: '/tmp/space-map/3d/.vite-cache',
  publicDir: '/Users/alakazan/workplace/tme/musicSpace/web/event-room/public',
  plugins: [...(base.plugins || []), {
    name: 'map3d-dev-doodle-fonts', apply: 'serve',
    transformIndexHtml: html => html.includes('fonts/doodle/fonts.css') ? html : html.replace('</head>', '<link rel="stylesheet" href="/fonts/doodle/fonts.css"></head>'),
  }],
  server: { host: '127.0.0.1', strictPort: true, hmr: false },
};
