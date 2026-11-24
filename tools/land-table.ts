// In bảng quỹ đất và giá đất mẫu: node tools/land-table.ts [tỉnh...]
import { PROVINCES } from '../shared/catalog.ts';
import { BUILDINGS, PROVINCE_LAND, buildingCost, provinceLandSummary, shopTraffic } from '../shared/land.ts';
import type { BuildingKind } from '../shared/land.ts';
import { TRUCK } from '../shared/rules.ts';
import { ENERGY_PRICE } from '../shared/vehicles.ts';

const miss = PROVINCES.filter((p) => !PROVINCE_LAND[p]);
if (miss.length) { console.error('Thiếu số liệu đất:', miss); process.exit(1); }
const pick = process.argv.slice(2).length ? process.argv.slice(2) : ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Bắc Ninh', 'Đồng Tháp', 'Lai Châu'];
const m = (v: number) => (v >= 1e9 ? (v / 1e9).toFixed(2) + ' tỉ' : Math.round(v / 1e6) + ' tr');
console.log('| Tỉnh | Loại đất | Thửa (m²) | Giá/m² | Giá thửa | Quỹ đợt 1 | Tổng giá trị |');
console.log('|---|---|---|---|---|---|---|');
for (const p of pick) for (const r of provinceLandSummary(p)) {
  console.log(`| ${p} | ${r.short} | ${r.lotM2.toLocaleString('vi-VN')} | ${r.priceM2.toLocaleString('vi-VN')}đ | ${m(r.lotPrice)} | ${r.released.toLocaleString('vi-VN')} thửa${r.open ? '' : ' (chưa mở)'} | ${m(r.leftValue)} |`);
}
console.log('\n| Tỉnh | ' + (Object.keys(BUILDINGS) as BuildingKind[]).map((k) => BUILDINGS[k].name).join(' | ') + ' | Lượng khách |');
console.log('|---|---|---|---|---|');
for (const p of pick) console.log(`| ${p} | ${(Object.keys(BUILDINGS) as BuildingKind[]).map((k) => m(buildingCost(k, p).total)).join(' | ')} | ×${shopTraffic(p)} |`);
console.log('\nXăng xe tải', TRUCK.fuelPrice, 'phí một trạm', TRUCK.tollFee, ENERGY_PRICE);
