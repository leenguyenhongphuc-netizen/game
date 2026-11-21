// Luật chơi thuần tuý, dùng chung cho máy chủ và giao diện.
import { CROPS, REGIONS, SPECIALTIES, processOf } from './catalog.ts';
import type { Region, Specialty } from './catalog.ts';

export const PLOT_COLS = 6;
export const PLOT_ROWS = 5;
export const TILE_M2 = 25; // 30 ô × 25 m² = 750 m²
export const TILE_COUNT = PLOT_COLS * PLOT_ROWS;

export const START_CASH = 1_000_000;
export const LAND_PRICE = 50_000_000;
export const SEED_COST_RATIO = 0.15;

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
export interface PriceMods { glut?: number; marketDay?: boolean; coop?: boolean; city?: boolean }
/** Giá thương lái trả cho 1 kg tại vùng nhà của người bán, có tính các yếu tố thị trường. */
export function npcPrice(refPrice: number, quality: Quality, specialtyRegionId: string, homeRegionId: string, mods: PriceMods = {}): number {
  const far = specialtyRegionId !== homeRegionId;
  let price = refPrice * (far ? FAR_MARKET_RATIO : FARM_GATE_RATIO) * QUALITY_MULT[quality] * (mods.glut ?? 1);
  if (mods.marketDay) price *= 1 + MARKET_DAY_BONUS;
  if (mods.coop) price *= 1 + COOP_BONUS;
  if (mods.city && far) price *= 1 + CITY_BONUS;
  return Math.round(price / 100) * 100;
}

// ---------------------------------------------------------------- thời tiết
export type WeatherKind = 'nang' | 'may' | 'mua' | 'nang_gat' | 'bao';
export interface Weather { kind: WeatherKind; label: string; icon: string; growth: number; until: number }
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
/** Thời tiết của một vùng: tất định theo (vùng, khung 3 giờ thật) nên máy chủ và giao diện luôn khớp nhau. */
export function weatherAt(regionId: string, nowMs: number): Weather {
  const slot = Math.floor(nowMs / WEATHER_SLOT_MS);
  let h = 2166136261;
  for (const ch of `${regionId}:${slot}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  const u = (h >>> 0) / 4294967296;
  const odds = WEATHER_ODDS[REGIONS[regionId]?.zone ?? 'nam'];
  let kind: WeatherKind = 'nang', acc = 0;
  for (let i = 0; i < odds.length; i++) { acc += odds[i]; if (u < acc) { kind = WEATHER_ORDER[i]; break; } }
  return { kind, ...WEATHER_INFO[kind], until: (slot + 1) * WEATHER_SLOT_MS };
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

// ---------------------------------------------------------------- được mùa mất giá, hợp tác xã, du lịch, quà
export const COOP_MAX_MEMBERS = 20, COOP_CREATE_COST = 200_000;
export const GLUT_KG = 3000, GLUT_MAX_DROP = 0.3;
/** Hệ số giá khi cả máy chủ bán nhiều một loại trong 24 giờ: càng nhiều càng rớt, tối đa GLUT_MAX_DROP. */
export function glutFactor(kg24h: number): number {
  return 1 - GLUT_MAX_DROP * Math.min(1, Math.max(0, kg24h) / GLUT_KG);
}
export const TRAVEL_COST = 20_000, SOUVENIR_RATIO = 1.2, SOUVENIR_MAX_KG = 5;
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
