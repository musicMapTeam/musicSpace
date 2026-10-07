import {renderAvatarSvg} from '../illustrated-avatar/index.js';

// The private memory card (1080 × 1440 PNG) in the Doodle style (docs/design/doodle.md): cream dot-grid paper, an ink-lined card with a hard
// shadow, taped polaroids, marker accents. Same content as before: the header, the room's title and venue, the person's own photos with
// 「摄影 / 名字」, the saved little person (optional), 「留存 / 名字」, the date and the privacy line. Colours and fonts are the page's own
// tokens (tokens.css), read at draw time; the fallbacks are tokens.css's values. The Doodle fonts are loaded before anything is drawn.
const W=1080,H=1440,X0=100,X1=980;
const TOKENS={paper:['--ds-paper','#f7efdf'],card:['--ds-paper-card','#fffaf0'],ink:['--ds-ink','#1c1b1a'],ink2:['--ds-ink-2','#3d3a36'],ink3:['--ds-ink-3','#6b655c'],pink:['--ds-pink','#ff5c8a'],mint:['--ds-mint','#5fdcc0'],yellow:['--ds-yellow','#ffd447'],yellowSoft:['--ds-yellow-soft','#fff0b8'],night:['--ds-night','#23212b']};
const FONTS={logo:['--ds-font-logo','"Doodle Logo","Doodle Display","Arial Black",sans-serif'],display:['--ds-font-display','"Doodle Display","Doodle Marker","PingFang SC","Microsoft YaHei",sans-serif'],ui:['--ds-font-ui','"Doodle Marker","PingFang SC","Microsoft YaHei",system-ui,sans-serif'],body:['--ds-font-body','"Doodle Hand","Doodle Marker","PingFang SC","Microsoft YaHei",system-ui,sans-serif'],digits:['--ds-font-digits','"Doodle Digits","Doodle Logo",ui-monospace,sans-serif']};
const HEADER='MUSIC SPACE',HEADER_TAIL=' / 这一晚',EMPTY_LINES=['这一晚，','留在手里。'],EMPTY_NOTE='散场以后，记忆还在。',PRIVACY='私人纪念';

