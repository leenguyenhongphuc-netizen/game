// Luật chơi thuần tuý, dùng chung cho máy chủ và giao diện.
import { CROPS, REGIONS, SPECIALTIES, processOf, recipeOf } from './catalog.ts';
import { fuelPriceNow, refPrice, tollPerKmGroup1 } from './realPrices.ts';
import type { Region, Specialty } from './catalog.ts';

export const PLOT_COLS = 6;
export const PLOT_ROWS = 5;
export const TILE_M2 = 25; // 30 ô × 25 m² = 750 m²
export const TILE_COUNT = PLOT_COLS * PLOT_ROWS;

export const START_CASH = 1_000_000;
export const LAND_PRICE = 50_000_000;
export const SEED_COST_RATIO = 0.08;

/** Nhịp chơi: người mới thu hoạch được ít lần thì cây lớn nhanh hơn nhiều, để không phải chờ hàng giờ ngay từ đầu. */
export function paceFactor(harvests: number): number {
  return harvests < 5 ? 30 : harvests < 20 ? 6 : 2;
}

/** Xóm: mỗi người có tối đa bấy nhiêu bạn, cũng là số vườn hàng xóm quanh nhà. */
export const MAX_FRIENDS = 9;
/** Tiền công mỗi lần chăm giúp cây của bạn, và số lượt chăm giúp tối đa mỗi ngày. */
export const HELP_REWARD = 3_000;
export const HELP_DAILY_LIMIT = 20;

/** Trễ một bước quá ngưỡng này thì tính một lần chăm sóc trễ. */
export const LATE_GRACE_MS = 12 * 3600_000;

export type Quality = 'A' | 'B' | 'C';
export const QUALITY_NAMES: Record<Quality, string> = { A: 'Loại 1', B: 'Loại 2', C: 'Loại 3' };
export const QUALITY_MULT: Record<Quality, number> = { A: 1, B: 0.85, C: 0.7 };
export const QUALITIES: Quality[] = ['A', 'B', 'C'];

/** Thương lái mua tại vườn thấp hơn giá tham chiếu; hàng phương xa được giá cao hơn. */
export const FARM_GATE_RATIO = 0.85;
export const FAR_MARKET_RATIO = 1.1;

/** Ô lưới làm mờ vị trí: khoảng 2 km. Máy chủ chỉ lưu tâm ô, không lưu toạ độ gốc. */
export const GRID_DEG = 0.02;
export function snapCell(lat: number, lng: number): { lat: number; lng: number } {
  const r = (v: number) => Math.round(Math.round(v / GRID_DEG) * GRID_DEG * 100) / 100;
  return { lat: r(lat), lng: r(lng) };
}

