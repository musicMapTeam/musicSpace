import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createAvatarApi} from '../../server/avatar-api.js';
import {createEventApi} from '../../server/event-api.js';
import {createAvatarWorker} from '../../runtime-preview/src/avatar-worker.js';
import {createEventWorker} from '../../runtime-preview/src/event-worker.js';
import {createFakeEnv} from '../../runtime-preview/tests/d1-adapter.mjs';
import {removeTempAfterTests} from './temp-directory.js';
export async function participationFixture(t,mode='Node'){
 const dir=await mkdtemp(join(tmpdir(),'musicspace-participation-'));let env,server,avatar,event,baseUrl;const clock=()=>Date.parse('2026-10-02T06:00:00Z');
 async function start(){if(mode==='Worker'){env=createFakeEnv(join(dir,'events.sqlite'),{clock});return;}avatar=createAvatarApi({dataDir:dir,rateLimits:false,clock});event=createEventApi({dataDir:dir,rateLimits:false,clock});server=createServer(async(req,res)=>{if(!await event(req,res)&&!await avatar(req,res)){res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');baseUrl=`http://127.0.0.1:${server.address().port}`;}
 async function stop(){if(mode==='Worker'){env.DB.close();return;}server.closeAllConnections();await new Promise(resolve=>server.close(resolve));avatar.close();event.close();}
 await start();t.after(async()=>{await stop();await removeTempAfterTests(dir);});
 const f={dir,get baseUrl(){return baseUrl;},get env(){return env;},restart:async()=>{await stop();await start();},async request(path,{method='GET',token,data,key=randomUUID()}={}){const suffix=path.startsWith('/api/')?path:'/api/event'+path,options={method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(method==='GET'?{}:{'Idempotency-Key':key,'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})};const r=mode==='Node'?await fetch(baseUrl+suffix,options):await (suffix.startsWith('/api/avatar')?createAvatarWorker({rateLimits:false,clock}):createEventWorker({rateLimits:false,clock})).fetch(new Request('https://space.test'+suffix,options),env);const bytes=Buffer.from(await r.arrayBuffer());return {status:r.status,headers:r.headers,bytes,body:r.headers.get('Content-Type')?.includes('json')?JSON.parse(bytes):null};}};
 f.session=async name=>(await f.request('/api/avatar/session',{method:'POST',data:{name}})).body;
 f.room=async(a,participation)=>(await f.request('/rooms',{method:'POST',token:a.token,data:{title:'合成状态验收',venue:'合成',songId:'late-train',joinConsent:true,...(participation?{participation}:{})}})).body.room;
 f.join=(room,a,participation)=>f.request(`/rooms/${room.code}/join`,{method:'POST',token:a.token,data:{joinConsent:true,...(participation?{participation}:{})}});
 f.roster=async(room,a)=>(await f.request('/rooms/'+room.id,{token:a.token})).body;
 f.choice=(room,a,mode,revision=1,key)=>f.request(`/rooms/${room.id}/participation`,{method:'PATCH',token:a.token,data:{mode,revision},...(key?{key}:{})});
 f.send=(room,a,b)=>f.request(`/rooms/${room.id}/greetings`,{method:'POST',token:a.token,data:{recipientId:b.user.id}});
 f.two=async()=>{const a=await f.session('合成A'),b=await f.session('合成B'),room=await f.room(a);await f.join(room,b);return{a,b,room};};return f;
}
