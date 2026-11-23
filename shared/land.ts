// Sổ địa chính của Vườn Việt: quỹ đất hữu hạn theo từng tỉnh, chia theo loại đất của Luật Đất đai 2024,
// giá theo bảng giá đất tỉnh, và quyền mua theo vai. Dùng chung cho máy chủ và giao diện.
//
// NGUỒN VÀ CÁCH ƯỚC TÍNH (ghi lại để rà khi có số liệu đầy đủ hơn):
// - Diện tích tự nhiên, dân số: Nghị quyết 202/2025/QH15 (34 tỉnh, thành từ 12/6/2025), số làm tròn theo bảng báo chí tổng hợp
//   (thuvienphapluat.vn, baophapluat.vn). Ví dụ: TP.HCM 6.772,59 km², Đà Nẵng 11.859,59 km², Lâm Đồng 24.233,07 km².
// - Tỉ lệ đất sản xuất nông nghiệp: ƯỚC TÍNH theo nhóm địa hình (kiểm kê đất đai toàn quốc: đất sản xuất nông nghiệp ~35% diện tích tự nhiên;
//   đồng bằng sông Cửu Long, đồng bằng sông Hồng cao hơn nhiều; miền núi phía Bắc thấp vì chủ yếu là rừng).
// - Diện tích khu, cụm công nghiệp: ƯỚC TÍNH làm tròn từ quy hoạch KCN các tỉnh trước sáp nhập cộng lại; cần rà theo quy hoạch tỉnh 2021–2030.
// - Đất thương mại – dịch vụ: ƯỚC TÍNH theo tỉ lệ đô thị hoá (đô thị lớn ~1,5% diện tích, tỉnh nông thôn 0,2–0,4%).
// - Giá đất: mức ĐẠI DIỆN (vị trí trung bình, không phải mặt đường đắt nhất) theo bảng giá đất tỉnh áp dụng từ 1/1/2026, chia 4 nhóm.
//   Mốc đối chiếu: Hà Nội giá cao nhất 702 triệu/m² (VT1 khu vực 1), ngoại thành khu vực 13 tối đa ~17,8 triệu/m² (dulieuphapluat.vn);
//   TP.HCM khu vực III tối đa gần 75 triệu/m², thấp nhất 0,44–1,9 triệu/m² (thuvienphapluat.vn). Đây là giá nhà nước, thấp hơn giá thị trường.
// - Thuế phí sang tên: shared/realPrices.ts (lệ phí trước bạ 0,5%, thuế TNCN 2%).

import { PROVINCES } from './catalog.ts';
import { registrationFee, transferTax } from './realPrices.ts';
import type { Role } from './rules.ts';

export type LandUse = 'nong_nghiep' | 'thuong_mai' | 'cong_nghiep' | 'o';
export interface LandUseInfo {
  name: string; short: string; emoji: string; code: string;
  /** Diện tích một thửa trong game (m²). */
  lotM2: number;
  /** Một thửa game ứng với bấy nhiêu ha đất quy hoạch thật (quỹ đợt 1 = đất thật / tỉ lệ này). */
  haPerLot: number;
  roles: Role[]; minLevel: number; open: boolean; note: string;
}
export const LAND_USES: Record<LandUse, LandUseInfo> = {
  nong_nghiep: { name: 'Đất nông nghiệp (trồng cây hằng năm, lâu năm)', short: 'Nông nghiệp', emoji: '🌾', code: 'NN', lotM2: 2_500, haPerLot: 200,
    roles: ['nong_dan'], minLevel: 5, open: true, note: 'Một thửa = một khối cánh đồng 100 ô. Chỉ nhà nông được nhận chuyển nhượng đất trồng lúa (giữ đúng tinh thần luật đất đai).' },
  thuong_mai: { name: 'Đất thương mại, dịch vụ', short: 'Thương mại', emoji: '🏪', code: 'TMD', lotM2: 100, haPerLot: 20,
    roles: ['thuong_lai', 'xuong', 'nong_dan'], minLevel: 8, open: true, note: 'Dựng cửa hàng đặc sản (1 thửa) hoặc siêu thị (4 thửa liền).' },
  cong_nghiep: { name: 'Đất khu, cụm công nghiệp', short: 'Công nghiệp', emoji: '🏭', code: 'SKK', lotM2: 1_000, haPerLot: 50,
    roles: ['xuong'], minLevel: 12, open: true, note: 'Dựng xưởng chi nhánh. Thuê lại trong khu công nghiệp nên chỉ chủ xưởng mua được.' },
  o: { name: 'Đất ở', short: 'Đất ở', emoji: '🏠', code: 'ODT', lotM2: 100, haPerLot: 50,
    roles: ['nong_dan', 'xuong', 'thuong_lai'], minLevel: 3, open: false, note: 'Nhà ở thứ hai, homestay: mở ở bản sau.' },
};
export const LAND_USE_ORDER: LandUse[] = ['nong_nghiep', 'thuong_mai', 'cong_nghiep', 'o'];

