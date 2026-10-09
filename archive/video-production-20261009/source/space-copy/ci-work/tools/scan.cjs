// node scan.cjs <report.json>... : banned-word scan over every captured screen text
const fs = require('fs');
const BANNED = ['示例', '虚构', '模拟', '演示', '自动回复', '不是真人', '在本页运行', '没有服务器', '只存在这个浏览器', '数据只存在', '本地体验版', '不代表', '不是到场认证', '不会自动', '原件仍归', '无法远程收回', '远程收回', '无法收回', '不订阅营销', '不扩大', '场景里的小人代表', '规则判断', '不是 AI', '未核实', '核对', '原操作', '原请求', '分身', '长期空间', '长期音乐社群', '音乐社群', '长期社群', '服务器', '服务已', '这个页面', '本页', '预览版', '虚拟', 'sample', 'demo', 'Demo', 'DEMO', 'fiction', '浏览器', '活动预告', '我的社群', '主办方，开一个现场', '自己开个房', '在线访问', '定向交换', '限尺寸', '等待本人回应', '互相同意成为朋友', '双向朋友', '联系', '真实', '真人', '明确'];
for (const file of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`##### ${file}`);
  for (const [label, text] of Object.entries(r.texts)) {
    for (const w of BANNED) {
      let i = -1;
      while ((i = text.indexOf(w, i + 1)) >= 0) console.log(`  ${label}: 「${w}」 …${text.slice(Math.max(0, i - 40), i + w.length + 40).replace(/\s+/g, ' ')}…`);
    }
  }
}
