// Tiến trình nhân vật: nguồn EXP của mọi hoạt động, mốc mở khoá theo cấp, nhiệm vụ ngày, thành tựu,
// nâng cấp đất, máy nhập khẩu và dung hợp (lai giống, phối hộp quà, ghép máy).
import { CROPS, SPECIALTIES } from './catalog.ts';
import { LEVELS, MACHINES, MACHINE_MAX_LEVEL, levelOf, levelPerks } from './rules.ts';
import type { MachineKind, Role } from './rules.ts';

// ---------------------------------------------------------------- nguồn EXP
/** Mọi việc trong game có điểm kinh nghiệm. Việc lặp rẻ có trần mỗi ngày (giờ Việt Nam) để không cày được. */
export type XpSource =
  | 'trong' | 'cham' | 'thu_hoach' | 'giup' | 'nang_dat'
  | 'ban_dn' | 'bay_sap' | 'ban_sap' | 'mua_sap' | 'mua_si' | 'qua_luu_niem'
  | 'chuyen_xe' | 'chuyen_xe_sach' | 'vung_moi' | 'mua_dat'
  | 'ky_gui' | 'ky_gui_ban' | 'mua_sieu_thi' | 'xuat_gui' | 'xuat_toi' | 'giao_don'
  | 'che_bien' | 'lay_me' | 'ban_thanh_pham' | 'mua_may' | 'nang_may' | 'nhap_may'
  | 'qua' | 'ket_ban' | 'htx_lap' | 'htx_vao' | 'htx_gop' | 'trang_tri' | 'quay_vai'
  | 'tem' | 'bo_tem' | 'diem_dung' | 'dia_danh' | 'vui_choi'
  | 'dung_hop' | 'dung_hop_hong' | 'ban_hop_qua' | 'nhiem_vu' | 'thanh_tuu' | 'khac';
