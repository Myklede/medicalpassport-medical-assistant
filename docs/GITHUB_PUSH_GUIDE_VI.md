# Hướng dẫn tự push MediPass lên GitHub

Repository dự kiến:

`https://github.com/Myklede/medipass-medical-assistant-demo`

Remote `origin` trong workspace đã trỏ đúng repository này và nhánh làm việc là `main`.

## Trước khi push

Mở terminal tại thư mục dự án trong Visual Studio Code và chạy:

```powershell
npx --yes node@24 scripts/pre-push-check.mjs
```

Lệnh này kiểm tra:

- phiên bản Node;
- remote GitHub;
- file bí mật và thư mục build không bị Git theo dõi;
- dấu cách/lỗi patch trong Git;
- TypeScript;
- 15 unit tests của portal và Wound Lab;
- production build.

Nếu hiện `READY TO PUSH`, xem các commit sẽ được gửi:

```powershell
git status
git log --oneline origin/main..HEAD
```

Sau đó tự push:

```powershell
git push origin main
```

## Nếu GitHub yêu cầu đăng nhập

Không dán Supabase key hoặc API key vào hộp đăng nhập GitHub. Hãy đăng nhập GitHub qua trình duyệt/Git Credential Manager. Nếu Git báo không có quyền ghi, kiểm tra tài khoản đang đăng nhập có quyền với repository `Myklede/medipass-medical-assistant-demo`.

Nếu remote bị thay đổi ngoài ý muốn, kiểm tra:

```powershell
git remote -v
```

Giá trị fetch và push phải là:

```text
https://github.com/Myklede/medipass-medical-assistant-demo.git
```

## File không được đưa lên GitHub

Các mục sau đã nằm trong `.gitignore`:

- `.env.local` và các file `.env*` chứa khóa;
- `node_modules`;
- `dist`, `.vinext`, `.next`, `.wrangler`;
- `outputs` chứa ảnh/test artifact và gói phát hành.

Kiểm tra nhanh `.env.local` vẫn bị bỏ qua:

```powershell
git check-ignore -v .env.local
git ls-files .env.local
```

Lệnh thứ hai phải không in ra gì.

## Cài trên laptop khác

```powershell
git clone https://github.com/Myklede/medipass-medical-assistant-demo.git
cd medipass-medical-assistant-demo
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm run dev
```

Điền cấu hình riêng vào `.env.local`; không gửi khóa qua chat và không commit file này. Website Sites đang phát hành có secret runtime riêng, nên push GitHub không tự cập nhật website đang chạy.
