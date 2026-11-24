// Đi phượt bằng xe máy: các cung đường nổi tiếng, thuê xe tại chỗ, sân sa hình xe máy hạng A1/A. Dùng chung cho máy chủ và giao diện.
// Quãng đường lấy theo cẩm nang du lịch (Hà Giang Loop: VnExpress, vietnamtourism.com); chỗ nào là ước tính thì ghi rõ.
import { fuelPriceNow } from './realPrices.ts';
import { VEHICLES } from './vehicles.ts';
import type { VehicleSpec } from './vehicles.ts';

export type PhuotTheme = 'karst' | 'pass_sea' | 'coast';
export type CheckpointKind = 'photo' | 'fuel' | 'cafe';
export interface PhuotCheckpoint {
  id: string; name: string; atKm: number; kind: CheckpointKind;
  /** Một câu kể ngắn hiện khi tới nơi. */
  note: string;
}
export interface PhuotRoute {
  id: string; name: string; province: string; startName: string; endName: string;
  /** Quãng đường thật (km) của chặng game cho đi. */
  km: number; theme: PhuotTheme;
  /** Độ khó: số khúc cua gắt trên mỗi đoạn đường, ảnh hưởng tốc độ vào cua khuyên dùng. */
  twisty: number;
  /** Xe nên đi (gợi ý), và mức thể lực tối thiểu để xuất phát. */
  advice: string; minEnergy: number;
  /** Vùng trồng gần điểm xuất phát (để chỉ đường đi tới), toạ độ điểm xuất phát. */
  lat: number; lng: number;
  checkpoints: PhuotCheckpoint[];
}

/**
 * Ba cung đường làm trước. Tỉnh ghi theo địa giới sau sắp xếp 2025 (Hà Giang nhập vào Tuyên Quang, Ninh Thuận nhập vào Khánh Hoà),
 * tên địa danh giữ cách gọi quen thuộc.
 */
