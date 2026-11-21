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
export const TRUCK = { tankL: 60, lPer100km: 12, fuelPrice: 21000, tollEveryKm: 70, tollFee: 35000, stationEveryKm: 60, rescueMult: 1.5, etcCashSurcharge: 0.2, startFuelL: 30 };
export interface TripPlan {
  km: number; needsBoat: boolean; seconds: number; tolls: number; tollFee: number; fuelNeededL: number;
  junctions: { atKm: number; dir: 'L' | 'R'; name: string }[]; stationsAtKm: number[];
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
    fuelNeededL: Math.round(((road * TRUCK.lPer100km) / 100) * 10) / 10, junctions, stationsAtKm,
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
