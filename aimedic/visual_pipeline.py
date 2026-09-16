"""Optional binary wound segmentation and masked tissue visualization.

The supplied SMP ResNet34 U-Net isolates the wound. The existing synthetic tissue
U-Net only colors pixels inside that binary mask; it does not set the boundary.
The CLI still trains that small tissue model, NOT the supplied binary checkpoint.
Neither visual model changes the existing late-fusion model or its Clinical Brief.
"""
import argparse
import base64
import hashlib
import json
import os
import pickle
from collections.abc import Mapping
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from torch.utils.data import DataLoader, Dataset

if __package__:
    from .train_loop import contained_file, load_datasets
else:
    from train_loop import contained_file, load_datasets

VISUAL_VERSION = "pwc-synthetic-unet-v1"
CLASS_NAMES = ["background", "necrotic", "slough", "granulation"]
IMAGE_SIZE = 64
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WOUND_CHECKPOINT = ROOT / "outputs" / "wound_unet_fusd.pt"
DEFAULT_TISSUE_CHECKPOINT = ROOT / "outputs" / "pwc-visual-run" / "best.pt"
WOUND_MODEL_VERSION = "pwc-fusd-resnet34-unet-v1"
WOUND_IMAGE_SIZE = 256
WOUND_THRESHOLD = 0.35
WOUND_MIN_FOREGROUND_FRACTION = 0.0025
WOUND_CLOSE_FRACTION = 0.03
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
PALETTE = np.array([[0, 0, 0], [60, 65, 78], [245, 190, 35], [230, 60, 90]], np.uint8)


def block(in_channels, out_channels):
    return nn.Sequential(nn.Conv2d(in_channels, out_channels, 3, padding=1), nn.ReLU(),
                         nn.Conv2d(out_channels, out_channels, 3, padding=1), nn.ReLU())


class VisualUNet(nn.Module):
    """Two-level U-Net with learned four-class logits [B,4,H,W]."""
    def __init__(self):
        super().__init__()
        self.enc1, self.enc2 = block(3, 8), block(8, 16)
        self.bottleneck = block(16, 32)
        self.dec2, self.dec1 = block(48, 16), block(24, 8)
        self.head = nn.Conv2d(8, 4, 1)

    def forward(self, image):
        e1 = self.enc1(image)
        e2 = self.enc2(F.max_pool2d(e1, 2))
        mid = self.bottleneck(F.max_pool2d(e2, 2))
        d2 = self.dec2(torch.cat([F.interpolate(mid, size=e2.shape[-2:], mode="bilinear", align_corners=False), e2], dim=1))
        d1 = self.dec1(torch.cat([F.interpolate(d2, size=e1.shape[-2:], mode="bilinear", align_corners=False), e1], dim=1))
        return self.head(d1)