export interface XpRule {
  label: string; xp: number;
  /** Tổng EXP tối đa mỗi ngày từ nguồn này; bỏ trống là không giới hạn. */
  dailyCap?: number;
  /** Cộng thêm 1 EXP cho mỗi `perValue` đồng giá trị giao dịch, tối đa `maxBonus` mỗi lần. */
  perValue?: number; maxBonus?: number;
}
export const XP_RULES: Record<XpSource, XpRule> = {
  trong: { label: 'Trồng một ô', xp: 2, dailyCap: 60 },
  cham: { label: 'Chăm cây một bước', xp: 1, dailyCap: 80 },
  thu_hoach: { label: 'Thu hoạch một ô', xp: 5 },
  giup: { label: 'Giúp vườn bạn', xp: 2 },
  nang_dat: { label: 'Nâng cấp đất', xp: 40 },
  ban_dn: { label: 'Bán cho doanh nghiệp', xp: 2, perValue: 200_000, maxBonus: 20, dailyCap: 150 },
  bay_sap: { label: 'Bày hàng lên sạp', xp: 1, dailyCap: 10 },
  ban_sap: { label: 'Sạp có người mua', xp: 2, perValue: 200_000, maxBonus: 15, dailyCap: 100 },
  mua_sap: { label: 'Mua hàng ở sạp bạn', xp: 1, perValue: 400_000, maxBonus: 8, dailyCap: 40 },
  mua_si: { label: 'Thu mua sỉ', xp: 2, perValue: 400_000, maxBonus: 10, dailyCap: 60 },
  qua_luu_niem: { label: 'Mua quà đặc sản', xp: 2, dailyCap: 12 },
  chuyen_xe: { label: 'Hoàn thành chuyến xe', xp: 10, perValue: 50, maxBonus: 30 },
  chuyen_xe_sach: { label: 'Chạy đúng tốc độ, không bị phạt', xp: 10 },
  vung_moi: { label: 'Lần đầu tới một vùng trồng', xp: 30 },
  mua_dat: { label: 'Mua thêm đất', xp: 100 },
  ky_gui: { label: 'Ký gửi siêu thị', xp: 3, dailyCap: 18 },
  ky_gui_ban: { label: 'Hàng ký gửi bán được', xp: 5, dailyCap: 100 },
  mua_sieu_thi: { label: 'Mua ở siêu thị', xp: 1, dailyCap: 10 },
  vui_choi: { label: 'Chơi một trò ở khu vui chơi', xp: 20, dailyCap: 240 },
  xuat_gui: { label: 'Gửi lô xuất khẩu', xp: 10, dailyCap: 100 },
  xuat_toi: { label: 'Lô xuất khẩu tới nơi', xp: 40 },
  giao_don: { label: 'Giao đơn hàng', xp: 15 },
  che_bien: { label: 'Chạy một mẻ chế biến', xp: 3, dailyCap: 45 },
  lay_me: { label: 'Lấy mẻ thành phẩm', xp: 8 },
  ban_thanh_pham: { label: 'Bán thành phẩm cho doanh nghiệp', xp: 2, perValue: 200_000, maxBonus: 20, dailyCap: 150 },
  mua_may: { label: 'Mua máy', xp: 30 },
  nang_may: { label: 'Nâng cấp máy', xp: 30 },
  nhap_may: { label: 'Lắp máy nhập khẩu', xp: 120 },
  qua: { label: 'Tặng quà bạn bè', xp: 3, dailyCap: 15 },
  ket_ban: { label: 'Kết bạn', xp: 10, dailyCap: 30 },
  htx_lap: { label: 'Lập hợp tác xã', xp: 80 },
  htx_vao: { label: 'Vào hợp tác xã', xp: 20, dailyCap: 20 },
  htx_gop: { label: 'Góp hàng cho đơn hợp tác xã', xp: 4, perValue: 200_000, maxBonus: 20, dailyCap: 120 },
  trang_tri: { label: 'Trang trí nhà cửa, sân vườn', xp: 3, dailyCap: 15 },
  quay_vai: { label: 'Nhận vai trò', xp: 20 },
  tem: { label: 'Tem đặc sản mới', xp: 3 },
  bo_tem: { label: 'Đủ bộ tem một vùng', xp: 40 },
  diem_dung: { label: 'Check-in một điểm dừng', xp: 10 },
  dia_danh: { label: 'Tham quan trọn một địa danh', xp: 50 },
  dung_hop: { label: 'Dung hợp thành công', xp: 25 },
  dung_hop_hong: { label: 'Dung hợp chưa thành', xp: 5, dailyCap: 25 },
  ban_hop_qua: { label: 'Bán hộp quà', xp: 3, perValue: 200_000, maxBonus: 25, dailyCap: 150 },
  nhiem_vu: { label: 'Thưởng nhiệm vụ ngày', xp: 0 },
  thanh_tuu: { label: 'Thưởng thành tựu', xp: 0 },
  khac: { label: 'Khác', xp: 0 },
};
/** EXP của một việc, có cộng phần theo giá trị giao dịch (nếu nguồn đó có). */
export function xpFor(source: XpSource, value = 0): number {
  const r = XP_RULES[source];
  return r.xp + (r.perValue ? Math.min(r.maxBonus ?? 0, Math.floor(Math.max(0, value) / r.perValue)) : 0);
}

