// Xe máy, mô tô: danh mục, bằng A1/A có thi sa hình, đi phượt (thuê xe hoặc xe của mình), xăng, tem điểm dừng.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { LICENSES, MOTO_KINDS, VEHICLES, isMoto, licenseCovers, needsYard, tripPlanFor } from '../../shared/vehicles.ts';
import { MOTO_RENTALS, PHUOT_BY_ID, PHUOT_ROUTES, PHUOT_RULES, phuotFuel } from '../../shared/moto.ts';
import { fuelPriceNow } from '../../shared/realPrices.ts';

const url = process.env.TEST_MOTO_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test_moto';
let db: Db, app: FastifyInstance;
before(async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  app = await buildApp({ db, timeScale: 1e9, examHurry: 1e9, lateGraceMs: 60_000, adminToken: 'test-admin-token-0123456789', rateLimit: false, staticDir: '/nonexistent', marketEventsAt: () => [], inSeason: () => false,
    paceFactor: () => 1, testerUsernames: [], tripMinFactor: 0, marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }) });
});
after(async () => { await app.close(); await db.close(); });

type Res = { status: number; body: any; cookie?: string };
async function call(method: string, path: string, body?: unknown, cookie?: string): Promise<Res> {
  const r = await app.inject({ method: method as any, url: path, payload: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) } });
  const set = r.headers['set-cookie'], first = Array.isArray(set) ? set[0] : set;
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, cookie: first?.split(';')[0] };
}
async function signup(name: string, role: 'nong_dan' | 'xuong' | 'thuong_lai' = 'nong_dan', cash = 500_000_000): Promise<string> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await db.query('update users set role = $2, role_assigned_at = now(), xp = 100000 where username = $1', [name, role]);
  assert.equal((await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, r.cookie)).status, 200);
  await db.query('update users set cash = $2 where username = $1', [name, cash]);
  return r.cookie!;
}
async function getLicense(cookie: string, cls: string) {
  for (const part of ['ly_thuyet', 'sa_hinh']) {
    const st = await call('POST', '/api/licenses/exam/start', { cls, part }, cookie);
    assert.equal(st.status, 200, `${cls} ${part}: ${JSON.stringify(st.body)}`);
    assert.equal((await call('POST', '/api/licenses/exam', { cls, part, score: 92, examId: st.body.examId }, cookie)).status, 200);
  }
  const b = await call('POST', '/api/licenses/buy', { cls }, cookie);
  assert.equal(b.status, 200, JSON.stringify(b.body));
}

test('danh mục xe máy: hạng bằng theo dung tích, không vào cao tốc, chở ít, tiêu hao thực tế', () => {
  assert.ok(MOTO_KINDS.length >= 5);
  for (const k of MOTO_KINDS) {
    const v = VEHICLES[k];
    assert.ok(isMoto(k) && v.group === 'xe_may' && v.noHighway, k);
    assert.equal(v.license, (v.cc ?? 0) > 125 || (v.kw ?? 0) > 11 ? 'A' : 'A1', `${k}: trên 125 cm³ hoặc 11 kW là hạng A`);
    assert.ok(v.cargoKg >= 30 && v.cargoKg <= 100, `${k} chở ít`);
    assert.ok(v.maxKmh <= 70, 'mô tô ngoài khu dân cư tối đa 70 km/h');
    assert.ok(v.power === 'dien' ? v.per100 < 3 : v.per100 >= 1.5 && v.per100 <= 6);
  }
  assert.ok(licenseCovers(['A'], 'A1') && !licenseCovers(['A1'], 'A') && !licenseCovers(['B'], 'A1') && !licenseCovers(['C'], 'A'));
  assert.ok(needsYard('A1') && needsYard('A') && !needsYard('B1'), 'A1, A thi sa hình xe máy; ba gác chỉ lý thuyết');
  assert.equal(LICENSES.A.includes[0], 'A1');
  // chuyến buôn bằng xe máy: không phí cao tốc, chậm hơn xe tải
  const moto = tripPlanFor(VEHICLES.moto_so110, 'dt_caibe', 'ld_dalat'), truck = tripPlanFor(VEHICLES.tai_990, 'dt_caibe', 'ld_dalat');
  assert.equal(moto.tollFee, 0);
  assert.ok(moto.seconds > truck.seconds && moto.cargoKg === 60);
  // xăng cho tuyến phượt theo giá xăng thật
  const f = phuotFuel(VEHICLES.moto_so110, 100);
  assert.equal(f.need, 1.7); assert.equal(f.price, fuelPriceNow('ron95'));
  for (const r of PHUOT_ROUTES) for (const c of r.checkpoints) assert.ok(c.atKm > 0 && c.atKm < r.km, `${r.id}/${c.id}`);
});