/** Khung bao lãnh thổ và vùng biển đảo Việt Nam (thô, chỉ để loại toạ độ rõ ràng ở nước ngoài). */
export function inVietnam(lat: number, lng: number): boolean {
  return lat >= 6 && lat <= 23.6 && lng >= 102 && lng <= 117.5;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function nearestRegion(lat: number, lng: number): { region: Region; km: number } {
  let best: Region | null = null;
  let bestKm = Infinity;
  for (const region of Object.values(REGIONS)) {
    const km = haversineKm(lat, lng, region.lat, region.lng);
    if (km < bestKm) { best = region; bestKm = km; }
  }
  return { region: best!, km: Math.round(bestKm) };
}

export function stepCount(sp: Specialty): number {
  return processOf(CROPS[sp.crop]).length;
}
/** Thời gian chờ giữa hai bước liên tiếp. */
export function stepWaitMs(sp: Specialty, timeScale: number): number {
  const crop = CROPS[sp.crop];
  return Math.max(1000, Math.round((crop.growHours * 3600_000) / (stepCount(sp) - 1) / timeScale));
}
export function qualityFromLate(lateCount: number): Quality {
  return lateCount === 0 ? 'A' : lateCount <= 2 ? 'B' : 'C';
}
export function seedCost(sp: Specialty): number {
  return Math.round((sp.refPrice * CROPS[sp.crop].yieldKg * SEED_COST_RATIO) / 1000) * 1000;
}
export interface PriceMods { glut?: number; marketDay?: boolean; coop?: boolean; city?: boolean; floating?: boolean }
/** Giá thương lái trả cho 1 kg tại vùng nhà của người bán, có tính các yếu tố thị trường. */
export function npcPrice(refPrice: number, quality: Quality, specialtyRegionId: string, homeRegionId: string, mods: PriceMods = {}): number {
  const far = specialtyRegionId !== homeRegionId;
  let price = refPrice * (far ? FAR_MARKET_RATIO : FARM_GATE_RATIO) * QUALITY_MULT[quality] * (mods.glut ?? 1);
  if (mods.marketDay) price *= 1 + MARKET_DAY_BONUS;
  if (mods.floating) price *= 1 + FLOATING_BONUS;
  if (mods.coop) price *= 1 + COOP_BONUS;
  if (mods.city && far) price *= 1 + CITY_BONUS;
  return Math.round(price / 100) * 100;
}

// ---------------------------------------------------------------- thời tiết
export type WeatherKind = 'nang' | 'may' | 'mua' | 'nang_gat' | 'bao';
export interface Weather { kind: WeatherKind; label: string; icon: string; growth: number; until: number; hazard?: Hazard }
const WEATHER_INFO: Record<WeatherKind, { label: string; icon: string; growth: number }> = {
  nang: { label: 'Nắng đẹp', icon: '☀️', growth: 1 },
  may: { label: 'Nhiều mây', icon: '⛅', growth: 1 },
  mua: { label: 'Mưa', icon: '🌧️', growth: 0.8 },
  nang_gat: { label: 'Nắng gắt', icon: '🥵', growth: 1.2 },
  bao: { label: 'Bão', icon: '🌀', growth: 1.3 },
};
const WEATHER_ORDER: WeatherKind[] = ['nang', 'may', 'mua', 'nang_gat', 'bao'];
/** Xác suất từng kiểu thời tiết theo miền, cùng thứ tự WEATHER_ORDER (tổng bằng 1). */
const WEATHER_ODDS: Record<string, number[]> = {
  bac: [0.4, 0.3, 0.22, 0.08, 0],
  trung: [0.35, 0.2, 0.18, 0.23, 0.04],
  taynguyen: [0.4, 0.28, 0.25, 0.07, 0],
  nam: [0.33, 0.22, 0.38, 0.07, 0],
  dao: [0.35, 0.2, 0.36, 0.05, 0.04],
};
export const WEATHER_SLOT_MS = 3 * 3600_000;
export function weatherInfo(kind: WeatherKind): { label: string; icon: string; growth: number } {
  return WEATHER_INFO[kind];
}
const VN_TZ_MS = 7 * 3600_000;
/** Tháng (1–12) theo giờ Việt Nam. */
export function vnMonth(nowMs: number): number {
  return new Date(nowMs + VN_TZ_MS).getUTCMonth() + 1;
}

// ---------------------------------------------------------------- mùa vụ thật theo miền
export interface Hazard { id: 'han_man' | 'bao' | 'suong_muoi' | 'lu' | 'nang_nong'; label: string; icon: string; note: string; growth: number }
const HAZARDS: Record<Hazard['id'], Hazard> = {
  han_man: { id: 'han_man', label: 'Hạn mặn', icon: '🧂', note: 'Mùa khô, nước mặn lấn vào kênh rạch nên cây thiếu nước ngọt và lớn chậm.', growth: 1.15 },
  bao: { id: 'bao', label: 'Mùa bão', icon: '🌀', note: 'Mùa bão ở miền Trung và biển đảo: gió to, mưa lớn, cây lớn chậm hơn.', growth: 1.1 },
  suong_muoi: { id: 'suong_muoi', label: 'Sương muối', icon: '❄️', note: 'Rét đậm ở miền Bắc, sương muối làm táp lá nên cây lớn chậm.', growth: 1.2 },
  lu: { id: 'lu', label: 'Mưa lũ', icon: '🌊', note: 'Mưa lũ miền Trung: vườn ngập úng, cây lớn chậm.', growth: 1.15 },
  nang_nong: { id: 'nang_nong', label: 'Nắng nóng', icon: '🔥', note: 'Nắng nóng gay gắt, gió Lào khô: cây mất nước và lớn chậm.', growth: 1.1 },
};
/** Hiện tượng theo mùa của vùng trong tháng hiện tại (giờ Việt Nam); không có thì null. */
export function seasonAt(regionId: string, nowMs: number): Hazard | null {
  const zone = REGIONS[regionId]?.zone, m = vnMonth(nowMs);
  if (zone === 'nam' && m >= 2 && m <= 4) return HAZARDS.han_man;
  if (zone === 'trung' && (m === 10 || m === 11)) return HAZARDS.lu;
  if ((zone === 'trung' || zone === 'dao') && m >= 9 && m <= 11) return HAZARDS.bao;
  if (zone === 'bac' && (m === 12 || m === 1)) return HAZARDS.suong_muoi;
  if ((zone === 'bac' || zone === 'trung') && (m === 6 || m === 7)) return HAZARDS.nang_nong;
  return null;
}
/** Cây đang vào chính vụ thu hoạch hay không. */
export function inSeason(cropId: string, nowMs: number): boolean {
  return !!CROPS[cropId]?.season.includes(vnMonth(nowMs));
}
export const IN_SEASON_YIELD = 1.15;

/** Thời tiết của một vùng: tất định theo (vùng, khung 3 giờ thật) nên máy chủ và giao diện luôn khớp nhau. */
export function weatherAt(regionId: string, nowMs: number): Weather {
  const slot = Math.floor(nowMs / WEATHER_SLOT_MS);
  let h = 2166136261;
  for (const ch of `${regionId}:${slot}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  const u = (h >>> 0) / 4294967296;
  const hazard = seasonAt(regionId, nowMs);
  let odds = WEATHER_ODDS[REGIONS[regionId]?.zone ?? 'nam'];
  // Theo mùa: mùa bão thì dễ có bão, hạn mặn và nắng nóng thì dễ nắng gắt, mưa lũ thì mưa nhiều.
  if (hazard?.id === 'bao') odds = [0.25, 0.2, 0.32, 0.08, 0.15];
  else if (hazard?.id === 'lu') odds = [0.15, 0.2, 0.5, 0.03, 0.12];
  else if (hazard?.id === 'han_man' || hazard?.id === 'nang_nong') odds = [0.3, 0.15, 0.1, 0.45, 0];
  let kind: WeatherKind = 'nang', acc = 0;
  for (let i = 0; i < odds.length; i++) { acc += odds[i]; if (u < acc) { kind = WEATHER_ORDER[i]; break; } }
  const info = WEATHER_INFO[kind];
  const growth = Math.round(info.growth * (hazard?.growth ?? 1) * 1000) / 1000;
  return { kind, label: info.label, icon: info.icon, growth, until: (slot + 1) * WEATHER_SLOT_MS, ...(hazard ? { hazard } : {}) };
}

// ---------------------------------------------------------------- chợ phiên
export interface MarketDay { active: boolean; startsAt: number; endsAt: number }
export const MARKET_DAY_BONUS = 0.1, COOP_BONUS = 0.05, CITY_BONUS = 0.1;
/** Chợ phiên họp thứ Bảy và Chủ nhật theo giờ Việt Nam (UTC+7). */
export function marketDayAt(nowMs: number): MarketDay {
  const DAY = 86400_000, TZ = 7 * 3600_000;
  const day = Math.floor((nowMs + TZ) / DAY);
  const dow = (((day + 4) % 7) + 7) % 7; // 0 = Chủ nhật
  const active = dow === 6 || dow === 0;
  const saturday = dow === 0 ? day - 1 : day + (6 - dow);
  const startsAt = saturday * DAY - TZ;
  return { active, startsAt, endsAt: startsAt + 2 * DAY };
}

/** Lịch chợ theo tuần (giờ Việt Nam): chợ phiên cuối tuần ở mọi miền, chợ nổi thứ Tư ở miền Nam. */
export interface MarketEvent { id: 'cho_phien' | 'cho_noi'; name: string; icon: string; bonus: number; active: boolean; startsAt: number; endsAt: number }
export const FLOATING_BONUS = 0.15;
export function marketEventsAt(regionId: string, nowMs: number): MarketEvent[] {
  const md = marketDayAt(nowMs);
  const out: MarketEvent[] = [{ id: 'cho_phien', name: 'Chợ phiên', icon: '🎪', bonus: MARKET_DAY_BONUS, active: md.active, startsAt: md.startsAt, endsAt: md.endsAt }];
  if (REGIONS[regionId]?.zone === 'nam') {
    const DAY = 86400_000;
    const day = Math.floor((nowMs + VN_TZ_MS) / DAY);
    const dow = (((day + 4) % 7) + 7) % 7; // 0 = Chủ nhật, 3 = thứ Tư
    const wednesday = day + ((3 - dow + 7) % 7);
    const startsAt = wednesday * DAY - VN_TZ_MS;
    out.push({ id: 'cho_noi', name: 'Chợ nổi', icon: '🛶', bonus: FLOATING_BONUS, active: dow === 3, startsAt, endsAt: startsAt + DAY });
  }
  return out;
}

// ---------------------------------------------------------------- vai trò (được giao bằng vòng quay), xưởng, đơn hàng
export type Role = 'nong_dan' | 'xuong' | 'thuong_lai';
export const ROLE_INFO: Record<Role, { name: string; icon: string; desc: string }> = {
  nong_dan: { name: 'Nhà vườn', icon: '🧑‍🌾', desc: 'Vườn lớn 30 ô và được thưởng sản lượng khi thu đúng chính vụ. Bán hàng qua sạp cho thương lái và chủ xưởng.' },
  xuong: { name: 'Chủ xưởng', icon: '🏭', desc: 'Không trồng trọt: lô đất là nhà xưởng với các máy chế biến. Mua nông sản về làm trái sấy, nước ép, mứt, cà phê rang… rồi bán cho siêu thị, doanh nghiệp hoặc xuất khẩu.' },
  thuong_lai: { name: 'Thương lái', icon: '🚚', desc: 'Chỉ thương lái mới bán cho doanh nghiệp được giá đầy đủ, và lái xe chở hàng sang vùng khác. Vườn nhỏ 8 ô.' },
};
export const ROLES = Object.keys(ROLE_INFO) as Role[];
/** Mỗi mùa dài bấy nhiêu ngày; hết mùa người chơi được quay lại vai trò. */
export const SEASON_DAYS = 30;
/** Tỉ lệ vai trò mong muốn trong một vùng: nông thôn nhiều nhà vườn, phố nhiều thương lái và chủ xưởng. */
export const ROLE_TARGETS: { rural: Record<Role, number>; urban: Record<Role, number> } = {
  rural: { nong_dan: 0.65, xuong: 0.15, thuong_lai: 0.2 },
  urban: { nong_dan: 0.3, xuong: 0.3, thuong_lai: 0.4 },
};
/** Trọng số vòng quay: nghiêng về vai đang thiếu so với tỉ lệ mong muốn, tổng bằng 1. */
export function spinWeights(targets: Record<Role, number>, counts: Record<Role, number>): Record<Role, number> {
  const total = ROLES.reduce((sum, r) => sum + Math.max(0, counts[r] ?? 0), 0);
  const raw = {} as Record<Role, number>;
  for (const r of ROLES) {
    const actual = total > 0 ? Math.max(0, counts[r] ?? 0) / total : targets[r];
    raw[r] = targets[r] * Math.min(3, Math.max(0.5, targets[r] / Math.max(actual, 0.01)));
  }
  const sum = ROLES.reduce((acc, r) => acc + raw[r], 0);
  for (const r of ROLES) raw[r] /= sum;
  return raw;
}
/** Vườn nhỏ của thương lái: 8 ô, hàng 1..2 × cột 1..4. Chủ xưởng không có ô trồng: lô của họ là nhà xưởng. */
export const SMALL_TILES: number[] = [1, 2].flatMap((row) => [1, 2, 3, 4].map((col) => row * PLOT_COLS + col));
/** Các ô được trồng của một lô, theo kiểu lô và vai trò của chủ lô. */
export function allowedTiles(kind: 'ground' | 'rooftop', role: Role | null): number[] {
  if (!role || role === 'xuong') return [];
  if (role !== 'nong_dan') return SMALL_TILES;
  return kind === 'rooftop' ? ROOFTOP_TILES : Array.from({ length: TILE_COUNT }, (_, i) => i);
}
/** Người không phải thương lái chỉ "bán tháo" được cho doanh nghiệp ở mức này so với giá tham chiếu. */
export const DUMP_RATIO = 0.6;
/** Tiền xăng mỗi km của một chuyến xe (cách tính cũ, giữ lại cho mã cũ còn tham chiếu). */
export const FUEL_PER_KM = 300;

/** Xe tải của thương lái: bình xăng, mức tiêu hao, giá xăng, trạm thu phí, trạm xăng, cứu hộ. */
export const TRUCK = { tankL: 60, lPer100km: 12, fuelPrice: fuelPriceNow('ron95'), tollEveryKm: 70, tollFee: Math.round((70 * tollPerKmGroup1()) / 1000) * 1000, stationEveryKm: 60, rescueMult: 1.5, etcCashSurcharge: 0.2, startFuelL: 30, cargoKg: 990 };
export interface TripPlan {
  km: number; needsBoat: boolean; seconds: number; tolls: number; tollFee: number; fuelNeededL: number;
  junctions: { atKm: number; dir: 'L' | 'R'; name: string }[]; stationsAtKm: number[];
  /** Sức chở của thùng xe (kg): lượng hàng thu mua sỉ được ở mỗi điểm đỗ. */
  cargoKg: number;
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Phần đường bộ của một chuyến: chuyến có chặng tàu thì 60% quãng đường là đường bộ. */
export function roadKm(km: number, needsBoat: boolean): number {
  return needsBoat ? Math.round(km * 0.6) : km;
}
/** Lộ trình một chuyến xe tải, tất định theo cặp vùng: nút giao phải rẽ, trạm xăng, trạm thu phí, lượng xăng cần. */
export function tripPlan(fromRegionId: string, toRegionId: string): TripPlan {
  const a = REGIONS[fromRegionId], b = REGIONS[toRegionId];
  const km = Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng));
  const needsBoat = !!(a.island || b.island);
  const road = roadKm(km, needsBoat);
  const tolls = road >= 40 ? Math.max(1, Math.floor(road / TRUCK.tollEveryKm)) : 0;
  // Các vùng trồng nằm gần tuyến (trừ hai đầu), xếp theo vị trí dọc tuyến, để đặt tên nút giao.
  const near = Object.values(REGIONS)
    .filter((r) => r.id !== a.id && r.id !== b.id)
    .map((r) => ({ r, da: haversineKm(a.lat, a.lng, r.lat, r.lng), db: haversineKm(b.lat, b.lng, r.lat, r.lng) }))
    .filter((x) => x.da + x.db <= km * 1.25 + 60)
    .sort((x, y) => x.da - y.da || (x.r.id < y.r.id ? -1 : 1));
  const count = Math.min(5, Math.max(2, 2 + Math.floor(road / 150)));
  const junctions: TripPlan['junctions'] = [];
  for (let i = 0; i < count; i++) {
    const last = i === count - 1;
    const atKm = Math.max(1, Math.round((road * (i + 1)) / (count + 0.25)));
    const dir = hashStr(`${fromRegionId}>${toRegionId}#${i}`) % 2 === 0 ? 'L' : 'R';
    const via = near.length ? near[Math.min(near.length - 1, Math.floor((i * near.length) / count))].r : b;
    junctions.push({ atKm, dir, name: last ? `Lối ra ${b.name}` : `Nút giao ${via.name}` });
  }
  const stationsAtKm: number[] = [];
  for (let k = TRUCK.stationEveryKm; k < road; k += TRUCK.stationEveryKm) stationsAtKm.push(k);
  return {
    km, needsBoat, seconds: Math.min(75, Math.max(30, Math.round(25 + km / 12))), tolls, tollFee: TRUCK.tollFee,
    fuelNeededL: Math.round(((road * TRUCK.lPer100km) / 100) * 10) / 10, junctions, stationsAtKm, cargoKg: TRUCK.cargoKg,
  };
}
/** Thông tin tóm tắt một chuyến xe: quãng đường, ước tính tổng chi phí (xăng + phí đường), có chặng tàu không, thời lượng màn lái (giây). */
export function tripInfo(fromRegionId: string, toRegionId: string): { km: number; fuel: number; needsBoat: boolean; seconds: number } {
  const p = tripPlan(fromRegionId, toRegionId);
  return { km: p.km, fuel: Math.round((p.fuelNeededL * TRUCK.fuelPrice + p.tolls * TRUCK.tollFee) / 1000) * 1000, needsBoat: p.needsBoat, seconds: p.seconds };
}

let landPrices: Record<string, number> | null = null;
/** Giá một lô đất theo vùng: vùng cho nông sản giá trị cao (tiền thu mỗi giờ trồng) thì đất đắt hơn; đảo đắt hơn 30%. */
export function landPrice(regionId: string): number {
  if (!landPrices) {
    const value: Record<string, number> = {};
    for (const r of Object.values(REGIONS)) {
      const sps = Object.values(SPECIALTIES).filter((sp) => sp.regionId === r.id);
      value[r.id] = sps.reduce((sum, sp) => sum + (sp.refPrice * CROPS[sp.crop].yieldKg) / CROPS[sp.crop].growHours, 0) / Math.max(1, sps.length);
    }
    const sorted = Object.values(value).sort((x, y) => x - y), n = sorted.length;
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    landPrices = {};
    for (const r of Object.values(REGIONS)) {
      const raw = LAND_PRICE * Math.pow(value[r.id] / median, 0.7) * (r.island ? 1.3 : 1);
      landPrices[r.id] = Math.min(200_000_000, Math.max(15_000_000, Math.round(raw / 1_000_000) * 1_000_000));
    }
  }
  return landPrices[regionId] ?? LAND_PRICE;
}
/** Khách vãng lai của thương lái ở phố: mua tối đa bấy nhiêu kg mỗi giờ cho mỗi tin rao có giá không quá mức này so với giá tham chiếu. */
export const STALL_WALKIN_KG_PER_HOUR = 5, STALL_WALKIN_MAX_RATIO = 1.15;
export const PROCESS_SLOTS = 2, PROCESS_SLOTS_XUONG = 4, PROCESS_SPEED_XUONG = 0.5;
/** Người phụ thu hoạch được chia phần này trong sản lượng. */
export const HARVEST_HELP_SHARE = 0.1;
export const COOP_ORDER_BONUS = 0.25, COOP_ORDER_KG_PER_MEMBER = 100, COOP_ORDER_DAYS = 7;
export const ORDERS_PER_DAY = 3, ORDER_PREMIUM = 1.3;
/** Nguồn cung ước tính của một đặc sản: lượng đã bán 24 giờ qua cộng một nửa sản lượng đang nằm ngoài ruộng. */
export function supplyKg(kg24h: number, plantedTiles: number, yieldKg: number): number {
  return kg24h + plantedTiles * yieldKg * 0.5;
}

// ---------------------------------------------------------------- được mùa mất giá, hợp tác xã, du lịch, quà
/** Hợp tác xã theo Luật Hợp tác xã 2023 (17/2023/QH15, hiệu lực 01/7/2024):
 * - ít nhất 5 thành viên chính thức (khoản 7 Điều 4; luật 2012 là 7) → COOP_MIN_MEMBERS;
 * - luật không giới hạn số thành viên tối đa; game giữ trần 200 chỉ để danh sách và đơn lớn không phình quá;
 * - không có vốn điều lệ tối thiểu: mức góp do điều lệ HTX quyết định → game đặt mỗi thành viên góp COOP_CAPITAL, ra khỏi HTX được trả lại vốn góp;
 * - lệ phí cấp mới Giấy chứng nhận đăng ký HTX do HĐND tỉnh quy định (Thông tư 85/2019/TT-BTC), phổ biến 100.000 đ/lần (ví dụ HĐND Tuyên Quang) → COOP_REG_FEE;
 * - nộp hồ sơ tại bộ phận một cửa, Cơ quan đăng ký kinh doanh cấp xã (từ 01/7/2025, NĐ 125/2025/NĐ-CP thay cho cấp huyện của NĐ 92/2024/NĐ-CP);
 *   hồ sơ: đề nghị đăng ký, điều lệ, phương án sản xuất kinh doanh, danh sách thành viên, nghị quyết hội nghị thành lập (Điều 42 Luật HTX 2023);
 * - cơ quan đăng ký giải quyết trong 3 ngày làm việc; game rút gọn còn COOP_REG_MINUTES phút. */
export const COOP_MIN_MEMBERS = 5, COOP_MAX_MEMBERS = 200, COOP_CAPITAL = 500_000, COOP_REG_FEE = 100_000, COOP_REG_MINUTES = 30;
/** Giữ tên cũ cho mã cũ: chi phí lập = vốn góp của người sáng lập (lệ phí nộp sau, khi nộp hồ sơ). */
export const COOP_CREATE_COST = COOP_CAPITAL;
export type CoopStatus = 'dang_lap' | 'cho_cap' | 'hoat_dong';
export const COOP_STATUS_NAMES: Record<CoopStatus, string> = { dang_lap: 'Đang vận động thành viên', cho_cap: 'Đã nộp hồ sơ, chờ cấp giấy', hoat_dong: 'Đang hoạt động' };
export const GLUT_KG = 3000, GLUT_MAX_DROP = 0.3;
/** Hệ số giá khi cả máy chủ bán nhiều một loại trong 24 giờ: càng nhiều càng rớt, tối đa GLUT_MAX_DROP. */
export function glutFactor(kg24h: number): number {
  return 1 - GLUT_MAX_DROP * Math.min(1, Math.max(0, kg24h) / GLUT_KG);
}
/** Quà đặc sản bán đắt hơn mọi mức thương lái trả (kể cả cộng dồn thưởng) và giới hạn số lần mua mỗi ngày, để không mua đi bán lại kiếm lời. */
export const TRAVEL_COST = 20_000, SOUVENIR_RATIO = 1.8, SOUVENIR_MAX_KG = 5, SOUVENIR_DAILY_BUYS = 3;
/** Phương tiện đi du lịch. Giá vé tính bằng các hàm bên dưới theo giá thật (shared/realPrices.ts); seconds là thời lượng hoạt cảnh. */
export type TravelMode = 'xe_khach' | 'tau_hoa' | 'may_bay' | 'tau_thuy' | 'taxi';
export const TRAVEL_MODES: Record<TravelMode, { name: string; icon: string; base: number; perKm: number; seconds: number }> = {
  xe_khach: { name: 'Xe khách', icon: '🚌', base: 100_000, perKm: 800, seconds: 10 },
  tau_hoa: { name: 'Tàu hoả', icon: '🚆', base: 30_000, perKm: 590, seconds: 10 },
  may_bay: { name: 'Máy bay', icon: '✈️', base: 600_000, perKm: 1_100, seconds: 8 },
  tau_thuy: { name: 'Tàu thuỷ', icon: '⛴️', base: 100_000, perKm: 2_200, seconds: 10 },
  taxi: { name: 'Taxi', icon: '🚕', base: 20_000, perKm: 15_500, seconds: 12 },
};
/** Đường bộ thực tế dài hơn đường chim bay (đèo, vòng qua sông, núi); hệ số bình quân các tuyến quốc lộ VN
 *  (Hà Nội – Sài Gòn: 1.140 km chim bay, ~1.650 km QL1). */
export const ROAD_FACTOR = 1.35;
export const roadKmOf = (straightKm: number): number => Math.max(1, Math.round(straightKm * ROAD_FACTOR));
/** Taxi chỉ chạy chặng ngắn trên đất liền (km đường bộ). Xa hơn thì xe khách, tàu rẻ hơn nhiều lần. */
export const TAXI_MAX_KM = 200;
/** Cước taxi 4 chỗ theo bậc: mở cửa km đầu, km 2–25, từ km 26 (làm tròn nghìn đồng). */
export function taxiFare(km: number): number {
  const k = Math.max(1, km);
  const v = refPrice('taxi_mo_cua') + Math.min(24, Math.max(0, k - 1)) * refPrice('taxi_km_2_25') + Math.max(0, k - 25) * refPrice('taxi_km_26');
  return Math.round(v / 1000) * 1000;
}
/** Chặng ra/vào ga, sân bay: gần (≤ 15 km) thì taxi, xa hơn thì xe buýt/xe trung chuyển. */
export function transferFare(km: number): number {
  return km <= 15 ? taxiFare(km) : Math.round((20_000 + refPrice('xe_trung_chuyen_km') * km) / 1000) * 1000;
}
/** Vé xe khách theo km đường bộ: phần cố định tăng dần tới đủ mức ở chặng 150 km (chặng ngắn là xe ghế ngồi, rẻ),
 *  500 km đầu giá cao hơn, tuyến dài rẻ dần. */
export function busFare(roadKm: number): number {
  const fixed = Math.min(refPrice('xe_khach_mo_ve'), 20_000 + (roadKm * (refPrice('xe_khach_mo_ve') - 20_000)) / 150);
  const v = fixed + Math.min(500, roadKm) * refPrice('xe_khach_km_ngan') + Math.max(0, roadKm - 500) * refPrice('xe_khach_km_dai');
  return Math.round(v / 1000) * 1000;
}
/** Tốc độ bình quân thực tế (km/h): xe khách kể cả dừng nghỉ, taxi, tàu SE (Hà Nội – Sài Gòn ~33 giờ), máy bay, xe trung chuyển. */
export const SPEED_KMH = { bus: 50, taxi: 50, train: 52, plane: 650, transfer: 40 };
/** Thời gian thủ tục ở sân bay (đến sớm, an ninh, chờ lên máy bay, nhận hành lý) và ở ga. */
export const AIRPORT_HOURS = 2, STATION_HOURS = 0.5;
const roundH = (h: number): number => Math.max(0.5, Math.round(h * 2) / 2);

/** Cảng hàng không dân dụng có chuyến bay nội địa thường lệ (toạ độ nhà ga). */
export const AIRPORTS: { code: string; name: string; lat: number; lng: number }[] = [
  { code: 'HAN', name: 'Nội Bài', lat: 21.221, lng: 105.807 }, { code: 'HPH', name: 'Cát Bi', lat: 20.819, lng: 106.725 },
  { code: 'VDO', name: 'Vân Đồn', lat: 21.118, lng: 107.414 }, { code: 'DIN', name: 'Điện Biên', lat: 21.397, lng: 103.008 },
  { code: 'THD', name: 'Thọ Xuân', lat: 19.902, lng: 105.468 }, { code: 'VII', name: 'Vinh', lat: 18.737, lng: 105.671 },
  { code: 'VDH', name: 'Đồng Hới', lat: 17.515, lng: 106.591 }, { code: 'HUI', name: 'Phú Bài', lat: 16.401, lng: 107.703 },
  { code: 'DAD', name: 'Đà Nẵng', lat: 16.044, lng: 108.199 }, { code: 'VCL', name: 'Chu Lai', lat: 15.403, lng: 108.706 },
  { code: 'PXU', name: 'Pleiku', lat: 14.004, lng: 108.017 }, { code: 'UIH', name: 'Phù Cát', lat: 13.955, lng: 109.042 },
  { code: 'TBB', name: 'Tuy Hoà', lat: 13.05, lng: 109.334 }, { code: 'CXR', name: 'Cam Ranh', lat: 11.998, lng: 109.219 },
  { code: 'BMV', name: 'Buôn Ma Thuột', lat: 12.668, lng: 108.12 }, { code: 'DLI', name: 'Liên Khương', lat: 11.75, lng: 108.367 },
  { code: 'SGN', name: 'Tân Sơn Nhất', lat: 10.819, lng: 106.652 }, { code: 'VCA', name: 'Cần Thơ', lat: 10.085, lng: 105.712 },
  { code: 'PQC', name: 'Phú Quốc', lat: 10.17, lng: 103.993 }, { code: 'VKG', name: 'Rạch Giá', lat: 9.958, lng: 105.133 },
  { code: 'CAH', name: 'Cà Mau', lat: 9.177, lng: 105.178 }, { code: 'VCS', name: 'Côn Đảo', lat: 8.732, lng: 106.633 },
];
/** Vùng cách sân bay quá mức này thì coi như không có sân bay gần; chặng bay ngắn hơn mức dưới thì không có đường bay thường lệ. */
export const AIRPORT_MAX_KM = 150, FLIGHT_MIN_KM = 200, ISLAND_AIRPORT_KM = 30;
/** Ba sân bay trung chuyển; sân bay địa phương thường chỉ có đường bay thẳng tới các sân bay này. */
export const AIRPORT_HUBS = ['HAN', 'SGN', 'DAD'];
/** Các sân bay trong tầm AIRPORT_MAX_KM của một vùng, kèm quãng đường bộ ước tính. Vùng trên đảo chỉ dùng sân bay ngay trên đảo. */
export function airportsNear(regionId: string): { code: string; name: string; lat: number; lng: number; km: number }[] {
  const r = region(regionId);
  if (!r) return [];
  return AIRPORTS.map((a) => ({ ...a, km: haversineKm(r.lat, r.lng, a.lat, a.lng) }))
    .filter((a) => a.km <= (r.island ? ISLAND_AIRPORT_KM : AIRPORT_MAX_KM))
    .map((a) => ({ ...a, km: Math.max(3, roadKmOf(a.km)) }))
    .sort((x, y) => x.km - y.km);
}
/** Vé máy bay phổ thông (đã gồm thuế, phí sân bay) theo km bay. */
export function flightTicket(airKm: number): number {
  return Math.round((refPrice('may_bay_co_ban') + refPrice('may_bay_km') * airKm) / 1000) * 1000;
}
export interface FlightPlan { from: string; to: string; airKm: number; fare: number; ticket: number; groundKm: number; hours: number }
/** Chuyến bay giữa hai vùng: ra sân bay + vé bay + từ sân bay về. Chọn cặp sân bay có đường bay thẳng
 *  (ít nhất một đầu là sân bay trung chuyển) và tổng đường bộ ngắn nhất. null nếu không có đường bay hợp lý. */
export function flightPlan(fromRegionId: string, toRegionId: string): FlightPlan | null {
  let best: FlightPlan | null = null;
  for (const a of airportsNear(fromRegionId)) for (const b of airportsNear(toRegionId)) {
    if (a.code === b.code || !(AIRPORT_HUBS.includes(a.code) || AIRPORT_HUBS.includes(b.code))) continue;
    const airKm = Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng));
    if (airKm < FLIGHT_MIN_KM || (best && a.km + b.km >= best.groundKm)) continue;
    const ticket = flightTicket(airKm);
    best = { from: a.name, to: b.name, airKm, ticket, groundKm: a.km + b.km, fare: ticket + transferFare(a.km) + transferFare(b.km),
      hours: roundH(AIRPORT_HOURS + airKm / SPEED_KMH.plane + 0.3 + (a.km + b.km) / SPEED_KMH.transfer) };
  }
  return best;
}