// ---------------------------------------------------------------- nâng cấp đất
export type LandUpgradeKind = 'cai_tao' | 'tuoi' | 'nha_mang' | 'cam_bien';
export type PlotUpgrades = Partial<Record<LandUpgradeKind, number>>;
export interface LandUpgradeInfo { name: string; emoji: string; note: string; effect: string; basePrice: number }
export const LAND_UPGRADES: Record<LandUpgradeKind, LandUpgradeInfo> = {
  cai_tao: { name: 'Cải tạo đất', emoji: '🪱', basePrice: 300_000, note: 'Bón phân hữu cơ, rải vôi khử chua, trồng cây che phủ.', effect: 'Mỗi cấp tăng 5% sản lượng mỗi ô.' },
  tuoi: { name: 'Tưới nhỏ giọt', emoji: '💧', basePrice: 500_000, note: 'Ống tưới tận gốc hẹn giờ, đỡ công và đỡ nước.', effect: 'Mỗi cấp rút 5% thời gian chờ mỗi bước chăm.' },
  nha_mang: { name: 'Nhà màng, nhà lưới', emoji: '🏕️', basePrice: 1_200_000, note: 'Che mưa dông, nắng gắt và côn trùng.', effect: 'Mỗi cấp bớt 15% mức chậm lớn do thời tiết xấu.' },
  cam_bien: { name: 'Cảm biến vườn', emoji: '📡', basePrice: 800_000, note: 'Đo ẩm đất, nhắc việc đúng lúc.', effect: 'Mỗi cấp nới 20% thời gian trước khi bị tính chăm trễ, nên dễ đạt Loại 1 hơn.' },
};
export const LAND_UPGRADE_MAX = 5;
/** Cấp nhân vật cần có để nâng lên từng cấp của một hạng mục đất. */
export const LAND_UPGRADE_LEVELS = [1, 3, 6, 10, 15];
const LAND_COST_MULT = [1, 2, 4, 7, 11];
export function landUpgradeCost(kind: LandUpgradeKind, nextLevel: number): number { return LAND_UPGRADES[kind].basePrice * LAND_COST_MULT[Math.max(1, Math.min(LAND_UPGRADE_MAX, nextLevel)) - 1]; }
export function cleanUpgrades(raw: unknown): PlotUpgrades {
  const out: PlotUpgrades = {};
  if (raw && typeof raw === 'object') for (const k of Object.keys(LAND_UPGRADES) as LandUpgradeKind[]) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'number' && v >= 1) out[k] = Math.min(LAND_UPGRADE_MAX, Math.floor(v));
  }
  return out;
}

// ---------------------------------------------------------------- giống lai (kết quả của lai tạo giống)
export type SeedTrait = 'chin_som' | 'nang_suat' | 'thuong_hang';
export interface SeedTraitInfo { name: string; emoji: string; effect: string; waitMult: number; yieldMult: number; forceA: boolean }
export const SEED_TRAITS: Record<SeedTrait, SeedTraitInfo> = {
  chin_som: { name: 'Giống chín sớm', emoji: '⏱️', effect: 'Mỗi bước chăm nhanh hơn 25%.', waitMult: 0.75, yieldMult: 1, forceA: false },
  nang_suat: { name: 'Giống năng suất cao', emoji: '🌾', effect: 'Sản lượng mỗi ô tăng 30%.', waitMult: 1, yieldMult: 1.3, forceA: false },
  thuong_hang: { name: 'Giống thượng hạng', emoji: '🏅', effect: 'Thu hoạch luôn đạt Loại 1 và tăng 10% sản lượng.', waitMult: 1, yieldMult: 1.1, forceA: true },
};
export const isSeedTrait = (v: unknown): v is SeedTrait => typeof v === 'string' && Object.hasOwn(SEED_TRAITS, v);

/** Tác dụng gộp của nâng cấp đất và giống lai lên một ô đang trồng. */
export interface GrowFx { waitMult: number; yieldMult: number; graceMult: number; forceA: boolean; /** Đổi hệ số thời tiết (lớn hơn 1 là chậm lớn) sau khi có nhà màng. */ weather: (growth: number) => number }
export function growFx(upRaw?: unknown, trait?: unknown): GrowFx {
  const up = cleanUpgrades(upRaw), t = isSeedTrait(trait) ? SEED_TRAITS[trait] : null;
  const shield = Math.min(0.75, 0.15 * (up.nha_mang ?? 0));
  return {
    waitMult: (1 - 0.05 * (up.tuoi ?? 0)) * (t?.waitMult ?? 1),
    yieldMult: (1 + 0.05 * (up.cai_tao ?? 0)) * (t?.yieldMult ?? 1),
    graceMult: 1 + 0.2 * (up.cam_bien ?? 0),
    forceA: !!t?.forceA,
    weather: (g) => (g > 1 ? 1 + (g - 1) * (1 - shield) : g),
  };
}
export const NO_FX: GrowFx = growFx();

