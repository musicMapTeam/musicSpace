import {avatarSVG} from './avatar.js';
import {SONGS} from './model.js';
const image=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('作品画面还没准备好，请稍后再试'));i.src=src;});
function wrap(ctx,text,x,y,width,lineHeight,maxLines){const chars=[...String(text||'')];let line='',lineIndex=0;for(let i=0;i<chars.length;i++){const next=line+chars[i];if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,y+lineIndex*lineHeight);lineIndex++;line='';if(lineIndex>=maxLines)return;}line+=chars[i];}if(line)ctx.fillText(line,x,y+lineIndex*lineHeight);}
/** Exports the exact 3:4 camera frame used by the editor, then adds readable print credits. */
export async function exportImage({title,caption,background,host,guest,songId,scene,sceneCapture}){
 const c=document.createElement('canvas');c.width=1440;c.height=1920;const x=c.getContext('2d');x.fillStyle='#24243e';x.fillRect(0,0,c.width,c.height);
 if(sceneCapture){x.drawImage(await image(sceneCapture),0,0,c.width,c.height);}else{
  const bg=await image(background);const k=Math.max(c.width/bg.width,c.height/bg.height);x.drawImage(bg,(c.width-bg.width*k)/2,(c.height-bg.height*k)/2,bg.width*k,bg.height*k);
  for(const p of [host,guest].filter(Boolean).sort((a,b)=>a.transform.y-b.transform.y)){const t=p.transform,svg=await image(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSVG(p.avatar))}`),aw=c.width*.32*t.scale,ah=aw*265/200;x.save();x.translate(c.width*t.x/100,c.height*t.y/100);x.rotate(t.rotation*Math.PI/180);x.drawImage(svg,-aw/2,-ah,aw,ah);x.restore();}
 }
 const top=x.createLinearGradient(0,0,0,500);top.addColorStop(0,'#16192b90');top.addColorStop(1,'#16192b00');x.fillStyle=top;x.fillRect(0,0,1440,500);
 const bottom=x.createLinearGradient(0,1620,0,1920);bottom.addColorStop(0,'#171a2f00');bottom.addColorStop(1,'#171a2fe8');x.fillStyle=bottom;x.fillRect(0,1620,1440,300);
 x.fillStyle='#fff3dc';x.font='500 24px sans-serif';x.fillText('SPACE / A MOMENT TOGETHER',82,95);x.font='500 51px sans-serif';wrap(x,title,80,185,1280,64,1);x.fillStyle='#efe3d1';x.font='34px sans-serif';wrap(x,caption,82,253,1260,48,2);
 x.fillStyle='#fff3dc';x.font='500 35px sans-serif';x.fillText([host.name,guest?.name].filter(Boolean).join(' × '),82,1780);x.textAlign='right';x.font='27px sans-serif';x.fillText(`♫ ${SONGS.find(s=>s.id===songId)?.title||'原创声景'}`,1358,1780);x.textAlign='left';x.strokeStyle='#fff0ce4d';x.lineWidth=1;x.beginPath();x.moveTo(82,1818);x.lineTo(1358,1818);x.stroke();x.font='22px sans-serif';x.fillStyle='#d5cbd1';const provenance=scene?.kind==='photo'?'用户照片 + 原创分身':sceneCapture?'原创三渲二场景与分身':'AI 生成虚构场景 + 原创分身';const authorship=guest?.fiction?'与虚构角色的想象创作':guest?'双方共同创作':'单人创作';wrap(x,`${provenance} · ${authorship}`,82,1862,1276,30,1);x.font='16px sans-serif';x.fillStyle='#b4abbc';x.fillText('MUSIC SPACE · MAKE ROOM FOR SOMEONE',82,1899);
 return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('导出失败，请重试')),'image/png'));
}
