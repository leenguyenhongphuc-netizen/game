import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { REGIONS } from '../../shared/catalog.ts';
import { LEVELS, TRUCK, haversineKm, roadKm, taxiFare, tripPlan } from '../../shared/rules.ts';
import { ITEMS } from '../../shared/items.ts';
import { SIGHTS } from '../../shared/sights.ts';
import {
  DEFAULT_VEHICLE, DRIVE_RULES, ENERGY_PRICE, LICENSES, PERSONAL_RIDES, TOLL_GROUP_MULT, VEHICLES, VEHICLE_RESALE, licenseCovers, personalLegFare, rangeKm,
  restStopItems, restsNeeded, tripPlanFor, truckOf,
} from '../../shared/vehicles.ts';
import { GOODS, GOODS_BY_ID, GOOD_CATEGORIES, RIDE_GOODS } from '../../shared/shop.ts';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test';
let db: Db, app: FastifyInstance;
before(async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  app = await buildApp({ db, timeScale: 1e9, lateGraceMs: 60_000, adminToken: 'test-admin-token-0123456789', rateLimit: false, staticDir: '/nonexistent', marketEventsAt: () => [], inSeason: () => false,
    paceFactor: () => 1, testerUsernames: ['thu_xe'], tripMinFactor: 0, marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }) });
});
after(async () => { await app.close(); await db.close(); });

type Res = { status: number; body: any; cookie?: string };
async function call(method: string, path: string, body?: unknown, cookie?: string): Promise<Res> {
  const r = await app.inject({ method: method as any, url: path, payload: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) } });
  const set = r.headers['set-cookie'], first = Array.isArray(set) ? set[0] : set;
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, cookie: first?.split(';')[0] };
}
async function signup(name: string, role: 'nong_dan' | 'xuong' | 'thuong_lai', regionId = 'dt_caibe', cash = 500_000_000): Promise<string> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await db.query('update users set role = $2, role_assigned_at = now() where username = $1', [name, role]);
  const o = await call('POST', '/api/onboard', { regionId }, r.cookie);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  await db.query('update users set cash = $2 where username = $1', [name, cash]);
  return r.cookie!;
}
const setLevel = (name: string, level: number) => db.query('update users set xp = $2 where username = $1', [name, LEVELS[level - 1].xp]);
const cashOf = async (name: string) => Number((await db.query('select cash from users where username = $1', [name])).rows[0].cash);
/** Vùng đất liền xa nhất tính từ một vùng (để có chuyến dài cần dừng nghỉ, cần sạc). */
const farFrom = (id: string) => Object.values(REGIONS).filter((r) => !r.island).sort((a, b) => haversineKm(REGIONS[id].lat, REGIONS[id].lng, b.lat, b.lng) - haversineKm(REGIONS[id].lat, REGIONS[id].lng, a.lat, a.lng))[0].id;

