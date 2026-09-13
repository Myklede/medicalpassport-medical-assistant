# MediPass — Medical Assistant Demo

Wound backend update (2026-09-11): masked tissue counts, persistent local image sessions, multi-day baseline-aware trajectory rules, risk/uncertainty, and evidence provenance are implemented. Bilingual patient explanations now explain the mechanism, possible consequences, and safe next steps; **77 Python tests passed.** See [trajectory API, runnable example and handoff](https://www.google.com/search?q=docs/WOUND_TRAJECTORY_ENGINE.md). The website uploader supports multi-day wound sessions and renders chronological changes in the research dashboard. Scores are uncalibrated research outputs.

> Quickstart for new AIs/contributors: read [`AGENTS.md`](AGENTS.md), [feature-to-Supabase alignment](https://www.google.com/search?q=docs/PORTAL_AUDIT.md), then [the project vision/whitepaper provided by the project owner](https://www.google.com/search?q=docs/PROJECT_VISION_WHITEPAPER_VI.md).

MediPass is a working demo of a **patient-controlled medical record**: users can view, search, add, edit, and soft-delete medical history; upload private images/PDFs; and generate a concise "Medical Passport" for their next visit.

Private demo: [medipass-medical-assistant-demo.thnguyen7807.chatgpt.site](https://medipass-medical-assistant-demo.thnguyen7807.chatgpt.site)

How to open with Chrome, run locally on a fixed port `3001`, and access from a mobile phone: [`docs/RUN_APP_VI.md`](https://www.google.com/search?q=docs/RUN_APP_VI.md).

> **Mandatory Disclaimer:** This is a research/startup prototype. It is not a medical device, does not provide diagnoses or treatment advice, and has not been declared HIPAA compliant. Use synthetic or de-identified data only.

## What is Currently Running

* Minimalist lobby `/`: select hospital portal, patient view, mobile frame, data, or edit requests before entering a record.
* Hospital portal `/editor`: 5 simulated patients, add/edit general records, and complete visit entries.
* Patient view `/patient`: identical data, read-only, includes plain-language disease and lab test explanations covering impact, monitoring goals, diet/lifestyle, and red-flag symptoms.
* From the selected record in `/editor` or `/patient`, the **Export IPS** button generates a human-readable bilingual PDF and an HL7 International Patient Summary (IPS) 2.0.1 compliant FHIR R4 document Bundle. The first page of the PDF prioritizes patient identification, allergies/conditions/medications, vitals, and plan; subsequent pages detail clinical specifics, provenance, and safe-use notices. The PDF embeds the FHIR JSON Bundle itself. Missing data uses Data Absent Reason/`unavailable` without collapsing empty arrays into "no conditions, allergies, or medications"; exports are always clearly marked as preliminary and uncertified/unsigned by a clinician.
* The portal and UI comments are stored in the Supabase project `gsllxxdewmksjbcnxgvp` via the backend; API keys are never exposed on the client or in Git.
* **UI Annotation** mode: select an area via mouse/touch, pin a comment to a specific patient/visit, and review it at `/feedback`.
* Responsive interface and mobile test frame `/mobile` at 360/390/430 px.
* `/medications` demo compares 20 medication classes across Vietnam, India, the US, and China by standardized active ingredient, strength, dosage form, and Rx/OTC status; always mandates pharmacist/prescriber verification and does not assert automatic therapeutic equivalence.
* `/insurance` securely stores SBC PDFs for user retrieval or download, extracts text, accepts condition/service descriptions, and generates estimates for deductible, copay/coinsurance, network status, prior authorization, plan share, and user share. Results and query history are saved per patient in D1; PDFs reside in R2. Scanned/unreadable PDFs default to simulated coverage profiles and are explicitly labeled.
* Light/Dark mode shared across desktop and mobile; user preference is persisted in the browser.
* Each visit is represented as a card detailing reason for encounter, symptoms, diagnosis/annotations, vital signs, labs, medications, procedures/services, care plan, and practitioner.
* Medical annotations currently cover 5 sample underlying conditions and 6 primary lab tests. The app strictly matches verified terminology, uses reference ranges directly from the lab report, and avoids guessing unknown terms.
* Unified overview dashboard tracking a consistent fictional patient.
* 5 record types: Allergy, Condition, Medication, Lab Result, and Encounter.
* Add, read, edit, and soft-delete records.
* Search and timeline filtering by record type.
* Clinical summary / "Medical Passport".
* Upload PDFs, JPEGs, and PNGs (up to 8 MB) to private object storage, retrievable via an ownership-verified API.
* Data persists across page refreshes.
* Automated synthetic data seeding for every new demo account.
* Server-side ownership verification and audit logs for read/write/upload/download operations.
* Responsive for desktop/mobile, `Cmd/Ctrl + K` keyboard shortcut, and explicit loading/error/empty states.

Wound Lab features local AI trained on simulated imagery, Patient/Developer Mode, a research U-Net segmentation layer, and an isolated image/history storage pipeline. Clinically validated computer vision, pose estimation models, real-time insurance eligibility/EDI, and live medication catalogs remain on the roadmap; Motion Lab currently provides a live camera preview, `/insurance` utilizes a rule-based policy parser, and `/medications` operates on a curated demo dataset.

Guide for pushing commits to GitHub: [`docs/GITHUB_PUSH_GUIDE_VI.md`](https://www.google.com/search?q=docs/GITHUB_PUSH_GUIDE_VI.md).

## Demo Architecture

```text
Browser / mobile PWA
        |
        | HTTPS + authenticated user headers
        v
Vinext / React UI
        |
        | /api/records               /api/files
        v                             v
Cloudflare D1 (SQLite)          Cloudflare R2 (private files)
        |
        +-- app_users
        +-- patients
        +-- patient_memberships
        +-- health_records
        +-- storage_objects
        +-- audit_events

```

The frontend never accesses the database directly. Each request resolves user → membership → patient, appending `patient_id` to every downstream query. This serves as the RLS abstraction layer for the D1 demo.

### Current APIs

| Endpoint | Method | Function |
| --- | --- | --- |
| `/api/records` | GET | Retrieve patient + all non-deleted records |
| `/api/records` | POST | Create a new record |
| `/api/records` | PATCH | Update a record belonging to the current patient |
| `/api/records` | DELETE | Soft-delete a record |
| `/api/files` | POST | Upload a file to R2 and store metadata in D1 |
| `/api/files?id=...` | GET | Retrieve a file after ownership verification |
| `/api/files` | DELETE | Delete object and soft-delete metadata |
| `/api/portal/ips?patient_id=...&format=pdf` | GET | Export IPS PDF following ownership check; PDF embeds FHIR JSON |
| `/api/portal/ips?patient_id=...&format=json` | GET | Export standalone FHIR R4 document Bundle |

Drizzle migrations reside in `drizzle/`. Source schema is located at `db/schema.ts`; idempotent runtime initialization is defined in `db/runtime.ts` to allow immediate local demo execution.

## Supabase Status

The portal is currently connected to Supabase project `gsllxxdewmksjbcnxgvp`. The `mp_*` tables store patients, conditions, allergies, practitioners, encounters, labs, medications, services, audit trails, and UI feedback comments. The backend uses a server secret; the client receives no keys. `/records` data, Wound Lab, and private files partially utilize D1/R2 as outlined in the audit documentation.

Remaining production steps for Supabase:

1. Migrate D1 to PostgreSQL while preserving current relational schemas.
2. Integrate Supabase Auth; configure `patient_memberships` for owner/patient/caregiver roles.
3. Enable RLS across **all** tables containing patient data; enforce policies that verify active membership or explicit access grants.
4. Transition R2 to private Supabase Storage; restrict generation of short-lived signed URLs to the backend.
5. Add `access_grants`, `consents`, and `share_links` featuring token hashing, expiration, scoping, and revocation capabilities.
6. Deconstruct clinical tables into `conditions`, `allergy_intolerances`, `observations`, `diagnostic_reports`, `encounters`, `procedures`, `medication_statements`, and `document_references`.
7. Retain normalized fields for query performance alongside `source_fhir_json JSONB` for imports/exports; avoid flattening the entire schema into a single monolithic JSONB table.
8. Integrate `pgvector` for insurance RAG once document ingestion and search stabilize.

Supabase mandates a signed BAA and a HIPAA/High Compliance configuration when handling PHI; using Supabase **does not automatically** ensure HIPAA compliance. Refer to the [Supabase HIPAA guidance](https://supabase.com/docs/guides/security/hipaa-compliance), [HIPAA projects](https://supabase.com/docs/guides/platform/hipaa-projects), and [Row-Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Recommended Production Data Model

### Identity, Consent, and Sharing

* `app_users`, `patients`, `patient_memberships`
* `organizations`, `practitioners`, `practitioner_roles`
* `access_grants`, `share_links`, `consents`
* `resource_provenance`, append-only `audit_events`

QR code shares should carry only an opaque, single-use token; the database stores solely the token hash. Tokens must be read-only, scoped, short-lived, and revokable. Never embed names, patient IDs, or PHI directly in the QR code.

### Clinical Records

* `encounters`
* `conditions`
* `allergy_intolerances`
* `observations` + `observation_components`
* `diagnostic_reports` + links to observations
* `procedures`
* `medication_statements`
* `storage_objects` + `document_references`
* `insurance_coverages` + `insurance_benefits`

Medical codes are stored as a triad of `code_system`, `code`, and `display`: ICD-10-CM, SNOMED CT, LOINC, RxNorm, and UCUM. The UI does not require non-clinical users to enter codes directly; codes reside in Advanced Details or are resolved during import mapping.

FHIR is a data exchange standard, not a security protocol. The demo implements preliminary export aligned with [International Patient Summary 2.0.1](https://hl7.org/fhir/uv/ips/en/): a `document`-type Bundle led by a Composition resource, Patient, and the three mandatory sections: Problem List, Allergies/Intolerances, and Medication Summary; empty sections apply `emptyReason=unavailable`. Eight synthetic test fixtures achieved 0 errors/0 warnings using the HL7 FHIR Validator 6.9.12, FHIR R4 4.0.1, IPS 2.0.1 package, and `tx.fhir.org`; this confirms fixture profile conformance, not product certification or clinician attestation. Ingestion, independent consumer validation, and live hospital EHR integration still necessitate SMART/OAuth, consent management, patient matching, terminology normalization, and formal integration agreements. Reference: [FHIR overview](https://hl7.org/fhir/overview.html), [US Core](https://www.hl7.org/fhir/us/core/), and [FHIR security](https://hl7.org/fhir/R4/security.html).

## Four-Pillar Feature Roadmap

### 1. Medical Passport and Record Synchronization

**Next MVP**

* Patient profile, caregiver membership, consent management, and time-limited share links.
* **Implemented in demo:** FHIR IPS document Bundle export + PDF with embedded JSON; eight adverse test fixtures validated by HL7 Validator. Next production milestones include automated release gates, independent consumer integration testing, clinician digital signatures/attestations, import pipelines, and granular provenance tracking.
* Clear provenance labeling: self-reported, provider document, imported, verified.
* Medication reconciliation and dedicated clinician view.
* No automated clinical diagnoses; all critical alerts require a validated clinical rules engine.

### 2. Insurance Policy Checker

**Implemented in demo:** `/insurance` uploads SBC PDFs to R2, persists metadata/parsing results in D1, supports document selection and download, parses text via an in-Worker PDF engine, and calculates cost-sharing estimates based on described services and network status. Parsed citations retain page-level provenance; unreadable tables trigger explicit warnings of simulated data usage. Real-time deductible accumulators, negotiated allowed amounts, CPT/HCPCS crosswalks, eligibility (270/271), and claims processing are not yet integrated live.

Target pipeline:

```text
Private PDF upload
  -> malware/file validation
  -> PDF text + table extraction
  -> section-aware chunking
  -> embedding
  -> vector retrieval
  -> answer with page/section citation + uncertainty

```

MVP scope covers deductible, out-of-pocket maximum, copay, coinsurance, network limits, formulary tiering, visit caps, and prior authorizations. Responses must cite page/section numbers and explicitly state that estimates do not constitute a formal coverage determination. CMS guidelines on SBC documents: [Summary of Benefits and Coverage](https://www.cms.gov/marketplace/health-plans-issuers/summary-benefits-coverage).

### 3A. Wound Monitoring / UB Research

To align with UB's Precision Wound Care initiative, avoid early claims of "infection diagnosis." Instead, construct a **longitudinal capture + annotation pipeline**:

```text
wound_case
  -> wound_visit / assessment at t0, t1, t2...
  -> media asset (RGB first; modality + device + capture protocol + calibration)
  -> clinician annotation / segmentation mask
  -> area and tissue measurements
  -> healing trajectory for research review

```

Initial AI milestone: wound margin segmentation and surface area trajectory; progressing sequentially to tissue classification, multimodal fusion, and predictive forecasting. Model inferences reside in `ai_inferences` without overwriting verified clinician records. Training imagery requires dedicated study consent, patient-level data splits, versioned datasets, and external multi-center validation.

The UB initiative emphasizes multimodal sensing, objective metrics, early deterioration detection, and predictive/preventive wound healing: [Precision Wound Care opportunity](https://www.buffalo.edu/undergrad-research/opportunities.host.html/content/shared/www/undergrad-research/research-opportunities/precision-wound-care-collaborative-ai-powered-multimodal-monitoring-for-predictive-preventive-healing.detail.html).

### 3B. Physical Therapy Pose Tracking

* MediaPipe Pose/TensorFlow.js running client-side in the browser.
* Joint angle calculation derived from hip–knee–ankle or shoulder–elbow–wrist coordinates.
* Finite-state machine for rep counting; exercise-specific heuristics to flag form deviation.
* Store reps, range of motion (ROM), session aggregates, and form anomalies; **do not store raw video streams by default**.
* If video retention is required, implement explicit consent protocols, retention lifecycle policies, encrypted private storage, and clinician-only access tiers.

### 4. Cross-Border Medication Reconciliation

Target pipeline:

```text
Prescription / label OCR
  -> extract ingredient + strength + dose form + route
  -> WHO INN normalization
  -> country-specific regulatory catalog
  -> U.S. RxNorm/NDC mapping
  -> candidate match
  -> pharmacist verification

```

The UI must explicitly display: "candidate matching ingredients/strength/form — pharmacist verification required"; avoid labeling items as "equivalent substitutes" solely on the basis of shared active ingredients. [WHO INN](https://www.who.int/teams/health-product-and-policy-standards/inn/) provides the global baseline; [RxNorm](https://www.nlm.nih.gov/research/umls/rxnorm/overview.html) handles standard US drug mapping.

Note: RxNav deprecated its drug–drug interaction (DDI) API endpoint on 2024-01-02; do not design new DDI pipelines against that service. See the [RxNav FAQ](https://lhncbc.nlm.nih.gov/RxNav/information/FAQs.html).

## Minimum Production Infrastructure

| Layer | Recommended Architecture |
| --- | --- |
| Web/PWA | Next.js/React, TypeScript, Tailwind CSS |
| Auth + Relational DB | Supabase Auth + PostgreSQL + RLS |
| File Storage | Private Supabase Storage or Cloudflare R2 |
| Interoperability / FHIR | FHIR R4/US Core mapping + IPS export; HAPI FHIR for complex integrations |
| AI / Inference APIs | Python FastAPI, isolated container runtime, async task queue |
| Insurance RAG | PDF parser, structured chunking, vector embeddings, pgvector/Vectorize, attributed outputs |
| Computer Vision Research | PyTorch, experiment tracking (MLflow/W&B), dataset/model versioning, clinician-in-the-loop validation |
| Pose Estimation | On-device MediaPipe Pose / TensorFlow.js |
| Observability | Structured PHI-redacted logs, error tracing, performance metrics, immutable audit trails |
| Security & Compliance | TLS termination, secret managers, MFA, least-privilege RBAC, encryption at rest/in transit, automated backups/PITR, incident response runbooks |
| CI/CD & Delivery | Segregated dev/staging/prod environments, automated migrations, CI test suites, IaC, vulnerability/dependency scanning |

Never ingest production relational databases containing identifiers directly into model training datasets. Build dedicated de-identification pipelines, consent tracking, and isolated dataset snapshots. HHS details both HIPAA de-identification pathways in the [HHS De-identification Guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html). Non-covered consumer health applications remain subject to the [FTC Health Breach Notification Rule](https://www.ftc.gov/business-guidance/resources/health-breach-notification-rule-basics-business).

## Realistic Implementation Sequence

1. **Completed:** Responsive frontend, database schema, private file storage, per-user ownership enforcement, CRUD operations, timeline, search/filter, synthetic demo seeding.
2. Supabase production schema + RLS test harness + consent/sharing/audit frameworks.
3. Upgrade the demo FHIR/IPS export into a validated and cryptographically signed pipeline; add import functionality and clinician read-only access.
4. **Demo implemented:** Insurance PDF ingestion + clause extraction/citation + cost estimation history; next production stage requires section-level vector retrieval, EDI 270/271 integration, CPT/HCPCS crosswalks, and live eligibility/claim checks.
5. Wound longitudinal data collection and labeling pipeline; secure IRB approval and research consent prior to acquiring real patient data.
6. Wound segmentation model training and research validation; strictly omit diagnostic claims.
7. Client-side physical therapy pose estimation proof of concept.
8. Active ingredient normalization and cross-border drug catalog mappings; build pharmacist review workflows.
9. Formal clinical safety, data privacy, cybersecurity, and regulatory compliance audits prior to clinical pilot deployment.

## Running Locally

Prerequisites: Node.js `>=22.13` and pnpm.

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm run demo

```

Open `http://localhost:3001/editor`. Compatible with Chrome, Edge, Safari, or mobile browsers; the server operates independently of the browser environment. For detailed setup instructions, see [`docs/RUN_APP_VI.md`](https://www.google.com/search?q=docs/RUN_APP_VI.md).

Validate build and schema:

```bash
pnpm run db:generate
pnpm run build
pnpm run lint

```

## 90-Second Demo Pitch Flow

1. Open Overview; highlight the Penicillin allergy and active medical conditions immediately.
2. Navigate to the Medical Passport to show the consolidated cross-provider summary.
3. Go to Medical Records; search `Hemoglobin`, filter by Lab Results.
4. Add a synthetic lab result and attach a mock PDF/image.
5. Refresh the page: demonstrate data persistence; reopen the attachment.
6. Edit the record, then soft-delete it; explain the audit trail and ownership validation logic.
7. Open `/insurance`, select a saved SBC, input an in-network MRI scenario, and highlight the estimated plan/patient cost shares, prior authorization requirements, and source citations.

## Wound Lab and Motion Lab Current Status

* `/wounds` and `/wound-analyzer` share a unified AI interface: **Patient Mode** isolates a sample profile, presenting simple image uploads and plain-language summaries; **Developer Mode** exposes 5 synthetic test profiles, clinical background parameters, and a 4-step diagnostic grid (original image, U-Net mask, tissue overlay, fused multimodal output). Toggle Developer Mode → **Sample Image & Profile** → **Analyze Image** to dispatch requests to the live local FastAPI backend at `127.0.0.1:8000`.
* Tissue segmentation utilizes the U-Net/ResNet34 checkpoint provided at `outputs/wound_unet_fusd.pt` (CPU runtime, ImageNet backbone, 256×256, sigmoid threshold >0.35). A standalone synthetic tissue heuristic recolors areas within the generated mask; inferences return mapped to the original image dimensions. These visualizations represent standalone segmented regions rather than feature-attribution maps or intermediate activations of the late-fusion model. Missing auxiliary weights will not interrupt Clinical Brief generation; refer to `aimedic/README.md` to distinguish between the checkpoints.
* `/wounds/history` retains the legacy capture/upload pipeline, strips EXIF data via in-browser canvas re-encoding, writes securely to private R2 storage, and groups evaluations under distinct `wound_case` entities. The **History & Records** entry point is accessible directly within the AI dashboard.
* The history safety review pipeline relies exclusively on self-reported patient symptoms and documented diagnoses/medications. Standalone AI predictions stem from synthetic training benchmarks, lack clinical validation, and are not automatically committed to medical records.
* Three new D1 tables: `wound_cases`, `wound_assessments`, and `ai_inferences`. The `ai_inferences` table is reserved for production model inferences and enforces human-in-the-loop review by default.
* `/therapy` provides a client-side device camera scaffold; raw video streams are neither recorded nor uploaded. Rep counts, range of motion metrics, and form deviation indicators remain mock placeholders pending integration with a validated pose model.
* Model training and data preprocessing code reside in `aimedic/`; generated model weights and synthesized datasets are stored in `outputs/` (ignored by Git). The browser client executes inference only, never local training. The legacy storage contract in `lib/vision/` remains separate from the Python API Clinical Brief schema.

For in-depth architectural details, safety guardrails, and GitHub collaboration guidelines, refer to [`docs/WOUND_RESEARCH_ARCHITECTURE.md`](https://www.google.com/search?q=docs/WOUND_RESEARCH_ARCHITECTURE.md).

The standalone Python research codebase in [`aimedic/`](https://www.google.com/search?q=aimedic/README.md) includes all four required scripts: generating 1,000 synthetic patient profiles, multimodal image + demographic feature modeling, PyTorch training pipelines, and longitudinal tissue change tracking to export JSON reports for investigator review. Model training, checkpoint restoration, and evaluation suites have executed successfully; these metrics reflect synthetic data baselines, not clinical diagnostic performance. Wound Lab currently queries the model via the local Python API; single-image inputs generate point-in-time estimates without populating historical trends or asserting wound healing/deterioration trajectories.

**Running the latest updates:** refer to [`docs/WOUND_AI_INTEGRATION.md`](https://www.google.com/search?q=docs/WOUND_AI_INTEGRATION.md).
Both the frontend server on port **3001** and the Python service on port **8000** must run concurrently on the same host machine.
