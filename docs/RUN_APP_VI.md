# Cách chạy và mở MediPass

## Mở bản trên mạng

Bản demo đã phát hành có địa chỉ cố định:

<https://medipass-medical-assistant-demo.thnguyen7807.chatgpt.site>

Địa chỉ này mở được bằng Chrome, Edge, Safari hoặc trình duyệt điện thoại và không cần giữ VS Code chạy. Đây là Sites private demo nên trình duyệt có thể yêu cầu đăng nhập.

Các đường dẫn chính:

- Trang sảnh: `/`
- Cổng bệnh viện: `/editor`
- Góc nhìn bệnh nhân: `/patient`
- Xuất IPS: chọn bệnh nhân ở `/editor` hoặc `/patient`, bấm **Xuất IPS**, rồi tải PDF hoặc FHIR JSON. PDF có sẵn JSON Bundle đính kèm nhưng một số trình đọc PDF có thể ẩn attachment.
- Khung thử điện thoại: `/mobile`
- Dữ liệu và Supabase: `/data`
- Yêu cầu chỉnh sửa: `/feedback`
- Đối chiếu thuốc quốc tế: `/medications`
- Kiểm tra chính sách bảo hiểm: `/insurance`
- Wound Lab: `/wounds`
- Motion Lab: `/therapy`

## Chạy trên máy bằng cổng 3001

Yêu cầu Node.js từ `22.13` trở lên và pnpm. Trong Terminal của VS Code, đứng tại thư mục dự án rồi chạy:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm run demo
```

Sau khi Terminal báo server sẵn sàng, mở:

<http://localhost:3001/editor>

Server local chỉ tồn tại khi cửa sổ Terminal này còn chạy. Dừng server bằng `Ctrl+C`. Cổng `3001` được cố định trong script `demo` của `package.json`, nên không cần hỏi AI cổng nào ở lần sau.

Nếu Node mặc định trên máy quá cũ, có thể chạy app bằng Node 24 mà không cài Node toàn hệ thống:

```powershell
npx --yes node@24 node_modules/vinext/dist/cli.js dev --hostname 0.0.0.0 --port 3001
```

## Mở đúng bằng Chrome trên Windows

Server không phụ thuộc trình duyệt. Edge xuất hiện trước đây chỉ vì công cụ tự động hóa đã chọn trình duyệt mặc định. Bạn có thể dán địa chỉ vào Chrome hoặc chạy:

```powershell
Start-Process "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" "http://localhost:3001/editor"
```

Nếu Chrome được cài cho riêng tài khoản Windows:

```powershell
Start-Process "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe" "http://localhost:3001/editor"
```

## Mở từ điện thoại trong cùng Wi-Fi

Lệnh `pnpm run demo` dùng `--hostname 0.0.0.0` để thiết bị trong mạng nội bộ truy cập. Lấy IPv4 bằng `ipconfig` trên Windows hoặc xem chi tiết Wi-Fi trong System Settings trên macOS, rồi mở trên điện thoại theo dạng:

```text
http://DIA-CHI-IP-CUA-MAY:3001/patient
```

Ví dụ: `http://192.168.1.25:3001/patient`. Windows Firewall có thể hỏi cho phép Node.js truy cập mạng riêng; chỉ cần cho phép trên mạng Private nếu muốn thử bằng điện thoại.

## Wound Lab: lưu ảnh một ngày hoặc nhiều ngày

Ba checkpoint AI gốc từ commit `c269a89` đã được tải bằng Git LFS, đối chiếu SHA-256
và kiểm tra suy luận thành công trên checkout macOS hiện tại. Sau khi clone trên máy
khác, cài Git LFS rồi chạy tại thư mục dự án:

```bash
git lfs install --local
git lfs pull
shasum -a 256 -c aimedic/checkpoints.sha256
outputs/wound-venv/bin/python -B scripts/verify-wound-models.py
```

Script cuối kiểm tra bằng ảnh giả lập và SQLite tạm, không chạm database đang dùng
hoặc thay đổi weights. Cần môi trường Python đã cài requirements theo
[aimedic/README.md](../aimedic/README.md).

Ngoài web server, mở Terminal thứ hai tại thư mục dự án và chạy Python. Môi trường macOS hiện tại:

```bash
outputs/wound-venv/bin/python -B aimedic/main.py
```

Mở `http://localhost:3001/wounds` trên máy tính hoặc `http://DIA-CHI-IP-CUA-MAY:3001/wounds` trên điện thoại cùng Wi-Fi. Trình duyệt gọi API cùng địa chỉ web; web server chuyển tiếp tới Python `127.0.0.1:8000`, nên không cần mở cổng Python cho điện thoại.

Chọn/tạo đợt theo dõi, nhập đúng thời điểm chụp và bấm **Lưu & phân tích**. Lần sau mở lại đợt từ danh sách máy chủ rồi thêm ảnh. Tối đa 1.000 ảnh/đợt; ảnh, mốc ngày và dữ liệu được giữ trong `outputs/wound-sessions.sqlite3` qua lần khởi động lại, không phụ thuộc local storage của trình duyệt. Nút xóa ảnh hoặc xóa cả đợt đều có bước xác nhận và dùng được trên desktop/điện thoại.

Giữ cả `pnpm run demo` và Python chạy trong hai Terminal. Nếu chuyển sang máy chưa tải đủ Git LFS hoặc model tạm không sử dụng được, ảnh vẫn được lưu ở trạng thái **chờ mô hình**, không có số đo giả. Khi model hoạt động trở lại, bấm **Phân tích lại ảnh đã lưu** để chạy trên chính ảnh đó. Luồng phân tích lại đã được kiểm tra với weights gốc. Xem vị trí checkpoint và hướng dẫn Windows tại [WOUND_AI_INTEGRATION.md](WOUND_AI_INTEGRATION.md). SQLite này thuộc demo local; dữ liệu không tự sao lưu lên Supabase. Trang hosted chưa có dịch vụ Python tương ứng.

## Chế độ Sáng/Tối

Nút `Tối` hoặc `Sáng` nằm nổi ở góc màn hình trên mọi trang. Lựa chọn được lưu trong trình duyệt và đồng bộ giữa giao diện desktop với iframe thử điện thoại. Khi chưa từng chọn, app dùng thiết lập sáng/tối của hệ điều hành.

## Cấu hình dữ liệu local

Các khóa Supabase nằm trong `.env.local`, không nằm trong Git. Khi chuyển sang máy khác, tạo file này từ `.env.example` rồi điền cấu hình riêng. Không commit hoặc gửi khóa bí mật lên GitHub.
