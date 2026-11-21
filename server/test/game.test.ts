import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { PROVINCES, REGIONS, SPECIALTIES, CROPS, processOf } from '../../shared/catalog.ts';
import {
  CITY_BONUS, COOP_BONUS, COOP_CREATE_COST, GIFT_DAILY_LIMIT, GLUT_KG, GLUT_MAX_DROP, HELP_REWARD, LAND_PRICE, MARKET_DAY_BONUS, MAX_FRIENDS,
  REGION_SET_REWARD, ROOFTOP_TILES, SOUVENIR_RATIO, START_CASH, TRAVEL_COST, glutFactor, marketDayAt, nearestRegion, npcPrice, qualityFromLate,
  seedCost, snapCell, stepCount, urbanCoreAt, weatherAt, weatherInfo,
} from '../../shared/rules.ts';
import type { Weather, WeatherKind } from '../../shared/rules.ts';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test';
const ADMIN = 'test-admin-token-0123456789';
let db: Db, app: FastifyInstance, fairApp: FastifyInstance;
const fixedWeather = (kind: WeatherKind) => (_regionId: string, nowMs: number): Weather => ({ kind, ...weatherInfo(kind), until: nowMs + 3600_000 });

before(async () => {
  const pg = (await import('pg')).default;
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  // TIME_SCALE rất lớn để mỗi bước chỉ chờ 1 giây (mức tối thiểu).
  // Thời tiết và chợ phiên được cố định để kết quả không phụ thuộc ngày giờ chạy kiểm thử.
  const base = { db, timeScale: 1e9, lateGraceMs: 60_000, adminToken: ADMIN, rateLimit: false, staticDir: '/nonexistent', weatherAt: fixedWeather('nang') };
  app = await buildApp({ ...base, marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }) });
  fairApp = await buildApp({ ...base, weatherAt: fixedWeather('nang_gat'), marketDayAt: () => ({ active: true, startsAt: 0, endsAt: 1 }) });
});
after(async () => { await app.close(); await fairApp.close(); await db.close(); });

