// Điểm tham quan thật ở từng tỉnh, thành: toạ độ thật, các điểm dừng theo đúng thứ tự đi bộ ngoài đời.
// Người chơi phải đang ở trong tỉnh đó (vùng nhà hoặc vùng đang tham quan) mới bắt taxi tới được.

export type SightKind = 'pho_co' | 'den_thap' | 'nui' | 'cau' | 'chua' | 'dao';
export interface SightStop { id: string; name: string; /** Điều có thật về điểm dừng, hiện khi người chơi đi tới. */ fact: string }
export interface Sight {
  id: string; name: string; province: string; formerProvince?: string;
  lat: number; lng: number; kind: SightKind; emoji: string;
  /** Một câu giới thiệu ngắn. */
  blurb: string;
  /** Vé vào cổng (đồng trong game). */
  entryFee: number;
  /** Các điểm dừng theo thứ tự đi; điểm cuối là lối ra dẫn sang siêu thị đặc sản. */
  stops: SightStop[];
}

export const SIGHTS: Sight[] = [
  {
    id: 'dn_hoi_an', name: 'Phố cổ Hội An', province: 'Đà Nẵng', formerProvince: 'Quảng Nam', lat: 15.877, lng: 108.326, kind: 'pho_co', emoji: '🏮',
    blurb: 'Thương cảng xưa bên sông Hoài, di sản văn hoá thế giới từ năm 1999.', entryFee: 12_000,
    stops: [
      { id: 'cong', name: 'Cổng phố đi bộ', fact: 'Hội An từng là thương cảng sầm uất thế kỷ 16–17, nơi thuyền buôn Nhật, Hoa, Hà Lan ghé bến. Năm 1999 UNESCO ghi danh phố cổ là di sản văn hoá thế giới.' },
      { id: 'chua_cau', name: 'Chùa Cầu', fact: 'Cây cầu gỗ có mái do thương nhân Nhật dựng đầu thế kỷ 17 nên còn gọi là cầu Nhật Bản. Hình Chùa Cầu được in trên tờ tiền 20.000 đồng.' },
      { id: 'nha_co', name: 'Nhà cổ Tấn Ký', fact: 'Ngôi nhà hơn 200 năm tuổi của một gia đình buôn bán, kết hợp kiến trúc Việt, Hoa và Nhật; mặt sau mở ra sông để nhận hàng từ thuyền.' },
      { id: 'hoi_quan', name: 'Hội quán Phúc Kiến', fact: 'Nơi người Hoa gốc Phúc Kiến hội họp và thờ Thiên Hậu, vị thần che chở người đi biển.' },
      { id: 'pho_den_long', name: 'Phố đèn lồng', fact: 'Đèn lồng Hội An làm từ khung tre bọc lụa. Đêm rằm phố cổ tắt đèn điện, chỉ thắp đèn lồng.' },
      { id: 'song_hoai', name: 'Bến sông Hoài', fact: 'Sông Hoài là một nhánh của sông Thu Bồn. Buổi tối người ta thả hoa đăng giấy xuống sông để cầu may.' },
      { id: 'cho', name: 'Chợ Hội An', fact: 'Cao lầu và mì Quảng là hai món sợi nổi tiếng của xứ Quảng. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'dn_my_son', name: 'Thánh địa Mỹ Sơn', province: 'Đà Nẵng', formerProvince: 'Quảng Nam', lat: 15.764, lng: 108.124, kind: 'den_thap', emoji: '🛕',
    blurb: 'Quần thể đền tháp Chăm Pa trong thung lũng kín, di sản văn hoá thế giới từ năm 1999.', entryFee: 15_000,
    stops: [
      { id: 'cong', name: 'Cổng khu di tích', fact: 'Mỹ Sơn nằm trong một thung lũng có núi bao quanh, là nơi các vua Chăm Pa dựng đền thờ từ thế kỷ 4 đến thế kỷ 13.' },
      { id: 'suoi', name: 'Cầu qua suối Khe Thẻ', fact: 'Con suối chảy qua thung lũng đổ ra sông Thu Bồn, con sông nối Mỹ Sơn với cảng thị Hội An xưa.' },
      { id: 'nhom_bcd', name: 'Nhóm tháp B, C, D', fact: 'Đây là nhóm tháp còn nguyên vẹn nhất. Tháp xây bằng gạch nung xếp khít đến mức gần như không thấy mạch vữa; cách làm đến nay vẫn chưa được giải thích trọn vẹn.' },
      { id: 'linga', name: 'Bệ thờ Linga – Yoni', fact: 'Các đền ở Mỹ Sơn thờ thần Shiva của Ấn Độ giáo, biểu tượng là bộ Linga – Yoni bằng sa thạch.' },
      { id: 'nhom_a', name: 'Nền tháp A1', fact: 'Tháp A1 từng cao khoảng 24 m, là kiệt tác của kiến trúc Chăm, bị bom đánh sập năm 1969; nay chỉ còn nền và gạch vỡ.' },
      { id: 'nha_mua', name: 'Nhà biểu diễn múa Chăm', fact: 'Điệu múa Apsara lấy hình tượng tiên nữ trên các phù điêu sa thạch. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'dn_ngu_hanh_son', name: 'Ngũ Hành Sơn', province: 'Đà Nẵng', lat: 16.004, lng: 108.263, kind: 'nui', emoji: '⛰️',
    blurb: 'Năm ngọn núi đá vôi sát biển Non Nước, nhiều hang động và chùa cổ.', entryFee: 4_000,
    stops: [
      { id: 'lang_da', name: 'Làng đá mỹ nghệ Non Nước', fact: 'Làng nghề tạc đá dưới chân núi đã có vài trăm năm. Năm ngọn núi mang tên Kim, Mộc, Thuỷ, Hoả, Thổ.' },
      { id: 'bac_da', name: 'Bậc đá lên Thuỷ Sơn', fact: 'Thuỷ Sơn là ngọn lớn và đẹp nhất, có 156 bậc đá dẫn lên chùa Tam Thai.' },
      { id: 'tam_thai', name: 'Chùa Tam Thai', fact: 'Ngôi chùa cổ trên Thuỷ Sơn, được vua Minh Mạng cho trùng tu năm 1825.' },
      { id: 'huyen_khong', name: 'Động Huyền Không', fact: 'Hang lớn nhất ở Thuỷ Sơn; vòm hang có những lỗ thông thiên cho nắng rọi xuống thành luồng.' },
      { id: 'vong_hai', name: 'Vọng Hải Đài', fact: 'Đài ngắm biển trên núi: nhìn thấy bãi Non Nước, và ngày trời trong thấy cả Cù Lao Chàm.' },
      { id: 'loi_ra', name: 'Cổng xuống núi', fact: 'Đá cẩm thạch ở đây nay được bảo vệ, thợ làng nghề dùng đá chở từ nơi khác về. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'dn_ba_na', name: 'Bà Nà – Cầu Vàng', province: 'Đà Nẵng', lat: 15.995, lng: 107.997, kind: 'nui', emoji: '🚡',
    blurb: 'Đỉnh núi mát quanh năm ở độ cao gần 1.500 m, có cây cầu đặt trên hai bàn tay đá.', entryFee: 90_000,
    stops: [
      { id: 'ga_cap', name: 'Ga cáp treo chân núi', fact: 'Bà Nà cao khoảng 1.487 m so với mực nước biển. Người Pháp lập khu nghỉ mát ở đây từ đầu thế kỷ 20 để tránh nóng.' },
      { id: 'cabin', name: 'Trên cabin cáp treo', fact: 'Cáp treo vượt qua rừng nguyên sinh và thác nước; nhiệt độ trên đỉnh thấp hơn dưới chân núi chừng 8–10 độ.' },
      { id: 'cau_vang', name: 'Cầu Vàng', fact: 'Cầu đi bộ dài khoảng 150 m, khánh thành tháng 6 năm 2018, được đỡ bởi hai bàn tay khổng lồ phủ rêu.' },
      { id: 'vuon_hoa', name: 'Vườn hoa Le Jardin', fact: 'Trên đỉnh núi có thể gặp đủ bốn mùa trong một ngày: sáng xuân, trưa hạ, chiều thu, đêm đông.' },
      { id: 'lang_phap', name: 'Làng Pháp', fact: 'Khu phố dựng lại kiểu làng cổ nước Pháp với quảng trường, nhà thờ và lâu đài đá. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'dn_cau_rong', name: 'Cầu Rồng – sông Hàn', province: 'Đà Nẵng', lat: 16.061, lng: 108.227, kind: 'cau', emoji: '🐉',
    blurb: 'Dạo bờ sông Hàn, ngắm cây cầu hình rồng phun lửa, phun nước.', entryFee: 0,
    stops: [
      { id: 'bo_tay', name: 'Đường Bạch Đằng', fact: 'Sông Hàn chảy giữa lòng thành phố rồi đổ ra vịnh Đà Nẵng. Đà Nẵng được gọi là thành phố của những cây cầu.' },
      { id: 'cau_song_han', name: 'Cầu sông Hàn', fact: 'Cây cầu quay đầu tiên do kỹ sư Việt Nam thiết kế và thi công, khánh thành năm 2000; nhịp giữa quay ngang để tàu lớn đi qua.' },
      { id: 'dau_rong', name: 'Đầu rồng', fact: 'Cầu Rồng dài 666 m, khánh thành ngày 29 tháng 3 năm 2013. Rồng phun lửa rồi phun nước lúc 21 giờ tối thứ Bảy, Chủ nhật.' },
      { id: 'ca_chep', name: 'Tượng cá chép hoá rồng', fact: 'Tượng đá trắng bên bờ đông sông Hàn, gợi tích cá chép vượt vũ môn.' },
      { id: 'cau_tinh_yeu', name: 'Cầu tàu Tình yêu', fact: 'Cầu tàu treo đèn lồng hình trái tim, nơi nhìn rõ nhất cảnh rồng phun lửa. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'dn_son_tra', name: 'Bán đảo Sơn Trà', province: 'Đà Nẵng', lat: 16.1, lng: 108.278, kind: 'chua', emoji: '🐒',
    blurb: 'Lá phổi xanh nhô ra biển, có chùa Linh Ứng và loài voọc chà vá chân nâu.', entryFee: 0,
    stops: [
      { id: 'duong_ven_bien', name: 'Đường Hoàng Sa ven biển', fact: 'Bán đảo Sơn Trà chắn gió cho vịnh Đà Nẵng, rừng ở đây là khu bảo tồn thiên nhiên.' },
      { id: 'cong_chua', name: 'Cổng tam quan chùa Linh Ứng', fact: 'Chùa Linh Ứng Bãi Bụt tựa lưng vào núi, mặt nhìn ra biển Đông.' },
      { id: 'tuong_quan_am', name: 'Tượng Quan Thế Âm', fact: 'Tượng cao 67 m, đứng trên toà sen, bên trong có 17 tầng. Ngư dân coi tượng là điểm tựa khi ra khơi.' },
      { id: 'voc', name: 'Lối mòn ngắm voọc', fact: 'Voọc chà vá chân nâu được gọi là nữ hoàng linh trưởng vì bộ lông năm màu; Sơn Trà là nơi dễ gặp chúng nhất ở Việt Nam.' },
      { id: 'vong_canh', name: 'Điểm vọng cảnh', fact: 'Từ đây thấy trọn đường bờ biển Đà Nẵng cong về phía Ngũ Hành Sơn. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
  {
    id: 'dn_cu_lao_cham', name: 'Cù Lao Chàm', province: 'Đà Nẵng', formerProvince: 'Quảng Nam', lat: 15.955, lng: 108.51, kind: 'dao', emoji: '🏝️',
    blurb: 'Cụm đảo ngoài khơi Hội An, khu dự trữ sinh quyển thế giới, nơi nói không với túi ni lông.', entryFee: 14_000,
    stops: [
      { id: 'cau_cang', name: 'Cầu cảng Bãi Làng', fact: 'Cù Lao Chàm gồm 8 hòn đảo, lớn nhất là Hòn Lao. Năm 2009 UNESCO công nhận đây là khu dự trữ sinh quyển thế giới.' },
      { id: 'bang_tui', name: 'Bảng "Nói không với túi ni lông"', fact: 'Từ năm 2009 người dân đảo thôi dùng túi ni lông, đi chợ bằng giỏ và làn để giữ sạch biển.' },
      { id: 'gieng_co', name: 'Giếng cổ Chăm', fact: 'Giếng xây bằng gạch khoảng 200 năm tuổi theo kiểu của người Chăm, nước ngọt không cạn dù ở giữa biển.' },
      { id: 'chua_hai_tang', name: 'Chùa Hải Tạng', fact: 'Ngôi chùa dựng từ thế kỷ 18, nơi thương thuyền ghé cầu bình an trước khi vào cảng Hội An.' },
      { id: 'bai_chong', name: 'Bãi Chồng', fact: 'Bãi tắm có những tảng đá xếp chồng lên nhau. Vùng biển quanh đảo có rạn san hô được bảo vệ.' },
      { id: 'cho_dao', name: 'Chợ Tân Hiệp', fact: 'Chợ đảo bán hải sản khô, bánh ít lá gai và rau rừng. Lối ra dẫn sang siêu thị đặc sản.' },
    ],
  },
];

export function sight(id: string): Sight | undefined { return SIGHTS.find((s) => s.id === id); }
export function sightsOfProvince(province: string): Sight[] { return SIGHTS.filter((s) => s.province === province); }
/** Các tỉnh, thành đã dựng điểm tham quan. */
export const SIGHT_PROVINCES = [...new Set(SIGHTS.map((s) => s.province))];
