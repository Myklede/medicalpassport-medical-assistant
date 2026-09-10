# Đối chiếu yêu cầu portal — 09/09/2026

Yêu cầu mới của chủ dự án về portal và Supabase thay thế các giới hạn MVP cũ trong PLAN.md.

| Yêu cầu | Kết quả trong bản nâng cấp |
| --- | --- |
| 5 bệnh nhân giả lập, có lịch sử khám | 5 bệnh nhân, mỗi người 2 lần khám; 3 bác sĩ giả lập |
| Bệnh viện thêm/sửa bệnh nhân | `/editor`: hồ sơ chung, bệnh nền, dị ứng, liên hệ |
| Nhập/sửa trọn lần khám | Ngày, lý do, triệu chứng, chẩn đoán và giải thích, chỉ số, labs, thuốc, dịch vụ, kế hoạch, hẹn khám và bác sĩ |
| Không lặp bệnh nền và dị ứng | Lưu theo bệnh nhân; hiện một lần trên đầu hồ sơ, gồm ghi chú |
| Mỗi lần khám một khung | Thẻ mở/thu gọn, trang đầy đủ và In/Lưu PDF qua hộp thoại in |
| Chuyển sang góc nhìn từng bệnh nhân | Giữ đúng bệnh nhân trong URL khi đổi góc nhìn; patient view chỉ đọc |
| Chú giải xét nghiệm | Giữ tên chuyên môn; tên dễ hiểu, lời bác sĩ, nguồn MedlinePlus; phân loại theo khoảng trên phiếu, không suy diễn chẩn đoán |
| Rà soát thuốc đang dùng | Tổng hợp theo tên/liều/đường dùng; có nút lấy vào lần khám mới để đánh dấu tiếp tục/ngừng/hoàn tất |
| Góp ý trực tiếp trên web | Bật Chú thích giao diện, di chuột chọn vùng, bấm để ghim bình luận; lưu selector, tọa độ tương đối, trích đoạn, bệnh nhân và lần khám. Các ghim trùng điểm được tách ra để bấm từng bình luận |
| Nút điều hướng không hoạt động | Thay điều hướng client gây lỗi runtime Vinext bằng liên kết tải trang; đã thử cả 5 bệnh nhân, feedback, data, records, Wound Lab và Motion Lab trên build production |
| Giao diện điện thoại | Web responsive và nút Giao diện điện thoại với khung tương tác 360/390/430px; trở lại desktop giữ bệnh nhân. Chưa có ứng dụng native iOS/Android |
| Dữ liệu trực quan | `/data`: lọc bệnh nhân, xem dữ liệu thực theo 9 nhóm, mở lại hồ sơ; cấu trúc Supabase thu gọn bên dưới |
| Supabase có category rõ ràng | SQL tạo 11 bảng gồm workspace, 9 nhóm nghiệp vụ và nhật ký; lưu lần khám trong một transaction |
| Kết nối project Supabase thật của chủ dự án | Project đã xác nhận: `gsllxxdewmksjbcnxgvp`. **Chưa hoàn tất**: cần chạy SQL và thêm `SUPABASE_SECRET_KEY` vào runtime Sites |

## Kết nối Supabase

Chạy bốn migration theo thứ tự trong project đã xác nhận:

1. `supabase/migrations/20260905000000_medipass_core.sql`
2. `supabase/migrations/20260909000000_medipass_portal.sql`
3. `supabase/migrations/20260909010000_preserve_portal_demo.sql`
4. `supabase/migrations/20260909020000_visual_annotations.sql`

Endpoint `/api/portal/schema` tải gộp cả bốn. Dùng Project URL và secret key phía máy chủ trong cấu hình Sites. Không đưa secret key vào mã client, Git hay chat.

