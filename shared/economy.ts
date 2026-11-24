// Kinh tế dùng chung: lô xuất khẩu nhiều mặt hàng, sức mua của thị trường nước ngoài, đơn hàng nội địa theo cấp,
// công ty xuất nhập khẩu (NPC) và tài sản thương mại (siêu thị, xưởng chi nhánh) ở tỉnh khác.
// Các con số được cân bằng bằng tools/econ-sim.mjs — sửa ở đây thì chạy lại mô phỏng.
import { CROPS, PROVINCES, REGIONS, SPECIALTIES, recipeOf, specialtiesOfRegion } from './catalog.ts';
import { BUILDINGS, buildingCost, shopTraffic } from './land.ts';
import type { BuildingKind } from './land.ts';
import { EXPORT_GATEWAYS, EXPORT_INLAND_PER_KG_KM, EXPORT_LCL_BASE_RATIO, EXPORT_LCL_PER_KG_MULT, EXPORT_MARKETS, EXPORT_MODES, EXPORT_PROCESSED_SPOIL, QUALITY_MULT, haversineKm } from './rules.ts';
import type { ExportMarket, ExportMode, Quality, Role } from './rules.ts';
import { SIGHTS } from './sights.ts';

/** Bộ sinh số tất định theo chuỗi hạt giống (giống máy chủ), để danh sách theo ngày luôn như nhau cho mọi người. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const VN_TZ_MS = 7 * 3600_000, DAY_MS = 86_400_000;
/** Ngày theo giờ Việt Nam (số ngày kể từ 1970). */
export const econDay = (now: number) => Math.floor((now + VN_TZ_MS) / DAY_MS);

// ---------------------------------------------------------------- thị trường xuất khẩu: sức mua có hạn, giá lên xuống theo ngày
/** Mỗi thị trường mua dễ một lượng mỗi đặc sản mỗi ngày; xả nhiều hơn thì giá rớt dần (tối đa 35% ở mức bão hoà). */
export const EXPORT_DEMAND_EASY_KG = 4_000, EXPORT_DEMAND_FULL_KG = 40_000, EXPORT_DEMAND_MAX_DROP = 0.35;
function demandAt(kg: number): number {
  if (kg <= EXPORT_DEMAND_EASY_KG) return 1;
  const t = Math.min(1, (kg - EXPORT_DEMAND_EASY_KG) / (EXPORT_DEMAND_FULL_KG - EXPORT_DEMAND_EASY_KG));
  return 1 - EXPORT_DEMAND_MAX_DROP * t;
}
/** Hệ số giá trung bình khi bán thêm `kg` vào một thị trường đã nhận `soldKg` trong 24 giờ (trung bình theo từng tấn). */
export function exportDemandFactor(soldKg: number, kg: number): number {
  if (kg <= 0) return demandAt(soldKg);
  const steps = Math.max(1, Math.min(40, Math.ceil(kg / 1000)));
  let s = 0;
  for (let i = 0; i < steps; i++) s += demandAt(soldKg + (kg * (i + 0.5)) / steps);
  return s / steps;
}
/** Giá thế giới dao động ±8% theo ngày, mỗi thị trường và mỗi đặc sản một kiểu (tất định để mọi người thấy như nhau). */
export const EXPORT_TREND_SPAN = 0.08;
export function exportTrend(market: ExportMarket, specialtyId: string, day: number): number {
  const r = seededRandom(`xk:${market}:${specialtyId}:${day}`);
  r();
  return Math.round((1 + (r() * 2 - 1) * EXPORT_TREND_SPAN) * 1000) / 1000;
}

