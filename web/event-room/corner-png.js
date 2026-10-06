import {renderAvatarSvg} from '../illustrated-avatar/index.js';
// The two-sided keepsake PNG, drawn in the Doodle style (docs/design/doodle.md): cream dot-grid paper, ink lines, hard offset
// shadows, marker accents, tape and polaroids. Same content as before; 1200 × 1600 with photos (taller only for long notes),
// 1200 × 1200 when neither person chose a photo, and a single photo sits in the middle.
// Colours and font stacks are read from the page's --ds-* tokens, so the PNG matches the screen; the fallbacks are the same values.
const TITLE='同一晚，我们的另一面。',TITLE_KEY='另一面',HEADER='MUSIC SPACE / TWO SIDES';
const PALETTE=[['paper','--ds-paper','#f7efdf'],['card','--ds-paper-card','#fffaf0'],['ink','--ds-ink','#1c1b1a'],['ink2','--ds-ink-2','#3d3a36'],['ink3','--ds-ink-3','#6b655c'],
 ['pink','--ds-pink','#ff5c8a'],['pinkSoft','--ds-pink-soft','#ffd0dd'],['mint','--ds-mint','#5fdcc0'],['mintSoft','--ds-mint-soft','#c9f3e8'],['yellow','--ds-yellow','#ffd447'],['night','--ds-night','#23212b']];
const STACKS=[['logo','"Doodle Logo","Doodle Display","Arial Black",sans-serif'],['display','"Doodle Display","Doodle Marker","PingFang SC","Microsoft YaHei",sans-serif'],
 ['ui','"Doodle Marker","PingFang SC","Microsoft YaHei",system-ui,sans-serif'],['body','"Doodle Hand","Doodle Marker","PingFang SC","Microsoft YaHei",system-ui,sans-serif']];
