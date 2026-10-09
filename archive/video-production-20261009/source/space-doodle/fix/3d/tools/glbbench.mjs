import fs from 'node:fs';
const b=fs.readFileSync('/Users/alakazan/workplace/tme/musicSpace/web/event-room/assets/venue-r1/venue.glb');const len=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+len).toString());
const bin=b.slice(20+len+8);
for(const name of ['MS_STATIC_CEL_INK','MS_STATIC_CEL_METAL','MS_STAGE','MS_CUTAWAY_CEL_INK']){
const node=j.nodes.find(n=>n.name===name);const mesh=j.meshes[node.mesh];const t=node.translation||[0,0,0];
for(const p of mesh.primitives){const a=j.accessors[p.attributes.POSITION];const bv=j.bufferViews[a.bufferView];const off=(bv.byteOffset||0)+(a.byteOffset||0);const stride=bv.byteStride||12;
 const pos=i=>[0,1,2].map(k=>bin.readFloatLE(off+i*stride+k*4)+t[k]);
 const box={min:[1e9,1e9,1e9],max:[-1e9,-1e9,-1e9],n:0};const zs=new Set();
 for(let v=0;v<a.count;v++){const q=pos(v);if(q[0]<-5.05&&q[2]>-1.2){box.n++;for(let k=0;k<3;k++){box.min[k]=Math.min(box.min[k],q[k]);box.max[k]=Math.max(box.max[k],q[k]);}if(q[1]>.6)zs.add(q[2].toFixed(2));}}
 console.log(name,'x<-5.05,z>-1.2:',box.n,'verts',box.min.map(v=>v.toFixed(2)).join(','),'..',box.max.map(v=>v.toFixed(2)).join(','),'top z values',[...zs].sort((a,b)=>a-b).join(' '));
 // anything else with y in .6..9 and z>-1.2 and x>-5.05?
 let other=0;for(let v=0;v<a.count;v++){const q=pos(v);if(q[0]>=-5.05&&q[0]<-4&&q[2]>-1.2&&q[1]>.55&&q[1]<.95)other++;}console.log('   nearby (x -5.05..-4) verts:',other);
}}
