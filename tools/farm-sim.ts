/**
 * Mô phỏng cân bằng kinh tế: nông trại quy mô lớn so với thương lái xe lớn và chủ xưởng nhiều máy.
 * Chạy: node tools/farm-sim.ts   (Node chạy TS trực tiếp như máy chủ)
 * Đây là ước lượng theo giờ thật với TIME_SCALE = 1, người chơi đều tay (không trễ bước), giá tham chiếu không biến động.
 * Ba vai cùng bị chặn bởi một thứ: sức mua của chợ (bulkSellFactor) hoặc nguồn hàng sỉ (wholesaleQuote).
 */
import { CROPS, SPECIALTIES } from '../shared/catalog.ts';
import { recipeOf } from '../shared/catalog.ts';
import { FARM_GATE_RATIO, FAR_MARKET_RATIO, bulkSellFactor, wholesaleQuote, WHOLESALE_BASE_KG, WORKSHOP_RUN_FEE_PER_KG, landPrice, MACHINES } from '../shared/rules.ts';
import { VEHICLES, ENERGY_PRICE } from '../shared/vehicles.ts';
import {
  FARM_MACHINES, FIELD_BLOCK_TILES, FIELD_PACE, fieldBlockPrice, fieldMaxBlocks, fieldSeedCost, fieldSteps, fieldYieldKg, workPlan,
  type FarmMachineKind, type WorkMethod,
} from '../shared/farm.ts';

const M = (n: number) => `${(n / 1e6).toFixed(1)} tr`;
const SP = 'xoai_cao_lanh', REGION = SPECIALTIES[SP].regionId, ref = SPECIALTIES[SP].refPrice;

// ---------------------------------------------------------------- nông trại
interface FarmCase { level: number; blocks: number; machines: FarmMachineKind[]; prefer: WorkMethod[]; crops?: number }
function farm(c: FarmCase) {
  const sp = SPECIALTIES[SP], crop = CROPS[sp.crop], tiles = c.blocks * FIELD_BLOCK_TILES;
  const steps = fieldSteps(SP);
  // mỗi cánh đồng tối đa 10 khối → máy làm lần lượt từng cánh đồng nên tổng giờ máy = tổng số ô / công suất.
  let workCost = 0, workHours = 0, energy = 0;
  for (const st of steps.slice(0, -1).concat(steps.slice(-1))) {
    const plans = c.prefer.map((m) => workPlan(st.kind, m, tiles, c.machines)).filter((p) => p.ok);
    const p = plans.sort((a, b) => a.cost + a.hours * 2e6 - (b.cost + b.hours * 2e6))[0] ?? workPlan(st.kind, 'thue', tiles, []);
    workCost += p.cost; workHours += p.hours; energy += p.energy;
  }
  const growHours = crop.growHours / FIELD_PACE;
  const cycleH = growHours + workHours;
  // chia ruộng cho nhiều đặc sản thì mỗi chợ đặc sản chỉ nhận một phần → ít bị ép giá hơn
  const nCrops = c.crops ?? 1, kg = fieldYieldKg(sp.crop, tiles);
  // bán tại chợ nhà; chu kỳ < 24 giờ thì lượng đã bán trong 24 giờ còn đè lên lần sau.
  const per = kg / nCrops, carried = cycleH < 24 ? per * (1 - cycleH / 24) : 0;
  const bulk = bulkSellFactor(carried, per);
  const revenue = kg * ref * FARM_GATE_RATIO * bulk;
  const seed = fieldSeedCost(sp, tiles);
  const capital = c.blocks * fieldBlockPrice(REGION) + c.machines.reduce((s, k) => s + FARM_MACHINES[k].price, 0);
  const net = revenue - seed - workCost;
  return { label: `Nông trại ${c.blocks} khối (${tiles} ô)${nCrops > 1 ? `, ${nCrops} đặc sản` : ''}, ${c.machines.length ? c.machines.join('+') : 'thuê người'}`, level: c.level, capital, cycleH, kg, bulk, perHour: net / cycleH, roiDays: capital / (net / cycleH) / 24 };
}

