// Original fictional album names and typographic cover palettes, 2026-10-02.
// No real recordings, artwork, audio or artist likenesses are represented.
export const WORLDCUP_ALBUMS=Object.freeze([
 {id:'night-platform',title:'午夜站台',artist:'纸灯乐队',color:'#645c7d',mark:'01'},
 {id:'sakura-static',title:'樱花电波',artist:'薄荷收音机',color:'#956c79',mark:'02'},
 {id:'courtyard-echo',title:'小院回声',artist:'月光邮局',color:'#697964',mark:'03'},
 {id:'last-lantern',title:'最后一盏灯',artist:'夜航纸片',color:'#9d7958',mark:'04'},
].map(a=>Object.freeze({...a,fictional:true})));
export const worldcupAlbum=id=>WORLDCUP_ALBUMS.find(a=>a.id===id)||null;