function theme(){
 const css=globalThis.getComputedStyle?.(document.documentElement),read=(name,fallback)=>css?.getPropertyValue(name).trim()||fallback;
 return {colour:Object.fromEntries(PALETTE.map(([key,token,value])=>[key,read(token,value)])),font:Object.fromEntries(STACKS.map(([role,value])=>[role,read('--ds-font-'+role,value)]))};
}
/** Ask for exactly the glyph slices the PNG uses (the fonts are split by unicode-range), then wait for them; a failure just falls back. */
async function fontsFor(font,texts){
 const set=document.fonts;if(!set?.load)return;
 await Promise.all(Object.entries(texts).map(([role,text])=>set.load(`40px ${font[role]}`,text||'a').catch(()=>[])));
 await set.ready;
}
async function decode(blob){const url=URL.createObjectURL(blob);try{const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}}
function lines(ctx,value,width,size,family){ctx.font=`${size}px ${family}`;const result=[];let line="";for(const char of String(value)){if(ctx.measureText(line+char).width>width&&line){result.push(line);line="";}line+=char;}if(line)result.push(line);return result;}
function text(ctx,value,x,y,width,size,rows,family){ctx.font=`${size}px ${family}`;let line='',row=0;for(const char of String(value)){if(ctx.measureText(line+char).width>width&&line){ctx.fillText(line,x,y+row*size*1.4);line='';if(++row>=rows)return;}line+=char;}if(row<rows)ctx.fillText(line,x,y+row*size*1.4);}
/** A rectangle with uneven corners and a slightly wandering edge: the hand-drawn frame. r = [top-left, top-right, bottom-right, bottom-left]. */
function sketch(ctx,x,y,w,h,[a,b,c,d]=[26,10,30,12]){
 ctx.beginPath();ctx.moveTo(x+a,y);ctx.lineTo(x+w-b,y+1.5);ctx.quadraticCurveTo(x+w,y,x+w,y+b);ctx.lineTo(x+w-1.5,y+h-c);ctx.quadraticCurveTo(x+w,y+h,x+w-c,y+h);
 ctx.lineTo(x+d,y+h-1.5);ctx.quadraticCurveTo(x,y+h,x,y+h-d);ctx.lineTo(x+1.5,y+a);ctx.quadraticCurveTo(x,y,x+a,y);ctx.closePath();
}
function card(ctx,c,x,y,w,h,{fill=c.card,shadow=c.ink,offset=[12,14],line=5,radii}={}){
 ctx.save();ctx.fillStyle=shadow;ctx.translate(offset[0],offset[1]);sketch(ctx,x,y,w,h,radii);ctx.fill();ctx.restore();
 ctx.fillStyle=fill;sketch(ctx,x,y,w,h,radii);ctx.fill();ctx.lineWidth=line;ctx.lineJoin='round';ctx.strokeStyle=c.ink;ctx.stroke();
}
function tape(ctx,colour,cx,cy,w,h,angle){
 ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.globalAlpha=.76;ctx.fillStyle=colour;ctx.beginPath();ctx.moveTo(-w/2,-h/2);ctx.lineTo(w/2,-h/2);
 for(let i=1;i<=6;i++)ctx.lineTo(w/2-(i%2?6:0),-h/2+h*i/6);for(let i=5;i>=0;i--)ctx.lineTo(-w/2+(i%2?6:0),-h/2+h*i/6);ctx.closePath();ctx.fill();ctx.restore();
}
function star(ctx,c,cx,cy,r,fill){
 const path=()=>{ctx.beginPath();for(let i=0;i<10;i++){const k=i%2?r*.46:r,a=-Math.PI/2+i*Math.PI/5+.08;ctx[i?'lineTo':'moveTo'](cx+Math.cos(a)*k,cy+Math.sin(a)*k);}ctx.closePath();};
 ctx.save();ctx.translate(r*.1,r*.12);path();ctx.fillStyle=fill;ctx.fill();ctx.restore();path();ctx.lineWidth=5;ctx.lineJoin='round';ctx.strokeStyle=c.ink;ctx.stroke();
}
function heart(ctx,c,cx,cy,s){
 const path=()=>{ctx.beginPath();ctx.moveTo(cx,cy+s*.8);ctx.bezierCurveTo(cx-s*1.1,cy+s*.05,cx-s*.95,cy-s*.95,cx,cy-s*.4);ctx.bezierCurveTo(cx+s*.95,cy-s*.95,cx+s*1.1,cy+s*.05,cx,cy+s*.8);ctx.closePath();};
 ctx.save();ctx.translate(s*.12,s*.14);path();ctx.fillStyle=c.pink;ctx.fill();ctx.restore();path();ctx.lineWidth=5;ctx.lineJoin='round';ctx.strokeStyle=c.ink;ctx.stroke();
}
function note(ctx,c,x,y,s){
 ctx.save();ctx.strokeStyle=c.ink;ctx.fillStyle=c.ink;ctx.lineWidth=s*.12;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-s*1.25);ctx.lineTo(x+s*.95,y-s*1.45);ctx.lineTo(x+s*.95,y-s*.2);ctx.stroke();
 ctx.lineWidth=s*.22;ctx.beginPath();ctx.moveTo(x,y-s*1.1);ctx.lineTo(x+s*.95,y-s*1.3);ctx.stroke();
 for(const [ex,ey] of [[x-s*.22,y+s*.04],[x+s*.73,y-s*.16]]){ctx.beginPath();ctx.ellipse(ex,ey,s*.27,s*.2,-.35,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}
function squiggle(ctx,colour,x,y,w,amp=7){ctx.save();ctx.strokeStyle=colour;ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);for(let i=0;x+i*28<x+w;i++)ctx.quadraticCurveTo(x+i*28+14,y+(i%2?amp:-amp)*1.6,x+(i+1)*28,y);ctx.stroke();ctx.restore();}
/** Layered lettering on canvas: the same recipes as type.css (.ds-logo and .ds-title). */
function logoText(ctx,c,value,x,y,size,family){
 ctx.font=`${size}px ${family}`;ctx.lineJoin='round';
 ctx.fillStyle=c.pink;ctx.fillText(value,x+size*.13,y+size*.13);ctx.fillStyle=c.ink;ctx.fillText(value,x+size*.07,y+size*.07);
 ctx.lineWidth=size*.11;ctx.strokeStyle=c.ink;ctx.strokeText(value,x,y);ctx.fillStyle=c.yellow;ctx.fillText(value,x,y);
}
function titleText(ctx,c,value,key,x,y,size,family,maxWidth){
 ctx.font=`${size}px ${family}`;let scale=1;const full=ctx.measureText(value).width;if(full>maxWidth){scale=maxWidth/full;size=Math.floor(size*scale);ctx.font=`${size}px ${family}`;}
 const at=value.indexOf(key);if(at>=0){const start=x+ctx.measureText(value.slice(0,at)).width,width=ctx.measureText(key).width;ctx.fillStyle=c.mint;ctx.save();ctx.translate(start-6,y-size*.36);ctx.rotate(-.012);ctx.fillRect(0,0,width+12,size*.42);ctx.restore();}
 ctx.fillStyle=c.pink;ctx.fillText(value,x+size*.06,y+size*.06);ctx.fillStyle=c.ink;ctx.fillText(value,x,y);
}
function dots(ctx,colour,w,h){ctx.save();ctx.fillStyle=colour;ctx.globalAlpha=.16;for(let y=18;y<h;y+=32)for(let x=18;x<w;x+=32){ctx.beginPath();ctx.arc(x,y,2.4,0,Math.PI*2);ctx.fill();}ctx.restore();}
function polaroid(ctx,c,f,image,caption,x,y,w,h,angle){
 ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(angle);ctx.translate(-w/2,-h/2);
 card(ctx,c,0,0,w,h,{offset:[9,10],line:3.5,radii:[8,4,9,5]});
 const inner={x:18,y:18,w:w-36,h:h-92};ctx.fillStyle=c.night;ctx.fillRect(inner.x,inner.y,inner.w,inner.h);
 const scale=Math.min(inner.w/image.naturalWidth,inner.h/image.naturalHeight),iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
 ctx.drawImage(image,inner.x+(inner.w-iw)/2,inner.y+(inner.h-ih)/2,iw,ih);ctx.lineWidth=2.5;ctx.strokeStyle=c.ink;ctx.strokeRect(inner.x,inner.y,inner.w,inner.h);
 ctx.fillStyle=c.ink2;text(ctx,caption,24,h-30,w-48,24,1,f.body);
 ctx.restore();
}
export async function renderCornerPng({contributions,revision,photos}){
 if(contributions.length!==2)throw Error('需要双方可用的小人和署名。');
 const {colour:c,font:f}=theme(),footer='小人与留言分别由署名者提供 · 双方确认版 '+revision;
 await fontsFor(f,{logo:HEADER,display:TITLE,ui:contributions.map(d=>d.name).join(''),body:contributions.map(d=>(d.note||'')+'照片：'+d.name).join('')+footer});
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1600;const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器暂不支持导出，可保留已保存的创作记录。');
 const noteRows=contributions.map(d=>lines(ctx,d.note||'',470,28,f.body));const extra=Math.max(0,...noteRows.map(rows=>rows.length-3))*40;
 // the polaroid band only exists when someone chose a photo: without one the sheet ends under the notes instead of leaving half a page blank
 const shown=contributions.filter(d=>photos.get(d.userId)).length,band=shown?400:0,bottom=1100+band+extra;canvas.height=bottom+100;
 ctx.textBaseline='alphabetic';
 // paper, dots, the main sheet with a hard ink shadow, tape over its top edge
 ctx.fillStyle=c.paper;ctx.fillRect(0,0,1200,canvas.height);dots(ctx,c.ink,1200,canvas.height);
 card(ctx,c,44,52,1100,bottom-12);
 tape(ctx,c.yellow,600,56,190,46,-.035);tape(ctx,c.pink,1096,96,130,40,.62);
 // header (logo lettering) and the layered title
 logoText(ctx,c,HEADER,96,152,40,f.logo);squiggle(ctx,c.mint,98,184,300);
 titleText(ctx,c,TITLE,TITLE_KEY,92,290,100,f.display,900);star(ctx,c,1072,212,34,c.yellow);
 // two sides: an arch for each person, a heart between them
 for(let i=0;i<2;i++){
  const d=contributions[i],x=96+i*544,tint=i?c.pinkSoft:c.mintSoft;
  ctx.save();ctx.fillStyle=c.ink;ctx.translate(7,8);sketch(ctx,x+60,330,360,470,[150,150,18,12]);ctx.fill();ctx.restore();
  ctx.fillStyle=tint;sketch(ctx,x+60,330,360,470,[150,150,18,12]);ctx.fill();ctx.lineWidth=4.5;ctx.strokeStyle=c.ink;ctx.stroke();
  ctx.fillStyle=i?c.pink:c.mint;ctx.beginPath();ctx.ellipse(x+240,778,112,20,0,0,Math.PI*2);ctx.fill();ctx.lineWidth=3.5;ctx.stroke();
  const avatar=await decode(new Blob([renderAvatarSvg(d.avatar,{view:'quarter',width:230,height:510})],{type:'image/svg+xml'}));ctx.drawImage(avatar,x+125,282,230,510);
  ctx.font=`40px ${f.ui}`;const nameWidth=Math.min(ctx.measureText(d.name).width,470);ctx.fillStyle=c.yellow;ctx.fillRect(x-4,862,nameWidth+10,16);
  ctx.fillStyle=c.ink;ctx.fillText(d.name,x,872,470);
  ctx.fillStyle=c.ink2;ctx.font=`28px ${f.body}`;noteRows[i].forEach((line,row)=>ctx.fillText(line,x,932+row*40));
  const photo=photos.get(d.userId);if(photo){const image=await decode(photo),px=shown===1?360:x-6;polaroid(ctx,c,f,image,'照片：'+d.name,px,1068+extra,480,366,shown===1?-.018:i?.022:-.026);tape(ctx,i?c.mint:c.yellow,px+240,1072+extra,120,34,i?.05:-.06);}
 }
 heart(ctx,c,600,566,34);note(ctx,c,1046,bottom+8,40);
 ctx.fillStyle=c.ink3;ctx.textAlign='center';text(ctx,footer,600,bottom,900,23,1,f.body);ctx.textAlign='start';
 return new Promise((yes,no)=>canvas.toBlob(blob=>blob?yes(blob):no(Error('导出未完成，请重新选择导出。')),'image/png'));
}
