/** CPU structural checks only; intentionally makes no visual-quality claim. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBenchmarkCharacter } from './character.js';
const {root,metadata,dispose}=createBenchmarkCharacter(THREE);
const failures=[],surfaces=[];
root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const g=mesh.geometry,p=g.attributes.position,indices=g.index?.array||Array.from({length:p.count},(_,i)=>i);
  assert(!g.type.includes('Plane'),`${mesh.name} must be volumetric`);
  assert(!mesh.material.map,`${mesh.name} must not use texture projection`);
  const keys=[], unique=new Map(),edges=new Map();
  for(let i=0;i<p.count;i++){
    const xyz=[p.getX(i),p.getY(i),p.getZ(i)];
    assert(xyz.every(Number.isFinite),`${mesh.name} contains finite coordinates`);
    const key=xyz.map(n=>Math.round(n*1e6)).join(',');
    if(!unique.has(key))unique.set(key,unique.size);keys.push(unique.get(key));
  }
  let volume=0,degenerate=0;
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i],b=indices[i+1],c=indices[i+2];
    const va=new THREE.Vector3().fromBufferAttribute(p,a),vb=new THREE.Vector3().fromBufferAttribute(p,b),vc=new THREE.Vector3().fromBufferAttribute(p,c);
    volume+=va.dot(vb.clone().cross(vc))/6;
    if(vb.clone().sub(va).cross(vc.clone().sub(va)).lengthSq()<1e-18)degenerate++;
    for(const [u,v] of [[a,b],[b,c],[c,a]]){
      const x=keys[u],y=keys[v];if(x===y)continue;const k=x<y?`${x}:${y}`:`${y}:${x}`;edges.set(k,(edges.get(k)||0)+1);
    }
  }
  const boundary=[...edges.values()].filter(n=>n===1).length,nonmanifold=[...edges.values()].filter(n=>n>2).length;
  const result={name:mesh.name,vertices:p.count,triangles:indices.length/3,boundaryEdges:boundary,nonmanifoldEdges:nonmanifold,degenerateTriangles:degenerate,signedVolume:volume};
  surfaces.push(result);
  if(boundary||nonmanifold||degenerate||volume<=0)failures.push(result);
});
assert.equal(root.getObjectByName('hair').parent.name,'head');
assert.equal(root.getObjectByName('eyewear').parent.name,'head');
assert.equal(metadata.bounds.min[1],0);
assert(metadata.bounds.size[2]>.5,'model needs genuine side-depth');
const variant=createBenchmarkCharacter(THREE,{palette:{skin:'#a67855',hair:'#473528',tee:'#85906a',shorts:'#302a28',canvas:'#595745'},eyewear:false});
assert.equal(variant.root.getObjectByName('eyewear').visible,false,'eyewear toggle hides the real glasses group');
assert.equal(variant.root.getObjectByName('hair-coherent-thin-shell').material.color.getHexString(),'473528','base hair palette override reaches real hair geometry');
assert.notEqual(variant.metadata.appearance.palette.hairLight,metadata.appearance.palette.hairLight,'base hair override derives a matching highlight');
assert.equal(variant.root.getObjectByName('tee-continuous-body-and-sleeves').material.color.getHexString(),'85906a','top palette override reaches the unified garment');
assert.equal(metadata.appearance.eyewear,true,'default appearance keeps its glasses');
variant.dispose();
console.log(JSON.stringify({status:failures.length?'FAIL':'PASS', scope:'Closed edge manifoldness, nondegenerate triangles, positive signed volume, finite geometry, stable groups, no image planes. Does NOT certify intersections, shading, pixels or reference fidelity.',metadata,failures},null,2));
dispose();
assert.equal(failures.length,0,'Every modeled surface must be a closed, consistently wound volume');
