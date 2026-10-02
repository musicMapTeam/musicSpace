// Runtime lighting/print direction over the unchanged Blender r2 geometry.
// These are original code-native print marks, not photographs or venue skins.
export const VENUE_PRINT_PALETTE=Object.freeze({
 CEL_FLOOR:'#96909b',CEL_PAPER:'#d5cdbb',CEL_CURTAIN:'#292737',
 CEL_SHADOW:'#494257',CEL_INK:'#252530',CEL_METAL:'#797481',
 CEL_LIME:'#bca66c',EMISSIVE_LIME:'#f1e2ab',
});

export const galleryColumns=(count,portrait)=>Math.min(count===4?2:portrait?2:3,Math.max(1,count));
export const GALLERY_PRINT_ASPECT=1024/160;

// The hanging paper keeps its proportions. A narrower physical print is used
// for portrait framing instead of stretching the typography or backing away
// until the people become tiny.
export const stagePrintLayout=portrait=>({position:portrait?[.65,3.55,-4.71]:[-.5,3.45,-4.71],scale:portrait?.62:1});

/** Paint only the physical stage's hanging print, leaving all room volume real. */
export function paintStagePrint(ctx){
 const paper='#eee7d6',ink='#2b273d',acid='#dce982';
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

export function paintGalleryPrint(ctx){
 ctx.fillStyle='#eee7d6';ctx.fillRect(0,0,1024,160);
 ctx.fillStyle='#292737';ctx.fillRect(0,0,13,160);
 ctx.font='900 80px "Noto Sans CJK SC","Microsoft YaHei",sans-serif';ctx.fillText('同一晚，另一面。',43,93);
 ctx.font='700 18px monospace';ctx.fillText('MUSIC SPACE / OUR POINTS OF VIEW',48,138);
 ctx.fillStyle='#71875d';ctx.fillRect(920,124,59,5);
}
