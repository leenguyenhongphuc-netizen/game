---
name: ui-test
description: Kiểm thử và sửa giao diện game Vườn Việt trên nhiều thiết bị (iPhone, iPad, máy tính). Dùng khi được yêu cầu "test giao diện", "kiểm tra hiển thị trên điện thoại/iPad", khi vừa sửa bố cục/CSS/màn hình mới, hoặc trước khi triển khai bản mới.
---

# Kiểm thử giao diện đa thiết bị

Mục tiêu: không màn nào bị tràn, bị cắt, bị phóng to, đè lên nhau hoặc khó bấm, trên 8 cỡ màn hình:
iPhone SE (375×667), iPhone 15 dọc (393×852), iPhone 15 Pro Max (430×932), iPhone ngang (852×393), iPad mini (768×1024), iPad Pro ngang (1366×1024), máy tính (1280×720, 1920×1080).

## Quy trình

1. **Chạy máy chủ thử** (dựng bản mới, cơ sở dữ liệu trống, cổng 3100):
   ```bash
   tools/ui-test/serve.sh
   ```
   Cần PostgreSQL cục bộ (`service postgresql start` nếu chưa chạy).

2. **Chạy bộ kiểm**:
   ```bash
   node tools/ui-test/run.mjs                    # đủ 8 thiết bị, khoảng 10–15 phút khi không có GPU
   node tools/ui-test/run.mjs --only iphone-15   # một thiết bị khi đang sửa dở
   ```
   Mỗi thiết bị tạo một tài khoản mới và đi qua: đăng nhập → chia sẻ vị trí → xác nhận địa điểm → vòng quay → xóm → đứng trên ô trống → chọn giống → cây đang lớn → Kho, Đơn hàng, Xưởng → Chợ, Bảng giá → Bạn bè, Hợp tác xã → Du lịch, chọn phương tiện, Sổ tem → Trang trí → **trang bị phóng to 115%** (xóm và Kho) → Hồ sơ.

   Mọi phép đo tính theo phần màn hình đang nhìn thấy (`visualViewport`). Bước phóng to giả lập Safari trên iPhone, vốn bỏ qua `user-scalable=no`: khung game phải bám theo phần nhìn thấy (xem `web/src/viewport.ts`), không được dùng `position: fixed; inset: 0` hay `100vw`/`100vh` cho khung ngoài cùng.

3. **Đọc `tools/ui-test/out/report.md`**. Quy tắc tự động:
   | Quy tắc | Ý nghĩa |
   |---|---|
   | `tran-ngang` | Trang cuộn ngang được. |
   | `nut-ngoai-man-hinh`, `khoi-tran-man-hinh` | Nút hoặc khối giao diện nằm ngoài khung nhìn. |
   | `khoi-de-nhau` | Hai khối nổi (thanh trên, nhiệm vụ, thời tiết, thanh nút, cửa sổ…) đè lên nhau. |
   | `nut-qua-nho` | Nút nhỏ hơn 38×38 trên thiết bị cảm ứng (cảnh báo). |
   | `chu-bi-cat` | Chữ bị cắt mà không có dấu ba chấm (cảnh báo). |
   | `loi-console`, `khong-di-tiep-duoc` | Lỗi JavaScript, hoặc luồng bị kẹt ở một màn. |

4. **Tự xem ảnh**, vì quy tắc tự động không thấy được cái xấu. Với mỗi thiết bị, mở bằng công cụ Read ít nhất các ảnh: `vong-quay`, `xom`, `dung-tren-o-trong`, `chon-giong`, `kho`, `chon-phuong-tien`, `trang-tri`. Tìm: chữ quá nhỏ hoặc quá to, khoảng trống vô lý, nhân vật bị che, màu khó đọc trên nền 3D, nút sát mép, bố cục màn ngang bị dồn.

5. **Sửa** trong `web/src/styles.css` và các tệp `web/src/*.tsx`. Nguyên tắc:
   - Ô nhập và ô chọn luôn có `font-size` từ 16px.
   - Khối nổi dùng `max-width: calc(100% - 16px)` và `env(safe-area-inset-*)`; kích thước chữ lớn dùng `clamp()`.
   - Không để gì cố định che vùng giữa màn hình, nơi người chơi kéo để điều khiển nhân vật.
   - Màn ngang thấp (cao dưới 430px) phải thu gọn thanh trên và thanh nút.
   - Sửa nguyên nhân gốc, không ẩn phần tử để qua bài kiểm.

6. **Chạy lại** bước 1–4 cho tới khi `report.md` không còn lỗi và ảnh trông ổn trên mọi thiết bị. Sau đó chạy `npm run typecheck` và `npm test`.

## Giới hạn

- Trình duyệt thử là Chromium không có GPU, **không phải Safari**: không đo được độ mượt và không tái hiện hết hành vi riêng của iPhone. Bộ kiểm sạch lỗi KHÔNG có nghĩa là máy thật ổn; khi báo cho người dùng phải nói rõ là mới kiểm trên giả lập. Lỗi chỉ có trên máy thật thì cần ảnh chụp từ người dùng, rồi tìm cách giả lập lại hành vi đó trong bộ kiểm (như bước phóng to).
- Vai trò do vòng quay giao ngẫu nhiên, nên màn có xe tải hay xưởng không phải lần nào cũng xuất hiện.
- Không triển khai lên Vercel trong quy trình này trừ khi người dùng yêu cầu.

## Thêm màn mới vào bộ kiểm

Trong `tools/ui-test/run.mjs`, thêm một `step(...)` gọi `shot('ten-man')` sau khi đưa giao diện tới màn đó. Nếu màn có khối nổi mới, thêm bộ chọn CSS của nó vào mảng `blocks` và các cặp cần kiểm đè nhau trong hàm `audit`.
