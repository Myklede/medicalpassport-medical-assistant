"""Run: python -B -m unittest discover -s aimedic -p test_pipeline.py -v"""
import contextlib
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import numpy as np
import torch

from inference_tracker import format_clinical_brief, load_checkpoint, track_wound, visit_days
from synthetic_data_generator import generate_dataset, write_png
from train_loop import load_datasets, train


PROFILE = {"patient_id": "TEST", "age": 62, "hba1c_level": 9.2, "blood_type": "O+",
           "has_diabetes_type_2": True, "hypertension": True, "synthetic": True}


def visit(day, tissue, risk=0.1):
    return {"day": day, "tissue_percentages": dict(zip(("necrotic", "slough", "granulation"), tissue)),
            "risk_deterioration_score": risk}


class BriefTests(unittest.TestCase):
    def test_baseline_specific_rules(self):
        visits = [visit(1, [20, 30, 50]), visit(3, [22, 35, 43])]
        high = format_clinical_brief(visits, PROFILE)
        low = format_clinical_brief(visits, {**PROFILE, "has_diabetes_type_2": False, "hba1c_level": 5.3})
        self.assertEqual(len(high["risk_alerts"]), 2)
        self.assertEqual(low["risk_alerts"], [])
        self.assertIn("9.2%", high["multimodal_context_analysis"])
        self.assertFalse(high["clinical_use_allowed"])
        self.assertTrue(high["requires_clinician_review"])

    def test_absolute_units_and_irregular_time(self):
        brief = format_clinical_brief([visit(1, [10, 30, 60]), visit(3, [20, 30, 50]),
                                      visit(7, [24, 31, 45])], PROFILE)
        intervals = brief["objective_measurements"]["interval_changes"]
        self.assertEqual(intervals[0]["change_percentage_points"]["necrotic"], 10)
        self.assertEqual(intervals[0]["change_percentage_points_per_day"]["necrotic"], 5)
        self.assertEqual(intervals[1]["change_percentage_points_per_day"]["necrotic"], 1)

    def test_interim_deterioration_is_not_hidden_by_recovery(self):
        brief = format_clinical_brief([visit(1, [20, 30, 50]), visit(3, [27, 30, 43]),
                                      visit(7, [18, 30, 52])], PROFILE)
        self.assertTrue(any(a.get("from_day") == 1 and a.get("to_day") == 3 for a in brief["risk_alerts"]))
        self.assertEqual(brief["objective_measurements"]["overall_change"]["change_percentage_points"]["necrotic"], -2)

    def test_cumulative_change_is_checked(self):
        brief = format_clinical_brief([visit(1, [20, 30, 50]), visit(3, [21.5, 30, 48.5]),
                                      visit(7, [23, 30, 47])], PROFILE)
        self.assertTrue(any(a.get("scope") == "overall" for a in brief["risk_alerts"]))

    def test_no_flag_does_not_mean_safe(self):
        brief = format_clinical_brief([visit(1, [20, 30, 50]), visit(7, [15, 25, 60])], PROFILE)
        self.assertEqual(brief["risk_alerts"], [])
        self.assertEqual(brief["research_review_priority"], "manual_review")
        self.assertFalse(brief["uncertainty"]["calibrated"])
        self.assertIsNone(brief["uncertainty"]["confidence_interval"])

    def test_single_visit_withholds_trajectory(self):
        brief = format_clinical_brief([visit(1, [20, 30, 50])], PROFILE)
        self.assertFalse(brief["objective_measurements"]["trajectory_available"])

    def test_dates_are_not_guessed_or_reordered(self):
        self.assertEqual(visit_days(["img_day1.jpg", "day_003_rgb.png"]), [1, 3])
        for images, days in [([], None), (["a.png"], None), (["a", "b"], [3, 1]),
                             (["a", "b"], [1, 1]), (["a"], [float("nan")]), (["a"], [1, 2])]:
            with self.assertRaises(ValueError):
                visit_days(images, days)

    def test_invalid_raw_predictions_fail(self):
        for tissue in ([20, 30, 60], [-10, 40, 70], [float("nan"), 30, 70]):
            with self.assertRaises(ValueError):
                format_clinical_brief([visit(1, tissue)], PROFILE)
        with self.assertRaises(ValueError):
            format_clinical_brief([visit(1, [20, 30, 50], 1.1)], PROFILE)

    def test_quality_failure_suppresses_outputs(self):
        bad = {**visit(3, [30, 30, 40]), "quality": {"usable_for_demo": False}}
        brief = format_clinical_brief([visit(1, [20, 30, 50]), bad], PROFILE)
        self.assertIsNone(brief["objective_measurements"]["visits"][1]["tissue_percentages"])
        self.assertIsNone(brief["objective_measurements"]["overall_change"])
        self.assertEqual(brief["risk_alerts"], [])


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[1] / "outputs"
        root.mkdir(exist_ok=True)
        cls.temp = TemporaryDirectory(prefix="pwc-tests-", dir=root)
        cls.base = Path(cls.temp.name)
        cls.data = cls.base / "data"
        cls.manifest = generate_dataset(cls.data, patients=30, days=(1, 3, 7, 30), image_size=32)
        cls.run_dir = cls.base / "run"
        with contextlib.redirect_stdout(io.StringIO()):
            cls.report = train(cls.data, cls.run_dir, epochs=2, batch_size=16)
        cls.checkpoint = cls.run_dir / "best.pt"
        entry = next(p for p in cls.manifest["patients"] if p["split"] == "test")
        cls.profile = cls.data / entry["profile_path"]
        cls.visits = json.loads((cls.data / entry["visits_path"]).read_text())
        cls.images = [cls.data / v["image_path"] for v in cls.visits]

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_training_and_reload(self):
        self.assertEqual(self.report["split_visits"], {"train": 84, "validation": 16, "test": 20})
        history = json.loads((self.run_dir / "history.json").read_text())["epochs"]
        chosen = min(history, key=lambda x: x["validation"]["loss"])
        self.assertEqual(self.report["best_epoch"], chosen["epoch"])
        brief = track_wound(self.images, self.profile, self.checkpoint)
        again = track_wound(self.images, self.profile, self.checkpoint)
        self.assertEqual(brief, again)
        self.assertEqual(len(brief["objective_measurements"]["visits"]), 4)
        self.assertTrue(brief["objective_measurements"]["trajectory_available"])
        json.dumps(brief, allow_nan=False)

    def test_corrupt_checkpoint_contracts(self):
        original = torch.load(self.checkpoint, weights_only=True)
        for name, value in (("trained", False), ("epoch", 0), ("feature_names", ["wrong"]),
                            ("preprocessing", {}), ("model_version", "wrong")):
            path = self.base / f"invalid-{name}.pt"
            torch.save({**original, name: value}, path)
            with self.assertRaises(ValueError):
                load_checkpoint(path)
        original["model_state_dict"]["tissue_head.weight"][0, 0] = float("nan")
        path = self.base / "nan.pt"
        torch.save(original, path)
        with self.assertRaises(ValueError):
            load_checkpoint(path)

    def test_blank_and_missing_images(self):
        blank = self.base / "blank.png"
        write_png(blank, np.zeros((32, 32, 3), dtype=np.uint8))
        brief = track_wound([self.images[0], blank], self.profile, self.checkpoint, days=[1, 3])
        self.assertFalse(brief["objective_measurements"]["trajectory_available"])
        self.assertIsNone(brief["objective_measurements"]["visits"][1]["risk_deterioration_score"])
        with self.assertRaises(FileNotFoundError):
            track_wound([self.base / "missing.png"], self.profile, self.checkpoint, days=[1])

    def test_no_overwrite_and_no_empty_training(self):
        with self.assertRaises(FileExistsError):
            train(self.data, self.run_dir, epochs=1)
        with self.assertRaises(ValueError):
            train(self.data, self.base / "bad", epochs=0)

    def test_patient_leakage_and_path_escape_rejected(self):
        path = self.data / "manifest.json"
        original = path.read_bytes()
        try:
            changed = json.loads(original)
            changed["patients"].append(changed["patients"][0])
            path.write_text(json.dumps(changed))
            with self.assertRaises(ValueError):
                load_datasets(self.data)
            changed = json.loads(original)
            changed["patients"][0]["profile_path"] = "../outside.json"
            (self.base / "outside.json").write_text(json.dumps(PROFILE))
            path.write_text(json.dumps(changed))
            with self.assertRaises(ValueError):
                load_datasets(self.data)
        finally:
            path.write_bytes(original)


if __name__ == "__main__":
    unittest.main()
