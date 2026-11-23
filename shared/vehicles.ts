// Xe chở hàng, giấy phép lái xe, xe điện và trạm sạc, trạm dừng nghỉ trên cao tốc. Dùng chung cho máy chủ và giao diện.
// Số liệu bám thực tế Việt Nam nhưng đã đơn giản hoá; chỗ nào đơn giản hoá ghi trong docs/GDD.md.
import { REGIONS } from './catalog.ts';
import { TRUCK, roadKm, tripPlan } from './rules.ts';
import type { TripPlan } from './rules.ts';
import { ITEMS, regionalItems } from './items.ts';

/** Hạng giấy phép lái xe theo Luật Trật tự, an toàn giao thông đường bộ 2024 (Điều 57), chỉ lấy các hạng game dùng. */
export type LicenseClass = 'A1' | 'B1' | 'B' | 'C1' | 'C' | 'CE';
export const LICENSES: Record<LicenseClass, { name: string; covers: string; price: number; minLevel: number; includes: LicenseClass[] }> = {
  A1: { name: 'Hạng A1', covers: 'Xe mô tô hai bánh đến 125 cm³ hoặc động cơ điện đến 11 kW', price: 200_000, minLevel: 1, includes: [] },
  B1: { name: 'Hạng B1', covers: 'Xe mô tô ba bánh (xe ba gác máy)', price: 300_000, minLevel: 1, includes: ['A1'] },
  B: { name: 'Hạng B', covers: 'Ô tô chở người đến 8 chỗ; ô tô tải có khối lượng toàn bộ theo thiết kế đến 3.500 kg', price: 1_500_000, minLevel: 1, includes: [] },
  C1: { name: 'Hạng C1', covers: 'Ô tô tải có khối lượng toàn bộ theo thiết kế trên 3.500 kg đến 7.500 kg', price: 3_000_000, minLevel: 3, includes: ['B'] },
  C: { name: 'Hạng C', covers: 'Ô tô tải có khối lượng toàn bộ theo thiết kế trên 7.500 kg', price: 5_000_000, minLevel: 5, includes: ['B', 'C1'] },
  CE: { name: 'Hạng CE', covers: 'Xe hạng C kéo rơ moóc trên 750 kg; ô tô đầu kéo kéo sơ mi rơ moóc', price: 8_000_000, minLevel: 7, includes: ['B', 'C1', 'C'] },
};
export const LICENSE_ORDER = Object.keys(LICENSES) as LicenseClass[];
/** Thời hạn giấy phép lái xe theo hạng (năm); null là không thời hạn. Viết theo hiểu biết về Luật Trật tự, an toàn giao thông đường bộ 2024, chưa đối chiếu văn bản. */
export const LICENSE_TERM_YEARS: Record<LicenseClass, number | null> = { A1: null, B1: null, B: 10, C1: 10, C: 5, CE: 5 };
/** Một "năm bằng lái" trong game dài chừng này ngày thật (B, C1 hết hạn sau 30 ngày thật; C, CE sau 15 ngày). */
export const LICENSE_YEAR_DAYS = 3;
export const LICENSE_YEAR_MS = LICENSE_YEAR_DAYS * 86400_000, LICENSE_MONTH_MS = LICENSE_YEAR_MS / 12;
/** Mỗi bằng có 12 điểm; vi phạm bị trừ, hết điểm thì bằng bị tạm khoá tới khi thi lại lý thuyết. Sau 12 "tháng" không bị trừ thì đủ điểm lại. */
export const LICENSE_POINTS = 12;
export type ExamPart = 'ly_thuyet' | 'sa_hinh';
/** Điểm đạt (thang 100), lệ phí mỗi lần thi và thời gian làm bài tối thiểu (giây) của từng phần. */
export const EXAM: Record<ExamPart, { name: string; pass: number; fee: number; minSeconds: number }> = {
  ly_thuyet: { name: 'Lý thuyết', pass: 80, fee: 100_000, minSeconds: 5 },
  sa_hinh: { name: 'Sa hình', pass: 80, fee: 300_000, minSeconds: 20 },
};
/** Hạng mô tô chỉ thi lý thuyết trong game; các hạng ô tô phải đạt cả sa hình. */
export const needsYard = (cls: LicenseClass): boolean => cls !== 'A1' && cls !== 'B1';
/** Lệ phí đổi bằng (không phải thi lại). */
export const LICENSE_RENEW_FEE = 135_000;
export type RenewMode = 'doi' | 'thi_ly_thuyet' | 'thi_lai';
/** Đổi bằng: còn hạn hoặc quá hạn dưới 3 "tháng" thì đổi thẳng; quá 3 tháng đến dưới 1 năm thi lại lý thuyết; từ 1 năm thi lại cả lý thuyết lẫn sa hình. */
export function renewMode(overdueMs: number): RenewMode {
  return overdueMs < 3 * LICENSE_MONTH_MS ? 'doi' : overdueMs < LICENSE_YEAR_MS ? 'thi_ly_thuyet' : 'thi_lai';
}
/** Có bằng `have` thì lái được xe cần bằng `need` không (bằng cao bao gồm bằng thấp cùng nhóm). */
export function licenseCovers(have: readonly string[], need: LicenseClass): boolean {
  return have.some((h) => h === need || (LICENSES[h as LicenseClass]?.includes ?? []).includes(need));
}

