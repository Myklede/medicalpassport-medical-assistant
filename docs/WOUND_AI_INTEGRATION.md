# Wound Lab AI integration — 2026-09-11

Current backend contract: [multi-day trajectory engine and stored sessions](WOUND_TRAJECTORY_ENGINE.md).
The existing uploader remains single-image. Use Swagger/API for multi-day sessions;
the session service is present but a session-selector UI is not yet wired.

## Run on this laptop

Open two terminals in the repository root and leave both running:

```powershell
# Terminal 1: frontend (uses Node 24 even if the system Node is older)
npx --yes node@24 node_modules/vinext/dist/cli.js dev --host 0.0.0.0 --port 3001
```

```powershell
# Terminal 2: Python 3.14 environment and trained checkpoint already on this laptop
outputs/pwc-venv/Scripts/python.exe -B aimedic/main.py
```

Open **http://localhost:3001/wounds** in Chrome. Complete local sign-in if requested.
Enable **Developer Mode**, choose **Thử ảnh & hồ sơ mẫu**, then **Phân tích ảnh**. The bundled synthetic image
and matching profile produce a fresh API request, not a prerecorded result.
You can instead upload PNG/JPEG. Patient Mode locks one simulated signed-in profile;
Developer Mode selects one of five profiles and exposes the relative observation day.

On another laptop, install frontend dependencies and follow
[`aimedic/README.md`](../aimedic/README.md) to create the Python environment, generate
the 1,000-patient dataset and train a checkpoint first. `outputs/` and weights are
intentionally not committed. The small public sample is committed with the app.

For the optional U-Net panels, first copy supplied binary weights to
`outputs/wound_unet_fusd.pt`. The following trains only the separate synthetic
tissue overlay model (skip if it already exists):

```powershell
outputs/pwc-venv/Scripts/python.exe -B aimedic/visual_pipeline.py --epochs 5
```

This creates `outputs/pwc-visual-run/best.pt`; both files already exist on this laptop.
`MEDIPASS_VISUAL_MODEL_PATH` overrides binary weights; `MEDIPASS_TISSUE_MODEL_PATH`
overrides tissue weights. Missing binary weights leave both panels unavailable.
Missing only tissue weights preserves isolation and leaves the overlay unavailable.
See `aimedic/README.md` for model provenance and limits.

Both services must run on the computer running the browser. The requested API URL
is fixed to `127.0.0.1:8000`; it does not connect a physical phone or a hosted site
to this laptop. Desktop Chrome device emulation and the same-origin mobile preview
can use it. Remote service hosting, authentication and a configurable endpoint are
separate future work. No deployment or GitHub push was performed for this change.

## What changed and what was reused

| Surface | Current behavior |
| --- | --- |
| `/wounds` | Main Wound Lab now opens the working AI upload/results interface |
| `/wound-analyzer` | Alternate URL for the same shared client component |
| `/wounds/history` | Original capture form, EXIF-removing image preparation, symptoms, saved photos, case history and reported-data review |
| `lib/wound-api.ts` | `analyzeWound(File, object, day = 0, options = {})` retains the original three fields; `options.includePipelineVisuals` adds the opt-in form flag |
| `components/wound-analyzer.tsx` | Patient/Developer switch, Select, responsive light/dark UI, preview, sample, loading, friendly summary or research pipeline/metadata |
| `lib/wound-patients.ts` | Five immutable synthetic profiles; Patient Mode always uses `PATIENT_MODE_PROFILE`, regardless of the last developer selection |
| `public/wound-demo` | One matching synthetic image/profile pair from SYN000014, day 7; no real clinical data |
| `aimedic/` | Existing late-fusion predictions preserved; optional supplied binary U-Net isolation plus synthetic tissue overlay clipped inside its mask |

Every existing Wound Lab navigation link now reaches the analyzer. **Lịch sử & ghi
nhận** opens the preserved storage workflow; its AI link returns to the analyzer.
No stored images, medical records, database schemas or storage providers were migrated.
The old `lib/vision` placeholder describes the stored-review adapter only, not the
new local API. Model training remains executable Python CLI work, not a browser button.

## View modes and image provenance

Patient Mode is the default. It hides metadata controls, developer sample controls,
technical risk score, intermediate images and model metadata. The friendly summary
retains quality abstention and one-image/research limits. This is a simulated login
profile, not real account-to-patient authorization.

