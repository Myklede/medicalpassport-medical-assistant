#!/usr/bin/env python3
"""Script 2: per-visit late fusion; executable CPU forward/backward smoke test.

Install: python -m pip install torch numpy opencv-python-headless
Run: python aimedic/multimodal_model.py

Contract for Scripts 3/4:
  RGB float32 [0,1]: images [B,3,H,W] or sequences [B,T,3,H,W].
  encode_profile(): fixed 13-feature order; baseline [B,13].
  MSE: tissue_fractions vs JSON tissue_percentages / 100, in TISSUE_NAMES order.
  BCEWithLogitsLoss: risk_logit vs float risk_target, BOTH [B,1].
  Never feed risk_target, future fractions, masks or patient ID as model inputs.
  Save state_dict plus MODEL_VERSION, FEATURE_NAMES and preprocessing metadata.

Sequence mode applies the same model independently to each visit; it is causal
but not a learned temporal model. Script 4 will calculate timestamp-aware deltas.
Outputs are unvalidated estimates; a sigmoid score is not calibrated confidence.
This prototype is not FDA-cleared or established as FDA-compliant. Calling an
image-analysis output CDS does not establish the non-device CDS exemption.
FDA source: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software
PyTorch source: https://docs.pytorch.org/docs/stable/generated/torch.nn.BCEWithLogitsLoss.html
"""

import json
import math
from collections.abc import Mapping
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import Tensor, nn

MODEL_VERSION = "pwc-late-fusion-v1"
TISSUE_NAMES = ("necrotic", "slough", "granulation")
BLOOD_TYPES = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown")
FEATURE_NAMES = ("age_scaled", "hba1c_scaled", "diabetes_type_2", "hypertension") + tuple(
    f"blood_type_{name}" for name in BLOOD_TYPES
)
PREPROCESSING = {
    "color": "RGB", "pixel_scale": 255.0, "image_size": 128,
    "age_divisor": 120.0, "hba1c_divisor": 20.0,
    "feature_order": list(FEATURE_NAMES), "tissue_order": list(TISSUE_NAMES),
}


def encode_profile(profile: Mapping) -> Tensor:
    """Fixed engineering scales, not clinical normal ranges or fitted statistics.

    Required missing/invalid clinical fields fail explicitly; no healthy defaults.
    Blood type is categorical, with an explicit unknown bucket, never ordinal.
    """
    values = []
    for field, minimum, maximum in (("age", 0.0, 120.0), ("hba1c_level", 2.0, 20.0)):
        value = profile.get(field)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{field} must be a finite number")
        if not math.isfinite(value) or not minimum <= value <= maximum:
            raise ValueError(f"{field} outside supported input bounds [{minimum}, {maximum}]")
        values.append(float(value) / maximum)
    for field in ("has_diabetes_type_2", "hypertension"):
        if type(profile.get(field)) is not bool:
            raise ValueError(f"{field} must be a JSON boolean")
        values.append(float(profile[field]))
    blood = profile.get("blood_type")
    blood = "unknown" if blood is None or blood == "" else str(blood).strip()
    if blood not in BLOOD_TYPES:
        raise ValueError(f"Unsupported blood_type: {blood!r}")
    values.extend(float(blood == category) for category in BLOOD_TYPES)
    return torch.tensor(values, dtype=torch.float32)


def load_rgb_image(path: str | Path, image_size: int = 128) -> Tensor:
    """Shared train/inference preprocessing; returns contiguous float32 [3,H,W]."""
    if not 32 <= image_size <= 1024:
        raise ValueError("image_size must be 32..1024")
    raw = np.fromfile(Path(path), dtype=np.uint8)
    if not raw.size:
        raise ValueError(f"Empty image: {path}")
    bgr = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError(f"Unreadable image: {path}")
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    rgb = cv2.resize(rgb, (image_size, image_size), interpolation=cv2.INTER_AREA)
    return torch.from_numpy(np.ascontiguousarray(rgb.transpose(2, 0, 1))).float().div(255.0)


class ResidualBlock(nn.Module):
    """Small ResNet block. GroupNorm works even with a one-patient batch."""

    def __init__(self, in_channels: int, out_channels: int, stride: int = 1):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3, stride, 1, bias=False),
            nn.GroupNorm(4, out_channels), nn.ReLU(),
            nn.Conv2d(out_channels, out_channels, 3, padding=1, bias=False),
            nn.GroupNorm(4, out_channels),
        )
        self.skip = (
            nn.Identity() if in_channels == out_channels and stride == 1
            else nn.Conv2d(in_channels, out_channels, 1, stride, bias=False)
        )

    def forward(self, x: Tensor) -> Tensor:
        return torch.relu(self.body(x) + self.skip(x))


