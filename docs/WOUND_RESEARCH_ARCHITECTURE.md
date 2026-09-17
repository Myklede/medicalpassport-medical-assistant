# MediPass wound and rehabilitation research architecture

This document is the collaboration boundary between the MediPass web product and
computer-vision work in `aimedic/`. The web analyzer now calls the local synthetic
wound model through FastAPI. No trained pose model is connected.

As of 2026-09-12, `aimedic/` contains the runnable synthetic
research pipeline (data generation, late-fusion model, training and longitudinal
JSON tracker). See [`aimedic/README.md`](../aimedic/README.md) for commands, tensor
contracts, verification and limits. It is integrated through `/wounds` and
`/wound-analyzer`, but has not been validated on clinical images. Its review rules are invented demo
thresholds, not validated medical triage criteria.

## What works now

### Wound Lab analyzer (`/wounds`, `/wound-analyzer`)

- Shared `components/wound-analyzer.tsx` embeds `WoundVisitWorkflow`. The browser
  calls same-origin `/api/wound-sessions`; the web server proxies to local Python
  on `127.0.0.1:8000`. Same-LAN phones use the laptop's web URL, not phone loopback.
- On the public Sites deployment, custom PNG/JPEG images run same-origin browser
  inference instead: pinned ONNX Runtime Web/WASM loads a verified int8 derivative
  of the supplied FUSd U-Net plus the fp32 synthetic tissue model. The browser
  applies the mask cleanup and inside-mask denominator, renders bounded 256 px
  pipeline rasters, and submits a hash/schema-pinned result with the original
  image to D1/R2. No port 8000 is needed for this hosted path.
- Patient Mode fixes one simulated profile and shows full VI/EN four-step education.
  Developer Mode selects five mock profiles and historical captures for structured
  tissue estimates, quality, pipeline panels, context and provenance. Recorded
  HbA1c/FPG, diabetes, vascular and neuropathy context accompany every analysis.
  Twenty synthetic clinical encounters remain complete in four-group accordions;
  they are not substituted for uploaded image measurements.
- Optional `pipeline_visuals` contains Base64 raw input, U-Net isolated foreground
  and tissue overlay. `aimedic/visual_pipeline.py` loads the supplied binary
  `outputs/wound_unet_fusd.pt` via SMP U-Net/ResNet34 on CPU (ImageNet, 256×256,
  sigmoid >0.35). Masks return at original dimensions. The single-wound workflow
  closes short gaps, keeps the dominant connected component, fills internal holes,
  and withholds implausibly tiny foreground; the Developer panel draws the retained
  contour explicitly. The separate synthetic tissue classifier colors only inside
  that cleaned mask. Binary training provenance/clinical
  performance have not been verified here. The tissue classifier and learned risk
  head now receive a masked crop. Tissue percentages count only mask pixels;
  unclassified mask pixels remain in the denominator. This is not feature attribution.
- v2 briefs preserve existing fields and add latest deltas, baseline-aware rules,
  uncalibrated risk/uncertainty and evidence provenance. Missing models or failed
  quality withhold unavailable measurements.
- The web workflow persists one or many captures in local SQLite, reloads the
  server's session list, appends on return and supports confirmed capture/session
  deletion. Thumbnails and historical pipeline results can be reopened. Sessions
  lock their baseline, derive relative days from capture times and allow 1,000 visits.
  One available image is analyzed with baseline; two comparable visits enable
  trajectory panels. A separate ≥7-day unchanged-trajectory review rule combines
  diabetes/HbA1c with measured changes; the legacy >7-day area flag is preserved.
- The three original checkpoints from `c269a89` are now materialized through
  Git LFS, SHA-256 verified and compatible with this macOS runtime. The isolated
  `scripts/verify-wound-models.py` API check passed actual single/two-visit inference,
  pending retry, historical visuals and exact-byte SQLite persistence. The unchanged
  79 Python tests also passed. These tests use synthetic fixtures and do not establish
  clinical performance or all-pages browser coverage. Opt-in missing-model handling
  still preserves an image as `pending_model` with null metrics if models become
  unavailable; retry analyzes the saved bytes once they are restored. No fabricated
  inference or replacement training was used. JSON `/api/analyze-trajectory` continues
  to review explicitly reported metrics.
  See [trajectory contracts and limits](WOUND_TRAJECTORY_ENGINE.md).
