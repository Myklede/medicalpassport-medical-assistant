"""Trajectory behavior tests: independently specified scenarios, no training needed."""
from copy import deepcopy
import json
import unittest

from inference_tracker import format_clinical_brief, analyze_trajectory
from trajectory_rules import RED_FLAGS

BASELINE = {"patient_id": "TRAJECTORY-TEST", "age": 30, "hba1c_level": 5.2, "blood_type": "O+",
            "has_diabetes_type_2": False, "hypertension": False}
DIABETES = {**BASELINE, "age": 68, "has_diabetes_type_2": True, "hba1c_level": 9.6, "hypertension": True}


def visit(day, tissue=(10, 30, 60), area=10, pixels=1000, **extra):
    return {"day": day, "tissue_metrics": dict(zip(("necrotic", "slough", "granulation"), tissue)),
            "area_cm2": area, "wound_area_pixels": pixels,
            "quality": {"usable_for_demo": True}, "capture_conditions_consistent": True, **extra}


def brief(visits, profile=BASELINE):
    return format_clinical_brief(visits, profile)


def assessment(visits, profile=BASELINE):
    return brief(visits, profile)["trajectory_risk_assessment"]


def scab_visits():
    return [visit(1, (85, 5, 10), area=2), visit(3, (92, 3, 5), area=1.5,
        clinical_observations={"source": "clinician_reported", "dry_scab": True, **dict.fromkeys(RED_FLAGS, False)})]


