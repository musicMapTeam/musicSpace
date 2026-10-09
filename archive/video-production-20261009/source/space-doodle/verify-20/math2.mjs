import { memberFloorPositions, overviewCameraLayout } from '/Users/alakazan/workplace/tme/musicSpace/web/event-room/scene-layout.js';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const T=Math.tan(21.5*Math.PI/180);
function ndc(cam,tgt,p,aspect){const f=norm(sub(tgt,cam)),r=norm(cross(f,[0,1,0])),d=sub(p,cam);return (dot(d,r)/dot(d,f))/(T*aspect);}
const poster=portrait=>portrait?{c:[.65,3.55,-4.71],w:5.24*.62}:{c:[-.5,3.45,-4.71],w:5.24};
// fit: push camera back along its own direction until every person (|lateral|+0.5) fits within 0.88 of the half-FOV
function fit(o,pts,aspect){const tgt=o.target,dir=norm(sub(o.position,tgt)),f=mul(dir,-1),r=norm(cross(f,[0,1,0]));let D=Math.hypot(...sub(o.position,tgt));
 for(const p of pts){const q=sub(p,tgt);const need=(Math.abs(dot(q,r))+.5)/(T*aspect*.88)+dot(q,dir);D=Math.max(D,need);}return {position:add(tgt,mul(dir,D)),target:tgt,D};}
const V=[[768,698,812],[810,740,868],[744,674,921],[820,750,968],[834,764,982],[1024,954,1154],[390,361,670],[1440,1370,688],[1024,954,556]];
for(const mode of ['current','A: 3d threshold<1.0','B: A + app aspect test','C: 3d fit-to-people']){
 console.log('--',mode);
 for(const [iw,cw,ch] of V){const aspect=cw/ch;const thr=mode==='current'?.85:mode.startsWith('C')?.85:1.0;const pc=aspect<thr;const pp=mode.startsWith('B')?aspect<1.0:iw<700;
  const out=[];for(const count of [0,4,5]){const shown=Math.min(count,pp?4:8),pos=memberFloorPositions(shown,pp);let o=overviewCameraLayout(shown,pc,ch);let D=Math.hypot(...sub(o.position,o.target));
   if(mode.startsWith('C')&&shown)({D,...o}=fit(o,pos.map(p=>[p[0],1.5,p[2]]),aspect));
   const body=pos.map(p=>ndc(o.position,o.target,[p[0],.9,p[2]],aspect)),head=pos.map(p=>ndc(o.position,o.target,[p[0]+.043,3.13,p[2]],aspect));
   const P=poster(pc),pl=ndc(o.position,o.target,[P.c[0]-P.w/2,P.c[1],P.c[2]],aspect),pr=ndc(o.position,o.target,[P.c[0]+P.w/2,P.c[1],P.c[2]],aspect);
   out.push(`n${shown}: D=${D.toFixed(1)} maxBody=${body.length?Math.max(...body.map(Math.abs)).toFixed(2):'-'} tagsHidden=${head.filter(v=>Math.abs(v)>=.97).length} poster=[${pl.toFixed(2)},${pr.toFixed(2)}]`);}
  console.log(`${iw}x(${cw}x${ch}) a=${aspect.toFixed(2)} cam=${pc?'P':'L'} pos=${pp?'P':'L'} | ${out.join(' | ')}`);}
}
