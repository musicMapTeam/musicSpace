import {renderAvatarSvg} from '../illustrated-avatar/index.js';
const PAPER='#f1eadb',INK='#282633',MUTED='#625e68',ACCENT='#dce982';
async function imageFromBlob(blob){const url=URL.createObjectURL(blob);try{const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}}
function wrap(context,value,x,y,width,lineHeight,maxLines){let line='',row=0;for(const char of String(value||'')){if(context.measureText(line+char).width>width&&line){context.fillText(line,x,y+row*lineHeight);line='';row++;if(row>=maxLines){return;}}line+=char;}if(line&&row<maxLines)context.fillText(line,x,y+row*lineHeight);}
export async function renderMemoryCardPng({room,author,includeAvatar,photos,savedAt}){
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('这个浏览器暂不支持保存纪念卡。');
 await document.fonts?.ready;
 ctx.fillStyle=PAPER;ctx.fillRect(0,0,1080,1440);ctx.strokeStyle=INK;ctx.lineWidth=2;ctx.strokeRect(30,30,1020,1380);
 ctx.fillStyle=INK;ctx.font='bold 28px Arial,"Microsoft YaHei",sans-serif';ctx.fillText('MUSIC SPACE / 这一晚',64,91);
 ctx.fillStyle=ACCENT;ctx.fillRect(64,113,952,8);ctx.fillStyle=INK;ctx.font='bold 64px Arial,"Microsoft YaHei",sans-serif';wrap(ctx,room.title,64,205,includeAvatar?770:952,76,2);
 ctx.fillStyle=MUTED;ctx.font='26px Arial,"Microsoft YaHei",sans-serif';wrap(ctx,room.venue||'我的现场记录',64,325,includeAvatar?770:952,34,1);
 if(includeAvatar){const svg=renderAvatarSvg(author.avatar,{view:'quarter',width:240,height:500}),image=await imageFromBlob(new Blob([svg],{type:'image/svg+xml'}));ctx.drawImage(image,856,134,135,281);}
 if(photos.length){
  const frames=photos.length===1?[{y:440,h:670}]:[{y:426,h:353},{y:802,h:353}];
  for(let i=0;i<photos.length;i++){const image=await imageFromBlob(photos[i].blob),frame=frames[i],inner={x:84,y:frame.y+20,w:912,h:frame.h-85};ctx.fillStyle='#faf6eb';ctx.fillRect(64,frame.y,952,frame.h);ctx.strokeStyle='#cfc5b3';ctx.strokeRect(64,frame.y,952,frame.h);const scale=Math.min(inner.w/image.naturalWidth,inner.h/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,inner.x+(inner.w-w)/2,inner.y+(inner.h-h)/2,w,h);ctx.fillStyle=INK;ctx.font='24px Arial,"Microsoft YaHei",sans-serif';ctx.fillText('摄影 / '+photos[i].authorName,86,frame.y+frame.h-25);}
 }else{
  ctx.strokeStyle='#cfc5b3';ctx.strokeRect(64,460,952,620);ctx.fillStyle=INK;ctx.font='bold 76px Arial,"Microsoft YaHei",sans-serif';ctx.fillText('这一晚，',114,667);ctx.fillText('留在手里。',114,777);ctx.fillStyle=ACCENT;ctx.fillRect(114,821,575,12);ctx.fillStyle=MUTED;ctx.font='30px Arial,"Microsoft YaHei",sans-serif';ctx.fillText('不必交换联系方式，也能留下自己的记忆。',114,951);
 }
 ctx.fillStyle=INK;ctx.font='bold 30px Arial,"Microsoft YaHei",sans-serif';ctx.fillText('留存 / '+author.name,64,1242);ctx.fillStyle=MUTED;ctx.font='24px Arial,"Microsoft YaHei",sans-serif';ctx.fillText('保存于 '+savedAt.toISOString().slice(0,10).replaceAll('-','.'),64,1290);ctx.fillText('私人纪念 · 分享副本前，请确认你愿意公开其中内容。',64,1358);
 return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('暂未生成图片，请重试。')),'image/png'));
}
export function saveMemoryCardDownload(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
