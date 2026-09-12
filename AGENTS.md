# MediPass: context for coding agents

Read these files before changing the project:

1. `README.md` — current product, routes, setup and verification.
2. `docs/PORTAL_AUDIT.md` — implemented portal behavior and evidence from QA.
3. `docs/PROJECT_VISION_WHITEPAPER_VI.md` — founder-provided vision, roadmap and due-diligence context. Treat it as product context, not as proof that every claim is implemented or legally verified.
4. `docs/WOUND_RESEARCH_ARCHITECTURE.md` — wound research boundaries.

## Current implementation

- `/` is a minimal lobby. It gives explicit entry points to the hospital portal, patient view, mobile preview, Supabase explorer and visual-feedback list; it does not open a patient record immediately.
- `/editor` is the hospital portal. It can add/edit five seeded patients and complete encounter cards.
- `/patient` is a read-only patient view of the same portal data. Known sample conditions and labs include reviewed plain-language summaries, impact, monitoring context and food/lifestyle guidance.
- The selected portal patient can be exported from `/editor` or `/patient` as a preliminary IPS 2.0.1 FHIR R4 document Bundle or as a bilingual PDF containing that JSON Bundle as an attachment. Eight synthetic fixtures pass the configured HL7 Validator gate; the export is not product-certified, digitally signed or clinician-attested.
- `/feedback` lists visual review comments. The global **Chú thích giao diện** mode lets the owner click a real UI region, save an anchored comment and reopen it later.
- `/mobile` is an interactive responsive web preview at 360/390/430 px. It is not a native iOS/Android app.
- A persistent light/dark switch is rendered by the root layout on every route. It stores `medipass-theme` in browser local storage and synchronizes same-origin desktop/phone-preview contexts.
- `/data` explains and displays the portal data structure.
- `/records` is the older medical-record module.
- `/insurance` is a working SBC policy-checker demo. It stores private PDFs in R2, document metadata and saved analyses in patient-scoped D1 tables, lets a user reuse/download an uploaded SBC, extracts searchable PDF text, and estimates in-network/out-of-network cost sharing for the described service. Source citations are shown when extraction succeeds; unreadable/scanned PDFs are explicitly labeled as using a synthetic fallback profile. Results are estimates, not coverage determinations, live eligibility checks, claims, or final bills.
- `/medications` is a curated 20-item, four-country medication-name comparison demo. It matches candidate products by active ingredient and surfaces strength/form, Rx/OTC and excipient-review differences; it never claims automatic therapeutic substitution.
- `/wounds` and `/wound-analyzer` share the local AI analyzer. **Patient Mode** defaults to fixed `PATIENT_MODE_PROFILE` (simulated sign-in), upload and friendly summary only. **Developer Mode** selects from five immutable profiles in `lib/wound-patients.ts`, requests `include_pipeline_visuals=true`, and shows input/U-Net isolation/tissue overlay/fused baseline panels. Mode/profile changes clear the old upload/result. This UI mode is not real authentication or a Supabase patient connection.
- `aimedic/visual_pipeline.py` loads supplied binary weights `outputs/wound_unet_fusd.pt` through SMP U-Net/ResNet34 on CPU (ImageNet normalization, 256×256, sigmoid >0.35, original-size mask). Tissue inference now receives only the masked crop; percentages count all wound-mask pixels, including an explicit unclassified fraction. The API brief uses those counts. The learned risk head receives the isolated crop; architecture/training are unchanged. Overrides: `MEDIPASS_VISUAL_MODEL_PATH` (binary), `MEDIPASS_TISSUE_MODEL_PATH` (tissue). Missing weights/quality failures withhold unavailable estimates. These visuals are not feature attribution.
- `aimedic/trajectory_rules.py` adds baseline-aware multi-day rules, latest cm²/pixel/tissue deltas, stagnation, conditional clinician-reported scab context, uncalibrated risk/uncertainty and evidence provenance. `patient_explanations.py` adds English/Vietnamese explanation, mechanism, consequence and next-step sections at `patient_explanation.locales.en/vi`. Existing string fields now use plain English; technical wording is preserved in `clinician_context_analysis` and `clinician_recommendation`. No image-only benign-scab diagnosis or inferred anaerobic infection. All 77 Python tests passed. Read `docs/WOUND_TRAJECTORY_ENGINE.md` for contracts, example requests, UI consumption limits and sources.
- `/wounds/history` preserves the original longitudinal captures, private R2/D1 storage and reported-data safety review. This storage flow is independent of AI inference; AI briefs are not saved to Supabase, D1 or clinician records.
- `/therapy` has local camera preview only. Pose estimation and rep counting are not connected.
- `aimedic/` contains the four-script synthetic PyTorch wound pipeline: generator, late-fusion model, training and JSON tracker. Read `aimedic/README.md` before modifying it. Model outputs and baseline-dependent rules are research demonstrations, not validated on clinical images. Training runs via Python CLI, not in the browser. Run `python -B -m unittest discover -s aimedic -p test_pipeline.py -v` in an environment with its requirements installed.
- `aimedic/main.py` provides stateless `POST /api/analyze-wound`, JSON `POST /api/analyze-trajectory`, and persistent `/api/wound-sessions` routes. Sessions store images/measurements atomically in ignored `outputs/wound-sessions.sqlite3` (local SQLite, not Supabase). Baselines are fixed; days/timestamps must increase; duplicate images are rejected. Optional image scale supplies projected cm². The web uploader still uses the stateless endpoint; a multi-day session-selector UI remains to be wired to `lib/wound-sessions-api.ts`. CORS allows local ports 3000/3001; Python defaults to 127.0.0.1:8000. Both services must run on the browser's computer; a phone or hosted page cannot reach the laptop through loopback. See `docs/WOUND_TRAJECTORY_ENGINE.md` and `docs/WOUND_AI_INTEGRATION.md`.

