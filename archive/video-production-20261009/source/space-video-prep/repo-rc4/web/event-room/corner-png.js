import {renderAvatarSvg} from '../illustrated-avatar/index.js';
async function decode(blob){const url=URL.createObjectURL(blob);try{const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}}
function lines(ctx,value,width,size){ctx.font=`${size}px Arial,"Microsoft YaHei",sans-serif`;const result=[];let line="";for(const char of String(value)){if(ctx.measureText(line+char).width>width&&line){result.push(line);line="";}line+=char;}if(line)result.push(line);return result;}
function text(ctx,value,x,y,width,size,rows){ctx.font=`${size}px Arial,"Microsoft YaHei",sans-serif`;let line='',row=0;for(const char of String(value)){if(ctx.measureText(line+char).width>width&&line){ctx.fillText(line,x,y+row*size*1.4);line='';if(++row>=rows)return;}line+=char;}if(row<rows)ctx.fillText(line,x,y+row*size*1.4);}
export async function renderCornerPng({contributions,revision,photos}){
 if(contributions.length!==2)throw Error('需要双方可用的小人和署名。');
 await document.fonts?.ready;const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1600;const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器暂不支持导出，可保留已保存的创作记录。');
 const noteRows=contributions.map(d=>lines(ctx,d.note||'',490,28));const extra=Math.max(0,...noteRows.map(rows=>rows.length-3))*40;canvas.height=1600+extra;
 ctx.fillStyle='#f1eadb';ctx.fillRect(0,0,1200,canvas.height);ctx.strokeStyle='#282633';ctx.lineWidth=3;ctx.strokeRect(35,35,1130,1530+extra);ctx.fillStyle='#282633';ctx.font='bold 28px Arial';ctx.fillText('MUSIC SPACE / TWO SIDES',70,108);ctx.fillStyle='#dce982';ctx.fillRect(70,138,1060,10);ctx.fillStyle='#282633';ctx.font='bold 62px Arial,"Microsoft YaHei",sans-serif';ctx.fillText('同一晚，我们的另一面。',70,237);
 for(let i=0;i<2;i++){const d=contributions[i],x=70+i*555;const avatar=await decode(new Blob([renderAvatarSvg(d.avatar,{view:'quarter',width:230,height:510})],{type:'image/svg+xml'}));ctx.drawImage(avatar,x+125,285,230,510);ctx.fillStyle='#282633';ctx.font='bold 36px Arial,"Microsoft YaHei",sans-serif';ctx.fillText(d.name,x,862,500);ctx.font='28px Arial,"Microsoft YaHei",sans-serif';noteRows[i].forEach((line,row)=>ctx.fillText(line,x,927+row*40));
  const photo=photos.get(d.userId);if(photo){const image=await decode(photo),w=490,h=300,scale=Math.min(w/image.naturalWidth,h/image.naturalHeight);ctx.fillStyle='#faf6eb';ctx.fillRect(x,1065+extra,w,355);ctx.drawImage(image,x+(w-image.naturalWidth*scale)/2,1080+extra+(h-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);ctx.fillStyle='#625e68';text(ctx,'照片：'+d.name,x+12,1400+extra,465,21,1);}
 }
 ctx.fillStyle='#625e68';text(ctx,'小人与留言分别由署名者提供 · 双方确认版 '+revision,70,1505+extra,1060,23,1);
 return new Promise((yes,no)=>canvas.toBlob(blob=>blob?yes(blob):no(Error('导出未完成，请重新选择导出。')),'image/png'));
}
