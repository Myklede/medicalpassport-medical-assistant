"""Export the verified wound checkpoints for same-link browser inference.

The hosted Worker cannot execute PyTorch. This script converts the supplied
binary U-Net and synthetic tissue U-Net to ONNX, quantizes only the binary
U-Net convolution weights, and verifies the browser artifact against the
full-precision ONNX model on the bundled synthetic fixture.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import onnx
import onnxruntime as ort
import torch
from onnxruntime.quantization import QuantType, quantize_dynamic

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from aimedic.visual_pipeline import (  # noqa: E402
    DEFAULT_TISSUE_CHECKPOINT,
    DEFAULT_WOUND_CHECKPOINT,
    IMAGE_SIZE,
    WOUND_IMAGE_SIZE,
    WOUND_THRESHOLD,
    load_visual_model,
    load_wound_model,
    postprocess_wound_mask,
    prepare_wound_tensor,
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(model: torch.nn.Module, shape: tuple[int, ...], destination: Path) -> None:
    torch.manual_seed(13)
    sample = torch.randn(*shape, dtype=torch.float32)
    torch.onnx.export(
        model,
        sample,
        destination,
        input_names=["image"],
        output_names=["logits"],
        opset_version=18,
        do_constant_folding=True,
        dynamo=False,
    )
    onnx.checker.check_model(onnx.load(destination))


def fixture_mask(model_path: Path) -> np.ndarray:
    image = cv2.cvtColor(
        cv2.imread(str(ROOT / "public" / "wound-demo" / "day_007_rgb.png")),
        cv2.COLOR_BGR2RGB,
    )
    tensor = prepare_wound_tensor(image).numpy()
    logits = ort.InferenceSession(
        str(model_path), providers=["CPUExecutionProvider"]
    ).run(["logits"], {"image": tensor})[0][0, 0]
    threshold_logit = np.log(WOUND_THRESHOLD / (1 - WOUND_THRESHOLD))
    resized = cv2.resize(
        (logits > threshold_logit).astype(np.uint8),
        (image.shape[1], image.shape[0]),
        interpolation=cv2.INTER_NEAREST,
    )
    return postprocess_wound_mask(resized)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "public" / "wound-models",
    )
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)

    full_wound = output / "wound_unet_fp32.onnx"
    browser_wound = output / "wound_unet_int8.onnx"
    tissue = output / "tissue_unet_fp32.onnx"
    export(
        load_wound_model(DEFAULT_WOUND_CHECKPOINT),
        (1, 3, WOUND_IMAGE_SIZE, WOUND_IMAGE_SIZE),
        full_wound,
    )
    export(
        load_visual_model(DEFAULT_TISSUE_CHECKPOINT)[0],
        (1, 3, IMAGE_SIZE, IMAGE_SIZE),
        tissue,
    )
    quantize_dynamic(
        full_wound,
        browser_wound,
        weight_type=QuantType.QInt8,
        op_types_to_quantize=["Conv"],
    )
    onnx.checker.check_model(onnx.load(browser_wound))
    reference = fixture_mask(full_wound)
    candidate = fixture_mask(browser_wound)
    intersection = int(np.logical_and(reference, candidate).sum())
    union = int(np.logical_or(reference, candidate).sum())
    mask_iou = intersection / union if union else 1.0
    if mask_iou < 0.9:
        raise RuntimeError(f"Quantized fixture mask IoU {mask_iou:.6f} is below 0.9")
    full_wound.unlink()

    metadata = {
        "schema_version": "medipass-browser-wound-models-v1",
        "runtime": "onnxruntime-web@1.30.0",
        "wound_model": {
            "file": browser_wound.name,
            "sha256": sha256(browser_wound),
            "bytes": browser_wound.stat().st_size,
            "source_checkpoint_sha256": sha256(DEFAULT_WOUND_CHECKPOINT),
            "architecture": "smp.Unet/resnet34",
            "quantization": "dynamic_int8_conv_weights",
            "fixture_mask_iou_vs_fp32": mask_iou,
        },
        "tissue_model": {
            "file": tissue.name,
            "sha256": sha256(tissue),
            "bytes": tissue.stat().st_size,
            "source_checkpoint_sha256": sha256(DEFAULT_TISSUE_CHECKPOINT),
            "architecture": "VisualUNet",
            "quantization": "none_fp32",
            "synthetic_only": True,
        },
        "clinical_validation": False,
    }
    (output / "models.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