type Res = { status: number; body: any; cookie?: string };
const call = (method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}) => callOn(app, method, path, body, cookie, headers);
async function callOn(target: FastifyInstance, method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}): Promise<Res> {
  const r = await target.inject({
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

test('bạn bè: mời, chấp nhận, mời chéo, huỷ và các lỗi chính', async () => {
  const a = await signup('ban_a'), b = await signup('ban_b'), c = await signup('ban_c');
  const idOf = async (ck: string) => (await call('GET', '/api/me', undefined, ck)).body.user.id as number;
  const [ida, idb, idc] = [await idOf(a), await idOf(b), await idOf(c)];

  assert.equal((await call('GET', '/api/friends')).status, 401);
  assert.equal((await call('POST', '/api/friends', { username: 'khong_co_ai' }, a)).status, 404);
  const self = await call('POST', '/api/friends', { username: 'ban_a' }, a);
  assert.equal(self.status, 409); assert.equal(self.body.error, 'tu_ket_ban');

  assert.deepEqual((await call('POST', '/api/friends', { username: 'ban_b' }, a)).body, { status: 'requested' });
  const again = await call('POST', '/api/friends', { username: 'ban_b' }, a);
  assert.equal(again.status, 409); assert.equal(again.body.error, 'da_ket_ban');
  assert.deepEqual((await call('GET', '/api/friends', undefined, a)).body.outgoing.map((u: any) => u.userId), [idb]);
  assert.deepEqual((await call('GET', '/api/friends', undefined, b)).body.incoming, [{ userId: ida, username: 'ban_a', displayName: 'ban_a' }]);

  assert.equal((await call('POST', `/api/friends/${idb}/accept`, {}, a)).status, 404, 'người mời không tự chấp nhận được');
  assert.equal((await call('POST', `/api/friends/${ida}/accept`, {}, c)).status, 404, 'người ngoài không chấp nhận được');
  assert.deepEqual((await call('POST', `/api/friends/${ida}/accept`, {}, b)).body, { ok: true });
  assert.equal((await call('POST', `/api/friends/${ida}/accept`, {}, b)).status, 404);
  const dup = await call('POST', '/api/friends', { username: 'ban_a' }, b);
  assert.equal(dup.status, 409); assert.equal(dup.body.error, 'da_ket_ban');
  const fa = (await call('GET', '/api/friends', undefined, a)).body;
  assert.deepEqual(fa.friends, [{ userId: idb, username: 'ban_b', displayName: 'ban_b', homeRegionId: null, plotId: null }]);
  assert.deepEqual([fa.incoming, fa.outgoing], [[], []]);

  // Mời chéo: C mời A, rồi A mời C thì thành bạn ngay.
  assert.deepEqual((await call('POST', '/api/friends', { username: 'ban_a' }, c)).body, { status: 'requested' });
  assert.deepEqual((await call('POST', '/api/friends', { username: 'ban_c' }, a)).body, { status: 'accepted' });
  assert.deepEqual((await call('GET', '/api/friends', undefined, a)).body.friends.map((u: any) => u.userId), [idb, idc], 'xếp theo lúc chấp nhận');

  // Huỷ kết bạn và từ chối lời mời.
  assert.equal((await call('DELETE', `/api/friends/${idc}`, undefined, b)).status, 404);
  assert.equal((await call('DELETE', `/api/friends/${ida}`, undefined, c)).status, 200);
  assert.deepEqual((await call('GET', '/api/friends', undefined, a)).body.friends.map((u: any) => u.userId), [idb]);
  await call('POST', '/api/friends', { username: 'ban_b' }, c);
  assert.equal((await call('DELETE', `/api/friends/${idc}`, undefined, b)).status, 200, 'từ chối lời mời');
  assert.deepEqual((await call('GET', '/api/friends', undefined, c)).body.outgoing, []);

  // Đủ số bạn thì không nhận thêm.
  const { rows } = await db.query(
    `insert into users (username, display_name, pass_hash, cash) select 'day_' || i, 'day', 'x', 0 from generate_series(1, $1::int) i returning id`, [MAX_FRIENDS]);
  for (const r of rows) {
    await db.query(`insert into friendships (user_a, user_b, requested_by, status, accepted_at) values ($1,$2,$1,'accepted', now())`, [Math.min(idc, r.id), Math.max(idc, r.id)]);
  }
  await call('POST', '/api/friends', { username: 'ban_c' }, b);
  const full = await call('POST', `/api/friends/${idb}/accept`, {}, c);
  assert.equal(full.status, 409); assert.equal(full.body.error, 'day_ban');
  const fullCross = await call('POST', '/api/friends', { username: 'ban_b' }, c);
  assert.equal(fullCross.status, 409); assert.equal(fullCross.body.error, 'day_ban');
});

test('xóm và chăm giúp: hàng xóm là bạn bè, bạn giúp được bước đến hạn, thu hoạch thuộc về chủ', async () => {
  const owner = await signup('chu_vuon'), friend = await signup('hang_xom'), stranger = await signup('nguoi_la'), homeless = await signup('chua_dat');
  assert.equal((await call('GET', '/api/village', undefined, homeless)).status, 409);
  const plotOf = async (ck: string, regionId: string) => (await call('POST', '/api/onboard', { regionId }, ck)).body.plotId as number;
  const ownerPlot = await plotOf(owner, 'qng_lyson');
  const friendPlot = await plotOf(friend, 'hn_phudien');
  const strangerPlot = await plotOf(stranger, 'qng_lyson');
  const me = async (ck: string) => (await call('GET', '/api/me', undefined, ck)).body;
  const ownerId = (await me(owner)).user.id, friendId = (await me(friend)).user.id;
  await call('POST', '/api/friends', { username: 'hang_xom' }, owner);
  await call('POST', `/api/friends/${ownerId}/accept`, {}, friend);

  const sp = SPECIALTIES.hanh_ly_son;
  const plant = await call('POST', `/api/plots/${ownerPlot}/plant`, { tile: 5, specialtyId: sp.id }, owner);
  const pid = plant.body.plantingId;
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'hanh_ly_son','A',9)`, [ownerId]);
  await call('POST', '/api/market/listings', { specialtyId: sp.id, quality: 'A', kg: 4, price: sp.refPrice }, owner);

  // Xóm của chủ vườn: lô nhà ở giữa, bạn bè là hàng xóm, người lạ thì không.
  const v = (await call('GET', '/api/village', undefined, owner)).body;
  assert.deepEqual(v.center.plot, { id: ownerPlot, regionId: 'qng_lyson', isHome: true, kind: 'ground', ownerId, ownerName: 'chu_vuon', mine: true, friend: false });
  assert.equal(v.center.plantings.length, 1);
  assert.deepEqual(Object.keys(v.center.plantings[0]).sort(), ['id', 'lateCount', 'specialtyId', 'stepIndex', 'stepReadyAt', 'tile']);
  assert.equal(typeof v.center.plantings[0].stepReadyAt, 'number');
  assert.equal(v.center.stall.length, 1); assert.equal(v.center.stall[0].kg, 4);
  assert.deepEqual(v.neighbors.map((n: any) => n.plot), [{ id: friendPlot, regionId: 'hn_phudien', isHome: true, kind: 'ground', ownerId: friendId, ownerName: 'hang_xom', mine: false, friend: true }]);
  assert.ok(typeof v.now === 'number');
  // Ghé lô của người khác: không kèm hàng xóm.
  const visit = (await call('GET', `/api/village?plotId=${ownerPlot}`, undefined, friend)).body;
  assert.equal(visit.center.plot.friend, true); assert.equal(visit.center.plot.mine, false);
  assert.deepEqual(visit.neighbors, []);
  assert.equal(visit.center.plantings[0].id, pid);
  const lone = (await call('GET', `/api/village?plotId=${strangerPlot}`, undefined, owner)).body;
  assert.equal(lone.center.plot.friend, false); assert.deepEqual(lone.neighbors, []);
  assert.equal((await call('GET', '/api/village?plotId=999999', undefined, owner)).status, 404);
  assert.deepEqual((await call('GET', '/api/village', undefined, stranger)).body.neighbors, []);

  // Chăm giúp.
  const early = await call('POST', `/api/plantings/${pid}/help`, {}, friend);
  assert.equal(early.status, 409); assert.equal(early.body.error, 'chua_den_luc');
  await sleep(1050);
  const no = await call('POST', `/api/plantings/${pid}/help`, {}, stranger);
  assert.equal(no.status, 403); assert.equal(no.body.error, 'khong_phai_ban');
  const own = await call('POST', `/api/plantings/${pid}/help`, {}, owner);
  assert.equal(own.status, 409); assert.equal(own.body.error, 'cay_cua_minh');
  assert.equal((await call('POST', '/api/plantings/999999/help', {}, friend)).status, 404);
  const before = (await me(friend)).user.cash;
  const help = await call('POST', `/api/plantings/${pid}/help`, {}, friend);
  assert.equal(help.status, 200, JSON.stringify(help.body));
  assert.equal(help.body.stepIndex, 2); assert.equal(help.body.reward, HELP_REWARD); assert.equal(help.body.lateCount, 0);
  assert.equal((await me(friend)).user.cash, before + HELP_REWARD);
  assert.equal((await call('POST', `/api/plantings/${pid}/help`, {}, friend)).status, 409, 'bước kế chưa đến hạn');

  // Chủ làm tiếp tới sát bước cuối; bạn không được thu hoạch thay.
  for (let i = 2; i < stepCount(sp) - 1; i++) {
    await sleep(1050);
    assert.equal((await call('POST', `/api/plantings/${pid}/step`, {}, owner)).status, 200);
  }
  await sleep(1050);
  const last = await call('POST', `/api/plantings/${pid}/help`, {}, friend);
  assert.equal(last.status, 409); assert.equal(last.body.error, 'chu_vuon_thu_hoach');
  const harvest = await call('POST', `/api/plantings/${pid}/step`, {}, owner);
  assert.deepEqual(harvest.body.harvested, { specialtyId: sp.id, quality: 'A', kg: CROPS.hanh.yieldKg });

  // Hết lượt trong ngày.
  const plant2 = await call('POST', `/api/plots/${ownerPlot}/plant`, { tile: 6, specialtyId: sp.id }, owner);
  await db.query(`insert into ledger (user_id, delta, reason) select $1, 0, 'cham_giup:0' from generate_series(1, 30)`, [friendId]);
  await sleep(1050);
  const capped = await call('POST', `/api/plantings/${plant2.body.plantingId}/help`, {}, friend);
  assert.equal(capped.status, 409); assert.equal(capped.body.error, 'het_luot');
});

const meOf = async (cookie: string) => (await call('GET', '/api/me', undefined, cookie)).body;
async function befriend(a: string, b: string) {
  const bMe = await meOf(b), aMe = await meOf(a);
  assert.equal((await call('POST', '/api/friends', { username: bMe.user.username }, a)).status, 200);
  assert.equal((await call('POST', '/api/friends', { username: aMe.user.username }, b)).body.status, 'accepted');
}

test('hàm thuần: thời tiết, chợ phiên, được mùa mất giá, lõi đô thị, giá có hệ số', () => {
  const t0 = Date.UTC(2026, 10, 18, 5, 0, 0);
  assert.deepEqual(weatherAt('qng_lyson', t0), weatherAt('qng_lyson', t0 + 60_000), 'cùng khung 3 giờ thì giống nhau');
  const growth: Record<string, number> = { nang: 1, may: 1, mua: 0.8, nang_gat: 1.2, bao: 1.3 };
  const seen = new Set<string>();
  for (const regionId of Object.keys(REGIONS)) for (let i = 0; i < 40; i++) {
    const w = weatherAt(regionId, t0 + i * 3 * 3600_000);
    assert.equal(w.growth, growth[w.kind]);
    assert.ok(w.label && w.icon && w.until > t0 + i * 3 * 3600_000 && w.until <= t0 + (i + 1) * 3 * 3600_000);
    if (w.kind === 'bao') assert.ok(['trung', 'dao'].includes(REGIONS[regionId].zone), 'bão chỉ có ở miền Trung và đảo');
    seen.add(w.kind);
  }
  assert.deepEqual([...seen].sort(), ['bao', 'may', 'mua', 'nang', 'nang_gat']);

  // 2026-11-21 là thứ Bảy, 2026-11-18 là thứ Tư (giờ Việt Nam = UTC+7).
  const sat = marketDayAt(Date.UTC(2026, 10, 21, 3, 0, 0));
  assert.equal(sat.active, true);
  assert.equal(sat.startsAt, Date.UTC(2026, 10, 20, 17, 0, 0));
  assert.equal(sat.endsAt, Date.UTC(2026, 10, 22, 17, 0, 0));
  assert.equal(marketDayAt(Date.UTC(2026, 10, 20, 16, 59, 0)).active, false, 'thứ Sáu 23:59 giờ VN chưa họp chợ');
  assert.equal(marketDayAt(Date.UTC(2026, 10, 22, 16, 59, 0)).active, true, 'Chủ nhật 23:59 giờ VN còn họp chợ');
  const wed = marketDayAt(Date.UTC(2026, 10, 18, 3, 0, 0));
  assert.deepEqual(wed, { active: false, startsAt: sat.startsAt, endsAt: sat.endsAt });

  assert.equal(glutFactor(0), 1);
  assert.equal(glutFactor(GLUT_KG / 2), 1 - GLUT_MAX_DROP / 2);
  assert.equal(glutFactor(GLUT_KG * 10), 1 - GLUT_MAX_DROP);

  assert.equal(urbanCoreAt(21.028, 105.854)?.id, 'ha_noi');
  assert.equal(urbanCoreAt(10.78, 106.7)?.id, 'tp_hcm');
  assert.equal(urbanCoreAt(15.38, 109.12), null, 'Lý Sơn không phải lõi đô thị');
  assert.equal(ROOFTOP_TILES.length, 12);
  assert.deepEqual([ROOFTOP_TILES[0], ROOFTOP_TILES[11]], [7, 22]);

  const ref = 100_000;
  assert.equal(npcPrice(ref, 'A', 'x', 'x'), 85_000);
  assert.equal(npcPrice(ref, 'A', 'x', 'x', {}), 85_000);
  assert.equal(npcPrice(ref, 'A', 'x', 'x', { glut: 0.7 }), 59_500);
  assert.equal(npcPrice(ref, 'A', 'x', 'x', { marketDay: true }), Math.round((85_000 * (1 + MARKET_DAY_BONUS)) / 100) * 100);
  assert.equal(npcPrice(ref, 'A', 'x', 'x', { coop: true }), Math.round((85_000 * (1 + COOP_BONUS)) / 100) * 100);
  assert.equal(npcPrice(ref, 'A', 'x', 'x', { city: true }), 85_000, 'thưởng phố chỉ áp cho hàng phương xa');
  assert.equal(npcPrice(ref, 'A', 'x', 'y', { city: true }), Math.round((110_000 * (1 + CITY_BONUS)) / 100) * 100);
});

test('sân thượng: chỉ ở lõi đô thị, chỉ 12 ô giữa, bán hàng phương xa được thưởng', async () => {
  const island = await signup('dan_dao');
  const near = await call('GET', '/api/geo/nearest?lat=15.38&lng=109.12', undefined, island);
  assert.equal(near.body.urban, null);
  const refused = await call('POST', '/api/onboard', { lat: 15.38, lng: 109.12, rooftop: true }, island);
  assert.deepEqual([refused.status, refused.body.error], [409, 'khong_o_pho']);
  assert.equal((await call('POST', '/api/onboard', { regionId: 'hcm_laithieu', rooftop: true }, island)).body.error, 'khong_o_pho');

  const city = await signup('dan_pho');
  assert.deepEqual((await call('GET', '/api/geo/nearest?lat=10.776&lng=106.7', undefined, city)).body.urban, { id: 'tp_hcm', name: 'TP. Hồ Chí Minh' });
  const ob = await call('POST', '/api/onboard', { lat: 10.776, lng: 106.7, rooftop: true }, city);
  assert.equal(ob.status, 200, JSON.stringify(ob.body));
  assert.equal(ob.body.regionId, 'hcm_laithieu');
  const me = await meOf(city);
  assert.equal(me.user.homeKind, 'rooftop');
  assert.equal(me.user.coopId, null);
  assert.equal(me.plots[0].kind, 'rooftop');
  assert.equal((await call('GET', '/api/village', undefined, city)).body.center.plot.kind, 'rooftop');
  assert.equal((await call('GET', `/api/plots/${ob.body.plotId}`, undefined, city)).body.plot.kind, 'rooftop');

  const locked = await call('POST', `/api/plots/${ob.body.plotId}/plant`, { tile: 0, specialtyId: 'buoi_bach_dang' }, city);
  assert.deepEqual([locked.status, locked.body.error], [409, 'o_bi_khoa']);
  assert.equal((await call('POST', `/api/plots/${ob.body.plotId}/plant`, { tile: ROOFTOP_TILES[0], specialtyId: 'buoi_bach_dang' }, city)).status, 200);

  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'man_bac_ha','A',2), ($1,'buoi_bach_dang','A',2)`, [me.user.id]);
  const far = await call('POST', '/api/sell/npc', { specialtyId: 'man_bac_ha', quality: 'A', kg: 1 }, city);
  assert.equal(far.body.mods.city, true);
  assert.equal(far.body.unitPrice, npcPrice(SPECIALTIES.man_bac_ha.refPrice, 'A', 'lc_bacha', 'hcm_laithieu', { city: true }));
  assert.ok(far.body.unitPrice > npcPrice(SPECIALTIES.man_bac_ha.refPrice, 'A', 'lc_bacha', 'hcm_laithieu'));
  const local = await call('POST', '/api/sell/npc', { specialtyId: 'buoi_bach_dang', quality: 'A', kg: 1 }, city);
  assert.equal(local.body.unitPrice, npcPrice(SPECIALTIES.buoi_bach_dang.refPrice, 'A', 'hcm_laithieu', 'hcm_laithieu'));
});

test('thời tiết kéo dài bước chờ; xóm và bảng giá báo thời tiết, chợ phiên', async () => {
  const cookie = await signup('troi_nang');
  const ob = await call('POST', '/api/onboard', { regionId: 'ld_dalat' }, cookie);
  const v = await call('GET', '/api/village', undefined, cookie);
  assert.equal(v.body.weather.kind, 'nang');
  assert.equal(v.body.marketDay.active, false);
  const hot = await callOn(fairApp, 'GET', '/api/village', undefined, cookie);
  assert.deepEqual([hot.body.weather.kind, hot.body.weather.growth, hot.body.marketDay.active], ['nang_gat', 1.2, true]);
  assert.equal((await callOn(fairApp, 'GET', '/api/prices')).body.marketDay.active, true);

  // Nắng gắt: bước kế chờ 1.200 ms thay vì 1.000 ms.
  const t0 = Date.now();
  const plant = await callOn(fairApp, 'POST', `/api/plots/${ob.body.plotId}/plant`, { tile: 0, specialtyId: 'atiso_da_lat' }, cookie);
  const view = await call('GET', `/api/plots/${ob.body.plotId}`, undefined, cookie);
  const wait = view.body.plantings[0].stepReadyAt - t0;
  assert.ok(wait >= 1200 && wait < 1400, `chờ ${wait} ms`);
  await sleep(1050);
  assert.equal((await call('POST', `/api/plantings/${plant.body.plantingId}/step`, {}, cookie)).body.error, 'chua_den_luc');
  await sleep(250);
  const step = await call('POST', `/api/plantings/${plant.body.plantingId}/step`, {}, cookie);
  assert.equal(step.status, 200);
  assert.ok(step.body.stepReadyAt - Date.now() <= 1000, 'trời nắng đẹp thì chờ đúng mức gốc');
});

test('được mùa mất giá, chợ phiên được giá', async () => {
  const cookie = await signup('ban_nhieu');
  await call('POST', '/api/onboard', { regionId: 'sl_mocchau' }, cookie);
  const me = await meOf(cookie);
  const sp = SPECIALTIES.man_moc_chau;
  assert.equal((await call('GET', '/api/prices')).body.prices[sp.id].glut, 1);
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,$2,'A',100)`, [me.user.id, sp.id]);

  const first = await call('POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 10 }, cookie);
  assert.deepEqual(first.body.mods, { glut: 1, marketDay: false, coop: false, city: false });
  assert.equal(first.body.unitPrice, npcPrice(sp.refPrice, 'A', sp.regionId, 'sl_mocchau'));

  // Cả máy chủ đổ ra bán: 1.490 kg nữa trong 24 giờ, cộng 10 kg vừa bán = nửa ngưỡng.
  await db.query(`insert into npc_sales (user_id, specialty_id, kg) values ($1,$2,$3)`, [me.user.id, sp.id, GLUT_KG / 2 - 10]);
  await db.query(`insert into npc_sales (user_id, specialty_id, kg, created_at) values ($1,$2,5000, now() - interval '25 hours')`, [me.user.id, sp.id]);
  const prices = (await call('GET', '/api/prices')).body;
  assert.equal(prices.prices[sp.id].glut, 1 - GLUT_MAX_DROP / 2);
  assert.equal(prices.prices.dau_tay_moc_chau.glut, 1);
  assert.equal(prices.marketDay.active, false);
  const second = await call('POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 10 }, cookie);
  assert.equal(second.body.mods.glut, 1 - GLUT_MAX_DROP / 2);
  assert.equal(second.body.unitPrice, npcPrice(sp.refPrice, 'A', sp.regionId, 'sl_mocchau', { glut: 1 - GLUT_MAX_DROP / 2 }));
  assert.ok(second.body.unitPrice < first.body.unitPrice);

  const fair = await callOn(fairApp, 'POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 1 }, cookie);
  assert.equal(fair.body.mods.marketDay, true);
  assert.equal(fair.body.unitPrice, npcPrice(sp.refPrice, 'A', sp.regionId, 'sl_mocchau', fair.body.mods));
  assert.ok(fair.body.unitPrice > npcPrice(sp.refPrice, 'A', sp.regionId, 'sl_mocchau', { glut: fair.body.mods.glut }));
});

test('hợp tác xã: lập, vào, khác vùng, thưởng giá, rời và chuyển chủ', async () => {
  const chu = await signup('chu_nhiem'), xa = await signup('xa_vien'), la = await signup('vung_khac'), ngheo = await signup('het_tien');
  await call('POST', '/api/onboard', { regionId: 'bn_lucngan' }, chu);
  await call('POST', '/api/onboard', { regionId: 'bn_lucngan' }, xa);
  await call('POST', '/api/onboard', { regionId: 'ld_dalat' }, la);
  await call('POST', '/api/onboard', { regionId: 'bn_lucngan' }, ngheo);
  const chuMe = await meOf(chu), xaMe = await meOf(xa), ngheoMe = await meOf(ngheo);

  assert.equal((await call('POST', '/api/coops', { name: 'ab' }, chu)).status, 400);
  await db.query('update users set cash = 1000 where id = $1', [ngheoMe.user.id]);
  assert.equal((await call('POST', '/api/coops', { name: 'HTX Nghèo' }, ngheo)).body.error, 'khong_du_tien');
  const made = await call('POST', '/api/coops', { name: '  HTX Vải thiều Lục Ngạn ' }, chu);
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const coopId = made.body.coopId;
  assert.equal((await meOf(chu)).user.cash, chuMe.user.cash - COOP_CREATE_COST);
  assert.equal((await meOf(chu)).user.coopId, coopId);
  assert.equal((await call('POST', '/api/coops', { name: 'HTX thứ hai' }, chu)).body.error, 'da_co_htx');
  assert.equal((await call('POST', '/api/coops', { name: 'HTX Vải thiều Lục Ngạn' }, xa)).body.error, 'ten_da_dung');

  assert.equal((await call('POST', `/api/coops/${coopId}/join`, {}, la)).body.error, 'khac_vung');
  assert.equal((await call('POST', `/api/coops/999999/join`, {}, xa)).status, 404);
  assert.equal((await call('POST', `/api/coops/${coopId}/join`, {}, xa)).status, 200);
  assert.equal((await call('POST', `/api/coops/${coopId}/join`, {}, xa)).body.error, 'da_co_htx');
  assert.equal((await call('POST', '/api/coops/leave', {}, la)).body.error, 'chua_co_htx');

  const list = (await call('GET', '/api/coops', undefined, xa)).body.coops;
  assert.deepEqual(list, [{ id: coopId, name: 'HTX Vải thiều Lục Ngạn', regionId: 'bn_lucngan', ownerName: 'chu_nhiem', members: 2 }]);
  assert.deepEqual((await call('GET', '/api/coops', undefined, la)).body.coops, []);
  assert.equal((await call('GET', '/api/coops?regionId=bn_lucngan', undefined, la)).body.coops.length, 1);
  assert.equal((await call('GET', '/api/coops/mine', undefined, la)).body.coop, null);

  // Xã viên được thưởng giá khi bán thương lái; sản lượng tuần tính từ lượng đã bán.
  const sp = SPECIALTIES.vai_luc_ngan;
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,$2,'A',30)`, [xaMe.user.id, sp.id]);
  const sell = await call('POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 30 }, xa);
  assert.equal(sell.body.mods.coop, true);
  assert.equal(sell.body.unitPrice, npcPrice(sp.refPrice, 'A', sp.regionId, 'bn_lucngan', { coop: true }));
  const mine = (await call('GET', '/api/coops/mine', undefined, chu)).body.coop;
  assert.deepEqual({ id: mine.id, ownerId: mine.ownerId, kgWeek: mine.kgWeek, regionId: mine.regionId }, { id: coopId, ownerId: chuMe.user.id, kgWeek: 30, regionId: 'bn_lucngan' });
  assert.deepEqual(mine.members, [{ userId: xaMe.user.id, displayName: 'xa_vien', kgWeek: 30 }, { userId: chuMe.user.id, displayName: 'chu_nhiem', kgWeek: 0 }]);

  // Chủ nhiệm rời: quyền chuyển cho xã viên vào sớm nhất; người cuối rời thì HTX giải thể.
  assert.equal((await call('POST', '/api/coops/leave', {}, chu)).status, 200);
  assert.equal((await meOf(chu)).user.coopId, null);
  assert.equal((await call('GET', '/api/coops/mine', undefined, xa)).body.coop.ownerId, xaMe.user.id);
  assert.equal((await call('POST', '/api/coops/leave', {}, xa)).status, 200);
  assert.deepEqual((await call('GET', '/api/coops?regionId=bn_lucngan', undefined, xa)).body.coops, []);
});

