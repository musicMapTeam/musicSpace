import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const VENUE_ASSET={id:'blender-venue-r2',sha256:'68f2b5991115dac38580e44f38277e9ca93be70d3bdf8e5806bbc64d59c85b8e',bytes:1158336};

// Validate the self-contained asset before GLTFLoader can follow any URI.
export function inspectVenueGlb(input){
 const data=input instanceof ArrayBuffer?input:input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength);
 const view=new DataView(data);
 if(data.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==data.byteLength)throw Error('Invalid venue GLB header');
 const length=view.getUint32(12,true);
 if(view.getUint32(16,true)!==0x4e4f534a||20+length>data.byteLength)throw Error('Missing venue GLB JSON');
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,length)));
 if((json.buffers||[]).some(x=>x.uri)||(json.images||[]).some(x=>x.uri))throw Error('Venue must not load external resources');
 if((json.extensionsRequired||[]).length)throw Error('Venue needs unsupported decoder extensions');
 for(const name of ['MS_VENUE_ROOT','MS_FLOOR','MS_STAGE','MS_GALLERY_ANCHOR','MS_FOREGROUND_CUTAWAY'])if(!json.nodes?.some(n=>n.name===name))throw Error('Missing venue node: '+name);
 if(json.animations?.length||json.skins?.length||json.cameras?.length)throw Error('Venue must contain static scenery only');
 const triangles=(json.meshes||[]).flatMap(m=>m.primitives||[]).reduce((sum,p)=>sum+(json.accessors[p.indices??p.attributes.POSITION]?.count||0)/3,0);
 if(triangles>80000||json.materials?.length>12)throw Error('Venue exceeds the agreed geometry budget');
 return {data,json,triangles};
}

export async function loadBlenderVenue({url,data,cel,signal,fetchImpl=fetch,palette={}}){
 if(!data){const response=await fetchImpl(url,{signal});if(!response.ok)throw Error('Venue file did not load');data=await response.arrayBuffer();}
 const checked=inspectVenueGlb(data),gltf=await new GLTFLoader().parseAsync(checked.data,'');
 const root=gltf.scene,model=root.getObjectByName('MS_VENUE_ROOT');
 const geometries=new Set(),originalMaterials=new Set(),textures=new Set(),mapped=new Map();let disposed=false;
 root.traverse(node=>{if(!node.isMesh)return;geometries.add(node.geometry);for(const material of[].concat(node.material)){originalMaterials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
 const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());originalMaterials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
 try{
  if(signal?.aborted)throw Error('Venue loading was cancelled');
  root.updateMatrixWorld(true);
  if(model.position.length()>.00001||model.quaternion.angleTo(new THREE.Quaternion())>.00001||model.scale.distanceTo(new THREE.Vector3(1,1,1))>.00001)throw Error('Venue root transform is not identity');
  const gallery=root.getObjectByName('MS_GALLERY_ANCHOR'),position=gallery.getWorldPosition(new THREE.Vector3()),rotation=gallery.getWorldQuaternion(new THREE.Quaternion());
  if(position.distanceTo(new THREE.Vector3(6.795,2.64,-.65))>.001||rotation.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2))>.001)throw Error('Venue gallery anchor changed');
  const bounds=new THREE.Box3().setFromObject(root);
  if(bounds.min.x< -7.2||bounds.max.x>7.3||bounds.min.y<-.4||bounds.max.y>6.3||bounds.min.z< -5.8||bounds.max.z>7.1)throw Error('Venue bounds do not match the room');
  const mapMaterial=material=>{
   if(mapped.has(material))return mapped.get(material);
   const color=typeof palette[material.name]==='string'?new THREE.Color(palette[material.name]):material.color.clone();
   const options={color,map:material.map,side:material.side,cache:false};let next;
   if(material.name.startsWith('CEL_'))next=cel.cel({...options,bands:material.name==='CEL_FLOOR'||material.name==='CEL_PAPER'?'soft3':3,tint:'#8c839b'});
   else if(/^(UNLIT_|EMISSIVE_)/.test(material.name))next=cel.flat(options);
   else throw Error('Unrecognized venue material: '+material.name);
   next.name=material.name;next.userData.venueAsset=VENUE_ASSET.id;mapped.set(material,next);return next;
  };
  const occluders=[];let meshCount=0;
  root.traverse(node=>{if(!node.isMesh)return;meshCount++;node.material=Array.isArray(node.material)?node.material.map(mapMaterial):mapMaterial(node.material);node.castShadow=true;node.receiveShadow=true;occluders.push(node);});
  // Converted materials belong to the mount's cel factory. This asset owns
  // only its loaded geometry and source materials/textures.
  originalMaterials.forEach(m=>m.dispose());originalMaterials.clear();
  if(signal?.aborted){dispose();throw Error('Venue loading was cancelled');}
  return {root,gallery,cutaway:root.getObjectByName('MS_FOREGROUND_CUTAWAY'),occluders,dispose,summary:{...VENUE_ASSET,status:'ready',meshCount,triangles:checked.triangles,materialCount:mapped.size,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}}};
 }catch(error){dispose();throw error;}
}
