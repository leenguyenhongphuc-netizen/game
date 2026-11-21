import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { PROVINCES, REGIONS, SPECIALTIES, CROPS, processOf } from '../../shared/catalog.ts';
import { LAND_PRICE, START_CASH, nearestRegion, npcPrice, qualityFromLate, seedCost, snapCell, stepCount } from '../../shared/rules.ts';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test';
const ADMIN = 'test-admin-token-0123456789';
let db: Db, app: FastifyInstance;

before(async () => {
  const pg = (await import('pg')).default;
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  // TIME_SCALE rất lớn để mỗi bước chỉ chờ 1 giây (mức tối thiểu).
  app = await buildApp({ db, timeScale: 1e9, lateGraceMs: 60_000, adminToken: ADMIN, rateLimit: false, staticDir: '/nonexistent' });
});
after(async () => { await app.close(); await db.close(); });

type Res = { status: number; body: any; cookie?: string };
async function call(method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}): Promise<Res> {
  const r = await app.inject({
    method: method as any, url: path,
    payload: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers },
  });
  const set = r.headers['set-cookie'];
  const first = Array.isArray(set) ? set[0] : set;
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, cookie: first?.split(';')[0] };
}
async function signup(name: string): Promise<string> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookie!;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('danh mục phủ đủ 34 tỉnh thành và dữ liệu nhất quán', () => {
  assert.equal(PROVINCES.length, 34);
  const covered = new Set(Object.values(REGIONS).map((r) => r.province));
  for (const p of PROVINCES) assert.ok(covered.has(p), `thiếu vùng trồng cho ${p}`);
  for (const r of Object.values(REGIONS)) {
    assert.ok((PROVINCES as readonly string[]).includes(r.province), `tỉnh lạ: ${r.province}`);
    assert.ok(Object.values(SPECIALTIES).some((s) => s.regionId === r.id), `vùng ${r.id} không có đặc sản`);
  }
  for (const s of Object.values(SPECIALTIES)) {
    assert.ok(processOf(CROPS[s.crop]).length >= 3);
    assert.ok(seedCost(s) > 0);
  }
  for (const r of Object.values(REGIONS)) {
    const cheapest = Math.min(...Object.values(SPECIALTIES).filter((s) => s.regionId === r.id).map(seedCost));
    assert.ok(cheapest * 2 <= START_CASH, `vốn khởi đầu không đủ trồng 2 ô ở ${r.id}`);
  }
  assert.deepEqual([0, 1, 2, 3].map(qualityFromLate), ['A', 'B', 'B', 'C']);
});

test('định vị: làm tròn về ô lưới và chọn vùng gần nhất', () => {
  assert.deepEqual(snapCell(15.38127, 109.11794), { lat: 15.38, lng: 109.12 });
  assert.equal(nearestRegion(15.38, 109.12).region.id, 'qng_lyson');
  assert.equal(nearestRegion(10.78, 106.7).region.id, 'hcm_laithieu');
  assert.equal(nearestRegion(21.03, 105.85).region.id, 'hn_phudien');
});

test('tài khoản: đăng ký, trùng tên, sai mật khẩu, đăng xuất', async () => {
  const cookie = await signup('nong_dan_1');
  assert.equal((await call('POST', '/api/auth/register', { username: 'nong_dan_1', password: 'matkhau123' })).status, 409);
  assert.equal((await call('POST', '/api/auth/register', { username: 'quai-thiet-chu', password: 'matkhau123' })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { username: 'hop_le', password: '123456' })).status, 400);
  assert.equal((await call('POST', '/api/auth/login', { username: 'nong_dan_1', password: 'sai_mat_khau' })).status, 401);
  const login = await call('POST', '/api/auth/login', { username: 'nong_dan_1', password: 'matkhau123' });
  assert.equal(login.status, 200);
  const me = await call('GET', '/api/me', undefined, login.cookie);
  assert.equal(me.body.user.cash, START_CASH);
  assert.equal((await call('GET', '/api/me')).status, 401);
  await call('POST', '/api/auth/logout', {}, cookie);
  assert.equal((await call('GET', '/api/me', undefined, cookie)).status, 401);
});

