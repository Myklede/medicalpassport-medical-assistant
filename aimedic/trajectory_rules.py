"""Inspectable late fusion of measured trajectories and recorded baseline data.

These weights/thresholds are engineering demonstrations, NOT clinical probabilities
or diagnostic criteria. References support clinician review topics, not our score.
No image-color rule can establish infection, ischemia, or normal epithelialization.
"""
from copy import deepcopy
from datetime import datetime
import math

if __package__:
    from .patient_explanations import VERSION as EXPLANATION_VERSION, SOURCES as PATIENT_SOURCES, build_patient_explanation
else:
    from patient_explanations import VERSION as EXPLANATION_VERSION, SOURCES as PATIENT_SOURCES, build_patient_explanation

TISSUES = ("necrotic", "slough", "granulation")
VERSION = "pwc-trajectory-cds-v2"
RED_FLAGS = ("fever", "spreading_redness", "purulent_drainage", "increasing_pain")
EXTRA_CONDITIONS = ("peripheral_arterial_disease", "chronic_kidney_disease", "immunosuppression")
PARAMETERS = {
    "high_hba1c_gt": 8.0, "age_context_ge": 65,
    "standard_necrotic_increase_pp": 5.0, "standard_slough_increase_pp": 10.0,
    "stall_reduction_lt_percent_per_interval": 5.0,
    "stall_min_intervals": 2, "stall_elapsed_days_gt": 7.0,
    "scab_granulation_le": 15.0, "scab_slough_le": 5.0,
    "max_unclassified_percent": 20.0,
    "non_healing_elapsed_days_ge": 7.0,
    "unchanged_tissue_tolerance_pp": 0.5,
    "unchanged_area_tolerance_percent": 5.0,
    "fpg_context_gt_mg_dl": 130.0,
}
EVIDENCE = {
    "infection_review": {
        "url": "https://www.idsociety.org/practice-guideline/diabetic-foot-infections/",
        "section": "IWGDF/IDSA 2023, recommendations 1 and 5",
        "scope": "Diabetes-related foot infection requires clinical assessment; color cannot identify anaerobic organisms.",
    },
    "perfusion_review": {
        "url": "https://iwgdfguidelines.org/wp-content/uploads/2023/07/IWGDF-2023-05-PAD-Guideline.pdf",
        "section": "IWGDF 2023 intersocietal PAD guideline",
        "scope": "Diabetes-related foot ulcer perfusion assessment; hypertension/HbA1c do not diagnose microvascular compromise.",
    },
    "offloading_review": {
        "url": "https://iwgdfguidelines.org/wp-content/uploads/2023/07/IWGDF-2023-06-Offloading-Guideline.pdf",
        "section": "IWGDF 2023 offloading, recommendations 1-2",
        "scope": "Neuropathic plantar diabetic foot ulcers; not a universal instruction for every wound site.",
    },
    "cds_boundary": {
        "url": "https://www.fda.gov/media/109618/download",
        "section": "FDA Clinical Decision Support Software, criterion 1",
        "scope": "CDS phrasing does not establish a non-device exemption for medical-image analysis.",
    },
    **PATIENT_SOURCES,
}


def number(value, name, minimum=0, maximum=None):
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not math.isfinite(value) or value < minimum or (maximum is not None and value > maximum)):
        raise ValueError(f"Invalid {name}")
    return value


def validate_observations(value):
    if value is None:
        return {}
    if not isinstance(value, dict) or set(value) - {"source", "dry_scab", "dark_linear_appearance", *RED_FLAGS}:
        raise ValueError("Invalid clinical_observations fields")
    if value and value.get("source") not in ("clinician_reported", "patient_reported"):
        raise ValueError("clinical_observations require a reported source")
    if any(type(v) is not bool for k, v in value.items() if k != "source"):
        raise ValueError("Clinical observation flags must be booleans")
    return dict(value)


def validate_baseline_context(profile):
    for name in EXTRA_CONDITIONS:
        if name in profile and type(profile[name]) is not bool:
            raise ValueError(f"{name} must be a boolean when provided")
    if profile.get("fpg_mg_dl") is not None:
        number(profile["fpg_mg_dl"], "fasting plasma glucose", minimum=1, maximum=2000)
    for key, values in (("peripheral_vascular_status", ("normal", "impaired", "unknown")),
                        ("neuropathy_status", ("present", "absent", "unknown"))):
        if key in profile and profile[key] not in values:
            raise ValueError(f"Invalid {key}")


