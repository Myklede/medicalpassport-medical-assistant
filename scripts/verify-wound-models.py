#!/usr/bin/env python3
"""Verify the original Git LFS models and persistent workflow in an isolated DB.

Run: outputs/wound-venv/bin/python -B scripts/verify-wound-models.py
Uses only the committed synthetic fixture and its horizontal mirror. The declared
10 px/cm scale is a QA input, not a real physical measurement. Never trains models
or reads/mutates the application's patient database.
"""
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from unittest.mock import patch
import uuid

import cv2
import numpy as np
import torch
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from aimedic.main import create_app, DEFAULT_CHECKPOINT, DEFAULT_VISUAL_CHECKPOINT


def verify_digests():
    digests = {}
    for line in (ROOT / "aimedic/checkpoints.sha256").read_text().splitlines():
        digest, name = line.split()
        with (ROOT / name).open("rb") as source:
            actual = hashlib.file_digest(source, "sha256").hexdigest()
        assert actual == digest.lower(), f"Checkpoint digest mismatch: {name}"
        digests[name] = actual
    return digests


def require(response, status=200):
    assert response.status_code == status, f"HTTP {response.status_code}: {response.text[:500]}"
    return response.json()


def verify_visuals(brief, original, expected_day):
    visual = brief["pipeline_visuals"]
    visit = brief["objective_measurements"]["visits"][-1]
    assert visual["status"] == visual["tissue_status"] == "available"
    assert visual["day"] == expected_day and base64.b64decode(visual["original_image"]) == original
    raw = cv2.imdecode(np.frombuffer(original, np.uint8), cv2.IMREAD_COLOR)
    isolated = cv2.imdecode(np.frombuffer(base64.b64decode(visual["unet_segmentation_mask"]), np.uint8), cv2.IMREAD_UNCHANGED)
    overlay = cv2.imdecode(np.frombuffer(base64.b64decode(visual["tissue_analysis_overlay"]), np.uint8), cv2.IMREAD_COLOR)
    assert isolated.shape == (*raw.shape[:2], 4) and overlay.shape == raw.shape
    mask = isolated[:, :, 3] > 0
    assert np.count_nonzero(mask) == visit["wound_area_pixels"] > 0
    assert np.array_equal(overlay[~mask], raw[~mask]), "Overlay changed pixels outside the wound mask"
    assert sum(visit["tissue_pixel_counts"].values()) == visit["wound_area_pixels"]
    assert math.isclose(sum(visit["tissue_percentages"].values()) + visit["unclassified_percentage"], 100)
    assert visit["measurement_status"] == "available"


