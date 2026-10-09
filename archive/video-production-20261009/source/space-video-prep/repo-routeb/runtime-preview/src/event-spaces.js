import {randomUUID} from 'node:crypto';
import {socialAllowedSQL} from './event-social.js';
const UUID='[0-9a-f-]{36}';
/** Host organization. Activity metadata never grants venue/photo membership. */
export async function handleEventSpaces(c){
 const {request,path,method,user,stmt,get,now,mutate,readJSON,keys,revision,fail,json,db,rate}=c;
 const route=new RegExp(`^/communities/(${UUID})/(space|events)(?:/(${UUID}))?$`).exec(path);if(!route)return null;
 const [_,id,section,eventId]=route,space=await get('SELECT * FROM event_communities WHERE id=?',id);if(!space)fail(404,'COMMUNITY_NOT_FOUND','找不到这个长期空间。');
 const host=space.host_id===user.id,member={sql:"EXISTS(SELECT 1 FROM event_conversation_members WHERE kind='community' AND scope_id=? AND user_id=? AND left_at IS NULL AND removed_at IS NULL)",args:[id,user.id]};
 const access={sql:`(${host?'1=1':member.sql}) AND ${socialAllowedSQL('?','?')}`,args:[...(host?[]:member.args),user.id,space.host_id,space.host_id,user.id]};
 const writeGuard={sql:`${access.sql} AND EXISTS(SELECT 1 FROM event_communities WHERE id=? AND revision=? AND archived_at IS NULL)`,args:[...access.args,id,space.revision]};
 const valid=async g=>Boolean(await get(`SELECT 1 ok WHERE ${g.sql}`,...g.args));if(!await valid(access))fail(403,'SPACE_MEMBERSHIP_REQUIRED','退出、移除或屏蔽后不能继续读取活动资料。');
 const view=r=>({id:r.id,title:r.title,description:r.description,hostId:r.host_id,archived:Boolean(r.archived_at),revision:r.revision,code:r.code});
 const eventView=r=>({id:r.id,communityId:r.community_id,title:r.title,venue:r.venue,startsAt:r.starts_at,note:r.note,status:r.status,revision:r.revision,createdAt:r.created_at,room:r.room_id?{id:r.room_id,code:r.room_code,title:r.room_title,status:r.room_closed_at?'closed':r.room_expires_at<=now()?'expired':'open',joined:Boolean(r.my_joined),removed:Boolean(r.my_removed)}:null});
 if(section==='space'){
  if(eventId)return null;
  if(method==='GET'){const result=await db.batch([stmt(`SELECT 1 ok WHERE ${access.sql}`,...access.args),stmt('SELECT * FROM event_communities WHERE id=?',id)]);if(!result[0].results.length)fail(403,'SPACE_MEMBERSHIP_REQUIRED','读取时资格已变化。');return json(200,{actorId:user.id,space:view(result[1].results[0]),host,joined:Boolean(await valid(member))});}
  if(method==='POST'){const d=await readJSON(request);keys(d,['title','description','archived','revision','editConsent']);if(!host)fail(403,'SPACE_HOST_REQUIRED','只有主办方可以维护长期空间。');if(d.editConsent!==true)fail(400,'SPACE_CONSENT_REQUIRED','请明确确认更新空间资料和状态。');const title=text(d.title,40,true),description=text(d.description,300);if(typeof d.archived!=='boolean')fail(400,'INVALID_STATUS','请选择开放或归档。');return mutate(d,async()=>{revision(space,d.revision);const g={sql:'EXISTS(SELECT 1 FROM event_communities WHERE id=? AND host_id=? AND revision=?)',args:[id,user.id,d.revision]};return{body:{actorId:user.id,updated:true},guard:g,statements:[stmt('UPDATE event_communities SET title=?,description=?,archived_at=?,revision=revision+1 WHERE id=?',title,description,d.archived?now():null,id)]};});}
  return null;
 }
 const query=`SELECT e.*,r.code room_code,r.title room_title,r.closed_at room_closed_at,r.expires_at room_expires_at,(SELECT 1 FROM event_members m WHERE m.room_id=e.room_id AND m.user_id=? AND m.left_at IS NULL) my_joined,(SELECT 1 FROM event_room_exclusions x WHERE x.room_id=e.room_id AND x.user_id=? AND x.restored_at IS NULL) my_removed FROM event_community_events e LEFT JOIN event_rooms r ON r.id=e.room_id WHERE e.community_id=?`;
 if(method==='GET'&&!eventId){const results=await db.batch([stmt(`SELECT 1 ok WHERE ${access.sql}`,...access.args),stmt(query+' ORDER BY e.created_at DESC,e.id DESC LIMIT 100',user.id,user.id,id),stmt('SELECT r.id,r.title,r.venue,r.closed_at,r.expires_at,r.code FROM event_community_rooms link JOIN event_rooms r ON r.id=link.room_id WHERE link.community_id=? ORDER BY r.created_at DESC LIMIT 100',id)]);if(!results[0].results.length)fail(403,'SPACE_MEMBERSHIP_REQUIRED','读取时资格已变化。');return json(200,{actorId:user.id,events:results[1].results.map(eventView),linkedRooms:results[2].results,space:view(space),host});}
 if(method!=='POST')return null;
 if(!host)fail(403,'SPACE_HOST_REQUIRED','只有主办方可以组织活动。');
 const d=await readJSON(request);keys(d,eventId?['revision','action','roomId','organizeConsent']:['title','venue','startsAt','note','organizeConsent']);if(d.organizeConsent!==true)fail(400,'ORGANIZE_CONSENT_REQUIRED','请确认向本社群成员提供活动资料；现场入场和照片另行授权。');
 if(!await valid(writeGuard))fail(409,'SPACE_ARCHIVED','空间已归档或更新，请重新读取。');
 if(!eventId){const title=text(d.title,40,true),venue=text(d.venue,40),note=text(d.note,300),time=d.startsAt??null;if(time!==null&&(!Number.isSafeInteger(time)||time<Date.parse(now())-86400000||time>Date.parse(now())+366*86400000))fail(400,'INVALID_EVENT_TIME','活动时间需在过去一天到未来一年之间，也可留空。');return mutate(d,async()=>{await rate('space-event-create:'+user.id,10,86400000);const eventId=randomUUID();return{status:201,body:{actorId:user.id,eventId},guard:writeGuard,statements:[stmt('INSERT INTO event_community_events(id,community_id,title,venue,starts_at,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',eventId,id,title,venue,time,note,now(),now())]};});}
 const event=await get('SELECT * FROM event_community_events WHERE id=? AND community_id=?',eventId,id);if(!event)fail(404,'EVENT_NOT_FOUND','找不到这个活动。');
 if(!['cancel','link'].includes(d.action))fail(400,'INVALID_EVENT_ACTION','请选择取消预告或关联已创建的现场。');
 return mutate(d,async()=>{revision(event,d.revision);if(event.status!=='planned')fail(409,'EVENT_ALREADY_DECIDED','活动已关联或取消，不能覆盖已有决定。');const g={sql:`${writeGuard.sql} AND EXISTS(SELECT 1 FROM event_community_events WHERE id=? AND community_id=? AND revision=? AND status='planned')`,args:[...writeGuard.args,eventId,id,d.revision]};
  if(d.action==='cancel'){if(d.roomId!==undefined)fail(400,'INVALID_INPUT','取消预告不接收现场编号。');return{body:{actorId:user.id,cancelled:true},guard:g,statements:[stmt("UPDATE event_community_events SET status='cancelled',revision=revision+1,updated_at=? WHERE id=?",now(),eventId)]};}
  if(typeof d.roomId!=='string'||!new RegExp('^'+UUID+'$').test(d.roomId))fail(400,'INVALID_ROOM','请选择本人创建的现场。');
  const roomGuard={sql:`${g.sql} AND EXISTS(SELECT 1 FROM event_rooms WHERE id=? AND host_id=?) AND NOT EXISTS(SELECT 1 FROM event_community_rooms WHERE room_id=?) AND NOT EXISTS(SELECT 1 FROM event_community_events WHERE room_id=?)`,args:[...g.args,d.roomId,user.id,d.roomId,d.roomId]};if(!await valid(roomGuard))fail(409,'EVENT_LINK_CONFLICT','只能关联本人尚未关联的现场，不会替成员入场。');
  return{body:{actorId:user.id,linked:true},guard:roomGuard,statements:[stmt('INSERT INTO event_community_rooms(room_id,community_id) VALUES(?,?)',d.roomId,id),stmt("UPDATE event_community_events SET status='linked',room_id=?,revision=revision+1,updated_at=? WHERE id=?",d.roomId,now(),eventId)]};
 });
 function text(v,max,required=false){if(typeof v!=='string'||[...v].length>max||/[\p{C}]/u.test(v)||required&&!v.trim())fail(400,'INVALID_SPACE_TEXT','请填写长度范围内的单行文字。');return v.trim();}
}