export type Power = 'xang' | 'dau' | 'dien';
export const POWER_NAMES: Record<Power, string> = { xang: 'Xăng', dau: 'Dầu diesel', dien: 'Điện' };
/** Giá nhiên liệu trong game (đồng/lít, đồng/kWh). Sạc nhanh DC ở trạm đắt hơn sạc chậm ở nhà. */
export const ENERGY_PRICE = { xang: TRUCK.fuelPrice, dau: 19_000, dienDC: 3_900, dienNha: 2_700 };
/** Sạc nhanh DC từ 10% lên 80% pin mất chừng này phút ngoài đời; sạc chậm ở nhà qua đêm. */
export const CHARGE = { dcMinutes: 35, homeHours: 8, everyKm: 120, dcSecondsInGame: 6, pumpSecondsInGame: 2 };
/** Phí đường theo 5 nhóm xe của trạm thu phí BOT/ETC, so với nhóm 1. */
export const TOLL_GROUP_MULT: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 1, 2: 1.4, 3: 2.1, 4: 3.4, 5: 5.1 };
export const TOLL_GROUP_NAMES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Nhóm 1: xe dưới 12 chỗ, xe tải dưới 2 tấn', 2: 'Nhóm 2: xe tải từ 2 đến dưới 4 tấn', 3: 'Nhóm 3: xe tải từ 4 đến dưới 10 tấn',
  4: 'Nhóm 4: xe tải từ 10 đến dưới 18 tấn, container 20 feet', 5: 'Nhóm 5: xe tải từ 18 tấn, container 40 feet',
};

