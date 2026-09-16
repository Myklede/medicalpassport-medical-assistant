# Đối chiếu yêu cầu portal — cập nhật 12/09/2026

Yêu cầu mới của chủ dự án về portal và Supabase thay thế các giới hạn MVP cũ trong PLAN.md.

| Yêu cầu | Kết quả trong bản nâng cấp |
| --- | --- |
| Không mở thẳng vào hồ sơ bệnh nhân | `/` là trang sảnh tối giản với hai lựa chọn chính và ba lối tắt; không hiển thị thông tin bệnh nhân trước khi người dùng chọn góc nhìn |
| 5 bệnh nhân giả lập, có lịch sử khám | 5 bệnh nhân, mỗi người 2 lần khám; 3 bác sĩ giả lập |
| Bệnh viện thêm/sửa bệnh nhân | `/editor`: hồ sơ chung, bệnh nền, dị ứng, liên hệ |
| Nhập/sửa trọn lần khám | Ngày, lý do, triệu chứng, chẩn đoán và giải thích, chỉ số, labs, thuốc, dịch vụ, kế hoạch, hẹn khám và bác sĩ |
| Không lặp bệnh nền và dị ứng | Lưu theo bệnh nhân; hiện một lần trên đầu hồ sơ, gồm ghi chú |
| Mỗi lần khám một khung | Thẻ mở/thu gọn, trang đầy đủ và In/Lưu PDF qua hộp thoại in |
| Chuyển sang góc nhìn từng bệnh nhân | Giữ đúng bệnh nhân trong URL khi đổi góc nhìn; patient view chỉ đọc |
| Chú giải xét nghiệm | Giữ tên chuyên môn; tên dễ hiểu, lời bác sĩ, nguồn MedlinePlus; phân loại theo khoảng trên phiếu, không suy diễn chẩn đoán |
| Giải thích bệnh và xét nghiệm dễ hiểu hơn | 5 bệnh mẫu và 6 xét nghiệm chính có tóm tắt, ảnh hưởng, mục tiêu/mức trên phiếu, ăn uống-sinh hoạt và cảnh báo phù hợp; thuật ngữ lạ không được app tự đoán |
| Rà soát thuốc đang dùng | Tổng hợp theo tên/liều/đường dùng; có nút lấy vào lần khám mới để đánh dấu tiếp tục/ngừng/hoàn tất |
| Góp ý trực tiếp trên web | Bật Chú thích giao diện, di chuột chọn vùng, bấm để ghim bình luận; lưu selector, tọa độ tương đối, trích đoạn, bệnh nhân và lần khám. Các ghim trùng điểm được tách ra để bấm từng bình luận |
| Nút điều hướng không hoạt động | Thay điều hướng client gây lỗi runtime Vinext bằng liên kết tải trang; đã thử cả 5 bệnh nhân, feedback, data, records, Wound Lab và Motion Lab trên build production |
| Giao diện điện thoại | Web responsive và nút Giao diện điện thoại với khung tương tác 360/390/430px; trở lại desktop giữ bệnh nhân. Chưa có ứng dụng native iOS/Android |
| Wound Lab theo dõi ảnh và hồ sơ nền | `/wounds` và `/wound-analyzer` dùng `WoundVisitWorkflow`: đợt SQLite được liệt kê từ máy chủ, ảnh một/nhiều ngày, timeline thumbnail, thêm khi quay lại, xóa ảnh/đợt có xác nhận, kết quả và pipeline từng lần. Một ảnh được phân tích cùng baseline; FPG/tưới máu/cảm giác bổ sung ngữ cảnh diabetes/HbA1c. 20 lần khám giả lập hiển thị đủ trong accordion bốn nhóm. Web proxy cùng origin giúp điện thoại cùng LAN dùng cùng dữ liệu. Ba checkpoint gốc từ `c269a89` đã tải qua Git LFS, xác minh SHA-256 và chạy QA API ảnh đơn/nhiều ảnh thành công. Nếu model tạm thiếu, ảnh vẫn được lưu chờ với phép đo null và nút phân tích lại. Lịch sử R2/D1 riêng vẫn ở `/wounds/history`. |
| Dữ liệu trực quan | `/data`: lọc bệnh nhân, xem dữ liệu thực theo 9 nhóm, mở lại hồ sơ; cấu trúc Supabase thu gọn bên dưới |
| Đối chiếu thuốc xuyên quốc gia | `/medications`: 20 nhóm thuốc demo giữa Việt Nam, Ấn Độ, Mỹ và Trung Quốc; chuẩn hóa theo INN/ATC, so hàm lượng, dạng dùng và Rx/OTC, luôn đánh dấu tá dược chưa xác nhận và yêu cầu pharmacist/người kê đơn kiểm tra. Đây không phải catalog lưu hành thời gian thực hay kết luận tương đương điều trị |
| Kiểm tra chính sách bảo hiểm | `/insurance`: tải SBC PDF tối đa 8 MB, lưu riêng tư trong R2 và metadata/lịch sử phân tích theo patient trong D1; tài liệu đã lưu có thể chọn lại và tải xuống. Bộ đọc PDF trích deductible, out-of-pocket, copay/coinsurance và citation theo trang khi văn bản đủ rõ; người dùng nhập tình trạng/dịch vụ, network và chi phí dự kiến để xem điều kiện cover, prior authorization, phần plan/người dùng ước tính trả. PDF scan/không đọc được bị gắn nhãn dùng dữ liệu mô phỏng. Không phải live eligibility, coverage determination, claim hay hóa đơn cuối cùng. |
| Xuất Hộ chiếu Y tế Quốc tế | Nút **Xuất IPS** trên `/editor` và `/patient` tạo PDF song ngữ cùng FHIR R4 document Bundle theo IPS 2.0.1. Trang đầu ưu tiên patient identity, clinical essentials, sinh hiệu và kế hoạch; trang sau dành cho chi tiết lâm sàng, provenance, FHIR attachment và cảnh báo sử dụng. PDF đính kèm đúng Bundle JSON; API kiểm tra ownership, không cache, không tự chia sẻ. Ba section bắt buộc luôn có narrative; danh sách nguồn trống dùng `emptyReason=unavailable`, không tự khẳng định `nilknown`. Tên/DOB thiếu dùng Data Absent Reason, lab có performer unknown/DAR, status/time không có trong schema không bị gán `final` hay giờ UTC giả. INN/WHO ATC chỉ xuất khi tên thuốc khớp chính xác catalog demo; tên chưa khớp được giữ nguyên, không suy đoán mã |
| Supabase có category rõ ràng | SQL tạo 11 bảng gồm workspace, 9 nhóm nghiệp vụ và nhật ký; lưu lần khám trong một transaction |
| Kết nối project Supabase thật của chủ dự án | **Đã kết nối và kiểm chứng ghi/đọc thật** tại `gsllxxdewmksjbcnxgvp`; đủ 5 bệnh nhân, 10 lần khám, 3 bác sĩ, 12 kết quả xét nghiệm, 10 mục thuốc và 4 dịch vụ |
| Patient view đang mở nhận thay đổi | Thông báo giữa các cửa sổ cùng trình duyệt sau khi lưu; thiết bị khác kiểm tra lại mỗi 5 giây khi trang hiển thị. Tạm dừng lúc đang nhập biểu mẫu/chú thích; giữ bệnh nhân, tab và trạng thái mở thẻ |

