/** Capture the space revision so archive/reopen cannot revive an in-flight write. */
export async function spaceWriteGuard(get, fail, kind, id) {
 if(kind!=='community')return {sql:'1=1',args:[]};
 const space=await get('SELECT revision,archived_at FROM event_communities WHERE id=?',id);
 if(!space||space.archived_at)fail(409,'SPACE_ARCHIVED','社群已归档，暂时不能参与。');
 return {sql:'EXISTS(SELECT 1 FROM event_communities WHERE id=? AND revision=? AND archived_at IS NULL)',args:[id,space.revision]};
}
