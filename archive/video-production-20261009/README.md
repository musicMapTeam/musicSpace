# Video production archival backup — 2026-10-09

This branch retains main commit bb1071ea2d28c1d85cca909b207d84e8eb3b9144 and adds a reviewed archival snapshot. Main is unchanged. All payload files in manifest.json are preserved by ordered GitHub Release parts at https://github.com/musicMapTeam/musicSpace/releases/tag/archive-video-production-20261009.

## Contents

- source/: every retained UTF-8 source/text file at most 1 MiB with a source/document/config extension, including two production workflow scripts.
- manifest.json: all original paths, sizes, permissions, modification times, SHA-256 values, symlink targets, exclusions and duplicate groups.
- backup-ledger.json (added after upload): ordered part names, byte sizes, SHA-256 checksums, server asset ids/digests and complete compressed stream checksum.
- Release parts: complete deduplicated gzip-compressed POSIX PAX tar. Duplicates are represented by tar hardlinks, preserving every original path while storing each unique content once. Symlinks preserve the exact original target and are never followed.

The payload includes original footage, screenshots and review evidence, source music and fonts with license proofs, scripts and notes, and every distinct final/preview/version output. Only the manifest's documented dependencies, Python bytecode, render frame caches and proven intermediate render chunks were excluded. A downloaded AST model is retained because its exact pinned reproduction was not established. No local SQLite/user database is included.

## Restore

1. Download all assets named video-production.tar.gz.partNNNN from this release. Use the final backup-ledger.json to verify every part SHA-256, ordered count and total size.
2. In a new empty destination, concatenate parts in four-digit lexical order and extract: `cat video-production.tar.gz.part???? | tar -xzf -`. Do not use an extraction mode that follows existing symlinks.
3. The tar contains one top directory per root alias listed in manifest.json; `tme-video-production` maps the persistent production root, other aliases map temporary production roots, and `video-workflows` contains the two named workflow scripts. No installation into original paths is necessary for recovery.
4. Check every extracted regular file against manifest.json SHA-256 values, and check all symlink targets. Hardlinked duplicate paths must all be present and readable. A portable script in this branch can perform this verification.
5. Some preserved symlinks point to `/Users/alakazan/workplace/tme/musicSpace` or `/tmp`/`/private/tmp`. Rebase these links explicitly to the restored root aliases on another machine; for musicSpace source references, check out the retained main base commit. Its generated dist-pages/node_modules targets can be reproduced using the retained build scripts and lockfile. Exact old targets remain recorded, so rewriting is reversible.

## Verification and exclusions

Every included original regular file is SHA-256 checked while archiving, including duplicates. The writer is tested on a generated fixture for gzip concatenation, chunk splitting, file content, duplicate hardlinks and preserved symlinks. Each remote part's GitHub asset SHA-256 digest must equal its local checksum before its generated local copy is removed. The final branch commit pins the completed ledger and the release tag points at that final commit.

The backup conserves original material and does not delete any source directory. Upload alone does not authorize deletion before the complete ledger, remote digests and branch/tag verification pass.

GitHub Release asset constraints: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases — each asset must be smaller than 2 GiB; GitHub documents no total release binary-size or bandwidth limit. These assets are bounded at 512 MiB.