- Python CLI still handles training and multi-visit trajectory analysis.
- See [integration and startup guide](WOUND_AI_INTEGRATION.md).

Model setup on a new clone: `git lfs install --local`, `git lfs pull`, then
`shasum -a 256 -c aimedic/checkpoints.sha256`. On this macOS environment run
`outputs/wound-venv/bin/python -B scripts/verify-wound-models.py` to repeat the
isolated check. Start the web with `pnpm run demo` and keep
`outputs/wound-venv/bin/python -B aimedic/main.py` running in a second terminal.

### Wound history (`/wounds/history`)

- Starts a wound case or adds a follow-up assessment to an existing case.
- Captures a JPEG/PNG from the rear phone camera or file picker.
- Re-encodes the image in the browser before upload. This removes EXIF metadata
  such as GPS location and limits the longest side to 1,800 pixels.
- Requires permission/de-identification and research-only attestations.
- Stores image bytes in private R2 and patient-scoped metadata in D1.
- Saves the symptoms, pain score, time, body location, capture protocol, and
  matched health-record factors that were available at assessment time.
- Produces a conservative rules-based safety review from **reported data only**.
- Shows a longitudinal case history and records audit events.

The stored safety review is not an AI inference and does not inspect image pixels. The
UI and API expose this limitation directly.

### Motion Lab (`/therapy`)

- Opens a local, audio-free camera preview after browser permission.
- Does not record or upload raw video.
- Exposes exercise selection and the future metrics surface.
- Keeps repetition, range-of-motion, and deviation results blank until a real
  pose adapter is connected.

## Data flow

```text
Phone/browser
  -> sanitize RGB image in browser (resize + JPEG re-encode)
  -> POST /api/wounds (photo + observations + attestations)
  -> resolve authenticated user -> active patient membership
  -> private image in R2 / relational metadata in D1
  -> rules-based safety review using reported warning signs
     + explicitly saved active medical records
  -> patient-scoped timeline + audit event

Current local analyzer (separate from R2/D1 capture storage):
  -> browser/phone -> same-origin /api/wound-sessions web proxy
  -> FastAPI: fixed baseline + timestamped PNG/JPEG
  -> inference_tracker -> supplied checkpoints, if available
  -> atomic SQLite: image bytes + measured or explicitly pending visit
  -> one-image brief / multi-day trajectory + historical pipeline + delete/retry

Current hosted analyzer:
  -> browser decodes PNG/JPEG -> same-origin ONNX Runtime Web/WASM
  -> quantized derivative of supplied binary U-Net -> dominant filled mask
  -> fp32 synthetic tissue U-Net sees only the isolated crop
  -> bounded result contract -> original in private R2, result/session in D1
  -> browser retry can analyze a previously saved pending cloud image

Future clinician-record integration:
  -> asynchronous call to model service implemented from aimedic/
  -> versioned segmentation / quality / tissue / trajectory response
  -> immutable ai_inferences row
  -> clinician review before any result becomes confirmed clinical data
```

## D1 tables

`wound_cases`

- One row per wound episode and body location.
- Owns the longitudinal grouping and active/closed lifecycle.
- Always includes `patient_id`; every API query checks it.

`wound_assessments`

- One row per capture time.
- Links the wound case, patient, private R2 object, symptoms, pain, capture
  metadata, and the safety review shown at that time.
- Keeps an assessment immutable enough to reproduce what the user saw.

`ai_inferences`

- Reserved for real model output; the current rules review does not write here.
- Records model and dataset versions, a versioned input manifest, output,
  uncertainty, and human-review state.
- `requires_review` defaults to true. Inference must not overwrite a clinician's
  observation or a previously confirmed record.

Production schema changes are generated with Drizzle. Do not rewrite an applied
file under `drizzle/`; append a new migration.

