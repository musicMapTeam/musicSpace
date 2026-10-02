/**
 * ONE original, genuinely volumetric character study for Music Space.
 * Coordinate convention: +Y up, +Z face, soles on Y=0. No images or planes.
 * Source: code-authored sculpted lofts, closed ribbon volumes and swept ink.
 * Reference images are deliberately NOT imported or distributed by this module.
 *
 * createBenchmarkCharacter(THREE, { cel?, flat?, palette?, eyewear? })
 *   -> { root, dispose, metadata }
 * cel/flat take a material options object. The caller owns supplied materials.
 * palette overrides named colors (skin, hair, tee, shorts, canvas, sole, ink,
 * plus their explicit shade/accent keys). Base hair/skin/tee overrides derive
 * matching shade colors unless those are explicitly supplied. Defaults unchanged.
 * eyewear:false hides the complete glasses group; it does not change identity.
 */
export function createBenchmarkCharacter(THREE, materials = {}) {
  const root = new THREE.Group(); root.name = 'musicspace-editorial-benchmark';
  const geometries = new Set(), ownedMaterials = new Set(), textures = new Set();
  const DEFAULT_PALETTE = {
    ink: '#493024', skin: '#dfb78e', skinShade: '#c69473', cream: '#f2dfb9',
    tee: '#edddbb', teeShade: '#d5bd97', hair: '#e7d09c', hairShade: '#c3a477',
    hairLight: '#f1dfb7', shorts: '#4b4235', seam: '#73604a', canvas: '#61513e',
    sole: '#eee0bf', white: '#fbf0d8', rust: '#a86a49', sock: '#dfcca5',
  };
  const overrides=materials.palette||{};
  const P=Object.fromEntries(Object.entries(DEFAULT_PALETTE).map(([key,value])=>[key,overrides[key]??value]));
  const shade=(color,factor)=>`#${new THREE.Color(color).multiplyScalar(factor).getHexString()}`;
  if(overrides.hair!=null){if(overrides.hairShade==null)P.hairShade=shade(P.hair,.70);if(overrides.hairLight==null)P.hairLight=`#${new THREE.Color(P.hair).lerp(new THREE.Color('#f4e6c9'),.14).getHexString()}`;}
  if(overrides.skin!=null&&overrides.skinShade==null)P.skinShade=shade(P.skin,.72);
  if(overrides.tee!=null&&overrides.teeShade==null)P.teeShade=shade(P.tee,.76);
  let ramp;
  function material(key, unlit = false) {
    const color = P[key] || key;
    if (unlit && materials.flat) return materials.flat({ color });
    if (!unlit && materials.cel) return materials.cel({ color, bands: 'soft3', tint: '#b8a58b', flat: false });
    let m;
    if (unlit) m = new THREE.MeshBasicMaterial({ color });
    else {
      if (!ramp) {
        const data = new Uint8Array([172,172,172,255, 224,224,224,255, 255,255,255,255]);
        ramp = new THREE.DataTexture(data,3,1,THREE.RGBAFormat);
        ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
        textures.add(ramp);
      }
      m = new THREE.MeshToonMaterial({ color, gradientMap: ramp });
    }
    ownedMaterials.add(m); return m;
  }
  const M = Object.fromEntries(Object.keys(P).map(k => [k,material(k)]));
  M.line = material('ink', true); M.print = material('rust', true);
  const groups = {};
  for (const name of ['anatomy','head','hair','eyewear','top','bottom','shoes','accessories']) {
    const g = new THREE.Group(); g.name = name; groups[name] = g;
    if (!['hair','eyewear'].includes(name)) root.add(g);
  }
  groups.head.add(groups.hair, groups.eyewear);
  groups.eyewear.visible=materials.eyewear!==false;
  const v = p => new THREE.Vector3(...p);
  const add = (name, geometry, mat, parent) => {
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometries.add(geometry);
    const o = new THREE.Mesh(geometry, mat); o.name = name; o.castShadow = true; o.receiveShadow = true;
    o.userData.closedSurface = true; parent.add(o); return o;
  };
  function meshFrom(name, pos, idx, mat, parent) {
    // Consistent outward winding: signed volume can be checked without WebGL.
    let volume = 0;
    for (let n=0;n<idx.length;n+=3) {
      const a=idx[n]*3,b=idx[n+1]*3,c=idx[n+2]*3;
      volume += (pos[a]*(pos[b+1]*pos[c+2]-pos[b+2]*pos[c+1]) + pos[a+1]*(pos[b+2]*pos[c]-pos[b]*pos[c+2]) + pos[a+2]*(pos[b]*pos[c+1]-pos[b+1]*pos[c])) / 6;
    }
    if (volume < 0) for(let n=0;n<idx.length;n+=3) [idx[n+1],idx[n+2]]=[idx[n+2],idx[n+1]];
    const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx);
    return add(name,g,mat,parent);
  }
  // General Y-section loft. Deliberately shaped rings, not stacked primitives.
  function loft(name, rings, mat, parent, sides=32) {
    const pos=[], idx=[];
    rings.forEach(r => {
      for(let i=0;i<sides;i++) {
        const t=i/sides*Math.PI*2, c=Math.cos(t), s=Math.sin(t);
        const x=r.x+(r.rx*Math.sign(c)*Math.pow(Math.abs(c),r.square || 1));
        const depth=s>=0?(r.front??r.rz):(r.back??r.rz);
        const z=(r.z||0)+depth*Math.sign(s)*Math.pow(Math.abs(s),r.square || 1);
        const y=r.y+(r.tilt||0)*(x-r.x)+(r.wave||0)*Math.cos(t*2+.6)+(r.frontDrop||0)*Math.max(0,s);
        pos.push(x,y,z);
      }
    });
    for(let k=0;k<rings.length-1;k++) for(let i=0;i<sides;i++) {
      const a=k*sides+i,b=k*sides+(i+1)%sides,c=(k+1)*sides+i,d=(k+1)*sides+(i+1)%sides;
      idx.push(a,c,b,b,c,d);
    }
    for(const top of [false,true]) {
      const k=top?rings.length-1:0, center=pos.length/3, r=rings[k];
      let cx=0,cy=0,cz=0; for(let i=0;i<sides;i++){cx+=pos[(k*sides+i)*3];cy+=pos[(k*sides+i)*3+1];cz+=pos[(k*sides+i)*3+2];}
      pos.push(cx/sides,cy/sides,cz/sides);
      for(let i=0;i<sides;i++){const a=k*sides+i,b=k*sides+(i+1)%sides;idx.push(...(top?[center,b,a]:[center,a,b]));}
    }
    return meshFrom(name,pos,idx,mat,parent);
  }
  // Parallel-transport-ish cross-sections give limb and sleeve curves continuity.
  function sweep(name, points, radii, mat, parent, sides=12, closed=false) {
    const pos=[],idx=[],p=points.map(v);
    for(let k=0;k<p.length;k++) {
      const before=p[(k-1+p.length)%p.length], after=p[(k+1)%p.length];
      const tangent=closed?after.clone().sub(before).normalize():(k===0?p[1].clone().sub(p[0]):k===p.length-1?p[k].clone().sub(p[k-1]):after.clone().sub(before)).normalize();
      const anchor=Math.abs(tangent.z)<.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
      const u=anchor.clone().cross(tangent).normalize(),w=tangent.clone().cross(u).normalize();
      const rr=Array.isArray(radii[k])?radii[k]:[radii[k],radii[k]];
      for(let i=0;i<sides;i++){const t=i/sides*Math.PI*2;const q=p[k].clone().addScaledVector(u,rr[0]*Math.cos(t)).addScaledVector(w,rr[1]*Math.sin(t));pos.push(q.x,q.y,q.z);}
    }
    const count=closed?p.length:p.length-1;
    for(let k=0;k<count;k++)for(let i=0;i<sides;i++){
      const a=k*sides+i,b=k*sides+(i+1)%sides,c=((k+1)%p.length)*sides+i,d=((k+1)%p.length)*sides+(i+1)%sides; idx.push(a,b,c,b,d,c);
    }
    if(!closed)for(const end of [0,p.length-1]){const c=pos.length/3;pos.push(...p[end].toArray());for(let i=0;i<sides;i++){const a=end*sides+i,b=end*sides+(i+1)%sides;idx.push(...(end===0?[c,b,a]:[c,a,b]));}}
    return meshFrom(name,pos,idx,mat,parent);
  }
  function ink(name,points,radius,parent,closed=false,mat=M.line) {
    return sweep(name,points,points.map(()=>radius),mat,parent,7,closed);
  }
  // Closed front-and-back polygon with a sculpted central ridge; convex contours.
  function leaf(name, front, thickness, mat, parent, ridge=.015) {
    const n=front.length,pos=[],idx=[];
    let signedArea=0;front.forEach((p,i)=>{const q=front[(i+1)%n];signedArea+=p[0]*q[1]-q[0]*p[1];});
    const points=signedArea<0?[...front].reverse():front;
    const depths=points.map(p=>typeof thickness==='function'?thickness(p):thickness);
    points.forEach(p=>pos.push(...p));points.forEach((p,i)=>pos.push(p[0],p[1],p[2]-depths[i]));
    const center=points.reduce((a,p)=>a.map((x,i)=>x+p[i]/n),[0,0,0]);
    const centerDepth=depths.reduce((a,b)=>a+b,0)/n;
    pos.push(center[0],center[1],center[2]+ridge,center[0],center[1],center[2]-centerDepth);
    for(let i=0;i<n;i++){const j=(i+1)%n;idx.push(2*n,i,j, 2*n+1,n+j,n+i, i,n+i,j, j,n+i,n+j);}
    return meshFrom(name,pos,idx,mat,parent);
  }
  function ellipse(name,at,radii,mat,parent,segments=20,rings=12) {
    const g=new THREE.SphereGeometry(1,segments,rings); const o=add(name,g,mat,parent);o.position.set(...at);o.scale.set(...radii);return o;
  }
  function ringInk(name,r,parent) {
    const points=Array.from({length:40},(_,i)=>{const t=i/40*Math.PI*2;return[r.x+r.rx*Math.cos(t),r.y+(r.tilt||0)*r.rx*Math.cos(t)+(r.wave||0)*Math.cos(t*2+.6)+(r.frontDrop||0)*Math.max(0,Math.sin(t)),(r.z||0)+(r.rz||.27)*Math.sin(t)];});
    return ink(name,points,.010,parent,true);
  }

  // Weight over right foot; left knee softened and foot turned slightly out.
  sweep('right-weight-leg', [[.24,2.51,-.015],[.27,2.34,.006],[.28,2.04,.030],[.26,1.65,.032],[.25,1.44,.006],[.27,1.16,-.018],[.26,.80,-.018],[.23,.40,.008]], [[.155,.14],[.15,.134],[.123,.11],[.097,.10],[.100,.104],[.096,.088],[.078,.074],[.077,.074]],M.skin,groups.anatomy,20);
  sweep('left-resting-leg', [[-.22,2.49,.006],[-.27,2.24,.025],[-.35,1.99,.045],[-.42,1.66,.083],[-.47,1.45,.081],[-.55,1.13,.028],[-.63,.77,.008],[-.69,.40,.060]], [[.154,.14],[.143,.125],[.122,.110],[.097,.096],[.096,.10],[.092,.085],[.078,.073],[.073,.072]],M.skin,groups.anatomy,20);
  // Ink only on a few expressive anatomical landmarks, not every triangle.
  ink('left-knee-mark',[[-.49,1.56,.161],[-.44,1.55,.168],[-.41,1.50,.158]],.007,groups.anatomy,false,M.seam);
  sweep('neck', [[-.065,3.97,-.015],[-.079,4.18,-.013],[-.094,4.36,-.004]], [[.166,.145],[.15,.14],[.19,.16]],M.skin,groups.anatomy,24);

  // Tailored shorts: one rounded hip volume and two angled, shaped leg openings.
  loft('shorts-seat',[
    {y:2.48,x:.04,rx:.39,rz:.235,tilt:-.08,square:.85},
    {y:2.62,x:.04,rx:.46,rz:.255,tilt:-.08,square:.85},
    {y:2.83,x:.04,rx:.455,rz:.255,tilt:-.08,square:.82},
    {y:2.99,x:.025,rx:.40,rz:.215,tilt:-.06,square:.82},
  ],M.shorts,groups.bottom);
  sweep('shorts-left-leg',[[-.215,2.76,0],[-.25,2.54,.012],[-.29,2.29,.020]],[[.237,.25],[.228,.255],[.225,.232]],M.shorts,groups.bottom,24);
  sweep('shorts-right-leg',[[.26,2.76,-.016],[.29,2.52,.0],[.29,2.27,.009]],[[.22,.247],[.22,.244],[.211,.228]],M.shorts,groups.bottom,24);
  ink('shorts-fly',[[.035,2.96,.237],[.069,2.76,.266],[.07,2.55,.263]],.008,groups.bottom,false,M.seam);
  ink('pocket-left-opening',[[-.34,2.85,.225],[-.405,2.72,.23],[-.453,2.63,.17]],.014,groups.bottom);
  ink('right-pocket-seam',[[.35,2.85,.225],[.385,2.70,.23],[.456,2.57,.16]],.010,groups.bottom,false,M.seam);
  ink('back-pocket',[[.13,2.82,-.271],[.32,2.80,-.270],[.33,2.58,-.249],[.20,2.53,-.249],[.13,2.59,-.26],[.13,2.82,-.271]],.010,groups.bottom,false,M.seam);

  // Asymmetric, soft tee. The lower rings contain a real lifted/tucked hem.
  const hem={y:2.93,x:.025,rx:.447,rz:.263,tilt:-.16,wave:.035,frontDrop:.055};
  // A single curved closed shirt surface owns both shoulders and sleeves.
  // Its front/back panels share one outline and welded subdivision vertices;
  // there are no intersecting shoulder caps or separately shaded sleeve shells.
  let shirtSurfaceZ;
  const shirtOutline=[
    [-.46,2.965],[-.462,3.20],[-.465,3.49],[-.474,3.515],
    [-.904,3.48],[-.871,3.655],[-.783,3.848],[-.62,3.982],[-.39,4.064],
    [-.22,4.088],[-.055,4.045],[.13,4.075],[.35,4.00],[.55,3.89],
    [.718,3.70],[.814,3.427],[.414,3.39],[.408,3.45],[.465,3.22],[.464,2.91],
    [.27,2.927],[.03,2.985],[-.22,2.957],
  ];
  {
    let outline=shirtOutline.map(p=>new THREE.Vector2(...p));
    if(THREE.ShapeUtils.isClockWise(outline))outline.reverse();
    const initial=THREE.ShapeUtils.triangulateShape(outline,[]),verts=outline.map(p=>[p.x,p.y]),lookup=new Map(verts.map((p,i)=>[p.map(n=>n.toFixed(8)).join(','),i]));
    let triangles=initial;
    const mid=(a,b)=>{const q=[(verts[a][0]+verts[b][0])*.5,(verts[a][1]+verts[b][1])*.5],key=q.map(n=>n.toFixed(8)).join(',');if(!lookup.has(key)){lookup.set(key,verts.length);verts.push(q);}return lookup.get(key);};
    for(let level=0;level<3;level++) {
      const next=[];for(const [a,b,c] of triangles){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);}triangles=next;
    }
    const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p[0]-a.x)*dx+(p[1]-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a.x-t*dx,p[1]-a.y-t*dy);};
    const zAt=(x,y,back=false)=> {
      const dist=Math.min(...outline.map((a,i)=>distance([x,y],a,outline[(i+1)%outline.length])));
      const dome=Math.sin(Math.min(1,dist/.24)*Math.PI*.5);
      const torso=x>-.45&&x<.425;
      const drape=Math.max(0,Math.min(1,(3.28-y)/.28));
      return back ? (-.127+.067*drape)-(.119+.067*drape)*dome : (.139-.073*drape)+(.130+.073*drape)*dome+(torso?.012*Math.sin((y-2.9)*4.7):0);
    };
    shirtSurfaceZ=zAt;
    const pos=[],indices=[],n=verts.length;
    for(const back of [false,true])for(const [x,y] of verts)pos.push(x,y,zAt(x,y,back));
    const edgeCounts=new Map();
    for(const [a,b,c] of triangles){indices.push(a,b,c,n+c,n+b,n+a);for(const [u,v]of[[a,b],[b,c],[c,a]]){const key=u<v?`${u}:${v}`:`${v}:${u}`;if(!edgeCounts.has(key))edgeCounts.set(key,{a:u,b:v,count:0});edgeCounts.get(key).count++;}}
    for(const {a,b,count}of edgeCounts.values())if(count===1)indices.push(a,n+a,b,b,n+a,n+b);
    meshFrom('tee-continuous-body-and-sleeves',pos,indices,M.tee,groups.top);
    // The cuff follows the single panel's front, thickness, and back edge.
    for(const [name,a,b]of[['left',[-.904,3.48],[-.474,3.515]],['right',[.814,3.427],[.414,3.39]]]){
      const points=[];for(let i=0;i<=10;i++){const t=i/10,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;points.push([x,y,zAt(x,y)+.006]);}
      for(let i=10;i>=0;i--){const t=i/10,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;points.push([x,y,zAt(x,y,true)-.005]);}
      ink(`tee-${name}-cuff`,points,.010,groups.top,true);
    }
  }
  ink('tee-wavy-hem',[[-.459,2.968],[-.22,2.965],[.03,2.993],[.27,2.935],[.463,2.918]].map(([x,y])=>[x,y,shirtSurfaceZ(x,y)+.005]),.006,groups.top);
  // Collar is an actual small oval volume around a narrow anatomical neck.
  const collarPts=Array.from({length:40},(_,i)=>{const t=i/40*Math.PI*2;return[-.065+.193*Math.cos(t),4.064-.068*Math.max(0,Math.sin(t)),.159*Math.sin(t)];});
  sweep('tee-collar-binding',collarPts,collarPts.map(()=>[.027,.024]),M.teeShade,groups.top,8,true);
  ink('tee-collar-ink',collarPts.map(p=>[p[0],p[1]+.012,p[2]+.003]),.009,groups.top,true);
  ink('tee-left-crease',[[-.31,3.46],[-.36,3.26],[-.31,3.09]].map(([x,y])=>[x,y,shirtSurfaceZ(x,y)+.008]),.007,groups.top,false,M.teeShade);
  ink('tee-hem-fold',[[.05,3.07],[.19,3.13],[.34,3.11]].map(([x,y])=>[x,y,shirtSurfaceZ(x,y)+.007]),.007,groups.top,false,M.teeShade);
  ink('tee-back-collar-seam',[[-.22,4.06,-.149],[-.09,4.065,-.163],[.07,4.044,-.156]],.007,groups.top,false,M.teeShade);
  // Original restrained 2×3 gig-dot print, six tiny actual disks on the cloth.
  for(let i=0;i<6;i++) {
    const x=-.135+(i%3)*.075,y=3.67-Math.floor(i/3)*.075,z=shirtSurfaceZ(x,y)+.006;
    ellipse(`tee-print-${i}`,[x,y,z],[.027,.027,.006],M.print,groups.top,12,8);
  }

  // Arms emerge from inside the sleeve volume, with a soft elbow (not 90°).
  sweep('left-pocket-arm',[[-.69,3.53,.045],[-.72,3.35,.048],[-.74,3.21,.061],[-.71,3.09,.10],[-.60,2.96,.165],[-.47,2.80,.19]],[[.10,.088],[.09,.082],[.092,.084],[.084,.079],[.074,.065],[.070,.061]],M.skin,groups.anatomy,18);
  // Hand is mostly covered by the pocket, with a distinct bent thumb.
  sweep('pocket-hand',[[-.47,2.82,.192],[-.405,2.75,.191],[-.378,2.70,.176]],[[.072,.039],[.065,.035],[.040,.022]],M.skin,groups.anatomy,14);
  sweep('pocket-thumb',[[-.485,2.81,.232],[-.452,2.765,.251],[-.407,2.786,.243]],[[.026,.027],[.025,.023],[.012,.013]],M.skin,groups.anatomy,10);
  sweep('right-hanging-arm',[[.65,3.48,.04],[.68,3.29,.061],[.69,3.09,.084],[.70,2.91,.092],[.72,2.73,.09]],[[.097,.086],[.09,.080],[.085,.078],[.074,.068],[.064,.058]],M.skin,groups.anatomy,18);
  sweep('right-relaxed-hand',[[.72,2.76,.09],[.73,2.66,.095],[.72,2.55,.119],[.704,2.49,.12]],[[.064,.052],[.077,.043],[.073,.035],[.042,.024]],M.skin,groups.anatomy,16);
  sweep('right-thumb',[[.66,2.67,.12],[.625,2.61,.151],[.64,2.557,.16]],[[.031,.025],[.026,.025],[.014,.016]],M.skin,groups.anatomy,10);
  ink('right-fingers',[[.74,2.62,.141],[.75,2.55,.153],[.727,2.50,.14]],.006,groups.anatomy,false,M.seam);
  ink('right-inner-finger',[[.711,2.61,.147],[.705,2.53,.157]],.005,groups.anatomy,false,M.seam);

  // Canvas sneakers: foot-shaped closed sections, low soles and curved toe caps.
  function shoe(label,x,z,yaw) {
    const g=new THREE.Group();g.name=`${label}-canvas-sneaker`;g.position.set(x,0,z);g.rotation.y=yaw;groups.shoes.add(g);
    // Oval sections shift forward toward the toe and narrow toward the ankle.
    const sole=[{y:.035,x:0,z:.12,rx:.18,front:.425,back:.25,square:.75},{y:.07,x:0,z:.12,rx:.187,front:.426,back:.259,square:.75},{y:.145,x:0,z:.12,rx:.179,front:.410,back:.25,square:.78}];
    loft(`${label}-rubber-sole`,sole,M.sole,g,32);
    loft(`${label}-canvas-upper`,[
      {y:.13,x:0,z:.085,rx:.177,front:.42,back:.223,square:.84},
      {y:.23,x:0,z:.071,rx:.17,front:.398,back:.214,square:.88},
      {y:.32,x:0,z:.005,rx:.145,front:.295,back:.178,square:.9},
      {y:.43,x:0,z:-.033,rx:.124,front:.183,back:.131,square:.92},
      {y:.48,x:0,z:-.05,rx:.119,front:.149,back:.117,square:.92},
    ],M.canvas,g,32);
    // Toe shell is a genuine closed lifted volume wrapping around the canvas.
    loft(`${label}-toe-cap`,[
      {y:.141,x:0,z:.360,rx:.159,front:.163,back:.115,square:.85},
      {y:.205,x:0,z:.348,rx:.161,front:.163,back:.114,square:.88},
      {y:.27,x:0,z:.321,rx:.137,front:.150,back:.090,square:.93},
      {y:.295,x:0,z:.3,rx:.084,front:.100,back:.052,square:1},
    ],M.sole,g,28);
    ringInk(`${label}-sole-stripe`,{y:.083,x:0,z:.12,rx:.187,rz:.332},g);
    // Small visible sock cuff above high-top canvas.
    loft(`${label}-sock`,[{y:.435,x:0,z:-.039,rx:.077,rz:.075},{y:.51,x:0,z:-.031,rx:.08,rz:.076},{y:.575,x:0,z:-.022,rx:.078,rz:.074}],M.sock,g,20);
    ink(`${label}-sock-top`,Array.from({length:28},(_,i)=>{const a=i/28*Math.PI*2;return[.08*Math.cos(a),.562,-.022+.076*Math.sin(a)];}),.006,g,true,M.seam);
    // Laces sit on the sloped vamp, not on a billboard.
    for(let i=0;i<3;i++) {
      const zz=.245-i*.076,yy=.305+i*.046;
      ink(`${label}-lace-${i}`,[[-.083,yy,zz],[0,yy+.015,zz+.005],[.083,yy,zz]],.014,g,false,M.sole);
    }
    for(const s of [-1,1]) ink(`${label}-vamp-seam-${s}`,[[s*.124,.235,.29],[s*.119,.335,.115],[s*.105,.447,-.015]],.006,g,false,M.teeShade);
  }
  shoe('left',-.69,.09,-.15);shoe('right',.23,.035,.11);

  // Slight head tilt and yaw remain real in all viewpoints.
  groups.head.position.set(-.092,4.65,-.006);
  groups.head.rotation.set(.025,-.045,-.075);
  groups.head.scale.set(1.075,1.045,1.0);
  groups.top.scale.x=.935;
  const H=groups.head;
  loft('angular-cheek-jaw-skull',[
    {y:-.395,x:0,rx:.135,front:.198,back:.19,z:.045,square:.92},
    {y:-.335,x:0,rx:.31,front:.279,back:.27,z:.031,square:.89},
    {y:-.21,x:0,rx:.465,front:.348,back:.355,z:.002,square:.87},
    {y:-.04,x:0,rx:.575,front:.406,back:.415,z:0,square:.91},
    {y:.18,x:0,rx:.612,front:.438,back:.437,z:-.012,square:.94},
    {y:.42,x:-.018,rx:.598,front:.402,back:.435,z:-.031,square:.97},
    {y:.63,x:-.035,rx:.492,front:.319,back:.36,z:-.036,square:1},
    {y:.755,x:-.041,rx:.275,front:.18,back:.225,z:-.038,square:1},
    {y:.80,x:-.045,rx:.065,front:.042,back:.06,z:-.04},
  ],M.skin,H,48);
  for(const s of [-1,1]) {
    ellipse(`ear-${s}`,[s*.582,.015,-.015],[.12,.17,.087],M.skin,H,24,16);
    ink(`ear-fold-${s}`,[[s*.604,.09,.067],[s*.633,.073,.072],[s*.642,.001,.068],[s*.613,-.041,.067]],.010,H,false,M.skinShade);
  }
  // Face attachments follow the curved cheek surface. Front depth is not flat.
  const faceZ=(x,y)=> {
    const ry=.44-Math.max(0,-y)*.32, rx=.615-Math.max(0,-y)*.29;
    return -.009+ry*Math.sqrt(Math.max(.03,1-Math.pow(Math.abs(x)/rx,2)))+.020;
  };
  const patch=(name,points,mat,thick=.009,offset=.012)=>leaf(name,points.map(([x,y])=>[x,y,faceZ(x,y)+offset]),thick,mat,H,.000);
  for(const side of [-1,1]) {
    const cx=side*.290,cy=.078;
    const local=[[-.198,.057],[-.105,.055],[.001,.037],[.105,.019],[.191,.006],[.159,-.089],[.071,-.137],[-.04,-.140],[-.135,-.112],[-.185,-.053]];
    const eye=local.map(([x,y])=>[cx+x,cy+y+side*x*.14]);
    patch(`half-lidded-eye-white-${side}`,eye,M.white,.008,.016);
    // Narrow dark iris, upper portion intentionally clipped by heavy upper lid.
    const ix=cx-side*.035,iy=cy-.021;
    const iris=[[-.079,.047],[.073,.031],[.075,-.031],[.052,-.076],[.012,-.092],[-.029,-.083],[-.066,-.050]];
    patch(`iris-${side}`,iris.map(([x,y])=>[ix+x,iy+y]),M.line,.006,.029);
    ink(`upper-eyelid-${side}`,[[-.196,.060],[-.11,.056],[.007,.038],[.12,.017],[.193,.005]].map(([x,y])=>[cx+x,cy+y+side*x*.14,faceZ(cx+x,cy+y)+.035]),.017,H);
    ink(`lower-eyelid-${side}`,[[-.174,-.055],[-.13,-.107],[-.025,-.14],[.076,-.133],[.143,-.095]].map(([x,y])=>[cx+x,cy+y+side*x*.14,faceZ(cx+x,cy+y)+.030]),.009,H);
    ink(`calm-eyebrow-${side}`,[[cx-.17,.265+side*.015],[cx-.055,.26],[cx+.087,.232],[cx+.166,.202]].map(([x,y])=>[x,y,faceZ(x,y)+.018]),.019,H);
  }
  // A subtle wedge nose reads in profile and casts its own small shadow.
  leaf('sculpted-nose', [[-.048,.008,.442],[-.040,-.063,.467],[.016,-.099,.494],[.064,-.065,.461],[.026,.035,.443]],.086,M.skin,H,.010);
  ink('nose-underside',[[-.038,-.083,.471],[.005,-.099,.491],[.041,-.083,.476]],.011,H);
  ink('quiet-mouth',[[-.075,-.231,.354],[-.014,-.246,.367],[.052,-.238,.361]],.010,H);
  ink('lower-lip',[[-.016,-.275,.355],[.029,-.270,.354]],.006,H,false,M.skinShade);

  // Thick geometric frames with substantial temples reaching both ears.
  const glasses=groups.eyewear;
  function lens(side) {
    const cx=side*.309,cy=.065;
    const shape=[[-.238,.157],[-.122,.170],[.118,.133],[.228,.099],[.211,-.055],[.166,-.153],[.068,-.188],[-.073,-.175],[-.190,-.127],[-.227,-.012]];
    const points=shape.map(([x,y])=>[cx+x,cy+y,faceZ(cx+x,cy+y)+.103]);
    sweep(`thick-frame-${side}`,points,points.map(()=>[.027,.030]),M.line,glasses,10,true);
    const end=points[side===1?3:0];
    ink(`glasses-temple-${side}`,[[side*.532,.169,faceZ(side*.532,.17)+.101],[side*.646,.158,.168],[side*.647,.101,-.017],[side*.619,.034,-.093]],.028,glasses);
    ellipse(`frame-hinge-${side}`,[side*.54,.168,faceZ(side*.54,.168)+.10],[.033,.031,.016],M.rust,glasses,12,8);
  }
  lens(-1);lens(1);
  ink('glasses-arched-bridge',[[-.077,.093,.543],[-.039,.13,.557],[.010,.143,.559],[.050,.124,.554],[.079,.098,.539]],.025,glasses);

  // Solid asymmetrical bob: sculpted cap plus genuinely thick tapered locks.
  const hair=groups.hair;
  // One coherent thin shell with a designed nape contour. No stacked rear lobes.
  const hairShellPoint=(t,p,inner=false)=> {
    const c=Math.cos(t),sn=Math.sin(t),front=Math.max(0,sn);
    const tt=(t+Math.PI*2)%(Math.PI*2);
    const cuts=[[Math.PI,-.38],[1.17*Math.PI,-.53],[1.285*Math.PI,-.335],[1.54*Math.PI,-.37],[1.635*Math.PI,-.49],[1.75*Math.PI,-.315],[2*Math.PI,-.35]];
    let nape=-.365-.02*c;
    if(tt>=Math.PI){for(let i=0;i<cuts.length-1;i++)if(tt>=cuts[i][0]&&tt<=cuts[i+1][0]){const f=(tt-cuts[i][0])/(cuts[i+1][0]-cuts[i][0]);nape=cuts[i][1]*(1-f)+cuts[i+1][1]*f;break;}}
    const edge=nape+(front>0?Math.pow(front,.75)*(.51-nape):0);
    const ys=[edge,Math.max(edge+.035,.11),Math.max(edge+.085,.38),.641,.802,.873];
    const widths=[.635,.685,.679,.553,.344,.045];
    const depths=[.45,.490,.476,.379,.226,.034];
    const u=p*5,k=Math.min(4,Math.floor(u)),f=u-k;
    const y=ys[k]*(1-f)+ys[k+1]*f,rx=widths[k]*(1-f)+widths[k+1]*f,rz=depths[k]*(1-f)+depths[k+1]*f;
    const shell=Math.min(1,p*4),shrink=inner?(.968-.083*shell):1;
    return[-.024+rx*c*shrink,y-(inner?(.012+.040*shell):0),-.07+rz*sn*shrink];
  };
  {
    const pos=[],idx=[],sides=64,rows=11,layerSize=sides*rows;
    for(const inner of[false,true])for(let r=0;r<rows;r++)for(let i=0;i<sides;i++)pos.push(...hairShellPoint(i/sides*Math.PI*2,r/(rows-1),inner));
    for(let layer=0;layer<2;layer++)for(let r=0;r<rows-1;r++)for(let i=0;i<sides;i++){
      const a=layer*layerSize+r*sides+i,b=layer*layerSize+r*sides+(i+1)%sides,c=a+sides,d=b+sides;
      idx.push(...(layer===0?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
    }
    for(let i=0;i<sides;i++){const a=i,b=(i+1)%sides,c=layerSize+i,d=layerSize+(i+1)%sides;idx.push(a,b,c,b,d,c);}
    for(let layer=0;layer<2;layer++){
      const center=pos.length/3;pos.push(-.024,.884-(layer?.052:0),-.07);
      for(let i=0;i<sides;i++){const a=layer*layerSize+(rows-1)*sides+i,b=layer*layerSize+(rows-1)*sides+(i+1)%sides;idx.push(...(layer===0?[center,b,a]:[center,a,b]));}
    }
    meshFrom('hair-coherent-thin-shell',pos,idx,M.hair,hair);
    // Back hair stays a continuous cream mass. Its own real silhouette supplies
    // the edge: no dark seam tubes around the nape or across the back of the cap.
  }
  const locks=[
    // Front fringe flows in asymmetric large graphic sections; generous open eyes.
    ['left-swept-fringe',[[-.59,.59,.244],[-.42,.82,.26],[-.25,.68,.375],[-.45,.12,.458],[-.48,.34,.44]],.17,M.hairLight],
    ['center-long-fringe',[[-.36,.79,.282],[-.07,.86,.247],[.074,.14,.488],[-.124,.38,.479],[-.238,.63,.393]],.19,M.hair],
    ['center-short-fringe',[[-.082,.848,.284],[.192,.769,.255],[.261,.321,.471],[.068,.442,.492]],.17,M.hairLight],
    ['right-slant-fringe',[[.147,.809,.258],[.466,.651,.242],[.525,.278,.380],[.575,.072,.318],[.353,.268,.460]],.19,M.hair],
    ['left-face-lock',[[-.586,.535,.246],[-.421,.453,.385],[-.575,-.443,.075],[-.696,-.232,.044],[-.748,-.367,-.042],[-.749,.028,.092]],.215,M.hair],
    ['right-jaw-lock',[[.574,.48,.212],[.693,.249,.077],[.773,-.418,-.116],[.595,-.252,.008],[.554,-.518,-.044],[.487,.024,.113]],.22,M.hair],
    ['right-long-lock',[[.638,.146,-.14],[.714,.025,-.19],[.764,-.656,-.235],[.638,-.378,-.14]],.20,M.hairShade],
    ['left-back-lock',[[-.666,.14,-.185],[-.728,-.056,-.278],[-.665,-.702,-.208],[-.484,-.238,-.125]],.215,M.hairShade],
    ['crown-flick',[[-.455,.787,-.005],[-.22,1.076,-.105],[-.088,.859,.025],[.366,.743,.174]],.20,M.hairLight],
    ['right-crown-tip',[[.174,.849,-.059],[.478,.729,-.065],[.728,.516,-.081],[.471,.563,.142]],.17,M.hair],
  ];
  for(const [name,points,depth,mat] of locks) {
    const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
    const taperedDepth=p=>depth*(.16+.84*Math.pow(Math.max(0,(p[1]-minY)/(maxY-minY)),.55));
    leaf(`hair-${name}`,points,taperedDepth,mat,hair,.022);
    // Selective outer/front boundaries, economical ink, not a triangle wireframe.
    if(['left-swept-fringe','center-long-fringe','center-short-fringe','right-slant-fringe','left-face-lock','right-jaw-lock','crown-flick','right-long-lock'].includes(name))
      ink(`hair-ink-${name}`,points.map(p=>[p[0],p[1],p[2]+.007]),.012,hair,true);
  }
  // Tiny restrained accessory, still a mesh: an enamel gig pin on the sleeve.
  ellipse('rust-gig-pin',[.659,3.626,shirtSurfaceZ(.705,3.626)+.008],[.028,.031,.01],M.rust,groups.accessories,14,10);
  root.scale.setScalar(.525);
  root.updateMatrixWorld(true);
  // Align exact measured minimum with the floor, independent of shoe cap details.
  let bounds = new THREE.Box3().setFromObject(root);
  root.position.y-=bounds.min.y;root.updateMatrixWorld(true);bounds=new THREE.Box3().setFromObject(root);
  const size=bounds.getSize(new THREE.Vector3());
  let vertices=0,triangles=0,meshes=0; root.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  const metadata={
    id:'cream-tee-editorial-01', revision:4, authored:'2026-09-30', geometry:'closed procedural 3D surfaces; no texture or plane assets',
    coordinateSystem:'+Y up / +Z front / soles on y=0', groups:Object.keys(groups),
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:size.toArray()}, meshes,vertices,triangles,
    appearance:{palette:{...P},eyewear:groups.eyewear.visible},
    artIntent:'Asymmetrical angular bob, large heavy glasses, half-lidded eyes, dropped cream tee, dark tailored shorts, long thin legs, relaxed contrapposto; original indie-comic character study.',
    validation:'Geometry statistics only. Art fidelity and intersections require front / three-quarter / side / back GPU review.',
  };
  root.userData.benchmark=metadata;
  return {root,metadata,dispose(){geometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
