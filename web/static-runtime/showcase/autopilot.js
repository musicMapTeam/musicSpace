// The fictional cast answers back, through the same worker API a real attendee uses. Nothing here bypasses a permission or a consent: every
// reaction is an ordinary request carrying the character's own bearer token, so a quiet member still cannot be greeted (the worker answers
// PARTICIPATION_QUIET and nothing overrides it), a decline is a real decline, and every grant is the worker's own. The characters read their own
// inboxes, and each reaction waits `thinkMs` after the SERVER timestamp of the thing it answers, so a reload loses nothing and nothing fires
// twice: whatever was answered is no longer pending, whatever was not is still there with the same timestamp. There is no state between
// ticks except the late arrival's timer (a reload restarts it), and nothing is cached: every tick asks again.
//
//   const pilot = createAutopilot({ people, room, now, thinkMs: 2500, arriveMs: 8000, intervalMs: 1500, onChange, log });
//   pilot.start();      // ticks every intervalMs while the tab is visible, once at once whenever it becomes visible again
//   pilot.stop();       // clears the timer and the listener; a stopped autopilot never ticks again (create a new one)
//   await pilot.tick(); // one pass; true when it ran, false when another pass was still running (or after stop()); it never throws
//   pilot.state         // read-only snapshot, for QA: running, stopped, busy, ticks, skipped, requests, mutations, failures, visitorSeenAt, lastTick
//
//   people   { key: { id, token, npc: { key, name, host?, participation, joins }, api: { get(path), post(path, body, { key }) } } } from ensureShowcase
//   room     { id, code } of the showcase room: the only scope the cast acts in
//   now      the runtime's clock function (createClock): server timestamps and this clock are the same time
//   onChange({ kind, npc })   after every SUCCESSFUL mutation, so the page can refresh at once (profile.demo.notifyChanged ignores the argument)
//   log(label, code, status)  a swallowed per-action failure; 404 and 409 are normal races (the visitor cancelled, a revision moved on),
//                             so this is a debug channel, not an error channel
//   document, setInterval, clearInterval   optional, for tests; the page's own are used by default (looked up when start() runs)
//
// What the cast does (each step only for a character that is in the room, only for what is addressed to it, never for the visitor, and only
// while somebody but the cast is in the room: before that a pass reads the room and nothing else, so an idle page asks 1 to 3 questions and
// writes nothing):
//   greeting     an incoming one from an open character: accept, then the two welcome lines
//   chat         the friend wrote last: reply with line number = lines this character already sent in that thread (REPLY_LINES, last repeated)
//   exchange     pending for this character: accept, unless both photos have a known viewpoint and it is the same, then decline
//   late arrival 林间 (joins 'after-visitor') joins the room and its chat, quietly, once a visitor has been seen for arriveMs; no photo
//   album cup    阿遥 and 小满 vote (a hash of their key and the match picks the side); 北屿 and 林间 abstain, so three voters never tie;
//                the cup's creator advances once the open match has three votes
//   game         preference game waiting with three players: the host starts; every joined character answers the open round once;
//                everyone has answered: the host reveals
import { WELCOME_LINES, replyLine } from './npc-lines.js';

export const THINK_MS = 2500;
export const ARRIVE_MS = 8000;
export const INTERVAL_MS = 1500;

/** A server timestamp this far in the future means the device clock went backwards: it is not a fresh request, do not wait for it. */
const CLOCK_SKEW_MS = 60_000;
/** Two voters plus the visitor make three, so a match can never tie (a tie would need the creator's reasoned decision). */
const CUP_VOTERS = Object.freeze(['yao', 'man']);
/** A visitor can open more cups and games than a demo needs; the newest few are answered, so one tick stays small whatever happens. */
const MAX_CUPS = 3;
const MAX_GAMES = 3;
/** Thrown inside a pass that was stopped; swallowed, never logged. */
const STOPPED = Symbol('autopilot stopped');

