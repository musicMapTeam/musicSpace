import * as THREE from '/Users/alakazan/workplace/tme/musicSpace/node_modules/three/build/three.module.js';
const shiftLayout=(count,portrait,height,shift)=>{const distance=portrait?(height<650||count>2?13.8:11.8):(count>4?14.4:10.8);const sx=.87004*shift,sz=.493*shift;return {position:[-.493*distance+sx,2.15+.20*distance,1+.87004*distance+sz],target:[sx,2.15,1+sz]};};
for(const [w,h] of [[929,688],[820,508],[994,518],[1370,758]])for(const shift of [0,1.8]){
  const s=shiftLayout(0,false,h,shift),cam=new THREE.PerspectiveCamera(43,w/h,.08,90);cam.position.set(...s.position);cam.lookAt(...s.target);cam.updateMatrixWorld();
  const m=new THREE.Matrix4().compose(new THREE.Vector3(-.5,3.45,-4.71),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.016),new THREE.Vector3(1,1,1));
  const xs=[],ys=[];for(const x of[-2.62,2.62])for(const y of[-1.485,1.485]){const p=new THREE.Vector3(x,y,0).applyMatrix4(m).project(cam);xs.push(Math.round((p.x+1)*w/2));ys.push(Math.round((1-p.y)*h/2));}
  console.log(`lobby canvas ${w}x${h} shift ${shift}: poster x ${Math.min(...xs)}..${Math.max(...xs)} y ${Math.min(...ys)}..${Math.max(...ys)}`);
}
