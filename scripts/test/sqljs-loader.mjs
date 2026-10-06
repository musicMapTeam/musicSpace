// Module-customisation hooks behind scripts/test/sqljs-register.mjs. They change what the code under test is linked to, never the code:
//  - `node:crypto` and `node:buffer` imported from inside runtime-preview/src (the worker code that also runs in the browser)
//    -> web/static-runtime/shims/node-crypto.js and node-buffer.js, the implementations the browser build aliases in
//  - any import of `d1-adapter.mjs` (the node:sqlite D1 fake the tests use) -> runtime-preview/tests/d1-adapter-sqljs.mjs
// Everything else, including the tests' own `node:crypto`, `node:buffer` and `node:sqlite`, resolves as usual.
//
// The load hook appends one marker statement to each shim when it is evaluated (globalThis.__SPACE_SQLJS_ENGINE__.crypto / .buffer = true),
// so scripts/test/static-suite.mjs can prove that the redirect really took effect: a conformance run that silently fell back to the Node
// engine would pass and prove nothing.
const shims = new URL('../../web/static-runtime/shims/', import.meta.url);
const adapter = new URL('../../runtime-preview/tests/d1-adapter-sqljs.mjs', import.meta.url).href;
const crypto = { url: new URL('node-crypto.js', shims).href, marker: 'crypto' };
const buffer = { url: new URL('node-buffer.js', shims).href, marker: 'buffer' };
const redirected = new Map([['node:crypto', crypto], ['crypto', crypto], ['node:buffer', buffer], ['buffer', buffer]]);
const markerOf = new Map([crypto, buffer].map(shim => [shim.url, shim.marker]));

export async function resolve(specifier, context, next) {
  const parent = context.parentURL || '';
  if (parent.includes('/runtime-preview/src/') && redirected.has(specifier)) return { url: redirected.get(specifier).url, shortCircuit: true };
  if (/(?:^|\/)d1-adapter\.mjs$/.test(specifier)) return { url: adapter, shortCircuit: true };
  return next(specifier, context);
}

export async function load(url, context, next) {
  const result = await next(url, context);
  const marker = markerOf.get(url);
  if (!marker || result.source == null) return result;
  const source = Buffer.from(result.source).toString('utf8');
  return { ...result, source: `${source}\n;(globalThis.__SPACE_SQLJS_ENGINE__ ??= {}).${marker} = true;\n` };
}