/** Nhóm giá: 1 = Hà Nội, TP.HCM; 2 = thành phố trực thuộc trung ương khác và tỉnh công nghiệp/du lịch lớn; 3 = đồng bằng, ven biển, Tây Nguyên; 4 = miền núi phía Bắc. */
export type PriceTier = 1 | 2 | 3 | 4;
/** Giá đại diện (đồng/m²) theo nhóm và loại đất. */
export const TIER_PRICE_M2: Record<PriceTier, Record<LandUse, number>> = {
  1: { o: 60_000_000, thuong_mai: 30_000_000, cong_nghiep: 3_500_000, nong_nghiep: 250_000 },
  2: { o: 18_000_000, thuong_mai: 10_000_000, cong_nghiep: 1_800_000, nong_nghiep: 120_000 },
  3: { o: 5_000_000, thuong_mai: 3_000_000, cong_nghiep: 800_000, nong_nghiep: 70_000 },
  4: { o: 2_000_000, thuong_mai: 1_200_000, cong_nghiep: 400_000, nong_nghiep: 40_000 },
};

export interface ProvinceLand {
  /** km² (NQ 202/2025/QH15, làm tròn). */ area: number;
  /** Dân số, triệu người (làm tròn). */ pop: number;
  tier: PriceTier;
  /** Phần diện tích là đất sản xuất nông nghiệp (ước tính theo nhóm). */ agri: number;
  /** Ha khu, cụm công nghiệp theo quy hoạch (ước tính). */ kcnHa: number;
  /** Phần diện tích là đất thương mại, dịch vụ (ước tính). */ tmd: number;
  /** Mã ngắn in trên sổ. */ code: string;
}
const P = (area: number, pop: number, tier: PriceTier, agri: number, kcnHa: number, tmd: number, code: string): ProvinceLand => ({ area, pop, tier, agri, kcnHa, tmd, code });
export const PROVINCE_LAND: Record<string, ProvinceLand> = {
  'Hà Nội': P(3_360, 8.7, 1, 0.45, 9_000, 0.015, 'HN'),
  'TP. Hồ Chí Minh': P(6_773, 14.0, 1, 0.30, 26_000, 0.015, 'HCM'),
  'Đà Nẵng': P(11_860, 3.07, 2, 0.15, 6_000, 0.006, 'DN'),
  'Hải Phòng': P(3_195, 4.7, 2, 0.40, 15_000, 0.010, 'HP'),
  'Cần Thơ': P(6_361, 4.2, 2, 0.75, 4_500, 0.006, 'CT'),
  'Huế': P(4_947, 1.4, 2, 0.15, 3_500, 0.005, 'HUE'),
  'Quảng Ninh': P(6_208, 1.4, 2, 0.12, 8_000, 0.006, 'QNI'),
  'Bắc Ninh': P(4_719, 3.6, 2, 0.45, 15_000, 0.008, 'BN'),
  'Khánh Hòa': P(8_556, 2.2, 2, 0.25, 4_000, 0.006, 'KH'),
  'Đồng Nai': P(12_737, 4.5, 2, 0.45, 15_000, 0.005, 'DNA'),
  'Lai Châu': P(9_069, 0.5, 4, 0.10, 300, 0.001, 'LCH'),
  'Điện Biên': P(9_540, 0.65, 4, 0.12, 300, 0.001, 'DB'),
  'Sơn La': P(14_110, 1.4, 4, 0.20, 600, 0.001, 'SL'),
  'Lạng Sơn': P(8_310, 0.8, 4, 0.12, 1_500, 0.002, 'LS'),
  'Cao Bằng': P(6_700, 0.57, 4, 0.12, 300, 0.001, 'CB'),
  'Tuyên Quang': P(13_796, 1.86, 4, 0.15, 1_200, 0.001, 'TQ'),
  'Lào Cai': P(13_257, 1.78, 4, 0.15, 2_000, 0.002, 'LCA'),
  'Thái Nguyên': P(8_375, 1.8, 3, 0.25, 5_000, 0.003, 'TN'),
  'Phú Thọ': P(9_361, 4.0, 3, 0.30, 8_000, 0.003, 'PT'),
  'Hưng Yên': P(2_515, 3.6, 3, 0.60, 8_000, 0.004, 'HY'),
  'Ninh Bình': P(3_943, 4.4, 3, 0.50, 5_000, 0.004, 'NB'),
  'Thanh Hóa': P(11_115, 4.3, 3, 0.25, 6_000, 0.003, 'TH'),
  'Nghệ An': P(16_487, 3.8, 3, 0.18, 5_000, 0.002, 'NA'),
  'Hà Tĩnh': P(5_994, 1.6, 3, 0.25, 4_000, 0.002, 'HT'),
  'Quảng Trị': P(12_700, 1.9, 3, 0.18, 2_500, 0.002, 'QT'),
  'Quảng Ngãi': P(14_833, 2.2, 3, 0.20, 4_000, 0.002, 'QNG'),
  'Gia Lai': P(21_577, 3.6, 3, 0.35, 3_000, 0.002, 'GL'),
  'Đắk Lắk': P(18_096, 3.35, 3, 0.40, 2_000, 0.002, 'DL'),
  'Lâm Đồng': P(24_233, 3.87, 3, 0.30, 3_000, 0.002, 'LD'),
  'Tây Ninh': P(8_537, 3.25, 3, 0.60, 12_000, 0.003, 'TNI'),
  'Vĩnh Long': P(6_296, 4.26, 3, 0.70, 2_500, 0.003, 'VL'),
  'Đồng Tháp': P(5_939, 4.37, 3, 0.75, 2_000, 0.003, 'DT'),
  'An Giang': P(9_889, 4.95, 3, 0.70, 2_500, 0.003, 'AG'),
  'Cà Mau': P(7_942, 2.6, 3, 0.70, 1_500, 0.002, 'CM'),
};
export const landOf = (province: string): ProvinceLand | undefined => PROVINCE_LAND[province];

