// Local-only HMR dev server for the UI restyle (not in the repo). Source: web/original-map; fonts from the event room's public dir.
// Run from the repo: node_modules/.bin/vite --config /tmp/space-map/ui/tools/vite.map-dev.config.mjs --port 5296
import base from '/Users/alakazan/workplace/tme/musicSpace/vite.map.config.js';
export default {
  ...base,
  publicDir: '/Users/alakazan/workplace/tme/musicSpace/web/event-room/public',
  cacheDir: '/tmp/space-map/ui/vite-cache',
  plugins: [...(base.plugins || []), {
    name: 'map-dev-doodle-fonts', apply: 'serve',
    transformIndexHtml: html => html.includes('fonts/doodle/fonts.css') ? html : html.replace('</head>', '<link rel="stylesheet" href="/fonts/doodle/fonts.css"></head>'),
  }],
  server: { host: '127.0.0.1', strictPort: true, hmr: { overlay: true } },
};