class SyntheticSegmentationDataset(Dataset):
    def __init__(self, pairs, seed):
        self.pairs, self.seed = pairs, seed

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, index):
        image_path, mask_path = self.pairs[index]
        rgb = cv2.cvtColor(cv2.imdecode(np.fromfile(image_path, np.uint8), cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)
        mask = cv2.imdecode(np.fromfile(mask_path, np.uint8), cv2.IMREAD_GRAYSCALE)
        if mask is None or mask.shape != rgb.shape[:2] or np.any(mask > 2):
            raise ValueError("Invalid paired synthetic tissue mask")
        rgb = cv2.resize(rgb, (IMAGE_SIZE, IMAGE_SIZE), interpolation=cv2.INTER_AREA)
        mask = cv2.resize(mask, (IMAGE_SIZE, IMAGE_SIZE), interpolation=cv2.INTER_NEAREST) + 1
        rng = np.random.default_rng(self.seed + index)
        # Keep 1/4 of wound-only crops; otherwise add a known synthetic background.
        if index % 4:
            foreground = np.zeros((IMAGE_SIZE, IMAGE_SIZE), np.uint8)
            cv2.ellipse(foreground, (int(rng.integers(26, 38)), int(rng.integers(26, 38))),
                        (int(rng.integers(16, 29)), int(rng.integers(16, 29))),
                        float(rng.uniform(0, 180)), 0, 360, 1, -1)
            background = np.clip(rng.uniform(130, 230) + rng.normal(0, 8, rgb.shape), 0, 255).astype(np.uint8)
            rgb = np.where(foreground[..., None].astype(bool), rgb, background)
            mask = np.where(foreground, mask, 0).astype(np.uint8)
        return torch.from_numpy(rgb.transpose(2, 0, 1).copy()).float() / 255, torch.from_numpy(mask.astype(np.int64))


def segmentation_splits(root):
    root = Path(root).resolve()
    _, manifest = load_datasets(root)  # Reuse identity, schema, duplicate and split checks.
    pairs = {key: [] for key in ("train", "validation", "test")}
    for patient in manifest["patients"]:
        visits = json.loads(contained_file(root, patient["visits_path"]).read_text(encoding="utf-8"))
        for visit in visits:
            pairs[patient["split"]].append((contained_file(root, visit["image_path"]), contained_file(root, visit["mask_path"])))
    return {key: SyntheticSegmentationDataset(value, 1800 + i * 10000) for i, (key, value) in enumerate(pairs.items())}


def evaluate(model, loader):
    confusion = torch.zeros(4, 4, dtype=torch.int64)
    model.eval()
    with torch.inference_mode():
        for image, target in loader:
            prediction = model(image).argmax(1)
            confusion += torch.bincount((4 * target + prediction).flatten(), minlength=16).reshape(4, 4)
    intersection = confusion.diag().double()
    union = confusion.sum(0) + confusion.sum(1) - intersection
    iou = intersection / union.clamp_min(1)
    return {"mean_iou": float(iou.mean()), "class_iou": dict(zip(CLASS_NAMES, iou.tolist())), "synthetic_only": True}


def train_visual_model(data, out, epochs=5, batch_size=32):
    if epochs < 1 or batch_size < 1:
        raise ValueError("Positive epochs and batch size required")
    out = Path(out)
    if out.exists():
        raise FileExistsError("Choose a new visual-model output directory")
    splits = segmentation_splits(data)
    out.mkdir(parents=True)
    torch.manual_seed(73)
    torch.set_num_threads(2)
    model = VisualUNet()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.002)
    train_loader = DataLoader(splits["train"], batch_size=batch_size, shuffle=True, generator=torch.Generator().manual_seed(73))
    validation = DataLoader(splits["validation"], batch_size=batch_size)
    best = -1.0
    for epoch in range(1, epochs + 1):
        model.train()
        for image, target in train_loader:
            optimizer.zero_grad(set_to_none=True)
            loss = F.cross_entropy(model(image), target)
            if not torch.isfinite(loss):
                raise ValueError("Non-finite segmentation loss")
            loss.backward()
            optimizer.step()
        metrics = evaluate(model, validation)
        print(json.dumps({"epoch": epoch, "validation": metrics}), flush=True)
        if metrics["mean_iou"] > best:
            best = metrics["mean_iou"]
            torch.save({"version": VISUAL_VERSION, "trained": True, "synthetic_only": True,
                        "clinical_validation": False, "class_names": CLASS_NAMES, "image_size": IMAGE_SIZE,
                        "epoch": epoch, "validation": metrics, "model_state_dict": model.state_dict(),
                        "augmentation": "synthetic_ellipse_background_v1",
                        "manifest_sha256": hashlib.sha256((Path(data) / "manifest.json").read_bytes()).hexdigest()}, out / "best.pt")
    model, _ = load_visual_model(out / "best.pt")
    metrics = evaluate(model, DataLoader(splits["test"], batch_size=batch_size))
    (out / "test_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps({"held_out_test": metrics}), flush=True)
    return metrics


def load_visual_model(path):
    """Load the existing four-class synthetic tissue companion (also used by CLI)."""
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    if (checkpoint.get("version") != VISUAL_VERSION or checkpoint.get("trained") is not True
            or checkpoint.get("synthetic_only") is not True or checkpoint.get("clinical_validation") is not False
            or checkpoint.get("class_names") != CLASS_NAMES or checkpoint.get("image_size") != IMAGE_SIZE
            or type(checkpoint.get("epoch")) is not int or checkpoint["epoch"] < 1):
        raise ValueError("Incompatible or untrained visual checkpoint")
    model = VisualUNet()
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    if any(not torch.isfinite(p).all() for p in model.parameters()):
        raise ValueError("Non-finite visual checkpoint")
    return model.eval(), checkpoint


def load_wound_model(path):
    # Lazy import: an absent optional dependency must not break the core brief.
    import segmentation_models_pytorch as smp

    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    if not isinstance(checkpoint, Mapping):
        raise ValueError("Expected a wound model state dictionary")
    # The supplied FUSd checkpoint is a bare OrderedDict. Support common wrappers
    # too, without unsafe pickle loading or silently accepting mismatched layers.
    state = checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))
    if not isinstance(state, Mapping) or not state or any(
            not isinstance(key, str) or not torch.is_tensor(value) or not torch.isfinite(value).all()
            for key, value in state.items()):
        raise ValueError("Invalid or non-finite wound model weights")
    model = smp.Unet(encoder_name="resnet34", encoder_weights=None, in_channels=3, classes=1).cpu()
    model.load_state_dict(state, strict=True)
    return model.eval()


