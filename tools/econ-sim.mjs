// Mô phỏng thu nhập theo giờ chơi của từng vai ở cấp 1/10/20/30, trên mọi kênh bán.
// Chạy: node tools/econ-sim.mjs   (in bảng "trước" theo luật cũ và "sau" theo luật hiện hành trong shared/)
// Giả định: TIME_SCALE = 1 (giờ thật), người chơi chọn cách lời nhất trong khả năng vốn và tài sản ở cấp đó,
// mua nguyên liệu sỉ ở vùng trồng, bán đúng kênh. Không tính thời tiết, chợ phiên, sự kiện.
import { CROPS, SPECIALTIES, recipeOf } from '../shared/catalog.ts';
import {
  EXPORT_MARKETS, FARM_GATE_RATIO, FAR_MARKET_RATIO, ORDER_PREMIUM, QUALITY_MULT, SEED_COST_RATIO, WORKSHOP_RUN_FEE_PER_KG,
  bulkSellFactor, exportQuote, machineStats, spoilRate, wholesaleQuote, WHOLESALE_BASE_KG,
} from '../shared/rules.ts';
import {
  CONTRACT_PRICE_FRESH, CONTRACT_PRICE_PROCESSED, ORDER_PREMIUM_V2, exportBundleQuote, machineBatchKg, orderBonus, orderScale,
  shopKgPerHour, SHOP_CONSIGN_FEE, provinceTraffic,
} from '../shared/economy.ts';
import { TRUCK } from '../shared/rules.ts';
import { ENERGY_PRICE } from '../shared/vehicles.ts';
import { BUILDINGS, buildingCost } from '../shared/land.ts';
let farm = null;
try { farm = await import('../shared/farm.ts'); } catch { /* chưa có cánh đồng */ }

const LEVELS = [1, 10, 20, 30];
/** Vốn lưu động điển hình theo cấp (tiền mặt + hàng), đúng với nhịp lên cấp đã thử. */
const CAPITAL = { 1: 5e6, 10: 150e6, 20: 1.5e9, 30: 6e9 };
/** Giờ chơi mỗi ngày (để quy đơn theo ngày ra giờ). */
const PLAY_H_PER_DAY = 3;
/** Có tính cánh đồng (shared/farm.ts) cho nông dân không: --khong-dong để chỉ tính vườn 30 ô. */
const FIELDS = !process.argv.includes('--khong-dong');
/** Đặc sản đại diện: trái tươi giá vừa (xoài), trái đắt (sầu riêng), hàng khô (cà phê). */
const SAMPLE = ['sau_rieng', 'xoai', 'ca_phe'].map((crop) => Object.values(SPECIALTIES).find((s) => s.crop === crop));
const OLD_MULT = { trung_quoc: 1.25, lao_cam: 1.15, asean: 1.3, an_do: 1.35, trung_dong: 1.5, nhat_han: 1.6, nga: 1.45, uc_nz: 1.75, au_my: 1.9 };

const fmt = (v) => (Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + ' tỉ' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + ' tr' : Math.round(v / 1e3) + ' k');

