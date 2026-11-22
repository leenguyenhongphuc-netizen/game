// Mua sắm: quần áo, nón, phụ kiện, kiểu nhà, nội thất, đồ sân vườn và xe cá nhân. Dùng chung cho máy chủ và giao diện.
// Đồ đặc trưng vùng miền (region) chỉ bán ở tỉnh đó: phải tới nơi mới mua được.
import type { LicenseClass } from './vehicles.ts';
import { PERSONAL_RIDES } from './vehicles.ts';

export type GoodCategory = 'ao' | 'non' | 'phu_kien' | 'nha' | 'noi_that' | 'san_vuon' | 'xe';
export const GOOD_CATEGORIES: Record<GoodCategory, { name: string; emoji: string; slot: string | null; note: string }> = {
  ao: { name: 'Quần áo', emoji: '👕', slot: 'ao', note: 'Mỗi lúc mặc một bộ.' },
  non: { name: 'Nón, mũ', emoji: '👒', slot: 'non', note: 'Mỗi lúc đội một chiếc.' },
  phu_kien: { name: 'Phụ kiện', emoji: '🎒', slot: 'phu_kien', note: 'Mỗi lúc mang một món.' },
  nha: { name: 'Kiểu nhà', emoji: '🏠', slot: 'nha', note: 'Chọn một kiểu để dựng trên thửa nhà.' },
  noi_that: { name: 'Nội thất', emoji: '🛋️', slot: null, note: 'Bày trong nhà; mua rồi là của bạn.' },
  san_vuon: { name: 'Đồ sân vườn', emoji: '🪴', slot: null, note: 'Bày ngoài sân.' },
  xe: { name: 'Xe cá nhân', emoji: '🛵', slot: 'xe', note: 'Đi tham quan trong tỉnh bằng xe riêng thay taxi: chỉ tốn tiền xăng hoặc điện.' },
};
export interface Good {
  id: string; name: string; emoji: string; category: GoodCategory; price: number;
  minLevel?: number;
  /** Chỉ bán ở tỉnh này. */
  region?: string;
  /** Cần bằng lái (xe cá nhân). */
  license?: LicenseClass | null;
  /** Mô tả ngắn để giao diện vẽ: màu chủ đạo và gợi ý hình. */
  preview: { color: string; hint: string };
}
const G = (id: string, name: string, emoji: string, category: GoodCategory, price: number, color: string, hint: string, extra: Partial<Good> = {}): Good =>
  ({ id, name, emoji, category, price, preview: { color, hint }, ...extra });