/** Ha đất thật theo quy hoạch của một loại trong tỉnh. */
export function realHa(province: string, use: LandUse): number {
  const p = PROVINCE_LAND[province];
  if (!p) return 0;
  const ha = p.area * 100;
  switch (use) {
    case 'nong_nghiep': return Math.round(ha * p.agri);
    case 'cong_nghiep': return p.kcnHa;
    case 'thuong_mai': return Math.round(ha * p.tmd);
    case 'o': return Math.round(ha * p.tmd * 2.5);
  }
}
/** Quỹ đất đợt 1 máy chủ mở bán (số thửa game). Tối thiểu 10 để tỉnh nhỏ vẫn có đất. */
export function releasedLots(province: string, use: LandUse): number {
  return Math.max(10, Math.round(realHa(province, use) / LAND_USES[use].haPerLot));
}
/** Giá đất đại diện (đ/m²): theo nhóm, đất thương mại nơi đông dân đắt hơn một chút. */
export function landPriceM2(province: string, use: LandUse): number {
  const p = PROVINCE_LAND[province];
  if (!p) return 0;
  const base = TIER_PRICE_M2[p.tier][use];
  const crowd = use === 'thuong_mai' || use === 'o' ? Math.min(1.3, Math.max(0.85, Math.sqrt(p.pop / 3))) : 1;
  const step = base >= 1_000_000 ? 100_000 : 1_000;
  return Math.round((base * crowd) / step) * step;
}
/** Giá một thửa (chưa gồm lệ phí trước bạ). */
export const lotPrice = (province: string, use: LandUse): number => Math.round((landPriceM2(province, use) * LAND_USES[use].lotM2) / 1_000_000) * 1_000_000;

