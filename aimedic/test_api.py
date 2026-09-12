"""Python 3.14 API tests: python -B -m unittest discover -s aimedic -p 'test_*.py' -v"""
import contextlib
import base64
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import cv2
import numpy as np
from fastapi.testclient import TestClient

import main
from synthetic_data_generator import generate_dataset
from train_loop import train
from visual_pipeline import train_visual_model, render_segmentation
from test_visual_pipeline import write_binary_fixture


class WoundAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        output = Path(__file__).resolve().parents[1] / "outputs"
        output.mkdir(exist_ok=True)
        cls.temporary = TemporaryDirectory(prefix="pwc-api-tests-", dir=output)
        cls.root = Path(cls.temporary.name)
        data = cls.root / "data"
        manifest = generate_dataset(data, patients=10, image_size=32)
        with contextlib.redirect_stdout(io.StringIO()):
            train(data, cls.root / "run", epochs=1, batch_size=8)
            train_visual_model(data, cls.root / "visual", epochs=1, batch_size=8)
        cls.checkpoint = cls.root / "run" / "best.pt"
        cls.tissue_checkpoint = cls.root / "visual" / "best.pt"
        cls.visual_checkpoint = cls.root / "binary.pt"
        write_binary_fixture(cls.visual_checkpoint)
        entry = manifest["patients"][0]
        cls.profile = json.loads((data / entry["profile_path"]).read_text())
        visits = json.loads((data / entry["visits_path"]).read_text())
        cls.png = (data / visits[0]["image_path"]).read_bytes()

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def setUp(self):
        self.tissue_environment = patch.dict(main.os.environ, {"MEDIPASS_TISSUE_MODEL_PATH": str(self.tissue_checkpoint)})
        self.tissue_environment.start()
        self.addCleanup(self.tissue_environment.stop)
        self.database = self.root / f"{self._testMethodName}.sqlite3"
        self.client = TestClient(main.create_app(self.checkpoint, self.visual_checkpoint, self.database))

    def tearDown(self):
        self.client.close()

    def post(self, profile=None, content=None, mime="image/png", name="wound.png", **fields):
        return self.client.post("/api/analyze-wound", files={"image": (name, self.png if content is None else content, mime)},
                                data={"patient_data": json.dumps(self.profile if profile is None else profile), **fields})

    def test_real_inference_and_single_visit_contract(self):
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        brief = response.json()
        self.assertEqual(brief["patient_id"], self.profile["patient_id"])
        self.assertIn("multimodal_context_analysis", brief)
        self.assertIn("system_recommendation", brief)
        measurements = brief["objective_measurements"]
        self.assertFalse(measurements["trajectory_available"])
        self.assertIsNone(measurements["overall_change"])
        self.assertEqual(measurements["visits"][0]["day"], 0)
        self.assertAlmostEqual(sum(measurements["visits"][0]["tissue_percentages"].values()), 100, places=3)
        self.assertFalse(brief["clinical_use_allowed"])
        self.assertNotIn("pipeline_visuals", brief)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_metrics_trajectory_endpoint_and_validation(self):
        payload = {"patient_data": self.profile, "visits": [
            {"day": 1, "tissue_metrics": {"necrotic": 10, "slough": 30, "granulation": 60}, "area_cm2": 5},
            {"day": 3, "tissue_metrics": {"necrotic": 5, "slough": 25, "granulation": 70}, "area_cm2": 4}]}
        response = self.client.post("/api/analyze-trajectory", json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["objective_measurements"]["latest_change"]["area_change_cm2"], -1)
        self.assertEqual(result["objective_measurements"]["latest_change"]["change_percentage_points"]["granulation"], 10)
        self.assertFalse(result["provenance"]["independently_verified"])
        self.assertIn("Deterioration_Risk_Score", result)
        self.assertEqual(set(result["patient_explanation"]["locales"]), {"en", "vi"})
        self.assertTrue(result["patient_explanation"]["locales"]["vi"]["why_this_matters"])
        self.assertIn("clinician_context_analysis", result)
        self.assertEqual(response.headers["cache-control"], "no-store")
        for visits in ([], list(reversed(payload["visits"])), [payload["visits"][0]] * 31,
                       [{"day": 1, "tissue_metrics": {"necrotic": 1}}],
                       [{**payload["visits"][0], "clinical_observations": {"source": "AI", "dry_scab": True}}]):
            self.assertEqual(self.client.post("/api/analyze-trajectory", json={**payload, "visits": visits}).status_code, 422)

    def create_session(self):
        response = self.client.post("/api/wound-sessions", data={"patient_data": json.dumps(self.profile)})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["session_id"]

    def append_visit(self, session_id, day, content=None, **fields):
        return self.client.post(f"/api/wound-sessions/{session_id}/visits",
            files={"image": ("x.png", self.png if content is None else content, "image/png")},
            data={"patient_id": self.profile["patient_id"], "day": str(day), **fields})

    def test_persistent_multi_visit_api_recomputes_trajectory_and_preserves_images(self):
        session_id = self.create_session()
        observations = {"source": "clinician_reported", "dry_scab": True, "fever": False}
        first = self.append_visit(session_id, 1, timestamp="2026-09-01T12:00:00Z", pixels_per_cm="10",
                                  clinical_observations=json.dumps(observations))
        self.assertEqual(first.status_code, 201, first.text)
        rgb = cv2.imdecode(np.frombuffer(self.png, np.uint8), cv2.IMREAD_COLOR)
        ok, flipped = cv2.imencode(".png", cv2.flip(rgb, 1))
        self.assertTrue(ok)
        second = self.append_visit(session_id, 3, flipped.tobytes(), timestamp="2026-09-03T12:00:00Z", pixels_per_cm="20")
        self.assertEqual(second.status_code, 201, second.text)
        result = second.json()
        self.assertEqual(len(result["visits"]), 2)
        self.assertEqual(result["storage_provider"], "local_sqlite")
        self.assertTrue(result["baseline_locked"])
        delta = result["brief"]["objective_measurements"]["latest_change"]
        self.assertAlmostEqual(delta["area_change_cm2"], -7.68)  # 32x32 mask, 10 then 20 px/cm
        self.assertEqual(delta["area_change_pixels"], 0)
        self.assertEqual(result["brief"]["objective_measurements"]["visits"][0]["clinical_observations"], observations)
        image = self.client.get(result["visits"][0]["image_path"])
        self.assertEqual(image.content, self.png)
        self.assertEqual(image.headers["cache-control"], "no-store")
        with TestClient(main.create_app(self.checkpoint, self.visual_checkpoint, self.database)) as restarted:
            saved = restarted.get(f"/api/wound-sessions/{session_id}").json()
        self.assertEqual(saved["brief"], result["brief"])
        self.assertIn("vi", saved["brief"]["patient_explanation"]["locales"])

    def test_session_rejects_duplicate_day_image_and_wrong_patient_without_mutation(self):
        session_id = self.create_session()
        self.assertEqual(self.append_visit(session_id, 1, timestamp="2026-09-01T12:00:00Z").status_code, 201)
        for day, fields, status in ((1, {}, 409), (3, {}, 409),
                (3, {"patient_id": "not-the-owner"}, 409), (3, {"pixels_per_cm": "0"}, 422),
                (3, {"timestamp": "2026-09-03"}, 422), (3, {"timestamp": "2026-08-31T12:00:00Z"}, 409),
                (3, {"clinical_observations": '{"source":"clinician_reported","fever":"false"}'}, 422)):
            response = self.append_visit(session_id, day, **fields)
            self.assertEqual(response.status_code, status, response.text)
        saved = self.client.get(f"/api/wound-sessions/{session_id}").json()
        self.assertEqual(len(saved["visits"]), 1)
        other = self.create_session()
        path = saved["visits"][0]["image_path"].replace(session_id, other)
        self.assertEqual(self.client.get(path).status_code, 404)

    def test_session_inference_failure_does_not_store_visit(self):
        session_id = self.create_session()
        with patch.object(main, "analyze_upload", side_effect=main.HTTPException(503, "fixture model missing")):
            self.assertEqual(self.append_visit(session_id, 1).status_code, 503)
        saved = self.client.get(f"/api/wound-sessions/{session_id}").json()
        self.assertEqual(saved["visits"], [])
        self.assertIsNone(saved["brief"])

    def test_jpeg_and_explicit_day(self):
        rgb = cv2.imdecode(np.frombuffer(self.png, np.uint8), cv2.IMREAD_COLOR)
        ok, jpeg = cv2.imencode(".jpg", rgb)
        self.assertTrue(ok)
        response = self.post(content=jpeg.tobytes(), mime="image/jpeg", day="7")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["objective_measurements"]["visits"][0]["day"], 7)

    def test_malformed_and_invalid_baselines(self):
        for raw in ("{broken", "[]", "null", json.dumps({**self.profile, "has_diabetes_type_2": "false"}),
                    json.dumps({**self.profile, "hba1c_level": float("nan")})):
            response = self.client.post("/api/analyze-wound", files={"image": ("x.png", self.png, "image/png")},
                                        data={"patient_data": raw})
            self.assertEqual(response.status_code, 422, response.text)

    def test_missing_fields_and_invalid_day(self):
        self.assertEqual(self.client.post("/api/analyze-wound", data={"patient_data": "{}"}).status_code, 422)
        for day in ("-1", "NaN", "inf"):
            self.assertEqual(self.post(day=day).status_code, 422)

    def test_invalid_images_and_upload_limit(self):
        self.assertEqual(self.post(content=b"").status_code, 422)
        self.assertEqual(self.post(content=b"not an image").status_code, 415)
        self.assertEqual(self.post(mime="application/pdf").status_code, 415)
        self.assertEqual(self.post(mime="image/jpeg").status_code, 415)
        self.assertEqual(self.post(content=b"\x89PNG\r\n\x1a\ntruncated").status_code, 422)
        with patch.object(main, "MAX_IMAGE_BYTES", 32):
            self.assertEqual(self.post().status_code, 413)

    def test_poor_quality_returns_abstention(self):
        ok, png = cv2.imencode(".png", np.zeros((32, 32, 3), dtype=np.uint8))
        self.assertTrue(ok)
        response = self.post(content=png.tobytes())
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["objective_measurements"]["visits"][0]["tissue_percentages"])

    def test_cors_preflight_and_error_response(self):
        for origin in main.DEFAULT_ORIGINS:
            response = self.client.options("/api/analyze-wound", headers={"Origin": origin,
                "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["access-control-allow-origin"], origin)
        denied = self.client.options("/api/analyze-wound", headers={"Origin": "https://unrelated.example",
            "Access-Control-Request-Method": "POST"})
        self.assertEqual(denied.status_code, 400)
        self.assertNotIn("access-control-allow-origin", denied.headers)
        response = self.client.post("/api/analyze-wound", headers={"Origin": "http://localhost:3001"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:3001")

    def test_missing_checkpoint_is_503(self):
        with TestClient(main.create_app(self.root / "missing.pt")) as client:
            response = client.post("/api/analyze-wound", files={"image": ("x.png", self.png, "image/png")},
                                   data={"patient_data": json.dumps(self.profile)})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn(str(self.root), response.text)

    def test_upload_cleanup_and_filename_isolation(self):
        original = main.track_wound
        observed = []
        def capture(**kwargs):
            image = kwargs["image_paths"][0]
            observed.append(image.parent)
            self.assertEqual(image.name, "capture.png")
            self.assertTrue(kwargs["patient_profile_path"].is_file())
            return original(**kwargs)
        with patch.object(main, "track_wound", side_effect=capture):
            self.assertEqual(self.post(name="../../outside.png").status_code, 200)
            self.assertEqual(self.post(name="C:\\outside.png").status_code, 200)
        self.assertNotEqual(observed[0], observed[1])
        self.assertTrue(all(not folder.exists() for folder in observed))

    def test_cleanup_on_inference_failure(self):
        observed = []
        def fail(**kwargs):
            observed.append(kwargs["image_paths"][0].parent)
            raise RuntimeError("Internal model error")
        with patch.object(main, "track_wound", side_effect=fail):
            self.assertEqual(self.post().status_code, 503)
        self.assertTrue(observed and not observed[0].exists())

    def test_openapi_exposes_upload_and_json_form(self):
        spec = self.client.get("/openapi.json").json()
        self.assertIn("multipart/form-data", spec["paths"]["/api/analyze-wound"]["post"]["requestBody"]["content"])

    def test_optional_visuals_preserve_core_brief_and_raw_input(self):
        original = self.post(day="7").json()
        response = self.post(day="7", include_pipeline_visuals="true")
        self.assertEqual(response.status_code, 200, response.text[:300])
        extended = response.json()
        visuals = extended.pop("pipeline_visuals")
        self.assertEqual(extended, original)
        self.assertEqual(visuals["status"], "available")
        self.assertEqual(visuals["day"], 7)
        self.assertEqual(base64.b64decode(visuals["original_image"], validate=True), self.png)
        self.assertEqual(visuals["relationship"], "auxiliary_segmentation_not_late_fusion_attribution")
        for key, channels in (("unet_segmentation_mask", 4), ("tissue_analysis_overlay", 3)):
            decoded = cv2.imdecode(np.frombuffer(base64.b64decode(visuals[key], validate=True), np.uint8), cv2.IMREAD_UNCHANGED)
            self.assertEqual(decoded.shape[2], channels)
            source = cv2.imdecode(np.frombuffer(self.png, np.uint8), cv2.IMREAD_COLOR)
            self.assertEqual(decoded.shape[:2], source.shape[:2])
        self.assertEqual(visuals["model"]["encoder"], "resnet34")
        self.assertEqual(visuals["model"]["classes"], 1)
        self.assertEqual(visuals["model"]["sigmoid_threshold"], 0.35)
        self.assertEqual(visuals["tissue_status"], "available")

    def test_default_binary_checkpoint_and_relative_override(self):
        with patch.dict(main.os.environ):
            main.os.environ.pop("MEDIPASS_VISUAL_MODEL_PATH", None)
            self.assertEqual(main.create_app(self.checkpoint).state.visual_checkpoint_path,
                             main.ROOT / "outputs" / "wound_unet_fusd.pt")
            main.os.environ["MEDIPASS_VISUAL_MODEL_PATH"] = "outputs/another-binary.pt"
            self.assertEqual(main.create_app(self.checkpoint).state.visual_checkpoint_path,
                             main.ROOT / "outputs" / "another-binary.pt")

    def test_missing_or_invalid_visual_model_never_breaks_brief(self):
        for path in (self.root / "absent.pt", self.checkpoint):
            with TestClient(main.create_app(self.checkpoint, path)) as client:
                response = client.post("/api/analyze-wound", files={"image": ("x.png", self.png, "image/png")},
                    data={"patient_data": json.dumps(self.profile), "include_pipeline_visuals": "true"})
            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertIn("objective_measurements", body)
            self.assertEqual(body["pipeline_visuals"]["status"], "unavailable")
            self.assertIsNone(body["pipeline_visuals"]["unet_segmentation_mask"])
            self.assertIsNone(body["pipeline_visuals"]["tissue_analysis_overlay"])
            self.assertNotIn(str(path), response.text)

    def test_quality_abstention_withholds_derived_visuals(self):
        _, png = cv2.imencode(".png", np.zeros((32, 32, 3), np.uint8))
        response = self.post(content=png.tobytes(), include_pipeline_visuals="true")
        self.assertEqual(response.status_code, 200)
        visuals = response.json()["pipeline_visuals"]
        self.assertEqual(visuals["status"], "quality_abstained")
        self.assertIsNone(visuals["unet_segmentation_mask"])
        self.assertIsNone(visuals["tissue_analysis_overlay"])

    def test_transparent_mask_keeps_black_tissue_and_overlay_does_not_change_background(self):
        rgb = np.array([[[0, 0, 0], [140, 160, 180], [200, 170, 30]]], np.uint8)
        labels = np.array([[1, 0, 2]], np.uint8)
        isolated, overlay = render_segmentation(rgb, labels)
        rgba = cv2.imdecode(np.frombuffer(base64.b64decode(isolated), np.uint8), cv2.IMREAD_UNCHANGED)
        self.assertEqual(rgba[0, :, 3].tolist(), [255, 0, 255])
        bgr = cv2.imdecode(np.frombuffer(base64.b64decode(overlay), np.uint8), cv2.IMREAD_COLOR)
        self.assertEqual(bgr[0, 1].tolist(), rgb[0, 1, ::-1].tolist())

    def test_visuals_jpeg_mime_and_boolean_validation(self):
        pixels = cv2.imdecode(np.frombuffer(self.png, np.uint8), cv2.IMREAD_COLOR)
        _, jpeg = cv2.imencode(".jpg", pixels)
        response = self.post(content=jpeg.tobytes(), mime="image/jpeg", include_pipeline_visuals="true")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pipeline_visuals"]["original_mime_type"], "image/jpeg")
        self.assertEqual(base64.b64decode(response.json()["pipeline_visuals"]["original_image"]), jpeg.tobytes())
        self.assertNotIn("pipeline_visuals", self.post(include_pipeline_visuals="false").json())
        self.assertEqual(self.post(include_pipeline_visuals="not-a-boolean").status_code, 422)


if __name__ == "__main__":
    unittest.main()
