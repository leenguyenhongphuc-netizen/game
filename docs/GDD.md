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
| Vai trò được giao bằng vòng quay, không tự chọn | Xem mục "Vai trò và chuỗi cung ứng" bên dưới. Áp dụng cho mọi nơi; thành phố vẫn có vườn sân thượng. | Đã có |
| Đặc sản gắn theo vùng trồng; Đà Lạt là vùng đặc biệt | 53 vùng trồng. Đà Lạt có 13 đặc sản gồm trái cây, rau củ và 6 loại hoa, có quy trình trồng hoa riêng. | Đã có |
| Thời gian nén | Thời gian gốc 10–48 giờ mỗi vụ, rút ngắn theo kinh nghiệm: người mới nhanh gấp 30, về sau nhanh gấp 2. | Đã có |
| NPC có tên và logo | Sáu doanh nghiệp thu mua hư cấu, tên chơi chữ, logo là biểu tượng. Xem ghi chú bên dưới. | Đã có, tên cần bạn duyệt |
| Thời tiết và mùa vụ thật theo vùng | Thời tiết đổi mỗi 3 giờ. Theo tháng thật: hạn mặn miền Nam (tháng 2–4), bão miền Trung và đảo (9–11), mưa lũ miền Trung (10–11), sương muối miền Bắc (12–1), nắng nóng (6–7). Mỗi loại cây có tháng chính vụ; thu đúng vụ được thêm 15% sản lượng. | Đã có, số liệu mùa vụ cần chuyên gia rà |
| Được mùa mất giá khi cả máy chủ trồng cùng loại | Giá thương lái giảm theo số ô đang trồng và lượng đã bán của đặc sản đó trên toàn máy chủ, tối đa 30%. Thanh chọn giống cảnh báo trước khi trồng. | Đã có |
| Hợp tác xã gom hàng nhận đơn lớn | Mỗi hợp tác xã có một đơn lớn 7 ngày từ doanh nghiệp xuất khẩu; thành viên góp hàng, đủ đơn thì mỗi người được thưởng 25% phần mình góp. | Đã có |
| Chợ phiên, chợ nổi theo lịch tuần | Chợ phiên thứ Bảy và Chủ nhật (+10%, mọi miền). Chợ nổi thứ Tư (+15%, chỉ miền Nam). | Đã có |
| Du lịch vườn | Mua vé tới vùng khác, ghé vườn, phụ thu hoạch (được chia 10% sản lượng làm quà vườn), mua tại sạp, mua đặc sản làm quà. | Đã có |

**Về tên doanh nghiệp NPC:** quyết định ban đầu là biến tấu tên và logo thương hiệu thật. Mình đã dùng tên hư cấu hoàn toàn, không nhại thương hiệu nào, vì tên nhại vẫn có thể bị coi là gây nhầm lẫn nhãn hiệu. Danh sách nằm ở `NPCS` trong `shared/catalog.ts`; nếu bạn vẫn muốn hướng nhại, bạn đưa danh sách tên cụ thể và nên hỏi luật sư trước.

Ngoài ra đã có: đơn hàng cá nhân theo ngày (đơn thu mua, giỏ quà biếu, mâm ngũ quả), xưởng chế biến cho mọi người chơi, sổ tem đặc sản, quà tặng bạn bè.

**Chưa có:** tác tử AI lấy giá thật (giá vẫn là giá mẫu), thấy bạn bè theo thời gian thực và trò chuyện, chăn nuôi, trang trí nhà và sạp, âm thanh, nạp tiền, mô hình do hoạ sĩ làm.

## Vai trò và chuỗi cung ứng

Sau khi chia sẻ vị trí, người chơi quay **vòng quay vai trò**. Không ai được chọn và không ai biết trước mình sẽ làm gì.

| Vai | Vườn | Quyền riêng | Thu nhập chính |
|---|---|---|---|
| 🧑‍🌾 Nhà vườn | 30 ô (sân thượng: 12) | Thưởng chính vụ trên diện tích lớn | Bán nông sản qua sạp cho thương lái và chủ xưởng |
| 🏭 Chủ xưởng | 8 ô, có xưởng trong sân | Chỉ mình chế biến được, 4 chỗ làm | Mua trái tươi, bán thành phẩm |
| 🚚 Thương lái | 8 ô, có xe tải | Chỉ mình bán cho doanh nghiệp với giá đầy đủ; lái xe, lái tàu đi vùng khác | Chênh lệch giá giữa các vùng |