/** Người mua nộp: giá + lệ phí trước bạ + phí cấp sổ. */
export const CERT_FEE = 500_000;
export function buyCost(price: number): { price: number; registration: number; certFee: number; total: number } {
  const registration = registrationFee(price);
  return { price, registration, certFee: CERT_FEE, total: price + registration + CERT_FEE };
}
/** Người bán nhận: giá − thuế TNCN 2%. */
export function sellerNet(price: number): { price: number; tax: number; net: number } {
  const tax = transferTax(price);
  return { price, tax, net: price - tax };
}
/** Giá rao bán lại phải trong khoảng này so với giá nhà nước (chống rửa tiền giữa các tài khoản). */
export const RESALE_MIN = 0.7, RESALE_MAX = 3;

/** Số sổ: VV-<mã tỉnh>-<mã loại đất>-<số thửa 6 chữ số>. */
export function certNo(province: string, use: LandUse, id: number): string {
  return `VV-${PROVINCE_LAND[province]?.code ?? 'XX'}-${LAND_USES[use].code}-${String(id).padStart(6, '0')}`;
}

export function canBuyLand(use: LandUse, role: Role | null, level: number): string | null {
  const u = LAND_USES[use];
  if (!u.open) return `${u.short}: chưa mở bán.`;
  if (!role) return 'Hãy nhận vai trò trước.';
  if (!u.roles.includes(role)) return use === 'nong_nghiep' ? 'Chỉ nhà nông được nhận đất nông nghiệp.' : use === 'cong_nghiep' ? 'Chỉ chủ xưởng thuê được đất khu công nghiệp.' : 'Vai này không mua được loại đất này.';
  if (level < u.minLevel) return `Cần đạt cấp ${u.minLevel}.`;
  return null;
}

// ---------------------------------------------------------------- công trình trên đất
export type BuildingKind = 'cua_hang' | 'sieu_thi' | 'xuong';
export interface BuildingInfo {
  name: string; emoji: string; use: LandUse; lots: number; build: number; permit: number; buildHours: number;
  roles: Role[]; minLevel: number; farmerLevel?: number; max: number;
  /** Sức bán so với siêu thị (siêu thị = 1). */ sales: number; shelves: number; note: string;
}
/**
 * Vì sao chia như vậy (cân bằng vai):
 * - Cửa hàng đặc sản (1 thửa thương mại, cấp 8): thương lái có chỗ bán lẻ hàng mình chở về; chủ xưởng bán thành phẩm. Rẻ, hoàn vốn ~ như một khối cánh đồng.
 * - Siêu thị (4 thửa, cấp 20, nhà nông cấp 25): công trình lớn, vốn hàng tỉ ở thành phố; hoàn vốn ngang xưởng chi nhánh và cánh đồng lớn.
 * - Xưởng chi nhánh (1 thửa khu công nghiệp, cấp 12, chỉ chủ xưởng): thêm 4 chỗ đặt máy ở tỉnh rẻ, gần vùng nguyên liệu.
 * Mỗi vai có một khoản đầu tư đất riêng: nhà nông → đất nông nghiệp; chủ xưởng → đất công nghiệp; thương lái → đất thương mại.
 */
