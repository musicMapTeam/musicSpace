# Music Map 原版页面

来源为 `musicMapTeam/musicMap` 的 `c626c0e54de1f5ea362710f1e47bacd8c09aa804`（0.16.0）。保持原版小院、唱片桌、翻片寻声、自由探索、作品署名与「我的发现」，不是上一轮的 SVG 简化图。

本轮适配仅涉及 Space 入口与返回草稿、独立存储前缀、页面销毁、共享 Three 模块和发布构建。原版第三方许可随源码与构建保留。开放目录是来源记录里的作品署名，不冒充核实过的共同演唱；只有既有 37 条核对录音能准备聊天室与接龙草稿，发送和开局仍需本人确认、服务重新核对权限。

入口 `/music-map/`，从 `/event-room/` 进入。完整页面导航卸载前一个场景，不把两个 Three 渲染器叠在同页。返回位置与待选歌曲只放当前标签页的 `music-space-map-return:v1`；探索与收藏分别用 `music-space-map-exploration:v1`、`music-space-map-saved-music:v1`，不读取或改写独立 Map 的存储键。
