const { realSongs } = await import(process.argv[2]);
const all = Object.values(realSongs);
const unverified = all.filter(s => s.listenStatus === 'qq-unverified');
const checked = all.filter(s => /核对/.test(s.recordingLabel || ''));
console.log('recordings', all.length, '| qq-same-version', all.filter(s => s.listenStatus === 'qq-same-version').length, '| other statuses', JSON.stringify([...new Set(all.map(s => s.listenStatus))]));
console.log('qq-unverified (would print 尚未核对 QQ 音乐):', unverified.map(s => s.title).join('、') || 'none');
console.log('labels with 核对 (printed in full inside 来源):', checked.map(s => `${s.id} 《${s.title}》 ${s.recordingLabel}`).join(' || ') || 'none');
console.log('reasons:', JSON.stringify([...new Set(all.filter(s => s.listenReason).map(s => s.listenReason))]));
