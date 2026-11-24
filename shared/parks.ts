// Khu vui chơi toàn quốc: chuỗi "Moon World" và "Bim Wonder" (tên trong game). Kiến trúc, trò chơi, tên trò do Vườn Việt tự đặt;
// không dùng logo, khẩu hiệu, linh vật hay tên công trình riêng của các khu vui chơi có thật.
// Mỗi khu cũng là một điểm tham quan (shared/sights.ts, kind 'khu_vui_choi'): đi tới bằng taxi/tàu như mọi địa danh,
// điểm dừng là các trò chơi; vé cổng, lượt chơi, xu trò chơi, quà do máy chủ (server/src/parks.ts) giữ.
//
// Giá vé tham chiếu giá niêm yết của khu vui chơi thật cùng loại (tra ngày 24/11/2026):
//  - Khu đảo trọn gói cả ngày: 1.050.000đ người lớn — bảng giá VinWonders Nha Trang, https://vinwonders.com/vi/wonderpedia/news/bang-gia-ve-vinwonders-nha-trang/
//  - Cáp treo vượt vịnh 380.000đ, công viên nước 350.000đ, combo ba khu 600.000đ — bảng giá Sun World Hạ Long do trang
//    sunparadiseland.com tổng hợp: https://sunparadiseland.com/SunParadiseLandQuangNinh/tin-tuc/bang-gia-sun-world-ha-long-moi-ban-nen-biet-truoc-chuyen-di-20539
//  - Khu trên núi có cáp treo: 650.000–1.300.000đ tuỳ loại vé — https://sunparadiseland.com/SunParadiseLandDaNang/tin-tuc/gia-ve-sun-world-ba-na-hills-dip-tet-bao-nhieu-cap-nhat-moi-2026-16237
//
// KHÔNG có cờ bạc. Bộ luật Hình sự Điều 321 (đánh bạc), 322 (tổ chức đánh bạc); Nghị định 06/2017/NĐ-CP chỉ cho người nước ngoài
// vào casino được cấp phép; Nghị định 147/2024/NĐ-CP: trò chơi điện tử trên mạng không được mô phỏng trò chơi casino, dùng hình lá bài,
// có hành vi đánh bạc, và vật phẩm/đơn vị ảo không được quy đổi ngược ra tiền. Vì vậy khu trò chơi chỉ có trò kỹ năng:
// kết quả do thao tác của người chơi quyết định (không có phần ngẫu nhiên), xu mua giá cố định, vé thưởng chỉ đổi lấy quà trang trí,
// quà không bán, không cho, không đổi ra tiền.

export type ParkChain = 'moon_world' | 'bim_wonder';
export type ParkZone = 'kho' | 'nuoc' | 'cap_treo';
export type RideKind = 'du_quay' | 'tau_luon' | 'thap_roi' | 'nha_ma' | 'xe_dung' | 'mang_truot' | 'ho_song' | 'song_luoi' | 'cap_treo';

export interface ParkRide {
  id: string; name: string; kind: RideKind; zone: ParkZone; emoji: string;
  /** Thể lực mỗi lượt chơi (ngoài phần đi bộ). */
  energy: number;
  /** Điểm kinh nghiệm mỗi lượt; lượt đầu tiên trong ngày được cộng đủ, các lượt sau một nửa. */
  xp: number;
  /** Độ dài hoạt cảnh (giây). */
  seconds: number;
  /** Mô tả ngắn hiện trên thẻ trò chơi. */
  blurb: string;
  /** Chiều cao tối thiểu thật thường áp cho trò này (chỉ để hiển thị cho giống thật). */
  minHeight?: string;
}
export interface ParkTicket { id: string; name: string; price: number; zones: ParkZone[]; note?: string }
export interface Park {
  id: string; chain: ParkChain; name: string; sightId: string; province: string;
  tickets: ParkTicket[];
  rides: ParkRide[];
  /** Có khu trò chơi kỹ năng (đổi quà). */
  arcade: boolean;
  /** Bảng màu chủ đạo của chuỗi (dựng cảnh). */
  palette: { main: number; accent: number; roof: number };
}