**Cân bằng:**
- Máy chủ chọn vai, nghiêng về vai mà vùng đó đang thiếu, tính trên người còn chơi trong 7 ngày gần nhất. Tỷ lệ mục tiêu: nông thôn 65% nhà vườn, 15% chủ xưởng, 20% thương lái; trung tâm thành phố 30 / 30 / 40.
- Không ai bị kẹt hàng: vai nào cũng "bán tháo" được cho doanh nghiệp ở mức 60% giá tham chiếu. Đi qua người chơi khác luôn lợi hơn.
- Mỗi mùa dài 30 ngày; hết mùa được quay lại. Tài khoản tạo trước khi có luật này sẽ quay ở lần đăng nhập kế tiếp.

**Thương lái đi buôn:** xe tải đỗ trước cổng, lên xe lái dọc đường làng ghé các sạp. Đi vùng khác là một màn lái xe thật (né xe máy, trâu bò, ổ gà); ra đảo có thêm chặng lái tàu. Mỗi chuyến tốn tiền xăng theo quãng đường. Tới nơi, thương lái bán cho doanh nghiệp ở vùng đó, nên chở đặc sản đi xa mới được giá hàng phương xa.

**Chưa có:** giá tự điều chỉnh theo mức thiếu vai trong vùng, sức chở của xe, hợp đồng thu mua đặt trước.

## Du lịch

Chọn nơi đến trong mục Du lịch rồi mua vé theo phương tiện. Giá vé tính theo quãng đường.

| Phương tiện | Khi nào có | Giá |
|---|---|---|
| 🚌 Xe khách | Mọi chuyến trong đất liền | 10.000đ + 150đ/km |
| 🚆 Tàu hoả | Từ 150 km | 20.000đ + 250đ/km |
| ✈️ Máy bay | Từ 400 km (đảo: từ 300 km) | 300.000đ + 1.500đ/km |
| ⛴️ Tàu thuỷ | Mọi chuyến ra hoặc vào đảo | 50.000đ + 600đ/km |

Sau khi mua vé, người chơi xem trọn hoạt cảnh năm chặng, **không bỏ qua được** vì đây là một phần trải nghiệm: (1) đi bộ ra bến xe trước xóm, (2) xe trung chuyển tới đón, (3) tới ga, sân bay hoặc bến cảng và bước lên phương tiện, (4) phương tiện đi qua cảnh quan của vùng đi rồi vùng đến, (5) tới nơi và bước xuống. Tới nơi là **vườn mẫu** của vùng: trồng đủ mọi đặc sản đang ra trái, đứng lên từng ô để xem trọn quy trình trồng. Trước cổng có **quầy trưng bày**: mua đặc sản làm quà (được tem trong sổ sưu tập), ghé vườn của người chơi ở vùng đó, mua đất. Bấm "Về nhà" để trở lại xóm.

Thương lái tự lái xe tải tới nơi cũng vào vườn mẫu của vùng đó.

### Chuyến xe tải của Thương lái

Xe tải có **bình xăng 60 lít** (12 lít/100 km, 21.000đ/lít) và **tài khoản thu phí không dừng (ETC)**. Lên xe ở xóm để xem kim xăng, đổ đầy bình, nạp ETC.

Mỗi chuyến có lộ trình cố định theo cặp vùng (`tripPlan`): quãng đường, các nút giao phải rẽ, trạm xăng mỗi 60 km, trạm thu phí mỗi 70 km (35.000đ/trạm). Trong màn lái:

- Rời xóm trên đường làng, nhập làn lên cao tốc ba làn; né xe cùng chiều bằng cách đổi làn.
- Biển báo và bản đồ dẫn đường chỉ hướng rẽ ở từng nút giao. **Đi lố** thì phải chạy tiếp và vòng lại, tốn thêm quãng đường và xăng.
- Ghé trạm xăng để đổ. Cạn bình giữa đường thì trả phí cứu hộ, đắt gấp rưỡi.
- Qua trạm thu phí: đủ số dư ETC thì chạy thẳng; thiếu thì dừng trả tiền mặt, phụ thu 20%.
- Chuyến ra đảo có chặng tàu theo hải trình vẽ sẵn giữa hai hàng phao tiêu.

