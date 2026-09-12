
#!/usr/bin/env python3
"""Script 4: timestamp-aware tissue tracking and a research CDS-style JSON brief.

python aimedic/inference_tracker.py --checkpoint outputs/pwc-run/best.pt \
  --profile outputs/pwc-synthetic/patients/SYN000001/patient_profile.json \
  --images outputs/pwc-synthetic/patients/SYN000001/day_001_rgb.png \
           outputs/pwc-synthetic/patients/SYN000001/day_003_rgb.png \
  --out outputs/pwc-brief.json

Pass --days 1 3 when filenames do not contain day1 or day_001. No fake timestamps.
The profile and every image must belong to the SAME patient and wound episode;
file pixels cannot verify that identity. Baseline is held constant across visits.
This synthetic-trained prototype is not validated for clinical use. CDS wording
does not establish FDA compliance or a non-device exemption for image analysis.
Source: https://www.fda.gov/media/109618/download
"""
import argparse
import base64
import hashlib
import json
import math
import re
from pathlib import Path

import cv2
import numpy as np
import torch

if __package__:
    from .multimodal_model import (
        FEATURE_NAMES, MODEL_VERSION, PREPROCESSING, TISSUE_NAMES,
        MultimodalWoundModel, encode_profile, load_rgb_image,
    )
    from .synthetic_data_generator import RISK_DEFINITION, SCHEMA_VERSION
    from .train_loop import CHECKPOINT_VERSION, atomic_json
    from .visual_pipeline import build_pipeline_visuals, masked_wound_tensor
    from .trajectory_rules import normalize_visits, compare_visits, assess_trajectory
    from .patient_explanations import patient_narrative, patient_guidance
else:
    from multimodal_model import (
        FEATURE_NAMES, MODEL_VERSION, PREPROCESSING, TISSUE_NAMES,
        MultimodalWoundModel, encode_profile, load_rgb_image,
    )
    from synthetic_data_generator import RISK_DEFINITION, SCHEMA_VERSION
    from train_loop import CHECKPOINT_VERSION, atomic_json
    from visual_pipeline import build_pipeline_visuals, masked_wound_tensor
    from trajectory_rules import normalize_visits, compare_visits, assess_trajectory
    from patient_explanations import patient_narrative, patient_guidance

RULES_VERSION = "pwc-illustrative-review-v1"
# Invented research thresholds. None has clinical sensitivity/specificity evidence.
REVIEW_RULES = {
    "baseline_hba1c_gt": 8.0,
    "diabetes_hba1c_gt_8": {"necrotic_pp": 2.0, "slough_pp": 5.0, "score": 0.65},
    "other_baselines": {"necrotic_pp": 5.0, "slough_pp": 10.0, "score": 0.80},
}


def visit_days(image_paths, days=None) -> list[float]:
    if not image_paths:
        raise ValueError("At least one image is required")
    if days is None:
        days = []
        for path in image_paths:
            match = re.search(r"(?:^|[_-])day[_-]?(\d+(?:\.\d+)?)(?:[_-]|$)", Path(path).stem, re.I)
            if not match:
                raise ValueError(f"Cannot infer visit day from {Path(path).name}; supply --days")
            days.append(float(match.group(1)))
    if len(days) != len(image_paths):
        raise ValueError("Provide one day for each image, in the same order")
    if any(isinstance(d, bool) or not isinstance(d, (int, float))
           or not math.isfinite(d) or d < 0 for d in days):
        raise ValueError("Days must be finite, nonnegative numbers")
    if any(b <= a for a, b in zip(days, days[1:])):
        raise ValueError("Days must be unique and increasing; images are never silently reordered")
    return [float(day) for day in days]


def load_checkpoint(path: Path, device="cpu"):
    # weights_only avoids unrestricted pickle loading; there is no random-weight fallback.
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    if not isinstance(checkpoint, dict):
        raise ValueError("Expected a versioned checkpoint dictionary")
    if (checkpoint.get("checkpoint_version") != CHECKPOINT_VERSION
            or checkpoint.get("model_version") != MODEL_VERSION
            or checkpoint.get("dataset_schema") != SCHEMA_VERSION
            or checkpoint.get("feature_names") != list(FEATURE_NAMES)
            or checkpoint.get("risk_definition") != RISK_DEFINITION
            or checkpoint.get("trained") is not True
            or checkpoint.get("synthetic_only") is not True
            or checkpoint.get("clinical_validation") is not False
            or type(checkpoint.get("epoch")) is not int or checkpoint["epoch"] < 1):
        raise ValueError("Untrained or incompatible checkpoint metadata")
    preprocessing = checkpoint.get("preprocessing", {})
    size = preprocessing.get("image_size")
    if type(size) is not int or not 32 <= size <= 1024:
        raise ValueError("Unsupported checkpoint image_size")
    if preprocessing != {**PREPROCESSING, "image_size": size}:
        raise ValueError("Preprocessing mismatch; refusing incorrect feature/color/scale order")
    model = MultimodalWoundModel()
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    if any(not torch.isfinite(p).all() for p in model.parameters()):
        raise ValueError("Checkpoint contains non-finite weights")
    model.to(device).eval()
    return model, checkpoint