export const PHUOT_ROUTES: PhuotRoute[] = [
  {
    id: 'ha_giang', name: 'Cung đường Hà Giang – đèo Mã Pí Lèng', province: 'Tuyên Quang', startName: 'Phường Hà Giang', endName: 'Mèo Vạc',
    // Hà Giang → Quản Bạ ~46 km, → Yên Minh ~50 km, → Đồng Văn ~48 km, → Mèo Vạc qua Mã Pí Lèng ~22 km (VnExpress, cẩm nang Hà Giang Loop).
    km: 166, theme: 'karst', twisty: 1, minEnergy: 30, lat: 22.82, lng: 104.98,
    advice: 'Đường đèo đá vôi, cua tay áo liên tục. Xe số hoặc côn tay là đủ; dân phượt hay thuê xe số ngay ở thành phố.',
    checkpoints: [
      { id: 'cot_moc_0', name: 'Cột mốc Km 0 Hà Giang', atKm: 2, kind: 'photo', note: 'Điểm khởi đầu quen thuộc của mọi chuyến đi cao nguyên đá.' },
      { id: 'cong_troi_quan_ba', name: 'Cổng trời Quản Bạ', atKm: 44, kind: 'photo', note: 'Đứng trên đèo nhìn xuống thung lũng có Núi đôi Cô Tiên.' },
      { id: 'yen_minh_xang', name: 'Cây xăng Yên Minh', atKm: 96, kind: 'fuel', note: 'Đổ đầy trước khi lên cao nguyên: đoạn sau cây xăng thưa.' },
      { id: 'doc_tham_ma', name: 'Dốc Thẩm Mã', atKm: 118, kind: 'photo', note: 'Con dốc uốn lượn, trẻ em người Mông hay đứng bán hoa ven đường.' },
      { id: 'pho_co_dong_van', name: 'Phố cổ Đồng Văn', atKm: 144, kind: 'cafe', note: 'Ghé quán cà phê nhà cổ trình tường, uống một ly cho ấm.' },
      { id: 'ma_pi_leng', name: 'Đèo Mã Pí Lèng – sông Nho Quế', atKm: 156, kind: 'photo', note: 'Một trong "tứ đại đỉnh đèo": dưới vực là dòng Nho Quế xanh ngọc.' },
    ],
  },
  {
    id: 'hai_van', name: 'Đèo Hải Vân', province: 'Đà Nẵng', startName: 'Đà Nẵng (chân đèo Nam)', endName: 'Lăng Cô',
    // Đèo dài khoảng 20 km; từ trung tâm Đà Nẵng qua đỉnh đèo tới Lăng Cô khoảng 35 km (ước tính theo bản đồ).
    km: 36, theme: 'pass_sea', twisty: 0.8, minEnergy: 15, lat: 16.11, lng: 108.13,
    advice: 'Ô tô, xe tải đi hầm; đường đèo gần như dành cho xe máy và khách du lịch. Đổ đèo nhớ về số thấp.',
    checkpoints: [
      { id: 'vinh_da_nang', name: 'Khúc cua nhìn vịnh Đà Nẵng', atKm: 10, kind: 'photo', note: 'Cả thành phố và bãi biển trải dài phía dưới.' },
      { id: 'hai_van_quan', name: 'Đỉnh đèo – Hải Vân Quan', atKm: 18, kind: 'photo', note: '"Thiên hạ đệ nhất hùng quan", cổng thành cổ nằm trên đỉnh mây.' },
      { id: 'quan_dinh_deo', name: 'Quán nước đỉnh đèo', atKm: 19, kind: 'cafe', note: 'Ngô nướng, nước dừa, nghỉ chân trước khi đổ đèo.' },
      { id: 'dam_lap_an', name: 'Đầm Lập An – Lăng Cô', atKm: 32, kind: 'photo', note: 'Mặt đầm phẳng lặng soi bóng núi, đặc sản hàu Lăng Cô.' },
    ],
  },
  {
    id: 'bien_vinh_hy', name: 'Cung đường biển Vĩnh Hy – Bình Tiên', province: 'Khánh Hoà', startName: 'Phan Rang', endName: 'Cam Ranh',
    // Đường ven biển Ninh Thuận cũ (ĐT702) từ Phan Rang qua Vĩnh Hy, Bình Tiên tới Cam Ranh: khoảng 80 km (ước tính theo bản đồ).
    km: 80, theme: 'coast', twisty: 0.55, minEnergy: 20, lat: 11.6, lng: 109.15,
    advice: 'Đường nhựa đẹp ôm sát biển, nắng gắt và gió mạnh. Xe nào cũng đi được, nhớ mang nước.',
    checkpoints: [
      { id: 'canh_dong_nho', name: 'Vườn nho ven đường', atKm: 14, kind: 'photo', note: 'Giàn nho, ruộng muối và đàn cừu đặc trưng vùng nắng gió.' },
      { id: 'vinh_vinh_hy', name: 'Vịnh Vĩnh Hy', atKm: 34, kind: 'photo', note: 'Một trong bốn vịnh đẹp nhất Việt Nam, nước trong thấy san hô.' },
      { id: 'quan_vinh_hy', name: 'Quán hải sản Vĩnh Hy', atKm: 36, kind: 'cafe', note: 'Nghỉ trưa với tô bánh canh chả cá.' },
      { id: 'xang_vinh_hy', name: 'Cây xăng Vĩnh Hy', atKm: 38, kind: 'fuel', note: 'Cây xăng cuối trước đoạn đèo ven biển.' },
      { id: 'binh_tien', name: 'Đèo và bãi Bình Tiên', atKm: 58, kind: 'photo', note: 'Đỉnh đèo nhìn xuống bãi cát trắng hoang sơ.' },
    ],
  },
];
export const PHUOT_BY_ID: Record<string, PhuotRoute> = Object.fromEntries(PHUOT_ROUTES.map((r) => [r.id, r]));

/** Thuê xe tại chỗ (giá thuê một ngày ở Hà Giang, Đà Nẵng phổ biến 150–300 nghìn: ước tính theo tin rao cho thuê). Vẫn phải có bằng đúng hạng. */
export const MOTO_RENTALS: { kind: string; perDay: number }[] = [
  { kind: 'moto_so110', perDay: 150_000 },
  { kind: 'moto_con155', perDay: 250_000 },
  { kind: 'moto_adv300', perDay: 900_000 },
];
/** Thể lực mất mỗi 10 km chạy đèo; quán nghỉ hồi lại. EXP mỗi điểm dừng chụp ảnh lần đầu, thưởng khi đi trọn tuyến lần đầu. */
export const PHUOT_RULES = { energyPer10Km: 1, cafeEnergy: 6, cafeCost: 35_000, firstFinishReward: 100_000, minSecondsPerKm: 0.25, minSeconds: 25 };

