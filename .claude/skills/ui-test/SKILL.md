---
name: ui-test
description: Kiểm thử và sửa giao diện game Vườn Việt trên nhiều thiết bị (iPhone, iPad, máy tính). Dùng khi được yêu cầu "test giao diện", "kiểm tra hiển thị trên điện thoại/iPad", khi vừa sửa bố cục/CSS/màn hình mới, hoặc trước khi triển khai bản mới.
---

# Kiểm thử giao diện đa thiết bị

Mục tiêu: không màn nào bị tràn, bị cắt, bị phóng to, đè lên nhau hoặc khó bấm, trên mọi cỡ màn hình.

Có hai bộ kiểm, cùng dùng luật trong `tools/ui-test/audit.mjs`:
- **Ma trận thiết bị** `tools/ui-test/matrix.mjs` (dùng SAU MỖI LẦN sửa CSS/bố cục): 19 cỡ màn hình — iPhone SE, 15, 15 Pro Max dọc/ngang, **mở trong Safari** (chiều cao trừ thanh địa chỉ/thanh công cụ), **Android** 360×800 và 412×915 (kể cả khi mở trong Chrome), Android ngang, iPad mini/iPad Pro dọc và ngang, laptop 1366×768, màn 1920×1080. Đi qua đăng ký, vòng quay, vườn, rồi mở **mọi cửa sổ và bấm qua mọi tab** (Kho theo cả 3 vai, Chợ, Xóm, Du lịch, Trang trí, Hồ sơ cuộn tới cuối, màn giới thiệu sân sát hạch). Khoảng 4–6 phút mỗi thiết bị khi không có GPU.
- **Bộ kiểm luồng** `tools/ui-test/run.mjs`: 8 thiết bị, đi trọn các hoạt cảnh (lái xe, du lịch, xuất khẩu…).

## Quy trình

1. **Chạy máy chủ thử** (dựng bản mới, cơ sở dữ liệu trống, cổng 3100):
   ```bash
   tools/ui-test/serve.sh
   ```
   Cần PostgreSQL cục bộ (`service postgresql start` nếu chưa chạy).

2. **Chạy bộ kiểm**:
   ```bash
   (cd web && npx vite --port 5190 &)                      # trang thử sân sát hạch chỉ có ở Vite dev
   node tools/ui-test/matrix.mjs                           # ma trận 19 thiết bị
   node tools/ui-test/matrix.mjs --nhom dien-thoai         # chỉ điện thoại (hoặc may-tinh-bang, may-tinh)
   node tools/ui-test/matrix.mjs --only android-360,iphone-se-safari --out tools/ui-test/out-m1
   # chạy song song: chia --only làm 3–4 phần, mỗi phần một --out riêng

   node tools/ui-test/run.mjs                    # đủ 8 thiết bị, khoảng 60–90 phút khi không có GPU (các hoạt cảnh chạy chậm)
   node tools/ui-test/run.mjs --only iphone-15   # một thiết bị khi đang sửa dở
   ```
   Mỗi thiết bị tạo một tài khoản mới và đi qua: đăng nhập → chia sẻ vị trí → xác nhận địa điểm → vòng quay → xóm → đứng trên ô trống → chọn giống → cây đang lớn → Kho, Đơn hàng, Xưởng → Chợ, Bảng giá → Bạn bè, Hợp tác xã → Du lịch, chọn phương tiện, Sổ tem → Trang trí → **trang bị phóng to 115%** (xóm và Kho) → Hồ sơ.

   Sau đó tài khoản được bật quyền thử nghiệm (qua `psql` vào cơ sở dữ liệu thử) và đi tiếp: công cụ thử nghiệm → đứng cạnh xe tải → lên xe (xăng, ETC) → kế hoạch chuyến xe → **lái xe trọn chuyến** (chụp theo từng pha) → tới nơi, vườn mẫu → thẻ cách trồng từng bước → quầy trưng bày, giá đất, mua đất → về nhà với nhiều vườn → **ba chuyến du lịch bằng ba phương tiện** (chụp từng cảnh 1–5, kiểm không còn nút Bỏ qua) → sân thượng → ban đêm.
   Thêm `--nhanh` để bỏ các hoạt cảnh dài (lái xe, du lịch) khi chỉ sửa bố cục.

   Mọi phép đo tính theo phần màn hình đang nhìn thấy (`visualViewport`). Bước phóng to giả lập Safari trên iPhone, vốn bỏ qua `user-scalable=no`: khung game phải bám theo phần nhìn thấy (xem `web/src/viewport.ts`), không được dùng `position: fixed; inset: 0` hay `100vw`/`100vh` cho khung ngoài cùng.

