// Nông trại quy mô lớn: cánh đồng theo khối 100 ô, cơ giới hoá (máy cày, máy gieo, hệ tưới, drone, máy thu hoạch), trực thăng tham quan.
// Dùng chung cho máy chủ (luật, giá) và giao diện (hiển thị, ước tính trước khi bấm).
import { CROPS, REGIONS, SPECIALTIES, processOf } from './catalog.ts';
import type { Specialty } from './catalog.ts';
import { landPrice, seedCost, stepWaitMs } from './rules.ts';

/** Một khối cánh đồng = 100 ô × 25 m² = 2.500 m² (0,25 ha). */
export const FIELD_BLOCK_TILES = 100;
export const FIELD_BLOCK_M2 = FIELD_BLOCK_TILES * 25;
/** Mỗi khối gộp tối đa bấy nhiêu khối liền nhau thành một cánh đồng (một loại cây, chăm một lượt). */
export const FIELD_MAX_BLOCKS_PER_FIELD = 10;
/** Cấp mở cánh đồng; mỗi cấp sau đó được thêm FIELD_BLOCKS_PER_LEVEL khối, tối đa FIELD_MAX_BLOCKS (4.000 ô = 1 ha). */
export const FIELD_MIN_LEVEL = 5, FIELD_BLOCKS_PER_LEVEL = 2, FIELD_MAX_BLOCKS = 40;
/** Từ cấp này được mua cánh đồng ở vùng khác (không chỉ vùng nhà). */
export const FIELD_ANY_REGION_LEVEL = 10;
/** Đất ruộng trống rẻ hơn đất vườn có nhà: giá một khối = giá một thửa vườn × hệ số này. */
export const FIELD_PRICE_RATIO = 1.2;
/** Canh tác quảng canh: năng suất mỗi ô thấp hơn vườn nhà chăm kỹ từng ô. */
export const FIELD_YIELD_MULT = 0.5;
/** Cánh đồng là việc của người chơi đã quen: nhịp sinh trưởng cố định bằng nhịp của người đã thu hoạch nhiều. */
export const FIELD_PACE = 2;
/** Bán lại cánh đồng được bấy nhiêu phần giá mua. */
export const FIELD_RESALE = 0.7;

export function fieldMaxBlocks(level: number): number {
  return level < FIELD_MIN_LEVEL ? 0 : Math.min(FIELD_MAX_BLOCKS, (level - FIELD_MIN_LEVEL + 1) * FIELD_BLOCKS_PER_LEVEL);
}
export function fieldBlockPrice(regionId: string): number {
  return Math.round((landPrice(regionId) * FIELD_PRICE_RATIO) / 1_000_000) * 1_000_000;
}
export function fieldRegionAllowed(level: number, regionId: string, homeRegionId: string | null): boolean {
  return Object.hasOwn(REGIONS, regionId) && (regionId === homeRegionId || level >= FIELD_ANY_REGION_LEVEL);
}

/** Loại việc của một bước chăm (quyết định máy nào làm được). */
export type WorkKind = 'dat' | 'gieo' | 'tuoi' | 'bon' | 'phun' | 'thu' | 'khac';
export const WORK_NAMES: Record<WorkKind, string> = {
  dat: 'Làm đất', gieo: 'Gieo trồng', tuoi: 'Tưới nước', bon: 'Bón phân', phun: 'Phun thuốc, phòng bệnh', thu: 'Thu hoạch', khac: 'Chăm sóc bằng tay',
};
export function workKindOf(stepName: string): WorkKind {
  const n = stepName.toLowerCase();
  if (/thu hoạch|thu hái|gặt|nhổ|hái/.test(n)) return 'thu';
  if (/^(làm|chuẩn bị|cày|xới|lên) (đất|luống|liếp|mô)|đào hố|lên mô/.test(n)) return 'dat';
  if (/bón/.test(n)) return 'bon';
  if (/sâu|bệnh|phòng|phun|bao trái/.test(n)) return 'phun';
  if (/tưới|nước|ẩm/.test(n)) return 'tuoi';
  if (/trồng|giống|gieo|cấy|ươm|hom/.test(n)) return 'gieo';
  return 'khac';
}

