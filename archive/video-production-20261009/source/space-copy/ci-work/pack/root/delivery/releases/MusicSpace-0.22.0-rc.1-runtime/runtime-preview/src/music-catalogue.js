import {realSongs,realArtists,REAL_CATALOGUE_VERSION} from './map-catalogue.js';
/** Public factual metadata only. No audio, lyrics, photographs or copied artwork.
 * Audited against musicMapTeam/musicMap c626c0e54de1f5ea362710f1e47bacd8c09aa804.
 * A deliberately small bridge into the independently maintained Music Map. */
const ORIGINAL_REFERENCES = Object.freeze([
  {id:'real-bu-gai',title:'不该',artists:['周杰伦','张惠妹'],artistIds:['real-jay','real-amei'],sourceLabel:'杰威尔音乐 · 作品页',sourceUrl:'https://jvrmusic.com.tw/artist/gallery/detail/1212682331903627264?lang=zh_CN&type=',checkedAt:'2026-09-27'},
  {id:'real-far-away',title:'千里之外',artists:['周杰伦','费玉清'],artistIds:['real-jay','real-fei'],sourceLabel:'周杰伦官方频道 · MV署名',sourceUrl:'https://www.youtube.com/watch?v=ocDo3ySyHSI',checkedAt:'2026-09-27'},
  {id:'real-wont-cry',title:'说好不哭',artists:['周杰伦','阿信'],artistIds:['real-jay','real-ashin'],sourceLabel:'杰威尔音乐 · 合作发布说明',sourceUrl:'https://www.jvrmusic.com.tw/news/detail/1173815022741229568',checkedAt:'2026-09-27'},
  {id:'real-waiting-for-you',title:'等你下课',artists:['周杰伦','杨瑞代'],artistIds:['real-jay','real-gary'],sourceLabel:'杰威尔音乐 · 单曲发布说明',sourceUrl:'https://www.jvrmusic.com.tw/artist/news/detail/1152141405221687296?lang=zh_CN',checkedAt:'2026-09-27'},
].map(item=>Object.freeze({...item,artists:Object.freeze(item.artists),artistIds:Object.freeze(item.artistIds),exploreUrl:'https://musicmapteam.github.io/musicMap/?from='+item.artistIds[0]+'&to='+item.artistIds[1]+'#/explore'})));
export const MUSIC_CATALOGUE_VERSION=REAL_CATALOGUE_VERSION;
export const MUSIC_CATALOGUE=Object.freeze(Object.values(realSongs).map(song=>Object.freeze({...song,artistIds:Object.freeze([...song.artists]),artists:Object.freeze(song.artists.map(id=>realArtists.find(a=>a.id===id).name)),exploreUrl:'#music-map:'+song.id,...(ORIGINAL_REFERENCES.find(r=>r.id===song.id)||{}),exploreUrl:'#music-map:'+song.id})));
export const musicReference=id=>MUSIC_CATALOGUE.find(item=>item.id===id)||null;