## Kết nối Supabase

Chạy bốn migration theo thứ tự trong project đã xác nhận:

1. `supabase/migrations/20260905000000_medipass_core.sql`
2. `supabase/migrations/20260909000000_medipass_portal.sql`
3. `supabase/migrations/20260909010000_preserve_portal_demo.sql`
4. `supabase/migrations/20260909020000_visual_annotations.sql`

Endpoint `/api/portal/schema` tải gộp cả bốn. Dùng Project URL và secret key phía máy chủ trong cấu hình Sites. Không đưa secret key vào mã client, Git hay chat.

Đã chạy cả bốn migration thành công trong SQL Editor của project, xác nhận quyền server `service_role`, cấu hình `SUPABASE_URL` và `SUPABASE_SECRET_KEY` dạng secret trong runtime Sites (revision 1), triển khai và tải lại website. Portal tự chuyển dữ liệu demo hiện có của chủ dự án từ D1 sang Supabase; đã đọc trực tiếp bằng `mp_portal_read` để kiểm đếm và đối chiếu. File `.env.local` và khóa không nằm trong Git.

Đã lưu lại hồ sơ chung và một lần khám từ website đang phát hành; đọc ngược từ Supabase xác nhận phiên bản tăng và toàn bộ nội dung lâm sàng, xét nghiệm, thuốc, dịch vụ và bác sĩ được giữ nguyên. `outputs/supabase-verify.mjs verify` đã PASS với bản đối chiếu trước khi lưu. Số lần khám của chủ dự án là **10**, không phải 18.