/** Ga khách đang có tàu chạy thường lệ. `line` là tuyến, `km` là lý trình tính từ ga Hà Nội (các tuyến nối nhau ở Hà Nội).
 *  Nguồn: lý trình đường sắt Thống Nhất và các tuyến phía Bắc (Hà Nội – Lào Cai, Hải Phòng, Đồng Đăng, Quán Triều) của
 *  Đường sắt Việt Nam; toạ độ nhà ga. Tuyến Đà Lạt – Trại Mát (7 km) chỉ là tàu du lịch, không nối mạng quốc gia nên không có ở đây. */
export type RailLine = 'thong_nhat' | 'lao_cai' | 'hai_phong' | 'dong_dang' | 'quan_trieu';
export const RAIL_STATIONS: { id: string; name: string; line: RailLine; km: number; lat: number; lng: number }[] = [
  { id: 'ha_noi', name: 'Hà Nội', line: 'thong_nhat', km: 0, lat: 21.0245, lng: 105.8412 },
  { id: 'phu_ly', name: 'Phủ Lý', line: 'thong_nhat', km: 56, lat: 20.5436, lng: 105.9136 },
  { id: 'nam_dinh', name: 'Nam Định', line: 'thong_nhat', km: 87, lat: 20.4334, lng: 106.1707 },
  { id: 'ninh_binh', name: 'Ninh Bình', line: 'thong_nhat', km: 115, lat: 20.2539, lng: 105.9732 },
  { id: 'bim_son', name: 'Bỉm Sơn', line: 'thong_nhat', km: 141, lat: 20.077, lng: 105.8615 },
  { id: 'thanh_hoa', name: 'Thanh Hoá', line: 'thong_nhat', km: 175, lat: 19.8075, lng: 105.7712 },
  { id: 'cho_sy', name: 'Chợ Sy', line: 'thong_nhat', km: 279, lat: 19.0225, lng: 105.6047 },
  { id: 'vinh', name: 'Vinh', line: 'thong_nhat', km: 319, lat: 18.6835, lng: 105.6719 },
  { id: 'huong_pho', name: 'Hương Phố', line: 'thong_nhat', km: 387, lat: 18.2156, lng: 105.6995 },
  { id: 'dong_le', name: 'Đồng Lê', line: 'thong_nhat', km: 436, lat: 17.8853, lng: 106.0247 },
  { id: 'dong_hoi', name: 'Đồng Hới', line: 'thong_nhat', km: 522, lat: 17.4625, lng: 106.6052 },
  { id: 'dong_ha', name: 'Đông Hà', line: 'thong_nhat', km: 622, lat: 16.816, lng: 107.096 },
  { id: 'hue', name: 'Huế', line: 'thong_nhat', km: 688, lat: 16.4567, lng: 107.5786 },
  { id: 'da_nang', name: 'Đà Nẵng', line: 'thong_nhat', km: 791, lat: 16.0715, lng: 108.2095 },
  { id: 'tam_ky', name: 'Tam Kỳ', line: 'thong_nhat', km: 865, lat: 15.5715, lng: 108.4706 },
  { id: 'quang_ngai', name: 'Quảng Ngãi', line: 'thong_nhat', km: 928, lat: 15.1203, lng: 108.7871 },
  { id: 'bong_son', name: 'Bồng Sơn', line: 'thong_nhat', km: 1017, lat: 14.4267, lng: 109.0127 },
  { id: 'dieu_tri', name: 'Diêu Trì', line: 'thong_nhat', km: 1096, lat: 13.8015, lng: 109.1436 },
  { id: 'tuy_hoa', name: 'Tuy Hoà', line: 'thong_nhat', km: 1198, lat: 13.087, lng: 109.2995 },
  { id: 'nha_trang', name: 'Nha Trang', line: 'thong_nhat', km: 1315, lat: 12.2486, lng: 109.1817 },
  { id: 'ninh_hoa', name: 'Ninh Hoà', line: 'thong_nhat', km: 1281, lat: 12.4925, lng: 109.1336 },
  { id: 'thap_cham', name: 'Tháp Chàm', line: 'thong_nhat', km: 1408, lat: 11.5952, lng: 108.9469 },
  { id: 'binh_thuan', name: 'Bình Thuận', line: 'thong_nhat', km: 1551, lat: 10.9853, lng: 108.0391 },
  { id: 'long_khanh', name: 'Long Khánh', line: 'thong_nhat', km: 1649, lat: 10.9392, lng: 107.2425 },
  { id: 'bien_hoa', name: 'Biên Hoà', line: 'thong_nhat', km: 1697, lat: 10.9462, lng: 106.8216 },
  { id: 'sai_gon', name: 'Sài Gòn', line: 'thong_nhat', km: 1726, lat: 10.7823, lng: 106.6772 },
  { id: 'yen_bai', name: 'Yên Bái', line: 'lao_cai', km: 155, lat: 21.7228, lng: 104.9113 },
  { id: 'lao_cai', name: 'Lào Cai', line: 'lao_cai', km: 294, lat: 22.5013, lng: 103.965 },
  { id: 'hai_duong', name: 'Hải Dương', line: 'hai_phong', km: 57, lat: 20.9437, lng: 106.3304 },
  { id: 'hai_phong', name: 'Hải Phòng', line: 'hai_phong', km: 102, lat: 20.859, lng: 106.687 },
  { id: 'bac_giang', name: 'Bắc Giang', line: 'dong_dang', km: 50, lat: 21.272, lng: 106.1946 },
  { id: 'lang_son', name: 'Lạng Sơn', line: 'dong_dang', km: 148, lat: 21.8467, lng: 106.7616 },
  { id: 'dong_dang', name: 'Đồng Đăng', line: 'dong_dang', km: 162, lat: 21.942, lng: 106.7015 },
  { id: 'thai_nguyen', name: 'Thái Nguyên', line: 'quan_trieu', km: 75, lat: 21.606, lng: 105.823 },
];
/** Vùng cách ga quá mức này (km đường bộ) thì coi như không đi tàu được; chặng tàu ngắn hơn mức dưới thì không đáng đi tàu. */
export const STATION_MAX_KM = 80, RAIL_MIN_KM = 80;
/** Km đường sắt giữa hai ga: cùng tuyến lấy hiệu lý trình, khác tuyến đi qua Hà Nội. */
export function railKmBetween(a: { line: RailLine; km: number }, b: { line: RailLine; km: number }): number {
  return a.line === b.line ? Math.abs(a.km - b.km) : a.km + b.km;
}
/** Các ga trong tầm STATION_MAX_KM đường bộ của một vùng (vùng trên đảo không có ga). */
export function stationsNear(regionId: string): { id: string; name: string; line: RailLine; km: number; groundKm: number }[] {
  const r = region(regionId);
  if (!r || r.island) return [];
  return RAIL_STATIONS.map((s) => ({ ...s, groundKm: Math.max(2, roadKmOf(haversineKm(r.lat, r.lng, s.lat, s.lng))) }))
    .filter((s) => s.groundKm <= STATION_MAX_KM).sort((x, y) => x.groundKm - y.groundKm);
}
/** Vé tàu SE ghế ngồi mềm điều hoà theo km đường sắt. */
export function trainTicket(railKm: number): number {
  return Math.round((refPrice('tau_mo_ve') + refPrice('tau_ghe_mem_km') * railKm) / 1000) * 1000;
}
export interface TrainPlan { from: string; to: string; railKm: number; fare: number; ticket: number; groundKm: number; hours: number }
/** Chuyến tàu giữa hai vùng: ra ga + vé tàu + từ ga về. Chọn cặp ga có tổng đường bộ ngắn nhất. */
export function trainPlan(fromRegionId: string, toRegionId: string): TrainPlan | null {
  let best: TrainPlan | null = null;
  for (const a of stationsNear(fromRegionId)) for (const b of stationsNear(toRegionId)) {
    if (a.id === b.id) continue;
    const railKm = railKmBetween(a, b);
    if (railKm < RAIL_MIN_KM || (best && a.groundKm + b.groundKm >= best.groundKm)) continue;
    const ticket = trainTicket(railKm);
    best = { from: a.name, to: b.name, railKm, ticket, groundKm: a.groundKm + b.groundKm, fare: ticket + transferFare(a.groundKm) + transferFare(b.groundKm),
      hours: roundH(STATION_HOURS + railKm / SPEED_KMH.train + (a.groundKm + b.groundKm) / SPEED_KMH.transfer) };
  }
  return best;
}
/** Một lựa chọn đi lại. km là quãng đường bộ (taxi, xe khách), đường ray (tàu), đường bay (máy bay), đường biển (tàu thuỷ); hours là tổng thời gian. */
export interface TravelOption { mode: TravelMode; fare: number; km: number; hours: number; via?: string }
/** Xe khách tuyến dài hơn mức này (km đường bộ): giường nằm chạy xuyên đêm, có thể phải đổi xe ở bến lớn. */
export const BUS_LONG_KM = 1000;
/** Vé tàu cao tốc ra đảo theo km đường biển (Rạch Giá – Phú Quốc ~115 km: 330.000–350.000đ). */
export function boatTripFare(km: number): number {
  return Math.round((refPrice('tau_cao_toc_mo_ve') + refPrice('tau_cao_toc_km') * Math.max(0, km)) / 1000) * 1000;
}
/** Tuyến tàu thường lệ từ cảng đất liền ra các vùng trên đảo (km đường biển, giờ chạy tàu). */
export const ISLAND_FERRIES: Record<string, { port: string; lat: number; lng: number; seaKm: number; hours: number; boat: string }> = {
  ag_phuquoc: { port: 'bến tàu Rạch Giá', lat: 10.012, lng: 105.08, seaKm: 115, hours: 2.75, boat: 'tàu cao tốc' },
  hcm_condao: { port: 'cảng Trần Đề', lat: 9.49, lng: 106.21, seaKm: 85, hours: 2.5, boat: 'tàu cao tốc' },
  qng_lyson: { port: 'cảng Sa Kỳ', lat: 15.21, lng: 108.92, seaKm: 30, hours: 1, boat: 'tàu cao tốc' },
  hp_catba: { port: 'bến Bính (Hải Phòng)', lat: 20.87, lng: 106.68, seaKm: 40, hours: 1, boat: 'tàu cao tốc' },
};
/** Chuyến tàu ra/vào đảo: đi đường bộ (xe khách hoặc trung chuyển) tới cảng đất liền + vé tàu. Hai đảo khác nhau thì về đất liền rồi ra đảo kia. */
export function ferryPlan(fromRegionId: string, toRegionId: string): { fare: number; km: number; hours: number; via: string } | null {
  const a = region(fromRegionId), b = region(toRegionId);
  if (!a || !b) return null;
  let fare = 0, km = 0, hours = 0, cur: { lat: number; lng: number } = a;
  const names: string[] = [];
  const ground = (to: { lat: number; lng: number }) => {
    const road = roadKmOf(haversineKm(cur.lat, cur.lng, to.lat, to.lng));
    if (road > 2) { fare += road <= 60 ? transferFare(road) : busFare(road); km += road; hours += 0.5 + road / SPEED_KMH.bus; }
  };
  const fa = a.island ? ISLAND_FERRIES[a.id] : undefined, fb = b.island ? ISLAND_FERRIES[b.id] : undefined;
  if ((a.island && !fa) || (b.island && !fb)) return null;
  if (fa) { fare += boatTripFare(fa.seaKm); km += fa.seaKm; hours += fa.hours + 0.5; cur = fa; names.push(`${fa.boat} vào ${fa.port}`); }
  if (fb) { ground(fb); fare += boatTripFare(fb.seaKm); km += fb.seaKm; hours += fb.hours + 0.5; names.push(`xe tới ${fb.port}, ${fb.boat} ra đảo`); }
  else ground(b);
  return { fare: Math.round(fare / 1000) * 1000, km, hours: roundH(hours), via: names.join(', ') };
}
/** Các phương tiện đi được giữa hai vùng, kèm giá vé và thời gian. Ra vào đảo phải đi tàu thuỷ hoặc máy bay; máy bay chỉ khi
 *  hai đầu đều gần sân bay có đường bay; tàu hoả chỉ khi hai đầu đều gần ga trên mạng đường sắt. */
