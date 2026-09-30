# On-device viewpoint model pack

Reproduces `web/public/ai/tc8/` (the model the browser runs to suggest a photo's viewpoint: 舞台 / 人海 / 身边 / 细节) and documents
where every byte came from. Steps 1-4 below are developer tooling: they never run in the app or in `npm run build`. The app ships only
the results: `vision.onnx`, `labels.json` (both committed) and the onnxruntime-web runtime (copied from `node_modules` at build time).
Two small scripts in this folder do run around the build: `copy-ort.mjs` (`predev` / `prebuild`) and `check-dist.mjs` (CI).

## What ships, and what does not

| File in the deployed site | What it is | Size |
| --- | --- | --- |
| `ai/tc8/vision.onnx` | TinyCLIP-ViT-8M/16 **image tower only**, dynamic int8 (QUInt8, per-tensor weights) | 8,807,127 B |
| `ai/tc8/labels.json` | class order, four L2-normalised viewpoint text vectors (512-d), logit scale, CLIP mean/std, crop size, file sizes | 17,609 B |
| `ai/ort/ort.wasm.min.mjs`, `ort-wasm-simd-threaded.mjs`, `ort-wasm-simd-threaded.wasm` | onnxruntime-web **1.30.0** WASM runtime, single thread | 50,126 + 24,381 + 14,239,897 B |
| `ai/tc8/LICENSE-TinyCLIP-MIT.txt`, `ai/LICENSE-onnxruntime-web-MIT.txt` | licence texts | |

Not shipped: the text tower (60.8 MB) and the fp32 image tower (33.3 MB). The four viewpoint vectors are computed once, here, and stored
in `labels.json`; a browser never encodes text. Nothing is loaded from huggingface.co, a CDN or any other origin at run time (they
are unreachable or unreliable from mainland China); the page fetches everything from its own origin and keeps it in Cache Storage
(`music-space-ai-v1`). Cold cost is 23.0 MB uncompressed (model + WASM); about 10.3 MB on the wire if the host gzips `.wasm` / `.onnx`
(simulated in the spike, not checked against GitHub Pages). After that it is cached.

## Source (pinned)

| | |
| --- | --- |
| ONNX export used | `onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX` **@ `9463a9c508a344c837ffefe9d724f3827bf2dc79`** (2026-01-28), file `onnx/model.onnx`, 94,071,688 B, SHA-256 `31d28cb07209533d10fc4fef73ac324ce17de6741a2372e7e1531a4ac8fdaeb2` |
| Converted from | `wkcn/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M` @ `a2a8c6eaa2549ad66eb7c31b85022bf58273a26c` (the ONNX card says "automatically converted and uploaded using the onnx-community/convert-to-onnx Space") |
| Upstream project / licence file | `microsoft/Cream`, `TinyCLIP/`; `TinyCLIP/LICENSE` last changed in `f3a5fd8aef84b6c9bc35a9179311aa15928773e5`. MIT, Copyright (c) Microsoft Corporation |
| Licence on both model cards | `license: mit` (read 2026-09-30) |
| Pre-training data named by the card | YFCC-15M (model zoo row "TinyCLIP ViT-8M/16 Text-3M": manual weight inheritance, YFCC-15M, ImageNet-1k zero-shot 41.1 %) |
| Model size | vision 10 layers, hidden 256, patch 16 (~8M parameters); text tower 3 layers, hidden 256 |

`fetch-source.mjs` pins the commit and checks the SHA-256 of all eight files it downloads, so `main` moving on cannot change the result.

## Reproduce

Tested on macOS (arm64), Node v24.19.0 / npm 11.17.0, Python 3.14.3, on 2026-09-30 in a scratch directory with fresh installs.

```sh
# 0. tooling (nothing here touches the app's package.json)
python3 -m venv scripts/ai/work/venv
scripts/ai/work/venv/bin/pip install -r scripts/ai/requirements.txt      # onnx 1.23.0, onnxruntime 1.30.0 + pinned deps
(cd scripts/ai && npm ci)                                                # @huggingface/transformers 4.3.0 (+ onnxruntime-node 1.30.0)

# 1. fetch the pinned export and verify every file (HF_ENDPOINT=https://hf-mirror.com works too; the hashes decide)
node scripts/ai/fetch-source.mjs
# 2. split into image / text towers, int8-quantise the image tower
scripts/ai/work/venv/bin/python scripts/ai/extract_tinyclip.py
# 3. embed every prompt (prompts.mjs) with the fp32 text tower
node scripts/ai/text_embed.mjs
# 4. build labels.json from the `en7` prompts and install both files, or check the committed pair without changing anything
#    (needs `npm ci` at the repo root once: it reads the .wasm size from node_modules/onnxruntime-web)
node scripts/ai/build-labels.mjs --check                                  # exit 0 = byte-identical
node scripts/ai/build-labels.mjs                                          # writes web/public/ai/tc8/{labels.json,vision.onnx}
```

`AI_WORK=/some/dir` moves the work directory (default `scripts/ai/work/`, git-ignored). `requant.py` holds quantisation variants that
were tried and not shipped (see its header).

### Output hashes (all reproduced from scratch on 2026-09-30)

| Artifact | SHA-256 |
| --- | --- |
| `vision_model.onnx` (fp32 image tower, 33,302,044 B) | `0c0dc84f851b55901cfaadf18b52c77338c530cf2fb22d0409eeebb33b488ea5` |
| `text_model.onnx` (fp32 text tower, 60,769,786 B, not shipped) | `75df04ac47265972a3e697eb286ed24cb314254b411713588d64aa08c04f2bb5` |
| `vision_model_quantized.onnx` = shipped `vision.onnx` (8,807,127 B) | `53112612a2c20a6c7af46c46de0824ea2206c9de5c3cae18ba11d3fa8fa328ca` |
| `textemb_tinyclip-8m.json` (68 prompts, 744,157 B) | `0b192ae6112de3094b63883fb5c60ef39b1ed07638fc8b18257778b9e93e7783` |
| shipped `labels.json` (17,609 B) | `a7422fc83f7f1c3b1f7133575969d9348e6fb6fa6019614ff9798d653dbdcc2e` |
| `ort.wasm.min.mjs` | `219e6a1fc8a9938268d18efca3c91d310bd2f4a59bbd13744df5b2b7fc6cee3b` |
| `ort-wasm-simd-threaded.mjs` | `e13f7f94fc51b4ca72b12faeb1ee95f4ace6dfbc8939bc718aabdc0a27c4299b` |
| `ort-wasm-simd-threaded.wasm` | `3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2` |

## onnxruntime-web copy step

`npm run ai:ort` (run automatically by `predev` and `prebuild`) runs `copy-ort.mjs`: it copies exactly those three runtime files from
`node_modules/onnxruntime-web/dist` to `web/public/ai/ort/` (git-ignored), after checking the package version (1.30.0), each file's
SHA-256 and that the `.wasm` length equals `wasmBytes` in `labels.json`. Vite copies `web/public` into `dist/` untouched; it is never
inlined into `index.html` (which stays ~1.7 MB). CI gets the files through `npm run build`, then runs `npm run ai:check`
(`check-dist.mjs`): the model and `.wasm` in `dist/ai` must have the lengths `labels.json` states, `dist/ai/ort` must hold exactly the
three runtime files, both licence texts must be present and `index.html` must stay under 5 MB.

## Changing the model or the runtime

1. Model or prompts: re-run steps 1-4, commit `vision.onnx` + `labels.json`, update the hashes above and in `THIRD_PARTY_NOTICES.md`.
2. onnxruntime-web: change `package.json`, the version and three hashes in `copy-ort.mjs`, re-run `build-labels.mjs` (records the new
   `.wasm` size), update this file and `THIRD_PARTY_NOTICES.md`.
3. Either way bump `CACHE_NAME` in `web/js/ai/space-ai.js`, so returning visitors do not keep the old bytes.

## What the numbers do and do not say

Feasibility-spike figures for this exact int8 tower and these `en7` vectors, run in a browser (WASM, single thread) on 75 CC-licensed
concert / crowd / friends / detail photos from Wikimedia Commons (the images are not in this repository): top-1 92.0 % (69 / 75), top-2
100 %; with the "sure" gate used by `space-ai.js` (cosine margin >= 0.02 and probability >= 0.5) 59 of 75 photos (79 %) were labelled
sure and all 59 were right, while the 16 unsure ones were right 62.5 % of the time. This is a small zero-shot model on a small,
public-photo test set: it says nothing about accuracy on real audiences' phone photos, so the product shows the result as a suggestion
the person can always change, never as a fact. Chinese prompts do not work with this model (see `prompts.mjs`), hence English-only prompts.
