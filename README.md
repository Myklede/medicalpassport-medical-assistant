# MediPass

**Medical Passport & Precision Wound Care Research Demo**

MediPass là nguyên mẫu HealthTech tập trung vào một hồ sơ y tế di động do bệnh
nhân kiểm soát. Bản demo kết hợp cổng bệnh viện, góc nhìn bệnh nhân, bản tóm tắt
FHIR International Patient Summary (IPS), công cụ đọc quyền lợi bảo hiểm, đối
chiếu tên thuốc xuyên quốc gia và một Wound Lab nghiên cứu chạy cục bộ.

> **Phạm vi sử dụng:** MediPass hiện là research/startup prototype. Sản phẩm
> không phải thiết bị y tế, không chẩn đoán, không chỉ định điều trị, chưa được
> chứng nhận lâm sàng và chưa được xác lập là HIPAA compliant. Chỉ sử dụng dữ
> liệu tổng hợp hoặc đã khử định danh.

**Bản demo riêng tư:**
[medipass-medical-assistant-demo.thnguyen7807.chatgpt.site](https://medipass-medical-assistant-demo.thnguyen7807.chatgpt.site)

**Chạy nhanh trên máy:**

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm run demo
```

Sau đó mở [http://localhost:3001](http://localhost:3001) hoặc đi thẳng tới
[http://localhost:3001/editor](http://localhost:3001/editor).

Trạng thái triển khai trong README này được đối chiếu với audit ngày
12/09/2026. Tầm nhìn dài hạn được lưu riêng và không được xem là bằng chứng một
tính năng đã hoàn thành.

## Mục lục

- [Tổng quan sản phẩm](#tổng-quan-sản-phẩm)
- [Trạng thái tính năng](#trạng-thái-tính-năng)
- [Các đường dẫn chính](#các-đường-dẫn-chính)
- [Kiến trúc và lưu trữ](#kiến-trúc-và-lưu-trữ)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cài đặt và chạy local](#cài-đặt-và-chạy-local)
- [Chạy Wound Lab AI](#chạy-wound-lab-ai)
- [Biến môi trường](#biến-môi-trường)
- [Kiểm thử và xác minh](#kiểm-thử-và-xác-minh)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Giới hạn hiện tại](#giới-hạn-hiện-tại)
- [Nguyên tắc phát triển](#nguyên-tắc-phát-triển)
- [Tài liệu liên quan](#tài-liệu-liên-quan)

## Tổng quan sản phẩm

MediPass thử nghiệm cách gom thông tin sức khỏe đang bị phân mảnh thành một hồ
sơ có cấu trúc, dễ đọc và có thể mang sang lần khám tiếp theo. Hai góc nhìn chính
dùng cùng dữ liệu portal:

- **Cổng bệnh viện:** nhân viên mô phỏng có thể chọn bệnh nhân, cập nhật hồ sơ
  chung và tạo hoặc sửa toàn bộ một lần khám.
- **Góc nhìn bệnh nhân:** cùng hồ sơ đó ở chế độ chỉ đọc, bổ sung giải thích bệnh
  nền và xét nghiệm bằng ngôn ngữ dễ hiểu.

Các mô-đun nghiên cứu mở rộng giải quyết bốn bài toán liên quan:

1. Xuất bản tóm tắt y tế sơ bộ theo FHIR R4 IPS 2.0.1.
2. Đọc tài liệu Summary of Benefits and Coverage (SBC) và ước tính chia sẻ chi
   phí theo các điều khoản trích xuất được.
3. Đối chiếu sản phẩm thuốc giữa Việt Nam, Ấn Độ, Mỹ và Trung Quốc theo hoạt
   chất, hàm lượng và dạng dùng.
4. Theo dõi ảnh vết thương theo thời gian bằng pipeline PyTorch/FastAPI nghiên
   cứu, tách biệt khỏi hồ sơ lâm sàng đã xác nhận.

## Trạng thái tính năng

| Khu vực | Trạng thái | Nội dung hiện có |
| --- | --- | --- |
| Hospital Portal | Hoạt động trong demo | 5 bệnh nhân tổng hợp, 10 lần khám, hồ sơ chung, bệnh nền, dị ứng, sinh hiệu, xét nghiệm, thuốc, dịch vụ, kế hoạch và bác sĩ |
| Patient View | Hoạt động trong demo | Chỉ đọc, giữ bệnh nhân qua `?patient=`, có giải thích đã biên soạn cho các bệnh và xét nghiệm mẫu |
| Xuất IPS | Sơ bộ, đã kiểm tra fixture | FHIR R4 document Bundle theo IPS 2.0.1 và PDF song ngữ có JSON Bundle đính kèm; chưa ký số hoặc được clinician xác nhận |
| Chú thích giao diện | Hoạt động trong demo | Chọn vùng thật trên UI, lưu comment có neo và mở lại ở danh sách feedback |
| Mobile Preview | Hoạt động trong demo | Khung web responsive 360/390/430 px; không phải ứng dụng iOS/Android native |
| Insurance Checker | Demo có quy tắc | Lưu SBC PDF riêng tư, trích văn bản/citation và ước tính cost sharing; không phải live eligibility, coverage determination, claim hoặc hóa đơn cuối cùng |
| Medication Exchange | Demo có tuyển chọn | 20 nhóm thuốc tại 4 quốc gia; so hoạt chất, hàm lượng, dạng dùng, Rx/OTC và nhu cầu kiểm tra tá dược; không tự kết luận tương đương điều trị |
| Wound Lab | Research demo chạy local | Phiên ảnh SQLite bền vững, một/nhiều lần chụp, U-Net, tissue overlay, Clinical Brief, giải thích VI/EN và trajectory rules |
| Wound History | Luồng lưu trữ độc lập | Ảnh riêng tư trong R2, metadata trong D1 và safety review chỉ dựa trên dữ liệu khai báo |
| Motion Lab | Scaffold | Camera preview cục bộ, không ghi/upload video; chưa nối pose estimation hoặc rep counting |
| Legacy Records | Hoạt động, dữ liệu riêng | Module hồ sơ cũ tại `/records`; không tự gộp danh tính/dữ liệu với portal mới |

### Hospital Portal và Patient View

- `/` là sảnh vào ứng dụng, không mở hồ sơ bệnh nhân ngay lập tức.
- `/editor` cho phép thêm/sửa 5 bệnh nhân mẫu và các thẻ lần khám hoàn chỉnh.
- Bệnh nền và dị ứng thuộc bệnh nhân; xét nghiệm, thuốc, thủ thuật, kế hoạch và
  snapshot bác sĩ thuộc từng lần khám.
- `/patient` hiển thị cùng dữ liệu ở chế độ chỉ đọc.
- Portal làm mới sau khi lưu trong cùng trình duyệt và kiểm tra thay đổi từ thiết
  bị khác mỗi 5 giây khi trang đang hiển thị. Đây không phải Supabase Realtime
  hoặc WebSocket subscription.
- Chế độ sáng/tối xuất hiện trên mọi route, lưu bằng khóa `medipass-theme` trong
  local storage và đồng bộ giữa trang chính với khung mobile cùng origin.

### FHIR IPS và PDF song ngữ

Từ `/editor` hoặc `/patient`, người dùng có thể xuất bệnh nhân đang chọn dưới hai
định dạng:

- FHIR R4 document Bundle theo International Patient Summary 2.0.1.
- PDF song ngữ chứa chính JSON Bundle dưới dạng attachment.

Tám fixture tổng hợp đã đạt 0 error/0 warning trong cổng kiểm tra HL7 được ghi ở
[`docs/PORTAL_AUDIT.md`](docs/PORTAL_AUDIT.md). Kết quả này xác minh cấu trúc
fixture, không phải chứng nhận sản phẩm, kiểm thử tương tác với mọi hệ thống nhận,
chữ ký số hoặc clinician attestation. Dữ liệu thiếu được biểu diễn bằng Data
Absent Reason hoặc `unavailable`, không tự suy diễn thành “không có”.

### Insurance Policy Checker

`/insurance` cho phép tải SBC PDF tối đa 8 MiB, dùng lại hoặc tải xuống tài liệu
đã lưu, nhập mô tả dịch vụ và xem ước tính deductible, copay/coinsurance, network,
prior authorization và phần dự kiến do plan/người dùng trả. Khi trích xuất văn
bản thành công, kết quả giữ citation theo trang. PDF scan hoặc không đọc được
phải hiển thị rõ đang dùng hồ sơ mô phỏng dự phòng.

Mô-đun chưa kết nối số deductible đã sử dụng thực tế, allowed amount, CPT/HCPCS,
EDI 270/271, eligibility hoặc claim thời gian thực.

### Medication Exchange

`/medications` dùng catalog demo 20 mục để tìm ứng viên theo hoạt chất. Giao diện
luôn phân biệt hàm lượng, dạng dùng, Rx/OTC và nhu cầu xác minh tá dược. Mọi thay
đổi thuốc phải được pharmacist hoặc người kê đơn xác nhận; cùng hoạt chất không
đồng nghĩa tự động thay thế điều trị.

### Legacy Records và private files

`/records` giữ module hồ sơ y tế được xây dựng trước portal hiện tại. Module này
có 5 loại bản ghi—Allergy, Condition, Medication, Lab Result và Encounter—cùng
CRUD, soft-delete, tìm kiếm, lọc timeline và clinical summary. PDF, JPEG hoặc PNG
tối đa 8 MiB được lưu trong private object storage và chỉ mở lại qua API có
ownership check. Các thao tác đọc, ghi, upload và download có audit event; dữ liệu
tồn tại sau khi refresh và tài khoản demo mới được seed bằng fixture tổng hợp.

Dữ liệu của module cũ không tự ghép với 5 bệnh nhân portal. Khi Supabase được cấu
hình, nhóm này có thể mirror vào các bảng `medipass_*`; giao diện vẫn phải hiển thị
đúng storage provider đang hoạt động.

### Wound Lab

`/wounds` và `/wound-analyzer` dùng chung `WoundVisitWorkflow`:

- Tạo và mở lại phiên theo dõi được liệt kê từ FastAPI server.
- Lưu một hoặc nhiều PNG/JPEG cùng thời điểm chụp vào SQLite cục bộ.
- Thêm ảnh ở lần quay lại, xem timeline thumbnail và mở kết quả lịch sử.
- Xóa một lần chụp hoặc cả phiên sau bước xác nhận.
- Giữ ảnh ở trạng thái `pending_model` với số đo `null` khi model không sẵn sàng,
  rồi phân tích lại từ đúng byte ảnh đã lưu.
- Patient Mode cố định một danh tính mô phỏng và hiển thị bốn bước giáo dục VI/EN.
- Developer Mode chọn 5 hồ sơ tổng hợp, mở ảnh đầu vào, U-Net isolation, tissue
  overlay và Clinical Brief cho từng lần chụp.
- 20 lần khám tổng hợp được giữ nguyên trong accordion bốn nhóm, tách khỏi phép đo
  của ảnh mới tải lên.

Các checkpoint hiện có được theo dõi bằng Git LFS. Pipeline phân vùng dùng U-Net
ResNet34 trên CPU; tissue inference chỉ nhận vùng crop đã mask và tỷ lệ mô được
tính trên toàn bộ pixel trong wound mask, gồm phần chưa phân loại. Các risk score,
uncertainty và ngưỡng trajectory là output nghiên cứu chưa hiệu chuẩn, không phải
xác suất lâm sàng hoặc hướng dẫn chờ điều trị.

`/wounds/history` là luồng khác: ảnh được tái mã hóa trong trình duyệt để loại EXIF,
lưu vào R2 và được rà soát an toàn bằng triệu chứng khai báo. AI brief và SQLite
session không tự ghi sang Supabase, D1 hoặc hồ sơ clinician.

## Các đường dẫn chính

| Route | Mục đích |
| --- | --- |
| `/` | Sảnh chọn khu vực sử dụng |
| `/editor` | Cổng bệnh viện có quyền chỉnh sửa trong demo |
| `/patient` | Góc nhìn bệnh nhân chỉ đọc |
| `/visit/[id]` | Chi tiết một lần khám |
| `/mobile` | Khung thử giao diện điện thoại 360/390/430 px |
| `/data` | Explorer dữ liệu portal và mô tả cấu trúc Supabase |
| `/feedback` | Danh sách chú thích và yêu cầu chỉnh sửa giao diện |
| `/records` | Module hồ sơ y tế cũ, có kho dữ liệu riêng |
| `/insurance` | Insurance SBC policy checker |
| `/medications` | Đối chiếu tên thuốc xuyên quốc gia |
| `/wounds` | Wound Lab chính |
| `/wound-analyzer` | Lối vào tương thích tới cùng wound workflow |
| `/wounds/history` | Lịch sử ảnh R2/D1 và review từ dữ liệu khai báo |
| `/therapy` | Motion Lab camera scaffold |

Patient selection được giữ bằng query `?patient=` giữa hospital, patient và mobile
view. Với `/records`, tham số này chỉ giữ ngữ cảnh điều hướng quay về; nó không đổi
danh tính hoặc ghép dữ liệu của module cũ.

## Kiến trúc và lưu trữ

MediPass hiện có ba data plane tách biệt:

```text
Browser / responsive web UI
          |
          v
Vinext + React + server routes
          |
          +-- Portal / Patient / Feedback / Data
          |      -> server-only Supabase RPC
          |      -> PostgreSQL mp_* tables
          |
          +-- Legacy Records / Insurance / Wound History
          |      -> Cloudflare D1 metadata
          |      -> private Cloudflare R2 objects
          |
          +-- /api/wound-sessions
                 -> same-origin proxy
                 -> local FastAPI on 127.0.0.1:8000
                 -> local SQLite + Git LFS model checkpoints
```

| Dữ liệu | Nơi lưu hiện tại | Ghi chú |
| --- | --- | --- |
| Portal, encounters, patient notes, visual feedback | Supabase `mp_*` qua RPC phía server | Secret không được gửi xuống client |
| Legacy `/records` | D1; được mirror vào nhóm `medipass_*` khi cấu hình | Không tự hợp nhất với portal mới |
| Insurance PDF | Private R2 | Metadata và phân tích theo patient ở D1 |
| Wound history | Private R2 + D1 | Safety review từ reported data, độc lập với AI inference |
| Wound AI sessions | `outputs/wound-sessions.sqlite3` | Cục bộ, không tự hết hạn hoặc backup lên cloud |
| Theme | Browser local storage | Khóa `medipass-theme` |

Frontend không truy cập trực tiếp Supabase secret, D1 hoặc R2. Các API có dữ liệu
bệnh nhân phải resolve danh tính/membership và scope truy vấn theo patient. Bản
demo local và Wound Lab vẫn chưa thay thế cho authentication, authorization, RLS,
consent và audit được thẩm định cho production.

### Nhóm API chính

| Endpoint | Chức năng |
| --- | --- |
| `/api/portal`, `/api/portal/patients`, `/api/portal/encounters` | Đọc/ghi dữ liệu portal |
| `/api/portal/ips` | Xuất PDF hoặc FHIR JSON cho bệnh nhân được phép truy cập |
| `/api/portal/data` | Cấp dữ liệu cho explorer |
| `/api/portal/schema` | Trả gói migration Supabase của portal |
| `/api/feedback` | Đọc và lưu chú thích giao diện |
| `/api/records` | CRUD và soft-delete cho module hồ sơ cũ |
| `/api/files` | Upload, mở và xóa private file sau ownership check |
| `/api/insurance/documents` | Lưu, liệt kê và tải tài liệu SBC |
| `/api/insurance/analyze` | Phân tích chính sách và lưu estimate |
| `/api/wounds` | Luồng wound history R2/D1 |
| `/api/wound-sessions` | Proxy phiên ảnh cục bộ sang FastAPI |

Schema D1 nguồn nằm ở `db/schema.ts`, migration Drizzle nằm trong `drizzle/` và
khởi tạo runtime idempotent nằm ở `db/runtime.ts`. Migration Supabase nằm trong
`supabase/migrations/`.

## Công nghệ sử dụng

| Lớp | Công nghệ |
| --- | --- |
| Web | Vinext, React 19, TypeScript, Vite |
| UI | Tailwind CSS 4, Base UI, shadcn, Lucide, Recharts |
| Cloud runtime | OpenAI Sites, Cloudflare Workers, D1 và R2 |
| Portal database | Supabase PostgreSQL qua server-only RPC |
| Schema/migration | Drizzle ORM và SQL migrations |
| PDF/FHIR | `pdf-lib`, fontkit, FHIR R4 IPS 2.0.1 |
| Insurance extraction | `unpdf` và bộ quy tắc TypeScript |
| Wound research | Python, FastAPI, PyTorch, segmentation-models-pytorch, SQLite |
| Kiểm thử | Node test runner, Python `unittest`, Playwright browser QA |

## Cài đặt và chạy local

### Yêu cầu

- Node.js `>=22.13.0`.
- pnpm qua Corepack.
- Git LFS nếu cần chạy Wound Lab với checkpoint.
- Python và các wheel tương thích nếu chạy backend `aimedic/`.

### 1. Lấy mã nguồn và cài dependency

```powershell
git clone https://github.com/Myklede/medipass-medical-assistant-demo.git
Set-Location medipass-medical-assistant-demo
corepack enable
pnpm install --frozen-lockfile
```

Nếu đã có repository, chỉ cần chạy hai lệnh cuối tại thư mục gốc.

### 2. Cấu hình Supabase khi cần

```powershell
Copy-Item .env.example .env.local
```

Điền `SUPABASE_URL` và `SUPABASE_SECRET_KEY` vào `.env.local`. Khóa secret chỉ
dành cho server; không đổi tên thành biến có tiền tố `NEXT_PUBLIC_` hoặc `VITE_`,
không commit và không gửi qua chat/log.

Portal đã dùng bốn migration theo thứ tự:

1. `supabase/migrations/20260905000000_medipass_core.sql`
2. `supabase/migrations/20260909000000_medipass_portal.sql`
3. `supabase/migrations/20260909010000_preserve_portal_demo.sql`
4. `supabase/migrations/20260909020000_visual_annotations.sql`

Không sửa migration đã áp dụng; tạo migration mới cho thay đổi schema tiếp theo.

### 3. Chạy web server

```powershell
pnpm run demo
```

Script này bind `0.0.0.0:3001`. Các địa chỉ thường dùng:

- Sảnh: [http://localhost:3001](http://localhost:3001)
- Hospital Portal: [http://localhost:3001/editor](http://localhost:3001/editor)
- Patient View: [http://localhost:3001/patient](http://localhost:3001/patient)
- Wound Lab: [http://localhost:3001/wounds](http://localhost:3001/wounds)

Dừng server bằng `Ctrl+C`. Nếu Node mặc định quá cũ, có thể chạy Vinext bằng Node
24 mà không thay phiên bản Node toàn hệ thống:

```powershell
npx --yes node@24 node_modules/vinext/dist/cli.js dev --hostname 0.0.0.0 --port 3001
```

### 4. Mở từ điện thoại cùng Wi-Fi

Lấy IPv4 của máy chạy server bằng `ipconfig` trên Windows hoặc phần thông tin Wi-Fi
trên macOS, sau đó mở:

```text
http://DIA-CHI-IP-CUA-MAY:3001/patient
```

Chỉ cho phép Node.js trên mạng Private đáng tin cậy. Điện thoại dùng web server ở
cổng 3001; với Wound Lab, web server tự proxy tới Python loopback nên không cần mở
cổng 8000 ra LAN.

Hướng dẫn chi tiết cho Chrome, firewall và truy cập điện thoại nằm tại
[`docs/RUN_APP_VI.md`](docs/RUN_APP_VI.md).

## Chạy Wound Lab AI

Web app và Python API phải chạy trong hai terminal. Hosted demo hiện không có
dịch vụ Python tương ứng và không thể gọi backend đang chạy trên laptop của bạn.

### 1. Materialize model qua Git LFS

```powershell
git lfs install --local
git lfs pull
git lfs ls-files
```

Ba checkpoint mặc định:

| Model | Đường dẫn |
| --- | --- |
| Late-fusion model | `outputs/pwc-run/best.pt` |
| Binary U-Net | `outputs/wound_unet_fusd.pt` |
| Tissue model | `outputs/pwc-visual-run/best.pt` |

Digest chuẩn nằm trong `aimedic/checkpoints.sha256`. Nếu chưa chạy `git lfs pull`,
file `.pt` có thể chỉ là LFS pointer và Python sẽ không tải được model.

### 2. Tạo môi trường Python trên Windows

```powershell
python -m venv outputs/pwc-venv
outputs/pwc-venv/Scripts/python.exe -m pip install -r aimedic/requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
outputs/pwc-venv/Scripts/python.exe -B scripts/verify-wound-models.py
```

Trên macOS/Linux, thay executable bằng môi trường `bin/python` tương ứng:

```bash
python3 -m venv outputs/wound-venv
outputs/wound-venv/bin/python -m pip install -r aimedic/requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
outputs/wound-venv/bin/python -B scripts/verify-wound-models.py
```

Script xác minh dùng ảnh tổng hợp và SQLite tạm, kiểm tra cả ba checkpoint và không
đọc/sửa database phiên người dùng hoặc huấn luyện lại model.

### 3. Chạy hai service

Terminal 1:

```powershell
pnpm run demo
```

Terminal 2 trên Windows:

```powershell
outputs/pwc-venv/Scripts/python.exe -B aimedic/main.py
```

Hoặc trên macOS/Linux:

```bash
outputs/wound-venv/bin/python -B aimedic/main.py
```

Mở [http://localhost:3001/wounds](http://localhost:3001/wounds). Swagger của API
local có tại [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

SQLite mặc định là `outputs/wound-sessions.sqlite3`, không tự hết hạn và không tự
backup lên cloud. FastAPI bind loopback, không có user authentication production;
CORS không phải cơ chế phân quyền.

Xem contract API, chronology, retry và model boundaries tại
[`docs/WOUND_AI_INTEGRATION.md`](docs/WOUND_AI_INTEGRATION.md) và
[`docs/WOUND_TRAJECTORY_ENGINE.md`](docs/WOUND_TRAJECTORY_ENGINE.md).

## Biến môi trường

### Web/portal

| Biến | Bắt buộc | Mục đích |
| --- | --- | --- |
| `SUPABASE_URL` | Khi dùng Supabase | Project URL dùng ở server |
| `SUPABASE_SECRET_KEY` | Khi dùng Supabase | Secret key server-only; tuyệt đối không đưa xuống client hoặc Git |

### Wound API

| Biến | Mặc định | Mục đích |
| --- | --- | --- |
| `MEDIPASS_MODEL_PATH` | `outputs/pwc-run/best.pt` | Override late-fusion checkpoint |
| `MEDIPASS_VISUAL_MODEL_PATH` | `outputs/wound_unet_fusd.pt` | Override binary U-Net checkpoint |
| `MEDIPASS_TISSUE_MODEL_PATH` | `outputs/pwc-visual-run/best.pt` | Override tissue checkpoint |
| `MEDIPASS_WOUND_SESSION_DB` | `outputs/wound-sessions.sqlite3` | Override SQLite session database |
| `MEDIPASS_CORS_ORIGINS` | Local frontend origins | Danh sách origin cho stateless FastAPI routes |

Đường dẫn tương đối của model được resolve từ repository root. Không commit môi
trường Python, dataset sinh ra, SQLite người dùng hoặc file secret trong `outputs/`.

## Kiểm thử và xác minh

### Cổng kiểm tra trước khi push

Yêu cầu Node.js 22.13 trở lên:

```powershell
npx --yes node@24 scripts/pre-push-check.mjs
```

Script kiểm tra remote Git dự kiến, Git LFS pointer, secret có thể bị commit,
whitespace, TypeScript, toàn bộ nhóm unit test chính và production build.

### Kiểm tra web riêng lẻ

```powershell
pnpm run lint
pnpm run test:portal
pnpm run test:wound
pnpm run build
```

Toàn bộ unit test chính có thể chạy trực tiếp bằng Node 24:

```powershell
npx --yes node@24 --test tests/portal.test.ts tests/ips-export.test.ts tests/medication-exchange.test.ts tests/wound-safety.test.ts tests/wound-api.test.ts tests/wound-sessions-api.test.ts tests/wound-presentation.test.ts tests/wound-schema.test.ts
```

### Kiểm tra Python

Windows:

```powershell
outputs/pwc-venv/Scripts/python.exe -B scripts/verify-wound-models.py
outputs/pwc-venv/Scripts/python.exe -B -m unittest discover -s aimedic -p 'test_*.py' -v
```

macOS/Linux:

```bash
outputs/wound-venv/bin/python -B scripts/verify-wound-models.py
outputs/wound-venv/bin/python -B -m unittest discover -s aimedic -p 'test_*.py' -v
```

Lần audit được ghi trong tài liệu dự án đã đạt 62 unit tests TypeScript, 77 Python
tests, TypeScript, lint và production build; model verification cũng chạy thành
công với checkpoint gốc. Đây là bằng chứng tích hợp phần mềm trên fixture tổng
hợp, không phải clinical validation.

Browser QA đầy đủ cần Playwright local trong `outputs/qa/node_modules`. Các script
browser và phạm vi từng lượt kiểm tra được mô tả trong
[`docs/PORTAL_AUDIT.md`](docs/PORTAL_AUDIT.md) và
[`docs/WOUND_AI_INTEGRATION.md`](docs/WOUND_AI_INTEGRATION.md). Chỉ bật
`MEDIPASS_VERIFY_SUPABASE=1` với danh tính QA cô lập; không trỏ helper vào workspace
của chủ dự án.

## Cấu trúc thư mục

```text
medipass-demo/
├── app/                    # Routes, pages và server API
│   ├── portal/             # Hospital/patient shared UI
│   ├── insurance/          # SBC policy checker
│   ├── medications/        # Medication exchange demo
│   ├── wounds/             # Wound Lab và wound history
│   └── api/                # Server route handlers
├── components/             # Shared UI, branding và wound workflow
├── lib/                    # Domain logic, validation, FHIR/PDF và API clients
├── db/                     # D1 schema, runtime và data stores
├── drizzle/                # D1 migrations
├── supabase/migrations/    # Portal PostgreSQL/RPC migrations
├── aimedic/                # Python wound research pipeline và tests
├── public/                 # Static assets và synthetic wound fixture
├── scripts/                # Pre-push và model verification helpers
├── tests/                  # TypeScript/API/browser QA
├── docs/                   # Audit, architecture, startup và product context
├── outputs/                # Git-LFS checkpoints; local/generated files ignored
└── .openai/hosting.json    # Sites D1/R2 binding configuration
```

## Giới hạn hiện tại

- Không có đăng nhập/phân quyền production cho từng bệnh viện, bệnh nhân hoặc hồ
  sơ Wound Lab; các profile wound hiện là simulated sign-in.
- Chưa có SMART on FHIR/OAuth import hoặc đồng bộ hai chiều với bệnh viện thật.
- IPS export chưa có chữ ký số, clinician attestation hoặc chứng nhận sản phẩm.
- Supabase polling 5 giây không phải Realtime/WebSocket.
- Insurance result là estimate từ tài liệu và quy tắc demo, không phải xác nhận
  quyền lợi, prior authorization, claim hoặc final bill.
- Medication catalog là bộ 20 mục có tuyển chọn, không phải dữ liệu lưu hành theo
  thời gian thực hoặc công cụ tự thay thuốc.
- Wound model học/kiểm tra bằng dữ liệu tổng hợp, chưa được external validation
  trên ảnh lâm sàng, chưa có area calibration lâm sàng, OOD detector hoặc risk
  probability đã hiệu chuẩn.
- Wound trajectory rules là ngưỡng nghiên cứu minh họa. Ảnh và checklist có thể
  bỏ sót nguy cơ; kết quả không được dùng để trì hoãn đánh giá trực tiếp.
- `/wounds/history` review reported data, không phân tích pixel ảnh.
- Motion Lab chưa có pose model hoặc đếm lần tập.
- `/mobile` là responsive web preview, không phải native mobile app.
- Chưa có tuyên bố FDA clearance, HIPAA compliance hoặc tư vấn pháp lý đã được xác
  minh cho pilot thực tế.

Roadmap đầy đủ—medical passport, consent/share, insurance EDI, wound research,
physical therapy và medication normalization—nằm trong
[`docs/PROJECT_VISION_WHITEPAPER_VI.md`](docs/PROJECT_VISION_WHITEPAPER_VI.md).
Tài liệu đó là product context, không phải danh sách chức năng đã triển khai.

## Nguyên tắc phát triển

- Đọc [`AGENTS.md`](AGENTS.md), README này, portal audit, vision whitepaper và wound
  architecture trước khi thay đổi dự án.
- Chỉ dùng dữ liệu tổng hợp hoặc đã khử định danh. Không commit PHI, ảnh vết thương
  thật, `.env*`, model credential, exported production data hoặc SQLite người dùng.
- Dùng `@/components/app-link` cho điều hướng trong app; `next/link` từng gây hỏng
  client navigation trong Vinext build đã triển khai.
- Giữ `data-annotate`, `data-annotation-label` và `data-encounter-id` ổn định cho
  visual comments.
- Không tự tạo giải thích cho thuật ngữ y khoa lạ. Condition education dùng exact
  alias lookup trong `lib/patient-education.ts`; lab education dùng
  `lib/lab-interpretation.ts` và khoảng tham chiếu của chính phiếu xét nghiệm.
- Không âm thầm đổi storage provider hoặc báo đã lưu Supabase khi thực tế không
  thành công. UI phải cho biết provider đang hoạt động.
- Không sửa migration đã áp dụng. Thêm migration mới và kiểm tra rollback/ownership.
- Không hiển thị confidence như certainty. Wound result phải đi kèm data quality,
  uncertainty, model version, provenance và trạng thái human review.
- Không tự động đẩy GitHub hoặc deploy Sites. Hai thao tác này độc lập và chỉ được
  thực hiện khi có yêu cầu rõ ràng.

## Tài liệu liên quan

| Tài liệu | Nội dung |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Ngữ cảnh và quy tắc làm việc cho coding agents |
| [`docs/PORTAL_AUDIT.md`](docs/PORTAL_AUDIT.md) | Hành vi portal đã triển khai và bằng chứng QA |
| [`docs/PROJECT_VISION_WHITEPAPER_VI.md`](docs/PROJECT_VISION_WHITEPAPER_VI.md) | Tầm nhìn, roadmap và due-diligence context do founder cung cấp |
| [`docs/RUN_APP_VI.md`](docs/RUN_APP_VI.md) | Chrome, local port 3001 và truy cập cùng Wi-Fi |
| [`docs/IPS_CONFORMANCE_AUDIT.md`](docs/IPS_CONFORMANCE_AUDIT.md) | Phạm vi kiểm tra FHIR IPS |
| [`docs/WOUND_RESEARCH_ARCHITECTURE.md`](docs/WOUND_RESEARCH_ARCHITECTURE.md) | Ranh giới nghiên cứu wound và rehabilitation |
| [`docs/WOUND_AI_INTEGRATION.md`](docs/WOUND_AI_INTEGRATION.md) | Khởi động và tích hợp Wound AI |
| [`docs/WOUND_TRAJECTORY_ENGINE.md`](docs/WOUND_TRAJECTORY_ENGINE.md) | Contract trajectory, persistence và retry |
| [`aimedic/README.md`](aimedic/README.md) | Pipeline Python, API, training và model boundaries |
| [`docs/GITHUB_PUSH_GUIDE_VI.md`](docs/GITHUB_PUSH_GUIDE_VI.md) | Quy trình kiểm tra và tự đẩy GitHub |

## Demo pitch 90 giây

1. Mở `/` để cho thấy app không để lộ hồ sơ trước khi chọn góc nhìn.
2. Vào `/editor`, chọn bệnh nhân và mở bệnh nền, dị ứng cùng một lần khám.
3. Chuyển sang `/patient` để xem giải thích bệnh/xét nghiệm ở chế độ chỉ đọc.
4. Xuất IPS PDF hoặc FHIR JSON và nói rõ đây là bản sơ bộ chưa ký.
5. Mở `/insurance`, chọn SBC đã lưu, nhập một dịch vụ và chỉ ra estimate, prior
   authorization cùng citation.
6. Mở `/medications` để minh họa đối chiếu ứng viên và yêu cầu pharmacist xác nhận.
7. Nếu FastAPI đang chạy, mở `/wounds`, chọn phiên nhiều ngày và so Patient Mode
   với Developer Mode; kết thúc bằng giới hạn research-only.

---

MediPass ưu tiên tính minh bạch: dữ liệu đến từ đâu, được lưu ở đâu, mức bất định
ra sao và phần nào chưa được xác minh phải luôn được trình bày rõ ràng.
