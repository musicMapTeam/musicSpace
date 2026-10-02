import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const version = JSON.parse(readFileSync(resolve(root, 'package.json'))).version;
if (!/^\d+\.\d+\.\d+-rc\.\d+$/.test(version)) throw new Error('This packager only publishes release candidates');
const name = `MusicSpace-${version}-runtime`;
const output = resolve(root, 'delivery/releases');
const stage = resolve(output, name);
mkdirSync(output, { recursive: true });
// Fresh staging protects against accidentally carrying a prior run's files into a release.
mkdirSync(stage);
for (const item of ['dist', 'server', 'runtime-preview/src', 'runtime-preview/drizzle', 'package.json', 'RUN-ME.md', 'THIRD_PARTY_NOTICES.md']) {
  cpSync(resolve(root, item), resolve(stage, item), { recursive: true });
}
mkdirSync(resolve(stage, 'docs'), { recursive: true });
cpSync(resolve(root, 'docs/deployment.md'), resolve(stage, 'docs/deployment.md'));
function files(dir) {
  return readdirSync(dir).sort().flatMap(name => {
    const path = resolve(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
const manifest = files(stage).map(file => ({ path: relative(stage, file).replaceAll('\\', '/'), bytes: statSync(file).size, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }));
writeFileSync(resolve(stage, 'manifest.json'), JSON.stringify({ version, sourceCommit: process.env.GITHUB_SHA || null, files: manifest }, null, 2) + '\n');
execFileSync('tar', ['-czf', resolve(output, `${name}.tar.gz`), '-C', output, name]);
const archive = resolve(output, `${name}.tar.gz`);
writeFileSync(resolve(output, 'SHA256SUMS.txt'), `${createHash('sha256').update(readFileSync(archive)).digest('hex')}  ${name}.tar.gz\n`);
console.log(JSON.stringify({ archive, bytes: statSync(archive).size, files: manifest.length }));
