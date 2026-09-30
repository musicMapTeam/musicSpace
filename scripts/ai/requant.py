#!/usr/bin/env python3
"""Quantisation variants that were tried and NOT shipped (kept so the size / accuracy comparison can be repeated).

  python scripts/ai/requant.py <fp32 vision onnx> <output onnx> <variant>

  variant  pc         per-channel weights (all op types)                 8.94 MB for the 8M vision tower
           pc_matmul  per-channel, MatMul/Gemm only (Conv left in fp32)  9.53 MB
           matmul     per-tensor, MatMul/Gemm only
           pc_s8      per-channel, signed int8 weights

The shipped file is the plain per-tensor QUInt8 dynamic quantisation made by extract_tinyclip.py (8.81 MB). The variants are
larger; on the feasibility spike's 75 CC-licensed photos (Node run, en7 prompts) fp32 scored 92.0 %, the shipped int8 93.3 % and
pc_matmul 92.0 %, i.e. no accuracy reason to prefer them (differences of 1 photo are noise at n = 75). Needs onnxruntime==1.30.0.
"""
import os
import sys
import time

from onnxruntime.quantization import QuantType, quantize_dynamic

src, dst, variant = sys.argv[1:4]
t = time.time()
kw = dict(weight_type=QuantType.QUInt8)
if variant == 'pc':            # per-channel weights
    kw['per_channel'] = True
elif variant == 'pc_matmul':   # per-channel, only MatMul/Gemm (leave Conv in fp32)
    kw['per_channel'] = True
    kw['op_types_to_quantize'] = ['MatMul', 'Gemm']
elif variant == 'matmul':      # per-tensor, only MatMul/Gemm
    kw['op_types_to_quantize'] = ['MatMul', 'Gemm']
elif variant == 'pc_s8':
    kw['per_channel'] = True
    kw['weight_type'] = QuantType.QInt8
quantize_dynamic(src, dst, **kw)
print(variant, os.path.basename(dst), round(os.path.getsize(dst) / 1e6, 2), 'MB', round(time.time() - t, 1), 's')