class TrajectoryTests(unittest.TestCase):
    def test_latest_exact_deltas_and_irregular_days(self):
        result = brief([visit(1), visit(3, (8, 28, 64), 9), visit(7, (5, 23, 72), 7, 750)])
        delta = result["objective_measurements"]["latest_change"]
        self.assertEqual((delta["from_day"], delta["to_day"], delta["elapsed_days"]), (3, 7, 4))
        self.assertEqual(delta["change_percentage_points"], {"necrotic": -3, "slough": -5, "granulation": 8})
        self.assertEqual(delta["area_change_cm2"], -2)
        self.assertEqual(delta["area_change_pixels"], -250)
        self.assertEqual(delta["change_percentage_points_per_day"]["granulation"], 2)
        self.assertIn("Compared to Day 3", result["summary"])

    def test_baseline_fusion_and_no_complication_probability(self):
        visits = [visit(1), visit(3, (11, 31, 58), 9)]
        low, high = assessment(visits), assessment(visits, DIABETES)
        self.assertGreater(high["Deterioration_Risk_Score"], low["Deterioration_Risk_Score"])
        self.assertEqual(low["risk_alerts"], [])
        self.assertEqual(high["review_priority"], "elevated_review")
        self.assertIn("9.6%", high["multimodal_context"])
        self.assertEqual(len(high["complication_considerations"]), 3)
        self.assertTrue(all(x["probability"] is None for x in high["complication_considerations"]))
        self.assertIn("cannot_determine", high["complication_considerations"][2]["status"])

    def test_high_hba1c_and_diabetes_are_independently_considered(self):
        visits = [visit(1), visit(3, (10, 30.1, 59.9), 9)]
        for profile in ({**BASELINE, "hba1c_level": 9}, {**BASELINE, "has_diabetes_type_2": True}):
            self.assertTrue(assessment(visits, profile)["risk_alerts"])

    def test_hba1c_threshold_is_strict(self):
        visits = [visit(1), visit(3, (11, 30, 59), 9)]
        self.assertEqual(assessment(visits, {**BASELINE, "hba1c_level": 8})["risk_alerts"], [])
        self.assertTrue(assessment(visits, {**BASELINE, "hba1c_level": 8.01})["risk_alerts"])

    def test_stagnation_requires_two_intervals_and_more_than_seven_days(self):
        self.assertFalse(assessment([visit(1), visit(10)], DIABETES)["stagnation"]["flagged"])
        self.assertFalse(assessment([visit(1), visit(3), visit(8)], DIABETES)["stagnation"]["flagged"])
        result = assessment([visit(1), visit(3), visit(9)], DIABETES)
        self.assertTrue(result["stagnation"]["flagged"])
        self.assertEqual(result["stagnation"]["elapsed_days"], 8)
        self.assertIn("seven days", " ".join(r["text"] for r in result["recommendations"]))

    def test_improvement_interrupts_stagnation(self):
        result = assessment([visit(1), visit(3, area=8), visit(10, area=8)], DIABETES)
        self.assertFalse(result["stagnation"]["flagged"])

    def test_pixels_are_not_cm2_and_do_not_imply_shrinkage_without_capture_confirmation(self):
        visits = [visit(1, area=None), visit(3, area=None, pixels=800, capture_conditions_consistent=False)]
        result = assessment(visits)
        delta = result["latest_comparison"]
        self.assertEqual(delta["area_change_pixels"], -200)
        self.assertIsNone(delta["area_change_cm2"])
        self.assertIsNone(delta["area_trend_change_percent"])
        visits[-1]["capture_conditions_consistent"] = True
        self.assertEqual(assessment(visits)["latest_comparison"]["area_trend_change_percent"], -20)

    def test_stall_does_not_mix_area_units_or_bridge_missing_calibration(self):
        visits = [visit(1), visit(3), visit(9, area=None)]
        self.assertFalse(assessment(visits)["stagnation"]["flagged"])
        visits[-1]["capture_conditions_consistent"] = False
        self.assertEqual(assessment(visits)["stagnation"]["trailing_intervals"], 0)

    def test_reported_scab_qualifies_dark_pixels_without_normal_healing_claim(self):
        result = assessment(scab_visits())
        self.assertTrue(result["scab_context"]["compatible_with_reported_scab"])
        self.assertFalse(result["scab_context"]["confirmed_normal_healing"])
        self.assertEqual(result["risk_alerts"], [])
        self.assertIn("may be compatible", result["multimodal_context"])

    def test_color_alone_or_unknown_symptoms_never_trigger_scab_reassurance(self):
        for observations in ({}, {"source": "clinician_reported", "dry_scab": True},
                             {"source": "patient_reported", "dry_scab": True, **dict.fromkeys(RED_FLAGS, False)}):
            visits = scab_visits()
            visits[-1]["clinical_observations"] = observations
            result = assessment(visits)
            self.assertFalse(result["scab_context"]["compatible_with_reported_scab"])
            self.assertTrue(result["risk_alerts"])

    def test_scab_never_overrides_high_baseline_growth_or_reported_symptoms(self):
        self.assertFalse(assessment(scab_visits(), DIABETES)["scab_context"]["compatible_with_reported_scab"])
        visits = scab_visits()
        visits[-1]["area_cm2"] = 3
        self.assertFalse(assessment(visits)["scab_context"]["compatible_with_reported_scab"])
        visits = scab_visits()
        visits[-1]["clinical_observations"]["fever"] = True
        result = assessment(visits)
        self.assertFalse(result["scab_context"]["compatible_with_reported_scab"])
        self.assertTrue(any(f["rule_id"] == "reported_clinical_warning_signs" for f in result["risk_alerts"]))

    def test_prolonged_stagnation_prevents_scab_suppression(self):
        visits = scab_visits()
        visits[0]["area_cm2"] = 1.5
        visits.insert(1, visit(2, (85, 5, 10), 1.5))
        visits[-1]["day"] = 10
        result = assessment(visits)
        self.assertTrue(result["stagnation"]["flagged"])
        self.assertFalse(result["scab_context"]["compatible_with_reported_scab"])
        self.assertTrue(any(f.get("tissue") == "necrotic" for f in result["risk_alerts"]))

    def test_quality_failure_abstains_but_does_not_suppress_reported_symptoms(self):
        visits = [visit(1), visit(3, quality={"usable_for_demo": False},
                                    clinical_observations={"source": "patient_reported", "fever": True})]
        result = assessment(visits)
        self.assertIsNone(result["Deterioration_Risk_Score"])
        self.assertEqual(result["Uncertainty_Score"], 1)
        self.assertIsNone(result["latest_comparison"]["area_change_cm2"])
        self.assertEqual(result["review_priority"], "elevated_review")

    def test_single_visit_withholds_score(self):
        result = assessment([visit(1)])
        self.assertIsNone(result["Deterioration_Risk_Score"])
        self.assertEqual(result["Uncertainty_Score"], 1)

    def test_unknown_pixels_increase_uncertainty_and_withhold_if_excessive(self):
        good = assessment([visit(1), visit(3)])
        visits = [visit(1), visit(3, (10, 10, 50), unclassified_percentage=30)]
        result = assessment(visits)
        self.assertIsNone(result["Deterioration_Risk_Score"])
        self.assertGreater(result["Uncertainty_Score"], good["Uncertainty_Score"])
        self.assertEqual(result["latest_comparison"]["unclassified_change_pp"], 30)

    def test_duplicate_nonadjacent_capture_and_model_change_abstain(self):
        visits = [visit(1, image_sha256="a"), visit(3, image_sha256="b"), visit(7, image_sha256="a")]
        self.assertIsNone(assessment(visits)["Deterioration_Risk_Score"])
        visits = [visit(1, segmentation_provenance={"version": 1}), visit(3, segmentation_provenance={"version": 2})]
        self.assertTrue(assessment(visits)["latest_comparison"]["model_changed"])
        self.assertIsNone(assessment(visits)["Deterioration_Risk_Score"])

    def test_earlier_worsening_remains_visible_after_latest_improvement(self):
        result = assessment([visit(1), visit(3, (25, 30, 45)), visit(7, (5, 20, 75), 8)], DIABETES)
        self.assertTrue(any(f.get("scope") == "historical" for f in result["risk_alerts"]))
        self.assertLess(result["latest_comparison"]["change_percentage_points"]["necrotic"], 0)

    def test_missing_visit_is_not_bridged_but_later_adjacent_pair_can_be_compared(self):
        result = brief([visit(1), visit(3, quality={"usable_for_demo": False}), visit(7), visit(9, (5, 20, 75), 8)])
        self.assertFalse(result["objective_measurements"]["trajectory_available"])
        self.assertTrue(result["objective_measurements"]["latest_trajectory_available"])
        self.assertIsNone(result["objective_measurements"]["longitudinal_intervals"][1]["change_percentage_points"])

    def test_malformed_inputs_rejected_without_imputation(self):
        invalid = [visit(1, area=-1), visit(1, pixels=2.3), visit(1, (1, 2, 3)), visit(True),
                   visit(1, area=float("nan")), visit(1, risk_deterioration_score=True),
                   visit(1, clinical_observations={"source": "clinician_reported", "dry_scab": "false"}),
                   visit(1, quality={"usable_for_demo": "false"}), visit(1, timestamp="2026-09-01")]
        for item in invalid:
            with self.subTest(item=item), self.assertRaises(ValueError):
                brief([item])
        with self.assertRaises(ValueError):
            brief([visit(3), visit(1)])
        with self.assertRaises(ValueError):
            brief([visit(1)], {**BASELINE, "immunosuppression": "false"})

    def test_timestamps_compare_instants_not_text_offsets(self):
        with self.assertRaises(ValueError):
            analyze_trajectory([visit(1, timestamp="2026-09-01T12:00:00+00:00"),
                                visit(3, timestamp="2026-09-01T13:00:00+02:00")])

    def test_score_provenance_reproducible_no_model_probability_leakage(self):
        visits = [visit(1, risk_deterioration_score=.99), visit(3, (15, 35, 50), 11, risk_deterioration_score=.99)]
        original = deepcopy(visits)
        result = assessment(visits, DIABETES)
        self.assertEqual(visits, original)
        expected = min(1, sum(x["value"] for x in result["rule_provenance"]["score_contributions"]))
        self.assertAlmostEqual(result["Deterioration_Risk_Score"], expected)
        visits[-1]["risk_deterioration_score"] = .01
        self.assertEqual(assessment(visits, DIABETES)["Deterioration_Risk_Score"], result["Deterioration_Risk_Score"])
        self.assertFalse(result["score_is_probability"])
        self.assertFalse(result["clinical_validation"])
        self.assertIsNone(result["prediction_horizon_days"])
        self.assertEqual(result, assessment(original, DIABETES))
        json.dumps(result, allow_nan=False)
        sources = result["rule_provenance"]["evidence"]
        for item in result["recommendations"] + result["risk_alerts"]:
            self.assertTrue(all(key in sources for key in item["evidence_ids"]))


if __name__ == "__main__":
    unittest.main()
