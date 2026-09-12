#!/usr/bin/env python3
"""Script 1: reproducible, wholly synthetic longitudinal wound data.

Install: python -m pip install numpy opencv-python-headless
Run from the repository root:
    python aimedic/synthetic_data_generator.py
    python aimedic/synthetic_data_generator.py --out outputs/pwc-four-visits --days 1 3 7 30

Default: 1,000 patients, three visits (days 1/3/7), patient-level 70/15/15 split.
Every PNG is a dummy wound-only RGB crop, NOT a clinical photograph. Masks use
0=necrotic/black, 1=slough/yellow, 2=granulation/red; no background class.
Percentages describe pixels inside that synthetic crop, not calibrated area.
All dynamics and risk thresholds below are invented simulation assumptions.
Synthetic accuracy cannot establish clinical validity or FDA compliance.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

SCHEMA_VERSION = "pwc-synthetic-v1"
TISSUE_NAMES = ("necrotic", "slough", "granulation")
BLOOD_TYPES = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")
RISK_HORIZON_DAYS = 7
# Arbitrary simulator event, not a clinical alert threshold or diagnosis.
RISK_DEFINITION = {
    "horizon_days": RISK_HORIZON_DAYS,
    "event": "necrotic increase >= 5 pp OR necrotic+slough increase >= 10 pp",
    "clinical_validation": False,
}
PALETTE_RGB = np.array([[35, 29, 32], [216, 182, 61], [191, 57, 72]], np.float32)


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def write_png(path: Path, pixels: np.ndarray) -> None:
    # imencode + tofile also supports Unicode paths on Windows.
    ok, encoded = cv2.imencode(".png", pixels)
    if not ok:
        raise OSError(f"Could not encode {path}")
    encoded.tofile(path)


def make_profile(patient_id: str, rng: np.random.Generator) -> dict:
    age = int(rng.integers(18, 91))
    diabetic = bool(rng.random() < 0.45)
    hba1c = rng.normal(8.4, 1.5) if diabetic else rng.normal(5.3, 0.45)
    return {
        "patient_id": patient_id,
        "synthetic": True,
        "age": age,
        "blood_type": str(rng.choice(BLOOD_TYPES)),
        "has_diabetes_type_2": diabetic,
        "hba1c_level": round(float(np.clip(hba1c, 4.0, 13.0)), 1),
        "hypertension": bool(rng.random() < 0.15 + 0.004 * (age - 18)),
    }


def advance_tissue(
    tissue: np.ndarray,
    profile: dict,
    elapsed_days: int,
    individual_effect: float,
    rng: np.random.Generator,
) -> np.ndarray:
    """Daily mass-conserving simulator; higher HbA1c shifts group trajectories.

    There is individual/day noise, so baseline never determines an outcome.
    Blood type is deliberately NOT assigned a causal healing effect.
    """
    diabetic = profile["has_diabetes_type_2"]
    if diabetic and profile["hba1c_level"] > 8.0:
        velocity = np.array([0.010, 0.004, -0.014])
    elif diabetic:
        velocity = np.array([-0.004, -0.008, 0.012])
    else:
        velocity = np.array([-0.012, -0.018, 0.030])
    modifier = individual_effect + 0.001 * profile["hypertension"]
    modifier += 0.00003 * max(profile["age"] - 60, 0)
    velocity += np.array([modifier, 0.5 * modifier, -1.5 * modifier])
    current = np.asarray(tissue, dtype=np.float64).copy()
    for _ in range(elapsed_days):
        noise = rng.normal(0.0, 0.008, size=3)
        noise -= noise.mean()
        current = np.clip(current + velocity + noise, 0.002, None)
        current /= current.sum()
    return current


def render_visit(
    tissue: np.ndarray, field: np.ndarray, rng: np.random.Generator
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Render smooth patches with exact class counts; labels come from the mask."""
    raw_counts = tissue * field.size
    counts = np.floor(raw_counts).astype(int)
    remainder = field.size - int(counts.sum())
    counts[np.argsort(-(raw_counts - counts))[:remainder]] += 1
    perturbation = cv2.GaussianBlur(
        rng.normal(size=field.shape).astype(np.float32), (0, 0), 2.0
    )
    ordering = np.argsort((field + 0.15 * perturbation).ravel(), kind="stable")
    flat_mask = np.empty(field.size, np.uint8)
    flat_mask[ordering] = np.repeat(np.arange(3, dtype=np.uint8), counts)
    mask = flat_mask.reshape(field.shape)
    rgb = PALETTE_RGB[mask] * rng.uniform(0.85, 1.12)
    rgb += rng.normal(0, 7, size=rgb.shape)
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    fractions = np.bincount(mask.ravel(), minlength=3) / mask.size
    return rgb, mask, fractions


