// Sổ địa chính: quỹ đất theo tỉnh, giá khác nhau, quyền theo vai, mua thửa, rao bán, chuyển nhượng có thuế phí,
// công trình dùng thửa đã có, cánh đồng trừ quỹ đất nông nghiệp; giá tham chiếu đời thực.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { PROVINCES } from '../../shared/catalog.ts';
import { LEVELS, TRUCK } from '../../shared/rules.ts';
import { BUILDINGS, CERT_FEE, PROVINCE_LAND, buildingCost, landPriceM2, lotPrice, releasedLots } from '../../shared/land.ts';
import { REF_PRICES, fuelPriceNow, householdPowerBill, registrationFee, transferTax } from '../../shared/realPrices.ts';
import { ENERGY_PRICE } from '../../shared/vehicles.ts';
import { fieldBlockPrice } from '../../shared/farm.ts';

const url = process.env.TEST_LAND_DATABASE_URL ?? process.env.TEST_ECON_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test_econ';
let db: Db, app: FastifyInstance;
before(async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  app = await buildApp({ db, timeScale: 1e9, lateGraceMs: 60_000, adminToken: 'test-admin-token-0123456789', rateLimit: false, staticDir: '/nonexistent', marketEventsAt: () => [], inSeason: () => false,
    paceFactor: () => 1, tripMinFactor: 0, marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }) } as any);
  await app.ready();
});
after(async () => { await app.close(); await db.close(); });

type Res = { status: number; body: any; cookie?: string };
async function call(method: string, path: string, body?: unknown, cookie?: string): Promise<Res> {
  const r = await app.inject({ method: method as any, url: path, payload: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) } });
  const set = r.headers['set-cookie'], first = Array.isArray(set) ? set[0] : set;
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, cookie: first?.split(';')[0] };
}
async function signup(name: string, role: 'nong_dan' | 'xuong' | 'thuong_lai', level = 20, regionId = 'dt_caibe', cash = 50_000_000_000): Promise<string> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await db.query('update users set role = $2, role_assigned_at = now() where username = $1', [name, role]);
  assert.equal((await call('POST', '/api/onboard', { regionId }, r.cookie)).status, 200);
  await db.query('update users set cash = $2, xp = $3 where username = $1', [name, cash, LEVELS[level - 1].xp]);
  return r.cookie!;
}
const cashOf = async (name: string) => Number((await db.query('select cash from users where username = $1', [name])).rows[0].cash);
const q = (p: string) => encodeURIComponent(p);

test('số liệu: đủ 34 tỉnh, giá khác nhau theo tỉnh, quỹ đất hữu hạn; giá thật dùng cho xăng, điện, phí đường', () => {
  assert.ok(PROVINCES.every((p) => PROVINCE_LAND[p] && releasedLots(p, 'thuong_mai') >= 10 && lotPrice(p, 'nong_nghiep') > 0));
  assert.ok(landPriceM2('Hà Nội', 'thuong_mai') > 5 * landPriceM2('Đồng Tháp', 'thuong_mai'), 'thủ đô đắt hơn tỉnh nông thôn nhiều lần');
  assert.ok(landPriceM2('Đà Nẵng', 'cong_nghiep') > landPriceM2('Lai Châu', 'cong_nghiep'));
  assert.ok(releasedLots('Đồng Tháp', 'nong_nghiep') > releasedLots('Đồng Tháp', 'cong_nghiep'), 'tỉnh nông nghiệp nhiều đất ruộng hơn đất KCN');
  assert.equal(TRUCK.fuelPrice, REF_PRICES.xang_e10_ron95.value);
  assert.equal(ENERGY_PRICE.dau, REF_PRICES.dau_do_005s.value);
  assert.equal(fuelPriceNow('dien_dc'), REF_PRICES.sac_cong_cong.value);
  assert.equal(householdPowerBill(100), Math.round(100 * 1_901 * 1.08));
  assert.equal(householdPowerBill(250), Math.round((100 * 1_901 + 100 * 2_289 + 50 * 2_894) * 1.08));
  assert.equal(registrationFee(4_000_000_000), 20_000_000);
  assert.equal(registrationFee(1e12), 500_000_000, 'trước bạ tối đa 500 triệu');
  assert.equal(transferTax(1_000_000_000), 20_000_000);
  assert.equal(fieldBlockPrice('dt_caibe'), lotPrice('Đồng Tháp', 'nong_nghiep'));
});

