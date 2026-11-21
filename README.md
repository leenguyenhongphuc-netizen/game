# Vườn Việt

Game nông trại trực tuyến trên web: nhận một mảnh vườn ở vùng trồng gần nơi bạn sống, trồng đặc sản của vùng theo đúng quy trình, bán cho thương lái hoặc bày sạp giao thương với cả nước.

Tài liệu thiết kế: [docs/GDD.md](docs/GDD.md).

## Chạy trên máy

Cần Node.js 22.18 trở lên và PostgreSQL.

```bash
npm install
createdb vuon_dev

# Cửa sổ 1: máy chủ (tự tạo bảng và nạp giá mẫu khi khởi động)
DATABASE_URL=postgres://localhost/vuon_dev TIME_SCALE=3600 npm run dev:server

# Cửa sổ 2: giao diện, mở http://localhost:5173
npm run dev:web
```

`TIME_SCALE=3600` làm một giờ trong game còn một giây, để thử trọn một vụ trong vài chục giây. Bỏ biến này khi chạy thật.

## Chạy thật

```bash
npm run build          # dựng giao diện vào web/dist
NODE_ENV=production DATABASE_URL=... ADMIN_TOKEN=... npm start
```

Máy chủ phục vụ luôn giao diện đã dựng ở cổng `PORT` (mặc định 3000). Cần đặt sau HTTPS vì cookie đăng nhập bật cờ `secure` khi `NODE_ENV=production`, và trình duyệt chỉ cho định vị trên HTTPS.

| Biến môi trường | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL (bắt buộc). |
| `ADMIN_TOKEN` | Mã cho cổng nạp giá, tối thiểu 16 ký tự. Không đặt thì cổng nạp giá bị tắt. |
| `TIME_SCALE` | Hệ số tăng tốc thời gian, mặc định 1. |
| `PORT`, `HOST` | Cổng và địa chỉ lắng nghe. |

## Nạp giá tham chiếu

```bash
curl -X POST http://localhost:3000/api/admin/prices \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"ticks":[{"specialtyId":"toi_ly_son","price":120000,"source":"tên nguồn giá"}]}'
```

Mã đặc sản xem trong `shared/catalog.ts`.

## Kiểm thử

```bash
createdb vuon_test
TEST_DATABASE_URL=postgres://localhost/vuon_test npm test
npm run typecheck
```

Kiểm thử xoá sạch cơ sở dữ liệu được trỏ tới, đừng trỏ vào dữ liệu thật.

## Cấu trúc

- `shared/` — danh mục vùng trồng, đặc sản, quy trình và luật chơi dùng chung.
- `server/` — máy chủ Fastify và lược đồ PostgreSQL.
- `web/` — giao diện React; vườn là cảnh 3D dựng bằng Three.js (`web/src/scene/`), toàn bộ mô hình tạo bằng mã, không dùng tệp hình ngoài.
