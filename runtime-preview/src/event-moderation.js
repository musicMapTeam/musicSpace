import {randomUUID} from 'node:crypto';
import {socialAllowedSQL} from './event-social.js';

const ID='[0-9a-f-]{36}',validID=value=>typeof value==='string'&&new RegExp(`^${ID}$`).test(value);
const combine=(...guards)=>({sql:guards.map(g=>`(${g.sql})`).join(' AND '),args:guards.flatMap(g=>g.args)});
const categories=['harassment','unwanted-content','privacy','spam','other'];
const reportJSON=row=>({id:row.id,roomId:row.room_id,targetId:row.target_id,targetName:row.target_name,photoId:row.photo_id,category:row.category,details:row.details,status:row.status,revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,resolvedAt:row.resolved_at});
const exclusionJSON=row=>({roomId:row.room_id,userId:row.user_id,targetName:row.target_name,revision:row.revision,active:!row.restored_at,createdAt:row.created_at,updatedAt:row.updated_at,restoredAt:row.restored_at});

/** Feedback goes only to this room's host. There is no platform moderator,
 * evidence image copy, private media grant, or automatic finding of wrongdoing. */
export async function handleEventModeration(c){
 const {request,path,method,user,stmt,get,now,rate,mutate,readJSON,keys,revision,fail,json,endExchanges}=c;
 const roomRoute=new RegExp(`^/rooms/(${ID})/(reports|moderation(?:/(reports|exclusions))?|exclusions/(${ID}))$`).exec(path);
 const reportRoute=new RegExp(`^/reports/(${ID})(?:/(withdraw|resolve))?$`).exec(path);
 if(path!=='/reports'&&!roomRoute&&!reportRoute)return null;
 const hostGuard=roomId=>({sql:'EXISTS (SELECT 1 FROM event_rooms WHERE id = ? AND host_id = ?)',args:[roomId,user.id]});
 const activeGuard=(roomId,id)=>({sql:'EXISTS (SELECT 1 FROM event_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL)',args:[roomId,id]});
 const unblocked=(a,b)=>({sql:socialAllowedSQL('?','?'),args:[a,b,b,a]});
 const satisfies=guard=>get(`SELECT 1 AS ok WHERE ${guard.sql}`,...guard.args);
 async function hostRoom(id){const room=await get('SELECT * FROM event_rooms WHERE id = ? AND host_id = ?',id,user.id);if(!room)fail(404,'ROOM_NOT_FOUND','现场不存在，或当前身份不是本场房主。');return room;}
 function queryCursor(){const query=[...new URL(request.url).searchParams];if(query.length>1||query.some(([key,value])=>key!=='cursor'||!validID(value)))fail(400,'INVALID_CURSOR','请提供一个有效分页位置。');return query[0]?.[1]||null;}
 async function reportsPage(roomId=null){
  const cursor=queryCursor(),scope=roomId?'room_id = ?':'reporter_id = ?',owner=roomId||user.id;
  const last=cursor&&await get(`SELECT id,created_at FROM event_reports WHERE id = ? AND ${scope}`,cursor,owner);if(cursor&&!last)fail(400,'INVALID_CURSOR','分页位置不属于当前范围。');
  const rows=(await stmt(`SELECT * FROM event_reports WHERE ${scope}${last?' AND (created_at < ? OR (created_at = ? AND id < ?))':''} ORDER BY created_at DESC,id DESC LIMIT 25`,owner,...(last?[last.created_at,last.created_at,last.id]:[])).all()).results;
  return {items:rows.slice(0,24).map(reportJSON),nextCursor:rows.length>24?rows[23].id:null};
 }
 async function exclusionsPage(roomId){
  const cursor=queryCursor(),last=cursor&&await get('SELECT user_id,created_at FROM event_room_exclusions WHERE room_id = ? AND user_id = ?',roomId,cursor);if(cursor&&!last)fail(400,'INVALID_CURSOR','分页位置不属于本場排除记录。');
  const rows=(await stmt(`SELECT * FROM event_room_exclusions WHERE room_id = ?${last?' AND (created_at < ? OR (created_at = ? AND user_id < ?))':''} ORDER BY created_at DESC,user_id DESC LIMIT 25`,roomId,...(last?[last.created_at,last.created_at,last.user_id]:[])).all()).results;
  return {items:rows.slice(0,24).map(exclusionJSON),nextCursor:rows.length>24?rows[23].user_id:null};
 }
 if(method==='GET'&&path==='/reports')return json(200,{actorId:user.id,reports:await reportsPage()});
 if(method==='GET'&&roomRoute&&roomRoute[2].startsWith('moderation')){
  const room=await hostRoom(roomRoute[1]);
  if(!roomRoute[3]){if(new URL(request.url).search)fail(400,'INVALID_CURSOR','总览不接受分页参数。');return json(200,{actorId:user.id,room:{id:room.id,title:room.title,hostId:room.host_id},reports:await reportsPage(room.id),exclusions:await exclusionsPage(room.id)});}
  return json(200,{actorId:user.id,roomId:room.id,...(roomRoute[3]==='reports'?{reports:await reportsPage(room.id)}:{exclusions:await exclusionsPage(room.id)})});
 }
 if(method==='POST'&&roomRoute?.[2]==='reports'){
  const data=await readJSON(request);keys(data,['targetId','photoId','category','details','reportConsent']);
  if(!validID(data.targetId)||data.photoId!==null&&data.photoId!==undefined&&!validID(data.photoId)||!categories.includes(data.category))fail(400,'INVALID_INPUT','请选择本场具体成员、内容和反馈分类。');
  if(data.targetId===user.id)fail(400,'SELF_REPORT','不能向房主反馈自己。');
  if(data.reportConsent!==true)fail(400,'REPORT_CONSENT_REQUIRED','请确认把说明与目标标识交给本场房主。');
  if(typeof data.details!=='string'||[...data.details.trim()].length<1||[...data.details].length>280||/[\p{Cs}\u0000-\u0008\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(data.details))fail(400,'INVALID_INPUT','请用1至280字说明现场情况，不要附上私聊或联系方式。');
  return mutate(data,async()=>{
   const roomId=roomRoute[1],room=await get('SELECT * FROM event_rooms WHERE id = ?',roomId);if(!room)fail(404,'ROOM_NOT_FOUND','现场不存在。');
   if(data.targetId===room.host_id)fail(409,'HOST_FEEDBACK_UNAVAILABLE','这份反馈会由房主本人处理，目前没有独立平台申诉渠道。你可以选择屏蔽或离场。');
   const visible=combine(activeGuard(roomId,user.id),activeGuard(roomId,data.targetId),unblocked(user.id,data.targetId),...(data.photoId?[{sql:"EXISTS (SELECT 1 FROM event_photos WHERE id = ? AND room_id = ? AND owner_id = ? AND deleted_at IS NULL AND visibility = 'members')",args:[data.photoId,roomId,data.targetId]}]:[]));
   if(!await satisfies(visible))fail(404,'CONTENT_UNAVAILABLE','此内容目前不在你的本场可见范围内。');
   const unique={sql:"NOT EXISTS (SELECT 1 FROM event_reports WHERE room_id = ? AND reporter_id = ? AND target_id = ? AND status = 'open')",args:[roomId,user.id,data.targetId]};
   if(!await satisfies(unique))fail(409,'REPORT_EXISTS','你已经向房主反馈过这个人，请先查看原记录。');
   await rate(`report:${user.id}`,5,60*60_000);await rate(`report-room:${roomId}:${user.id}`,10,24*60*60_000);
   const target=await get('SELECT name FROM avatar_users WHERE id = ?',data.targetId),timestamp=now();
   const row={id:randomUUID(),room_id:roomId,reporter_id:user.id,target_id:data.targetId,photo_id:data.photoId||null,target_name:target.name,category:data.category,details:data.details.trim(),status:'open',revision:1,created_at:timestamp,updated_at:timestamp,resolved_at:null};
   return {status:201,body:{actorId:user.id,report:reportJSON(row)},guard:combine(visible,unique),statements:[stmt("INSERT INTO event_reports (id,room_id,reporter_id,target_id,photo_id,target_name,category,details,status,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'open',1,?,?)",row.id,roomId,user.id,row.target_id,row.photo_id,row.target_name,row.category,row.details,timestamp,timestamp)]};
  });
 }
 if(reportRoute){
  const id=reportRoute[1],action=reportRoute[2],row=await get('SELECT p.* FROM event_reports p JOIN event_rooms r ON r.id = p.room_id WHERE p.id = ? AND (p.reporter_id = ? OR r.host_id = ?)',id,user.id,user.id);
  if(!row)fail(404,'REPORT_NOT_FOUND','反馈不存在，或你无权查看。');
  if(method==='GET'&&!action)return json(200,{actorId:user.id,report:reportJSON(row)});
  if(method==='POST'&&['withdraw','resolve'].includes(action)){
   const data=await readJSON(request);keys(data,action==='resolve'?['revision','resolution']:['revision']);
   if(action==='withdraw'&&row.reporter_id!==user.id)fail(403,'REPORT_ROLE_REQUIRED','只能撤回自己提交的反馈。');
   if(action==='resolve'){await hostRoom(row.room_id);if(data.resolution!=='dismissed')fail(400,'INVALID_INPUT','移出成员请使用明确的移出操作；此操作只结束反馈处理。');}
   return mutate(data,async()=>{const current=await get('SELECT * FROM event_reports WHERE id = ?',id);revision(current,data.revision);if(current.status!=='open')fail(409,'REPORT_RESOLVED','这项反馈已经结束。');
    const timestamp=now(),status=action==='withdraw'?'withdrawn':'dismissed';
    return {body:{actorId:user.id,report:reportJSON({...current,status,revision:current.revision+1,updated_at:timestamp,resolved_at:timestamp})},guard:combine({sql:"EXISTS (SELECT 1 FROM event_reports WHERE id = ? AND revision = ? AND status = 'open')",args:[id,current.revision]},action==='resolve'?hostGuard(current.room_id):{sql:'EXISTS (SELECT 1 FROM event_reports WHERE id = ? AND reporter_id = ?)',args:[id,user.id]}),statements:[stmt('UPDATE event_reports SET status = ?,revision = revision + 1,updated_at = ?,resolved_at = ? WHERE id = ?',status,timestamp,timestamp,id)]};
   });
  }
 }
 if(roomRoute?.[4]&&['POST','DELETE'].includes(method)){
  const roomId=roomRoute[1],targetId=roomRoute[4];await hostRoom(roomId);if(targetId===user.id)fail(400,'HOST_EXCLUSION','房主不能移出自己。');
  const data=await readJSON(request);keys(data,method==='POST'?['membershipJoinedAt','reportId','reportRevision','removalConsent']:['revision','allowReentryConsent']);
  if(method==='POST'&&data.removalConsent!==true||method==='DELETE'&&data.allowReentryConsent!==true)fail(400,'MODERATION_CONSENT_REQUIRED','请明确确认本场成员管理操作。');
  return mutate(data,async()=>{
   const existing=await get('SELECT * FROM event_room_exclusions WHERE room_id = ? AND user_id = ?',roomId,targetId),timestamp=now();
   if(method==='DELETE'){
    if(!existing)fail(404,'EXCLUSION_NOT_FOUND','本场没有这项排除记录。');revision(existing,data.revision);if(existing.restored_at)fail(409,'EXCLUSION_RESOLVED','已经允许此身份重新申请加入。');
    const updated={...existing,restored_at:timestamp,updated_at:timestamp,revision:existing.revision+1};
    return {body:{actorId:user.id,exclusion:exclusionJSON(updated)},guard:combine(hostGuard(roomId),{sql:'EXISTS (SELECT 1 FROM event_room_exclusions WHERE room_id = ? AND user_id = ? AND revision = ? AND restored_at IS NULL)',args:[roomId,targetId,existing.revision]}),statements:[stmt('UPDATE event_room_exclusions SET restored_at = ?,updated_at = ?,revision = revision + 1 WHERE room_id = ? AND user_id = ?',timestamp,timestamp,roomId,targetId)]};
   }
   const membership=await get('SELECT m.*,u.name FROM event_members m JOIN avatar_users u ON u.id = m.user_id WHERE room_id = ? AND user_id = ?',roomId,targetId);if(!membership)fail(404,'MEMBER_NOT_FOUND','这个身份未参加过本场。');
   let report=null,reviewGuard;
   if(data.reportId){if(!validID(data.reportId))fail(400,'INVALID_INPUT','反馈编号无效。');report=await get('SELECT * FROM event_reports WHERE id = ? AND room_id = ? AND target_id = ?',data.reportId,roomId,targetId);if(!report)fail(404,'REPORT_NOT_FOUND','反馈不属于这个现场和成员。');revision(report,data.reportRevision);if(report.status!=='open')fail(409,'REPORT_RESOLVED','反馈已结束，请重新核对。');reviewGuard={sql:"EXISTS (SELECT 1 FROM event_reports WHERE id = ? AND room_id = ? AND target_id = ? AND revision = ? AND status = 'open')",args:[report.id,roomId,targetId,report.revision]};}
   else{if(typeof data.membershipJoinedAt!=='string'||data.membershipJoinedAt!==membership.joined_at||membership.left_at)fail(409,'MEMBER_CHANGED','成员入场状态已变化，请重新读取名单。');reviewGuard=combine(activeGuard(roomId,user.id),{sql:'EXISTS (SELECT 1 FROM event_members WHERE room_id = ? AND user_id = ? AND joined_at = ? AND left_at IS NULL)',args:[roomId,targetId,data.membershipJoinedAt]});}
   const unchanged=existing?{sql:'EXISTS (SELECT 1 FROM event_room_exclusions WHERE room_id = ? AND user_id = ? AND revision = ?)',args:[roomId,targetId,existing.revision]}:{sql:'NOT EXISTS (SELECT 1 FROM event_room_exclusions WHERE room_id = ? AND user_id = ?)',args:[roomId,targetId]};
   const row={room_id:roomId,user_id:targetId,target_name:membership.name,revision:(existing?.revision||0)+1,created_at:existing?.created_at||timestamp,updated_at:timestamp,restored_at:null};
   return {body:{actorId:user.id,exclusion:exclusionJSON(row),report:report?reportJSON({...report,status:'resolved',revision:report.revision+1,updated_at:timestamp,resolved_at:timestamp}):null},guard:combine(hostGuard(roomId),reviewGuard,unchanged),statements:[
    stmt('INSERT INTO event_room_exclusions (room_id,user_id,target_name,revision,created_at,updated_at,restored_at) VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(room_id,user_id) DO UPDATE SET target_name = excluded.target_name,revision = excluded.revision,updated_at = excluded.updated_at,restored_at = NULL',roomId,targetId,row.target_name,row.revision,row.created_at,timestamp),
    stmt('UPDATE event_members SET left_at = ? WHERE room_id = ? AND user_id = ? AND left_at IS NULL',timestamp,roomId,targetId),
    stmt("UPDATE event_photos SET visibility = 'private',revision = revision + 1,updated_at = ? WHERE room_id = ? AND owner_id = ? AND visibility = 'members' AND deleted_at IS NULL",timestamp,roomId,targetId),
    ...endExchanges('room_id = ? AND (sender_id = ? OR recipient_id = ?)',[roomId,targetId,targetId],{pendingOnly:true}),
    ...(report?[stmt("UPDATE event_reports SET status = 'resolved',revision = revision + 1,updated_at = ?,resolved_at = ? WHERE id = ?",timestamp,timestamp,report.id)]:[]),
   ]};
  });
 }
 if(roomRoute?.[4]&&method==='GET'){
  await hostRoom(roomRoute[1]);const row=await get('SELECT * FROM event_room_exclusions WHERE room_id = ? AND user_id = ?',roomRoute[1],roomRoute[4]);if(!row)fail(404,'EXCLUSION_NOT_FOUND','本场没有这项排除记录。');return json(200,{actorId:user.id,exclusion:exclusionJSON(row)});
 }
 return null;
}
