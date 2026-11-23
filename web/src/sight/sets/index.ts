// Bảng các bộ cảnh: mỗi địa danh một hàm dựng. Thêm tỉnh mới chỉ cần thêm file và ghi vào đây.
import type { Sight } from '../../../../shared/sights.ts';
import type { Kit, SightSet } from '../SightKit.ts';
import { hoiAn } from './dn_hoi_an.ts';
import { cauRong } from './dn_cau_rong.ts';
import { nguHanhSon } from './dn_ngu_hanh_son.ts';
import { baNa } from './dn_ba_na.ts';
import { sonTra } from './dn_son_tra.ts';
import { cuLaoCham } from './dn_cu_lao_cham.ts';
import { mySon } from './dn_my_son.ts';
import { haiVan } from './dn_hai_van.ts';
import { myKhe } from './dn_my_khe.ts';
import { thanhHa } from './dn_thanh_ha.ts';
import { bayMau } from './dn_bay_mau.ts';
import { tamThanh } from './dn_tam_thanh.ts';
import { lySon } from './qng_ly_son.ts';
import { parkSet } from '../../park/parkSet.ts';

import { decorate } from '../guide.ts';
export type SetBuilder = (kit: Kit, sight: Sight) => SightSet;
const RAW: Record<string, SetBuilder> = {
  dn_hoi_an: hoiAn,
  dn_my_son: mySon,
  dn_cau_rong: cauRong,
  dn_ngu_hanh_son: nguHanhSon,
  dn_ba_na: baNa,
  dn_son_tra: sonTra,
  dn_cu_lao_cham: cuLaoCham,
  dn_hai_van: haiVan,
  dn_my_khe: myKhe,
  dn_thanh_ha: thanhHa,
  dn_bay_mau: bayMau,
  dn_tam_thanh: tamThanh,
  qng_ly_son: lySon,
  'kind:pho_co': hoiAn,
  'kind:chua': sonTra,
  'kind:dao': cuLaoCham,
  'kind:nui': nguHanhSon,
  'kind:cau': cauRong,
  'kind:den_thap': mySon,
  // khu vui chơi: một bộ dựng chung, đọc danh sách trò từ shared/parks.ts
  park_mw_da_nang: parkSet,
  park_bw_nha_trang: parkSet,
  park_mw_ha_long: parkSet,
  'kind:khu_vui_choi': parkSet,
};
/** Mọi set đều được bọc thêm lớp dẫn đường và điểm tương tác phụ dùng chung. */
export const SETS: Record<string, SetBuilder> = Object.fromEntries(Object.entries(RAW).map(([k, f]) => [k, (kit: Kit, sight: Sight) => decorate(kit, sight, f(kit, sight))]));