def main():
    torch.set_num_threads(2)
    before = verify_digests()
    image = (ROOT / "public/wound-demo/day_007_rgb.png").read_bytes()
    decoded = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    encoded, mirror = cv2.imencode(".png", cv2.flip(decoded, 1))
    assert encoded
    second_image = mirror.tobytes()
    profile = json.loads((ROOT / "public/wound-demo/patient_profile.json").read_text())
    profile.update(patient_id="ORIGINAL-MODEL-QA-" + uuid.uuid4().hex, fpg_mg_dl=194,
                   peripheral_vascular_status="impaired", neuropathy_status="present")
    report = {"checkpoint_digests": before, "fixture": "synthetic colored simulator mask and horizontal mirror",
              "calibration": "10 pixels/cm supplied only for QA", "clinical_validation": False}
    with TemporaryDirectory(prefix="medipass-original-models-") as temporary, patch.dict(os.environ, {
        "MEDIPASS_TISSUE_MODEL_PATH": str(ROOT / "outputs/pwc-visual-run/best.pt"),
    }):
        database = Path(temporary) / "sessions.sqlite3"
        api = create_app(checkpoint_path=DEFAULT_CHECKPOINT, visual_checkpoint_path=DEFAULT_VISUAL_CHECKPOINT,
                         session_db_path=database)
        with TestClient(api) as client:
            body = {"patient_data": json.dumps(profile), "include_pipeline_visuals": "true", "pixels_per_cm": "10"}
            single = require(client.post("/api/analyze-wound", data=body, files={"image": ("synthetic.png", image, "image/png")}))
            verify_visuals(single, image, 0)
            assert single["trajectory_risk_assessment"]["single_visit_analysis"]["baseline_fused"]
            assert not single["objective_measurements"]["trajectory_available"]
            assert single["Deterioration_Risk_Score"] is None
            assert "9.6%" in single["patient_explanation"]["locales"]["vi"]["baseline_context"]
            low_profile = {**profile, "has_diabetes_type_2": False, "hba1c_level": 5.4,
                           "fpg_mg_dl": 95, "peripheral_vascular_status": "normal", "neuropathy_status": "absent"}
            low = require(client.post("/api/analyze-wound", data={**body, "patient_data": json.dumps(low_profile)},
                                      files={"image": ("synthetic.png", image, "image/png")}))
            first_metric = single["objective_measurements"]["visits"][0]
            low_metric = low["objective_measurements"]["visits"][0]
            assert first_metric["tissue_percentages"] == low_metric["tissue_percentages"]
            assert first_metric["risk_deterioration_score"] != low_metric["risk_deterioration_score"]
            report["single_image"] = {key: first_metric[key] for key in
                ("wound_area_pixels", "area_cm2", "tissue_pixel_counts", "tissue_percentages", "risk_deterioration_score")}
            report["same_image_lower_baseline_learned_score"] = low_metric["risk_deterioration_score"]
            sid = require(client.post("/api/wound-sessions", data={"patient_data": json.dumps(profile)}), 201)["session_id"]
            url, query = "/api/wound-sessions/" + sid, {"patient_id": profile["patient_id"]}
            api.state.checkpoint_path = Path(temporary) / "intentionally-absent.pt"
            pending = require(client.post(url + "/visits", data={**query, "day": "0", "timestamp": "2026-09-01T12:00:00Z",
                "pixels_per_cm": "10", "capture_conditions_consistent": "true", "preserve_on_model_unavailable": "true"},
                files={"image": ("synthetic.png", image, "image/png")}), 201)
            assert pending["visits"][0]["analysis_status"] == "pending_model"
            assert pending["brief"]["objective_measurements"]["visits"][0]["tissue_percentages"] is None
            first_id = pending["visits"][0]["visit_id"]
            api.state.checkpoint_path = DEFAULT_CHECKPOINT
            retried = require(client.post(url + "/visits/" + first_id + "/analyze", params=query))
            assert retried["visits"][0]["analysis_status"] == "completed" and len(retried["visits"]) == 1
            assert retried["brief"]["objective_measurements"]["visits"][0]["tissue_pixel_counts"] == first_metric["tissue_pixel_counts"]
            result = require(client.post(url + "/visits", data={**query, "day": "7", "timestamp": "2026-09-08T12:00:00Z",
                "pixels_per_cm": "10", "capture_conditions_consistent": "true", "include_pipeline_visuals": "false"},
                files={"image": ("synthetic-mirror.png", second_image, "image/png")}), 201)
            assert len(result["visits"]) == 2 and "pipeline_visuals" not in result["brief"]
            metrics = result["brief"]["objective_measurements"]["visits"]
            delta = result["brief"]["objective_measurements"]["latest_change"]
            assert result["brief"]["objective_measurements"]["latest_trajectory_available"]
            assert delta["area_change_pixels"] == metrics[1]["wound_area_pixels"] - metrics[0]["wound_area_pixels"]
            assert math.isclose(delta["area_change_cm2"], metrics[1]["area_cm2"] - metrics[0]["area_cm2"])
            for tissue in ("granulation", "slough", "necrotic"):
                assert math.isclose(delta["change_percentage_points"][tissue], metrics[1]["tissue_percentages"][tissue] - metrics[0]["tissue_percentages"][tissue])
            assert delta["elapsed_days"] == 7
            report["two_visit_comparison"] = delta
            report["healing_status"] = result["brief"]["trajectory_risk_assessment"]["healing_status"]
            report["illustrative_trajectory_risk_score"] = result["brief"]["Deterioration_Risk_Score"]
        # A new app instance reloads only this temporary DB, with no inference needed.
        with TestClient(create_app(session_db_path=database)) as restarted:
            restored = require(restarted.get(url, params=query))
            assert restored["patient_profile"] == profile and restored["visits"] == result["visits"]
            for index, (visit, original) in enumerate(zip(restored["visits"], (image, second_image))):
                historical = require(restarted.get(url + "/visits/" + visit["visit_id"], params=query))
                verify_visuals(historical["brief"], original, index * 7)
                assert len(historical["brief"]["objective_measurements"]["visits"]) == index + 1
                assert restarted.get(visit["image_path"], params=query).content == original
            assert restarted.delete(url, params={"patient_id": "OTHER-QA"}).status_code == 404
            removed = require(restarted.delete(url + "/visits/" + first_id, params=query))
            assert len(removed["visits"]) == 1 and removed["patient_profile"] == profile
            require(restarted.delete(url, params=query))
            assert require(restarted.get("/api/wound-sessions", params=query))["sessions"] == []
    assert verify_digests() == before
    report["checks"] = ["all three original checkpoints loaded", "single image plus recorded baseline", "baseline-sensitive learned score",
        "pending capture retried with actual original models", "two-visit exact deltas", "historical pipeline retained for Patient Mode uploads",
        "mask pixel count and outside-overlay equality", "exact image bytes persisted", "app restart", "patient-scoped deletion", "checkpoint bytes unchanged"]
    report["result"] = "PASS"
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