def normalize_visits(visits):
    """Accept canonical visits or {day, tissue_metrics:{necrotic,slough,granulation}}.

    Nested metrics use percent (not fractions); extra mask pixels are explicitly
    unclassified. Never silently reorder, renormalize or impute healthy defaults.
    """
    if not isinstance(visits, list) or not 1 <= len(visits) <= 1000:
        raise ValueError("Provide 1 to 1000 ordered visits")
    normalized, last_day, last_timestamp = [], -1, None
    for raw in visits:
        if not isinstance(raw, dict):
            raise ValueError("Each visit must be an object")
        v = deepcopy(raw)
        day = number(v.get("day"), "day")
        if day <= last_day:
            raise ValueError("Days must be unique and increasing")
        last_day = day
        if "tissue_metrics" in v:
            if "tissue_percentages" in v or not isinstance(v["tissue_metrics"], dict):
                raise ValueError("Ambiguous tissue metrics")
            metrics = v.pop("tissue_metrics")
            v["tissue_percentages"] = {k: metrics.get(k) for k in TISSUES}
            for key in ("area_cm2", "wound_area_pixels", "unclassified_percentage"):
                if key in metrics:
                    if key in v and v[key] != metrics[key]:
                        raise ValueError("Conflicting measurement fields")
                    v[key] = metrics[key]
            v.setdefault("measurement_source", "caller_reported_metrics")
        tissue = v.get("tissue_percentages")
        unknown_raw = v.get("unclassified_percentage", 0)
        # An unavailable mask has no denominator; null is not zero measured tissue.
        unknown = 0 if tissue is None and unknown_raw is None else number(unknown_raw, "unclassified percentage", maximum=100)
        if tissue is not None:
            if not isinstance(tissue, dict) or set(tissue) != set(TISSUES):
                raise ValueError("Provide all three tissue percentages")
            if abs(sum(number(tissue[k], k, maximum=100) for k in TISSUES) + unknown - 100) > .001:
                raise ValueError("Tissue percentages including unclassified must sum to 100")
        for key in ("area_cm2", "wound_area_pixels", "risk_deterioration_score"):
            if v.get(key) is not None:
                number(v[key], key, maximum=1 if key == "risk_deterioration_score" else None)
                if key == "wound_area_pixels" and int(v[key]) != v[key]:
                    raise ValueError("Pixel counts must be integers")
        v.setdefault("risk_deterioration_score", None)
        quality = v.get("quality", {})
        if not isinstance(quality, dict) or ("usable_for_demo" in quality and type(quality["usable_for_demo"]) is not bool):
            raise ValueError("Invalid quality status")
        if "capture_conditions_consistent" in v and type(v["capture_conditions_consistent"]) is not bool:
            raise ValueError("Capture consistency must be a boolean")
        if v.get("timestamp") is not None:
            try:
                ts = datetime.fromisoformat(v["timestamp"].replace("Z", "+00:00"))
                if ts.utcoffset() is None or (last_timestamp is not None and ts <= last_timestamp):
                    raise ValueError("Timestamps must be timezone-aware and increasing")
                last_timestamp = ts
            except (TypeError, AttributeError) as exc:
                raise ValueError("Invalid timestamp") from exc
        v["clinical_observations"] = validate_observations(v.get("clinical_observations"))
        normalized.append(v)
    return normalized


def usable(v):
    return v.get("quality", {}).get("usable_for_demo", True) and v.get("measurement_status", "available") == "available"


