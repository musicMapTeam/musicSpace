#!/bin/sh
# Mirror the live Plan A page (0.16, main@54f3e6e) byte for byte for deterministic recording.  Resumes partial downloads.
B=https://musicmapteam.github.io/musicSpace
cd /tmp/space-video-prep/live-mirror
for p in ai/tc8/vision.onnx ai/tc8/labels.json ai/tc8/LICENSE-TinyCLIP-MIT.txt ai/ort/ort.wasm.min.mjs ai/ort/ort-wasm-simd-threaded.mjs ai/ort/ort-wasm-simd-threaded.wasm ai/LICENSE-onnxruntime-web-MIT.txt; do
  n=0; until curl -sS -f -C - -m 600 -o "$p" "$B/$p"; do n=$((n+1)); [ $n -ge 8 ] && { echo "FAILED $p"; break; }; sleep 2; done
  echo "$p $(wc -c < "$p")"
done
echo DONE