test('/api/ref-prices trả bảng giá thật kèm nguồn và ngày hiệu lực', async () => {
  const r = await call('GET', '/api/ref-prices');
  assert.equal(r.status, 200);
  const ron = r.body.prices.find((p: any) => p.key === 'xang_e10_ron95');
  assert.equal(ron.value, REF_PRICES.xang_e10_ron95.value);
  assert.ok(ron.source && ron.since);
});

test('xem quỹ đất, mua thửa theo vai, rao bán và sang tên có thuế phí', async () => {
  const tl = await signup('tl_dat', 'thuong_lai'), nd = await signup('nd_dat', 'nong_dan'), cx = await signup('cx_dat', 'xuong');
  const view = (await call('GET', `/api/land?province=${q('Đà Nẵng')}`, undefined, tl)).body;
  const tm = view.summary.find((r: any) => r.use === 'thuong_mai');
  assert.deepEqual([tm.released, tm.sold, tm.left], [releasedLots('Đà Nẵng', 'thuong_mai'), 0, releasedLots('Đà Nẵng', 'thuong_mai')]);
  assert.equal(tm.lotPrice, lotPrice('Đà Nẵng', 'thuong_mai'));
  assert.equal(tm.blocked, null);
  assert.match(view.summary.find((r: any) => r.use === 'cong_nghiep').blocked, /chủ xưởng/);
  // vai không hợp lệ
  assert.equal((await call('POST', '/api/land/buy', { province: 'Đà Nẵng', use: 'cong_nghiep' }, tl)).status, 403);
  assert.equal((await call('POST', '/api/land/buy', { province: 'Đà Nẵng', use: 'o' }, tl)).status, 403, 'đất ở chưa mở');
  assert.equal((await call('POST', '/api/land/buy', { province: 'Đà Nẵng', use: 'nong_nghiep' }, nd)).body.error, 'dung_canh_dong');
  // mua 2 thửa thương mại
  const before = await cashOf('tl_dat'), price = lotPrice('Đà Nẵng', 'thuong_mai');
  const buy = await call('POST', '/api/land/buy', { province: 'Đà Nẵng', use: 'thuong_mai', count: 2 }, tl);
  assert.equal(buy.status, 200, JSON.stringify(buy.body));
  assert.equal(await cashOf('tl_dat'), before - 2 * price - registrationFee(2 * price) - 2 * CERT_FEE);
  assert.match(buy.body.lots[0].certNo, /^VV-DN-TMD-\d{6}$/);
  const after = (await call('GET', `/api/land?province=${q('Đà Nẵng')}`, undefined, cx)).body.summary.find((r: any) => r.use === 'thuong_mai');
  assert.equal(after.left, tm.left - 2);
  // chủ xưởng mua đất KCN được
  assert.equal((await call('POST', '/api/land/buy', { province: 'Đà Nẵng', use: 'cong_nghiep' }, cx)).status, 200);
  // rao bán: giá ngoài khoảng bị từ chối
  const lot = buy.body.lots[0];
  assert.equal((await call('POST', `/api/land/${lot.id}/list`, { price: price * 10 }, tl)).body.error, 'gia_sai');
  assert.equal((await call('POST', `/api/land/${lot.id}/list`, { price: price * 2 }, cx)).status, 404, 'không phải chủ');
  assert.equal((await call('POST', `/api/land/${lot.id}/list`, { price: price * 2 }, tl)).status, 200);
  const listed = (await call('GET', `/api/land?province=${q('Đà Nẵng')}`, undefined, cx)).body.listings;
  assert.equal(listed.length, 1);
  // chủ xưởng mua lại: trả giá + trước bạ + phí sổ; người bán nhận giá − 2%
  const sellerBefore = await cashOf('tl_dat'), buyerBefore = await cashOf('cx_dat'), p2 = price * 2;
  const pur = await call('POST', `/api/land/${lot.id}/purchase`, {}, cx);
  assert.equal(pur.status, 200, JSON.stringify(pur.body));
  assert.equal(await cashOf('cx_dat'), buyerBefore - p2 - registrationFee(p2) - CERT_FEE);
  assert.equal(await cashOf('tl_dat'), sellerBefore + p2 - transferTax(p2));
  assert.equal(pur.body.lot.mine, true);
  assert.equal((await call('POST', `/api/land/${lot.id}/purchase`, {}, nd)).status, 404, 'đã bán rồi');
  const hist = (await call('GET', `/api/land/${lot.id}`, undefined, nd)).body.history;
  assert.equal(hist[0].price, p2);
  // nhà nông không nhận chuyển nhượng đất KCN
  const kcn = (await call('GET', '/api/land', undefined, cx)).body.mine.find((l: any) => l.use === 'cong_nghiep');
  await call('POST', `/api/land/${kcn.id}/list`, { price: lotPrice('Đà Nẵng', 'cong_nghiep') }, cx);
  assert.equal((await call('POST', `/api/land/${kcn.id}/purchase`, {}, nd)).status, 403);
});

