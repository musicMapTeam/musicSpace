// Local-only dev server for the map fixes (not in the repo). The event room's public dir is served at /fonts/doodle/,
// and the page links fonts.css in dev only (the builds add their own link).
// Run: node_modules/.bin/vite --config /tmp/space-map/fix/tools/vite.mapdev.config.mjs --port 5641
import base from '/Users/alakazan/workplace/tme/musicSpace/vite.map.config.js';
export default {
  ...base,
  cacheDir: '/tmp/space-map/fix/.vite-cache',
  publicDir: '/Users/alakazan/workplace/tme/musicSpace/web/event-room/public',
  plugins: [...(base.plugins || []), {
    name: 'mapdev-doodle-fonts', apply: 'serve',
    transformIndexHtml: html => html.includes('fonts/doodle/fonts.css') ? html : html.replace('</head>', '<link rel="stylesheet" href="/fonts/doodle/fonts.css"></head>'),
  }],
  server: { host: '127.0.0.1', strictPort: true, hmr: false },
};