def prepare_wound_tensor(rgb):
    """RGB uint8 HWC -> CPU float32 [1,3,256,256], ImageNet normalization."""
    resized = cv2.resize(rgb, (WOUND_IMAGE_SIZE, WOUND_IMAGE_SIZE), interpolation=cv2.INTER_LINEAR)
    normalized = (resized.astype(np.float32) / 255.0 - IMAGENET_MEAN) / IMAGENET_STD
    return torch.from_numpy(normalized.transpose(2, 0, 1).copy()).unsqueeze(0)


def postprocess_wound_mask(mask):
    """Return one coherent dominant region for the single-wound workflow.

    The binary checkpoint can emit small detached islands. Close short boundary
    gaps, keep the dominant connected region, and fill internal holes. An
    implausibly tiny result is withheld instead of promoted to a measurement.
    """
    if not isinstance(mask, np.ndarray) or mask.ndim != 2:
        raise ValueError("Expected a two-dimensional wound mask")
    binary = np.asarray(mask, dtype=np.uint8)
    if not binary.any():
        return np.zeros(binary.shape, dtype=bool)
    radius = max(1, int(round(min(binary.shape) * WOUND_CLOSE_FRACTION)))
    kernel_size = 2 * radius + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)
    if count <= 1:
        return np.zeros(binary.shape, dtype=bool)
    dominant = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    component = np.where(labels == dominant, 255, 0).astype(np.uint8)
    minimum = max(16, int(np.ceil(binary.size * WOUND_MIN_FOREGROUND_FRACTION)))
    if int(np.count_nonzero(component)) < minimum:
        return np.zeros(binary.shape, dtype=bool)
    contours, _ = cv2.findContours(component, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(component)
    cv2.drawContours(filled, contours, -1, 255, thickness=cv2.FILLED)
    return filled.astype(bool)


def predict_wound_mask(rgb, model):
    with torch.inference_mode():
        logits = model(prepare_wound_tensor(rgb))
        if logits.shape != (1, 1, WOUND_IMAGE_SIZE, WOUND_IMAGE_SIZE) or not torch.isfinite(logits).all():
            raise ValueError("Invalid binary wound logits")
        # SMP returns logits. Threshold probabilities strictly > 0.35, then use
        # nearest-neighbor resizing so the original-size mask stays binary.
        mask = (torch.sigmoid(logits)[0, 0] > WOUND_THRESHOLD).cpu().numpy().astype(np.uint8)
    resized = cv2.resize(mask, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_NEAREST)
    return postprocess_wound_mask(resized)


def masked_wound_tensor(rgb, wound_mask, size):
    """Crop to the wound bounds; exclude skin BEFORE resampling/model inference.

    Reapply the resized mask after interpolation, preventing color leakage into
    background tensor pixels. The crop/mask are shared by tissue and risk adapters.
    """
    if wound_mask.shape != rgb.shape[:2] or wound_mask.dtype != np.bool_:
        raise ValueError("Expected an image-aligned binary mask")
    ys, xs = np.nonzero(wound_mask)
    if not len(xs):
        raise ValueError("No segmented wound pixels")
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    crop_mask = wound_mask[y0:y1, x0:x1]
    crop = np.where(crop_mask[..., None], rgb[y0:y1, x0:x1], 0).astype(np.uint8)
    resized = cv2.resize(crop, (size, size), interpolation=cv2.INTER_LINEAR)
    small_mask = cv2.resize(crop_mask.astype(np.uint8), (size, size), interpolation=cv2.INTER_NEAREST).astype(bool)
    resized[~small_mask] = 0
    return torch.from_numpy(resized.transpose(2, 0, 1).copy()).float()[None] / 255, (x0, y0, x1, y1)


def predict_tissue_labels(rgb, model, wound_mask):
    labels = np.zeros(wound_mask.shape, dtype=np.uint8)
    if not wound_mask.any():
        return labels
    tensor, (x0, y0, x1, y1) = masked_wound_tensor(rgb, wound_mask, IMAGE_SIZE)
    with torch.inference_mode():
        logits = model(tensor)
        if logits.shape != (1, 4, IMAGE_SIZE, IMAGE_SIZE) or not torch.isfinite(logits).all():
            raise ValueError("Invalid tissue logits")
        crop_labels = logits.argmax(1)[0].cpu().numpy().astype(np.uint8)
    labels[y0:y1, x0:x1] = cv2.resize(crop_labels, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)
    return np.where(wound_mask, labels, 0).astype(np.uint8)


def count_wound_tissues(labels, wound_mask):
    """Denominator is ALL segmented wound pixels, never the crop/background.

    Class zero INSIDE the mask is unclassified, not necrosis and not excluded
    from the denominator. Empty masks yield missing estimates, not 0% disease.
    """
    count = int(wound_mask.sum())
    if labels.shape != wound_mask.shape or np.any(labels[wound_mask] > 3):
        raise ValueError("Invalid aligned tissue labels")
    if count == 0:
        return {"tissue_percentages": None, "unclassified_percentage": None, "wound_area_pixels": 0}
    counts = np.bincount(labels[wound_mask], minlength=4)
    return {"tissue_percentages": {name: float(100 * counts[i] / count) for i, name in enumerate(CLASS_NAMES[1:], 1)},
            "unclassified_percentage": float(100 * counts[0] / count), "wound_area_pixels": count,
            "tissue_pixel_counts": dict(zip(CLASS_NAMES, counts.tolist()))}


def encode_png(pixels):
    ok, encoded = cv2.imencode(".png", pixels)
    if not ok:
        raise ValueError("Unable to encode pipeline image")
    return base64.b64encode(encoded).decode("ascii")


def isolate_wound(rgb, wound_mask):
    isolated = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGRA)
    isolated[..., 3] = np.where(wound_mask, 255, 0).astype(np.uint8)
    return encode_png(isolated)


