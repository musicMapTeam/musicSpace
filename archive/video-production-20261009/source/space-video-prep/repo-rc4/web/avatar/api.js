export class ApiError extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code;}}
const OP_KEY='music-space-avatar-operations:v1';let operations={};try{const value=JSON.parse(localStorage.getItem(OP_KEY));operations=value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([k,v])=>/^[a-f0-9]{64}$/.test(k)&&typeof v==='string'&&v.length<=100)):{};}catch{}
function saveOperations(){try{localStorage.setItem(OP_KEY,JSON.stringify(operations));}catch{}}
async function operationKey(method,path,body){const bytes=new TextEncoder().encode(JSON.stringify([method,path,body]));const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');if(!operations[hash]){if(Object.keys(operations).length>40)delete operations[Object.keys(operations)[0]];operations[hash]=crypto.randomUUID();saveOperations();}return {hash,key:operations[hash]};}
export async function request(path,{method='GET',body,token,key,signal}={}){
 body=body===undefined?undefined:JSON.parse(JSON.stringify(body));
 const op=method==='GET'?null:await operationKey(method,path,body);let r;
 try{r=await fetch(`/api/avatar${path}`,{method,signal:signal||AbortSignal.timeout(20000),headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...(method!=='GET'?{'Idempotency-Key':key||op.key}: {})},...(body?{body:JSON.stringify(body)}:{})});}catch(e){if(e.name==='AbortError'||e.name==='TimeoutError')throw new ApiError('连接暂时没有回应。草稿仍在，请稍后重试。',0,'NETWORK');throw new ApiError('网络暂时没接上。你的本机草稿还在，联网后可以重试。',0,'NETWORK');}
 let data;try{data=await r.json();}catch{throw new ApiError('共创服务暂时不可用，仍然可以在本机创作。',r.status,'UNAVAILABLE');}
 if(op&&(r.ok||(r.status>=400&&r.status<500&&r.status!==429))){delete operations[op.hash];saveOperations();}
 if(!r.ok)throw new ApiError(data.error?.message||'操作没有完成，请重试',r.status,data.error?.code);return data;
}
export async function photoBlob(url,token){const r=await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!r.ok)throw new ApiError('照片暂时无法读取，请重新连接',r.status,'PHOTO');return URL.createObjectURL(await r.blob());}
