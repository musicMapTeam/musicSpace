// The prompt sets behind the four viewpoint text vectors ("defined a priori, before looking at any model output", as the
// feasibility spike recorded it). The shipped pack uses `en7` only: seven short English prompts per viewpoint, embedded by the
// unmodified fp32 TinyCLIP text tower, each L2-normalised, averaged per viewpoint and L2-normalised again (build-labels.mjs).
// English only, deliberately: Chinese prompts do not work with this model (English BPE tokenizer). Node run of the shipped int8
// tower on the spike's 75 CC-licensed photos: en1 89.3 %, en7 93.3 %, zh7 22.7 % (near chance for 4 classes), zh7+en7 89.3 %,
// view2 77.3 %. The UI language and the prompt language are therefore independent. Class keys are the pack's:
// stage | crowd | near | detail. The product calls `near` 「身边」 / `friends`; space-ai.js does that mapping.
//
// text_embed.mjs embeds the unique prompts of ALL sets in one pass, in this order and in batches of 8, so its output (and therefore
// labels.json) is reproducible byte for byte; only `en7` reaches labels.json.
export const CLASSES = ['stage', 'crowd', 'near', 'detail'];
export const ZH = { stage: '舞台', crowd: '人海', near: '身边', detail: '细节' };

// A: one short English prompt per class
const en1 = {
  stage: ['a photo of a performer on a concert stage'],
  crowd: ['a photo of a crowd of people at a concert'],
  near: ['a selfie of friends at a concert'],
  detail: ['a close-up photo of a ticket, wristband, lightstick or merchandise'],
};

// B: English ensemble (7 prompts / class)
const en7 = {
  stage: [
    'a photo of a singer performing on a concert stage',
    'a photo of a band playing on stage under stage lights',
    'a close-up of a performer on stage',
    'a big LED screen showing a performer at a concert',
    'a photo of a concert stage with lights and musicians',
    'a photo of a stage show, taken facing the stage',
    'a blurry photo of a musician on stage at a concert',
  ],
  crowd: [
    'a photo of a huge crowd at a concert seen from behind',
    'a sea of glowing lightsticks and phone lights in the audience at a concert',
    'a photo of the audience at a music festival',
    'many people with raised hands in a concert crowd',
    'a photo of a packed stadium crowd at night',
    'a wide shot of a crowd of concert-goers',
    "the backs of people's heads in the audience at a concert",
  ],
  near: [
    'a selfie of a person at a concert',
    'a photo of two friends posing together at a concert',
    'a group of friends taking a picture together at a music festival',
    "a close-up of smiling people's faces, taken by a friend",
    'a portrait photo of a fan at a concert',
    'a selfie with friends in a crowd',
    'people posing for the camera at a music event',
  ],
  detail: [
    'a close-up photo of a concert ticket',
    'a close-up photo of a wristband on a wrist',
    'a photo of a lightstick held in a hand',
    'a photo of concert merchandise, such as a t-shirt, badge or poster',
    'a photo of a small object on a table',
    'a close-up photo of a paper ticket stub and a souvenir',
    'a photo of a glow stick',
  ],
};

// C: Chinese ensemble (7 prompts / class)
const zh7 = {
  stage: [
    '演唱会舞台上歌手正在表演的照片',
    '舞台灯光下乐队演出的照片',
    '近距离拍摄的舞台上的表演者',
    '演唱会大屏幕上显示的表演者',
    '有灯光和音乐人的演唱会舞台的照片',
    '面向舞台拍摄的演出照片',
    '演唱会上舞台上模糊的歌手照片',
  ],
  crowd: [
    '从后面拍摄的演唱会现场的人海',
    '演唱会观众席里一片荧光棒和手机灯光的海洋',
    '音乐节上观众的照片',
    '演唱会人群中很多人举起双手',
    '夜晚体育场里挤满观众的照片',
    '演唱会观众的全景照片',
    '演唱会观众席里人们的后脑勺',
  ],
  near: [
    '在演唱会现场的自拍照',
    '和朋友在演唱会上的合影',
    '朋友们在音乐节上一起拍照',
    '朋友拍的人物笑脸特写',
    '演唱会上粉丝的人像照片',
    '在人群中和朋友的自拍',
    '在音乐活动上对着镜头摆姿势的人们',
  ],
  detail: [
    '演唱会门票的特写照片',
    '手腕上的演唱会手环的特写照片',
    '手里拿着的应援棒的照片',
    '演唱会周边商品的照片，比如T恤、徽章或海报',
    '桌子上的小物件的照片',
    '票根和纪念品的特写照片',
    '荧光棒的照片',
  ],
};

// D: a hand-written "label + hint" style (2 prompts / class) with viewpoint language, English
const view = {
  stage: ['a photo taken at a concert, showing the stage and the performer', 'a photo of the stage at a live show'],
  crowd: ['a photo taken at a concert, showing the crowd and audience', 'a photo of a sea of people and lights at a live show'],
  near: ['a photo taken at a concert, showing the friends next to me', 'a selfie or group photo of people at a live show'],
  detail: ['a photo taken at a concert, showing a small object up close', 'a close-up photo of a small item from a live show'],
};

const cat = (...sets) => Object.fromEntries(CLASSES.map((c) => [c, sets.flatMap((s) => s[c])]));

export const PROMPT_SETS = {
  'en1': en1,
  'en7': en7,
  'zh7': zh7,
  'zh7+en7': cat(en7, zh7),
  'view2': view,
};