test('bằng A1/A: phải đạt sa hình xe máy; xe trên 125 cm³ cần hạng A', async () => {
  const u = await signup('xe_may_bang');
  const st = await call('POST', '/api/licenses/exam/start', { cls: 'A1', part: 'sa_hinh' }, u);
  assert.equal(st.body.error, 'chua_thi_ly_thuyet', 'phải đạt lý thuyết trước');
  const th = await call('POST', '/api/licenses/exam/start', { cls: 'A1', part: 'ly_thuyet' }, u);
  await call('POST', '/api/licenses/exam', { cls: 'A1', part: 'ly_thuyet', score: 100, examId: th.body.examId }, u);
  assert.equal((await call('POST', '/api/licenses/buy', { cls: 'A1' }, u)).body.error, 'chua_thi_sa_hinh', 'thiếu sa hình thì chưa cấp bằng');
  const yd = await call('POST', '/api/licenses/exam/start', { cls: 'A1', part: 'sa_hinh' }, u);
  assert.equal(yd.status, 200);
  await call('POST', '/api/licenses/exam', { cls: 'A1', part: 'sa_hinh', score: 85, examId: yd.body.examId }, u);
  assert.equal((await call('POST', '/api/licenses/buy', { cls: 'A1' }, u)).status, 200);
  assert.equal((await call('POST', '/api/vehicles/buy', { kind: 'moto_con155' }, u)).body.error, 'thieu_bang_lai', 'côn tay 155 cần hạng A');
  assert.equal((await call('POST', '/api/vehicles/buy', { kind: 'moto_so110' }, u)).status, 200);
  await getLicense(u, 'A');
  assert.equal((await call('POST', '/api/vehicles/buy', { kind: 'moto_con155' }, u)).status, 200);
  const g = await call('GET', '/api/vehicles', undefined, u);
  assert.ok(g.body.catalog.some((c: any) => c.kind === 'moto_adv300' && c.group === 'xe_may'));
  assert.ok(g.body.licenses.find((l: any) => l.cls === 'A').owned);
});

test('đi phượt: thuê xe cần bằng, đủ thể lực; tính xăng, quán nghỉ, tem chụp ảnh, thưởng lần đầu', async () => {
  const u = await signup('phuot_thue');
  const route = PHUOT_BY_ID.hai_van;
  assert.equal((await call('POST', '/api/phuot/start', { routeId: route.id, rent: 'moto_so110' }, u)).body.error, 'thieu_bang_lai', 'thuê xe vẫn phải có bằng');
  await getLicense(u, 'A1');
  assert.equal((await call('POST', '/api/phuot/start', { routeId: route.id, rent: 'moto_con155' }, u)).body.error, 'thieu_bang_lai', 'côn tay cần hạng A');
  await db.query(`update users set energy = 100, energy_at = now() where username = 'phuot_thue'`);
  const cash0 = Number((await db.query(`select cash from users where username = 'phuot_thue'`)).rows[0].cash);
  const s = await call('POST', '/api/phuot/start', { routeId: route.id, rent: 'moto_so110' }, u);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const rent = MOTO_RENTALS.find((r) => r.kind === 'moto_so110')!.perDay;
  assert.equal(s.body.cash, cash0 - rent);
  assert.equal(s.body.fuel, VEHICLES.moto_so110.tank, 'xe thuê đổ đầy bình');
  const list = await call('GET', '/api/phuot', undefined, u);
  assert.equal(list.body.open.tripId, s.body.tripId);
  const photos = route.checkpoints.filter((c) => c.kind === 'photo').map((c) => c.id), cafe = route.checkpoints.find((c) => c.kind === 'cafe')!.id;
  const f = await call('POST', `/api/phuot/${s.body.tripId}/finish`, { photos: [...photos, 'khong_co'], cafes: [cafe], refuels: [{ at: 'khong_phai_cay_xang', amount: 3 }] }, u);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.deepEqual(f.body.freshStamps.sort(), photos.sort(), 'chỉ nhận tem các điểm có thật');
  assert.equal(f.body.refuel, 0, 'không đổ xăng ở chỗ không có cây xăng');
  assert.equal(f.body.fuelUsed, phuotFuel(VEHICLES.moto_so110, route.km).need);
  assert.ok(f.body.firstFinish && f.body.reward === PHUOT_RULES.firstFinishReward);
  assert.equal(f.body.cafeCost, PHUOT_RULES.cafeCost);
  assert.ok(f.body.xpGained > 0);
  // đi lần hai: tem đã có, không thưởng lần đầu
  const s2 = await call('POST', '/api/phuot/start', { routeId: route.id, rent: 'moto_so110' }, u);
  const f2 = await call('POST', `/api/phuot/${s2.body.tripId}/finish`, { photos }, u);
  assert.deepEqual([f2.body.freshStamps.length, f2.body.firstFinish, f2.body.reward], [0, false, 0]);
  const done = (await call('GET', '/api/phuot', undefined, u)).body.routes.find((r: any) => r.id === route.id);
  assert.equal(done.done.times, 2); assert.equal(done.stamps.length, photos.length);
});