test('du lịch, quà đặc sản và sổ sưu tập', async () => {
  const cookie = await signup('du_khach');
  await call('POST', '/api/onboard', { regionId: 'hn_phudien' }, cookie);
  const start = (await meOf(cookie)).user.cash;
  assert.deepEqual((await call('GET', '/api/travel', undefined, cookie)).body.visited, ['hn_phudien']);
  assert.deepEqual((await call('GET', '/api/collection', undefined, cookie)).body, { specialties: [], regionsRewarded: [] });

  const early = await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'que_tra_bong', kg: 1 }, cookie);
  assert.deepEqual([early.status, early.body.error], [409, 'chua_toi']);
  assert.deepEqual((await call('POST', '/api/travel', { regionId: 'qng_trabong' }, cookie)).body, { cost: TRAVEL_COST, isNew: true });
  assert.deepEqual((await call('POST', '/api/travel', { regionId: 'qng_trabong' }, cookie)).body, { cost: 0, isNew: false });
  assert.deepEqual((await call('POST', '/api/travel', { regionId: 'hn_phudien' }, cookie)).body, { cost: 0, isNew: false }, 'vùng mình có đất thì miễn phí');
  assert.equal((await call('POST', '/api/travel', { regionId: 'khong_co' }, cookie)).status, 400);
  assert.deepEqual((await call('GET', '/api/travel', undefined, cookie)).body.visited, ['hn_phudien', 'qng_trabong']);

  assert.equal((await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'toi_ly_son', kg: 1 }, cookie)).status, 400, 'đặc sản không thuộc vùng');
  assert.equal((await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'que_tra_bong', kg: 6 }, cookie)).status, 400, 'quá số kg');
  const unit = Math.round(SPECIALTIES.que_tra_bong.refPrice * SOUVENIR_RATIO);
  const buy = await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'que_tra_bong', kg: 2 }, cookie);
  assert.deepEqual(buy.body, { unitPrice: unit, total: unit * 2 });
  await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'que_tra_bong', kg: 1 }, cookie);

  // Trà Bồng chỉ có một đặc sản nên mua xong là trọn bộ: thưởng đúng một lần.
  const me = await meOf(cookie);
  assert.equal(me.user.cash, start - TRAVEL_COST - unit * 3 + REGION_SET_REWARD);
  assert.deepEqual(me.inventory, [{ specialtyId: 'que_tra_bong', quality: 'A', kg: 3 }]);
  assert.deepEqual((await call('GET', '/api/collection', undefined, cookie)).body, { specialties: ['que_tra_bong'], regionsRewarded: ['qng_trabong'] });
  const ledger = await db.query('select coalesce(sum(delta),0)::bigint as s from ledger where user_id = $1', [me.user.id]);
  assert.equal(ledger.rows[0].s, me.user.cash, 'sổ cái khớp số dư');

  // Thu hoạch ở vườn nhà cũng vào sổ; vùng nhà còn thiếu đặc sản thì chưa thưởng.
  const plant = await call('POST', `/api/plots/${me.plots[0].id}/plant`, { tile: 0, specialtyId: 'buoi_dien' }, cookie);
  for (let i = 1; i < stepCount(SPECIALTIES.buoi_dien); i++) { await sleep(1050); await call('POST', `/api/plantings/${plant.body.plantingId}/step`, {}, cookie); }
  assert.deepEqual((await call('GET', '/api/collection', undefined, cookie)).body, { specialties: ['que_tra_bong', 'buoi_dien'], regionsRewarded: ['qng_trabong'] });
});

