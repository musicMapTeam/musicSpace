import { removeTempAfterTests } from './helpers/temp-directory.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {localLaunchPlan,rememberBoundAddress} from '../server/launch-local.js';
const delay=n=>new Promise(r=>setTimeout(r,n));
async function temp(t){const dir=await mkdtemp(join(tmpdir(),'space-launch-'));t.after(()=>removeTempAfterTests(dir));return dir;}
function child(dataDir){const env={...process.env,DATA_DIR:dataDir};delete env.PORT;delete env.HOST;const p=spawn(process.execPath,[fileURLToPath(new URL('../server/launch-local.js',import.meta.url))],{env,stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);return {p,get out(){return out;},get err(){return err;}};}
async function waitUntil(check){for(let i=0;i<100;i++){const result=await check();if(result)return result;await delay(30);}throw Error('startup check did not settle');}
async function stop(p){if(p.exitCode!==null||p.signalCode!==null)return;const done=once(p,'exit');p.kill('SIGTERM');await done;}
async function blocker(port){const s=createServer((_,r)=>r.end('owned-test-blocker'));const outcome=new Promise((resolve,reject)=>{s.once('listening',()=>resolve(s));s.once('error',reject);});s.listen(port,'127.0.0.1');return outcome;}
const close=s=>new Promise(resolve=>{s.closeAllConnections();s.close(resolve);});

test('fresh launch may select a free port, but a remembered or legacy instance stays at its origin',async t=>{
 const dir=await temp(t),fresh=await localLaunchPlan({dataDir:dir});assert.equal(fresh.autoPort,true);assert.equal(fresh.port,8787);
 await rememberBoundAddress(fresh,{address:'127.0.0.1',port:8798});const known=await localLaunchPlan({dataDir:dir});assert.equal(known.autoPort,false);assert.equal(known.port,8798);
 await assert.rejects(localLaunchPlan({dataDir:dir,requestedPort:8799}),/不会静默换地址/);
 const legacy=await temp(t);await writeFile(join(legacy,'existing-record.txt'),'synthetic existing record');const old=await localLaunchPlan({dataDir:legacy});assert.equal(old.autoPort,false);assert.equal(old.port,8787);
});

test('a confirmed local bind is required before an address is remembered',async t=>{
 const dir=await temp(t),plan=await localLaunchPlan({dataDir:dir});await assert.rejects(rememberBoundAddress(plan,{address:'0.0.0.0',port:8787}),/本机地址/);await assert.rejects(readFile(plan.preference),e=>e.code==='ENOENT');
});

test('actual occupied first port is skipped once for a new instance; later occupation fails without killing its owner',async t=>{
 const dir=await temp(t);let firstBlocker;
 try{firstBlocker=await blocker(8787);}catch(e){if(e.code!=='EADDRINUSE')throw e;}
 if(firstBlocker)t.after(()=>close(firstBlocker));
 const first=child(dir);t.after(()=>stop(first.p));
 const chosen=await waitUntil(async()=>{if(first.p.exitCode!==null)throw Error(first.err);const m=first.out.match(/http:\/\/127\.0\.0\.1:(\d+)\/event-room\//);return m&&Number(m[1]);});
 assert.ok(chosen>8787&&chosen<=8817);const saved=JSON.parse(await readFile(join(dir,'local-address.json'),'utf8'));assert.equal(saved.port,chosen);assert.equal((await fetch(`http://127.0.0.1:${chosen}/api/event/chats`)).status,401);
 if(firstBlocker)assert.equal(await (await fetch('http://127.0.0.1:8787/')).text(),'owned-test-blocker');
 await stop(first.p);const occupied=await blocker(chosen);t.after(()=>close(occupied));const again=child(dir);t.after(()=>stop(again.p));
 const [code]=await once(again.p,'exit');assert.equal(code,1);assert.match(again.err,/已被占用/);assert.ok(!again.out.includes('/event-room/'),'never print a false ready URL');assert.equal(JSON.parse(await readFile(join(dir,'local-address.json'),'utf8')).port,chosen);assert.equal(await (await fetch(`http://127.0.0.1:${chosen}/`)).text(),'owned-test-blocker');
});
