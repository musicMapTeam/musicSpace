# 排版与 UI 验收 — 2026-10-04

基线为 0.21.0-rc.2；负责人 Codex，唯一实施者。仅检查隔离本地服务中的合成身份、消息和自制测试照片，没有读取真实私人聊天。原版 Music Map 美术与完整功能保留，不把旧的小图谱换回来。

## 实际发现及针对性修复

| 问题 | 复现与像素证据 | 修复与复查 |
| --- | --- | --- |
| 横屏房间／社群聊天输入区被裁 | 844×390 打开已加入聊天室，旧布局只剩标题及操作，消息和输入均不在画面内 | 只调整短屏布局；操作／消息区域可滚动，输入和发送常驻；保留管理、Map、小游戏与分享入口，滚动位置在刷新时保留 |
| 横屏及 200% 等效布局私聊输入区被裁 | 两名合成观众明确成为好友后打开私聊，旧面板高度不足，输入和发送在裁剪区外 | 私聊短横屏使用较高面板，压缩重复留白；保留原消息滚动及已读判定，不改变照片或好友权限；断网原请求和重试仍可访问 |
| 短屏聊天上方场景文字重叠 | 320×568 小场景中的两行品牌和场名碰到人数条，长中文更明显 | 仅短屏聊天小场景隐藏重复品牌并单行节略场名，完整场名仍在聊天标题内，人数与标题分开 |
| 纸面页头状态文字过淡 | 实际像素很浅；旧规则更高优先级仍取 `#cecec5`，纸底 `#f0e9d8`，对比度 1.31:1 | 精确覆盖页头状态为 `#53664b`，同纸底约 5.15:1，保留字级和夜场配色 |
| Map 音乐人名字被拆行 | 844×390 探索目标把「邓紫棋」拆成两行 | 只让起终点姓名作为整体换行；保留问句、票签、原版场景和所有控制 |

前三项通过实际截图及再次操作复查，尺寸断言仅作为补充。Map 的关系／挑战／关于面板在短屏中需要正常滚动，原手牌说明可横向滚动到达，没有删除说明或功能来凑布局。无问题的个人空间、衣橱、照片和小游戏保留既有视觉。

## 检查范围与方法

- 1440×1000 常规桌面、1280×720 小笔记本、390×844、320×568、844×390 横屏。
- 「200%」是 720×450 CSS 像素／DPR 2 对应桌面缩放的等效布局及像素密度检查；不是实际操作系统／浏览器缩放，也不等于真实手机。
- 实际查看首页、身份／个人空间、试穿、照片、房间和社群聊天、长中文、私聊、音乐话题、默契局／接龙、Map 小院／唱片探索／关系版本来源／挑战／发现，及关闭返回、断网、撤回和固定输入。
- 动态内容使用独立浏览器会话；正常／空／失败／断网态不混同。保留巡检中旧驱动选取收起管理项、邀请码空读等失败尝试；修正的是验收驱动选择，不强制点击隐藏元素，不把失败写成通过。
- 渲染器、缓存、Map 分享与关系接龙、返回未发草稿、权限和持久化使用既有专门闭环再次检查。

## 验证与交付状态

本地 `npm test`、721 项 `test:release`、角色检查已通过。发行候选、精确 HEAD CI、下载包与当前服务升级尚待实际执行；完成后在此补充证据，不拿上一版通过记录代替。

真实手机软键盘／触屏手势、低端 GPU、辅助技术与真实观众反馈仍待外部验证。没有公网部署、独立 Map／Pages 更新、音频服务、新素材或权限扩张。

## RC3 发布包检查发现与 RC4 补修

实际下载 RC3 的 75 个文件与本地构建逐项一致。但增强的输入区边界断言在 1280×720 长场次标题加音乐分享草稿时失败，实际截图确认分享确认按钮及聊天输入区被挤出。此项没有记为通过，也没有把 RC3 升级到 8791。RC4 将内容区的可收缩滚动容器覆盖全部尺寸，桌面消息仍独立滚动；实际下载包已经重新验收通过。

## 最终实际包与持久化证据

