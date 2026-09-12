# Local multimodal trajectory engine

Updated 2026-09-11. Implementation: `aimedic/inference_tracker.py`,
`trajectory_rules.py`, `main.py`, `session_store.py`, `visual_pipeline.py`.
The existing `train_loop.py` and `multimodal_model.py` are unchanged.

## Patient explanations (latest update)

`patient_explanations.py` supplies versioned English/Vietnamese templates to
`trajectory_rules.py`; `inference_tracker.py` exposes them on every Clinical Brief.
No request changes are required. Read `patient_explanation.locales.en` or `.vi`:

- `simple_explanation` and `baseline_context`: what was observed and which recorded
  baseline applies; HbA1c is explained without treating it as today's blood sugar.
- `why_this_matters`: general circulation/oxygen/nutrient and immune mechanisms
  when diabetes/high HbA1c is recorded, never a claim of confirmed poor circulation.
- `possible_consequences`: conditional outcomes, without a fabricated infection
  probability or a proven seven-day danger threshold.
- `what_to_do`: stable action IDs, plain instructions, and evidence IDs; follow
  existing glucose/pressure-relief/dressing plans rather than change treatment.
- `when_to_seek_care`, `measurement_note`, `rule_note`, `safety_note`: care contacts,
  image limitations, the illustrative timer, and the need for professional assessment.

Both languages use the same triggering facts and actions. The selected `scenario`
distinguishes reported symptoms, insufficient data, stagnation, current worsening,
historical changes, a possible clinician-reported scab, and no new flag. Unknown
quality or missing visits never become reassurance. Symptoms still prompt care
when the photo is unusable. Patients are not told to wait seven days.

Existing `multimodal_context_analysis` and `system_recommendation` strings now
contain the English plain-language narrative and guidance. The previous technical
wording remains in `clinician_context_analysis` and `clinician_recommendation`.
`trajectory_risk_assessment.multimodal_context` also remains technical.
Evidence URLs live in `rule_provenance.trajectory_engine.evidence`; each risk flag
references the shared explanation. Its separate template version leaves the
scoring model/version, weights, measurements and thresholds unchanged.

