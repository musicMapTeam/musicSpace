// Runtime art direction over the unchanged Blender r2 geometry: the hand-drawn
// Doodle look (docs/design/doodle.md §6). Original code-native prints only, no
// photographs, venue skins or third-party artwork.
// The doodle render pass lives in web/avatar/doodle-pass.js; it is re-exported
// here so the room renderer takes its whole art direction from one module.
export {createDoodlePass,patchDoodleCel,doodleWanted,DOODLE_CODE} from '../avatar/doodle-pass.js';

/** The colour values of web/event-room/doodle/tokens.css, for WebGL and canvas. */
export const DOODLE_COLORS=Object.freeze({
 paper:'#f7efdf',card:'#fffaf0',paperDeep:'#efe3c8',ink:'#1c1b1a',ink2:'#3d3a36',ink3:'#6b655c',
 pink:'#ff5c8a',pinkSoft:'#ffd0dd',mint:'#5fdcc0',mintSoft:'#c9f3e8',yellow:'#ffd447',yellowSoft:'#fff0b8',
 sky:'#74b9ff',skySoft:'#d6e9ff',orange:'#ff8a3d',night:'#23212b',
});
const mixHex=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
const DS=DOODLE_COLORS;
/** Kraft board for the floor: the deep paper tone warmed with marker orange, a touch of ink. */
export const DOODLE_KRAFT=mixHex(mixHex(DS.paperDeep,DS.orange,.3),DS.ink,.12);

// Paper diorama: kraft floor, cream walls, one marker curtain, ink stage and
// speakers, marker props. Keys are the GLB's material names.
export const VENUE_PRINT_PALETTE=Object.freeze({
 CEL_FLOOR:DOODLE_KRAFT,CEL_PAPER:DS.paper,CEL_CURTAIN:DS.pink,
 CEL_SHADOW:DS.mint,CEL_INK:DS.ink,CEL_METAL:DS.ink2,
 CEL_LIME:DS.yellow,EMISSIVE_LIME:DS.yellow,
});

/** The classic room's palette (the pre-Doodle print direction), for every page
 * that is not the event room. Keys are the GLB's material names. */
export const CLASSIC_VENUE_PALETTE=Object.freeze({
 CEL_FLOOR:'#a77c56',CEL_PAPER:'#526a51',CEL_CURTAIN:'#294938',
 CEL_SHADOW:'#2a4133',CEL_INK:'#223b2d',CEL_METAL:'#827d62',
 CEL_LIME:'#bca66c',EMISSIVE_LIME:'#f1e2ab',
});

// Four photos: one row on a landscape window (a 2×2 there is height-bound and
// leaves the polaroids small on a wide wall), a 2×2 on a portrait or near-square one.
export const galleryColumns=(count,portrait,aspect=portrait?.75:1.6)=>Math.min(portrait?2:count===4?(aspect>=1?4:2):3,Math.max(1,count));
export const GALLERY_PRINT_ASPECT=1024/160;

// The hanging paper keeps its proportions. A narrower physical print is used
// for portrait framing instead of stretching the typography or backing away
// until the people become tiny.
export const stagePrintLayout=portrait=>({position:portrait?[.65,3.55,-4.71]:[-.5,3.45,-4.71],scale:portrait?.62:1});

