import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export const JPEG_FIXTURE = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDx6iiitzM//9k=';
export const photoData = () => ({dataUrl: 'data:image/jpeg;base64,' + JPEG_FIXTURE, visibility:'private'});
export function eventContract(label, fixture) {
  test(`${label}: explicit distinct identity joins; preview never exposes people or photos`, async t => {
    const f = await fixture(t), a = await f.session('A'), b = await f.session('B');
    assert.notEqual(a.user.id,b.user.id); assert.notEqual(a.token,b.token);
    const rejected = await f.request('/rooms', {token:a.token,method:'POST',data:{title:'夜场',songId:'late-train'}});
    assert.equal(rejected.status,400); assert.equal(rejected.body.error.code,'JOIN_CONSENT_REQUIRED');
    const made = await f.createRoom(a); const room = made.body.room;
    assert.equal(made.status,201); assert.match(room.code,/^[A-Z2-7]{12}$/);
    const preview = await f.request('/preview/'+room.code); assert.equal(preview.status,200);
    assert.deepEqual(Object.keys(preview.body),['preview']);
    assert.deepEqual(Object.keys(preview.body.preview).sort(), ['id','code','title','venue','songId','status','revision','createdAt','expiresAt','capacity'].sort());
    for (const secret of [a.token, a.user.id, 'token_hash', 'members', 'photo_key']) assert.ok(!JSON.stringify(preview.body).includes(secret));
    assert.equal((await f.request('/rooms/'+room.id)).status,401);
    assert.equal((await f.request('/rooms/'+room.id,{token:b.token})).status,404);
    assert.equal((await f.join(room,b,false)).status,400);
    assert.equal((await f.join(room,b)).status,200);
    const inside = await f.request('/rooms/'+room.id,{token:b.token}); assert.equal(inside.status,200);
    assert.deepEqual(new Set(inside.body.members.map(m=>m.id)),new Set([a.user.id,b.user.id]));
    assert.equal(inside.body.actorId,b.user.id);
    assert.ok(inside.body.members.every(m=>Object.keys(m).sort().join(',')==='avatar,id,joinedAt,name'));
    const own = await f.request('/rooms',{token:b.token}); assert.equal(own.body.rooms.length,1);
    assert.equal((await f.request('/no-such-route',{token:a.token})).status,404);
  });
  test(`${label}: photos are explicit, private by default only through a chosen value, and cross-room denied`, async t => {
    const f=await fixture(t), a=await f.session('A'), b=await f.session('B'), c=await f.session('C');
    const room=(await f.createRoom(a)).body.room; await f.join(room,b);
    const other=(await f.createRoom(c)).body.room;
    const noChoice=await f.request(`/rooms/${room.id}/photos`,{token:a.token,method:'POST',data:{dataUrl:photoData().dataUrl}}); assert.equal(noChoice.status,400);
    const upload=await f.upload(room,a,'private'); assert.equal(upload.status,201); const p=upload.body.photo;
    assert.equal(p.visibility,'private'); assert.ok(!JSON.stringify(p).includes('photo_key'));
    assert.equal((await f.request(`/photos/${p.id}/image`,{token:b.token})).status,404);
    assert.equal((await f.request(`/photos/${p.id}/image`,{token:c.token})).status,404);
    assert.equal((await f.request('/rooms/'+room.id,{token:b.token})).body.photos.length,0);
    const bytes=await f.request(`/photos/${p.id}/image`,{token:a.token}); assert.equal(bytes.status,200); assert.ok(bytes.bytes.length>50);
    assert.match(bytes.headers.get('cache-control'),/no-store/);
    const shared=await f.request('/photos/'+p.id,{token:a.token,method:'PATCH',data:{revision:1,visibility:'members'}}); assert.equal(shared.status,200); assert.equal(shared.body.photo.revision,2);
    assert.equal((await f.request(`/photos/${p.id}/image`,{token:b.token})).status,200);
    assert.equal((await f.request(`/photos/${p.id}/image`,{token:c.token})).status,404);
    assert.equal((await f.request('/rooms/'+other.id,{token:a.token})).status,404);
    assert.equal((await f.request('/photos/'+p.id,{token:b.token,method:'PATCH',data:{revision:2,visibility:'private'}})).status,404);
    assert.equal((await f.request('/photos/'+p.id,{token:a.token,method:'PATCH',data:{revision:1,visibility:'private'}})).status,409);
    assert.equal((await f.request('/photos',{token:b.token})).body.photos.length,0);
    await f.request('/photos/'+p.id,{token:a.token,method:'PATCH',data:{revision:2,visibility:'private'}});
    assert.equal((await f.request(`/photos/${p.id}/image`,{token:b.token})).status,404);
  });
  test(`${label}: leave revokes roster and sharing; rejoin does not silently re-share; uploader removal is final`, async t=>{
    const f=await fixture(t), a=await f.session('A'), b=await f.session('B'); const room=(await f.createRoom(a)).body.room; await f.join(room,b);
    const p=(await f.upload(room,a,'members')).body.photo, q=(await f.upload(room,b,'members')).body.photo;
    assert.equal((await f.request(`/rooms/${room.id}/leave`,{token:a.token,method:'POST',data:{}})).status,200);
    assert.equal((await f.request('/rooms/'+room.id,{token:a.token})).status,404);
    assert.equal((await f.request(`/photos/${q.id}/image`,{token:a.token})).status,404);
    assert.equal((await f.request(`/photos/${p.id}/image`,{token:b.token})).status,404);
    assert.equal((await f.request(`/photos/${p.id}/image`,{token:a.token})).status,200);
    const own=(await f.request('/photos',{token:a.token})).body.photos; assert.equal(own[0].visibility,'private'); assert.equal(own[0].revision,2);
    assert.equal((await f.request('/photos/'+p.id,{token:a.token,method:'PATCH',data:{revision:2,visibility:'members'}})).status,404);
    const revoked=await f.request('/photos/'+p.id,{token:a.token,method:'PATCH',data:{revision:2,visibility:'private'}}); assert.equal(revoked.status,200);
    await f.join(room,a);
    assert.equal((await f.request(`/photos/${p.id}/image`,{token:b.token})).status,404);
    const reshared=await f.request('/photos/'+p.id,{token:a.token,method:'PATCH',data:{revision:3,visibility:'members'}}); assert.equal(reshared.status,200);
    const removed=await f.request('/photos/'+p.id,{token:a.token,method:'DELETE',data:{revision:4}}); assert.equal(removed.status,200);
    for(const u of [a,b]) assert.equal((await f.request(`/photos/${p.id}/image`,{token:u.token})).status,404);
    assert.equal((await f.request('/photos',{token:a.token})).body.photos.length,0);
  });
  test(`${label}: close and expiry stop entry and upload, keep retained photos and allow revocation`,async t=>{
    const f=await fixture(t),a=await f.session('A'),b=await f.session('B'),c=await f.session('C');const room=(await f.createRoom(a)).body.room;await f.join(room,b);
    const p=(await f.upload(room,a,'members')).body.photo;
    assert.equal((await f.request(`/rooms/${room.id}/close`,{token:b.token,method:'POST',data:{revision:1}})).status,403);
    const closed=await f.request(`/rooms/${room.id}/close`,{token:a.token,method:'POST',data:{revision:1}});assert.equal(closed.status,200);assert.equal(closed.body.room.status,'closed');
    assert.equal((await f.request(`/rooms/${room.id}/close`,{token:a.token,method:'POST',data:{revision:1}})).status,409);
    assert.equal((await f.join(room,c)).status,409);assert.equal((await f.upload(room,b,'private')).status,409);
    assert.equal((await f.request(`/photos/${p.id}/image`,{token:b.token})).status,200);
    assert.equal((await f.request('/photos/'+p.id,{token:a.token,method:'PATCH',data:{revision:1,visibility:'private'}})).status,200);
    assert.equal((await f.request(`/photos/${p.id}/image`,{token:b.token})).status,404);
    const second=(await f.createRoom(a)).body.room;const q=(await f.upload(second,a,'private')).body.photo;
    f.advance(24*60*60*1000+1);
    assert.equal((await f.request('/preview/'+second.code)).body.preview.status,'expired');
    assert.equal((await f.join(second,b)).status,409);assert.equal((await f.upload(second,a,'private')).status,409);
    assert.equal((await f.request(`/photos/${q.id}/image`,{token:a.token})).status,200);
  });
  test(`${label}: concurrent joins cannot exceed 24; exact retries create one room/photo and conflicting keys fail`,async t=>{
    const f=await fixture(t),host=await f.session('Host');
    const key=randomUUID(),[first,retry]=await Promise.all([f.createRoom(host,key),f.createRoom(host,key)]);
    assert.equal(first.status,201);assert.equal(retry.status,201);assert.equal(first.body.room.id,retry.body.room.id);const room=first.body.room;
    const other=await f.request('/rooms',{token:host.token,method:'POST',key,data:{title:'different',songId:'late-train',joinConsent:true}});assert.equal(other.status,409);
    const people=await Promise.all(Array.from({length:30},(_,i)=>f.session('Person'+i)));
    const joined=await Promise.all(people.map(u=>f.join(room,u)));assert.equal(joined.filter(r=>r.status===200).length,23);assert.ok(joined.every(r=>[200,409].includes(r.status)));
    const inside=await f.request('/rooms/'+room.id,{token:host.token});assert.equal(inside.body.members.length,24);assert.equal(new Set(inside.body.members.map(m=>m.id)).size,24);
    const pkey=randomUUID(),uploads=await Promise.all([f.upload(room,host,'members',pkey),f.upload(room,host,'members',pkey)]);
    assert.ok(uploads.every(r=>r.status===201));assert.equal(uploads[0].body.photo.id,uploads[1].body.photo.id);
    assert.equal((await f.request('/photos',{token:host.token})).body.photos.length,1);
    const photo=uploads[0].body.photo;
    const writes=await Promise.all(['private','members'].map(v=>f.request('/photos/'+photo.id,{token:host.token,method:'PATCH',data:{revision:1,visibility:v}})));
    assert.equal(writes.filter(r=>r.status===200).length,1);assert.equal(writes.filter(r=>r.status===409).length,1);
  });
  test(`${label}: photo limit is transactional; malformed/photo metadata inputs and missing keys are rejected`,async t=>{
    const f=await fixture(t),a=await f.session('A'),room=(await f.createRoom(a)).body.room;
    for(const data of [{...photoData(),url:'https://other.test/private'}, {...photoData(),visibility:'public'}, {...photoData(),dataUrl:'data:image/jpeg;base64,ZmFrZQ=='}]) assert.equal((await f.request(`/rooms/${room.id}/photos`,{token:a.token,method:'POST',data})).status,400);
    assert.equal((await f.request(`/rooms/${room.id}/leave`,{token:a.token,method:'POST',data:{},key:null})).status,400);
    assert.equal((await f.request('/rooms',{token:a.token,method:'POST',data:{title:'x'.repeat(41),songId:'late-train',joinConsent:true}})).status,400);
    assert.equal((await f.request('/rooms',{token:a.token,method:'POST',data:{title:'x\ny',songId:'late-train',joinConsent:true}})).status,400);
    assert.equal((await f.request('/rooms/'+room.id,{token:a.token,headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
    const uploads=await Promise.all(Array.from({length:10},()=>f.upload(room,a,'private')));assert.equal(uploads.filter(r=>r.status===201).length,6);assert.ok(uploads.every(r=>[201,409].includes(r.status)));
    assert.equal((await f.request('/photos',{token:a.token})).body.photos.length,6);
  });
  test(`${label}: identity, memberships, images and idempotency survive restart`,async t=>{
    const f=await fixture(t),a=await f.session('A'),b=await f.session('B'),key=randomUUID(); const room=(await f.createRoom(a,key)).body.room;await f.join(room,b);const p=(await f.upload(room,a,'members')).body.photo;
    const before=(await f.request(`/photos/${p.id}/image`,{token:b.token})).bytes;
    await f.restart();
    assert.equal((await f.request('/rooms/'+room.id,{token:b.token})).body.members.length,2);
    assert.deepEqual((await f.request(`/photos/${p.id}/image`,{token:b.token})).bytes,before);
    assert.equal((await f.createRoom(a,key)).body.room.id,room.id);
  });
  test(`${label}: departed host retains only management metadata/close, never roster or others' photos`,async t=>{
    const f=await fixture(t),a=await f.session('Host'),b=await f.session('Member'),c=await f.session('Outsider');
    const room=(await f.createRoom(a)).body.room;await f.join(room,b);const photo=(await f.upload(room,b,'members')).body.photo;
    await f.request(`/rooms/${room.id}/leave`,{token:a.token,method:'POST',data:{}});await f.restart();
    const listing=await f.request('/rooms',{token:a.token});assert.equal(listing.body.rooms.length,1);assert.equal(listing.body.rooms[0].role,'host');assert.equal(listing.body.rooms[0].joined,false);
    assert.equal((await f.request('/rooms/'+room.id,{token:a.token})).status,404);assert.equal((await f.request(photo.imageUrl,{token:a.token})).status,404);
    const closed=await f.request(`/rooms/${room.id}/close`,{token:a.token,method:'POST',data:{revision:1}});assert.equal(closed.status,200);assert.equal(closed.body.room.joined,false);
    assert.equal((await f.join(room,c)).status,409);assert.equal((await f.request('/rooms/'+room.id,{token:a.token})).status,404);assert.equal((await f.request(photo.imageUrl,{token:a.token})).status,404);
    assert.equal((await f.request(photo.imageUrl,{token:b.token})).status,200);
  });

  test(`${label}: departed members retain only historical metadata and cursor access, including after restart`,async t=>{
    const f=await fixture(t),host=await f.session('Host'),guest=await f.session('Guest'),outside=await f.session('Outside');
    const room=(await f.createRoom(host)).body.room,foreign=(await f.createRoom(outside)).body.room;
    await f.join(room,guest);const shared=(await f.upload(room,host,'members')).body.photo,own=(await f.upload(room,guest,'private')).body.photo;
    await f.request(`/rooms/${room.id}/leave`,{token:guest.token,method:'POST',data:{}});
    for(let pass=0;pass<2;pass++){
      if(pass)await f.restart();
      const listing=await f.request('/rooms',{token:guest.token});assert.equal(listing.status,200);assert.equal(listing.body.rooms.length,1);
      const history=listing.body.rooms[0];assert.equal(history.id,room.id);assert.equal(history.role,'member');assert.equal(history.joined,false);
      assert.deepEqual(Object.keys(history).sort(),['id','code','title','venue','songId','status','revision','createdAt','expiresAt','capacity','role','joined','entryState'].sort());
      assert.equal(history.entryState,'left');
      assert.equal((await f.request('/rooms?cursor='+room.id,{token:guest.token})).status,200);
      assert.equal((await f.request('/rooms?cursor='+foreign.id,{token:guest.token})).status,400);
      assert.equal((await f.request('/rooms?cursor='+room.id,{token:outside.token})).status,400);
      assert.equal((await f.request('/rooms/'+room.id,{token:guest.token})).status,404);
      assert.equal((await f.request(shared.imageUrl,{token:guest.token})).status,404);
      assert.equal((await f.request(own.imageUrl,{token:guest.token})).status,200);
    }
    assert.equal((await f.join(room,guest,false)).status,400);assert.equal((await f.join(room,guest)).status,200);
    let listing=await f.request('/rooms',{token:guest.token});assert.equal(listing.body.rooms.length,1);assert.equal(listing.body.rooms[0].joined,true);
    await f.request(`/rooms/${room.id}/leave`,{token:guest.token,method:'POST',data:{}});
    await f.request(`/rooms/${room.id}/close`,{token:host.token,method:'POST',data:{revision:1}});
    listing=await f.request('/rooms',{token:guest.token});assert.equal(listing.body.rooms[0].joined,false);assert.equal(listing.body.rooms[0].status,'closed');
    assert.equal((await f.join(room,guest)).status,409);assert.equal((await f.request('/rooms/'+room.id,{token:guest.token})).status,404);
  });

}
