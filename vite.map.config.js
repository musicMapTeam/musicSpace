import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {sharedThree} from './scripts/build/shared-three.mjs';
// The Doodle faces are the event room's (dist/event-room/fonts/doodle/, served at /event-room/fonts/doodle/ next to /music-map/): linked,
// never imported (the single-file page would inline ~2.4 MB of woff2); the two first-screen slices are preloaded.
const doodleFonts=dir=>({name:'map-doodle-fonts',apply:'build',transformIndexHtml:{order:'post',handler:()=>[...['marker-0','display-0'].map(slice=>({tag:'link',attrs:{rel:'preload',as:'font',type:'font/woff2',crossorigin:true,href:`${dir}${slice}.woff2`},injectTo:'head'})),{tag:'link',attrs:{rel:'stylesheet',href:`${dir}fonts.css`},injectTo:'head'}]}});
const DOODLE_FONTS='../event-room/fonts/doodle/';
// map-notices appends the licences of the code bundled into the page; no Phosphor notice, the icons are first-party drawings (js/icons.js).
export default defineConfig({root:fileURLToPath(new URL('./web/original-map',import.meta.url)),base:'./',plugins:[sharedThree(),doodleFonts(DOODLE_FONTS),viteSingleFile(),{name:'map-notices',enforce:'post',generateBundle(_,bundle){for(const file of ['three-MIT.txt','sakura-crossing-MIT.txt','gsap-notice.txt','overlayscrollbars-MIT.txt','qrcode-generator-MIT.txt'])bundle['index.html'].source+='\n<!-- '+file+'\n'+readFileSync(new URL('./web/original-map/assets/licenses/'+file,import.meta.url),'utf8')+'\n-->\n';}}],build:{outDir:fileURLToPath(new URL('./dist/music-map',import.meta.url)),emptyOutDir:true,assetsInlineLimit:10000000,chunkSizeWarningLimit:8000}});
