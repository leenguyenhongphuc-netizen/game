// Chức năng theo vai — BẢNG DUY NHẤT. Giao diện ẩn hẳn chức năng không thuộc vai; máy chủ chặn đúng theo bảng này.
// Lý do từng ô: docs/GDD.md mục "Chức năng theo vai".
import type { Role } from './rules.ts';

export type Feature =
  | 'vuon_nha'          // trồng ở vườn nhà (nhà vườn 30 ô; thương lái vườn bếp 8 ô)
  | 'canh_dong'         // cánh đồng lớn, máy nông nghiệp, drone, trực thăng xem ruộng
  | 'hop_tac_xa'        // lập/vào hợp tác xã nông nghiệp
  | 'lai_giong'         // lai giống trong Lò lai tạo
  | 'xuong'             // nhà xưởng, máy chế biến, máy nhập khẩu, ghép máy
  | 'phoi_hop_qua'      // phối hộp quà (đóng gói thương mại)
  | 'thu_mua_si'        // thu mua sỉ bằng xe tải ở vùng khác
  | 'xuat_khau'         // gửi lô xuất khẩu (thương lái: tươi + thành phẩm; chủ xưởng: thành phẩm)
  | 'xuat_khau_tuoi'    // xuất khẩu nông sản tươi
  | 'hop_dong'          // nhận hợp đồng của công ty xuất nhập khẩu
  | 'ky_gui_sieu_thi'   // ký gửi hàng lên kệ siêu thị
  | 'dat_nong_nghiep'   // nhận/mua lại đất nông nghiệp (khối ruộng)
  | 'dat_thuong_mai'    // nhận/mua lại đất thương mại – dịch vụ
  | 'dat_cong_nghiep'   // thuê/mua lại đất khu công nghiệp
  | 'dat_o'             // đất ở (nhà thứ hai, homestay — chưa mở bán)
  | 'cua_hang'          // mở cửa hàng đặc sản, siêu thị trên đất thương mại
  | 'xuong_chi_nhanh'   // mở xưởng chi nhánh trên đất công nghiệp
  | 'mua_may'           // mua máy chế biến (kể cả máy công ty xuất nhập khẩu bán lại)
  | 'xe_tai_lon';       // xe tải nặng 8–15 tấn, đầu kéo

