#!/usr/bin/env python3
"""Step 2 of the model pack: split the TinyCLIP-ViT-8M/16 export into its two towers and int8-quantise the image tower.

  python scripts/ai/extract_tinyclip.py          (AI_WORK=/some/dir to choose the work directory; default scripts/ai/work/)

Input  <work>/models/onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX/   from fetch-source.mjs (pinned commit, verified)
Output <work>/models/local/tinyclip-8m-16/
         onnx/vision_model.onnx            fp32 image tower  pixel_values -> image_embeds
         onnx/text_model.onnx              fp32 text tower   input_ids, attention_mask -> text_embeds   (used offline by text_embed.mjs only)
         onnx/vision_model_quantized.onnx  dynamic int8 (QUInt8, per-tensor weights, default op types)  <- this is what ships as vision.onnx
         + the tokenizer / preprocessor / config files copied alongside

Needs onnx==1.23.0 and onnxruntime==1.30.0 (see requirements.txt). Only the quantised image tower is shipped; the text tower is
never sent to a browser: the four viewpoint text vectors are precomputed (text_embed.mjs, build-labels.mjs).
"""
import os
import shutil
import time
from pathlib import Path

from onnx import utils
from onnxruntime.quantization import QuantType, quantize_dynamic

WORK = Path(os.environ.get('AI_WORK') or Path(__file__).resolve().parent / 'work')
SRC = WORK / 'models' / 'onnx-community' / 'TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX'
DST = WORK / 'models' / 'local' / 'tinyclip-8m-16'

(DST / 'onnx').mkdir(parents=True, exist_ok=True)
for name in ['config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'vocab.json', 'merges.txt']:
    shutil.copy(SRC / name, DST / name)

full = SRC / 'onnx' / 'model.onnx'
t = time.time()
# vision tower: pixel_values -> image_embeds
utils.extract_model(str(full), str(DST / 'onnx' / 'vision_model.onnx'), input_names=['pixel_values'], output_names=['image_embeds'], check_model=False)
# text tower: input_ids, attention_mask -> text_embeds
utils.extract_model(str(full), str(DST / 'onnx' / 'text_model.onnx'), input_names=['input_ids', 'attention_mask'], output_names=['text_embeds'], check_model=False)
print('extracted in', round(time.time() - t, 1), 's')

quantize_dynamic(str(DST / 'onnx' / 'vision_model.onnx'), str(DST / 'onnx' / 'vision_model_quantized.onnx'), weight_type=QuantType.QUInt8)
for f in sorted(os.listdir(DST / 'onnx')):
    print('  ', f, round(os.path.getsize(DST / 'onnx' / f) / 1e6, 2), 'MB')