## Persistence and security boundaries

- The hospital portal, patient view and visual comments use Supabase project ref `gsllxxdewmksjbcnxgvp` through server-only RPCs and normalized `mp_*` tables.
- Never commit or print `SUPABASE_SECRET_KEY`. Local secrets belong in `.env.local`; hosted secrets belong in the Sites runtime.
- Legacy `/records` data is mirrored to `medipass_*` Supabase tables when configured. Private files, insurance SBCs/analyses, wound images and wound metadata still use Cloudflare R2/D1.
- Portal views refresh after a same-browser save and poll every five seconds while visible for changes made on another device. This is not a Supabase Realtime/WebSocket subscription.
- Use synthetic or de-identified data only. The demo is not a medical device and has not been established as HIPAA compliant.

## Important implementation choices

- Use `@/components/app-link` for app navigation. `next/link` caused broken client navigation in the deployed Vinext build.
- Stable visual-comment targets use `data-annotate`, `data-annotation-label` and, for visit cards, `data-encounter-id`.
- Shared conditions and allergies live on the patient; labs, medications, procedures, plan and clinician snapshot live on an encounter.
- Condition education is an exact alias lookup in `lib/patient-education.ts`. Lab education is in `lib/lab-interpretation.ts`. Add medical content only with an authoritative source, never infer an explanation for an unknown label, and continue using the reference range supplied by the lab record.
- Patient selection is kept in the `?patient=` query parameter across hospital, patient and mobile views.
- Do not silently fall back and claim a Supabase save. The UI must show the active storage provider.

## Verification

Use Node.js 22.13 or newer. Before a GitHub push, run:

```powershell
npx --yes node@24 scripts/pre-push-check.mjs
```

For a stable local demo URL, run `pnpm run demo` and use `http://localhost:3001/editor`. See `docs/RUN_APP_VI.md` for Chrome and same-Wi-Fi phone access.

Focused lobby, patient-education and light/dark QA uses `tests/theme-browser.mjs` against the local dev server and does not mutate medical data. Full browser QA additionally needs the local Playwright package under ignored `outputs/qa/node_modules`; local development uses its own fresh sign-in context. Set `MEDIPASS_TEST_PRODUCTION=1` only when targeting a production-style local Worker. For remote storage verification, also set `MEDIPASS_VERIFY_SUPABASE=1`; that path sends the isolated `browser-qa` identity and deletes its remote fixtures. Never point the helper at an owner workspace.

The intended GitHub remote is `https://github.com/Myklede/medipass-medical-assistant-demo.git`. Do not push or deploy unless the user asks. GitHub push and Sites deployment are separate operations.
