import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {inspectVenueGlb,loadBlenderVenue,VENUE_ASSET} from '../web/event-room/venue-asset.js';
import {VENUE_PRINT_PALETTE,galleryColumns,GALLERY_PRINT_ASPECT} from '../web/event-room/venue-art.js';
const bytes=readFileSync(new URL('../web/event-room/assets/venue-r1/venue.glb',import.meta.url));
const cel={cel:({bands,tint,cache,...options})=>new THREE.MeshToonMaterial(options),flat:({cache,...options})=>new THREE.MeshBasicMaterial(options)};

test('actual Blender export is self-contained, within budget and matches its retained identity',()=>{
 const checked=inspectVenueGlb(bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),VENUE_ASSET.sha256);
 assert.equal(bytes.length,VENUE_ASSET.bytes);assert.equal(checked.triangles,19728);
 assert.equal(checked.json.meshes.length,12);assert.equal(checked.json.materials.length,8);
 assert.equal(checked.json.images,undefined);assert.equal(checked.json.animations,undefined);
});

test('real GLTFLoader parses the asset and toon mapping preserves authored linear colors and anchors',async()=>{
 const checked=inspectVenueGlb(bytes),asset=await loadBlenderVenue({data:bytes,cel});
 assert.equal(asset.summary.status,'ready');assert.equal(asset.summary.meshCount,12);assert.equal(asset.summary.materialCount,8);
 assert.ok(asset.gallery.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(6.795,2.64,-.65))<.001);
 const mapped=new Set();asset.root.traverse(n=>{if(!n.isMesh)return;mapped.add(n.material);assert.ok(n.castShadow&&n.receiveShadow);const source=checked.json.materials.find(m=>m.name===n.material.name);assert.deepEqual(n.material.color.toArray(),source.pbrMetallicRoughness.baseColorFactor.slice(0,3));assert.equal(n.material.isMeshBasicMaterial===true,n.material.name.startsWith('EMISSIVE_'));});
 let disposed=0;for(const n of asset.occluders)n.geometry.addEventListener('dispose',()=>disposed++);
 asset.dispose();asset.dispose();assert.equal(disposed,12);mapped.forEach(m=>m.dispose());
});

test('runtime print palette changes only material colors, keeping the authored GLB and gallery anchor intact',async()=>{
 const before=createHash('sha256').update(bytes).digest('hex'),asset=await loadBlenderVenue({data:bytes,cel,palette:VENUE_PRINT_PALETTE});
 assert.equal(asset.summary.meshCount,12);assert.equal(asset.summary.triangles,19728);
 assert.ok(asset.gallery.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(6.795,2.64,-.65))<.001);
 const materials=new Set();asset.root.traverse(n=>{if(n.isMesh){materials.add(n.material);assert.equal(n.material.color.getHexString(),VENUE_PRINT_PALETTE[n.material.name].slice(1));}});
 asset.dispose();materials.forEach(m=>m.dispose());assert.equal(createHash('sha256').update(bytes).digest('hex'),before);
});

test('four photos form one row on a landscape wall and a balanced two-by-two on a portrait one; typography keeps its native aspect',()=>{
 assert.equal(galleryColumns(4,false),4);assert.equal(galleryColumns(4,true),2);
 assert.equal(galleryColumns(6,false),3);assert.equal(galleryColumns(6,true),2);
 assert.equal(galleryColumns(1,false),1);assert.equal(GALLERY_PRINT_ASPECT,6.4);
});

test('GLB metadata is rejected before following an external URI or decoder dependency',()=>{
 const make=json=>{const text=Buffer.from(JSON.stringify(json)),size=Math.ceil(text.length/4)*4,out=Buffer.alloc(20+size,32);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(size,12);out.writeUInt32LE(0x4e4f534a,16);text.copy(out,20);return out;};
 const data=inspectVenueGlb(bytes).json;
 for(const uri of ['https://example.invalid/photo.png','../private.jpg','data:image/png;base64,AA=='])assert.throws(()=>inspectVenueGlb(make({...data,images:[{uri}]})),/external/);
 assert.throws(()=>inspectVenueGlb(make({...data,extensionsRequired:['KHR_draco_mesh_compression']})),/decoder/);
 assert.throws(()=>inspectVenueGlb(make({...data,nodes:[]})),/Missing venue node/);
});

test('a disposed loading owner never creates converted materials',async()=>{
 const abort=new AbortController();abort.abort();let converted=0;
 await assert.rejects(loadBlenderVenue({data:bytes,signal:abort.signal,cel:{cel(){converted++;},flat(){converted++;}}}),/cancelled/);
 assert.equal(converted,0);
});
