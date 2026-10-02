// Room-specific willingness, independent of photo visibility and existing friends.
export function participationMode(value) {
  return value === undefined ? 'quiet' : value;
}
export const openParticipationSQL = (room, actor, peer) => `EXISTS (SELECT 1 FROM event_participation pa JOIN event_participation pb ON pb.room_id=pa.room_id WHERE pa.room_id=${room} AND pa.user_id=${actor} AND pb.user_id=${peer} AND pa.mode='open' AND pb.mode='open')`;

export async function handleEventParticipation(c) {
  const {request,path,method,user,stmt,get,now,mutate,readJSON,keys,revision,fail,json}=c;
  const match=/^\/rooms\/([0-9a-f-]{36})\/participation$/.exec(path);
  if(!match||method!=='PATCH')return null;
  const roomId=match[1],data=await readJSON(request);keys(data,['mode','revision']);
  if(!['quiet','open'].includes(data.mode))fail(400,'PARTICIPATION_REQUIRED','请选择安静参与或愿意打招呼。');
  return mutate(data,async()=>{
    const row=await get('SELECT p.* FROM event_participation p JOIN event_members m ON m.room_id=p.room_id AND m.user_id=p.user_id WHERE p.room_id=? AND p.user_id=? AND m.left_at IS NULL',roomId,user.id);
    if(!row)fail(404,'ROOM_NOT_FOUND','当前身份未加入这一场。');revision(row,data.revision);
    const guard={sql:'EXISTS (SELECT 1 FROM event_participation p JOIN event_members m ON m.room_id=p.room_id AND m.user_id=p.user_id WHERE p.room_id=? AND p.user_id=? AND p.revision=? AND m.left_at IS NULL)',args:[roomId,user.id,row.revision]};
    const statements=[stmt('UPDATE event_participation SET mode=?,revision=revision+1,updated_at=? WHERE room_id=? AND user_id=? AND revision=?',data.mode,now(),roomId,user.id,row.revision)];
    // Existing friendships/chats and every photo grant remain untouched.
    // A concurrent greeting's transaction also checks both choices.
    if(data.mode==='quiet')statements.push(stmt("UPDATE event_social_pairs SET status='cancelled',revision=revision+1,updated_at=?,cooldown_until=NULL WHERE room_id=? AND status='pending' AND (sender_id=? OR recipient_id=?)",now(),roomId,user.id,user.id));
    return {guard,statements,body:{actorId:user.id,roomId,participation:{mode:data.mode,revision:row.revision+1}}};
  });
}
