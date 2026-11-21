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
/** Giá thương lái trả cho 1 kg tại vùng nhà của người bán. */
export function npcPrice(refPrice: number, quality: Quality, specialtyRegionId: string, homeRegionId: string): number {
  const ratio = specialtyRegionId === homeRegionId ? FARM_GATE_RATIO : FAR_MARKET_RATIO;
  return Math.round((refPrice * ratio * QUALITY_MULT[quality]) / 100) * 100;
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
