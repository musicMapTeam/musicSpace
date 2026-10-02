import { removeTempAfterTests } from './helpers/temp-directory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createAvatarApi } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { eventContract, photoData } from './event-contract.test.js';

async function fixture(t) {
  const dataDir=await mkdtemp(join(tmpdir(),'musicspace-events-node-'));let time=Date.parse('2026-09-30T10:00:00Z');let server,avatar,event,base;
  async function start(){
    avatar=createAvatarApi({dataDir,clock:()=>time,rateLimits:false});event=createEventApi({dataDir,clock:()=>time,rateLimits:false});
    server=createServer(async(req,res)=>{if(!await event(req,res)&&!await avatar(req,res)){res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;
  }
  async function stop(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));avatar.close();event.close();}
  await start();t.after(async()=>{await stop();await removeTempAfterTests(dataDir);});
  const f={get base(){return base;},advance:ms=>time+=ms,restart:async()=>{await stop();await start();},async request(path,{method='GET',token,data,key=randomUUID(),headers={}}={}){
    const result=await fetch(base+(path.startsWith('/api/')?path:'/api/event'+path),{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(data===undefined?{}:{'Content-Type':'application/json'}),...(method==='GET'||key===null?{}:{'Idempotency-Key':key}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
    const bytes=Buffer.from(await result.arrayBuffer());return {status:result.status,headers:result.headers,bytes,body:result.headers.get('content-type')?.includes('json')?JSON.parse(bytes):null};
  }};
  f.session=async name=>(await f.request('/api/avatar/session',{method:'POST',data:{name}})).body;
  f.createRoom=(user,key)=>f.request('/rooms',{method:'POST',token:user.token,key,data:{title:'合成测试现场',venue:'合成场地',songId:'late-train',joinConsent:true,participation:'open'}});
  f.join=(room,user,yes=true)=>f.request(`/rooms/${room.code}/join`,{method:'POST',token:user.token,data:{joinConsent:yes}});
  f.upload=(room,user,visibility,key)=>f.request(`/rooms/${room.id}/photos`,{method:'POST',token:user.token,key,data:{...photoData(),visibility}});
  return f;
}
eventContract('Node SQLite',fixture);

test('Node: streamed oversize returns JSON 413 without dropping the server',async t=>{
  const f=await fixture(t),a=await f.session('A');
  const result=await new Promise((resolve,reject)=>{
    const req=httpRequest(f.base+'/api/event/rooms',{method:'POST',headers:{Authorization:`Bearer ${a.token}`,'Content-Type':'application/json','Idempotency-Key':randomUUID()}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))}));
    });req.on('error',reject);req.write('x'.repeat(430*1024));req.end();
  });assert.equal(result.status,413);assert.equal(result.body.error.code,'BODY_TOO_LARGE');assert.equal((await f.request('/health')).status,200);
});