export const GOODS: Good[] = [
  // quần áo
  G('ao_ba_ba', 'Áo bà ba', '👚', 'ao', 150_000, '#6b4f3a', 'áo cổ tròn xẻ tà ngắn, màu nâu hoặc tím than, quần lụa đen', { region: 'Đồng Tháp' }),
  G('ao_dai_trang', 'Áo dài trắng', '👗', 'ao', 400_000, '#ffffff', 'áo dài hai tà, quần trắng', { region: 'Huế' }),
  G('ao_dai_tim_hue', 'Áo dài tím Huế', '👗', 'ao', 450_000, '#8e6bbf', 'áo dài tím, quần trắng, hợp đội nón bài thơ', { region: 'Huế', minLevel: 2 }),
  G('ao_tu_than', 'Áo tứ thân', '👘', 'ao', 350_000, '#b5462f', 'áo bốn vạt nâu non, yếm đào, thắt lưng xanh', { region: 'Bắc Ninh' }),
  G('ao_tho_cam_tay_nguyen', 'Áo thổ cẩm Tây Nguyên', '🧥', 'ao', 380_000, '#2b2b3a', 'nền chàm, sọc đỏ vàng trắng dệt ngang', { region: 'Đắk Lắk' }),
  G('ao_tho_cam_tay_bac', 'Váy áo thổ cẩm Tây Bắc', '🧥', 'ao', 420_000, '#1f3b6e', 'nền chàm thêu hoa văn đỏ hồng xanh, váy xoè', { region: 'Lào Cai', minLevel: 2 }),
  G('ao_toi', 'Áo tơi lá', '🧥', 'ao', 120_000, '#a88b4a', 'áo khoác kết bằng lá cọ che mưa nắng', { region: 'Hà Tĩnh' }),
  G('do_bao_ho', 'Đồ bảo hộ nhà vườn', '🦺', 'ao', 90_000, '#3f7d5a', 'áo dài tay xanh lá, găng tay, ủng'),
  G('ao_so_mi', 'Áo sơ mi quần tây', '👔', 'ao', 180_000, '#e9eef5', 'sơ mi sáng màu, quần tây sẫm'),
  G('ao_thun', 'Áo thun quần jean', '👕', 'ao', 120_000, '#5aa9e6', 'áo thun trơn, quần jean xanh'),
  G('vest', 'Bộ vest doanh nhân', '🤵', 'ao', 1_200_000, '#2d3142', 'vest sẫm, cà vạt', { minLevel: 5 }),
  G('ao_mua', 'Áo mưa cánh dơi', '🧥', 'ao', 40_000, '#f2c14e', 'áo mưa trùm rộng, màu vàng hoặc xanh'),
  // nón, mũ
  G('non_bai_tho', 'Nón bài thơ', '👒', 'non', 90_000, '#f3e9c9', 'nón lá mỏng, soi lên thấy hình và câu thơ', { region: 'Huế' }),
  G('non_quai_thao', 'Nón quai thao', '👒', 'non', 160_000, '#e8d9a8', 'nón phẳng rộng vành, quai tua đỏ', { region: 'Bắc Ninh' }),
  G('non_ngua', 'Nón ngựa Phú Gia', '👒', 'non', 140_000, '#d8c58e', 'nón lá dày chóp nhọn có chụp bạc', { region: 'Gia Lai' }),
  G('mu_bao_hiem', 'Mũ bảo hiểm', '⛑️', 'non', 150_000, '#e2573c', 'mũ nửa đầu có kính'),
  G('mu_coi', 'Mũ cối', '🪖', 'non', 70_000, '#6f7f4f', 'mũ cứng tròn màu xanh lá'),
  G('mu_len', 'Mũ len', '🧶', 'non', 60_000, '#c0533e', 'mũ len trùm tai, hợp vùng cao lạnh', { region: 'Lâm Đồng' }),
  // phụ kiện
  G('khan_ran_do', 'Khăn rằn', '🧣', 'phu_kien', 50_000, '#2b2b2b', 'khăn ca rô đen trắng vắt vai', { region: 'Đồng Tháp' }),
  G('gui', 'Gùi mây', '🧺', 'phu_kien', 130_000, '#a9783f', 'gùi đan đeo sau lưng', { region: 'Đắk Lắk' }),
  G('quang_ganh', 'Quang gánh', '🧺', 'phu_kien', 110_000, '#b98a4a', 'đòn gánh tre hai đầu treo thúng'),
  G('tui_coi', 'Túi cói', '👜', 'phu_kien', 80_000, '#cdb37a', 'túi đan bằng cói', { region: 'Ninh Bình' }),
  G('ba_lo', 'Ba lô du lịch', '🎒', 'phu_kien', 200_000, '#3d6fb4', 'ba lô vải, có bình nước'),
  G('kinh_ram', 'Kính râm', '🕶️', 'phu_kien', 90_000, '#1c1c1c', 'kính đen'),
  // kiểu nhà (thêm ngoài ba kiểu sẵn có ở mục Trang trí)
  G('nha_cap_bon', 'Nhà cấp bốn mái tôn', '🏠', 'nha', 300_000, '#d9d2c5', 'nhà một tầng mái tôn dốc, hiên trước'),
  G('nha_ong', 'Nhà ống ba tầng', '🏢', 'nha', 3_000_000, '#f1e4c8', 'nhà phố hẹp ngang, ba tầng, ban công', { minLevel: 4 }),
  G('nha_ruong', 'Nhà rường Huế', '🏯', 'nha', 6_000_000, '#6b3f24', 'nhà gỗ nhiều cột kèo chạm trổ, mái ngói liệt', { region: 'Huế', minLevel: 5 }),
  G('nha_dai', 'Nhà dài Ê Đê', '🛖', 'nha', 2_500_000, '#8a6a3f', 'nhà sàn rất dài, cầu thang gỗ đẽo', { region: 'Đắk Lắk', minLevel: 3 }),
  G('nha_rong', 'Nhà rông', '🛖', 'nha', 4_000_000, '#9a7a45', 'mái tranh cao vút hình lưỡi rìu', { region: 'Quảng Ngãi', minLevel: 4 }),
  G('nha_trinh_tuong', 'Nhà trình tường', '🏠', 'nha', 2_000_000, '#c9a468', 'tường đất nện vàng, mái ngói âm dương', { region: 'Tuyên Quang', minLevel: 3 }),
  G('nha_noi', 'Nhà nổi miền Tây', '🛶', 'nha', 1_800_000, '#7fa6b8', 'nhà gỗ trên bè, cạnh ghe', { region: 'An Giang', minLevel: 3 }),
  G('biet_thu_vuon', 'Biệt thự vườn', '🏡', 'nha', 12_000_000, '#f5efe2', 'hai tầng mái ngói, sân rộng, cổng sắt', { minLevel: 7 }),
  // nội thất
  G('bo_truong_ky', 'Bộ trường kỷ gỗ', '🪑', 'noi_that', 900_000, '#6b3f24', 'ghế dài và bàn trà gỗ sẫm chạm khảm'),
  G('phan_go', 'Phản gỗ', '🛏️', 'noi_that', 700_000, '#7a4a28', 'bộ ngựa gỗ dày'),
  G('ban_tho', 'Bàn thờ gia tiên', '🕯️', 'noi_that', 1_500_000, '#8a2d1c', 'tủ thờ gỗ, lư hương, hoành phi', { minLevel: 2 }),
  G('vong', 'Võng', '🪢', 'noi_that', 120_000, '#4f8f6a', 'võng lưới mắc hai cột'),
  G('tu_che', 'Tủ chè', '🗄️', 'noi_that', 1_100_000, '#5c3520', 'tủ thấp khảm trai'),
  G('bep_cui', 'Bếp củi', '🔥', 'noi_that', 200_000, '#5a5a5a', 'kiềng ba chân, nồi đất, gác bếp'),
  G('tu_lanh', 'Tủ lạnh', '🧊', 'noi_that', 2_000_000, '#dfe7ee', 'tủ lạnh hai cánh', { minLevel: 3 }),
  G('ti_vi', 'Ti vi', '📺', 'noi_that', 1_600_000, '#22252b', 'ti vi màn hình phẳng trên kệ', { minLevel: 3 }),
  // đồ sân vườn
  G('gieng_nuoc', 'Giếng nước', '⛲', 'san_vuon', 500_000, '#8d8d86', 'giếng tròn xây gạch có gàu'),
  G('cay_rom', 'Cây rơm', '🌾', 'san_vuon', 100_000, '#d9b44a', 'đống rơm hình nấm'),
  G('chuong_ga', 'Chuồng gà', '🐔', 'san_vuon', 350_000, '#a9783f', 'chuồng tre thấp có mái'),
  G('gian_bau', 'Giàn bầu', '🥒', 'san_vuon', 250_000, '#5fa052', 'giàn tre leo bầu, mướp'),
  G('hon_non_bo', 'Hòn non bộ', '⛰️', 'san_vuon', 1_200_000, '#7f8a7a', 'núi đá nhỏ trong bể nước, cây si', { minLevel: 3 }),
  G('cay_si_bonsai', 'Chậu bon sai', '🌳', 'san_vuon', 800_000, '#3f6f3a', 'cây thế trong chậu sứ', { minLevel: 2 }),
  G('lu_nuoc_mam', 'Chum nước mắm', '🏺', 'san_vuon', 300_000, '#7a4b2e', 'hàng chum sành đậy nón', { region: 'An Giang' }),
  G('cot_neu', 'Cây nêu ngày Tết', '🎋', 'san_vuon', 200_000, '#4f9a57', 'cây tre cao treo đèn lồng, câu đối'),
  // xe cá nhân
  G('xe_dap', 'Xe đạp', '🚲', 'xe', 800_000, '#3d8fd1', 'xe đạp có giỏ', { license: null }),
  G('xe_may', 'Xe máy số', '🛵', 'xe', 9_000_000, '#c0392b', 'xe số phổ thông 110 cm³', { license: 'A1' }),
  G('xe_may_dien', 'Xe máy điện', '🛵', 'xe', 11_000_000, '#27ae60', 'xe ga chạy điện, không ống xả', { license: 'A1' }),
  G('o_to', 'Ô tô con 5 chỗ', '🚗', 'xe', 60_000_000, '#f2f2f2', 'xe gầm thấp bốn cửa', { license: 'B', minLevel: 4 }),
  G('o_to_dien', 'Ô tô điện 5 chỗ', '🚙', 'xe', 80_000_000, '#4aa3d8', 'xe gầm cao chạy điện, cổng sạc bên hông', { license: 'B', minLevel: 5 }),
];
export const GOODS_BY_ID: Record<string, Good> = Object.fromEntries(GOODS.map((g) => [g.id, g]));
export type EquipSlot = 'ao' | 'non' | 'phu_kien' | 'nha' | 'xe';
export const EQUIP_SLOTS: EquipSlot[] = ['ao', 'non', 'phu_kien', 'nha', 'xe'];
/** Mọi xe cá nhân đều phải có trong bảng PERSONAL_RIDES của shared/vehicles.ts. */
export const RIDE_GOODS = GOODS.filter((g) => g.category === 'xe' && Object.hasOwn(PERSONAL_RIDES, g.id)).map((g) => g.id);