// ---------------------------------------------------------------- máy nhập khẩu
export type ImportStage = 'tau_bien' | 'thong_quan' | 'xe_ve_xuong';
export interface ImportMachine {
  id: string; kind: MachineKind; origin: string; flag: string; name: string; price: number;
  /** Hệ số thời gian mỗi mẻ so với máy nội cùng cấp (nhỏ hơn 1 là nhanh hơn). */
  speed: number;
  /** Thành phẩm ra thêm so với máy nội. */
  yieldBonus: number;
  minLevel: number; port: string; seaMinutes: number; note: string;
}
/** Xuất xứ nêu chung theo nước, không gắn với hãng thật nào. */
export const IMPORT_MACHINES: ImportMachine[] = [
  { id: 'say_lanh_nhat', kind: 'may_say', origin: 'Nhật Bản', flag: '🇯🇵', name: 'Máy sấy lạnh', price: 24_000_000, speed: 0.6, yieldBonus: 0.08, minLevel: 5, port: 'Cảng Cát Lái', seaMinutes: 20, note: 'Sấy ở nhiệt độ thấp nên giữ màu và mùi, ít hao.' },
  { id: 'ep_lanh_han', kind: 'may_ep', origin: 'Hàn Quốc', flag: '🇰🇷', name: 'Máy ép lạnh – cô đặc chân không', price: 20_000_000, speed: 0.65, yieldBonus: 0.07, minLevel: 6, port: 'Cảng Hải Phòng', seaMinutes: 16, note: 'Ép chậm, cô đặc chân không nên giữ vị trái tươi.' },
  { id: 'mut_y', kind: 'day_chuyen_mut', origin: 'Ý', flag: '🇮🇹', name: 'Dây chuyền mứt – chiết rót tự động', price: 30_000_000, speed: 0.6, yieldBonus: 0.06, minLevel: 9, port: 'Cảng Cái Mép', seaMinutes: 34, note: 'Nấu chân không và chiết rót, đóng hũ liền mạch.' },
  { id: 'rang_duc', kind: 'may_rang_xay', origin: 'Đức', flag: '🇩🇪', name: 'Máy rang xay khí nóng', price: 34_000_000, speed: 0.55, yieldBonus: 0.06, minLevel: 12, port: 'Cảng Cái Mép', seaMinutes: 36, note: 'Rang bằng khí nóng điều khiển theo từng mẻ, hạt chín đều.' },
].filter((m) => Object.hasOwn(MACHINES, m.kind)) as ImportMachine[];
export const importMachine = (id: unknown): ImportMachine | undefined => IMPORT_MACHINES.find((m) => m.id === id);
/** Thuế và phí khi nhập máy (đơn giản hoá): thuế nhập khẩu máy chế biến mức thấp, thuế giá trị gia tăng, phí thông quan và cước biển. */
export const IMPORT_DUTY_RATIO = 0.02, IMPORT_VAT_RATIO = 0.1, IMPORT_CUSTOMS_FEE = 500_000, IMPORT_FREIGHT_PER_MINUTE = 60_000;
export const IMPORT_CUSTOMS_MINUTES = 6, IMPORT_TRUCK_MINUTES = 4, IMPORT_MAX_PENDING = 2;
export function importCost(m: ImportMachine): { price: number; freight: number; duty: number; vat: number; fees: number; total: number } {
  const freight = m.seaMinutes * IMPORT_FREIGHT_PER_MINUTE;
  const duty = Math.round(((m.price + freight) * IMPORT_DUTY_RATIO) / 1000) * 1000;
  const vat = Math.round(((m.price + freight + duty) * IMPORT_VAT_RATIO) / 1000) * 1000;
  return { price: m.price, freight, duty, vat, fees: IMPORT_CUSTOMS_FEE, total: m.price + freight + duty + vat + IMPORT_CUSTOMS_FEE };
}
export const IMPORT_STAGE_NAMES: Record<ImportStage, string> = { tau_bien: 'Tàu container chở máy về cảng', thong_quan: 'Làm thủ tục thông quan', xe_ve_xuong: 'Xe đầu kéo chở máy về xưởng' };