test('danh mục xe: tải trọng thực tế, bằng lái theo khối lượng toàn bộ, xe điện, phí đường theo nhóm', () => {
  const v = VEHICLES;
  assert.deepEqual([v.ba_gac.cargoKg, v.ban_tai.cargoKg, v[DEFAULT_VEHICLE].cargoKg, v.tai_1t9.cargoKg, v.tai_3t5.cargoKg, v.tai_8t.cargoKg, v.tai_15t.cargoKg, v.dau_keo.cargoKg],
    [300, 700, 990, 1_900, 3_500, 8_000, 15_000, 28_000]);
  assert.equal(TRUCK.cargoKg, 990, 'xe mặc định không còn là 500 kg');
  // Bằng lái xếp theo khối lượng toàn bộ theo thiết kế: tới 3.500 kg là B, tới 7.500 kg là C1, trên nữa là C, kéo rơ moóc là CE.
  for (const s of Object.values(v)) {
    if (s.group === 'dau_keo') assert.equal(s.license, 'CE');
    else if (s.group === 'ba_gac') assert.equal(s.license, 'B1');
    else assert.equal(s.license, s.gvwKg <= 3_500 ? 'B' : s.gvwKg <= 7_500 ? 'C1' : 'C', s.kind);
    assert.ok(s.price > 0 && s.tank > 0 && s.per100 > 0 && s.maxKmh <= 120);
  }
  assert.ok(licenseCovers(['C'], 'C1') && licenseCovers(['C'], 'B') && licenseCovers(['CE'], 'C') && !licenseCovers(['B'], 'C1') && !licenseCovers([], 'B') && !licenseCovers(['B'], 'A1'));
  // Xe điện: đắt hơn bản xăng dầu, tiền năng lượng mỗi 100 km rẻ hơn hẳn, tầm ngắn hơn.
  for (const [ev, ice] of [['ban_tai_dien', 'ban_tai'], ['tai_990_dien', 'tai_990'], ['tai_3t5_dien', 'tai_3t5']]) {
    const e = truckOf(v[ev]), f = truckOf(v[ice]);
    assert.equal(v[ev].power, 'dien');
    assert.ok(v[ev].price > v[ice].price);
    assert.ok(e.lPer100km * e.fuelPrice < 0.75 * f.lPer100km * f.fuelPrice, `${ev} phải rẻ tiền chạy hơn`);
    assert.ok(rangeKm(v[ev]) < rangeKm(v[ice]));
    assert.equal(e.unit, 'kWh');
    assert.ok(e.parkPrice < e.fuelPrice, 'sạc ở nhà rẻ hơn sạc nhanh');
  }
  assert.ok(v.tai_990_lanh.cold && v.tai_990_lanh.price > v.tai_990.price);
  assert.equal(truckOf(v.dau_keo).tollFee, Math.round((TRUCK.tollFee * TOLL_GROUP_MULT[5]) / 1000) * 1000);
  // Kế hoạch chuyến theo xe.
  const from = 'dt_caibe', to = farFrom('dt_caibe'), base = tripPlan(from, to), road = roadKm(base.km, base.needsBoat);
  const ice = tripPlanFor(v.tai_3t5, from, to), ev = tripPlanFor(v.tai_3t5_dien, from, to);
  assert.equal(ice.fuelNeededL, Math.round(((road * v.tai_3t5.per100) / 100) * 10) / 10);
  assert.deepEqual([ice.cargoKg, ice.unit, ice.chargersAtKm.length, ice.stationsAtKm.length > 0], [3_500, 'lít', 0, true]);
  assert.deepEqual([ev.unit, ev.stationsAtKm.length, ev.chargersAtKm.length > 0], ['kWh', 0, true]);
  assert.ok(ev.chargersAtKm.length <= base.stationsAtKm.length, 'trạm sạc thưa hơn trạm xăng');
  assert.ok(ice.restStops.length > 0 && ice.restStops.every((r) => /^Trạm dừng nghỉ Km \d+$/.test(r.name) && r.hasWc && r.hasCharger));
  assert.equal(ice.restsNeeded, restsNeeded(road));
  assert.ok(restsNeeded(DRIVE_RULES.continuousHours * DRIVE_RULES.avgKmh) === 0 && restsNeeded(DRIVE_RULES.continuousHours * DRIVE_RULES.avgKmh + 1) === 1);
  assert.ok(ev.restStops.every((r) => ev.chargersAtKm.includes(r.atKm)), 'trạm dừng nghỉ nào cũng có trụ sạc');
  assert.equal(tripPlanFor(v.ba_gac, from, to).tollFee, 0);
  assert.ok(tripPlanFor(v.ba_gac, from, to).seconds > base.seconds && ice.upkeepCost > 0);
  assert.ok(restStopItems('Đà Nẵng').includes('mi_quang') && restStopItems(null).every((id) => ITEMS[id]));
});

