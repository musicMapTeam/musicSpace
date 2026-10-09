// Every on-screen string / selector the Route B capture scripts depend on, in ONE place.
// Sources (read 2026-10-05 from the repo checkpoint 1915e23 = Route B wave 1, NOT yet booted: T9b/T10 are wave 2):
//   web/static-runtime/showcase/{copy,entry-panel,tour,roster,seed,autopilot,npc-lines,about-panel}.js, web/event-room/{moment-upload,moment-wall,moment-model,exchange-suggest,exchange-panel}.js,
//   web/js/photo-insight.js, and the design /tmp/space-b-design-final.json (judgePath, aiStory).
// If a step fails on the real build, run `node routeb/probe.mjs --enter` (lists what is on screen) and fix the line here, not in the shots.
export const UI = {
  // boot / landing (copy.js; design 9.1)
  loading: /灯快亮了/, statusPreparing: /正在布置示例现场/, statusReady: /示例现场 · 在本页运行/,
  presenceTitle: /同一刻，另一面。/, enter: /进入示例现场/, footerAbout: /关于这个示例/,
  // entry panel (entry-panel.js: form[data-form=demo-entry]; the wardrobe is the product's own)
  entryForm: 'form[data-form=demo-entry]', entryTitle: /带上小人，进入示例现场/, nickname: '#panel form[data-form=demo-entry] input[name=name]',
  wardrobeOpen: /现在换个造型/, wardrobeSave: /保存这个我/,
  consentEntry: '#panel form[data-form=demo-entry] input[name=consent]', participationOpen: '#panel input[name=participation][value=open]',
  // room (tour.js: .demo-tour card above .presence; roster.js: ROOM)
  roomTitle: /回声现场 · 示例场/, tourStep1: /示例路线 1\/4/, tourCard: '.demo-tour',
  tourSample: id => `.demo-tour [data-tour-action="sample:${id}"]`, tourOwn: '.demo-tour [data-tour-action="open:upload"]',
  hotspot: '.hotspot', hotspotPhoto: '.hotspot.photo', camNav: 'nav.camera-nav button',
  sampleCrowd: /人海 · 示例照片/, sampleStage: /舞台 · 示例照片/, ownPhoto: /用我自己的照片/,
  // upload form (moment-upload.js) + the on-device AI line (photo-insight.js: 「AI 判断：人海」 / 「不确定，请选择」)
  uploadForm: 'form[data-form=upload]', samplePhoto: id => `[data-sample-photo="${id}"]`,
  takenLine: '[data-taken-line]', takenNote: '[data-taken-note]',
  exifLine: /拍摄于 \d{1,2}:\d{2}/, exifNote: /来自照片自带的信息/,
  aiTag: '.moment-ai-tag', aiUnsureTag: '.moment-ai-tag--unsure', chip: id => `[data-moment-viewpoint="${id}"]`,
  aiSure: /AI 判断：/, aiUnsure: /不确定，请选择/, aiLoading: /AI 在本机判断视角/, aiDownload: /首次需下载模型/,
  chipStage: /^舞台/, chipCrowd: /^人海/, save: /保存这张照片/, panel: '#panel', panelClose: '#panel-close',
  // wall (moment-wall.js) - the pipeline ribbon only shows once some photo on the wall really has an AI-sourced viewpoint
  wallOpen: /看照片/, wallRoot: '[data-moment-wall]', wallRibbon: '[data-moment-ribbon]', ribbonText: /AI 建议视角 → 规则找同一刻 → 双方同意才交换/,
  groupTitle: '.moment-group__title', groupNote: '.moment-group__note',
  groupHeader: /同一刻 · \d+ 个视角/, groupRule: /规则判断，不是 AI/, badgeBlock: '[data-moment-badge="other-side"]', badge: /同一刻的另一面/,
  reason: /同一刻 · \d{1,2}:\d{2}，相差/, offer: /和 TA 交换这个视角/, offerBtn: '[data-exchange-offer]', metaLine: '.moment-meta', byAi: /AI 建议，未改动/, byAuthor: /作者选择/,
  // exchange compose (exchange-panel.js + exchange-suggest.js): the recommendation is the SELECTED option 「我的第 N 张 · 已上墙 · 同一刻的另一面（推荐）」
  xChoice: 'select[data-x-choice]', recommendedOption: /同一刻的另一面（推荐）/, xReason: '#exchange-reason', ruleNote: /规则判断，不是 AI。要不要交换/,
  xConsent: '[data-x-consent]', consentExchange: /我同意提供选中照片的预览/, xSend: '[data-x-send]', send: /把这两张交给对方确认/,
  pending: /等待本人回应/, accepted: /交换已接受/,
  // social (judgePath 7; npc-lines.js)
  greetBtn: /向 .*·示例 招个手/, chatBtn: /和 .*·示例 私聊/, quiet: /选择安静参与，不接收新招呼/,
  castXiaoman: '小满·示例', castYao: '阿遥·示例', castBeiyu: '北屿·示例', castLinjian: '林间·示例', castLabel: /示例角色 · 自动回复/,
  welcome: /我是示例角色，由这个页面自动回复/, disclosure: /示例角色的自动回复：我不是真人/,
  // after-show, recap, map
  recap: '#room-recap', memorySave: /保存我的纪念卡/, memoryDownload: /下载纪念卡 PNG/, memoryReady: /你的纪念卡/, myspace: '#my-space', mapEntry: '#music-map-entry', mapBack: /返回现场/,
};
