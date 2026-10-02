import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
export default defineConfig({root:fileURLToPath(new URL('./web/event-room',import.meta.url)),base:'./',plugins:[viteSingleFile(),{name:'retain-livehouse-licenses',enforce:'post',generateBundle(_,bundle){for(const file of ['three-MIT.txt','sakura-crossing-MIT.txt','qrcode-generator-MIT.txt'])bundle['index.html'].source+='\n<!-- '+file+'\n'+readFileSync(new URL('./web/assets/licenses/'+file,import.meta.url),'utf8')+'\n-->\n';}}],build:{outDir:fileURLToPath(new URL('./dist/event-room',import.meta.url)),emptyOutDir:true,assetsInlineLimit:10000000,chunkSizeWarningLimit:8000},server:{host:'127.0.0.1',port:5182,proxy:{'/api':'http://127.0.0.1:8787'}}});
