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
| 🏭 Chủ xưởng | Không trồng: lô đất là nhà xưởng với các máy | Chỉ mình chế biến được; xưởng mới có sẵn 1 máy (2 mẻ) | Mua nông sản, bán thành phẩm cho siêu thị, doanh nghiệp, xuất khẩu |
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
| 🚚 Xe tải biên mậu | 30 – 500 | 300.000đ + 1.500đ | 20 phút | 3% | Cửa khẩu |
| 🚛 Xe container lạnh | 200 – 5.000 | 2,5 triệu + 900đ | 30 phút | 1% | Cửa khẩu |
| 🚂 Tàu hoả liên vận | 100 – 8.000 | 1,5 triệu + 600đ | 45 phút | 4% | Ga liên vận |
| ✈️ Máy bay chở hàng | 10 – 1.000 | 800.000đ + 12.000đ | 10 phút | 0% | Sân bay |
| ⛴️ Tàu biển nhỏ | 100 – 3.000 | 1 triệu + 500đ | 60 phút | 6% | Cảng |
| 🚢 Tàu container viễn dương | 500 – 50.000 | 6 triệu + 250đ | 120 phút | 10% | Cảng |

Mức tối thiểu đã hạ so với bản đầu (container từ 500 xuống 200 kg, tàu lớn từ 2 tấn xuống 500 kg): lô nhỏ được coi là hàng lẻ đi ghép container. Cước cố định vẫn giữ nên lô nhỏ đi đường lớn tự khắc không lời.

Hàng khô (cây công nghiệp như cà phê, tiêu, chè, quế; lúa gạo) chỉ hao một phần năm, nên đi tàu lớn là rẻ nhất; trái tươi giá trị cao thì đáng đi máy bay; lô vừa đi container lạnh. Cộng thêm cước nội địa 1,2đ mỗi kg mỗi km từ vùng nhà tới cửa ngõ gần nhất (cửa khẩu Hữu Nghị, Kim Thành, Móng Cái, Lao Bảo, Mộc Bài; ga Đồng Đăng, Lào Cai; sân bay Nội Bài, Đà Nẵng, Tân Sơn Nhất; cảng Hải Phòng, Tiên Sa, Cái Mép), nên vườn miền Nam bán sang Trung Quốc bằng đường bộ tốn hơn vườn miền Bắc.

| Thị trường | Giá so với tham chiếu | Đường đi được | Yêu cầu |
|---|---|---|---|
| 🇨🇳 Trung Quốc | 125% | Xe tải, container, tàu hoả | |
| 🇱🇦 Lào – Campuchia | 115% | Xe tải, container | |
| 🌏 Thái Lan – Singapore | 130% | Tàu nhỏ, máy bay | |
| 🇮🇳 Ấn Độ | 135% | Tàu nhỏ, tàu lớn, máy bay | |
| 🇦🇪 Trung Đông | 150% | Máy bay, tàu lớn | |
| 🇯🇵 Nhật Bản – Hàn Quốc | 160% | Máy bay, tàu lớn | Trái tươi: chỉ Loại 1, xử lý hơi nước nóng 2.500đ/kg, thêm 5 phút |
| 🇷🇺 Nga – Á Âu | 145% | Tàu hoả, tàu lớn | Chỉ nhận hàng chế biến và hàng khô |
| 🇦🇺 Úc – New Zealand | 175% | Máy bay, tàu lớn | Trái tươi: chỉ Loại 1, chiếu xạ 4.000đ/kg, thêm 10 phút |
| 🌍 Châu Âu – Mỹ | 190% | Máy bay, tàu lớn | Trái tươi: chỉ Loại 1, chiếu xạ 4.000đ/kg, thêm 10 phút |

Giá xuất khẩu không chịu "được mùa mất giá" trong nước, nên xuất khẩu là lối thoát khi cả máy chủ trồng cùng một loại.

**Hàng chế biến của xưởng xuất khẩu được** (`processed: true`): giá = giá nông sản × hệ số giá trị của công thức × hệ số thị trường (cộng 8% nếu xưởng có máy đóng gói); hao hụt chỉ bằng một phần mười hàng tươi; không xét loại; miễn phí kiểm dịch. Đây là đầu ra chính của chủ xưởng và là loại hàng duy nhất (cùng hàng khô) đi được Nga – Á Âu.

**Ai đi được đường nào:** mọi vai đi được mọi đường. Thương lái được giảm 15% cước (có mối vận tải), thành viên hợp tác xã giảm thêm 10% (gom hàng chung); phí kiểm dịch không được giảm. Số lô đang trên đường: 4 ở cấp 1, mỗi cấp thêm 1, tối đa 10 (xem mục Hộ chiếu và cấp bậc).

Đơn giản hoá so với thực tế: mã số vùng trồng, kiểm dịch thực vật, chứng nhận xuất xứ được gộp vào cước; chiếu xạ và xử lý hơi nước nóng là một khoản phí mỗi kg cộng thời gian; không có hạn ngạch, thuế, tỷ giá.

Đơn lớn của hợp tác xã ghi sẵn thị trường và đường đi (`exportMode`, `market`) để giao diện phát đúng hoạt cảnh khi đủ đơn.

Chưa có: rủi ro dọc đường (ùn ứ cửa khẩu, trả hàng), giá thị trường nước ngoài biến động, đơn lớn hợp tác xã tạo lô hàng thật.

## Ba trụ: vườn là nguồn tiền, xây dựng tự do, du lịch là nơi tiêu tiền và gặp nhau

Vườn Việt khác các game thế giới ảo ở chỗ bản đồ là Việt Nam thật và hàng hoá là do người chơi làm ra, chở đi, bày bán. Ba trụ nối thành một vòng:

1. **Vườn là nguồn tiền duy nhất.** Tiền chỉ sinh ra từ trồng, chế biến, buôn bán, xuất khẩu. Vé, taxi, vé vào cổng, đồ trang trí, đất, xe đều là nơi tiêu tiền. Không mở nguồn tiền nào ngoài chuỗi này (thưởng tham quan lần đầu nhỏ hơn tiền taxi và vé của chính chuyến đó).
2. **Xây dựng tự do.** Lô đất là nơi người chơi đặt, xoay, sắp xếp đồ theo ý mình và mời nhau tới thăm. Đồ đặc trưng vùng miền mua ở nơi tới du lịch (hướng phát triển).
3. **Du lịch là nơi tiêu tiền và gặp nhau.** Mỗi tỉnh có các điểm tham quan thật; đi hết tuyến thì ra siêu thị đặc sản, nơi hàng trên kệ do thương lái và nhà vườn chở tới ký gửi.

### Taxi

Phương tiện thứ năm bên cạnh xe khách, tàu hoả, máy bay, tàu thuỷ. Cước 15.000đ + 2.500đ/km (`taxiFare`), chỉ chạy trên đất liền và tối đa 200 km (`TAXI_MAX_KM`). Dùng để đi giữa hai vùng gần nhau và để đi từ vùng đang đứng tới điểm tham quan trong tỉnh. Đắt hơn xe khách nhiều lần, đổi lại là góc nhìn hàng ghế sau.

### Điểm tham quan

Danh mục ở `shared/sights.ts`: toạ độ thật, các điểm dừng theo đúng thứ tự đi bộ ngoài đời, mỗi điểm dừng một điều có thật. Tỉnh đầu tiên là Đà Nẵng (gồm Quảng Nam cũ): Hội An, Mỹ Sơn, Ngũ Hành Sơn, Bà Nà, Cầu Rồng, Sơn Trà, Cù Lao Chàm.

- Người chơi phải đang có mặt trong tỉnh: vùng nhà, nơi xe tải đỗ, hoặc vùng vừa mua vé tới (`users.tour_region`, xoá khi gọi `POST /api/travel/home`).
- `POST /api/sights/:id/visit` trừ cước taxi (theo km từ vùng đang đứng, ít nhất 3 km) và vé vào cổng.
- `POST /api/sights/:id/finish` ghi các điểm dừng đã xem (cộng dồn qua nhiều lượt). Lần đầu xem đủ mọi điểm dừng được thưởng 30.000đ.

### Siêu thị đặc sản (ký gửi)

Mỗi tỉnh có điểm tham quan có một siêu thị ở lối ra.

- **Ký gửi:** ai đang ở trong tỉnh cũng đem hàng trong kho bày lên kệ được. Giá tự đặt trong khung 100–160% giá tham chiếu; mỗi lô 5–300 kg; mỗi người tối đa 6 lô đang bày. Hàng rời kho ngay, rút về được bất cứ lúc nào.
- **Mua:** phải đang ở trong tỉnh; mỗi người 30 kg mỗi ngày ở mỗi siêu thị (thêm 5 kg mỗi cấp). Kệ nhận cả thành phẩm của xưởng; thành phẩm mua về nằm ở kho thành phẩm riêng. Hàng mua được tính vào sổ tem. Người bán nhận tiền ngay, trừ phí kệ 5%.
- **Kệ nhà bán:** để siêu thị không trống khi ít người chơi, "Tiệm Ba Miền" luôn bày đặc sản của các vùng trong tỉnh và 3 đặc sản tỉnh khác xoay theo ngày, giá 150% giá tham chiếu, mỗi món 20 kg mỗi ngày cho mọi người. Kệ người chơi rẻ hơn hiện trước.
- **Cân bằng:** mua của nhà bán ở 150% rồi ký gửi lại tối đa 160% trừ phí 5% còn 152%, lãi 2% trên tối đa 20 kg, không đáng tiền taxi. Mua hàng người chơi ở sàn 100% rồi bán tháo cho doanh nghiệp thì lỗ. Kẽ hở còn lại: mua ở sàn 100% rồi giao đơn hàng, bán hàng phương xa hay xuất khẩu sang thị trường giá cao; đã bị chặn ở 30 kg mỗi ngày mỗi siêu thị, và chợ người chơi vốn đã cho mua rẻ hơn thế. Sàn 100% còn giữ cho siêu thị không phá giá chợ và sạp ở quê.

## Hộ chiếu du lịch, điểm kinh nghiệm và cấp bậc

Mỗi người chơi có một **hộ chiếu Vườn Việt** (`GET /api/passport`), số hộ chiếu sinh từ mã tài khoản. Hộ chiếu đóng ba loại dấu, có ngày giờ:

- **Dấu check-in** cho mỗi điểm dừng đã chụp ảnh ở một địa danh.
- **Dấu chứng nhận** (dấu lớn) khi đi trọn mọi điểm dừng của một địa danh.
- **Dấu vùng** cho mỗi vùng trồng đã đặt chân tới (bằng vé, bằng xe tải, hoặc có đất ở đó).

**Điểm kinh nghiệm** (`XP` trong `shared/rules.ts`): check-in điểm dừng 10, tham quan trọn địa danh 50, lần đầu tới một vùng 30, thu hoạch 5, giao đơn 15, một lô xuất khẩu tới nơi 40, nhận một mẻ chế biến 8, mua đất 100, bán được hàng ký gửi 5, chăm giúp 2.

**10 cấp** (`LEVELS`): Tập sự 0 → Lữ khách 100 → Người ham đi 300 → Thổ địa 600 → Nhà thám hiểm 1.000 → Người kể chuyện vùng miền 1.600 → Hướng dẫn viên 2.400 → Chuyên gia đặc sản 3.500 → Sứ giả miền quê 5.000 → Đại sứ Vườn Việt 7.000.

**Quyền lợi theo cấp** (`levelPerks`), cố ý vừa phải để cấp là niềm tự hào chứ không là lợi thế áp đảo: thể lực tối đa +10 mỗi cấp (100 → 190), số lô xuất khẩu cùng lúc +1 mỗi cấp (4 → 10), lượng mua ở mỗi siêu thị +5 kg mỗi cấp (30 → 75).

Chưa có: bảng xếp hạng, dấu theo sự kiện mùa, thưởng khi gom đủ dấu một tỉnh.

## Giấy chứng nhận quyền sử dụng đất

Mỗi thửa của người chơi có một **Giấy chứng nhận quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất** (`GET /api/plots/:id/certificate`, chỉ chủ thửa xem được): số vào sổ, tên chủ, tỉnh và xã phường, diện tích (30 ô × 25 m² = 750 m²; sân thượng 300 m²), mục đích sử dụng (đất trồng cây lâu năm ở vùng có cây ăn trái, cây công nghiệp; đất trồng cây hằng năm ở vùng rau, lúa, hoa; đất cơ sở sản xuất phi nông nghiệp với lô nhà của chủ xưởng; đất ở tại đô thị với vườn sân thượng), thời hạn 50 năm với đất nông nghiệp, nguồn gốc ("Nhà nước giao đất không thu tiền sử dụng đất" với thửa đầu, "Nhận chuyển nhượng" với đất mua), giá và các khoản phí đã nộp.

Mua đất thu thêm **lệ phí trước bạ 0,5%** giá trị và **phí cấp giấy 100.000đ** (`landFees`), hiện rõ trong kết quả mua.

Đơn giản hoá so với Luật Đất đai 2024: không có hạn mức nhận chuyển nhượng, không có thuế thu nhập 2% của bên bán (đất mua từ "quỹ đất của vùng" chứ không từ người chơi khác), không công chứng, không thuế sử dụng đất hằng năm, hết 50 năm mặc nhiên được dùng tiếp. Thửa có từ trước khi có luật này không ghi giá đã trả: giấy hiện giá đất hiện hành của vùng.

## Thể lực, ăn uống và quầy hàng