export const FEATURE_INFO: Record<Feature, { name: string; roles: Role[]; why: string }> = {
  vuon_nha: { name: 'Trồng ở vườn nhà', roles: ['nong_dan', 'thuong_lai'],
    why: 'Nhà vườn sống bằng vườn; thương lái giữ vườn bếp nhỏ. Chủ xưởng dùng lô làm nhà xưởng.' },
  canh_dong: { name: 'Cánh đồng, máy nông nghiệp', roles: ['nong_dan'],
    why: 'Đất trồng lúa và cây lâu năm chỉ chuyển nhượng cho người trực tiếp sản xuất nông nghiệp (Luật Đất đai 2024).' },
  hop_tac_xa: { name: 'Hợp tác xã nông nghiệp', roles: ['nong_dan'],
    why: 'Hợp tác xã trong game là HTX nông nghiệp: gom người trồng cùng vùng để bán chung.' },
  lai_giong: { name: 'Lai giống', roles: ['nong_dan'], why: 'Việc của người trồng.' },
  xuong: { name: 'Nhà xưởng, máy chế biến', roles: ['xuong'], why: 'Chủ xưởng là vai duy nhất chế biến.' },
  phoi_hop_qua: { name: 'Phối hộp quà', roles: ['xuong', 'thuong_lai'], why: 'Đóng gói thương mại: xưởng hoặc thương lái làm.' },
  thu_mua_si: { name: 'Thu mua sỉ bằng xe tải', roles: ['thuong_lai'], why: 'Nghề của thương lái.' },
  xuat_khau: { name: 'Xuất khẩu', roles: ['thuong_lai', 'xuong'],
    why: 'Nông dân bán cho thương lái, HTX hoặc chợ; người xuất khẩu là doanh nghiệp thương mại và nhà chế biến.' },
  xuat_khau_tuoi: { name: 'Xuất khẩu nông sản tươi', roles: ['thuong_lai'], why: 'Chủ xưởng chỉ xuất thành phẩm của mình.' },
  hop_dong: { name: 'Hợp đồng công ty xuất nhập khẩu', roles: ['thuong_lai', 'xuong', 'nong_dan'],
    why: 'Doanh nghiệp ký hợp đồng liên kết bao tiêu với nông dân/HTX (NĐ 98/2018/NĐ-CP), với thương lái và xưởng. Nông dân chỉ nhận hợp đồng hàng tươi do mình trồng.' },
  ky_gui_sieu_thi: { name: 'Ký gửi lên kệ siêu thị', roles: ['thuong_lai', 'xuong'],
    why: 'Siêu thị nhận hàng từ nhà cung cấp có hoá đơn; nông dân bán qua chợ, thương lái, HTX.' },
  dat_nong_nghiep: { name: 'Đất nông nghiệp', roles: ['nong_dan'],
    why: 'Luật Đất đai 2024: đất trồng lúa chỉ chuyển nhượng cho người trực tiếp sản xuất nông nghiệp.' },
  dat_thuong_mai: { name: 'Đất thương mại – dịch vụ', roles: ['thuong_lai', 'xuong'],
    why: 'Dùng để dựng cửa hàng, siêu thị bán hàng: việc của thương lái (bán buôn, bán lẻ) và chủ xưởng (cửa hàng giới thiệu sản phẩm). Nhà vườn bán qua chợ, HTX, thương lái nên không cần.' },
  dat_cong_nghiep: { name: 'Đất khu công nghiệp', roles: ['xuong'],
    why: 'Đất trong khu công nghiệp cho doanh nghiệp sản xuất thuê lại để dựng nhà xưởng.' },
  dat_o: { name: 'Đất ở', roles: ['nong_dan', 'xuong', 'thuong_lai'], why: 'Ai cũng được mua nhà ở (mở ở bản sau).' },
  cua_hang: { name: 'Cửa hàng đặc sản, siêu thị', roles: ['thuong_lai', 'xuong'],
    why: 'Bán lẻ là nghề của thương lái; chủ xưởng mở cửa hàng bán thành phẩm của mình.' },
  xuong_chi_nhanh: { name: 'Xưởng chi nhánh', roles: ['xuong'], why: 'Chỉ chủ xưởng chế biến.' },
  mua_may: { name: 'Mua máy chế biến', roles: ['xuong'], why: 'Máy chế biến chỉ dùng trong nhà xưởng.' },
  xe_tai_lon: { name: 'Xe tải nặng, đầu kéo', roles: ['thuong_lai', 'xuong'],
    why: 'Chở hàng sỉ đường dài là việc của thương lái và xưởng. Nhà vườn có xe tới 3,5 tấn (kể cả thùng lạnh) để chở nông sản nhà mình.' },
};

/** Loại đất → chức năng (để giao diện ẩn và máy chủ chặn cùng một bảng). */
export const LAND_USE_FEATURE = { nong_nghiep: 'dat_nong_nghiep', thuong_mai: 'dat_thuong_mai', cong_nghiep: 'dat_cong_nghiep', o: 'dat_o' } as const satisfies Record<string, Feature>;
/** Loại công trình → chức năng. */
export const BUILDING_FEATURE = { cua_hang: 'cua_hang', sieu_thi: 'cua_hang', xuong: 'xuong_chi_nhanh' } as const satisfies Record<string, Feature>;
/** Vai được dùng một loại đất / một loại công trình. */
export const rolesOfLand = (use: keyof typeof LAND_USE_FEATURE): Role[] => FEATURE_INFO[LAND_USE_FEATURE[use]].roles;
export const rolesOfBuilding = (kind: keyof typeof BUILDING_FEATURE): Role[] => FEATURE_INFO[BUILDING_FEATURE[kind]].roles;

