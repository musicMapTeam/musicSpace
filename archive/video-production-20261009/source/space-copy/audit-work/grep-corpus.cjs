// Grep every harvested state (visible text, attributes, hidden text, transient logs) for leftover words.
const fs = require('fs');
const path = require('path');
const DIR = '/tmp/space-copy/audit-work/corpus';
const WORDS = (process.argv[2] ? process.argv[2].split(',') : ['示例', '虚构', '模拟', '演示', '不是真人', '自动回复', '本页', '浏览器里运行', '没有服务器', '服务器', '不代表', '不会自动', '无法远程', '仍归', '不订阅', '不扩大', '不是 AI', '规则判断', '测试', '预览', '分身', '核对', '原操作', '原请求', '未核实', '真实', '长期', '音乐社群', '主办方', '活动', '空间', '联系', '明确', '本地', '这个浏览器', '只存在', '服务', '原件', '收回', '体验', 'demo', 'Demo', 'sample', '在线版', '页面']);
const ALLOW = [/在线版里的场地、观众和照片是演示内容，观众会自动回复。/];
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && (!process.argv[3] || new RegExp(process.argv[3]).test(f)));
const hits = new Map();
for (const f of files) {
  const c = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const sources = [];
  for (const s of c.states) {
    if (s.layout) continue;
    for (const line of (s.visible || '').split('\n')) sources.push(['visible', `${s.vp} ${s.label}`, line]);
    for (const a of s.attrs || []) sources.push(['attr', `${s.vp} ${s.label}`, a]);
    for (const h of s.hidden || []) sources.push(['hidden', `${s.vp} ${s.label}`, h]);
  }
  for (const [k, entries] of Object.entries(c.logs || {})) for (const e of entries) sources.push(['log', k, e]);
  for (const [kind, where, text] of sources) {
    for (const w of WORDS) {
      if (!text.includes(w)) continue;
      let t = text; for (const a of ALLOW) t = t.replace(a, '');
      if (!t.includes(w)) continue;
      const key = `${w}\t${kind}\t${text.slice(0, 160)}`;
      if (!hits.has(key)) hits.set(key, new Set());
      hits.get(key).add(`${f.replace('.json', '')}:${where}`);
    }
  }
}
const byWord = {};
for (const [key, where] of hits) { const [w, kind, text] = key.split('\t'); (byWord[w] ||= []).push({ kind, text, where: [...where] }); }
for (const w of WORDS) {
  if (!byWord[w]) continue;
  console.log(`\n### ${w} (${byWord[w].length})`);
  for (const h of byWord[w].sort((a, b) => a.kind.localeCompare(b.kind))) console.log(`  [${h.kind}] ${h.text}   <- ${h.where.slice(0, 3).join(', ')}${h.where.length > 3 ? ` (+${h.where.length - 3})` : ''}`);
}
// the About sentence: how many states show it, and where
const about = [];
for (const f of files) { const c = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); for (const s of c.states) { if (s.layout) continue; const all = [s.visible, ...(s.attrs || []), ...(s.hidden || [])].join('\n'); const n = (all.match(/在线版里的场地、观众和照片是演示内容，观众会自动回复。/g) || []).length; if (n) about.push(`${f}:${s.vp} ${s.label} x${n}${s.visible.includes('在线版里的场地') ? '' : ' (not visible)'}`); } }
console.log(`\n### About sentence appears in ${about.length} states:\n  ` + about.join('\n  '));