// ---------------------------------------------------------------- các kênh
/** Nông dân: vườn 30 ô + cánh đồng mua bằng vốn (nếu có). Bán tại vườn (0,85) có ép giá khi xả nhiều. */
/** Đề xuất cho cánh đồng (shared/farm.ts): --dong-de-xuat mô phỏng với nhịp và năng suất này. */
const FIELD_OVERRIDE = process.argv.includes('--dong-de-xuat') ? { pace: 1, yieldMult: 0.6 } : null;
function farmer(level, after, withFields = true, maxTiles = 30) {
  const blocks = farm && withFields ? Math.min(farm.fieldMaxBlocks(level), Math.floor((CAPITAL[level] * 0.8) / farm.fieldBlockPrice(SAMPLE[1].regionId))) : 0;
  let best = 0;
  for (const sp of SAMPLE) {
    const c = CROPS[sp.crop];
    // hạt giống phải mua trước bằng vốn: vốn ít thì trồng ít ô cây đắt
    const tiles = Math.min(maxTiles, Math.floor((CAPITAL[level] * 0.8) / Math.max(1, sp.refPrice * c.yieldKg * SEED_COST_RATIO))), fieldTiles = blocks * 100;
    const kgPerH = (tiles * c.yieldKg) / c.growHours + (farm ? (fieldTiles * c.yieldKg * (FIELD_OVERRIDE?.yieldMult ?? farm.FIELD_YIELD_MULT) * (FIELD_OVERRIDE?.pace ?? farm.FIELD_PACE)) / c.growHours : 0);
    const kgDay = kgPerH * PLAY_H_PER_DAY * 8; // cây vẫn lớn khi không chơi: một ngày ~ 24 giờ, chơi 3 giờ → mỗi giờ chơi ứng 8 giờ cây lớn
    const bulk = bulkSellFactor(0, kgDay);
    const seed = sp.refPrice * SEED_COST_RATIO;
    const unit = sp.refPrice * FARM_GATE_RATIO * QUALITY_MULT.A * bulk - seed;
    best = Math.max(best, unit * kgPerH * 8);
  }
  return { income: best, note: `${30 + blocks * 100} ô` };
}
/** Chủ xưởng: máy theo vốn; mua sỉ nguyên liệu, chế biến, bán thành phẩm (luật mới: có ép giá khi bán nhiều). */
function workshop(level, after) {
  const machines = level >= 30 ? 12 : level >= 20 ? 8 : level >= 10 ? 4 : 1;
  const mLevel = level >= 20 ? 3 : level >= 10 ? 2 : 1;
  let best = 0, bestNote = '';
  for (const sp of SAMPLE) {
    const r = recipeOf(CROPS[sp.crop]), st = machineStats('may_say', mLevel);
    const slots = machines * st.slots, hours = r.hours * st.time;
    const budget = CAPITAL[level] * 0.9;
    const kgCap = after ? machineBatchKg(mLevel, level >= 20) : Infinity;
    const buyUnit = wholesaleQuote(sp.refPrice, 1, WHOLESALE_BASE_KG, 0, Math.min(budget / sp.refPrice, slots * Math.min(kgCap, 1e6))).unit;
    const kgBatch = Math.min(kgCap, budget / slots / buyUnit);
    const outKgDay = (kgBatch * slots * r.ratio * 24) / hours;
    // thành phẩm chia ra ba mặt hàng, bán ba nơi
    const bulk = after ? bulkSellFactor(0, outKgDay / 3) : 1;
    const perBatch = kgBatch * (r.ratio * r.value * sp.refPrice * bulk - buyUnit - WORKSHOP_RUN_FEE_PER_KG);
    // mỗi giờ chơi máy chạy liên tục (8 giờ máy / giờ chơi như cây), nhưng phải có mặt để nạp mẻ: tối đa 3 lượt mỗi ngày
    const batchesPerDay = Math.min(24 / hours, PLAY_H_PER_DAY * 2);
    const v = (perBatch * slots * batchesPerDay) / PLAY_H_PER_DAY;
    if (v > best) { best = v; bestNote = `${machines} máy c${mLevel}, mẻ ${Math.round(kgBatch)} kg`; }
  }
  return { income: best, note: bestNote };
}
const TRUCK_BY_LEVEL = { 1: 990, 10: 8000, 20: 28000, 30: 28000 };
/** Thương lái: mua sỉ ở vùng trồng, chở 400 km, bán chợ xa (1,1) có ép giá. Một chuyến ~ 35 phút chơi. */
function trader(level) {
  const cap = TRUCK_BY_LEVEL[level];
  let best = 0;
  for (const sp of SAMPLE) for (const load of [990, 3000, 8000, 15000, 28000]) {
    if (load > cap) continue;
    const kg = Math.min(load, CAPITAL[level] / sp.refPrice);
    const buy = wholesaleQuote(sp.refPrice, 1, WHOLESALE_BASE_KG, 0, kg).unit;
    const arrive = kg * (1 - spoilRate(400, cap >= 8000));
    const sell = sp.refPrice * FAR_MARKET_RATIO * bulkSellFactor(0, arrive);
    // giá thật (shared/realPrices.ts): xe nhỏ chạy xăng, xe lớn chạy dầu; 400 km ~ 6 chặng thu phí, xe lớn nhóm 3–5
    const fuel = 400 * (load >= 8000 ? 30 : 12) / 100 * (load >= 3000 ? ENERGY_PRICE.dau : TRUCK.fuelPrice) + 6 * TRUCK.tollFee * (load >= 28000 ? 4 : load >= 15000 ? 3 : load >= 8000 ? 2 : load >= 3000 ? 1.5 : 1);
    best = Math.max(best, (arrive * sell - kg * buy - fuel) / (35 / 60));
  }
  return { income: best, note: `xe ${cap / 1000} t` };
}
/** Xuất khẩu (mọi vai): vốn mua sỉ một lô lớn nhất trong khả năng rồi gửi đường lời nhất mỗi giờ. */
function exporter(level, after, role) {
  let best = 0, note = '';
  for (const sp of SAMPLE) {
    for (const market of Object.keys(EXPORT_MARKETS)) {
      for (const mode of EXPORT_MARKETS[market].modes) {
        const kgMax = Math.min(50_000, Math.floor((CAPITAL[level] * 0.9) / sp.refPrice));
        for (const kg of [100, 200, 500, 1000, 3000, 5000, 10000, 20000, 50000]) {
          if (kg > kgMax) continue;
          const buy = wholesaleQuote(sp.refPrice, 1, WHOLESALE_BASE_KG, 0, kg).unit;
          const discount = role === 'thuong_lai' ? 0.15 : 0;
          let net, minutes;
          if (after) {
            const q = exportBundleQuote([{ specialtyId: sp.id, grade: 'A', kg }], mode, market, sp.regionId, { refOf: () => sp.refPrice, discount, day: 20000 });
            if (!q.ok) continue; net = q.net; minutes = q.minutes;
          } else {
            const saved = EXPORT_MARKETS[market].priceMult; EXPORT_MARKETS[market].priceMult = OLD_MULT[market];
            const q = exportQuote(sp.id, 'A', kg, mode, market, sp.regionId, sp.refPrice, { discount });
            EXPORT_MARKETS[market].priceMult = saved;
            if (!q.ok) continue; net = q.net; minutes = q.minutes;
          }
          // phải đi mua gom (35 phút) rồi chờ lô về; lô sau gửi khi lô trước về (vốn quay vòng)
          const v = (net - buy * kg) / ((minutes + 35) / 60);
          if (v > best) { best = v; note = `${sp.name} ${kg / 1000} t → ${EXPORT_MARKETS[market].name}`; }
        }
      }
    }
  }
  return { income: best, note };
}
/** Đơn hàng nội địa trong ngày, quy về mỗi giờ chơi (hàng tự trồng hoặc mua sỉ). */
function orders(level, after, role) {
  const ref = SAMPLE[1].refPrice;
  if (!after) { const kg = 20 + 10 + 10 + 16; return { income: (kg * ref * (ORDER_PREMIUM - 0.9)) / PLAY_H_PER_DAY, note: `${kg} kg/ngày` }; }
  const s = orderScale(level);
  let kg = (20 + 20 + 16) * s, value = kg * ref * (ORDER_PREMIUM_V2 - 0.9) + 3 * orderBonus(level);
  if (role === 'xuong') { const pkg = 40 * s; value += pkg * ref * 3.8 * (ORDER_PREMIUM_V2 - 1) + orderBonus(level); kg += pkg; }
  if (role === 'thuong_lai') { const big = 300 * s; value += big * ref * (ORDER_PREMIUM_V2 - 1.0) + orderBonus(level); kg += big; }
  return { income: value / PLAY_H_PER_DAY, note: `${Math.round(kg)} kg/ngày` };
}
/** Hợp đồng công ty xuất nhập khẩu: mua sỉ (hoặc tự trồng) giao kho công ty. Hai hợp đồng một ngày, giới hạn vốn. */
function contracts(level) {
  const ref = SAMPLE[1].refPrice, ratio = (CONTRACT_PRICE_FRESH[0] + CONTRACT_PRICE_FRESH[1]) / 2;
  const kg = Math.min(2 * 11_000, (CAPITAL[level] * 0.9) / ref);
  const buy = wholesaleQuote(ref, 1, WHOLESALE_BASE_KG, 0, kg / 2).unit;
  return { income: (kg * (ref * ratio - buy) - kg * 400 * 1.2) / PLAY_H_PER_DAY, note: `${Math.round(kg / 1000)} t/ngày` };
}
/** Cửa hàng/siêu thị riêng: mua được bao nhiêu theo vốn (một nửa vốn), bán hàng tự bày, lãi ~ 45% giá tham chiếu so với giá vốn sỉ. */
function shop(level) {
  if (level < 8) return { income: 0, note: '—' };
  let budget = CAPITAL[level] * 0.5, inc = 0;
  const ref = SAMPLE[1].refPrice, got = [];
  const opts = [['sieu_thi', 'Đà Nẵng'], ['cua_hang', 'Đà Nẵng'], ['cua_hang', 'Đồng Tháp']];
  for (const [kind, prov] of opts) {
    if (level < BUILDINGS[kind].minLevel) continue;
    const cost = buildingCost(kind, prov).total;
    let n = 0;
    while (budget >= cost && n < BUILDINGS[kind].max) { budget -= cost; n++; inc += shopKgPerHour(prov, level, kind) * 8 * ref * (1.4 - 0.95); }
    if (n) got.push(`${n} ${BUILDINGS[kind].name.toLowerCase()} ${prov}`);
  }
  return { income: inc, note: got.join(', ') || 'chưa đủ vốn' };
}

