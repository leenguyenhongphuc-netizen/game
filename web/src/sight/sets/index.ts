// Bảng các bộ cảnh: mỗi địa danh một hàm dựng. Thêm tỉnh mới chỉ cần thêm file và ghi vào đây.
import type { Sight } from '../../../../shared/sights.ts';
import type { Kit, SightSet } from '../SightKit.ts';
import { hoiAn } from './dn_hoi_an.ts';

export type SetBuilder = (kit: Kit, sight: Sight) => SightSet;
export const SETS: Record<string, SetBuilder> = {
  dn_hoi_an: hoiAn,
  'kind:pho_co': hoiAn,
};
