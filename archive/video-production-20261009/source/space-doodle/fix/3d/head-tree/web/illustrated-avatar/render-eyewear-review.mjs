import { writeFile, mkdir } from 'node:fs/promises';
import { renderAvatarSvg } from './index.js';
import { DEFAULT_AVATAR } from '../avatar/model.js';

// Reproduce the actual runtime SVG, not a separate character illustration.
const directory=process.argv[2]||new URL('.',import.meta.url);
await mkdir(directory,{recursive:true});
const ink='#342d2c',paper='#f1ecdf',acid='#d9ee80';
const text=(x,y,s,size=16,extra='')=>`<text x="${x}" y="${y}" fill="${ink}" font-family="Noto Sans CJK SC,sans-serif" font-size="${size}" ${extra}>${s}</text>`;
const body=a=>{const svg=renderAvatarSvg(a.look,{view:a.view});return svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>'));};
const pairs=[['front',0,'正面 · 不戴眼镜'],['front',1,'正面 · 厚方框'],['side',0,'侧面 · 不戴眼镜'],['side',1,'侧面 · 厚方框']];
const head=(title,subtitle,h)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${h}" viewBox="0 0 1280 ${h}"><rect width="1280" height="${h}" fill="${paper}"/><rect x="42" y="36" width="126" height="25" rx="2" fill="${acid}"/>${text(52,54,'MUSIC SPACE',12,'font-weight="700" letter-spacing="1"')}${text(42,105,title,34,'font-weight="700"')}${text(42,136,subtitle,15)}<path d="M42 158H1238" stroke="${ink}" stroke-width="1"/>`;
const overview=head('眼镜，由你选','同一角色、同一发型与表情。只切换眼镜，眼神和脸不会跟着换掉。',820)+pairs.map(([view,eyewear,label],i)=>`<svg x="${36+i*306}" y="178" width="288" height="570" viewBox="0 0 240 500">${body({view,look:{...DEFAULT_AVATAR,eyewear}})}</svg>${text(65+i*306,779,label,18,'font-weight="600"')}`).join('')+'</svg>';
const closeups=head('摘下镜框，眼神还在','上排为浅杏肤色，下排为深棕肤色；眉眼、鼻子、嘴与发型独立保留。',890)+[0,4].map((skin,row)=>pairs.map(([view,eyewear,label],i)=>`<defs><clipPath id="face-crop-${row}-${i}"><rect width="280" height="277"/></clipPath></defs><g transform="translate(${43+i*306} ${174+row*337})"><g clip-path="url(#face-crop-${row}-${i})"><svg width="280" height="277" viewBox="58 24 122 137">${body({view,look:{...DEFAULT_AVATAR,eyewear,skin}})}</svg></g></g>${text(67+i*306,477+row*337,label,17,'font-weight="600"')}`).join('')).join('')+text(42,863,'应用当前分层 SVG 的实际栅格化对照 · 不是场馆截图',13)+'</svg>';
for(const [name,svg] of [['MusicSpace-optional-eyewear',overview],['MusicSpace-eyewear-face-detail',closeups]]) await writeFile(typeof directory==='string'?`${directory}/${name}.svg`:new URL(`${name}.svg`,directory),svg);
console.log('Wrote runtime eyewear comparison SVGs');