/** Năng lượng (lít hoặc kWh) cần cho cả tuyến, và tiền nạp nếu trả theo giá dọc đường. */
export function phuotFuel(spec: VehicleSpec, km: number): { need: number; unit: 'lít' | 'kWh'; price: number; cost: number } {
  const need = Math.round(((km * spec.per100) / 100) * 10) / 10, unit = spec.power === 'dien' ? 'kWh' as const : 'lít' as const;
  const price = spec.power === 'dien' ? fuelPriceNow('dien_dc') : fuelPriceNow('ron95');
  return { need, unit, price, cost: Math.round((need * price) / 1000) * 1000 };
}
/** Thời gian chạy thật tối thiểu được chấp nhận khi nộp kết quả (chống gửi kết quả giả). */
export const phuotMinSeconds = (r: PhuotRoute) => Math.max(PHUOT_RULES.minSeconds, Math.round(r.km * PHUOT_RULES.minSecondsPerKm));
/** Thời lượng chạy dự kiến trong game (giây) — đường được nén lại. */
export const phuotSeconds = (r: PhuotRoute) => Math.round(Math.min(160, 45 + r.km * 0.55));
export const isMotoSpec = (kind: string | null | undefined): kind is string => !!kind && VEHICLES[kind]?.group === 'xe_may';

// ---------------------------------------------------------------- sân sa hình xe máy (A1, A)
/** 4 bài thi thực hành mô tô theo Phụ lục XIII Thông tư 35/2024/TT-BGTVT. Kích thước lấy theo dự thảo QCVN sân sát hạch (đường thẳng
 * A1 dài 18 m, A dài 27 m; đường gồ ghề dài 15 m, gờ cao 5 cm cách 1,5 m) — dự thảo, chưa đối chiếu bản chính thức. */
export type MotoTest = 'so_8' | 'duong_thang' | 'vach_can' | 'go_ghe';
export const MOTO_TESTS: Record<MotoTest, { name: string; how: string }> = {
  so_8: { name: 'Đi theo hình số 8', how: 'Vào hình, đi trọn một vòng số 8 rồi ra. Không đè vạch, không chống chân.' },
  duong_thang: { name: 'Đi qua vạch đường thẳng', how: 'Giữ xe thẳng giữa hai vạch, bánh xe không chạm vạch.' },
  vach_can: { name: 'Đi qua đường có vạch cản', how: 'Lượn qua các vạch cản xen kẽ hai bên, không cán vạch cản.' },
  go_ghe: { name: 'Đi qua đường gồ ghề', how: 'Đi chậm, đều ga qua các gờ, giữ thăng bằng, không chống chân.' },
};
/** Trừ điểm và truất quyền (thang 100, đạt từ 80 theo EXAM.sa_hinh). Mức trừ mỗi lỗi là tham khảo các tài liệu ôn thi, chưa đối chiếu văn bản gốc. */
export const MOTO_YARD = { touchLine: 5, footDown: 5, stall: 5, outOfCourse: 'Đi ra ngoài hình thi', fall: 'Đổ xe', wrongOrder: 'Đi sai thứ tự bài', timeLimitSec: 600 };
export const motoStraightLen = (cls: 'A1' | 'A') => (cls === 'A1' ? 18 : 27);

// ---------------------------------------------------------------- thời tiết trên cung đường phượt
/** Kiểu thời tiết: nắng ráo, mưa (đường trơn), sương mù (tầm nhìn ngắn). */
export type PhuotWeather = 'nang' | 'mua' | 'suong';
export interface WeatherSpan { fromKm: number; kind: PhuotWeather }
export const WEATHER_NAME: Record<PhuotWeather, string> = { nang: 'Trời nắng ráo', mua: 'Trời mưa, đường trơn', suong: 'Sương mù dày' };
export const WEATHER_ICON: Record<PhuotWeather, string> = { nang: '☀️', mua: '🌧️', suong: '🌫️' };
/**
 * Xác suất mưa và sương mù theo tháng (1–12) cho từng tuyến, theo khí hậu thật:
 * - Đèo Hải Vân (Đà Nẵng): mùa mưa tháng 9–12, đỉnh tháng 10–11; tháng 12–2 hay có mây mù trên đỉnh đèo.
 * - Hà Giang: mưa nhiều tháng 5–9; mùa đông (12–2) sương mù dày trên cao nguyên đá.
 * - Ven biển Ninh Thuận cũ (Vĩnh Hy): khô hạn nhất cả nước, mưa ít, chủ yếu tháng 9–11.
 * Con số là ước tính theo mô tả khí hậu vùng (mùa mưa, số ngày mưa trung bình), chưa lấy từ chuỗi số liệu trạm khí tượng.
 */
