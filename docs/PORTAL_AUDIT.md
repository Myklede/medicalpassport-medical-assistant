# Đối chiếu yêu cầu portal — cập nhật 10/09/2026

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
| Dữ liệu trực quan | `/data`: lọc bệnh nhân, xem dữ liệu thực theo 9 nhóm, mở lại hồ sơ; cấu trúc Supabase thu gọn bên dưới |
| Đối chiếu thuốc xuyên quốc gia | `/medications`: 20 nhóm thuốc demo giữa Việt Nam, Ấn Độ, Mỹ và Trung Quốc; chuẩn hóa theo INN/ATC, so hàm lượng, dạng dùng và Rx/OTC, luôn đánh dấu tá dược chưa xác nhận và yêu cầu pharmacist/người kê đơn kiểm tra. Đây không phải catalog lưu hành thời gian thực hay kết luận tương đương điều trị |
| Xuất Hộ chiếu Y tế Quốc tế | Nút **Xuất IPS** trên `/editor` và `/patient` tạo PDF song ngữ cùng FHIR R4 document Bundle theo IPS 2.0.1. PDF đính kèm đúng Bundle JSON; API kiểm tra ownership, không cache, không tự chia sẻ. Ba section bắt buộc luôn có narrative; danh sách nguồn trống dùng `emptyReason=unavailable`, không tự khẳng định `nilknown`. Tên/DOB thiếu dùng Data Absent Reason, lab có performer unknown/DAR, status/time không có trong schema không bị gán `final` hay giờ UTC giả. INN/WHO ATC chỉ xuất khi tên thuốc khớp chính xác catalog demo; tên chưa khớp được giữ nguyên, không suy đoán mã |
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

- Unit tests: 9 kiểm tra riêng cho IPS gồm document/section/narrative/`unavailable`, Data Absent Reason khi thiếu nhân khẩu học, lab status/time/performer và UCUM, đổi liều rồi ngừng thuốc, không tạo reaction giả, ngày procedure đúng precision, chọn latest vital theo từng loại và PDF nhiều trang có FHIR attachment; cùng các kiểm tra portal, thuốc, xét nghiệm và wound hiện có.
- HL7 FHIR Validator 6.9.12: 8 fixture tổng hợp đạt 0 error/0 warning với FHIR R4 4.0.1, `hl7.fhir.uv.ips#2.0.1`, SNOMED international và `tx.fhir.org`. Kết quả này xác nhận profile của fixture, không thay thế chứng nhận sản phẩm, clinical review hay kiểm thử với hệ thống nhận độc lập.
- API local: 5 bệnh nhân, lưu/đọc Unicode tiếng Việt, trọn lần khám, xung đột phiên bản, chặn đổi bệnh nhân của lần khám, CSRF, data explorer và các trang portal. Khôi phục nội dung mẫu sau kiểm tra.
- PostgreSQL độc lập bằng PGlite: chạy thật các migration, bootstrap 5 bệnh nhân/10 lần khám, thêm người thứ 6 trong bộ nhớ, sửa hồ sơ, rollback khi lỗi ở mục con, quyền truy cập, tách workspace, giữ góp ý và không seed trùng. **Không phải xác nhận kết nối Supabase từ xa.**
- Browser QA trên `http://localhost:3001` (Wrangler chạy build production): PASS toàn bộ. Chuyển cả 5 bệnh nhân; mở các tab nhập; chọn vùng bằng chuột, lưu hai ghim cùng điểm, tải lại và mở riêng từng bình luận; bật khung điện thoại; các liên kết module; tải ảnh PNG giả lập, lưu Wound Lab và đọc lại ảnh/lịch sử; bật/tắt camera giả lập; viewport 390px không tràn ngang. Không có lỗi JavaScript chưa xử lý.
- TypeScript và production build: PASS. Toàn bộ unit test portal/IPS/thuốc/wound: 31 PASS, gồm kiểm tra đủ chú giải cho cả 5 bệnh mẫu và không tự đoán thuật ngữ lạ.
- QA mở rộng với Supabase từ xa: PASS lưu/sửa ghi chú chung; tạo trọn lần khám có labs/thuốc/dịch vụ/bác sĩ; đọc trực tiếp RPC để đối chiếu; cửa sổ bệnh nhân 390px riêng tự nhận ghi chú và lần khám mới; ghim tại thẻ ghi chú trên mobile rồi tải lại/mở bình luận; annotation đọc trực tiếp từ `mp_feedback`. Không có lỗi JavaScript chưa xử lý. Đã dọn đúng vùng `browser-qa` và hồ sơ cũ của QA; hồ sơ của chủ dự án giữ nguyên.
- Sửa nhãn trường nhập để tên truy cập không lẫn nội dung textarea hoặc lời gợi ý. Các nhãn ổn định giúp thao tác nhập và kiểm thử chính xác.

