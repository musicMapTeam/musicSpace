import {randomUUID} from 'node:crypto';
import {socialAllowedSQL} from './event-social.js';
const ID='[0-9a-f-]{36}',valid=x=>typeof x==='string'&&new RegExp('^'+ID+'$').test(x);
// Bind consent to the friendship and both block generations. Unblocking or
// becoming friends again must never resurrect an old creation's permissions.
const relation=alias=>`EXISTS(SELECT 1 FROM event_social_pairs s WHERE s.id=${alias}.pair_id AND s.status='accepted' AND s.revision=${alias}.pair_revision
 AND ${socialAllowedSQL(alias+'.a_id',alias+'.b_id')}
 AND COALESCE((SELECT revision FROM event_social_blocks WHERE actor_id=s.low_id AND target_id=s.high_id),0)=${alias}.low_block_revision
 AND COALESCE((SELECT revision FROM event_social_blocks WHERE actor_id=s.high_id AND target_id=s.low_id),0)=${alias}.high_block_revision)`;
const materials=alias=>`NOT EXISTS(SELECT 1 FROM event_corner_contributions d WHERE d.corner_id=${alias}.id AND d.photo_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM event_photos p WHERE p.id=d.photo_id AND p.owner_id=d.user_id AND p.revision=d.photo_revision AND p.deleted_at IS NULL))`;
export async function handleEventCorners(c){
 const {request,path,method,user,db,stmt,get,now,rate,mutate,readJSON,keys,revision,fail,json,env,headers}=c;
 const route=new RegExp(`^/corners/(${ID})(?:/(join|contribution|confirm|save|withdraw|photos/(${ID})/image))?$`).exec(path);
 if(path!=='/corners'&&!route)return null;
 const id=route?.[1],action=route?.[2];
 const owned=()=>get('SELECT * FROM event_corners WHERE id=? AND (a_id=? OR b_id=?)',id,user.id,user.id);
 const guard=(row,{active=true,complete=false,material=false}={})=>({sql:`EXISTS(SELECT 1 FROM event_corners c WHERE c.id=? AND c.revision=? AND c.status=? AND ${relation('c')}${active?' AND c.b_joined=1':''}${material?' AND '+materials('c'):''}${complete?' AND c.a_confirm=c.revision AND c.b_confirm=c.revision':''})`,args:[row.id,row.revision,row.status]});
 async function requireCorner({active=true}={}){const row=await owned();if(!row||row.status==='withdrawn'||!await get(`SELECT 1 FROM event_corners c WHERE c.id=? AND ${relation('c')}`,id))fail(404,'CORNER_UNAVAILABLE','共同创作已不可用，请重新读取。');if(active&&(row.status!=='active'||!row.b_joined))fail(403,'CORNER_JOIN_REQUIRED','双方需要先明确参与，才能一起编辑。');return row;}
 if(path==='/corners'&&method==='GET'){
  const result=await db.batch([stmt(`SELECT c.*,${relation('c')} AS allowed,EXISTS(SELECT 1 FROM event_corner_saves v WHERE v.corner_id=c.id AND v.user_id=?) AS has_saved FROM event_corners c WHERE c.a_id=? OR c.b_id=? ORDER BY c.created_at DESC,c.id DESC LIMIT 50`,user.id,user.id,user.id)]);
  return json(200,{actorId:user.id,corners:result[0].results.map(r=>({id:r.id,revision:r.revision,status:r.allowed?r.status:'unavailable',joined:r.a_id===user.id||!!r.b_joined,hasSaved:!!r.has_saved}))});
 }
 if(path==='/corners'&&method==='POST'){
  const data=await readJSON(request);keys(data,['peerId','participationConsent']);if(!valid(data.peerId)||data.peerId===user.id)fail(400,'PEER_REQUIRED','请选择一位双向朋友。');if(data.participationConsent!==true)fail(400,'PARTICIPATION_CONSENT_REQUIRED','请明确同意展示自己的署名和小人。');await rate('corner-create:'+user.id,10,3600000);
  const [low,high]=[user.id,data.peerId].sort();
  return mutate(data,async()=>{
   const pair=await get(`SELECT s.*,COALESCE((SELECT revision FROM event_social_blocks WHERE actor_id=s.low_id AND target_id=s.high_id),0) AS low_block,COALESCE((SELECT revision FROM event_social_blocks WHERE actor_id=s.high_id AND target_id=s.low_id),0) AS high_block FROM event_social_pairs s WHERE s.low_id=? AND s.high_id=? AND s.status='accepted' AND ${socialAllowedSQL('s.low_id','s.high_id')}`,low,high);
   if(!pair)fail(403,'FRIEND_REQUIRED','仅当前双向朋友且未屏蔽时可以邀请共同创作。');
   const old=await get("SELECT id,revision FROM event_corners WHERE pair_id=? AND pair_revision=? AND low_block_revision=? AND high_block_revision=? AND status!='withdrawn'",pair.id,pair.revision,pair.low_block,pair.high_block);if(old)return{body:{cornerId:old.id,revision:old.revision}};
   const cornerId=randomUUID(),sql=`EXISTS(SELECT 1 FROM event_social_pairs s WHERE s.id=? AND s.revision=? AND s.status='accepted' AND ${socialAllowedSQL('s.low_id','s.high_id')} AND COALESCE((SELECT revision FROM event_social_blocks WHERE actor_id=s.low_id AND target_id=s.high_id),0)=? AND COALESCE((SELECT revision FROM event_social_blocks WHERE actor_id=s.high_id AND target_id=s.low_id),0)=?)`;
   return{status:201,body:{cornerId,revision:1},guard:{sql,args:[pair.id,pair.revision,pair.low_block,pair.high_block]},statements:[stmt('INSERT INTO event_corners(id,pair_id,pair_revision,low_block_revision,high_block_revision,a_id,b_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',cornerId,pair.id,pair.revision,pair.low_block,pair.high_block,user.id,data.peerId,now(),now()),stmt('INSERT INTO event_corner_contributions(corner_id,user_id,author_name,avatar) VALUES(?,?,?,?)',cornerId,user.id,user.name,user.avatar)]};
  });
 }
 if(!action&&method==='GET'){
  const result=await db.batch([
   stmt(`SELECT c.*,${relation('c')} AS allowed,${materials('c')} AS materials_valid FROM event_corners c WHERE c.id=? AND (c.a_id=? OR c.b_id=?)`,id,user.id,user.id),
   stmt(`SELECT d.* FROM event_corner_contributions d JOIN event_corners c ON c.id=d.corner_id WHERE c.id=? AND (c.a_id=? OR c.b_id=?) AND c.status!='withdrawn' AND ${relation('c')} AND (c.b_joined=1 OR d.user_id=?)`,id,user.id,user.id,user.id),
   stmt('SELECT content_revision FROM event_corner_saves WHERE corner_id=? AND user_id=?',id,user.id)
  ]),row=result[0].results[0];
  if(!row||!row.allowed)fail(404,'CORNER_UNAVAILABLE','这份共同创作当前不可读取。');
  const available=row.status!=='withdrawn',joint=available&&!!row.b_joined,materialValid=!!row.materials_valid,eligible=joint&&materialValid&&row.a_confirm===row.revision&&row.b_confirm===row.revision;
  const contributions=available?result[1].results.filter(d=>materialValid||d.user_id===user.id).map(d=>({userId:d.user_id,name:d.author_name,avatar:JSON.parse(d.avatar),note:d.note,photo:materialValid&&d.photo_id?{id:d.photo_id,revision:d.photo_revision,imageUrl:`/api/event/corners/${id}/photos/${d.photo_id}/image`}:null})):[];
  return json(200,{actorId:user.id,corner:{id,revision:row.revision,status:row.status,joined:row.a_id===user.id||!!row.b_joined,myConfirmed:(row.a_id===user.id?row.a_confirm:row.b_confirm)===row.revision,peerConfirmed:(row.a_id===user.id?row.b_confirm:row.a_confirm)===row.revision,materialValid,eligible,ownSaved:eligible&&result[2].results.some(v=>v.content_revision===row.revision)},contributions});
 }
 if(action?.startsWith('photos/')&&method==='GET'){
  const photoId=route[3],readable=()=>get(`SELECT p.* FROM event_photos p JOIN event_corner_contributions d ON d.photo_id=p.id AND d.user_id=p.owner_id AND d.photo_revision=p.revision JOIN event_corners c ON c.id=d.corner_id WHERE c.id=? AND p.id=? AND (c.a_id=? OR c.b_id=?) AND c.status='active' AND c.b_joined=1 AND p.deleted_at IS NULL AND ${relation('c')} AND ${materials('c')}`,id,photoId,user.id,user.id);
  const photo=await readable();if(!photo)fail(404,'PHOTO_UNAVAILABLE','素材已不可读取。');if(!env.PHOTOS?.get)fail(503,'PHOTO_SERVICE_UNAVAILABLE','照片暂时不可读取。');const object=await env.PHOTOS.get(photo.photo_key);if(!object)fail(503,'PHOTO_SERVICE_UNAVAILABLE','照片暂时不可读取。');const current=await readable();if(!current||current.revision!==photo.revision||current.photo_key!==photo.photo_key){await object.body?.cancel?.();fail(404,'PHOTO_UNAVAILABLE','素材许可已改变。');}return new Response(object.body,{headers:{...headers,'Content-Type':'image/jpeg'}});
 }
 if(method!=='POST'||!['join','contribution','confirm','save','withdraw'].includes(action))return null;
 const data=await readJSON(request);
 if(action==='withdraw'){
  keys(data,['revision']);const row=await owned();if(!row)fail(404,'CORNER_UNAVAILABLE','创作不存在。');
  return mutate(data,async()=>{revision(row,data.revision);return {body:{cornerId:id,withdrawn:true},guard:{sql:'EXISTS(SELECT 1 FROM event_corners WHERE id=? AND revision=? AND (a_id=? OR b_id=?))',args:[id,row.revision,user.id,user.id]},statements:[stmt("UPDATE event_corners SET status='withdrawn',revision=revision+1,a_confirm=NULL,b_confirm=NULL,updated_at=? WHERE id=? AND status!='withdrawn'",now(),id)]};});
 }
 const row=await requireCorner({active:action!=='join'});
 if(action==='join'){
  keys(data,['revision','participationConsent']);if(data.participationConsent!==true)fail(400,'PARTICIPATION_CONSENT_REQUIRED','请本人明确参与。');if(user.id!==row.b_id)fail(403,'INVITEE_REQUIRED','由收到邀请的人本人选择。');
  return mutate(data,async()=>{revision(row,data.revision);return {body:{cornerId:id,joined:true},guard:guard(row,{active:false}),statements:row.b_joined?[]:[stmt("UPDATE event_corners SET status='active',b_joined=1,revision=revision+1,a_confirm=NULL,b_confirm=NULL,updated_at=? WHERE id=?",now(),id),stmt('INSERT INTO event_corner_contributions(corner_id,user_id,author_name,avatar) VALUES(?,?,?,?)',id,user.id,user.name,user.avatar)]};});
 }
 if(action==='contribution'){
  keys(data,['revision','note','photoId','shareConsent']);if(data.shareConsent!==true)fail(400,'SHARE_CONSENT_REQUIRED','请明确同意向这位共同创作者展示本次素材。');if(typeof data.note!=='string'||[...data.note].length>200||/[\p{Cc}\u2028\u2029\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(data.note))fail(400,'NOTE_INVALID','留言请填写不超过200字的单行文字。');if(data.photoId!==null&&!valid(data.photoId))fail(400,'PHOTO_INVALID','请明确选择本人照片或不带照片。');
  const photo=data.photoId?await get('SELECT id,revision FROM event_photos WHERE id=? AND owner_id=? AND deleted_at IS NULL',data.photoId,user.id):null;if(data.photoId&&!photo)fail(404,'OWN_PHOTO_REQUIRED','只能选择本人仍可用的照片。');
  const operationGuard=guard(row);if(photo){operationGuard.sql+=` AND EXISTS(SELECT 1 FROM event_photos WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL)`;operationGuard.args.push(photo.id,user.id,photo.revision);}
  return mutate(data,async()=>{revision(row,data.revision);return {body:{cornerId:id,revision:row.revision+1},guard:operationGuard,statements:[stmt('UPDATE event_corner_contributions SET author_name=?,avatar=?,note=?,photo_id=?,photo_revision=? WHERE corner_id=? AND user_id=?',user.name,user.avatar,data.note.trim(),photo?.id||null,photo?.revision||null,id,user.id),stmt('UPDATE event_corners SET revision=revision+1,a_confirm=NULL,b_confirm=NULL,updated_at=? WHERE id=?',now(),id)]};});
 }
 keys(data,action==='confirm'?['revision','consent']:['revision','saveConsent']);if(data[action==='confirm'?'consent':'saveConsent']!==true)fail(400,'CONFIRMATION_REQUIRED','请确认当前共同成果及双方署名。');
 if(!await get(`SELECT 1 FROM event_corners c WHERE c.id=? AND ${materials('c')}`,id))fail(409,'MATERIAL_CHANGED','素材已撤回或改变，请作者重新选择。');
 if(action==='confirm'){const field=user.id===row.a_id?'a_confirm':'b_confirm';return mutate(data,async()=>{revision(row,data.revision);return {body:{cornerId:id,confirmed:true,revision:row.revision},guard:guard(row,{material:true}),statements:[stmt(`UPDATE event_corners SET ${field}=? WHERE id=?`,row.revision,id)]};});}
 if(row.a_confirm!==row.revision||row.b_confirm!==row.revision)fail(409,'BOTH_CONFIRM_REQUIRED','双方需确认同一版本后再保存。');
 return mutate(data,async()=>{revision(row,data.revision);return {body:{cornerId:id,saved:true,revision:row.revision},guard:guard(row,{complete:true,material:true}),statements:[stmt('INSERT INTO event_corner_saves(id,corner_id,user_id,content_revision,created_at) VALUES(?,?,?,?,?) ON CONFLICT(corner_id,user_id,content_revision) DO NOTHING',randomUUID(),id,user.id,row.revision,now())]};});
}
