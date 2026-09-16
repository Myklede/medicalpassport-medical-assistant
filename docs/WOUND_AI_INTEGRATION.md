# Wound Lab AI integration — 2026-09-12

Current backend contract: [trajectory engine and stored sessions](WOUND_TRAJECTORY_ENGINE.md).
`components/wound-analyzer.tsx` embeds `WoundVisitWorkflow`: one or many captures
are saved in server-listed local SQLite sessions and analyzed with a fixed clinical
baseline when the required models are available.

## Run on this laptop

Leave two terminals running in the repository root:

```bash
# Terminal 1: Node >=22.13
pnpm run demo

# Terminal 2: current macOS environment
outputs/wound-venv/bin/python -B aimedic/main.py
```

If system Node is older, use
`npx --yes node@24 node_modules/vinext/dist/cli.js dev --hostname 0.0.0.0 --port 3001`.
Windows users can follow the environment instructions in
[`aimedic/README.md`](../aimedic/README.md) using `outputs/pwc-venv/Scripts/python.exe`.

Open **http://localhost:3001/wounds**. Choose an existing tracking session or start
a new one, select PNG/JPEG files, enter each capture's actual date/time, then choose
**Lưu & phân tích**. One available image is analyzed with the historical baseline;
comparable later images add trajectory deltas. Developer Mode also offers a public
synthetic sample and five selectable profiles. This is a fresh request, not a prerecorded result.

**All three original checkpoints from `c269a89` are present and verified in this
macOS checkout.** Their paths and optional environment overrides are:

- Fusion: `outputs/pwc-run/best.pt` (`MEDIPASS_MODEL_PATH`).
- Binary U-Net: `outputs/wound_unet_fusd.pt` (`MEDIPASS_VISUAL_MODEL_PATH`).
- Tissue: `outputs/pwc-visual-run/best.pt` (`MEDIPASS_TISSUE_MODEL_PATH`).

The checkpoint paths are tracked through Git LFS; the Python environment, generated
dataset and user SQLite database remain ignored. No replacement model was trained
for this UI work, and the original checkpoint bytes and backend tests are unchanged.
The small public synthetic sample is committed with the app. On another clone:

```bash
git lfs install --local
git lfs pull
git lfs ls-files
shasum -a 256 -c aimedic/checkpoints.sha256
outputs/wound-venv/bin/python -B scripts/verify-wound-models.py
```

The `.pt` files must contain actual model bytes, not small Git LFS pointer files.
The verification script loads the originals through the API, uses only a temporary
SQLite database and synthetic fixtures, and checks unchanged digests afterward.
It passed on this checkout; original-model inference now runs without a replacement
checkpoint or fabricated measurements.

The uploader opts into `preserve_on_model_unavailable=true`. When inference returns
a missing-model 503, the image is retained as `pending_model` with null image/tissue/risk
estimates. The UI displays **Ảnh đã lưu · đang chờ mô hình AI** and **Phân tích lại ảnh đã lưu**.
If compatible checkpoints need to be restored, retry analyzes the saved bytes without
another upload. Missing optional visual models show explicit unavailable panels.

## Desktop and same-Wi-Fi phones

Both services run on the laptop. The browser calls same-origin
`/api/wound-sessions`; the web server forwards only this API to Python at
`127.0.0.1:8000`. A phone opens `http://LAPTOP-LAN-IP:3001/wounds` and uses
the same saved sessions. It never calls the phone's loopback. Keep Python on loopback
and expose the web port only on the trusted LAN. A hosted page cannot reach this
laptop's service; hosted inference and production authentication are separate work.
See [LAN startup instructions](RUN_APP_VI.md).

## Workflow and integration surfaces