Khi namespace Supabase của người dùng còn mới, bootstrap chuyển hồ sơ/ghi chú/góp ý hiện có từ bộ lưu D1, hoặc tạo dữ liệu mẫu nếu chưa có. Đây là nhập một lần, không đồng bộ hai chiều và không ghi đè namespace Supabase đã có. Hồ sơ D1 gốc được giữ. Không tự chuyển nhóm `medipass_*` của app cũ sang portal; nhóm này vẫn ở `/records`.

## Kiểm tra đã thực hiện

Các kết quả dưới đây ghi lại nhiều phiên bản trước. Bản workflow 12/09/2026 có
mục riêng ở cuối phần Wound. Việc tải weights gốc từ `c269a89` và kiểm tra API
với chúng trên macOS được ghi riêng, không suy ra từ QA của môi trường cũ.

- Unit tests: 9 kiểm tra riêng cho IPS gồm document/section/narrative/`unavailable`, Data Absent Reason khi thiếu nhân khẩu học, lab status/time/performer và UCUM, đổi liều rồi ngừng thuốc, không tạo reaction giả, ngày procedure đúng precision, chọn latest vital theo từng loại và PDF nhiều trang có FHIR attachment; cùng các kiểm tra portal, thuốc, xét nghiệm và wound hiện có. Bố cục PDF mới được render kiểm tra từng trang với hồ sơ ngắn 2 trang và hồ sơ dài 3 trang; không thấy chữ bị cắt, chồng lớp hoặc tràn qua header/footer.
- HL7 FHIR Validator 6.9.12: 8 fixture tổng hợp đạt 0 error/0 warning với FHIR R4 4.0.1, `hl7.fhir.uv.ips#2.0.1`, SNOMED international và `tx.fhir.org`. Kết quả này xác nhận profile của fixture, không thay thế chứng nhận sản phẩm, clinical review hay kiểm thử với hệ thống nhận độc lập.
- API local: 5 bệnh nhân, lưu/đọc Unicode tiếng Việt, trọn lần khám, xung đột phiên bản, chặn đổi bệnh nhân của lần khám, CSRF, data explorer và các trang portal. Khôi phục nội dung mẫu sau kiểm tra.
- PostgreSQL độc lập bằng PGlite: chạy thật các migration, bootstrap 5 bệnh nhân/10 lần khám, thêm người thứ 6 trong bộ nhớ, sửa hồ sơ, rollback khi lỗi ở mục con, quyền truy cập, tách workspace, giữ góp ý và không seed trùng. **Không phải xác nhận kết nối Supabase từ xa.**
- Browser QA trên `http://localhost:3001` (Wrangler chạy build production): PASS toàn bộ. Chuyển cả 5 bệnh nhân; mở các tab nhập; chọn vùng bằng chuột, lưu hai ghim cùng điểm, tải lại và mở riêng từng bình luận; bật khung điện thoại; các liên kết module; tải ảnh PNG giả lập, lưu Wound Lab và đọc lại ảnh/lịch sử; bật/tắt camera giả lập; viewport 390px không tràn ngang. Không có lỗi JavaScript chưa xử lý.
- TypeScript và production build: PASS. Toàn bộ unit test portal/IPS/thuốc/wound: 31 PASS, gồm kiểm tra đủ chú giải cho cả 5 bệnh mẫu và không tự đoán thuật ngữ lạ.
- Insurance checker local: migration D1 tạo `insurance_documents`/`insurance_analyses`; PDF SBC tổng hợp được upload vào R2, đọc đúng deductible $1,000, out-of-pocket $6,500, specialist copay $50 và MRI coinsurance 20%; tình huống MRI $4,000 cho kết quả có điều kiện, prior authorization, plan $2,400 và người dùng $1,600; tải PDF lại trả HTTP 200 dạng attachment. 4 unit tests cho extraction/calculation/fallback PASS; production build PASS.
- QA mở rộng với Supabase từ xa: PASS lưu/sửa ghi chú chung; tạo trọn lần khám có labs/thuốc/dịch vụ/bác sĩ; đọc trực tiếp RPC để đối chiếu; cửa sổ bệnh nhân 390px riêng tự nhận ghi chú và lần khám mới; ghim tại thẻ ghi chú trên mobile rồi tải lại/mở bình luận; annotation đọc trực tiếp từ `mp_feedback`. Không có lỗi JavaScript chưa xử lý. Đã dọn đúng vùng `browser-qa` và hồ sơ cũ của QA; hồ sơ của chủ dự án giữ nguyên.
- Sửa nhãn trường nhập để tên truy cập không lẫn nội dung textarea hoặc lời gợi ý. Các nhãn ổn định giúp thao tác nhập và kiểm thử chính xác.