const FONT={
 logo:'"Doodle Logo","Doodle Display","Arial Black",sans-serif',
 display:'"Doodle Display","Doodle Marker","Noto Sans CJK SC","Microsoft YaHei",sans-serif',
 hand:'"Doodle Hand","Doodle Marker","Noto Sans CJK SC","Microsoft YaHei",sans-serif',
 digits:'"Doodle Digits","Doodle Logo","Arial Black",sans-serif',
};
const PRINT_FONT_LOADS=[
 [`190px ${FONT.logo}`,'SIDE BY MUSIC SPACE / AFTER THE ENCORE OUR POINTS OF VIEW'],
 [`86px ${FONT.display}`,'同一晚，另一面。'],
 [`40px ${FONT.hand}`,'STAY FOR ONE MORE.'],
 [`130px ${FONT.digits}`,'01'],
];
/** Resolves true once at least one Doodle face for the prints has arrived (then repaint). */
export function loadVenuePrintFonts(doc=globalThis.document){
 const fonts=doc?.fonts;
 if(typeof fonts?.load!=='function')return Promise.resolve(false);
 return Promise.all(PRINT_FONT_LOADS.map(([font,text])=>fonts.load(font,text).then(faces=>faces.length>0,()=>false))).then(loaded=>loaded.some(Boolean));
}

// Small hand-drawn marks. Only basic path calls are used, so the prints also
// paint on minimal canvas implementations; text outlines are optional extras.
function random(seed){let s=seed%2147483647||1;return()=>(s=s*16807%2147483647)/2147483647;}
function wobblyRect(ctx,x,y,w,h,jitter,seed){
 const r=random(seed),j=()=>(r()-.5)*2*jitter;
 ctx.beginPath();ctx.moveTo(x+j(),y+j());
 ctx.bezierCurveTo(x+w*.33+j(),y+j(),x+w*.67+j(),y+j(),x+w+j(),y+j());
 ctx.bezierCurveTo(x+w+j(),y+h*.33+j(),x+w+j(),y+h*.67+j(),x+w+j(),y+h+j());
 ctx.bezierCurveTo(x+w*.67+j(),y+h+j(),x+w*.33+j(),y+h+j(),x+j(),y+h+j());
 ctx.bezierCurveTo(x+j(),y+h*.67+j(),x+j(),y+h*.33+j(),x+j(),y+j());
 ctx.closePath();
}
function star(ctx,x,y,radius,{fill,ink=DS.ink,line=6,turn=0,points=5,inner=.47}){
 ctx.save();ctx.translate(x,y);ctx.rotate(turn);ctx.beginPath();
 for(let i=0;i<points*2;i++){const a=-Math.PI/2+i*Math.PI/points,r=i%2?radius*inner:radius;i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
 ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}
 ctx.lineJoin='round';ctx.lineWidth=line;ctx.strokeStyle=ink;ctx.stroke();ctx.restore();
}
function sparkle(ctx,x,y,radius,color=DS.ink){
 ctx.save();ctx.translate(x,y);ctx.beginPath();ctx.moveTo(0,-radius);
 ctx.bezierCurveTo(radius*.12,-radius*.12,radius*.12,-radius*.12,radius,0);
 ctx.bezierCurveTo(radius*.12,radius*.12,radius*.12,radius*.12,0,radius);
 ctx.bezierCurveTo(-radius*.12,radius*.12,-radius*.12,radius*.12,-radius,0);
 ctx.bezierCurveTo(-radius*.12,-radius*.12,-radius*.12,-radius*.12,0,-radius);
 ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();
}
function wave(ctx,x,y,width,height,count,color,line){
 ctx.beginPath();ctx.moveTo(x,y);const step=width/count;
 for(let i=0;i<count;i++){const s=x+i*step,dir=i%2?1:-1;ctx.bezierCurveTo(s+step*.3,y+dir*height,s+step*.7,y+dir*height,s+step,y);}
 ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=line;ctx.strokeStyle=color;ctx.stroke();
}
function band(ctx,x,y,w,h,color,turn=-.012){
 ctx.save();ctx.translate(x,y);ctx.rotate(turn);wobblyRect(ctx,0,0,w,h,2.5,Math.round(w+h));ctx.fillStyle=color;ctx.fill();ctx.restore();
}
const textWidth=(ctx,text,size)=>ctx.measureText?.(text)?.width||text.length*size*.62;
/** Layered lettering: colour offset shadow, then ink outline, then the fill. */
function layered(ctx,text,x,y,{fill=DS.ink,outline=null,shadow=DS.pink,dx=8,dy=8,line=10}){
 ctx.lineJoin='round';ctx.miterLimit=2;
 if(shadow){ctx.fillStyle=shadow;ctx.fillText(text,x+dx,y+dy);if(outline){ctx.strokeStyle=shadow;ctx.lineWidth=line;ctx.strokeText?.(text,x+dx,y+dy);}}
 if(outline){ctx.strokeStyle=outline;ctx.lineWidth=line;ctx.strokeText?.(text,x,y);}
 ctx.fillStyle=fill;ctx.fillText(text,x,y);
}