- RC4 代码 `7896403c4a8dc5ee64e54502d17191daa32b9b65`，GitHub 资产 13583178 字节，SHA-256 `44d492b3c88502b7b2c3b71fb48008b5de1c2a92134196b4373acbb222f84515`；75 个文件匹配本地构建及 manifest，含 `runtime-preview/src`、drizzle、原版 Map 和共享 Three。
- 实际包 42 步：两／三身份原版 Map 分享、接龙草稿和机位／聊天／未发文字返回 9；进入／退出／刷新／历史／离线及无 WebGL 8；多标签写冲突、刷新和 Map 原存储不变 3；双向同意、长署名／本人 avatar 的真实 PNG、重复保存、刷新、多标签新版本、断网原操作重试、正常重启、删原照和任意一方撤回 15；私聊长中文、空态、断网草稿、关闭返回和衣橱取消 7。全部错误列表为空，合成身份和素材。另有当前构建音乐互动 19 步通过。
- 长内容六尺寸断言：聊天及私聊文本框／发送按钮至少 44px，并在可视范围内；短屏标题和人数不重叠。Map 关系／挑战／关于与收藏空态、个人空间和衣橱另有实际截图；加载延迟真实 Three 模块、故障中止真实 health 请求、手动刷新恢复分别留图。截图驱动字体等待、模态返回选择器和已折叠菜单等失败尝试保留，没有记成通过、没有强点隐藏元素。
- 8791：原进程身份／端口／运行文件核对后正常 CTRL_C 停服；两库 integrity_check、逐表业务摘要及全部私人 blob 核对。备份 `memory-8791-before-layout-ui-backup` 有 2 文件且验证通过；16 blob、291759 字节，SHA-256 `7f901b0bc8f55944c1e900a5b31e785403b9d5670e80e2b2b92fef0e32edb2f9` 原样保留。下载包启动与正常重启后的 75 运行文件、实际页面内容、原业务记录及私人照片均一致，匿名私人音乐 API 为 401。既有过期速率窗口按操作性数据单列，不排除任何用户记录。
- 加载提示深色字改暖纸白；连接中断条移到无操作按钮的底部状态区，恢复原操作重试仍保留草稿。真实 GPU 为 Intel UHD 770／ANGLE D3D11。

本轮明确结束于这些修复和交付；真机软键盘、系统放大／浏览器真实缩放、触屏手势、低端 GPU 与真实观众仍需外部验证。没有以桌面模拟代替这些证据，没有生产上线声明。

## Library 成果

本轮实际截图、合成纪念卡与已验证发布包共 12 项已保存，完整证据包含 2188 张截图（包括失败驱动尝试）。证据 ZIP 内的 QA 文档是归档时稿，最终结论以本仓库此文为准；原用户数据、凭据和传输地址不在包内。当前官方上传辅助程序在任何写入前报告 prepare_uploads 不可用，改用 Library 当前批量保存接口，逐项成功。随后逐项调用官方元数据辅助程序；Windows Python 不提供所需扩展属性接口，未声称本地属性写入成功，真实 ID、全部返回元数据与本地文件哈希已另存核验记录，Library 文件保存成功不受影响。

| 文件 | Library 文件 |
| --- | --- |
| MusicSpace-0.21.0-rc.4-chat-before-landscape.png | [libfile_867f8d6492b0819193d8abacd6115cda](https://chatgpt.com/api/library/files/libfile_867f8d6492b0819193d8abacd6115cda/download) |
| MusicSpace-0.21.0-rc.4-chat-after-landscape.png | [libfile_79509cf1c44c8191a706f1effd671788](https://chatgpt.com/api/library/files/libfile_79509cf1c44c8191a706f1effd671788/download) |
| MusicSpace-0.21.0-rc.4-chat-after-short.png | [libfile_f32dc729f884819181450f53aeb8be55](https://chatgpt.com/api/library/files/libfile_f32dc729f884819181450f53aeb8be55/download) |
| MusicSpace-0.21.0-rc.4-map-desktop.png | [libfile_d124f166b4448191b005782fbd68a7b9](https://chatgpt.com/api/library/files/libfile_d124f166b4448191b005782fbd68a7b9/download) |
| MusicSpace-0.21.0-rc.4-map-mobile.png | [libfile_7b01cae641908191a6c5a651e9da7c56](https://chatgpt.com/api/library/files/libfile_7b01cae641908191a6c5a651e9da7c56/download) |
| MusicSpace-0.21.0-rc.4-share-after-laptop.png | [libfile_84e4a9d2405081919d915fe60510a362](https://chatgpt.com/api/library/files/libfile_84e4a9d2405081919d915fe60510a362/download) |
| MusicSpace-0.21.0-rc.4-private-after-landscape.png | [libfile_b940cfd60c6881918d29d21f2be1a396](https://chatgpt.com/api/library/files/libfile_b940cfd60c6881918d29d21f2be1a396/download) |
| MusicSpace-0.21.0-rc.4-loading-mobile.png | [libfile_64ccf5bb8cf08191a9c394325c722a1b](https://chatgpt.com/api/library/files/libfile_64ccf5bb8cf08191a9c394325c722a1b/download) |
| MusicSpace-0.21.0-rc.4-connection-mobile.png | [libfile_2cd6cb0c150c8191853f8df19e926773](https://chatgpt.com/api/library/files/libfile_2cd6cb0c150c8191853f8df19e926773/download) |
| MusicSpace-0.21.0-rc.4-synthetic-keepsake.png | [libfile_17b37dd87d608191bdb6612468c02462](https://chatgpt.com/api/library/files/libfile_17b37dd87d608191bdb6612468c02462/download) |
| MusicSpace-0.21.0-rc.4-ui-evidence.zip | [libfile_d7aa6a61d2dc8191a8e163214a6449ab](https://chatgpt.com/api/library/files/libfile_d7aa6a61d2dc8191a8e163214a6449ab/download) |
| MusicSpace-0.21.0-rc.4-runtime.tar.gz | [libfile_5693189e714c8191a64b756d87bf4e3d](https://chatgpt.com/api/library/files/libfile_5693189e714c8191a64b756d87bf4e3d/download) |