Lỗi phát hiện khi tiếp tục phiên: QA ban đầu thất bại vì các ghim cùng điểm che nhau. Đã sửa bố trí ghim, giữ đường chỉ tới điểm gốc; thêm regression với hai bình luận cùng tọa độ và dọn bình luận của mỗi lượt QA cả khi thất bại.

QA ngày 10/09/2026 còn xác nhận trang sảnh có đúng hai lựa chọn chính và ba lối tắt, các khối giải thích bệnh/xét nghiệm xuất hiện trong Chrome, chế độ tối và mobile vẫn hoạt động. Ghim chú thích được chặn trong biên viewport để vẫn bấm được khi phần tử gốc nằm ngoài vùng đang nhìn. Full browser QA dùng phiên đăng nhập local mới; khi kiểm tra Supabase từ xa mới dùng danh tính `browser-qa` riêng và dọn fixture sau kiểm tra.

`tests/portal-api.mjs` chỉ gọi localhost. `tests/portal-supabase.mjs` dùng PGlite tạm từ npm exec và không sửa dependency của app.

`tests/browser.mjs` cần Playwright ở `outputs/qa/node_modules`. Chạy PowerShell: `$env:MEDIPASS_TEST_URL='http://localhost:3001'`, sau đó `npx --yes node@24 tests/browser.mjs`. Thêm `$env:MEDIPASS_VERIFY_SUPABASE='1'` để buộc kiểm tra Supabase thật bằng helper `tests/supabase-browser-store.mjs`. Wrangler cần secret trong `.dev.vars` cạnh file cấu hình Worker; chỉ `--env-file` không đủ để biến chúng thành Worker bindings. File secret QA nằm trong `dist/server`, bị Git bỏ qua và phải loại khỏi gói phát hành. Danh tính giả của QA chỉ được dùng ở localhost.

Ở bản 11/09/2026, Wound Lab gọi một ảnh qua API stateless và chưa tích lũy chuỗi.
Bản 12/09 đã thay phần tải ảnh bằng phiên SQLite nhiều ngày (xem dưới). Luồng
`/wounds/history` vẫn lưu R2/D1 và dùng dữ liệu khai báo; kết quả AI không tự ghi
vào Supabase hoặc hồ sơ clinician. Motion Lab vẫn chỉ có camera preview. Đồng bộ
portal vẫn kiểm tra định kỳ qua server, không dùng WebSocket Supabase Realtime.