export const CHAIN_NAMES: Record<ParkChain, string> = { moon_world: 'Moon World', bim_wonder: 'Bim Wonder' };
export const ZONE_NAMES: Record<ParkZone, string> = { kho: 'Công viên khô', nuoc: 'Công viên nước', cap_treo: 'Cáp treo' };
/** Vé dùng được trong chừng này thời gian thật kể từ lúc mua (một buổi chơi). */
export const PASS_HOURS = 8;

const R = (id: string, name: string, kind: RideKind, zone: ParkZone, emoji: string, energy: number, xp: number, seconds: number, blurb: string, minHeight?: string): ParkRide =>
  ({ id, name, kind, zone, emoji, energy, xp, seconds, blurb, minHeight });

export const PARKS: Park[] = [
  {
    id: 'park_mw_da_nang', chain: 'moon_world', name: 'Moon World Đà Nẵng', sightId: 'park_mw_da_nang', province: 'Đà Nẵng', arcade: true,
    palette: { main: 0x3b5fd9, accent: 0xffc93c, roof: 0x2a3f99 },
    tickets: [
      { id: 'tron_goi', name: 'Vé trọn gói (cáp treo + khu khô + khu nước)', price: 900_000, zones: ['cap_treo', 'kho', 'nuoc'], note: 'Tham chiếu khu vui chơi trên núi có cáp treo 650.000–1.300.000đ.' },
      { id: 'cap_treo', name: 'Vé cáp treo lên đỉnh', price: 450_000, zones: ['cap_treo'] },
    ],
    rides: [
      R('cap_treo_doi', 'Cáp treo Đồi Trăng', 'cap_treo', 'cap_treo', '🚡', 4, 25, 16, 'Cabin tám chỗ lướt qua rừng thông lên đỉnh đồi, nhìn xuống cả thành phố và sông Hàn.'),
      R('vong_quay_trang', 'Vòng quay Trăng Rằm', 'du_quay', 'kho', '🎡', 3, 20, 16, 'Vòng quay cao 60 m, cabin kính nhìn thấy biển và bán đảo phía xa.'),
      R('tau_luon_sao_bang', 'Tàu lượn Sao Băng', 'tau_luon', 'kho', '🎢', 8, 40, 14, 'Ray thép lượn vòng tròn, hai cú lao dốc gần thẳng đứng.', 'từ 1,3 m'),
      R('thap_roi_mat_troi', 'Tháp rơi Thiên Thạch', 'thap_roi', 'kho', '🗼', 7, 35, 12, 'Ghế kéo lên 50 m, dừng ba giây rồi rơi tự do.', 'từ 1,4 m'),
      R('lau_dai_bong_dem', 'Lâu đài Bóng Đêm', 'nha_ma', 'kho', '👻', 4, 25, 16, 'Đi xe goòng qua dãy hành lang tối, đèn lồng chập chờn và tiếng cửa kẽo kẹt.'),
      R('xe_dung_ngan_ha', 'Xe điện đụng Ngân Hà', 'xe_dung', 'kho', '🚗', 3, 15, 14, 'Sàn đụng có mái che, xe chạy điện lưới trần.'),
      R('mang_truot_xoay', 'Máng trượt Lốc Xoáy', 'mang_truot', 'nuoc', '🌀', 6, 30, 12, 'Ống trượt kín xoắn ba vòng rồi đổ xuống hồ.', 'từ 1,2 m'),
      R('ho_song_bac', 'Hồ tạo sóng Biển Bạc', 'ho_song', 'nuoc', '🌊', 3, 15, 14, 'Hồ rộng như bãi biển, cứ mười phút lại nổi sóng một đợt.'),
    ],
  },
  {
    id: 'park_bw_nha_trang', chain: 'bim_wonder', name: 'Bim Wonder Nha Trang', sightId: 'park_bw_nha_trang', province: 'Khánh Hòa', arcade: true,
    palette: { main: 0xe04a7a, accent: 0x2ec4b6, roof: 0x9c2a55 },
    tickets: [
      { id: 'tron_goi', name: 'Vé trọn gói cả ngày (khu khô + khu nước)', price: 1_050_000, zones: ['kho', 'nuoc'], note: 'Theo giá vé khu vui chơi trên đảo cùng loại: 1.050.000đ người lớn.' },
      { id: 'buoi_chieu', name: 'Vé buổi chiều (sau 16 giờ)', price: 700_000, zones: ['kho', 'nuoc'] },
    ],
    rides: [
      R('du_quay_bien', 'Đu quay Mắt Biển', 'du_quay', 'kho', '🎡', 3, 20, 16, 'Vòng quay ven biển, cabin lên cao thấy vịnh và các đảo nhỏ.'),
      R('tau_luon_ca_heo', 'Tàu lượn Cá Heo', 'tau_luon', 'kho', '🎢', 8, 40, 14, 'Tàu lượn treo ngược, chân lơ lửng khi qua các vòng xoắn.', 'từ 1,3 m'),
      R('thap_roi_hai_dang', 'Tháp rơi Hải Đăng', 'thap_roi', 'kho', '🗼', 7, 35, 12, 'Tháp sơn sọc như ngọn hải đăng, rơi nhanh rồi phanh bằng từ.', 'từ 1,4 m'),
      R('nha_ma_tau_dam', 'Con tàu Ma', 'nha_ma', 'kho', '👻', 4, 25, 16, 'Lạc trong con tàu cổ mắc cạn, cột buồm rách và tiếng sóng vỗ.'),
      R('xe_dung_san_ho', 'Xe đụng San Hô', 'xe_dung', 'kho', '🚗', 3, 15, 14, 'Sàn đụng vẽ rạn san hô, xe hình cá nóc.'),
      R('mang_truot_thac', 'Máng trượt Thác Đổ', 'mang_truot', 'nuoc', '🌀', 6, 30, 12, 'Sáu làn trượt song song từ tháp cao 18 m, ai về trước thắng.'),
      R('ho_song_vinh', 'Hồ sóng Vịnh Xanh', 'ho_song', 'nuoc', '🌊', 3, 15, 14, 'Hồ tạo sóng lớn ven biển, có phao tròn cho thuê.'),
      R('song_luoi_dao', 'Sông lười Quanh Đảo', 'song_luoi', 'nuoc', '🛟', 2, 10, 16, 'Thả phao trôi chậm quanh đảo nhân tạo, qua hang đá và màn nước.'),
    ],
  },
  {
    id: 'park_mw_ha_long', chain: 'moon_world', name: 'Moon World Hạ Long', sightId: 'park_mw_ha_long', province: 'Quảng Ninh', arcade: true,
    palette: { main: 0x3b5fd9, accent: 0xff7a3c, roof: 0x2a3f99 },
    tickets: [
      { id: 'tron_goi', name: 'Combo ba khu (cáp treo + khu khô + khu nước)', price: 600_000, zones: ['cap_treo', 'kho', 'nuoc'], note: 'Tham chiếu combo ba công viên 600.000đ.' },
      { id: 'cap_treo', name: 'Vé cáp treo vượt vịnh', price: 380_000, zones: ['cap_treo'] },
      { id: 'nuoc', name: 'Vé công viên nước', price: 350_000, zones: ['nuoc'] },
    ],
    rides: [
      R('cap_treo_vinh', 'Cáp treo Vượt Vịnh', 'cap_treo', 'cap_treo', '🚡', 4, 25, 16, 'Cabin hai tầng băng qua cửa vịnh, nhìn thấy hàng nghìn hòn đảo đá vôi.'),
      R('vong_quay_vinh', 'Vòng quay Ngắm Vịnh', 'du_quay', 'kho', '🎡', 3, 20, 16, 'Vòng quay trên đỉnh đồi, buổi tối thắp đèn nhiều màu.'),
      R('tau_luon_rong_bay', 'Tàu lượn Cánh Diều', 'tau_luon', 'kho', '🎢', 8, 40, 14, 'Tàu lượn gỗ rung lắc kiểu cổ điển, chạy men sườn đồi.', 'từ 1,3 m'),
      R('nha_ma_hang', 'Hang Ma', 'nha_ma', 'kho', '👻', 4, 25, 16, 'Đi bộ trong hang đá giả, nhũ đá phát sáng và bóng người thấp thoáng.'),
      R('xe_dung_hai_au', 'Xe đụng Hải Âu', 'xe_dung', 'kho', '🚗', 3, 15, 14, 'Sàn đụng nhỏ cho cả nhà.'),
      R('mang_truot_ong', 'Máng trượt Ống Xoắn', 'mang_truot', 'nuoc', '🌀', 6, 30, 12, 'Ống trượt màu xoắn ốc từ tháp gỗ.', 'từ 1,2 m'),
      R('song_luoi_vinh', 'Sông lười Bến Thuyền', 'song_luoi', 'nuoc', '🛟', 2, 10, 16, 'Thả phao trôi qua những chiếc thuyền buồm nâu dựng làm cảnh.'),
    ],
  },
];