Lỗi phát hiện khi tiếp tục phiên: QA ban đầu thất bại vì các ghim cùng điểm che nhau. Đã sửa bố trí ghim, giữ đường chỉ tới điểm gốc; thêm regression với hai bình luận cùng tọa độ và dọn bình luận của mỗi lượt QA cả khi thất bại.

QA ngày 10/09/2026 còn xác nhận trang sảnh có đúng hai lựa chọn chính và ba lối tắt, các khối giải thích bệnh/xét nghiệm xuất hiện trong Chrome, chế độ tối và mobile vẫn hoạt động. Ghim chú thích được chặn trong biên viewport để vẫn bấm được khi phần tử gốc nằm ngoài vùng đang nhìn. Full browser QA dùng phiên đăng nhập local mới; khi kiểm tra Supabase từ xa mới dùng danh tính `browser-qa` riêng và dọn fixture sau kiểm tra.

`tests/portal-api.mjs` chỉ gọi localhost. `tests/portal-supabase.mjs` dùng PGlite tạm từ npm exec và không sửa dependency của app.

`tests/browser.mjs` cần Playwright ở `outputs/qa/node_modules`. Chạy PowerShell: `$env:MEDIPASS_TEST_URL='http://localhost:3001'`, sau đó `npx --yes node@24 tests/browser.mjs`. Thêm `$env:MEDIPASS_VERIFY_SUPABASE='1'` để buộc kiểm tra Supabase thật bằng helper `tests/supabase-browser-store.mjs`. Wrangler cần secret trong `.dev.vars` cạnh file cấu hình Worker; chỉ `--env-file` không đủ để biến chúng thành Worker bindings. File secret QA nằm trong `dist/server`, bị Git bỏ qua và phải loại khỏi gói phát hành. Danh tính giả của QA chỉ được dùng ở localhost.

Wound Lab có lưu ảnh và đánh giá theo quy tắc; Motion Lab có camera preview. Ảnh/tệp vẫn ở kho riêng R2, dữ liệu Wound Lab vẫn ở D1. Các mô hình AI phân tích ảnh/chuyển động chưa được tích hợp. Đồng bộ tự động portal dùng kiểm tra định kỳ qua server, không cấp khóa service_role cho trình duyệt và không dùng WebSocket Supabase Realtime.

## Đọc góp ý trong phiên làm việc tiếp theo

Mở `/feedback` hoặc GET `/api/feedback` trong phiên xác thực của chủ dự án. D1 lưu feedback trong `portal_documents` với `kind='feedback'`; khi cấu hình Supabase, dữ liệu nằm ở `mp_feedback`. Đọc nội dung trước khi sửa, không tự đánh dấu hoàn thành trước khi thay đổi được kiểm tra. Website không tự chạy Codex nền.

Đây là chuyển vai mô phỏng trong một không gian riêng, chưa có tài khoản/phân quyền độc lập cho bệnh viện và từng bệnh nhân thật.
