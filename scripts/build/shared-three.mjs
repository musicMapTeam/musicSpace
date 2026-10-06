import {mkdirSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
/**
 * Full-page scenes share one immutable three module URL (and so one browser cache entry). The defaults serve the Node server's
 * /shared/ path and write dist/shared/three-0.186.1/, which is exactly what build:event and build:map always did. A static build
 * passes a page-relative publicPath ('./shared/three-0.186.1/' for the page at the site root, '../shared/three-0.186.1/' for the
 * Map one directory down) and its own output directory, so the bundle imports a URL that works under any prefix.
 */
export function sharedThree({publicPath='/shared/three-0.186.1/',outDir=fileURLToPath(new URL('../../dist/shared/three-0.186.1/',import.meta.url))}={}){
  const prefix=publicPath.endsWith('/')?publicPath:publicPath+'/';
  return {name:'space-shared-three',apply:'build',enforce:'pre',
    resolveId(id){if(id==='three')return {id:prefix+'three.module.js',external:true};},
    closeBundle(){mkdirSync(outDir,{recursive:true});for(const f of ['three.module.js','three.core.js'])copyFileSync(new URL('../../node_modules/three/build/'+f,import.meta.url),join(outDir,f));}};
}