test('quà tặng: chỉ cho bạn bè, có giới hạn ngày, người nhận có hàng và có trong sổ', async () => {
  const tang = await signup('nguoi_tang'), nhan = await signup('nguoi_nhan'), la = await signup('nguoi_dung');
  await call('POST', '/api/onboard', { regionId: 'qng_lyson' }, tang);
  await call('POST', '/api/onboard', { regionId: 'hn_phudien' }, nhan);
  const tangMe = await meOf(tang), nhanMe = await meOf(nhan), laMe = await meOf(la);
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'toi_ly_son','A',30), ($1,'hanh_ly_son','B',3)`, [tangMe.user.id]);
  const gift = { toUserId: nhanMe.user.id, specialtyId: 'toi_ly_son', quality: 'A', kg: 2, message: 'x'.repeat(200) };

  const stranger = await call('POST', '/api/gifts', { ...gift, toUserId: laMe.user.id }, tang);
  assert.deepEqual([stranger.status, stranger.body.error], [403, 'khong_phai_ban']);
  assert.equal((await call('POST', '/api/gifts', gift, tang)).status, 403, 'chưa kết bạn');
  await befriend(tang, nhan);
  assert.equal((await call('POST', '/api/gifts', { ...gift, kg: 21 }, tang)).status, 400);
  assert.equal((await call('POST', '/api/gifts', { ...gift, specialtyId: 'hanh_ly_son', quality: 'B', kg: 4 }, tang)).body.error, 'khong_du_hang');
  const sent = await call('POST', '/api/gifts', gift, tang);
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.ok(sent.body.giftId > 0);
  assert.equal((await call('POST', '/api/gifts', { ...gift, specialtyId: 'hanh_ly_son', quality: 'B', kg: 3, message: 'Hành nhà trồng' }, tang)).status, 200);

  const box = (await call('GET', '/api/gifts', undefined, nhan)).body;
  assert.equal(box.unseen, 2);
  assert.equal(box.inbox.length, 2);
  assert.deepEqual({ ...box.inbox[0], id: 0, createdAt: 0 }, { id: 0, fromName: 'nguoi_tang', specialtyId: 'hanh_ly_son', quality: 'B', kg: 3, message: 'Hành nhà trồng', createdAt: 0, seen: false });
  assert.equal(box.inbox[1].message.length, 120, 'lời nhắn bị cắt còn 120 ký tự');
  assert.ok(Math.abs(box.inbox[0].createdAt - Date.now()) < 60_000);
  assert.deepEqual((await meOf(nhan)).inventory, [{ specialtyId: 'hanh_ly_son', quality: 'B', kg: 3 }, { specialtyId: 'toi_ly_son', quality: 'A', kg: 2 }]);
  assert.equal((await meOf(tang)).inventory.find((i: any) => i.specialtyId === 'toi_ly_son').kg, 28);
  // Lý Sơn có đúng hai đặc sản: nhận đủ cả hai là trọn bộ, người nhận được thưởng.
  assert.deepEqual((await call('GET', '/api/collection', undefined, nhan)).body, { specialties: ['toi_ly_son', 'hanh_ly_son'], regionsRewarded: ['qng_lyson'] });
  assert.equal((await meOf(nhan)).user.cash, nhanMe.user.cash + REGION_SET_REWARD);
  assert.deepEqual((await call('GET', '/api/gifts', undefined, tang)).body, { inbox: [], unseen: 0 });

  assert.deepEqual((await call('POST', '/api/gifts/seen', {}, nhan)).body, { ok: true });
  const after = (await call('GET', '/api/gifts', undefined, nhan)).body;
  assert.deepEqual([after.unseen, after.inbox.every((g: any) => g.seen)], [0, true]);

  for (let i = 2; i < GIFT_DAILY_LIMIT; i++) assert.equal((await call('POST', '/api/gifts', { ...gift, kg: 1 }, tang)).status, 200);
  const over = await call('POST', '/api/gifts', { ...gift, kg: 1 }, tang);
  assert.deepEqual([over.status, over.body.error], [409, 'het_luot']);
});