Tiền xăng và phí đường tính khi tới nơi, theo quãng đường thật đã chạy (kể cả phần đi lố).

**Phạt quá tốc độ.** Chạy quá tốc độ có thể bị công an dừng xe. Mỗi lần bị dừng, màn lái gửi số km/h vượt quá; máy chủ tính tiền phạt theo Điều 6 Nghị định 168/2024/NĐ-CP (lấy mức giữa khung) và trừ tiền mặt khi tới nơi, tối đa 6 lần một chuyến:

| Vượt quá | Khung phạt | Mức trong game | Trừ điểm GPLX |
|---|---|---|---|
| 5 đến dưới 10 km/h | 800.000 – 1.000.000đ | 900.000đ | 0 |
| 10 đến 20 km/h | 4 – 6 triệu | 5 triệu | 2 |
| trên 20 đến 35 km/h | 6 – 8 triệu | 7 triệu | 4 |
| trên 35 km/h | 12 – 14 triệu | 13 triệu | 6 |

Bảng nằm ở `SPEED_FINES` trong `shared/rules.ts`. Cần người rà lại khi luật sửa đổi (có tin về nghị định sửa đổi năm 2026, chưa đối chiếu được văn bản gốc).

### Mua vé khác tự lái xe tải chỗ nào

| | Mua vé (xe khách, tàu, máy bay) | Tự lái xe tải |
|---|---|---|
| Ai đi được | Ai cũng đi được | Chỉ thương lái |
| Mang được gì | Chỉ người đi; mua quà tối đa 5 kg mỗi lần, 3 lần mỗi ngày, giá 180% | Thu mua sỉ tới 500 kg mỗi điểm đỗ, giá 90%; chở hàng nhà đi bán |
| Bán hàng | Vẫn bán theo giá vùng nhà | Bán ở nơi xe đỗ: hàng vùng khác được 110% giá tham chiếu, so với 85% khi bán tại vườn |
| Chi phí | Một lần tiền vé | Xăng, phí đường, có thể bị phạt |
| Để làm gì | Tham quan, lấy tem | Buôn chênh lệch giá giữa các vùng |

Hai cách có thể tốn ngang nhau (ví dụ đi Côn Đảo khoảng 2 triệu), nhưng vé là tiền tiêu, còn chuyến xe là tiền vốn: một xe 500 kg hàng 30.000đ/kg mua 90% bán 110% lãi gộp khoảng 3 triệu. Nội dung này nằm ở `TRAVEL_VS_TRUCK` để giao diện đặt hai cách cạnh nhau.

### Thu mua sỉ tại vùng

Thương lái có xe đỗ ở vùng nào (vùng nhà hoặc nơi vừa lái tới) thì thu mua sỉ được đặc sản của vùng đó:

- Giá sỉ bằng 90% giá tham chiếu hiện hành (`WHOLESALE_RATIO`), rẻ hơn nữa khi đặc sản đang được mùa. Hàng nhận về là Loại 1.
- **Sức chở 500 kg** (`TRUCK.cargoKg`) cho mỗi điểm đỗ: tới vùng mới thì tính lại từ đầu; xe không đi đâu thì tính lại mỗi ngày.
- **Nguồn hàng 1.500 kg mỗi đặc sản mỗi ngày**, chung cho mọi thương lái (`WHOLESALE_SUPPLY_KG`).
- Mua xong bán lại ngay tại vùng đó là lỗ (85% < 90%); phải chở đi vùng khác (110%), đem xuất khẩu, giao đơn hàng hoặc rao chợ.
- Tới một vùng, `GET /api/regions/:id/trade` cho bảng "mua gì ở đây, mang về bán lời bao nhiêu" và "hàng trong kho bán ở đây hơn ở nhà bao nhiêu".

Chỉ thương lái có xe tải nên chỉ thương lái thu mua sỉ được; đó là ưu thế của vai này. Nhà vườn và chủ xưởng lấy hàng vùng khác qua chợ hoặc từ thương lái.

