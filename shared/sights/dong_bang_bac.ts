// Điểm tham quan vùng Đồng bằng sông Hồng. Thêm địa danh vào mảng; bộ cảnh 3D ở web/src/sight/sets/regions/dong_bang_bac.ts.
// Tỉnh theo địa giới sau sáp nhập 2025 (formerProvince là tỉnh cũ). Giá vé lấy theo bảng giá công bố gần nhất tìm được:
// Văn Miếu 70.000đ (baolamdong.vn 12/2025), Tràng An 250.000đ gồm đò (2025; từ 2026 nhiều nguồn ghi 300.000đ),
// vé thắng cảnh vịnh Hạ Long tuyến hang Sửng Sốt – Ti Tốp 250.000đ (sunparadiseland.com, 2025). Đền Ngọc Sơn 30.000đ, Yên Tử 40.000đ là mức
// quen thuộc nhiều năm, chưa thấy văn bản 2025 nên coi là ước tính.
import type { Sight } from '../sights.ts';

export const SIGHTS_DONG_BANG_BAC: Sight[] = [
  {
    id: 'hn_ho_guom', name: 'Hồ Gươm – đền Ngọc Sơn', province: 'Hà Nội', lat: 21.0287, lng: 105.8524, kind: 'chua', emoji: '🐢',
    blurb: 'Hồ nước giữa lòng phố cổ, gắn với truyền thuyết vua Lê Lợi trả gươm cho Rùa thần.', entryFee: 30_000,
    stops: [
      { id: 'thap_but', name: 'Tháp Bút và Đài Nghiên', fact: 'Tháp Bút năm tầng do nhà nho Nguyễn Văn Siêu cho dựng năm 1865, thân tháp khắc ba chữ "Tả thanh thiên" nghĩa là viết lên trời xanh. Cổng bên trong có Đài Nghiên hình nửa quả đào đặt trên lưng ba con cóc.' },
      { id: 'cau_the_huc', name: 'Cầu Thê Húc', fact: 'Cây cầu gỗ sơn đỏ cong như con tôm nối bờ với đảo Ngọc. Tên Thê Húc nghĩa là nơi đậu ánh sáng ban mai.' },
      { id: 'den_ngoc_son', name: 'Đền Ngọc Sơn', fact: 'Đền trên đảo Ngọc thờ Văn Xương Đế Quân và Đức Thánh Trần Hưng Đạo. Trong đền giữ tiêu bản một cá thể rùa Hồ Gươm từng sống ở hồ.' },
      { id: 'thap_rua', name: 'Ngắm Tháp Rùa', fact: 'Tháp Rùa ba tầng xây cuối thế kỷ 19 trên gò Rùa giữa hồ, pha lối kiến trúc Việt với châu Âu, nay là biểu tượng của Hà Nội.' },
      { id: 'pho_di_bo', name: 'Phố đi bộ ven hồ', fact: 'Tối thứ Sáu đến Chủ nhật, các phố quanh hồ cấm xe để người đi bộ dạo chơi, xem hát, chơi trò dân gian. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'hn_van_mieu', name: 'Văn Miếu – Quốc Tử Giám', province: 'Hà Nội', lat: 21.0285, lng: 105.8355, kind: 'den_thap', emoji: '🎓',
    blurb: 'Nơi thờ Khổng Tử và trường đại học đầu tiên của Việt Nam, hơn chín trăm năm tuổi.', entryFee: 70_000,
    stops: [
      { id: 'van_mieu_mon', name: 'Văn Miếu Môn', fact: 'Văn Miếu được vua Lý Thánh Tông cho xây năm 1070. Năm 1076 vua Lý Nhân Tông lập Quốc Tử Giám bên cạnh, coi là trường đại học đầu tiên của nước ta.' },
      { id: 'khue_van_cac', name: 'Khuê Văn Các', fact: 'Gác hai tầng xây năm 1805, bốn mặt có cửa sổ tròn tượng trưng sao Khuê, ngôi sao chủ về văn chương. Hình gác này được in trên logo của Hà Nội.' },
      { id: 'bia_tien_si', name: 'Giếng Thiên Quang và bia tiến sĩ', fact: 'Hai bên giếng vuông Thiên Quang là 82 tấm bia đá đặt trên lưng rùa, khắc tên 1.307 vị đỗ tiến sĩ qua 82 khoa thi từ năm 1442 đến 1779. Bia được UNESCO ghi danh Di sản tư liệu thế giới năm 2010.' },
      { id: 'dai_thanh', name: 'Điện Đại Thành', fact: 'Điện chính thờ Khổng Tử và các học trò. Phía sau là khu Thái Học, nơi thờ thầy giáo Chu Văn An và các vua có công với Quốc Tử Giám. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'qn_vinh_ha_long', name: 'Vịnh Hạ Long – hang Sửng Sốt', province: 'Quảng Ninh', lat: 20.8439, lng: 107.0888, kind: 'dao', emoji: '⛰️',
    island: true, port: { name: 'cảng tàu khách quốc tế Tuần Châu', lat: 20.931, lng: 106.988, islandPort: 'bến đảo Bồ Hòn', boat: 'Tàu tham quan vịnh', note: 'Tàu tham quan đi giữa các đảo đá vôi khoảng 1 giờ tới đảo Bồ Hòn.' },
    blurb: 'Gần hai nghìn hòn đảo đá vôi nhô lên giữa biển xanh, hai lần được UNESCO ghi danh Di sản thiên nhiên thế giới.', entryFee: 250_000,
    stops: [
      { id: 'ben_bo_hon', name: 'Bến đảo Bồ Hòn', fact: 'Vịnh Hạ Long có 1.969 hòn đảo, phần lớn là đá vôi. UNESCO ghi danh vịnh là Di sản thiên nhiên thế giới năm 1994 vì cảnh quan và năm 2000 vì giá trị địa chất.' },
      { id: 'hang_sung_sot', name: 'Hang Sửng Sốt', fact: 'Hang trên đảo Bồ Hòn được người Pháp tìm ra năm 1901. Lối vào nằm lưng chừng vách đá, phải leo bậc lên khoảng 25 m.' },
      { id: 'dinh_bo_hon', name: 'Ngăn trong của hang', fact: 'Lòng hang chia hai ngăn; ngăn sau rộng như một nhà hát lớn, trần cao hàng chục mét, nhũ đá và măng đá muôn hình.' },
      { id: 'dao_ti_top', name: 'Cửa ra của hang', fact: 'Từ cửa ra nhìn xuống vụng Sửng Sốt kín gió, nơi tàu tham quan neo đậu giữa các hòn đảo.' },
      { id: 'chot_ngam', name: 'Bến đông, nhìn sang đảo Ti Tốp', fact: 'Năm 1962 Chủ tịch Hồ Chí Minh đưa nhà du hành vũ trụ Liên Xô Gherman Titov thăm hòn đảo phía đông, từ đó đảo mang tên Ti Tốp, nổi tiếng với bãi tắm hình vầng trăng. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'qn_yen_tu', name: 'Yên Tử', province: 'Quảng Ninh', lat: 21.1567, lng: 106.7116, kind: 'nui', emoji: '🔔',
    blurb: 'Núi thiêng nơi vua Trần Nhân Tông tu hành và lập nên Thiền phái Trúc Lâm.', entryFee: 40_000,
    stops: [
      { id: 'chua_giai_oan', name: 'Chùa Giải Oan', fact: 'Năm 1299 vua Trần Nhân Tông lên Yên Tử tu hành. Tương truyền các cung nữ theo vua không được, gieo mình xuống suối; vua lập chùa Giải Oan để siêu độ cho họ.' },
      { id: 'thap_to', name: 'Vườn tháp Huệ Quang', fact: 'Khu tháp mộ các thiền sư, lớn nhất là tháp Huệ Quang giữ xá lợi của Trần Nhân Tông, Phật hoàng tổ của Thiền phái Trúc Lâm.' },
      { id: 'chua_hoa_yen', name: 'Chùa Hoa Yên', fact: 'Ngôi chùa chính trên lưng chừng núi, ở độ cao khoảng 516 m, nơi vua Trần Nhân Tông thuyết pháp. Quanh chùa còn những cây đại, cây tùng hàng trăm năm tuổi.' },
      { id: 'cap_treo', name: 'Ga cáp treo', fact: 'Cáp treo đưa khách từ chân núi lên gần chùa Hoa Yên rồi lên tới gần đỉnh, rút ngắn hàng nghìn bậc đá.' },
      { id: 'chua_dong', name: 'Chùa Đồng trên đỉnh', fact: 'Chùa Đồng trên đỉnh Yên Tử ở độ cao khoảng 1.068 m, toàn bộ đúc bằng đồng. Quần thể Yên Tử – Vĩnh Nghiêm – Côn Sơn, Kiếp Bạc được UNESCO ghi danh Di sản văn hoá thế giới năm 2025. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'hp_lan_ha', name: 'Cát Bà – vịnh Lan Hạ', province: 'Hải Phòng', lat: 20.761, lng: 107.07, kind: 'dao', emoji: '🐒',
    island: true, port: { name: 'bến Bính', lat: 20.866, lng: 106.684, islandPort: 'cảng Cát Bà', boat: 'Tàu cao tốc', note: 'Tàu cao tốc từ bến Bính ra Cát Bà mất khoảng 50 phút.' },
    blurb: 'Hòn đảo lớn nhất vịnh Bắc Bộ với rừng nguyên sinh, voọc Cát Bà và vịnh Lan Hạ yên tĩnh.', entryFee: 0,
    stops: [
      { id: 'thi_tran', name: 'Thị trấn Cát Bà', fact: 'Quần đảo Cát Bà có hơn 360 hòn đảo, được UNESCO công nhận Khu dự trữ sinh quyển thế giới năm 2004. Năm 2023, Hạ Long – Cát Bà được ghi danh chung một Di sản thiên nhiên thế giới.' },
      { id: 'phao_dai', name: 'Pháo đài Thần Công', fact: 'Trên đồi cao nhất gần thị trấn còn hai khẩu pháo do người Pháp đặt từ những năm 1940, từ đây nhìn bao quát vịnh Lan Hạ.' },
      { id: 'voc', name: 'Rừng của voọc Cát Bà', fact: 'Voọc Cát Bà (voọc đầu vàng) chỉ sống trên quần đảo này, là một trong những loài linh trưởng hiếm nhất thế giới, chỉ còn vài chục cá thể.' },
      { id: 'lang_chai', name: 'Làng chài nổi', fact: 'Người dân nuôi cá, tôm hùm trên những bè gỗ nổi giữa vịnh, nhà nổi sơn xanh đỏ nối nhau bằng ván gỗ.' },
      { id: 'lan_ha', name: 'Bãi vịnh Lan Hạ', fact: 'Vịnh Lan Hạ có khoảng 400 đảo đá vôi và nhiều bãi cát trắng nhỏ, nước xanh ngọc, kín gió. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'nb_trang_an', name: 'Tràng An', province: 'Ninh Bình', lat: 20.2546, lng: 105.8996, kind: 'nui', emoji: '🛶',
    blurb: 'Đi đò len giữa núi đá vôi, xuyên những hang nước tối, di sản hỗn hợp văn hoá và thiên nhiên đầu tiên của Đông Nam Á.', entryFee: 250_000,
    stops: [
      { id: 'ben_do', name: 'Bến thuyền Tràng An', fact: 'Quần thể danh thắng Tràng An được UNESCO ghi danh năm 2014, là di sản hỗn hợp văn hoá và thiên nhiên đầu tiên của Việt Nam và Đông Nam Á.' },
      { id: 'hang_sang', name: 'Hang Sáng', fact: 'Đò đi xuyên lòng núi qua những hang nước. Hang Sáng có nhũ đá rủ xuống sát mặt nước, phải cúi người khi đò đi qua.' },
      { id: 'hang_toi', name: 'Hang Tối', fact: 'Trong các hang ở Tràng An, các nhà khảo cổ tìm thấy dấu tích người tiền sử sống từ khoảng 30.000 năm trước.' },
      { id: 'den_trinh', name: 'Đền Trình', fact: 'Đền nhỏ trên đảo giữa hồ, nơi thờ quan coi giữ kinh đô Hoa Lư thời Đinh, khách lên đò thường dừng thắp hương trước khi đi tiếp.' },
      { id: 'phim_truong', name: 'Phim trường Kong', fact: 'Năm 2016, đoàn làm phim "Kong: Skull Island" dựng một làng thổ dân ở Tràng An. Một phần làng được giữ lại cho khách tham quan. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'nb_bai_dinh', name: 'Chùa Bái Đính', province: 'Ninh Bình', lat: 20.2737, lng: 105.8652, kind: 'chua', emoji: '🔔',
    blurb: 'Quần thể chùa lớn bậc nhất Việt Nam tựa lưng vào núi, với hành lang La Hán và tượng Phật bằng đồng.', entryFee: 0,
    stops: [
      { id: 'tam_quan', name: 'Tam quan', fact: 'Chùa Bái Đính mới được xây từ năm 2003 bên cạnh chùa Bái Đính cổ trên núi, trên khu đất rộng hàng trăm ha.' },
      { id: 'hanh_lang_la_han', name: 'Hành lang La Hán', fact: 'Hai dãy hành lang dài hơn một cây số đặt 500 tượng La Hán bằng đá xanh, mỗi tượng một dáng vẻ khác nhau.' },
      { id: 'gac_chuong', name: 'Gác chuông', fact: 'Gác chuông treo quả chuông đồng nặng khoảng 36 tấn, từng được ghi nhận là chuông đồng lớn nhất Việt Nam.' },
      { id: 'dien_phap_chu', name: 'Điện Pháp Chủ', fact: 'Điện thờ tượng Phật Pháp Chủ bằng đồng cao khoảng 10 m, nặng khoảng 100 tấn.' },
      { id: 'bao_thap', name: 'Bảo tháp', fact: 'Bảo tháp 13 tầng cao khoảng 99 m nhìn ra cả cánh đồng và núi đá Ninh Bình. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'bn_chua_dau', name: 'Chùa Dâu', province: 'Bắc Ninh', lat: 21.0325, lng: 106.0414, kind: 'chua', emoji: '🏯',
    blurb: 'Ngôi chùa được coi là cổ nhất Việt Nam, trung tâm Phật giáo đầu tiên ở vùng Luy Lâu xưa.', entryFee: 0,
    stops: [
      { id: 'cong_chua', name: 'Cổng chùa', fact: 'Chùa Dâu (Diên Ứng tự) ở Thuận Thành, xây dựng từ khoảng đầu Công nguyên khi vùng Luy Lâu là trung tâm Phật giáo đầu tiên của nước ta.' },
      { id: 'thap_hoa_phong', name: 'Tháp Hoà Phong', fact: 'Tháp gạch nung ba tầng còn lại giữa sân chùa, xây thời Trần, bốn góc tầng dưới có bốn tượng Thiên Vương bằng đá.' },
      { id: 'dien_phap_van', name: 'Điện thờ Pháp Vân', fact: 'Chùa thờ bà Dâu, tức Pháp Vân, đứng đầu hệ thống Tứ Pháp (Mây, Mưa, Sấm, Chớp) gắn với nghề trồng lúa nước.' },
      { id: 'hoi_chua', name: 'Sân hội', fact: 'Hội chùa Dâu mở ngày 8 tháng Tư âm lịch, rước các tượng Tứ Pháp và cầu mưa thuận gió hoà. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'hy_pho_hien', name: 'Phố Hiến', province: 'Hưng Yên', lat: 20.6466, lng: 106.0619, kind: 'pho_co', emoji: '🏮',
    blurb: 'Thương cảng sầm uất bên sông Hồng thế kỷ 16–17, như câu "Thứ nhất kinh kỳ, thứ nhì Phố Hiến".', entryFee: 0,
    stops: [
      { id: 'van_mieu_xich_dang', name: 'Văn Miếu Xích Đằng', fact: 'Văn Miếu của trấn Sơn Nam, nơi ghi danh các nhà khoa bảng của vùng. Phố Hiến từng có thương nhân Trung Hoa, Nhật Bản, Hà Lan, Anh đến buôn bán.' },
      { id: 'chua_chuong', name: 'Chùa Chuông', fact: 'Chùa Chuông (Kim Chung tự) nổi tiếng với cổng tam quan, giếng nước và hai dãy tượng La Hán dọc hành lang.' },
      { id: 'den_mau', name: 'Đền Mẫu bên hồ Bán Nguyệt', fact: 'Đền nằm bên hồ, sân có cây si cổ thụ rễ buông xuống mặt nước, là nơi thờ Dương Quý Phi theo truyền thuyết địa phương.' },
      { id: 'vuon_nhan', name: 'Vườn nhãn lồng', fact: 'Hưng Yên nổi tiếng với nhãn lồng, ngày xưa là sản vật tiến vua. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'hy_chua_keo', name: 'Chùa Keo', province: 'Hưng Yên', formerProvince: 'Thái Bình', lat: 20.4286, lng: 106.3076, kind: 'chua', emoji: '🔔',
    blurb: 'Ngôi chùa gỗ thế kỷ 17 với gác chuông ba tầng mái đẹp bậc nhất đồng bằng Bắc Bộ.', entryFee: 0,
    stops: [
      { id: 'tam_quan', name: 'Tam quan và hồ sen', fact: 'Chùa Keo (Thần Quang tự) ở Vũ Thư được dựng lại ở vị trí hiện nay năm 1630, sau khi chùa cũ bị lũ sông Hồng cuốn trôi.' },
      { id: 'chua_phat', name: 'Chùa thờ Phật', fact: 'Toàn bộ chùa làm bằng gỗ lim, kiến trúc nội công ngoại quốc, các toà nối nhau theo trục thẳng.' },
      { id: 'den_thanh', name: 'Đền thờ Thánh', fact: 'Chùa thờ Thiền sư Không Lộ, người có công với nghề chài lưới và đúc đồng thời Lý.' },
      { id: 'gac_chuong', name: 'Gác chuông ba tầng', fact: 'Gác chuông cao khoảng 11 m, ba tầng mười hai mái cong, khung gỗ ghép mộng không dùng đinh, là công trình gỗ tiêu biểu thời Hậu Lê. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
];