// ---------------------------------------------------------------- bảng
function table(after) {
  const rows = [];
  for (const level of LEVELS) {
    const o = (role) => orders(level, after, role).income;
    const ex = (role) => exporter(level, after, role).income;
    const ct = after ? contracts(level).income : 0;
    const sh = after ? shop(level).income : 0;
    const roles = {
      'Nông dân': Math.max(farmer(level, after, FIELDS).income, 0) + o('nong_dan') + Math.max(0, Math.max(ex('nong_dan'), ct) * 0.3),
      'Chủ xưởng': workshop(level, after).income + o('xuong') + Math.max(0, Math.max(ex('xuong'), ct, sh) * 0.3),
      // thương lái có vườn nhỏ 8 ô
      // lô xuất khẩu đi ngầm trong lúc xe vẫn chạy buôn: thương lái tận dụng được một nửa
      'Thương lái': trader(level).income + Math.max(0, Math.max(ex('thuong_lai'), ct) * 0.5) + sh * 0.8 + o('thuong_lai') + farmer(level, after, false, 8).income,
    };
    rows.push({ level, ...roles, detail: { farm: farmer(level, after), xuong: workshop(level, after), trader: trader(level), export: exporter(level, after, 'thuong_lai'), orders: orders(level, after, 'nong_dan'), contracts: after ? contracts(level) : null, shop: after ? shop(level) : null } });
  }
  return rows;
}
function print(title, rows) {
  console.log(`\n### ${title} (đồng mỗi giờ chơi)`);
  console.log('| Cấp | Nông dân | Chủ xưởng | Thương lái | Lệch lớn nhất | Xuất khẩu tốt nhất | Đơn nội địa |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const v = [r['Nông dân'], r['Chủ xưởng'], r['Thương lái']];
    console.log(`| ${r.level} | ${fmt(v[0])} | ${fmt(v[1])} | ${fmt(v[2])} | ×${(Math.max(...v) / Math.max(1, Math.min(...v))).toFixed(2)} | ${fmt(r.detail.export.income)} (${r.detail.export.note}) | ${fmt(r.detail.orders.income)} |`);
  }
}
const before = table(false), after = table(true);
print('Trước (luật cũ)', before);
print('Sau (luật hiện hành)', after);
if (process.argv.includes('--chi-tiet')) for (const r of after) console.log(r.level, JSON.stringify(r.detail));

