// Đồ ăn thức uống để hồi thể lực, và các kiểu quầy hàng mọc ngẫu nhiên ở điểm tham quan.
export interface FoodItem {
  id: string; name: string; emoji: string; price: number;
  /** Số điểm thể lực hồi lại khi dùng. */
  energy: number; kind: 'an' | 'uong';
  /** Món đặc trưng: chỉ bán ở các quầy thuộc tỉnh này. */
  regional?: string;
}
export const ITEMS: Record<string, FoodItem> = Object.fromEntries(([
  ['nuoc_suoi', 'Nước suối', '💧', 6_000, 6, 'uong'],
  ['tra_da', 'Trà đá', '🧊', 4_000, 4, 'uong'],
  ['nuoc_mia', 'Nước mía', '🥤', 10_000, 12, 'uong'],
  ['nuoc_dua', 'Dừa tươi', '🥥', 18_000, 18, 'uong'],
  ['ca_phe_sua_da', 'Cà phê sữa đá', '☕', 20_000, 20, 'uong'],
  ['sinh_to', 'Sinh tố trái cây', '🍹', 25_000, 22, 'uong'],
  ['banh_mi', 'Bánh mì thịt', '🥖', 20_000, 25, 'an'],
  ['xoi', 'Gói xôi', '🍙', 12_000, 16, 'an'],
  ['com_hop', 'Cơm hộp', '🍱', 35_000, 40, 'an'],
  ['pho', 'Tô phở', '🍜', 45_000, 50, 'an'],
  ['che', 'Ly chè', '🍧', 15_000, 15, 'an'],
  ['trai_cay_dia', 'Đĩa trái cây', '🍉', 22_000, 20, 'an'],
  ['mi_quang', 'Mì Quảng', '🍜', 40_000, 55, 'an', 'Đà Nẵng'],
  ['cao_lau', 'Cao lầu', '🍝', 45_000, 58, 'an', 'Đà Nẵng'],
  ['banh_it_la_gai', 'Bánh ít lá gai', '🍡', 10_000, 14, 'an', 'Đà Nẵng'],
  ['banh_trang_cuon_thit_heo', 'Bánh tráng cuốn thịt heo', '🥬', 60_000, 65, 'an', 'Đà Nẵng'],
  ['che_xoa_xoa', 'Chè xoa xoa hạt lựu', '🍨', 15_000, 18, 'uong', 'Đà Nẵng'],
  ['goi_toi_ly_son', 'Gỏi tỏi Lý Sơn', '🧄', 50_000, 52, 'an', 'Quảng Ngãi'],
  ['don_quang_ngai', 'Don Quảng Ngãi', '🥣', 30_000, 38, 'an', 'Quảng Ngãi'],
  ['ram_bap', 'Ram bắp', '🌽', 20_000, 24, 'an', 'Quảng Ngãi'],
  ['nuoc_rong_bien', 'Nước rong biển', '🌿', 12_000, 14, 'uong', 'Quảng Ngãi'],
] as [string, string, string, number, number, 'an' | 'uong', string?][]).map(([id, name, emoji, price, energy, kind, regional]) => [id, { id, name, emoji, price, energy, kind, ...(regional ? { regional } : {}) }]));

export type ShopKind = 'xe_nuoc_mia' | 'hang_rong' | 'quan_ca_phe' | 'tap_hoa' | 'quay_dac_san' | 'quan_an';
/** Mỗi kiểu quầy bán một nhóm món; quầy đặc sản và quán ăn bán thêm món riêng của tỉnh. */
export const SHOP_KINDS: Record<ShopKind, { name: string; emoji: string; items: string[]; regional: boolean }> = {
  xe_nuoc_mia: { name: 'Xe nước mía', emoji: '🛒', items: ['nuoc_mia', 'nuoc_dua', 'tra_da'], regional: false },
  hang_rong: { name: 'Gánh hàng rong', emoji: '🧺', items: ['xoi', 'che', 'trai_cay_dia', 'tra_da'], regional: true },
  quan_ca_phe: { name: 'Quán cà phê', emoji: '☕', items: ['ca_phe_sua_da', 'sinh_to', 'nuoc_suoi'], regional: false },
  tap_hoa: { name: 'Tiệm tạp hoá', emoji: '🏪', items: ['nuoc_suoi', 'banh_mi', 'xoi', 'tra_da', 'com_hop'], regional: false },
  quay_dac_san: { name: 'Quầy đặc sản', emoji: '🎁', items: ['trai_cay_dia', 'che'], regional: true },
  quan_an: { name: 'Quán ăn', emoji: '🍜', items: ['com_hop', 'pho', 'tra_da'], regional: true },
};
/** Tiệm tạp hoá ở vùng nhà: luôn mở, bán các món cơ bản. */
export const HOME_SHOP_ITEMS = ['nuoc_suoi', 'tra_da', 'banh_mi', 'xoi', 'com_hop', 'ca_phe_sua_da'];
/** Tối đa bấy nhiêu món mỗi loại trong túi. */
export const ITEM_BAG_MAX = 20;
export function regionalItems(province: string): string[] { return Object.values(ITEMS).filter((i) => i.regional === province).map((i) => i.id); }