Kiểm tra lại ngày 09/09/2026: `.env.local` chưa có secret key; runtime Sites chưa có biến môi trường. Vì vậy dữ liệu đang lưu ở D1 của demo, **chưa ghi vào project Supabase từ xa**. Giao diện và thông báo lưu hiện ghi rõ trạng thái này. Thiết lập key chỉ trong `.env.local` chưa đủ cho website đã phát hành; cần thiết lập runtime Sites rồi triển khai lại.

Khi namespace Supabase của người dùng còn mới, bootstrap chuyển hồ sơ/ghi chú/góp ý hiện có từ bộ lưu D1, hoặc tạo dữ liệu mẫu nếu chưa có. Đây là nhập một lần, không đồng bộ hai chiều và không ghi đè namespace Supabase đã có. Hồ sơ D1 gốc được giữ. Không tự chuyển nhóm `medipass_*` của app cũ sang portal; nhóm này vẫn ở `/records`.

## Kiểm tra đã thực hiện

- Unit tests: khoảng xét nghiệm, đơn vị thiếu, glossary chính xác, thuốc đã ngừng, ngày sinh, ID trùng, liên kết góp ý an toàn và các kiểm tra module cũ.
- API local: 5 bệnh nhân, lưu/đọc Unicode tiếng Việt, trọn lần khám, xung đột phiên bản, chặn đổi bệnh nhân của lần khám, CSRF, data explorer và các trang portal. Khôi phục nội dung mẫu sau kiểm tra.
- PostgreSQL độc lập bằng PGlite: chạy thật các migration, bootstrap 5 bệnh nhân/10 lần khám, thêm người thứ 6 trong bộ nhớ, sửa hồ sơ, rollback khi lỗi ở mục con, quyền truy cập, tách workspace, giữ góp ý và không seed trùng. **Không phải xác nhận kết nối Supabase từ xa.**
- Browser QA trên `http://localhost:3001` (Wrangler chạy build production): PASS toàn bộ. Chuyển cả 5 bệnh nhân; mở các tab nhập; chọn vùng bằng chuột, lưu hai ghim cùng điểm, tải lại và mở riêng từng bình luận; bật khung điện thoại; các liên kết module; tải ảnh PNG giả lập, lưu Wound Lab và đọc lại ảnh/lịch sử; bật/tắt camera giả lập; viewport 390px không tràn ngang. Không có lỗi JavaScript chưa xử lý.
- TypeScript và production build: PASS. Unit tests portal/wound: 15 PASS.

Lỗi phát hiện khi tiếp tục phiên: QA ban đầu thất bại vì các ghim cùng điểm che nhau. Đã sửa bố trí ghim, giữ đường chỉ tới điểm gốc; thêm regression với hai bình luận cùng tọa độ và dọn bình luận của mỗi lượt QA cả khi thất bại.

`tests/portal-api.mjs` chỉ gọi localhost. `tests/portal-supabase.mjs` dùng PGlite tạm từ npm exec và không sửa dependency của app.

`tests/browser.mjs` cần Playwright ở `outputs/qa/node_modules`. Chạy PowerShell: `$env:MEDIPASS_TEST_URL='http://localhost:3001'`, sau đó `npx --yes node@24 tests/browser.mjs`. Danh tính giả của QA chỉ được dùng ở localhost. Wound Lab có lưu ảnh và đánh giá theo quy tắc; Motion Lab có camera preview. Các mô hình AI phân tích ảnh/chuyển động chưa được tích hợp.

## Đọc góp ý trong phiên làm việc tiếp theo

Mở `/feedback` hoặc GET `/api/feedback` trong phiên xác thực của chủ dự án. D1 lưu feedback trong `portal_documents` với `kind='feedback'`; khi cấu hình Supabase, dữ liệu nằm ở `mp_feedback`. Đọc nội dung trước khi sửa, không tự đánh dấu hoàn thành trước khi thay đổi được kiểm tra. Website không tự chạy Codex nền.

Đây là chuyển vai mô phỏng trong một không gian riêng, chưa có tài khoản/phân quyền độc lập cho bệnh viện và từng bệnh nhân thật.