export interface VehicleSpec {
  kind: string; name: string; emoji: string;
  group: 'ba_gac' | 'ban_tai' | 'tai_nhe' | 'tai_trung' | 'tai_nang' | 'dau_keo';
  /** Tải trọng chở hàng (kg) và khối lượng toàn bộ theo thiết kế (kg, để xếp hạng bằng lái). */
  cargoKg: number; gvwKg: number;
  power: Power;
  /** Bình nhiên liệu (lít) hoặc pin (kWh). */
  tank: number;
  /** Tiêu hao khi đầy tải: lít/100 km hoặc kWh/100 km. */
  per100: number;
  price: number; license: LicenseClass; tollGroup: 1 | 2 | 3 | 4 | 5;
  /** Tốc độ tối đa xe này được chạy trên cao tốc trong game (km/h). */
  maxKmh: number;
  /** Xe ba bánh không được vào cao tốc: chuyến đi lâu hơn. */
  noHighway?: boolean;
  /** Thùng lạnh: hàng tươi thu mua bằng xe này được giữ loại tốt hơn (hệ số hao hụt). */
  cold?: boolean;
  /** Phí đăng kiểm, bảo hiểm, bảo dưỡng quy ra mỗi 100 km. */
  upkeepPer100: number;
  minLevel: number; note: string;
}
const V = (v: VehicleSpec) => v;
/** Xe mặc định cấp cho thương lái (và người chơi cũ): thông số lấy từ TRUCK để hai nơi luôn khớp. */
export const DEFAULT_VEHICLE = 'tai_990';
const BASE: VehicleSpec[] = [
  V({ kind: 'ba_gac', name: 'Xe ba gác máy 300 kg', emoji: '🛺', group: 'ba_gac', cargoKg: 300, gvwKg: 650, power: 'xang', tank: 12, per100: 4, price: 6_000_000, license: 'B1', tollGroup: 1, maxKmh: 50, noHighway: true, upkeepPer100: 2_000, minLevel: 1,
    note: 'Rẻ, chở ít, không được vào cao tốc nên đi chậm. Hợp đi chợ gần.' }),
  V({ kind: 'ban_tai', name: 'Xe bán tải 700 kg', emoji: '🛻', group: 'ban_tai', cargoKg: 700, gvwKg: 3_000, power: 'dau', tank: 75, per100: 9, price: 25_000_000, license: 'B', tollGroup: 1, maxKmh: 120, upkeepPer100: 5_000, minLevel: 1,
    note: 'Chạy nhanh như xe con, bình to, đi xa không lo.' }),
  V({ kind: DEFAULT_VEHICLE, name: 'Xe tải nhẹ 990 kg', emoji: '🚚', group: 'tai_nhe', cargoKg: TRUCK.cargoKg, gvwKg: 2_400, power: 'xang', tank: TRUCK.tankL, per100: TRUCK.lPer100km, price: 18_000_000, license: 'B', tollGroup: 1, maxKmh: 100, upkeepPer100: 4_000, minLevel: 1,
    note: 'Xe khởi nghiệp của thương lái: dưới 1 tấn nên vào được phố giờ cấm tải.' }),
  V({ kind: 'tai_1t9', name: 'Xe tải 1,9 tấn', emoji: '🚚', group: 'tai_nhe', cargoKg: 1_900, gvwKg: 4_990, power: 'dau', tank: 70, per100: 10, price: 30_000_000, license: 'C1', tollGroup: 1, maxKmh: 90, upkeepPer100: 6_000, minLevel: 2,
    note: 'Khối lượng toàn bộ gần 5 tấn nên cần bằng C1 dù chỉ chở 1,9 tấn.' }),
  V({ kind: 'tai_3t5', name: 'Xe tải 3,5 tấn', emoji: '🚛', group: 'tai_trung', cargoKg: 3_500, gvwKg: 7_200, power: 'dau', tank: 100, per100: 13, price: 48_000_000, license: 'C1', tollGroup: 2, maxKmh: 90, upkeepPer100: 9_000, minLevel: 3,
    note: 'Xe tải trung phổ biến nhất của các vựa trái cây.' }),
  V({ kind: 'tai_8t', name: 'Xe tải 8 tấn', emoji: '🚛', group: 'tai_nang', cargoKg: 8_000, gvwKg: 16_000, power: 'dau', tank: 200, per100: 20, price: 90_000_000, license: 'C', tollGroup: 3, maxKmh: 80, upkeepPer100: 15_000, minLevel: 5,
    note: 'Chở cả vườn một chuyến; phí đường nhóm 3.' }),
  V({ kind: 'tai_15t', name: 'Xe tải 15 tấn (3 chân)', emoji: '🚛', group: 'tai_nang', cargoKg: 15_000, gvwKg: 24_000, power: 'dau', tank: 350, per100: 28, price: 150_000_000, license: 'C', tollGroup: 4, maxKmh: 80, upkeepPer100: 22_000, minLevel: 6,
    note: 'Ba trục, tổng tải 24 tấn; phí đường nhóm 4.' }),
  V({ kind: 'dau_keo', name: 'Đầu kéo + sơ mi rơ moóc 28 tấn', emoji: '🚛', group: 'dau_keo', cargoKg: 28_000, gvwKg: 40_000, power: 'dau', tank: 500, per100: 35, price: 260_000_000, license: 'CE', tollGroup: 5, maxKmh: 80, upkeepPer100: 32_000, minLevel: 7,
    note: 'Kéo container 40 feet; cần bằng CE, phí đường nhóm 5.' }),
];
/** Bản thùng lạnh: đắt hơn 30%, tốn nhiên liệu hơn 8% vì chạy máy lạnh, chở ít hơn 8% vì thùng nặng. */
const cold = (b: VehicleSpec): VehicleSpec => ({
  ...b, kind: `${b.kind}_lanh`, name: `${b.name} thùng lạnh`, cold: true, cargoKg: Math.round((b.cargoKg * 0.92) / 10) * 10,
  per100: Math.round(b.per100 * 1.08 * 10) / 10, price: Math.round((b.price * 1.3) / 100_000) * 100_000, minLevel: b.minLevel + 1,
  note: 'Thùng lạnh giữ hàng tươi: hàng thu mua về được xếp cao hơn một hạng chất lượng. Tốn nhiên liệu hơn vì chạy máy lạnh.',
});
/** Bản chạy điện: đắt hơn 35%, tiền điện rẻ hơn hẳn nhưng tầm ngắn và phải dừng sạc. */
const electric = (b: VehicleSpec, kwh: number, per100: number): VehicleSpec => ({
  ...b, kind: `${b.kind}_dien`, name: `${b.name.replace('Xe ', 'Xe điện ')}`, emoji: '⚡', power: 'dien', tank: kwh, per100,
  price: Math.round((b.price * 1.35) / 100_000) * 100_000, upkeepPer100: Math.round(b.upkeepPer100 * 0.7), minLevel: b.minLevel + 1,
  note: `Pin ${kwh} kWh, đi được khoảng ${Math.round((kwh / per100) * 100)} km mỗi lần sạc đầy khi chở nặng. Tiền điện rẻ hơn xăng dầu nhưng phải dừng sạc ${CHARGE.dcMinutes} phút ở trạm.`,
});
const by = (k: string) => BASE.find((b) => b.kind === k)!;
export const VEHICLES: Record<string, VehicleSpec> = Object.fromEntries([
  ...BASE,
  cold(by('tai_990')), cold(by('tai_1t9')), cold(by('tai_3t5')), cold(by('tai_8t')), cold(by('tai_15t')), cold(by('dau_keo')),
  electric(by('ban_tai'), 70, 24), electric(by('tai_990'), 42, 20), electric(by('tai_3t5'), 100, 45),
].map((v) => [v.kind, v]));
export const VEHICLE_KINDS = Object.keys(VEHICLES);
/** Bán lại xe được chừng này phần giá mua. */
export const VEHICLE_RESALE = 0.6;
export const VEHICLE_MAX_OWNED = 6;

