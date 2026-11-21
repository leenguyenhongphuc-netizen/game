# Triển khai: Supabase + Vercel + Cloudflare

| Dịch vụ | Vai trò |
|---|---|
| **Supabase** | Cơ sở dữ liệu PostgreSQL. Bảng được tạo tự động khi máy chủ khởi động. |
| **Vercel** | Phục vụ giao diện (`web/dist`) và chạy máy chủ dưới dạng một hàm serverless ở `/api/*`. |
| **Cloudflare** | Tên miền, DNS và lớp chắn phía trước Vercel. |

> Cấu hình này mới được thử tại chỗ (gói máy chủ bằng `npm run build:api` rồi gọi hàm qua một máy chủ HTTP giả lập). **Chưa triển khai thật lên Vercel lần nào**, nên lần đầu có thể cần chỉnh.

## 1. Supabase

1. Tạo dự án mới, chọn vùng gần Việt Nam (Singapore).
2. Vào **Project Settings → Database → Connection string**, chọn chế độ **Transaction pooler** (cổng 6543) và chép chuỗi kết nối. Hàm serverless mở kết nối liên tục nên phải đi qua pooler.

## 2. Vercel

1. Nhập kho mã `game` từ GitHub. Vercel đọc `vercel.json` nên không cần chỉnh lệnh dựng.
2. Thêm biến môi trường:

| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối pooler của Supabase. |
| `DATABASE_SSL` | `no-verify` (pooler của Supabase dùng chứng chỉ riêng). |
| `ADMIN_TOKEN` | Chuỗi ngẫu nhiên từ 16 ký tự, dùng cho cổng nạp giá. |

3. Triển khai, rồi mở `/api/health` để kiểm tra; phải trả `{"ok":true}`.

## 3. Cloudflare

1. Thêm tên miền vào Cloudflare, tạo bản ghi `CNAME` trỏ về `cname.vercel-dns.com`, rồi khai báo tên miền đó trong Vercel.
2. Đặt chế độ SSL là **Full (strict)**.
3. Không bật bộ nhớ đệm cho `/api/*`.

Game cần HTTPS: trình duyệt chỉ cho định vị trên HTTPS và cookie đăng nhập có cờ `secure`.

## Giới hạn của cách chạy serverless

- **Giới hạn tần suất** đếm trong bộ nhớ từng phiên bản hàm nên không chính xác tuyệt đối. Nên bật thêm quy tắc giới hạn của Cloudflare cho `/api/auth/*`.
- **Chưa có thời gian thực.** Giao diện hỏi lại máy chủ mỗi 15 giây. Muốn thấy bạn bè chạy trong xóm theo thời gian thực thì bước tiếp theo là dùng Supabase Realtime.

## Phương án khác: một máy chủ riêng

`npm run build && NODE_ENV=production TRUST_PROXY=1 DATABASE_URL=... npm start` chạy cả giao diện lẫn API trên một tiến trình Node, đặt sau Caddy hoặc Cloudflare. Xem `README.md`.