test('mua xe: ai cũng mua được nhưng phải có bằng lái, đủ cấp, đủ tiền; đổi xe, bán xe', async () => {
  const farmer = await signup('nha_vuon_xe', 'nong_dan');
  assert.equal((await call('GET', '/api/me', undefined, farmer)).body.user.vehicle, null);
  assert.deepEqual([(await call('POST', '/api/trips/start', { toRegionId: 'dt_caolanh' }, farmer)).body.error, (await call('POST', '/api/truck/refuel', { liters: 5 }, farmer)).body.error], ['chua_co_xe', 'chua_co_xe']);
  const noLic = await call('POST', '/api/vehicles/buy', { kind: 'ban_tai' }, farmer);
  assert.deepEqual([noLic.status, noLic.body.error], [409, 'thieu_bang_lai']);
  assert.equal((await call('POST', '/api/licenses/buy', { cls: 'Z' }, farmer)).status, 400);
  const lic = await call('POST', '/api/licenses/buy', { cls: 'B' }, farmer);
  assert.deepEqual([lic.status, lic.body.price, lic.body.licenses], [200, LICENSES.B.price, ['B']]);
  assert.equal((await call('POST', '/api/licenses/buy', { cls: 'B' }, farmer)).body.error, 'da_co');
  assert.equal((await call('POST', '/api/licenses/buy', { cls: 'C1' }, farmer)).body.error, 'chua_du_cap');
  const before = await cashOf('nha_vuon_xe');
  const buy = await call('POST', '/api/vehicles/buy', { kind: 'ban_tai' }, farmer);
  assert.deepEqual([buy.status, buy.body.active, buy.body.price], [200, true, VEHICLES.ban_tai.price]);
  assert.equal(await cashOf('nha_vuon_xe'), before - VEHICLES.ban_tai.price);
  const me = (await call('GET', '/api/me', undefined, farmer)).body.user;
  assert.deepEqual([me.vehicle.kind, me.vehicle.cargoKg, me.fuelL], ['ban_tai', 700, VEHICLES.ban_tai.tank / 2]);
  // Xe nặng cần cấp và bằng cao hơn.
  assert.equal((await call('POST', '/api/vehicles/buy', { kind: 'tai_3t5' }, farmer)).body.error, 'chua_du_cap');
  await setLevel('nha_vuon_xe', 3);
  assert.equal((await call('POST', '/api/vehicles/buy', { kind: 'tai_3t5' }, farmer)).body.error, 'thieu_bang_lai');
  assert.equal((await call('POST', '/api/licenses/buy', { cls: 'C1' }, farmer)).status, 200);
  const big = await call('POST', '/api/vehicles/buy', { kind: 'tai_3t5' }, farmer);
  assert.deepEqual([big.status, big.body.active], [200, false]);
  const list = (await call('GET', '/api/vehicles', undefined, farmer)).body;
  assert.deepEqual(list.owned.map((o: any) => [o.kind, o.active]), [['ban_tai', true], ['tai_3t5', false]]);
  assert.ok(list.catalog.find((c: any) => c.kind === 'dau_keo').why && list.catalog.find((c: any) => c.kind === 'tai_1t9').canBuy);
  assert.deepEqual(list.licenses.filter((l: any) => l.covered).map((l: any) => l.cls), ['B', 'C1']);
  // Đổi sang xe tải 3,5 tấn: nhiên liệu của từng xe được giữ riêng.
  const act = await call('POST', `/api/vehicles/${big.body.vehicleId}/activate`, {}, farmer);
  assert.deepEqual([act.status, act.body.cargoKg, act.body.energy], [200, 3_500, VEHICLES.tai_3t5.tank / 2]);
  assert.equal((await call('GET', '/api/me', undefined, farmer)).body.user.vehicle.kind, 'tai_3t5');
  // Bán xe đang không dùng: nhận lại một phần giá mua.
  const sell = await call('POST', `/api/vehicles/${buy.body.vehicleId}/sell`, {}, farmer);
  assert.deepEqual([sell.status, sell.body.refund], [200, Math.round(VEHICLES.ban_tai.price * VEHICLE_RESALE)]);
  assert.equal((await call('POST', '/api/vehicles/999999/sell', {}, farmer)).status, 404);
  assert.equal((await call('POST', '/api/vehicles/buy', { kind: 'xe_bay' }, farmer)).status, 400);
});