export const unitOf = (p: Power) => (p === 'dien' ? 'kWh' : 'lít');
/** Giá một đơn vị năng lượng khi nạp dọc đường (trạm xăng, trạm sạc nhanh). */
export const roadPrice = (p: Power) => (p === 'dien' ? ENERGY_PRICE.dienDC : p === 'dau' ? ENERGY_PRICE.dau : ENERGY_PRICE.xang);
/** Giá khi nạp lúc xe đỗ ở nhà: xe điện sạc chậm giá điện sinh hoạt. */
export const parkPrice = (p: Power) => (p === 'dien' ? ENERGY_PRICE.dienNha : roadPrice(p));
/** Tầm hoạt động (km) khi đầy bình hoặc đầy pin. */
export const rangeKm = (v: VehicleSpec) => Math.round((v.tank / v.per100) * 100);

/** Thông số xe theo đúng hình dạng hằng TRUCK cũ, để phần chuyến xe dùng chung một công thức. */
export function truckOf(v: VehicleSpec) {
  return {
    ...TRUCK, tankL: v.tank, lPer100km: v.per100, fuelPrice: roadPrice(v.power), parkPrice: parkPrice(v.power),
    tollFee: Math.round((TRUCK.tollFee * TOLL_GROUP_MULT[v.tollGroup]) / 1000) * 1000, cargoKg: v.cargoKg,
    kind: v.kind, name: v.name, power: v.power, unit: unitOf(v.power), maxKmh: v.maxKmh, cold: !!v.cold, tollGroup: v.tollGroup,
  };
}
export type TruckInfo = ReturnType<typeof truckOf>;

