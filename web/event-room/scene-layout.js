/** Deterministic floor positions aligned with the overview camera, not its
 * changing close-up view. Actual membership and ordering remain unchanged. */
export function memberFloorPositions(count,portrait){
 const right=portrait?[.99015,.14]:[.87004,.493];
 const gap=portrait?(count>2?1.15:1.9):(count>4?1.45:2.15),centerZ=portrait?1.4:2;
 return Array.from({length:count},(_,i)=>{const x=(i-(count-1)/2)*gap,depth=count>2?(i%2?.1:-.1):0;return [right[0]*x+right[1]*depth,0,centerZ+right[1]*x-right[0]*depth];});
}

export function overviewCameraLayout(count,portrait){
 const distance=portrait?(count>2?13.8:11.8):(count>4?14.4:10.8);
 return portrait
  ?{position:[-.14*distance,2+.18*distance,.5+.99015*distance],target:[0,2,.5]}
  :{position:[-.493*distance,2.15+.20*distance,1+.87004*distance],target:[0,2.15,1]};
}

/** Screen-space labels keep their own target and a small leader. All names
 * remain in the accessible roster even if there is no safe projected slot. */
export function layoutSceneLabels(items,{width,height}){
 const portrait=width<700,labelWidth=portrait?(items.filter(p=>p.visible&&p.kind==='person').length>2?88:132):128,labelHeight=44,placed=[];
 const visible=items.filter(p=>p.visible).sort((a,b)=>a.x-b.x||String(a.id).localeCompare(String(b.id)));
 for(const p of visible){
  const x=Math.max(labelWidth/2+8,Math.min(width-labelWidth/2-8,p.x*width)),base=p.y*height-22;
  let found=null;
  for(const offset of [0,-48,-96,-144,48]){
   const y=base+offset;if(y<labelHeight/2+72||y>height-150)continue;
   if(placed.some(q=>Math.abs(q.x-x)<(q.width+labelWidth)/2+6&&Math.abs(q.y-y)<labelHeight+4))continue;
   found={...p,x,y,width:labelWidth,height:labelHeight};break;
  }
  if(found){const dx=p.x*width-found.x,dy=p.y*height-(found.y+labelHeight/2);found.stemLength=Math.max(0,Math.hypot(dx,dy));found.stemAngle=-Math.atan2(dx,dy);placed.push(found);}
 }
 return placed;
}
