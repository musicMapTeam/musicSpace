// usage: node crop.cjs <in.png> <out.png> x y w h  (css px) [dpr]
const {PNG}=require('/tmp/space-video-prep/tools/node_modules/pngjs');const fs=require('fs');
const [,,inp,outp,x,y,w,h,dprArg]=process.argv;const src=PNG.sync.read(fs.readFileSync(inp));
const dpr=+(dprArg||1);const X=Math.round(x*dpr),Y=Math.round(y*dpr),W=Math.round(w*dpr),H=Math.round(h*dpr);
const out=new PNG({width:W,height:H});
for(let j=0;j<H;j++)for(let i=0;i<W;i++){const si=((Y+j)*src.width+(X+i))*4,di=(j*W+i)*4;for(let k=0;k<4;k++)out.data[di+k]=(Y+j<src.height&&X+i<src.width)?src.data[si+k]:0;}
fs.writeFileSync(outp,PNG.sync.write(out));console.log('wrote',outp,W,H);