QA tích hợp AI ngày 11/09/2026: **39 unit tests PASS**, TypeScript và production build PASS. Chrome gọi API thật trên cổng 8000 thành công; kiểm tra tải ảnh, loading/khóa form, kết quả có cấu trúc, HTTP 422, lỗi kết nối, thiếu ước tính do chất lượng ảnh, xóa kết quả cũ khi sửa form, mẫu SYN000014, giao diện tối 390px không tràn ngang, liên kết và trường nhập của màn hình lịch sử đều PASS. Đây là kiểm tra local, không triển khai site và không huấn luyện bằng ảnh bệnh nhân thật. Xem [`WOUND_AI_INTEGRATION.md`](WOUND_AI_INTEGRATION.md) để chạy lại.

Cập nhật Wound Lab Patient/Developer Mode (11/09/2026): **41 frontend unit tests và
30 Python tests PASS**, TypeScript/build PASS. Patient Mode cố định SYN000014 và
ẩn metadata/lớp ảnh; Developer Mode chọn 5 hồ sơ giả lập và gọi API với
`include_pipeline_visuals=true`. U-Net phụ đã huấn luyện 5 epoch trên mask giả lập
với background augmentation, mean IoU test giả lập 0.9346; không phải xác nhận
phân vùng ảnh lâm sàng hay giải thích feature importance của mô hình late fusion.
API giữ nguyên Clinical Brief, dùng null khi lớp ảnh phụ không sẵn sàng.
Chrome QA PASS cả hai mode, 5 lựa chọn hồ sơ, nhận ảnh Base64 thật, khóa/khôi phục
đúng bệnh nhân, chặn response sai bệnh nhân, lỗi 422/mất kết nối, ảnh không đạt,
backend cũ thiếu visuals, dark/mobile và đường dẫn lịch sử. Không có lỗi JavaScript
chưa xử lý hoặc tràn ngang ở viewport 390px.

## Wound backend follow-up — 2026-09-11

Historical verification: 69 Python tests passed, including persisted image sessions,
masked classifier inputs/percentages, multi-day deltas, baseline-dependent rules,
scab qualifications and uncertainty. New session storage is local SQLite, separate
from Supabase and the original D1/R2 history. At that revision the uploader remained
single-image; the 12 September workflow below now uses those sessions.
See [contracts, source links and handoff](WOUND_TRAJECTORY_ENGINE.md).
Earlier QA counts above describe previous versions.

## Wound workflow hiện tại — 12/09/2026

- Lưu một hoặc nhiều ảnh trong SQLite không tự hết hạn; danh sách đợt lấy từ máy chủ
  nên tải lại trang, xóa local storage hoặc mở từ điện thoại cùng LAN vẫn tìm được
  đợt của hồ sơ demo. Thêm tối đa 1.000 lần chụp/đợt, kiểm tra ảnh trùng và thời gian
  tăng dần; ngày tương đối neo theo thời điểm chụp, không lấy thứ tự file làm ngày.
- Mỗi lần lưu giữ baseline cố định, ảnh gốc, số đo hoặc trạng thái chờ và dữ liệu
  pipeline. Xem lại thumbnail/kết quả đến lần chụp đã chọn; xóa ảnh hoặc cả đợt qua
  hộp xác nhận trên desktop/mobile. API retry dùng lại ảnh đã lưu, không upload lại.
- Patient Mode đọc đủ bốn bước từ `patient_explanation.locales.vi` và có tùy chọn
  English. FPG, tưới máu và cảm giác ngoại vi là thông tin ghi trong baseline; không
  khẳng định tổn thương vi mạch qua ảnh. Alert đình trệ ≥7 ngày với diabetes hoặc
  HbA1c >8% tách khỏi flag diện tích >7 ngày trước đây. Các ngưỡng là rule nghiên cứu.