export function canUse(role: Role | null | undefined, f: Feature): boolean {
  return !!role && FEATURE_INFO[f].roles.includes(role);
}

const ROLE_NAME: Record<Role, string> = { nong_dan: 'Nhà vườn', xuong: 'Chủ xưởng', thuong_lai: 'Thương lái' };
/** Câu báo khi vai không dùng được chức năng. */
export function denyMessage(role: Role | null | undefined, f: Feature): string {
  const who = FEATURE_INFO[f].roles.map((r) => ROLE_NAME[r]).join(', ');
  return role ? `${FEATURE_INFO[f].name} là việc của ${who}; ${ROLE_NAME[role]} không dùng chức năng này.` : 'Hãy nhận vai trò trước.';
}

/** Đường API thuộc chức năng nào (METHOD + url mẫu của Fastify). Không có trong bảng = chức năng chung. */
// Không chặn: xem xưởng, nhận mẻ đang chạy, bán thành phẩm còn trong kho và rút hàng khỏi kệ siêu thị —
// để người vừa đổi vai (vòng quay mỗi mùa) thu dọn được phần việc cũ.
export const ROUTE_FEATURES: Record<string, Feature> = {
  'POST /api/fields/buy': 'canh_dong', 'POST /api/fields/:id/plant': 'canh_dong', 'POST /api/fields/:id/work': 'canh_dong',
  'POST /api/fields/:id/harvest': 'canh_dong', 'POST /api/fields/:id/sell': 'canh_dong',
  'POST /api/farm/machines/buy': 'canh_dong', 'POST /api/farm/heli/tour': 'canh_dong',
  'POST /api/coops': 'hop_tac_xa', 'POST /api/coops/:id/join': 'hop_tac_xa', 'POST /api/coops/order/contribute': 'hop_tac_xa',
  'POST /api/coops/:id/accept': 'hop_tac_xa', 'POST /api/coops/:id/register': 'hop_tac_xa', 'POST /api/coops/:id/invite': 'hop_tac_xa',
  'GET /api/workshop/imports': 'xuong', 'POST /api/workshop/start': 'xuong', 
  'POST /api/workshop/machines/buy': 'xuong', 'POST /api/workshop/machines/import': 'xuong',
  'POST /api/workshop/machines/:id/upgrade': 'xuong', 'POST /api/workshop/imports/:id/install': 'xuong',
  'POST /api/fusion/boxes/sell': 'phoi_hop_qua',
  'POST /api/wholesale/buy': 'thu_mua_si',
  'POST /api/export/quote': 'xuat_khau', 'POST /api/export/ship': 'xuat_khau',
  'POST /api/contracts/:id/deliver': 'hop_dong',
  'POST /api/supermarket/consign': 'ky_gui_sieu_thi',
};
// Đất và công trình chặn theo loại trong thân yêu cầu (shared/land.ts canBuyLand/canBuild đọc rolesOfLand/rolesOfBuilding).

/** Loại công thức trong Lò lai tạo → chức năng. */
export const FUSION_FEATURE: Record<'giong' | 'san_pham' | 'may', Feature> = { giong: 'lai_giong', san_pham: 'phoi_hop_qua', may: 'xuong' };

/** Thẻ trong bảng Kho theo vai (App dùng để ẩn). */
export type KhoTab = 'kho' | 'don' | 'xuong' | 'xuat' | 'mua' | 'tui' | 'dunghop' | 'ruong' | 'hopdong';
export function khoTabs(role: Role | null | undefined): KhoTab[] {
  const t: KhoTab[] = ['kho', 'don'];
  if (canUse(role, 'hop_dong')) t.push('hopdong');
  if (canUse(role, 'xuong')) t.push('xuong');
  if (canUse(role, 'xuat_khau')) t.push('xuat');
  t.push('tui');
  if (canUse(role, 'lai_giong') || canUse(role, 'phoi_hop_qua') || canUse(role, 'xuong')) t.push('dunghop');
  if (canUse(role, 'canh_dong')) t.push('ruong');
  if (canUse(role, 'thu_mua_si')) t.push('mua');
  return t;
}
