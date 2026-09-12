#!/usr/bin/env python3
"""Script 3: train/evaluate late fusion on Script 1's patient-level splits.

python aimedic/train_loop.py --data outputs/pwc-synthetic --out outputs/pwc-run
Requires torch, numpy, opencv-python-headless. See aimedic/README.md.
The test split is evaluated once, after validation selects the checkpoint.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

if __package__:
    from .multimodal_model import (
        FEATURE_NAMES, MODEL_VERSION, PREPROCESSING, TISSUE_NAMES,
        MultimodalWoundModel, encode_profile, load_rgb_image,
    )
    from .synthetic_data_generator import RISK_DEFINITION, SCHEMA_VERSION
else:
    from multimodal_model import (
        FEATURE_NAMES, MODEL_VERSION, PREPROCESSING, TISSUE_NAMES,
        MultimodalWoundModel, encode_profile, load_rgb_image,
    )
    from synthetic_data_generator import RISK_DEFINITION, SCHEMA_VERSION

CHECKPOINT_VERSION = "pwc-checkpoint-v1"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path: Path, value: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def contained_file(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f"Missing file or path outside dataset: {relative}")
    return path


class WoundDataset(Dataset):
    """A visit is one example; assignment to a split is always by patient."""

    def __init__(self, root: Path, records: list[dict], image_size: int):
        self.root, self.records, self.image_size = root, records, image_size

    def __len__(self):
        return len(self.records)

    def __getitem__(self, index):
        record = self.records[index]
        return (
            load_rgb_image(record["image"], self.image_size),
            record["baseline"], record["tissue"], record["risk"],
        )


def load_datasets(root: Path) -> tuple[dict[str, WoundDataset], dict]:
    root = Path(root).resolve()
    manifest = read_json(root / "manifest.json")
    if (manifest.get("schema_version") != SCHEMA_VERSION
            or manifest.get("synthetic_only") is not True
            or manifest.get("split_unit") != "patient"
            or manifest.get("tissue_order") != list(TISSUE_NAMES)
            or manifest.get("risk_definition") != RISK_DEFINITION):
        raise ValueError("Dataset schema, tissue order, split unit or risk definition mismatch")
    size = manifest.get("image_size")
    if type(size) is not int or not 32 <= size <= 1024:
        raise ValueError("Invalid manifest image_size")
    records = {name: [] for name in ("train", "validation", "test")}
    seen_patients, seen_images, seen_content = set(), set(), set()
    for entry in manifest["patients"]:
        patient_id, split = entry["patient_id"], entry["split"]
        if patient_id in seen_patients or split not in records:
            raise ValueError("Duplicate patient or invalid split; refusing patient leakage")
        seen_patients.add(patient_id)
        profile = read_json(contained_file(root, entry["profile_path"]))
        if profile.get("patient_id") != patient_id or profile.get("synthetic") is not True:
            raise ValueError("Profile identity mismatch or non-synthetic profile")
        baseline = encode_profile(profile)
        visits = read_json(contained_file(root, entry["visits_path"]))
        if not visits or [v["day"] for v in visits] != manifest["days"]:
            raise ValueError("Visit days do not match manifest")
        previous_day = -math.inf
        for visit in visits:
            day = visit["day"]
            if (isinstance(day, bool) or not isinstance(day, (int, float))
                    or not math.isfinite(day) or day < 0 or day <= previous_day):
                raise ValueError("Visit days must be finite, nonnegative and increasing")
            previous_day = day
            percentages = np.array([visit["tissue_percentages"][k] for k in TISSUE_NAMES], dtype=float)
            if (not np.isfinite(percentages).all() or np.any(percentages < 0)
                    or np.any(percentages > 100) or abs(percentages.sum() - 100) > 1e-4):
                raise ValueError("Invalid tissue composition")
            risk = visit["risk_target"]
            if type(risk) is not int or risk not in (0, 1) or visit["risk_horizon_days"] != 7:
                raise ValueError("Expected a binary seven-day simulator risk target")
            image = contained_file(root, visit["image_path"])
            digest = hashlib.sha256(image.read_bytes()).hexdigest()
            if image in seen_images or digest in seen_content:
                raise ValueError("Duplicate image path/content; refusing sample leakage")
            seen_images.add(image)
            seen_content.add(digest)
            # Only current image and baseline are inputs. Future outcome data,
            # masks and patient_id are deliberately excluded from model inputs.
            records[split].append({
                "image": image, "baseline": baseline,
                "tissue": torch.tensor(percentages / 100, dtype=torch.float32),
                "risk": torch.tensor([risk], dtype=torch.float32),
            })
    if any(not rows for rows in records.values()):
        raise ValueError("Each patient split must contain at least one visit")
    return {name: WoundDataset(root, rows, size) for name, rows in records.items()}, manifest


def run_epoch(model, loader, device, tissue_weight, risk_weight, optimizer=None) -> dict:
    training = optimizer is not None
    model.train(training)
    count, loss_sum, mse_sum, bce_sum, brier_sum = 0, 0.0, 0.0, 0.0, 0.0
    errors = torch.zeros(3, device=device)
    tp = tn = fp = fn = 0
    with torch.set_grad_enabled(training):
        for images, baseline, tissue, risk in loader:
            images, baseline, tissue, risk = [x.to(device) for x in (images, baseline, tissue, risk)]
            if training:
                optimizer.zero_grad(set_to_none=True)
            prediction = model(images, baseline)
            # Both risk tensors are [B,1]. Apply BCE to LOGITS, not sigmoid twice.
            mse = nn.functional.mse_loss(prediction["tissue_fractions"], tissue)
            bce = nn.functional.binary_cross_entropy_with_logits(prediction["risk_logit"], risk)
            loss = tissue_weight * mse + risk_weight * bce
            if not torch.isfinite(loss):
                raise FloatingPointError("Non-finite loss; checkpoint not saved")
            if training:
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), 5.0, error_if_nonfinite=True)
                optimizer.step()
            batch = images.shape[0]
            count += batch
            loss_sum += loss.item() * batch
            mse_sum += mse.item() * batch
            bce_sum += bce.item() * batch
            scores = prediction["risk_deterioration_score"].detach()
            brier_sum += ((scores - risk) ** 2).sum().item()
            errors += (prediction["tissue_fractions"].detach() - tissue).abs().sum(0) * 100
            predicted, actual = scores >= 0.5, risk.bool()
            tp += int((predicted & actual).sum())
            tn += int((~predicted & ~actual).sum())
            fp += int((predicted & ~actual).sum())
            fn += int((~predicted & actual).sum())
    return {
        "visits": count, "loss": loss_sum / count, "tissue_mse_fraction": mse_sum / count,
        "tissue_mae_pp": dict(zip(TISSUE_NAMES, (errors / count).cpu().tolist())),
        "risk_bce": bce_sum / count, "risk_brier": brier_sum / count,
        "risk_confusion_at_0_5": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
        "clinical_validation": False,
    }


def train(data: Path, out: Path, epochs=10, batch_size=32, learning_rate=1e-3,
          device="cpu", seed=42, workers=0, threads=2, tissue_weight=10.0, risk_weight=1.0) -> dict:
    if (epochs < 1 or batch_size < 1 or workers < 0 or threads < 1 or seed < 0
            or any(not math.isfinite(v) or v <= 0 for v in (learning_rate, tissue_weight, risk_weight))):
        raise ValueError("Invalid training parameters")
    device = torch.device(device)
    if device.type == "cuda" and not torch.cuda.is_available():
        raise ValueError("CUDA requested but unavailable; use --device cpu")
    out = Path(out).resolve()
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        raise FileExistsError(f"Choose an empty --out directory: {out}")
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(threads)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.benchmark = False
        torch.backends.cudnn.deterministic = True
    datasets, manifest = load_datasets(data)
    loaders = {
        split: DataLoader(dataset, batch_size=batch_size, shuffle=split == "train",
                          num_workers=workers, generator=torch.Generator().manual_seed(seed))
        for split, dataset in datasets.items()
    }
    out.mkdir(parents=True, exist_ok=True)
    model = MultimodalWoundModel().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    preprocessing = {**PREPROCESSING, "image_size": manifest["image_size"]}
    history, best_loss = [], math.inf
    for epoch in range(1, epochs + 1):
        train_metrics = run_epoch(model, loaders["train"], device, tissue_weight, risk_weight, optimizer)
        validation = run_epoch(model, loaders["validation"], device, tissue_weight, risk_weight)
        history.append({"epoch": epoch, "train": train_metrics, "validation": validation})
        if validation["loss"] < best_loss:
            best_loss = validation["loss"]
            checkpoint = {
                "checkpoint_version": CHECKPOINT_VERSION, "model_version": MODEL_VERSION,
                "model_state_dict": {k: v.detach().cpu() for k, v in model.state_dict().items()},
                "preprocessing": preprocessing, "feature_names": list(FEATURE_NAMES),
                "dataset_schema": SCHEMA_VERSION, "risk_definition": RISK_DEFINITION,
                "dataset_manifest_sha256": hashlib.sha256((Path(data) / "manifest.json").read_bytes()).hexdigest(),
                "trained": True, "synthetic_only": True, "clinical_validation": False,
                "epoch": epoch, "validation": validation,
                "training_config": {"seed": seed, "learning_rate": learning_rate, "batch_size": batch_size,
                                    "tissue_weight": tissue_weight, "risk_weight": risk_weight},
                "torch_version": str(torch.__version__),
            }
            temporary = out / "best.pt.tmp"
            torch.save(checkpoint, temporary)
            temporary.replace(out / "best.pt")
        atomic_json(out / "history.json", {"epochs": history})
        print(json.dumps({"epoch": epoch, "train_loss": train_metrics["loss"],
                          "validation_loss": validation["loss"], "best_loss": best_loss}), flush=True)
    # No test metrics influence optimization or checkpoint selection.
    selected = torch.load(out / "best.pt", map_location="cpu", weights_only=True)
    model.load_state_dict(selected["model_state_dict"], strict=True)
    test = run_epoch(model, loaders["test"], device, tissue_weight, risk_weight)
    report = {"best_epoch": selected["epoch"], "validation": selected["validation"], "test": test,
              "split_visits": {k: len(v) for k, v in datasets.items()}, "synthetic_only": True}
    atomic_json(out / "metrics.json", report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("outputs/pwc-synthetic"))
    parser.add_argument("--out", type=Path, default=Path("outputs/pwc-run"))
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--device", default="cpu", choices=("cpu", "cuda"))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--tissue-weight", type=float, default=10.0)
    parser.add_argument("--risk-weight", type=float, default=1.0)
    args = parser.parse_args()
    try:
        report = train(**vars(args))
    except (ValueError, OSError, KeyError, RuntimeError) as exc:
        parser.exit(1, f"Training failed: {exc}\n")
    print(json.dumps(report, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
