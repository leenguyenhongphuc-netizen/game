// Rà soát phương tiện công cộng trên toàn bản đồ: mọi cặp vùng (đi → đến), phương tiện có/không, giá, thời gian, và các bất thường.
// Chạy: node tools/transport-audit.ts            (tóm tắt + danh sách bất thường)
//       node tools/transport-audit.ts --bang     (thêm bảng đầy đủ mọi cặp, dạng markdown)
//       node tools/transport-audit.ts --tu ld_dalat   (chỉ các chuyến đi từ một vùng)
import { REGIONS } from '../shared/catalog.ts';
import { haversineKm, stationsNear, airportsNear, travelOptions, busFare, taxiFare, roadKmOf, TAXI_MAX_KM } from '../shared/rules.ts';
import type { TravelOption } from '../shared/rules.ts';

const ids = Object.keys(REGIONS).sort();
const args = process.argv.slice(2), full = args.includes('--bang'), from = args.includes('--tu') ? args[args.indexOf('--tu') + 1] : null;
const vnd = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tr` : `${Math.round(v / 1000)}k`);

/** Luật cũ (trước nhánh I5) để so số bất thường: giá theo km đường chim bay, tàu cứ ≥ 150 km là có. */
function oldOptions(a: string, b: string): { mode: string; fare: number }[] {
  const ra = REGIONS[a], rb = REGIONS[b];
  const km = Math.round(haversineKm(ra.lat, ra.lng, rb.lat, rb.lng));
  if (ra.island || rb.island) return [{ mode: 'tau_thuy', fare: 50_000 + 600 * km }];
  return [{ mode: 'xe_khach', fare: 10_000 + 150 * km }, ...(km <= 200 ? [{ mode: 'taxi', fare: 15_000 + 2_500 * km }] : []), ...(km >= 150 ? [{ mode: 'tau_hoa', fare: 20_000 + 250 * km }] : [])];
}

type Issue = { pair: string; what: string };
function check(a: string, b: string, opts: TravelOption[]): Issue[] {
  const out: Issue[] = [], pair = `${REGIONS[a].name} → ${REGIONS[b].name}`;
  const ra = REGIONS[a], rb = REGIONS[b], road = roadKmOf(haversineKm(ra.lat, ra.lng, rb.lat, rb.lng));
  const by = (m: string) => opts.find((o) => o.mode === m);
  if (!opts.length) out.push({ pair, what: 'không có phương tiện nào' });
  if (!ra.island && !rb.island && !by('xe_khach')) out.push({ pair, what: 'đất liền mà không có xe khách' });
  if ((ra.island || rb.island) && !by('tau_thuy')) out.push({ pair, what: 'ra đảo mà không có tàu thuỷ' });
  const train = by('tau_hoa');
  if (train && (!stationsNear(a).length || !stationsNear(b).length)) out.push({ pair, what: 'có tàu hoả nhưng một đầu không gần ga' });
  const plane = by('may_bay'), bus = by('xe_khach');
  if (plane && (!airportsNear(a).length || !airportsNear(b).length)) out.push({ pair, what: 'có máy bay nhưng một đầu không gần sân bay' });
  if (plane && bus && plane.hours >= bus.hours) out.push({ pair, what: `máy bay (${plane.hours} giờ) không nhanh hơn xe khách (${bus.hours} giờ)` });
  if (plane && bus && plane.fare > bus.fare * 12) out.push({ pair, what: `máy bay đắt gấp ${(plane.fare / bus.fare).toFixed(1)} lần xe khách` });
  if (train && plane && train.fare > plane.fare) out.push({ pair, what: 'tàu hoả đắt hơn máy bay' });
  if (bus && road >= 30 && (bus.fare / road < 400 || bus.fare / road > 2_000)) out.push({ pair, what: `giá xe khách ${Math.round(bus.fare / road)} đ/km ngoài khoảng thật 400–2.000` });
  const taxi = by('taxi');
  if (taxi && road > TAXI_MAX_KM) out.push({ pair, what: 'taxi chặng quá xa' });
  return out;
}
function checkOld(a: string, b: string): Issue[] {
  const out: Issue[] = [], pair = `${REGIONS[a].name} → ${REGIONS[b].name}`, ra = REGIONS[a], rb = REGIONS[b];
  const road = roadKmOf(haversineKm(ra.lat, ra.lng, rb.lat, rb.lng)), o = oldOptions(a, b), by = (m: string) => o.find((x) => x.mode === m);
  if (by('tau_hoa') && (!stationsNear(a).length || !stationsNear(b).length)) out.push({ pair, what: 'có tàu hoả nhưng một đầu không gần ga' });
  const bus = by('xe_khach');
  if (bus && bus.fare < busFare(road) * 0.6) out.push({ pair, what: 'giá xe khách thấp hơn 60% giá thật' });
  const taxi = by('taxi');
  if (taxi && taxi.fare < taxiFare(road) * 0.6) out.push({ pair, what: 'giá taxi thấp hơn 60% giá thật' });
  return out;
}

let pairs = 0;
const issues: Issue[] = [], oldIssues: Issue[] = [];
const count: Record<string, number> = {};
const rows: string[] = [];
for (const a of ids) for (const b of ids) {
  if (a === b || (from && a !== from)) continue;
  pairs++;
  const opts = travelOptions(a, b);
  for (const o of opts) count[o.mode] = (count[o.mode] ?? 0) + 1;
  issues.push(...check(a, b, opts));
  oldIssues.push(...checkOld(a, b));
  if (full || from) rows.push(`| ${REGIONS[a].name} | ${REGIONS[b].name} | ${opts.map((o) => `${o.mode} ${vnd(o.fare)} ${o.hours}h${o.via ? ` (${o.via})` : ''}`).join('; ')} |`);
}
const group = (list: Issue[]) => {
  const g: Record<string, number> = {};
  for (const i of list) { const k = i.what.replace(/[\d.,]+/g, 'N'); g[k] = (g[k] ?? 0) + 1; }
  return Object.entries(g).sort((x, y) => y[1] - x[1]);
};
console.log(`Rà soát ${pairs} cặp vùng (${ids.length} vùng).`);
console.log('Số cặp có từng phương tiện:', Object.entries(count).map(([m, n]) => `${m} ${n}`).join(', '));
console.log(`Vùng gần ga (≤ 80 km đường bộ): ${ids.filter((i) => stationsNear(i).length).length}/${ids.length}; gần sân bay: ${ids.filter((i) => airportsNear(i).length).length}/${ids.length}`);
console.log(`Không gần ga: ${ids.filter((i) => !stationsNear(i).length).map((i) => REGIONS[i].name).join(', ')}`);
console.log(`\nBất thường theo luật CŨ: ${oldIssues.length}`);
for (const [k, n] of group(oldIssues)) console.log(`  ${n} × ${k}`);
console.log(`Bất thường theo luật MỚI: ${issues.length}`);
for (const [k, n] of group(issues)) console.log(`  ${n} × ${k}`);
for (const i of issues.slice(0, 40)) console.log(`  - ${i.pair}: ${i.what}`);
if (rows.length) console.log(['\n| Đi | Đến | Phương tiện |', '|---|---|---|', ...rows].join('\n'));