/** Cách làm một bước: tự làm, thuê nhân công, dùng máy của mình, dùng drone. */
export type WorkMethod = 'tay' | 'thue' | 'may' | 'drone';
export const METHOD_NAMES: Record<WorkMethod, string> = { tay: 'Tự làm', thue: 'Thuê nhân công', may: 'Dùng máy', drone: 'Drone' };
/** Tự làm: ô mỗi giờ (giờ trong game), thể lực mỗi khối. Chỉ hợp cánh đồng nhỏ. */
export const HAND_TILES_PER_HOUR = 60, HAND_ENERGY_PER_BLOCK = 12;
/** Thuê nhân công: đồng mỗi ô cho mỗi bước, ô mỗi giờ (một tổ thợ). */
export const HIRE_COST_PER_TILE = 4_000, HIRE_TILES_PER_HOUR = 250;

export type FarmMachineKind = 'may_cay' | 'may_gieo' | 'he_tuoi' | 'drone' | 'may_thu' | 'truc_thang';
export interface FarmMachine {
  kind: FarmMachineKind; name: string; emoji: string; price: number; minLevel: number;
  /** Việc làm được. */
  works: WorkKind[];
  /** Ô mỗi giờ trong game. */
  tilesPerHour: number;
  /** Nhiên liệu/điện + hao mòn, đồng mỗi ô. */
  costPerTile: number;
  /** Thể lực mỗi lượt (ngồi máy vẫn mệt một chút). */
  energy: number;
  note: string;
}
export const FARM_MACHINES: Record<FarmMachineKind, FarmMachine> = {
  he_tuoi: { kind: 'he_tuoi', name: 'Hệ tưới nhỏ giọt tự động', emoji: '💧', price: 30_000_000, minLevel: 5, works: ['tuoi'], tilesPerHour: 3_000, costPerTile: 200, energy: 0,
    note: 'Ống nhỏ giọt và bơm hẹn giờ cho mọi cánh đồng của bạn: tưới gần như tức thì, tiết kiệm nước.' },
  may_cay: { kind: 'may_cay', name: 'Máy cày – xới 25 mã lực', emoji: '🚜', price: 180_000_000, minLevel: 6, works: ['dat'], tilesPerHour: 500, costPerTile: 600, energy: 2,
    note: 'Cày ải, xới tơi và lên luống. Chạy trong ruộng, không ra đường lớn nên trong game không cần bằng lái ô tô.' },
  may_gieo: { kind: 'may_gieo', name: 'Máy gieo – cấy', emoji: '🌱', price: 120_000_000, minLevel: 7, works: ['gieo'], tilesPerHour: 600, costPerTile: 500, energy: 2,
    note: 'Gieo hạt theo hàng hoặc cấy mạ, trồng cây con đều khoảng cách.' },
  drone: { kind: 'drone', name: 'Drone nông nghiệp 30 lít', emoji: '🛸', price: 95_000_000, minLevel: 8, works: ['bon', 'phun', 'tuoi'], tilesPerHour: 1_600, costPerTile: 250, energy: 0,
    note: 'Ngồi một chỗ điều khiển drone rải phân, phun thuốc theo đường bay đặt sẵn. Mỗi chuyến bay một bình 30 lít, sạc pin giữa các chuyến; chỉ bay cánh đồng trong cùng vùng với bạn.' },
  may_thu: { kind: 'may_thu', name: 'Máy thu hoạch đa năng', emoji: '🌾', price: 350_000_000, minLevel: 10, works: ['thu'], tilesPerHour: 500, costPerTile: 900, energy: 3,
    note: 'Máy gặt đập liên hợp cho lúa, băng chuyền thu hái và phân loại cho cây trái.' },
  truc_thang: { kind: 'truc_thang', name: 'Trực thăng nông nghiệp', emoji: '🚁', price: 3_500_000_000, minLevel: 15, works: [], tilesPerHour: 0, costPerTile: 0, energy: 0,
    note: 'Bay tham quan toàn bộ cánh đồng của bạn từ trên cao bất cứ lúc nào, không phải thuê.' },
};
export const FARM_MACHINE_KINDS = Object.keys(FARM_MACHINES) as FarmMachineKind[];
/** Thuê trực thăng bay một vòng tham quan (chưa có trực thăng riêng). Cấp tối thiểu để thuê. */
export const HELI_TOUR_FEE = 3_000_000, HELI_TOUR_MIN_LEVEL = 8;