// ---------------------------------------------------------------- dung hợp
export type FusionKind = 'giong' | 'san_pham' | 'may';
/** Hộp quà phối từ nhiều thành phẩm; nằm trong kho hộp quà riêng. */
export interface GiftBox { id: string; name: string; emoji: string; note: string; /** Số loại thành phẩm khác nhau cần có. */ kinds: number; kgEach: number; boxes: number; valueMult: number; minLevel: number; packCost: number; successRate: number }
export const GIFT_BOXES: GiftBox[] = [
  { id: 'hop_doi', name: 'Hộp quà đôi vị', emoji: '🎁', note: 'Hai món thành phẩm đóng chung một hộp giấy kraft.', kinds: 2, kgEach: 5, boxes: 10, valueMult: 1.25, minLevel: 6, packCost: 150_000, successRate: 0.8 },
  { id: 'hop_ba_mien', name: 'Hộp đặc sản ba miền', emoji: '🧺', note: 'Ba món của ba vùng khác nhau, quà biếu dịp lễ Tết.', kinds: 3, kgEach: 5, boxes: 15, valueMult: 1.45, minLevel: 9, packCost: 300_000, successRate: 0.7 },
  { id: 'gio_thuong_hang', name: 'Giỏ quà thượng hạng', emoji: '👑', note: 'Bốn món tuyển, đóng giỏ mây, đạt chuẩn bày ở sân bay và xuất khẩu.', kinds: 4, kgEach: 6, boxes: 24, valueMult: 1.7, minLevel: 13, packCost: 600_000, successRate: 0.6 },
];
export const giftBox = (id: unknown): GiftBox | undefined => GIFT_BOXES.find((b) => b.id === id);
/** Bán hộp quà: doanh nghiệp quà tặng trả đủ giá; xuất khẩu được thêm nhưng cần gom đủ số hộp và đủ cấp. */
export const BOX_EXPORT_BONUS = 0.2, BOX_EXPORT_MIN = 20, BOX_EXPORT_LEVEL = 10;

export interface SeedFusion { id: string; trait: SeedTrait; kgEach: number; cost: number; packets: number; minLevel: number; successRate: number }
/** Lai tạo giống: hai đặc sản cùng loại cây (hoặc cùng nhóm cây) làm bố mẹ; giống mới mang tên đặc sản thứ nhất. */
export const SEED_FUSIONS: SeedFusion[] = [
  { id: 'lai_chin_som', trait: 'chin_som', kgEach: 20, cost: 200_000, packets: 4, minLevel: 4, successRate: 0.6 },
  { id: 'lai_nang_suat', trait: 'nang_suat', kgEach: 30, cost: 400_000, packets: 4, minLevel: 7, successRate: 0.5 },
  { id: 'lai_thuong_hang', trait: 'thuong_hang', kgEach: 40, cost: 800_000, packets: 4, minLevel: 11, successRate: 0.4 },
];
/** Ghép hai máy cùng loại, cùng cấp thành một máy cấp cao hơn (rẻ hơn nâng cấp nhưng mất một máy). */
export const MACHINE_MERGE = { id: 'ghep_may', minLevel: 8, successRate: 0.7, partsRatio: 0.25 } as const;
/** Mỗi cấp nhân vật thêm 1,5 điểm phần trăm thành công; vật tư tăng cường thêm 15 điểm; trần 95%. */
export const FUSION_LEVEL_BONUS = 0.015, FUSION_BOOST = 0.15, FUSION_MAX_RATE = 0.95, FUSION_KEEP_ON_FAIL = 0.5;
export function fusionRate(base: number, level: number, boost: boolean): number {
  return Math.round(Math.min(FUSION_MAX_RATE, base + FUSION_LEVEL_BONUS * Math.max(0, level - 1) + (boost ? FUSION_BOOST : 0)) * 1000) / 1000;
}
/** Giá vật tư tăng cường = một nửa chi phí công thức (tối thiểu 100.000đ). */
export const boostCost = (cost: number) => Math.max(100_000, Math.round(cost / 2 / 1000) * 1000);
/** Hai đặc sản lai được với nhau khi cùng loại cây, hoặc cùng nhóm cây (cùng `kind`). */
export function canCross(a: string, b: string): boolean {
  const x = SPECIALTIES[a], y = SPECIALTIES[b];
  if (!x || !y || a === b) return false;
  return x.crop === y.crop || CROPS[x.crop].kind === CROPS[y.crop].kind;
}

