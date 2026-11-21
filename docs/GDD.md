# Vườn Việt — Tài liệu thiết kế game

> "Vườn Việt" là tên tạm. Bản này mô tả cả phần đã dựng (đánh dấu **Đã có**) và phần dự kiến (**Dự kiến**).

## 1. Tầm nhìn

Một game nông trại trực tuyến chạy trên web, nơi **vị trí thật của người chơi quyết định họ trồng được gì**. Ai ở vùng nào thì trồng đặc sản vùng đó, rồi giao thương với cả nước.

Ba mục tiêu, phải đạt cùng lúc để game tồn tại được:

1. **Vui**: vòng trồng – chăm – thu – bán đủ cuốn để người chơi quay lại mỗi ngày.
2. **Hiểu nông sản Việt**: mỗi loại cây có quy trình canh tác từng bước, người chơi hiểu vì sao trái đó có giá đó.
3. **Bảng giá tham chiếu**: giá trong game bám giá thật ngoài đời theo tỉ lệ 1:1, về lâu dài thành nơi tiểu thương và nhà vườn tham khảo và tự báo giá.

## Các quyết định đã chốt và trạng thái

| Quyết định | Cách làm trong game | Trạng thái |
|---|---|---|
| Vị trí hiện theo xã/phường, không lộ vị trí người chơi | Người chơi chọn xã, phường từ danh sách 3.321 đơn vị sau sáp nhập 2025; máy chủ chỉ lưu tên đó và ô lưới ~2 km. Đổi được trong Hồ sơ. | Đã có |
| Người ở thành phố có vai trò riêng | Định vị trong trung tâm 7 thành phố lớn thì được làm vườn sân thượng và chọn vai: thương lái (hàng phương xa +10%), chủ sạp (có khách vãng lai mua hàng trên sạp), chủ xưởng (chế biến nhanh gấp đôi, 4 chỗ làm). | Đã có |
| Đặc sản gắn theo vùng trồng; Đà Lạt là vùng đặc biệt | 53 vùng trồng. Đà Lạt có 13 đặc sản gồm trái cây, rau củ và 6 loại hoa, có quy trình trồng hoa riêng. | Đã có |
| Thời gian nén | Mỗi vụ 10–48 giờ thật, chia đều cho các bước. | Đã có |
| NPC có tên và logo | Sáu doanh nghiệp thu mua hư cấu, tên chơi chữ, logo là biểu tượng. Xem ghi chú bên dưới. | Đã có, tên cần bạn duyệt |
| Thời tiết và mùa vụ thật theo vùng | Thời tiết đổi mỗi 3 giờ. Theo tháng thật: hạn mặn miền Nam (tháng 2–4), bão miền Trung và đảo (9–11), mưa lũ miền Trung (10–11), sương muối miền Bắc (12–1), nắng nóng (6–7). Mỗi loại cây có tháng chính vụ; thu đúng vụ được thêm 15% sản lượng. | Đã có, số liệu mùa vụ cần chuyên gia rà |
| Được mùa mất giá khi cả máy chủ trồng cùng loại | Giá thương lái giảm theo số ô đang trồng và lượng đã bán của đặc sản đó trên toàn máy chủ, tối đa 30%. Thanh chọn giống cảnh báo trước khi trồng. | Đã có |
| Hợp tác xã gom hàng nhận đơn lớn | Mỗi hợp tác xã có một đơn lớn 7 ngày từ doanh nghiệp xuất khẩu; thành viên góp hàng, đủ đơn thì mỗi người được thưởng 25% phần mình góp. | Đã có |
| Chợ phiên, chợ nổi theo lịch tuần | Chợ phiên thứ Bảy và Chủ nhật (+10%, mọi miền). Chợ nổi thứ Tư (+15%, chỉ miền Nam). | Đã có |
| Du lịch vườn | Mua vé tới vùng khác, ghé vườn, phụ thu hoạch (được chia 10% sản lượng làm quà vườn), mua tại sạp, mua đặc sản làm quà. | Đã có |

**Về tên doanh nghiệp NPC:** quyết định ban đầu là biến tấu tên và logo thương hiệu thật. Mình đã dùng tên hư cấu hoàn toàn, không nhại thương hiệu nào, vì tên nhại vẫn có thể bị coi là gây nhầm lẫn nhãn hiệu. Danh sách nằm ở `NPCS` trong `shared/catalog.ts`; nếu bạn vẫn muốn hướng nhại, bạn đưa danh sách tên cụ thể và nên hỏi luật sư trước.