Nhân vật có **thể lực** (tối đa 100 ở cấp 1), tự hồi 1 điểm mỗi 3 phút thật (đầy lại sau 5 giờ; theo `TIME_SCALE`). Việc tốn sức (`ENERGY_COST`): trồng 1, chăm một bước 1, thu hoạch 2, chăm giúp 1, đứng máy một mẻ 3, lái xe tải 2 điểm mỗi 100 km (tối đa 12), mỗi điểm dừng mới khi đi bộ tham quan 2. Hết sức thì việc đó bị từ chối với lỗi `het_suc` kèm lời nhắc ăn uống. **Không tốn sức:** mua bán, xem bảng, ngồi xe khách, tàu, máy bay, taxi, ăn uống. Riêng tham quan: cần còn ít nhất 2 điểm mới vào cổng; nếu giữa chừng hết sức thì trừ hết phần còn lại chứ không huỷ chuyến.

**Người mới không bị kẹt:** vườn 8 ô trồng hết 8 điểm, chăm một lượt 8 điểm; một vụ 8 bước cho cả 8 ô hết khoảng 80 điểm trải trên nhiều giờ, trong khi mỗi giờ hồi 20 điểm. Nhà vườn 30 ô chăm một lượt hết 30 điểm, bằng 1,5 giờ hồi; các bước cách nhau lâu hơn thế. Thể lực chỉ thật sự giới hạn khi dồn nhiều việc nặng trong một lúc (thu hoạch 30 ô rồi lái xe rồi đi tham quan), và lúc đó có quầy hàng.

**Đồ ăn thức uống** (`shared/items.ts`): nước suối 6.000đ (+6), nước mía 10.000đ (+12), cà phê sữa đá 20.000đ (+20), bánh mì 20.000đ (+25), cơm hộp 35.000đ (+40), phở 45.000đ (+50)… và món riêng của tỉnh: mì Quảng, cao lầu, bánh ít lá gai, bánh tráng cuốn thịt heo, chè xoa xoa (Đà Nẵng); gỏi tỏi Lý Sơn, don, ram bắp, nước rong biển (Quảng Ngãi). Mua xong ăn ngay hoặc bỏ túi (mỗi món tối đa 20 phần) để dùng sau.

**Quầy hàng:** mỗi địa danh mỗi ngày mọc ngẫu nhiên 2–4 quầy trong sáu kiểu (xe nước mía, gánh hàng rong, quán cà phê, tiệm tạp hoá, quầy đặc sản, quán ăn), tên chủ quầy và món bán đổi theo ngày; cùng ngày thì ai cũng thấy như nhau. Phải đang ở trong tỉnh mới mua được. Mỗi vùng nhà có một tiệm tạp hoá luôn mở bán món cơ bản.

Cân bằng: tiền ăn là khoản tiêu nhỏ có ý nghĩa (một bữa phở 45.000đ so với một ô xoài bán vài triệu), không phải thuế chơi game. Chưa có: quầy lưu niệm bán vật phẩm trang trí (hệ trang trí hiện gắn món với lô đất, chưa có khái niệm món độc quyền theo địa danh), đói khát, ngủ nghỉ ở nhà nghỉ, món ăn cho hiệu ứng tạm thời.

## Xưởng chế biến: máy móc thay cho ruộng

Chủ xưởng **không trồng trọt**. Trồng cây trên lô của chủ xưởng bị từ chối (`xuong_khong_trong`); `allowedTiles` trả về rỗng; `GET /api/plots/:id` của lô nhà chủ xưởng có thêm `factory.machines` để giao diện vẽ nhà xưởng. Cây trồng từ trước khi đổi sang vai chủ xưởng vẫn chăm và thu hoạch nốt được, chỉ không trồng thêm.

| Máy | Giá | Làm được | Ghi chú |
|---|---|---|---|
| ♨️ Máy sấy | 6 triệu | Sấy dẻo trái cây, sấy khô củ, hoa khô | 2 mẻ song song |
| 🧃 Máy ép – cô đặc | 5 triệu | Nước ép trái dây leo | 2 mẻ |
| 🍯 Dây chuyền mứt – đóng hũ | 7 triệu | Mứt | 2 mẻ |
| 🔥 Máy rang xay – xay xát | 8 triệu | Rang sao cây công nghiệp, xay xát lúa gạo | 2 mẻ |
| 🚿 Máy rửa – phân loại | 3 triệu | Phụ trợ | Mỗi mẻ ra thêm 5% |
| 📦 Máy đóng gói hút chân không | 4 triệu | Phụ trợ | Thành phẩm bán được thêm 8% (doanh nghiệp, xuất khẩu) |
| ❄️ Kho lạnh | 5 triệu | Phụ trợ | Nguyên liệu Loại 2, 3 chỉ thiệt một nửa |

- Xưởng mới được cấp sẵn một máy hợp với đặc sản đầu tiên của vùng nhà (`starterMachine`).
- Tối đa 8 máy; máy chế biến mỗi loại 2 cái, máy phụ trợ mỗi loại 1 cái. Máy chế biến nâng tới cấp 3: mỗi cấp thêm 1 mẻ song song và nhanh hơn 10%; giá nâng = nửa giá máy × cấp hiện tại.
- Mỗi mẻ tốn tiền điện và bảo trì 200đ mỗi kg nguyên liệu và 3 thể lực.
- Nguyên liệu: xưởng mua qua sạp người chơi, chợ, siêu thị hoặc từ thương lái; không tự trồng.
- Đầu ra: (a) ký gửi siêu thị nội địa (`processed: true`, khung giá 100–160% giá tham chiếu của thành phẩm), (b) xuất khẩu, (c) bán ngay cho doanh nghiệp chế biến như cũ.

Kẽ hở còn lại: người mua thành phẩm ở siêu thị đúng giá sàn có thể bán lại cho doanh nghiệp lúc chợ phiên (+10%) để lãi nhẹ, bị chặn bởi giới hạn mua mỗi ngày; chủ xưởng có máy đóng gói mua thành phẩm của xưởng khác ở sàn rồi bán doanh nghiệp lãi 8% trừ phí, cũng trong giới hạn đó. Vai khác đổi sang chủ xưởng giữa mùa không bị mất cây đang trồng.

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

## Xe cộ, giấy phép lái xe, xe điện

- **Ai cũng mua được xe chở hàng** (không riêng thương lái), miễn có bằng lái đúng hạng, đủ cấp và đủ tiền. Danh mục nằm ở `shared/vehicles.ts`: ba gác máy 300 kg, bán tải 700 kg, tải nhẹ 990 kg, tải 1,9 tấn, 3,5 tấn, 8 tấn, 15 tấn (3 chân), đầu kéo + sơ mi rơ moóc 28 tấn; bản thùng lạnh cho xe từ 990 kg trở lên; bản chạy điện cho bán tải, tải nhẹ 990 kg và tải 3,5 tấn. Không dùng tên hãng thật.
- **Xe mặc định** của thương lái (và người chơi cũ) là tải nhẹ 990 kg, cấp kèm bằng B; thông số lấy từ hằng `TRUCK` (sức chở đã đổi từ 500 kg lên 990 kg). Xe được cấp miễn phí bán lại không ra tiền, để không đổi vai lấy xe rồi bán.
- **Sức chở khi thu mua sỉ** lấy theo chiếc xe đang dùng. Nguồn hàng sỉ mỗi vùng vẫn là `WHOLESALE_SUPPLY_KG` mỗi đặc sản mỗi ngày, nên xe rất lớn chưa phát huy hết — cần cân lại nguồn hàng nếu muốn xe 8 tấn trở lên có ý nghĩa.
- **Vai khác tự lái xe tới vùng khác** thì bán hàng theo giá nơi xe đỗ như thương lái (không còn chỉ bán tháo). Thu mua sỉ vẫn chỉ thương lái làm được. Đây là thay đổi cân bằng cần chơi thử: nhà vườn có xe sẽ bán được giá hàng phương xa.
- **Giấy phép lái xe** theo Luật Trật tự, an toàn giao thông đường bộ 2024: B1 (mô tô ba bánh), A1 (mô tô đến 125 cm³), B (ô tô tải có khối lượng toàn bộ theo thiết kế đến 3.500 kg), C1 (trên 3.500 đến 7.500 kg), C (trên 7.500 kg), CE (kéo rơ moóc). Game xếp hạng theo **khối lượng toàn bộ** chứ không theo tải trọng chở, nên xe tải 1,9 tấn (toàn bộ gần 5 tấn) cần bằng C1. Bằng cao lái được xe của bằng thấp cùng nhóm (C gồm C1 và B; CE gồm C). "Thi bằng" trong game là nộp lệ phí khi đủ cấp; câu hỏi luật do giao diện đảm nhiệm. *Chưa đối chiếu nguyên văn điều luật.*
- **Phí đường theo 5 nhóm xe** của trạm BOT/ETC (hệ số 1 – 1,4 – 2,1 – 3,4 – 5,1 so với nhóm 1); xe ba gác không vào cao tốc nên không mất phí đường nhưng đi lâu hơn. *Hệ số là ước lượng, không phải biểu phí của một trạm cụ thể.*
- **Tốc độ tối đa trên cao tốc** theo loại xe trong game: xe tới 3,5 tấn chạy theo biển (tới 120), xe tải nặng và đầu kéo tối đa 80–90. *Đơn giản hoá: ngoài đời tốc độ trên cao tốc theo biển báo, giới hạn theo loại xe áp dụng cho đường khác.*
- **Phí đăng kiểm, bảo hiểm, bảo dưỡng** quy ra tiền theo cây số, trừ khi chuyến xe tới nơi (`upkeepCost`).
- **Xe điện**: đắt hơn bản xăng dầu khoảng 35%, tiền điện mỗi 100 km rẻ hơn hẳn (sạc nhanh DC 3.900đ/kWh, sạc chậm ở nhà 2.700đ/kWh, so với xăng 21.000đ/lít, dầu 19.000đ/lít), tầm hoạt động ngắn hơn và phải dừng sạc ở trạm (ngoài đời khoảng 35 phút từ 10% lên 80%). Trạm sạc thưa hơn trạm xăng: có ở mọi trạm dừng nghỉ và thêm các trụ lẻ cách nhau khoảng 120 km. Hết pin giữa đường thì gọi cứu hộ như hết xăng. *Giá điện, dung lượng pin và mức tiêu hao là số tròn theo mặt bằng chung, chưa lấy từ một mẫu xe cụ thể.*
- **Thùng lạnh**: hiện mới có trong danh mục (giá, tải trọng, tiêu hao); **chưa có tác dụng** ở máy chủ vì hàng thu mua sỉ vốn đã là loại 1.

## Trạm dừng nghỉ

- Kế hoạch chuyến (`tripPlanFor`) có `restStops`: cứ khoảng 90 km đường bộ một trạm, gọi tên theo cây số ("Trạm dừng nghỉ Km 180") vì **chưa đối chiếu được tên trạm thật** trên từng tuyến. Mỗi trạm có cửa hàng tiện lợi và quán ăn (đồ ăn uống phổ thông cộng đặc sản của tỉnh trạm đó), nhà vệ sinh miễn phí, cây xăng và trụ sạc.
- **Giờ lái xe**: luật 2024 quy định không lái liên tục quá 4 giờ, không quá 10 giờ một ngày và 48 giờ một tuần. Game quy đổi theo quãng đường với tốc độ trung bình 60 km/h: cứ 240 km phải nghỉ một lần (`restsNeeded`). Tới nơi mà nghỉ thiếu thì mỗi lần thiếu mất thêm 6 thể lực kèm lời nhắc. Game chưa áp giới hạn 10 giờ mỗi ngày và 48 giờ mỗi tuần.
- Ghé nhà vệ sinh hồi 2 thể lực ("tỉnh táo"); ăn uống hồi theo món. Mua tại trạm khi đang chạy qua `/api/shop/buy` với `shopId` dạng `rest:<mã chuyến>:<km>`, hoặc gửi gộp trong `rests` khi kết thúc chuyến.

## Mua sắm

- Danh mục ở `shared/shop.ts`: quần áo (áo bà ba, áo dài, áo tứ thân, thổ cẩm Tây Nguyên và Tây Bắc, áo tơi, đồ hiện đại), nón mũ (nón bài thơ, nón quai thao, nón ngựa…), phụ kiện (khăn rằn, gùi, quang gánh…), kiểu nhà (cấp bốn, nhà ống, nhà rường, nhà dài, nhà rông, trình tường, nhà nổi, biệt thự vườn), nội thất, đồ sân vườn, xe cá nhân (xe đạp, xe máy, xe máy điện, ô tô con xăng và điện).
- **Đồ đặc trưng vùng miền chỉ bán ở tỉnh đó**: phải tới nơi (vùng nhà, nơi đang tham quan hoặc nơi xe đỗ thuộc tỉnh) mới mua được. Tỉnh gắn cho từng món là theo hiểu biết chung, chưa đối chiếu nguồn.
- Mỗi ô (áo, nón, phụ kiện, nhà, xe) dùng một món; món đầu tiên mua cho một ô thì dùng luôn.
- **Xe cá nhân thay taxi**: có xe riêng (và bằng lái hợp lệ: A1 cho xe máy, B cho ô tô) thì các chặng taxi tới địa danh chỉ tốn tiền xăng hoặc điện, nếu xe đi nổi quãng đó (xe đạp tới 12 km, xe máy điện tới 70 km…). Chặng tàu ra đảo không đổi.
- Hệ thống cũ ở mục Trang trí (3 kiểu nhà, 4 kiểu nón, màu áo, đồ sân) **giữ nguyên**; đồ mua ở đây mới được lưu sở hữu và ô đang dùng, phía giao diện chưa có mô hình 3D cho chúng.

