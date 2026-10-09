import fs from 'node:fs';
const b=fs.readFileSync('web/event-room/assets/venue-r1/venue.glb');const len=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+len).toString());
const binStart=20+len+8;const bin=b.slice(binStart);
const name=process.argv[2]||'MS_STATIC_CEL_INK';
const node=j.nodes.find(n=>n.name===name);const mesh=j.meshes[node.mesh];const t=node.translation||[0,0,0];
for(const p of mesh.primitives){const a=j.accessors[p.attributes.POSITION];const bv=j.bufferViews[a.bufferView];const off=(bv.byteOffset||0)+(a.byteOffset||0);const stride=bv.byteStride||12;
 const idx=j.accessors[p.indices];const ibv=j.bufferViews[idx.bufferView];const ioff=(ibv.byteOffset||0)+(idx.byteOffset||0);
 const pos=i=>[0,1,2].map(k=>bin.readFloatLE(off+i*stride+k*4)+t[k]);
 const read=idx.componentType===5125?(i=>bin.readUInt32LE(ioff+i*4)):(i=>bin.readUInt16LE(ioff+i*2));
 // cluster triangles by connected components (shared vertex index)
 const parent=new Int32Array(a.count).map((_,i)=>i);const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
 for(let i=0;i<idx.count;i+=3){const A=find(read(i)),B=find(read(i+1)),C=find(read(i+2));parent[B]=A;parent[find(C)]=A;}
 const comps=new Map();for(let v=0;v<a.count;v++){const r=find(v);const q=pos(v);let c=comps.get(r);if(!c){c={n:0,min:[1e9,1e9,1e9],max:[-1e9,-1e9,-1e9]};comps.set(r,c);}c.n++;for(let k=0;k<3;k++){c.min[k]=Math.min(c.min[k],q[k]);c.max[k]=Math.max(c.max[k],q[k]);}}
 const list=[...comps.values()].sort((x,y)=>y.max[2]-x.max[2]);
 console.log(name,'components',list.length);
 for(const c of list.slice(0,+process.argv[3]||30))console.log(String(c.n).padStart(5),'min',c.min.map(v=>v.toFixed(2)).join(','),'max',c.max.map(v=>v.toFixed(2)).join(','));
}