export const BUILDINGS: Record<BuildingKind, BuildingInfo> = {
  cua_hang: { name: 'Cửa hàng đặc sản', emoji: '🏪', use: 'thuong_mai', lots: 1, build: 120_000_000, permit: 5_000_000, buildHours: 3,
    roles: ['thuong_lai', 'xuong', 'nong_dan'], minLevel: 8, farmerLevel: 12, max: 4, sales: 0.3, shelves: 4,
    note: 'Kiốt mặt tiền 100 m²: bày 4 lô hàng, khách vãng lai và khách du lịch mua lẻ.' },
  sieu_thi: { name: 'Siêu thị đặc sản', emoji: '🏬', use: 'thuong_mai', lots: 4, build: 1_000_000_000, permit: 30_000_000, buildHours: 8,
    roles: ['thuong_lai', 'xuong', 'nong_dan'], minLevel: 20, farmerLevel: 25, max: 2, sales: 1, shelves: 12,
    note: 'Mặt bằng 400 m²: bán hàng của bạn và nhận ký gửi của người chơi khác (thu phí).' },
  xuong: { name: 'Xưởng chi nhánh', emoji: '🏭', use: 'cong_nghiep', lots: 1, build: 900_000_000, permit: 20_000_000, buildHours: 6,
    roles: ['xuong'], minLevel: 12, max: 2, sales: 0, shelves: 0,
    note: 'Nhà xưởng 1.000 m² trong khu công nghiệp: thêm 4 chỗ đặt máy ở tỉnh khác.' },
};
export function canBuild(kind: BuildingKind, role: Role | null, level: number): string | null {
  const b = BUILDINGS[kind];
  if (!role) return 'Hãy nhận vai trò trước.';
  if (!b.roles.includes(role)) return kind === 'xuong' ? 'Chỉ chủ xưởng mới mở xưởng chi nhánh.' : 'Vai này không mở được công trình này.';
  const need = role === 'nong_dan' && b.farmerLevel ? b.farmerLevel : b.minLevel;
  if (level < need) return `Cần đạt cấp ${need} mới mở ${b.name.toLowerCase()}.`;
  return null;
}
/** Tổng chi phí dựng công trình ở một tỉnh, khi phải mua thêm `needLots` thửa. */
export function buildingCost(kind: BuildingKind, province: string, needLots = BUILDINGS[kind].lots) {
  const b = BUILDINGS[kind], lp = lotPrice(province, b.use);
  const land = buyCost(lp * needLots);
  return { lotPrice: lp, needLots, land: land.price, registration: land.registration, certFee: needLots ? CERT_FEE * needLots : 0, build: b.build, permit: b.permit,
    total: land.price + land.registration + (needLots ? CERT_FEE * needLots : 0) + b.build + b.permit };
}
/** Khách mua mỗi giờ quy ra kg: theo dân số và nhóm giá (đất đắt = phố đông khách) và số điểm du lịch. */
export function shopTraffic(province: string, sights = 0): number {
  const p = PROVINCE_LAND[province];
  if (!p) return 1;
  const tierMult = { 1: 2.4, 2: 1.4, 3: 1, 4: 0.7 }[p.tier];
  return Math.round(Math.sqrt(p.pop / 3) * tierMult * (1 + 0.08 * sights) * 100) / 100;
}

/** Bảng tóm tắt một tỉnh: mỗi loại đất còn bao nhiêu thửa, giá, tổng giá trị. `sold` là số thửa đã cấp sổ. */
export function provinceLandSummary(province: string, sold: Partial<Record<LandUse, number>> = {}) {
  return LAND_USE_ORDER.map((use) => {
    const released = releasedLots(province, use), s = sold[use] ?? 0, left = Math.max(0, released - s), price = lotPrice(province, use);
    return { use, ...LAND_USES[use], realHa: realHa(province, use), released, sold: s, left, priceM2: landPriceM2(province, use), lotPrice: price, leftValue: left * price };
  });
}
export const LAND_PROVINCES: readonly string[] = PROVINCES;
