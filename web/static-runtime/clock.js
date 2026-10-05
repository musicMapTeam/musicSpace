/**
 * The runtime's wall clock: max(device time, build time).
 *
 * Why: the showcase photos carry takenAt on 2026-09-26 and the worker rejects a takenAt later than now + 1 day, so a device whose
 * clock is behind the build (a wrong date, a phone that lost its time) would fail the seed. The device clock is never allowed to
 * run behind the moment this build was made. SQLite's own strftime('now') (event-exchanges.js DB_NOW) still reads the device clock,
 * but this one is never behind it, so exchange expiry stays correct under skew.
 */
export function createClock({ buildAtMs, now = Date.now } = {}) {
  if (!Number.isFinite(buildAtMs)) throw new TypeError('createClock needs buildAtMs (milliseconds since the epoch).');
  if (typeof now !== 'function') throw new TypeError('createClock: now must be a function.');
  return () => {
    const time = now();
    return Number.isFinite(time) && time > buildAtMs ? time : buildAtMs;
  };
}