// ---------------------------------------------------------------- thương lái
function trader(kind: string, level: number, km = 250) {
  const v = VEHICLES[kind];
  const cargo = v.cargoKg;
  const buy = wholesaleQuote(ref, 1, WHOLESALE_BASE_KG, 0, cargo).total;
  const sell = cargo * ref * FAR_MARKET_RATIO * bulkSellFactor(0, cargo);
  const fuel = (km * 2 / 100) * v.per100 * ENERGY_PRICE.dau, tolls = Math.floor(km * 2 / 70) * 35_000 * 3, upkeep = (km * 2 / 100) * v.upkeepPer100;
  const hours = (km * 2) / 55 + 1; // lái đi về + xếp dỡ
  const net = sell - buy - fuel - tolls - upkeep;
  const capital = v.price + buy;
  return { label: `Thương lái ${v.name}, ${km} km`, level, capital, cycleH: hours, kg: cargo, bulk: bulkSellFactor(0, cargo), perHour: net / hours, roiDays: capital / (net / hours) / 24 };
}

// ---------------------------------------------------------------- chủ xưởng
function workshop(machines: number, level: number) {
  const r = recipeOf(CROPS[SPECIALTIES[SP].crop]);
  const slots = machines * 2; // máy sấy cấp 1: 2 mẻ song song
  // nguồn sỉ 40 tấn/ngày mỗi đặc sản; mỗi mẻ 2 tấn
  const batchKg = 2000, perDayKg = Math.min(WHOLESALE_BASE_KG, slots * batchKg * (24 / r.hours));
  const buy = wholesaleQuote(ref, 1, WHOLESALE_BASE_KG, 0, perDayKg).total;
  const sell = perDayKg * r.ratio * ref * r.value;
  const fee = perDayKg * WORKSHOP_RUN_FEE_PER_KG;
  const net = (sell - buy - fee) / 24;
  const capital = machines * MACHINES.may_say.price + buy / (24 / r.hours);
  return { label: `Chủ xưởng ${machines} máy sấy, nguyên liệu mua sỉ`, level, capital, cycleH: r.hours, kg: perDayKg, bulk: 1, perHour: net, roiDays: capital / net / 24 };
}

const rows = [
  farm({ level: 5, blocks: fieldMaxBlocks(5), machines: [], prefer: ['thue'] }),
  farm({ level: 7, blocks: fieldMaxBlocks(7), machines: ['he_tuoi', 'may_cay'], prefer: ['may', 'drone', 'thue'] }),
  farm({ level: 10, blocks: fieldMaxBlocks(10), machines: ['he_tuoi', 'may_cay', 'may_gieo', 'drone', 'may_thu'], prefer: ['may', 'drone', 'thue'] }),
  farm({ level: 14, blocks: fieldMaxBlocks(14), machines: ['he_tuoi', 'may_cay', 'may_gieo', 'drone', 'may_thu'], prefer: ['may', 'drone', 'thue'] }),
  farm({ level: 14, blocks: fieldMaxBlocks(14), machines: ['he_tuoi', 'may_cay', 'may_gieo', 'drone', 'may_thu'], prefer: ['may', 'drone', 'thue'], crops: 3 }),
  farm({ level: 24, blocks: fieldMaxBlocks(24), machines: ['he_tuoi', 'may_cay', 'may_gieo', 'drone', 'may_thu'], prefer: ['may', 'drone', 'thue'] }),
  trader('tai_8t', 5), trader('tai_15t', 6), trader('dau_keo', 7),
  workshop(4, 5), workshop(8, 10),
];
console.log(`Đặc sản mẫu: ${SPECIALTIES[SP].name} (${ref.toLocaleString('vi-VN')} đ/kg), giá khối ruộng ${M(fieldBlockPrice(REGION))}, đất vườn ${M(landPrice(REGION))}`);
console.log('| Vai | Cấp | Vốn | Chu kỳ (giờ) | Hàng/chu kỳ | Hệ số xả | Lãi/giờ | Hoàn vốn (ngày) |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.label} | ${r.level} | ${M(r.capital)} | ${r.cycleH.toFixed(1)} | ${Math.round(r.kg).toLocaleString('vi-VN')} kg | ${r.bulk.toFixed(2)} | ${M(r.perHour)} | ${r.roiDays.toFixed(1)} |`);
