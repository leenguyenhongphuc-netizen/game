// Cá nhân hoá: nhà, cổng, hàng rào, sạp, đồ trang trí sân vườn và nhân vật. Dùng chung cho máy chủ và giao diện.

export const WALL_COLORS: string[] = ['#fff6e2', '#ffeceb', '#eef6ff', '#f1f9e4', '#fff8d6', '#f3ecff', '#ffe9d6', '#e6f7f4'];
export const ROOF_COLORS: string[] = ['#f08a6c', '#6fb7d9', '#f2b25c', '#a98bd6', '#e7799a', '#7cc48a', '#c9785a', '#5f7fb8'];
export const AWNING_COLORS: string[] = ['#f08a6c', '#6fb7d9', '#f2b25c', '#a98bd6', '#e7799a', '#7cc48a', '#f6d05a', '#5f7fb8'];
export const SHIRT_COLORS: string[] = ['#5aa9e6', '#f08a6c', '#7cc48a', '#a98bd6', '#f2b25c', '#e7799a', '#8a6a4a', '#4f6d8f'];
export const TRUCK_COLORS: string[] = ['#5aa9e6', '#f08a6c', '#7cc48a', '#f6d05a', '#f3f4f6', '#a98bd6'];

export const FENCE_STYLES: { id: 'trang' | 'go' | 'tre' | 'gach'; name: string }[] = [
  { id: 'trang', name: 'Hàng rào trắng' }, { id: 'go', name: 'Hàng rào gỗ mộc' }, { id: 'tre', name: 'Hàng rào tre' }, { id: 'gach', name: 'Tường gạch thấp' },
];
export const HOUSE_TYPES: { id: 'mai_ngoi' | 'nha_san' | 'nha_ba_gian'; name: string; price: number }[] = [
  { id: 'mai_ngoi', name: 'Nhà mái ngói', price: 0 }, { id: 'nha_san', name: 'Nhà sàn', price: 400_000 }, { id: 'nha_ba_gian', name: 'Nhà ba gian', price: 800_000 },
];
export const HATS: { id: 'non_la' | 'mu_tai_beo' | 'mu_luoi_trai' | 'khan_ran'; name: string }[] = [
  { id: 'non_la', name: 'Nón lá' }, { id: 'mu_tai_beo', name: 'Mũ tai bèo' }, { id: 'mu_luoi_trai', name: 'Mũ lưỡi trai' }, { id: 'khan_ran', name: 'Khăn rằn' },
];

export interface PlotStyle { house: string; wall: string; roof: string; fence: string; awning: string; gateName: string; stallName: string }
export interface DecorItem { id: string; name: string; emoji: string; price: number }
export const DECOR_ITEMS: DecorItem[] = [
  { id: 'chau_hoa', name: 'Chậu hoa', emoji: '🪴', price: 20_000 },
  { id: 'den_long', name: 'Đèn lồng', emoji: '🏮', price: 40_000 },
  { id: 'chum_nuoc', name: 'Chum nước', emoji: '🏺', price: 50_000 },
  { id: 'bu_nhin', name: 'Bù nhìn rơm', emoji: '🎃', price: 60_000 },
  { id: 'cot_co', name: 'Cột cờ', emoji: '🚩', price: 80_000 },
  { id: 'ban_ghe', name: 'Bộ bàn ghế', emoji: '🪑', price: 120_000 },
  { id: 'xich_du', name: 'Xích đu', emoji: '🎠', price: 150_000 },
  { id: 'cay_mai', name: 'Cây mai vàng', emoji: '🌼', price: 200_000 },
  { id: 'cay_dao', name: 'Cây đào', emoji: '🌸', price: 200_000 },
  { id: 'ao_ca', name: 'Ao cá', emoji: '🐟', price: 300_000 },
];
export interface DecorPlacement { item: string; x: number; z: number; rot: number }
export const DECOR_MAX = 24;
export interface Avatar { shirt: string; hat: string; truck: string }

export const DEFAULT_STYLE: PlotStyle = { house: 'mai_ngoi', wall: WALL_COLORS[0], roof: ROOF_COLORS[0], fence: 'trang', awning: AWNING_COLORS[0], gateName: '', stallName: '' };
export const DEFAULT_AVATAR: Avatar = { shirt: SHIRT_COLORS[0], hat: 'non_la', truck: TRUCK_COLORS[0] };

/** Chuẩn hoá tên do người chơi đặt: bỏ ký tự điều khiển và dấu < >, gộp khoảng trắng, tối đa 24 ký tự. */
export function cleanName(s: unknown): string {
  if (typeof s !== 'string') return '';
  let out = '';
  for (const ch of s.normalize('NFC')) {
    const c = ch.codePointAt(0)!;
    // Bỏ ký tự điều khiển, ký tự vô hình và dấu < >.
    const hidden = c < 0x20 || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202f) || c === 0xfeff;
    out += hidden || ch === '<' || ch === '>' ? ' ' : ch;
  }
  return [...out.replace(/ +/g, ' ').trim()].slice(0, 24).join('').trim();
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const oneOf = (list: readonly string[], v: unknown): v is string => typeof v === 'string' && list.includes(v);

export function validStyle(x: unknown): PlotStyle | null {
  if (!isObj(x)) return null;
  if (!oneOf(HOUSE_TYPES.map((h) => h.id), x.house) || !oneOf(WALL_COLORS, x.wall) || !oneOf(ROOF_COLORS, x.roof)
    || !oneOf(FENCE_STYLES.map((f) => f.id), x.fence) || !oneOf(AWNING_COLORS, x.awning)) return null;
  if ((x.gateName !== undefined && typeof x.gateName !== 'string') || (x.stallName !== undefined && typeof x.stallName !== 'string')) return null;
  return { house: x.house, wall: x.wall, roof: x.roof, fence: x.fence, awning: x.awning, gateName: cleanName(x.gateName), stallName: cleanName(x.stallName) };
}

/** Đồ trang trí phải nằm trong lô, ngoài ruộng và ngoài nền nhà. */
export function validDecor(x: unknown): DecorPlacement[] | null {
  if (!Array.isArray(x) || x.length > DECOR_MAX) return null;
  const ids = DECOR_ITEMS.map((d) => d.id), out: DecorPlacement[] = [];
  for (const it of x) {
    if (!isObj(it) || !oneOf(ids, it.item) || typeof it.x !== 'number' || typeof it.z !== 'number' || !Number.isFinite(it.x) || !Number.isFinite(it.z)) return null;
    const px = Math.round(it.x * 10) / 10, pz = Math.round(it.z * 10) / 10;
    if (Math.abs(px) > 9 || pz < -13 || pz > 8) return null;
    if (Math.abs(px) < 6.4 && Math.abs(pz) < 5.4) return null;
    if (Math.abs(px) < 3.4 && pz < -8) return null;
    const turns = typeof it.rot === 'number' && Number.isFinite(it.rot) ? it.rot / (Math.PI / 2) : NaN;
    if (!(Math.abs(turns - Math.round(turns)) < 1e-6) || Math.round(turns) < 0 || Math.round(turns) > 3) return null;
    out.push({ item: it.item, x: px, z: pz, rot: Math.round(turns) * (Math.PI / 2) });
  }
  return out;
}

export function validAvatar(x: unknown): Avatar | null {
  if (!isObj(x) || !oneOf(SHIRT_COLORS, x.shirt) || !oneOf(HATS.map((h) => h.id), x.hat) || !oneOf(TRUCK_COLORS, x.truck)) return null;
  return { shirt: x.shirt, hat: x.hat, truck: x.truck };
}
