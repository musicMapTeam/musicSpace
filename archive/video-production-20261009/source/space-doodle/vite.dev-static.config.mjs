// Local-only dev server for the Doodle restyle: the static showcase (in-page room service + example cast) with HMR.
// Build-time files (sql wasm, demo photos, ai model, shared three, classic) are served from a built dist-pages.
import base from '/Users/alakazan/workplace/tme/musicSpace/vite.static.config.js';
import {existsSync, statSync, createReadStream} from 'node:fs';
import {join, extname} from 'node:path';
const DIST = process.env.DOODLE_DIST || '/Users/alakazan/workplace/tme/musicSpace/dist-pages';
const TYPES = {'.wasm':'application/wasm','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.json':'application/json','.js':'text/javascript','.mjs':'text/javascript','.onnx':'application/octet-stream','.html':'text/html','.css':'text/css','.txt':'text/plain'};
export default {
  ...base,
  plugins: [...(base.plugins || []), {
    name: 'doodle-dev-static-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url || '').split('?')[0]);
        if (!/^\/(sql|demo|ai|shared|classic|map|original-map|music-map)\//.test(path)) return next();
        const file = join(DIST, path);
        if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  }],
  server: {host: '127.0.0.1', port: 5190, strictPort: true},
};
