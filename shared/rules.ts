// Luật chơi thuần tuý, dùng chung cho máy chủ và giao diện.
import { CROPS, REGIONS, SPECIALTIES, processOf } from './catalog.ts';
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
  xuong: { name: 'Chủ xưởng', icon: '🏭', desc: 'Chỉ chủ xưởng mới chế biến được nông sản, xưởng có 4 chỗ làm. Vườn nhỏ 8 ô.' },
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
/** Vườn nhỏ của chủ xưởng và thương lái: 8 ô, hàng 1..2 × cột 1..4. */
export const SMALL_TILES: number[] = [1, 2].flatMap((row) => [1, 2, 3, 4].map((col) => row * PLOT_COLS + col));
/** Các ô được trồng của một lô, theo kiểu lô và vai trò của chủ lô. */
export function allowedTiles(kind: 'ground' | 'rooftop', role: Role | null): number[] {
  if (!role) return [];
  if (role !== 'nong_dan') return SMALL_TILES;
  return kind === 'rooftop' ? ROOFTOP_TILES : Array.from({ length: TILE_COUNT }, (_, i) => i);
}
/** Người không phải thương lái chỉ "bán tháo" được cho doanh nghiệp ở mức này so với giá tham chiếu. */
export const DUMP_RATIO = 0.6;
/** Tiền xăng mỗi km của một chuyến xe (cách tính cũ, giữ lại cho mã cũ còn tham chiếu). */
export const FUEL_PER_KM = 300;

