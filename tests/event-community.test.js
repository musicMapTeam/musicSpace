import { removeTempAfterTests } from './helpers/temp-directory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createAvatarApi } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { createEventStore } from '../server/event-store.js';
import { createAvatarWorker } from '../runtime-preview/src/avatar-worker.js';
import { createEventWorker } from '../runtime-preview/src/event-worker.js';
import { createFakeEnv } from '../runtime-preview/tests/d1-adapter.mjs';
import { photoData } from './event-contract.test.js';

async function fixture(t, mode = 'Worker', { rateLimits = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'musicspace-chat-'));
  let time = Date.parse('2026-09-30T10:00:00Z'), env, server, avatar, event, base;
  async function start() {
    if (mode === 'Worker') { env = createFakeEnv(join(dir, 'events.sqlite')); return; }
    avatar = createAvatarApi({ dataDir: dir, clock: () => time, rateLimits: false });
    event = createEventApi({ dataDir: dir, clock: () => time, rateLimits });
    server = createServer(async (req, res) => { if (!await event(req, res) && !await avatar(req, res)) { res.writeHead(404); res.end(); } });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    if (mode === 'Worker') { env.DB.close(); return; }
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); avatar.close(); event.close();
  }
  await start(); t.after(async () => { await stop(); await removeTempAfterTests(dir); });
  const f = { dir, get env() { return env; }, advance: ms => time += ms, restart: async () => { await stop(); await start(); },
    async request(path, { method = 'GET', token, data, key = randomUUID(), headers = {} } = {}) {
      const suffix = path.startsWith('/api/') ? path : '/api/event' + path;
      const options = { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' || key === null ? {} : { 'Idempotency-Key': key }), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) };
      const result = mode === 'Node' ? await fetch(base + suffix, options) : await (suffix.startsWith('/api/avatar') ? createAvatarWorker({ clock: () => time, rateLimits: false }) : createEventWorker({ clock: () => time, rateLimits })).fetch(new Request('https://musicspace.test' + suffix, options), env);
      const bytes = Buffer.from(await result.arrayBuffer());
      return { status: result.status, headers: result.headers, bytes, body: result.headers.get('Content-Type')?.includes('json') ? JSON.parse(bytes) : null };
    },
  };
  f.session = async name => (await f.request('/api/avatar/session', { method: 'POST', data: { name } })).body;
  f.room = async a => (await f.request('/rooms', { method: 'POST', token: a.token, data: { title: '合成现场', venue: '合成场地', songId: 'late-train', joinConsent: true, participation: 'open' } })).body.room;
  f.join = (room, a) => f.request(`/rooms/${room.code}/join`, { method: 'POST', token: a.token, data: { joinConsent: true, participation: 'open' } });
  f.send = (room, a, b, options = {}) => f.request(`/rooms/${room.id}/greetings`, { method: 'POST', token: a.token, data: { recipientId: b.user.id }, ...options });
  f.respond = (greeting, action, a, options = {}) => f.request(`/greetings/${greeting.id}/${action}`, { method: 'POST', token: a.token, data: { revision: greeting.revision }, ...options });
  f.block = (a, b, options = {}) => f.request(`/blocks/${b.user.id}`, { method: 'POST', token: a.token, data: {}, ...options });
  f.unblock = (a, b, revision, options = {}) => f.request(`/blocks/${b.user.id}`, { method: 'DELETE', token: a.token, data: { revision }, ...options });
  f.social = async a => { const r = await f.request('/social', { token: a.token }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  f.upload = async (room, a, visibility) => (await f.request(`/rooms/${room.id}/photos`, { method: 'POST', token: a.token, data: { ...photoData(), visibility } })).body.photo;
  f.two = async () => { const a = await f.session('A'), b = await f.session('B'), room = await f.room(a); assert.equal((await f.join(room, b)).status, 200); return { a, b, room }; };
  f.chatSend = (a, b, text = '合成测试消息', options = {}) => f.request(`/chats/${b.user.id}/messages`, { method: 'POST', token: a.token, data: { text }, ...options });
  f.messages = (a, b, query = '') => f.request(`/chats/${b.user.id}/messages${query}`, { token: a.token });
  f.ack = (a, b, ids, options = {}) => f.request(`/chats/${b.user.id}/read`, { method: 'POST', token: a.token, data: { messageIds: ids }, ...options });
  f.friends = async () => { const pair = await f.two(); const greeting = (await f.send(pair.room, pair.a, pair.b)).body.greeting; assert.equal((await f.respond(greeting, 'accept', pair.b)).status, 200); return pair; };
  return f;
}



for(const mode of ['Node','Worker']){
 test(mode+' community: independent consent, lifecycle, replies, explicit reads and persistence',async t=>{
  const f=await fixture(t,mode),{a,b,room}=await f.two(),outside=await f.session('Outside'),path='/rooms/'+room.id+'/conversation';
  const call=(suffix,actor=a,method='GET',data,opts={})=>f.request(path+suffix,{token:actor.token,method,data,...opts});
  assert.equal((await call('/messages')).status,403);
  assert.equal((await call('/join',a,'POST',{})).status,400);
  assert.equal((await call('/join',outside,'POST',{joinConsent:true})).status,403);
  for(const actor of[a,b])assert.equal((await call('/join',actor,'POST',{joinConsent:true})).status,200);
  const key=randomUUID(),send={text:'After the show',replyId:null};
  const [one,duplicate]=await Promise.all([call('/messages',a,'POST',send,{key}),call('/messages',a,'POST',send,{key})]);
  assert.equal(one.status,201);assert.equal(duplicate.status,201);assert.equal(one.body.messageId,duplicate.body.messageId);
  assert.equal((await call('/read',b,'POST',{messageIds:[one.body.messageId]})).status,400);
  let page=await call('/messages',b);assert.equal(page.body.messages.length,1);assert.equal(page.body.unreadCount,1);
  assert.equal((await call('/read',b,'POST',{messageIds:[one.body.messageId]})).status,200);
  assert.equal((await call('/messages',b)).body.unreadCount,0);
  assert.equal((await call('/messages',b,'POST',{text:'Reply',replyId:one.body.messageId})).status,201);
  assert.equal((await call('/messages')).body.messages[1].reply.text,send.text);
  assert.equal((await f.request('/rooms/'+room.id+'/close',{token:a.token,method:'POST',data:{revision:room.revision}})).status,200);
  f.advance(2*86400000);assert.equal((await call('/messages',b,'POST',{text:'Still together'})).status,201);
  let state=(await call('',b)).body.conversation;assert.equal((await call('/settings',b,'POST',{revision:state.revision,muted:true})).status,200);
  await f.restart();state=(await call('',b)).body.conversation;assert.equal(state.muted,true);assert.equal((await call('/messages')).body.messages.length,3);
  assert.equal((await call('/leave',b,'POST',{revision:state.revision})).status,200);
  assert.equal((await call('/messages',b)).status,403);assert.equal((await call('/messages',b,'POST',{text:'Denied'})).status,403);
  assert.equal((await call('/join',b,'POST',{joinConsent:true})).status,200);
  const community=(await f.request('/communities',{token:a.token,method:'POST',data:{title:'Long music space',joinConsent:true}})).body.community;
  assert.equal((await f.request('/rooms/'+room.id+'/community',{token:a.token,method:'POST',data:{communityId:community.id}})).status,200);
  assert.equal((await f.request('/rooms/'+room.id+'/community',{token:b.token})).body.community.id,community.id);
  assert.equal((await f.request('/communities/'+community.id+'/conversation',{token:b.token})).body.conversation.joined,false);
  assert.equal((await f.request('/communities/'+community.id+'/conversation/join',{token:b.token,method:'POST',data:{joinConsent:true}})).status,200);
  assert.equal((await f.request('/rooms/'+room.id+'/leave',{token:b.token,method:'POST',data:{}})).status,200);
  assert.equal((await call('/messages',b)).status,403);
  assert.equal((await f.request('/communities/'+community.id+'/conversation/messages',{token:b.token,method:'POST',data:{text:'Separate membership'}})).status,201);
  const groupPath='/communities/'+community.id+'/conversation';
  let listed=(await f.request('/communities',{token:a.token})).body.communities.find(c=>c.id===community.id);
  assert.equal(listed.unreadCount,1);assert.equal(listed.badgeCount,1);
  const groupState=(await f.request(groupPath,{token:a.token})).body.conversation;
  assert.equal((await f.request(groupPath+'/settings',{token:a.token,method:'POST',data:{revision:groupState.revision,muted:true}})).status,200);
  listed=(await f.request('/communities',{token:a.token})).body.communities.find(c=>c.id===community.id);
  assert.equal(listed.unreadCount,1);assert.equal(listed.badgeCount,0);
  const unreadPage=(await f.request(groupPath+'/messages',{token:a.token})).body;
  assert.equal((await f.request(groupPath+'/read',{token:a.token,method:'POST',data:{messageIds:unreadPage.messages.map(m=>m.id)}})).status,200);
  assert.equal((await f.request('/communities',{token:a.token})).body.communities.find(c=>c.id===community.id).unreadCount,0);
 });
 test(mode+' community: block, hidden replies, host removal, restoration and scope forgery',async t=>{
  const f=await fixture(t,mode),{a,b,room}=await f.two(),c=await f.session('C');await f.join(room,c);const path='/rooms/'+room.id+'/conversation';
  const call=(suffix,actor=a,method='GET',data)=>f.request(path+suffix,{token:actor.token,method,data});
  for(const actor of[a,b,c])await call('/join',actor,'POST',{joinConsent:true});
  const first=(await call('/messages',b,'POST',{text:'Private from blockers'})).body.messageId;
  await call('/messages',c,'POST',{text:'Third voice',replyId:first});await f.block(a,b);
  let page=(await call('/messages')).body.messages;assert.equal(page.length,1);assert.equal(page[0].reply,null);
  assert.equal((await call('/messages',a,'POST',{text:'Not visible',replyId:first})).status,404);
  assert.equal((await call('/read',a,'POST',{messageIds:[first]})).status,400);
  assert.equal((await call('/messages/'+first,c,'DELETE',{})).status,403);
  assert.equal((await call('/messages/'+first,a,'DELETE',{})).status,200);assert.equal((await call('/messages',c)).body.messages[0].reply,null);
  let member=(await call('')).body.members.find(m=>m.id===c.user.id);
  assert.equal((await call('/members/'+c.user.id,b,'POST',{revision:member.revision})).status,403);
  assert.equal((await call('/members/'+c.user.id,a,'POST',{revision:member.revision})).status,200);
  assert.equal((await call('/messages',c)).status,403);assert.equal((await call('/join',c,'POST',{joinConsent:true})).status,403);
  assert.equal((await call('/members/'+c.user.id,a,'DELETE',{revision:member.revision+1})).status,200);
  assert.equal((await call('/messages',c)).status,403);assert.equal((await call('/join',c,'POST',{joinConsent:true})).status,200);
  assert.equal((await call('/messages?before='+randomUUID())).status,400);
 });
}
for(const mode of ['Node','Worker'])test(mode+' community contacts: explicit willingness after show, mutual acceptance, no event photo grants',async t=>{
 const f=await fixture(t,mode),a=await f.session('Host'),b=await f.session('B'),c=await f.session('C'),room=await f.room(a),community=(await f.request('/communities',{token:a.token,method:'POST',data:{title:'Persistent space',joinConsent:true}})).body.community;
 const base='/communities/'+community.id,call=(suffix,actor=a,method='GET',data)=>f.request(base+suffix,{token:actor.token,method,data});
 await f.request('/rooms/'+room.id+'/community',{token:a.token,method:'POST',data:{communityId:community.id}});for(const actor of[b,c])await call('/conversation/join',actor,'POST',{joinConsent:true});
 assert.equal((await call('/greetings',a,'POST',{recipientId:b.user.id})).status,409);
 for(const actor of[a,b,c]){const m=(await call('/conversation',actor)).body.conversation;assert.equal((await call('/conversation/settings',actor,'POST',{revision:m.revision,muted:false,mode:'open'})).status,200);}
 await f.request('/rooms/'+room.id+'/close',{token:a.token,method:'POST',data:{revision:room.revision}});f.advance(2*86400000);
 const greet=await call('/greetings',a,'POST',{recipientId:b.user.id});assert.equal(greet.status,201,JSON.stringify(greet.body));assert.equal((await f.chatSend(a,b)).status,404);
 assert.equal((await f.respond(greet.body.greeting,'accept',b)).status,200);assert.equal((await f.chatSend(a,b)).status,201);assert.equal((await f.request('/rooms/'+room.id,{token:b.token})).status,404);
 const pending=(await call('/greetings',a,'POST',{recipientId:c.user.id})).body.greeting;let m=(await call('/conversation',c)).body.conversation;await call('/conversation/settings',c,'POST',{revision:m.revision,muted:false,mode:'quiet'});assert.equal((await f.respond(pending,'accept',c)).status,409);
 m=(await call('/conversation',b)).body.conversation;await call('/conversation/leave',b,'POST',{revision:m.revision});assert.equal((await f.chatSend(a,b)).status,201);await f.block(a,b);assert.equal((await f.chatSend(a,b)).status,404);
});
test('Worker conversation: removing a sender before its paused transaction rejects the guard without a duplicate receipt',async t=>{
 const f=await fixture(t),{a,b,room}=await f.two(),path='/rooms/'+room.id+'/conversation';for(const actor of[a,b])await f.request(path+'/join',{token:actor.token,method:'POST',data:{joinConsent:true}});
 let signal,release;const started=new Promise(r=>signal=r),gate=new Promise(r=>release=r),original=f.env.DB.batch.bind(f.env.DB);f.env.DB.batch=async statements=>{if(statements.some(s=>s.query.startsWith('INSERT INTO event_group_messages'))){signal();await gate;}return original(statements);};
 const pending=f.request(path+'/messages',{token:b.token,method:'POST',data:{text:'Delayed synthetic send'}});await started;const m=(await f.request(path,{token:a.token})).body.members.find(m=>m.id===b.user.id);assert.equal((await f.request(path+'/members/'+b.user.id,{token:a.token,method:'POST',data:{revision:m.revision}})).status,200);release();assert.equal((await pending).status,409);assert.equal((await f.request(path+'/messages',{token:a.token})).body.messages.length,0);
});
for(const mode of ['Node','Worker'])test(mode+' community capacity: concurrent final-slot joins cannot exceed100 members',async t=>{
 const f=await fixture(t,mode),a=await f.session('Host'),b=await f.session('B'),c=await f.session('C'),community=(await f.request('/communities',{token:a.token,method:'POST',data:{title:'Capacity space',joinConsent:true}})).body.community;
 const db=mode==='Worker'?f.env.DB.sql:new DatabaseSync(join(f.dir,'avatar-space.sqlite'));let freed;
 for(let n=0;n<99;n++){const id=randomUUID();freed=id;db.prepare('INSERT INTO avatar_users(id,name,avatar,token_hash,revision,created_at) VALUES(?,?,?,?,1,?)').run(id,'Synthetic member '+n,JSON.stringify(a.user.avatar),randomUUID(),'2026-10-02T10:00:00.000Z');db.prepare("INSERT INTO event_conversation_members(kind,scope_id,user_id,joined_at) VALUES('community',?,?,?)").run(community.id,id,'2026-10-02T10:00:00.000Z');}
 const joinConversation=actor=>f.request('/communities/'+community.id+'/conversation/join',{token:actor.token,method:'POST',data:{joinConsent:true}});
 assert.equal((await joinConversation(b)).status,403);db.prepare("UPDATE event_conversation_members SET left_at=? WHERE kind='community' AND scope_id=? AND user_id=?").run('2026-10-02T11:00:00.000Z',community.id,freed);
 const results=await Promise.all([joinConversation(b),joinConversation(c)]);assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(db.prepare("SELECT COUNT(*) total FROM event_conversation_members WHERE kind='community' AND scope_id=? AND left_at IS NULL AND removed_at IS NULL").get(community.id).total,100);if(mode==='Node')db.close();
});

for(const mode of ['Node','Worker'])test(mode+' music bridge: references inherit consent, idempotency, quote retraction, block and persistent membership gates',async t=>{
 const f=await fixture(t,mode),{a,b,room}=await f.two(),outsider=await f.session('Outside'),path='/rooms/'+room.id+'/conversation';
 const call=(suffix,actor=a,method='GET',data,options={})=>f.request(path+suffix,{token:actor.token,method,data,...options});
 const catalogue=(await f.request('/music',{token:a.token})).body.recordings;assert.equal(catalogue.length,4);assert.equal(catalogue[0].title,'不该');assert.equal(new URL(catalogue[0].exploreUrl).hostname,'musicmapteam.github.io');assert.equal((await f.request('/music')).status,401);
 assert.equal((await call('/messages',a,'POST',{text:'Music',musicId:catalogue[0].id})).status,403);
 for(const actor of[a,b])await call('/join',actor,'POST',{joinConsent:true});
 assert.equal((await call('/messages',a,'POST',{text:'Spoof',musicId:'unknown'})).status,400);
 assert.equal((await call('/messages',a,'POST',{text:'Spoof',musicId:catalogue[0].id,sourceUrl:'https://example.com/private'})).status,400);
 const key=randomUUID(),data={text:'This duet matters to me',musicId:catalogue[0].id};
 const [one,two]=await Promise.all([call('/messages',a,'POST',data,{key}),call('/messages',a,'POST',data,{key})]);assert.equal(one.status,201);assert.equal(one.body.messageId,two.body.messageId);
 let messages=(await call('/messages',b)).body.messages;assert.equal(messages.length,1);assert.deepEqual(messages[0].music,catalogue[0]);assert.equal(messages[0].senderId,a.user.id);
 assert.equal((await call('/messages',outsider)).status,403);
 const reply=await call('/messages',b,'POST',{text:'Another perspective',replyId:one.body.messageId});assert.equal(reply.status,201);
 await f.restart();messages=(await call('/messages',b)).body.messages;assert.deepEqual(messages[1].reply.music,catalogue[0]);
 await f.block(a,b);assert.equal((await call('/messages',b)).body.messages[0].reply,null);
 await f.unblock(a,b,(await f.social(a)).blocks[0].revision);
 assert.equal((await call('/messages/'+one.body.messageId,a,'DELETE',{})).status,200);
 messages=(await call('/messages',b)).body.messages;assert.equal(messages.length,1);assert.equal(messages[0].reply,null);
 const member=(await call('',b)).body.conversation;await call('/leave',b,'POST',{revision:member.revision});assert.equal((await call('/messages',b)).status,403);
});

test('Node music additive migration preserves a 0007 conversation and restores the new table on restart',async t=>{
 const f=await fixture(t,'Node'),{a,b,room}=await f.two(),path='/rooms/'+room.id+'/conversation';for(const actor of[a,b])await f.request(path+'/join',{token:actor.token,method:'POST',data:{joinConsent:true}});
 const old=await f.request(path+'/messages',{token:a.token,method:'POST',data:{text:'Before music references'}});assert.equal(old.status,201);
 const db=new DatabaseSync(join(f.dir,'avatar-space.sqlite'));db.exec('DROP TABLE event_group_music');db.close();await f.restart();
 const messages=(await f.request(path+'/messages',{token:b.token})).body.messages;assert.equal(messages[0].id,old.body.messageId);assert.equal(messages[0].text,'Before music references');assert.equal(messages[0].music,null);
 assert.equal((await f.request(path+'/messages',{token:a.token,method:'POST',data:{text:'After migration',musicId:'real-bu-gai'}})).status,201);
});

for(const mode of ['Node','Worker'])test(mode+' album worldcup: explicit synthetic votes, ties, advancement, result and persistent private ballots',async t=>{
 const f=await fixture(t,mode),{a,b,room}=await f.two(),outside=await f.session('Outside'),conversation='/rooms/'+room.id+'/conversation',collection='/rooms/'+room.id+'/worldcups';
 assert.equal((await f.request(collection,{token:a.token,method:'POST',data:{title:'Synthetic albums',createConsent:true}})).status,403);
 for(const actor of[a,b])await f.request(conversation+'/join',{token:actor.token,method:'POST',data:{joinConsent:true}});
 assert.equal((await f.request(collection,{token:a.token,method:'POST',data:{title:'Synthetic albums'}})).status,400);
 const cup=(await f.request(collection,{token:a.token,method:'POST',data:{title:'Synthetic albums',createConsent:true}})).body.worldcup,path='/worldcups/'+cup.id;
 assert.equal(cup.fictional,true);assert.equal((await f.request(path,{token:outside.token})).status,403);
 const read=async actor=>(await f.request(path,{token:actor.token})).body;
 const vote=(m,actor,album,key=randomUUID())=>f.request(path+'/matches/'+m.id+'/vote',{token:actor.token,method:'POST',key,data:{revision:m.revision,albumId:album,voteConsent:true}});
 const advance=(m,actor=a,extra={},key=randomUUID())=>f.request(path+'/matches/'+m.id+'/advance',{token:actor.token,method:'POST',key,data:{revision:m.revision,advanceConsent:true,...extra}});
 let state=await read(a);assert.equal(state.matches.length,2);assert.ok(state.matches.every(m=>m.left.fictional&&m.right.fictional&&m.leftCount+m.rightCount===0));
 assert.equal((await advance(state.matches[0])).status,409);
 const m=state.matches[0],key=randomUUID(),pair=await Promise.all([vote(m,a,m.left.id,key),vote(m,a,m.left.id,key)]);assert.ok(pair.every(r=>r.status===200));
 assert.equal((await vote(m,a,m.right.id)).status,409);assert.equal((await vote(m,b,m.right.id)).status,200);
 assert.equal((await advance(m,b)).status,403);assert.equal((await advance(m)).status,400);assert.equal((await advance(m,a,{tieWinner:m.left.id,tieReason:'Synthetic host tie decision'})).status,200);
 assert.equal((await vote(m,a,m.left.id,key)).status,200);assert.equal((await vote(m,b,m.left.id)).status,409);
 let other=state.matches[1];await vote(other,a,other.left.id);await vote(other,b,other.left.id);const advanceKey=randomUUID(),advances=await Promise.all([advance(other,a,{},advanceKey),advance(other,a,{},advanceKey)]);assert.ok(advances.every(r=>r.status===200));
 state=await read(a);assert.equal(state.matches.length,3);assert.equal(state.matches[0].leftCount,1);assert.equal(state.matches[0].rightCount,1);assert.equal(state.matches[0].tieReason,'Synthetic host tie decision');assert.equal(state.matches[1].leftCount,2);assert.equal(state.matches[2].left.id,m.left.id);assert.equal(state.matches[2].right.id,other.left.id);
 const final=state.matches[2];await vote(final,a,final.left.id);await vote(final,b,final.right.id);assert.equal((await advance(final,a,{tieWinner:final.right.id,tieReason:'Another explicit tie decision'})).status,200);
 await f.restart();state=await read(b);assert.equal(state.completed,true);assert.equal(state.matches[2].winner.id,final.right.id);assert.equal(state.matches[2].myVote,final.right.id);assert.equal(state.matches[0].myVote,m.right.id);assert.equal(JSON.stringify(state).includes(a.token),false);assert.equal('voters' in state.matches[2],false);
});

for(const mode of ['Node','Worker'])test(mode+' album worldcup: conflicting concurrent votes, blocks, exit and closed-show participation',async t=>{
 const f=await fixture(t,mode),{a,b,room}=await f.two(),conversation='/rooms/'+room.id+'/conversation';for(const actor of[a,b])await f.request(conversation+'/join',{token:actor.token,method:'POST',data:{joinConsent:true}});
 const cup=(await f.request('/rooms/'+room.id+'/worldcups',{token:a.token,method:'POST',data:{title:'Synthetic concurrency',createConsent:true}})).body.worldcup,path='/worldcups/'+cup.id,state=(await f.request(path,{token:b.token})).body,m=state.matches[0];
 const vote=(actor,album)=>f.request(path+'/matches/'+m.id+'/vote',{token:actor.token,method:'POST',data:{revision:m.revision,albumId:album,voteConsent:true}});
 assert.equal((await vote(b,'not-an-album')).status,400);const attempts=await Promise.all([vote(b,m.left.id),vote(b,m.right.id)]);assert.equal(attempts.filter(r=>r.status===200).length,1);let current=(await f.request(path,{token:b.token})).body;assert.equal(current.matches[0].leftCount+current.matches[0].rightCount,1);
 await f.block(a,b);assert.equal((await f.request(path,{token:b.token})).status,403);assert.equal((await vote(b,m.left.id)).status,403);await f.unblock(a,b,(await f.social(a)).blocks[0].revision);
 await f.block(b,a);assert.equal((await f.request(path,{token:b.token})).status,403);await f.unblock(b,a,(await f.social(b)).blocks[0].revision);
 let member=(await f.request(conversation,{token:b.token})).body.conversation;await f.request(conversation+'/leave',{token:b.token,method:'POST',data:{revision:member.revision}});assert.equal((await f.request(path,{token:b.token})).status,403);assert.equal((await f.request('/rooms/'+room.id+'/worldcups',{token:b.token})).status,403);
 await f.request(conversation+'/join',{token:b.token,method:'POST',data:{joinConsent:true}});await f.request('/rooms/'+room.id+'/close',{token:a.token,method:'POST',data:{revision:room.revision}});f.advance(2*86400000);assert.equal((await vote(a,m.left.id)).status,200);assert.equal((await f.request(path,{token:b.token})).status,200);
});

test('Worker worldcup: a new ballot during advancement rejects the stale count snapshot',async t=>{
 const f=await fixture(t),{a,b,room}=await f.two(),conversation='/rooms/'+room.id+'/conversation';for(const actor of[a,b])await f.request(conversation+'/join',{token:actor.token,method:'POST',data:{joinConsent:true}});
 const cup=(await f.request('/rooms/'+room.id+'/worldcups',{token:a.token,method:'POST',data:{title:'Synthetic race',createConsent:true}})).body.worldcup,path='/worldcups/'+cup.id,m=(await f.request(path,{token:a.token})).body.matches[0];
 const vote=actor=>f.request(path+'/matches/'+m.id+'/vote',{token:actor.token,method:'POST',data:{revision:m.revision,albumId:actor===a?m.left.id:m.right.id,voteConsent:true}});await vote(a);
 let release,signal;const gate=new Promise(r=>release=r),started=new Promise(r=>signal=r),original=f.env.DB.batch.bind(f.env.DB);f.env.DB.batch=async statements=>{if(statements.some(s=>s.query.startsWith('UPDATE event_worldcup_matches SET winner_id'))){signal();await gate;}return original(statements);};
 const advancing=f.request(path+'/matches/'+m.id+'/advance',{token:a.token,method:'POST',data:{revision:m.revision,advanceConsent:true}});await started;assert.equal((await vote(b)).status,200);release();assert.equal((await advancing).status,409);
 const state=(await f.request(path,{token:a.token})).body;assert.equal(state.matches[0].winner,null);assert.equal(state.matches[0].leftCount,1);assert.equal(state.matches[0].rightCount,1);
});

for(const mode of ['Node','Worker'])test(mode+' worldcup: concurrent different first-round advancements create one final',async t=>{
 const f=await fixture(t,mode),{a,room}=await f.two(),conversation='/rooms/'+room.id+'/conversation';await f.request(conversation+'/join',{token:a.token,method:'POST',data:{joinConsent:true}});
 const cup=(await f.request('/rooms/'+room.id+'/worldcups',{token:a.token,method:'POST',data:{title:'Synthetic parallel brackets',createConsent:true}})).body.worldcup,path='/worldcups/'+cup.id,matches=(await f.request(path,{token:a.token})).body.matches;
 for(const m of matches)await f.request(path+'/matches/'+m.id+'/vote',{token:a.token,method:'POST',data:{revision:m.revision,albumId:m.left.id,voteConsent:true}});
 const responses=await Promise.all(matches.map(m=>f.request(path+'/matches/'+m.id+'/advance',{token:a.token,method:'POST',data:{revision:m.revision,advanceConsent:true}})));assert.ok(responses.every(r=>r.status===200));const current=(await f.request(path,{token:a.token})).body;assert.equal(current.matches.length,3);assert.equal(current.matches.filter(m=>m.ordinal===2).length,1);
});