| Surface | Current behavior |
| --- | --- |
| `/wounds`, `/wound-analyzer` | Shared Patient/Developer analyzer and persistent visit workflow |
| `components/wound-visit-workflow.tsx` | Server session selector, one/multiple captures, timestamps, durable append/reload, thumbnails, historical selection, confirmed deletion and pending-analysis retry |
| `lib/wound-sessions-api.ts`, `vite.config.ts`, `app/api/wound-sessions` | Same-origin client; local Node/Vite proxy reaches Python outside the Worker sandbox, with a server route providing a controlled unavailable-service response where loopback is inaccessible |
| `components/wound-clinical-history.tsx` | Complete four-group clinical encounter accordion |
| `lib/wound-patients.ts` | Five deeply immutable synthetic profiles, FPG/vascular/neuropathy context and four full clinical visits each |
| `/wounds/history` | Preserved EXIF-removing R2/D1 capture storage and reported-data review, independent of AI sessions |
| `lib/wound-api.ts` | Existing stateless `analyzeWound` service remains for compatibility |
| `aimedic/` | Existing trained architecture, isolated crop/inside-mask tissue counts, trajectory rules, SQLite sessions and API |
| `public/wound-demo` | SYN000014 day-7 synthetic image/profile; no real clinical data |
| `components/medipass-brand.tsx`, `components/medipass-badge.tsx`, `app/globals.css` | Shared biometric-shield/pulse badge and Clinical Indigo/Deep Slate theme tokens across the common shell |

Existing R2/D1 images and clinician records are not migrated. SQLite evolves
additively to retain pipeline data with image bytes/measurements. Model training
remains Python CLI work, not a browser control.

## View modes and baseline fusion

Patient Mode fixes `PATIENT_MODE_PROFILE` (SYN000014), hides technical scores and
intermediate images, and renders `patient_explanation.locales.vi` by default with
an English option. All four steps are displayed: simple explanation/baseline;
biological mechanism; realistic consequences; actions/care triggers. Measurement,
rule and safety notes remain visible. Quality abstention never becomes reassurance.

Developer Mode selects one of five profiles and opens the four pipeline panels for
any selected saved capture. Changing mode/profile clears unsaved drafts and old
results, then reloads that patient's sessions; saved images are not deleted.
This is simulated sign-in, not real patient authorization or a Supabase connection.

Baseline keys are `patient_id`, `age`, `blood_type`, **`hba1c_level`**,
`has_diabetes_type_2`, `hypertension`, `fpg_mg_dl`,
`peripheral_vascular_status` (`normal`, `impaired`, `unknown`) and
`neuropathy_status` (`present`, `absent`, `unknown`).
Each session retains its original baseline. Additional clinical context affects
deterministic rules and explanations, not the learned model's feature architecture.

The accordion exposes all 20 synthetic visits: recorded reference ranges/flags,
wound dimensions and tissue ratios, procedures, exact medication doses/dressings,
offloading plans and follow-up dates. Carried-forward HbA1c keeps its original
measurement date. These historical records are never substituted for measurements
from newly uploaded images.

## Chronology, persistence and deletion

Each append request accepts one PNG/JPEG, up to 8 MiB. The UI serializes a batch
in capture-time order and preserves successful saves if a later request fails.
Sessions allow up to 1,000 captures. Duplicate images and backward timestamps/days
are rejected. The UI derives relative days from capture times with a fixed session
anchor; deleting a capture does not renumber the remaining history.

One analyzed capture provides a full current baseline-fused brief but no invented
healing rate. Two comparable captures expose exact tissue percentage-point and
cm²/pixel deltas. Optional `pixels_per_cm` must come from a same-plane ruler in
that image; pixel comparisons require explicit capture consistency. A ≥7-day
nearly unchanged trajectory with diabetes OR HbA1c >8% triggers a research review
alert, separate from the legacy >7-day area-only flag. These are not validated
clinical timers, probabilities or instructions to wait for symptoms.

SQLite defaults to ignored `outputs/wound-sessions.sqlite3` and has no automatic
expiry. Browser storage clearing or service restarts do not erase this database.
Delete controls confirm permanent removal of one capture or a complete session;
remaining trajectories are recomputed. SQLite is local storage, not cloud backup
or clinician-confirmed records. Supabase and the original R2/D1 history remain separate.

Multipart requests let the browser set Content-Type/boundary. Session requests
time out after 65 seconds; the UI reloads server state before retrying an uncertain
save. Invalid/identity-mismatched success payloads are rejected; unavailable
measurements are null/dashes, never zero estimates.

