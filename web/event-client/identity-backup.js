// Local-only encryption helpers. They do not read storage, transmit credentials,
// save files, install an identity, or promise recovery without this backup.
const MAGIC='music-space-identity-backup',VERSION=1,ITERATIONS=600000;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const fail=message=>{throw Error(message);};
function originValue(value){
 if(typeof value!=='string'||value.length>200)fail('服务地址无效。');
 let url;try{url=new URL(value);}catch{fail('服务地址无效。');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.origin!==value)fail('备份只能绑定一个明确的房间服务来源。');
 return value;
}
function passwordValue(value){if(typeof value!=='string'||[...value].length<12||[...value].length>128||/[\p{Cs}\u0000-\u001f\u007f]/u.test(value))fail('备份密码需要12至128个字符');return value;}
function cryptoValue(value){if(!value?.subtle||typeof value.getRandomValues!=='function')fail('浏览器缺少安全加密能力，无法备份');return value;}
function base64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes)));}
function decode(value,min,max){
 if(typeof value!=='string'||value.length>max*2||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))fail('备份文件格式不正确。');
 let result;try{result=Uint8Array.from(atob(value),char=>char.charCodeAt(0));}catch{fail('备份文件格式不正确。');}
 if(result.length<min||result.length>max||base64(result)!==value)fail('备份文件格式不正确。');return result;
}
const aad=origin=>encoder.encode(`${MAGIC}\n${VERSION}\n${origin}\nPBKDF2-SHA-256:${ITERATIONS}\nAES-GCM-256`);
async function keyFor(crypto,password,salt){
 const bytes=encoder.encode(passwordValue(password));
 try{const seed=await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey']);return await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},seed,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}finally{bytes.fill(0);}
}
function parseEnvelope(text,expectedOrigin){
 if(typeof text!=='string'||text.length>8192)fail('请选择有效的 Music Space 身份备份文件。');
 let value;try{value=JSON.parse(text);}catch{fail('备份文件无法读取。');}
 if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!=='cipher,ciphertext,iterations,kdf,magic,nonce,origin,salt,version'||value.magic!==MAGIC||value.version!==VERSION||value.kdf!=='PBKDF2-SHA-256'||value.iterations!==ITERATIONS||value.cipher!=='AES-GCM-256')fail('不支持这份备份的格式');
 if(originValue(value.origin)!==originValue(expectedOrigin))fail('这份备份属于另一个服务地址');
 return {...value,salt:decode(value.salt,16,16),nonce:decode(value.nonce,12,12),ciphertext:decode(value.ciphertext,16,4096)};
}

export async function encryptIdentityBackup(session,password,{origin,crypto=globalThis.crypto}={}){
 origin=originValue(origin);crypto=cryptoValue(crypto);passwordValue(password);
 if(!session||!TOKEN.test(session.token)||!ID.test(session.user?.id))fail('请先确认你的小人身份');
 const salt=crypto.getRandomValues(new Uint8Array(16)),nonce=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(crypto,password,salt);
 const bytes=encoder.encode(JSON.stringify({actorId:session.user.id,token:session.token,origin,createdAt:new Date().toISOString()}));
 try{const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:aad(origin),tagLength:128},key,bytes);
  return JSON.stringify({magic:MAGIC,version:VERSION,origin,kdf:'PBKDF2-SHA-256',iterations:ITERATIONS,cipher:'AES-GCM-256',salt:base64(salt),nonce:base64(nonce),ciphertext:base64(ciphertext)},null,2);
 }finally{bytes.fill(0);}
}

export async function decryptIdentityBackup(text,password,{origin,crypto=globalThis.crypto}={}){
 // Origin is checked before any expensive derivation and before the caller can
 // obtain a credential to submit. Origin is also authenticated by the GCM tag.
 const envelope=parseEnvelope(text,origin);crypto=cryptoValue(crypto);passwordValue(password);
 const key=await keyFor(crypto,password,envelope.salt);let plaintext;
 try{plaintext=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:envelope.nonce,additionalData:aad(envelope.origin),tagLength:128},key,envelope.ciphertext));}
 catch{fail('密码不正确或文件已损坏');}
 try{const value=JSON.parse(decoder.decode(plaintext));if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!=='actorId,createdAt,origin,token'||!ID.test(value.actorId)||!TOKEN.test(value.token)||value.origin!==origin||!Number.isFinite(Date.parse(value.createdAt)))fail('备份内容无效');
  // The integration must verify /api/avatar/session at this exact origin and
  // require explicit replacement consent before writing SESSION_KEY.
  return {actorId:value.actorId,token:value.token,origin:value.origin,createdAt:value.createdAt};
 }finally{plaintext.fill(0);}
}
