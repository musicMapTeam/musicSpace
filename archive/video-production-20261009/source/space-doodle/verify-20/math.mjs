// Theoretical NDC x of each member (body centre y=0.9, head anchor y=3.13) in the overview shot, per canvas size.
import { memberFloorPositions, overviewCameraLayout } from '/Users/alakazan/workplace/tme/musicSpace/web/event-room/scene-layout.js';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function ndc(cam,tgt,p,aspect){const f=norm(sub(tgt,cam)),r=norm(cross(f,[0,1,0])),d=sub(p,cam);return (dot(d,r)/dot(d,f))/(Math.tan(43/2*Math.PI/180)*aspect);}
const cases=process.argv.slice(2).map(s=>s.split(':')); // innerWidth:canvasW:canvasH:count
for(const [iw,cw,ch,count] of cases.map(c=>c.map(Number))){
  const aspect=cw/ch,portraitCam=aspect<.85,portraitPos=iw<700;
  const shown=Math.min(count,portraitPos?4:8),pos=memberFloorPositions(shown,portraitPos),o=overviewCameraLayout(shown,portraitCam,ch);
  const body=pos.map(p=>ndc(o.position,o.target,[p[0],.9,p[2]],aspect)),head=pos.map(p=>ndc(o.position,o.target,[p[0]+.043,3.13,p[2]],aspect));
  console.log(`iw=${iw} canvas=${cw}x${ch} aspect=${aspect.toFixed(3)} cam=${portraitCam?'portrait':'landscape'} pos=${portraitPos?'portrait':'landscape'} n=${shown}  bodyX=[${body.map(v=>v.toFixed(2)).join(', ')}]  headX=[${head.map(v=>v.toFixed(2)).join(', ')}]  tagHidden=[${head.map(v=>Math.abs(v)>=.97?'Y':'-').join('')}]`);
}
