// Local-only HMR dev server for the Music Map restyle (not in the repo). Source: web/original-map, fonts from the event room's public dir.
// Run: npx vite --config /tmp/space-map/tools/vite.map-dev.config.mjs --port <free port>   → http://127.0.0.1:<port>/
import base from '/Users/alakazan/workplace/tme/musicSpace/vite.map.config.js';
export default {
  ...base,
  publicDir: '/Users/alakazan/workplace/tme/musicSpace/web/event-room/public',
  plugins: [...(base.plugins || []), {
    name: 'map-dev-doodle-fonts', apply: 'serve',
    transformIndexHtml: html => html.includes('fonts/doodle/fonts.css') ? html : html.replace('</head>', '<link rel="stylesheet" href="/fonts/doodle/fonts.css"></head>'),
  }],
  server: { host: '127.0.0.1', strictPort: true },
};
