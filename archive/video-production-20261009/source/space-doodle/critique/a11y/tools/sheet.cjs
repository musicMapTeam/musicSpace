// contact sheet: node sheet.cjs out.png scale cols file1 file2 ...
const {PNG}=require('/tmp/space-video-prep/tools/node_modules/pngjs');const fs=require('fs');
const [,,out,scaleArg,colsArg,...files]=process.argv;const scale=+scaleArg,cols=+colsArg;
const imgs=files.map(f=>PNG.sync.read(fs.readFileSync(f)));
const cw=Math.max(...imgs.map(i=>Math.round(i.width*scale))),ch=Math.max(...imgs.map(i=>Math.round(i.height*scale)));
const rows=Math.ceil(imgs.length/cols);const W=cw*cols+8*(cols+1),H=ch*rows+8*(rows+1);
const o=new PNG({width:W,height:H});o.data.fill(255);
imgs.forEach((im,k)=>{const ox=8+(k%cols)*(cw+8),oy=8+Math.floor(k/cols)*(ch+8);const w=Math.round(im.width*scale),h=Math.round(im.height*scale);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(im.width-1,Math.floor(x/scale)),sy=Math.min(im.height-1,Math.floor(y/scale));const si=(sy*im.width+sx)*4,di=((oy+y)*W+(ox+x))*4;o.data[di]=im.data[si];o.data[di+1]=im.data[si+1];o.data[di+2]=im.data[si+2];o.data[di+3]=255;}});
fs.writeFileSync(out,PNG.sync.write(o));console.log('wrote',out,W,H);