def render_wound_boundary(rgb, wound_mask):
    """Show the selected region with a high-contrast contour and mask alpha."""
    outlined = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    contours, _ = cv2.findContours(wound_mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    thickness = max(1, int(round(min(wound_mask.shape) / 128)))
    cv2.drawContours(outlined, contours, -1, (255, 210, 0), thickness=thickness, lineType=cv2.LINE_AA)
    rgba = cv2.cvtColor(outlined, cv2.COLOR_BGR2BGRA)
    rgba[..., 3] = np.where(wound_mask, 255, 0).astype(np.uint8)
    return encode_png(rgba)


def render_segmentation(rgb, labels, wound_mask=None):
    """Binary-mask alpha preserves dark tissue; outside pixels remain unchanged."""
    if wound_mask is None:
        wound_mask = labels > 0  # Compatibility for existing standalone callers.
    # Reapply the boundary at rendering as well; no tissue classifier can color
    # surrounding skin even if it predicts tissue everywhere in the image.
    labels = np.where(wound_mask, labels, 0).astype(np.uint8)
    overlay = np.where((wound_mask & (labels > 0))[..., None],
                       0.45 * rgb + 0.55 * PALETTE[labels], rgb).astype(np.uint8)
    return isolate_wound(rgb, wound_mask), encode_png(cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))


