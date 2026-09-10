# MediPass: context for coding agents

Read these files before changing the project:

1. `README.md` — current product, routes, setup and verification.
2. `docs/PORTAL_AUDIT.md` — implemented portal behavior and evidence from QA.
3. `docs/PROJECT_VISION_WHITEPAPER_VI.md` — founder-provided vision, roadmap and due-diligence context. Treat it as product context, not as proof that every claim is implemented or legally verified.
4. `docs/WOUND_RESEARCH_ARCHITECTURE.md` — wound research boundaries.

## Current implementation

- `/editor` is the hospital portal. It can add/edit five seeded patients and complete encounter cards.
- `/patient` is a read-only patient view of the same portal data.
- `/feedback` lists visual review comments. The global **Chú thích giao diện** mode lets the owner click a real UI region, save an anchored comment and reopen it later.
- `/mobile` is an interactive responsive web preview at 360/390/430 px. It is not a native iOS/Android app.
- A persistent light/dark switch is rendered by the root layout on every route. It stores `medipass-theme` in browser local storage and synchronizes same-origin desktop/phone-preview contexts.
- `/data` explains and displays the portal data structure.
- `/records` is the older medical-record module.
- `/wounds` stores longitudinal wound captures and rule-based safety review. It does not analyze image pixels with an AI model.
- `/therapy` has local camera preview only. Pose estimation and rep counting are not connected.

## Persistence and security boundaries

- The hospital portal, patient view and visual comments use Supabase project ref `gsllxxdewmksjbcnxgvp` through server-only RPCs and normalized `mp_*` tables.
- Never commit or print `SUPABASE_SECRET_KEY`. Local secrets belong in `.env.local`; hosted secrets belong in the Sites runtime.
- Legacy `/records` data is mirrored to `medipass_*` Supabase tables when configured. Private files, wound images and wound metadata still use Cloudflare R2/D1.
- Portal views refresh after a same-browser save and poll every five seconds while visible for changes made on another device. This is not a Supabase Realtime/WebSocket subscription.
- Use synthetic or de-identified data only. The demo is not a medical device and has not been established as HIPAA compliant.

## Important implementation choices

- Use `@/components/app-link` for app navigation. `next/link` caused broken client navigation in the deployed Vinext build.
- Stable visual-comment targets use `data-annotate`, `data-annotation-label` and, for visit cards, `data-encounter-id`.
- Shared conditions and allergies live on the patient; labs, medications, procedures, plan and clinician snapshot live on an encounter.
- Patient selection is kept in the `?patient=` query parameter across hospital, patient and mobile views.
- Do not silently fall back and claim a Supabase save. The UI must show the active storage provider.

## Verification

Use Node.js 22.13 or newer. Before a GitHub push, run:

```powershell
npx --yes node@24 scripts/pre-push-check.mjs
```

For a stable local demo URL, run `pnpm run demo` and use `http://localhost:3001/editor`. See `docs/RUN_APP_VI.md` for Chrome and same-Wi-Fi phone access.

Focused light/dark QA uses `tests/theme-browser.mjs` against the local dev server and does not mutate medical data. Full browser QA additionally needs the local Playwright package under ignored `outputs/qa/node_modules`; set `MEDIPASS_TEST_PRODUCTION=1` only when targeting a production-style local Worker. For remote storage verification, also set `MEDIPASS_VERIFY_SUPABASE=1`. The remote QA identity is isolated and its fixtures are deleted by the test; never point the helper at an owner workspace.

The intended GitHub remote is `https://github.com/Myklede/medipass-medical-assistant-demo.git`. Do not push or deploy unless the user asks. GitHub push and Sites deployment are separate operations.
