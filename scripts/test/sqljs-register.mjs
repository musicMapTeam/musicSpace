// node --import ./scripts/test/sqljs-register.mjs --test <files>
//
// Runs the repo's existing Worker-mode tests on the stack the browser build uses: sql.js instead of node:sqlite behind the D1 adapter, and
// the pure-JS crypto / Buffer shims instead of node:crypto / node:buffer for runtime-preview/src (the tests themselves keep Node's real ones).
// The loader that does the redirecting is sqljs-loader.mjs. SPACE_TEST_ENGINE=sqljs tells the few tests that cannot run on this engine to
// skip themselves (a test that edits the database file while a worker holds it open; a Buffer-identity assertion). `node --test` hands the
// variable and the --import flag on to every test file it spawns.
// npm run test:static runs this for you (scripts/test/static-suite.mjs).
import { register } from 'node:module';

process.env.SPACE_TEST_ENGINE = 'sqljs';
register('./sqljs-loader.mjs', import.meta.url);