// ---------------------------------------------------------------- mốc mở khoá theo cấp
export const LEVEL_CASH_REWARD = 20_000;
/** Tiền thưởng khi lên tới một cấp. */
export const levelReward = (level: number) => LEVEL_CASH_REWARD * Math.max(0, level);
export interface LevelUnlock { level: number; title: string; xp: number; reward: number; unlocks: string[] }
function unlocksAt(level: number): string[] {
  const out: string[] = [];
  const p = levelPerks(level), prev = levelPerks(level - 1);
  if (level > 1 && p.energyMax > prev.energyMax) out.push(`Thể lực tối đa ${p.energyMax}`);
  if (level > 1 && p.superDailyKg > prev.superDailyKg) out.push(`Mua ở siêu thị ${p.superDailyKg} kg mỗi ngày`);
  LAND_UPGRADE_LEVELS.forEach((l, i) => { if (l === level && i > 0) out.push(`Nâng cấp đất lên cấp ${i + 1}`); });
  for (const f of SEED_FUSIONS) if (f.minLevel === level) out.push(`Lai tạo ${SEED_TRAITS[f.trait].name.toLowerCase()}`);
  for (const b of GIFT_BOXES) if (b.minLevel === level) out.push(`Phối ${b.name.toLowerCase()}`);
  for (const m of IMPORT_MACHINES) if (m.minLevel === level) out.push(`Nhập ${m.name.toLowerCase()} (${m.origin})`);
  if (MACHINE_MERGE.minLevel === level) out.push('Ghép hai máy cùng loại thành máy cấp cao hơn');
  if (BOX_EXPORT_LEVEL === level) out.push('Xuất khẩu hộp quà');
  if (level === 2) out.push('Nhiệm vụ ngày thưởng thêm theo cấp');
  return out;
}
/** Bảng 30 cấp: ngưỡng EXP, danh hiệu, tiền thưởng và những thứ mở ra ở cấp đó. */
export const LEVEL_UNLOCKS: LevelUnlock[] = LEVELS.map((l) => ({ level: l.level, title: l.title, xp: l.xp, reward: l.level > 1 ? levelReward(l.level) : 0, unlocks: unlocksAt(l.level) }));

