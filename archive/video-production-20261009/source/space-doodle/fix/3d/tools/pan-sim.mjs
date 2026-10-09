import * as THREE from '/Users/alakazan/workplace/tme/musicSpace/node_modules/three/build/three.module.js';
// HEAD scene-layout (no shift, gap 2.15 for <=4 people) to check three-scene's pan on its own.
const mfp=(count,portrait)=>{const right=portrait?[.99015,.14]:[.87004,.493];const gap=portrait?(count>2?1.15:1.9):(count>4?1.45:2.15),centerZ=portrait?1.4:2;return Array.from({length:count},(_,i)=>{const x=(i-(count-1)/2)*gap,depth=count>2?(i%2?.1:-.1):0;return [right[0]*x+right[1]*depth,0,centerZ+right[1]*x-right[0]*depth];});};
const ocl=(count,portrait,height=844)=>{const distance=portrait?(height<650||count>2?13.8:11.8):(count>4?14.4:10.8);const targetY=height<650?.95:1.3;return portrait?{position:[-.14*distance,targetY+.18*distance,.5+.99015*distance],target:[0,targetY,.5]}:{position:[-.493*distance,2.15+.20*distance,1+.87004*distance],target:[0,2.15,1]};};
const ROOM_CARD={inset:470,left:120,tag:80};
function shot(count,width,height){
  const portrait=width/height<1,overview=ocl(count,portrait,height),target=new THREE.Vector3(...overview.target),position=new THREE.Vector3(...overview.position);
  const people=mfp(count,width<700+70);
  const back=position.clone().sub(target),preset=back.length();back.normalize();
  const right=new THREE.Vector3(back.z,0,-back.x).normalize(),tanH=Math.tan(THREE.MathUtils.degToRad(43/2))*width/height;
  const spots=people.map(p=>{const q=new THREE.Vector3(p[0],1.5,p[2]).sub(target);return {side:q.dot(right),depth:q.dot(back)};});
  let distance=preset,pan=0;for(const s of spots)distance=Math.max(distance,(Math.abs(s.side)+.5)/(tanH*.88)+s.depth);
  if(width>800&&!portrait){const xR=1-2*ROOM_CARD.inset/width,xL=-1+2*ROOM_CARD.left/width,tag=2*ROOM_CARD.tag/width;let need=0,room=Infinity;for(const s of spots){const half=(distance-s.depth)*tanH;need=Math.max(need,s.side-(xR-tag)*half);room=Math.min(room,s.side-(xL+tag)*half);}pan=Math.max(0,Math.min(need,room));}
  const slide=right.clone().multiplyScalar(pan),pos=target.clone().addScaledVector(back,distance).add(slide),tgt=target.clone().add(slide);
  const cam=new THREE.PerspectiveCamera(43,width/height,.08,90);cam.position.copy(pos);cam.lookAt(tgt);cam.updateMatrixWorld();
  const xs=people.map(p=>{const h=new THREE.Vector3(p[0]+.043,3.13,p[2]).project(cam);return Math.round((h.x+1)*width/2);});
  return {pan:+pan.toFixed(2),distance:+distance.toFixed(2),tagsLeft:Math.min(...xs)-64,tagsRight:Math.max(...xs)+64,cardLeft:width-461};
}
for(const [W,H] of [[1440,900],[1440,790],[1536,730],[1280,720],[1920,970],[1024,768]])for(const n of [4,5,8]){const w=W-70,h=H-212;console.log(`${W}x${H} n=${n}`,JSON.stringify(shot(n,w,h)));}