## Historical visual pipeline

The workflow requests/stores visuals even when Patient Mode hides them. Developer
Mode reopens input, U-Net isolation, tissue overlay and Clinical Brief through the
selected capture. Raw input can always be retrieved separately from the stored image.

Binary U-Net uses supplied weights, CPU/ImageNet normalization, 256×256 input,
sigmoid >0.35 and original-size masks. Single-wound post-processing closes short
gaps, removes detached noise by retaining the dominant component, fills holes and
withholds tiny foreground. The mask panel draws its boundary rather than leaving
users to infer it from transparency. Tissue inference and the learned risk head
receive the isolated crop; tissue percentages count all mask pixels, including
unclassified pixels. These panels are not feature attribution. Missing, malformed,
quality-abstained or unavailable images receive honest placeholders. Current
original-checkpoint API verification confirmed both derived images, original-size
mask restoration and unchanged overlay pixels outside the mask on the synthetic fixture.

## Verification

```bash
npx --yes node@24 --test tests/wound-api.test.ts tests/wound-sessions-api.test.ts tests/wound-presentation.test.ts
outputs/wound-venv/bin/python -B scripts/verify-wound-models.py
outputs/wound-venv/bin/python -B -m unittest discover -s aimedic -p 'test_*.py' -v
pnpm build

# Browser contract QA, frontend required; uses isolated in-memory session fixtures
npx --yes node@24 tests/wound-analyzer-browser.mjs
```

After retrieving `c269a89`, the unchanged **77 Python tests** and
`scripts/verify-wound-models.py` passed with the original materialized checkpoints.
The isolated API verification covers full single-image baseline fusion, two-visit
exact area/tissue deltas, actual pending-image retry, persisted historical pipeline
visuals, exact input bytes, reopening the database and patient-scoped deletion.
The current cleaned sample produced 2,531 wound-mask pixels in one connected region
(granulation 74.6%, slough 18.1%, necrotic 7.2%); changing only the synthetic baseline
changed the learned score while leaving the tissue mask/counts unchanged. This
demonstrates integration and baseline sensitivity, not calibrated risk or clinical
accuracy. The second capture is an explicitly mirrored synthetic fixture; its
differences must not be interpreted as observed healing. No user data was accessed.

Earlier on 12 September, before the checkpoint retrieval, the workflow revision
passed **60 frontend unit tests**, TypeScript, whole-project `pnpm run lint`,
`pnpm build`, and the unchanged **77 Python tests**. Chrome contract
QA passed single/multi-capture persistence, restored server lists without localStorage,
historical pipeline selection, all clinical fields, VI/EN education, missing-model
retry, confirmed deletion, 390px light/dark layouts, annotation cancellation and
same-origin iframe theme synchronization. Browser inference responses use isolated
in-memory fixtures; they are not original-checkpoint validation.

A separate pre-retrieval localhost/SQLite smoke check used an isolated synthetic QA identity:
create/upload/list/reload, exact retained PNG bytes, selected historical brief,
failed pending-model retry without data loss, wrong-patient rejection, origin guard,
visit deletion and session cleanup all passed. The LAN address also returned the
same session API. That run exercised the missing-model path; the actual original-model
checks above now cover successful inference and retry separately.

Historical QA on 2026-09-11 passed 41 frontend tests, TypeScript/build and focused
Chrome checks; Python counts progressed from 30 to 42, 69 and 77 as backend features
were added. Those older runs included supplied-checkpoint visual inference on a
different environment. They remain historical records; the current model retrieval
and isolated API results above are separate evidence. None establish clinical validation
or a new all-pages browser verification.

`tests/wound-analyzer-browser.mjs` now exercises the persistent workflow with
in-memory session fixtures. It verifies UI/API contracts without touching real
SQLite, Supabase or owner data, and does not verify original-checkpoint inference.
`tests/browser.mjs` uses **Lịch sử & ghi nhận** for the preserved R2/D1
capture/save/readback flow.