export function travelOptions(fromRegionId: string, toRegionId: string): TravelOption[] {
  const a = region(fromRegionId), b = region(toRegionId);
  if (!a || !b || a.id === b.id) return [];
  const straight = haversineKm(a.lat, a.lng, b.lat, b.lng), road = roadKmOf(straight);
  const out: TravelOption[] = [];
  if (a.island || b.island) {
    const ferry = ferryPlan(a.id, b.id);
    if (ferry) out.push({ mode: 'tau_thuy', ...ferry });
  } else {
    out.push({ mode: 'xe_khach', fare: busFare(road), km: road, hours: roundH(0.5 + road / SPEED_KMH.bus), ...(road > BUS_LONG_KM ? { via: 'giường nằm tuyến dài, có thể đổi xe' } : {}) });
    if (road <= TAXI_MAX_KM) out.push({ mode: 'taxi', fare: taxiFare(road), km: road, hours: roundH(road / SPEED_KMH.taxi) });
    const train = trainPlan(a.id, b.id);
    if (train) out.push({ mode: 'tau_hoa', fare: train.fare, km: train.railKm, hours: train.hours, via: `ga ${train.from} → ga ${train.to}` });
  }
  // Máy bay chỉ hiện khi thật sự nhanh hơn đi đường bộ (tính cả thủ tục sân bay và đường ra/vào sân bay).
  const fly = flightPlan(a.id, b.id), busH = out.find((o) => o.mode === 'xe_khach')?.hours ?? Infinity, boatH = out.find((o) => o.mode === 'tau_thuy')?.hours ?? Infinity;
  if (fly && fly.hours < Math.min(busH, boatH === Infinity ? Infinity : boatH * 2)) out.push({ mode: 'may_bay', fare: fly.fare, km: fly.airKm, hours: fly.hours, via: `${fly.from} → ${fly.to}` });
  return out;
}
export const GIFT_DAILY_LIMIT = 5, GIFT_MAX_KG = 20, REGION_SET_REWARD = 50_000;

// ---------------------------------------------------------------- điểm tham quan và siêu thị đặc sản
/** Quãng taxi ngắn nhất tới một điểm tham quan, thưởng lần đầu đi hết mọi điểm dừng, thời lượng hoạt cảnh taxi. */
export const SIGHT_MIN_KM = 3, SIGHT_REWARD = 30_000, SIGHT_TAXI_SECONDS = 12;
/** Một chặng trên đường tới điểm tham quan. */
export interface SightLeg { mode: 'taxi' | 'tau_thuy'; from: string; to: string; km: number; fare: number; seconds: number; /** Tên loại tàu (chặng tàu). */ boat?: string }
export interface SightRoute { legs: SightLeg[]; total: number; km: number }
/** Vùng trên đảo cách địa danh dưới mức này thì coi như cùng một hòn đảo, không cần tàu. */
export const SIGHT_SAME_ISLAND_KM = 15;
/** Giá vé tàu ra đảo cho một quãng biển (cùng bảng giá tàu thuỷ du lịch). */
export function boatFare(km: number): number {
  return Math.round((TRAVEL_MODES.tau_thuy.base + TRAVEL_MODES.tau_thuy.perKm * Math.max(0, km)) / 1000) * 1000;
}
/**
 * Đường tới một điểm tham quan từ vùng đang đứng: đất liền thì một chặng taxi; ra đảo thì taxi tới cảng rồi đi tàu;
 * đang ở đảo mà vào đất liền (hay sang đảo khác) thì đi tàu về cảng trước. Đang ở ngay trên đảo đó thì chỉ đi xe trên đảo.
 */