## Safety policy in code

`lib/wound-safety.ts` separates reported-data triage from image inference:

- Emergency boundary: severe/uncontrolled bleeding, loss of feeling/function,
  or visible deep structures.
- Same-day review: fever, red streak, pus-like drainage, spreading redness,
  deep/gaping injury, retained object, bite, or a foot-area wound paired with a
  diabetes-related record.
- Prompt review: worsening pain, warmth, swelling, puncture/dirty wound, severe
  pain, or a matched healing/bleeding risk in the saved record.
- Monitoring state never says “safe” or “healing normally.” It says only that no
  urgent warning was reported and repeats that a photo/checklist can miss risk.

The wording follows the general warning signs and wound-management boundaries in
[MedlinePlus cuts and puncture wounds](https://medlineplus.gov/ency/article/000043.htm),
[CDC tetanus wound guidance](https://www.cdc.gov/tetanus/hcp/clinical-guidance/index.html),
and [CDC diabetes foot guidance](https://www.cdc.gov/diabetes/communication-resources/diabetes-foot-problems-when-to-see-your-doctor.html).
Before a real pilot, clinicians must review the rules, language, escalation
destinations, accessibility, and local emergency information.

## Connecting a real wound model later

The application contract is in `lib/vision/wound-model.ts`. Keep model code,
weights, training data, notebooks, and preprocessing in `aimedic/`.

Recommended implementation sequence:

1. Implement a small HTTP inference service in `aimedic/` with a health endpoint
   and the exact `WoundModelInput` / `WoundModelOutput` contract.
2. Validate capture quality first. Return an unusable result rather than forcing
   a prediction from blur, poor lighting, obstruction, or missing calibration.
3. Begin with segmentation and calibrated area trend. Do not begin with a claim
   that the model diagnoses infection.
4. Add an asynchronous Worker-side adapter; never expose service credentials to
   the browser.
5. Write every result to `ai_inferences` with model, dataset, and contract
   versions plus uncertainty.
6. Show the result as unreviewed until a qualified reviewer confirms or rejects
   it. Preserve both the raw inference and the review outcome.
7. Evaluate with patient-level train/validation/test splits and an external test
   site so images from one patient cannot leak across splits.

The target matches UB's focus on longitudinal, objective, multimodal metrics,
early deterioration signals, healing trajectories, and clinical validation:
[UB Precision Wound Care Collaborative](https://www.buffalo.edu/undergrad-research/opportunities.host.html/content/shared/www/undergrad-research/research-opportunities/precision-wound-care-collaborative-ai-powered-multimodal-monitoring-for-predictive-preventive-healing.detail.html).

## Connecting pose tracking later

`lib/vision/therapy-pose.ts` defines the browser adapter boundary. A MediaPipe or
TensorFlow.js implementation should:

1. Run locally against the live `<video>` element.
2. Emit landmarks and visibility without storing video frames.
3. Compute clinician-defined joint angles and a per-exercise state machine.
4. Return repetitions, range of motion, and timestamped deviations.
5. Save only the derived session summary by default. Video storage requires a
   separate consent, retention policy, and access-control review.

## GitHub collaboration rules

- Never commit real wound photos, PHI, model credentials, `.env*`, or exported
  production data.
- Use synthetic/de-identified fixtures only. The three original checkpoints are
  distributed through Git LFS under `outputs/`, with digests in
  `aimedic/checkpoints.sha256`; keep model bytes out of ordinary Git blobs.
  Generated datasets, environments and the user's SQLite database remain ignored.
- Suggested ownership:
  - product/API: `app/`, `db/`, `lib/wound-safety.ts`
  - model research: `aimedic/`
  - shared contract: `lib/vision/` (changes reviewed by both sides)
- Use short feature branches such as `feature/wound-segmentation-adapter`.
- Include a new migration, safety test cases, and contract-version note in pull
  requests that change stored model input or output.
- Do not merge a UI that displays confidence as certainty. Always show data
  quality, uncertainty, model version, and human-review status together.
