import {renderAvatarSvg} from '../illustrated-avatar/index.js';
// Only alpha participates in picking; let the temporary RGBA readback go after copying.
function readAlphaMask(ctx,width,height){
 const rgba=ctx.getImageData(0,0,width,height).data,alpha=new Uint8Array(width*height);
 for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
 return alpha;
}
/** Four hand-drawn direction plates in an actual depth-tested 3D room.
 * This is intentionally a 2D character, never described as a volumetric mesh. */
export function createIllustratedPerson(THREE,avatar,{onLoad=()=>{}}={}){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);body.name='directional-illustrated-person';
 const geometry=new THREE.PlaneGeometry(1.5552,3.24),material=new THREE.MeshBasicMaterial({color:'#eee7d0',transparent:false,alphaTest:.35,side:THREE.DoubleSide,depthTest:true,depthWrite:true});
 const plane=new THREE.Mesh(geometry,material);plane.position.y=1.48;plane.castShadow=false;plane.receiveShadow=false;plane.visible=false;body.add(plane);
 const shadowGeometry=new THREE.CircleGeometry(.48,32),shadowMaterial=new THREE.MeshBasicMaterial({color:'#24352a',transparent:true,opacity:.25,depthWrite:false});const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.scale.y=.5;shadow.position.y=.015;root.add(shadow);
 const plates=new Map(),pending=new Set();let destroyed=false,view='front',mirror=false;
 function apply(){const plate=plates.get(view);if(!plate)return;material.map=plate.texture;material.needsUpdate=true;plane.visible=true;plane.scale.x=mirror?-1:1;plane.userData.alphaAt=(uv)=>{if(!plate.alpha)return false;if(!uv)return true;const x=Math.min(plate.width-1,Math.max(0,Math.floor(uv.x*plate.width))),y=Math.min(plate.height-1,Math.max(0,Math.floor((1-uv.y)*plate.height)));return plate.alpha[y*plate.width+x]>88;};}
 for(const direction of ['front','quarter','side','back']){const image=new Image(),url=URL.createObjectURL(new Blob([renderAvatarSvg(avatar,{view:direction,width:480,height:1000})],{type:'image/svg+xml'}));pending.add(url);image.onload=()=>{URL.revokeObjectURL(url);pending.delete(url);if(destroyed)return;const canvas=document.createElement('canvas');canvas.width=480;canvas.height=1000;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,480,1000);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;plates.set(direction,{texture,width:480,height:1000,alpha:readAlphaMask(ctx,480,1000)});apply();onLoad();};image.onerror=()=>{URL.revokeObjectURL(url);pending.delete(url);};image.src=url;}
 const world=new THREE.Vector3();
 function updateFacing(camera){root.getWorldPosition(world);const angle=Math.atan2(camera.position.x-world.x,camera.position.z-world.z),relative=Math.atan2(Math.sin(angle-root.rotation.y),Math.cos(angle-root.rotation.y)),abs=Math.abs(relative);const next=abs<.29?'front':abs<1.1?'quarter':abs<2.05?'side':'back';const nextMirror=relative<0;body.rotation.y=angle-root.rotation.y;if(next!==view||nextMirror!==mirror){view=next;mirror=nextMirror;apply();}}
 return {root,body,head:null,limbs:[],avatar,signature:JSON.stringify(avatar),phase:0,updateFacing,dispose(){if(destroyed)return;destroyed=true;pending.forEach(url=>URL.revokeObjectURL(url));pending.clear();plane.visible=false;delete plane.userData.alphaAt;material.map=null;plates.forEach(p=>{p.alpha=null;p.texture.dispose();p.texture=null;});plates.clear();geometry.dispose();material.dispose();shadowGeometry.dispose();shadowMaterial.dispose();},metadata:{kind:'directional-2d-character',views:4}};
}
