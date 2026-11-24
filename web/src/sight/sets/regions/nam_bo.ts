// Bộ cảnh 3D các địa danh vùng Nam Bộ (id khớp shared/sights/nam_bo.ts).
import type { SetBuilder } from '../index.ts';
import { hcmTrungTam } from '../nb_hcm_trung_tam.ts';
import { cuChi } from '../nb_hcm_cu_chi.ts';
import { vungTau } from '../nb_hcm_vung_tau.ts';
import { catTien } from '../nb_dni_cat_tien.ts';
import { buuLong } from '../nb_dni_buu_long.ts';
import { baDen } from '../nb_tni_ba_den.ts';
import { toaThanh } from '../nb_tni_toa_thanh.ts';
import { tramChim } from '../nb_dt_tram_chim.ts';
import { thoiSon } from '../nb_dt_thoi_son.ts';
import { aoBaOm } from '../nb_vl_ao_ba_om.ts';
import { conPhung } from '../nb_vl_con_phung.ts';
import { caiRang } from '../nb_ct_cai_rang.ts';
import { chuaDoi } from '../nb_ct_chua_doi.ts';
import { baChuaXu } from '../nb_ag_ba_chua_xu.ts';
import { traSu } from '../nb_ag_tra_su.ts';
import { dinhCau } from '../nb_ag_dinh_cau.ts';
import { muiCaMau } from '../nb_cm_mui_ca_mau.ts';
import { dienGio } from '../nb_cm_dien_gio.ts';
export const SETS_NAM_BO: Record<string, SetBuilder> = {
  hcm_trung_tam: hcmTrungTam,
  hcm_cu_chi: cuChi,
  hcm_vung_tau: vungTau,
  dni_cat_tien: catTien,
  dni_buu_long: buuLong,
  tni_ba_den: baDen,
  tni_toa_thanh: toaThanh,
  dt_tram_chim: tramChim,
  dt_thoi_son: thoiSon,
  vl_ao_ba_om: aoBaOm,
  vl_con_phung: conPhung,
  ct_cai_rang: caiRang,
  ct_chua_doi: chuaDoi,
  ag_ba_chua_xu: baChuaXu,
  ag_tra_su: traSu,
  ag_dinh_cau: dinhCau,
  cm_mui_ca_mau: muiCaMau,
  cm_dien_gio: dienGio,
};