// ---------------------------------------------------------------- trạm dừng nghỉ và giờ lái xe
/** Luật 2024: không lái liên tục quá 4 giờ, không quá 10 giờ một ngày, không quá 48 giờ một tuần. */
export const DRIVE_RULES = { continuousHours: 4, dailyHours: 10, weeklyHours: 48, avgKmh: 60, wcEnergy: 2, missedRestEnergy: 6 };
/** Cứ khoảng này km đường bộ có một trạm dừng nghỉ. */
export const REST_EVERY_KM = 90;
export interface RestStop { atKm: number; name: string; hasFuel: boolean; hasCharger: boolean; hasWc: true; province: string | null }
/** Số lần tối thiểu phải dừng nghỉ trên một chuyến để không lái liên tục quá 4 giờ. */
export function restsNeeded(roadKmTotal: number): number {
  return Math.max(0, Math.ceil(roadKmTotal / (DRIVE_RULES.continuousHours * DRIVE_RULES.avgKmh)) - 1);
}
export interface VehicleTripPlan extends TripPlan {
  vehicleKind: string; power: Power; unit: 'lít' | 'kWh';
  /** Năng lượng cần cho cả chuyến, theo đơn vị của xe (bằng fuelNeededL). */
  energyNeeded: number;
  /** Trạm sạc nhanh dọc đường (xe điện); xe xăng dầu dùng stationsAtKm. */
  chargersAtKm: number[];
  restStops: RestStop[]; restStopsAtKm: number[];
  restsNeeded: number; driveHours: number; maxKmh: number; tollGroup: number;
  /** Phí đăng kiểm, bảo hiểm, bảo dưỡng tính cho chuyến này. */
  upkeepCost: number;
}
/** Tỉnh của vùng trồng nằm gần điểm `f` (0..1) trên đoạn thẳng nối hai vùng — để biết trạm dừng bán đặc sản gì. */
function provinceAlong(fromId: string, toId: string, f: number): string | null {
  const a = REGIONS[fromId], b = REGIONS[toId];
  if (!a || !b) return null;
  const lat = a.lat + (b.lat - a.lat) * f, lng = a.lng + (b.lng - a.lng) * f;
  let best: { d: number; p: string } | null = null;
  for (const r of Object.values(REGIONS)) { const d = (r.lat - lat) ** 2 + (r.lng - lng) ** 2; if (!best || d < best.d) best = { d, p: r.province }; }
  return best?.p ?? null;
}
/** Kế hoạch chuyến theo chiếc xe đang lái: năng lượng, phí đường theo nhóm xe, trạm sạc, trạm dừng nghỉ. */
export function tripPlanFor(v: VehicleSpec, fromRegionId: string, toRegionId: string): VehicleTripPlan {
  const p = tripPlan(fromRegionId, toRegionId), road = roadKm(p.km, p.needsBoat);
  const energy = Math.round(((road * v.per100) / 100) * 10) / 10;
  const restStops: RestStop[] = [];
  for (let k = REST_EVERY_KM; k < road - 20; k += REST_EVERY_KM) {
    // Chưa đối chiếu được tên trạm thật trên từng tuyến nên chỉ gọi theo cây số.
    restStops.push({ atKm: k, name: `Trạm dừng nghỉ Km ${k}`, hasFuel: true, hasCharger: true, hasWc: true, province: provinceAlong(fromRegionId, toRegionId, k / Math.max(1, road)) });
  }
  const chargersAtKm: number[] = [];
  if (v.power === 'dien') {
    // trạm sạc thưa hơn trạm xăng: có ở mọi trạm dừng nghỉ, cộng thêm các trụ lẻ cách nhau CHARGE.everyKm
    const set = new Set(restStops.map((r) => r.atKm));
    for (let k = CHARGE.everyKm; k < road; k += CHARGE.everyKm) if (![...set].some((x) => Math.abs(x - k) < 25)) set.add(k);
    chargersAtKm.push(...[...set].sort((x, y) => x - y));
  }
  const speedFactor = v.noHighway ? 1.5 : v.maxKmh <= 80 ? 1.15 : 1;
  return {
    ...p, seconds: Math.min(110, Math.round(p.seconds * speedFactor)), tollFee: v.noHighway ? 0 : Math.round((p.tollFee * TOLL_GROUP_MULT[v.tollGroup]) / 1000) * 1000,
    fuelNeededL: energy, energyNeeded: energy, stationsAtKm: v.power === 'dien' ? [] : p.stationsAtKm, cargoKg: v.cargoKg,
    vehicleKind: v.kind, power: v.power, unit: unitOf(v.power), chargersAtKm, restStops, restStopsAtKm: restStops.map((r) => r.atKm),
    restsNeeded: restsNeeded(road), driveHours: Math.round((road / DRIVE_RULES.avgKmh) * 10) / 10, maxKmh: v.maxKmh, tollGroup: v.tollGroup,
    upkeepCost: Math.round((road * v.upkeepPer100) / 100 / 1000) * 1000,
  };
}
/** Món bán ở một trạm dừng nghỉ: đồ ăn uống phổ thông cộng đặc sản của tỉnh trạm đó. */
export const REST_STOP_ITEMS = ['nuoc_suoi', 'tra_da', 'ca_phe_sua_da', 'banh_mi', 'xoi', 'com_hop', 'pho', 'trai_cay_dia'];
export function restStopItems(province: string | null): string[] {
  const base = REST_STOP_ITEMS.filter((id) => Object.hasOwn(ITEMS, id));
  return [...base, ...(province ? regionalItems(province) : [])];
}