Điểm cần theo dõi khi cân bằng: thương lái mua sỉ đặc sản vùng nhà (90%) rồi góp vào đơn lớn hợp tác xã (100% + thưởng 25%) là có lời mà không cần chạy xe. Mức lời bị chặn bởi kích cỡ đơn (100 kg mỗi thành viên mỗi 7 ngày).

## Xuất khẩu

Mục xuất khẩu cho người chơi gửi hàng trong kho ra nước ngoài. Chọn hàng, thị trường và đường đi; trả cước ngay; khi lô tới nơi thì tiền hàng về (giá chốt lúc gửi).

| Đường | Lô (kg) | Cước cố định + mỗi kg | Thời gian | Hao hụt hàng tươi | Cửa ngõ |
|---|---|---|---|---|---|
| 🚚 Xe tải biên mậu | 50 – 500 | 300.000đ + 1.500đ | 20 phút | 3% | Cửa khẩu |
| 🚛 Xe container lạnh | 500 – 5.000 | 2,5 triệu + 900đ | 30 phút | 1% | Cửa khẩu |
| 🚂 Tàu hoả liên vận | 300 – 8.000 | 1,5 triệu + 600đ | 45 phút | 4% | Ga liên vận |
| ✈️ Máy bay chở hàng | 20 – 1.000 | 800.000đ + 12.000đ | 10 phút | 0% | Sân bay |
| ⛴️ Tàu biển nhỏ | 200 – 3.000 | 1 triệu + 500đ | 60 phút | 6% | Cảng |
| 🚢 Tàu container viễn dương | 2.000 – 50.000 | 6 triệu + 250đ | 120 phút | 10% | Cảng |

Hàng khô (cây công nghiệp như cà phê, tiêu, chè, quế; lúa gạo) chỉ hao một phần năm, nên đi tàu lớn là rẻ nhất; trái tươi giá trị cao thì đáng đi máy bay; lô vừa đi container lạnh. Cộng thêm cước nội địa 1,2đ mỗi kg mỗi km từ vùng nhà tới cửa ngõ gần nhất (cửa khẩu Hữu Nghị, Kim Thành, Móng Cái, Lao Bảo, Mộc Bài; ga Đồng Đăng, Lào Cai; sân bay Nội Bài, Đà Nẵng, Tân Sơn Nhất; cảng Hải Phòng, Tiên Sa, Cái Mép), nên vườn miền Nam bán sang Trung Quốc bằng đường bộ tốn hơn vườn miền Bắc.

| Thị trường | Giá so với tham chiếu | Đường đi được | Yêu cầu |
|---|---|---|---|
| 🇨🇳 Trung Quốc | 125% | Xe tải, container, tàu hoả | |
| 🇱🇦 Lào – Campuchia | 115% | Xe tải, container | |
| 🌏 Thái Lan – Singapore | 130% | Tàu nhỏ, máy bay | |
| 🇯🇵 Nhật Bản – Hàn Quốc | 160% | Máy bay, tàu lớn | Chỉ Loại 1 |
| 🌍 Châu Âu – Mỹ | 190% | Máy bay, tàu lớn | Chỉ Loại 1 |

Giá xuất khẩu không chịu "được mùa mất giá" trong nước, nên xuất khẩu là lối thoát khi cả máy chủ trồng cùng một loại.

Ai đi được đường nào: thương lái đi mọi đường; nhà vườn và chủ xưởng gửi xe tải biên mậu và máy bay, vào hợp tác xã thì thêm container, tàu hoả, tàu nhỏ. Mỗi người tối đa 3 lô đang trên đường.

Đơn lớn của hợp tác xã ghi sẵn thị trường và đường đi (`exportMode`, `market`) để giao diện phát đúng hoạt cảnh khi đủ đơn.

Chưa có: xuất khẩu thành phẩm của xưởng, rủi ro dọc đường (ùn ứ cửa khẩu, trả hàng), giá thị trường nước ngoài biến động.

## Vì sao có giới hạn