/** The hanging stage print: a yellow marker poster with sticker lettering. */
export function paintStagePrint(ctx){
 ctx.fillStyle=DS.yellow;ctx.fillRect(0,0,1200,680);
 // a light grid of pink print dots in one corner, like a riso poster
 ctx.fillStyle=DS.pink;
 for(let row=0;row<6;row++)for(let col=0;col<9-row;col++){ctx.beginPath();ctx.arc(1118-col*24,64+row*24,5.5-row*.5,0,Math.PI*2);ctx.fill();}
 wobblyRect(ctx,26,24,1148,632,4,7);ctx.lineJoin='round';ctx.lineWidth=10;ctx.strokeStyle=DS.ink;ctx.stroke();
 ctx.save();ctx.translate(88,58);ctx.rotate(-.04);
 ctx.font=`190px ${FONT.logo}`;ctx.textBaseline='alphabetic';
 layered(ctx,'SIDE',0,198,{fill:DS.card,outline:DS.ink,shadow:DS.pink,dx:12,dy:12,line:16});
 layered(ctx,'BY SIDE',-6,392,{fill:DS.card,outline:DS.ink,shadow:DS.pink,dx:12,dy:12,line:16});
 wave(ctx,0,446,760,13,8,DS.ink,9);
 ctx.restore();
 // "01" sticker
 ctx.save();ctx.translate(990,262);ctx.rotate(.1);
 ctx.fillStyle=DS.ink;ctx.beginPath();ctx.arc(10,12,112,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=DS.pink;ctx.beginPath();ctx.arc(0,0,112,0,Math.PI*2);ctx.fill();
 ctx.lineWidth=9;ctx.strokeStyle=DS.ink;ctx.stroke();
 ctx.font=`132px ${FONT.digits}`;ctx.textAlign='center';ctx.fillStyle=DS.ink;ctx.fillText('01',0,46);
 ctx.restore();ctx.textAlign='left';
 star(ctx,1078,470,46,{fill:DS.card,line:7,turn:.2});
 sparkle(ctx,946,452,24);sparkle(ctx,1114,566,17);
 // small print
 ctx.fillStyle=DS.ink;ctx.font=`34px ${FONT.logo}`;ctx.fillText('MUSIC SPACE  /  AFTER THE ENCORE',92,560);
 ctx.save();ctx.translate(96,622);ctx.rotate(-.025);ctx.font=`42px ${FONT.hand}`;ctx.fillText('STAY FOR ONE MORE.',0,0);ctx.restore();
}

/** The gallery label above the photo wall: a paper strip with layered title lettering. */
export function paintGalleryPrint(ctx){
 ctx.fillStyle=DS.card;ctx.fillRect(0,0,1024,160);
 const title='同一晚，',key='另一面。',size=86,x=44,y=104;
 ctx.font=`${size}px ${FONT.display}`;ctx.textBaseline='alphabetic';
 const lead=textWidth(ctx,title,size),keyWidth=textWidth(ctx,key,size);
 band(ctx,x+lead-6,y-50,keyWidth*.82+12,46,DS.mint);
 layered(ctx,title,x,y,{shadow:DS.pink,dx:5,dy:5});
 layered(ctx,key,x+lead,y,{shadow:DS.pink,dx:5,dy:5});
 ctx.fillStyle=DS.ink;ctx.font=`22px ${FONT.logo}`;ctx.fillText('MUSIC SPACE / OUR POINTS OF VIEW',x+2,146);
 star(ctx,936,72,36,{fill:DS.pink,line:5,turn:-.25});
 sparkle(ctx,880,116,15);sparkle(ctx,986,128,10);
 wobblyRect(ctx,7,7,1010,146,2.5,3);ctx.lineJoin='round';ctx.lineWidth=7;ctx.strokeStyle=DS.ink;ctx.stroke();
}

// The classic room's prints, unchanged from before the Doodle restyle.
/** Classic backdrop sign of the procedural room (1536×720). */
export function paintClassicStageSign(ctx){
 ctx.fillStyle='#ecebdc';ctx.fillRect(0,0,1536,720);
 ctx.fillStyle='#252329';ctx.save();ctx.translate(84,30);ctx.rotate(-.06);
 ctx.font='900 250px Arial';ctx.fillText('SIDE',0,280);ctx.fillText('BY SIDE',-7,520);ctx.restore();
 ctx.fillStyle='#dcec54';ctx.beginPath();ctx.arc(1238,247,183,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#252329';ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(1090,270);ctx.bezierCurveTo(1180,105,1290,400,1380,224);ctx.stroke();
 ctx.fillStyle='#252329';ctx.font='bold 26px monospace';ctx.fillText('MUSIC SPACE / AFTER THE ENCORE',90,652);
 ctx.font='bold 21px monospace';ctx.fillText('01',1360,659);
}

/** Classic hanging stage print (1200×680): only the physical stage's print, all room volume stays real. */
export function paintClassicStagePrint(ctx){
 const paper='#eee2c1',ink='#294c3e',acid='#c78555';
 ctx.fillStyle=paper;ctx.fillRect(0,0,1200,680);
 ctx.fillStyle=ink;ctx.fillRect(38,35,1124,610);
 ctx.save();ctx.translate(81,95);ctx.rotate(-.035);
 ctx.fillStyle=paper;ctx.font='900 188px Arial';ctx.fillText('SIDE',0,155);ctx.fillText('BY SIDE',-4,330);
 ctx.fillStyle=acid;ctx.fillRect(6,356,808,14);ctx.restore();
 ctx.strokeStyle=paper;ctx.lineWidth=6;
 for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(861+i*35,133);ctx.bezierCurveTo(752+i*35,263,1107-i*12,323,905+i*24,484);ctx.stroke();}
 ctx.fillStyle=acid;ctx.beginPath();ctx.arc(976,166,45,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=paper;ctx.font='700 21px monospace';ctx.fillText('MUSIC SPACE  /  AFTER THE ENCORE',79,569);
 ctx.font='20px monospace';ctx.fillText('STAY FOR ONE MORE.',79,605);
 ctx.font='700 45px Arial';ctx.fillText('01',1040,598);
 // Sparse registration strokes belong to the printed design, not random noise.
 ctx.strokeStyle=ink;ctx.lineWidth=2;
 for(const y of[17,663]){ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(176,y);ctx.moveTo(1024,y);ctx.lineTo(1166,y);ctx.stroke();}
}

/** Classic gallery label above the photo wall (1024×160). */
export function paintClassicGalleryPrint(ctx){
 ctx.fillStyle='#eee7d6';ctx.fillRect(0,0,1024,160);
 ctx.fillStyle='#292737';ctx.fillRect(0,0,13,160);
 ctx.font='900 80px "Noto Sans CJK SC","Microsoft YaHei",sans-serif';ctx.fillText('同一晚，另一面。',43,93);
 ctx.font='700 18px monospace';ctx.fillText('MUSIC SPACE / OUR POINTS OF VIEW',48,138);
 ctx.fillStyle='#71875d';ctx.fillRect(920,124,59,5);
}
