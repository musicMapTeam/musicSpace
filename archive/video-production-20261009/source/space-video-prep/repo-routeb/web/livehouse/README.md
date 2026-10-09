# Livehouse 三维空间样片

`npm run build:livehouse` 生成单文件 `dist/livehouse/index.html`。

场景复用 `web/avatar/three-scene.js` 的真实人物生成与三渲二管线，使用实体地板、墙、舞台、台阶、灯架、音箱、鼓组、话筒、护栏和照片框。固定镜头都在同一空间中，使用 PerspectiveCamera。没有整幅插画背景平面。

公开站点没有替换。Library 的房间版本 5 已在 Intel UHD 770 WebGL2 上验证三机位、24 次快切、返回及减少动态，但美术未通过：染色、空地、人物造型和照片框比例需要修正。后续本地候选增加中性光、精简地面/照片框、直接点击几何和克制操作条，尚未重新进行像素验收。

此页面的加入、招手和交换仍是明示的示例动作，没有连接新 `/api/event` 房间数据。真实系统进展见 `docs/event/README.md`，不能把场景样片和已完成多人应用混为一谈。