- Năm hồ sơ giữ nguyên thông tin gốc, có tổng cộng 20 lần khám giả lập bất biến.
  Accordion giữ đủ xét nghiệm/khoảng tham chiếu, số đo/can thiệp, đơn/băng và hẹn
  khám, tách rõ hồ sơ mẫu với phép đo ảnh mới. `MediPassBrand`/`MediPassBadge` dùng
  chung biểu tượng khiên sinh trắc/nhịp tim; token Clinical Indigo `#2563EB` và
  Deep Slate `#0F172A` áp dụng cho shell và workflow. Đây là mô tả implementation;
  Developer Mode mở pipeline lịch sử, phạm vi QA trình duyệt được ghi riêng.
- Web gọi `/api/wound-sessions` cùng origin rồi proxy tới Python loopback; điện
  thoại mở LAN URL cổng 3001. Không triển khai dịch vụ inference hosted hay auth thật.
- Trước khi tải checkpoint qua Git LFS, 77 Python tests có sẵn và 60 unit tests frontend PASS; TypeScript, toàn bộ
  `pnpm run lint` và `pnpm build` PASS. Chrome QA dùng session fixture tách biệt
  đã kiểm tra đủ luồng một/nhiều ảnh, phục hồi không cần localStorage, pipeline
  lịch sử, bảo toàn nội dung khám, VI/EN, xóa, retry, 390px sáng/tối, hủy chú thích
  và đồng bộ theme trong iframe. Kiểm tra localhost/SQLite thật với patient QA
  riêng xác nhận giữ nguyên byte ảnh, readback, bảo toàn ảnh khi retry lỗi,
  chặn nhầm patient/origin và xóa; fixture QA đã được dọn. Đây là QA workflow trước
  bước tải weights gốc, không phải kết quả mới cho toàn bộ trang sau pull.
- Sau khi pull `c269a89`, ba weights gốc đã được materialize bằng Git LFS và đạt
  `shasum -a 256 -c aimedic/checkpoints.sha256`. Môi trường macOS
  `outputs/wound-venv/bin/python` chạy lại **77/77 test Python có sẵn PASS**.
  `scripts/verify-wound-models.py` chạy trực tiếp chính ba model gốc qua API:
  ảnh đơn ghép baseline, hai lần chụp có delta chính xác, retry ảnh từng lưu chờ,
  pipeline lịch sử, mask và overlay, đọc lại byte ảnh sau mở lại DB, xóa đúng patient
  đều PASS trong SQLite tạm. Database người dùng không bị đọc/sửa; fixture tạm được dọn.
- Ảnh simulator mẫu sau hậu xử lý một vùng chính tạo mask 2.531 pixel: mô hạt 1.889,
  slough 459, lớp mô sẫm 183; mask có một component liên thông và đường biên được vẽ rõ;
  pixel ngoài mask trong overlay được giữ nguyên. Cùng ảnh với baseline khác có
  điểm model khác nhưng không đổi tissue counts, xác nhận luồng ghép baseline.
  Ảnh thứ hai trong QA là ảnh mẫu lật ngang, không phải ảnh hồi phục ngoài thực tế;
  tỉ lệ 10 pixel/cm do script nhập chỉ là dữ liệu thử. Kết quả này kiểm tra tích hợp,
  không xác nhận độ chính xác lâm sàng hoặc suy ra trạng thái bệnh nhân thật.
- Test Python và byte checkpoint gốc không bị sửa, không huấn luyện model thay thế.
  Luồng thiếu model vẫn lưu `pending_model`, phép đo `null`, có thông báo và nút
  phân tích lại; retry bằng checkpoint gốc đã được kiểm tra thành công.

## Đồng bộ checkpoint và nhận diện — 12/09/2026

- Đã fast-forward tới `c269a89`, giữ và khôi phục đầy đủ thay đổi local. Ba
  checkpoint Git LFS đã được tải và khớp `aimedic/checkpoints.sha256`; không sửa
  trọng số, test Python hay migration đã có.
