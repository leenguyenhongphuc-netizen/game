// Điểm tham quan vùng Nam Bộ (tỉnh, thành sau sắp xếp 2025). Bộ cảnh 3D ở web/src/sight/sets/regions/nam_bo.ts.
// Toạ độ là toạ độ thật của địa danh. Vé vào cổng lấy theo giá niêm yết/tin báo 2025; chỗ nào nguồn không thống nhất
// hoặc chưa tìm được bảng giá chính thức thì ghi "ước tính" ngay cạnh, cần rà lại trước khi phát hành.
// Nguồn chính: vnexpress.net, mia.vn, thuvienphapluat.vn (TT 182/2016 phí Dinh Độc Lập), greensm.com (địa đạo Củ Chi),
// sunparadiseland.com (cáp treo núi Bà Đen, Trà Sư), baomoi.com (giá xuồng chèo Thới Sơn), vi.wikipedia.org.
import type { Sight } from '../sights.ts';

export const SIGHTS_NAM_BO: Sight[] = [
  // ------------------------------------------------------------------ TP. Hồ Chí Minh
  {
    id: 'hcm_trung_tam', name: 'Trung tâm Sài Gòn', province: 'TP. Hồ Chí Minh', lat: 10.7798, lng: 106.6990, kind: 'pho_co', emoji: '⛪',
    blurb: 'Dạo bộ từ Nhà thờ Đức Bà, Bưu điện Trung tâm qua đường sách tới Dinh Độc Lập và chợ Bến Thành.', entryFee: 65_000, // vé Dinh Độc Lập gồm khu trưng bày (mia.vn 2025)
    stops: [
      { id: 'nha_tho', name: 'Nhà thờ Đức Bà', fact: 'Nhà thờ chính toà Sài Gòn xây năm 1877–1880 theo kiểu Roman pha Gothic, gạch đỏ chở từ Pháp sang không trát vữa mà vẫn giữ màu đến nay. Hai tháp chuông cao gần 58 m được thêm năm 1895.' },
      { id: 'buu_dien', name: 'Bưu điện Trung tâm', fact: 'Xây năm 1886–1891, mái vòm sắt và hai tấm bản đồ lớn vẽ tay trong sảnh. Đến nay bưu điện vẫn nhận gửi thư, bán tem như ngày đầu.' },
      { id: 'duong_sach', name: 'Đường sách Nguyễn Văn Bình', fact: 'Con đường nhỏ cạnh bưu điện thành phố chuyển thành phố sách năm 2016: hàng chục gian sách, quán cà phê và ghế đá dưới tán cây.' },
      { id: 'dinh_doc_lap', name: 'Dinh Độc Lập', fact: 'Do kiến trúc sư Ngô Viết Thụ thiết kế, xây 1962–1966 trên nền Dinh Norodom cũ. Trưa 30/4/1975 xe tăng húc đổ cổng dinh, khép lại chiến tranh. Năm 2009 được xếp hạng di tích quốc gia đặc biệt.' },
      { id: 'cho_ben_thanh', name: 'Chợ Bến Thành', fact: 'Toà chợ xây 1912–1914 với tháp đồng hồ ở cửa nam, là biểu tượng của Sài Gòn. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'hcm_cu_chi', name: 'Địa đạo Củ Chi', province: 'TP. Hồ Chí Minh', lat: 11.1420, lng: 106.4620, kind: 'den_thap', emoji: '🕳️',
    blurb: 'Hệ thống đường hầm ba tầng đào bằng tay dưới rừng cao su, di tích quốc gia đặc biệt.', entryFee: 35_000, // khách Việt (greensm.com 2025)
    stops: [
      { id: 'cong', name: 'Cổng khu di tích', fact: 'Địa đạo bắt đầu đào từ năm 1948, nối dài khoảng 250 km dưới lòng đất Củ Chi. Năm 2004 khu di tích được xếp hạng di tích quốc gia đặc biệt.' },
      { id: 'nap_ham', name: 'Nắp hầm bí mật', fact: 'Miệng hầm chỉ vừa một người, nắp gỗ phủ lá khô nên đứng ngay bên cạnh cũng khó nhận ra. Đất sét đỏ ở đây cứng như đá ong nên hầm không sụp.' },
      { id: 'ham_bep', name: 'Bếp Hoàng Cầm', fact: 'Bếp đào nhiều ngăn dẫn khói đi xa rồi tan sát mặt đất, nấu cơm ban ngày mà máy bay không phát hiện được khói.' },
      { id: 'duong_ham', name: 'Đoạn hầm cho khách bò qua', fact: 'Hầm có ba tầng sâu 3, 6 và 8–10 m. Đoạn mở cho khách đã được nới rộng, vẫn phải khom lưng mới đi lọt.' },
      { id: 'nha_truyen_thong', name: 'Nhà trưng bày', fact: 'Trưng bày sa bàn hệ thống địa đạo, dụng cụ đào đất bằng tay và đời sống dưới lòng đất. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'hcm_vung_tau', name: 'Tượng Chúa Kitô Vua Vũng Tàu', province: 'TP. Hồ Chí Minh', formerProvince: 'Bà Rịa – Vũng Tàu', lat: 10.3270, lng: 107.0850, kind: 'nui', emoji: '🗽',
    blurb: 'Tượng Chúa dang tay cao 32 m trên đỉnh Núi Nhỏ, nhìn ra Bãi Sau và mũi Nghinh Phong.', entryFee: 0,
    stops: [
      { id: 'chan_nui', name: 'Chân núi Nhỏ', fact: 'Đường lên tượng hơn 800 bậc đá uốn lượn dưới tán cây trên sườn Núi Nhỏ (Wikipedia ghi 811 bậc).' },
      { id: 'tuong_thanh', name: 'Mười hai tông đồ', fact: 'Dọc đường lên có các tượng nhỏ và phù điêu kể chuyện Kinh Thánh, chỗ nghỉ chân nhìn xuống thành phố biển.' },
      { id: 'chan_tuong', name: 'Chân tượng', fact: 'Tượng cao 32 m, hai tay dang rộng khoảng 18 m, xây từ năm 1974 đến 1993. Bên trong có cầu thang xoắn 133 bậc lên tới vai tượng.' },
      { id: 'vai_tuong', name: 'Ban công vai tượng', fact: 'Từ cánh tay tượng nhìn thấy Bãi Sau, Bãi Trước và mũi Nghinh Phong vươn ra biển Đông.' },
      { id: 'xuong_nui', name: 'Lối xuống Bãi Sau', fact: 'Bãi Sau dài hơn 8 km, sóng lớn, là bãi tắm đông nhất Vũng Tàu. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // ------------------------------------------------------------------ Đồng Nai
  {
    id: 'dni_cat_tien', name: 'Vườn quốc gia Cát Tiên', province: 'Đồng Nai', lat: 11.4260, lng: 107.4270, kind: 'nui', emoji: '🌳',
    blurb: 'Rừng nhiệt đới nguyên sinh bên sông Đồng Nai, khu dự trữ sinh quyển thế giới.', entryFee: 50_000, // ước tính (nguồn ghi 25.000–50.000đ, chưa có biểu phí chính thức)
    stops: [
      { id: 'ben_pha', name: 'Bến phà sông Đồng Nai', fact: 'Khách qua sông Đồng Nai bằng phà để vào trung tâm vườn. Cát Tiên được UNESCO công nhận khu dự trữ sinh quyển thế giới năm 2001.' },
      { id: 'cay_tung', name: 'Cây tung cổ thụ', fact: 'Cây tung hơn 400 năm tuổi với rễ bạnh cao quá đầu người, phải vài người ôm mới hết gốc.' },
      { id: 'cuu_ho_gau', name: 'Trạm cứu hộ gấu', fact: 'Nơi chăm sóc gấu ngựa, gấu chó bị nuôi lấy mật được giải cứu, chuẩn bị cho chúng về rừng. Vé trạm cứu hộ khoảng 40.000đ.' },
      { id: 'bau_sau', name: 'Bàu Sấu', fact: 'Đầm lầy giữa rừng là nơi sống của cá sấu nước ngọt, được công nhận khu Ramsar năm 2005.' },
      { id: 'nha_trung_bay', name: 'Trung tâm du khách', fact: 'Trưng bày mẫu vật các loài thú, chim của vườn. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'dni_buu_long', name: 'Khu du lịch Bửu Long', province: 'Đồng Nai', lat: 10.9560, lng: 106.8070, kind: 'chua', emoji: '🏞️',
    blurb: '"Hạ Long thu nhỏ" của Đồng Nai: hồ Long Ẩn giữa núi đá, chùa Bửu Phong trên đồi.', entryFee: 40_000, // ước tính
    stops: [
      { id: 'cong', name: 'Cổng khu du lịch', fact: 'Bửu Long là khu thắng cảnh ở Biên Hoà, có núi đá và hồ nên được gọi là "Hạ Long thu nhỏ" của miền Đông.' },
      { id: 'ho_long_an', name: 'Hồ Long Ẩn', fact: 'Hồ hình thành từ moong khai thác đá cũ, nước xanh in bóng vách đá dựng đứng, có thuyền đạp vịt quanh hồ.' },
      { id: 'cau_treo', name: 'Cầu qua hồ', fact: 'Cây cầu nối bờ hồ với đảo nhỏ giữa hồ, chỗ chụp ảnh vách đá đẹp nhất.' },
      { id: 'chua_buu_phong', name: 'Chùa Bửu Phong', fact: 'Ngôi chùa cổ trên núi Bửu Long, dựng từ thế kỷ 17, có tượng Phật nằm và những tảng đá lớn quanh sân chùa.' },
      { id: 'loi_ra', name: 'Lối ra', fact: 'Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // ------------------------------------------------------------------ Tây Ninh
  {
    id: 'tni_ba_den', name: 'Núi Bà Đen', province: 'Tây Ninh', lat: 11.3830, lng: 106.1680, kind: 'nui', emoji: '🚡',
    blurb: '"Nóc nhà Nam Bộ" cao 986 m: cáp treo lên đỉnh, tượng Phật Bà bằng đồng trên mây.', entryFee: 400_000, // cáp treo tuyến Vân Sơn khứ hồi (sunparadiseland.com, MoMo 2025)
    stops: [
      { id: 'ga_cap', name: 'Ga cáp treo chân núi', fact: 'Núi Bà Đen cao 986 m, cao nhất Nam Bộ. Hệ thống cáp treo đưa khách lên đỉnh trong khoảng 8 phút thay cho cả buổi leo bộ.' },
      { id: 'chua_ba', name: 'Chùa Bà (Linh Sơn Tiên Thạch Tự)', fact: 'Ngôi chùa nằm lưng chừng núi thờ Linh Sơn Thánh Mẫu, gắn với truyền thuyết nàng Lý Thị Thiên Hương. Hội xuân núi Bà kéo dài từ Tết tới hết tháng Giêng.' },
      { id: 'dinh_nui', name: 'Đỉnh núi', fact: 'Trên đỉnh thường có mây bay ngang tầm mắt, nhìn xuống hồ Dầu Tiếng và cánh đồng Tây Ninh.' },
      { id: 'tuong_phat', name: 'Tượng Phật Bà Tây Bổ Đà Sơn', fact: 'Tượng Phật Bà bằng đồng cao 72 m, khánh thành năm 2020, được xác lập kỷ lục tượng Phật bằng đồng trên núi cao nhất châu Á.' },
      { id: 'loi_ra', name: 'Lối ra', fact: 'Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'tni_toa_thanh', name: 'Tòa Thánh Tây Ninh', province: 'Tây Ninh', lat: 11.3000, lng: 106.1340, kind: 'chua', emoji: '🛕',
    blurb: 'Thánh thất trung ương của đạo Cao Đài, kiến trúc độc đáo pha Đông – Tây.', entryFee: 0,
    stops: [
      { id: 'cong', name: 'Cửa chính', fact: 'Tòa Thánh xây từ năm 1933 đến 1955, là trung tâm của đạo Cao Đài, tôn giáo ra đời ở Tây Ninh năm 1926.' },
      { id: 'san', name: 'Sân trước Tòa Thánh', fact: 'Mặt tiền có hai tháp chuông và trống, giữa là biểu tượng Thiên Nhãn (con mắt trái) của đạo Cao Đài.' },
      { id: 'dien', name: 'Chánh điện', fact: 'Bên trong có hai hàng cột rồng quấn và quả càn khôn lớn vẽ Thiên Nhãn. Khách được xem lễ cúng lúc 12 giờ trưa từ hành lang.' },
      { id: 'loi_ra', name: 'Lối ra', fact: 'Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // ------------------------------------------------------------------ Đồng Tháp
  {
    id: 'dt_tram_chim', name: 'Vườn quốc gia Tràm Chim', province: 'Đồng Tháp', lat: 10.7140, lng: 105.5300, kind: 'nui', emoji: '🦩',
    blurb: 'Đồng Tháp Mười thu nhỏ: rừng tràm, đồng cỏ năng và nơi trú của sếu đầu đỏ.', entryFee: 30_000, // ước tính (chưa có bảng giá 2025)
    stops: [
      { id: 'ben_xuong', name: 'Bến xuồng', fact: 'Tràm Chim rộng hơn 7.000 ha, là khu Ramsar thứ 4 của Việt Nam (2012). Khách đi xuồng máy vào sâu trong vườn.' },
      { id: 'rung_tram', name: 'Rừng tràm', fact: 'Rừng tràm và đồng cỏ năng ngập nước theo mùa lũ, giữ lại nét hoang sơ của Đồng Tháp Mười xưa.' },
      { id: 'thap_quan_sat', name: 'Tháp quan sát chim', fact: 'Vườn có hơn 230 loài chim. Mùa khô (tháng 1–4) có thể gặp sếu đầu đỏ, loài chim cao gần bằng người.' },
      { id: 'dong_sen', name: 'Đầm sen', fact: 'Sen, súng nở kín mặt nước. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'dt_thoi_son', name: 'Cù lao Thới Sơn', province: 'Đồng Tháp', formerProvince: 'Tiền Giang', lat: 10.3380, lng: 106.3550, kind: 'lang_nghe', emoji: '🥥',
    blurb: 'Cù lao giữa sông Tiền: chèo xuồng rạch dừa nước, nghe đờn ca tài tử, ăn trái cây vườn.', entryFee: 30_000, // một chuyến xuồng ba lá 2 người (baomoi.com)
    stops: [
      { id: 'ben_ghe', name: 'Bến ghe Mỹ Tho', fact: 'Thới Sơn là cù lao lớn trên sông Tiền, đối diện thành phố Mỹ Tho. Khách sang cù lao bằng ghe máy.' },
      { id: 'vuon_trai_cay', name: 'Vườn trái cây', fact: 'Vườn nhãn, chôm chôm, bưởi, mãng cầu xen mương nước. Khách được mời trà mật ong ong nuôi ngay trong vườn.' },
      { id: 'don_ca', name: 'Đờn ca tài tử', fact: 'Nghệ thuật đờn ca tài tử Nam Bộ được UNESCO ghi danh di sản văn hoá phi vật thể năm 2013. Người đàn hát ở cù lao là nông dân trong vùng.' },
      { id: 'rach_dua', name: 'Rạch dừa nước', fact: 'Xuồng ba lá chèo tay len qua con rạch nhỏ hai bên rợp dừa nước. Người chèo đội nón lá, mặc áo bà ba.' },
      { id: 'loi_ra', name: 'Lối ra', fact: 'Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // ------------------------------------------------------------------ Vĩnh Long
  {
    id: 'vl_ao_ba_om', name: 'Ao Bà Om', province: 'Vĩnh Long', formerProvince: 'Trà Vinh', lat: 9.9170, lng: 106.3160, kind: 'chua', emoji: '🛕',
    blurb: 'Ao vuông cổ của người Khmer, quanh bờ là cây dầu rễ lồi và chùa Âng nghìn năm.', entryFee: 0,
    stops: [
      { id: 'bo_ao', name: 'Bờ ao', fact: 'Ao gần như vuông, mỗi cạnh vài trăm mét. Truyền thuyết kể nam và nữ thi nhau đào ao, phụ nữ thắng nhờ mẹo đốt đèn giả sao Mai.' },
      { id: 'cay_dau', name: 'Rừng dầu rễ lồi', fact: 'Hàng cây dầu cổ thụ có rễ trồi lên mặt đất thành hình thù kỳ lạ, có cây hàng trăm năm tuổi.' },
      { id: 'chua_ang', name: 'Chùa Âng', fact: 'Chùa Âng (Angkorajaborey) là một trong những chùa Khmer cổ nhất Nam Bộ, mái nhiều tầng nhọn, đầu rắn Naga ở chóp mái.' },
      { id: 'bao_tang', name: 'Bảo tàng văn hoá Khmer', fact: 'Trưng bày nhạc cụ ngũ âm, ghe ngo, trang phục Khmer. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'vl_con_phung', name: 'Cồn Phụng', province: 'Vĩnh Long', formerProvince: 'Bến Tre', lat: 10.3260, lng: 106.3640, kind: 'lang_nghe', emoji: '🥥',
    blurb: 'Cồn trên sông Tiền: di tích Đạo Dừa, lò kẹo dừa, đi xe ngựa trong vườn dừa.', entryFee: 30_000, // ước tính
    stops: [
      { id: 'ben', name: 'Bến cồn', fact: 'Cồn Phụng nằm giữa sông Tiền, thuộc xứ dừa Bến Tre cũ.' },
      { id: 'dao_dua', name: 'Di tích Đạo Dừa', fact: 'Ông Đạo Dừa Nguyễn Thành Nam lập đạo trên cồn từ năm 1963, nổi tiếng với sân lễ có cột rồng và bản đồ Việt Nam đắp nổi.' },
      { id: 'lo_keo', name: 'Lò kẹo dừa', fact: 'Nước cốt dừa nấu với mạch nha, đường cho sệt rồi cán, cắt, gói bằng tay. Kẹo dừa là đặc sản nổi tiếng nhất Bến Tre.' },
      { id: 'xe_ngua', name: 'Đường xe ngựa', fact: 'Xe ngựa chở khách qua đường làng rợp bóng dừa. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // ------------------------------------------------------------------ Cần Thơ
  {
    id: 'ct_cai_rang', name: 'Chợ nổi Cái Răng', province: 'Cần Thơ', lat: 10.0060, lng: 105.7500, kind: 'lang_nghe', emoji: '🛶',
    blurb: 'Chợ trên sông họp từ sáng sớm: ghe xuồng treo hàng trên cây bẹo, bán trái cây, hủ tiếu.', entryFee: 50_000, // ước tính tiền đò đi chợ
    stops: [
      { id: 'ben_ninh_kieu', name: 'Bến Ninh Kiều', fact: 'Đò từ bến Ninh Kiều đi khoảng 6 km theo sông Cần Thơ là tới chợ nổi.' },
      { id: 'cay_beo', name: 'Cây bẹo', fact: 'Mỗi ghe dựng một cây sào cao treo thứ hàng mình bán, gọi là cây bẹo, nhìn từ xa là biết ghe bán gì.' },
      { id: 'ghe_hang', name: 'Ghe trái cây', fact: 'Ghe chở dưa hấu, khóm, bưởi từ các vùng về bán sỉ cho thương lái. Chợ nổi Cái Răng là di sản văn hoá phi vật thể quốc gia từ năm 2016.' },
      { id: 'hu_tieu', name: 'Xuồng hủ tiếu', fact: 'Xuồng nhỏ nấu hủ tiếu, cà phê bán ngay trên sông, cập sát mạn đò để đưa tô.' },
      { id: 'loi_ra', name: 'Lối ra', fact: 'Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'ct_chua_doi', name: 'Chùa Dơi', province: 'Cần Thơ', formerProvince: 'Sóc Trăng', lat: 9.5940, lng: 105.9890, kind: 'chua', emoji: '🦇',
    blurb: 'Chùa Khmer Mahatup hơn 400 năm, hàng nghìn con dơi treo mình trên cây sao cổ thụ.', entryFee: 0,
    stops: [
      { id: 'cong', name: 'Cổng chùa', fact: 'Chùa Mahatup của người Khmer, dân gian gọi là chùa Dơi vì đàn dơi quạ hàng nghìn con sống trong vườn chùa.' },
      { id: 'vuon_doi', name: 'Vườn dơi', fact: 'Ban ngày dơi treo mình ngủ trên cây sao, cây dầu; chập tối bay đi kiếm ăn ở vườn cây ăn trái xa chùa rồi về trước sáng.' },
      { id: 'chanh_dien', name: 'Chánh điện', fact: 'Chánh điện mái ba tầng nhọn, chóp mái hình rắn Naga, vách vẽ tích Phật. Sư chùa sống theo Phật giáo Nam tông.' },
      { id: 'loi_ra', name: 'Lối ra', fact: 'Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // ------------------------------------------------------------------ An Giang
  {
    id: 'ag_ba_chua_xu', name: 'Miếu Bà Chúa Xứ núi Sam', province: 'An Giang', lat: 10.6800, lng: 105.0790, kind: 'chua', emoji: '🛕',
    blurb: 'Miếu thờ Bà Chúa Xứ dưới chân núi Sam, Châu Đốc, nơi hành hương lớn nhất miền Tây.', entryFee: 0,
    stops: [
      { id: 'quang_truong', name: 'Quảng trường trước miếu', fact: 'Miếu nằm dưới chân núi Sam, cách trung tâm Châu Đốc vài km. Lễ hội vía Bà diễn ra từ 23 đến 27 tháng 4 âm lịch.' },
      { id: 'mieu', name: 'Miếu Bà', fact: 'Miếu mái ba tầng lợp ngói xanh, dạng chữ "quốc". Lễ hội vía Bà Chúa Xứ núi Sam là di sản văn hoá phi vật thể quốc gia (2014).' },
      { id: 'lang_thoai_ngoc_hau', name: 'Lăng Thoại Ngọc Hầu', fact: 'Lăng của quan trấn thủ Thoại Ngọc Hầu, người chỉ huy đào kênh Vĩnh Tế đầu thế kỷ 19, nằm đối diện miếu.' },
      { id: 'chan_nui', name: 'Chân núi Sam', fact: 'Núi Sam cao khoảng 230 m, có đường lên đỉnh nhìn sang biên giới Campuchia. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'ag_tra_su', name: 'Rừng tràm Trà Sư', province: 'An Giang', lat: 10.5840, lng: 105.0590, kind: 'nui', emoji: '🌿',
    blurb: 'Rừng tràm ngập nước phủ thảm bèo xanh, đi xuồng chèo qua đàn cò trắng.', entryFee: 120_000, // vé tham quan (mia.vn); nguồn khác ghi 50.000đ vé xuồng — chưa thống nhất
    stops: [
      { id: 'ben_xuong', name: 'Bến xuồng máy', fact: 'Trà Sư rộng khoảng 845 ha ở vùng Bảy Núi. Khách đi xuồng máy vào giữa rừng rồi đổi sang xuồng chèo tay.' },
      { id: 'tham_beo', name: 'Thảm bèo tấm', fact: 'Mặt nước phủ kín bèo tấm xanh mướt, xuồng đi qua để lại một vệt nước rồi bèo khép lại.' },
      { id: 'cau_tre', name: 'Cầu tre dài', fact: 'Cây cầu tre xuyên rừng dài hàng trăm mét, có chòi quan sát cò, vạc, điêng điểng làm tổ.' },
      { id: 'thap_quan_sat', name: 'Tháp quan sát', fact: 'Từ tháp nhìn thấy cả rừng tràm và dãy Thất Sơn phía xa. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'ag_dinh_cau', name: 'Dinh Cậu Phú Quốc', province: 'An Giang', formerProvince: 'Kiên Giang', lat: 10.2170, lng: 103.9580, kind: 'dao', emoji: '🏝️',
    blurb: 'Miếu nhỏ trên ghềnh đá ở cửa sông Dương Đông, nơi ngư dân Phú Quốc cầu bình an.', entryFee: 0, island: true,
    port: { name: 'Cảng Rạch Giá', lat: 10.0130, lng: 105.0790, islandPort: 'Cảng Bãi Vòng', boat: 'tàu cao tốc', note: 'Tàu cao tốc chạy khoảng 2 giờ 30 phút qua vịnh Thái Lan.' },
    stops: [
      { id: 'cho_dem', name: 'Chợ đêm Dương Đông', fact: 'Chợ ven cửa sông bán hải sản tươi, nước mắm, ngọc trai và hồ tiêu Phú Quốc.' },
      { id: 'ghenh_da', name: 'Ghềnh đá', fact: 'Dinh Cậu nằm trên khối đá nhô ra biển ở cửa sông Dương Đông, ngư dân tin Cậu phù hộ cho ghe ra khơi bình an.' },
      { id: 'dinh', name: 'Dinh Cậu', fact: 'Miếu nhỏ mái ngói đỏ, có ngọn hải đăng bên cạnh. Lễ vía Cậu tổ chức vào tháng 10 âm lịch.' },
      { id: 'hoang_hon', name: 'Bãi ngắm hoàng hôn', fact: 'Bờ tây Phú Quốc là nơi ngắm hoàng hôn trên biển đẹp nhất Việt Nam. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // ------------------------------------------------------------------ Cà Mau
  {
    id: 'cm_mui_ca_mau', name: 'Mũi Cà Mau', province: 'Cà Mau', lat: 8.6080, lng: 104.7230, kind: 'bien', emoji: '🧭',
    blurb: 'Điểm cực nam đất liền Việt Nam: cột mốc toạ độ, biểu tượng con tàu và rừng đước bạt ngàn.', entryFee: 30_000, // người lớn (vnexpress.net)
    stops: [
      { id: 'rung_duoc', name: 'Lối đi rừng đước', fact: 'Rừng ngập mặn Mũi Cà Mau mỗi năm lấn ra biển hàng chục mét nhờ phù sa và rễ đước, mắm giữ đất. Vườn quốc gia Mũi Cà Mau là khu Ramsar từ năm 2013.' },
      { id: 'cot_moc', name: 'Cột mốc toạ độ', fact: 'Cột mốc GPS 0001 đánh dấu điểm cực nam trên đất liền của Tổ quốc.' },
      { id: 'con_tau', name: 'Biểu tượng con tàu', fact: 'Biểu tượng hình mũi tàu hướng ra biển, nơi khách chụp ảnh lưu niệm ở "đất mũi".' },
      { id: 'thap_ngam', name: 'Tháp ngắm cảnh', fact: 'Từ tháp nhìn thấy biển Đông và vịnh Thái Lan gặp nhau, phía xa là hòn Khoai. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'cm_dien_gio', name: 'Cánh đồng điện gió Bạc Liêu', province: 'Cà Mau', formerProvince: 'Bạc Liêu', lat: 9.2300, lng: 105.7700, kind: 'bien', emoji: '🌬️',
    blurb: 'Hàng tua-bin gió trắng đứng giữa bãi bồi ven biển, nhà máy điện gió gần bờ đầu tiên của Việt Nam.', entryFee: 20_000, // ước tính
    stops: [
      { id: 'cong', name: 'Cổng nhà máy', fact: 'Nhà máy điện gió Bạc Liêu có 62 tua-bin, công suất khoảng 99 MW, xây trên bãi bồi ven biển từ năm 2010 đến 2016.' },
      { id: 'cau_di_bo', name: 'Cầu bê tông ra biển', fact: 'Cây cầu bê tông dài chạy giữa hàng tua-bin, khi nước ròng thấy bãi bùn và cây mắm mọc lan ra biển.' },
      { id: 'chan_tua_bin', name: 'Chân tua-bin', fact: 'Mỗi tua-bin cao khoảng 80 m, cánh quạt dài hơn 40 m. Đứng dưới chân nghe tiếng cánh quạt rít trong gió.' },
      { id: 'loi_ra', name: 'Lối ra', fact: 'Gần đó là nhà Công tử Bạc Liêu, dinh thự nổi tiếng đầu thế kỷ 20. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
];