export const PHUOT_CLIMATE: Record<string, { rain: number[]; fog: number[] }> = {
  hai_van: { rain: [0.2, 0.12, 0.1, 0.08, 0.12, 0.12, 0.1, 0.15, 0.4, 0.6, 0.6, 0.45], fog: [0.3, 0.25, 0.15, 0.05, 0, 0, 0, 0, 0.05, 0.1, 0.15, 0.3] },
  ha_giang: { rain: [0.05, 0.08, 0.12, 0.2, 0.4, 0.55, 0.6, 0.55, 0.4, 0.2, 0.1, 0.05], fog: [0.4, 0.35, 0.2, 0.1, 0.05, 0.05, 0.05, 0.05, 0.08, 0.15, 0.25, 0.4] },
  bien_vinh_hy: { rain: [0.03, 0.02, 0.02, 0.03, 0.06, 0.06, 0.06, 0.08, 0.15, 0.25, 0.25, 0.1], fog: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
};
/** Độ bám đường (1 = khô ráo). Mưa làm giảm cả tốc độ vào cua an toàn lẫn lực phanh. */
export const WEATHER_GRIP: Record<PhuotWeather, number> = { nang: 1, mua: 0.68, suong: 0.9 };
/** Áo mưa mua ở quán ven đường (áo mưa bộ phổ thông, giá ước tính theo bán lẻ phổ biến); mưa mà không mặc áo thì mất thêm thể lực. */
export const RAINCOAT = { cost: 60_000, extraEnergyPer10Km: 1 };
/** Thời tiết từng đoạn. Đổi tối đa một lần giữa chuyến. Tất định theo hạt giống (mã chuyến) để máy chủ và máy người chơi khớp nhau. */
export function weatherPlan(routeId: string, month: number, seed: number): WeatherSpan[] {
  const route = PHUOT_BY_ID[routeId], c = PHUOT_CLIMATE[routeId];
  if (!route || !c) return [{ fromKm: 0, kind: 'nang' }];
  let x = ((seed >>> 0) ^ 0x9e3779b9) >>> 0 || 1;
  const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  const m = Math.min(12, Math.max(1, Math.round(month))) - 1;
  const draw = (): PhuotWeather => { const r = rnd(); return r < c.rain[m] ? 'mua' : r < c.rain[m] + c.fog[m] ? 'suong' : 'nang'; };
  const first = draw(), plan: WeatherSpan[] = [{ fromKm: 0, kind: first }];
  // một nửa số chuyến đổi trời giữa đường (mưa đèo đến nhanh, tạnh cũng nhanh)
  if (rnd() < 0.5) { const second = draw(); if (second !== first) plan.push({ fromKm: Math.round(route.km * (0.3 + rnd() * 0.4)), kind: second }); }
  return plan;
}
export function weatherAt(plan: WeatherSpan[], km: number): PhuotWeather {
  let k: PhuotWeather = plan[0]?.kind ?? 'nang'; for (const p of plan) if (km >= p.fromKm) k = p.kind; return k;
}
/** Số km chạy dưới mưa trong đoạn [a, b]. */
export function rainKm(plan: WeatherSpan[], a: number, b: number): number {
  let sum = 0;
  for (let i = 0; i < plan.length; i++) {
    if (plan[i].kind !== 'mua') continue;
    const lo = Math.max(a, plan[i].fromKm), hi = Math.min(b, plan[i + 1]?.fromKm ?? Infinity);
    if (hi > lo) sum += hi - lo;
  }
  return sum;
}
/** Thể lực mất thêm vì dầm mưa (không áo mưa) trong đoạn đã chạy; mặc áo mưa từ km `coatAtKm` thì phần sau không mất thêm. */
export function rainEnergy(plan: WeatherSpan[], kmDone: number, coatAtKm: number | null): number {
  const wet = rainKm(plan, 0, coatAtKm === null ? kmDone : Math.min(kmDone, coatAtKm));
  return Math.round((wet / 10) * RAINCOAT.extraEnergyPer10Km);
}
