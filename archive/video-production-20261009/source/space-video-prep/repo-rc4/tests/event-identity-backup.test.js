import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encryptIdentityBackup,decryptIdentityBackup} from '../web/event-client/identity-backup.js';

const session={token:'synthetic-test-token-only-'.padEnd(43,'x'),user:{id:'00000000-0000-4000-8000-000000000001',name:'Synthetic tester'}};
const origin='http://127.0.0.1:8787',password='Synthetic backup passphrase 2026';
test('identity backup encrypts only minimal identity material with fresh random salt/nonce and round-trips locally',async()=>{
 const first=await encryptIdentityBackup(session,password,{origin}),second=await encryptIdentityBackup(session,password,{origin});
 assert.ok(!first.includes(session.token));assert.ok(!first.includes(session.user.id));assert.ok(!first.includes(session.user.name));assert.ok(!first.includes(password));
 const a=JSON.parse(first),b=JSON.parse(second);assert.notEqual(a.salt,b.salt);assert.notEqual(a.nonce,b.nonce);assert.notEqual(a.ciphertext,b.ciphertext);
 const recovered=await decryptIdentityBackup(first,password,{origin});assert.equal(recovered.actorId,session.user.id);assert.equal(recovered.token,session.token);assert.equal(recovered.origin,origin);
});
test('identity backup refuses another service before crypto work and authenticates the origin against tampering',async()=>{
 const file=await encryptIdentityBackup(session,password,{origin});let cryptoCalls=0;const fake={getRandomValues(){cryptoCalls++;},subtle:{deriveKey(){cryptoCalls++;}}};
 await assert.rejects(decryptIdentityBackup(file,password,{origin:'https://unrelated.example',crypto:fake}),/另一个服务地址/);assert.equal(cryptoCalls,0);
 const forged=JSON.parse(file);forged.origin='https://unrelated.example';await assert.rejects(decryptIdentityBackup(JSON.stringify(forged),password,{origin:forged.origin}),/损坏/);
});
test('identity backup rejects wrong passwords and altered ciphertext without returning identity material',async()=>{
 const file=await encryptIdentityBackup(session,password,{origin});await assert.rejects(decryptIdentityBackup(file,'Wrong synthetic password',{origin}),/密码不正确/);
 const changed=JSON.parse(file),bytes=Uint8Array.from(atob(changed.ciphertext),c=>c.charCodeAt(0));bytes[0]^=1;changed.ciphertext=btoa(String.fromCharCode(...bytes));await assert.rejects(decryptIdentityBackup(JSON.stringify(changed),password,{origin}),/损坏/);
});
test('identity backup bounds file, algorithm and password input before expensive work',async()=>{
 const file=JSON.parse(await encryptIdentityBackup(session,password,{origin}));
 for(const change of[{iterations:1},{iterations:1000000000},{cipher:'AES-CBC'},{version:99},{extra:'unrecognized'},{nonce:'AAAA'},{salt:'!not-base64'},{ciphertext:''}])await assert.rejects(decryptIdentityBackup(JSON.stringify({...file,...change}),password,{origin}));
 await assert.rejects(decryptIdentityBackup('x'.repeat(8193),password,{origin}));
 await assert.rejects(encryptIdentityBackup(session,'short',{origin}),/12至128/);await assert.rejects(encryptIdentityBackup(session,'x'.repeat(129),{origin}),/12至128/);
 await assert.rejects(encryptIdentityBackup(session,password,{origin:'https://example.test/path'}),/来源/);await assert.rejects(encryptIdentityBackup(session,password,{origin,crypto:{}}),/安全加密能力/);
});