test('thương lái: được cấp xe tải nhẹ 990 kg và bằng B; sức chở thu mua theo xe đang dùng; không bán được chiếc cuối', async () => {
  const t = await signup('lai_buon_xe', 'thuong_lai');
  const list = (await call('GET', '/api/vehicles', undefined, t)).body;
  assert.deepEqual([list.owned.length, list.owned[0].kind, list.owned[0].active, list.owned[0].resaleValue], [1, DEFAULT_VEHICLE, true, 0]);
  assert.ok(list.licenses.find((l: any) => l.cls === 'B').owned);
  assert.equal((await call('GET', '/api/regions/dt_caibe/trade', undefined, t)).body.cargo.capacityKg, 990);
  assert.equal((await call('POST', `/api/vehicles/${list.owned[0].id}/sell`, {}, t)).body.error, 'xe_cuoi');
  await setLevel('lai_buon_xe', 5);
  assert.equal((await call('POST', '/api/licenses/buy', { cls: 'C' }, t)).status, 200);
  const b = await call('POST', '/api/vehicles/buy', { kind: 'tai_8t' }, t);
  assert.equal(b.status, 200);
  await call('POST', `/api/vehicles/${b.body.vehicleId}/activate`, {}, t);
  const trade = (await call('GET', '/api/regions/dt_caibe/trade', undefined, t)).body;
  assert.deepEqual([trade.cargo.capacityKg, trade.canBuy], [8_000, true]);
  const sp = trade.buy[0];
  const ok = await call('POST', '/api/wholesale/buy', { specialtyId: sp.specialtyId, kg: 1_200 }, t);
  assert.deepEqual([ok.status, ok.body.cargo.capacityKg, ok.body.cargo.usedKg], [200, 8_000, 1_200]);
  assert.equal((await call('POST', '/api/wholesale/buy', { specialtyId: sp.specialtyId, kg: 8_001 }, t)).status, 400);
  // Xe được cấp miễn phí bán không ra tiền (tránh đổi vai lấy xe rồi bán).
  const sold = await call('POST', `/api/vehicles/${list.owned[0].id}/sell`, {}, t);
  assert.deepEqual([sold.status, sold.body.refund], [200, 0]);
});

