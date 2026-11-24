// Điểm tham quan vùng Nam Trung Bộ và Tây Nguyên (tỉnh sau sáp nhập 2025). Bộ cảnh 3D ở web/src/sight/sets/regions/nam_trung_tay_nguyen.ts.
// Số liệu tra 24/11/2026; nguồn ghi ngay trên từng địa danh. Khi các nguồn vênh nhau, dùng con số đa số nguồn ghi và nói "khoảng".
import type { Sight } from '../sights.ts';

export const SIGHTS_NAM_TRUNG_TAY_NGUYEN: Sight[] = [
  // Nguồn: mia.vn (nhà rông Kon Klor: dài 17 m, rộng 6 m, nóc cao khoảng 22 m; cầu treo 292 m × 4,5 m)
  {
    id: 'nt_kon_klor', name: 'Nhà rông Kon Klor', province: 'Quảng Ngãi', formerProvince: 'Kon Tum', lat: 14.357, lng: 108.019, kind: 'lang_nghe', emoji: '🛖',
    blurb: 'Nhà rông Ba Na mái cao vút bên sông Đắk Bla và cây cầu treo dài nhất Kon Tum.', entryFee: 0,
    stops: [
      { id: 'cau_treo', name: 'Cầu treo Kon Klor', fact: 'Cầu treo bắc qua sông Đắk Bla dài khoảng 292 m, rộng 4,5 m, nối thành phố Kon Tum với các làng Ba Na bên kia sông. Chiều tà người dân dắt xe máy, lùa bò qua cầu.' },
      { id: 'song_dak_bla', name: 'Bến sông Đắk Bla', fact: 'Sông Đắk Bla chảy qua Kon Tum rồi đổ vào sông Sê San. Người Ba Na vẫn dùng thuyền độc mộc khoét từ một thân cây để đánh cá trên sông.' },
      { id: 'nha_rong', name: 'Nhà rông Kon Klor', fact: 'Nhà rông dài khoảng 17 m, rộng 6 m, mái lá dựng đứng như lưỡi rìu cao khoảng 22 m. Đây là nơi già làng họp bàn việc làng, tiếp khách và tổ chức lễ hội.' },
      { id: 'cot_le', name: 'Cột lễ đâm trâu', fact: 'Cây nêu chạm khắc và sân rộng trước nhà rông là chỗ làng tổ chức lễ hội, đánh cồng chiêng. Không gian văn hoá cồng chiêng Tây Nguyên được UNESCO ghi danh năm 2005.' },
      { id: 'nha_san', name: 'Nhà sàn làng Kon Klor', fact: 'Nhà sàn thấp quanh nhà rông là nơi các gia đình Ba Na ở, gầm sàn để củi, nông cụ và khung dệt thổ cẩm. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: vinwonders.com, mia.vn (vé Kỳ Co 100.000đ, Eo Gió 25.000đ; cách Quy Nhơn khoảng 25 km qua cầu Thị Nại)
  {
    id: 'nt_ky_co', name: 'Kỳ Co – Eo Gió', province: 'Gia Lai', formerProvince: 'Bình Định', lat: 13.843, lng: 109.296, kind: 'bien', emoji: '🏝️',
    blurb: 'Bãi biển nước trong như ngọc dưới chân núi và mỏm đá đón gió ở bán đảo Phương Mai, Quy Nhơn.', entryFee: 100_000,
    stops: [
      { id: 'eo_gio', name: 'Lối dạo Eo Gió', fact: 'Eo Gió là eo biển hình cánh cung giữa hai dãy núi đá ở xã Nhơn Lý, gió thổi quanh năm. Lối bê tông men theo vách đá có lan can là chỗ ngắm hoàng hôn nổi tiếng.' },
      { id: 'tuong_phat', name: 'Tượng Phật trên vách đá', fact: 'Trên mỏm đá phía bắc Eo Gió có tượng Phật trắng của Tịnh xá Ngọc Hoà nhìn ra biển, dân chài coi là nơi phù hộ thuyền ra khơi.' },
      { id: 'bai_ky_co', name: 'Bãi biển Kỳ Co', fact: 'Bãi Kỳ Co dài chừng 1 km, nước biển xanh trong tới mức nhìn thấy đáy cát. Du khách thường đi ca nô từ Nhơn Lý vào bãi khoảng 15 phút.' },
      { id: 'bai_da', name: 'Bãi đá ven núi', fact: 'Cuối bãi là những tảng đá granite tròn nhẵn do sóng gió bào mòn, xếp chồng lên nhau sát mép nước.' },
      { id: 'lang_chai', name: 'Làng chài Nhơn Lý', fact: 'Nhơn Lý sống bằng nghề biển: thuyền thúng, lưới, hải sản phơi khô. Gỏi cá mai và bánh xèo tôm là món đặc trưng Quy Nhơn. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: vinwonders.com, mia.vn, tuoitre.vn (bốn tháp, cuối thế kỷ 11 – đầu thế kỷ 12, đồi bên sông Kôn, còn gọi tháp Bạc)
  {
    id: 'nt_thap_banh_it', name: 'Tháp Bánh Ít', province: 'Gia Lai', formerProvince: 'Bình Định', lat: 13.867, lng: 109.106, kind: 'den_thap', emoji: '🛕',
    blurb: 'Bốn tháp Chăm cổ trên đồi nhìn ra sông Kôn, còn gọi là tháp Bạc.', entryFee: 0,
    stops: [
      { id: 'chan_doi', name: 'Bậc đá lên đồi', fact: 'Quần thể nằm trên một ngọn đồi thoải cách trung tâm Quy Nhơn khoảng 20 km về phía tây bắc. Từ xa nhìn cụm tháp giống chiếc bánh ít nên dân gian đặt tên như vậy; người Pháp gọi là tháp Bạc.' },
      { id: 'thap_cong', name: 'Tháp Cổng', fact: 'Tháp Cổng (gopura) đứng ở sườn đồi thấp nhất, là lối vào linh thiêng dẫn lên tháp chính. Cả bốn tháp đều xây bằng gạch nung, ghép khít mà không thấy mạch vữa.' },
      { id: 'thap_bia', name: 'Tháp Bia', fact: 'Tháp Bia là ngọn tháp duy nhất có mặt bằng hình chữ nhật, mái cong hình thuyền, xưa đặt bia đá ghi việc dựng đền.' },
      { id: 'thap_chinh', name: 'Tháp Chính (Kalan)', fact: 'Tháp chính dựng khoảng cuối thế kỷ 11 – đầu thế kỷ 12, đánh dấu giai đoạn chuyển giữa phong cách Mỹ Sơn và phong cách Bình Định của nghệ thuật Chăm.' },
      { id: 'nhin_song_kon', name: 'Ngắm sông Kôn', fact: 'Từ đỉnh đồi nhìn xuống đồng lúa và dòng sông Kôn chảy về đầm Thị Nại. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: vnexpress.net, tapchicongthuong.vn (miệng núi lửa đã tắt, mặt nước khoảng 230–280 ha, cao khoảng 800 m, cách Pleiku 7 km; di tích quốc gia 1988)
  {
    id: 'nt_bien_ho', name: 'Biển Hồ Pleiku', province: 'Gia Lai', lat: 14.05, lng: 108.0, kind: 'nui', emoji: '🌊',
    blurb: 'Hồ nước trong miệng núi lửa đã tắt, được gọi là đôi mắt Pleiku.', entryFee: 10_000,
    stops: [
      { id: 'hang_thong', name: 'Đường thông vào hồ', fact: 'Con đường dẫn vào hồ hai bên là hàng thông ba lá thẳng tắp. Hồ nằm ở độ cao khoảng 800 m, cách trung tâm Pleiku chừng 7 km.' },
      { id: 'bac_thang', name: 'Bậc thang xuống hồ', fact: 'Bờ hồ chính là vành miệng núi lửa nhô cao, nên phải đi bậc thang xuống mới tới mặt nước. Người Jrai gọi hồ là T’Nưng, nghĩa là biển trên núi.' },
      { id: 'mat_ho', name: 'Mặt hồ T’Nưng', fact: 'Hồ rộng khoảng 230–280 ha, sâu trung bình 16–19 m. Đây là nguồn nước sinh hoạt chính của thành phố Pleiku nên không được bơi lội.' },
      { id: 'tuong_me', name: 'Tượng Đức Mẹ', fact: 'Tượng Đức Mẹ trắng đứng trên mỏm đất nhô ra hồ là chỗ chụp ảnh quen thuộc. Năm 1988 Biển Hồ được công nhận là di tích thắng cảnh quốc gia.' },
      { id: 'che_bien_ho', name: 'Đồi chè Biển Hồ', fact: 'Sườn đồi gần hồ là đồi chè trồng trên đất đỏ bazan, ở giữa có những cây thông cổ thụ mọc lẻ loi. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: vinpearl.com, vietnamairlines.com, vneconomy.vn (cột đá bazan lục giác; vé 40.000đ; công viên địa chất toàn cầu UNESCO)
  {
    id: 'nt_ganh_da_dia', name: 'Gành Đá Đĩa', province: 'Đắk Lắk', formerProvince: 'Phú Yên', lat: 13.357, lng: 109.296, kind: 'bien', emoji: '🪨',
    blurb: 'Bãi cột đá bazan hình lục giác xếp khít như tổ ong sát mép biển.', entryFee: 40_000,
    stops: [
      { id: 'cong', name: 'Cổng thắng cảnh', fact: 'Gành Đá Đĩa ở xã An Ninh Đông, nay thuộc Đắk Lắk sau khi sáp nhập Phú Yên. Vé vào cổng 40.000đ đã gồm bảo hiểm cho khách.' },
      { id: 'cot_da', name: 'Bãi cột đá lục giác', fact: 'Hàng nghìn cột đá bazan năm, sáu cạnh xếp khít nhau như tổ ong. Dung nham núi lửa phun trào, gặp nước biển nguội đi và co lại, nứt thành những cột đều đặn.' },
      { id: 'mat_da', name: 'Mặt đá như chồng đĩa', fact: 'Nhìn từ trên xuống, mặt các cột đá như những chồng đĩa xếp nghiêng, vì thế có tên Gành Đá Đĩa. Nơi đây được ví với Con đường Người khổng lồ ở Bắc Ireland.' },
      { id: 'mep_song', name: 'Mép sóng', fact: 'Sóng đánh vào chân gành tung bọt trắng. Khi biển động không nên đứng sát mép đá vì mặt đá trơn.' },
      { id: 'lang_chai', name: 'Bãi thuyền thúng', fact: 'Hai bên gành là bãi cát và làng chài với thuyền thúng phơi trên cát. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: vnexpress.net, mia.vn, vietnambooking.com (thác cao hơn 30 m, bề ngang khoảng 250 m mùa nước lớn, vé 30.000đ, cách Buôn Ma Thuột khoảng 27 km)
  {
    id: 'nt_dray_nur', name: 'Thác Dray Nur', province: 'Đắk Lắk', lat: 12.538, lng: 107.889, kind: 'nui', emoji: '💦',
    blurb: 'Thác nước hùng vĩ trên sông Sêrêpốk, bức tường nước trắng xoá giữa đại ngàn.', entryFee: 30_000,
    stops: [
      { id: 'loi_rung', name: 'Lối rừng xuống thác', fact: 'Thác Dray Nur cách trung tâm Buôn Ma Thuột khoảng 27 km, trên dòng Sêrêpốk. Lối đi xuống thác len giữa rừng cây và những tảng đá bazan đen.' },
      { id: 'chan_thac', name: 'Chân thác', fact: 'Mùa nước lớn, bức tường nước rộng khoảng 250 m đổ từ độ cao hơn 30 m xuống hồ sâu, bụi nước bay mù cả một vùng.' },
      { id: 'hang_doi', name: 'Hang dơi sau thác', fact: 'Phía sau màn nước có hang đá lớn, xưa là nơi trú của đàn dơi. Dray Nur trong tiếng Ê Đê nghĩa là thác vợ.' },
      { id: 'cau_treo', name: 'Cầu treo sang Dray Sáp', fact: 'Dray Nur là thác vợ, thác Dray Sáp gần đó là thác chồng. Truyền thuyết kể về đôi vợ chồng chia lìa thành hai ngọn thác bên nhau.' },
      { id: 'nha_dai', name: 'Nhà dài Ê Đê', fact: 'Nhà dài của người Ê Đê làm trên sàn, cầu thang có tạc hình bầu ngực người mẹ, biểu tượng của chế độ mẫu hệ. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: nhandan.vn, vinpearl.com, momo.vn (tháp chính cao khoảng 23 m, thờ nữ thần Po Inư Nagar; di tích quốc gia đặc biệt 1/2025; vé 30.000đ)
  {
    id: 'nt_ponagar', name: 'Tháp Bà Ponagar', province: 'Khánh Hòa', lat: 12.265, lng: 109.195, kind: 'den_thap', emoji: '🛕',
    blurb: 'Quần thể tháp Chăm trên đồi Cù Lao bên cửa sông Cái, Nha Trang.', entryFee: 30_000,
    stops: [
      { id: 'bac_da', name: 'Bậc đá lên đồi', fact: 'Quần thể nằm trên đồi Cù Lao nhìn xuống cửa sông Cái Nha Trang. Tháng 1/2025 di tích được xếp hạng di tích quốc gia đặc biệt.' },
      { id: 'mandapa', name: 'Tiền đình cột gạch', fact: 'Tiền đình (mandapa) còn hai hàng cột gạch to tròn đứng trơ trụi, xưa có mái che, là nơi khách hành hương sửa soạn trước khi lên tháp.' },
      { id: 'thap_chinh', name: 'Tháp chính', fact: 'Tháp chính cao khoảng 23 m, thờ nữ thần Po Inư Nagar, mẹ xứ sở của người Chăm. Người Việt gọi là Thiên Y A Na Thánh Mẫu.' },
      { id: 'thap_nam', name: 'Các tháp phụ', fact: 'Quanh tháp chính còn các tháp nhỏ thờ các vị thần khác. Lễ hội Tháp Bà diễn ra vào tháng Ba âm lịch hằng năm, có múa bóng dâng lễ.' },
      { id: 'nhin_song_cai', name: 'Ngắm cửa sông Cái', fact: 'Từ sân tháp nhìn ra cầu Xóm Bóng và những đoàn thuyền thúng, thuyền đánh cá neo ở cửa sông. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: vinwonders.com, mia.vn (vịnh thuộc vùng biển Vườn quốc gia Núi Chúa; tàu đáy kính 80.000đ/người đã gồm phí bảo tồn)
  {
    id: 'nt_vinh_hy', name: 'Vịnh Vĩnh Hy', province: 'Khánh Hòa', formerProvince: 'Ninh Thuận', lat: 11.722, lng: 109.197, kind: 'bien', emoji: '⛵',
    blurb: 'Vịnh biển kín gió giữa núi rừng Núi Chúa, nước trong nhìn thấy san hô.', entryFee: 80_000,
    stops: [
      { id: 'deo', name: 'Đèo ven biển', fact: 'Đường vào Vĩnh Hy men theo cung đường biển Phan Rang – Nha Trang, một bên núi đá khô, một bên vực biển xanh.' },
      { id: 'ben_vinh_hy', name: 'Bến Vĩnh Hy', fact: 'Vịnh ba mặt là núi của Vườn quốc gia Núi Chúa, chỉ mở ra biển ở một phía nên sóng lặng quanh năm. Làng chài Vĩnh Hy neo thuyền ngay trong lòng vịnh.' },
      { id: 'tau_day_kinh', name: 'Tàu đáy kính', fact: 'Tàu đáy kính đưa khách ra ngắm rạn san hô, vé khoảng 80.000đ/người đã gồm phí bảo tồn. Mùa đẹp nhất từ tháng 5 đến tháng 8 khi biển lặng.' },
      { id: 'be_nuoi', name: 'Bè nuôi hải sản', fact: 'Trong vịnh có các bè nổi nuôi tôm hùm, cá mú. Khách có thể ghé bè ăn hải sản tươi.' },
      { id: 'bai_da', name: 'Bãi đá ven vịnh', fact: 'Bờ vịnh là đá granite xám xếp chồng và rừng khô hạn ven biển hiếm hoi ở Việt Nam. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: vinwonders.com, wikipedia (Po Klong Garai: cuối thế kỷ 13 – đầu thế kỷ 14, đồi Trầu, ba tháp: chính, cổng, lửa)
  {
    id: 'nt_po_klong_garai', name: 'Tháp Po Klong Garai', province: 'Khánh Hòa', formerProvince: 'Ninh Thuận', lat: 11.6, lng: 108.944, kind: 'den_thap', emoji: '🛕',
    blurb: 'Ba tháp Chăm trên đồi Trầu giữa nắng gió Phan Rang, còn nguyên dáng vẻ sau hơn 700 năm.', entryFee: 25_000,
    stops: [
      { id: 'chan_doi', name: 'Chân đồi Trầu', fact: 'Tháp dựng trên đồi Trầu, phía tây bắc Phan Rang, giữa vùng đất khô nhiều nắng gió nhất cả nước. Sườn đồi mọc xương rồng và cỏ cháy vàng.' },
      { id: 'thap_cong', name: 'Tháp Cổng', fact: 'Quần thể gồm ba tháp: tháp Cổng, tháp Lửa và tháp Chính. Hai tháp phụ không dùng để thờ cúng.' },
      { id: 'thap_lua', name: 'Tháp Lửa', fact: 'Tháp Lửa có mái cong hình yên ngựa, xưa là nơi chuẩn bị đồ tế lễ trước khi dâng lên tháp chính.' },
      { id: 'thap_chinh', name: 'Tháp Chính', fact: 'Tháp chính dựng cuối thế kỷ 13 – đầu thế kỷ 14, thờ vua Po Klong Garai, người có công làm thuỷ lợi cho vùng đất khô Panduranga. Trên cửa chính có tượng thần Shiva sáu tay.' },
      { id: 'le_kate', name: 'Sân lễ Katê', fact: 'Lễ hội Katê của người Chăm theo đạo Bà-la-môn diễn ra ở tháp vào tháng 7 lịch Chăm, có rước y trang, múa và trống Ginăng. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: wikipedia, lonelyplanet, daidoanket.vn (đập năm 1919, mở rộng 1923; chu vi khoảng 5 km, khoảng 25 ha)
  {
    id: 'nt_ho_xuan_huong', name: 'Hồ Xuân Hương', province: 'Lâm Đồng', lat: 11.942, lng: 108.446, kind: 'nui', emoji: '🌲',
    blurb: 'Hồ nước hình trăng lưỡi liềm giữa lòng Đà Lạt, viền thông và hoa.', entryFee: 0,
    stops: [
      { id: 'quang_truong', name: 'Quảng trường Lâm Viên', fact: 'Quảng trường bên bờ hồ có công trình nụ hoa dã quỳ và khối bông hoa atiso bằng kính màu, biểu tượng của Đà Lạt.' },
      { id: 'bo_ho', name: 'Lối dạo bờ hồ', fact: 'Hồ có từ năm 1919 khi người Pháp đắp đập ngăn suối Cam Ly, sau đó xây thêm đập năm 1923. Chu vi khoảng 5 km, rộng khoảng 25 ha.' },
      { id: 'thien_nga', name: 'Bến thuyền thiên nga', fact: 'Du khách thường đạp thuyền thiên nga trên hồ. Buổi sớm mặt hồ phủ sương mờ, xa xa là đồi thông.' },
      { id: 'thuy_ta', name: 'Nhà hàng Thủy Tạ', fact: 'Nhà hàng Thủy Tạ dựng trên cột giữa mặt hồ từ thời Pháp, là một trong những công trình cũ nhất quanh hồ.' },
      { id: 'cho_da_lat', name: 'Chợ Đà Lạt', fact: 'Chợ Đà Lạt ngay sát hồ bán dâu tây, atiso, mứt và rau hoa. Tối đến khu chợ đêm bán sữa đậu nành nóng và bánh tráng nướng. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: nhandan.vn, vnexpress.net, vinwonders.com (xây từ 1932, xong khoảng 1936–1938; ba mái nhọn gợi dãy Lang Biang; di tích quốc gia 2001)
  {
    id: 'nt_ga_da_lat', name: 'Ga Đà Lạt', province: 'Lâm Đồng', lat: 11.941, lng: 108.455, kind: 'pho_co', emoji: '🚂',
    blurb: 'Nhà ga cổ ba mái nhọn, tuyến xe lửa răng cưa xưa nối Đà Lạt với Tháp Chàm.', entryFee: 10_000,
    stops: [
      { id: 'san_ga', name: 'Sân trước ga', fact: 'Ga Đà Lạt khởi công năm 1932, hoàn thành khoảng 1936–1938. Năm 2001 nhà ga được công nhận là di tích lịch sử – văn hoá quốc gia.' },
      { id: 'mai_nhon', name: 'Ba mái nhọn', fact: 'Ba chóp mái dốc đứng được cho là gợi hình dãy núi Lang Biang, cũng có người thấy dáng mái nhà rông Tây Nguyên. Kính màu trên mặt tiền chiếu sáng sảnh đợi.' },
      { id: 'sanh_doi', name: 'Sảnh đợi', fact: 'Tuyến xe lửa răng cưa Tháp Chàm – Đà Lạt dài 84 km, đoạn qua đèo Sông Pha leo dốc nhờ thanh răng cưa ở giữa đường ray. Tuyến ngừng chạy từ năm 1975.' },
      { id: 'dau_may', name: 'Đầu máy hơi nước', fact: 'Trên sân ga còn trưng bày đầu máy hơi nước cũ. Hiện chỉ có đoàn tàu du lịch chạy 7 km từ ga Đà Lạt xuống ga Trại Mát.' },
      { id: 'tau_trai_mat', name: 'Tàu du lịch Trại Mát', fact: 'Đoàn tàu du lịch đi qua những vườn rau, đồi thông tới Trại Mát, gần chùa Linh Phước khảm sành. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  // Nguồn: vietnamairlines.com, vinwonders.com, momo.vn (đồi cát đổi hình theo gió; vào cửa miễn phí hoặc vài nghìn đồng gửi xe)
  {
    id: 'nt_mui_ne', name: 'Đồi cát bay Mũi Né', province: 'Lâm Đồng', formerProvince: 'Bình Thuận', lat: 10.955, lng: 108.297, kind: 'bien', emoji: '🏜️',
    blurb: 'Đồi cát đỏ vàng đổi hình theo gió bên làng chài Mũi Né.', entryFee: 15_000,
    stops: [
      { id: 'chan_doi', name: 'Chân đồi cát', fact: 'Đồi cát bay ở phường Mũi Né, nay thuộc Lâm Đồng sau khi sáp nhập Bình Thuận. Gió mùa thổi cát di chuyển nên hình dáng đồi thay đổi theo từng mùa.' },
      { id: 'dinh_doi', name: 'Đỉnh đồi', fact: 'Cát ở đây có màu vàng đỏ do lẫn ôxít sắt. Trên đỉnh đồi nhìn thấy cả biển Mũi Né phía xa.' },
      { id: 'truot_cat', name: 'Chỗ trượt cát', fact: 'Trẻ em làng chài cho thuê tấm nhựa để trượt từ đỉnh đồi xuống. Nên đi lúc sáng sớm hoặc chiều muộn vì giữa trưa cát rất nóng.' },
      { id: 'xe_dia_hinh', name: 'Bãi xe địa hình', fact: 'Xe địa hình (ATV) và xe jeep đưa khách chạy qua các triền cát. Dịch vụ tính phí riêng, nên hỏi giá trước.' },
      { id: 'lang_chai', name: 'Làng chài Mũi Né', fact: 'Dưới chân đồi là làng chài với hàng trăm thuyền thúng neo sát bờ, nổi tiếng với nước mắm Phan Thiết và bánh căn. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
];
