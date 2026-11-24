// Bộ cảnh 3D các địa danh vùng Nam Trung Bộ và Tây Nguyên (id khớp shared/sights/nam_trung_tay_nguyen.ts).
import type { SetBuilder } from '../index.ts';
import { konKlor } from '../nt_kon_klor.ts';
import { kyCo } from '../nt_ky_co.ts';
import { thapBanhIt } from '../nt_thap_banh_it.ts';
import { bienHo } from '../nt_bien_ho.ts';
import { ganhDaDia } from '../nt_ganh_da_dia.ts';
import { drayNur } from '../nt_dray_nur.ts';
import { ponagar } from '../nt_ponagar.ts';
import { vinhHy } from '../nt_vinh_hy.ts';
import { poKlongGarai } from '../nt_po_klong_garai.ts';
import { hoXuanHuong } from '../nt_ho_xuan_huong.ts';
import { gaDaLat } from '../nt_ga_da_lat.ts';
import { muiNe } from '../nt_mui_ne.ts';
export const SETS_NAM_TRUNG_TAY_NGUYEN: Record<string, SetBuilder> = {
  nt_kon_klor: konKlor, nt_ky_co: kyCo, nt_thap_banh_it: thapBanhIt, nt_bien_ho: bienHo, nt_ganh_da_dia: ganhDaDia, nt_dray_nur: drayNur,
  nt_ponagar: ponagar, nt_vinh_hy: vinhHy, nt_po_klong_garai: poKlongGarai, nt_ho_xuan_huong: hoXuanHuong, nt_ga_da_lat: gaDaLat, nt_mui_ne: muiNe,
};