def build_pipeline_visuals(image_path, checkpoint_path, quality, day, tissue_checkpoint_path=None):
    raw = Path(image_path).read_bytes()
    visuals = {"schema_version": "pwc-pipeline-visuals-v1", "original_image": base64.b64encode(raw).decode("ascii"),
               "original_mime_type": "image/png" if raw.startswith(b"\x89PNG") else "image/jpeg",
               "unet_segmentation_mask": None, "tissue_analysis_overlay": None, "derived_mime_type": "image/png",
               "status": "unavailable", "day": day, "class_names": CLASS_NAMES,
               "relationship": "auxiliary_segmentation_not_late_fusion_attribution",
               "note": "Tissue estimates count pixels inside the binary wound mask, including an explicit unclassified fraction. The tissue model sees only an isolated wound crop. The separate late-fusion risk model uses that crop plus baseline data; these panels are not feature attribution.",
               "wound_measurements": {"measurement_source": "binary_wound_mask_v2", "measurement_status": "unavailable",
                                      "tissue_percentages": None, "unclassified_percentage": None, "wound_area_pixels": None},
               "clinical_validation": False}
    if not quality.get("usable_for_demo", False):
        visuals.update(status="quality_abstained", reason="Input failed the existing image-quality gate; derived images withheld.")
        return visuals
    if checkpoint_path is None or not Path(checkpoint_path).is_file():
        visuals["reason"] = "Optional wound U-Net checkpoint unavailable. Provide wound_unet_fusd.pt or set MEDIPASS_VISUAL_MODEL_PATH."
        return visuals
    try:
        model = load_wound_model(checkpoint_path)
        bgr = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        height, width = rgb.shape[:2]
        wound_mask = predict_wound_mask(rgb, model)
        visuals["wound_measurements"]["wound_area_pixels"] = int(wound_mask.sum())
        visuals.update(status="available", unet_segmentation_mask=render_wound_boundary(rgb, wound_mask),
                       processed_size={"width": width, "height": height},
                       foreground_fraction=float(wound_mask.mean()),
                       mask_postprocessing={"method": "close_dominant_component_fill_v1",
                                            "single_wound_assumption": True,
                                            "closing_radius_fraction": WOUND_CLOSE_FRACTION,
                                            "minimum_foreground_fraction": WOUND_MIN_FOREGROUND_FRACTION},
                       model={"version": WOUND_MODEL_VERSION, "architecture": "smp.Unet",
                              "encoder": "resnet34", "classes": 1, "device": "cpu",
                              "input_size": [WOUND_IMAGE_SIZE, WOUND_IMAGE_SIZE],
                              "normalization": {"mean": IMAGENET_MEAN.tolist(), "std": IMAGENET_STD.tolist()},
                              "sigmoid_threshold": WOUND_THRESHOLD, "threshold_operator": ">",
                              "source": "user_supplied_checkpoint", "clinical_validation": False,
                              "checkpoint_sha256": hashlib.sha256(Path(checkpoint_path).read_bytes()).hexdigest()})
    except (ValueError, TypeError, AttributeError, KeyError, OSError, RuntimeError, ImportError, cv2.error, pickle.UnpicklingError):
        # Optional visualization failure must not erase a valid core brief.
        visuals["reason"] = "Optional U-Net visualization unavailable; verify its trained checkpoint."
        return visuals

    try:
        if not wound_mask.any():
            labels = np.zeros((height, width), dtype=np.uint8)
            visuals["tissue_status"] = "no_wound_pixels"
        else:
            tissue_path = Path(tissue_checkpoint_path or os.getenv("MEDIPASS_TISSUE_MODEL_PATH", str(DEFAULT_TISSUE_CHECKPOINT)))
            tissue_path = ROOT / tissue_path if not tissue_path.is_absolute() else tissue_path
            tissue_model, tissue_checkpoint = load_visual_model(tissue_path)
            labels = predict_tissue_labels(rgb, tissue_model, wound_mask)
            visuals.update(tissue_status="available", tissue_model={"version": VISUAL_VERSION,
                           "epoch": tissue_checkpoint["epoch"], "synthetic_only": True,
                           "checkpoint_sha256": hashlib.sha256(tissue_path.read_bytes()).hexdigest()})
        _, visuals["tissue_analysis_overlay"] = render_segmentation(rgb, labels, wound_mask)
        visuals["wound_measurements"].update(count_wound_tissues(labels, wound_mask),
            measurement_status="available" if wound_mask.any() else "empty_wound_mask")
    except (ValueError, TypeError, AttributeError, KeyError, OSError, RuntimeError, cv2.error, pickle.UnpicklingError):
        # The binary wound isolation remains available without tissue weights.
        visuals.update(tissue_status="unavailable", reason="Wound mask available; optional synthetic tissue checkpoint unavailable or incompatible.")
    return visuals


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("outputs/pwc-synthetic"))
    parser.add_argument("--out", type=Path, default=Path("outputs/pwc-visual-run"))
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()
    train_visual_model(args.data, args.out, args.epochs, args.batch_size)