// ---------------------------------------------------------------- nhiệm vụ ngày
export interface DailyQuest { id: string; text: string; sources: XpSource[]; goal: number; xp: number; cash: number; roles?: Role[] }
export const DAILY_QUESTS: DailyQuest[] = [
  { id: 'cham_8', text: 'Chăm cây 8 lần', sources: ['cham'], goal: 8, xp: 30, cash: 20_000, roles: ['nong_dan', 'thuong_lai'] },
  { id: 'thu_hoach_4', text: 'Thu hoạch 4 ô', sources: ['thu_hoach'], goal: 4, xp: 40, cash: 30_000, roles: ['nong_dan', 'thuong_lai'] },
  { id: 'trong_4', text: 'Trồng 4 ô', sources: ['trong'], goal: 4, xp: 25, cash: 20_000, roles: ['nong_dan'] },
  { id: 'ban_hang_2', text: 'Bán hàng 2 lần (doanh nghiệp, sạp hoặc siêu thị)', sources: ['ban_dn', 'bay_sap', 'ky_gui'], goal: 2, xp: 30, cash: 25_000, roles: ['nong_dan'] },
  { id: 'che_bien_3', text: 'Chạy 3 mẻ chế biến', sources: ['che_bien'], goal: 3, xp: 40, cash: 30_000, roles: ['xuong'] },
  { id: 'lay_me_2', text: 'Lấy 2 mẻ thành phẩm', sources: ['lay_me'], goal: 2, xp: 30, cash: 25_000, roles: ['xuong'] },
  { id: 'mua_nl_2', text: 'Mua nguyên liệu 2 lần (sạp, siêu thị)', sources: ['mua_sap', 'mua_sieu_thi'], goal: 2, xp: 30, cash: 25_000, roles: ['xuong'] },
  { id: 'ban_tp_1', text: 'Đưa thành phẩm ra thị trường 1 lần', sources: ['ban_thanh_pham', 'ky_gui', 'xuat_gui', 'ban_hop_qua'], goal: 1, xp: 35, cash: 30_000, roles: ['xuong'] },
  { id: 'chuyen_xe_1', text: 'Hoàn thành 1 chuyến xe tải', sources: ['chuyen_xe'], goal: 1, xp: 45, cash: 40_000, roles: ['thuong_lai'] },
  { id: 'mua_si_2', text: 'Thu mua sỉ 2 lần', sources: ['mua_si'], goal: 2, xp: 35, cash: 30_000, roles: ['thuong_lai'] },
  { id: 'ban_dn_3', text: 'Bán cho doanh nghiệp 3 lần', sources: ['ban_dn'], goal: 3, xp: 35, cash: 30_000, roles: ['thuong_lai'] },
  { id: 'diem_dung_3', text: 'Check-in 3 điểm dừng ở một địa danh', sources: ['diem_dung'], goal: 3, xp: 40, cash: 30_000 },
  { id: 'giao_don_1', text: 'Giao 1 đơn hàng', sources: ['giao_don'], goal: 1, xp: 30, cash: 25_000 },
  { id: 'xuat_gui_1', text: 'Gửi 1 lô xuất khẩu', sources: ['xuat_gui'], goal: 1, xp: 40, cash: 35_000 },
  { id: 'qua_1', text: 'Tặng quà hoặc giúp vườn một người bạn', sources: ['qua', 'giup'], goal: 1, xp: 25, cash: 20_000 },
  { id: 'trang_tri_1', text: 'Trang trí nhà hoặc sân vườn 1 lần', sources: ['trang_tri'], goal: 1, xp: 20, cash: 15_000 },
];
export const DAILY_QUEST_COUNT = 3;
/** Thưởng nhiệm vụ ngày tăng 5% mỗi cấp. */
export const dailyRewardMult = (level: number) => 1 + 0.05 * Math.max(0, level - 1);
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** Ba nhiệm vụ của một người trong một ngày: hai việc theo vai, một việc chung; cố định theo (người, ngày). */
export function dailyQuestsFor(userId: number, day: number, role: Role | null): DailyQuest[] {
  const mine = DAILY_QUESTS.filter((q) => q.roles && role && q.roles.includes(role)), common = DAILY_QUESTS.filter((q) => !q.roles);
  const pick = (pool: DailyQuest[], n: number, salt: string) => [...pool].sort((a, b) => hash(`${userId}:${day}:${salt}:${a.id}`) - hash(`${userId}:${day}:${salt}:${b.id}`)).slice(0, n);
  const a = pick(mine, DAILY_QUEST_COUNT - 1, 'vai');
  return [...a, ...pick(common, DAILY_QUEST_COUNT - a.length, 'chung')];
}

