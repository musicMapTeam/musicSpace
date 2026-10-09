// Throw-away dev server for a prototype copy of web/original-map (never the repo's own files).
// Usage: PROTO=/tmp/space-map/proto/<v> PORT=<p> npx vite --config /tmp/space-map/tools/vite.proto.mjs

const PROTO = process.env.PROTO;
const REPO = '/Users/alakazan/workplace/tme/musicSpace';
export default ({
  root: `${PROTO}/web/original-map`,
  base: '/music-map/',
  cacheDir: `${PROTO}/.vite-cache`,
  resolve: {alias: [
    {find: /^node:crypto$/, replacement: `${REPO}/web/static-runtime/shims/node-crypto.js`},
    {find: /^node:buffer$/, replacement: `${REPO}/web/static-runtime/shims/node-buffer.js`},
  ]},
  server: {host: '127.0.0.1', port: Number(process.env.PORT), strictPort: true, fs: {allow: [PROTO, `/private${PROTO}`, REPO]}, hmr: false},
  logLevel: 'info',
  // Pages layout: the Doodle fonts live at the site root (../fonts/doodle/ from music-map/).
  plugins: [{ name: 'proto-doodle-fonts', configureServer(server) { server.middlewares.use(async (req, res, next) => {
    const path = decodeURIComponent((req.url || '').split('?')[0]);
    if (!path.startsWith('/fonts/doodle/')) return next();
    const { createReadStream, existsSync } = await import('node:fs');
    const file = `${REPO}/web/event-room/public${path}`;
    if (path.includes('..') || !existsSync(file)) return next();
    res.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'font/woff2'); createReadStream(file).pipe(res);
  }); } }],
});