/** Xe tải của thương lái: bình xăng, mức tiêu hao, giá xăng, trạm thu phí, trạm xăng, cứu hộ. */
export const TRUCK = { tankL: 60, lPer100km: 12, fuelPrice: 21000, tollEveryKm: 70, tollFee: 35000, stationEveryKm: 60, rescueMult: 1.5, etcCashSurcharge: 0.2, startFuelL: 30, cargoKg: 500 };
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
export const COOP_MAX_MEMBERS = 20, COOP_CREATE_COST = 200_000;
export const GLUT_KG = 3000, GLUT_MAX_DROP = 0.3;
/** Hệ số giá khi cả máy chủ bán nhiều một loại trong 24 giờ: càng nhiều càng rớt, tối đa GLUT_MAX_DROP. */
export function glutFactor(kg24h: number): number {
  return 1 - GLUT_MAX_DROP * Math.min(1, Math.max(0, kg24h) / GLUT_KG);
}
/** Quà đặc sản bán đắt hơn mọi mức thương lái trả (kể cả cộng dồn thưởng) và giới hạn số lần mua mỗi ngày, để không mua đi bán lại kiếm lời. */
export const TRAVEL_COST = 20_000, SOUVENIR_RATIO = 1.8, SOUVENIR_MAX_KG = 5, SOUVENIR_DAILY_BUYS = 3;
/** Phương tiện đi du lịch: giá vé = base + perKm × quãng đường; seconds là thời lượng hoạt cảnh trên đường. */
export type TravelMode = 'xe_khach' | 'tau_hoa' | 'may_bay' | 'tau_thuy';
export const TRAVEL_MODES: Record<TravelMode, { name: string; icon: string; base: number; perKm: number; seconds: number }> = {
  xe_khach: { name: 'Xe khách', icon: '🚌', base: 10_000, perKm: 150, seconds: 10 },
  tau_hoa: { name: 'Tàu hoả', icon: '🚆', base: 20_000, perKm: 250, seconds: 10 },
  may_bay: { name: 'Máy bay', icon: '✈️', base: 300_000, perKm: 1500, seconds: 8 },
  tau_thuy: { name: 'Tàu thuỷ', icon: '⛴️', base: 50_000, perKm: 600, seconds: 10 },
};
/** Các phương tiện đi được giữa hai vùng, kèm giá vé. Ra vào đảo phải đi tàu thuỷ hoặc máy bay. */
export function travelOptions(fromRegionId: string, toRegionId: string): { mode: TravelMode; fare: number; km: number }[] {
  const a = region(fromRegionId), b = region(toRegionId);
  if (!a || !b || a.id === b.id) return [];
  const km = Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng));
  const modes: TravelMode[] = a.island || b.island
    ? ['tau_thuy', ...(km >= 300 ? ['may_bay' as const] : [])]
    : ['xe_khach', ...(km >= 150 ? ['tau_hoa' as const] : []), ...(km >= 400 ? ['may_bay' as const] : [])];
  return modes.map((mode) => ({ mode, fare: Math.round((TRAVEL_MODES[mode].base + TRAVEL_MODES[mode].perKm * km) / 1000) * 1000, km }));
}
export const GIFT_DAILY_LIMIT = 5, GIFT_MAX_KG = 20, REGION_SET_REWARD = 50_000;

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
/** Mỗi đặc sản, mỗi vùng chỉ có chừng này kg cho tất cả thương lái thu mua trong một ngày. */
export const WHOLESALE_SUPPLY_KG = 1500;
/** Giá mua sỉ 1 kg tại vùng trồng; được mùa (glut < 1) thì rẻ hơn. */
export function wholesalePrice(refPrice: number, glut = 1): number {
  return Math.round((refPrice * WHOLESALE_RATIO * glut) / 100) * 100;
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
      `Thu mua sỉ tại vườn với ${Math.round(WHOLESALE_RATIO * 100)}% giá tham chiếu, tối đa ${TRUCK.cargoKg} kg mỗi điểm đỗ, rồi chở về bán lại.`,
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
  xe_tai: { name: 'Xe tải biên mậu', icon: '🚚', minKg: 50, maxKg: 500, baseFee: 300_000, perKgFee: 1_500, minutes: 20, spoil: 0.03, gate: 'cua_khau', note: 'Lô nhỏ, đi nhanh qua cửa khẩu; cước mỗi kg cao hơn container.' },
  container: { name: 'Xe container lạnh', icon: '🚛', minKg: 500, maxKg: 5_000, baseFee: 2_500_000, perKgFee: 900, minutes: 30, spoil: 0.01, gate: 'cua_khau', note: 'Giữ lạnh nên hao ít nhất trong đường bộ; phải đủ nửa tấn mới chạy.' },
  tau_hoa: { name: 'Tàu hoả liên vận', icon: '🚂', minKg: 300, maxKg: 8_000, baseFee: 1_500_000, perKgFee: 600, minutes: 45, spoil: 0.04, gate: 'ga', note: 'Rẻ hơn đường bộ khi hàng nhiều, nhưng chậm và chỉ đi được sang Trung Quốc.' },
  hang_khong: { name: 'Máy bay chở hàng', icon: '✈️', minKg: 20, maxKg: 1_000, baseFee: 800_000, perKgFee: 12_000, minutes: 10, spoil: 0, gate: 'san_bay', note: 'Nhanh nhất, không hao hụt, cước rất đắt: chỉ hợp hàng giá trị cao.' },
  tau_nho: { name: 'Tàu biển nhỏ', icon: '⛴️', minKg: 200, maxKg: 3_000, baseFee: 1_000_000, perKgFee: 500, minutes: 60, spoil: 0.06, gate: 'cang', note: 'Chạy tuyến gần trong Đông Nam Á; rẻ nhưng hàng tươi hao khá nhiều.' },
  tau_lon: { name: 'Tàu container viễn dương', icon: '🚢', minKg: 2_000, maxKg: 50_000, baseFee: 6_000_000, perKgFee: 250, minutes: 120, spoil: 0.1, gate: 'cang', note: 'Cước mỗi kg rẻ nhất, đi rất lâu: hợp hàng khô số lượng lớn.' },
};
export type ExportMarket = 'trung_quoc' | 'lao_cam' | 'asean' | 'nhat_han' | 'au_my';
export const EXPORT_MARKETS: Record<ExportMarket, { name: string; icon: string; priceMult: number; modes: ExportMode[]; gradeA: boolean; note: string }> = {
  trung_quoc: { name: 'Trung Quốc', icon: '🇨🇳', priceMult: 1.25, modes: ['xe_tai', 'container', 'tau_hoa'], gradeA: false, note: 'Chợ biên mậu gần, mua số lượng lớn, giá vừa phải.' },
  lao_cam: { name: 'Lào – Campuchia', icon: '🇱🇦', priceMult: 1.15, modes: ['xe_tai', 'container'], gradeA: false, note: 'Gần và dễ tính, giá chỉ nhỉnh hơn trong nước.' },
  asean: { name: 'Thái Lan – Singapore', icon: '🌏', priceMult: 1.3, modes: ['tau_nho', 'hang_khong'], gradeA: false, note: 'Đi tàu nhỏ hoặc máy bay, giá khá.' },
  nhat_han: { name: 'Nhật Bản – Hàn Quốc', icon: '🇯🇵', priceMult: 1.6, modes: ['hang_khong', 'tau_lon'], gradeA: true, note: 'Giá cao nhưng chỉ nhận hàng Loại 1.' },
  au_my: { name: 'Châu Âu – Mỹ', icon: '🌍', priceMult: 1.9, modes: ['hang_khong', 'tau_lon'], gradeA: true, note: 'Giá cao nhất, xa nhất, chỉ nhận hàng Loại 1.' },
};
/** Cửa ngõ xuất khẩu thật: hàng phải chở nội địa tới đó trước, càng xa càng tốn. */
export const EXPORT_GATEWAYS: { id: string; name: string; gate: ExportModeInfo['gate']; lat: number; lng: number; markets: ExportMarket[] }[] = [
  { id: 'huu_nghi', name: 'Cửa khẩu Hữu Nghị (Lạng Sơn)', gate: 'cua_khau', lat: 21.97, lng: 106.71, markets: ['trung_quoc'] },
  { id: 'kim_thanh', name: 'Cửa khẩu Kim Thành (Lào Cai)', gate: 'cua_khau', lat: 22.5, lng: 103.96, markets: ['trung_quoc'] },
  { id: 'mong_cai', name: 'Cửa khẩu Móng Cái (Quảng Ninh)', gate: 'cua_khau', lat: 21.53, lng: 107.97, markets: ['trung_quoc'] },
  { id: 'lao_bao', name: 'Cửa khẩu Lao Bảo (Quảng Trị)', gate: 'cua_khau', lat: 16.62, lng: 106.6, markets: ['lao_cam'] },
  { id: 'moc_bai', name: 'Cửa khẩu Mộc Bài (Tây Ninh)', gate: 'cua_khau', lat: 11.08, lng: 106.18, markets: ['lao_cam'] },
  { id: 'ga_dong_dang', name: 'Ga liên vận Đồng Đăng (Lạng Sơn)', gate: 'ga', lat: 21.95, lng: 106.7, markets: ['trung_quoc'] },
  { id: 'ga_lao_cai', name: 'Ga liên vận Lào Cai', gate: 'ga', lat: 22.5, lng: 103.97, markets: ['trung_quoc'] },
  { id: 'noi_bai', name: 'Sân bay Nội Bài (Hà Nội)', gate: 'san_bay', lat: 21.22, lng: 105.8, markets: ['asean', 'nhat_han', 'au_my'] },
  { id: 'da_nang_bay', name: 'Sân bay Đà Nẵng', gate: 'san_bay', lat: 16.04, lng: 108.2, markets: ['asean', 'nhat_han', 'au_my'] },
  { id: 'tan_son_nhat', name: 'Sân bay Tân Sơn Nhất (TP. Hồ Chí Minh)', gate: 'san_bay', lat: 10.82, lng: 106.65, markets: ['asean', 'nhat_han', 'au_my'] },
  { id: 'hai_phong', name: 'Cảng Hải Phòng', gate: 'cang', lat: 20.86, lng: 106.68, markets: ['asean', 'nhat_han', 'au_my'] },
  { id: 'tien_sa', name: 'Cảng Tiên Sa (Đà Nẵng)', gate: 'cang', lat: 16.12, lng: 108.21, markets: ['asean', 'nhat_han', 'au_my'] },
  { id: 'cai_mep', name: 'Cảng Cái Mép (TP. Hồ Chí Minh)', gate: 'cang', lat: 10.5, lng: 107.02, markets: ['asean', 'nhat_han', 'au_my'] },
];
/** Cước chở nội địa tới cửa ngõ: đồng cho mỗi kg mỗi km. */
export const EXPORT_INLAND_PER_KG_KM = 1.2;
/** Số lô hàng xuất khẩu đang trên đường tối đa của một người. */
export const EXPORT_MAX_ACTIVE = 3;
const DRY_KINDS = new Set(['cn', 'lua']);
/** Ai được đi đường nào: thương lái đi mọi đường; người khác chỉ gửi lô nhỏ, vào hợp tác xã thì thêm đường gom hàng. */
export function exportModesFor(role: Role | null, inCoop: boolean): ExportMode[] {
  if (role === 'thuong_lai') return ['xe_tai', 'container', 'tau_hoa', 'hang_khong', 'tau_nho', 'tau_lon'];
  if (!role) return [];
  return inCoop ? ['xe_tai', 'hang_khong', 'container', 'tau_hoa', 'tau_nho'] : ['xe_tai', 'hang_khong'];
}
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
}
/** Báo giá một lô xuất khẩu. `refPrice` mặc định là giá tham chiếu trong danh mục; máy chủ truyền giá hiện hành. */
export function exportQuote(specialtyId: string, grade: Quality, kg: number, mode: ExportMode, market: ExportMarket, fromRegionId: string, refPrice?: number): ExportQuote {
  const sp = SPECIALTIES[specialtyId], m = EXPORT_MODES[mode], mk = EXPORT_MARKETS[market], from = REGIONS[fromRegionId];
  const base: ExportQuote = { ok: false, mode, market, kg, gatewayId: '', gatewayName: '', inlandKm: 0, freight: 0, spoilKg: 0, arriveKg: 0, unitPrice: 0, payout: 0, net: 0, minutes: m?.minutes ?? 0 };
  if (!sp || !m || !mk || !from) return { ...base, reason: 'Thông tin lô hàng không hợp lệ.' };
  const gates = EXPORT_GATEWAYS.filter((g) => g.gate === m.gate && g.markets.includes(market))
    .map((g) => ({ g, km: Math.round(haversineKm(from.lat, from.lng, g.lat, g.lng)) })).sort((a, b) => a.km - b.km);
  if (!mk.modes.includes(mode) || !gates.length) return { ...base, reason: `${m.name} không đi tới ${mk.name}.` };
  const { g, km } = gates[0];
  const dry = DRY_KINDS.has(CROPS[sp.crop].kind);
  const spoilKg = Math.floor(kg * m.spoil * (dry ? 0.2 : 1)), arriveKg = kg - spoilKg;
  const freight = Math.round((m.baseFee + m.perKgFee * kg + EXPORT_INLAND_PER_KG_KM * km * kg) / 1000) * 1000;
  const unitPrice = Math.round(((refPrice ?? sp.refPrice) * mk.priceMult * QUALITY_MULT[grade]) / 100) * 100;
  const payout = unitPrice * arriveKg;
  const q: ExportQuote = { ...base, gatewayId: g.id, gatewayName: g.name, inlandKm: km, freight, spoilKg, arriveKg, unitPrice, payout, net: payout - freight };
  if (kg < m.minKg) return { ...q, reason: `${m.name} nhận lô từ ${m.minKg} kg.` };
  if (kg > m.maxKg) return { ...q, reason: `${m.name} chỉ chở tối đa ${m.maxKg} kg một lô.` };
  if (mk.gradeA && grade !== 'A') return { ...q, reason: `${mk.name} chỉ nhận hàng Loại 1.` };
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

// ---------------------------------------------------------------- vì sao có giới hạn
/** Mỗi giới hạn trong game kèm một câu giải thích lý do, để giao diện hiện ngay cạnh con số. */
export const LIMIT_REASONS: Record<string, { title: string; limit: string; reason: string }> = {
  souvenir: { title: 'Quà đặc sản ở quầy trưng bày', limit: `Mỗi lần ${SOUVENIR_MAX_KG} kg, mỗi ngày ${SOUVENIR_DAILY_BUYS} lần, giá ${Math.round(SOUVENIR_RATIO * 100)}% giá tham chiếu`,
    reason: 'Quầy bán quà cho khách du lịch để lấy tem sưu tập, không phải nơi buôn hàng. Nếu mua thoải mái thì ai cũng gom đủ hàng mọi miền mà không cần trồng hay buôn. Muốn mua nhiều: thương lái lái xe tải tới và thu mua sỉ tại vườn.' },
  wholesale_cargo: { title: 'Thu mua sỉ bằng xe tải', limit: `Tối đa ${TRUCK.cargoKg} kg mỗi điểm đỗ (và mỗi ngày nếu xe không đi đâu)`,
    reason: 'Thùng xe chỉ chở được chừng đó. Muốn mua thêm thì phải chạy thêm chuyến, nên quãng đường và tiền xăng mới có ý nghĩa.' },
  wholesale_supply: { title: 'Nguồn hàng sỉ của vùng', limit: `${WHOLESALE_SUPPLY_KG} kg mỗi đặc sản mỗi ngày cho tất cả thương lái`,
    reason: 'Vườn trong vùng mỗi ngày chỉ hái được chừng đó. Thương lái tới sớm thì còn hàng, để không ai vét sạch một vùng.' },
  wholesale_role: { title: 'Ai được thu mua sỉ', limit: 'Chỉ thương lái',
    reason: 'Chỉ thương lái có xe tải. Nhà vườn và chủ xưởng mua hàng vùng khác qua chợ hoặc từ thương lái, để ba vai cần nhau.' },
  gift: { title: 'Tặng quà cho bạn', limit: `Mỗi ngày ${GIFT_DAILY_LIMIT} lần, mỗi lần tối đa ${GIFT_MAX_KG} kg`,
    reason: 'Để quà là quà, không thành đường chuyển hàng và tiền giữa các tài khoản phụ.' },
  orders: { title: 'Đơn hàng mỗi ngày', limit: `${ORDERS_PER_DAY} đơn mỗi ngày, trả ${Math.round(ORDER_PREMIUM * 100)}% giá tham chiếu`,
    reason: 'Đơn trả giá cao hơn thị trường nên chỉ có vài đơn, đủ để mỗi ngày có việc mà không thay thế việc buôn bán.' },
  tiles: { title: 'Số ô trồng theo vai', limit: `Nhà vườn trồng cả ${TILE_COUNT} ô; thương lái và chủ xưởng ${SMALL_TILES.length} ô`,
    reason: 'Mỗi vai mạnh một khâu: nhà vườn trồng nhiều, chủ xưởng chế biến, thương lái buôn xa. Vườn nhỏ để thương lái phải mua hàng của người khác.' },
  dump: { title: 'Bán tháo', limit: `Người không phải thương lái chỉ bán cho doanh nghiệp ở ${Math.round(DUMP_RATIO * 100)}% giá tham chiếu`,
    reason: 'Để nhà vườn có lý do bán qua chợ, sạp hoặc thương lái thay vì bấm bán ngay.' },
  coop_members: { title: 'Thành viên hợp tác xã', limit: `Tối đa ${COOP_MAX_MEMBERS} người, cùng một vùng trồng`,
    reason: 'Hợp tác xã là xóm cùng trồng một loại đặc sản; nhỏ vừa đủ để ai cũng thấy phần mình góp.' },
  coop_order: { title: 'Đơn lớn của hợp tác xã', limit: `${COOP_ORDER_KG_PER_MEMBER} kg mỗi thành viên, hạn ${COOP_ORDER_DAYS} ngày, thưởng ${Math.round(COOP_ORDER_BONUS * 100)}%`,
    reason: 'Đơn xuất khẩu cần gom đủ hàng mới đi được một chuyến; chia theo đầu người để hợp tác xã đông hay ít đều làm nổi.' },
  export_role: { title: 'Ai xuất khẩu được đường nào', limit: 'Thương lái: mọi đường. Vai khác: xe tải biên mậu và máy bay; vào hợp tác xã thì thêm container, tàu hoả, tàu nhỏ',
    reason: 'Thuê nguyên chuyến container hay tàu cần đầu mối gom hàng. Một nhà vườn riêng lẻ chỉ gửi được lô nhỏ.' },
  export_min: { title: 'Khối lượng tối thiểu mỗi lô', limit: (Object.keys(EXPORT_MODES) as ExportMode[]).map((k) => `${EXPORT_MODES[k].name} từ ${EXPORT_MODES[k].minKg} kg`).join('; '),
    reason: 'Xe, tàu càng lớn thì cước mỗi kg càng rẻ nhưng phải đủ hàng mới chạy. Vì vậy mới cần gom hàng và chọn đường cho hợp.' },
  export_active: { title: 'Lô hàng đang trên đường', limit: `Tối đa ${EXPORT_MAX_ACTIVE} lô cùng lúc`,
    reason: 'Để mỗi lô là một quyết định có cân nhắc, không phải bấm liên tục.' },
  export_grade: { title: 'Thị trường khó tính', limit: 'Nhật – Hàn và Âu – Mỹ chỉ nhận hàng Loại 1',
    reason: 'Giống ngoài đời: thị trường trả giá cao thì đòi chất lượng cao. Chăm cây đúng giờ mới có hàng Loại 1.' },
  friends: { title: 'Số bạn trong xóm', limit: `Tối đa ${MAX_FRIENDS} người`,
    reason: 'Xóm hiển thị quanh vườn nhà chỉ có chừng đó lô đất.' },
};
