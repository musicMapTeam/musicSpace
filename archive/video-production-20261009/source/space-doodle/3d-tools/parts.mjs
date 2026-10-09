import {readFileSync} from 'node:fs';
import * as THREE from '/Users/alakazan/workplace/tme/musicSpace/node_modules/three/build/three.module.js';
import {GLTFLoader} from '/Users/alakazan/workplace/tme/musicSpace/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const b=readFileSync('/Users/alakazan/workplace/tme/musicSpace/web/event-room/assets/venue-r1/venue.glb');
const ab=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const gltf=await new GLTFLoader().parseAsync(ab,'');
gltf.scene.updateMatrixWorld(true);
gltf.scene.traverse(n=>{if(!n.isMesh)return;const g=n.geometry,pos=g.attributes.position,idx=g.index;
 // union-find over vertices by triangle; also merge identical positions
 const parent=new Int32Array(pos.count).map((_,i)=>i);const f=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};const u=(a,b)=>{a=f(a);b=f(b);if(a!==b)parent[a]=b;};
 const key=new Map();for(let i=0;i<pos.count;i++){const k=pos.getX(i).toFixed(4)+','+pos.getY(i).toFixed(4)+','+pos.getZ(i).toFixed(4);if(key.has(k))u(i,key.get(k));else key.set(k,i);}
 for(let t=0;t<idx.count;t+=3){u(idx.getX(t),idx.getX(t+1));u(idx.getX(t),idx.getX(t+2));}
 const comps=new Map();const v=new THREE.Vector3();for(let i=0;i<pos.count;i++){const r=f(i);if(!comps.has(r))comps.set(r,new THREE.Box3());v.fromBufferAttribute(pos,i).applyMatrix4(n.matrixWorld);comps.get(r).expandByPoint(v);}
 const list=[...comps.values()].map(bx=>{const c=bx.getCenter(new THREE.Vector3()),s=bx.getSize(new THREE.Vector3());return {c:c.toArray().map(x=>+x.toFixed(2)),s:s.toArray().map(x=>+x.toFixed(2)),vol:s.x*s.y+s.y*s.z+s.x*s.z};}).sort((a,b)=>b.vol-a.vol);
 console.log(`\n${n.name} [${n.material.name}] comps=${list.length}`);for(const p of list.slice(0,14))console.log('  c',JSON.stringify(p.c),'size',JSON.stringify(p.s));
});