export function sightRoute(
  from: { name: string; lat: number; lng: number; island?: boolean } | null | undefined,
  s: { name: string; lat: number; lng: number; island?: boolean; port?: { name: string; lat: number; lng: number; islandPort: string; boat?: string } },
  /** Các địa danh đảo đã biết cảng, để tìm cảng đất liền của hòn đảo người chơi đang đứng. */
  islandSights: { lat: number; lng: number; island?: boolean; port?: { name: string; lat: number; lng: number; islandPort: string; boat?: string } }[] = [],
): SightRoute {
  const kmOf = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.max(SIGHT_MIN_KM, Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng)));
  const taxi = (a: string, b: string, km: number): SightLeg => ({ mode: 'taxi', from: a, to: b, km, fare: taxiFare(km), seconds: SIGHT_TAXI_SECONDS });
  const boat = (a: string, b: string, km: number, name?: string): SightLeg => ({ mode: 'tau_thuy', from: a, to: b, km, fare: boatFare(km), seconds: TRAVEL_MODES.tau_thuy.seconds, boat: name ?? 'Tàu thuỷ' });
  const done = (legs: SightLeg[]): SightRoute => ({ legs, total: legs.reduce((n, l) => n + l.fare, 0), km: legs.reduce((n, l) => n + l.km, 0) });
  if (!from) return done([taxi('chỗ bạn đứng', s.name, SIGHT_MIN_KM)]);
  const sameIsland = !!from.island && !!s.island && haversineKm(from.lat, from.lng, s.lat, s.lng) < SIGHT_SAME_ISLAND_KM;
  if (sameIsland || (!from.island && !s.island)) return done([taxi(from.name, s.name, kmOf(from, s))]);
  const legs: SightLeg[] = [];
  let cur: { name: string; lat: number; lng: number } = from;
  if (from.island) {
    // tàu từ đảo đang đứng về cảng đất liền của chính hòn đảo đó (nếu biết), không thì cập bến gần nơi cần tới
    const own = islandSights.find((x) => x.island && x.port && haversineKm(from.lat, from.lng, x.lat, x.lng) < SIGHT_SAME_ISLAND_KM)?.port;
    const land = own ?? (s.island && s.port ? s.port : { name: `bến tàu gần ${s.name}`, lat: s.lat, lng: s.lng, boat: undefined });
    legs.push(boat(from.name, land.name, kmOf(from, land), land.boat));
    cur = land;
  }
  if (s.island && s.port) {
    if (haversineKm(cur.lat, cur.lng, s.port.lat, s.port.lng) > 1) legs.push(taxi(cur.name, s.port.name, kmOf(cur, s.port)));
    legs.push(boat(s.port.name, s.port.islandPort, kmOf(s.port, s), s.port.boat));
  } else if (s.island) {
    legs.push(boat(cur.name, s.name, kmOf(cur, s)));
  } else {
    legs.push(taxi(cur.name, s.name, haversineKm(cur.lat, cur.lng, s.lat, s.lng) < 1 ? SIGHT_MIN_KM : kmOf(cur, s)));
  }
  return done(legs);
}
/** Siêu thị đặc sản: khung giá ký gửi so với giá tham chiếu, phí sàn, giới hạn lô và lượng mua mỗi ngày. */
export const SUPER_MIN_RATIO = 1.0, SUPER_MAX_RATIO = 1.6, SUPER_FEE = 0.05;
export const SUPER_MIN_KG = 5, SUPER_MAX_LOT_KG = 300, SUPER_MAX_LOTS = 6, SUPER_DAILY_KG = 30;
/** Kệ của nhà bán (NPC) để siêu thị không bao giờ trống: giá cao hơn mọi kệ người chơi hợp lý, mỗi món ít hàng mỗi ngày. */
export const SUPER_NPC_RATIO = 1.5, SUPER_NPC_KG = 20, SUPER_NPC_GUESTS = 3;
export function superPriceRange(refPrice: number): { minPrice: number; maxPrice: number } {
  return { minPrice: Math.ceil(refPrice * SUPER_MIN_RATIO), maxPrice: Math.floor(refPrice * SUPER_MAX_RATIO) };
}

// ---------------------------------------------------------------- vườn sân thượng trong phố
/** Vườn sân thượng chỉ dùng 12 ô giữa lưới 6×5: cột 1..4, hàng 1..3. */
export const ROOFTOP_TILES: number[] = [1, 2, 3].flatMap((row) => [1, 2, 3, 4].map((col) => row * PLOT_COLS + col));
export interface UrbanCore { id: string; name: string; lat: number; lng: number; km: number }
export const URBAN_CORES: UrbanCore[] = [
  { id: 'ha_noi', name: 'Hà Nội', lat: 21.028, lng: 105.854, km: 8 },
  { id: 'tp_hcm', name: 'TP. Hồ Chí Minh', lat: 10.776, lng: 106.7, km: 10 },
  { id: 'da_nang', name: 'Đà Nẵng', lat: 16.06, lng: 108.22, km: 5 },
  { id: 'hai_phong', name: 'Hải Phòng', lat: 20.86, lng: 106.683, km: 5 },
  { id: 'can_tho', name: 'Cần Thơ', lat: 10.033, lng: 105.783, km: 4 },
  { id: 'hue', name: 'Huế', lat: 16.463, lng: 107.59, km: 3 },
  { id: 'nha_trang', name: 'Nha Trang', lat: 12.245, lng: 109.194, km: 3 },
];
export function urbanCoreAt(lat: number, lng: number): UrbanCore | null {
  for (const core of URBAN_CORES) if (haversineKm(lat, lng, core.lat, core.lng) <= core.km) return core;
  return null;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('vi-VN') + 'đ';
}
export function specialty(id: string): Specialty | undefined {
  return Object.hasOwn(SPECIALTIES, id) ? SPECIALTIES[id] : undefined;
}
export function region(id: string): Region | undefined {
  return Object.hasOwn(REGIONS, id) ? REGIONS[id] : undefined;
}

// ---------------------------------------------------------------- luật đường bộ (dùng cho màn lái xe)
/** Tốc độ khai thác (km/h). Cao tốc: tối đa 120, tối thiểu 60 theo Thông tư 38/2024/TT-BGTVT; mỗi đoạn theo biển cắm. */
export const ROAD_LIMITS = { village: 50, ramp: 60, highwayMin: 60, highwayPosted: [80, 100, 120] as number[], station: 30, toll: 40 };
/**
 * Mức phạt ô tô chạy quá tốc độ theo Điều 6 Nghị định 168/2024/NĐ-CP (hiệu lực 01/01/2025).
 * `fine` là mức trung bình của khung phạt; `points` là số điểm giấy phép lái xe bị trừ.
 * Cần người rà lại khi luật sửa đổi (có tin về nghị định sửa đổi năm 2026, chưa đối chiếu được văn bản gốc).
 */
export const SPEED_FINES: { overFrom: number; min: number; max: number; fine: number; points: number; label: string }[] = [
  { overFrom: 35, min: 12_000_000, max: 14_000_000, fine: 13_000_000, points: 6, label: 'quá tốc độ trên 35 km/h' },
  { overFrom: 20, min: 6_000_000, max: 8_000_000, fine: 7_000_000, points: 4, label: 'quá tốc độ trên 20 đến 35 km/h' },
  { overFrom: 10, min: 4_000_000, max: 6_000_000, fine: 5_000_000, points: 2, label: 'quá tốc độ từ 10 đến 20 km/h' },
  { overFrom: 5, min: 800_000, max: 1_000_000, fine: 900_000, points: 0, label: 'quá tốc độ từ 5 đến dưới 10 km/h' },
];
/** Khung phạt ứng với số km/h vượt quá; dưới 5 km/h thì không phạt (trả về null). */
export function speedFine(overKmh: number): (typeof SPEED_FINES)[number] | null {
  if (overKmh > 35) return SPEED_FINES[0];
  if (overKmh > 20) return SPEED_FINES[1];
  if (overKmh >= 10) return SPEED_FINES[2];
  if (overKmh >= 5) return SPEED_FINES[3];
  return null;
}

/** Các đường xuất khẩu. Giá cước, thời gian, sức chở do máy chủ định trong EXPORT_MODES. */
export type ExportMode = 'xe_tai' | 'container' | 'tau_hoa' | 'hang_khong' | 'tau_nho' | 'tau_lon';

// ---------------------------------------------------------------- thu mua sỉ bằng xe tải
/** Thương lái mua sỉ tại vườn ở vùng xe đang đỗ với giá này so với giá tham chiếu (hàng Loại 1). */
export const WHOLESALE_RATIO = 0.9;
/** Sản lượng một đặc sản mà cả vùng bán sỉ được trong một ngày bình thường (kg), cho tất cả thương lái. */
export const WHOLESALE_BASE_KG = 40_000;
/** Chính vụ vùng có nhiều hàng hơn, trái vụ khan hàng. */
export const WHOLESALE_IN_SEASON = 1.5, WHOLESALE_OFF_SEASON = 0.4;
/** Giữ tên cũ cho mã đang dùng: nguồn ngày ở mùa thường. */
export const WHOLESALE_SUPPLY_KG = WHOLESALE_BASE_KG;
/** Nguồn hàng sỉ trong ngày của một đặc sản tại vùng trồng. */
export function wholesaleSupplyKg(inSeasonNow: boolean | null): number {
  return Math.round(WHOLESALE_BASE_KG * (inSeasonNow === null ? 1 : inSeasonNow ? WHOLESALE_IN_SEASON : WHOLESALE_OFF_SEASON));
}
/** Đường cung: phần hàng dễ gom đầu ngày giá WHOLESALE_RATIO, càng vét càng đắt, gần cạn nguồn lên WHOLESALE_TOP_RATIO. */
export const WHOLESALE_EASY_KG = 5000, WHOLESALE_TOP_RATIO = 1.05;
/** Tỉ lệ so với giá tham chiếu của ki-lô-gam thứ `cumKg` mà cả vùng đã bán sỉ trong ngày. */
export function wholesaleRatioAt(cumKg: number, supplyKg: number): number {
  const easy = Math.min(WHOLESALE_EASY_KG, supplyKg * 0.25);
  if (cumKg <= easy) return WHOLESALE_RATIO;
  const f = Math.min(1, (cumKg - easy) / Math.max(1, supplyKg - easy));
  return WHOLESALE_RATIO + (WHOLESALE_TOP_RATIO - WHOLESALE_RATIO) * f;
}
/** Giá mua sỉ 1 kg tại vùng trồng ở đầu ngày; được mùa (glut < 1) thì rẻ hơn. */
export function wholesalePrice(refPrice: number, glut = 1): number {
  return Math.round((refPrice * WHOLESALE_RATIO * glut) / 100) * 100;
}
/** Báo giá mua sỉ `kg` khi cả vùng đã bán `boughtKg` trong ngày: giá trung bình (làm tròn trăm đồng) và tổng tiền. */
export function wholesaleQuote(refPrice: number, glut: number, supplyKg: number, boughtKg: number, kg: number): { unit: number; total: number; firstUnit: number; lastUnit: number } {
  const at = (c: number) => refPrice * glut * wholesaleRatioAt(c, supplyKg);
  const n = 24; let sum = 0;
  for (let i = 0; i < n; i++) sum += at(boughtKg + ((i + 0.5) / n) * Math.max(0, kg));
  const unit = Math.round(sum / n / 100) * 100;
  return { unit, total: unit * Math.max(0, kg), firstUnit: Math.round(at(boughtKg) / 100) * 100, lastUnit: Math.round(at(boughtKg + kg) / 100) * 100 };
}
/** Sức mua của một chợ vùng trong 24 giờ: bán tới BULK_EASY_KG thì giữ giá, càng xả nhiều giá càng rớt, tối đa BULK_MAX_DROP ở BULK_FULL_KG. */
export const BULK_EASY_KG = 1000, BULK_FULL_KG = 30_000, BULK_MAX_DROP = 0.45;
export function bulkFactorAt(cumKg: number): number {
  if (cumKg <= BULK_EASY_KG) return 1;
  return 1 - BULK_MAX_DROP * Math.min(1, (cumKg - BULK_EASY_KG) / (BULK_FULL_KG - BULK_EASY_KG));
}
/** Hệ số giá trung bình khi bán `kg` vào một chợ đã nhận `soldKg` loại này trong 24 giờ qua. */
export function bulkSellFactor(soldKg: number, kg: number): number {
  const n = 24; let sum = 0;
  for (let i = 0; i < n; i++) sum += bulkFactorAt(soldKg + ((i + 0.5) / n) * Math.max(0, kg));
  return sum / n;
}
/** Hàng tươi chở xe thùng thường hao theo quãng đường; thùng lạnh chỉ hao một phần. */
export const SPOIL_PER_100KM = 0.005, SPOIL_MAX = 0.06, SPOIL_COLD_FACTOR = 0.2;
export function spoilRate(roadKmValue: number, cold: boolean): number {
  const r = Math.min(SPOIL_MAX, (Math.max(0, roadKmValue) / 100) * SPOIL_PER_100KM);
  return Math.round((cold ? r * SPOIL_COLD_FACTOR : r) * 10000) / 10000;
}