Ngoài ra đã có: đơn hàng cá nhân theo ngày (đơn thu mua, giỏ quà biếu, mâm ngũ quả), xưởng chế biến cho mọi người chơi, sổ tem đặc sản, quà tặng bạn bè.

**Chưa có:** tác tử AI lấy giá thật (giá vẫn là giá mẫu), thấy bạn bè theo thời gian thực và trò chuyện, chăn nuôi, trang trí nhà và sạp, âm thanh, nạp tiền, mô hình do hoạ sĩ làm.

## 2. Trụ cột thiết kế

| Trụ cột | Ý nghĩa trong game |
|---|---|
| Đất gắn với nơi sống | Lô đất đầu tiên nằm ở vùng trồng gần vị trí thật nhất. |
| Vùng nào trái nấy | Mỗi vùng trồng chỉ có đặc sản của vùng. Muốn có trái vùng khác phải mua, hoặc mua đất ở đó. |
| Làm đúng thì được giá | Chăm sóc đúng hạn cho hàng Loại 1; trễ thì xuống Loại 2, Loại 3 và giá giảm. |
| Giá thật | Tiền trong game tính bằng đồng, giá tham chiếu lấy từ thị trường thật. |

## 3. Vòng chơi

1. **Nhận đất** — tạo tài khoản, cho phép định vị, nhận lô đất 750 m² (30 ô, mỗi ô 25 m²). **Đã có**
2. **Trồng** — chọn đặc sản của vùng, trả tiền giống, làm bước đầu của quy trình. **Đã có**
3. **Chăm** — quay lại làm từng bước khi đến giờ (mỗi vụ từ 10 đến 48 giờ thật). **Đã có**
4. **Thu hoạch** — nông sản vào kho, kèm hạng chất lượng. **Đã có**
5. **Bán** — bán ngay cho thương lái, hoặc bày lên sạp trước nhà với giá tự đặt. **Đã có**
6. **Mở rộng** — có tiền thì mua đất ở vùng khác để trồng loại khác, ghé thăm vườn người khác. **Đã có** (mua đất, ghé thăm)
7. **Đơn hàng, chế biến, sưu tầm** — lý do để mua hàng của nhau (mục 8). **Dự kiến**

## 4. Vị trí và quyền riêng tư

- Trình duyệt xin quyền định vị một lần khi nhận đất.
- Máy chủ **làm tròn toạ độ về ô lưới 0,02°** (khoảng 2 km) rồi mới lưu. Toạ độ gốc không được lưu.
- Người chơi khác chỉ thấy tên vùng trồng, không thấy ô lưới.
- Không cho định vị, hoặc đang ở nước ngoài: tự chọn vùng trồng từ danh sách.
- Mỗi tài khoản chỉ nhận đất miễn phí một lần; mỗi vùng chỉ có một lô.

**Còn thiếu:** tên xã/phường. Hiện vị trí được gắn vào vùng trồng gần nhất theo khoảng cách. Để hiện "vườn ở xã X" cần bộ dữ liệu ranh giới xã sau sáp nhập 2025.

**Rủi ro:** giả mạo GPS để chọn vùng có đặc sản đắt. Vì đã cho tự chọn vùng nên giả mạo không đem lại lợi thế nào thêm; nếu sau này có phần thưởng theo vị trí thật thì cần xét lại.

## 5. Vùng trồng và đặc sản

Danh mục nằm ở `shared/catalog.ts`: **53 vùng trồng, 136 đặc sản, 56 loại cây**, phủ đủ **34 tỉnh, thành phố** (theo sắp xếp hành chính 2025) và bốn đảo: Cát Bà, Lý Sơn, Côn Đảo, Phú Quốc.

Đặc sản gắn với **vùng trồng** chứ không gắn với tên tỉnh, vì tên tỉnh đã đổi sau sáp nhập còn vùng trồng thì không. Ví dụ:

| Vùng trồng | Tỉnh hiện nay | Đặc sản |
|---|---|---|
| Hàm Thuận Nam | Lâm Đồng (Bình Thuận cũ) | Thanh long Bình Thuận |
| Ninh Phước | Khánh Hòa (Ninh Thuận cũ) | Nho, táo xanh, tỏi Phan Rang, măng tây xanh |
| Đảo Lý Sơn | Quảng Ngãi | Tỏi Lý Sơn, hành tím Lý Sơn |
| Lục Ngạn | Bắc Ninh (Bắc Giang cũ) | Vải thiều, cam, na dai Lục Nam |
| Cái Bè | Đồng Tháp (Tiền Giang cũ) | Xoài cát Hòa Lộc, vú sữa Lò Rèn, sầu riêng Ngũ Hiệp, khóm Tân Phước |
| Phong Điền | Cần Thơ | Dâu Hạ Châu, khóm Cầu Đúc |