const parseTime = iso => Date.parse(iso) || 0;
const hashCode = text => [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
const codeOf = error => error?.code || error?.message || String(error);

/** A fresh Idempotency-Key (the worker takes [A-Za-z0-9_-]{16,128}); a UUID, with a fallback for contexts without crypto.randomUUID. */
function freshKey() {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof source?.getRandomValues === 'function') source.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The pairing rule the characters apply to an exchange: they trade views, not duplicates. A photo nobody can read the view of is no reason to refuse. */
export function wantsExchange(offered, requested) {
  if (!offered?.viewpoint || !requested?.viewpoint) return true;
  return offered.viewpoint !== requested.viewpoint;
}

/** The album a character votes for in a match: the side comes from a hash of the character and the match, so it is stable and needs no memory. */
export const cupPick = (npcKey, match) => (hashCode(`${npcKey}${match.id}`) % 2 ? match.left.id : match.right.id);

/** The entry a character answers a preference round with: always the same taste per character (the two voters differ for 2, 3 and 4 entries). */
export const gameChoice = (npcKey, entries) => entries[hashCode(npcKey) % entries.length];

export function createAutopilot({
  people, room, now = Date.now, thinkMs = THINK_MS, arriveMs = ARRIVE_MS, intervalMs = INTERVAL_MS, onChange = () => {}, log = () => {},
  document: pageDocument, setInterval: setTimer, clearInterval: clearTimer,           // injectable for tests; the page's own by default
} = {}) {
  if (!people || typeof people !== 'object') throw new TypeError('createAutopilot needs people: { key: { id, npc, api } } (ensureShowcase gives them).');
  if (!room?.id || !room?.code) throw new TypeError('createAutopilot needs room: { id, code }.');
  if (typeof now !== 'function') throw new TypeError('createAutopilot: now must be the runtime clock function.');
  const cast = Object.values(people).filter(person => person?.id && person.api && person.npc);
  const byId = new Map(cast.map(person => [person.id, person]));
  const host = cast.find(person => person.npc.host) ?? people.yao;
  if (!host) throw new TypeError('createAutopilot needs a host character (npc.host) to read the room as.');
  const voters = CUP_VOTERS.map(key => people[key]).filter(person => person && byId.has(person.id));
  const latecomers = cast.filter(person => person.npc.joins === 'after-visitor');
  const roomPath = `/rooms/${room.id}`;

  let busy = false, stopped = false, started = false, timer = null, watching = null, visitorSeenAt = null, run = null, lastTick = null;
  const counters = { ticks: 0, skipped: 0, requests: 0, mutations: 0, failures: 0 };

  const ready = iso => {
    const age = now() - parseTime(iso);
    return age >= thinkMs || age < -CLOCK_SKEW_MS;
  };
  const isHuman = member => !byId.has(member.id);

  // ---- the only two ways out of this module: one read and one mutation, both as a character --------------------------------------
  async function read(person, path) {
    if (stopped) throw STOPPED;
    counters.requests += 1; if (run) run.requests += 1;
    return person.api.get(path);
  }
  async function write(person, path, body, kind) {
    if (stopped) throw STOPPED;
    counters.requests += 1; if (run) run.requests += 1;
    const result = await person.api.post(path, body, { key: freshKey() });
    counters.mutations += 1; if (run) run.mutations += 1;
    try { onChange({ kind, npc: person.npc.key }); } catch { /* the page's refresh failing must not stop the cast */ }
    return result ?? {};
  }
  function failed(label, error) {
    counters.failures += 1; if (run) run.failures += 1;
    try { log(label, codeOf(error), error?.status); } catch { /* a logger must not break the cast */ }
  }
  /** One reaction. A failure (404 and 409 are normal races) is logged and does not stop the reactions after it; returns null then. */
  async function safe(label, work) {
    try { return await work(); }
    catch (error) { if (error !== STOPPED) failed(label, error); return null; }
  }

  // ---- reactions ---------------------------------------------------------------------------------------------------------------------
  /** 林间 comes in once a visitor has been in the room for arriveMs: she joins the room (quietly) and its chat, and uploads nothing. */
  async function arrive(members, present) {
    const waiting = latecomers.filter(person => !members.has(person.id));
    if (!waiting.length || now() - visitorSeenAt < arriveMs) return;
    for (const person of waiting) {
      if (!await safe(`arrive:${person.npc.key}`, () => write(person, `/rooms/${room.code}/join`, { joinConsent: true, participation: person.npc.participation }, 'arrive'))) continue;
      members.add(person.id);
      present.push(person);
      await safe(`arrive-chat:${person.npc.key}`, () => write(person, `${roomPath}/conversation/join`, { joinConsent: true }, 'arrive-chat'));
    }
  }

  /** An open character accepts a greeting that is thinkMs old and says hello twice. Quiet characters are never greeted: the worker refuses it. */
  async function greetings(person) {
    if (person.npc.participation !== 'open') return;
    const social = await read(person, '/social');
    for (const greeting of social.incoming ?? []) {
      if (greeting.status !== 'pending' || greeting.roomId !== room.id || !ready(greeting.createdAt)) continue;
      const accepted = await safe(`accept-greeting:${person.npc.key}`, () => write(person, `/greetings/${greeting.id}/accept`, { revision: greeting.revision }, 'greeting-accept'));
      if (!accepted) continue;
      for (const text of WELCOME_LINES) {
        if (!await safe(`welcome:${person.npc.key}`, () => write(person, `/chats/${greeting.senderId}/messages`, { text }, 'welcome'))) break;
      }
    }
  }

  /** A friend wrote last and the message is thinkMs old: answer with the line that matches how many this character has sent in the thread. */
  async function chats(person) {
    const list = await read(person, '/chats');
    for (const chat of list.chats ?? []) {
      const last = chat.lastMessage;
      if (!last || last.senderId === person.id || !chat.canSend || !ready(last.createdAt)) continue;
      await safe(`chat:${person.npc.key}`, async () => {
        const thread = await read(person, `/chats/${chat.userId}/messages`);
        const sent = (thread.messages ?? []).filter(message => message.senderId === person.id).length;
        await write(person, `/chats/${chat.userId}/messages`, { text: replyLine(sent) }, 'chat-reply');
      });
    }
  }

  /** An exchange offered to this character: accept it unless both photos show the same side, then decline. The photos are read when it is decided. */
  async function exchanges(person) {
    const list = await read(person, '/exchanges');
    const due = (list.exchanges ?? []).filter(item => item.status === 'pending' && item.recipientId === person.id && item.roomId === room.id && ready(item.createdAt));
    if (!due.length) return;
    const photos = new Map(((await read(person, roomPath)).photos ?? []).map(photo => [photo.id, photo]));
    for (const item of due) {
      const accept = wantsExchange(photos.get(item.offeredPhotoId), photos.get(item.requestedPhotoId));
      await safe(`${accept ? 'accept' : 'decline'}-exchange:${person.npc.key}`, () => (accept
        ? write(person, `/exchanges/${item.id}/accept`, { revision: item.revision, exchangeConsent: true }, 'exchange-accept')
        : write(person, `/exchanges/${item.id}/decline`, { revision: item.revision }, 'exchange-decline')));
    }
  }

  /** The album cup: the voters vote on the open match, the cup's creator closes it at three votes. */
  async function worldcups(present) {
    const active = voters.filter(person => present.includes(person));
    if (!active.length) return;
    const list = await read(active[0], `${roomPath}/worldcups?status=active`);
    for (const cup of (list.worldcups ?? []).filter(item => !item.completed).slice(0, MAX_CUPS)) {
      for (const person of active) {
        await safe(`cup:${person.npc.key}`, async () => {
          const detail = await read(person, `/worldcups/${cup.id}`);
          const match = detail.completed ? null : (detail.matches ?? []).find(item => !item.winner);
          if (!match) return;
          if (!match.myVote) {
            if (ready(cup.createdAt)) await write(person, `/worldcups/${cup.id}/matches/${match.id}/vote`, { revision: match.revision, albumId: cupPick(person.npc.key, match), voteConsent: true }, 'cup-vote');
          } else if (person.id === cup.creatorId && match.leftCount + match.rightCount >= 3) {
            await write(person, `/worldcups/${cup.id}/matches/${match.id}/advance`, { revision: match.revision, advanceConsent: true }, 'cup-advance');
          }
        });
      }
    }
  }

  /** One preference game: start it at three players, answer the open round as every joined character, reveal when all have answered. */
  async function game(summary, present) {
    let view = await read(host, `/games/${summary.id}`);
    if (view.game.phase === 'waiting') {
      if (view.players.length >= 3 && ready(view.game.createdAt)) await write(host, `/games/${summary.id}/start`, { revision: view.game.revision, startConsent: true }, 'game-start');
      return;
    }
    if (view.game.phase !== 'playing' || view.rounds.at(-1)?.status !== 'open') return;
    const players = new Set(view.players.map(player => player.id));
    let answered = 0;
    for (const person of present) {
      if (!players.has(person.id)) continue;
      const own = person === host ? view : await read(person, `/games/${summary.id}`);
      const round = own.rounds.at(-1);
      if (!own.joined || round?.status !== 'open' || round.myAnswer) continue;
      const choice = gameChoice(person.npc.key, own.options.entries);
      if (await safe(`answer:${person.npc.key}`, () => write(person, `/games/${summary.id}/answer`, { revision: round.revision, choiceId: choice.id, answerConsent: true }, 'game-answer'))) answered += 1;
    }
    if (answered) view = await read(host, `/games/${summary.id}`);
    const round = view.rounds.at(-1);
    if (round?.status === 'open' && view.players.length >= 3 && round.answeredCount >= view.players.length) {
      await write(host, `/games/${summary.id}/reveal`, { revision: round.revision, revealConsent: true }, 'game-reveal');
    }
  }
  async function games(present) {
    const list = await read(host, `${roomPath}/games`);
    const open = (list.games ?? []).filter(item => item.type === 'preference' && (item.phase === 'waiting' || item.phase === 'playing')).slice(0, MAX_GAMES);
    for (const summary of open) await safe(`game:${summary.id.slice(0, 8)}`, () => game(summary, present));
  }

  // ---- one pass --------------------------------------------------------------------------------------------------------------------------
  async function pass() {
    const view = await read(host, roomPath);                       // who is in the room; a failure here ends the pass (tick() logs it)
    const members = new Set((view.members ?? []).map(member => member.id));
    const present = cast.filter(person => members.has(person.id)); // a character that is not in the room is not asked anything
    // Is anybody but the cast here? The host is asked first; a visitor who blocked her is still in the room for the others.
    let human = (view.members ?? []).some(isHuman);
    for (const other of present) {
      if (human) break;
      if (other !== host) human = ((await safe(`look:${other.npc.key}`, () => read(other, roomPath)))?.members ?? []).some(isHuman);
    }
    if (!human) { visitorSeenAt = null; return; }                  // nobody to answer: the cast does not act on its own, and nothing is written
    visitorSeenAt ??= now();
    await safe('arrive', () => arrive(members, present));
    for (const person of present) {
      await safe(`greetings:${person.npc.key}`, () => greetings(person));
      await safe(`exchanges:${person.npc.key}`, () => exchanges(person));
      await safe(`chats:${person.npc.key}`, () => chats(person));
    }
    await safe('worldcups', () => worldcups(present));
    await safe('games', () => games(present));
  }

  async function tick() {
    if (stopped) return false;
    if (busy) { counters.skipped += 1; return false; }
    busy = true;
    const began = globalThis.performance?.now?.() ?? Date.now();
    try {
      run = { at: now(), requests: 0, mutations: 0, failures: 0 };  // inside the try: whatever the clock does, busy is released below
      await pass();
    } catch (error) { if (error !== STOPPED) failed('tick', error); }
    finally {
      counters.ticks += 1;
      lastTick = { at: null, requests: 0, mutations: 0, failures: 0, ...run, ms: (globalThis.performance?.now?.() ?? Date.now()) - began };
      run = null;
      busy = false;
    }
    return true;
  }

  // ---- the clock: only while the tab can be seen ---------------------------------------------------------------------------------------
  const pageIsVisible = () => { const visibility = (pageDocument ?? globalThis.document)?.visibilityState; return visibility === undefined || visibility === 'visible'; };
  const kick = () => { tick().catch(() => {}); };
  function arm() {
    if (timer !== null || stopped || !started || !pageIsVisible()) return;
    timer = (setTimer ?? globalThis.setInterval).call(globalThis, kick, intervalMs);
    timer?.unref?.();                                              // a forgotten stop() must not keep a Node process alive
  }
  function disarm() {
    if (timer === null) return;
    (clearTimer ?? globalThis.clearInterval).call(globalThis, timer);
    timer = null;
  }
  /** A tab that comes back is caught up at once instead of waiting for the next interval; a hidden tab gets no ticks at all. */
  function onVisibility() {
    if (stopped || !started) return;
    if (pageIsVisible()) { arm(); kick(); } else disarm();
  }

  function start() {
    if (started || stopped) return false;
    started = true;
    watching = pageDocument ?? globalThis.document ?? null;
    watching?.addEventListener?.('visibilitychange', onVisibility);
    arm();
    if (pageIsVisible()) kick();
    return true;
  }
  function stop() {
    stopped = true; started = false;
    disarm();
    watching?.removeEventListener?.('visibilitychange', onVisibility);
    watching = null;
  }

  return {
    tick, start, stop,
    get state() {
      return { running: started && !stopped, stopped, busy, ...counters, visitorSeenAt, lastTick: lastTick && { ...lastTick } };
    },
  };
}
