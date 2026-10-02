import { after } from 'node:test';
import { rm } from 'node:fs/promises';

const directories = new Set();
// A per-test hook may be registered before a later database handle or restarted
// server. Remove directories only after all per-test resource hooks have run.
// Windows forbids unlinking an open SQLite WAL, unlike Linux.
after(async () => {
  for (const directory of directories) {
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

export function removeTempAfterTests(directory) {
  directories.add(directory);
}
