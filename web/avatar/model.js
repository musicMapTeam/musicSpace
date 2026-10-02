export const KEY='music-space-avatar:v1';
export const SESSION_KEY='music-space-avatar-session:v1';
export const DEFAULT_AVATAR={version:2,skin:0,hair:1,hairColor:3,outfit:0,top:0,bottom:0,shoes:1,eyewear:0,topColor:0,bottomColor:1,shoeColor:0,expression:'neutral',accessory:'none',pose:'listen'};
export const SKINS=['#f6dbc0','#e7b68e','#c78d65','#9e624b','#68473b'];
export const HAIRS=['#302b38','#694937','#a5774e','#d4c7b0'];
export const OUTFITS=['#e7decb','#8c9b7a','#b67e65','#678b8e','#b8896d','#8b9c7d'];
export const GARMENT_COLORS=['#eee3cd','#47404b','#8c9b7a','#b67e65','#678b8e','#aaa1c4','#c5a879','#c69d9e'];
export const TEMPLATES=[
 {name:'留白',english:'STATIC',note:'不戴眼镜 / 宽T / 高帮鞋',avatar:{...DEFAULT_AVATAR}},
 {name:'断拍',english:'BREAK',note:'不戴眼镜 / 工装夹克 / 锥形裤',avatar:{...DEFAULT_AVATAR,hair:0,hairColor:0,outfit:1,top:1,bottom:1,shoes:0,topColor:2,pose:'sway'}},
 {name:'循迹',english:'LOOP',note:'针织背心 / 阔腿裤',avatar:{...DEFAULT_AVATAR,hair:5,hairColor:0,outfit:2,top:2,bottom:2,shoes:2,eyewear:2,topColor:3,bottomColor:0,shoeColor:1}},
 {name:'回声',english:'ECHO',note:'不戴眼镜 / 飞行夹克 / 长袜',avatar:{...DEFAULT_AVATAR,hair:4,hairColor:0,outfit:3,top:3,bottom:3,shoes:2,topColor:4,bottomColor:0,shoeColor:1,pose:'wave'}},
 {name:'失真',english:'FUZZ',note:'条纹长袖 / 厚底鞋',avatar:{...DEFAULT_AVATAR,hair:2,hairColor:2,outfit:4,top:4,bottom:4,shoes:3,eyewear:3,topColor:6,pose:'sing'}},
 {name:'脉冲',english:'PULSE',note:'短上衣 / 微喇长裤',avatar:{...DEFAULT_AVATAR,hair:3,hairColor:1,outfit:5,top:5,bottom:5,shoes:0,eyewear:2,topColor:2,bottomColor:3,pose:'sway'}},
];
export const COMPONENTS={
 hair:[['侧扫','SIDE CUT'],['不对称鲍伯','ASYMMETRIC'],['碎刺','SHAG'],['高马尾','HIGH TAIL'],['卷束','TWISTS'],['齐切鲍伯','BLUNT'],['中分','CURTAIN'],['短寸','BUZZ']],
 eyewear:[['不戴眼镜','BARE'],['厚方框','BOLD'],['猫眼框','CAT EYE'],['窄墨镜','SHADES'],['细圆框','WIRE'],['折角框','ANGULAR']],
 top:[['宽版短袖','BOX TEE'],['工装夹克','UTILITY'],['叠穿背心','VEST'],['飞行夹克','BOMBER'],['条纹长袖','STRIPES'],['无袖短上衣','CROP']],
 bottom:[['宽版短裤','SHORTS'],['锥形长裤','TAPERED'],['阔腿裤','WIDE'],['短裤与长袜','LONG SOCKS'],['窄腿裤','SLIM'],['微喇裤','FLARE']],
 shoes:[['帆布鞋','CANVAS'],['高帮鞋','HIGH TOP'],['乐福鞋','LOAFER'],['厚底鞋','PLATFORM']],
 accessory:[['none','不加配件','CLEAN'],['headphones','大耳机','HEADPHONES'],['earbuds','入耳耳机','EARBUDS'],['chain','音符项链','CHAIN'],['crossbody','斜挎唱片包','RECORD BAG'],['cap','鸭舌帽','CAP']],
 expression:[['neutral','淡定','CALM'],['smile','浅笑','SMILE'],['wink','眨眼','WINK'],['focused','专注','FOCUS']],
};
export const POSES=[['sway','随音乐摇摆'],['wave','向你招手'],['sing','一起唱'],['listen','安静听歌']];
export const SONGS=[{id:'late-train',title:'晚班列车',artist:'Space 原创声景',mood:'把一天的噪音，留在身后',bpm:78,notes:[220,261.63,329.63,392],tag:'LO-FI / 78 BPM',color:'#c5caa6'}, {id:'moon-window',title:'月亮靠窗',artist:'Space 原创声景',mood:'今晚适合，慢一点靠近',bpm:66,notes:[196,246.94,293.66,369.99],tag:'AMBIENT / 66 BPM',color:'#c2b8d9'}, {id:'sakura-echo',title:'樱下回声',artist:'Space 原创声景',mood:'这首歌的副歌，留给你',bpm:96,notes:[261.63,329.63,392,493.88],tag:'INDIE / 96 BPM',color:'#e5b6b2'}];
export function newDraft(avatar=DEFAULT_AVATAR){return {id:crypto.randomUUID(),title:'把晚风借给你',caption:'这首歌，想和你一起听。',scene:{kind:'builtin',id:'rooftop-night'},songId:'late-train',avatar:safeAvatar(avatar),transform:{x:37,y:81,scale:1,rotation:0},light:65,frame:true,createdAt:new Date().toISOString()};}
export function normalizeSaved(x){
 const base={version:1,profile:null,draft:null,works:[],session:null};if(!x||x.version!==1)return base;
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const profile=obj(x.profile)&&typeof x.profile.name==='string'&&x.profile.name.length<=18?{name:x.profile.name,avatar:safeAvatar(x.profile.avatar)}:null;
 function draft(v){if(!obj(v)||typeof v.id!=='string'||typeof v.title!=='string'||!obj(v.scene)||!obj(v.transform)||!['builtin','photo'].includes(v.scene.kind))return null;if(v.scene.kind==='builtin'&&!['rooftop-night','sakura-night','fan-stage'].includes(v.scene.id))return null;if(v.scene.kind==='photo'&&!(typeof v.scene.dataUrl==='string'&&v.scene.dataUrl.startsWith('data:image/jpeg;base64,')))return null;return {...v,avatar:safeAvatar(v.avatar),transform:{x:clamp(Number(v.transform.x)||37,14,86),y:clamp(Number(v.transform.y)||81,45,94),scale:clamp(Number(v.transform.scale)||1,.55,1.35),rotation:clamp(Number(v.transform.rotation)||0,-20,20)},title:v.title.slice(0,24),caption:String(v.caption||'').slice(0,72),songId:SONGS.some(s=>s.id===v.songId)?v.songId:'late-train'};}
 const works=Array.isArray(x.works)?x.works.slice(0,100).map(w=>obj(w)&&typeof w.remoteId==='string'&&typeof w.id==='string'&&typeof w.title==='string'?{...w,avatar:safeAvatar(w.avatar)}:draft(w)).filter(Boolean):[];
 const session=obj(x.session)&&typeof x.session.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(x.session.token)&&obj(x.session.user)&&typeof x.session.user.id==='string'?x.session:null;
 return {...base,profile,draft:draft(x.draft),works,session,activeWork:typeof x.activeWork==='string'?x.activeWork:null,pendingEdits:obj(x.pendingEdits)?x.pendingEdits:{},inviteLinks:obj(x.inviteLinks)?Object.fromEntries(Object.entries(x.inviteLinks).filter(([k,v])=>typeof k==='string'&&typeof v==='string'&&v.length<2000)):{}};
}
export function readSaved(){let x=null;try{x=JSON.parse(localStorage.getItem(KEY));}catch{}const n=normalizeSaved(x);try{const own=JSON.parse(localStorage.getItem(SESSION_KEY));if(own?.token&&own?.user)n.session=normalizeSaved({version:1,session:own}).session;}catch{}if(n.session){try{localStorage.setItem(SESSION_KEY,JSON.stringify(n.session));}catch{}}return n;}
export const clone=x=>structuredClone(x);
export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function safeAvatar(input={}){
 const a=input&&typeof input==='object'?input:{},number=(v,max,fallback)=>Number.isFinite(Number(v))?Math.round(clamp(Number(v),0,max)):fallback;
 const outfit=number(a.outfit,5,0),v2=a.version===2;
 let hair=number(a.hair,v2?7:3,1);if(!v2&&hair===2&&outfit===3)hair=4;
 const legacyGlasses=a.accessory==='glasses',eyewearDefault=legacyGlasses?([2,5].includes(outfit)?2:outfit===4?3:1):0;
 return {version:2,skin:number(a.skin,4,0),hair,hairColor:number(a.hairColor,3,0),outfit,
  top:number(a.top,5,outfit),bottom:number(a.bottom,5,outfit),shoes:number(a.shoes,3,[1,0,2,2,3,0][outfit]),
  eyewear:number(a.eyewear,5,eyewearDefault),topColor:number(a.topColor,7,[0,2,3,4,6,2][outfit]),bottomColor:number(a.bottomColor,7,[1,1,0,0,1,3][outfit]),shoeColor:number(a.shoeColor,7,[0,0,1,1,0,0][outfit]),
  expression:['neutral','smile','wink','focused'].includes(a.expression)?a.expression:'neutral',
  accessory:['none','headphones','earbuds','chain','crossbody','cap'].includes(a.accessory)?a.accessory:'none',
  pose:POSES.some(p=>p[0]===a.pose)?a.pose:'sway'};
}
export function validateSaved(value){return value&&value.version===1&&Array.isArray(value.works)&&value.works.length<=100;}
export function withAvatarPart(value,key,next){
 const allowed=['skin','hair','hairColor','top','bottom','shoes','eyewear','topColor','bottomColor','shoeColor','accessory','expression','pose'];
 if(!allowed.includes(key))throw new Error('Unknown avatar component');
 return safeAvatar({...safeAvatar(value),[key]:next});
}
export function applyLookPreset(value,preset){const previous=safeAvatar(value);return {...safeAvatar(preset),skin:previous.skin,expression:previous.expression,pose:previous.pose};}