test('xe của mình đi phượt: hết xăng giữa đường phải trả tiền cứu hộ, đổ ở cây xăng thì không', async () => {
  const u = await signup('phuot_xe_nha');
  await getLicense(u, 'A1');
  const v = await call('POST', '/api/vehicles/buy', { kind: 'moto_so110' }, u);
  assert.equal(v.status, 200);
  await db.query('update vehicles set energy = 1 where id = $1', [v.body.vehicleId]);
  await db.query(`update users set fuel_l = 1, energy = 100, energy_at = now() where username = 'phuot_xe_nha'`);
  const route = PHUOT_BY_ID.ha_giang;
  const s = await call('POST', '/api/phuot/start', { routeId: route.id, vehicleId: v.body.vehicleId }, u);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.fuel, 1);
  const dry = await call('POST', `/api/phuot/${s.body.tripId}/finish`, {}, u);
  assert.ok(dry.body.rescue > 0 && dry.body.fuelLeft === 0, 'không đổ xăng thì hết giữa đèo');
  const odo = Number((await db.query('select odo_km from vehicles where id = $1', [v.body.vehicleId])).rows[0].odo_km);
  assert.equal(odo, route.km);
  // lần này đổ đầy ở cây xăng Yên Minh
  await db.query('update vehicles set energy = 1 where id = $1', [v.body.vehicleId]); await db.query(`update users set fuel_l = 1 where username = 'phuot_xe_nha'`);
  const s2 = await call('POST', '/api/phuot/start', { routeId: route.id, vehicleId: v.body.vehicleId }, u);
  const fuelStop = route.checkpoints.find((c) => c.kind === 'fuel')!.id;
  const ok = await call('POST', `/api/phuot/${s2.body.tripId}/finish`, { refuels: [{ at: fuelStop, amount: 3.7 }] }, u);
  assert.equal(ok.body.rescue, 0, JSON.stringify(ok.body));
  assert.equal(ok.body.fuelCost, Math.round((3.7 * fuelPriceNow('ron95')) / 1000) * 1000);
  // bỏ dở giữa đường: chỉ tính quãng đã đi, không có thưởng trọn tuyến
  const s3 = await call('POST', '/api/phuot/start', { routeId: route.id, vehicleId: v.body.vehicleId }, u);
  const ab = await call('POST', `/api/phuot/${s3.body.tripId}/finish`, { aborted: true, km: 50, photos: ['ma_pi_leng', 'cong_troi_quan_ba'] }, u);
  assert.deepEqual([ab.body.kmDone, ab.body.firstFinish], [50, false]);
  assert.deepEqual(ab.body.photos, ['cong_troi_quan_ba'], 'chưa tới Mã Pí Lèng thì không có tem');
});