class MultimodalWoundModel(nn.Module):
    """Two independent encoders -> concatenation -> tissue and simulator-risk heads."""

    def __init__(self):
        super().__init__()
        self.vision = nn.Sequential(
            nn.Conv2d(3, 16, 3, stride=2, padding=1, bias=False),
            nn.GroupNorm(4, 16), nn.ReLU(),
            ResidualBlock(16, 16), ResidualBlock(16, 32, 2), ResidualBlock(32, 64, 2),
            nn.AdaptiveAvgPool2d(1), nn.Flatten(),
        )
        self.tabular = nn.Sequential(
            nn.Linear(len(FEATURE_NAMES), 32), nn.ReLU(), nn.Linear(32, 32), nn.ReLU(),
        )
        # z_v in R^(B x 64), z_t in R^(B x 32).
        # Late fusion z = [z_v ; z_t] in R^(B x 96), along the FEATURE axis.
        self.fusion = nn.Sequential(nn.Linear(64 + 32, 64), nn.ReLU())
        self.tissue_head = nn.Linear(64, 3)
        self.risk_head = nn.Linear(64, 1)

    def forward(self, images: Tensor, baseline: Tensor) -> dict[str, Tensor]:
        if images.ndim != 4 or images.shape[1] != 3 or min(images.shape[-2:]) < 32:
            raise ValueError("images must be [B,3,H,W], with H,W >= 32")
        if images.shape[0] < 1 or baseline.shape != (images.shape[0], len(FEATURE_NAMES)):
            raise ValueError(f"baseline must be [B,{len(FEATURE_NAMES)}] with matching nonempty B")
        parameter = self.tissue_head.weight
        if images.device != baseline.device or images.device != parameter.device:
            raise ValueError("images, baseline and model must be on the same device")
        if images.dtype != baseline.dtype or images.dtype != parameter.dtype:
            raise ValueError("images, baseline and model must have the same floating dtype")
        for name, value in (("images", images), ("baseline", baseline)):
            if not value.is_floating_point() or not torch.isfinite(value).all():
                raise ValueError(f"{name} must be finite floating-point tensors")
            if torch.any(value < 0) or torch.any(value > 1):
                raise ValueError(f"{name} must be normalized to [0,1]")
        z = torch.cat((self.vision(images), self.tabular(baseline)), dim=1)
        fused = self.fusion(z)
        # Softmax enforces nonnegative composition summing to 1 (100 percent).
        fractions = torch.softmax(self.tissue_head(fused), dim=-1)
        risk_logit = self.risk_head(fused)
        return {
            "tissue_fractions": fractions,                 # [B,3], MSE target scale
            "tissue_percentages": 100.0 * fractions,       # [B,3], display scale
            "risk_logit": risk_logit,                      # [B,1], BCEWithLogitsLoss
            "risk_deterioration_score": torch.sigmoid(risk_logit),  # [B,1]
        }

    def forward_sequence(self, images: Tensor, baseline: Tensor) -> dict[str, Tensor]:
        if images.ndim != 5 or images.shape[1] < 1:
            raise ValueError("sequence images must be [B,T,3,H,W], T >= 1")
        batch, time, channels, height, width = images.shape
        if baseline.shape != (batch, len(FEATURE_NAMES)):
            raise ValueError(f"sequence baseline must be [B,{len(FEATURE_NAMES)}]")
        # Repeat only the baseline over T; each visit sees no future image.
        repeated = baseline[:, None, :].expand(batch, time, -1).reshape(batch * time, -1)
        result = self(images.reshape(batch * time, channels, height, width), repeated)
        return {key: value.reshape(batch, time, -1) for key, value in result.items()}


def smoke_test() -> None:
    torch.manual_seed(42)
    torch.set_num_threads(2)
    profile = {"age": 62, "hba1c_level": 9.2, "has_diabetes_type_2": True,
               "hypertension": True, "blood_type": "O+"}
    baseline = encode_profile(profile).unsqueeze(0).repeat(2, 1)
    images = torch.rand(2, 3, 64, 64)
    model = MultimodalWoundModel()
    result = model(images, baseline)
    # A single gradient check, not a training loop or a trained checkpoint.
    target = torch.tensor([[0.2, 0.3, 0.5], [0.1, 0.2, 0.7]])
    loss = nn.MSELoss()(result["tissue_fractions"], target)
    loss += nn.BCEWithLogitsLoss()(result["risk_logit"], torch.tensor([[1.0], [0.0]]))
    loss.backward()
    for branch in (model.vision, model.tabular, model.tissue_head, model.risk_head):
        grads = [p.grad for p in branch.parameters() if p.grad is not None]
        assert grads and all(torch.isfinite(g).all() for g in grads)
        assert any(torch.count_nonzero(g) > 0 for g in grads)
    model.eval()
    with torch.no_grad():
        sequence = torch.rand(2, 3, 3, 64, 64)
        outputs = model.forward_sequence(sequence, baseline)
        assert outputs["tissue_percentages"].shape == (2, 3, 3)
        assert outputs["risk_deterioration_score"].shape == (2, 3, 1)
        torch.testing.assert_close(outputs["tissue_percentages"].sum(-1), torch.full((2, 3), 100.0))
        scores = outputs["risk_deterioration_score"]
        assert torch.all((scores >= 0) & (scores <= 1))
        sequence[:, 2] = 0
        changed = model.forward_sequence(sequence, baseline)
        torch.testing.assert_close(outputs["tissue_percentages"][:, :2], changed["tissue_percentages"][:, :2])
        assert model(images[:1], baseline[:1])["risk_logit"].shape == (1, 1)
    print(json.dumps({"status": "PASS", "model_version": MODEL_VERSION,
                      "tabular_features": len(FEATURE_NAMES), "trained": False,
                      "sequence_output_shapes": {k: list(v.shape) for k, v in outputs.items()}}, indent=2))


if __name__ == "__main__":
    smoke_test()