**Cần rà lại trước khi phát hành:** danh mục do mình soạn từ hiểu biết chung, chưa đối chiếu với danh sách chỉ dẫn địa lý và OCOP chính thức. Một số vùng mới có một đặc sản (Trà Bồng, Hoài Nhơn, Cần Giờ, Côn Đảo…), nên bổ sung.

**Người chơi thành phố:** ở Hà Nội được gắn về Phú Diễn (bưởi Diễn, cam Canh), ở TP.HCM về Lái Thiêu (măng cụt, bưởi Bạch Đằng). Vì phần đông người chơi sẽ dồn về hai vùng này, nên có thêm vai trò cho dân thành phố: thương lái, xưởng chế biến, chủ sạp (dự kiến).

## 6. Quy trình canh tác

Mỗi đặc sản đi qua 6–8 bước; bước đầu làm ngay khi xuống giống, bước cuối là thu hoạch. Thời gian chờ chia đều giữa các bước.

- **Quy trình riêng** (7 loại): thanh long (chong đèn ra hoa trái vụ), nho (cắt cành tạo vụ), tỏi Lý Sơn (trải đất đỏ rồi phủ cát trắng), khóm (lên liếp trên đất phèn), vải thiều (khoanh vỏ hãm lộc đông), sầu riêng (xiết nước, thụ phấn ban đêm), lúa.
- **Quy trình theo nhóm** cho các loại còn lại: cây ăn trái lâu năm, cây leo giàn, cây ngắn ngày, cây lấy củ, cây công nghiệp.

**Chất lượng:** làm một bước trễ quá 12 giờ so với lúc đến hạn thì tính một lần trễ. Không trễ → Loại 1 (100% giá); trễ 1–2 lần → Loại 2 (85%); từ 3 lần → Loại 3 (70%).

**Cần chuyên gia nông nghiệp rà lại** nội dung từng bước. **Dự kiến:** viết quy trình riêng cho từng loại cây, thêm thời tiết và mùa vụ thật theo vùng (hạn mặn, bão, sương muối), thêm chuẩn VietGAP làm hạng cao hơn Loại 1.

## 7. Kinh tế

Tiền trong game là **đồng**, giá mỗi kg bằng giá tham chiếu ngoài đời.

| Thông số | Giá trị hiện tại |
|---|---|
| Vốn khởi đầu | 1.000.000đ |
| Tiền giống mỗi ô | 15% doanh thu kỳ vọng của ô đó |
| Thương lái mua tại vườn (đặc sản của vùng nhà) | 85% giá tham chiếu |
| Thương lái mua hàng phương xa (đặc sản vùng khác) | 110% giá tham chiếu |
| Khung giá rao trên sạp | 30% đến 300% giá tham chiếu |
| Mua một lô đất vùng khác | 50.000.000đ |

**Vì sao có hai mức giá thương lái:** chênh lệch 85% – 110% là lý do để giao thương. Người trồng rao bán trong khoảng đó thì lợi hơn bán tại vườn; người vùng khác mua về bán lại vẫn có lãi. Nó cũng phản ánh đúng thực tế: giá tại vườn thấp hơn giá ở chợ xa.

**Vì sao có khung giá rao:** để chợ không thành kênh chuyển tiền giữa các tài khoản.

**Sổ cái:** mọi thay đổi số dư đều ghi vào bảng `ledger` kèm lý do, để đối soát và phát hiện gian lận.

**Chưa cân bằng:** các con số trên là điểm khởi đầu. Hiện chưa có thứ gì rút tiền ra khỏi nền kinh tế ngoài giống và đất, nên về lâu dài sẽ lạm phát; cần thêm chi phí (phân bón, nhân công, vận chuyển, trang trí sạp).

## 8. Lý do để mua bán, đi lại và kết nối