def image_quality(image: torch.Tensor) -> dict:
    rgb = (image.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mean, contrast = float(gray.mean()), float(gray.std())
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    reasons = []
    if mean < 12 or mean > 243:
        reasons.append("extreme_exposure")
    if contrast < 3:
        reasons.append("near_uniform_image")
    if sharpness < 5:
        reasons.append("low_detail_or_blur")
    return {
        "usable_for_demo": not reasons, "reasons": reasons,
        "mean_intensity": round(mean, 3), "contrast_std": round(contrast, 3),
        "laplacian_variance": round(sharpness, 3),
        "thresholds_are_engineering_heuristics": True,
        "clinical_capture_quality_validated": False,
    }


def delta_record(first: dict, last: dict) -> dict:
    elapsed = last["day"] - first["day"]
    differences = {k: last["tissue_percentages"][k] - first["tissue_percentages"][k] for k in TISSUE_NAMES}
    return {
        "from_day": first["day"], "to_day": last["day"], "elapsed_days": elapsed,
        "change_percentage_points": differences,
        "change_percentage_points_per_day": {k: v / elapsed for k, v in differences.items()},
    }


def analyze_trajectory(visits):
    """Adjacent, timestamped measurements; never invent physical scale or bridge gaps."""
    return compare_visits(visits)


def format_clinical_brief(visits: list[dict], profile: dict, provenance: dict | None = None) -> dict:
    """Deterministic, inspectable rules, not generated diagnoses or treatment plans.

    Percent changes are ABSOLUTE percentage-point differences, not relative %.
    Every interval is inspected so later improvement cannot hide an earlier flag.
    Model-estimated tissue is never presented as confirmed clinician measurement.
    """
    encode_profile(profile)
    visits = normalize_visits(visits)
    visit_days(["visit"] * len(visits), [v["day"] for v in visits])
    visits = [dict(v) for v in visits]
    segmented = all(v.get("measurement_source") == "binary_wound_mask_v2" for v in visits)
    measured = all(v.get("measurement_source") in ("binary_wound_mask_v2", "caller_reported_metrics") for v in visits)
    valid = []
    for visit in visits:
        if not visit.get("quality", {}).get("usable_for_demo", True):
            visit["tissue_percentages"] = None
            visit["risk_deterioration_score"] = None
            continue
        tissue, score = visit.get("tissue_percentages"), visit.get("risk_deterioration_score")
        if tissue is None or (score is None and not measured):
            continue
        vector = np.array([tissue[k] for k in TISSUE_NAMES], dtype=float)
        unknown = visit.get("unclassified_percentage", 0)
        if (not np.isfinite(vector).all() or np.any(vector < 0) or np.any(vector > 100)
                or not isinstance(unknown, (int, float)) or not math.isfinite(unknown) or not 0 <= unknown <= 100
                or abs(vector.sum() + unknown - 100) > 1e-3
                or (score is not None and (not math.isfinite(score) or not 0 <= score <= 1))):
            raise ValueError("Invalid raw prediction; brief generation stopped")
        valid.append(visit)
    comparable = len(visits) >= 2 and len(valid) == len(visits)
    if any(not p["tissue_comparison_available"] for p in compare_visits(visits)):
        comparable = False
    intervals = [delta_record(a, b) for a, b in zip(visits, visits[1:])] if comparable else []
    overall = delta_record(visits[0], visits[-1]) if comparable else None
    high_baseline = profile["has_diabetes_type_2"] and profile["hba1c_level"] > REVIEW_RULES["baseline_hba1c_gt"]
    group = "diabetes_hba1c_gt_8" if high_baseline else "other_baselines"
    thresholds, alerts = REVIEW_RULES[group], []
    comparisons = [("interval", item) for item in intervals]
    if comparable and len(visits) > 2:
        comparisons.append(("overall", overall))
    for scope, interval in comparisons:
        for tissue in ("necrotic", "slough"):
            change = interval["change_percentage_points"][tissue]
            threshold = thresholds[f"{tissue}_pp"]
            if change + 1e-6 >= threshold:
                alerts.append({
                    "kind": "illustrative_tissue_change_flag", "tissue": tissue,
                    "scope": scope,
                    "from_day": interval["from_day"], "to_day": interval["to_day"],
                    "observed_change_pp": change, "threshold_pp": threshold,
                    "baseline_rule_group": group, "clinical_validation": False,
                })
    if len(valid) == len(visits) and valid[-1]["risk_deterioration_score"] is not None and valid[-1]["risk_deterioration_score"] >= thresholds["score"]:
        alerts.append({
            "kind": "uncalibrated_simulator_score_flag", "day": valid[-1]["day"],
            "score": valid[-1]["risk_deterioration_score"], "threshold": thresholds["score"],
            "baseline_rule_group": group, "clinical_validation": False,
        })
    baseline_text = (
        f"Recorded baseline: age {profile['age']}, HbA1c {profile['hba1c_level']:.1f}%, "
        f"type 2 diabetes {'present' if profile['has_diabetes_type_2'] else 'not recorded as present'}, "
        f"hypertension {'present' if profile['hypertension'] else 'not recorded as present'}. "
    )
    if comparable:
        changes = overall["change_percentage_points"]
        trajectory = "; ".join(
            f"{name} {changes[name]:+.2f} percentage points" for name in TISSUE_NAMES
        )
        analysis = f"Model-estimated change over {overall['elapsed_days']:g} days: {trajectory}. " + baseline_text
        analysis += (
            "The recorded diabetes and HbA1c >8% select lower illustrative review thresholds "
            if high_baseline else "This baseline selects the standard illustrative review thresholds "
        )
        analysis += (
            f"(necrotic +{thresholds['necrotic_pp']:g} pp; slough +{thresholds['slough_pp']:g} pp per interval). "
            f"{len(alerts)} research flag(s) detected across interval/overall changes and the latest score. "
            "These thresholds do not establish clinical danger, urgency, or safety. "
            "Blood type has no assumed causal healing effect; individual feature effects are not estimated."
        )
    else:
        analysis = (
            "Trajectory withheld: at least two ordered, usable images are needed and every supplied visit must pass the demo quality gate. "
            + baseline_text + "No conclusion about healing or deterioration can be drawn from this comparison."
        )
    recommendation = (
        "Physician research review: verify patient/wound identity, compare the original images and capture conditions, "
        "and assess the recorded baseline and tissue changes independently. "
        "Do not use this synthetic-trained model to decide diagnosis, clinical urgency, or treatment."
    )
    if not comparable:
        recommendation = "Review or reacquire unusable/missing follow-up images before comparing the trajectory. " + recommendation
    elif alerts:
        recommendation = "Prioritize manual inspection of the flagged intervals in the research workflow. " + recommendation
    brief = {
        "brief_schema_version": "pwc-research-brief-v1", "patient_id": profile.get("patient_id"),
        "research_only": True, "clinical_use_allowed": False, "requires_clinician_review": True,
        "objective_measurements": {
            "measurement_status": "model_estimates_not_confirmed_measurements",
            "tissue_units": "percent_of_assumed_wound_crop", "delta_units": "percentage_points",
            "risk_score_horizon_days": 7, "visits": visits, "interval_changes": intervals,
            "overall_change": overall, "trajectory_available": comparable,
            "area_cm2": None, "area_calibration_available": False,
        },
        "multimodal_context_analysis": analysis, "system_recommendation": recommendation,
        "research_review_priority": "insufficient_data" if not comparable else "elevated" if alerts else "manual_review",
        "risk_alerts": alerts,
        "rule_provenance": {"version": RULES_VERSION, "rules": REVIEW_RULES, "clinical_validation": False},
        "uncertainty": {"calibrated": False, "confidence_interval": None,
                        "out_of_distribution_detection": "not_implemented",
                        "note": "Synthetic validation error is not patient-level uncertainty; no safety conclusion from absent flags."},
        "limitations": [
            "Trained only on synthetic colored masks, not clinical wound photographs.",
            "Assumes the full image is a wound crop; no real-image segmentation or physical area measurement.",
            "Fixed baseline across visits; cannot infer treatment response or causal effects.",
            "No diagnosis, treatment directive, FDA clearance, or established FDA compliance.",
        ],
        "provenance": provenance or {},
    }
    if segmented:
        area_intervals = analyze_trajectory(visits)
        brief["brief_schema_version"] = "pwc-research-brief-v2"
        brief["objective_measurements"].update(
            tissue_units="percent_of_binary_wound_mask_including_unclassified",
            measurement_source="binary_wound_mask_v2", longitudinal_intervals=area_intervals,
            area_cm2=visits[-1].get("area_cm2"), area_calibration_available=visits[-1].get("area_cm2") is not None)
        if overall:
            overall["unclassified_change_pp"] = visits[-1].get("unclassified_percentage", 0) - visits[0].get("unclassified_percentage", 0)
        brief["limitations"][1] = "Tissue estimates count only segmented wound pixels; unclassified pixels remain in the denominator. Area is projected area from caller-supplied same-plane scale, not a 3D surface measurement."
        brief["multimodal_context_analysis"] += " Tissue percentages use only the binary wound region. Unclassified fractions and segmentation/capture differences must be reviewed before interpreting changes. "
        calibrated = [x for x in area_intervals if x["area_comparison_available"]]
        if calibrated:
            brief["multimodal_context_analysis"] += "Projected area changes from supplied scale: " + "; ".join(
                f"day {x['from_day']:g} to {x['to_day']:g}: {x['area_change_cm2']:+.3f} cm2" for x in calibrated) + ". "
        if len(calibrated) < len(area_intervals) or not area_intervals:
            brief["multimodal_context_analysis"] += "Physical area comparison is unavailable wherever either capture lacks valid calibration or repeats the same image. Pixel counts alone cannot establish healing because camera distance/framing can change."
    assessment = assess_trajectory(visits, profile)
    brief.update(trajectory_risk_assessment=assessment, summary=assessment["summary"],
                 Deterioration_Risk_Score=assessment["Deterioration_Risk_Score"],
                 Uncertainty_Score=assessment["Uncertainty_Score"])
    brief["objective_measurements"].update(latest_change=assessment["latest_comparison"],
        longitudinal_intervals=assessment["intervals"],
        latest_trajectory_available=bool(assessment["latest_comparison"] and assessment["latest_comparison"]["tissue_comparison_available"]))
    brief["rule_provenance"]["trajectory_engine"] = assessment["rule_provenance"]
    brief["uncertainty"].update(score=assessment["Uncertainty_Score"], score_is_calibrated=False)
    # Preserve the old CLI v1 fields for existing consumers. Mask-based API briefs
    # and caller-supplied measurement briefs use the new rule engine throughout.
    if measured:
        brief["brief_schema_version"] = "pwc-research-brief-v2"
        brief["multimodal_context_analysis"] = assessment["summary"] + " " + assessment["multimodal_context"]
        brief["system_recommendation"] = " ".join(r["text"] for r in assessment["recommendations"])
        brief["risk_alerts"] = assessment["risk_alerts"]
        brief["research_review_priority"] = {"elevated_review": "elevated"}.get(assessment["review_priority"], assessment["review_priority"])
        if not segmented:
            brief["objective_measurements"].update(measurement_source="caller_reported_metrics",
                tissue_units="percent_of_reported_wound_including_unclassified", area_cm2=visits[-1].get("area_cm2"),
                area_calibration_available=visits[-1].get("area_cm2") is not None)
            brief["limitations"][1] = "Metrics and physical area are caller supplied, not independently verified."
    explanation = assessment["patient_explanation"]
    brief["patient_explanation"] = explanation
    # Keep the technical wording available without forcing patients to interpret
    # rule codes. Existing string consumers also receive the complete framework.
    brief["clinician_context_analysis"] = brief["multimodal_context_analysis"]
    brief["clinician_recommendation"] = brief["system_recommendation"]
    brief["multimodal_context_analysis"] = patient_narrative(explanation)
    brief["system_recommendation"] = patient_guidance(explanation)
    return brief


def track_wound(image_paths, patient_profile_path, checkpoint_path, days=None, device="cpu",
                include_pipeline_visuals=False, visual_checkpoint_path=None,
                segmented_measurements=False, pixels_per_cm=None, clinical_observations=None) -> dict:
    paths = [Path(path) for path in image_paths]
    days = visit_days(paths, days)
    scales = [None] * len(paths) if pixels_per_cm is None else pixels_per_cm
    observations = [None] * len(paths) if clinical_observations is None else clinical_observations
    if len(observations) != len(paths):
        raise ValueError("Provide one clinical_observations object per image, or null")
    if len(scales) != len(paths) or any(s is not None and (isinstance(s, bool) or not isinstance(s, (int, float))
            or not math.isfinite(s) or not 0 < s <= 100000) for s in scales):
        raise ValueError("Provide one positive finite pixels_per_cm scale per image, or null")
    profile = json.loads(Path(patient_profile_path).read_text(encoding="utf-8"))
    baseline = encode_profile(profile).unsqueeze(0).to(device)
    model, checkpoint = load_checkpoint(Path(checkpoint_path), device)
    visits, seen_hashes = [], {}
    with torch.inference_mode():
        for path, day, scale, observation in zip(paths, days, scales, observations):
            image = load_rgb_image(path, checkpoint["preprocessing"]["image_size"])
            quality = image_quality(image)
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            visit = {"day": day, "image_name": path.name, "image_sha256": digest, "quality": quality,
                     "tissue_percentages": None, "risk_deterioration_score": None,
                     "clinical_observations": observation}
            if digest in seen_hashes:
                visit["duplicate_content_of_day"] = seen_hashes[digest]
            seen_hashes[digest] = day
            if segmented_measurements:
                visuals = build_pipeline_visuals(path, visual_checkpoint_path, quality, day)
                visit.update(visuals["wound_measurements"])
                visit["area_cm2"] = visit["wound_area_pixels"] / scale ** 2 if scale and visit["wound_area_pixels"] else None
                visit["calibration"] = {"pixels_per_cm": scale, "method": "caller_supplied_same_plane_scale" if scale else None}
                visit["segmentation_provenance"] = {"binary": visuals.get("model"), "tissue": visuals.get("tissue_model"),
                    "processing_version": "masked_crop_counts_v2"}
                if visit["tissue_percentages"] is not None:
                    rgba = cv2.imdecode(np.frombuffer(base64.b64decode(visuals["unet_segmentation_mask"]), np.uint8), cv2.IMREAD_UNCHANGED)
                    masked, _ = masked_wound_tensor(cv2.cvtColor(rgba[..., :3], cv2.COLOR_BGR2RGB), rgba[..., 3] > 0,
                                                   checkpoint["preprocessing"]["image_size"])
                    result = model(masked.to(device), baseline)
                    # Preserve the architecture/weights, but never substitute its
                    # whole-crop tissue head for the measured masked pixel counts.
                    visit["risk_deterioration_score"] = float(result["risk_deterioration_score"][0, 0])
            elif quality["usable_for_demo"]:
                result = model(image.unsqueeze(0).to(device), baseline)
                visit["tissue_percentages"] = dict(zip(TISSUE_NAMES, result["tissue_percentages"][0].cpu().tolist()))
                visit["risk_deterioration_score"] = float(result["risk_deterioration_score"][0, 0])
            visits.append(visit)
    provenance = {
        "model_version": MODEL_VERSION, "checkpoint_epoch": checkpoint["epoch"],
        "checkpoint_sha256": hashlib.sha256(Path(checkpoint_path).read_bytes()).hexdigest(),
        "profile_sha256": hashlib.sha256(Path(patient_profile_path).read_bytes()).hexdigest(),
        "dataset_manifest_sha256": checkpoint["dataset_manifest_sha256"],
        "input_profile_marked_synthetic": profile.get("synthetic") is True,
        "synthetic_validation_metrics": checkpoint["validation"],
        "patient_and_wound_identity": "caller_asserted_not_verified_from_pixels",
    }
    brief = format_clinical_brief(visits, profile, provenance)
    if include_pipeline_visuals:
        # Optional top-level extension leaves the v1 Clinical Brief fields intact.
        # For multi-visit CLI callers the visuals always describe the LAST visit.
        brief["pipeline_visuals"] = visuals if segmented_measurements else build_pipeline_visuals(paths[-1], visual_checkpoint_path, visits[-1]["quality"], days[-1])
    return brief


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--images", type=Path, nargs="+", required=True)
    parser.add_argument("--days", type=float, nargs="+")
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    try:
        if args.out and args.out.exists():
            raise FileExistsError("Choose a new --out file; existing brief will not be overwritten")
        torch.set_num_threads(2)
        brief = track_wound(args.images, args.profile, args.checkpoint, args.days, args.device)
        if args.out:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            atomic_json(args.out, brief)
        print(json.dumps(brief, indent=2, allow_nan=False))
    except (ValueError, OSError, KeyError, RuntimeError) as exc:
        parser.exit(1, f"Inference failed: {exc}\n")


if __name__ == "__main__":
    main()
