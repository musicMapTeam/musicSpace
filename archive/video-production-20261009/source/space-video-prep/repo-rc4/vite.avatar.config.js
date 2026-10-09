import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
export default defineConfig({
  root: fileURLToPath(new URL('./web/avatar', import.meta.url)), base: './',
  server: { port: 5178, host: '0.0.0.0', proxy: { '/api/avatar': 'http://127.0.0.1:8788' } },
  plugins: [viteSingleFile(), {name:'retain-avatar-renderer-licenses',enforce:'post',generateBundle(_,bundle){for(const name of ['three-MIT.txt','sakura-crossing-MIT.txt'])bundle['index.html'].source+='\n<!-- '+name+'\n'+readFileSync(new URL('./web/assets/licenses/'+name,import.meta.url),'utf8')+'\n-->\n';}}],
  build: { outDir: fileURLToPath(new URL('./dist/avatar', import.meta.url)), emptyOutDir: true, assetsInlineLimit: 10000000, chunkSizeWarningLimit: 8000 },
});
