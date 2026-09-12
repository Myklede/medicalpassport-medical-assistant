# MediPass — Medical Assistant demo

Wound backend update (2026-09-11): masked tissue counts, persistent local image
sessions, multi-day baseline-aware trajectory rules, risk/uncertainty and evidence
provenance are implemented. Bilingual patient explanations now explain the mechanism,
possible consequences and safe next steps; **77 Python tests passed.** See
[trajectory API, runnable example and handoff](docs/WOUND_TRAJECTORY_ENGINE.md).
The website uploader remains single-image; multi-day sessions can be exercised at
`http://127.0.0.1:8000/docs`. Scores are uncalibrated research outputs.

> Bắt đầu cho AI/cộng tác viên mới: đọc [`AGENTS.md`](AGENTS.md), [đối chiếu tính năng và Supabase](docs/PORTAL_AUDIT.md), rồi [tầm nhìn/whitepaper do chủ dự án cung cấp](docs/PROJECT_VISION_WHITEPAPER_VI.md).


MediPass là bản demo hoạt động được của một **patient-controlled medical record**: người dùng xem, tìm, thêm, sửa và soft-delete lịch sử y tế; tải ảnh/PDF riêng tư; và tạo một “Medical Passport” cô đọng cho lần khám tiếp theo.

Private demo: [medipass-medical-assistant-demo.thnguyen7807.chatgpt.site](https://medipass-medical-assistant-demo.thnguyen7807.chatgpt.site)

Cách mở bằng Chrome, chạy local ở cổng cố định `3001` và truy cập từ điện thoại: [`docs/RUN_APP_VI.md`](docs/RUN_APP_VI.md).

> **Giới hạn bắt buộc:** đây là research/startup prototype, không phải thiết bị y tế, không chẩn đoán, không tư vấn điều trị và chưa được tuyên bố HIPAA compliant. Chỉ dùng dữ liệu giả hoặc đã de-identify.

## Những gì đang chạy

- Trang sảnh tối giản `/`: chọn cổng bệnh viện, góc nhìn bệnh nhân, khung điện thoại, dữ liệu hoặc yêu cầu chỉnh sửa trước khi vào hồ sơ.
- Cổng bệnh viện `/editor`: 5 bệnh nhân giả lập, thêm/sửa hồ sơ chung và từng lần khám đầy đủ.
- Góc nhìn bệnh nhân `/patient`: cùng dữ liệu, chỉ đọc, có giải thích bệnh và xét nghiệm bằng lời dễ hiểu, gồm ảnh hưởng, mục tiêu theo dõi, ăn uống/sinh hoạt và dấu hiệu cần chú ý.
- Từ hồ sơ đang chọn ở `/editor` hoặc `/patient`, nút **Xuất IPS** tạo PDF song ngữ dễ đọc và FHIR R4 document Bundle theo HL7 International Patient Summary 2.0.1. PDF dùng trang đầu ưu tiên nhận diện người bệnh, dị ứng/bệnh/thuốc, sinh hiệu và kế hoạch; các trang sau trình bày chi tiết lâm sàng, provenance và lưu ý sử dụng an toàn. PDF đính kèm chính JSON Bundle. Dữ liệu thiếu dùng Data Absent Reason/`unavailable`, không biến mảng rỗng thành “không có bệnh, dị ứng hay thuốc”; bản xuất luôn ghi rõ sơ bộ và chưa được clinician ký/xác nhận.
- Portal và bình luận giao diện được lưu trong Supabase project `gsllxxdewmksjbcnxgvp` qua backend; khóa không xuất hiện ở client hoặc Git.
- Chế độ **Chú thích giao diện**: chọn vùng bằng chuột/chạm, ghim comment vào đúng bệnh nhân/lần khám và mở lại ở `/feedback`.
- Giao diện responsive và khung thử điện thoại `/mobile` ở 360/390/430 px.
- Demo `/medications` đối chiếu 20 nhóm thuốc giữa Việt Nam, Ấn Độ, Mỹ và Trung Quốc theo hoạt chất chuẩn, hàm lượng, dạng dùng và Rx/OTC; luôn yêu cầu pharmacist/người kê đơn xác nhận và không tuyên bố tự động tương đương điều trị.
- `/insurance` lưu SBC PDF riêng tư để người dùng chọn lại hoặc tải xuống, trích xuất văn bản, nhận mô tả tình trạng/dịch vụ và tạo ước tính deductible, copay/coinsurance, network, prior authorization, phần plan trả và phần người dùng trả. Kết quả cùng lịch sử được lưu theo patient trong D1; PDF nằm trong R2. PDF scan/không đọc được chỉ dùng hồ sơ quyền lợi mô phỏng và được gắn nhãn rõ.
- Chế độ Sáng/Tối dùng chung cho desktop và điện thoại; lựa chọn được lưu trong trình duyệt.
- Mỗi lần khám là một card gồm lý do, triệu chứng, chẩn đoán/chú giải, vital signs, labs, thuốc, dịch vụ, kế hoạch và bác sĩ.
- Chú giải y khoa hiện bao phủ 5 bệnh nền mẫu và 6 xét nghiệm chính. App chỉ ghép đúng thuật ngữ đã được kiểm duyệt, dùng khoảng tham chiếu trên chính phiếu xét nghiệm và không tự đoán thuật ngữ lạ.
- Dashboard tổng quan theo một bệnh nhân hư cấu thống nhất.
- 5 loại hồ sơ: Allergy, Condition, Medication, Lab Result và Encounter.
- Thêm, đọc, sửa và soft-delete dữ liệu.
- Tìm kiếm và lọc timeline theo loại hồ sơ.
- Clinical summary / “Medical Passport”.
- Upload PDF, JPEG, PNG tối đa 8 MB vào private object storage và mở lại qua API có ownership check.
- Dữ liệu tồn tại sau khi refresh.
- Seed dữ liệu giả tự động cho mỗi tài khoản demo mới.
- Ownership check phía server và audit log cho read/write/upload/download.
- Responsive cho desktop/mobile, keyboard shortcut `Cmd/Ctrl + K`, loading/error/empty states.

Wound Lab có AI cục bộ học từ ảnh giả lập, Patient/Developer Mode, lớp phân vùng U-Net nghiên cứu và luồng lưu ảnh/lịch sử riêng. Computer Vision đã xác nhận lâm sàng, pose model, insurance eligibility/EDI thời gian thực và catalog thuốc thời gian thực vẫn là roadmap; Motion Lab hiện có camera preview, `/insurance` dùng bộ phân tích điều khoản có quy tắc và `/medications` dùng bộ dữ liệu demo có tuyển chọn.

Hướng dẫn để tự đưa các commit lên GitHub: [`docs/GITHUB_PUSH_GUIDE_VI.md`](docs/GITHUB_PUSH_GUIDE_VI.md).

## Kiến trúc bản demo

```text
Browser / mobile PWA
        |
        | HTTPS + authenticated user headers
        v
Vinext / React UI
        |
        | /api/records             /api/files
        v                              v
Cloudflare D1 (SQLite)          Cloudflare R2 (private files)
        |
        +-- app_users
        +-- patients
        +-- patient_memberships
        +-- health_records
        +-- storage_objects
        +-- audit_events
```

Frontend không được truy cập database trực tiếp. Mỗi request resolve người dùng → membership → patient, rồi mọi query đều kèm `patient_id`. Đây là lớp thay thế RLS ở bản D1 demo.

### API hiện tại

| Endpoint | Method | Chức năng |
| --- | --- | --- |
| `/api/records` | GET | Lấy patient + toàn bộ hồ sơ chưa bị xóa |
| `/api/records` | POST | Tạo bản ghi mới |
| `/api/records` | PATCH | Sửa bản ghi thuộc patient hiện tại |
| `/api/records` | DELETE | Soft-delete bản ghi |
| `/api/files` | POST | Upload tệp vào R2 và lưu metadata vào D1 |
| `/api/files?id=...` | GET | Mở tệp sau khi kiểm tra quyền sở hữu |
| `/api/files` | DELETE | Xóa object và soft-delete metadata |
| `/api/portal/ips?patient_id=...&format=pdf` | GET | Xuất PDF IPS sau ownership check; PDF chứa FHIR JSON attachment |
| `/api/portal/ips?patient_id=...&format=json` | GET | Xuất riêng FHIR R4 document Bundle |

Migration Drizzle nằm trong `drizzle/`. Schema nguồn nằm trong `db/schema.ts`; runtime initialization idempotent nằm trong `db/runtime.ts` để local demo có thể chạy ngay.

## Trạng thái Supabase

Portal hiện đã kết nối Supabase project `gsllxxdewmksjbcnxgvp`. Các bảng `mp_*` lưu bệnh nhân, bệnh nền, dị ứng, bác sĩ, lần khám, labs, thuốc, dịch vụ, audit và comment giao diện. Backend dùng server secret; client không nhận key. Dữ liệu `/records`, Wound Lab và file riêng tư vẫn có phần dùng D1/R2 như mô tả trong tài liệu audit.

Các bước production còn lại cho Supabase:

1. Đổi D1 thành PostgreSQL và giữ các bảng quan hệ hiện có.
2. Dùng Supabase Auth; tạo `patient_memberships` cho owner/patient/caregiver.
3. Bật RLS trên **mọi** bảng có patient data; policy phải kiểm tra active membership hoặc access grant.
4. Chuyển R2 sang private Supabase Storage; chỉ backend tạo signed URL ngắn hạn.
5. Thêm `access_grants`, `consents`, `share_links` với token hash, expiry, scope và revoke.
6. Tách bảng lâm sàng thành `conditions`, `allergy_intolerances`, `observations`, `diagnostic_reports`, `encounters`, `procedures`, `medication_statements`, `document_references`.
7. Giữ trường chuẩn hóa để query nhanh và `source_fhir_json JSONB` để import/export; không biến toàn bộ database thành một bảng JSONB lớn.
8. Thêm `pgvector` cho insurance RAG sau khi upload/search hồ sơ đã ổn định.

Supabase yêu cầu signed BAA và cấu hình HIPAA/High Compliance nếu xử lý PHI; dùng Supabase **không tự động** làm app compliant. Xem [Supabase HIPAA guidance](https://supabase.com/docs/guides/security/hipaa-compliance), [HIPAA projects](https://supabase.com/docs/guides/platform/hipaa-projects) và [Row-Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Data model production nên có

### Identity, consent và chia sẻ

- `app_users`, `patients`, `patient_memberships`
- `organizations`, `practitioners`, `practitioner_roles`
- `access_grants`, `share_links`, `consents`
- `resource_provenance`, append-only `audit_events`

QR share chỉ chứa opaque one-time token; database chỉ lưu token hash. Token phải read-only theo scope, hết hạn nhanh và revoke được. Không nhúng tên, patient ID hay PHI vào QR.

### Hồ sơ lâm sàng

- `encounters`
- `conditions`
- `allergy_intolerances`
- `observations` + `observation_components`
- `diagnostic_reports` + links tới observations
- `procedures`
- `medication_statements`
- `storage_objects` + `document_references`
- `insurance_coverages` + `insurance_benefits`

Mã y khoa lưu bộ ba `code_system`, `code`, `display`: ICD-10-CM, SNOMED CT, LOINC, RxNorm và UCUM. UI không bắt người dùng phổ thông nhập code; code nằm trong Advanced details hoặc được map khi import.

FHIR là chuẩn trao đổi, không phải security protocol. Demo đã có export sơ bộ theo [International Patient Summary 2.0.1](https://hl7.org/fhir/uv/ips/en/): Bundle dạng `document`, Composition đứng đầu, Patient và ba section bắt buộc Problem List, Allergies/Intolerances, Medication Summary; section trống dùng `emptyReason=unavailable`. Tám fixture tổng hợp đã đạt 0 error/0 warning với HL7 FHIR Validator 6.9.12, FHIR R4 4.0.1, package IPS 2.0.1 và `tx.fhir.org`; đây là kiểm định profile của fixture, không phải chứng nhận sản phẩm hay clinician attestation. Import, kiểm thử với hệ thống nhận độc lập và đồng bộ bệnh viện thật vẫn cần SMART/OAuth, consent, patient matching, terminology mapping và thỏa thuận tích hợp. Tham khảo [FHIR overview](https://hl7.org/fhir/overview.html), [US Core](https://www.hl7.org/fhir/us/core/) và [FHIR security](https://hl7.org/fhir/R4/security.html).

## Roadmap bốn nhóm tính năng

### 1. Medical Passport và đồng bộ hồ sơ

**MVP kế tiếp**

- Patient profile, caregiver membership, consent và time-limited share link.
- **Đã có bản demo:** FHIR IPS document Bundle export + PDF có JSON đính kèm; tám fixture bất lợi đã qua HL7 Validator. Bước production tiếp theo là release gate tự động, kiểm thử với consumer độc lập, clinician attestation/signature, import và provenance chi tiết.
- Provenance hiển thị rõ: self-reported, provider document, imported, verified.
- Medication reconciliation và clinician view riêng.
- Không tự kết luận bệnh; mọi alert quan trọng cần clinical rules engine đã được thẩm định.

### 2. Insurance Policy Checker

**Đã có bản demo:** `/insurance` tải SBC PDF vào R2, lưu metadata/phân tích trong D1, cho chọn lại và tải xuống tài liệu, trích xuất văn bản bằng PDF parser chạy trong Worker, rồi ước tính cost sharing theo dịch vụ mô tả và network. Kết quả giữ citation theo trang khi trích xuất được; nếu không đọc được bảng PDF, giao diện bắt buộc ghi rõ đang dùng dữ liệu mô phỏng. Số deductible đã dùng, allowed amount thực, mã CPT/HCPCS, eligibility và claim chưa được kết nối thời gian thực.

Pipeline nên là:

```text
Private PDF upload
  -> malware/file validation
  -> PDF text + table extraction
  -> section-aware chunking
  -> embedding
  -> vector retrieval
  -> answer with page/section citation + uncertainty
```

MVP tập trung deductible, out-of-pocket maximum, copay, coinsurance, network, formulary, visit limit và prior authorization. Câu trả lời phải luôn trích page/section và nói rõ đây không phải quyết định coverage hay cost estimate cuối cùng. CMS giải thích tài liệu SBC tại [Summary of Benefits and Coverage](https://www.cms.gov/marketplace/health-plans-issuers/summary-benefits-coverage).

### 3A. Wound monitoring / UB research

Để khớp hướng Precision Wound Care tại UB, đừng bắt đầu bằng claim “chẩn đoán nhiễm trùng”. Hãy xây **longitudinal capture + annotation pipeline**:

```text
wound_case
  -> wound_visit / assessment at t0, t1, t2...
  -> media asset (RGB first; modality + device + capture protocol + calibration)
  -> clinician annotation / segmentation mask
  -> area and tissue measurements
  -> healing trajectory for research review
```

AI milestone đầu: segment vết thương và đo area trend; sau đó mới tissue classification, multimodal fusion và forecasting. Kết quả model nằm trong `ai_inferences`, không ghi đè hồ sơ clinician đã xác nhận. Mọi ảnh train cần consent nghiên cứu riêng, patient-level split, versioned dataset và external validation.

Đề tài UB nhấn mạnh multimodal sensing, objective metrics, early deterioration và predictive/preventive healing: [Precision Wound Care opportunity](https://www.buffalo.edu/undergrad-research/opportunities.host.html/content/shared/www/undergrad-research/research-opportunities/precision-wound-care-collaborative-ai-powered-multimodal-monitoring-for-predictive-preventive-healing.detail.html).

### 3B. Physical therapy pose tracking

- MediaPipe Pose/TensorFlow.js chạy on-device trong browser.
- Tính joint angle từ hip–knee–ankle hoặc shoulder–elbow–wrist.
- Finite-state machine đếm rep; exercise-specific rules đánh dấu deviation.
- Lưu reps, range of motion, session summary và detected issues; **không lưu raw video mặc định**.
- Nếu lưu video, cần consent riêng, retention policy, private storage và clinician review.

### 4. Thuốc tương ứng xuyên quốc gia

Pipeline:

```text
OCR nhãn / đơn thuốc
  -> extract ingredient + strength + dose form + route
  -> WHO INN normalization
  -> country-specific regulatory catalog
  -> U.S. RxNorm/NDC mapping
  -> candidate match
  -> pharmacist verification
```

UI nên ghi “candidate matching ingredients/strength/form — pharmacist verification required”, không gọi là “thuốc thay thế tương đương” chỉ vì cùng hoạt chất. [WHO INN](https://www.who.int/teams/health-product-and-policy-standards/inn/) là anchor toàn cầu; [RxNorm](https://www.nlm.nih.gov/research/umls/rxnorm/overview.html) phù hợp để chuẩn hóa thuốc tại Mỹ.

Lưu ý: RxNav đã dừng drug–drug interaction feature từ 02/01/2024; không nên thiết kế DDI mới dựa vào endpoint đó. Xem [RxNav FAQ](https://lhncbc.nlm.nih.gov/RxNav/information/FAQs.html).

## Hạ tầng production tối thiểu

| Lớp | Lựa chọn khuyến nghị |
| --- | --- |
| Web/PWA | Next.js/React, TypeScript, Tailwind |
| Auth + relational DB | Supabase Auth + PostgreSQL + RLS |
| Files | Private Supabase Storage hoặc R2 |
| FHIR | FHIR R4/US Core mapping + IPS export; HAPI FHIR khi integration phức tạp |
| AI API | Python FastAPI, container riêng, async job queue |
| Insurance RAG | PDF parser, structured chunks, embeddings, pgvector/Vectorize, cited answers |
| CV research | PyTorch, experiment tracking, dataset/model versioning, human review |
| Pose | MediaPipe Pose/TensorFlow.js on-device |
| Observability | Structured logs không chứa PHI, error tracking, metrics, immutable audit trail |
| Security | TLS, secrets manager, MFA, least privilege, encryption, backup/PITR, incident response |
| Delivery | Dev/staging/prod tách riêng, migrations, CI tests, IaC, dependency scanning |

Không dùng database vận hành chứa định danh làm thẳng training dataset. Tạo pipeline de-identification + consent + dataset snapshot riêng. HHS mô tả hai phương pháp HIPAA de-identification tại [HHS De-identification Guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html). Consumer health apps ngoài HIPAA vẫn có thể chịu [FTC Health Breach Notification Rule](https://www.ftc.gov/business-guidance/resources/health-breach-notification-rule-basics-business).

## Thứ tự build thực tế

1. **Đã hoàn thành:** responsive frontend, database, private files, per-user ownership, CRUD, timeline, search/filter, demo seed.
2. Supabase production schema + RLS tests + consent/share/audit.
3. Nâng bản FHIR/IPS export demo thành luồng đã validate/ký; thêm import và clinician read-only share flow.
4. **Đã có demo:** Insurance PDF ingestion + trích điều khoản/citation + lịch sử ước tính; bước production tiếp theo là retrieval theo section, EDI 270/271, CPT/HCPCS và xác minh claim/eligibility.
5. Wound longitudinal data collection/annotation; IRB/consent trước khi lấy dữ liệu người thật.
6. Segmentation model + research validation; không gắn diagnostic claim.
7. On-device physical-therapy proof of concept.
8. Ingredient normalization và country catalogs; pharmacist review workflow.
9. Clinical, privacy, security và regulatory review trước pilot thật.

## Chạy local

Yêu cầu Node.js `>=22.13` và pnpm.

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm run demo
```

Mở `http://localhost:3001/editor`. Có thể dùng Chrome, Edge, Safari hoặc trình duyệt điện thoại; server không phụ thuộc trình duyệt. Xem hướng dẫn đầy đủ tại [`docs/RUN_APP_VI.md`](docs/RUN_APP_VI.md).

Kiểm tra build và schema:

```bash
pnpm run db:generate
pnpm run build
pnpm run lint
```

## Demo pitch 90 giây

1. Mở Overview; chỉ ngay Penicillin allergy và active conditions.
2. Mở Medical Passport để cho thấy cross-provider summary.
3. Vào Medical records; search `Hemoglobin`, filter Lab results.
4. Thêm một lab record hư cấu và đính kèm PDF/ảnh giả.
5. Refresh: dữ liệu vẫn còn; mở lại attachment.
6. Sửa record rồi soft-delete; giải thích audit trail và ownership check.
7. Mở `/insurance`, chọn SBC đã lưu, nhập tình huống MRI trong network và chỉ rõ phần plan/người dùng dự kiến trả cùng prior authorization và citation.

## Wound Lab và Motion Lab hiện tại

- `/wounds` và `/wound-analyzer` mở chung giao diện AI: **Patient Mode** khóa một hồ sơ mẫu và chỉ hiện tải ảnh/tóm tắt dễ đọc; **Developer Mode** cho chọn 5 hồ sơ giả lập, xem dữ liệu nền và lưới 4 bước (ảnh gốc, vùng U-Net, lớp phủ mô, kết luận kết hợp hồ sơ). Bật Developer Mode → **Thử ảnh & hồ sơ mẫu** → **Phân tích ảnh** để gọi FastAPI thật tại `127.0.0.1:8000`.
- Phân vùng dùng checkpoint U-Net/ResNet34 được cung cấp ở `outputs/wound_unet_fusd.pt` (CPU, ImageNet, 256×256, sigmoid >0.35). Mô hình mô giả lập riêng chỉ tô màu bên trong mask; kết quả trả về đúng kích thước ảnh gốc. Các hình này không phải giải thích đặc trưng hay bước trung gian của mô hình late fusion. Thiếu checkpoint phụ không làm hỏng Clinical Brief; xem `aimedic/README.md` để phân biệt hai checkpoint.
- `/wounds/history` giữ luồng chụp/chọn ảnh cũ, xóa EXIF bằng cách tái mã hóa trong trình duyệt, lưu ảnh riêng tư vào R2 và nhóm các lần đánh giá theo `wound_case`. Liên kết **Lịch sử & ghi nhận** nằm ngay trên màn hình AI.
- Safety review trong luồng lưu lịch sử chỉ dùng triệu chứng khai báo và bệnh lý/thuốc đã lưu. Kết quả AI riêng dùng mô hình học ảnh giả lập, chưa được xác nhận lâm sàng và không tự lưu vào hồ sơ.
- Ba bảng D1 mới là `wound_cases`, `wound_assessments` và `ai_inferences`. Bảng `ai_inferences` được dành sẵn cho model thật và mặc định bắt buộc human review.
- `/therapy` là scaffold camera chạy tại thiết bị; video không được ghi hoặc upload. Rep count, range of motion và form deviation để trống cho tới khi pose model thật được nối.
- Code huấn luyện/preprocessing nằm trong `aimedic/`, weights và bộ dữ liệu tạo ra nằm trong `outputs/` bị Git bỏ qua. Trình duyệt gọi inference, không huấn luyện model. Contract lưu trữ cũ trong `lib/vision/` vẫn tách khỏi Clinical Brief của API Python.

Chi tiết kiến trúc, nguyên tắc an toàn và workflow cộng tác GitHub nằm tại [`docs/WOUND_RESEARCH_ARCHITECTURE.md`](docs/WOUND_RESEARCH_ARCHITECTURE.md).

Bản nghiên cứu Python chạy riêng trong [`aimedic/`](aimedic/README.md) hiện đã có đủ
bốn script: tạo 1.000 bệnh nhân giả lập, mô hình ảnh + hồ sơ nền, huấn luyện PyTorch,
và theo dõi thay đổi mô theo thời gian để xuất JSON cho người nghiên cứu xem lại.
Đã chạy huấn luyện, đọc checkpoint và kiểm thử; đây là kết quả trên dữ liệu giả lập,
chưa phải phân tích ảnh lâm sàng. Wound Lab hiện gọi mô hình qua API Python cục bộ;
một ảnh chỉ có ước tính hiện tại, không tạo lịch sử hay kết luận lành/xấu đi.

**Chạy tính năng mới:** xem [`docs/WOUND_AI_INTEGRATION.md`](docs/WOUND_AI_INTEGRATION.md).
Cần giữ cả frontend cổng **3001** và Python cổng **8000** chạy trên cùng máy.