function readTheme(){
 let style=null;try{style=getComputedStyle(document.documentElement);}catch{style=null;}
 const read=([name,fallback])=>{try{return style?.getPropertyValue(name).trim()||fallback;}catch{return fallback;}};
 const pick=table=>Object.fromEntries(Object.entries(table).map(([key,entry])=>[key,read(entry)]));
 return {C:pick(TOKENS),F:pick(FONTS)};
}
async function imageFromBlob(blob){const url=URL.createObjectURL(blob);try{const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}}
/** Fetch the font slices this card needs (the families are split by unicode-range, so the text decides which files load); never waits long. */
async function loadFonts(F,texts){
 const fonts=document.fonts;if(!fonts?.load)return;
 const jobs=[[`56px ${F.logo}`,HEADER],[`34px ${F.ui}`,texts.ui],[`80px ${F.display}`,texts.display],[`34px ${F.body}`,texts.body],[`36px ${F.digits}`,texts.digits]].filter(([,text])=>text);
 await Promise.race([Promise.all(jobs.map(([font,text])=>fonts.load(font,text).catch(()=>[]))),new Promise(resolve=>setTimeout(resolve,4000))]);
 try{await fonts.ready;}catch{/* draw with what is there */}
}
// a fixed seed: the same card always gets the same wobble
function wobble(seed=11){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
/** Lines of `value` that fit `width` (character by character, as the old card did); the last kept line ends with … when text is left over. */
function lines(ctx,value,width,maxLines){
 const out=[];let line='';
 for(const char of String(value||'')){if(ctx.measureText(line+char).width>width&&line){out.push(line);line='';if(out.length>=maxLines)break;}line+=char;}
 if(out.length<maxLines){if(line)out.push(line);return out;}
 let last=out[maxLines-1];while(last&&ctx.measureText(last+'…').width>width)last=last.slice(0,-1);out[maxLines-1]=last+'…';return out;
}
/** A box with slightly bowed, hand-drawn edges and soft corners, at (0,0). */
function sketchBox(w,h,r,rand,bow=3){
 const p=new Path2D(),b=()=>(rand()-.5)*2*bow;
 p.moveTo(r,0);p.quadraticCurveTo(w/2,b(),w-r,0);p.quadraticCurveTo(w,0,w,r);p.quadraticCurveTo(w+b(),h/2,w,h-r);p.quadraticCurveTo(w,h,w-r,h);
 p.quadraticCurveTo(w/2,h+b(),r,h);p.quadraticCurveTo(0,h,0,h-r);p.quadraticCurveTo(b(),h/2,0,r);p.quadraticCurveTo(0,0,r,0);p.closePath();return p;
}
function inked(ctx,path,{fill,shadow=null,line=5,C}){
 if(shadow){ctx.save();ctx.translate(shadow[0],shadow[1]);ctx.fillStyle=C.ink;ctx.fill(path);ctx.restore();}
 if(fill){ctx.fillStyle=fill;ctx.fill(path);}
 if(line){ctx.lineWidth=line;ctx.lineJoin='round';ctx.strokeStyle=C.ink;ctx.stroke(path);}
}
/** A strip of translucent marker tape with torn ends, centred on (x, y). */
function tape(ctx,x,y,w,h,angle,color){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle*Math.PI/180);ctx.globalAlpha=.78;ctx.fillStyle=color;
 const p=new Path2D(),teeth=5;p.moveTo(-w/2,-h/2);p.lineTo(w/2,-h/2);
 for(let i=1;i<=teeth;i++)p.lineTo(w/2+(i%2?-5:0),-h/2+h*i/teeth);
 p.lineTo(-w/2,h/2);for(let i=teeth-1;i>=0;i--)p.lineTo(-w/2+(i%2?5:0),-h/2+h*i/teeth);
 p.closePath();ctx.fill(p);ctx.restore();
}
function starPath(cx,cy,R,rot){const p=new Path2D();for(let i=0;i<10;i++){const a=rot+i*Math.PI/5-Math.PI/2,rad=i%2?R*.47:R;const x=cx+Math.cos(a)*rad,y=cy+Math.sin(a)*rad;if(i)p.lineTo(x,y);else p.moveTo(x,y);}p.closePath();return p;}
/** A sticker star: the marker fill printed a little off the ink line. */
function star(ctx,cx,cy,R,rot,color,C){ctx.save();ctx.translate(R*.13,R*.15);ctx.fillStyle=color;ctx.fill(starPath(cx,cy,R,rot));ctx.restore();ctx.lineWidth=Math.max(3,R*.11);ctx.lineJoin='round';ctx.strokeStyle=C.ink;ctx.stroke(starPath(cx,cy,R,rot));}
function sparkle(ctx,cx,cy,r,color){const k=r*.16,p=new Path2D();p.moveTo(cx,cy-r);p.quadraticCurveTo(cx+k,cy-k,cx+r,cy);p.quadraticCurveTo(cx+k,cy+k,cx,cy+r);p.quadraticCurveTo(cx-k,cy+k,cx-r,cy);p.quadraticCurveTo(cx-k,cy-k,cx,cy-r);p.closePath();ctx.fillStyle=color;ctx.fill(p);}
function squiggle(ctx,x,y,w,color,{amp=7,wave=34,line=6}={}){
 ctx.beginPath();ctx.moveTo(x,y);for(let i=0;i+wave<=w+.5;i+=wave){ctx.quadraticCurveTo(x+i+wave/4,y-amp,x+i+wave/2,y);ctx.quadraticCurveTo(x+i+wave*3/4,y+amp,x+i+wave,y);}
 ctx.lineWidth=line;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.stroke();
}
/** A marker band behind the lower part of a line of text (x..x+w, baseline y, font size s). */
function highlight(ctx,x,y,w,s,color){ctx.save();ctx.globalAlpha=.9;ctx.fillStyle=color;const p=new Path2D();p.moveTo(x-8,y-s*.36);p.lineTo(x+w+10,y-s*.4);p.lineTo(x+w+8,y+s*.08);p.lineTo(x-10,y+s*.12);p.closePath();ctx.fill(p);ctx.restore();}
function note(ctx,x,y,s,C){
 ctx.save();ctx.translate(x,y);ctx.rotate(-.12);ctx.strokeStyle=C.ink;ctx.fillStyle=C.ink;ctx.lineWidth=s*.09;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(s*.32,s*.78);ctx.lineTo(s*.32,s*.1);ctx.lineTo(s*.9,0);ctx.lineTo(s*.9,s*.66);ctx.stroke();
 ctx.lineWidth=s*.15;ctx.beginPath();ctx.moveTo(s*.32,s*.17);ctx.lineTo(s*.9,s*.07);ctx.stroke();
 for(const [hx,hy] of [[s*.2,s*.8],[s*.78,s*.68]]){ctx.beginPath();ctx.ellipse(hx,hy,s*.15,s*.11,-.35,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}
/** Text with an offset marker shadow under ink letters (the page's .ds-title). */
function layered(ctx,text,x,y,color,shadow,offset){ctx.fillStyle=shadow;ctx.fillText(text,x+offset,y+offset);ctx.fillStyle=color;ctx.fillText(text,x,y);}
/** The image fitted (never cropped) into at most maxW × maxH. */
const fit=(image,maxW,maxH)=>{const s=Math.min(maxW/image.naturalWidth,maxH/image.naturalHeight);return {w:Math.max(1,Math.round(image.naturalWidth*s)),h:Math.max(1,Math.round(image.naturalHeight*s))};};
/** A taped polaroid of one photo, centred on (cx, cy), with 「摄影 / 名字」 written in its bottom band. */
function polaroid(ctx,{image,w,h,cx,cy,angle,caption,tapes,rand,C,F}){
 const pad=24,band=96,fw=w+pad*2,fh=h+pad+band;
 ctx.save();ctx.translate(cx,cy);ctx.rotate(angle*Math.PI/180);ctx.translate(-fw/2,-fh/2);
 inked(ctx,sketchBox(fw,fh,6,rand,2.5),{fill:C.card,shadow:[13,15],line:5,C});
 ctx.fillStyle=C.night;ctx.fillRect(pad,pad,w,h);ctx.drawImage(image,pad,pad,w,h);
 ctx.lineWidth=3.5;ctx.strokeStyle=C.ink;ctx.strokeRect(pad,pad,w,h);
 ctx.font=`36px ${F.body}`;ctx.fillStyle=C.ink;ctx.textBaseline='alphabetic';
 ctx.fillText(lines(ctx,caption,fw-pad*2-10,1)[0]||'',pad+6,pad+h+band*.62);
 tapes.forEach(([dx,angleOf,color])=>tape(ctx,fw*dx,-4,150,40,angleOf,color));
 ctx.restore();
}

export async function renderMemoryCardPng({room,author,includeAvatar,photos,savedAt}){
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('这个浏览器暂不支持保存纪念卡。');
 const {C,F}=readTheme(),rand=wobble();
 const title=String(room.title||''),venue=room.venue||'我的现场记录',savedLine='保存于 '+savedAt.toISOString().slice(0,10).replaceAll('-','.'),kept='留存 / '+author.name;
 const captions=photos.map(photo=>'摄影 / '+photo.authorName);
 await loadFonts(F,{ui:HEADER_TAIL+kept+savedLine,display:title+EMPTY_LINES.join(''),body:venue+captions.join('')+PRIVACY+EMPTY_NOTE,digits:savedLine});
 ctx.textBaseline='alphabetic';

 // the paper and its dot grid
 ctx.fillStyle=C.paper;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.globalAlpha=.15;ctx.fillStyle=C.ink;for(let y=20;y<H;y+=36)for(let x=20;x<W;x+=36){ctx.beginPath();ctx.arc(x,y,2.3,0,Math.PI*2);ctx.fill();}ctx.restore();
 // the card: ink line, hard shadow, a strip of tape
 ctx.save();ctx.translate(44,40);inked(ctx,sketchBox(992,1352,28,rand,4),{fill:C.card,shadow:[14,16],line:6,C});ctx.restore();
 tape(ctx,540,44,190,46,-3,C.yellow);

 // the header: the word mark as a sticker (yellow letters, ink outline, ink and pink shadows), then 「 / 这一晚」
 ctx.font=`54px ${F.logo}`;ctx.lineJoin='round';
 // word by word with a wider gap: the display face sets its space very tight
 const logoY=142,words=HEADER.split(' '),gap=18;let logoW=0;
 for(const word of words){const x=X0+logoW;ctx.fillStyle=C.pink;ctx.fillText(word,x+7,logoY+7);ctx.fillStyle=C.ink;ctx.fillText(word,x+3.5,logoY+3.5);
  ctx.lineWidth=7;ctx.strokeStyle=C.ink;ctx.strokeText(word,x,logoY);ctx.fillStyle=C.yellow;ctx.fillText(word,x,logoY);logoW+=ctx.measureText(word).width+gap;}
 logoW-=gap;ctx.font=`34px ${F.ui}`;ctx.fillStyle=C.ink2;ctx.fillText(HEADER_TAIL,X0+logoW+14,logoY-2);
 squiggle(ctx,X0,logoY+30,272,C.mint,{amp:6,wave:34,line:6});

 // the room's title (layered, up to two lines), its venue on a mint marker band, and the little person on a round yellow sticker
 const textW=includeAvatar?640:X1-X0;
 ctx.font=`80px ${F.display}`;const titleLines=lines(ctx,title,textW,2);
 let y=274;for(const line of titleLines){layered(ctx,line,X0,y,C.ink,C.pink,6);y+=92;}
 const venueY=y-92+68;ctx.font=`34px ${F.body}`;const venueLine=lines(ctx,venue,textW,1)[0]||'';
 highlight(ctx,X0,venueY,ctx.measureText(venueLine).width,34,C.mint);ctx.fillStyle=C.ink;ctx.fillText(venueLine,X0,venueY);
 if(includeAvatar){
  const svg=renderAvatarSvg(author.avatar,{view:'quarter',width:240,height:500}),image=await imageFromBlob(new Blob([svg],{type:'image/svg+xml'}));
  const disc=new Path2D();disc.arc(868,262,96,0,Math.PI*2);inked(ctx,disc,{fill:C.yellow,shadow:[9,10],line:5,C});
  ctx.drawImage(image,868-66,118,132,275);
  sparkle(ctx,968,150,22,C.pink);sparkle(ctx,760,214,12,C.ink);
 }

 // the photos: one big taped polaroid, or two that sit diagonally; without photos, a paper ticket that says so in words
 const top=Math.max(venueY+56,includeAvatar?420:0),bottom=1186;
 if(photos.length){
  const images=[];for(const photo of photos)images.push(await imageFromBlob(photo.blob));
  if(images.length===1){
   const space=bottom-top-40,size=fit(images[0],820,space-24-96);
   polaroid(ctx,{image:images[0],...size,cx:540,cy:top+20+space/2,angle:-2,caption:captions[0],tapes:[[.12,-14,C.yellow],[.88,11,C.pink]],rand,C,F});
  }else{
   const space=bottom-top,each=Math.round((space+70)/2)-24-96-24,first=fit(images[0],500,each),second=fit(images[1],500,each);
   const f1={w:first.w+48,h:first.h+120},f2={w:second.w+48,h:second.h+120};
   polaroid(ctx,{image:images[0],...first,cx:X0+10+f1.w/2,cy:top+18+f1.h/2,angle:-3,caption:captions[0],tapes:[[.5,-5,C.yellow]],rand,C,F});
   polaroid(ctx,{image:images[1],...second,cx:X1-10-f2.w/2,cy:bottom-f2.h/2-6,angle:2.5,caption:captions[1],tapes:[[.5,6,C.pink]],rand,C,F});
   star(ctx,X1-70,top+80,40,.2,C.yellow,C);note(ctx,X0+30,bottom-150,90,C);
  }
 }else{
  const boxTop=top+24,boxH=bottom-boxTop-10;
  ctx.save();ctx.translate(X0,boxTop);const ticket=sketchBox(X1-X0,boxH,26,rand,3);ctx.fillStyle=C.yellowSoft;ctx.fill(ticket);ctx.setLineDash([22,14]);ctx.lineWidth=5;ctx.strokeStyle=C.ink;ctx.stroke(ticket);ctx.restore();
  const mid=boxTop+boxH/2;ctx.font=`104px ${F.display}`;
  layered(ctx,EMPTY_LINES[0],X0+64,mid-50,C.ink,C.pink,7);
  const second=EMPTY_LINES[1],secondW=ctx.measureText(second).width;highlight(ctx,X0+64,mid+78,secondW,104,C.mint);layered(ctx,second,X0+64,mid+78,C.ink,C.pink,7);
  ctx.font=`36px ${F.body}`;ctx.fillStyle=C.ink2;ctx.fillText(lines(ctx,EMPTY_NOTE,X1-X0-128,1)[0],X0+64,mid+190);
  star(ctx,X1-110,boxTop+110,50,.25,C.yellow,C);sparkle(ctx,X1-200,boxTop+70,18,C.pink);note(ctx,X1-150,mid+40,96,C);
 }

 // the footer: a dashed rule, who keeps it, when, and the privacy line; a sticker star in the free corner
 ctx.save();ctx.setLineDash([16,12]);ctx.lineWidth=3;ctx.strokeStyle=C.ink3;ctx.beginPath();ctx.moveTo(X0,1222);ctx.lineTo(X1,1222);ctx.stroke();ctx.restore();
 ctx.font=`38px ${F.ui}`;ctx.fillStyle=C.ink;ctx.fillText(lines(ctx,kept,700,1)[0],X0,1282);
 const [savedWord,...savedRest]=savedLine.split(' ');ctx.font=`30px ${F.ui}`;ctx.fillStyle=C.ink2;ctx.fillText(savedWord+' ',X0,1330);
 const savedW=ctx.measureText(savedWord+' ').width;ctx.font=`38px ${F.digits}`;ctx.fillStyle=C.ink;ctx.fillText(savedRest.join(' '),X0+savedW,1331);
 ctx.font=`27px ${F.body}`;ctx.fillStyle=C.ink2;ctx.fillText(lines(ctx,PRIVACY,760,1)[0],X0,1374);
 star(ctx,928,1288,46,-.15,C.yellow,C);sparkle(ctx,866,1352,15,C.pink);

 return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('暂未生成图片，请重试。')),'image/png'));
}
export function saveMemoryCardDownload(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
