import {mkdirSync,copyFileSync} from 'node:fs';
/** Both full-page scenes use the same immutable module URL and browser cache. */
export function sharedThree(){return {name:'space-shared-three',apply:'build',enforce:'pre',resolveId(id){if(id==='three')return {id:'/shared/three-0.186.1/three.module.js',external:true};},closeBundle(){const dir=new URL('../../dist/shared/three-0.186.1/',import.meta.url);mkdirSync(dir,{recursive:true});for(const f of ['three.module.js','three.core.js'])copyFileSync(new URL('../../node_modules/three/build/'+f,import.meta.url),new URL(f,dir));}};}
