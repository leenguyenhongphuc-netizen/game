// Kiểm nhanh dữ liệu địa danh vùng Nam Trung Bộ – Tây Nguyên: có trong SIGHTS, tỉnh có trong danh sách tỉnh, đủ 5 điểm dừng.
import { SIGHTS } from '../shared/sights.ts';
import { PROVINCES, REGIONS } from '../shared/catalog.ts';
import { SIGHTS_NAM_TRUNG_TAY_NGUYEN } from '../shared/sights/nam_trung_tay_nguyen.ts';
const regionProv = new Set(Object.values(REGIONS).map((r) => r.province));
for (const s of SIGHTS_NAM_TRUNG_TAY_NGUYEN) {
  const ok = SIGHTS.some((x) => x.id === s.id), prov = (PROVINCES as readonly string[]).includes(s.province), hasRegion = regionProv.has(s.province);
  console.log(s.id.padEnd(20), ok ? 'co' : 'THIEU', prov ? 'tinh-ok' : 'TINH-SAI', hasRegion ? 'co-vung' : 'KHONG-VUNG', s.stops.length, 'diem dung');
}
console.log('tong SIGHTS', SIGHTS.length);
