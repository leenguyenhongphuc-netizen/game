# Sổ bàn giao — Vườn Việt

Ghi lại trạng thái dự án để phiên làm việc sau (kể cả khi đổi mô hình) nối tiếp không bị gián đoạn.
Cập nhật mỗi khi xong một đợt. Mới nhất ở trên cùng của phần "Nhật ký".

## Cách làm việc với người dùng (quy ước đã thống nhất)

- Trả lời bằng tiếng Việt, xưng "mình", gọi "bạn", dùng đại từ trung tính.
- Người dùng thử trên **iPhone/iPad thật** và gửi ảnh/video. Mọi kiểm tra của mình là **Chromium giả lập không GPU** — luôn nói rõ điều này, không nói "đã chạy mượt trên máy thật".
- Sau mỗi đợt: chạy bộ kiểm, triển khai, rồi báo **từng khung kèm ảnh** (gửi ảnh từ scratchpad).
- Không gộp PR (#1, nhánh `claude/dreamy-lovelace-0twwum`), không đụng repo khác.
- Commit kết thúc bằng hai dòng ghi công (Co-Authored-By + Claude-Session) theo nhắc của hệ thống; không ghi tên mô hình vào commit/PR/mã.
- **Không bao giờ** ghi mật khẩu, khoá hay thông tin đăng nhập vào repo. Đã khuyên người dùng đổi mật khẩu CSDL từng lộ trong chat.
- Video người dùng: dùng `ffmpeg` trích khung (tile) và đo độ đều chuyển động (so khung liên tiếp, tương quan pha) — xem cách làm ở phần "Chẩn đoán giật".

## Hạ tầng

- Monorepo npm workspaces: `shared/` (luật chơi, danh mục), `server/` (Fastify 5 + pg, Node chạy TS trực tiếp), `web/` (React + Vite + Three.js), `api/` + `vercel.json`.
- Production: https://vuon-viet-rho.vercel.app (Vercel; CSDL Postgres trên Supabase dùng chung với dự án khác, schema riêng `vuon_viet` — chỉ chạy SELECT khi soi, không động bảng của dự án kia). Schema tự tạo idempotent khi máy chủ chạy.
- Triển khai (đẩy nhánh KHÔNG tự triển khai): từ một bản sao sạch (git worktree ở scratchpad) chạy `vercel deploy --prod` theo `docs/DEPLOY.md`; khoá Vercel do proxy của môi trường tự chèn, không bao giờ hỏi người dùng dán khoá. Sau đó kiểm `/api/health` và đăng nhập tài khoản thử nghiệm của người dùng qua `POST /api/auth/login` (cookie).
- Kiểm thử máy chủ: `npm test` (cần Postgres cục bộ: `service postgresql start`; máy hay khởi động lại làm Postgres tắt).
- Kiểm giao diện: `bash tools/ui-test/serve.sh` (build + máy chủ thử cổng 3100, CSDL `vuon_ui`) rồi `node tools/ui-test/run.mjs [--nhanh] --only iphone-15-pro-max,iphone-15-ngang --out tools/ui-test/out-x`. Một lượt đủ 8 thiết bị > 30 phút → chia hai nửa chạy song song. Hướng dẫn chi tiết: `.claude/skills/ui-test/SKILL.md`.
- Trang thử độc lập: `drive-test.html`, `ride-test.html`, `sight-test.html`, `exam-test.html`, `map-test.html`, `e-test.html`, `ui-test.html`, `u2/u4/u5-test.html`; tham số `?fps=1` hiện ô đo khung hình; `?gio=`, `?thoitiet=`, `?santhuong=1`, `?xuong=1`.
- Kling AI (tạo ảnh, qua kết nối của người dùng): khoảng 4 credit/ảnh, còn ít credit — báo chi phí trước khi tạo nhiều. Bộ hình vườn kiểu tranh vẽ (`web/public/art/garden/`) **không dùng nữa** — người dùng chọn giữ 3D.

## Bản đồ mã (chỗ hay sửa)

- Vườn 3D: `web/src/scene/World.ts` (rất lớn; nhiều nhánh cùng sửa → chỉ Edit đoạn nhỏ), `plants.ts`, `zones.ts`, `factory.ts`, `houses.ts`/`wardrobe.ts`/`rides.ts` (đồ mua sắm), `actions.ts` (động tác làm việc), `batch.ts` (gộp lưới theo màu đỉnh).
- Hiệu năng: `web/src/perf.ts` (ngân sách điểm ảnh, bộ điều tiết bậc chất lượng; khoá lưu `vv-q2-level`; phép thử `node tools/ui-test/governor-test.mjs`).
- Lái xe: `web/src/drive/DriveScene.ts`, `DriveGame.tsx`, `DriveExtras.ts`; sân thi: `ExamCourse.ts`, `ExamYard.ts`, `ExamGame.tsx`; hoạt cảnh: `Ride*`, `TaxiRide.ts`, `Export*`, `ImportRide.tsx`.
- Tham quan: `web/src/sight/SightScene.ts`, `SightKit.ts`, `SightWalk.tsx`, `guide.ts`, `sets/*.ts` (13 địa danh Đà Nẵng + Lý Sơn). Danh mục: `shared/sights.ts`.
- Giao diện chính: `web/src/App.tsx` (rất lớn), các bảng: `panels.tsx`, `trade.tsx` (buôn bán, xuất khẩu), `workshop.tsx`, `sights.tsx` (tham quan, siêu thị), `vehicles.tsx` (bãi xe, bằng lái), `shopping.tsx`, `custom.tsx` (Tủ đồ), `progress.tsx`, `fusion.tsx`, `upgrades.tsx`, `passport.tsx`, `vital.tsx`, `build.tsx`.
- Luật/dữ liệu: `shared/rules.ts` (rất lớn), `shared/vehicles.ts`, `shared/progress.ts`, `shared/shop.ts`, `shared/items.ts`, `shared/catalog.ts`.
- Máy chủ: `server/src/app.ts` (rất lớn), `vehicles.ts`, `progress.ts`, `shopping.ts`, `schema.ts`. Tài liệu thiết kế: `docs/GDD.md`.

## Chẩn đoán giật (đã học được)

- Video màn hình iPhone 60 khung/giây: nếu gần như khung nào cũng mới mà vẫn "giật" → lỗi nằm ở **nhịp chuyển động** (camera/bước thời gian), không phải máy yếu. Đo tự tương quan của độ thay đổi giữa khung: đỉnh ở độ trễ 2–3 = chỉ cập nhật 30/20 lần mỗi giây.
- Đã sửa: camera theo thời gian thật (không lerp theo khung), bộ điều tiết không khoá nhịp 30 vì khung trễ lúc tải, bỏ hiệu ứng mờ HUD khi chạm, hầm đường bộ.
- Thanh cuộn gốc (`overflow: auto`) nằm đè canvas WebGL bị Chromium vẽ lệch → dải nền trống; dùng `web/src/dragScroll.ts` (kéo tay) cho thanh nổi trên cảnh.

## Việc đang mở (cập nhật 23/11/2026, đợt phản hồi lúc 15:30)

Người dùng báo (ảnh + video ngày 23/11):
1. **Vẫn còn cảm giác lag khi đi vào khu nhà/sân thượng.** Đo video: khung đều 60/giây, camera trượt đều 1–2 px/khung → không rớt khung. Nghi phạm: **răng cưa/nhấp nháy** (di động tắt MSAA khi tỉ lệ điểm ảnh ≥ 1,9; vạch kẻ, mép vỉa mảnh lấp lánh), **bóng đổ rung** (mặt trời bám theo nấc 2 m, bản đồ bóng thấp), hạt sỏi trên mặt đường lấp lánh.
2. **Ảnh 1 — hiển thị không đồng bộ:** bong bóng chữ "Tỉa cành tạo…" là viên trắng rộng nhưng chữ bị cắt (đo chữ trước khi phông tải xong?), toast "Đã chăm 5 ô" còn trong khi dòng nhiệm vụ và thanh dưới nói việc khác.
3. **Ảnh 2 — siêu thị:** "Tỉnh này chưa có siêu thị" → mọi tỉnh cần siêu thị; chủ xưởng (và vai khác?) được **mua đất xây siêu thị hoặc xưởng** ở tỉnh khác.
4. **Ảnh 3 — lỗi màu:** khi lái qua cầu, mặt cầu như trong suốt thấy nước sông xuyên qua; "nhiều nơi bị vậy".
5. **Ảnh 4–6 — xuất khẩu:** muốn **gộp nhiều loại trái cây trong một lô**; xây **công ty xuất nhập khẩu NPC** đặt đơn và đi thu mua để cân bằng game; đơn hàng của xưởng/đơn thu mua hiện **giá trị quá thấp** so với lời xuất khẩu (mất cân bằng) → làm lại kinh tế cho đàng hoàng.
6. **Thi sa hình:** đồ hoạ xấu; **vô-lăng khó điều khiển, quá nhạy** → giảm độ khó (trợ lái, bắt dính, vô-lăng chậm, góc nhìn rõ).
7. **Trạm dừng/cây xăng:** phải có **nhánh rẽ riêng**, đỗ vào bãi, **xuống xe đi bộ** vào cửa hàng mua nước/vệ sinh; đổ xăng thì tới trụ, **cầm vòi bơm** và tính tiền; xe điện tương tự với trụ sạc. **Giảm số lần dừng nghỉ** (hiện quá nhiều, gây phiền).
8. ✅ (nhánh D2, chờ App nối) **Nông dân quy mô lớn:** nâng vườn lên **hàng trăm/hàng nghìn ô**, mua **máy cày**, công cụ; **trực thăng** bay xem ruộng; **drone** rải phân, phun thuốc.
9. **Cân bằng mọi vai** (phần nông dân: xong ở D2 — xem GDD "Nông trại quy mô lớn", `node tools/farm-sim.ts`) (nông dân, chủ xưởng, thương lái) — không vai nào lấn át.

## Nhật ký

- **23/11 (Opus, nhánh kinh tế):** xử lý việc mở 3, 5 và phần kinh tế của 9 — siêu thị ở mọi tỉnh, siêu thị riêng/xưởng chi nhánh mua đất ở tỉnh khác, xuất khẩu gộp nhiều mặt hàng một lô, 8 công ty xuất nhập khẩu NPC đặt hợp đồng, đơn hàng theo cấp và vai, giá xuất khẩu hạ + sức mua có hạn + giá dao động, sức chứa mẻ máy. Mô phỏng `tools/econ-sim.mjs`, bảng trước/sau trong GDD mục "Cân bằng kinh tế". Mã: `shared/economy.ts`, `server/src/economy.ts`, `web/src/contracts.tsx`, `web/src/properties.tsx`; kiểm thử `server/test/economy.test.ts` (CSDL riêng `vuon_test_econ`, đổi bằng `TEST_ECON_DATABASE_URL`). Còn chờ: nối thẻ Hợp đồng và Tài sản trong App, workshop.tsx giới hạn ô kg theo `machine.batchKg`, nhánh cánh đồng hạ nhịp/năng suất theo đề xuất.
- **23/11 (Opus, nhánh D2 — nông trại lớn):** cánh đồng theo khối 100 ô (tối đa 40 khối = 4.000 ô, chỉ nhà nông, từ cấp 5), máy tưới/cày/gieo/gặt, drone (chỉ vùng nhà), thuê nhân công, trực thăng thuê/mua. Luật `shared/farm.ts`, máy chủ `server/src/farm.ts` (bảng `fields`, `farm_machines`, `field_jobs`; kiểm thử `server/test/farm.test.ts`), bảng `web/src/fields.tsx`, cảnh `web/src/scene/fields.ts` + `World.setFields()`, hoạt cảnh `web/src/drive/HeliTour.tsx`, trang thử `fields-test.html` (`?gia=2000` dữ liệu giả). 2.000 ô chỉ thêm 3 lần vẽ. **Chưa nối vào App.tsx**: thêm nút mở `<FieldsPanel me refresh onTour onFields={(d) => world.setFields(d.fields)} />` cho nhà nông, và `{tour && <HeliTour tour={tour} onDone={() => setTour(null)} />}`.
- **23/11 (Opus):** triển khai bản `55b84be`: hoạt ảnh trồng/chăm/thu hàng loạt theo cấp, thu mua theo tải trọng xe (nguồn 40 tấn/ngày, giá bậc thang, ép giá khi xả, hao đường dài, thùng lạnh), bằng lái có hạn/điểm/thi/đổi, sân thi sa hình 11 bài, đồ mua sắm hiện lên nhân vật/nhà/xe + Tủ đồ, sửa dải nền dưới HUD. Bộ kiểm đầy đủ iPhone dọc+ngang 0 lỗi; 59/59 kiểm thử máy chủ.
- **22–23/11 (Fable):** tham quan 13 địa danh (Hội An dựng bằng ảnh Kling), taxi ghế sau, ra đảo bằng tàu, hộ chiếu/cấp bậc 30 cấp, thể lực, xưởng máy + máy nhập khẩu + dung hợp, xe tải nhiều loại + xe điện + trạm dừng, mua sắm, màn vườn mới (thanh giống, HUD 2 hàng), chống giật nhiều đợt.
- Mô hình Fable hết hạn mức tới 26/11 22:00 UTC; đang làm tiếp bằng Opus.