def compare_visits(visits):
    """Only adjacent visits; raw pixel differences never imply physical shrinkage."""
    visits = normalize_visits(visits)
    intervals, seen = [], set()
    for i, (a, b) in enumerate(zip(visits, visits[1:])):
        if a.get("image_sha256"):
            seen.add(a["image_sha256"])
        duplicate = bool(b.get("image_sha256") and b["image_sha256"] in seen)
        source_mismatch = bool(a.get("measurement_source") and b.get("measurement_source")
                               and a["measurement_source"] != b["measurement_source"])
        model_mismatch = bool(a.get("segmentation_provenance") and b.get("segmentation_provenance")
                              and a["segmentation_provenance"] != b["segmentation_provenance"])
        consistent = not (duplicate or source_mismatch or model_mismatch)
        valid = usable(a) and usable(b) and consistent
        calibrated = valid and all(v.get("area_cm2") is not None for v in (a, b))
        pixels = valid and all(v.get("wound_area_pixels") is not None for v in (a, b))
        pixel_comparable = pixels and all(v.get("capture_conditions_consistent") is True for v in (a, b))
        tissue_ok = valid and all(v.get("tissue_percentages") is not None for v in (a, b))
        elapsed = b["day"] - a["day"]
        changes = {k: b["tissue_percentages"][k] - a["tissue_percentages"][k] for k in TISSUES} if tissue_ok else None
        area_change = b["area_cm2"] - a["area_cm2"] if calibrated else None
        pixel_change = b["wound_area_pixels"] - a["wound_area_pixels"] if pixels else None
        area_unit = "cm2" if calibrated else "pixels" if pixel_comparable else None
        start = a.get("area_cm2") if calibrated else a.get("wound_area_pixels") if pixel_comparable else None
        difference = area_change if calibrated else pixel_change if pixel_comparable else None
        intervals.append({
            "from_day": a["day"], "to_day": b["day"], "elapsed_days": elapsed,
            "from_timestamp": a.get("timestamp"), "to_timestamp": b.get("timestamp"),
            "change_percentage_points": changes,
            "change_percentage_points_per_day": {k: x / elapsed for k, x in changes.items()} if changes else None,
            "unclassified_change_pp": b.get("unclassified_percentage", 0) - a.get("unclassified_percentage", 0) if tissue_ok else None,
            "tissue_comparison_available": tissue_ok, "area_comparison_available": calibrated,
            "area_change_cm2": area_change, "area_change_cm2_per_day": area_change / elapsed if calibrated else None,
            "area_change_percent": 100 * area_change / a["area_cm2"] if calibrated and a["area_cm2"] > 0 else None,
            "area_change_pixels": pixel_change, "pixel_comparison_supports_trend": bool(pixel_comparable),
            "area_trend_unit": area_unit,
            "area_trend_change_percent": 100 * difference / start if start and difference is not None else None,
            "same_image_content": duplicate, "measurement_source_changed": source_mismatch,
            "model_changed": model_mismatch, "comparison_consistent": consistent,
        })
    return intervals


