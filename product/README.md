# 产品文档与应用

文档版本：**3.0 · 2026-09-30**，对应应用 **MVP 0.16.0**。**Music Space**：演唱会散场后，同场观众交换彼此没有的视角（「同一刻，另一面。」）。它是 2026-09-30 从 Music Map × Music Space 0.15（`3dd102c`）拆出的独立产品，Map 一半已移除，留在 [musicMapTeam/musicMap](https://github.com/musicMapTeam/musicMap)；两个产品各自编号（Map 仓库同为 MVP 0.16.0，两者互不相干）。

本页是入口。**事实与计划分开**：工作分支 `feat/moment-ai` 没有推送、没有 PR、没有合并；线上 <https://musicmapteam.github.io/musicSpace/> 是它 `7c962e2` 的静态版构建（`gh-pages` `2d8f1a3`，带 AI，2026-09-30 11:18 +08:00 部署，2026-09-30 11:51 +08:00 核对），不含之后的改动；下面提到的「已实现」都指代码存在并有记录的检查，不等于已验证。逐项状态与证据见[项目状态](../docs/PROJECT_STATUS.md)。文档由开发侧起草，队友（产品负责人）尚未审阅。

## 当前只读这三份

| 文档 | 回答什么 |
| --- | --- |
| [产品方案](docs/01-product-plan.md) | Space 是什么、为谁、要解决什么问题；现场卡、拍摄时间、「同一刻的另一面」、端侧 AI 视角建议、「那晚的歌单」、交换与同意的规则；静态版与房间版；已实现与未做；待团队决定；决策记录 |
| [交付计划](docs/02-delivery-plan.md) | 初赛交付：GitHub Pages 静态版、房间版、AI 文件的托管与大陆访问风险、「上线」口径、材料与到 10 月 9 日的时间线、视频路线、评审维度对照 |
| [实施规格](docs/03-build-guide.md) | 模块、状态与存储键、拍摄时间与 AI 管线（固定来源与哈希）、房间服务的表与接口、构建与部署命令、测试 |

[参赛材料](../docs/competition/README.md)保存报名介绍与分镜；[资源台账](data/resource-register.json)记当前用到的来源与实际落地状态；[视觉规范](../docs/VISUAL_THEMES.md)记「樱下放映 · 夜场」；[协作约定](../AGENTS.md)与[根 README](../README.md)记规则与运行方式。三份文档与协作约定、根 README、项目状态冲突时，以后三者为准。

## 一眼看懂当前应用

现场卡 → 私藏 / 展示 → 申请交换 → 对方同意 → 两人署名的双联票根 → 纪念册（「收藏」）。选照片时，浏览器在压缩前读出照片自带的拍摄时间，一个小模型在本机建议视角；两张卡拍摄时间相差 ≤ 3 分钟算「同一刻」，视角不同的标「同一刻的另一面」并写出理由；卡上写的歌按拍摄时间排成「那晚的歌单」。

| | 静态版 | 房间版 |
| --- | --- | --- |
| 是什么 | 整个 `dist/`：`index.html` + `ai/`，任意静态托管（含 GitHub Pages），必须发布整个目录 | Node 24 + SQLite，同一进程提供页面与 `/api/live` |
| 能体验 | 本地双角色示例（Lin / 阿遥，`#/space/demo`），可换成自己的照片 | 真实房间：邀请码、二维码、两台设备各自申请与同意 |
| 状态 | 线上是 `7c962e2` 的构建（带 AI）；之后的改动未上线 | 只在本机两个来源之间走过；没有托管 |

端侧 AI 只做视角建议（TinyCLIP-ViT-8M/16 图像塔，int8，MIT；onnxruntime-web 1.30.0），同源自托管，照片不为此上传；只在有把握时预选，人选的永远优先，会判错。它在 75 张公开 CC 图上量过，没在真实观众的照片上量过。规则细节见[产品方案](docs/01-product-plan.md) §3。

### 画面（0.16）

统一放在 `docs/assets/themes/`，命名 `space-<页面>-<desktop|mobile>-v016.png`，由专门的截图轮次生成；文件缺失时以项目状态的记录为准。

| 页面 | 桌面 | 手机 |
| --- | --- | --- |
| 首页 | [space-home-desktop-v016.png](../docs/assets/themes/space-home-desktop-v016.png) | [space-home-mobile-v016.png](../docs/assets/themes/space-home-mobile-v016.png) |
| 示例现场 | [space-demo-wall-desktop-v016.png](../docs/assets/themes/space-demo-wall-desktop-v016.png) | [space-demo-wall-mobile-v016.png](../docs/assets/themes/space-demo-wall-mobile-v016.png) |
| 制卡与 AI 建议 | [space-editor-ai-desktop-v016.png](../docs/assets/themes/space-editor-ai-desktop-v016.png) | [space-editor-ai-mobile-v016.png](../docs/assets/themes/space-editor-ai-mobile-v016.png) |
| 配对理由 | [space-pairing-desktop-v016.png](../docs/assets/themes/space-pairing-desktop-v016.png) | [space-pairing-mobile-v016.png](../docs/assets/themes/space-pairing-mobile-v016.png) |
| 那晚的歌单 | [space-setlist-desktop-v016.png](../docs/assets/themes/space-setlist-desktop-v016.png) | [space-setlist-mobile-v016.png](../docs/assets/themes/space-setlist-mobile-v016.png) |
| 双联仪式页 | [space-duet-desktop-v016.png](../docs/assets/themes/space-duet-desktop-v016.png) | [space-duet-mobile-v016.png](../docs/assets/themes/space-duet-mobile-v016.png) |
| 收藏 | [space-records-desktop-v016.png](../docs/assets/themes/space-records-desktop-v016.png) | [space-records-mobile-v016.png](../docs/assets/themes/space-records-mobile-v016.png) |
| 票根 PNG（应用实际导出，1600×1800） | [space-ticket-v016.png](../docs/assets/themes/space-ticket-v016.png) | — |

## 状态与边界（2026-09-30）

- **已做**：拆分为独立产品；静态版已上线（先是 `a45ecbd`，现为含 AI 的 `7c962e2`，Pages 上 `ai/` 五个文件 gzip 传输共 10,344,436 B）；拍摄时间读取、端侧视角建议、同一刻配对与理由、「那晚的歌单」、静态版 / 房间版双模式（都在 `feat/moment-ai`，本地提交）；`npm test` 三份检查与 `npm run build` 通过；桌面 Chrome 模拟视口下的静态版与房间版主流程走过。
- **没做**：`feat/moment-ai` 的推送、PR 与合并，`7c962e2` 之后改动的部署；iOS Safari、微信内置浏览器、Android 与实体手机；大陆网络；Cache Storage 在 Pages 上的命中；真实观众照片上的 AI 准确率；目标用户试用；Space 版的视频、封面与介绍；队友审阅。现有封面与视频含 Map 内容，不能用于 Space。
- **待团队决定**：提交 Space 还是 Map（每支队伍限定提交一份作品，与队友商定，结论前不写成已定）、赛道、作品名称、仓库与 Pages 公开是否影响「未上线」的要求、是否上线托管房间版。见[产品方案](docs/01-product-plan.md) §9。

## 历史与参考

- [prototype/index.html](prototype/index.html) 是旧 Map 可点击原型，艺人、歌曲和关系为示例，播放无声模拟；[assets/](assets/) 里的旧截图与[核验记录](verification/report.md)只对应它。它们不是 Space 的一部分，也不当作新版已完成的能力；确需复用时，明确迁移的代码与含义。
- v0.3 私人唱片馆方案及概念图已[归档](../archive/README.md)，不作为当前实施依据。
- [官方资料](../references/official/2026-09-26/README.md)（另有 [2026-09-29 提交表单字段](../references/official/2026-09-29/submission-form.md)）与[原始创意材料](../references/original-ideas/README.md)分别留存；[9 月 27 日赛事复核](../references/research/2026-09-27/competition-review.md)区分已重读官网和赛题表原档，[竞品研究](../references/research/2026-09-27/social-product-review.md)含小样本试用方案。
- Map 的规则、数据与画面：见 Git 提交 `3dd102c`（`git show 3dd102c:product/README.md` 等）与 [musicMapTeam/musicMap](https://github.com/musicMapTeam/musicMap)。

---

## 附录 · 历史（2.6 原文保留）

以下是 2.6（Music Map × Music Space，0.15）本页的原文，一字未改，按出处分块保留。其中的 Map、寻声、完整图鉴与 0.4 材料的状态不适用于 Music Space 3.0。

### A. 版本说明与 0.15 视觉整改（2.6 第 3–11 行）

文档版本：**2.6 · 2026-09-27**，对应应用 **MVP 0.15.0**。用自己的现场卡交换同场观众的另一视角；Map 以「寻声一局」提供作品发现与制作署名，完整精选网收进「完整图鉴」。实际构建、画面及 PR / 合并结果统一见[项目状态](../docs/PROJECT_STATUS.md)。

0.15 是视觉整改：
- 「樱下放映」改为夜场，并冻结为最终美术方向。
- 首页首屏说明「同一刻，另一面」与交换三步。
- 唱片店改为由用户逐张翻开的寻声一局，不再默认铺开完整网络或直接高亮最短链。
- 双方同意的交换进入全屏仪式页，PNG 改为夜场票根。

本轮实际检查见项目状态。

### B. 0.4 视频与封面的状态（2.6 第 41 行）

现有 **106 秒中文字幕实际操作录屏与 16:9 封面均为 0.4.0 材料**，不包含后续空间镜头、曲库、个人收藏入口，以及 0.15 的夜场、寻声与仪式页；视频需按 0.15 重制，新封面待更新。规格见[交付清单](../delivery/README.md)。尚待评审部署、外部用户试用、实体手机检查与正式提交；运行方式见[根 README](../README.md)。完整 HF 数据已有本地副本，运行页面仅内置 120 首精选；没有模型权重、内置音频或实时 AI 推理。