| Tính năng | Cách hoạt động | Trạng thái |
|---|---|---|
| **Vườn sân thượng** | Định vị trong trung tâm Hà Nội, TP.HCM, Đà Nẵng, Hải Phòng, Cần Thơ, Huế, Nha Trang thì được chọn: làm vườn trên sân thượng nhà mình (12 thùng trồng, cảnh khu phố) hoặc nhận vườn 30 ô ở vùng trồng gần nhất. Dân phố bán hàng phương xa được thêm 10%, nên hợp vai thương lái. | Đã có |
| **Thời tiết** | Mỗi vùng có thời tiết riêng, đổi mỗi 3 giờ: nắng đẹp, nhiều mây, mưa (cây lớn nhanh hơn 20%), nắng gắt (chậm 20%), bão (chậm 30%, chỉ miền Trung và đảo). Mưa và bão có hiệu ứng trong cảnh. | Đã có |
| **Được mùa mất giá** | Một đặc sản bị bán cho thương lái càng nhiều trong 24 giờ thì giá thương lái càng giảm, tối đa 30%. Bảng giá hiện cột "Nguồn cung". | Đã có |
| **Hợp tác xã** | Người cùng vùng lập hợp tác xã (tối đa 20 người). Thành viên bán thương lái được cộng 5%; có bảng xếp hạng sản lượng 7 ngày. | Đã có |
| **Chợ phiên** | Thứ Bảy và Chủ nhật, thương lái trả thêm 10% cho mọi mặt hàng. | Đã có |
| **Du lịch** | Mua vé tới vùng khác (20.000đ), mua đặc sản về làm quà, ghé vườn người ở đó, mua đất. | Đã có |
| **Sổ sưu tập** | Mỗi đặc sản thu hoạch, mua hoặc được tặng thành một con tem. Đủ tem một vùng thưởng 50.000đ. | Đã có |
| **Quà tặng** | Tặng nông sản cho bạn bè, tối đa 5 món mỗi ngày. | Đã có |
| Đơn hàng theo dịp | Mâm ngũ quả Tết, giỏ quà Trung thu: mỗi đơn cần trái từ nhiều vùng. | Dự kiến |
| Chế biến | Mứt, trái sấy, nước ép: bán giá cao hơn trái tươi. | Dự kiến |
| Đơn xuất khẩu | Hợp tác xã góp hàng Loại 1 số lượng lớn. | Dự kiến |

Các con số trên nằm trong `shared/rules.ts` và chưa được cân bằng với người chơi thật.

## 9. Bảng giá và tác tử thu thập giá

**Đã có:**

- Bảng `price_ticks` lưu mọi lần ghi giá: đặc sản, giá, nguồn, thời điểm.
- `POST /api/admin/prices` nhận giá mới, yêu cầu mã quản trị (`ADMIN_TOKEN`) và bắt buộc ghi nguồn.
- Màn hình Bảng giá hiện giá, mức thay đổi so với lần ghi trước và nguồn.
- Khi khởi tạo, mỗi đặc sản có một dòng **"giá mẫu"** do mình ước lượng để chơi thử. Giao diện ghi rõ đây chưa phải giá thị trường.

**Dự kiến — tác tử AI thu thập giá:**

1. Chạy theo lịch (mỗi ngày một lần, mùa vụ chính có thể dày hơn).
2. Với từng đặc sản, tìm giá thu mua tại vườn và giá bán buôn trên các nguồn công khai, lấy ít nhất hai nguồn.
3. Loại giá lệch bất thường so với lần trước; khi các nguồn vênh nhau nhiều thì giữ giá cũ và báo người duyệt.
4. Gửi kết quả qua `POST /api/admin/prices`, ghi rõ nguồn và thời điểm.

Cần quyết: danh sách nguồn được tin, ai duyệt khi tác tử không chắc, và chi phí chạy mỗi ngày cho 127 đặc sản.

**Dự kiến — tiểu thương và nhà vườn tự báo giá:** khu riêng, tách khỏi tiền trong game. Mỗi người báo giá mua/bán tại vùng của mình; hệ thống hiện trung vị bên cạnh giá tham chiếu. Cần xác minh người báo và chống báo giá ảo.

## 10. Kiếm tiền và pháp lý

- **Nạp tiền mua vật phẩm:** nên giới hạn ở trang trí (nhà, sạp, hàng rào), không bán lợi thế trồng trọt, để giá trong game còn ý nghĩa tham chiếu.
- **Nối với nông sản thật** (về sau): người chơi đặt mua trái cây thật từ nhà vườn đối tác.
- **Cần luật sư tư vấn trước khi mở nạp tiền:** giấy phép trò chơi điện tử trên mạng, quy định không quy đổi vật phẩm ảo ra tiền, bảo vệ dữ liệu cá nhân (vị trí là dữ liệu nhạy cảm), và điều kiện khi hiển thị giá như một bảng tham chiếu thị trường.
- **Tên công ty, thương hiệu thật** chỉ dùng khi có thoả thuận. Thương lái trong game hiện không mang tên ai.

## 11. Kiến trúc kỹ thuật

