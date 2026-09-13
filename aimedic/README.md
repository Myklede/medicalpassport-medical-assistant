# MediPass: multimodal wound research prototype

Current integration revision (2026-09-12): the unchanged **77 tests passed, 0 failed**,
plus actual original-model API verification through `scripts/verify-wound-models.py`.
The three checkpoints from `c269a89` are materialized through Git LFS and match
`aimedic/checkpoints.sha256`. API v2 uses mask-only
tissue counts, durable SQLite sessions and baseline-aware trajectory rules. Web UI
now lists/reopens sessions, appends one or many images, shows historical pipeline
panels and confirms visit/session deletion. Read
[the current trajectory contract and runnable example](../docs/WOUND_TRAJECTORY_ENGINE.md).
Patient explanations now follow explanation → mechanism → consequence → next steps
in English and Vietnamese, with source links and separate clinician wording.
Earlier training/QA results below describe the original simulator and visual integration.

Updated 2026-09-12. All five executable Python scripts are implemented. Training runs
locally via CLI. The website's `/wounds` and `/wound-analyzer` use `WoundVisitWorkflow`
and `lib/wound-sessions-api.ts` through the web server's same-origin proxy to Script 5.
The stateless `lib/wound-api.ts` remains compatible. `/wounds/history` preserves the original
stored captures and reported-data rules. Model results do not write to Supabase or
patient records. See [frontend integration](../docs/WOUND_AI_INTEGRATION.md).

## Run from the repository root

Create an isolated Python environment. Activation is unnecessary on Windows:

**Current macOS checkout:** the environment is `outputs/wound-venv/bin/python`.
The original fusion/binary/tissue checkpoints from `c269a89` have been retrieved,
SHA-256 verified and exercised by real single/two-visit API inference. On a new
clone, install Git LFS and materialize the existing models before starting:

```bash
git lfs install --local
git lfs pull
shasum -a 256 -c aimedic/checkpoints.sha256
outputs/wound-venv/bin/python -B scripts/verify-wound-models.py
```

Keep `pnpm run demo` running in one terminal and
`outputs/wound-venv/bin/python -B aimedic/main.py` in another, then open
`http://localhost:3001/wounds`. The verification script uses a temporary SQLite
database and the committed synthetic fixture; it never touches the user's database
or trains/modifies models. Pending-image storage, session listing/readback/deletion
and JSON reported-metric review also work if models become unavailable. The training
commands below document the original research workflow; no replacement model was
trained for this integration.

```powershell
python -m venv outputs/pwc-venv
outputs/pwc-venv/Scripts/python.exe -m pip install -r aimedic/requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
outputs/pwc-venv/Scripts/python.exe -B aimedic/synthetic_data_generator.py
outputs/pwc-venv/Scripts/python.exe -B aimedic/multimodal_model.py
outputs/pwc-venv/Scripts/python.exe -B aimedic/train_loop.py --epochs 10 --out outputs/pwc-run
outputs/pwc-venv/Scripts/python.exe -B aimedic/inference_tracker.py --checkpoint outputs/pwc-run/best.pt --profile outputs/pwc-synthetic/patients/SYN000001/patient_profile.json --images outputs/pwc-synthetic/patients/SYN000001/day_001_rgb.png outputs/pwc-synthetic/patients/SYN000001/day_003_rgb.png outputs/pwc-synthetic/patients/SYN000001/day_007_rgb.png --out outputs/pwc-brief.json
```

On macOS/Linux use the chosen environment's `bin/python` instead of the Windows executable.
Use a Python version supported by the installed wheels; the original Windows environment was verified with
Python 3.14.7, PyTorch 2.14.0+cpu, NumPy 2.5.3 and OpenCV 5.0.0 on Windows.

**Historical Windows training artifacts:** `outputs/pwc-synthetic` contained 1,000 patients
and 3,000 visits; `outputs/pwc-run/best.pt` is the original five-epoch demonstration checkpoint,
now distributed through Git LFS; `outputs/pwc-brief.json` held an example brief.
The full generated dataset and example brief are not included by cloning the repository.
Dataset/training directories and brief filenames refuse overwrites;
choose a new `--out` value for another run. Generated datasets, example briefs and
the Python environment remain ignored and must be recreated on another laptop;
the three original checkpoints are the explicit Git LFS exceptions.