export function park(id: string): Park | undefined { return PARKS.find((p) => p.id === id); }
export function parkOfSight(sightId: string): Park | undefined { return PARKS.find((p) => p.sightId === sightId); }

// ---------------------------------------------------------------------------- khu trò chơi kỹ năng
/** Giá một xu trò chơi (đồng). Ước tính: một lượt máy trò chơi ở khu vui chơi trong nhà thường vài chục nghìn đồng; chưa có nguồn niêm yết chính thức. */
export const TOKEN_PRICE = 10_000;
export const TOKEN_MAX_BUY = 50;
export type ArcadeGameId = 'nem_vong' | 'bong_ro' | 'gap_thu';
export interface ArcadeGame {
  id: ArcadeGameId; name: string; emoji: string; tokens: number;
  /** Điểm tối đa một lượt (máy chủ cắt nếu gửi lớn hơn). */
  maxScore: number;
  /** Một lượt chơi thật không thể xong nhanh hơn chừng này (ms) — chặn gửi điểm ngay sau khi bắt đầu. */
  minMs: number;
  /** Số lượt ném/bắn trong một ván. */
  shots: number;
  how: string;
}
export const ARCADE_GAMES: Record<ArcadeGameId, ArcadeGame> = {
  nem_vong: { id: 'nem_vong', name: 'Ném vòng cổ chai', emoji: '⭕', tokens: 1, maxScore: 100, minMs: 4_000, shots: 5, how: 'Vạch sáng chạy qua lại, chạm đúng lúc vạch nằm trong vùng xanh để vòng lọt cổ chai. Càng giữa vùng càng nhiều điểm.' },
  bong_ro: { id: 'bong_ro', name: 'Ném bóng rổ', emoji: '🏀', tokens: 1, maxScore: 100, minMs: 4_000, shots: 5, how: 'Thanh lực lên xuống liên tục, thả tay đúng vùng vàng để bóng vào rổ.' },
  gap_thu: { id: 'gap_thu', name: 'Gắp thú bông', emoji: '🧸', tokens: 2, maxScore: 100, minMs: 3_000, shots: 1, how: 'Càng gắp chạy ngang qua thùng; chạm để thả càng. Thả trúng ngay trên con thú là gắp được — không có tỉ lệ may rủi.' },
};
/** Vé thưởng nhận được theo điểm (không có phần ngẫu nhiên). */
export function arcadeTickets(game: ArcadeGameId, score: number): number {
  const g = ARCADE_GAMES[game], s = Math.max(0, Math.min(g.maxScore, Math.round(score)));
  return Math.floor(s / 10) * g.tokens * 2 + (s >= g.maxScore ? 5 * g.tokens : 0);
}
export interface ParkPrize { id: string; name: string; emoji: string; tickets: number }
/** Quà đổi bằng vé thưởng: chỉ để trưng bày, không bán, không tặng, không quy đổi ra tiền. */
export const PARK_PRIZES: ParkPrize[] = [
  { id: 'bong_bay', name: 'Bóng bay hình trăng', emoji: '🎈', tickets: 20 },
  { id: 'mu_tai_tho', name: 'Băng đô tai thỏ', emoji: '🐰', tickets: 40 },
  { id: 'kinh_sao', name: 'Kính râm ngôi sao', emoji: '🕶️', tickets: 60 },
  { id: 'gau_bong', name: 'Gấu bông nhỏ', emoji: '🧸', tickets: 90 },
  { id: 'ca_heo_bong', name: 'Cá heo nhồi bông', emoji: '🐬', tickets: 140 },
  { id: 'cup_vang', name: 'Cúp vô địch khu trò chơi', emoji: '🏆', tickets: 250 },
];
export function prize(id: string): ParkPrize | undefined { return PARK_PRIZES.find((p) => p.id === id); }
