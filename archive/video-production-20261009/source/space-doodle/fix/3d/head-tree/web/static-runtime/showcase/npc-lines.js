// Everything the fictional cast says on its own. Fixed lines, no generation, and no line claims to be a person: the first thing anyone
// is told is that the sender is a sample character answered by this page, and the thread ends on the plain statement that it is not a
// human. autopilot.js sends them through the ordinary chat API (the product's text rules apply to them like to anyone else); roster.js
// (T7) has its own copy of the three group-chat lines the seed posts, and tests/static-autopilot.test.js keeps the two in step.

/** The closing line of every automatic reply. The same text roster.js exports as DISCLOSURE. */
export const DISCLOSURE = '（示例角色的自动回复：我不是真人。）';

/** Sent, in this order, right after a greeting is accepted. The first line says what the sender is. */
export const WELCOME_LINES = Object.freeze([
  '嗨，欢迎来到「回声现场」。我是示例角色，由这个页面自动回复。',
  '你拍到的是哪一面？',
]);

/** What a friend answers when the visitor writes: the 3rd, 4th and 5th line of a thread, the last one repeated after that. */
export const GENERIC_LINES = Object.freeze([
  '今晚的返场太好听了。',
  '你的视角我这边没拍到，谢谢你愿意交换。',
  DISCLOSURE,
]);

/** The whole script of one private thread: line number = how many lines the character has already sent in it. */
export const REPLY_LINES = Object.freeze([...WELCOME_LINES, ...GENERIC_LINES]);

/** Same shape as the prototype's roster.js CHAT_LINES. */
export const CHAT_LINES = Object.freeze({ welcome: WELCOME_LINES, generic: GENERIC_LINES });

/**
 * What the three characters who are in the room before the visitor said in its group chat (seed.js posts them through the chat API).
 * Each ends with the disclosure, so a visitor who opens the group chat first reads it before anything else.
 */
export const GROUP_LINES = Object.freeze({
  yao: `大家好，今晚我把舞台这一面放上了照片墙。${DISCLOSURE}`,
  man: `我拍的是人海这一面，手都举起来了。${DISCLOSURE}`,
  bei: `我只拍了看台边的一盏灯，算细节。${DISCLOSURE}`,
});

/** The line that answers a friend who has already received `ownMessages` lines from this character (stateless: the thread is the counter). */
export const replyLine = ownMessages => {
  const sent = Number.isFinite(ownMessages) ? Math.max(0, Math.floor(ownMessages)) : 0;
  return REPLY_LINES[Math.min(sent, REPLY_LINES.length - 1)];
};