test('dựng công trình dùng thửa trống đã có; hết quỹ đất thì không mua được', async () => {
  const tl = await signup('tl_ch', 'thuong_lai');
  const prov = 'Cà Mau';
  await call('POST', '/api/land/buy', { province: prov, use: 'thuong_mai', count: 1 }, tl);
  const before = await cashOf('tl_ch');
  const shop = await call('POST', '/api/properties/buy', { province: prov, kind: 'cua_hang' }, tl);
  assert.equal(shop.status, 200, JSON.stringify(shop.body));
  assert.equal(await cashOf('tl_ch'), before - BUILDINGS.cua_hang.build - BUILDINGS.cua_hang.permit, 'không phải trả lại tiền đất');
  const lots = (await call('GET', '/api/land', undefined, tl)).body.mine;
  assert.equal(lots[0].propertyId, shop.body.property.id);
  assert.equal((await call('POST', `/api/land/${lots[0].id}/list`, { price: lotPrice(prov, 'thuong_mai') }, tl)).body.error, 'dang_dung');
  // siêu thị cần 4 thửa: tự mua đủ
  const b2 = await cashOf('tl_ch');
  const st = await call('POST', '/api/properties/buy', { province: prov, kind: 'sieu_thi' }, tl);
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.equal(await cashOf('tl_ch'), b2 - buildingCost('sieu_thi', prov).total);
  // vét cạn quỹ đất thương mại của tỉnh
  const left = releasedLots(prov, 'thuong_mai') - 5;
  await db.query(`insert into land_lots (province, use, owner_id, area_m2, price_paid) select $1, 'thuong_mai', null, 100, 1 from generate_series(1, $2)`, [prov, left]);
  assert.equal((await call('POST', '/api/land/buy', { province: prov, use: 'thuong_mai' }, tl)).body.error, 'het_dat');
});

test('cánh đồng trừ quỹ đất nông nghiệp của tỉnh; bán ruộng trả thửa về quỹ', async () => {
  const nd = await signup('nd_ruong', 'nong_dan', 10);
  const before = (await call('GET', `/api/land?province=${q('Đồng Tháp')}`, undefined, nd)).body.summary.find((r: any) => r.use === 'nong_nghiep').left;
  const f = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 3 }, nd);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  const mid = (await call('GET', `/api/land?province=${q('Đồng Tháp')}`, undefined, nd)).body;
  assert.equal(mid.summary.find((r: any) => r.use === 'nong_nghiep').left, before - 3);
  assert.equal(mid.mine.filter((l: any) => l.fieldId === Number(f.body.fieldId)).length, 3);
  assert.equal((await call('POST', `/api/fields/${f.body.fieldId}/sell`, {}, nd)).status, 200);
  assert.equal((await call('GET', `/api/land?province=${q('Đồng Tháp')}`, undefined, nd)).body.summary.find((r: any) => r.use === 'nong_nghiep').left, before);
});
