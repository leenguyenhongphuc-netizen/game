// Bộ cảnh 3D các địa danh vùng Đồng bằng sông Hồng (id khớp shared/sights/dong_bang_bac.ts).
import type { SetBuilder } from '../index.ts';
import { hoGuom } from '../db_hn_ho_guom.ts';
import { vanMieu } from '../db_hn_van_mieu.ts';
import { haLong } from '../db_qn_ha_long.ts';
import { yenTu } from '../db_qn_yen_tu.ts';
import { lanHa } from '../db_hp_lan_ha.ts';
import { trangAn } from '../db_nb_trang_an.ts';
import { baiDinh } from '../db_nb_bai_dinh.ts';
import { chuaDau } from '../db_bn_chua_dau.ts';
import { phoHien } from '../db_hy_pho_hien.ts';
import { chuaKeo } from '../db_hy_chua_keo.ts';
export const SETS_DONG_BANG_BAC: Record<string, SetBuilder> = {
  hn_ho_guom: hoGuom,
  hn_van_mieu: vanMieu,
  qn_vinh_ha_long: haLong,
  qn_yen_tu: yenTu,
  hp_lan_ha: lanHa,
  nb_trang_an: trangAn,
  nb_bai_dinh: baiDinh,
  bn_chua_dau: chuaDau,
  hy_pho_hien: phoHien,
  hy_chua_keo: chuaKeo,
};
