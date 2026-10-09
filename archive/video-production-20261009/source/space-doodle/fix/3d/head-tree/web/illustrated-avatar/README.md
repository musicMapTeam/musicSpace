# Music Space · 分层插画分身

2026-09-30 本地候选。为真实 Three.js 场馆提供透明二维立绘，同时用于衣橱的即时预览。这里不创建场馆、API、存储或新的人物字段，不宣称人物本身是三维网格。

## 接口

```js
import {
  renderAvatarSvg,
  avatarSvgDataUrl,
  normalizeIllustratedLook,
  illustratedLookKey,
  ILLUSTRATED_VIEWS,
  ILLUSTRATED_SIZE,
  ILLUSTRATED_INVENTORY,
} from '../illustrated-avatar/index.js';

const svg = renderAvatarSvg(avatar, {
  view: 'quarter',       // front / quarter / side / back
  label: 'Lin 的分身',    // 已转义的 title 和 aria-label
  width: 480,
  height: 1000,
  shadow: false,         // 场馆自己投影时保持 false
});
```

- viewBox 恒为 `0 0 240 500`，脚底基准 `feetY: 477`；厚底鞋最大到 480，留有透明余量
- 默认透明、自包含 SVG；无外部字体、图片、远程 URL、滤镜或脚本。衣服使用内嵌剪裁路径，让条纹和袖口细节不飘出衣服
- 缺省 view 为 quarter，缺省 avatar 为原 `DEFAULT_AVATAR`；传入对象交给原 `safeAvatar`，兼容原 v1→v2 迁移，不改变既有字段含义
- `avatarSvgDataUrl` 输出百分号编码的 `data:image/svg+xml;charset=utf-8,…`
- `illustratedLookKey(avatar, view)` 可用于纹理缓存；调用方负责取消过期异步加载和释放纹理
- `normalizeIllustratedLook` 返回新对象，不修改输入；没有新增持久化 schema

## 模块及方向

所有编号直接对应 `web/avatar/model.js`：8 发型、6 眼镜、6 上装、6 下装、4 鞋履、6 配件，共 36 个可选项。颜色、肤色、表情和姿势仍使用旧字段。部件可单独替换，不换脸或重设别的部件。

2026-10-01：眼镜的 6 个选项包括「不戴眼镜」与 5 种镜框。首次默认无镜；衣橱以单件选择为主，默认折叠的组合示例中「留白／断拍／回声」无镜，其余三套保留镜框；只影响新身份或主动选择预设，不迁移已保存的外观。无镜在四方向都没有镜框和镜腿，前／3/4／侧面仍保留同一组五官；背面本来不显示五官。深棕肤色的眉、鼻、嘴使用浅暖色细线，提高小尺寸辨识度。

- front：正面脸与身体
- quarter：更窄脸部、突出鼻尖、远侧眼睛与镜框透视，独立肩部与上衣轮廓
- side：侧面鼻/下颌轮廓、单眼、侧面身体、裤装与鞋
- back：没有 face 或 features 图层，不显示正面眼睛/嘴/胸口圆点；后脑、后兜、后跟和背缝
- listen / sway：不同肩线、头部角度和重心；wave：抬手及对应袖形；sing：举麦及对应袖形。都是静态插画姿势，不伪称骨骼动画

`data-layer` 可辅助测试和检查，但调用方应以完整 SVG 为渲染单元。上衣含局部 clipPath；相同 ID 对应相同衣服轮廓，多个预览同时插入不会使不同衣服互相裁切。

## 本地审图

```sh
node web/illustrated-avatar/render-review.mjs
node web/illustrated-avatar/render-eyewear-review.mjs /path/to/review-output
node --test tests/illustrated-avatar.test.js
```

输出原生矢量审图板：

- `review-views.svg`：默认同一人的四方向
- `review-presets.svg`：原六套穿搭，含 listen / sway / wave / sing 姿势
- `review-components.svg`：36 个可选部件

已用运行时现有 Sharp / librsvg 将三份板栅格化并逐份目视；另将 36 部件 × 4 视角 × 4 姿势的 576 份 SVG 全部栅格化通过。该批所有实色像素联合边界为 x=11…205、y=21…480，未触及画布边缘。16 项 Node 测试覆盖 schema、转义、自包含资源、四方向、36 项独立几何、换件不换脸、短上衣下的躯干底层、姿势、缓存键和审图板。

这些检查是模块渲染证据，不替代主场馆的 GPU、遮挡、移动端、换装保存或房间同步验收。

## 素材来源与范围

本目录是原创代码原生分层 SVG。实现前目视了用户给的人物参考与六套概念板，采用细长比例、不对称松弛姿势、角切发束、厚框眼镜、低眼睑、奶油/墨色加小面积色彩的方向。没有把用户上传的参考图片复制进仓库，也没有把概念图当成人物纹理或实际场景截图。

候选的 4 向立绘不是连续 360° 模型；相邻方向应由场馆按视线选择，左右方向可镜像。风格和方向覆盖仍应由用户验收。
