// Bảng các bộ cảnh: mỗi địa danh một hàm dựng. Thêm tỉnh mới chỉ cần thêm file và ghi vào đây.
import type { Sight } from '../../../../shared/sights.ts';
import type { Kit, SightSet } from '../SightKit.ts';
import { hoiAn } from './dn_hoi_an.ts';
import { mySon } from './dn_my_son.ts';

export type SetBuilder = (kit: Kit, sight: Sight) => SightSet;
export const SETS: Record<string, SetBuilder> = {
  dn_hoi_an: hoiAn,
  dn_my_son: mySon,
  'kind:pho_co': hoiAn,
  'kind:den_thap': mySon,
};
