# Cách chạy và mở MediPass

## Mở bản trên mạng

Bản demo đã phát hành có địa chỉ cố định:

<https://medipass-medical-assistant-demo.thnguyen7807.chatgpt.site>

Địa chỉ này mở được bằng Chrome, Edge, Safari hoặc trình duyệt điện thoại và không cần giữ VS Code chạy. Đây là Sites private demo nên trình duyệt có thể yêu cầu đăng nhập.

Các đường dẫn chính:

- Cổng bệnh viện: `/editor`
- Góc nhìn bệnh nhân: `/patient`
- Khung thử điện thoại: `/mobile`
- Dữ liệu và Supabase: `/data`
- Yêu cầu chỉnh sửa: `/feedback`
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
npx --yes node@24 node_modules/vinext/dist/cli.js dev --host 0.0.0.0 --port 3001
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

Lệnh `pnpm run demo` cho phép thiết bị khác trong mạng nội bộ truy cập. Lấy địa chỉ IPv4 của máy tính bằng `ipconfig`, rồi mở trên điện thoại theo dạng:

```text
http://DIA-CHI-IP-CUA-MAY:3001/patient
```

Ví dụ: `http://192.168.1.25:3001/patient`. Windows Firewall có thể hỏi cho phép Node.js truy cập mạng riêng; chỉ cần cho phép trên mạng Private nếu muốn thử bằng điện thoại.

## Chế độ Sáng/Tối

Nút `Tối` hoặc `Sáng` nằm nổi ở góc màn hình trên mọi trang. Lựa chọn được lưu trong trình duyệt và đồng bộ giữa giao diện desktop với iframe thử điện thoại. Khi chưa từng chọn, app dùng thiết lập sáng/tối của hệ điều hành.

## Cấu hình dữ liệu local

Các khóa Supabase nằm trong `.env.local`, không nằm trong Git. Khi chuyển sang máy khác, tạo file này từ `.env.example` rồi điền cấu hình riêng. Không commit hoặc gửi khóa bí mật lên GitHub.
