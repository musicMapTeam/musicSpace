// Everything the seeded people say on their own. Fixed lines, no generation, and no line claims to be a person (the About panel's one
// sentence says that the audience of the online edition answers automatically). Every line is true whatever the visitor did before it (no
// thanks for an exchange that may never have happened), and a thread ends on the farewell: after it the character does not answer again,
// so nothing repeats. autopilot.js sends them through the ordinary chat API (the product's text rules apply to them like to anyone else);
// roster.js has its own copy of the three group-chat lines the seed posts, and tests/static-autopilot.test.js keeps the two in step.

/** Sent, in this order, right after a greeting is accepted. */
export const WELCOME_LINES = Object.freeze([
  '嗨，欢迎来到「回声现场」！',
  '你拍到的是哪一面？',
]);

/** What a friend answers when the visitor writes: the 3rd, 4th and 5th line of a thread. The last one is the farewell. */
export const GENERIC_LINES = Object.freeze([
  '今晚的返场太好听了。',
  '照片墙上有好几张是同一刻拍的，你看了吗？',
  '下次月台见！',
]);

/** The whole script of one private thread: line number = how many lines the character has already sent in it. */
export const REPLY_LINES = Object.freeze([...WELCOME_LINES, ...GENERIC_LINES]);

/** Same shape as the prototype's roster.js CHAT_LINES. */
export const CHAT_LINES = Object.freeze({ welcome: WELCOME_LINES, generic: GENERIC_LINES });

/** What the three people who are in the room before the visitor said in its group chat (seed.js posts them through the chat API). */
export const GROUP_LINES = Object.freeze({
  yao: '大家好，我是月台的阿遥。今晚舞台这一面，我先放上照片墙啦。',
  man: '我拍的是人海这一面，手都举起来了。',
  bei: '我只拍了看台边的一盏灯，算细节。',
});

/**
 * What a character writes on a two-sides card (双人纪念) a friend invited it to: its own side, next to its own photo. One single line each
 * (the corner takes up to 200 characters, no line breaks); a character without a line of its own says CORNER_LINE.
 */
export const CORNER_LINES = Object.freeze({
  yao: '舞台这一面，交给我。',
  man: '人海这一面，手都举起来了。',
  bei: '看台边那盏灯，留给你。',
});
export const CORNER_LINE = '同一晚，另一面。';
export const cornerLine = key => (Object.hasOwn(CORNER_LINES, key) ? CORNER_LINES[key] : CORNER_LINE);

/**
 * The line that answers a friend who has already received `ownMessages` lines from this character (stateless: the thread is the counter),
 * or null once the whole script has been said: the farewell is the last word, and the character stays quiet after it.
 */
export const replyLine = ownMessages => {
  const sent = Number.isFinite(ownMessages) ? Math.max(0, Math.floor(ownMessages)) : 0;
  return sent < REPLY_LINES.length ? REPLY_LINES[sent] : null;
};