export interface WorkPlan { ok: boolean; why?: string; method: WorkMethod; cost: number; hours: number; energy: number; machine?: FarmMachineKind }
/** Giá, thời gian, thể lực để làm một bước trên một cánh đồng bằng một cách làm. */
export function workPlan(kind: WorkKind, method: WorkMethod, tiles: number, owned: FarmMachineKind[]): WorkPlan {
  const blocks = tiles / FIELD_BLOCK_TILES;
  if (method === 'tay') return { ok: true, method, cost: 0, hours: tiles / HAND_TILES_PER_HOUR, energy: Math.ceil(blocks * HAND_ENERGY_PER_BLOCK) };
  if (method === 'thue') return { ok: true, method, cost: Math.round((tiles * HIRE_COST_PER_TILE) / 1000) * 1000, hours: tiles / HIRE_TILES_PER_HOUR, energy: 0 };
  const want = method === 'drone' ? (['drone'] as FarmMachineKind[]) : FARM_MACHINE_KINDS.filter((k) => k !== 'drone' && FARM_MACHINES[k].works.includes(kind));
  const have = want.filter((k) => owned.includes(k)).sort((a, b) => FARM_MACHINES[b].tilesPerHour - FARM_MACHINES[a].tilesPerHour)[0];
  if (!want.length || (method === 'drone' && !FARM_MACHINES.drone.works.includes(kind))) return { ok: false, why: `Việc "${WORK_NAMES[kind]}" không làm bằng ${METHOD_NAMES[method].toLowerCase()} được.`, method, cost: 0, hours: 0, energy: 0 };
  if (!have) return { ok: false, why: `Bạn chưa có ${FARM_MACHINES[want[0]].name.toLowerCase()}.`, method, cost: 0, hours: 0, energy: 0, machine: want[0] };
  const m = FARM_MACHINES[have];
  return { ok: true, method, cost: Math.round((tiles * m.costPerTile) / 1000) * 1000, hours: tiles / m.tilesPerHour, energy: m.energy, machine: have };
}
/** Các cách làm có thể dùng cho một việc (để giao diện hiện nút). */
export function methodsFor(kind: WorkKind): WorkMethod[] {
  const out: WorkMethod[] = ['tay', 'thue'];
  if (FARM_MACHINE_KINDS.some((k) => k !== 'drone' && FARM_MACHINES[k].works.includes(kind))) out.push('may');
  if (FARM_MACHINES.drone.works.includes(kind)) out.push('drone');
  return out;
}

/** Tiền giống cho cả cánh đồng. */
export function fieldSeedCost(sp: Specialty, tiles: number): number {
  return Math.round((seedCost(sp) * tiles) / 1000) * 1000;
}
/** Chờ giữa hai bước (chưa tính thời tiết) ở nhịp cánh đồng. */
export function fieldStepWaitMs(sp: Specialty, timeScale: number): number {
  return Math.max(1000, Math.round(stepWaitMs(sp, timeScale) / FIELD_PACE));
}
/** Sản lượng ước tính cả cánh đồng (kg), chưa tính chính vụ. */
export function fieldYieldKg(cropId: string, tiles: number, inSeasonMult = 1): number {
  return Math.round(CROPS[cropId].yieldKg * tiles * FIELD_YIELD_MULT * inSeasonMult);
}
export function fieldSteps(specialtyId: string) {
  const sp = SPECIALTIES[specialtyId];
  return processOf(CROPS[sp.crop]).map((s) => ({ name: s.name, kind: workKindOf(s.name) }));
}
/** Màu đại diện cho bản đồ ô vuông và cảnh 3D: đất trống, cây theo nhóm và giai đoạn. */
export const KIND_COLORS: Record<string, string> = {
  trai: '#4f9a3a', leo: '#5aa845', ngan: '#7cc04f', cu: '#6fa34a', cn: '#3f7f3a', lua: '#9cc94a', hoa: '#d86a9a',
};
export function fieldColor(cropId: string | null, progress: number): string {
  if (!cropId) return '#8a5a34';
  if (progress >= 0.999) return CROPS[cropId].kind === 'lua' ? '#e0b83a' : '#d8a23a';
  return KIND_COLORS[CROPS[cropId].kind] ?? '#5aa845';
}
