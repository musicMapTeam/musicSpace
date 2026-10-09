// WAVE-1 STUB. vite.static.config.js aliases web/event-room/runtime-profile.js (the Node-server profile) to this file. T10 replaces it
// with the real static profile (global fetch, sql.js runtime, showcase seed, autopilot, boot). Until then the page is built with no
// runtime: nothing is intercepted, there is no demo world, and boot is reported as done so the rescue watchdog stays quiet.
if (typeof window !== 'undefined') window.__SPACE_BOOT__ = 'ready';
export const profile = {mode: 'static', controllerOptions: () => ({}), copy: {}, demo: null, ready: Promise.resolve()};