test('chuyến xe theo xe đang lái: phí đường theo nhóm, phí đăng kiểm, trạm dừng nghỉ, mệt vì không nghỉ, vai khác bán được ở nơi xe đỗ', async () => {
  const f = await signup('duong_dai', 'nong_dan');
  await setLevel('duong_dai', 3);
  await call('POST', '/api/licenses/buy', { cls: 'C1' }, f);
  const b = await call('POST', '/api/vehicles/buy', { kind: 'tai_3t5' }, f);
  assert.equal(b.status, 200);
  await db.query(`update users set fuel_l = $2, etc = 0, energy = 100, energy_at = now() where username = $1`, ['duong_dai', VEHICLES.tai_3t5.tank]);
  const to = farFrom('dt_caibe'), plan = tripPlanFor(VEHICLES.tai_3t5, 'dt_caibe', to), road = roadKm(plan.km, plan.needsBoat);
  assert.ok(plan.restsNeeded >= 1 && plan.restStops.length >= plan.restsNeeded, 'chuyến đủ dài để phải dừng nghỉ');
  const start = await call('POST', '/api/trips/start', { toRegionId: to }, f);
  assert.equal(start.status, 200, JSON.stringify(start.body));
  assert.deepEqual([start.body.truck.kind, start.body.truck.cargoKg, start.body.truck.tankL, start.body.plan.tollFee, start.body.plan.restStopsAtKm.length],
    ['tai_3t5', 3_500, VEHICLES.tai_3t5.tank, plan.tollFee, plan.restStops.length]);
  assert.equal(start.body.plan.tollFee, Math.round((TRUCK.tollFee * TOLL_GROUP_MULT[2]) / 1000) * 1000);
  // Đang chạy: xem trạm dừng và mua đồ ở quầy của trạm.
  const stops = (await call('GET', `/api/trips/${start.body.tripId}/reststops`, undefined, f)).body;
  assert.deepEqual([stops.stops.length, stops.restsNeeded], [plan.restStops.length, plan.restsNeeded]);
  const stop = stops.stops[0];
  const snack = await call('POST', '/api/shop/buy', { shopId: stop.shopId, itemId: 'banh_mi', qty: 1 }, f);
  assert.deepEqual([snack.status, snack.body.total], [200, ITEMS.banh_mi.price]);
  assert.equal((await call('POST', '/api/shop/buy', { shopId: `rest:${start.body.tripId}:7`, itemId: 'banh_mi' }, f)).status, 404);
  const energyBefore = (await call('GET', '/api/me', undefined, f)).body.user.energy;
  const cashBefore = await cashOf('duong_dai');
  // Tới nơi mà không dừng nghỉ lần nào: bị mệt, mất thêm thể lực; ghé một trạm ăn phở và đi vệ sinh thì hồi sức.
  const fin = await call('POST', `/api/trips/${start.body.tripId}/finish`, { refuelL: 0, rests: [{ atKm: stop.atKm, wc: true, items: [{ itemId: 'pho', qty: 1 }, { itemId: 'nuoc_suoi', qty: 2, use: false }, { itemId: 'khong_co', qty: 1 }] }, { atKm: 7 }] }, f);
  assert.equal(fin.status, 200, JSON.stringify(fin.body));
  const missed = plan.restsNeeded - 1;
  assert.deepEqual([fin.body.rests.needed, fin.body.rests.taken, fin.body.rests.missed, fin.body.rests.wc, fin.body.rests.cost], [plan.restsNeeded, 1, missed, 1, ITEMS.pho.price + 2 * ITEMS.nuoc_suoi.price]);
  assert.equal(!!fin.body.fatigue, missed > 0);
  assert.equal(fin.body.energy, Math.min(fin.body.energyMax, Math.max(0, energyBefore + ITEMS.pho.energy + DRIVE_RULES.wcEnergy - missed * DRIVE_RULES.missedRestEnergy)));
  assert.equal(fin.body.items.find((i: any) => i.itemId === 'nuoc_suoi').qty, 2);
  assert.deepEqual([fin.body.upkeepCost, fin.body.odoKm, fin.body.unit], [plan.upkeepCost, road, 'lít']);
  const used = (road * VEHICLES.tai_3t5.per100) / 100, rescue = Math.max(0, used - VEHICLES.tai_3t5.tank);
  const tollCash = Math.round(plan.tolls * plan.tollFee * (1 + TRUCK.etcCashSurcharge));
  assert.equal(fin.body.cash, cashBefore - Math.round(rescue * ENERGY_PRICE.dau * TRUCK.rescueMult) - tollCash - plan.upkeepCost - fin.body.rests.cost);
  assert.equal(await cashOf('duong_dai'), fin.body.cash);
  // Nhà vườn tự chở hàng tới vùng khác thì bán theo giá nơi xe đỗ chứ không phải bán tháo.
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) select id, 'xoai_hoa_loc', 'A', 50 from users where username = 'duong_dai'`);
  const sell = await call('POST', '/api/sell/npc', { specialtyId: 'xoai_hoa_loc', quality: 'A', kg: 10 }, f);
  assert.equal(sell.status, 200, JSON.stringify(sell.body));
  assert.ok(!sell.body.dump, 'không phải bán tháo');
  // Đang ở xa thì không nhận xe mới, không đổi xe.
  assert.equal((await call('POST', '/api/vehicles/buy', { kind: 'tai_990' }, f)).body.error, 'xe_o_xa');
});

test('xe điện: sạc nhanh dọc đường tính theo kWh, sạc ở nhà rẻ hơn', async () => {
  const e = await signup('xe_dien', 'thuong_lai');
  await setLevel('xe_dien', 2);
  const b = await call('POST', '/api/vehicles/buy', { kind: 'tai_990_dien' }, e);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  await call('POST', `/api/vehicles/${b.body.vehicleId}/activate`, {}, e);
  const spec = VEHICLES.tai_990_dien;
  // Sạc ở nhà: giá điện sinh hoạt.
  const home = await call('POST', '/api/truck/refuel', { liters: 10 }, e);
  assert.deepEqual([home.status, home.body.cost], [200, 10 * ENERGY_PRICE.dienNha]);
  await db.query(`update users set fuel_l = $2, etc = 100000000 where username = $1`, ['xe_dien', spec.tank]);
  const to = farFrom('dt_caibe'), plan = tripPlanFor(spec, 'dt_caibe', to), road = roadKm(plan.km, plan.needsBoat);
  const start = await call('POST', '/api/trips/start', { toRegionId: to }, e);
  assert.equal(start.status, 200, JSON.stringify(start.body));
  assert.deepEqual([start.body.plan.power, start.body.plan.unit, start.body.plan.stationsAtKm.length, start.body.plan.chargersAtKm.length > 0, start.body.truck.unit], ['dien', 'kWh', 0, true, 'kWh']);
  const need = (road * spec.per100) / 100;
  assert.ok(need > spec.tank, 'chuyến dài hơn tầm pin nên phải sạc dọc đường');
  const kwh = Math.ceil(need - spec.tank) + 5;
  const cashBefore = await cashOf('xe_dien');
  const fin = await call('POST', `/api/trips/${start.body.tripId}/finish`, { charges: [{ atKm: plan.chargersAtKm[0], kwh }], rests: plan.restStops.map((r) => ({ atKm: r.atKm })) }, e);
  assert.equal(fin.status, 200, JSON.stringify(fin.body));
  assert.deepEqual([fin.body.fuelCost, fin.body.rescueL, fin.body.unit, fin.body.fatigue], [kwh * ENERGY_PRICE.dienDC, 0, 'kWh', null]);
  assert.equal(fin.body.cash, cashBefore - kwh * ENERGY_PRICE.dienDC - plan.upkeepCost);
  assert.ok(Math.abs(fin.body.fuelL - (spec.tank + kwh - need)) < 0.11);
});

test('mua sắm: đồ vùng miền phải tới nơi mới mua, mặc và đổi đồ, xe riêng thay taxi khi đi tham quan', async () => {
  for (const g of GOODS) assert.ok(GOOD_CATEGORIES[g.category] && g.price > 0 && g.preview.hint, g.id);
  assert.deepEqual(RIDE_GOODS.sort(), Object.keys(PERSONAL_RIDES).sort());
  assert.deepEqual([personalLegFare('xe_dap', 10), personalLegFare('xe_dap', 30), personalLegFare(null, 5), personalLegFare('xe_may', 40)], [0, null, null, 20_000]);
  const u = await signup('mua_sam', 'nong_dan', 'dn_tienphuoc');
  const shop = (await call('GET', '/api/shopping', undefined, u)).body;
  assert.deepEqual(shop.where, ['Đà Nẵng']);
  const find = (id: string, list = shop.items) => list.find((i: any) => i.id === id);
  assert.deepEqual([find('ao_thun').canBuy, find('ao_dai_tim_hue').canBuy, find('ao_dai_tim_hue').available, find('xe_may').why], [true, false, false, `Cần bằng lái ${LICENSES.A1.name}`]);
  assert.ok((await call('GET', `/api/shopping?where=${encodeURIComponent('Huế')}`, undefined, u)).body.items.find((i: any) => i.id === 'non_bai_tho').available);
  assert.equal((await call('POST', '/api/shopping/buy', { itemId: 'non_bai_tho' }, u)).body.error, 'khac_tinh');
  assert.equal((await call('POST', '/api/shopping/buy', { itemId: 'vest' }, u)).body.error, 'chua_du_cap');
  const a = await call('POST', '/api/shopping/buy', { itemId: 'ao_thun' }, u);
  assert.deepEqual([a.status, a.body.price, a.body.equipped], [200, GOODS_BY_ID.ao_thun.price, { ao: 'ao_thun' }]);
  assert.equal((await call('POST', '/api/shopping/buy', { itemId: 'ao_thun' }, u)).body.error, 'da_co');
  await call('POST', '/api/shopping/buy', { itemId: 'ao_so_mi' }, u);
  assert.deepEqual((await call('POST', '/api/shopping/equip', { slot: 'ao', itemId: 'ao_so_mi' }, u)).body.equipped, { ao: 'ao_so_mi' });
  assert.equal((await call('POST', '/api/shopping/equip', { slot: 'non', itemId: 'ao_so_mi' }, u)).status, 400);
  assert.equal((await call('POST', '/api/shopping/equip', { slot: 'ao', itemId: 'vest' }, u)).body.error, 'chua_co');
  assert.deepEqual((await call('POST', '/api/shopping/equip', { slot: 'ao', itemId: null }, u)).body.equipped, {});
  // Xe máy cần bằng A1; có xe thì chặng taxi tới địa danh chỉ còn tiền xăng.
  const hoiAn = SIGHTS.find((s) => s.id === 'dn_hoi_an')!;
  const taxi = (await call('GET', '/api/sights', undefined, u)).body.sights.find((s: any) => s.id === 'dn_hoi_an');
  assert.equal(taxi.route.ride, null);
  assert.equal(taxi.taxiFare, taxiFare(taxi.km));
  assert.equal((await call('POST', '/api/shopping/buy', { itemId: 'xe_may' }, u)).body.error, 'thieu_bang_lai');
  await call('POST', '/api/licenses/buy', { cls: 'A1' }, u);
  const bike = await call('POST', '/api/shopping/buy', { itemId: 'xe_may' }, u);
  assert.deepEqual([bike.status, bike.body.equipped.xe], [200, 'xe_may']);
  const own = (await call('GET', '/api/sights', undefined, u)).body.sights.find((s: any) => s.id === 'dn_hoi_an');
  assert.deepEqual([own.route.ride, own.taxiFare, own.route.legs[0].own], ['xe_may', personalLegFare('xe_may', own.km), 'xe_may']);
  assert.ok(own.taxiFare < taxi.taxiFare);
  await db.query(`update users set energy = 100, energy_at = now() where username = 'mua_sam'`);
  const before = await cashOf('mua_sam');
  const visit = await call('POST', `/api/sights/${hoiAn.id}/visit`, {}, u);
  assert.equal(visit.status, 200, JSON.stringify(visit.body));
  assert.equal(await cashOf('mua_sam'), before - own.taxiFare - hoiAn.entryFee);
  assert.deepEqual((await call('GET', '/api/me', undefined, u)).body.user.equipped, { xe: 'xe_may' });
});

test('tài khoản thử: nhận ngay một loại xe kèm bằng lái', async () => {
  const t = await signup('thu_xe', 'nong_dan');
  const r = await call('POST', '/api/test/vehicle', { kind: 'dau_keo' }, t);
  assert.deepEqual([r.status, r.body.kind, r.body.energy], [200, 'dau_keo', VEHICLES.dau_keo.tank]);
  const truck = await call('POST', '/api/test/truck', {}, t);
  assert.deepEqual([truck.status, truck.body.fuelL], [200, VEHICLES.dau_keo.tank]);
  assert.equal((await call('GET', '/api/me', undefined, t)).body.user.vehicle.cargoKg, 28_000);
  const other = await signup('khong_thu', 'nong_dan');
  assert.equal((await call('POST', '/api/test/vehicle', { kind: 'dau_keo' }, other)).status, 403);
});