Mỗi giới hạn có một câu lý do trong `LIMIT_REASONS` (`shared/rules.ts`) để giao diện hiện ngay cạnh con số: quà đặc sản, sức chở xe, nguồn hàng sỉ, ai được thu mua sỉ, tặng quà, đơn hàng mỗi ngày, số ô theo vai, bán tháo, hợp tác xã, đơn lớn, quyền xuất khẩu, kg tối thiểu mỗi lô, số lô cùng lúc, thị trường khó tính, số bạn.

Lý do chung: (1) giữ cho ba vai cần nhau — quầy trưng bày giới hạn 5 kg × 3 lần vì đó là quà lấy tem, còn muốn mua nhiều thì phải là thương lái lái xe tới thu mua sỉ; (2) chặn chuyển tiền, chuyển hàng giữa tài khoản phụ; (3) để quãng đường, sức chở và việc gom hàng là quyết định có cân nhắc.

## Nhịp chơi cho người mới

Thời gian chờ được rút ngắn theo số lần đã thu hoạch: dưới 5 lần nhanh gấp 30 (vụ 12 giờ còn 24 phút), dưới 20 lần nhanh gấp 6, sau đó nhanh gấp 2 so với thời gian gốc. Tiền giống giảm còn 8% doanh thu kỳ vọng của ô, nên vốn 1 triệu trồng được nhiều ô hơn.

## Tài khoản thử nghiệm

Tên đăng nhập nằm trong biến môi trường `TESTER_USERNAMES` sẽ có mục "Công cụ thử nghiệm" trong Hồ sơ: đổi vai trò ngay, xoá vai để quay lại, chuyển vườn nhà sang vùng khác hoặc sân thượng, đặt 1 tỷ đồng, cho mọi cây tới bước kế ngay, thêm nông sản vào kho. Các công cụ chỉ tác động lên chính tài khoản đó.

## Kiểm thử giao diện tự động

`tools/ui-test/` đi qua 23 màn trên 7 cỡ thiết bị (iPhone SE, iPhone 15 dọc và ngang, iPad mini, iPad Pro ngang, máy tính 1280 và 1920), chụp ảnh và tự soát: trang bị phóng to, tràn ngang, nút hoặc khối nằm ngoài màn hình, các khối đè nhau, nút quá nhỏ, chữ bị cắt, lỗi JavaScript. Kỹ năng `.claude/skills/ui-test` hướng dẫn tác tử AI chạy bộ kiểm, xem ảnh, sửa và chạy lại.

## Cá nhân hoá

Mục **Trang trí** cho đổi: kiểu nhà (mái ngói, nhà sàn, nhà ba gian), màu tường, màu mái, kiểu hàng rào, tên vườn trên cổng; màu mái che và biển hiệu gian hàng; màu áo, nón, màu xe tải; và mười món đồ sân vườn đặt tại chỗ nhân vật đang đứng. Khách ghé thăm và hàng xóm đều thấy.

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
| Tiền giống mỗi ô | 8% doanh thu kỳ vọng của ô đó |
| Thương lái mua tại vườn (đặc sản của vùng nhà) | 85% giá tham chiếu |
| Thương lái mua hàng phương xa (đặc sản vùng khác) | 110% giá tham chiếu |
| Khung giá rao trên sạp | 30% đến 300% giá tham chiếu |
| Mua một lô đất vùng khác | 15–200 triệu tuỳ vùng (xem dưới) |

**Giá đất theo vùng:** `landPrice(regionId)` lấy giá trị làm ra mỗi giờ của các đặc sản trong vùng (giá × sản lượng ÷ thời gian một vụ), so với vùng trung vị, rồi tính 50 triệu × chỉ số^0,7; đảo nhân thêm 1,3. Vùng cho nông sản giá trị cao thì đất đắt hơn. Hiện thấp nhất là Trà Bồng (24 triệu), cao nhất là Lý Sơn (131 triệu); Đà Lạt 71 triệu, Cái Bè 58 triệu. Đây là mức trong game suy ra từ giá nông sản, chưa đối chiếu giá đất nông nghiệp ngoài đời.

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
| Đơn xuất khẩu | Hợp tác xã góp hàng cho đơn lớn có sẵn thị trường và đường đi; ai cũng tự gửi được lô xuất khẩu theo 6 đường (xem mục Xuất khẩu). | Đã có ở máy chủ |

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