// ---------------------------------------------------------------- thành tựu
export interface Achievement { id: string; text: string; /** Đếm số lần từ các nguồn EXP này; hoặc `metric` lấy số có sẵn. */ sources?: XpSource[]; metric?: 'level' | 'sights' | 'regions'; goal: number; xp: number; cash: number }
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'thu_hoach_10', text: 'Thu hoạch 10 ô', sources: ['thu_hoach'], goal: 10, xp: 50, cash: 50_000 },
  { id: 'thu_hoach_100', text: 'Thu hoạch 100 ô', sources: ['thu_hoach'], goal: 100, xp: 200, cash: 300_000 },
  { id: 'thu_hoach_1000', text: 'Thu hoạch 1.000 ô', sources: ['thu_hoach'], goal: 1000, xp: 1000, cash: 2_000_000 },
  { id: 'cham_200', text: 'Chăm cây 200 lần', sources: ['cham'], goal: 200, xp: 150, cash: 150_000 },
  { id: 'giup_20', text: 'Giúp vườn bạn 20 lần', sources: ['giup'], goal: 20, xp: 100, cash: 100_000 },
  { id: 'qua_10', text: 'Tặng quà 10 lần', sources: ['qua'], goal: 10, xp: 80, cash: 80_000 },
  { id: 'che_bien_20', text: 'Lấy 20 mẻ thành phẩm', sources: ['lay_me'], goal: 20, xp: 150, cash: 200_000 },
  { id: 'che_bien_200', text: 'Lấy 200 mẻ thành phẩm', sources: ['lay_me'], goal: 200, xp: 600, cash: 1_500_000 },
  { id: 'chuyen_xe_10', text: 'Hoàn thành 10 chuyến xe tải', sources: ['chuyen_xe'], goal: 10, xp: 150, cash: 200_000 },
  { id: 'lai_xe_sach_10', text: '10 chuyến xe không bị phạt', sources: ['chuyen_xe_sach'], goal: 10, xp: 200, cash: 300_000 },
  { id: 'xuat_khau_10', text: '10 lô xuất khẩu tới nơi', sources: ['xuat_toi'], goal: 10, xp: 300, cash: 500_000 },
  { id: 'xuat_khau_50', text: '50 lô xuất khẩu tới nơi', sources: ['xuat_toi'], goal: 50, xp: 800, cash: 2_000_000 },
  { id: 'ky_gui_20', text: 'Hàng ký gửi bán được 20 lần', sources: ['ky_gui_ban'], goal: 20, xp: 200, cash: 300_000 },
  { id: 'giao_don_30', text: 'Giao 30 đơn hàng', sources: ['giao_don'], goal: 30, xp: 250, cash: 400_000 },
  { id: 'dung_hop_5', text: 'Dung hợp thành công 5 lần', sources: ['dung_hop'], goal: 5, xp: 200, cash: 300_000 },
  { id: 'nang_dat_5', text: 'Nâng cấp đất 5 lần', sources: ['nang_dat'], goal: 5, xp: 150, cash: 200_000 },
  { id: 'nhap_may_1', text: 'Lắp chiếc máy nhập khẩu đầu tiên', sources: ['nhap_may'], goal: 1, xp: 200, cash: 500_000 },
  { id: 'dia_danh_5', text: 'Tham quan trọn 5 địa danh', metric: 'sights', goal: 5, xp: 200, cash: 200_000 },
  { id: 'dia_danh_13', text: 'Tham quan trọn 13 địa danh', metric: 'sights', goal: 13, xp: 600, cash: 800_000 },
  { id: 'vung_10', text: 'Đặt chân tới 10 vùng trồng', metric: 'regions', goal: 10, xp: 200, cash: 200_000 },
  { id: 'vung_30', text: 'Đặt chân tới 30 vùng trồng', metric: 'regions', goal: 30, xp: 600, cash: 800_000 },
  { id: 'cap_5', text: 'Đạt cấp 5', metric: 'level', goal: 5, xp: 0, cash: 200_000 },
  { id: 'cap_10', text: 'Đạt cấp 10', metric: 'level', goal: 10, xp: 0, cash: 500_000 },
  { id: 'cap_20', text: 'Đạt cấp 20', metric: 'level', goal: 20, xp: 0, cash: 2_000_000 },
];

export { MACHINE_MAX_LEVEL, levelOf };
