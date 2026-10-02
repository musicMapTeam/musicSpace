import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {memberFloorPositions,layoutSceneLabels,overviewCameraLayout} from '../web/event-room/scene-layout.js';
import {stagePrintLayout} from '../web/event-room/venue-art.js';

test('actual members keep unique in-floor placements with distinct projected horizontal positions',()=>{
 for(const portrait of[true,false])for(const count of(portrait?[1,2,4]:[1,2,4,8])){
  const positions=memberFloorPositions(count,portrait);assert.equal(positions.length,count);assert.equal(new Set(positions.map(JSON.stringify)).size,count);
  const right=portrait?new THREE.Vector3(.99015,0,.14):new THREE.Vector3(.87004,0,.493);
  const horizontal=positions.map(p=>new THREE.Vector3(...p).dot(right));
  positions.forEach(([x,y,z])=>{assert.equal(y,0);assert.ok(x> -5&&x<5);assert.ok(z>-.5&&z<6.2);});
  for(let i=1;i<count;i++)assert.ok(horizontal[i]-horizontal[i-1]>1.1,'no two member bodies occupy the same viewing column');
 }
});

test('four mobile/eight desktop projected label targets all remain readable without overlapping',()=>{
 for(const [width,height,count]of[[390,844,4],[1365,900,8]]){
  const items=Array.from({length:count},(_,i)=>({id:String(i),kind:'person',visible:true,x:.17+i*.66/(count-1),y:.38+(i%2)*.008}));
  const layout=layoutSceneLabels(items,{width,height});assert.equal(layout.length,count);
  for(const a of layout){assert.ok(a.x-a.width/2>=8);assert.ok(a.x+a.width/2<=width-8);assert.ok(a.y-a.height/2>72);assert.ok(Number.isFinite(a.stemLength));for(const b of layout){if(a===b)continue;assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2+6||Math.abs(a.y-b.y)>=a.height+4);}}
 }
});

test('occluded or off-camera targets are not turned into fake scene labels',()=>{
 const p={id:'visible',visible:true,kind:'person',x:.5,y:.4};const result=layoutSceneLabels([p,{...p,id:'hidden',visible:false}],{width:390,height:844});assert.deepEqual(result.map(x=>x.id),['visible']);
});

test('portrait print keeps its physical aspect and all four paper corners on screen without shrinking people',()=>{
 for(const [width,height,count]of[[320,568,2],[390,844,2],[390,664,4]]){
  const shot=overviewCameraLayout(count,true),camera=new THREE.PerspectiveCamera(43,width/height,.08,90);camera.position.set(...shot.position);camera.lookAt(...shot.target);camera.updateMatrixWorld();
  const layout=stagePrintLayout(true),transform=new THREE.Matrix4().compose(new THREE.Vector3(...layout.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.016),new THREE.Vector3().setScalar(layout.scale));
  for(const x of[-2.62,2.62])for(const y of[-1.485,1.485]){const p=new THREE.Vector3(x,y,0).applyMatrix4(transform).project(camera);assert.ok(p.x>-.94&&p.x<.94);assert.ok(p.y>-.9&&p.y<.85);}
  const [x,,z]=memberFloorPositions(count,true)[0],head=new THREE.Vector3(x,3.35,z).project(camera),foot=new THREE.Vector3(x,0,z).project(camera);assert.ok((head.y-foot.y)*height/2>200,'people retain a useful readable scale');
 }
});

test('desktop close framing keeps two/four/eight actual people inside the reading area',()=>{
 for(const count of[2,4,8]){
  const width=1365,height=900,shot=overviewCameraLayout(count,false),camera=new THREE.PerspectiveCamera(43,width/height,.08,90);camera.position.set(...shot.position);camera.lookAt(...shot.target);camera.updateMatrixWorld();
  for(const [x,,z]of memberFloorPositions(count,false))for(const y of[0,3.35]){const p=new THREE.Vector3(x,y,z).project(camera),sx=(p.x+1)*width/2,sy=(1-p.y)*height/2;assert.ok(sx>120&&sx<width-120);assert.ok(sy>170&&sy<height-185);}
 }
});

 test('390px mobile overview keeps both full silhouettes above the memory actions',()=>{
 const width=390,height=844,shot=overviewCameraLayout(2,true),camera=new THREE.PerspectiveCamera(43,width/height,.08,90);camera.position.set(...shot.position);camera.lookAt(...shot.target);camera.updateMatrixWorld();
 for(const [x,,z]of memberFloorPositions(2,true)){const head=new THREE.Vector3(x,3.24,z).project(camera),foot=new THREE.Vector3(x,0,z).project(camera);assert.ok((1-head.y)*height/2>190,'heads clear room metadata');assert.ok((1-foot.y)*height/2<570,'feet clear the memory dock');}
 });

 test('short mobile overview keeps the full two-person silhouette above the compact 44px action dock',()=>{
 const width=320,height=568,shot=overviewCameraLayout(2,true,height),camera=new THREE.PerspectiveCamera(43,width/height,.08,90);camera.position.set(...shot.position);camera.lookAt(...shot.target);camera.updateMatrixWorld();
 for(const [x,,z]of memberFloorPositions(2,true)){const head=new THREE.Vector3(x,3.24,z).project(camera),foot=new THREE.Vector3(x,0,z).project(camera);assert.ok((1-head.y)*height/2>130,'head clears room title');assert.ok((1-foot.y)*height/2<350,'feet clear compact action dock');}
 });
