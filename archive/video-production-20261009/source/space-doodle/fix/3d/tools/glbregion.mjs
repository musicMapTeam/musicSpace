import fs from 'node:fs';
const b=fs.readFileSync('web/event-room/assets/venue-r1/venue.glb');const len=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+len).toString());
const bin=b.slice(20+len+8);
for(const name of process.argv.slice(2)){
const node=j.nodes.find(n=>n.name===name);const mesh=j.meshes[node.mesh];const t=node.translation||[0,0,0];
for(const p of mesh.primitives){const a=j.accessors[p.attributes.POSITION];const bv=j.bufferViews[a.bufferView];const off=(bv.byteOffset||0)+(a.byteOffset||0);const stride=bv.byteStride||12;
 const pos=i=>[0,1,2].map(k=>bin.readFloatLE(off+i*stride+k*4)+t[k]);
 const cells=new Map();
 for(let v=0;v<a.count;v++){const q=pos(v);const key=[Math.floor(q[0]),Math.floor(q[2])].join(',');const c=cells.get(key)||{n:0,ymin:1e9,ymax:-1e9};c.n++;c.ymin=Math.min(c.ymin,q[1]);c.ymax=Math.max(c.ymax,q[1]);cells.set(key,c);}
 const rows=[...cells.entries()].map(([k,c])=>({x:+k.split(',')[0],z:+k.split(',')[1],...c})).sort((p,q)=>q.z-p.z||p.x-q.x);
 console.log(name);for(const r of rows)if(r.z>=-1)console.log(' x',String(r.x).padStart(3),'z',String(r.z).padStart(3),'verts',String(r.n).padStart(5),'y',r.ymin.toFixed(2),'..',r.ymax.toFixed(2));
}}