/** Khác biệt giữa mua vé đi và tự lái xe tải, để giao diện đặt cạnh nhau. */
export const TRAVEL_VS_TRUCK: Record<'ve' | 'xe_tai', { title: string; icon: string; who: string; points: string[] }> = {
  ve: {
    title: 'Mua vé (xe khách, tàu, máy bay)', icon: '🎫', who: 'Ai cũng đi được',
    points: [
      'Chỉ người đi: tham quan vườn mẫu, lấy tem vào sổ sưu tập.',
      `Mang về tối đa ${SOUVENIR_MAX_KG} kg quà mỗi lần mua, ${SOUVENIR_DAILY_BUYS} lần mỗi ngày, giá quà bằng ${Math.round(SOUVENIR_RATIO * 100)}% giá tham chiếu.`,
      'Trả tiền vé một lần, không lo xăng, phí đường hay bị phạt.',
      'Hàng trong kho vẫn bán theo giá ở vùng nhà.',
    ],
  },
  xe_tai: {
    title: 'Tự lái xe tải', icon: '🚚', who: 'Chỉ thương lái',
    points: [
      `Chở hàng đi bán: hàng vùng khác bán ở nơi xe đỗ được giá hàng phương xa (${Math.round(FAR_MARKET_RATIO * 100)}% giá tham chiếu, so với ${Math.round(FARM_GATE_RATIO * 100)}% khi bán tại vườn).`,
      `Thu mua sỉ tại vườn với ${Math.round(WHOLESALE_RATIO * 100)}% giá tham chiếu, tối đa bằng tải trọng chiếc xe đang lái (xe tải nhẹ: ${TRUCK.cargoKg} kg, xe lớn chở nhiều hơn) mỗi điểm đỗ, rồi chở về bán lại.`,
      'Tốn xăng, phí đường; chạy quá tốc độ bị phạt theo luật; tự lái nên mất công hơn.',
      'Tới nơi cũng được tính là đã ghé thăm vùng đó.',
    ],
  },
};

// ---------------------------------------------------------------- xuất khẩu
export interface ExportModeInfo {
  name: string; icon: string;
  /** Khối lượng một lô (kg). */
  minKg: number; maxKg: number;
  /** Cước cố định một lô và cước mỗi kg (đồng). */
  baseFee: number; perKgFee: number;
  /** Thời gian tới nơi tính bằng phút thật khi TIME_SCALE = 1. */
  minutes: number;
  /** Tỉ lệ hao hụt với hàng tươi; hàng khô (cà phê, tiêu, chè, lúa gạo…) chỉ hao một phần năm. */
  spoil: number;
  /** Cửa ngõ hàng phải ra: cửa khẩu đường bộ, ga liên vận, sân bay hay cảng biển. */
  gate: 'cua_khau' | 'ga' | 'san_bay' | 'cang';
  note: string;
}
export const EXPORT_MODES: Record<ExportMode, ExportModeInfo> = {
  xe_tai: { name: 'Xe tải biên mậu', icon: '🚚', minKg: 30, maxKg: 500, baseFee: 300_000, perKgFee: 1_500, minutes: 20, spoil: 0.03, gate: 'cua_khau', note: 'Lô nhỏ, đi nhanh qua cửa khẩu; cước mỗi kg cao hơn container.' },
  container: { name: 'Xe container lạnh', icon: '🚛', minKg: 200, maxKg: 5_000, baseFee: 2_500_000, perKgFee: 900, minutes: 30, spoil: 0.01, gate: 'cua_khau', note: 'Giữ lạnh nên hao ít nhất trong đường bộ; lô dưới nửa tấn đi ghép chung container (hàng lẻ).' },
  tau_hoa: { name: 'Tàu hoả liên vận', icon: '🚂', minKg: 100, maxKg: 8_000, baseFee: 1_500_000, perKgFee: 600, minutes: 45, spoil: 0.04, gate: 'ga', note: 'Rẻ hơn đường bộ khi hàng nhiều, chậm hơn; đi Trung Quốc và nối tuyến sang Nga – Á Âu.' },
  hang_khong: { name: 'Máy bay chở hàng', icon: '✈️', minKg: 10, maxKg: 1_000, baseFee: 800_000, perKgFee: 12_000, minutes: 10, spoil: 0, gate: 'san_bay', note: 'Nhanh nhất, không hao hụt, cước rất đắt: chỉ hợp hàng giá trị cao.' },
  tau_nho: { name: 'Tàu biển nhỏ', icon: '⛴️', minKg: 100, maxKg: 3_000, baseFee: 1_000_000, perKgFee: 500, minutes: 60, spoil: 0.06, gate: 'cang', note: 'Chạy tuyến gần trong châu Á; rẻ nhưng hàng tươi hao khá nhiều.' },
  tau_lon: { name: 'Tàu container viễn dương', icon: '🚢', minKg: 200, maxKg: 50_000, baseFee: 6_000_000, perKgFee: 250, minutes: 120, spoil: 0.1, gate: 'cang', note: 'Cước mỗi kg rẻ nhất, đi rất lâu: hợp hàng khô, hàng chế biến số lượng lớn; lô nhỏ đi ghép container.' },
};
export type ExportMarket = 'trung_quoc' | 'lao_cam' | 'asean' | 'nhat_han' | 'au_my' | 'an_do' | 'trung_dong' | 'uc_nz' | 'nga';
export interface ExportMarketInfo {
  name: string; icon: string; priceMult: number; modes: ExportMode[]; gradeA: boolean; note: string;
  /** Phí xử lý kiểm dịch mỗi kg hàng tươi (chiếu xạ, xử lý hơi nước nóng) và thời gian thêm (phút khi TIME_SCALE = 1). Hàng chế biến được miễn. */
  treatFee?: number; treatMinutes?: number; treat?: string;
  /** Thị trường quá xa cho hàng tươi: chỉ nhận hàng chế biến và hàng khô. */
  processedOnly?: boolean;
}
export const EXPORT_MARKETS: Record<ExportMarket, ExportMarketInfo> = {
  trung_quoc: { name: 'Trung Quốc', icon: '🇨🇳', priceMult: 1.12, modes: ['xe_tai', 'container', 'tau_hoa'], gradeA: false, note: 'Chợ biên mậu gần, mua số lượng lớn, giá vừa phải. Cần mã số vùng trồng (đã gồm trong cước).' },
  lao_cam: { name: 'Lào – Campuchia', icon: '🇱🇦', priceMult: 1.05, modes: ['xe_tai', 'container'], gradeA: false, note: 'Gần và dễ tính, giá chỉ nhỉnh hơn trong nước.' },
  asean: { name: 'Thái Lan – Singapore', icon: '🌏', priceMult: 1.18, modes: ['tau_nho', 'hang_khong'], gradeA: false, note: 'Đi tàu nhỏ hoặc máy bay, giá khá.' },
  an_do: { name: 'Ấn Độ', icon: '🇮🇳', priceMult: 1.2, modes: ['tau_nho', 'tau_lon', 'hang_khong'], gradeA: false, note: 'Thị trường đông dân, chuộng hồ tiêu, quế, hạt điều và trái cây sấy.' },
  trung_dong: { name: 'Trung Đông', icon: '🇦🇪', priceMult: 1.28, modes: ['hang_khong', 'tau_lon'], gradeA: false, note: 'Mua trái cây nhiệt đới và hàng chế biến giá tốt; đi máy bay hoặc tàu lớn.' },
  nhat_han: { name: 'Nhật Bản – Hàn Quốc', icon: '🇯🇵', priceMult: 1.38, modes: ['hang_khong', 'tau_lon'], gradeA: true, note: 'Giá cao nhưng chỉ nhận hàng Loại 1; trái tươi phải xử lý hơi nước nóng.', treatFee: 2_500, treatMinutes: 5, treat: 'Xử lý hơi nước nóng' },
  nga: { name: 'Nga – Á Âu', icon: '🇷🇺', priceMult: 1.25, modes: ['tau_hoa', 'tau_lon'], gradeA: false, note: 'Đường quá dài cho hàng tươi: chỉ nhận hàng chế biến và hàng khô (cà phê, tiêu, chè, trái sấy).', processedOnly: true },
  uc_nz: { name: 'Úc – New Zealand', icon: '🇦🇺', priceMult: 1.45, modes: ['hang_khong', 'tau_lon'], gradeA: true, note: 'Giá cao, kiểm dịch rất chặt: trái tươi phải chiếu xạ trước khi đi.', treatFee: 4_000, treatMinutes: 10, treat: 'Chiếu xạ' },
  au_my: { name: 'Châu Âu – Mỹ', icon: '🌍', priceMult: 1.5, modes: ['hang_khong', 'tau_lon'], gradeA: true, note: 'Giá cao nhất, xa nhất, chỉ nhận hàng Loại 1; trái tươi đi Mỹ phải chiếu xạ.', treatFee: 4_000, treatMinutes: 10, treat: 'Chiếu xạ' },
};
/** Cửa ngõ xuất khẩu thật: hàng phải chở nội địa tới đó trước, càng xa càng tốn. */
const FAR: ExportMarket[] = ['asean', 'nhat_han', 'au_my', 'an_do', 'trung_dong', 'uc_nz'];
export const EXPORT_GATEWAYS: { id: string; name: string; gate: ExportModeInfo['gate']; lat: number; lng: number; markets: ExportMarket[] }[] = [
  { id: 'huu_nghi', name: 'Cửa khẩu Hữu Nghị (Lạng Sơn)', gate: 'cua_khau', lat: 21.97, lng: 106.71, markets: ['trung_quoc'] },
  { id: 'kim_thanh', name: 'Cửa khẩu Kim Thành (Lào Cai)', gate: 'cua_khau', lat: 22.5, lng: 103.96, markets: ['trung_quoc'] },
  { id: 'mong_cai', name: 'Cửa khẩu Móng Cái (Quảng Ninh)', gate: 'cua_khau', lat: 21.53, lng: 107.97, markets: ['trung_quoc'] },
  { id: 'lao_bao', name: 'Cửa khẩu Lao Bảo (Quảng Trị)', gate: 'cua_khau', lat: 16.62, lng: 106.6, markets: ['lao_cam'] },
  { id: 'moc_bai', name: 'Cửa khẩu Mộc Bài (Tây Ninh)', gate: 'cua_khau', lat: 11.08, lng: 106.18, markets: ['lao_cam'] },
  { id: 'ga_dong_dang', name: 'Ga liên vận Đồng Đăng (Lạng Sơn)', gate: 'ga', lat: 21.95, lng: 106.7, markets: ['trung_quoc', 'nga'] },
  { id: 'ga_lao_cai', name: 'Ga liên vận Lào Cai', gate: 'ga', lat: 22.5, lng: 103.97, markets: ['trung_quoc'] },
  { id: 'noi_bai', name: 'Sân bay Nội Bài (Hà Nội)', gate: 'san_bay', lat: 21.22, lng: 105.8, markets: FAR },
  { id: 'da_nang_bay', name: 'Sân bay Đà Nẵng', gate: 'san_bay', lat: 16.04, lng: 108.2, markets: FAR },
  { id: 'tan_son_nhat', name: 'Sân bay Tân Sơn Nhất (TP. Hồ Chí Minh)', gate: 'san_bay', lat: 10.82, lng: 106.65, markets: FAR },
  { id: 'hai_phong', name: 'Cảng Hải Phòng', gate: 'cang', lat: 20.86, lng: 106.68, markets: [...FAR, 'nga'] },
  { id: 'tien_sa', name: 'Cảng Tiên Sa (Đà Nẵng)', gate: 'cang', lat: 16.12, lng: 108.21, markets: [...FAR, 'nga'] },
  { id: 'cai_mep', name: 'Cảng Cái Mép (TP. Hồ Chí Minh)', gate: 'cang', lat: 10.5, lng: 107.02, markets: [...FAR, 'nga'] },
];
/** Cước chở nội địa tới cửa ngõ: đồng cho mỗi kg mỗi km. */
export const EXPORT_INLAND_PER_KG_KM = 1.2;
/** Không còn giới hạn số lô theo cấp: hàng trong kho và mức tối thiểu mỗi đường mới là giới hạn thật. Con số này chỉ để chặn gửi dồn bất thường. */
export const EXPORT_MAX_ACTIVE = 20, EXPORT_MAX_ACTIVE_TOP = 20;
export function exportMaxActive(_level = 1): number { return EXPORT_MAX_ACTIVE; }
/** Tàu container viễn dương nhận hàng lẻ ghép container (LCL): phí cố định bằng một phần tư, cước mỗi kg gấp ba; lô lớn tự chuyển sang nguyên container khi rẻ hơn. */
export const EXPORT_LCL_BASE_RATIO = 0.25, EXPORT_LCL_PER_KG_MULT = 3;
const DRY_KINDS = new Set(['cn', 'lua']);
/** Mọi vai đều đi được mọi đường xuất khẩu; thương lái và hợp tác xã được giảm cước thay vì độc quyền. */
export function exportModesFor(role: Role | null, _inCoop = false): ExportMode[] {
  return role ? (Object.keys(EXPORT_MODES) as ExportMode[]) : [];
}
export const EXPORT_DISCOUNT_TRADER = 0.15, EXPORT_DISCOUNT_COOP = 0.1;
/** Phần cước được giảm: thương lái có mối vận tải, hợp tác xã gom hàng chung. */
export function exportDiscount(role: Role | null, inCoop: boolean): number {
  return (role === 'thuong_lai' ? EXPORT_DISCOUNT_TRADER : 0) + (inCoop ? EXPORT_DISCOUNT_COOP : 0);
}
/** Hàng chế biến hao hụt chỉ bằng một phần mười hàng tươi. */
export const EXPORT_PROCESSED_SPOIL = 0.1;
export interface ExportOpts { /** Hàng đã chế biến ở xưởng (không xét loại, giá theo công thức chế biến). */ processed?: boolean; /** Phần cước được giảm (0–1). */ discount?: number; /** Hệ số giá thêm của thành phẩm (máy đóng gói). */ valueBonus?: number }
export interface ExportQuote {
  ok: boolean;
  /** Lý do không gửi được (khi ok = false). */
  reason?: string;
  mode: ExportMode; market: ExportMarket; kg: number;
  gatewayId: string; gatewayName: string; inlandKm: number;
  /** Tổng cước phải trả ngay = cước cố định + cước theo kg + cước nội địa. */
  freight: number;
  spoilKg: number; arriveKg: number;
  /** Giá bán mỗi kg ở thị trường đó và tiền hàng về khi lô tới nơi. */
  unitPrice: number; payout: number;
  /** Lãi sau cước. */
  net: number;
  minutes: number;
  /** Đi hàng lẻ ghép container (chỉ tàu viễn dương). */
  lcl?: boolean;
}
/** Báo giá một lô xuất khẩu. `refPrice` mặc định là giá tham chiếu trong danh mục; máy chủ truyền giá hiện hành. */
export function exportQuote(specialtyId: string, grade: Quality, kg: number, mode: ExportMode, market: ExportMarket, fromRegionId: string, refPrice?: number, opts: ExportOpts = {}): ExportQuote {
  const sp = SPECIALTIES[specialtyId], m = EXPORT_MODES[mode], mk = EXPORT_MARKETS[market], from = REGIONS[fromRegionId];
  const base: ExportQuote = { ok: false, mode, market, kg, gatewayId: '', gatewayName: '', inlandKm: 0, freight: 0, spoilKg: 0, arriveKg: 0, unitPrice: 0, payout: 0, net: 0, minutes: m?.minutes ?? 0 };
  if (!sp || !m || !mk || !from) return { ...base, reason: 'Thông tin lô hàng không hợp lệ.' };
  const gates = EXPORT_GATEWAYS.filter((g) => g.gate === m.gate && g.markets.includes(market))
    .map((g) => ({ g, km: Math.round(haversineKm(from.lat, from.lng, g.lat, g.lng)) })).sort((a, b) => a.km - b.km);
  if (!mk.modes.includes(mode) || !gates.length) return { ...base, reason: `${m.name} không đi tới ${mk.name}.` };
  const { g, km } = gates[0];
  const processed = !!opts.processed, dry = DRY_KINDS.has(CROPS[sp.crop].kind);
  const spoilKg = Math.floor(kg * m.spoil * (processed ? EXPORT_PROCESSED_SPOIL : dry ? 0.2 : 1)), arriveKg = kg - spoilKg;
  // hàng tươi vào thị trường kiểm dịch chặt phải qua xử lý: thêm phí và thời gian
  const treat = !processed && !dry && mk.treatFee ? mk.treatFee : 0;
  const minutes = m.minutes + (treat ? mk.treatMinutes ?? 0 : 0);
  // tàu viễn dương: lô nhỏ đi hàng lẻ ghép container, lấy cách tính rẻ hơn trong hai cách
  const fcl = m.baseFee + m.perKgFee * kg, lclCost = m.baseFee * EXPORT_LCL_BASE_RATIO + m.perKgFee * EXPORT_LCL_PER_KG_MULT * kg;
  const lcl = mode === 'tau_lon' && lclCost < fcl;
  const gross = (lcl ? lclCost : fcl) + EXPORT_INLAND_PER_KG_KM * km * kg;
  const freight = Math.round((gross * (1 - Math.min(0.5, Math.max(0, opts.discount ?? 0))) + treat * kg) / 1000) * 1000;
  const ref = refPrice ?? sp.refPrice;
  const unitPrice = processed
    ? Math.round((ref * recipeOf(CROPS[sp.crop]).value * (1 + (opts.valueBonus ?? 0)) * mk.priceMult) / 100) * 100
    : Math.round((ref * mk.priceMult * QUALITY_MULT[grade]) / 100) * 100;
  const payout = unitPrice * arriveKg;
  const q: ExportQuote = { ...base, lcl, gatewayId: g.id, gatewayName: g.name, inlandKm: km, freight, spoilKg, arriveKg, unitPrice, payout, net: payout - freight, minutes };
  if (kg < m.minKg) return { ...q, reason: `${m.name} nhận lô từ ${m.minKg} kg.` };
  if (kg > m.maxKg) return { ...q, reason: `${m.name} chỉ chở tối đa ${m.maxKg} kg một lô.` };
  if (mk.processedOnly && !processed && !dry) return { ...q, reason: `${mk.name} chỉ nhận hàng chế biến và hàng khô.` };
  if (mk.gradeA && !processed && grade !== 'A') return { ...q, reason: `${mk.name} chỉ nhận hàng Loại 1.` };
  return { ...q, ok: true };
}
/** Đường và thị trường của một đơn lớn hợp tác xã, tất định theo mã đơn (dùng cho đơn cũ chưa ghi sẵn). */
export function coopOrderRoute(orderId: number, kgTarget: number): { exportMode: ExportMode; market: ExportMarket } {
  const markets = Object.keys(EXPORT_MARKETS) as ExportMarket[];
  const market = markets[orderId % markets.length];
  const fit = EXPORT_MARKETS[market].modes.filter((mo) => kgTarget >= EXPORT_MODES[mo].minKg && kgTarget <= EXPORT_MODES[mo].maxKg);
  const pool = fit.length ? fit : EXPORT_MARKETS[market].modes;
  return { exportMode: pool[orderId % pool.length], market };
}