- `MediPassBrand` dùng chung logo khiên sinh trắc/pulse; các trang dùng Clinical
  Indigo `#2563EB`, Deep Slate `#0F172A`, cùng token sáng/tối và favicon SVG.
  Màu cảnh báo và trạng thái lâm sàng vẫn được phân biệt. Sửa tương phản chữ,
  nút viền và liên kết trong portal; bản in luôn sáng dù trình duyệt đang tối.
- Phát hiện và sửa lỗi cold-start của lịch sử R2/D1: `ensureDatabase` tạo bổ sung
  bảng/index vết thương nếu thiếu, đúng schema migration `0001`. Hai regression
  SQLite trong bộ nhớ xác nhận schema và dữ liệu có sẵn không bị thay thế.
- Bản cuối: **62 unit tests TypeScript, 77 Python tests, TypeScript, lint và
  `pnpm build` PASS**. Script kiểm chứng checkpoint gốc PASS suy luận ảnh đơn,
  ghép baseline, hai lần đo, retry ảnh chờ, pipeline lịch sử và persistence.
- Chrome `tests/brand-browser.mjs` PASS **14 đường dẫn × 2 theme × 2 viewport
  (1440/390px)** sau khi nội dung tải xong: logo/màu chung, độ tương phản chữ
  được đo, bản in sáng từ chế độ tối, không tràn ngang/chồng nút, không lỗi
  JavaScript hoặc HTTP 5xx từ API cùng origin. `tests/theme-browser.mjs` và
  toàn bộ workflow `tests/wound-analyzer-browser.mjs` cũng PASS; kiểm tra workflow
  trình duyệt dùng API fixture riêng, kiểm chứng trọng số thật dùng SQLite tạm.
  Không lưu chỉnh sửa hồ sơ hay feedback trong kiểm tra giao diện này.
- Web và API được bật lại để review local. Không push hoặc triển khai website.

## Điều hướng hồ sơ trước đây — 12/09/2026

- `/records` dùng module hồ sơ cũ, không phải một cổng localhost khác. Logo trước
  đây chỉ chuyển tab nội bộ; liên kết “Care team” bị đánh dấu như đang ở portal
  bệnh viện và bị giấu trong menu điện thoại, gây khó tìm đường quay lại.
- Thêm liên kết **Cổng bệnh viện** trong header cố định, luôn thấy trên desktop
  và điện thoại; logo về sảnh `/`. Bỏ bộ chuyển cổng gây nhầm, ghi rõ module cũ
  và dữ liệu riêng. Khi mở từ `/editor` hoặc `/patient`, cả rail và mobile giữ
  `?patient=` để quay về đúng hồ sơ. Tham số chỉ dùng cho điều hướng; API và
  danh tính dữ liệu `/records` không thay đổi, không ghép hai kho bệnh nhân.
- `tests/records-navigation-browser.mjs` PASS Chrome 1440/390/360px × sáng/tối:
  bấm đi/về từ bệnh nhân không phải người đầu tiên, mở trực tiếp không cần lịch
  sử Back, logo về sảnh, menu mobile, query được encode/lặp và khung điện thoại
  cùng origin. Nút đạt vùng chạm 44px, không tràn ngang, không lỗi JavaScript.
  API dùng fixture trong bộ nhớ và chặn mọi thao tác ghi; không sửa hồ sơ thật.
  Đã xem ảnh chụp desktop và mobile tối. TypeScript, lint, 62 unit tests và
  `pnpm build` PASS; localhost 3001 được bật lại. Không push/deploy.

## Đọc góp ý trong phiên làm việc tiếp theo

Mở `/feedback` hoặc GET `/api/feedback` trong phiên xác thực của chủ dự án. D1 lưu feedback trong `portal_documents` với `kind='feedback'`; khi cấu hình Supabase, dữ liệu nằm ở `mp_feedback`. Đọc nội dung trước khi sửa, không tự đánh dấu hoàn thành trước khi thay đổi được kiểm tra. Website không tự chạy Codex nền.

Đây là chuyển vai mô phỏng trong một không gian riêng, chưa có tài khoản/phân quyền độc lập cho bệnh viện và từng bệnh nhân thật.