test('trọn vòng: nhận đất theo GPS, trồng đủ quy trình, thu hoạch, bán thương lái', async () => {
  const cookie = await signup('ly_son');
  assert.equal((await call('POST', '/api/onboard', { lat: 48.85, lng: 2.35 }, cookie)).status, 422);
  const ob = await call('POST', '/api/onboard', { lat: 15.38127, lng: 109.11794 }, cookie);
  assert.equal(ob.body.regionId, 'qng_lyson');
  assert.equal((await call('POST', '/api/onboard', { regionId: 'ld_dalat' }, cookie)).status, 409);
  const stored = await db.query('select cell_lat, cell_lng from plots where id = $1', [ob.body.plotId]);
  assert.deepEqual(stored.rows[0], { cell_lat: 15.38, cell_lng: 109.12 }, 'chỉ lưu tâm ô lưới, không lưu toạ độ gốc');

  const plotId = ob.body.plotId;
  assert.equal((await call('POST', `/api/plots/${plotId}/plant`, { tile: 0, specialtyId: 'thanh_long_binh_thuan' }, cookie)).status, 409);
  const sp = SPECIALTIES.toi_ly_son;
  const plant = await call('POST', `/api/plots/${plotId}/plant`, { tile: 0, specialtyId: sp.id }, cookie);
  assert.equal(plant.status, 200, JSON.stringify(plant.body));
  assert.equal((await call('POST', `/api/plots/${plotId}/plant`, { tile: 0, specialtyId: sp.id }, cookie)).status, 409);
  assert.equal((await call('POST', `/api/plantings/${plant.body.plantingId}/step`, {}, cookie)).status, 409, 'chưa đến giờ');

  let harvested: any;
  for (let i = 1; i < stepCount(sp); i++) {
    await sleep(1050);
    const r = await call('POST', `/api/plantings/${plant.body.plantingId}/step`, {}, cookie);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    harvested = r.body.harvested;
  }
  assert.deepEqual(harvested, { specialtyId: sp.id, quality: 'A', kg: CROPS.toi.yieldKg });

  const sell = await call('POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 10 }, cookie);
  assert.equal(sell.body.unitPrice, npcPrice(sp.refPrice, 'A', sp.regionId, 'qng_lyson'));
  assert.equal((await call('POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 999 }, cookie)).status, 409);
  const me = await call('GET', '/api/me', undefined, cookie);
  assert.equal(me.body.user.cash, START_CASH - seedCost(sp) + sell.body.total);
  assert.deepEqual(me.body.inventory, [{ specialtyId: sp.id, quality: 'A', kg: CROPS.toi.yieldKg - 10 }]);
  const ledger = await db.query('select coalesce(sum(delta),0)::bigint as s from ledger where user_id = $1', [me.body.user.id]);
  assert.equal(ledger.rows[0].s, me.body.user.cash, 'sổ cái khớp số dư');
});

test('chợ: rao bán, khung giá, mua, huỷ; người khác không đụng được cây của mình', async () => {
  const seller = await signup('nguoi_ban');
  const buyer = await signup('nguoi_mua');
  await call('POST', '/api/onboard', { regionId: 'qng_lyson' }, seller);
  await call('POST', '/api/onboard', { regionId: 'hn_phudien' }, buyer);
  const sellerMe = (await call('GET', '/api/me', undefined, seller)).body;
  const buyerMe = (await call('GET', '/api/me', undefined, buyer)).body;
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'toi_ly_son','A',20)`, [sellerMe.user.id]);

  const plant = await call('POST', `/api/plots/${sellerMe.plots[0].id}/plant`, { tile: 3, specialtyId: 'hanh_ly_son' }, seller);
  await sleep(1050);
  assert.equal((await call('POST', `/api/plantings/${plant.body.plantingId}/step`, {}, buyer)).status, 404);
  assert.equal((await call('POST', `/api/plots/${sellerMe.plots[0].id}/plant`, { tile: 4, specialtyId: 'hanh_ly_son' }, buyer)).status, 404);
  const visit = await call('GET', `/api/plots/${sellerMe.plots[0].id}`, undefined, buyer);
  assert.equal(visit.body.plot.mine, false);
  assert.equal(visit.body.plantings.length, 1);

  const ref = SPECIALTIES.toi_ly_son.refPrice;
  assert.equal((await call('POST', '/api/market/listings', { specialtyId: 'toi_ly_son', quality: 'A', kg: 5, price: ref * 10 }, seller)).status, 409);
  assert.equal((await call('POST', '/api/market/listings', { specialtyId: 'toi_ly_son', quality: 'A', kg: 50, price: ref }, seller)).status, 409);
  const l1 = await call('POST', '/api/market/listings', { specialtyId: 'toi_ly_son', quality: 'A', kg: 2, price: ref }, seller);
  const l2 = await call('POST', '/api/market/listings', { specialtyId: 'toi_ly_son', quality: 'A', kg: 3, price: ref }, seller);
  assert.equal((await call('GET', '/api/market?specialtyId=toi_ly_son', undefined, buyer)).body.listings.length, 2);
  assert.equal((await call('GET', '/api/market', undefined, seller)).body.listings.length, 0, 'chợ không hiện tin của chính mình');
  assert.equal((await call('GET', '/api/market?mine=1', undefined, seller)).body.listings.length, 2);
  assert.equal((await call('POST', `/api/market/listings/${l1.body.listingId}/buy`, { kg: 1 }, seller)).status, 409, 'không tự mua');
  assert.equal((await call('POST', `/api/market/listings/${l1.body.listingId}/buy`, { kg: 3 }, buyer)).status, 409, 'quá số lượng');
  assert.equal((await call('POST', `/api/market/listings/${l1.body.listingId}/buy`, { kg: 2 }, buyer)).status, 200);
  assert.equal((await call('DELETE', `/api/market/listings/${l2.body.listingId}`, undefined, buyer)).status, 404);
  assert.equal((await call('DELETE', `/api/market/listings/${l2.body.listingId}`, undefined, seller)).status, 200);

  const s2 = (await call('GET', '/api/me', undefined, seller)).body;
  const b2 = (await call('GET', '/api/me', undefined, buyer)).body;
  assert.equal(b2.user.cash, buyerMe.user.cash - 2 * ref);
  assert.deepEqual(b2.inventory, [{ specialtyId: 'toi_ly_son', quality: 'A', kg: 2 }]);
  assert.equal(s2.inventory.find((i: any) => i.specialtyId === 'toi_ly_son').kg, 18);
  // Hàng phương xa: người mua ở Hà Nội bán tỏi Lý Sơn cho thương lái được giá cao hơn giá tại vườn.
  const far = await call('POST', '/api/sell/npc', { specialtyId: 'toi_ly_son', quality: 'A', kg: 1 }, buyer);
  const local = await call('POST', '/api/sell/npc', { specialtyId: 'toi_ly_son', quality: 'A', kg: 1 }, seller);
  assert.ok(far.body.unitPrice > ref && local.body.unitPrice < ref);
});

test('mua đất vùng khác cần đủ tiền và mỗi vùng một lô', async () => {
  const cookie = await signup('dai_gia');
  await call('POST', '/api/onboard', { regionId: 'ld_dalat' }, cookie);
  assert.equal((await call('POST', '/api/plots/buy', { regionId: 'qng_lyson' }, cookie)).status, 409);
  const me = (await call('GET', '/api/me', undefined, cookie)).body;
  await db.query('update users set cash = $2 where id = $1', [me.user.id, LAND_PRICE + 1000]);
  assert.equal((await call('POST', '/api/plots/buy', { regionId: 'qng_lyson' }, cookie)).status, 200);
  const after = (await call('GET', '/api/me', undefined, cookie)).body;
  assert.equal(after.user.cash, 1000);
  assert.equal(after.plots.length, 2);
  await db.query('update users set cash = $2 where id = $1', [me.user.id, LAND_PRICE]);
  assert.equal((await call('POST', '/api/plots/buy', { regionId: 'ld_dalat' }, cookie)).status, 409, 'đã có đất ở vùng nhà');
  const farms = await call('GET', '/api/regions/qng_lyson/farms', undefined, cookie);
  assert.ok(farms.body.total >= 1);
});

test('bảng giá: nạp giá cần mã quản trị, giá mới thay giá tham chiếu', async () => {
  const tick = { ticks: [{ specialtyId: 'toi_ly_son', price: 120000, source: 'kiem-thu' }] };
  assert.equal((await call('POST', '/api/admin/prices', tick)).status, 401);
  assert.equal((await call('POST', '/api/admin/prices', tick, undefined, { authorization: 'Bearer sai' })).status, 401);
  assert.equal((await call('POST', '/api/admin/prices', { ticks: [{ specialtyId: 'toi_ly_son', price: 120000 }] }, undefined, { authorization: `Bearer ${ADMIN}` })).status, 400, 'thiếu nguồn');
  assert.equal((await call('POST', '/api/admin/prices', tick, undefined, { authorization: `Bearer ${ADMIN}` })).status, 200);
  const prices = (await call('GET', '/api/prices')).body.prices;
  assert.equal(prices.toi_ly_son.price, 120000);
  assert.equal(prices.toi_ly_son.prev, SPECIALTIES.toi_ly_son.refPrice);
  assert.equal(prices.toi_ly_son.source, 'kiem-thu');
  assert.equal(Object.keys(prices).length, Object.keys(SPECIALTIES).length);
  const hist = (await call('GET', '/api/prices/toi_ly_son/history')).body.history;
  assert.equal(hist.length, 2);
});
