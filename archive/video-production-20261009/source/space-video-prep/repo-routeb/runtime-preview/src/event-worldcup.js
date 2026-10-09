import {customEntries} from './music-play-access.js';
import {spaceWriteGuard} from './space-access.js';
import {randomUUID} from 'node:crypto';
import {socialAllowedSQL} from './event-social.js';
import {WORLDCUP_ALBUMS,worldcupAlbum} from './worldcup-albums.js';

const UUID='[0-9a-f-]{36}';
export async function handleEventWorldCup(c){
 const {request,path,method,user,stmt,get,now,rate,mutate,readJSON,keys,revision,fail,json,db,replayOperation}=c;
 const collection=new RegExp(`^/(rooms|communities)/(${UUID})/worldcups$`).exec(path);
 const route=new RegExp(`^/worldcups/(${UUID})(?:/matches/(${UUID})/(vote|advance))?$`).exec(path);
 if(!collection&&!route)return null;
 const rows=async(sql,...args)=>(await stmt(sql,...args).all()).results;
 const cup=route?await get('SELECT * FROM event_worldcups WHERE id=?',route[1]):null;
 if(cup)cup.custom_count=(await get('SELECT COUNT(*) n FROM event_worldcup_entries WHERE cup_id=?',cup.id)).n;
 if(route&&!cup)fail(404,'WORLDCUP_NOT_FOUND','找不到这次专辑世界杯。');
 const kind=collection?(collection[1]==='rooms'?'room':'community'):cup.kind,scope=collection?.[2]||cup.scope_id;
 const membership={sql:`EXISTS(SELECT 1 FROM event_conversation_members WHERE kind=? AND scope_id=? AND user_id=? AND left_at IS NULL AND removed_at IS NULL)${kind==='room'?" AND EXISTS(SELECT 1 FROM event_members WHERE room_id=? AND user_id=? AND left_at IS NULL) AND NOT EXISTS(SELECT 1 FROM event_room_exclusions WHERE room_id=? AND user_id=? AND restored_at IS NULL)":''}`,args:[kind,scope,user.id,...(kind==='room'?[scope,user.id,scope,user.id]:[])]};
 const access=cup?{sql:`${membership.sql} AND ${socialAllowedSQL('?','?')}`,args:[...membership.args,user.id,cup.creator_id,cup.creator_id,user.id]}:membership;
 if(!await get(`SELECT 1 ok WHERE ${access.sql}`,...access.args))fail(403,'CONVERSATION_MEMBERSHIP_REQUIRED','请先明确加入对应聊天室；退出、移除或屏蔽后不能继续参与。');
 const input=method==='POST'?await readJSON(request):null;if(input){const receipt=await replayOperation(input);if(receipt)return receipt;}
 const writable=method==='POST'?await spaceWriteGuard(get,fail,kind,scope):{sql:'1=1',args:[]};
 const writeAccess={sql:`(${access.sql}) AND (${writable.sql})`,args:[...access.args,...writable.args]};
 const cupJSON=r=>({id:r.id,kind:r.kind,scopeId:r.scope_id,title:r.title,creatorId:r.creator_id,creatorName:r.creator_name,createdAt:r.created_at,fictional:!r.custom_count,provenance:r.custom_count?'member-text':'original-fictional',completed:Boolean(r.completed)});
 if(collection){
  if(method==='GET'){const query=new URL(request.url).searchParams,filter=query.get('status')||'all',before=query.get('before');if(!['all','active','completed'].includes(filter)||before&&!new RegExp('^'+UUID+'$').test(before))fail(400,'INVALID_CURSOR','列表筛选或分页位置无效。');if(before&&!await get(`SELECT id FROM event_worldcups c WHERE id=? AND kind=? AND scope_id=? AND ${socialAllowedSQL('?','c.creator_id')}`,before,kind,scope,user.id,user.id))fail(400,'INVALID_CURSOR','分页位置当前不可见。');const complete="EXISTS(SELECT 1 FROM event_worldcup_matches m WHERE m.cup_id=c.id AND m.ordinal=2 AND m.winner_id IS NOT NULL)",q=(filter==='all'?'':filter==='completed'?' AND '+complete:' AND NOT '+complete)+(before?' AND (c.created_at<(SELECT created_at FROM event_worldcups WHERE id=?) OR (c.created_at=(SELECT created_at FROM event_worldcups WHERE id=?) AND c.id<?))':'');const result=await db.batch([stmt(`SELECT 1 ok WHERE ${access.sql}`,...access.args),stmt(`SELECT c.*,(SELECT COUNT(*) FROM event_worldcup_entries WHERE cup_id=c.id) custom_count,${complete} completed FROM event_worldcups c WHERE kind=? AND scope_id=? AND ${socialAllowedSQL('?','c.creator_id')}${q} ORDER BY c.created_at DESC,c.id DESC LIMIT 21`,kind,scope,user.id,user.id,...(before?[before,before,before]:[])),stmt(kind==='community'?'SELECT archived_at FROM event_communities WHERE id=?':'SELECT NULL archived_at',...(kind==='community'?[scope]:[]))]);if(!result[0].results.length)fail(403,'CONVERSATION_MEMBERSHIP_REQUIRED','读取时参与资格已变化。');return json(200,{actorId:user.id,archived:Boolean(result[2].results[0]?.archived_at),worldcups:result[1].results.slice(0,20).map(cupJSON),nextCursor:result[1].results.length>20?result[1].results[19].id:null,status:filter});}
  if(method==='POST'){
   const d=input;keys(d,['title','entries','createConsent']);const entries=d.entries===undefined?null:customEntries(fail,d.entries),options=entries||WORLDCUP_ALBUMS;if(d.createConsent!==true)fail(400,'WORLDCUP_CONSENT_REQUIRED','请确认在当前聊天室发起虚构专辑投票。');
   if(typeof d.title!=='string'||!d.title.trim()||[...d.title].length>40||/[\p{C}]/u.test(d.title))fail(400,'INVALID_TITLE','标题需为1至40字，不含控制字符。');
   return mutate(d,async()=>{await rate(`worldcup-create:${user.id}`,3,86400000);const id=randomUUID(),r={id,kind,scope_id:scope,creator_id:user.id,creator_name:user.name,title:d.title.trim(),created_at:now(),custom_count:entries?.length||0};return {status:201,body:{actorId:user.id,worldcup:cupJSON(r)},guard:writeAccess,statements:[stmt('INSERT INTO event_worldcups(id,kind,scope_id,creator_id,creator_name,title,created_at) VALUES(?,?,?,?,?,?,?)',id,kind,scope,user.id,user.name,r.title,r.created_at),...(entries||[]).map(e=>stmt('INSERT INTO event_worldcup_entries(cup_id,id,title,artist,ordinal) VALUES(?,?,?,?,?)',id,e.id,e.title,e.artist,e.ordinal)),...[[0,0,1],[1,2,3]].map(([ordinal,a,b])=>stmt('INSERT INTO event_worldcup_matches(id,cup_id,ordinal,left_id,right_id) VALUES(?,?,?,?,?)',randomUUID(),id,ordinal,options[a].id,options[b].id))]};});
  }
  return null;
 }
 if(!route[2]&&method==='GET'){
  const result=await db.batch([stmt(`SELECT 1 ok WHERE ${access.sql}`,...access.args),stmt(`SELECT m.*,(SELECT COUNT(*) FROM event_worldcup_votes v WHERE v.match_id=m.id AND v.album_id=m.left_id) AS live_left,(SELECT COUNT(*) FROM event_worldcup_votes v WHERE v.match_id=m.id AND v.album_id=m.right_id) AS live_right,(SELECT album_id FROM event_worldcup_votes v WHERE v.match_id=m.id AND v.user_id=?) AS my_vote FROM event_worldcup_matches m WHERE cup_id=? ORDER BY ordinal`,user.id,cup.id),stmt('SELECT * FROM event_worldcup_entries WHERE cup_id=? ORDER BY ordinal',cup.id),stmt(kind==='community'?'SELECT archived_at FROM event_communities WHERE id=?':'SELECT NULL archived_at',...(kind==='community'?[scope]:[]))]);
  if(!result[0].results.length)fail(403,'CONVERSATION_MEMBERSHIP_REQUIRED','读取时参与资格已变化。');
  const custom=result[2].results,resolve=id=>{const e=custom.find(e=>e.id===id);return e?{id:e.id,title:e.title,artist:e.artist,color:['#645c7d','#956c79','#697964','#9d7958'][e.ordinal],mark:['I','II','III','IV'][e.ordinal],fictional:false,provenance:'member-text'}:worldcupAlbum(id);};
  const matches=result[1].results.map(m=>({id:m.id,ordinal:m.ordinal,revision:m.revision,left:resolve(m.left_id),right:resolve(m.right_id),winner:m.winner_id?resolve(m.winner_id):null,leftCount:m.winner_id?m.left_count:m.live_left,rightCount:m.winner_id?m.right_count:m.live_right,myVote:m.my_vote||null,tieReason:m.tie_reason||null}));
  return json(200,{actorId:user.id,archived:Boolean(result[3].results[0]?.archived_at),worldcup:cupJSON({...cup,completed:Boolean(matches.find(m=>m.ordinal===2)?.winner)}),matches,completed:Boolean(matches.find(m=>m.ordinal===2)?.winner)});
 }
 const match=await get('SELECT * FROM event_worldcup_matches WHERE id=? AND cup_id=?',route[2],cup.id);if(!match)fail(404,'MATCH_NOT_FOUND','找不到这轮投票。');
 if(method!=='POST')return null;
 const d=input,expected=d.revision;if(!Number.isSafeInteger(expected)||expected<1)fail(400,'INVALID_REVISION','请先读取当前轮次。');
 const openGuard={sql:`${writeAccess.sql} AND EXISTS(SELECT 1 FROM event_worldcup_matches WHERE id=? AND cup_id=? AND revision=? AND winner_id IS NULL)`,args:[...writeAccess.args,match.id,cup.id,expected]};
 if(route[3]==='vote'){
  keys(d,['revision','albumId','voteConsent']);if(d.voteConsent!==true)fail(400,'VOTE_CONSENT_REQUIRED','请确认把这一票计入当前聊天室结果。');if(![match.left_id,match.right_id].includes(d.albumId))fail(400,'INVALID_ALBUM','只能选择这一轮的两张虚构专辑。');
  return mutate(d,async()=>{revision(match,expected);await rate(`worldcup-vote:${user.id}`,30,3600000);if(await get('SELECT 1 FROM event_worldcup_votes WHERE match_id=? AND user_id=?',match.id,user.id))fail(409,'ALREADY_VOTED','这一轮已投票，不能重复投或改票。');return {body:{actorId:user.id,matchId:match.id,albumId:d.albumId},guard:{sql:`${openGuard.sql} AND NOT EXISTS(SELECT 1 FROM event_worldcup_votes WHERE match_id=? AND user_id=?)`,args:[...openGuard.args,match.id,user.id]},statements:[stmt('INSERT INTO event_worldcup_votes(match_id,user_id,album_id,created_at) VALUES(?,?,?,?)',match.id,user.id,d.albumId,now())]};});
 }
 if(route[3]==='advance'){
  keys(d,['revision','advanceConsent','tieWinner','tieReason']);if(cup.creator_id!==user.id)fail(403,'WORLDCUP_CREATOR_REQUIRED','只有发起者能明确结束这一轮。');if(d.advanceConsent!==true)fail(400,'ADVANCE_CONSENT_REQUIRED','请确认结束这一轮，之后不能继续投票。');
  return mutate(d,async()=>{
   revision(match,expected);
   const counts=await get('SELECT COUNT(*) FILTER(WHERE album_id=?) AS left_total,COUNT(*) FILTER(WHERE album_id=?) AS right_total FROM event_worldcup_votes WHERE match_id=?',match.left_id,match.right_id,match.id),left=counts.left_total,right=counts.right_total;
   if(left+right===0)fail(409,'NO_VOTES','还没有真实投票，不能替大家决定。');
   const tied=left===right;if(tied&&(![match.left_id,match.right_id].includes(d.tieWinner)||typeof d.tieReason!=='string'||!d.tieReason.trim()||[...d.tieReason].length>100||/[\p{C}]/u.test(d.tieReason)))fail(400,'TIE_DECISION_REQUIRED','平票时须发起者明确选择并留下理由，结果会标注房主决定。');
   if(!tied&&(d.tieWinner||d.tieReason))fail(400,'TIE_NOT_PRESENT','当前不是平票，不能覆盖实际票数决定。');const winner=tied?d.tieWinner:left>right?match.left_id:match.right_id;
   const guard={sql:`${openGuard.sql} AND (SELECT COUNT(*) FROM event_worldcup_votes WHERE match_id=? AND album_id=?)=? AND (SELECT COUNT(*) FROM event_worldcup_votes WHERE match_id=? AND album_id=?)=?`,args:[...openGuard.args,match.id,match.left_id,left,match.id,match.right_id,right]};
   return {body:{actorId:user.id,matchId:match.id,winnerId:winner},guard,statements:[stmt('UPDATE event_worldcup_matches SET winner_id=?,left_count=?,right_count=?,tie_reason=?,revision=revision+1 WHERE id=?',winner,left,right,tied?d.tieReason.trim():null,match.id),stmt('INSERT INTO event_worldcup_matches(id,cup_id,ordinal,left_id,right_id) SELECT ?,?,2,a.winner_id,b.winner_id FROM event_worldcup_matches a JOIN event_worldcup_matches b ON b.cup_id=a.cup_id AND b.ordinal=1 WHERE a.cup_id=? AND a.ordinal=0 AND a.winner_id IS NOT NULL AND b.winner_id IS NOT NULL ON CONFLICT(cup_id,ordinal) DO NOTHING',randomUUID(),cup.id,cup.id)]};
  });
 }
 return null;
}
