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
| Góp ý trực tiếp trên web | Nút toàn website, vị trí trang/lần khám, loại, ưu tiên, danh sách, trạng thái và ghi chú xử lý |
| Dữ liệu trực quan | `/data`: lọc bệnh nhân, xem dữ liệu thực theo 9 nhóm, mở lại hồ sơ; cấu trúc Supabase thu gọn bên dưới |
| Supabase có category rõ ràng | SQL tạo 11 bảng gồm workspace, 9 nhóm nghiệp vụ và nhật ký; lưu lần khám trong một transaction |
| Kết nối project Supabase thật của chủ dự án | Project đã xác nhận: `gsllxxdewmksjbcnxgvp`. **Chưa hoàn tất**: cần chạy SQL và thêm `SUPABASE_SECRET_KEY` vào runtime Sites |

## Kết nối Supabase

Chạy hai migration theo thứ tự trong project đã xác nhận:

1. `supabase/migrations/20260909000000_medipass_portal.sql`
2. `supabase/migrations/20260909010000_preserve_portal_demo.sql`

Endpoint `/api/portal/schema` tải gộp cả hai. Dùng Project URL và secret key phía máy chủ trong cấu hình Sites. Không đưa secret key vào mã client, Git hay chat.

Khi namespace Supabase của người dùng còn mới, bootstrap chuyển hồ sơ/ghi chú/góp ý hiện có từ bộ lưu D1, hoặc tạo dữ liệu mẫu nếu chưa có. Đây là nhập một lần, không đồng bộ hai chiều và không ghi đè namespace Supabase đã có. Hồ sơ D1 gốc được giữ. Không tự chuyển nhóm `medipass_*` của app cũ sang portal; nhóm này vẫn ở `/records`.

## Kiểm tra đã thực hiện

- Unit tests: khoảng xét nghiệm, đơn vị thiếu, glossary chính xác, thuốc đã ngừng, ngày sinh, ID trùng, liên kết góp ý an toàn và các kiểm tra module cũ.
- API local: 5 bệnh nhân, lưu/đọc Unicode tiếng Việt, trọn lần khám, xung đột phiên bản, chặn đổi bệnh nhân của lần khám, CSRF, data explorer và các trang portal. Khôi phục nội dung mẫu sau kiểm tra.
- PostgreSQL độc lập bằng PGlite: chạy thật các migration, bootstrap 5 bệnh nhân/10 lần khám, thêm người thứ 6 trong bộ nhớ, sửa hồ sơ, rollback khi lỗi ở mục con, quyền truy cập, tách workspace, giữ góp ý và không seed trùng. **Không phải xác nhận kết nối Supabase từ xa.**

`tests/portal-api.mjs` chỉ gọi localhost. `tests/portal-supabase.mjs` dùng PGlite tạm từ npm exec và không sửa dependency của app.

## Đọc góp ý trong phiên làm việc tiếp theo

Mở `/feedback` hoặc GET `/api/feedback` trong phiên xác thực của chủ dự án. D1 lưu feedback trong `portal_documents` với `kind='feedback'`; khi cấu hình Supabase, dữ liệu nằm ở `mp_feedback`. Đọc nội dung trước khi sửa, không tự đánh dấu hoàn thành trước khi thay đổi được kiểm tra. Website không tự chạy Codex nền.

Đây là chuyển vai mô phỏng trong một không gian riêng, chưa có tài khoản/phân quyền độc lập cho bệnh viện và từng bệnh nhân thật.
