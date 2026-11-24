// Biển mở: tuyến tàu ra đảo lái tự do (cảnh web/src/sea/SeaScene.ts) và mô tô nước (jet ski) cho thuê ở bãi biển du lịch.
// Toạ độ cảng lấy theo bến thật; bản đồ bờ biển dùng web/src/map/vn-outline.ts (Natural Earth 1:10m đã giản lược).
import { ISLAND_FERRIES, region } from './rules.ts';

export interface SeaRoute {
  /** = mã vùng trên đảo (hp_catba, qng_lyson, ag_phuquoc, hcm_condao). */
  id: string;
  mainland: { name: string; lat: number; lng: number };
  island: { name: string; lat: number; lng: number };
  /** Hòn đảo không có trong dữ liệu bờ biển (quá nhỏ ở tỉ lệ 1:10m): dựng tạm một hòn bán kính này (km) quanh cảng đảo. */
  synthIslandKm?: number;
  /** Vùng có đảo đá vôi (vịnh Hạ Long, vịnh Lan Hạ): rải các hòn đá vôi dựng đứng trên mặt biển. */
  karst?: boolean;
  seaKm: number;
}

/** Bến tàu phía đảo (toạ độ gần đúng của cảng khách): Cát Bà — cảng khách thị trấn Cát Bà; Lý Sơn — cảng Lý Sơn;
 *  Phú Quốc — cảng Bãi Vòng; Côn Đảo — cảng Bến Đầm. */
const ISLAND_PIERS: Record<string, { name: string; lat: number; lng: number; synthIslandKm?: number; karst?: boolean }> = {
  hp_catba: { name: 'cảng Cát Bà', lat: 20.726, lng: 107.047, karst: true },
  qng_lyson: { name: 'cảng Lý Sơn', lat: 15.377, lng: 109.108, synthIslandKm: 3.2 },
  ag_phuquoc: { name: 'cảng Bãi Vòng', lat: 10.155, lng: 104.05 },
  hcm_condao: { name: 'cảng Bến Đầm', lat: 8.657, lng: 106.57 },
};

export function seaRoute(islandRegionId: string): SeaRoute | null {
  const f = ISLAND_FERRIES[islandRegionId], p = ISLAND_PIERS[islandRegionId], r = region(islandRegionId);
  if (!f || !p || !r) return null;
  return { id: islandRegionId, mainland: { name: f.port, lat: f.lat, lng: f.lng }, island: { name: p.name, lat: p.lat, lng: p.lng }, synthIslandKm: p.synthIslandKm, karst: p.karst, seaKm: f.seaKm };
}
export const SEA_ROUTE_IDS = Object.keys(ISLAND_PIERS);

/** Chuyến đi giữa hai vùng có chặng biển nào (đảo nào ở một đầu). */
export function seaRouteFor(fromRegionId: string, toRegionId: string): { route: SeaRoute; toIsland: boolean } | null {
  const a = region(fromRegionId), b = region(toRegionId);
  if (b?.island) { const route = seaRoute(b.id); if (route) return { route, toIsland: true }; }
  if (a?.island) { const route = seaRoute(a.id); if (route) return { route, toIsland: false }; }
  return null;
}

// ------------------------------------------------------------------ mô tô nước
export interface JetSkiBeach {
  id: string; name: string; province: string; lat: number; lng: number;
  /** Hướng ra biển (rad, 0 = bắc, π/2 = đông) để đặt vùng phao an toàn trước bãi. */
  seaward: number;
  /** Giá thuê 15 phút (đồng). */
  price15: number;
  source: string;
}
/** Giá tham chiếu: VinWonders Wonderpedia "Jetski Nha Trang" (bãi Trần Phú 800.000–1.000.000đ/người/15–30 phút; Bãi Tranh 650.000đ/15 phút).
 *  Mỹ Khê và Phú Quốc không tìm được bảng giá công khai — đặt theo mức Nha Trang, ghi rõ là ước tính. */
export const JETSKI_BEACHES: JetSkiBeach[] = [
  { id: 'my_khe', name: 'Bãi biển Mỹ Khê', province: 'Đà Nẵng', lat: 16.062, lng: 108.247, seaward: Math.PI / 2, price15: 700_000, source: 'ước tính theo giá Nha Trang (vinwonders.com/vi/wonderpedia/news/jetski-nha-trang)' },
  { id: 'nha_trang', name: 'Bãi biển Trần Phú, Nha Trang', province: 'Khánh Hòa', lat: 12.236, lng: 109.197, seaward: Math.PI / 2, price15: 800_000, source: 'vinwonders.com/vi/wonderpedia/news/jetski-nha-trang (800.000–1.000.000đ/15–30 phút)' },
  { id: 'phu_quoc', name: 'Bãi Trường, Phú Quốc', province: 'An Giang', lat: 10.152, lng: 103.966, seaward: -Math.PI / 2, price15: 800_000, source: 'ước tính theo giá Nha Trang' },
];
export const jetSkiBeach = (id: string) => JETSKI_BEACHES.find((b) => b.id === id) ?? null;
/** Gói thuê (phút thật). Gói 30 phút rẻ hơn hai gói 15 phút như cách các bãi niêm yết. */
export const JETSKI_PLANS = [15, 30] as const;
export type JetSkiMinutes = (typeof JETSKI_PLANS)[number];
export function jetSkiPrice(b: JetSkiBeach, minutes: JetSkiMinutes): number {
  return minutes === 15 ? b.price15 : Math.round((b.price15 * 1.75) / 10_000) * 10_000;
}
/** Thể lực mất khi chạy mô tô nước, EXP nhận khi chạy đủ JETSKI_MIN_RIDE_S giây. */
export const JETSKI_ENERGY = 6, JETSKI_XP = 20, JETSKI_MIN_RIDE_S = 60;
/** Vùng phao bơi an toàn cho mô tô nước (mét, tính từ mép nước): dài dọc bờ × sâu ra biển, cách bờ một khoảng. */
export const JETSKI_ZONE = { along: 520, out: 300, gap: 60 };