## Cấp bậc và EXP toàn game

Mọi hoạt động đều có điểm kinh nghiệm (EXP), ghi vào sổ `xp_log` theo nguồn. Bảng nguồn nằm ở `XP_RULES` trong `shared/progress.ts`; giao diện đọc qua `GET /api/progress` (`xpRules`, kèm số EXP đã nhận hôm nay của từng nguồn).

| Nhóm | Việc (EXP mỗi lần · trần mỗi ngày) |
|---|---|
| Trồng trọt | trồng 2 · 60; chăm một bước 1 · 80; thu hoạch 5; giúp vườn bạn 2; nâng cấp đất 40 |
| Bán hàng | bán doanh nghiệp 2 + 1 cho mỗi 200.000đ (tối đa +20) · 150; bày sạp 1 · 10; sạp có người mua 2 + theo giá trị · 100; mua sạp bạn 1 + theo giá trị · 40; thu mua sỉ 2 + theo giá trị · 60 |
| Vận chuyển | hoàn thành chuyến xe 10 + 1 cho mỗi 50 km (tối đa +30); không bị phạt thêm 10; tới vùng mới 30; mua đất 100 |
| Siêu thị, xuất khẩu | ký gửi 3 · 18; hàng ký gửi bán được 5 · 100; mua siêu thị 1 · 10; gửi lô xuất khẩu 10 · 100; lô tới nơi 40; giao đơn 15 |
| Xưởng | chạy mẻ 3 · 45; lấy mẻ 8; bán thành phẩm 2 + theo giá trị · 150; mua máy 30; nâng máy 30; lắp máy nhập khẩu 120 |
| Kết nối, trang trí | tặng quà 3 · 15; kết bạn 10 · 30; lập hợp tác xã 80; vào hợp tác xã 20 · 20; góp đơn 4 + theo giá trị · 120; trang trí 3 · 15; nhận vai 20 |
| Sưu tập, tham quan | tem mới 3; đủ bộ tem một vùng 40; check-in điểm dừng 10; tham quan trọn địa danh 50 |
| Dung hợp | thành công 25; chưa thành 5 · 25; bán hộp quà 3 + theo giá trị · 150 |

Chống cày: việc lặp rẻ (trồng, chăm, bày sạp, ký gửi…) có trần EXP mỗi ngày theo giờ Việt Nam; EXP theo giá trị giao dịch có trần mỗi lần và trần ngày, nên hai tài khoản mua qua bán lại không đẩy cấp nhanh được. Ăn uống, xem bảng, đi vé không có EXP.

**30 cấp.** Mười cấp đầu giữ nguyên ngưỡng cũ (0 → 7.000); cấp 11–30 lên tới 270.000 EXP. Bảng `LEVEL_UNLOCKS` ghi mỗi cấp mở gì, chỉ gồm những thứ máy chủ thật sự kiểm: thể lực tối đa (+10 mỗi cấp, trần 250), lượng mua siêu thị mỗi ngày (+5 kg mỗi cấp), cấp nâng đất (cấp 2/3/4/5 cần nhân vật cấp 3/6/10/15), lai giống (cấp 4, 7, 11), hộp quà (cấp 6, 9, 13), ghép máy (cấp 8), xuất khẩu hộp quà (cấp 10), máy nhập khẩu (cấp 5, 6, 9, 12). Mỗi cấp có tiền thưởng 20.000đ × cấp, **nhận bằng tay** ở bảng tiến trình (không tự cộng, để số dư không đổi bất ngờ giữa một giao dịch).

**Nhiệm vụ ngày.** Mỗi người mỗi ngày có 3 việc: hai việc theo vai, một việc chung, cố định theo (người, ngày). Tiến độ đếm số dòng sổ EXP trong ngày của các nguồn liên quan. Thưởng EXP và tiền, tăng 5% mỗi cấp.

**Thành tựu.** 24 mốc dài hạn, đếm theo sổ EXP (nên chỉ tính từ khi có sổ), riêng mốc cấp, địa danh, vùng trồng đọc số có sẵn.

## Nâng cấp theo vai

- **Nhà vườn và thương lái (có đất trồng):** bốn hạng mục nâng cho cả thửa, mỗi hạng mục 5 cấp, giá gốc × 1, 2, 4, 7, 11. Cải tạo đất (300.000đ, +5% sản lượng mỗi cấp), tưới nhỏ giọt (500.000đ, −5% thời gian chờ mỗi cấp), nhà màng (1.200.000đ, bớt 15% mức chậm lớn do thời tiết xấu mỗi cấp), cảm biến (800.000đ, nới 20% thời gian trước khi bị tính chăm trễ mỗi cấp). Tác dụng áp ngay vào chỗ tính thời gian chờ, sản lượng và hạng chất lượng. Khi bạn chăm giúp vườn người khác, bước kế chưa tính nâng cấp của chủ vườn (đơn giản hoá).
- **Chủ xưởng:** nâng cấp máy như cũ, thêm máy nhập khẩu và ghép máy (mục dưới). Lô nhà xưởng không có hạng mục đất.
- **Thương lái:** chưa có nâng cấp kho và giấy phép kinh doanh (chưa làm).

## Máy nhập khẩu

Bốn máy ngoại, nêu xuất xứ theo nước (Nhật Bản, Hàn Quốc, Ý, Đức), không gắn hãng thật. Máy ngoại chạy nhanh hơn máy nội 35–45% và ra thêm 6–8% thành phẩm; là một máy thuộc loại sẵn có nên dùng chung công thức, chỗ đặt và giới hạn mỗi loại 2 máy. Chưa có công thức riêng chỉ máy ngoại làm được.

Đặt mua trả ngay: giá máy + cước biển (60.000đ mỗi phút hải trình) + thuế nhập khẩu 2% + thuế giá trị gia tăng 10% + phí thông quan 500.000đ. Máy về qua ba chặng có mốc thời gian để phát hoạt cảnh: tàu container về cảng (16–36 phút), thông quan (6 phút), xe đầu kéo về xưởng (4 phút); tới nơi phải bấm lắp. Tối đa 2 máy đang trên đường. Thuế phí là mức đơn giản hoá, ngoài đời tuỳ mã hàng và hiệp định thương mại.

## Dung hợp

Ba hệ, đều ghi rõ tỉ lệ thành công trong dữ liệu trả về: tỉ lệ gốc + 1,5 điểm phần trăm mỗi cấp nhân vật + 15 điểm nếu mua vật tư tăng cường (giá bằng nửa chi phí công thức), trần 95%. Thất bại được trả lại một nửa nguyên liệu; tiền vật tư thì mất.

- **Lai tạo giống (nhà vườn, thương lái):** hai đặc sản khác nhau cùng loại cây hoặc cùng nhóm cây, hàng Loại 1. Ra 4 gói giống của đặc sản thứ nhất; mỗi gói trồng một ô không tốn tiền giống. Chín sớm (20 kg mỗi loại, 200.000đ, gốc 60%, cấp 4): mỗi bước nhanh hơn 25%. Năng suất cao (30 kg, 400.000đ, 50%, cấp 7): +30% sản lượng. Thượng hạng (40 kg, 800.000đ, 40%, cấp 11): luôn Loại 1 và +10% sản lượng. Giống lai không tạo hạng chất lượng mới; giá trị nằm ở sản lượng, tốc độ và việc chắc chắn đạt Loại 1 (điều kiện của thị trường khó tính).
- **Phối hộp quà (chủ xưởng):** 2, 3 hoặc 4 loại thành phẩm khác nhau (hộp ba miền cần ba miền khác nhau) + tiền bao bì → 10, 15 hoặc 24 hộp, tổng giá trị bằng 125%, 145%, 170% giá các thành phẩm bỏ vào. Hộp nằm trong kho hộp quà riêng; bán cho doanh nghiệp quà tặng đủ giá, hoặc xuất khẩu được thêm 20% khi gom từ 20 hộp và đạt cấp 10. Hộp quà **chưa** lên được kệ siêu thị và chưa đi qua hệ lô hàng xuất khẩu (bán xuất khẩu là nhận tiền ngay).
- **Ghép máy (chủ xưởng, cấp 8):** hai máy chế biến cùng loại, cùng cấp, cùng xuất xứ, đang rảnh + linh kiện (25% giá nâng cấp) → một máy cao hơn một cấp, gốc 70%. Thất bại giữ nguyên cả hai máy. Chưa có dây chuyền liên hoàn ghép từ hai máy khác loại.

Cân bằng và kẽ hở còn lại: giống năng suất cao cộng dồn với cải tạo đất cấp 5 cho +62% sản lượng, chưa chơi thử để cân với hiện tượng được mùa mất giá; hộp quà thượng hạng lãi tối đa 70% trước chi phí bao bì và rủi ro 40% hỏng ở cấp thấp, chưa có trần bán mỗi ngày; EXP nhiệm vụ ngày và thành tựu không có trần ngày vì bản thân chúng đã giới hạn số lần.

## Xuất khẩu: bỏ trần số lô theo cấp

Trần "số lô đang trên đường" theo cấp đã bỏ (chỉ còn mức chặn 20 lô để tránh gửi dồn bất thường). Giới hạn thật là lượng hàng trong kho và mức tối thiểu mỗi đường. Tàu container viễn dương nhận hàng lẻ ghép container từ 200 kg: phí cố định bằng một phần tư, cước mỗi kg gấp ba; máy chủ tự lấy cách tính rẻ hơn giữa hàng lẻ và nguyên container (điểm hoà vốn khoảng 9 tấn).

## Thu mua sỉ theo tải trọng xe (cập nhật)

- **Nguồn hàng của vùng:** mỗi đặc sản có khoảng 40 tấn mỗi ngày cho tất cả thương lái (`WHOLESALE_BASE_KG`); chính vụ ×1,5, trái vụ ×0,4. Một lần mua tối đa bằng chỗ trống trên chiếc xe đang lái: xe 15 tấn mua 15 tấn, đầu kéo khoảng 28 tấn.
- **Đường cung (giá mua tăng dần):** 5 tấn đầu của vùng trong ngày giá 90% tham chiếu, sau đó tăng đều tới 105% khi cạn nguồn (`wholesaleRatioAt`, `wholesaleQuote`). Giá một lần mua là giá trung bình của đúng đoạn đường cung đó.
- **Sức mua của chợ nơi đến (giá bán giảm dần):** mỗi chợ vùng giữ giá cho 1 tấn đầu mỗi loại trong 24 giờ, sau đó giá rớt đều tới −45% ở mốc 30 tấn (`bulkSellFactor`). Áp cho thương lái và người tự lái xe bán tại nơi xe đỗ; cộng dồn với hệ số được mùa toàn máy chủ đã có.
- **Hao hụt đường dài:** hàng vừa thu mua sỉ hao 0,5% mỗi 100 km đường bộ, tối đa 6%; xe thùng lạnh chỉ hao 1/5 (`spoilRate`). Trừ khi chuyến xe tới nơi.
- **Cân bằng:** mua rồi bán tại chỗ luôn lỗ (giá tại vườn 85% < giá mua ≥ 90%, còn bị ép giá). Chở xa: 1 tấn lời khoảng 22% trước chi phí; 15 tấn lời mỗi kg thấp hơn nhưng tổng lời cao hơn; vét cạn 40 tấn rồi xả vào một chợ thì lỗ. Kẽ hở còn lại: chia một xe lớn ra bán ở nhiều chợ gần nhau để né ép giá (tốn thêm chuyến); xả 15 tấn làm hệ số được mùa toàn máy chủ chạm đáy 24 giờ, ảnh hưởng giá của nhà vườn cùng loại. Các con số chưa chơi thử để cân.

## Bằng lái: thời hạn, điểm, thi và đổi (cập nhật)

Viết theo hiểu biết sẵn có về Luật Trật tự, an toàn giao thông đường bộ 2024, **chưa đối chiếu văn bản**.

- **Thời hạn:** A1, B1 không thời hạn; B, C1 10 năm; C, CE 5 năm. Một "năm bằng lái" = 3 ngày thật (`LICENSE_YEAR_DAYS`), nên B/C1 hết hạn sau 30 ngày thật, C/CE sau 15 ngày. Thời hạn không theo `TIME_SCALE`; máy chủ có biến riêng `LICENSE_TIME_SCALE` (mặc định 1) để tua nhanh khi cần.
- **Cấp mới:** phải đạt lý thuyết (từ 80/100) và, với các hạng ô tô (B trở lên), đạt sa hình (từ 80/100) trong vòng 1 "năm"; mỗi lượt thi thu lệ phí (lý thuyết 100.000đ, sa hình 300.000đ), rồi mới đóng lệ phí cấp bằng.
- **Điểm:** mỗi bằng 12 điểm. Bị phạt quá tốc độ trong chuyến xe thì trừ theo mức phạt (2, 4, 6 điểm…). Hết điểm bằng bị tạm khoá, thi lại lý thuyết đạt thì phục hồi 12 điểm. 12 "tháng" không bị trừ thì tự đủ điểm lại.
- **Hết hạn:** không được bắt đầu chuyến bằng xe cần hạng đó. Đổi bằng (lệ phí 135.000đ): còn hạn hoặc quá hạn dưới 3 "tháng" đổi thẳng; quá 3 tháng đến dưới 1 năm phải thi lại lý thuyết; từ 1 năm phải thi lại cả sa hình.
- **Đơn giản hoá:** không có khám sức khoẻ, không có thi đường trường và mô phỏng; bài thi do phía người chơi chấm điểm, máy chủ chỉ kiểm tra khoảng điểm và thời gian làm bài tối thiểu.