For day 30, generate a separate dataset with `--days 1 3 7 30`. The same architecture
supports any number of ordered visits. Infer days from filenames such as
`day_001_rgb.png` or `img_day1.jpg`; otherwise pass `--days 1 3 7 30` explicitly.
Images must belong to the same patient and wound episode. Neither filenames nor
pixels verify identity. The caller supplies a single baseline valid for the comparison.

## Local FastAPI server (Script 5)

Historically tested on Python **3.14.7** with FastAPI 0.141.1, Pydantic 2.13.5, Uvicorn 0.52.4
and python-multipart 0.0.32. The API uses Pydantic v2; Python 3.14 is not a
Pydantic v1 target. Install the current requirements before starting the server:

```powershell
outputs/pwc-venv/Scripts/python.exe -m pip install -r aimedic/requirements.txt
outputs/pwc-venv/Scripts/python.exe -B aimedic/main.py
```

From the repository root, this alternative also works:

```powershell
outputs/pwc-venv/Scripts/python.exe -m uvicorn aimedic.main:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000/docs** to try the endpoint in Swagger UI.
`POST /api/analyze-wound` accepts `multipart/form-data`:

| Field | Type | Meaning |
| --- | --- | --- |
| `image` | UploadFile | PNG or JPEG, maximum 8 MiB |
| `patient_data` | string | JSON baseline object, maximum 16,384 characters |
| `day` | number, optional | Nonnegative relative observation day; default 0 denotes this capture's baseline |
| `include_pipeline_visuals` | boolean, optional | Default false; true adds the Base64 visualization extension for Developer Mode |
| `pixels_per_cm` | positive number, optional | Caller-measured same-plane scale in this image; enables projected cm² |
| `clinical_observations` | JSON string, optional | Reported source and boolean symptoms/scab observations; never inferred from image color |

Legacy stateless client example (browser on the same computer only; the current
web workflow uses the same-origin session proxy instead):

```typescript
const form = new FormData();
form.append("image", file); // file is the user's File from the file input
form.append("patient_data", JSON.stringify({
  patient_id: "DEMO-001", age: 62, blood_type: "O+",
  has_diabetes_type_2: true, hba1c_level: 9.2, hypertension: true,
  synthetic: true,
}));
form.append("day", "1"); // optional
const response = await fetch("http://127.0.0.1:8000/api/analyze-wound", {
  method: "POST", body: form,
});
const result = await response.json();
if (!response.ok) throw new Error(JSON.stringify(result.detail));
console.log(result.objective_measurements, result.multimodal_context_analysis);
```

Let the browser set `Content-Type` and the multipart boundary. CORS allows
`localhost` and `127.0.0.1` on frontend ports **3000 and 3001**. Override origins
with comma-separated `MEDIPASS_CORS_ORIGINS` if needed. Cookies are not required.
The default checkpoint is `outputs/pwc-run/best.pt`, resolved relative to the repo
regardless of the process working directory. Override it with `MEDIPASS_MODEL_PATH`.

The stateless route calls `track_wound` in a worker thread using isolated temporary files,
which are deleted on success or failure. It does not retain uploads or accumulate
visits across requests. One image returns current estimates but
`trajectory_available: false`; no previous visit or healing rate is fabricated.
The existing quality abstention and research-only flags remain in the brief.
Responses: 413 oversized image; 415 unsupported/mismatched format; 422 invalid
JSON/baseline/image/day; 503 missing or incompatible trained model.

The service binds to loopback by default. This is a local adapter with no user
authentication; CORS is not authorization. The current session workflow's web proxy
reaches Python on `127.0.0.1:8000`. Desktop and same-LAN phones access the laptop's
web host on port 3001 and share its SQLite sessions, without exposing Python or
calling phone loopback. No hosted Python service has been deployed.

API verification (includes training a tiny independent synthetic fixture):

```powershell
outputs/pwc-venv/Scripts/python.exe -m pip install -r aimedic/requirements-dev.txt
outputs/pwc-venv/Scripts/python.exe -B -m unittest discover -s aimedic -p 'test_*.py' -v
```

Historical binary integration: 42 tests passed (17 API + 14 pipeline + 11 binary-visual tests), including real multipart inference, PNG/JPEG,
the single-visit contract, CORS preflights, malformed input, upload bounds, missing
checkpoints, and temporary-file cleanup. See [FastAPI forms and files](https://fastapi.tiangolo.com/tutorial/request-forms-and-files/)
and [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/) for the request conventions.

`/api/wound-sessions` routes retain image bytes, measurements and historical
pipeline data in ignored `outputs/wound-sessions.sqlite3`, independent of Supabase/D1/R2.
`POST /api/analyze-trajectory` accepts ordered JSON metrics without needing weights.
Sessions lock baseline, enforce chronology, reject duplicate captures and recompute
the brief after each visit. The limit is 1,000 images/session with no automatic expiry.
The web derives days from capture timestamps and lists saved sessions from the server;
it supports confirmed deletion of a visit/session and historical-visit readback.
New recorded FPG/vascular/neuropathy context and the ≥7-day unchanged-trajectory
review flag leave trained architecture unchanged and preserve the legacy >7-day area flag.

The optional upload flag `preserve_on_model_unavailable=true` preserves valid images
when inference returns 503 as `pending_model` visits with null metrics. The frontend
uses this flag and labels missing analysis explicitly.
`POST /api/wound-sessions/{session_id}/visits/{visit_id}/analyze?patient_id=...` retries
from stored image bytes after compatible models are supplied; it keeps capture
identity/timing and updates analysis atomically. The default API error behavior
without opt-in is unchanged. See the trajectory guide for requests and validation.

## Optional Developer Mode visuals

The original `pwc-late-fusion-v1` model uses a ResNet-style encoder and predicts
global tissue proportions. It has no U-Net mask or pixel-level attribution.
`visual_pipeline.py` now loads the supplied `outputs/wound_unet_fusd.pt` with
`smp.Unet(encoder_name="resnet34", encoder_weights=None, in_channels=3, classes=1)`
on CPU in eval/inference mode. `segmentation-models-pytorch==0.5.0` is in requirements.
It loads a bare state dictionary or `state_dict`/`model_state_dict` wrapper strictly
with `weights_only=True`, without downloading encoder weights. See the
[SMP U-Net API](https://smp.readthedocs.io/en/latest/models.html#unet).

Binary preprocessing: RGB → bilinear resize to 256×256 → divide by 255 → ImageNet
mean `[0.485, 0.456, 0.406]`, std `[0.229, 0.224, 0.225]`. Apply sigmoid to logits,
select probabilities **strictly >0.35**, then resize the binary mask to the original
image dimensions with nearest-neighbor interpolation. This mask determines PNG alpha.

The existing small four-class U-Net remains the synthetic tissue classifier with
its original 64×64 RGB `[0,1]` preprocessing. Tissue labels and the rendered overlay
are both clipped to the binary mask; outside overlay pixels remain identical to the input.
The input to tissue inference is now zero-masked before crop/resize and masked again
after resize. API v2 tissue percentages come from counted mask pixels, including an
explicit unclassified fraction. The risk head receives the isolated crop with the
existing baseline encoding; the model architecture/weights remain unchanged.

```powershell
# This command trains ONLY the synthetic tissue companion; use a fresh --out.
outputs/pwc-venv/Scripts/python.exe -B aimedic/visual_pipeline.py --epochs 5 --out outputs/pwc-visual-run
outputs/pwc-venv/Scripts/python.exe -B aimedic/main.py
```

Binary weights default to `outputs/wound_unet_fusd.pt` (`MEDIPASS_VISUAL_MODEL_PATH`
override). Tissue weights remain `outputs/pwc-visual-run/best.pt`
(`MEDIPASS_TISSUE_MODEL_PATH` override). Relative paths resolve from the repo root.
The binary, tissue and late-fusion checkpoints are stored in Git LFS. After cloning
on another laptop, install Git LFS and materialize the files before running the API:

```powershell
git lfs install --local
git lfs pull
git lfs ls-files
```

Expected locations and SHA-256 digests are recorded in
`aimedic/checkpoints.sha256`. If `git lfs pull` is skipped, the `.pt` paths contain
small LFS pointer text instead of PyTorch weights and model loading will fail.
Their training provenance/clinical performance are not verified here.
The following training description applies only to the synthetic tissue companion.
Training reuses the existing
patient-level train/validation/test splits and paired synthetic RGB/class masks.
Those crops have no background class, so a known synthetic ellipse and gray noisy
background are added to 3/4 of training examples. Labels: 0 background, 1 necrotic,
2 slough, 3 granulation. Five epochs were run in the historical Windows environment; held-out **synthetic**
mean IoU was 0.9346. This is not clinical segmentation performance. Epoch selection
uses validation only; the test split is evaluated after selection. Original
images/profiles and fusion weights are unchanged.

`include_pipeline_visuals=true` adds one object to the brief:

- `original_image`: standard Base64 of exact input bytes, with `original_mime_type`
  (`image/png` or `image/jpeg`); API strings have no data-URL prefix.
- `unet_segmentation_mask`: Base64 PNG RGBA with transparent predicted background;
  dark tissue is not removed just because it is dark.
- `tissue_analysis_overlay`: Base64 PNG RGB highlighting tissue classes only inside
  the binary wound mask; surrounding skin is excluded.
- `status`, `reason`, `model`, `day`, `relationship`, `clinical_validation` describe
  provenance and limits. Both derived PNGs retain the original image dimensions.
  `model` describes the supplied binary model and threshold; `tissue_model`
  separately describes the synthetic tissue classifier.

Missing/incompatible visual weights return `status: unavailable`; quality failure
returns `quality_abstained`. Both derived image values are null in either case.
The original image remains available and the core Clinical Brief is preserved.
If only tissue weights are missing, isolation remains available (`status: available`,
`tissue_status: unavailable`) while the overlay is null. Empty binary masks produce
transparent isolation, unchanged overlay and `tissue_status: no_wound_pixels`; this
does not confirm absence of injury.
Default callers receive no extension. Optional Python tracker visuals describe the
**last** visit and require `include_pipeline_visuals=True, visual_checkpoint_path=...`.
The stateless endpoint persists no images or briefs; session endpoints do. Tests cover core-brief/raw-byte equality,
PNG alpha, JPEG MIME, optional-model fallback, quality abstention, normalization,
strict threshold, original-size restoration and outside-mask pixel equality.
The existing tests use controlled SMP fixture weights. Separately, the original
checkpoints were verified on this macOS checkout on 2026-09-12 using
`scripts/verify-wound-models.py`: actual single-image analysis, a two-capture
comparison, pending-image retry, saved historical visuals and exact-byte SQLite
readback all passed. The original synthetic image produced 2,536 wound-mask pixels;
the overlay left every outside-mask pixel unchanged. The second QA image is a
horizontal mirror of the same simulator fixture, not a real later healing capture.
This verifies model compatibility and software behavior, not clinical accuracy.
The earlier binary-only
update left the tracker unchanged; the subsequent trajectory update modifies it.
`train_loop.py` and `multimodal_model.py` remain unchanged in both updates.

## Contracts for the next agent

- `synthetic_data_generator.py`: profile JSONs, per-patient visit JSONs, RGB PNGs,
  class masks and a versioned manifest. All of one patient's visits stay in the
  same split: 700 train / 150 validation / 150 test patients by default.
- `multimodal_model.py`: ResNet-style vision encoder (64 features), baseline MLP
  (32 features), concatenation (96), shared dense layer and two heads. Images are
  RGB float32 `[B,3,H,W]` in `[0,1]`; baseline is `[B,13]`. Tissue fractions are
  `[B,3]` in necrotic/slough/granulation order, summing to one. Risk logits/scores
  are `[B,1]`. `forward_sequence` returns `[B,T,3]` and `[B,T,1]`; it shares the
  per-visit model, rather than learning a recurrent/attention temporal encoder.
- `train_loop.py`: MSE on fractions plus BCEWithLogitsLoss on binary seven-day
  simulator labels; AdamW, gradient clipping, seeded shuffling, validation-based
  checkpoint selection and a held-out test evaluation. Input features exclude
  masks, patient IDs, future outcomes and risk labels. Duplicate patients/images
  and dataset paths outside the data root are rejected.
- `inference_tracker.py`: `track_wound(image_paths, patient_profile_path,
  checkpoint_path, days=None, device="cpu")` returns a JSON-serializable dictionary.
  It checks the trained checkpoint and exact preprocessing/feature schema, applies
  basic quality gates, compares consecutive visits and overall change, and records
  hashes of the checkpoint, profile and images. It has no random-weight fallback.
- `main.py`: FastAPI multipart adapter, metric-trajectory endpoint and local stored image sessions. Both
  `python aimedic/main.py` and `uvicorn aimedic.main:app` work; imports in the
  tracker and training module support both package and standalone execution.
- `format_clinical_brief(visits, profile, provenance=None)` is independently testable:
  deterministic context rules, tissue changes in **percentage points** and per day,
  physician review suggestions, and explicit rule provenance. Historical worsening
  remains visible even if the last visit improves; cumulative changes are checked too.

`risk_deterioration_score` estimates an **invented seven-day simulator event**:
necrotic +5 pp or necrotic+slough +10 pp in a separately simulated future.
The review thresholds are separate illustrative rules, not clinical thresholds.
Diabetes with HbA1c >8 selects lower thresholds (necrotic +2 pp, slough +5 pp)
to demonstrate baseline-dependent logic. No empirical claim of danger is attached.
Blood type is encoded categorically but has no assumed causal effect in the generator.

## Verification and limits

Current macOS verification:

```bash
outputs/wound-venv/bin/python -B scripts/verify-wound-models.py
outputs/wound-venv/bin/python -B -m unittest discover -s aimedic -p 'test_*.py' -v
```

Both passed after retrieving `c269a89`: the integration script uses all three
original checkpoint files; the existing suite passed **77/77** without test edits.
Checkpoint digests were unchanged before and after the integration checks.
Its supplied 10 pixels/cm scale is only a test input. These API checks do not
establish all-pages browser coverage or clinical measurement performance.

```powershell
outputs/pwc-venv/Scripts/python.exe -B -m unittest discover -s aimedic -p test_pipeline.py -v
```

Historical original pipeline: 14 tests passed for train/save/reload/infer, four time points including day 30,
patient split integrity, invalid checkpoints and paths, quality abstention,
date validation, absolute change units, baseline-specific thresholds, cumulative
and interim deterioration, and no false safety claim when no rule fires.

The full five-epoch run used 2,100 train / 450 validation / 450 test visits.
Epoch 5 was selected. Held-out **synthetic** tissue MAE was 1.146 / 1.836 / 1.957 pp
(necrotic/slough/granulation), risk Brier 0.0887. These are software/demo results,
not clinical performance estimates or patient-level uncertainty bounds.

The late-fusion model learns colored synthetic masks, not hospital photographs.
The API now supplies a masked wound crop and discards the global tissue head in
favor of masked pixel counts. Legacy CLI defaults retain the original crop path.
The new rule score is separate from the model score. There is no clinically validated segmentation, area calibration,
clinical quality model, OOD detector, calibrated risk probability or diagnostic
capability. Simple exposure/contrast/detail checks reject obvious unusable images;
passing these checks does not establish that a clinical image is suitable.

Every brief marks estimates as unconfirmed, includes `clinical_use_allowed: false`,
and requires human review. The code makes no FDA clearance/compliance claim.
Medical-image analysis does not become non-device CDS just by changing the wording
of the output; see [FDA's CDS guidance](https://www.fda.gov/media/109618/download).
Checkpoint loading uses `weights_only=True`; see
[PyTorch serialization guidance](https://docs.pytorch.org/docs/2.14/notes/serialization.html).

Before any clinical integration, replace the simulator with appropriately governed
data, perform external validation and calibration, validate uncertainty/quality,
review the regulatory intended use, and follow `docs/WOUND_RESEARCH_ARCHITECTURE.md`.
Keep model outputs separate from clinician-confirmed observations.