| Phần | Công nghệ | Thư mục |
|---|---|---|
| Luật chơi và danh mục dùng chung | TypeScript thuần | `shared/` |
| Máy chủ | Node.js 22, Fastify, PostgreSQL | `server/` |
| Giao diện | React, Vite, cảnh 3D bằng Three.js | `web/` |

- Máy chủ quyết định mọi thứ liên quan tiền, thời gian và hàng hoá; giao diện chỉ hiển thị.
- Tài khoản: tên + mật khẩu (băm scrypt), phiên lưu bằng cookie `httpOnly`.
- Mọi thao tác tiền và hàng chạy trong giao dịch cơ sở dữ liệu có khoá dòng.
- Giới hạn tần suất: 300 yêu cầu/phút mỗi địa chỉ, 10 lần/phút cho đăng ký và đăng nhập.
- `TIME_SCALE` tăng tốc thời gian khi phát triển (ví dụ 3600 thì một giờ còn một giây).

### Thế giới và điều khiển

Game là một thế giới 3D phủ kín màn hình; người chơi điều khiển một nhân vật chạy trong xóm. **Đã có:**

- **Xóm:** một con đường làng, hai bên là các lô vườn. Lô nào cũng có hàng rào, cổng, nhà, sân, ruộng 30 ô và sạp hàng sát đường. Người chơi xuất hiện ngoài đường và chạy qua cổng vào vườn.
- **Hàng xóm là bạn bè:** kết bạn bằng tên tài khoản; vườn của bạn bè (tối đa 9) hiện ngay cạnh và đối diện vườn mình. Lô chưa có ai cắm biển "Đất trống · mời bạn".
- **Chăm giúp:** chạy sang vườn bạn, đứng lên ô có cây đã đến giờ là chăm giúp một bước và nhận 3.000đ tiền công, tối đa 20 lượt mỗi ngày. Thu hoạch thì chỉ chủ vườn làm.
- **Điều khiển:** kéo để hiện cần điều khiển, chạm để chạy tới, hoặc dùng bàn phím. Máy quay bám theo nhân vật.
- **Làm việc bằng cách chạy tới:** đứng lên ô trống thì hiện thanh chọn giống; chạy qua ô có dấu vàng thì nhân vật tự làm bước chăm sóc đó, tên bước và số ký thu hoạch nổi lên.
- **Dẫn đường:** bảng nhiệm vụ ở góc trên và mũi tên vàng chỉ cổng vườn, rồi chỉ ô gần nhất đang chờ chăm.
- **Cảnh theo vùng:** đảo có biển và ghe, miền Nam có dừa và kênh, Tây Nguyên có thông và đất đỏ, miền Bắc và miền Trung có núi. Xóm mang cảnh của vùng người chơi định vị.
- **Sự sống:** cây lớn dần qua bốn giai đoạn và ra trái khi tới lúc thu hoạch; gà, bướm, mây, khói bếp; ngày đêm theo giờ thật.

**Chưa có:** thấy bạn bè chạy trong xóm theo thời gian thực (hiện chủ vườn hàng xóm là nhân vật đứng vẫy tay), trò chuyện, chăn nuôi, trang trí nhà và sạp, âm thanh, thời tiết, mô hình do hoạ sĩ làm.

## 12. Lộ trình

| Giai đoạn | Nội dung |
|---|---|
| **0 — nền tảng (bản này)** | Tài khoản, định vị, thế giới xóm 3D, trồng theo quy trình, kho, sạp, chợ, bảng giá, mua đất, kết bạn, chăm giúp. |
| 1 — có lý do quay lại | Đơn hàng theo dịp, thông báo đến giờ chăm cây, trang trí sạp, lấy lại mật khẩu. |
| 2 — giá thật | Tác tử thu thập giá chạy hằng ngày, biểu đồ lịch sử giá, được mùa mất giá. |
| 3 — cộng đồng | Thấy nhau theo thời gian thực, trò chuyện, hợp tác xã, chế biến, chợ phiên, sổ sưu tầm, bảng xếp hạng. |
| 4 — nối ra đời thật | Tiểu thương báo giá, đối tác nhà vườn, nạp tiền (sau khi xong pháp lý). |

## 13. Câu hỏi còn mở

1. Tên chính thức của game.
2. Ai rà nội dung quy trình canh tác và danh mục đặc sản?
3. Nguồn giá nào được coi là đáng tin cho tác tử?
4. Người chơi thành phố có nên được chọn vai thương lái ngay từ đầu thay vì nhận vườn?
5. Mỗi vùng có giới hạn số lô đất không (đất khan hiếm thì có giá trị, nhưng người đến sau thiệt)?