const DRY_KINDS = new Set(['cn', 'lua']);
export interface BundleLineIn { specialtyId: string; grade: Quality; kg: number; processed?: boolean }
export interface BundleLine extends BundleLineIn {
  ok: boolean; reason?: string; name: string;
  spoilKg: number; arriveKg: number; unitPrice: number; payout: number;
  /** Phần cước chia theo kg của dòng này. */
  freight: number; demand: number; trend: number;
}
export interface BundleQuote {
  ok: boolean; reason?: string; mode: ExportMode; market: ExportMarket;
  /** Tổng khối lượng các dòng đạt điều kiện (dòng bị loại không đi). */
  kg: number; lines: BundleLine[];
  gatewayId: string; gatewayName: string; inlandKm: number;
  freight: number; spoilKg: number; arriveKg: number; payout: number; net: number; minutes: number; lcl?: boolean;
}
export interface BundleOpts {
  discount?: number; valueBonus?: number;
  /** Giá tham chiếu hiện hành của nguyên liệu tươi (đồng/kg); thành phẩm tự nhân hệ số công thức. */
  refOf: (specialtyId: string) => number;
  /** Lượng đã bán vào thị trường này trong 24 giờ, theo đặc sản. */
  soldOf?: (specialtyId: string) => number;
  day?: number;
}
const productName = (specialtyId: string) => { const sp = SPECIALTIES[specialtyId]; return sp ? `${recipeOf(CROPS[sp.crop]).name} ${sp.name}` : specialtyId; };
/** Báo giá một lô xuất khẩu gồm nhiều mặt hàng: tối thiểu/tối đa tính trên tổng lô, cước chia theo kg; mặt hàng không đạt điều kiện thị trường bị loại kèm lý do. */
export function exportBundleQuote(items: BundleLineIn[], mode: ExportMode, market: ExportMarket, fromRegionId: string, opts: BundleOpts): BundleQuote {
  const m = EXPORT_MODES[mode], mk = EXPORT_MARKETS[market], from = REGIONS[fromRegionId];
  const empty: BundleQuote = { ok: false, mode, market, kg: 0, lines: [], gatewayId: '', gatewayName: '', inlandKm: 0, freight: 0, spoilKg: 0, arriveKg: 0, payout: 0, net: 0, minutes: m?.minutes ?? 0 };
  if (!m || !mk || !from) return { ...empty, reason: 'Thông tin lô hàng không hợp lệ.' };
  const gates = EXPORT_GATEWAYS.filter((g) => g.gate === m.gate && g.markets.includes(market))
    .map((g) => ({ g, km: Math.round(haversineKm(from.lat, from.lng, g.lat, g.lng)) })).sort((a, b) => a.km - b.km);
  if (!mk.modes.includes(mode) || !gates.length) return { ...empty, reason: `${m.name} không đi tới ${mk.name}.` };
  const { g, km } = gates[0];
  const day = opts.day ?? econDay(Date.now());
  // gộp các dòng trùng mặt hàng
  const merged = new Map<string, BundleLineIn>();
  for (const it of items) {
    if (!it || !SPECIALTIES[it.specialtyId] || !(it.kg > 0)) continue;
    const key = `${it.specialtyId}:${it.processed ? 'P' : it.grade}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, kg: prev.kg + Math.floor(it.kg) } : { specialtyId: it.specialtyId, grade: it.processed ? 'A' : it.grade, kg: Math.floor(it.kg), processed: !!it.processed });
  }
  let anyTreat = false;
  const lines: BundleLine[] = [...merged.values()].map((it) => {
    const sp = SPECIALTIES[it.specialtyId], processed = !!it.processed, dry = DRY_KINDS.has(CROPS[sp.crop].kind);
    const base = { ...it, name: processed ? productName(it.specialtyId) : sp.name, spoilKg: 0, arriveKg: 0, unitPrice: 0, payout: 0, freight: 0, demand: 1, trend: 1 };
    if (mk.processedOnly && !processed && !dry) return { ...base, ok: false, reason: `${mk.name} chỉ nhận hàng chế biến và hàng khô.` };
    if (mk.gradeA && !processed && it.grade !== 'A') return { ...base, ok: false, reason: `${mk.name} chỉ nhận hàng Loại 1.` };
    if (!processed && !dry && mk.treatFee) anyTreat = true;
    const spoilKg = Math.floor(it.kg * m.spoil * (processed ? EXPORT_PROCESSED_SPOIL : dry ? 0.2 : 1)), arriveKg = it.kg - spoilKg;
    const ref = opts.refOf(it.specialtyId);
    const raw = processed ? ref * recipeOf(CROPS[sp.crop]).value * (1 + (opts.valueBonus ?? 0)) * mk.priceMult : ref * mk.priceMult * QUALITY_MULT[it.grade];
    const trend = exportTrend(market, it.specialtyId, day), demand = exportDemandFactor(opts.soldOf?.(it.specialtyId) ?? 0, arriveKg);
    const unitPrice = Math.round((raw * trend * demand) / 100) * 100;
    return { ...base, ok: true, spoilKg, arriveKg, unitPrice, payout: unitPrice * arriveKg, demand: Math.round(demand * 1000) / 1000, trend };
  });
  const ok = lines.filter((l) => l.ok), kg = ok.reduce((s, l) => s + l.kg, 0);
  // cước tính trên tổng lô: một khoản cố định + theo kg; tàu viễn dương tự chọn ghép container nếu rẻ hơn
  const fcl = m.baseFee + m.perKgFee * kg, lclCost = m.baseFee * EXPORT_LCL_BASE_RATIO + m.perKgFee * EXPORT_LCL_PER_KG_MULT * kg;
  const lcl = mode === 'tau_lon' && lclCost < fcl;
  const gross = (lcl ? lclCost : fcl) + EXPORT_INLAND_PER_KG_KM * km * kg;
  const discounted = gross * (1 - Math.min(0.5, Math.max(0, opts.discount ?? 0)));
  let freightSum = 0;
  for (const l of ok) {
    const sp = SPECIALTIES[l.specialtyId], fresh = !l.processed && !DRY_KINDS.has(CROPS[sp.crop].kind);
    l.freight = Math.round((discounted * (l.kg / Math.max(1, kg)) + (fresh && mk.treatFee ? mk.treatFee * l.kg : 0)) / 1000) * 1000;
    freightSum += l.freight;
  }
  const payout = ok.reduce((s, l) => s + l.payout, 0);
  const q: BundleQuote = {
    ...empty, lcl, lines, kg, gatewayId: g.id, gatewayName: g.name, inlandKm: km, freight: freightSum,
    spoilKg: ok.reduce((s, l) => s + l.spoilKg, 0), arriveKg: ok.reduce((s, l) => s + l.arriveKg, 0), payout, net: payout - freightSum,
    minutes: m.minutes + (anyTreat ? mk.treatMinutes ?? 0 : 0),
  };
  if (!ok.length) return { ...q, reason: lines.length ? 'Không mặt hàng nào đạt điều kiện của thị trường này.' : 'Chưa chọn hàng.' };
  if (kg < m.minKg) return { ...q, reason: `${m.name} nhận lô từ ${m.minKg} kg (lô đang có ${kg} kg).` };
  if (kg > m.maxKg) return { ...q, reason: `${m.name} chỉ chở tối đa ${m.maxKg} kg một lô (lô đang có ${kg} kg).` };
  return { ...q, ok: true };
}

// ---------------------------------------------------------------- xưởng: sức chứa mỗi mẻ
/** Mỗi mẻ một máy chỉ nhận chừng này kg nguyên liệu (theo cấp máy); máy nhập khẩu thêm 50%. Trước đây mẻ không giới hạn nên xưởng lời vô hạn theo vốn. */
export const MACHINE_BATCH_KG = [0, 30, 50, 80];
export function machineBatchKg(level: number, imported = false): number {
  return Math.round(MACHINE_BATCH_KG[Math.max(1, Math.min(3, level))] * (imported ? 1.5 : 1));
}

// ---------------------------------------------------------------- đơn hàng nội địa theo cấp và vai
/** Đơn hàng trả cao hơn giá tham chiếu (người mua đặt trước). Khối lượng lớn dần theo cấp để đơn luôn đáng làm. */
export const ORDER_PREMIUM_V2 = 1.35;
/** Hệ số khối lượng đơn theo cấp: cấp 1 = 1, cấp 10 = 5,5, cấp 20 = 10,5, cấp 30 = 15,5. */
export function orderScale(level: number): number { return Math.round((1 + Math.max(0, level - 1) * 0.5) * 100) / 100; }
/** Thưởng tiền mặt thêm cho đơn theo cấp (bù cho người mới chưa có nhiều hàng). */
export function orderBonus(level: number): number { return Math.round((200_000 + level * 100_000) / 1000) * 1000; }
export type OrderKind = 'thu_mua' | 'qua_bieu' | 'mam_ngu_qua' | 'xuong' | 'si_lon';
export const ORDER_KIND_NAMES: Record<OrderKind, string> = {
  thu_mua: 'Đơn thu mua', qua_bieu: 'Giỏ quà biếu', mam_ngu_qua: 'Mâm ngũ quả', xuong: 'Đơn hàng chế biến', si_lon: 'Đơn sỉ lớn',
};

// ---------------------------------------------------------------- công ty xuất nhập khẩu (NPC)
export interface Company { id: string; name: string; short: string; province: string; regionId: string; emoji: string; markets: ExportMarket[]; note: string; sells: string[] }
/** Công ty hư cấu (không trùng tên doanh nghiệp thật). Kho đặt ở tỉnh có cảng, cửa khẩu hoặc sân bay. */
export const COMPANIES: Company[] = [
  { id: 'phuong_nam', name: 'Công ty TNHH Nông sản Phương Nam Xanh', short: 'Phương Nam Xanh', province: 'TP. Hồ Chí Minh', regionId: '', emoji: '🚢', markets: ['au_my', 'uc_nz', 'trung_dong'], note: 'Gom trái cây miền Nam đi Mỹ, Úc qua cảng Cái Mép.', sells: ['may_say', 'kho_lanh'] },
  { id: 'kinh_bac', name: 'Công ty CP Thương mại Kinh Bắc Lộc', short: 'Kinh Bắc Lộc', province: 'Bắc Ninh', regionId: '', emoji: '🏮', markets: ['trung_quoc', 'nga'], note: 'Chuyên vải, nhãn, hồi quế đi Trung Quốc qua Lạng Sơn.', sells: ['may_rang_xay'] },
  { id: 'cang_bien', name: 'Công ty Xuất nhập khẩu Cảng Biển Đông', short: 'Cảng Biển Đông', province: 'Hải Phòng', regionId: '', emoji: '⚓', markets: ['nhat_han', 'au_my', 'nga'], note: 'Đóng container hàng khô, hàng chế biến đi Nhật, Hàn, châu Âu.', sells: ['may_dong_goi', 'day_chuyen_mut'] },
  { id: 'cao_nguyen', name: 'Công ty TNHH Cao Nguyên Vàng', short: 'Cao Nguyên Vàng', province: 'Đắk Lắk', regionId: '', emoji: '☕', markets: ['trung_dong', 'an_do', 'nga'], note: 'Thu mua cà phê, hồ tiêu, sầu riêng Tây Nguyên.', sells: ['may_rang_xay'] },
  { id: 'song_han', name: 'Công ty CP Nông sản Sông Hàn', short: 'Nông sản Sông Hàn', province: 'Đà Nẵng', regionId: '', emoji: '🌊', markets: ['nhat_han', 'asean'], note: 'Gom hàng miền Trung đi Nhật và Đông Nam Á qua cảng Tiên Sa.', sells: ['may_rua'] },
  { id: 'cuu_long', name: 'Hợp tác xã Xuất khẩu Cửu Long', short: 'HTX Cửu Long', province: 'Cần Thơ', regionId: '', emoji: '🛶', markets: ['asean', 'trung_quoc', 'trung_dong'], note: 'Gạo, trái cây miền Tây đi Đông Nam Á và Trung Quốc.', sells: ['may_rang_xay', 'may_say'] },
  { id: 'xu_lang', name: 'Công ty TNHH Biên Mậu Xứ Lạng', short: 'Biên Mậu Xứ Lạng', province: 'Lạng Sơn', regionId: '', emoji: '🚚', markets: ['trung_quoc'], note: 'Đổ hàng tươi qua cửa khẩu Hữu Nghị mỗi ngày.', sells: ['kho_lanh'] },
  { id: 'da_lat_hoa', name: 'Công ty CP Hoa Trái Đà Lạt', short: 'Hoa Trái Đà Lạt', province: 'Lâm Đồng', regionId: 'ld_dalat', emoji: '🌸', markets: ['nhat_han', 'uc_nz', 'asean'], note: 'Hoa, rau, dâu tây cao cấp đi máy bay.', sells: ['kho_lanh', 'may_dong_goi'] },
];
// kho công ty đặt ở một vùng trồng trong tỉnh đó (vùng đầu tiên theo danh mục)
for (const c of COMPANIES) if (!c.regionId) c.regionId = Object.values(REGIONS).find((r) => r.province === c.province)?.id ?? Object.keys(REGIONS)[0];
export function company(id: string): Company | undefined { return COMPANIES.find((c) => c.id === id); }

export interface Contract {
  id: string; companyId: string; day: number;
  specialtyId: string; processed: boolean; minGrade: Quality;
  /** Tổng khối lượng hợp đồng, giá thu mua mỗi kg, hạn giao (ms). */
  kg: number; price: number; expiresAt: number;
  market: ExportMarket;
}
/** Công ty trả cao hơn giá tham chiếu nhưng thấp hơn tự xuất khẩu, vì công ty chịu cước, hao và rủi ro giá. */
export const CONTRACT_PRICE_FRESH = [1.12, 1.22], CONTRACT_PRICE_PROCESSED = [1.08, 1.16];
export const CONTRACTS_PER_COMPANY = 2, CONTRACT_DAYS = 2;
/** Giao qua dịch vụ vận chuyển (không tự chở tới kho): phí mỗi kg mỗi km. */
export const CONTRACT_SHIP_PER_KG_KM = 2.5;
/** Hợp đồng trong ngày của mọi công ty, tất định theo ngày. `refOf` là giá tham chiếu hiện hành (thành phẩm dùng giá thành phẩm). */
export function contractsOfDay(day: number, refOf: (specialtyId: string, processed: boolean) => number): Contract[] {
  const out: Contract[] = [];
  const all = Object.values(SPECIALTIES);
  for (const c of COMPANIES) {
    // công ty ưu tiên đặc sản vùng lân cận kho của mình
    const home = REGIONS[c.regionId];
    const near = all.filter((sp) => { const r = REGIONS[sp.regionId]; return r && home && haversineKm(r.lat, r.lng, home.lat, home.lng) < 450; });
    const pool = near.length >= 4 ? near : all;
    for (let k = 0; k < CONTRACTS_PER_COMPANY; k++) {
      const r = seededRandom(`hd:${c.id}:${day}:${k}`);
      const sp = pool[Math.floor(r() * pool.length)];
      const processed = r() < 0.3;
      const market = c.markets[Math.floor(r() * c.markets.length)];
      const minGrade: Quality = EXPORT_MARKETS[market].gradeA || r() < 0.4 ? 'A' : 'B';
      const kg = Math.round((processed ? 500 + r() * 2_500 : 2_000 + r() * 18_000) / 100) * 100;
      const span = processed ? CONTRACT_PRICE_PROCESSED : CONTRACT_PRICE_FRESH;
      const ratio = span[0] + r() * (span[1] - span[0]);
      const price = Math.round((refOf(sp.id, processed) * ratio) / 100) * 100;
      out.push({ id: `${c.id}-${day}-${k}`, companyId: c.id, day, specialtyId: sp.id, processed, minGrade, kg, price, expiresAt: (day + CONTRACT_DAYS) * DAY_MS - VN_TZ_MS, market });
    }
  }
  return out;
}
/** Hợp đồng có còn nhận hàng hôm nay không (ngày tạo trong hạn). */
export const contractDaysOpen = (today: number) => Array.from({ length: CONTRACT_DAYS }, (_, i) => today - i);

// ---------------------------------------------------------------- tài sản thương mại: cửa hàng, siêu thị, xưởng chi nhánh
// Công trình dựng trên thửa đất của sổ địa chính (shared/land.ts): đất, giá, quyền theo vai đều lấy ở đó.
export type PropertyKind = BuildingKind;
export interface PropertyInfo { name: string; emoji: string; minLevel: number; land: number; build: number; permit: number; buildHours: number; roles: Role[]; note: string; use: string; lots: number; max: number; shelves: number }
export const PROPERTY_KINDS: Record<PropertyKind, PropertyInfo> = Object.fromEntries((Object.keys(BUILDINGS) as BuildingKind[]).map((k) => {
  const b = BUILDINGS[k];
  return [k, { name: b.name, emoji: b.emoji, minLevel: b.minLevel, land: 0, build: b.build, permit: b.permit, buildHours: b.buildHours, roles: b.roles, note: b.note, use: b.use, lots: b.lots, max: b.max, shelves: b.shelves }];
})) as Record<PropertyKind, PropertyInfo>;
/** Nông dân phải lên cấp cao hơn mới mở siêu thị (để vai chính của siêu thị là chủ xưởng và thương lái). */
export const PROPERTY_FARMER_LEVEL = BUILDINGS.sieu_thi.farmerLevel ?? 25;
/** Lượng khách theo tỉnh: dân số, nhóm giá đất và số điểm du lịch. */
export function provinceTraffic(province: string): number {
  return shopTraffic(province, SIGHTS.filter((s) => s.province === province).length);
}
/** Chi phí mở công trình khi phải mua `needLots` thửa (mặc định mua đủ). land = tiền đất + trước bạ + phí sổ. */
export function propertyCost(kind: PropertyKind, province: string, needLots?: number): { land: number; build: number; permit: number; total: number; lots: number; lotPrice: number; registration: number } {
  const c = buildingCost(kind, province, needLots);
  return { land: c.land + c.registration + c.certFee, build: c.build, permit: c.permit, total: c.total, lots: c.needLots, lotPrice: c.lotPrice, registration: c.registration };
}
/** Khách mỗi giờ (thời gian thật khi TIME_SCALE = 1) của siêu thị người chơi, quy ra kg hàng bán được mỗi giờ. Cửa hàng bán ít hơn. */
export const SHOP_KG_PER_HOUR = 300;
export function shopKgPerHour(province: string, level: number, kind: PropertyKind = 'sieu_thi'): number {
  return Math.max(1, Math.round(SHOP_KG_PER_HOUR * BUILDINGS[kind].sales * provinceTraffic(province) * (1 + 0.04 * Math.max(0, level - 1))));
}
/** Siêu thị người chơi thu phí ký gửi này trên hàng của người khác (siêu thị NPC thu SUPER_FEE). */
export const SHOP_CONSIGN_FEE = 0.07;
/** Xưởng chi nhánh thêm bấy nhiêu chỗ đặt máy. */
export const BRANCH_MACHINE_SLOTS = 4;
/** Mọi tỉnh đều có siêu thị đặc sản của nhà nước (NPC). */
export const SUPER_PROVINCES: readonly string[] = PROVINCES;
export const isProvince = (p: string): boolean => (PROVINCES as readonly string[]).includes(p);
/** Đặc sản bán ở siêu thị NPC của tỉnh: hàng các vùng trong tỉnh, nếu tỉnh không có vùng trồng thì lấy vùng gần nhất. */
export function provinceSpecialties(province: string): string[] {
  const regs = Object.values(REGIONS).filter((r) => r.province === province);
  if (regs.length) return regs.flatMap((r) => specialtiesOfRegion(r.id).map((s) => s.id));
  return [];
}
