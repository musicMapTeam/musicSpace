/**
 * The page's runtime profile. app.js imports it FIRST, so a profile may start work (install a replacement fetch, boot an in-page room
 * service) at module evaluation, before any API client exists.
 *
 * This file is the SERVER profile: the page is served by the Node room server and talks to /api over the network. The static
 * (GitHub Pages) build swaps this module for web/static-runtime/profile.js (an alias in vite.static.config.js); the Node build never
 * sees that file.
 *
 * Shape (design section 10.2):
 *   mode               'server' | 'static'
 *   controllerOptions  () => options for createEventController (the static profile returns {fetch})
 *   copy               {key: text}: wording the static build replaces; app.js reads it through t(key, existingLiteral), so an
 *                      empty object keeps today's text byte for byte. Other keys: keepRoomInUrl (boolean), pollMs (number)
 *   demo               null, or the example-site hooks: roomInviteMarkup(room), onWorldChanged(cb), ...
 *   ready              optional Promise: boot() waits for it before the first API call and shows the toast when it rejects
 */
export const profile = { mode: 'server', controllerOptions: () => ({}), copy: {}, demo: null };