// ---------------------------------------------------------------- hộ chiếu du lịch, điểm kinh nghiệm, cấp bậc
export const LEVELS: { level: number; xp: number; title: string }[] = [
  { level: 1, xp: 0, title: 'Tập sự' }, { level: 2, xp: 100, title: 'Lữ khách' }, { level: 3, xp: 300, title: 'Người ham đi' },
  { level: 4, xp: 600, title: 'Thổ địa' }, { level: 5, xp: 1_000, title: 'Nhà thám hiểm' }, { level: 6, xp: 1_600, title: 'Người kể chuyện vùng miền' },
  { level: 7, xp: 2_400, title: 'Hướng dẫn viên' }, { level: 8, xp: 3_500, title: 'Chuyên gia đặc sản' }, { level: 9, xp: 5_000, title: 'Sứ giả miền quê' },
  { level: 10, xp: 7_000, title: 'Đại sứ Vườn Việt' },
  { level: 11, xp: 9_500, title: 'Lão nông tri điền' }, { level: 12, xp: 12_500, title: 'Chủ vườn mẫu' }, { level: 13, xp: 16_000, title: 'Nghệ nhân đặc sản' },
  { level: 14, xp: 20_000, title: 'Thương nhân miền xuôi' }, { level: 15, xp: 25_000, title: 'Chủ trang trại' }, { level: 16, xp: 31_000, title: 'Bậc thầy mùa vụ' },
  { level: 17, xp: 38_000, title: 'Doanh nhân nông sản' }, { level: 18, xp: 46_000, title: 'Nhà xuất khẩu' }, { level: 19, xp: 55_000, title: 'Chủ chuỗi cung ứng' },
  { level: 20, xp: 65_000, title: 'Vua đặc sản' }, { level: 21, xp: 77_000, title: 'Người giữ giống quý' }, { level: 22, xp: 90_000, title: 'Kiến trúc sư làng nghề' },
  { level: 23, xp: 105_000, title: 'Đại thương gia' }, { level: 24, xp: 122_000, title: 'Người dựng hợp tác xã kiểu mẫu' }, { level: 25, xp: 141_000, title: 'Biểu tượng vùng miền' },
  { level: 26, xp: 162_000, title: 'Người nâng tầm nông sản Việt' }, { level: 27, xp: 185_000, title: 'Huyền thoại chợ quê' }, { level: 28, xp: 210_000, title: 'Đại sứ thương hiệu quốc gia' },
  { level: 29, xp: 238_000, title: 'Tinh hoa đất Việt' }, { level: 30, xp: 270_000, title: 'Huyền thoại Vườn Việt' },
];
export interface LevelInfo { level: number; title: string; xp: number; /** Ngưỡng của cấp kế; null khi đã ở cấp cao nhất. */ nextXp: number | null; prevXp: number }
export function levelOf(xp: number): LevelInfo {
  const x = Math.max(0, Math.floor(xp || 0));
  let i = 0;
  while (i + 1 < LEVELS.length && x >= LEVELS[i + 1].xp) i++;
  return { level: LEVELS[i].level, title: LEVELS[i].title, xp: x, nextXp: LEVELS[i + 1]?.xp ?? null, prevXp: LEVELS[i].xp };
}
/** Điểm kinh nghiệm cho từng việc. */
export const XP = { stop: 10, sight: 50, region: 30, harvest: 5, order: 15, export: 40, process: 8, land: 100, consignSold: 5, help: 2 } as const;
export interface LevelPerks { energyMax: number; exportActive: number; superDailyKg: number }
export const ENERGY_MAX = 100, ENERGY_PER_LEVEL = 10, ENERGY_REGEN_MINUTES = 3, ENERGY_MAX_TOP = 250;
export function levelPerks(level: number): LevelPerks {
  const l = Math.max(1, Math.min(LEVELS.length, level));
  return { energyMax: Math.min(ENERGY_MAX_TOP, ENERGY_MAX + ENERGY_PER_LEVEL * (l - 1)), exportActive: exportMaxActive(l), superDailyKg: SUPER_DAILY_KG + 5 * (l - 1) };
}
/** Thể lực tốn cho từng việc. Mua bán, xem bảng, đi vé (ngồi xe), ăn uống không tốn. */
export const ENERGY_COST = { plant: 1, care: 1, harvest: 2, help: 1, stop: 2, process: 3, tripPer100Km: 2, tripMax: 12 } as const;
export function tripEnergy(km: number): number { return Math.min(ENERGY_COST.tripMax, Math.max(1, Math.round((km / 100) * ENERGY_COST.tripPer100Km))); }
/** Thể lực hiện có, tính cả phần hồi theo thời gian kể từ lần ghi gần nhất. */
export function energyAt(stored: number, storedAtMs: number, nowMs: number, max: number, timeScale = 1): number {
  const gained = Math.floor(((nowMs - storedAtMs) * timeScale) / (ENERGY_REGEN_MINUTES * 60_000));
  return Math.min(max, Math.max(0, stored) + Math.max(0, gained));
}

// ---------------------------------------------------------------- giấy chứng nhận quyền sử dụng đất
export const LAND_CERT_NAME = 'Giấy chứng nhận quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất';
/** Lệ phí trước bạ nhà đất 0,5% giá trị và lệ phí cấp giấy cố định. */
export const LAND_REG_FEE_RATIO = 0.005, LAND_CERT_FEE = 100_000;
export function landFees(price: number): { registration: number; certificate: number; total: number } {
  const registration = Math.round((price * LAND_REG_FEE_RATIO) / 1000) * 1000;
  return { registration, certificate: LAND_CERT_FEE, total: registration + LAND_CERT_FEE };
}