def generate_dataset(
    out: Path,
    patients: int = 1000,
    days: tuple[int, ...] = (1, 3, 7),
    image_size: int = 128,
    seed: int = 42,
) -> dict:
    if patients < 10 or not 32 <= image_size <= 1024 or seed < 0:
        raise ValueError("Require patients >= 10, image_size 32..1024, seed >= 0")
    if len(days) < 2 or any(type(d) is not int or d < 0 for d in days):
        raise ValueError("Provide at least two nonnegative integer visit days")
    if any(b <= a for a, b in zip(days, days[1:])):
        raise ValueError("Visit days must be unique and strictly increasing")
    out = Path(out).resolve()
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        raise FileExistsError(f"Choose a new --out directory; will not overwrite {out}")
    out.mkdir(parents=True, exist_ok=True)

    # Independent RNG streams keep follow-up labels from changing observed data.
    profile_seed, image_seed, outcome_seed, split_seed = np.random.SeedSequence(seed).spawn(4)
    rng = np.random.default_rng(profile_seed)
    image_rng = np.random.default_rng(image_seed)
    outcome_rng = np.random.default_rng(outcome_seed)
    shuffled = np.random.default_rng(split_seed).permutation(patients)
    split_for = {}
    for rank, index in enumerate(shuffled):
        split_for[int(index)] = (
            "train" if rank < int(0.70 * patients)
            else "validation" if rank < int(0.85 * patients) else "test"
        )

    entries, rows = [], []
    for index in range(patients):
        patient_id = f"SYN{index + 1:06d}"
        folder = out / "patients" / patient_id
        folder.mkdir(parents=True)
        profile = make_profile(patient_id, rng)
        write_json(folder / "patient_profile.json", profile)
        tissue = rng.dirichlet([2.2, 3.2, 3.6])
        individual_effect = float(rng.normal(0, 0.004))
        field = cv2.GaussianBlur(
            image_rng.normal(size=(image_size, image_size)).astype(np.float32),
            (0, 0), max(1.0, image_size / 16),
        )
        field /= max(float(field.std()), 1e-6)
        visits = []
        for step, day in enumerate(days):
            if step:
                tissue = advance_tissue(tissue, profile, day - days[step - 1], individual_effect, rng)
            rgb, mask, measured = render_visit(tissue, field, image_rng)
            image_path = folder / f"day_{day:03d}_rgb.png"
            mask_path = folder / f"day_{day:03d}_mask.png"
            write_png(image_path, cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
            write_png(mask_path, mask)

            # Simulate an independent fixed-horizon outcome for EVERY visit,
            # including the final visit. This future is a label, NEVER an input.
            future = advance_tissue(measured, profile, RISK_HORIZON_DAYS, individual_effect, outcome_rng)
            delta = future - measured
            risk_target = int(delta[0] >= 0.05 or delta[:2].sum() >= 0.10)
            percentages = np.round(measured * 100, 6)
            percentages[2] = round(100 - percentages[0] - percentages[1], 6)
            visits.append({
                "time_step": f"T_{step}",
                "day": day,
                "image_path": image_path.relative_to(out).as_posix(),
                "mask_path": mask_path.relative_to(out).as_posix(),
                "tissue_percentages": dict(zip(TISSUE_NAMES, percentages.tolist())),
                "risk_target": risk_target,
                "risk_horizon_days": RISK_HORIZON_DAYS,
                "simulated_future_day": day + RISK_HORIZON_DAYS,
                "simulated_future_fractions": future.tolist(),
            })
        visits_path = folder / "visits.json"
        write_json(visits_path, visits)
        entries.append({
            "patient_id": patient_id,
            "split": split_for[index],
            "profile_path": (folder / "patient_profile.json").relative_to(out).as_posix(),
            "visits_path": visits_path.relative_to(out).as_posix(),
        })
        group = (
            "diabetes_hba1c_gt_8" if profile["has_diabetes_type_2"] and profile["hba1c_level"] > 8
            else "other_diabetes" if profile["has_diabetes_type_2"] else "no_diabetes"
        )
        rows.append((group, visits[-1]["tissue_percentages"]["granulation"]
                     - visits[0]["tissue_percentages"]["granulation"]))

    summary = {}
    for group in ("diabetes_hba1c_gt_8", "other_diabetes", "no_diabetes"):
        changes = [change for name, change in rows if name == group]
        summary[group] = {
            "patients": len(changes),
            "mean_granulation_change_pp": round(float(np.mean(changes)), 3) if changes else None,
        }
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "synthetic_only": True,
        "seed": seed,
        "days": list(days),
        "image_size": image_size,
        "tissue_order": list(TISSUE_NAMES),
        "mask_classes": {"0": "necrotic", "1": "slough", "2": "granulation"},
        "image_scope": "entire crop is synthetic wound; no background; no area calibration",
        "risk_definition": RISK_DEFINITION,
        "split_unit": "patient",
        "summary": summary,
        "patients": entries,
    }
    # Written last: a partial run never advertises a complete dataset.
    write_json(out / "manifest.json", manifest)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("outputs/pwc-synthetic"))
    parser.add_argument("--patients", type=int, default=1000)
    parser.add_argument("--days", type=int, nargs="+", default=[1, 3, 7])
    parser.add_argument("--image-size", type=int, default=128)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    try:
        manifest = generate_dataset(args.out, args.patients, tuple(args.days), args.image_size, args.seed)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Generation failed: {exc}\n")
    print(json.dumps({"out": str(args.out.resolve()), "patients": len(manifest["patients"]),
                      "visits": len(manifest["patients"]) * len(args.days),
                      "summary": manifest["summary"]}, indent=2))


if __name__ == "__main__":
    main()