Developer Mode offers five age/blood-type/HbA1c/comorbidity profiles via Select.
Selection fills the displayed baseline and API payload. Changing mode/profile
clears the image and brief; controls lock during a request. Patient Mode always
restores SYN000014. These mock profiles do not create Supabase records.

The four panels show raw input, actual U-Net foreground with transparent background,
its tissue overlay, and the late-fusion Clinical Brief with the selected baseline.
API v2 now counts tissue percentages within the binary mask, including unclassified
pixels. Tissue inference and the learned risk head receive an isolated crop;
overlays are still not feature attribution. The model architecture is unchanged.
The binary U-Net uses supplied weights whose training provenance/clinical performance
are not verified here. It runs on CPU with ImageNet normalization, 256×256 input,
sigmoid >0.35 and original-size masks. Tissue and fusion training remain synthetic.

Developer Mode requests `include_pipeline_visuals=true`; Patient Mode omits it.
Base64 strings include MIME/status/provenance fields. The UI accepts bounded PNG/JPEG
data only and displays placeholders if images are absent, malformed, quality-abstained
or unavailable from an older server.

## Contract and limits

Baseline keys are `patient_id`, `age`, **`hba1c_level`**, `blood_type`,
`has_diabetes_type_2`, and `hypertension`. The spelling uses the digit **1**, not
`hbaic_level`. `day` is a nonnegative relative observation day, default 0.

The browser sends no manually constructed Content-Type header so its multipart
boundary stays valid. Requests time out after 60 seconds. FastAPI 422 messages show
the field and message without dumping the submitted `input` object. Editing inputs
clears a previous brief. Rejected image quality displays missing estimates as dashes,
not zeros; malformed success payloads become errors rather than fabricated metrics.

The current endpoint accepts **one image per request**. Its tracker returns current
estimates and `trajectory_available: false`; repeated uploads do not become a time
series automatically. Multi-visit analysis remains available through the Python
tracker CLI. The score describes the invented simulator target, not a calibrated
clinical probability. No diagnosis, clinical validation or regulatory approval is
claimed. A clinical photograph is outside the model's synthetic training domain.

The stateless endpoint deletes temporary upload files. New session endpoints store
images/measurements in local SQLite and recalculate the multi-day brief on read.
These AI sessions are not saved to Supabase, D1, R2 or clinician-confirmed records. The separate history workflow
continues saving captures to private R2 and metadata to D1 as before.

## Verification

```powershell
# Contract tests; no API server needed
npx --yes node@24 --test tests/wound-api.test.ts

# Browser integration; requires both servers and the existing ignored Playwright install
$env:MEDIPASS_TEST_URL='http://localhost:3001'
npx --yes node@24 tests/wound-analyzer-browser.mjs

# Full pre-push check (does not push)
npx --yes node@24 scripts/pre-push-check.mjs
```

The browser script covers real multipart inference, disabled/loading states,
structured results, 422 and connection failures, quality abstention, stale-result
clearing, mobile dark mode without horizontal overflow, the synthetic sample, both
analyzer routes, and preserved history navigation/inputs. It does not save medical
data. Screenshots are written under ignored `outputs/qa/`.

`tests/browser.mjs` now enters **Lịch sử & ghi nhận** before testing the existing
capture/save/readback flow. `scripts/pre-push-check.mjs` includes the ten new
service/profile tests along with the existing unit suite, TypeScript and production build.

Verified on 2026-09-11: **41 frontend unit tests, 30 Python tests, TypeScript, production build and the focused
Chrome integration script passed**. Both the frontend on 3001 and FastAPI on 8000
were running during the live upload tests. The full portal browser suite was not
rerun for this wound-only change; its history route entry was updated. Focused QA
covers all five developer profiles, fixed patient identity after mode switching,
rejection of mismatched response identity, three decodable images/four pipeline
panels, older-server fallback and both modes in mobile dark/light layouts.

Binary update, 2026-09-11: **42 Python tests passed, 0 failed** using the project's
virtual environment and `unittest discover -s aimedic -p 'test_*.py' -v`.
Fixtures now separate the single-output SMP binary model from the tissue classifier.
Coverage includes normalization, threshold, original-size masks, background exclusion,
empty masks, unavailable models and relative paths. Live inference with the supplied
checkpoint returned HTTP 200 with both images. SHA256 checks confirmed unchanged
`train_loop.py`, `multimodal_model.py` and `inference_tracker.py` at that stage.
Subsequent trajectory revision: **69 Python tests passed**, tracker/API updated;
training and core multimodal model remain unchanged. See the current trajectory guide.