// ---------------------------------------------------------------- xưởng chế biến: máy móc
export type MachineKind = 'may_say' | 'may_ep' | 'day_chuyen_mut' | 'may_rang_xay' | 'may_rua' | 'may_dong_goi' | 'kho_lanh';
export interface MachineInfo {
  name: string; emoji: string; price: number;
  /** Số mẻ chạy song song ở cấp 1 (máy phụ trợ: 0). */
  slots: number;
  /** Công thức (Recipe.id) máy làm được; rỗng với máy phụ trợ. */
  recipes: string[];
  /** Máy phụ trợ: cộng sản lượng mẻ, cộng giá thành phẩm, hoặc giảm thiệt do nguyên liệu loại thấp. */
  bonus?: { yield?: number; value?: number; grade?: number };
  note: string;
}
export const MACHINES: Record<MachineKind, MachineInfo> = {
  may_say: { name: 'Máy sấy', emoji: '♨️', price: 6_000_000, slots: 2, recipes: ['say_deo', 'say_kho', 'hoa_kho'], note: 'Sấy dẻo trái cây, sấy khô củ, làm hoa khô.' },
  may_ep: { name: 'Máy ép – cô đặc', emoji: '🧃', price: 5_000_000, slots: 2, recipes: ['nuoc_ep'], note: 'Ép nước và cô đặc các loại trái dây leo.' },
  day_chuyen_mut: { name: 'Dây chuyền mứt – đóng hũ', emoji: '🍯', price: 7_000_000, slots: 2, recipes: ['mut'], note: 'Nấu mứt, đóng hũ thanh trùng.' },
  may_rang_xay: { name: 'Máy rang xay – xay xát', emoji: '🔥', price: 8_000_000, slots: 2, recipes: ['rang_sao', 'xay_xat'], note: 'Rang cà phê, sao chè, xay tiêu, xay xát lúa gạo.' },
  may_rua: { name: 'Máy rửa – phân loại', emoji: '🚿', price: 3_000_000, slots: 0, recipes: [], bonus: { yield: 0.05 }, note: 'Phụ trợ: nguyên liệu sạch và đều nên mỗi mẻ ra thêm 5% thành phẩm.' },
  may_dong_goi: { name: 'Máy đóng gói hút chân không', emoji: '📦', price: 4_000_000, slots: 0, recipes: [], bonus: { value: 0.08 }, note: 'Phụ trợ: bao bì đẹp, để được lâu nên thành phẩm bán được thêm 8%.' },
  kho_lanh: { name: 'Kho lạnh', emoji: '❄️', price: 5_000_000, slots: 0, recipes: [], bonus: { grade: 0.5 }, note: 'Phụ trợ: giữ nguyên liệu tươi nên hàng Loại 2, Loại 3 chỉ thiệt một nửa so với bình thường.' },
};
export const WORKSHOP_MAX_MACHINES = 8, WORKSHOP_MAX_PER_KIND = 2, MACHINE_MAX_LEVEL = 3;
/** Tiền điện và bảo trì cho mỗi kg nguyên liệu đưa vào máy. */
export const WORKSHOP_RUN_FEE_PER_KG = 200;
/** Số mẻ song song và hệ số thời gian của một máy theo cấp. */
export function machineStats(kind: MachineKind, level: number): { slots: number; time: number } {
  const m = MACHINES[kind], l = Math.max(1, Math.min(MACHINE_MAX_LEVEL, level));
  return { slots: m.slots ? m.slots + (l - 1) : 0, time: 1 - 0.1 * (l - 1) };
}
export function machineUpgradeCost(kind: MachineKind, level: number): number { return Math.round((MACHINES[kind].price * 0.5 * level) / 100_000) * 100_000; }
/** Máy chế biến nào làm được công thức này. */
export function machinesForRecipe(recipeId: string): MachineKind[] { return (Object.keys(MACHINES) as MachineKind[]).filter((k) => MACHINES[k].recipes.includes(recipeId)); }
/** Máy cấp sẵn cho xưởng mới: máy hợp với đặc sản đầu tiên của vùng nhà. */
export function starterMachine(homeRegionId: string): MachineKind {
  const sp = Object.values(SPECIALTIES).find((x) => x.regionId === homeRegionId);
  return (sp && machinesForRecipe(recipeOf(CROPS[sp.crop]).id)[0]) || 'may_say';
}

// ---------------------------------------------------------------- vì sao có giới hạn
/** Mỗi giới hạn trong game kèm một câu giải thích lý do, để giao diện hiện ngay cạnh con số. */
export const LIMIT_REASONS: Record<string, { title: string; limit: string; reason: string }> = {
  souvenir: { title: 'Quà đặc sản ở quầy trưng bày', limit: `Mỗi lần ${SOUVENIR_MAX_KG} kg, mỗi ngày ${SOUVENIR_DAILY_BUYS} lần, giá ${Math.round(SOUVENIR_RATIO * 100)}% giá tham chiếu`,
    reason: 'Quầy bán quà cho khách du lịch để lấy tem sưu tập, không phải nơi buôn hàng. Nếu mua thoải mái thì ai cũng gom đủ hàng mọi miền mà không cần trồng hay buôn. Muốn mua nhiều: thương lái lái xe tải tới và thu mua sỉ tại vườn.' },
  wholesale_cargo: { title: 'Mỗi lần mua được bao nhiêu', limit: 'Bằng đúng chỗ trống trên chiếc xe đang lái: xe tải nhẹ 990 kg, xe 15 tấn mua được 15 tấn, đầu kéo container khoảng 28 tấn',
    reason: 'Hàng mua sỉ được chất thẳng lên xe nên xe chở được bao nhiêu thì mua được bấy nhiêu. Muốn buôn lớn thì mua xe lớn (và thi bằng lái hạng tương ứng).' },
  wholesale_supply: { title: 'Nguồn hàng và giá của vùng', limit: `Mỗi đặc sản khoảng ${WHOLESALE_BASE_KG / 1000} tấn mỗi ngày cho tất cả thương lái (chính vụ nhiều hơn, trái vụ ít hơn); ${WHOLESALE_EASY_KG / 1000} tấn đầu giá ${Math.round(WHOLESALE_RATIO * 100)}% tham chiếu, càng vét giá càng lên tới ${Math.round(WHOLESALE_TOP_RATIO * 100)}%`,
    reason: 'Vườn trong vùng chỉ thu hoạch được chừng đó mỗi ngày. Mua ít thì gom được hàng rẻ; vét cả vùng thì phải trả giá cao hơn, và xả một lúc quá nhiều ở chợ nơi đến thì giá bán cũng rớt. Hàng tươi chở xa bằng xe thùng thường còn bị hao, thùng lạnh hao ít hơn.' },
  wholesale_role: { title: 'Ai được thu mua sỉ', limit: 'Chỉ thương lái',
    reason: 'Chỉ thương lái có xe tải. Nhà vườn và chủ xưởng mua hàng vùng khác qua chợ hoặc từ thương lái, để ba vai cần nhau.' },
  gift: { title: 'Tặng quà cho bạn', limit: `Mỗi ngày ${GIFT_DAILY_LIMIT} lần, mỗi lần tối đa ${GIFT_MAX_KG} kg`,
    reason: 'Để quà là quà, không thành đường chuyển hàng và tiền giữa các tài khoản phụ.' },
  orders: { title: 'Đơn hàng mỗi ngày', limit: `${ORDERS_PER_DAY + 1} đơn mỗi ngày (một đơn riêng theo vai), trả 135% giá tham chiếu cộng thưởng theo cấp`,
    reason: 'Đơn trả giá cao hơn thị trường nên chỉ có vài đơn; khối lượng và tiền thưởng lớn dần theo cấp để người mới có thu nhập ổn định, còn người chơi lâu năm kiếm chính từ buôn bán, chế biến, hợp đồng công ty và xuất khẩu.' },
  tiles: { title: 'Số ô trồng theo vai', limit: `Nhà vườn trồng cả ${TILE_COUNT} ô; thương lái ${SMALL_TILES.length} ô; chủ xưởng không trồng`,
    reason: 'Mỗi vai mạnh một khâu: nhà vườn trồng nhiều, chủ xưởng chế biến, thương lái buôn xa. Vườn nhỏ để thương lái phải mua hàng của người khác.' },
  dump: { title: 'Bán tháo', limit: `Người không phải thương lái chỉ bán cho doanh nghiệp ở ${Math.round(DUMP_RATIO * 100)}% giá tham chiếu`,
    reason: 'Để nhà vườn có lý do bán qua chợ, sạp hoặc thương lái thay vì bấm bán ngay.' },
  coop_members: { title: 'Thành viên hợp tác xã', limit: `Tối đa ${COOP_MAX_MEMBERS} người, cùng một vùng trồng`,
    reason: 'Hợp tác xã là xóm cùng trồng một loại đặc sản; nhỏ vừa đủ để ai cũng thấy phần mình góp.' },
  coop_order: { title: 'Đơn lớn của hợp tác xã', limit: `${COOP_ORDER_KG_PER_MEMBER} kg mỗi thành viên, hạn ${COOP_ORDER_DAYS} ngày, thưởng ${Math.round(COOP_ORDER_BONUS * 100)}%`,
    reason: 'Đơn xuất khẩu cần gom đủ hàng mới đi được một chuyến; chia theo đầu người để hợp tác xã đông hay ít đều làm nổi.' },
  export_role: { title: 'Ai xuất khẩu được đường nào', limit: `Mọi vai đi được mọi đường. Thương lái được giảm ${Math.round(EXPORT_DISCOUNT_TRADER * 100)}% cước, thành viên hợp tác xã giảm thêm ${Math.round(EXPORT_DISCOUNT_COOP * 100)}%`,
    reason: 'Ai có hàng cũng xuất được; người có mối vận tải (thương lái) và người gom hàng chung (hợp tác xã) thì được cước rẻ hơn, giống ngoài đời.' },
  export_min: { title: 'Khối lượng tối thiểu mỗi lô', limit: (Object.keys(EXPORT_MODES) as ExportMode[]).map((k) => `${EXPORT_MODES[k].name} từ ${EXPORT_MODES[k].minKg} kg`).join('; '),
    reason: 'Xe, tàu càng lớn thì cước mỗi kg càng rẻ nhưng phải đủ hàng mới chạy. Vì vậy mới cần gom hàng và chọn đường cho hợp.' },
  export_active: { title: 'Lô hàng đang trên đường', limit: 'Không giới hạn theo cấp: có hàng và đủ mức tối thiểu của đường đi là gửi được',
    reason: 'Giới hạn thật của xuất khẩu là lượng hàng trong kho và việc mỗi loại xe, tàu phải đủ hàng mới chạy. Tàu viễn dương nhận cả hàng lẻ ghép container từ 200 kg, cước mỗi kg cao hơn đi nguyên container.' },
  export_grade: { title: 'Thị trường khó tính', limit: 'Nhật – Hàn, Úc – New Zealand và Âu – Mỹ chỉ nhận trái tươi Loại 1 và thu thêm phí xử lý kiểm dịch; Nga – Á Âu chỉ nhận hàng chế biến, hàng khô',
    reason: 'Giống ngoài đời: thị trường trả giá cao thì đòi chất lượng và kiểm dịch (chiếu xạ, xử lý hơi nước nóng). Hàng chế biến được miễn các yêu cầu này nên xưởng có lợi thế.' },
  export_processed: { title: 'Hàng chế biến xuất khẩu', limit: 'Giá theo công thức chế biến, hao hụt bằng một phần mười hàng tươi, không xét loại, miễn phí kiểm dịch',
    reason: 'Trái sấy, mứt, cà phê rang để được lâu và nhẹ hơn nên đi xa được; đây là đầu ra chính của chủ xưởng.' },
  tiles_xuong: { title: 'Chủ xưởng không trồng trọt', limit: 'Lô của chủ xưởng là nhà xưởng với các máy, không có ô trồng',
    reason: 'Xưởng mạnh ở khâu chế biến: mua nông sản của nhà vườn và thương lái về làm thành phẩm. Nhờ vậy ba vai cần nhau.' },
  energy: { title: 'Thể lực', limit: `Tối đa ${ENERGY_MAX} điểm ở cấp 1, hồi 1 điểm mỗi ${ENERGY_REGEN_MINUTES} phút; ăn uống hồi ngay`,
    reason: 'Làm vườn, lái xe, đi bộ tham quan đều tốn sức như ngoài đời. Ăn uống ở quầy hàng là cách hồi sức nhanh, cũng là lý do ghé các quầy khi đi du lịch.' },
  workshop_machines: { title: 'Máy trong xưởng', limit: `Tối đa ${WORKSHOP_MAX_MACHINES} máy, mỗi loại ${WORKSHOP_MAX_PER_KIND} cái, nâng tới cấp ${MACHINE_MAX_LEVEL}`,
    reason: 'Nhà xưởng có diện tích hữu hạn. Muốn làm nhiều thì chọn máy cho hợp nguồn nguyên liệu và nâng cấp máy.' },
  super_buy: { title: 'Mua ở siêu thị đặc sản', limit: `Mỗi người ${SUPER_DAILY_KG} kg mỗi ngày ở mỗi siêu thị`,
    reason: 'Siêu thị là nơi khách du lịch mua đặc sản mang về, không phải kho sỉ. Nếu mua thoải mái thì một người vét sạch kệ rồi bán lại, khách tới sau không còn gì.' },
  super_consign: { title: 'Ký gửi hàng lên kệ', limit: `Mỗi lô ${SUPER_MIN_KG}–${SUPER_MAX_LOT_KG} kg, mỗi người tối đa ${SUPER_MAX_LOTS} lô đang bày, phải đang ở tỉnh đó`,
    reason: 'Kệ có hạn, chia cho nhiều người bán. Phải chở hàng tới tận nơi thì quãng đường của thương lái và nhà vườn mới có giá trị.' },
  super_price: { title: 'Giá bán trên kệ', limit: `Từ ${Math.round(SUPER_MIN_RATIO * 100)}% đến ${Math.round(SUPER_MAX_RATIO * 100)}% giá tham chiếu, siêu thị thu phí ${Math.round(SUPER_FEE * 100)}%`,
    reason: 'Sàn giá để siêu thị không rẻ hơn chợ và sạp ở quê, trần giá để kệ không thành đường chuyển tiền giữa các tài khoản. Phí là tiền thuê kệ.' },
  friends: { title: 'Số bạn trong xóm', limit: `Tối đa ${MAX_FRIENDS} người`,
    reason: 'Xóm hiển thị quanh vườn nhà chỉ có chừng đó lô đất.' },
};