3. **Đọc `report.md`** (`tools/ui-test/out-matrix/` hoặc `tools/ui-test/out/`). Quy tắc tự động (lỗi trừ khi ghi cảnh báo):
   | Quy tắc | Ý nghĩa |
   |---|---|
   | `tran-ngang` | Trang cuộn ngang được. |
   | `cuon-ngang-trong-khung` | Một khung (cửa sổ, thẻ) cuộn ngang được — đúng lỗi "bảng bị lệch trái, mất chữ đầu". Chỉ dải tab/lọc có chủ đích (`.tabs, .chips, .table-wrap, .seed-bar, .shop-cats, .veh-filter, .hscroll, [data-scroll-x]`) được cuộn ngang. Báo kèm "thủ phạm" là phần tử lòi xa nhất. |
   | `bi-cat-ngang` | Nội dung rộng hơn khung có `overflow: hidden/clip` nên bị cắt mất bên phải (trừ khung toàn màn hình như `.game`, `.exam`). |
   | `tran-khoi-khung` | Phần tử con lòi ra ngoài mép một khung có viền hoặc nền (thẻ, viên giá, cửa sổ) quá 1,5 px — đúng lỗi "viên giá lòi khỏi thẻ đơn hàng". |
   | `nut-ngoai-man-hinh`, `khoi-tran-man-hinh` | Nút hoặc khối giao diện nằm ngoài khung nhìn. |
   | `khoi-de-nhau` | Hai khối nổi (thanh trên, nhiệm vụ, thời tiết, thanh nút, cửa sổ…) đè lên nhau. |
   | `nut-qua-nho` | Vùng bấm dưới 44×44 trên máy cảm ứng: lỗi khi dưới 40, cảnh báo 40–43. Ô đánh dấu nằm trong nhãn thì tính cả nhãn. |
   | `chu-bi-cat` | Chữ bị cắt mà không có dấu ba chấm. |
   | `loi-console`, `khong-di-tiep-duoc` | Lỗi JavaScript, hoặc luồng bị kẹt ở một màn. |

4. **Tự xem ảnh**, vì quy tắc tự động không thấy được cái xấu. Với mỗi thiết bị, mở bằng công cụ Read ít nhất các ảnh: `vong-quay`, `xom`, `dung-tren-o-trong`, `chon-giong`, `chi-tiet-cay`, `kho`, `chon-phuong-tien`, `trang-tri`, `tren-xe-tai`, mọi ảnh `lai-xe-*`, `nhieu-vuon`, mọi ảnh `du-lich-*`. Tìm: chữ quá nhỏ hoặc quá to, khoảng trống vô lý, nhân vật bị che, màu khó đọc trên nền 3D, nút sát mép, bố cục màn ngang bị dồn.

5. **Sửa** trong `web/src/styles.css` và các tệp `web/src/*.tsx`. Cuối `styles.css` có **lớp bố cục chống tràn** áp cho mọi màn: chỉ ô chữ mới `width: 100%` (ô đánh dấu/radio giữ 22 px), khung cuộn chỉ cuộn dọc và `overflow-wrap: anywhere`, con của hàng flex `min-width: 0`, `.row-line/.row-head` tự xuống dòng (phần `.grow` cơ sở 9rem, giá/nút rơi xuống dưới khi hết chỗ), dải tab xuống hàng, vùng bấm 44 px. Màn mới nên dùng sẵn các lớp này (`.row`, `.row-line`, `.grow`, `.price`, `.tabs`) thay vì tự viết flex riêng. Nguyên tắc:
   - Ô nhập và ô chọn luôn có `font-size` từ 16px.
   - Khối nổi dùng `max-width: calc(100% - 16px)` và `env(safe-area-inset-*)`; kích thước chữ lớn dùng `clamp()`.
   - Không để gì cố định che vùng giữa màn hình, nơi người chơi kéo để điều khiển nhân vật.
   - Màn ngang thấp (cao dưới 430px) phải thu gọn thanh trên và thanh nút.
   - Sửa nguyên nhân gốc, không ẩn phần tử để qua bài kiểm.

6. **Chạy lại** bước 1–4 cho tới khi `report.md` không còn lỗi và ảnh trông ổn trên mọi thiết bị. Sau đó chạy `npm run typecheck` và `npm test`.

## Giới hạn

- Trình duyệt thử là Chromium không có GPU, **không phải Safari**: không đo được độ mượt và không tái hiện hết hành vi riêng của iPhone. Bộ kiểm sạch lỗi KHÔNG có nghĩa là máy thật ổn; khi báo cho người dùng phải nói rõ là mới kiểm trên giả lập. Lỗi chỉ có trên máy thật thì cần ảnh chụp từ người dùng, rồi tìm cách giả lập lại hành vi đó trong bộ kiểm (như bước phóng to).
- Luôn chạy `tools/ui-test/serve.sh` trước mỗi lượt để có cơ sở dữ liệu trống và đúng bản vừa dựng.
- Không triển khai lên Vercel trong quy trình này trừ khi người dùng yêu cầu.

## Thêm màn mới vào bộ kiểm

Trong `tools/ui-test/run.mjs`, thêm một `step(...)` gọi `shot('ten-man')` sau khi đưa giao diện tới màn đó. Nếu màn có khối nổi mới, thêm bộ chọn CSS của nó vào mảng `blocks` và các cặp cần kiểm đè nhau trong hàm `audit`.

## Các móc dùng cho hoạt cảnh và màn lái xe

Bộ kiểm đặt sẵn trước khi tải trang: `window.__rideStep = 0.15` (hoạt cảnh du lịch, xuất khẩu chạy nhanh), `window.__driveAuto = true` (xe tự lái theo đúng tốc độ cho phép) và `window.__drivePolice = false` (không gặp chốt cảnh sát). Muốn chụp cảnh bị phạt, tầm nhìn buồng lái hay số lùi thì dùng `window.__drive` (`setThrottle`, `setBrake`, `setGear`, `setView`, `simulate`). Trang `ride-test.html?xuat=<đường>` phát riêng hoạt cảnh xuất khẩu của từng đường (`xe_tai`, `container`, `tau_hoa`, `hang_khong`, `tau_nho`, `tau_lon`).

Tài khoản thử được nạp sẵn hàng qua `/api/test/stock` để đi qua bước thu mua sỉ và xuất khẩu. Một lượt đủ 8 thiết bị mất hơn 30 phút: chạy làm hai nửa song song bằng `--only` và `--out` riêng, hoặc dùng `--nhanh` khi chỉ cần soát bố cục.