// ---------------------------------------------------------------- hoàn vốn đầu tư đất theo vai (giờ chơi)
// Mỗi vai một khoản đầu tư đất: nhà nông mua khối ruộng, chủ xưởng dựng xưởng chi nhánh, thương lái mở cửa hàng/siêu thị.
// Thu thêm mỗi giờ chơi do khoản đầu tư đó mang lại; hoàn vốn = vốn / thu thêm.
function payback() {
  const rows = [];
  const ref = SAMPLE[1].refPrice;
  // cánh đồng: một khối 100 ô ở vùng của xoài mẫu
  const sp = SAMPLE[1], c = CROPS[sp.crop];
  if (farm) {
    const price = farm.fieldBlockPrice(sp.regionId);
    const kgH = (100 * c.yieldKg * farm.FIELD_YIELD_MULT * farm.FIELD_PACE) / c.growHours;
    const unit = sp.refPrice * FARM_GATE_RATIO * QUALITY_MULT.A - sp.refPrice * SEED_COST_RATIO;
    rows.push(['Nông dân', `1 khối ruộng (${REG(sp.regionId)})`, price, unit * kgH * 8]);
  }
  // xưởng chi nhánh: 4 chỗ máy thêm; thu mỗi chỗ = thu xưởng cấp 20 / số chỗ
  for (const prov of ['Đồng Tháp', 'Bắc Ninh']) {
    const w = workshop(20, true).income, perSlot = w / (8 * machineStats('may_say', 3).slots);
    rows.push(['Chủ xưởng', `Xưởng chi nhánh ở ${prov}`, buildingCost('xuong', prov).total, perSlot * 4 * machineStats('may_say', 3).slots]);
  }
  for (const [kind, prov, lvl] of [['cua_hang', 'Đà Nẵng', 10], ['cua_hang', 'Đồng Tháp', 10], ['sieu_thi', 'Đà Nẵng', 20], ['sieu_thi', 'TP. Hồ Chí Minh', 20]]) {
    const kgH = shopKgPerHour(prov, lvl, kind);
    rows.push(['Thương lái', `${BUILDINGS[kind].name} ở ${prov} (c${lvl})`, buildingCost(kind, prov).total, kgH * 8 * ref * (1.4 - 0.95)]);
  }
  console.log('\n### Hoàn vốn đầu tư đất theo vai');
  console.log('| Vai | Khoản đầu tư | Vốn | Thu thêm mỗi giờ chơi | Hoàn vốn (giờ chơi) |');
  console.log('|---|---|---|---|---|');
  for (const [role, what, cost, inc] of rows) console.log(`| ${role} | ${what} | ${fmt(cost)} | ${fmt(inc)} | ${(cost / inc).toFixed(1)} |`);
}
function REG(id) { return id; }
if (!process.argv.includes('--khong-hoan-von')) payback();
