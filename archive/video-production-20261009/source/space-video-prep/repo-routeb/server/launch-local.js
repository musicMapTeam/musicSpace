import {mkdir,readFile,readdir,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const portValue=value=>{const n=Number(value);if(!Number.isInteger(n)||n<1024||n>65535)throw Error('本机端口设置无效，请保留 data 文件夹后检查设置。');return n;};
export async function localLaunchPlan({dataDir,requestedPort}={}){
 dataDir=resolve(dataDir||fileURLToPath(new URL('../data',import.meta.url)));await mkdir(dataDir,{recursive:true});
 const preference=resolve(dataDir,'local-address.json'),pending=resolve(dataDir,'local-address-pending.json');let saved;
 try{saved=JSON.parse(await readFile(preference,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('无法读取已保存的演示地址，不会自动换端口。');}
 if(saved){if(saved.version!==1||saved.host!=='127.0.0.1')throw Error('已保存的演示地址格式不受支持。');const port=portValue(saved.port);if(requestedPort!==undefined&&portValue(requestedPort)!==port)throw Error(`这个实例固定使用端口 ${port}，不会静默换地址而丢失浏览器身份。`);return {dataDir,port,autoPort:false,preference,pending};}
 const files=await readdir(dataDir),fresh=files.length===0||files.includes('local-address-pending.json');
 if(fresh)await writeFile(pending,JSON.stringify({version:1,state:'not-bound'}));
 return {dataDir,port:requestedPort===undefined?8787:portValue(requestedPort),autoPort:fresh&&requestedPort===undefined,preference,pending};
}
export async function rememberBoundAddress(plan,address){
 if(address?.address!=='127.0.0.1')throw Error('演示服务没有绑定到预期的本机地址。');
 const port=portValue(address.port),next={version:1,host:'127.0.0.1',port};
 try{await writeFile(plan.preference,JSON.stringify(next,null,2)+'\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;const saved=JSON.parse(await readFile(plan.preference,'utf8'));if(saved.host!==next.host||saved.port!==port)throw Error('另一次启动已经记住了不同地址，本次服务已停止。');}
 await unlink(plan.pending).catch(e=>{if(e.code!=='ENOENT')throw e;});return port;
}
async function main(){
 const plan=await localLaunchPlan({dataDir:process.env.DATA_DIR,requestedPort:process.env.PORT});
 process.env.HOST='127.0.0.1';process.env.PORT=String(plan.port);process.env.DATA_DIR=plan.dataDir;
 process.env.MUSIC_SPACE_TRY_NEXT_LOCAL_PORT=plan.autoPort?'1':'0';process.env.MUSIC_SPACE_LOCAL_LAUNCH='1';
 const service=await import('./index.js');const address=await service.serverReady;
 try{const port=await rememberBoundAddress(plan,address);console.log(`\nMusic Space 已启动： http://127.0.0.1:${port}/event-room/\n保留这个窗口。Ctrl+C 停止本次服务；下次会使用同一个地址。\n`);}
 catch(error){await service.stopLocalService();throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))void main().catch(error=>{console.error('Music Space 未能启动：'+error.message);process.exitCode=1;});