Source checks: [NIDDK circulation and wound healing](https://www.niddk.nih.gov/health-information/professionals/diabetes-discoveries-practice/diabetes-peripheral-arterial-disease-and-foot-ulcers),
[CDC diabetes and immunity](https://www.cdc.gov/diabetes/diabetes-complications/diabetes-immune-system.html),
[NIDDK foot care](https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/foot-problems),
[CDC HbA1c](https://www.cdc.gov/diabetes/diabetes-testing/prediabetes-a1c-test.html),
and [CDC glucose monitoring](https://www.cdc.gov/diabetes/diabetes-testing/monitoring-blood-sugar.html).

Latest QA: **77 Python tests passed, 0 failed**, including eight bilingual
explanation scenarios and API/session readback. Earlier counts below document
the preceding engine revision. This update changes backend output only; Patient
Mode's static UI will need to render `patient_explanation.locales.vi` to display
all structured sections. Existing string-based clients receive the English text.

## Run and try it

```powershell
outputs/pwc-venv/Scripts/python.exe -B aimedic/main.py
```

Open http://127.0.0.1:8000/docs. `POST /api/analyze-trajectory` accepts JSON;
paste [`aimedic/examples/trajectory_request.json`](../aimedic/examples/trajectory_request.json).
It does not need model weights and labels these metrics as caller-reported.
This example has latest granulation +8 percentage points, necrotic -1 pp,
slough -7 pp, area -0.1 cm², plus earlier worsening and prolonged limited area reduction.

Alternatively:

```powershell
$brief = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/analyze-trajectory' -ContentType 'application/json' -InFile 'aimedic/examples/trajectory_request.json'
$brief | ConvertTo-Json -Depth 30
```

`format_clinical_brief(visits, profile)` also accepts the same visits directly in
Python. Required baseline fields keep their existing validation. Optional extra
booleans: `peripheral_arterial_disease`, `chronic_kidney_disease`, `immunosuppression`.
They affect only the rule context, not the learned model's fixed feature schema.

## Inputs and output contract

Visits must have unique increasing nonnegative `day` values. Provide canonical
`tissue_percentages` or nested `tissue_metrics` with `necrotic`, `slough`,
`granulation`, all in percent. Known tissues plus optional
`unclassified_percentage` must sum to 100. No renormalization or sorting occurs.
Optional fields: `area_cm2`, integer `wound_area_pixels`, timezone-aware increasing
`timestamp`, `quality.usable_for_demo`, `capture_conditions_consistent`,
`clinical_observations`. Invalid inputs return HTTP 422. The JSON endpoint accepts
1–30 visits; direct Python accepts up to 1,000. Do not combine different wounds.

The v2 Clinical Brief adds:

- `objective_measurements.latest_change`: previous-to-latest deltas in percentage
  points, cm² and raw pixels, plus per-day rates, availability and consistency flags.
- `longitudinal_intervals`: every adjacent pair; missing/bad visits are not bridged.
- `latest_trajectory_available`: the last pair is comparable. The older
  `trajectory_available` still requires the whole sequence to be comparable.
- `Deterioration_Risk_Score`: 0–1 deterministic **uncalibrated research review score**,
  or null when latest measurements are insufficient/unreliable. Not an event probability.
- `Uncertainty_Score`: 0–1 engineering data-quality/consistency index; not a
  confidence interval. Poor quality, missing comparison/calibration, unclassified
  pixels and large changes increase it. More uncertainty never lowers risk.
- `trajectory_risk_assessment`: score components, latest/historical flags,
  complication review topics, scab qualification, stagnation, summary and linked recommendations.
- `rule_provenance.trajectory_engine`: version, parameters, exact contributions,
  fired rules and evidence links. References support review topics, **not score weights**.

The unchanged learned `risk_deterioration_score` on each visit describes the
synthetic model's seven-day simulator target. It is retained separately and never
silently averaged into the new score. This is rule-based fusion of image measurements
and baseline factors, not a newly trained temporal model or calibrated complication predictor.
Legacy CLI v1 output retains its earlier top-level rules for compatibility and
also includes the new assessment extension; v2 API output uses the new rules throughout.

## Measurement and rule boundaries

Binary U-Net preprocessing stays ImageNet/256×256/sigmoid >0.35 on CPU. Before
tissue inference, pixels outside the binary mask are zeroed, the wound bounding
box is cropped and resized, and the resized mask is applied again. Tissue counts
divide by **all mask pixels**; tissue class zero inside the mask is unclassified.
The API uses these counts, not the whole-image tissue head, in the brief. The
learned risk head receives the same isolated crop; architecture and weights are unchanged.

`pixels_per_cm` is optional for each image upload: projected cm² = mask pixels /
pixels_per_cm². The caller must measure a same-plane ruler in that specific image.
No physical scale is guessed. Raw pixel deltas are displayed but used for area
rules only when both visits explicitly assert consistent capture conditions.
Physical area is projected 2D area, not true 3D wound surface area. Empty masks
withhold tissue/area conclusions rather than establish that an injury has healed.

Diabetes **or** HbA1c >8 selects review for increasing estimated necrotic/slough
classes. Age/hypertension and optional comorbidities add explicit context modifiers.
Small changes remain research review signals, not an assertion of urgency.
The illustrative stagnation rule requires at least two trailing comparable area
intervals, each with <5% reduction, spanning **more than seven days**. A gap or
change of area unit resets the run. Sampling cadence affects this demonstration
rule; it is not a validated clinical threshold or a directive to wait seven days.

Dark pixels alone neither prove necrosis nor establish benign scabbing. To qualify
a possible scab, supply per-visit observations such as:

```json
{
  "source": "clinician_reported",
  "dry_scab": true,
  "fever": false,
  "spreading_redness": false,
  "purulent_drainage": false,
  "increasing_pain": false
}
```

`dark_linear_appearance` is an alternative to `dry_scab`. Sources are caller
assertions, not authenticated clinician attestations. Missing symptoms are unknown.
Low slough/granulation, non-increasing comparable area, and no recorded systemic
modifiers are additionally required. Output says **may be compatible** with dry
epithelialization/scabbing, never confirms normal healing. Symptoms, area expansion,
prolonged stagnation, poor quality, or systemic risks prevent reassurance.

The engine can suggest reviewing delayed healing, perfusion and infection signs;
it cannot establish microvascular compromise or identify anaerobic organisms from
color/HbA1c. Offloading suggestions are conditional on a neuropathic plantar diabetic
foot ulcer. Recommendations link to [IWGDF/IDSA infection guidance](https://www.idsociety.org/practice-guideline/diabetic-foot-infections/),
[IWGDF PAD guidance](https://iwgdfguidelines.org/wp-content/uploads/2023/07/IWGDF-2023-05-PAD-Guideline.pdf)
and [IWGDF offloading guidance](https://iwgdfguidelines.org/wp-content/uploads/2023/07/IWGDF-2023-06-Offloading-Guideline.pdf).
Medical-image analysis is not made exempt from device regulation merely by CDS
wording; [FDA guidance](https://www.fda.gov/media/109618/download) remains linked in provenance.

## Stored image sessions

All endpoints are local, unauthenticated research APIs. Use synthetic/de-identified
data only. Session IDs are opaque access capabilities, not authorization for clinical use.

1. `POST /api/wound-sessions`, multipart `patient_data` JSON string: creates a
   session with a fixed baseline and returns `session_id`.
2. `POST /api/wound-sessions/{session_id}/visits`: multipart `image`, `patient_id`,
   `day`; optional `timestamp`, `pixels_per_cm`, `clinical_observations` JSON string,
   `include_pipeline_visuals`. Returns the recomputed full brief and visits.
3. `GET /api/wound-sessions/{session_id}`: reloads the stored history and recomputes
   the brief using the currently installed rule version; model measurements stay unchanged.
4. `GET /api/wound-sessions/{session_id}/visits/{visit_id}/image`: scoped stored image.

Storage is atomic SQLite (image bytes + measurements), default ignored
`outputs/wound-sessions.sqlite3`; override `MEDIPASS_WOUND_SESSION_DB`.
Limit 30 visits/session. Duplicate images, backwards days/timestamps, wrong patient
and incompatible model/preprocessing versions return 409 without storing a visit.
Missing timestamp uses server receipt time and is labeled `server_received`;
relative day remains caller supplied. No batch chronology is invented.
These sessions are **not Supabase/D1/R2 or clinician-confirmed records**.
`/api/analyze-wound` remains stateless. CORS allows local ports 3000/3001.

The current Next.js uploader still calls the stateless endpoint. The existing
`lib/wound-sessions-api.ts` service is available for a future session-selector UI;
this backend task does not add that UI. Use Swagger/the API to test multi-day sessions.

## Verification and handoff

```powershell
outputs/pwc-venv/Scripts/python.exe -B -m unittest discover -s aimedic -p 'test_*.py' -v
```

**69 passed, 0 failed**: 21 API + 14 original pipeline + 21 trajectory + 13 binary visual tests.
Coverage includes mask input isolation, denominator, scab guardrails, baseline
thresholds, exact deltas, quality abstention, historical flags, score reproducibility,
session persistence across app instances, scoped images, validation and failed-write cleanup.
No model retraining or clinical validation was performed.

The pre-push check also passed: TypeScript, 41 frontend unit tests and production
build. It found and fixed a pre-existing type-narrowing error in the unfinished
session service. Focused headless Chrome QA passed against the live backend:
Patient/Developer modes, five profiles, real Base64 masks, loading/errors, quality
abstention, older-server fallback and mobile/light/dark layouts. The running API
also accepted the example above and returned the exact latest deltas, score 0.61,
uncertainty 0.60, and the illustrative stagnation flag. That is software evidence,
not an estimate of clinical performance. Nothing was committed, pushed or deployed.
