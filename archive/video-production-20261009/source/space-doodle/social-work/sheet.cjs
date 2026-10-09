// node sheet.cjs out.png width cols file1 file2 ...
const {chromium}=require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs=require('fs');
(async()=>{const [,,out,w,cols,...files]=process.argv;const W=+w,C=+cols;
const html=`<html><body style="margin:0;background:#fff;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(${C},${W}px);gap:8px;padding:8px">${files.map(f=>`<figure style="margin:0"><figcaption>${f.split('/').pop()}</figcaption><img style="width:${W}px;display:block;border:1px solid #000" src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"></figure>`).join('')}</div></body></html>`;
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const p=await b.newPage({viewport:{width:C*(W+8)+8,height:400}});await p.setContent(html);await p.waitForTimeout(300);await p.screenshot({path:out,fullPage:true});await b.close();})();