def assess_trajectory(visits, profile):
    """Rule-based late fusion, separate from the unchanged learned per-visit head.

    r = clip(intercept + sum(active image-delta terms) + baseline modifiers,0,1).
    Uncertainty is independent: missing/unreliable data must not lower risk.
    Neither score is a calibrated probability or a seven-day outcome prediction.
    """
    visits = normalize_visits(visits)
    validate_baseline_context(profile)
    intervals = compare_visits(visits)
    latest, pair = visits[-1], intervals[-1] if intervals else None
    diabetes, high = profile["has_diabetes_type_2"], profile["hba1c_level"] > PARAMETERS["high_hba1c_gt"]
    vulnerability = diabetes or high
    high_fpg = profile.get("fpg_mg_dl") is not None and profile["fpg_mg_dl"] > PARAMETERS["fpg_context_gt_mg_dl"]
    recorded_vascular = profile.get("peripheral_vascular_status") == "impaired"
    recorded_neuropathy = profile.get("neuropathy_status") == "present"
    systemic = (vulnerability or high_fpg or recorded_vascular or recorded_neuropathy or profile["hypertension"]
                or profile["age"] >= PARAMETERS["age_context_ge"] or any(profile.get(k) for k in EXTRA_CONDITIONS))
    uncertainty_terms = [{"reason": "unvalidated_models_and_rules", "value": .35}]
    if not all("usable_for_demo" in v.get("quality", {}) for v in visits[-2:]):
        uncertainty_terms.append({"reason": "quality_not_assessed", "value": .15})
    if not pair or not pair["tissue_comparison_available"]:
        uncertainty_terms.append({"reason": "latest_tissue_comparison_unavailable", "value": .65})
    if pair and pair["area_trend_unit"] is None:
        uncertainty_terms.append({"reason": "area_not_comparable", "value": .15})
    if not all(v.get("capture_conditions_consistent") is True for v in visits[-2:]):
        uncertainty_terms.append({"reason": "capture_consistency_unconfirmed", "value": .1})
    unknown = max(v.get("unclassified_percentage") or 0 for v in visits[-2:])
    if unknown:
        uncertainty_terms.append({"reason": "unclassified_wound_pixels", "value": .4 * unknown / 100})
    if pair and pair["change_percentage_points"] and max(abs(x) for x in pair["change_percentage_points"].values()) > 40:
        uncertainty_terms.append({"reason": "large_change_verify_capture_or_intervention", "value": .2})
    uncertainty = min(1., sum(x["value"] for x in uncertainty_terms))
    evaluable = bool(pair and pair["tissue_comparison_available"] and unknown <= PARAMETERS["max_unclassified_percent"])
    # A benign interpretation requires an external observation, not an untrained
    # shape/dryness classifier. Unknown symptoms are not treated as absent.
    obs = latest["clinical_observations"]
    symptoms = [k for k in RED_FLAGS if obs.get(k) is True]
    tissue = latest.get("tissue_percentages") or {}
    scab = bool(evaluable and not systemic and obs.get("source") == "clinician_reported"
                and (obs.get("dry_scab") is True or obs.get("dark_linear_appearance") is True)
                and all(obs.get(k) is False for k in RED_FLAGS)
                and tissue.get("necrotic", 0) > 0
                and tissue.get("granulation", 100) <= PARAMETERS["scab_granulation_le"]
                and tissue.get("slough", 100) <= PARAMETERS["scab_slough_le"]
                and pair["area_trend_change_percent"] is not None and pair["area_trend_change_percent"] <= 0
                and pair["change_percentage_points"]["slough"] <= 0)
    # Determine prolonged stagnation before deciding whether a color-only flag
    # can be qualified by scab context.
    stalled = []
    for item in reversed(intervals):
        reduction = item["area_trend_change_percent"]
        if (reduction is None or reduction <= -PARAMETERS["stall_reduction_lt_percent_per_interval"]
                or (stalled and item["area_trend_unit"] != stalled[0]["area_trend_unit"])):
            break
        stalled.insert(0, item)
    duration = sum(item["elapsed_days"] for item in stalled)
    stall = len(stalled) >= PARAMETERS["stall_min_intervals"] and duration > PARAMETERS["stall_elapsed_days_gt"]
    # The inclusive seven-day workflow alert is deliberately separate from the
    # legacy area-only rule above. It also works for one seven-day interval and
    # checks the entire trailing run, rather than just its final pair.
    unchanged = []
    for item in reversed(intervals):
        changes = item["change_percentage_points"]
        if (not changes or not item["comparison_consistent"]
                or max(abs(value) for value in changes.values()) > PARAMETERS["unchanged_tissue_tolerance_pp"]):
            break
        area_delta = item["area_trend_change_percent"]
        if area_delta is not None and abs(area_delta) >= PARAMETERS["unchanged_area_tolerance_percent"]:
            break
        candidate = [item, *unchanged]
        if max(abs(sum(part["change_percentage_points"][name] for part in candidate)) for name in TISSUES) > PARAMETERS["unchanged_tissue_tolerance_pp"]:
            break
        area_parts = [part for part in candidate if part["area_trend_change_percent"] is not None]
        if area_parts and len({part["area_trend_unit"] for part in area_parts}) > 1:
            break
        if len(area_parts) == len(candidate):
            cumulative_area_percent = 100 * (math.prod(1 + part["area_trend_change_percent"] / 100 for part in area_parts) - 1)
            if abs(cumulative_area_percent) >= PARAMETERS["unchanged_area_tolerance_percent"]:
                break
        unchanged = candidate
    unchanged_duration = sum(item["elapsed_days"] for item in unchanged)
    persistent_unchanged = bool(evaluable and unchanged_duration >= PARAMETERS["non_healing_elapsed_days_ge"])
    high_risk_non_healing = bool(vulnerability and persistent_unchanged)
    scab = scab and not (stall or persistent_unchanged)
    flags, fired = [], []
    contributions = [{"term": "research_intercept", "value": .10}]
    if vulnerability:
        contributions.append({"term": "diabetes_or_high_hba1c", "value": .15})
    if diabetes and high:
        contributions.append({"term": "diabetes_with_hba1c_gt_8", "value": .10})
    for enabled, term, value in ((profile["hypertension"], "hypertension_context", .03),
                                  (profile["age"] >= 65, "age_context", .03),
                                  (any(profile.get(k) for k in EXTRA_CONDITIONS), "additional_recorded_comorbidity", .08),
                                  (high_fpg, "recorded_fasting_glucose_context", .03),
                                  (recorded_vascular, "recorded_impaired_peripheral_circulation", .05),
                                  (recorded_neuropathy, "recorded_neuropathy_context", .03)):
        if enabled:
            contributions.append({"term": term, "value": value})

    for item in intervals:
        changes = item["change_percentage_points"]
        if not changes:
            continue
        current = item is pair
        for name in ("necrotic", "slough"):
            threshold = 0.0 if vulnerability else PARAMETERS[f"standard_{name}_increase_pp"]
            active = changes[name] > 0 if vulnerability else changes[name] >= threshold
            if not active:
                continue
            suppressed = current and scab and name == "necrotic"
            event = {"rule_id": "baseline_tissue_increase", "from_day": item["from_day"], "to_day": item["to_day"],
                     "tissue": name, "observed_change_pp": changes[name], "threshold_pp": threshold,
                     "threshold_operator": ">" if vulnerability else ">=", "suppressed_by_scab_context": suppressed,
                     "evidence_ids": ["infection_review", "perfusion_review"], "clinical_validation": False}
            fired.append(event)
            if not suppressed:
                flags.append({**event, "kind": "trajectory_review_flag", "scope": "latest" if current else "historical",
                              "message": "Verify estimated tissue change in person; color does not establish devitalization or infection."})
                if current:
                    contributions.append({"term": f"{name}_increase", "value": min(.25, .08 + changes[name] / 100)})
    # Require a contiguous trailing run with a consistent area unit. Never bridge
    # missing visits/calibrations or pool pixel and cm2 reductions.
    if stall:
        event = {"rule_id": "persistent_area_stagnation", "kind": "trajectory_review_flag", "scope": "latest",
                 "from_day": stalled[0]["from_day"], "to_day": latest["day"], "elapsed_days": duration,
                 "area_unit": stalled[0]["area_trend_unit"], "evidence_ids": ["perfusion_review"],
                 "clinical_validation": False, "message": "Persistent limited measured area reduction warrants clinician review; the 7-day/5% rule is illustrative."}
        fired.append(event)
        flags.append(event)
        contributions.append({"term": "persistent_area_stagnation", "value": .20 if vulnerability else .12})
    if high_risk_non_healing:
        event = {"rule_id": "high_risk_non_healing_trajectory", "kind": "trajectory_review_flag", "scope": "latest",
                 "from_day": unchanged[0]["from_day"], "to_day": latest["day"], "elapsed_days": unchanged_duration,
                 "review_level": "high_risk_non_healing_review", "diabetes_recorded": diabetes,
                 "recorded_hba1c": profile["hba1c_level"], "clinical_validation": False,
                 "evidence_ids": ["perfusion_review", "diabetes_circulation", "diabetes_immunity"],
                 "message": "Estimated tissue composition remains nearly unchanged for at least seven days alongside recorded diabetes or HbA1c above 8%. Prioritize clinician review of delayed healing, glucose control and recorded vascular/nerve findings; this research alert is not a diagnosis."}
        fired.append(event)
        flags.append(event)
    if pair and pair["area_trend_change_percent"] is not None and pair["area_trend_change_percent"] > 0:
        contributions.append({"term": "area_expansion", "value": min(.20, pair["area_trend_change_percent"] / 100)})
        event = {"rule_id": "area_expansion", "kind": "trajectory_review_flag", "scope": "latest",
                      "observed_change_percent": pair["area_trend_change_percent"], "clinical_validation": False,
                      "evidence_ids": ["perfusion_review"], "message": "Verify increased area against capture conditions and examination."}
        flags.append(event)
        fired.append(event)
    if symptoms:
        event = {"rule_id": "reported_clinical_warning_signs", "kind": "reported_symptom_review", "scope": "latest",
                 "observations": symptoms, "source": obs["source"], "evidence_ids": ["infection_review"], "clinical_validation": False}
        flags.append(event)
        fired.append(event)
        contributions.append({"term": "reported_warning_signs", "value": .50})
    if scab:
        fired.append({"rule_id": "conditional_scab_context", "day": latest["day"], "source": obs["source"],
                      "clinical_validation": False, "evidence_ids": [], "effect": "avoid color-only escalation, never confirm healing"})
    score = round(min(1., sum(x["value"] for x in contributions)), 6) if evaluable else None
    priority = "elevated_review" if flags else "manual_review" if evaluable else "insufficient_data"
    if pair and pair["change_percentage_points"]:
        changes = pair["change_percentage_points"]
        summary = f"Compared to Day {pair['from_day']:g}, Day {latest['day']:g}: " + "; ".join(
            f"estimated {k} {changes[k]:+.2f} percentage points" for k in ("granulation", "necrotic", "slough")) + "."
        if pair["area_change_cm2"] is not None:
            summary += f" Projected area {pair['area_change_cm2']:+.4g} cm2."
        elif pair["area_change_pixels"] is not None:
            summary += f" Mask area {pair['area_change_pixels']:+g} pixels; camera scale may change this count."
    else:
        summary = "Latest trajectory withheld: two adjacent, usable, consistent visits are required."
    context = (f"Recorded baseline: age {profile['age']}, type 2 diabetes {'present' if diabetes else 'not recorded'}, "
               f"HbA1c {profile['hba1c_level']:.1f}%, hypertension {'present' if profile['hypertension'] else 'not recorded'}. ")
    if profile.get("fpg_mg_dl") is not None:
        context += f"Recorded fasting plasma glucose: {profile['fpg_mg_dl']:g} mg/dL; this historical measurement is not a current glucose reading. "
    if "peripheral_vascular_status" in profile:
        context += f"Recorded peripheral vascular status: {profile['peripheral_vascular_status']}. "
    if "neuropathy_status" in profile:
        context += f"Recorded neuropathy status: {profile['neuropathy_status']}. "
    if vulnerability:
        context += "Diabetes and/or HbA1c >8% increases the illustrative review sensitivity for tissue changes and stalled area reduction. "
    if scab:
        context += ("Clinician-reported dry scab/linear appearance with low slough, low granulation and non-increasing area may be compatible with normal dry epithelialization/scabbing. "
                    "This is a conditional alternative explanation, not confirmation of normal healing; dark pixels alone cannot establish necrosis. ")
    elif tissue.get("necrotic", 0) > 0:
        context += "The dark-tissue class cannot distinguish a dry healing scab from devitalized tissue; examination is required. "
    if not flags and evaluable:
        context += "No current illustrative escalation rule fired; this does not establish uncomplicated recovery or exclude infection. "
    context += "Age and hypertension are context modifiers, not proof of impaired perfusion. Blood type has no rule-based causal effect."
    recommendations = [{"text": "Compare original images, capture conditions and the wound examination before interpreting these research estimates.", "evidence_ids": ["cds_boundary"]}]
    if vulnerability:
        recommendations.append({"text": "If this is a neuropathic plantar diabetic foot ulcer, review the existing offloading plan and adherence with the treating clinician.", "evidence_ids": ["offloading_review"]})
    if flags:
        recommendations.append({"text": "Review flagged intervals and examine for local/systemic signs of infection; assess perfusion when clinically indicated. Images cannot determine organism type or establish microvascular compromise.", "evidence_ids": ["infection_review", "perfusion_review"]})
    if stall:
        recommendations.append({"text": "Limited area reduction persists beyond seven days in this illustrative rule. Arrange clinical reassessment of measurement, wound cause and current care; do not wait for this timer if clinical concerns arise.", "evidence_ids": ["perfusion_review"]})
    if high_risk_non_healing:
        recommendations.append({"text": "Prioritize review of this at-least-seven-day unchanged trajectory with the recorded diabetes/HbA1c, fasting glucose, circulation and nerve findings. Review the existing wound-care plan; do not wait seven days when symptoms or a nonhealing diabetic foot wound already warrant care.", "evidence_ids": ["diabetes_foot_care", "perfusion_review"]})
    if not evaluable:
        recommendations.append({"text": "Verify or reacquire the latest measurements; risk scoring is withheld, not set to zero.", "evidence_ids": []})
    considerations = []
    if vulnerability and any(f.get("scope") == "latest" for f in flags):
        considerations = [
            {"topic": "delayed_healing", "status": "elevated_review_concern", "probability": None, "evidence_ids": ["perfusion_review"]},
            {"topic": "microvascular_compromise", "status": "requires_perfusion_assessment_not_inferred", "probability": None, "evidence_ids": ["perfusion_review"]},
            {"topic": "secondary_anaerobic_infection", "status": "cannot_determine_from_images_or_baseline", "probability": None, "evidence_ids": ["infection_review"]},
        ]
    latest_deterioration = any(flag.get("scope") == "latest" and flag["rule_id"] in
                              ("baseline_tissue_increase", "area_expansion", "reported_clinical_warning_signs") for flag in flags)
    improving = bool(evaluable and pair["area_trend_change_percent"] is not None
                     and pair["area_trend_change_percent"] <= -PARAMETERS["unchanged_area_tolerance_percent"]
                     and pair["change_percentage_points"]["granulation"] > 0
                     and pair["change_percentage_points"]["necrotic"] <= 0
                     and pair["change_percentage_points"]["slough"] <= 0)
    healing_status = ("insufficient_data" if not evaluable else "deteriorating" if latest_deterioration
                      else "stagnant" if stall or persistent_unchanged else "improving" if improving else "insufficient_data")
    assessment = {"engine_version": VERSION, "score_status": "illustrative_not_calibrated" if evaluable else "withheld_insufficient_data",
            "Deterioration_Risk_Score": score, "Uncertainty_Score": round(uncertainty, 6),
            "score_is_probability": False, "prediction_horizon_days": None, "clinical_validation": False,
            "latest_comparison": pair, "intervals": intervals, "review_priority": priority,
            "risk_alerts": flags, "complication_considerations": considerations,
            "scab_context": {"compatible_with_reported_scab": scab, "confirmed_normal_healing": False,
                             "image_only_scab_detection": False},
            "stagnation": {"flagged": stall, "trailing_intervals": len(stalled), "elapsed_days": duration},
            "non_healing_trajectory": {"flagged": high_risk_non_healing, "persistent_unchanged": persistent_unchanged,
                "elapsed_days": unchanged_duration, "from_day": unchanged[0]["from_day"] if unchanged else None,
                "to_day": latest["day"], "baseline_vulnerability": vulnerability,
                "area_unchanged": True if unchanged and all(item["area_trend_change_percent"] is not None for item in unchanged) else None,
                "tissue_unchanged": bool(unchanged), "thresholds_are_illustrative": True},
            "healing_status": healing_status,
            "latest_analysis_status": latest.get("analysis_status", "completed"),
            "single_visit_analysis": {"available": bool(len(visits) == 1 and usable(latest)),
                "baseline_fused": bool(usable(latest)), "baseline_evaluated": True,
                "trajectory_available": bool(pair and pair["tissue_comparison_available"])},
            "baseline_risk_context": {"has_diabetes_type_2": diabetes, "hba1c_level": profile["hba1c_level"],
                "fpg_mg_dl": profile.get("fpg_mg_dl"),
                "peripheral_vascular_status": profile.get("peripheral_vascular_status", "unknown"),
                "neuropathy_status": profile.get("neuropathy_status", "unknown"),
                "source": "locked_recorded_patient_profile", "individual_diagnosis_inferred": False},
            "summary": summary, "multimodal_context": context, "recommendations": recommendations,
            "rule_provenance": {"version": VERSION, "parameters": deepcopy(PARAMETERS), "thresholds_are_illustrative": True,
                                "score_formula": "clip(sum(score_contributions), 0, 1); null when not evaluable",
                                "score_contributions": contributions, "uncertainty_contributions": uncertainty_terms,
                                "fired_rules": fired, "evidence": deepcopy(EVIDENCE),
                                "evidence_does_not_validate_scores_or_scab_thresholds": True},
            "learned_model_score_used_in_rule_score": False}
    # Explanation version is separate: templates never alter scoring or triggers.
    assessment["patient_explanation"] = build_patient_explanation(assessment, profile)
    assessment["rule_provenance"]["patient_explanation_version"] = EXPLANATION_VERSION
    for flag in flags:
        flag["patient_explanation_ref"] = "patient_explanation"
    return assessment
