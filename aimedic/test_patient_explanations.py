"""Patient-language regression scenarios; clinical scores are not retrained."""
from copy import deepcopy
import json
from pathlib import Path
import unittest

from inference_tracker import format_clinical_brief
from patient_explanations import patient_narrative, patient_guidance
from test_trajectory import BASELINE, DIABETES, visit, scab_visits


class PatientExplanationTests(unittest.TestCase):
    def test_diabetes_stagnation_has_four_part_framework_in_both_languages(self):
        result = format_clinical_brief([visit(1), visit(3), visit(10)], DIABETES)
        explanation = result["patient_explanation"]
        self.assertEqual(explanation["scenario"], "stagnation")
        self.assertEqual(set(explanation["locales"]), {"en", "vi"})
        for language in ("en", "vi"):
            text = explanation["locales"][language]
            for field in ("simple_explanation", "why_this_matters", "possible_consequences",
                          "when_to_seek_care", "safety_note", "rule_note"):
                self.assertTrue(text[field])
            self.assertIn("9.6%", text["baseline_context"])
            self.assertEqual([x["action_id"] for x in text["what_to_do"]], ["glucose", "check", "existing_plan", "pressure"])
        en, vi = explanation["locales"]["en"], explanation["locales"]["vi"]
        self.assertIn("oxygen", en["why_this_matters"])
        self.assertIn("infection-fighting cells", en["why_this_matters"])
        self.assertIn("oxy", vi["why_this_matters"])
        self.assertIn("do not wait for day seven", en["when_to_seek_care"])
        self.assertIn("đừng chờ đến ngày thứ bảy", vi["when_to_seek_care"])
        self.assertIn("unvalidated", en["rule_note"])
        self.assertIn("If an infection develops", en["possible_consequences"])

    def test_existing_string_contract_uses_plain_framework_and_retains_clinician_text(self):
        result = format_clinical_brief([visit(1), visit(3, (15, 35, 50))], DIABETES)
        explanation = result["patient_explanation"]
        self.assertEqual(result["multimodal_context_analysis"], patient_narrative(explanation))
        self.assertEqual(result["system_recommendation"], patient_guidance(explanation))
        self.assertIn("HbA1c", result["clinician_context_analysis"])
        self.assertIn("clinician", result["clinician_recommendation"])
        self.assertEqual(result["objective_measurements"]["latest_change"]["change_percentage_points"]["slough"], 5)

    def test_high_hba1c_without_recorded_diabetes_does_not_invent_diagnosis(self):
        profile = {**BASELINE, "hba1c_level": 9.1}
        e = format_clinical_brief([visit(1), visit(3, (15, 35, 50))], profile)["patient_explanation"]
        self.assertIn("Diabetes is not recorded", e["locales"]["en"]["baseline_context"])
        self.assertIn("a1c_review", [x["action_id"] for x in e["locales"]["en"]["what_to_do"]])
        self.assertNotIn("glucose", [x["action_id"] for x in e["locales"]["en"]["what_to_do"]])
        controlled = format_clinical_brief([visit(1), visit(3)], {**DIABETES, "hba1c_level": 5.2})["patient_explanation"]
        self.assertIn("5.2%", controlled["locales"]["en"]["baseline_context"])
        self.assertNotIn("your blood sugar is high", patient_narrative(controlled).lower())

    def test_missing_quality_data_withholds_conclusions_but_explains_general_baseline(self):
        result = format_clinical_brief([visit(1), visit(3, quality={"usable_for_demo": False})], DIABETES)
        e = result["patient_explanation"]
        self.assertEqual(e["scenario"], "insufficient_data")
        self.assertIn("not enough reliable", e["locales"]["en"]["simple_explanation"])
        self.assertIn("not that the risk is zero", e["locales"]["en"]["why_this_matters"])
        self.assertIn("possible effects", e["locales"]["en"]["why_this_matters"])
        self.assertIsNone(result["Deterioration_Risk_Score"])
        self.assertEqual(result["Uncertainty_Score"], 1)
        self.assertIn("Do not wait for day seven", e["locales"]["en"]["when_to_seek_care"])

    def test_reported_warning_symptoms_override_image_uncertainty(self):
        result = format_clinical_brief([visit(1, quality={"usable_for_demo": False},
            clinical_observations={"source": "patient_reported", "fever": True})], DIABETES)
        e = result["patient_explanation"]
        self.assertEqual(e["scenario"], "reported_symptoms")
        self.assertIn("now", e["locales"]["en"]["when_to_seek_care"])
        self.assertIn("ngay", e["locales"]["vi"]["when_to_seek_care"])
        self.assertIsNone(result["Deterioration_Risk_Score"])

    def test_scab_and_lower_baseline_do_not_get_diabetes_or_infection_claim(self):
        e = format_clinical_brief(scab_visits(), BASELINE)["patient_explanation"]
        self.assertEqual(e["scenario"], "possible_scab")
        self.assertIn("may fit", e["locales"]["en"]["simple_explanation"])
        self.assertIn("cannot confirm", e["locales"]["en"]["simple_explanation"])
        self.assertNotIn("high blood sugar", e["locales"]["en"]["why_this_matters"])
        self.assertNotIn("glucose", [x["action_id"] for x in e["locales"]["en"]["what_to_do"]])
        stable = format_clinical_brief([visit(1), visit(3, (5, 25, 70), 8)], BASELINE)["patient_explanation"]
        self.assertEqual(stable["scenario"], "no_new_flag")
        self.assertIn("does not prove", stable["locales"]["en"]["simple_explanation"])

    def test_historical_worsening_is_distinguished_from_current_trend(self):
        e = format_clinical_brief([visit(1), visit(3, (25, 30, 45)), visit(7, (5, 20, 75), 8)], DIABETES)["patient_explanation"]
        self.assertEqual(e["scenario"], "historical_review")
        self.assertTrue(e["historical_findings_retained"])
        self.assertIn("earlier visit", e["locales"]["en"]["simple_explanation"])

    def test_scores_sources_and_determinism_preserved(self):
        example = json.loads((Path(__file__).parent / "examples" / "trajectory_request.json").read_text())
        original = deepcopy(example)
        result = format_clinical_brief(example["visits"], example["patient_data"])
        self.assertEqual(result["Deterioration_Risk_Score"], .61)
        self.assertEqual(result["Uncertainty_Score"], .60)
        self.assertEqual(example, original)
        self.assertEqual(result, format_clinical_brief(example["visits"], example["patient_data"]))
        e = result["patient_explanation"]
        sources = result["rule_provenance"]["trajectory_engine"]["evidence"]
        self.assertTrue(all(key in sources for key in e["evidence_ids"]))
        for language in e["locales"].values():
            self.assertTrue(all(key in sources for action in language["what_to_do"] for key in action["evidence_ids"]))
        self.assertTrue(e["mechanism_is_general_education"])
        self.assertFalse(e["clinical_validation"])
        self.assertTrue(all(f["patient_explanation_ref"] == "patient_explanation" for f in result["risk_alerts"]))
        json.dumps(result, ensure_ascii=False, allow_nan=False)


if __name__ == "__main__":
    unittest.main()