## Nông trại quy mô lớn (cánh đồng, máy nông nghiệp, drone, trực thăng)

Chỉ dành cho **nhà nông** (vai `nong_dan`): chủ xưởng mở rộng bằng máy chế biến, thương lái bằng xe lớn — mỗi vai một đường lớn lên riêng. Luật nằm ở `shared/farm.ts`, máy chủ `server/src/farm.ts`.

- **Cánh đồng** mua theo **khối 100 ô** (0,25 ha). Từ cấp 5: hạn mức `(cấp − 4) × 2` khối, tối đa 40 khối (4.000 ô). Một cánh đồng gộp 1–10 khối, trồng **một loại**; mỗi bước chăm áp dụng cho cả cánh đồng. Dưới cấp 10 chỉ mua ở vùng nhà, từ cấp 10 mua vùng nào cũng được. Giá một khối = giá thửa vườn × 1,2 (+ lệ phí trước bạ/sổ như đất vườn); bán lại khi ruộng trống được 70%.
- **Năng suất** mỗi ô = 0,5 × vườn nhà (quảng canh); nhịp sinh trưởng cố định như người đã quen (pace 2: một vụ bằng nửa `growHours`); giống = 8% giá trị sản lượng như vườn. Trễ bước quá hạn mức vẫn hạ loại A/B/C.
- **Cách làm mỗi bước**: *Tự làm* 60 ô/giờ, 12 thể lực mỗi khối, không tốn tiền; *Thuê nhân công* 4.000 đ/ô, 250 ô/giờ; *Dùng máy*/*Drone* nhanh và rẻ mỗi ô nhưng phải mua máy. Bước tỉa cành/bao trái chỉ làm tay hoặc thuê. Một máy chỉ làm một cánh đồng một lúc — ruộng sau xếp hàng chờ.

| Máy | Giá | Cấp | Làm bước | Công suất | Chi phí/ô |
|---|---|---|---|---|---|
| Hệ thống tưới | 30 tr | 5 | tưới | 3.000 ô/giờ | 200 đ |
| Máy cày (không cần bằng lái trong game) | 180 tr | 6 | làm đất | 500 ô/giờ | 600 đ (dầu) |
| Máy gieo/cấy | 120 tr | 7 | gieo, trồng | 600 ô/giờ | 500 đ |
| Drone phun/rải | 95 tr | 8 | bón, phun, tưới — chỉ ruộng ở vùng nhà (tầm bay, pin) | 1.600 ô/giờ | 250 đ |
| Máy gặt/thu hoạch | 350 tr | 10 | thu hoạch | 500 ô/giờ | 900 đ |
| Trực thăng riêng | 3,5 tỷ | 15 | bay tham quan miễn phí | — | — |

- **Trực thăng tham quan**: thuê 3 triệu/chuyến từ cấp 8 (hoặc miễn phí nếu sở hữu), bay vòng trên các cánh đồng của mình, xem từ cabin hoặc từ ngoài.
- **Áp lực xả hàng**: sản lượng lớn bán tại chợ nhà chịu `bulkSellFactor` như mọi người — 55 tấn xoài một lúc chỉ được ~68% giá. Muốn lãi hơn phải chia nhiều đặc sản, đưa cho xưởng chế biến hoặc xuất khẩu.

**Cân bằng** (`node tools/farm-sim.ts`, Xoài Cao Lãnh 40.000 đ/kg, giờ thật TIME_SCALE = 1, chơi đều tay):

| Vai | Cấp | Vốn | Chu kỳ | Lãi/giờ | Hoàn vốn |
|---|---|---|---|---|---|
| Nông trại 2 khối, thuê người | 5 | 116 tr | 21 giờ | 6,5 tr | 0,7 ngày |
| Nông trại 6 khối, tưới + máy cày | 7 | 558 tr | 31 giờ | 12,2 tr | 1,9 ngày |
| Nông trại 12 khối, đủ máy | 10 | 1,47 tỷ | 33 giờ | 18,9 tr | 3,2 ngày |
| Nông trại 20 khối, đủ máy, 1 đặc sản | 14 | 1,94 tỷ | 46 giờ | 19,6 tr | 4,1 ngày |
| Nông trại 20 khối, đủ máy, 3 đặc sản | 14 | 1,94 tỷ | 46 giờ | 27,7 tr | 2,9 ngày |
| Nông trại 40 khối, đủ máy | 24 | 3,1 tỷ | 76 giờ | 20,3 tr | 6,3 ngày |
| Thương lái xe 15 tấn, 250 km | 6 | 699 tr | 10 giờ | 4,0 tr | 7,2 ngày |
| Thương lái đầu kéo 28 tấn, 250 km (xả một chợ) | 7 | 1,31 tỷ | 10 giờ | âm | — |
| Chủ xưởng 4–8 máy sấy, mua sỉ 40 tấn/ngày | 5–10 | ~0,3 tỷ | 4 giờ | 24 tr | 0,5 ngày |

Nhận xét: nông trại cấp 10 nằm trong ±50% của chủ xưởng; lãi/giờ **bão hoà ~20 tr** khi chỉ trồng một loại vì chợ chỉ hút có hạn, nên mua thêm ruộng không làm nông dân lấn át. Thương lái hiện **thấp hẳn** (4 tr/giờ, đầu kéo xả một chợ thì lỗ) và chủ xưởng hoàn vốn quá nhanh (bán thành phẩm chưa bị ép giá khi xả) — hai chỗ này thuộc đợt cân bằng buôn bán/xuất khẩu, không chỉnh trong nhánh nông trại.

Đơn giản hoá: máy cày không đòi bằng lái; chưa có thuê/cho thuê máy giữa người chơi; chưa có xe tải nông trại (dùng xe tải thường); ruộng không có thời tiết riêng ngoài hệ số sinh trưởng của vùng.

### Cánh đồng trong thế giới 3D, làm hàng loạt, tự lái máy (nhánh F4)

**Đất thật ngoài lô vườn.** Cánh đồng không còn chỉ là lưới ô vuông trong bảng: các khối ruộng nằm **sau lưng xóm**, ngoài dãy lô vườn đã cấp. Đường đi: từ đường làng đi về đầu xóm phía đông, rẽ vào **đường đất** (vùng có kênh sau xóm như miền Tây thì qua **cầu ván**), ra **đường bờ ruộng** chạy dọc mặt trước cánh đồng. Khối xếp 8 khối một hàng; giữa hai khối cạnh nhau là **bờ** (1,2 m), giữa hai hàng khối là **mương nước** (3 m). Mỗi khối có **cột mốc** ghi **số sổ đỏ** của thửa (`VV-<tỉnh>-NN-<số>`, từ sổ địa chính) và tên cây đang trồng. Nút **"Ra đồng"** trong bảng Cánh đồng dẫn nhân vật tự đi (nhanh gấp 1,7 lần đi bộ) theo đường đất ra tới khối ruộng; chạm cần điều khiển là thôi tự đi. Chỉ dựng cánh đồng thuộc vùng đang xem; khi có ruộng, đất sau xóm được làm phẳng, cây rừng và núi lùi ra xa.

**Làm hàng loạt — quy tắc sắp xếp (không bung từng ô):**
- Một lượt làm trên N ô đi theo **đường chạy kiểu cày ruộng**: hết khối này sang khối kia; trong khối chạy theo dải luống, dải chẵn trái→phải, dải lẻ phải→trái (`workSeq`).
- **Máy** (một chiếc của mình): giàn rộng **2 ô** (máy cày, máy gieo, máy gặt), **drone 3 ô**; một máy chạy hết đường.
- **Thuê nhân công / thuê robot**: số tổ = số khối (tối đa 12); đường chạy chia đều cho các tổ (`crewSpans`), các tổ **làm song song**, mỗi tổ đi luống trong vùng của mình.
- Ô đổi trạng thái đúng lúc máy/tổ đi qua: làm đất → đất cày sẫm theo luống; gieo → cây con mọc; tưới → đất sẫm ướt; bón/phun → vệt sương; thu hoạch → cây biến mất, còn gốc rạ vàng.
- **Xem tua nhanh** khi vừa giao việc: thời lượng nén theo quy mô `min(25, 6 + 0,6·√N)` giây (100 ô ≈ 12 s, 800 ô ≈ 23 s, tối đa 25 s), có nút **Bỏ qua**. Máy quay bám **khối** đang làm của máy/tổ dẫn đầu (không bám từng vòng quay đầu), lùi xa theo cỡ ruộng. Tua xong cảnh trở về **tiến độ thật** của lượt (máy chủ tính giờ; máy/tổ đứng đúng chỗ theo % thời gian đã qua).

**Thuê robot làm vườn** (cách làm mới, từ cấp 8): 2.500 đ/ô, 450 ô/giờ — rẻ và nhanh hơn thuê người (4.000 đ/ô, 250 ô/giờ), làm mọi việc trừ tỉa cành/tạo tán (việc "chăm sóc bằng tay" vẫn cần người).

**Tự lái máy:** máy cày, máy gieo, máy gặt đã mua **đậu ở bãi cuối đường bờ ruộng** (phía đông lối ra đồng). Đứng cạnh máy → nút **"Lên máy …"**; lái bằng cần điều khiển như xe tải (tối đa 6 m/s ≈ 22 km/h, quay đầu chậm, không xuyên qua máy khác). **Hạ giàn** thì mọi ô giàn đi qua được làm thật cho bước hiện tại của ruộng đó (đúng việc của máy, đã tới giờ, không có lượt khác đang chạy). Giao diện gửi lô ô mỗi ~2 giây lên `POST /api/fields/:id/drive` kèm quãng đường và thời gian; máy chủ chặn **chạy quá 7,5 m/s** và **số ô vượt bề rộng giàn trên quãng đường** (`driveTileCap`), trả **tiền dầu theo ô** (bằng chi phí/ô của máy), đủ ô thì bước xong ngay và sang bước kế. Đã tự lái một phần thì nếu giao phần còn lại cho người/robot/máy tự chạy, **chỉ tính tiền và giờ cho số ô còn lại**.

**Hiệu năng:** đất mọi khối là một lưới tô màu từng ô; bờ/mương/đường/cột mốc gộp vài lưới; chữ cột mốc là một ảnh ghép; cây là InstancedMesh thưa theo khoảng cách; người làm thuê và robot là InstancedMesh dùng chung. Đo trên Chromium giả lập (không GPU): đứng giữa cánh đồng 800 ô **16–36 lần vẽ** cả cảnh; xem tua máy cày 21, tổ thợ 36 (lúc khung hình có cả xóm).

## Cân bằng kinh tế (23/11, làm lại theo phản hồi)

Mô phỏng bằng `node tools/econ-sim.mjs` (thêm `--khong-dong` bỏ cánh đồng, `--dong-de-xuat` thử cánh đồng nhịp 1, năng suất 0,6; `--chi-tiet` in từng kênh). Đơn vị: đồng mỗi giờ chơi, giả định chơi 3 giờ/ngày, cây và máy vẫn chạy khi offline, vốn lưu động 5 tr / 150 tr / 1,5 tỉ / 6 tỉ ở cấp 1/10/20/30, ba đặc sản mẫu (sầu riêng, xoài, cà phê). Mỗi vai gồm kênh chính + đơn hàng + một phần xuất khẩu/hợp đồng chạy nền.

| Cấp | Trước: nông dân / xưởng / thương lái (lệch) | Sau: nông dân / xưởng / thương lái (lệch) | Sau, cánh đồng theo đề xuất |
|---|---|---|---|
| 1 | 10,8 tr / 5,1 tr / 4,9 tr (×2,18) | 10,7 tr / 5,7 tr / 6,1 tr (×1,88) | như cột bên |
| 10 | 95,8 tr / 167 tr / 115 tr (×1,75) | 81,8 tr / 81,1 tr / 97,5 tr (×1,20) | 64,9 / 81,1 / 97,5 (×1,50) |
| 20 | 552 tr / 1,33 tỉ / 418 tr (×3,18) | 506 tr / 356 tr / 354 tr (×1,43) | 367 / 356 / 354 (×1,04) |
| 30 | 1,29 tỉ / 3,83 tỉ / 699 tr (×5,48) | 1,12 tỉ / 502 tr / 441 tr (×2,55) | 787 / 502 / 441 (×1,79) |

Xuất khẩu tốt nhất mỗi giờ: trước 132 tr / 403 tr / 974 tr (cấp 10/20/30, đều sang Châu Âu – Mỹ); sau 76 tr / 233 tr / 396 tr. Lô 10 tấn sầu riêng đi Mỹ: lãi sau vốn từ 592 tr còn khoảng 360 tr và lô thứ hai liền sau bị ép giá. Đơn nội địa mỗi giờ: trước 0,3 tr ở mọi cấp; sau 0,6 / 3,0 / 5,7 / 8,4 tr.

Đã sửa:
- **Giá thị trường xuất khẩu** hạ: Trung Quốc 1,12, Lào–Cam 1,05, Thái–Sing 1,18, Ấn Độ 1,2, Trung Đông 1,28, Nhật–Hàn 1,38, Nga 1,25, Úc 1,45, Âu–Mỹ 1,5 (trước tới 1,9).
- **Sức mua có hạn** (`exportDemandFactor`): mỗi thị trường mua dễ 4 tấn một đặc sản mỗi 24 giờ (tính mọi người chơi), xả tới 40 tấn thì giá rớt tối đa 35%. **Giá thế giới dao động ±8%/ngày** theo thị trường và đặc sản (`exportTrend`).
- **Sức chứa mỗi mẻ máy**: 30/50/80 kg nguyên liệu theo cấp máy, máy nhập khẩu +50% (trước không giới hạn nên xưởng lời vô hạn theo vốn). Bán thành phẩm cho doanh nghiệp cũng bị ép giá khi bán nhiều một loại trong 24 giờ (như chợ nông sản).
- **Đơn hàng**: trả 135% giá tham chiếu + thưởng `200k + 100k × cấp`; khối lượng nhân `1 + 0,5 × (cấp − 1)`; thêm đơn thứ tư theo vai (xưởng: thành phẩm; thương lái: đơn sỉ 150–300 kg × hệ số; nhà vườn: đơn thu mua lớn), EXP hiện trên đơn.
- **Đề xuất cho nhánh cánh đồng** (shared/farm.ts, chưa đổi ở đây): `FIELD_PACE` 2 → 1 và `FIELD_YIELD_MULT` 0,8 → 0,6 để nông dân cấp 20–30 không gấp đôi vai khác; cấp 30 vẫn ×1,8 nên cân nhắc thêm hạ `FIELD_MAX_BLOCKS`.
- Cấp 1 còn lệch ×1,9 vì nhà vườn có sẵn 30 ô; cấp 1 chỉ kéo dài khoảng một giờ chơi, thương lái và chủ xưởng bù bằng đơn hàng riêng theo vai.

## Xuất khẩu gộp lô

Một lô gồm tối đa 12 mặt hàng (tươi, khô, chế biến). Mức tối thiểu/tối đa của đường đi tính trên **tổng lô**; cước cố định trả một lần, cước theo kg và cước nội địa chia theo kg cho từng dòng; phí kiểm dịch chỉ tính cho dòng hàng tươi. Mặt hàng thị trường không nhận (chỉ Loại 1, chỉ hàng chế biến/khô) hiện lý do và bị bỏ khỏi lô khi gửi. Giao diện: bước 1 là "Giỏ hàng xuất khẩu" (chọn nhiều, nút −100/+100/½/Hết), báo giá cả lô cho mọi thị trường, mỗi đường hiện cước, thời gian, hao từng dòng, tiền về, lãi.

API: `POST /api/export/quote { items:[{specialtyId, grade, kg, processed?}], market? }` → `{ quotes: BundleQuote[] }` (mỗi đường một báo giá, `lines[]` có `ok/reason/freight/spoilKg/unitPrice/demand/trend`); `POST /api/export/ship { items, mode, market }` (kiểu cũ `{specialtyId, grade, kg, mode, market, processed?}` vẫn nhận). Một lô nhiều dòng tính là một lô đang đi.

## Công ty xuất nhập khẩu (NPC)

Tám công ty hư cấu (Phương Nam Xanh – TP.HCM, Kinh Bắc Lộc – Bắc Ninh, Cảng Biển Đông – Hải Phòng, Cao Nguyên Vàng – Đắk Lắk, Nông sản Sông Hàn – Đà Nẵng, HTX Cửu Long – Cần Thơ, Biên Mậu Xứ Lạng – Lạng Sơn, Hoa Trái Đà Lạt – Lâm Đồng). Mỗi ngày mỗi công ty đặt 2 hợp đồng (tất định theo ngày, hạn 2 ngày): đặc sản gần kho, hàng tươi 2–20 tấn giá 112–122% giá tham chiếu hoặc thành phẩm 0,5–3 tấn giá 108–116%, loại tối thiểu. Nhiều người cùng giao từng phần, có bảng xếp hạng; giao vượt chỉ nhận phần còn thiếu. Có mặt ở tỉnh có kho (xe đỗ, vùng nhà, đang tham quan) thì không mất phí, không thì thuê chành xe 2,5 đ/kg/km. Công ty cũng niêm yết máy nhập khẩu (giá tham khảo).

API: `GET /api/companies`, `GET /api/companies/:id/contracts` (kèm `leaderboard`), `POST /api/contracts/:id/deliver { specialtyId?, grade, kg }`. Giao diện: `web/src/contracts.tsx` (`ContractsPanel`), thẻ "Hợp đồng" trong Kho.

## Siêu thị khắp nơi, siêu thị riêng và xưởng chi nhánh

Tỉnh nào cũng có siêu thị đặc sản (kệ nhà bán + hàng ký gửi). Chủ xưởng (từ cấp 8), thương lái (cấp 8) và nhà vườn (cấp 18) mua đất thương mại để mở **siêu thị riêng** (tối đa 3); chủ xưởng từ cấp 12 mở **xưởng chi nhánh** ở tỉnh khác tỉnh nhà (tối đa 2, mỗi cái +4 chỗ đặt máy). Giá = đất (120 tr × theo độ đông khách của tỉnh) + xây 180 tr + giấy phép 15 tr cho siêu thị; xưởng 90 tr đất + 140 tr + 10 tr. Xây 6 giờ / 4 giờ. Siêu thị riêng bán hàng bày trên kệ theo lượt khách (`30 kg/giờ × độ đông khách × (1 + 4%/cấp chủ)`; tỉnh nhiều địa danh, thành phố lớn đông hơn), hàng rẻ bán trước, giá trên 1,2 lần tham chiếu bán chậm dần; người khác ký gửi thì chủ thu 7%. Chủ nhận doanh thu bằng nút "Nhận tiền".

API: `GET /api/properties?province=`, `POST /api/properties/buy { province, kind: 'sieu_thi'|'xuong' }`, `GET /api/properties/:id`, `POST /api/properties/:id/collect`, `POST /api/properties/:id/stock { specialtyId, grade, kg, processed?, price }`, `POST /api/properties/:id/withdraw { shelfId }`. Giao diện: `web/src/properties.tsx` (`ProvinceShops` gắn sẵn trong SupermarketPanel, `PropertiesPanel` cho Hồ sơ).

_(Đã thay bằng "Sổ địa chính" bên dưới: siêu thị cấp 20, có thêm cửa hàng đặc sản, đất theo quỹ đất tỉnh.)_

## Sổ địa chính: quỹ đất theo tỉnh, sổ đỏ, chuyển nhượng (nhánh B3, 23/11)
Luật: `shared/land.ts`; máy chủ `server/src/land.ts` (bảng `land_lots`, `land_transfers`); bảng mẫu `node tools/land-table.ts [tỉnh…]`; kiểm thử `server/test/land.test.ts`.

- **Quỹ đất hữu hạn mỗi tỉnh, chia theo loại đất của Luật Đất đai 2024:** đất nông nghiệp (thửa 2.500 m² = một khối cánh đồng), đất thương mại – dịch vụ (thửa 100 m²), đất khu/cụm công nghiệp (thửa 1.000 m²), đất ở (chưa mở). Quỹ đợt 1 = diện tích quy hoạch thật / tỉ lệ (NN 200 ha/thửa, TMD 20 ha, KCN 50 ha), tối thiểu 10 thửa. Máy chủ đếm thửa đã cấp sổ; hết quỹ thì báo `het_dat`. Bán ruộng về nhà nước thì thửa trở lại quỹ.
- **Nguồn số liệu:** diện tích, dân số theo NQ 202/2025/QH15 (làm tròn); tỉ lệ đất sản xuất nông nghiệp, diện tích KCN, tỉ lệ đất TMD là **ước tính theo nhóm** (ghi rõ trong đầu `shared/land.ts`) — cần rà theo quy hoạch tỉnh 2021–2030. Giá đất là mức **đại diện** theo bảng giá đất tỉnh từ 1/1/2026, 4 nhóm: (1) Hà Nội, TP.HCM; (2) thành phố trực thuộc TW khác và tỉnh công nghiệp/du lịch lớn; (3) đồng bằng, ven biển, Tây Nguyên; (4) miền núi phía Bắc. Mốc đối chiếu: Hà Nội cao nhất 702 triệu/m², TP.HCM khu vực III tối đa ~75 triệu/m². Đây là giá nhà nước, thấp hơn giá thị trường.
- **Quyền theo vai (cân bằng):** nhà nông → đất nông nghiệp (qua Cánh đồng, cấp 5); chủ xưởng → đất KCN (xưởng chi nhánh, cấp 12); thương lái (và chủ xưởng; nhà nông từ cấp cao) → đất thương mại: **cửa hàng đặc sản** 1 thửa từ cấp 8 (nhà nông cấp 12), **siêu thị** 4 thửa từ cấp 20 (nhà nông cấp 25). Trước đây siêu thị chỉ cần cấp 8 và 315 triệu nên thương lái mở siêu thị quá sớm, rẻ như nhau mọi nơi; nay là công trình lớn, vốn hàng tỉ, hoàn vốn ngang các khoản đầu tư của vai khác.
- **Sổ đỏ và chuyển nhượng:** mỗi thửa một số sổ `VV-<tỉnh>-<loại>-<số>`. Thửa trống rao bán được trong khoảng 70%–300% giá nhà nước; người mua nộp **lệ phí trước bạ 0,5%** (tối đa 500 triệu) + phí cấp sổ 500.000đ; người bán nộp **thuế TNCN 2%**. Lịch sử sang tên lưu ở `land_transfers`. Người mua phải đúng vai với loại đất. Mở công trình dùng thửa trống bạn đã có ở tỉnh đó trước, thiếu mới mua thêm.
- **Lượng khách cửa hàng:** theo dân số, nhóm giá đất (đất đắt = phố đông) và số điểm du lịch (`shopTraffic`). Cửa hàng bán bằng 0,3 siêu thị. `SHOP_KG_PER_HOUR` 30 → 300 để hoàn vốn ~23–25 giờ chơi.
- **Cánh đồng:** giá khối ruộng = giá một thửa đất nông nghiệp của tỉnh; năng suất cánh đồng 0,5 → 0,45.

API: `GET /api/land?province=` (quỹ đất, sổ của tôi, tin rao), `POST /api/land/buy { province, use, count }`, `POST /api/land/:id/list { price }`, `POST /api/land/:id/unlist`, `POST /api/land/:id/purchase`, `GET /api/land/:id` (kèm lịch sử sang tên). `POST /api/properties/buy { province, kind: 'cua_hang'|'sieu_thi'|'xuong' }`.

**Hoàn vốn đầu tư đất theo vai** (`node tools/econ-sim.mjs`, giờ chơi):

| Vai | Khoản đầu tư | Vốn | Thu thêm mỗi giờ chơi | Hoàn vốn |
|---|---|---|---|---|
| Nông dân | 1 khối ruộng (Mộc Châu, Sơn La) | 100 tr | 20,3 tr | 4,9 giờ |
| Chủ xưởng | Xưởng chi nhánh ở Đồng Tháp | 1,72 tỉ | 136 tr | 12,7 giờ |
| Chủ xưởng | Xưởng chi nhánh ở Bắc Ninh | 2,73 tỉ | 136 tr | 20,1 giờ |
| Thương lái | Cửa hàng đặc sản ở Đà Nẵng (cấp 10) | 1,14 tỉ | 49 tr | 23,3 giờ |
| Thương lái | Cửa hàng đặc sản ở Đồng Tháp (cấp 10) | 487 tr | 21 tr | 22,9 giờ |
| Thương lái | Siêu thị ở Đà Nẵng (cấp 20) | 5,09 tỉ | 211 tr | 24,1 giờ |
| Thương lái | Siêu thị ở TP.HCM (cấp 20) | 16,7 tỉ | 394 tr | 42,4 giờ |

Khối ruộng hoàn vốn nhanh nhưng nhà nông chỉ được thêm 2 khối mỗi cấp (trần 40 khối), nên tổng vốn đất nhà nông vẫn thấp. Thu nhập mỗi giờ chơi sau thay đổi (nông dân/chủ xưởng/thương lái): c1 10,7/5,7/6,1 tr · c10 58,4/81,1/99,2 tr · c20 290/356/373 tr (×1,28) · c30 663/502/590 tr (×1,32, trước đó ×1,60). Thương lái nay tính thêm thu nhập thụ động từ cửa hàng/siêu thị (chạy trong lúc đi buôn).

## Giá tham chiếu đời thực (nhánh B3, 23/11)
`shared/realPrices.ts` giữ mọi giá đời thực kèm ngày hiệu lực và nguồn; máy chủ ghi vào bảng `ref_prices` khi khởi động và trả ở `GET /api/ref-prices` (`/api/prices` vẫn là giá đặc sản). Bản ghi có ngày hiệu lực mới hơn trong `ref_prices` thắng bản tĩnh (để sau gắn tác vụ cập nhật). Trạm xăng/sạc gọi `fuelPriceNow(kind)`.

| Khoản | Giá | Hiệu lực | Nguồn |
|---|---|---|---|
| Xăng E10 RON95-III | 19.100 đ/lít | 19/11/2026 | Petrolimex vùng 1 |
| Xăng E5 RON92-II | 18.570 đ/lít | 19/11/2026 | Petrolimex vùng 1 |
| Dầu DO 0,05S-II | 26.340 đ/lít | 19/11/2026 | Petrolimex vùng 1 |
| Điện sinh hoạt 5 bậc | 1.901 / 2.289 / 2.894 / 3.456 / 3.844 đ/kWh (chưa VAT) | 1/11/2026 | QĐ 2892/QĐ-BCT |
| Sạc xe điện V-GREEN | 3.858 đ/kWh | 7/2026 | Tuổi Trẻ |
| Phí cao tốc nhóm 1 | 900–1.300 đ/km (Nhà nước), BOT bình quân 1.721 đ/km; nhóm 2 ×1,5 … nhóm 5 ×4 | 2/3/2026 | 5 tuyến Bắc – Nam |
| Lương tối thiểu vùng I–IV | 5,31 / 4,73 / 4,14 / 3,70 triệu/tháng | 1/1/2026 | NĐ 293/2025/NĐ-CP |
| Lệ phí trước bạ / thuế TNCN chuyển nhượng | 0,5% (tối đa 500 triệu) / 2% | — | NĐ 10/2022, Luật thuế TNCN |

Áp vào game: xe chạy xăng 19.100 đ/lít (trước 21.000), xe dầu 26.340 (trước 19.000), sạc trạm 3.858, sạc ở nhà = bậc 3 + VAT 8% = 3.126 đ/kWh; phí một chặng cao tốc 70 km ≈ 91.000đ (trước 35.000), hệ số nhóm xe theo biểu phí thật (1; 1,5; 2; 3; 4). Cần kiểm lại: VAT điện 8% (mức giảm thuế còn hiệu lực?), giá DO mới nhất.

## Xuất khẩu gọn và Đại lý xuất khẩu trong thế giới (nhánh B3)
- Mỗi đường đi là một thẻ: tên đường + **lãi** trên cùng; một dòng thời gian/cước/tiền về; "N mặt hàng · kg · hao" **gập lại**, mở ra thì mỗi mặt hàng một dòng tên · kg · tiền (hao, đơn giá, cước ở dòng nhỏ dưới); nút **Gửi đi** rộng hết thẻ ở dưới. Giỏ hàng hiện tổng lô và lãi tốt nhất ở trên cùng; tên mặt hàng một dòng, nút kg xuống dòng.
- **Quầy Đại lý xuất khẩu** ở đầu xóm (khe bên trái vườn nhà, sát đường làng, gần chỗ xuất hiện): mái che sọc xanh trắng, quầy gỗ, cân, thùng hàng có đai, container 10 feet, cờ các thị trường; nhân viên đứng quầy vẫy tay. Tới vòng vàng trước quầy → ngữ cảnh `export-desk` → hội thoại (`web/src/exportDesk.tsx`): lời chào theo giờ, 3 đơn công ty trả cao nhất, nút "Xem đơn của công ty" / "Tự gửi lô xuất khẩu".

## Chức năng theo vai (nhánh E4, 24/11)
Bảng duy nhất: `shared/roles.ts` (`canUse(role, feature)`). Giao diện ẩn hẳn thẻ/nút/ngữ cảnh không thuộc vai; máy chủ chặn bằng cùng bảng (`ROUTE_FEATURES`, móc `preHandler` trong `server/src/app.ts`, lỗi 403 `khong_dung_vai`).

| Chức năng | Nhà vườn | Chủ xưởng | Thương lái | Lý do |
|---|---|---|---|---|
| Trồng ở vườn nhà | ✓ 30 ô | — (lô là nhà xưởng) | ✓ vườn bếp 8 ô | như cũ |
| Cánh đồng, máy nông nghiệp, drone, trực thăng | ✓ | — | — | đất trồng lúa chỉ chuyển cho người trực tiếp sản xuất (Luật Đất đai 2024) |
| Hợp tác xã nông nghiệp | ✓ | — | — | HTX trong game là HTX nông nghiệp |
| Lai giống (Lò lai tạo) | ✓ | — | — | việc của người trồng |
| Nhà xưởng, máy chế biến, máy nhập khẩu, ghép máy | — | ✓ | — | vai chế biến |
| Phối hộp quà | — | ✓ | ✓ | đóng gói thương mại |
| Thu mua sỉ bằng xe tải | — | — | ✓ | nghề thương lái |
| Xuất khẩu | — | ✓ chỉ thành phẩm | ✓ tươi + thành phẩm | nông dân bán qua thương lái/HTX/chợ; người xuất là doanh nghiệp thương mại và chế biến |
| Hợp đồng công ty XNK | ✓ chỉ hàng tươi | ✓ | ✓ | liên kết sản xuất – tiêu thụ (NĐ 98/2018/NĐ-CP) |
| Ký gửi kệ siêu thị | — | ✓ | ✓ | siêu thị nhận hàng của nhà cung cấp có hoá đơn |
| Đất nông nghiệp (khối ruộng) | ✓ | — | — | Luật Đất đai 2024: đất trồng lúa chỉ chuyển cho người trực tiếp sản xuất (nhánh P7) |
| Đất thương mại – dịch vụ; mở cửa hàng đặc sản, siêu thị | — | ✓ | ✓ | bán lẻ là nghề thương lái; chủ xưởng mở cửa hàng bán thành phẩm; nhà vườn bán qua chợ/HTX/thương lái (P7, bỏ ngoại lệ "nhà nông cấp 25") |
| Đất khu công nghiệp; xưởng chi nhánh | — | ✓ | — | doanh nghiệp sản xuất thuê lại đất KCN (P7) |
| Mua máy chế biến (kể cả máy công ty XNK bán lại) | — | ✓ | — | máy chỉ dùng trong nhà xưởng; `/api/companies` trả `shop: []` cho vai khác (P7) |
| Xe tải nặng 8–15 tấn, đầu kéo | — | ✓ | ✓ | chở sỉ đường dài; nhà vườn có xe tới 3,5 tấn (kể cả thùng lạnh) chở nông sản nhà mình (P7) |
| Lai giống / Hộp quà / Ghép máy trong Lò lai tạo | chỉ Lai giống | Hộp quà, Ghép máy | chỉ Hộp quà | thẻ trong Lò lai tạo lọc theo `FUSION_FEATURE` (P7) |
| Đất ở | ✓ | ✓ | ✓ | chưa mở bán |
| Chợ, đơn hàng, du lịch, mua sắm, trang trí, bạn bè, bằng lái, lái xe riêng | ✓ | ✓ | ✓ | chung |

Kiểm bằng `node tools/ui-test/roles-audit.mjs` (3 vai, mọi bảng/thẻ, danh sách đen theo vai). Đất và công trình chặn theo loại trong thân yêu cầu: `shared/land.ts` `canBuyLand`/`canBuild` đọc vai từ `rolesOfLand`/`rolesOfBuilding` của `shared/roles.ts`.

Không chặn (để người vừa đổi vai thu dọn): xem xưởng, nhận mẻ đang chạy, bán thành phẩm còn trong kho, rút hàng khỏi kệ siêu thị.
Thay cho xuất khẩu, nhà vườn trong HTX đang hoạt động **bán qua HTX** ở giá tại vườn (85%) + 5% thay vì bán tháo 60%.
Thu nhập/giờ sau đổi (`node tools/econ-sim.mjs`, nhà vườn / chủ xưởng / thương lái): c1 12,4/5,7/6,1 tr · c10 42,8/81,1/99,2 tr · c20 265/356/373 tr · c30 686/502/590 tr. Nhà vườn cấp 10 tụt (mất phần xuất khẩu) — cần tăng nhịp mở cánh đồng ở cấp 5–15 (`shared/farm.ts`, nhánh cánh đồng).

## Hợp tác xã theo Luật Hợp tác xã 2023 (nhánh E4)
- Ít nhất **5 thành viên chính thức** (Luật 17/2023/QH15, khoản 7 Điều 4; luật 2012 là 7). Luật không giới hạn số tối đa → game để 200 (chỉ vì giao diện).
- Không có vốn điều lệ tối thiểu; điều lệ HTX quyết định mức góp → game: mỗi thành viên góp **500.000đ**, ra khỏi HTX được trả lại vốn góp.
- Lệ phí cấp mới Giấy chứng nhận đăng ký HTX do HĐND tỉnh quy định (Thông tư 85/2019/TT-BTC); phổ biến **100.000đ/lần** (ví dụ HĐND Tuyên Quang). Game dùng một mức chung.
- Nộp hồ sơ ở bộ phận một cửa, **Cơ quan đăng ký kinh doanh cấp xã** (từ 01/7/2025, NĐ 125/2025/NĐ-CP thay cấp huyện của NĐ 92/2024/NĐ-CP). Hồ sơ theo Điều 42 Luật HTX 2023: giấy đề nghị, điều lệ, phương án sản xuất kinh doanh, danh sách thành viên, nghị quyết hội nghị thành lập. Xử lý 3 ngày làm việc → game rút còn 30 phút.
- Luồng: vận động (người sáng lập góp vốn) → mời/xin vào (góp vốn) → đủ 5 → nộp hồ sơ + lệ phí (`POST /api/coops/:id/register`, sau này đặt ở khu hành chính) → được cấp số `HTX-…` → mới hưởng quyền lợi (bán qua HTX, đơn lớn). Cư dân (tài khoản máy) được mời thì đồng ý ngay nếu đủ tiền, góp bằng tiền của chính họ.
- Nguồn: [Luật HTX 2023](https://thuvienphapluat.vn/van-ban/doanh-nghiep/Luat-Hop-tac-xa-2023-17-2023-QH15-499239.aspx), [số thành viên tối thiểu](https://accgroup.vn/so-luong-thanh-vien-toi-thieu-cua-hop-tac-xa), [Thông tư 85/2019/TT-BTC](https://luatvietnam.vn/thue/thong-tu-85-2019-tt-btc-phi-va-le-phi-thuoc-tham-quyen-hoi-dong-nhan-dan-cap-tinh-179392-d1.html), [đăng ký HTX ở cấp xã](https://pbgdpl.cantho.gov.vn/dang-ky-ho-kinh-doanh-hop-tac-xa-tai-co-quan-dang-ky-kinh-doanh-cap-xa), [NĐ 92/2024](https://luatvietnam.vn/doanh-nghiep/nghi-dinh-92-2024-nd-cp-dang-ky-to-hop-tac-hop-tac-xa-lien-hiep-hop-tac-xa-360753-d1.html). Chưa kiểm chứng: trần vốn góp của một thành viên (luật cũ 20%) — game chưa áp vì mọi người góp bằng nhau.

## Bộ chọn giống (nhánh E4)
Vùng ≤ 6 giống: thanh nhanh như cũ. Vùng nhiều giống (Đà Lạt 13): thanh nhanh chỉ giữ 5 giống (đang cầm → ghim → gần đây → lời nhất), nút **🗂️ Tất cả** đứng đầu thanh mở bảng lưới theo nhóm cây, tìm kiếm không dấu ("ca phe" → Cà phê), lọc chính vụ, sắp lời nhất/rẻ nhất/nhanh nhất, ghim 📍. Ghim và gần đây lưu trên máy (`web/src/seeds.tsx`).
## Khu vui chơi toàn quốc và tham quan nhiều người (nhánh H4, 24/11)
**Tham quan là không gian chung.** Mọi địa danh và khu vui chơi gửi vị trí qua hiện diện (scene `sight`, khoá = mã địa danh): người chơi thấy nhau đi lại, có bảng tên; cư dân ảo đi tham quan theo kịch bản tính từ đồng hồ (đi giữa các điểm dừng, đứng xem 8–20 giây) nên mọi máy thấy giống nhau, không tốn truy vấn (`web/src/sight/SightOthers.ts`). Địa danh thường có 2–3 cư dân, khu vui chơi 4–6. Người chơi bấm biểu cảm (👋 ❤️ 😄 🎉 👍) — gửi kèm nhịp hiện diện trong 4,5 giây, người khác thấy bong bóng trên đầu, 👋 thì nhân vật vẫy tay. Đứng gần người khác (< 9 m) hiện nút **Ảnh chung**: chụp cảnh hiện tại kèm tên những người đứng gần, lưu ảnh về máy.

**Chuỗi khu vui chơi** (tên trong game "Moon World", "Bim Wonder"; kiến trúc, tên trò, biểu tượng tự thiết kế — không dùng logo, khẩu hiệu, linh vật hay tên công trình của khu có thật). Mỗi khu là một điểm tham quan (`kind: 'khu_vui_choi'`) nên dùng lại toàn bộ đường đi taxi/tàu, hộ chiếu, đóng dấu; điểm dừng = cổng soát vé → từng trò → khu trò chơi kỹ năng → cổng ra.

| Khu | Tỉnh | Địa hình | Vé (tham chiếu giá thật) | Trò |
|---|---|---|---|---|
| Moon World Đà Nẵng | Đà Nẵng | đồi phía tây, cáp treo lên đỉnh | trọn gói 900.000đ (khu núi có cáp treo 650.000–1.300.000đ); cáp treo 450.000đ | cáp treo, vòng quay 60 m, tàu lượn, tháp rơi 50 m, lâu đài ma, xe đụng, máng trượt xoắn, hồ sóng |
| Bim Wonder Nha Trang | Khánh Hòa | đảo giữa vịnh, đi tàu cao tốc | trọn gói 1.050.000đ, sau 16 giờ 700.000đ (= giá khu đảo cùng loại) | đu quay ven biển, tàu lượn treo, tháp rơi hải đăng, con tàu ma, xe đụng, máng trượt 6 làn, hồ sóng, sông lười |
| Moon World Hạ Long | Quảng Ninh | đồi ven vịnh, cáp treo vượt vịnh | combo 3 khu 600.000đ, cáp treo 380.000đ, công viên nước 350.000đ | cáp treo, vòng quay, tàu lượn gỗ, hang ma, xe đụng, máng trượt ống, sông lười |

Nguồn giá: [bảng giá VinWonders Nha Trang](https://vinwonders.com/vi/wonderpedia/news/bang-gia-ve-vinwonders-nha-trang/), [bảng giá Sun World Hạ Long](https://sunparadiseland.com/SunParadiseLandQuangNinh/tin-tuc/bang-gia-sun-world-ha-long-moi-ban-nen-biet-truoc-chuyen-di-20539), [giá vé khu trên núi 2026](https://sunparadiseland.com/SunParadiseLandDaNang/tin-tuc/gia-ve-sun-world-ba-na-hills-dip-tet-bao-nhieu-cap-nhat-moi-2026-16237) (tra 24/11/2026; nguồn Hạ Long, Đà Nẵng là trang tổng hợp, chưa phải trang bán vé chính thức).

**Luật chơi.** Vé mua ở cổng, dùng 8 giờ thật, mỗi vé mở một số khu (khô / nước / cáp treo). Lên trò: cần vé có khu đó, tốn 2–8 thể lực, +10–40 EXP (lượt đầu trong 12 giờ đủ EXP, lượt sau một nửa; nguồn EXP `vui_choi` trần 240/ngày), xem hoạt cảnh 12–16 giây (`web/src/park/RideCutScene.ts`: đu quay, tàu lượn, tháp rơi, cáp treo góc nhìn thứ nhất; xe đụng góc thứ ba; trong ống máng trượt; hành lang nhà ma; phao trên hồ sóng/sông lười). Xong trò thì đóng dấu điểm dừng đó vào hộ chiếu.

**Không có casino, không cờ bạc.** Lý do pháp lý: Bộ luật Hình sự Điều 321 (tội đánh bạc), 322 (tổ chức đánh bạc); Nghị định 06/2017/NĐ-CP chỉ cho người nước ngoài chơi ở casino được cấp phép; Nghị định 147/2024/NĐ-CP về trò chơi điện tử trên mạng cấm mô phỏng trò chơi casino, dùng hình lá bài, có hành vi đánh bạc, và vật phẩm/đơn vị ảo không được quy đổi ngược ra tiền ([luatvietnam](https://luatvietnam.vn/linh-vuc-khac/kinh-doanh-tro-choi-dien-tu-tren-mang-883-100134-article.html), [nhandan](https://nhandan.vn/ocop/nghi-dinh-moi-cam-mua-ban-vat-pham-ao-trong-tro-choi-dien-tu-tren-mang-giua-nhung-nguoi-choi-post844806.html)). Thay bằng **khu trò chơi kỹ năng**: xu 10.000đ/xu (ước tính, chưa có giá niêm yết chính thức một lượt máy), ném vòng, ném bóng rổ, gắp thú — kết quả chỉ phụ thuộc lúc chạm (không có phần ngẫu nhiên), điểm → vé thưởng theo công thức cố định, vé thưởng đổi quà trang trí (bóng bay, băng đô tai thỏ, gấu bông, cúp…). Quà không bán, không tặng, không đổi ra tiền; máy chủ không có đường nào cộng tiền từ xu/vé/quà (kiểm thử `server/test/parks.test.ts`). Nộp điểm sớm hơn thời gian tối thiểu một ván thì không tính.

**Lưu ý pháp lý cần xem lại cho cả game:** theo các bài tóm tắt Nghị định 147/2024 ở trên, doanh nghiệp không được cho người chơi mua bán vật phẩm ảo với nhau. Chợ giữa người chơi và chuyển nhượng đất trong game hiện dùng tiền trong game (không nạp, không rút tiền thật) — cần luật sư xác nhận trước khi ra mắt có thu phí.

Kiểm: `npm test` (parks.test.ts), `node tools/park-test.mjs` (hai tài khoản cùng khu, cần máy chủ cổng 3000 và vite dev), trang thử `park-test.html?park=…&kind=tau_luon` hoặc `&arcade=1`.

## Đất độc bản và Trung tâm hành chính công (nhánh G4, 24/11)
- **Mỗi thửa là duy nhất.** Mã thửa `<mã tỉnh>.<tờ bản đồ>.<số thửa>` (vd `DN.0001.0007`) đánh theo thứ tự cấp lần đầu trong tỉnh, không đổi qua các đời chủ; thửa trả lại Nhà nước giữ nguyên mã và được giao lại cho người sau. Giấy chứng nhận có **số phát hành** dạng mẫu mới (Thông tư 10/2024/TT-BTNMT: 2 chữ cái + 8 chữ số, vd `LT 29675198`), không bao giờ trùng (khoá chính `land_certs.serial`), mỗi thửa chỉ một sổ còn hiệu lực (chỉ mục duy nhất có điều kiện). Sang tên thì sổ cũ bị thu hồi, cấp sổ mới số mới.
- **Sổ biến động chuỗi băm** (`land_ledger`): mỗi biến động (cấp lần đầu, chuyển nhượng, trả lại Nhà nước, cho thuê, gia hạn thuê, hết hạn thuê) ghi `prev_hash` + `hash = sha256(prev | thửa | loại | thời điểm | dữ liệu)`. Sửa hay xoá một dòng là chuỗi gãy đúng tại đó; ai cũng kiểm được (`GET /api/land/ledger/verify`, tra từng thửa ở Quầy 2).
- **Không dùng tiền mã hoá/NFT:** tài sản số ở Việt Nam mới thí điểm có kiểm soát; NFT gắn tài sản trong game dễ bị coi là phát hành tài sản số/huy động vốn trái phép, kéo nghĩa vụ pháp lý cho nhà phát hành. Chuỗi băm phía máy chủ cho cùng tính "không sửa lén được" mà không có rủi ro đó.
- **Chuyển nhượng theo Luật Đất đai 2024** (bỏ "mua ngay"): (1) bên mua trả giá thửa đang rao, bên bán đồng ý → hẹn công chứng (30 ngày game); (2) **cả hai cùng có mặt** ở Quầy 1 Văn phòng công chứng, mỗi bên ký; đủ hai chữ ký thì tiền đất vào tài khoản phong toả, bên mua nộp phí công chứng (TT 257/2016, bậc theo giá trị, không thấp hơn giá nhà nước) + thù lao soạn thảo 800.000đ (ước tính); (3) nộp hồ sơ đăng ký biến động ở Quầy 2; (4) cơ quan thuế ra thông báo sau 3 ngày làm việc (ước tính); bên bán nộp thuế TNCN 2%, bên mua nộp lệ phí trước bạ 0,5% + lệ phí cấp sổ ở Quầy 3; (5) Văn phòng đăng ký chỉnh lý trong 10 ngày làm việc (NĐ 101/2024 Điều 22), bên mua nhận sổ mới ở Quầy 2, tiền phong toả chuyển cho bên bán. "Có mặt" = nhịp hiện diện ở cảnh `admin` cùng tỉnh trong 30 giây gần nhất. Trước công chứng huỷ được; sau công chứng không tự huỷ.
- **Lịch hành chính**: một năm = một "năm bằng lái" (3 ngày thật), 1 ngày ≈ 11,8 phút thật, 1 quý ≈ 18 giờ thật; chia TIME_SCALE của máy chủ (riêng hẹn công chứng không tua).
- **Trung tâm phục vụ hành chính công**: mỗi tỉnh một trung tâm, cùng bố cục (thực tế từ 7/2025 mỗi tỉnh có Trung tâm phục vụ hành chính công cấp tỉnh; hồ sơ đất nộp ở nơi có đất). Cảnh 3D: sân trước có cột cờ, bồn hoa, bãi xe máy có mái, sảnh một cửa có máy lấy số, ghế chờ, bảng LED gọi số, 6 quầy có cán bộ, quầy hướng dẫn. Người chơi cùng tỉnh thấy nhau (presence `admin`, key = tên tỉnh). Lấy số → bảng gọi → tới quầy làm việc. Quầy: 1 Công chứng · 2 Đăng ký đất đai (nộp hồ sơ, nhận sổ, tra cứu, kiểm chuỗi) · 3 Thuế (thuế chuyển nhượng; kê khai thuế hộ kinh doanh theo quý) · 4 Quản lý đô thị (giấy phép xây dựng) · 5 Hợp tác xã (mở bảng HTX của E4) · 6 Bằng lái.
- **Thuế hộ kinh doanh** (bỏ thuế khoán từ 2026, kê khai theo quý): doanh thu = các khoản bán hàng trong sổ tiền (`SALE_REASONS`); ngưỡng 1 tỷ/năm tính cộng dồn trong năm (NĐ 141/2026 theo báo chí, chưa thấy văn bản gốc); thương lái (phân phối) 1% + 0,5%, chủ xưởng (sản xuất, chế biến) 3% + 1,5% trên phần vượt ngưỡng; nhà nông bán sản phẩm tự trồng không chịu thuế. Hạn nộp ≈ 30 ngày sau hết quý; chậm nộp 0,03%/ngày; còn nợ quá hạn thì không xin được giấy phép xây dựng. Chỉ tính từ 23/11/2026.
- **Giấy phép xây dựng**: cửa hàng/siêu thị/xưởng chi nhánh phải đứng tên đủ số thửa trống đúng loại đất ở tỉnh đó, nộp hồ sơ ở Quầy 4 (lệ phí 150.000đ, thẩm định 20 ngày), có phép mới khởi công (`/api/properties/buy` dùng một giấy phép). Khoản "giấy phép" cũ trong `BUILDINGS` nay hiểu là chi phí thiết kế, thẩm định.
- **Thuê đất nông nghiệp trả tiền hằng năm** (song song mua đứt): tiền thuê/năm = 1% giá đất bảng giá tỉnh (tỉ lệ UBND tỉnh quy định theo NĐ 103/2024 Điều 26, sửa NĐ 291/2025: Hà Tĩnh 1,0%, Tây Ninh 1%, Thái Bình 0,8%, Điện Biên 0,8–0,9%). Hạn mức thuê theo cấp `fieldLeaseMax` = 1 + ⌊(cấp − 5)/3⌋ (cấp 5: 1, cấp 10: 2, cấp 20: 6), vẫn trong tổng hạn mức giữ ruộng. Thửa thuê có mã thửa nhưng chỉ có **hợp đồng thuê** (`HĐT-<mã thửa>-<số>`), không có sổ, không rao bán được; trả lại sớm không hoàn tiền; hết hạn không gia hạn thì ruộng trống trả về quỹ, ruộng đang có cây để thu hoạch xong nhưng không gieo vụ mới. Mô phỏng `node tools/econ-sim.mjs` (thêm `--khong-thue` để so): lệch thu nhập 3 vai cấp 10 từ ×2,31 xuống ×1,22; cấp 20 ×1,41 → ×1,05; cấp 30 giữ ×1,37; **cấp 1 vẫn ×1,85** (chưa có cánh đồng ở cấp 1 — vườn 30 ô của nhà nông lời hơn hai vai kia, không thuộc phần đất).

## Giao thông công cộng (nhánh I5, 24/11)

Bốn phương tiện công cộng khi đi du lịch giữa các vùng, mỗi loại chỉ hiện khi ngoài đời thật sự đi được. Mã ở `shared/rules.ts` (`travelOptions`, `trainPlan`, `flightPlan`, `ferryPlan`), giá ở `shared/realPrices.ts`.

| Phương tiện | Khi nào có | Giá (tra 24/11/2026) | Thời gian |
|---|---|---|---|
| Xe khách | mọi cặp vùng trên đất liền | phần cố định tăng dần tới 100.000đ ở chặng 150 km + 800 đ/km cho 500 km đầu + 500 đ/km sau đó (Sài Gòn – Đà Lạt ~340.000đ; Hà Nội – Sài Gòn ~1,0 triệu). Trên 1.000 km ghi "giường nằm tuyến dài, có thể đổi xe" | 0,5 giờ + km/50 |
| Taxi | đường bộ ≤ 200 km | mở cửa 20.000đ km đầu, 15.500 đ/km km 2–25, 13.500 đ/km từ km 26 | km/50 |
| Tàu hoả | hai đầu đều cách một ga khách ≤ 80 km đường bộ, chặng ray ≥ 80 km | vé ghế mềm 30.000đ + 590 đ/km ray + chặng ra/vào ga | 0,5 giờ + km ray/52 + đường ra ga/40 |
| Máy bay | hai đầu gần sân bay có đường bay thẳng (một đầu là Nội Bài, Tân Sơn Nhất hoặc Đà Nẵng), bay ≥ 200 km, và **nhanh hơn xe khách** | vé 600.000đ + 1.100 đ/km bay + chặng ra/vào sân bay | 2 giờ thủ tục + km bay/650 + đường ra sân bay/40 |
| Tàu thuỷ (ra đảo) | vùng trên đảo có tuyến tàu thường lệ | xe tới cảng + vé tàu cao tốc 100.000đ + 2.200 đ/km biển (Rạch Giá – Phú Quốc ~350.000đ) | theo tuyến |

- **Đường bộ** = đường chim bay × 1,35 (`ROAD_FACTOR`). **Đường ray** theo lý trình thật (`RAIL_STATIONS`: 30 ga trên Thống Nhất, Hà Nội – Lào Cai, Hải Phòng, Đồng Đăng, Quán Triều; khác tuyến thì đi qua ga Hà Nội). Đà Lạt chỉ có tàu du lịch Đà Lạt – Trại Mát, không nối mạng quốc gia nên không có tàu. Đồng bằng sông Cửu Long, Tây Nguyên, Mộc Châu, Điện Biên không có ga.
- **Chặng ra/vào ga, sân bay:** ≤ 15 km đi taxi, xa hơn đi xe buýt/xe trung chuyển (20.000đ + 1.200 đ/km — ước tính).
- **Tuyến tàu ra đảo** (`ISLAND_FERRIES`): Rạch Giá → Phú Quốc 115 km, Trần Đề → Côn Đảo 85 km, Sa Kỳ → Lý Sơn 30 km, bến Bính (Hải Phòng) → Cát Bà 40 km. Từ đảo này sang đảo kia: về cảng đất liền rồi ra đảo kia.
- **Rà soát:** `node tools/transport-audit.ts` (thêm `--bang` in bảng đủ 2.756 cặp, `--tu <vùng>` chỉ một vùng). Luật cũ: 4.232 bất thường (2.352 cặp xe khách rẻ dưới 60% giá thật, 1.368 cặp có tàu ở nơi không có ga, 512 cặp taxi rẻ dưới 60%). Luật mới: 0. Hiện có: xe khách 2.352 cặp, máy bay 1.416, tàu hoả 728, tàu thuỷ 404, taxi 352. 28/53 vùng gần ga, 50/53 gần sân bay.
- **Hệ quả:** taxi theo giá thật đắt hơn trước ~4 lần (10 km: 40.000đ → 160.000đ), áp cả cho taxi đi tham quan địa danh (`sightRoute`). Thưởng tham quan `SIGHT_REWARD` 30.000đ chưa chỉnh theo.
## Xe máy, mô tô và đi phượt (nhánh J5, 24/11)
- **Danh mục** (`shared/vehicles.ts`, nhóm `xe_may`, mẫu chung không theo hãng): Xe số 110 (bình 3,7 lít, 1,7 lít/100 km, 18 triệu, A1), Xe tay ga 125 (40 triệu, A1), Xe côn tay 155 (50 triệu, A), Adventure 300 (bình 17 lít, 3,5 lít/100 km, 150 triệu, A), Mô tô Adventure 650 (250 triệu, A), Xe máy điện (pin 3,5 kWh, ~200 km, 22 triệu, A1). Bình/tiêu hao theo mẫu phổ biến cùng phân khúc (Wave Alpha/RSX công bố 1,7 lít; xe ga phượt 17 lít, 3,5 lít/100 km — báo Lâm Đồng 2025); **giá là ước tính theo phân khúc**.
- **Luật**: đến 125 cm³ hoặc 11 kW là hạng A1, lớn hơn là hạng A (A bao gồm A1) — Luật TTATGTĐB 2024 Điều 57. Xe máy **không vào cao tốc**, tối đa 70 km/h ngoài khu dân cư (Thông tư 38/2024): chuyến đi bằng xe máy không mất phí đường, chậm hơn 1,5 lần.
- **Sa hình xe máy** (A1, A): 4 bài liên hoàn theo Phụ lục XIII Thông tư 35/2024 — hình số 8, vạch đường thẳng (A1 dài 18 m, A 27 m theo dự thảo QCVN sân sát hạch), đường có vạch cản, đường gồ ghề (gờ cách 1,5 m). Thang 100, đạt 80; chạm vạch, chống chân −5; ra ngoài hình truất quyền (mức trừ là tham khảo tài liệu ôn thi, chưa đối chiếu văn bản gốc). Chỉ một chế độ: xe tự bám đường mẫu như sân ô tô; người thi giữ ga/phanh đúng khoảng tốc độ từng bài (quá nhanh ở cua thì văng ra chạm vạch, quá chậm thì loạng choạng chống chân), ◀ ▶ chỉnh nhẹ. B1 (ba gác) vẫn chỉ thi lý thuyết.
- **Đi phượt** (`shared/moto.ts`, Bãi xe → thẻ "🏍️ Đi phượt"): 3 cung đường — Hà Giang – Mã Pí Lèng 166 km (Hà Giang→Quản Bạ 46, →Yên Minh 50, →Đồng Văn 48, →Mèo Vạc 22 km theo cẩm nang VnExpress), đèo Hải Vân 36 km, cung biển Vĩnh Hy – Bình Tiên 80 km (hai tuyến sau ước tính theo bản đồ). Mỗi tuyến có điểm chụp ảnh (tem sổ phượt, EXP "điểm dừng" lần đầu), cây xăng (giá xăng thật `fuelPriceNow`), quán nghỉ (35.000đ, +6 thể lực). Thể lực −1 mỗi 10 km. Lần đầu đi trọn tuyến +100.000đ. Đi bằng xe của mình (lấy xăng trong bình, cộng công-tơ-mét) hoặc **thuê xe tại chỗ** (xe số 150.000đ/ngày, côn tay 250.000đ, adventure 900.000đ — ước tính theo tin rao) — thuê vẫn phải có bằng đúng hạng. Hết xăng giữa đèo: nhờ người chở xăng lên, tính 2,5 lần giá cây xăng.
- **Màn lái** (`web/src/drive/MotoScene.ts`): đường uốn lượn dựng theo độ "xoắn" của tuyến, địa hình lưới độ cao (núi đá tai mèo, đèo ven biển, đường biển, đồng bằng), xe ngược chiều và xe chậm (◀ vượt, ▶ về làn; lấn làn đụng xe ngược chiều là ngã), cua quá nhanh trượt/ngã, người lái nghiêng theo cua, máy quay sau lưng. Người chơi khác và cư dân ảo cùng tuyến qua presence (`highway`, khoá `phuot:<tuyến>`). 24–48 lần vẽ mỗi khung.
- **Chở hàng nhỏ**: xe máy chở 40–100 kg; chuyến buôn bằng xe máy (`DriveGame` → `MotoTrip`) chạy quốc lộ trong MotoScene, trạm dừng nghỉ thành quán ven đường, cây xăng rải theo tầm đi của bình nhỏ.
- **Thời tiết** (nhánh N6, `shared/moto.ts`): máy chủ chọn lúc xuất phát theo tháng (giờ Việt Nam) và khí hậu thật của từng tuyến — Hải Vân mùa mưa tháng 9–12 (đỉnh 10–11, khả năng ~60%), mây mù đỉnh đèo tháng 12–2; Hà Giang mưa tháng 5–9, sương mù dày mùa đông; ven biển Vĩnh Hy khô hạn (mưa ≤ 25% kể cả tháng 10–11). Con số là ước tính theo mô tả khí hậu vùng, chưa lấy từ chuỗi số liệu trạm. Một nửa số chuyến đổi trời một lần giữa đường; cả đoàn dùng chung hạt giống nên gặp cùng một cơn mưa. **Mưa**: độ bám 0,68 → tốc độ vào cua an toàn, lực phanh và ngưỡng trượt/ngã đều giảm theo; mặt đường tối và bóng, hạt mưa rơi, sương mù, giọt nước trên kính mũ; cảnh báo "⚠️ Đường trơn" ở cua gắt. **Sương mù**: tầm nhìn ~150 m, độ bám 0,9. **Áo mưa** 60.000đ mua ở quán đã ghé; dầm mưa không áo mất thêm 1 thể lực/10 km (máy chủ tính theo số km mưa trước chỗ mua áo).
- **Đi đoàn** (`shared/convoy.ts`, `server/src/convoy.ts`): trưởng đoàn lập đoàn trên một cung đường → mã 6 ký tự (bỏ 0/O/1/I/L); mời bạn bè (đã kết bạn) hoặc gửi mã cho người cùng tuyến; tối đa 8 xe, cần ít nhất 2. Ai cũng chọn xe rồi "Sẵn sàng"; trưởng đoàn bấm "Cả đoàn xuất phát" → mọi máy tự lên đường với xe đã chọn (ai chưa sẵn sàng bị rời đoàn). Khi chạy: mỗi máy báo km + điểm đang đứng mỗi 3 giây (2 giây khi đứng ở điểm dừng) qua `POST /api/convoys/:id/pos`; người cùng đoàn có cờ đuôi màu và tên 🏁; HUD hiện chấm màu cả đoàn, trưởng đoàn trước/sau bao nhiêu km, cuối đoàn cách bao xa. Điểm chụp ảnh và quán là **điểm tập trung**: bảng dừng hiện "x/y xe đã tới · đang chờ …", có thể "Đi tiếp, không chờ". Khi mọi người đã xong, nhóm lớn nhất về đích cách nhau ≤ 15 phút (≥ 2 xe) được **+50% EXP chuyến** của mỗi người. Đoàn đang lập quá 60 phút tự giải tán.
- **Hộ chiếu → trang "Cung đường phượt"**: mỗi tuyến một mục, dấu tròn "SỔ PHƯỢT" cho từng điểm chụp ảnh, dấu răng cưa "CHINH PHỤC CUNG ĐƯỜNG" khi đi trọn tuyến (cùng kiểu mực, xoay ngẫu nhiên như dấu địa danh).
- **Kiểm thử trong trình duyệt**: `web/phuot-test.html?auto=1&step=14&nhanh=1&troi=doi` (tự lái, 14 bước vật lý mỗi khung, máy chủ chỉ nhận "chạy nhanh" và ép thời tiết với tài khoản thử) và `node tools/phuot-test.mjs --base <vite>` (một mình + đoàn 2 tài khoản + hộ chiếu; `--chi-ho-chieu` chỉ kiểm trang hộ chiếu).

## Kết bạn, trò chuyện, loa phát thanh (nhánh M6, 24/11)
- **Thẻ người chơi:** bấm vào tên trong "Quanh đây" (bảng 💬), trong nhật ký chat chung, hoặc chạm vào người chơi trong cảnh tham quan/khu vui chơi → thẻ: tên hiển thị, vai, cấp, vùng trồng (huyện, tỉnh — không lộ xã/phường hay toạ độ, không lộ tên tài khoản). Nút: Kết bạn / Đã gửi lời mời (Huỷ) / Chấp nhận – Từ chối / Nhắn tin (đã là bạn) / Huỷ kết bạn / Chặn – Bỏ chặn / Báo cáo. Cư dân ảo không kết bạn được. Tối đa 9 bạn như luật xóm.
- **Chat chung:** nút "💬 Nói" khi đang ở cảnh có người khác (làng, cao tốc, trạm dừng, tham quan, khu vui chơi, khu hành chính). Tối đa 80 ký tự; mỗi tin cách nhau ≥ 3 giây, tối đa 10 tin/phút. Tin hiện **bong bóng trên đầu** người gửi 8 giây cho mọi người cùng cảnh, 3 dòng gần nhất ở góc trái, nhật ký 10 phút gần nhất trong bảng 💬. Về theo nhịp hiện diện sẵn có (không tốn thêm yêu cầu).
- **Chat riêng:** chỉ giữa bạn bè; tối đa 2.000 ký tự/tin (trần an toàn), ≥ 0,8 giây/tin, 30 tin/phút. Hộp thư liệt kê bạn bè theo tin mới nhất, chấm đỏ số tin chưa đọc + lời mời kết bạn trên nút 💬. Không có WebSocket (Vercel): hỏi `/api/chat/poll` 9 giây/lần (4 giây khi đang mở bảng), dừng khi ẩn tab.
- **Loa phát thanh:** chạy chữ trên đầu màn hình mọi người đang chơi, mỗi lượt 15 giây, xếp hàng nối đuôi (khoá tư vấn Postgres để hai người mua cùng lúc không chồng giờ). Người chơi: từ cấp 10, 5.000.000đ/lượt, 1 lượt/người/giờ, nội dung không được có từ tục, số điện thoại, đường dẫn (bị từ chối chứ không che). Quản trị: `POST /api/admin/broadcast` (ADMIN_TOKEN), miễn phí, nền xanh. Lịch sử loa trong thẻ "Loa".
- **Bộ lọc** (`shared/chat.ts`, chạy ở máy chủ): che bằng `***` từ tục tiếng Việt có dấu ("lồn", "địt"…) và viết tắt không dấu/teencode ("dm", "đcm", "vcl", viết lặp "dmmm", viết liền "ditme"), cụm xúc phạm ("đồ chó đẻ", "mẹ mày"), tiếng Anh; số điện thoại (9–11 số, có dấu cách/chấm, +84), đường dẫn, tên miền, email, tài khoản Zalo/Facebook/Telegram… Chữ thường có dấu trùng mặt chữ ("buổi", "đủ", "lon bia", "125cc") không bị che. Tin chỉ toàn từ bị che thì không gửi.
- **An toàn cho người chơi nhỏ tuổi:** không nhắn riêng với người lạ (phải kết bạn hai chiều); chặn = huỷ bạn, không nhận lời mời/tin riêng, không thấy chat chung và bong bóng của nhau; báo cáo (5 lý do) lưu kèm 20 tin gần nhất **nguyên văn** của người bị báo cáo (chat chung 1 ngày + tin gửi cho người báo cáo) để ban quản trị xem ở `GET /api/admin/chat-reports`; nguyên văn chỉ máy chủ giữ, người chơi chỉ thấy bản đã lọc. Nhật ký chat chung giữ 30 ngày, tin riêng 180 ngày rồi tự xoá. Dòng nhắc an toàn ở cuối bảng trò chuyện.
- Còn thiếu: chạm vào người chơi trong làng/cao tốc/trạm dừng mới qua danh sách "Quanh đây" (chạm trực tiếp chỉ có ở cảnh tham quan); chưa có tắt tiếng (mute) tạm thời và trang kiểm duyệt có giao diện; chưa gửi được ảnh/biểu tượng cảm xúc riêng.
