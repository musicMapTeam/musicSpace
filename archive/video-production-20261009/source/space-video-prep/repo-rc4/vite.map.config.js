import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {sharedThree} from './scripts/build/shared-three.mjs';
export default defineConfig({root:fileURLToPath(new URL('./web/original-map',import.meta.url)),base:'./',plugins:[sharedThree(),viteSingleFile(),{name:'map-notices',enforce:'post',generateBundle(_,bundle){for(const file of ['three-MIT.txt','sakura-crossing-MIT.txt','gsap-notice.txt','overlayscrollbars-MIT.txt','phosphor-MIT.txt','qrcode-generator-MIT.txt'])bundle['index.html'].source+='\n<!-- '+file+'\n'+readFileSync(new URL('./web/original-map/assets/licenses/'+file,import.meta.url),'utf8')+'\n-->\n';}}],build:{outDir:fileURLToPath(new URL('./dist/music-map',import.meta.url)),emptyOutDir:true,assetsInlineLimit:10000000,chunkSizeWarningLimit:8000}});