// ---------------------------------------------------------------- xe cá nhân đi tham quan trong tỉnh
/** Có xe riêng thì chặng taxi tới địa danh chỉ tốn tiền xăng hoặc điện. */
export interface PersonalRide { id: string; name: string; perKm: number; maxKm: number; license: LicenseClass | null; power: Power | 'suc_nguoi' }
export const PERSONAL_RIDES: Record<string, PersonalRide> = {
  xe_dap: { id: 'xe_dap', name: 'Xe đạp', perKm: 0, maxKm: 12, license: null, power: 'suc_nguoi' },
  xe_may: { id: 'xe_may', name: 'Xe máy', perKm: 500, maxKm: 120, license: 'A1', power: 'xang' },
  xe_may_dien: { id: 'xe_may_dien', name: 'Xe máy điện', perKm: 150, maxKm: 70, license: 'A1', power: 'dien' },
  o_to: { id: 'o_to', name: 'Ô tô con', perKm: 1_500, maxKm: 600, license: 'B', power: 'xang' },
  o_to_dien: { id: 'o_to_dien', name: 'Ô tô điện', perKm: 600, maxKm: 350, license: 'B', power: 'dien' },
};
/** Tiền đi một chặng đường bộ bằng xe riêng; null nếu xe này không đi nổi quãng đó (phải gọi taxi). */
export function personalLegFare(rideId: string | null | undefined, km: number): number | null {
  const r = rideId ? PERSONAL_RIDES[rideId] : undefined;
  if (!r || km > r.maxKm) return null;
  return Math.round((r.perKm * km) / 1000) * 1000;
}
