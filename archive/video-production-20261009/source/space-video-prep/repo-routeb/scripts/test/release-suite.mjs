import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = ['tests', 'runtime-preview/tests'].flatMap(dir => readdirSync(dir).filter(name => /\.test\.(?:js|mjs)$/.test(name)).sort().map(name => `${dir}/${name}`));
// Bound simultaneous HTTP fixtures rather than scaling them to every CPU core.
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
