import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { NPCS, PROVINCES, REGIONS, SPECIALTIES, CROPS, npcOf, processOf, recipeOf, specialtiesOfRegion } from '../../shared/catalog.ts';
import {
  CITY_BONUS, COOP_BONUS, COOP_CREATE_COST, GIFT_DAILY_LIMIT, GLUT_KG, GLUT_MAX_DROP, HELP_REWARD, LAND_PRICE, MARKET_DAY_BONUS, MAX_FRIENDS,
  COOP_ORDER_BONUS, COOP_ORDER_KG_PER_MEMBER, FLOATING_BONUS, IN_SEASON_YIELD, ORDERS_PER_DAY, ORDER_PREMIUM, PROCESS_SLOTS_XUONG,
  ROLE_INFO, inSeason, marketEventsAt, seasonAt, supplyKg,
  DUMP_RATIO, FUEL_PER_KM, ROLES, ROLE_TARGETS, SEASON_DAYS, SMALL_TILES, allowedTiles, spinWeights, tripInfo, TRUCK, landPrice, roadKm, tripPlan,
  HARVEST_HELP_SHARE, REGION_SET_REWARD, ROOFTOP_TILES, SOUVENIR_RATIO, START_CASH, TRAVEL_MODES, glutFactor, paceFactor, stepWaitMs, travelOptions, marketDayAt, nearestRegion, npcPrice, qualityFromLate,
  seedCost, snapCell, stepCount, urbanCoreAt, weatherAt, weatherInfo,
  speedFine, SPEED_FINES, wholesalePrice, WHOLESALE_RATIO, WHOLESALE_SUPPLY_KG, EXPORT_MODES, EXPORT_MARKETS, EXPORT_MAX_ACTIVE, exportModesFor, exportQuote, coopOrderRoute,
  LIMIT_REASONS, TRAVEL_VS_TRUCK, QUALITY_MULT,
} from '../../shared/rules.ts';
import type { Weather, WeatherKind } from '../../shared/rules.ts';
import { DECOR_ITEMS, DEFAULT_AVATAR, DEFAULT_STYLE, HOUSE_TYPES, ROOF_COLORS, cleanName, validDecor, validStyle } from '../../shared/custom.ts';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test';
const ADMIN = 'test-admin-token-0123456789';
let db: Db, app: FastifyInstance, fairApp: FastifyInstance, slowApp: FastifyInstance, seasonApp: FastifyInstance, spinApp: FastifyInstance, paceApp: FastifyInstance;
type RoleId = 'nong_dan' | 'xuong' | 'thuong_lai';
/** Vai mà vòng quay của spinApp sẽ trả, và trọng số nó nhận được ở lần quay gần nhất. */
let nextRole: RoleId = 'nong_dan', lastWeights: Record<RoleId, number> | null = null;
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
  const base = { db, timeScale: 1e9, lateGraceMs: 60_000, adminToken: ADMIN, rateLimit: false, staticDir: '/nonexistent', weatherAt: fixedWeather('nang'), marketEventsAt: () => [], inSeason: () => false,
    paceFactor: () => 1, testerUsernames: ['thu_nghiem', ' Thu_Sau '] }; // nhịp chơi cố định 1 để các kiểm thử cũ không đổi
  app = await buildApp({ ...base, marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }) });
  const quiet = { marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }) };
  slowApp = await buildApp({ ...base, ...quiet, timeScale: 1 }); // thời gian thật, để kiểm việc chưa xong
  seasonApp = await buildApp({ ...base, ...quiet, inSeason: () => true }); // luôn đúng chính vụ
  fairApp = await buildApp({ ...base, weatherAt: fixedWeather('nang_gat'), marketDayAt: () => ({ active: true, startsAt: 0, endsAt: 1 }) });
  // Vòng quay tất định và chuyến xe tới nơi ngay.
  spinApp = await buildApp({ ...base, ...quiet, pickRole: (w) => { lastWeights = w; return nextRole; }, tripMinFactor: 0 });
  // Thời gian thật và nhịp chơi mặc định, để đo thời gian chờ theo số lần thu hoạch.
  paceApp = await buildApp({ ...base, ...quiet, timeScale: 1, paceFactor: undefined });
});
after(async () => { await app.close(); await fairApp.close(); await slowApp.close(); await seasonApp.close(); await spinApp.close(); await paceApp.close(); await db.close(); });

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
/** Đăng ký mà chưa có vai trò (như người chơi thật trước khi quay vòng quay). */
async function signupRaw(name: string): Promise<string> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.cookie!;
}
/** Gán thẳng vai trò cho một tài khoản thử (bỏ qua vòng quay). */
async function setRole(name: string, role: 'nong_dan' | 'xuong' | 'thuong_lai') {
  const r = await db.query('update users set role = $2, role_assigned_at = now(), truck_region = home_region_id where username = $1', [name, role]);
  assert.equal(r.rowCount, 1, `không thấy tài khoản ${name}`);
}
/** Đăng ký và gán sẵn vai nhà vườn, để các kiểm thử cũ trồng được ở mọi ô. */
async function signup(name: string, role: 'nong_dan' | 'xuong' | 'thuong_lai' = 'nong_dan'): Promise<string> {
  const cookie = await signupRaw(name);
  await setRole(name, role);
  return cookie;
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
  assert.deepEqual(harvested, { specialtyId: sp.id, quality: 'A', kg: CROPS.toi.yieldKg, inSeason: false });

  // Nhà vườn chỉ bán tháo được; đổi sang thương lái thì bán đủ giá tại vườn.
  const dump = await call('POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 1 }, cookie);
  assert.deepEqual([dump.body.dump, dump.body.unitPrice], [true, Math.round((sp.refPrice * DUMP_RATIO) / 100) * 100]);
  await setRole('ly_son', 'thuong_lai');
  const sell = await call('POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 9 }, cookie);
  assert.deepEqual([sell.body.dump, sell.body.marketRegionId], [false, 'qng_lyson']);
  assert.equal(sell.body.unitPrice, npcPrice(sp.refPrice, 'A', sp.regionId, 'qng_lyson', { glut: sell.body.mods.glut }));
  assert.equal((await call('POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 999 }, cookie)).status, 409);
  const me = await call('GET', '/api/me', undefined, cookie);
  assert.equal(me.body.user.cash, START_CASH - seedCost(sp) + dump.body.total + sell.body.total);
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
  await setRole('nguoi_mua', 'thuong_lai'); await setRole('nguoi_ban', 'thuong_lai');
  const far = await call('POST', '/api/sell/npc', { specialtyId: 'toi_ly_son', quality: 'A', kg: 1 }, buyer);
  const local = await call('POST', '/api/sell/npc', { specialtyId: 'toi_ly_son', quality: 'A', kg: 1 }, seller);
  assert.ok(far.body.unitPrice > ref && local.body.unitPrice < ref);
});

test('mua đất vùng khác cần đủ tiền và mỗi vùng một lô', async () => {
  const cookie = await signup('dai_gia');
  await call('POST', '/api/onboard', { regionId: 'ld_dalat' }, cookie);
  assert.equal((await call('POST', '/api/plots/buy', { regionId: 'qng_lyson' }, cookie)).status, 409);
  const me = (await call('GET', '/api/me', undefined, cookie)).body;
  await db.query('update users set cash = $2 where id = $1', [me.user.id, landPrice('qng_lyson') + 1000]);
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
  assert.deepEqual(v.center.plot, { id: ownerPlot, regionId: 'qng_lyson', isHome: true, kind: 'ground', wardName: null, wardProvince: null, ownerId, ownerName: 'chu_vuon', mine: true, friend: false, ownerRole: 'nong_dan', style: null, decor: [], ownerAvatar: null, ownedHouses: ['mai_ngoi'] });
  assert.equal(v.center.plantings.length, 1);
  assert.deepEqual(Object.keys(v.center.plantings[0]).sort(), ['id', 'lateCount', 'specialtyId', 'stepIndex', 'stepReadyAt', 'tile']);
  assert.equal(typeof v.center.plantings[0].stepReadyAt, 'number');
  assert.equal(v.center.stall.length, 1); assert.equal(v.center.stall[0].kg, 4);
  assert.deepEqual(v.neighbors.map((n: any) => n.plot), [{ id: friendPlot, regionId: 'hn_phudien', isHome: true, kind: 'ground', wardName: null, wardProvince: null, ownerId: friendId, ownerName: 'hang_xom', mine: false, friend: true, ownerRole: 'nong_dan', style: null, decor: [], ownerAvatar: null }]);
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
  // Người lạ chưa tới vùng này không phụ thu hoạch được; bạn bè thì được và nhận phần chia.
  assert.equal((await call('POST', `/api/plantings/${pid}/help`, {}, stranger)).body.error, 'khong_phai_ban');
  const kgOf = async (c: string) => (await me(c)).inventory.filter((i: any) => i.specialtyId === sp.id).reduce((n: number, i: any) => n + i.kg, 0);
  const ownerBefore = await kgOf(owner), friendBefore = await kgOf(friend);
  const last = await call('POST', `/api/plantings/${pid}/help`, {}, friend);
  const share = Math.max(1, Math.round(CROPS.hanh.yieldKg * HARVEST_HELP_SHARE));
  assert.deepEqual(last.body.harvested, { specialtyId: sp.id, quality: 'A', kg: CROPS.hanh.yieldKg, share, inSeason: false });
  assert.equal((await call('POST', `/api/plantings/${pid}/step`, {}, owner)).status, 404, 'cây đã được thu hoạch hộ');
  assert.equal(await kgOf(owner), ownerBefore + CROPS.hanh.yieldKg - share);
  assert.equal(await kgOf(friend), friendBefore + share);

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
    assert.equal(w.growth, Math.round(growth[w.kind] * (w.hazard?.growth ?? 1) * 1000) / 1000);
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

  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'man_bac_ha','A',3), ($1,'buoi_bach_dang','A',2)`, [me.user.id]);
  // Nhà vườn chỉ bán tháo; thưởng dân phố dành cho thương lái bán hàng phương xa ngay tại phố nhà.
  const plain = await call('POST', '/api/sell/npc', { specialtyId: 'man_bac_ha', quality: 'A', kg: 1 }, city);
  assert.deepEqual([plain.body.dump, plain.body.mods], [true, {}]);
  await setRole('dan_pho', 'thuong_lai');
  assert.equal((await meOf(city)).user.role, 'thuong_lai');
  const far = await call('POST', '/api/sell/npc', { specialtyId: 'man_bac_ha', quality: 'A', kg: 1 }, city);
  assert.equal(far.body.mods.city, true);
  assert.equal(far.body.npcId, 'vua_chin_cay');
  assert.equal(far.body.unitPrice, npcPrice(SPECIALTIES.man_bac_ha.refPrice, 'A', 'lc_bacha', 'hcm_laithieu', far.body.mods));
  assert.ok(far.body.unitPrice > plain.body.unitPrice);
  const local = await call('POST', '/api/sell/npc', { specialtyId: 'buoi_bach_dang', quality: 'A', kg: 1 }, city);
  assert.equal(local.body.unitPrice, npcPrice(SPECIALTIES.buoi_bach_dang.refPrice, 'A', 'hcm_laithieu', 'hcm_laithieu', { glut: local.body.mods.glut }), 'hàng tại chỗ không được thưởng phố');
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
  const cookie = await signup('ban_nhieu', 'thuong_lai');
  await call('POST', '/api/onboard', { regionId: 'sl_mocchau' }, cookie);
  const me = await meOf(cookie);
  const sp = SPECIALTIES.man_moc_chau;
  assert.equal((await call('GET', '/api/prices')).body.prices[sp.id].glut, 1);
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,$2,'A',100)`, [me.user.id, sp.id]);

  const first = await call('POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 10 }, cookie);
  assert.deepEqual(first.body.mods, { glut: 1, marketDay: false, coop: false, city: false, floating: false });
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
  const chu = await signup('chu_nhiem'), xa = await signup('xa_vien', 'thuong_lai'), la = await signup('vung_khac'), ngheo = await signup('het_tien');
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
  const fare = travelOptions('hn_phudien', 'qng_trabong')[0].fare;
  assert.deepEqual((await call('POST', '/api/travel', { regionId: 'qng_trabong' }, cookie)).body, { cost: fare, isNew: true, mode: 'xe_khach' });
  assert.deepEqual((await call('POST', '/api/travel', { regionId: 'qng_trabong' }, cookie)).body, { cost: fare, isNew: false, mode: 'xe_khach' }, 'mỗi chuyến đều mua vé');
  assert.equal((await call('POST', '/api/travel', { regionId: 'hn_phudien' }, cookie)).status, 400, 'không mua vé tới chính vùng nhà');
  assert.equal((await call('POST', '/api/travel', { regionId: 'khong_co' }, cookie)).status, 400);
  assert.deepEqual((await call('GET', '/api/travel', undefined, cookie)).body.visited, ['hn_phudien', 'qng_trabong']);

  assert.equal((await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'toi_ly_son', kg: 1 }, cookie)).status, 400, 'đặc sản không thuộc vùng');
  assert.equal((await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'que_tra_bong', kg: 6 }, cookie)).status, 400, 'quá số kg');
  const unit = Math.round(SPECIALTIES.que_tra_bong.refPrice * SOUVENIR_RATIO);
  const buy = await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'que_tra_bong', kg: 2 }, cookie);
  assert.deepEqual(buy.body, { unitPrice: unit, total: unit * 2 });
  await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'que_tra_bong', kg: 1 }, cookie);
  assert.equal((await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'que_tra_bong', kg: 1 }, cookie)).status, 200);
  assert.equal((await call('POST', '/api/souvenir', { regionId: 'qng_trabong', specialtyId: 'que_tra_bong', kg: 1 }, cookie)).body.error, 'het_luot', 'giới hạn số lần mua quà mỗi ngày');
  // Quà đặc sản luôn đắt hơn mức cao nhất thương lái có thể trả, nên không mua đi bán lại được.
  assert.ok(SOUVENIR_RATIO > 1.1 * 1.15 * 1.05 * 1.1 * 1.1);

  // Trà Bồng chỉ có một đặc sản nên mua xong là trọn bộ: thưởng đúng một lần.
  const me = await meOf(cookie);
  assert.equal(me.user.cash, start - fare * 2 - unit * 4 + REGION_SET_REWARD);
  assert.deepEqual(me.inventory, [{ specialtyId: 'que_tra_bong', quality: 'A', kg: 4 }]);
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

// ------------------------------------------------------------------ đợt bổ sung: mùa vụ, vai trò, xưởng, đơn hàng
/** Đặt sẵn một cây đã tới bước thu hoạch để khỏi phải chờ cả quy trình. */
async function ripePlanting(plotId: number, tile: number, specialtyId: string): Promise<number> {
  const { rows } = await db.query(
    `insert into plantings (plot_id, tile, specialty_id, step_index, step_ready_at) values ($1,$2,$3,$4, now() - interval '1 second') returning id`,
    [plotId, tile, specialtyId, stepCount(SPECIALTIES[specialtyId]) - 1]);
  return rows[0].id;
}

test('hàm thuần mới: mùa vụ theo miền, chính vụ, lịch chợ, nguồn cung, công thức, doanh nghiệp, Đà Lạt', () => {
  const at = (month: number, day = 15) => Date.UTC(2026, month - 1, day, 5, 0, 0);
  assert.equal(seasonAt('dt_caibe', at(3))?.id, 'han_man');
  assert.equal(seasonAt('dt_caibe', at(8)), null);
  assert.equal(seasonAt('hue_thuybieu', at(9))?.id, 'bao');
  assert.equal(seasonAt('hue_thuybieu', at(10))?.id, 'lu', 'mưa lũ ưu tiên hơn bão ở miền Trung');
  assert.equal(seasonAt('qng_lyson', at(10))?.id, 'bao');
  assert.equal(seasonAt('hn_phudien', at(12))?.id, 'suong_muoi');
  assert.equal(seasonAt('hn_phudien', at(1))?.id, 'suong_muoi');
  assert.equal(seasonAt('hn_phudien', at(6))?.id, 'nang_nong');
  assert.equal(seasonAt('dl_buonmathuot', at(6)), null);
  // Giờ Việt Nam: 31/1 lúc 18:00 UTC đã là tháng 2 ở Việt Nam.
  assert.equal(seasonAt('dt_caibe', Date.UTC(2026, 0, 31, 18, 0, 0))?.id, 'han_man');
  const dry = weatherAt('dt_caibe', at(3));
  assert.equal(dry.hazard?.id, 'han_man');
  assert.ok(dry.hazard!.note.length > 10 && dry.hazard!.growth === 1.15);
  assert.equal(weatherAt('dt_caibe', at(8)).hazard, undefined);

  assert.equal(inSeason('vai', at(6)), true);
  assert.equal(inSeason('vai', at(12)), false);
  assert.equal(inSeason('khong_co', at(6)), false);
  for (const c of Object.values(CROPS)) {
    assert.ok(c.season.length >= 1 && c.season.length <= 12 && c.season.every((m) => Number.isInteger(m) && m >= 1 && m <= 12), `mùa vụ sai: ${c.id}`);
    assert.equal(new Set(c.season).size, c.season.length);
    const r = recipeOf(c);
    assert.ok(r.ratio >= 0.3 && r.ratio <= 0.7 && r.hours >= 2 && r.hours <= 6 && r.name && r.emoji);
    assert.ok(r.ratio * r.value >= 1.25 && r.ratio * r.value <= 1.4, `công thức ${r.id} lãi ngoài khung`);
  }
  assert.deepEqual([recipeOf(CROPS.xoai).name, recipeOf(CROPS.nho).name, recipeOf(CROPS.khom).name, recipeOf(CROPS.toi).name, recipeOf(CROPS.ca_phe).name, recipeOf(CROPS.lua).name, recipeOf(CROPS.hoa_hong).name],
    ['Sấy dẻo', 'Nước ép', 'Mứt', 'Sấy khô', 'Rang sao', 'Xay xát', 'Hoa khô']);

  // 2026-11-18 là thứ Tư, 2026-11-19 là thứ Năm (giờ Việt Nam).
  const wed = Date.UTC(2026, 10, 18, 3, 0, 0), thu = Date.UTC(2026, 10, 19, 3, 0, 0);
  const south = marketEventsAt('dt_caibe', wed);
  assert.deepEqual(south.map((e) => [e.id, e.active]), [['cho_phien', false], ['cho_noi', true]]);
  assert.equal(south[1].bonus, FLOATING_BONUS);
  assert.ok(south[1].startsAt <= wed && south[1].endsAt > wed && south[1].endsAt - south[1].startsAt === 86400_000);
  assert.deepEqual(marketEventsAt('hn_phudien', wed).map((e) => e.id), ['cho_phien'], 'chợ nổi chỉ có ở miền Nam');
  const next = marketEventsAt('dt_caibe', thu)[1];
  assert.equal(next.active, false);
  assert.equal(next.startsAt, Date.UTC(2026, 10, 24, 17, 0, 0), 'kỳ kế tiếp là thứ Tư tuần sau, 0 giờ Việt Nam');
  assert.equal(marketEventsAt('dt_caibe', Date.UTC(2026, 10, 21, 3, 0, 0))[0].active, true);

  assert.equal(supplyKg(100, 10, 50), 350);
  assert.equal(npcPrice(100_000, 'A', 'x', 'x', { floating: true }), Math.round((85_000 * (1 + FLOATING_BONUS)) / 100) * 100);
  assert.equal(NPCS.length, 6);
  for (const role of ['thuong_lai', 'che_bien', 'xuat_khau', 'sieu_thi'] as const) assert.equal(npcOf(role).role, role);
  assert.equal(new Set(NPCS.map((n) => n.id)).size, 6);
  for (const n of NPCS) assert.ok(n.name && n.logo && n.tagline && /^#[0-9a-f]{6}$/.test(n.color));
  assert.deepEqual(Object.keys(ROLE_INFO).sort(), ['nong_dan', 'thuong_lai', 'xuong']);

  assert.equal(REGIONS.ld_dalat.special, true);
  const dalat = specialtiesOfRegion('ld_dalat');
  assert.ok(dalat.length >= 12);
  assert.ok(dalat.some((s) => CROPS[s.crop].kind === 'hoa') && processOf(CROPS.hoa_hong).length === 7);
  assert.equal(SPECIALTIES.thanh_long_binh_thuan.name, 'Thanh long Hàm Thuận');
  assert.equal(SPECIALTIES.nho_ninh_thuan.name, 'Nho Ninh Sơn');
  assert.equal(REGIONS.kh_ninhphuoc.name, 'Ninh Sơn');
});

test('xã phường: danh sách theo tỉnh, chọn khi nhận đất, đổi sau', async () => {
  const cookie = await signup('co_xa');
  const list = await call('GET', `/api/wards?province=${encodeURIComponent('Quảng Ngãi')}`, undefined, cookie);
  assert.ok(list.body.wards.includes('Đặc khu Lý Sơn'));
  assert.equal((await call('GET', '/api/wards?province=Atlantis', undefined, cookie)).status, 400);
  const badWard = await call('POST', '/api/onboard', { regionId: 'qng_lyson', wardProvince: 'Quảng Ngãi', wardName: 'Phường Không Có' }, cookie);
  assert.deepEqual([badWard.status, badWard.body.error], [400, 'xa_khong_hop_le']);
  assert.equal((await meOf(cookie)).plots.length, 0);
  const ob = await call('POST', '/api/onboard', { regionId: 'qng_lyson', wardProvince: 'Quảng Ngãi', wardName: 'Đặc khu Lý Sơn' }, cookie);
  assert.equal(ob.status, 200, JSON.stringify(ob.body));
  const v = (await call('GET', '/api/village', undefined, cookie)).body;
  assert.deepEqual([v.center.plot.wardName, v.center.plot.wardProvince], ['Đặc khu Lý Sơn', 'Quảng Ngãi']);
  assert.deepEqual(v.events, []);
  assert.equal((await meOf(cookie)).plots[0].wardName, 'Đặc khu Lý Sơn');
  assert.equal((await call('GET', `/api/plots/${ob.body.plotId}`, undefined, cookie)).body.plot.wardName, 'Đặc khu Lý Sơn');
  const farms = (await call('GET', '/api/regions/qng_lyson/farms', undefined, cookie)).body.farms;
  assert.equal(farms.find((f: any) => f.plotId === ob.body.plotId).wardName, 'Đặc khu Lý Sơn');

  const hn = (await call('GET', `/api/wards?province=${encodeURIComponent('Hà Nội')}`, undefined, cookie)).body.wards;
  assert.equal((await call('POST', `/api/plots/${ob.body.plotId}/ward`, { wardProvince: 'Hà Nội', wardName: hn[0] }, cookie)).status, 200);
  assert.equal((await meOf(cookie)).plots[0].wardName, hn[0]);
  assert.equal((await call('POST', `/api/plots/${ob.body.plotId}/ward`, { wardProvince: 'Hà Nội', wardName: 'Đặc khu Lý Sơn' }, cookie)).body.error, 'xa_khong_hop_le');
  const other = await signup('nguoi_khac_xa');
  assert.equal((await call('POST', `/api/plots/${ob.body.plotId}/ward`, { wardProvince: 'Hà Nội', wardName: hn[0] }, other)).status, 404);
});

test('khách vãng lai: chỉ thương lái có vườn sân thượng trong phố mới có', async () => {
  const que = await signup('dan_que', 'thuong_lai');
  await call('POST', '/api/onboard', { regionId: 'ld_dalat' }, que);
  assert.equal((await call('POST', '/api/role', { role: 'thuong_lai' }, que)).status, 404, 'không còn tự chọn vai trò');
  const queMe = await meOf(que);
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'atiso_da_lat','A',10)`, [queMe.user.id]);
  const queListing = await call('POST', '/api/market/listings', { specialtyId: 'atiso_da_lat', quality: 'A', kg: 10, price: SPECIALTIES.atiso_da_lat.refPrice }, que);
  await db.query(`update listings set walkin_at = now() - interval '2 hours' where id = $1`, [queListing.body.listingId]);
  assert.equal((await meOf(que)).walkin, null, 'thương lái ở quê không có khách vãng lai');

  const pho = await signup('chu_sap_pho');
  await call('POST', '/api/onboard', { lat: 10.776, lng: 106.7, rooftop: true }, pho);
  const me = await meOf(pho);
  assert.equal(me.user.role, 'nong_dan');
  const ref = SPECIALTIES.buoi_bach_dang.refPrice;
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'buoi_bach_dang','A',40)`, [me.user.id]);
  const cheap = await call('POST', '/api/market/listings', { specialtyId: 'buoi_bach_dang', quality: 'A', kg: 20, price: ref }, pho);
  const dear = await call('POST', '/api/market/listings', { specialtyId: 'buoi_bach_dang', quality: 'A', kg: 20, price: ref * 2 }, pho);
  await db.query(`update listings set walkin_at = now() - interval '2 hours' where id = any($1::bigint[])`, [[cheap.body.listingId, dear.body.listingId]]);
  assert.equal((await meOf(pho)).walkin, null, 'nhà vườn ở phố thì không có khách vãng lai');
  await setRole('chu_sap_pho', 'thuong_lai');
  const after = await meOf(pho);
  assert.deepEqual(after.walkin, { kg: 20, total: 20 * ref }, 'chỉ tin giá hợp lý mới có khách');
  assert.equal(after.user.cash, me.user.cash + 20 * ref);
  const rows = await db.query('select id, kg, status from listings where id = any($1::bigint[]) order by id', [[cheap.body.listingId, dear.body.listingId]]);
  assert.deepEqual(rows.rows.map((r) => [r.kg, r.status]), [[0, 'sold'], [20, 'open']]);
  assert.equal((await meOf(pho)).walkin, null);
});

test('xưởng chế biến: chỉ chủ xưởng làm được; bắt đầu, hết chỗ, chưa xong, nhận hàng, bán thành phẩm', async () => {
  const cookie = await signup('tho_say', 'xuong');
  await call('POST', '/api/onboard', { regionId: 'qng_lyson' }, cookie);
  const me = await meOf(cookie);
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'toi_ly_son','A',30), ($1,'toi_ly_son','C',10)`, [me.user.id]);
  const recipe = recipeOf(CROPS.toi);
  const toiRef: number = (await call('GET', '/api/prices')).body.prices.toi_ly_son.price; // test bảng giá đã nạp giá mới cho tỏi
  assert.equal((await call('GET', '/api/workshop', undefined, cookie)).body.slots, PROCESS_SLOTS_XUONG);
  const j1 = await callOn(slowApp, 'POST', '/api/workshop/start', { specialtyId: 'toi_ly_son', quality: 'A', kg: 10 }, cookie);
  assert.equal(j1.status, 200, JSON.stringify(j1.body));
  assert.equal(j1.body.kgOut, Math.floor(10 * recipe.ratio + 1e-9));
  assert.ok(Math.abs(j1.body.readyAt - Date.now() - recipe.hours * 3600_000) < 5000);
  const j2 = await callOn(slowApp, 'POST', '/api/workshop/start', { specialtyId: 'toi_ly_son', quality: 'C', kg: 10 }, cookie);
  assert.equal(j2.body.kgOut, Math.floor(10 * recipe.ratio * 0.7 + 1e-9), 'hàng hạng thấp cho ít thành phẩm hơn');
  for (let i = 2; i < PROCESS_SLOTS_XUONG; i++) assert.equal((await callOn(slowApp, 'POST', '/api/workshop/start', { specialtyId: 'toi_ly_son', quality: 'A', kg: 5 }, cookie)).status, 200);
  const full = await callOn(slowApp, 'POST', '/api/workshop/start', { specialtyId: 'toi_ly_son', quality: 'A', kg: 5 }, cookie);
  assert.deepEqual([full.status, full.body.error], [409, 'het_cho']);
  assert.equal((await call('POST', '/api/workshop/start', { specialtyId: 'toi_ly_son', quality: 'A', kg: 999 }, cookie)).status, 409);
  const early = await call('POST', `/api/workshop/collect/${j1.body.jobId}`, {}, cookie);
  assert.deepEqual([early.status, early.body.error], [409, 'chua_xong']);
  const ws = (await call('GET', '/api/workshop', undefined, cookie)).body;
  assert.equal(ws.jobs.length, PROCESS_SLOTS_XUONG);
  assert.deepEqual(ws.jobs.slice(0, 2).map((j: any) => [j.specialtyId, j.kgIn, j.kgOut]), [['toi_ly_son', 10, j1.body.kgOut], ['toi_ly_son', 10, j2.body.kgOut]]);

  await db.query(`update process_jobs set ready_at = now() - interval '1 second' where user_id = $1`, [me.user.id]);
  assert.equal((await call('POST', `/api/workshop/collect/${j1.body.jobId}`, {}, cookie)).status, 200);
  assert.equal((await call('POST', `/api/workshop/collect/${j2.body.jobId}`, {}, cookie)).status, 200);
  assert.equal((await call('POST', `/api/workshop/collect/${j2.body.jobId}`, {}, cookie)).status, 404);
  const total = j1.body.kgOut + j2.body.kgOut;
  assert.deepEqual((await call('GET', '/api/workshop', undefined, cookie)).body.products, [{ specialtyId: 'toi_ly_son', kg: total }]);
  assert.equal((await call('POST', '/api/workshop/sell', { specialtyId: 'toi_ly_son', kg: total + 1 }, cookie)).status, 409);
  const cash = (await meOf(cookie)).user.cash;
  const sell = await call('POST', '/api/workshop/sell', { specialtyId: 'toi_ly_son', kg: total }, cookie);
  const unit = Math.round((toiRef * recipe.value) / 100) * 100;
  assert.equal(sell.body.unitPrice, unit);
  assert.equal(sell.body.npcId, npcOf('che_bien').id);
  assert.equal((await meOf(cookie)).user.cash, cash + unit * total);
  // Chế biến lãi hơn bán tươi cho thương lái tại vườn.
  assert.ok(unit * j1.body.kgOut > npcPrice(toiRef, 'A', 'qng_lyson', 'qng_lyson') * 10);
  const fair = await callOn(fairApp, 'POST', '/api/workshop/start', { specialtyId: 'toi_ly_son', quality: 'A', kg: 10 }, cookie);
  await db.query(`update process_jobs set ready_at = now() - interval '1 second' where id = $1`, [fair.body.jobId]);
  await call('POST', `/api/workshop/collect/${fair.body.jobId}`, {}, cookie);
  assert.equal((await callOn(fairApp, 'POST', '/api/workshop/sell', { specialtyId: 'toi_ly_son', kg: 1 }, cookie)).body.unitPrice,
    Math.round((toiRef * recipe.value * (1 + MARKET_DAY_BONUS)) / 100) * 100, 'chợ phiên thì thành phẩm cũng được giá');

  // Vai khác không chế biến được, nhưng hàng dở trong xưởng vẫn lấy và bán được sau khi đổi vai.
  await setRole('tho_say', 'nong_dan');
  assert.equal((await call('GET', '/api/workshop', undefined, cookie)).body.slots, 0);
  const no = await call('POST', '/api/workshop/start', { specialtyId: 'toi_ly_son', quality: 'A', kg: 5 }, cookie);
  assert.deepEqual([no.status, no.body.error], [403, 'chi_chu_xuong']);
  const left = (await call('GET', '/api/workshop', undefined, cookie)).body.jobs;
  assert.ok(left.length > 0);
  assert.equal((await call('POST', `/api/workshop/collect/${left[0].id}`, {}, cookie)).status, 200);
  assert.equal((await call('POST', '/api/workshop/sell', { specialtyId: 'toi_ly_son', kg: 1 }, cookie)).status, 200);
});

test('chính vụ thêm sản lượng; được mùa mất giá tính cả diện tích đang trồng', async () => {
  const cookie = await signup('dung_vu');
  const ob = await call('POST', '/api/onboard', { regionId: 'sl_mocchau' }, cookie);
  const pid = await ripePlanting(ob.body.plotId, 0, 'xoai_yen_chau');
  const h = await callOn(seasonApp, 'POST', `/api/plantings/${pid}/step`, {}, cookie);
  assert.deepEqual(h.body.harvested, { specialtyId: 'xoai_yen_chau', quality: 'A', kg: Math.round(CROPS.xoai.yieldKg * IN_SEASON_YIELD), inSeason: true });
  const pid2 = await ripePlanting(ob.body.plotId, 0, 'xoai_yen_chau');
  assert.deepEqual((await call('POST', `/api/plantings/${pid2}/step`, {}, cookie)).body.harvested.kg, CROPS.xoai.yieldKg);

  const before = (await call('GET', '/api/prices')).body.prices.xoai_yen_chau;
  assert.deepEqual([before.planted, before.glut], [0, 1]);
  for (let tile = 0; tile < 30; tile++) await ripePlanting(ob.body.plotId, tile, 'xoai_yen_chau');
  const p = (await call('GET', '/api/prices')).body.prices.xoai_yen_chau;
  assert.equal(p.planted, 30);
  assert.equal(p.glut, glutFactor(supplyKg(0, 30, CROPS.xoai.yieldKg)));
  assert.ok(p.glut < 1);
  const me = await meOf(cookie);
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'xoai_yen_chau','B',5)`, [me.user.id]);
  await setRole('dung_vu', 'thuong_lai');
  const sell = await call('POST', '/api/sell/npc', { specialtyId: 'xoai_yen_chau', quality: 'B', kg: 1 }, cookie);
  assert.equal(sell.body.mods.glut, p.glut);
  assert.equal(sell.body.unitPrice, npcPrice(SPECIALTIES.xoai_yen_chau.refPrice, 'B', 'sl_mocchau', 'sl_mocchau', { glut: p.glut }));
});

test('phụ thu hoạch: khách du lịch đã tới vùng được chia phần, chưa tới thì không', async () => {
  const owner = await signup('chu_vuon_xa');
  const ob = await call('POST', '/api/onboard', { regionId: 'cb_trungkhanh' }, owner);
  const tourist = await signup('khach_du_lich');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, tourist);
  const pid = await ripePlanting(ob.body.plotId, 2, 'le_cao_bang');
  const no = await call('POST', `/api/plantings/${pid}/help`, {}, tourist);
  assert.deepEqual([no.status, no.body.error], [403, 'khong_phai_ban']);
  assert.equal((await call('POST', '/api/travel', { regionId: 'cb_trungkhanh' }, tourist)).status, 200);
  // Khách du lịch chỉ phụ thu hoạch, không làm các bước chăm sóc.
  const young = (await db.query(
    `insert into plantings (plot_id, tile, specialty_id, step_index, step_ready_at) values ($1, 3, 'le_cao_bang', 2, now() - interval '1 second') returning id`, [ob.body.plotId])).rows[0].id;
  assert.equal((await call('POST', `/api/plantings/${young}/help`, {}, tourist)).body.error, 'khong_phai_ban');
  const cash = (await meOf(tourist)).user.cash;
  const h = await call('POST', `/api/plantings/${pid}/help`, {}, tourist);
  const share = Math.max(1, Math.round(CROPS.le.yieldKg * HARVEST_HELP_SHARE));
  assert.deepEqual(h.body.harvested, { specialtyId: 'le_cao_bang', quality: 'A', kg: CROPS.le.yieldKg, share, inSeason: false });
  assert.deepEqual((await meOf(tourist)).inventory, [{ specialtyId: 'le_cao_bang', quality: 'A', kg: share }]);
  assert.deepEqual((await meOf(owner)).inventory, [{ specialtyId: 'le_cao_bang', quality: 'A', kg: CROPS.le.yieldKg - share }]);
  assert.equal((await meOf(tourist)).user.cash, cash, 'phụ thu hoạch nhận phần chia chứ không nhận tiền công');
  assert.ok((await call('GET', '/api/collection', undefined, tourist)).body.specialties.includes('le_cao_bang'));
  assert.ok((await call('GET', '/api/collection', undefined, owner)).body.specialties.includes('le_cao_bang'));
  assert.equal((await call('POST', `/api/plantings/${pid}/help`, {}, tourist)).status, 404);
});

test('đơn lớn của hợp tác xã: góp hàng, không vượt đơn, hoàn thành thì thưởng và nhận đơn mới', async () => {
  const a = await signup('htx_don_a'), b = await signup('htx_don_b'), lone = await signup('khong_htx');
  await call('POST', '/api/onboard', { regionId: 'ag_baynui' }, a);
  await call('POST', '/api/onboard', { regionId: 'ag_baynui' }, b);
  assert.equal((await call('POST', '/api/coops/order/contribute', { quality: 'A', kg: 1 }, lone)).body.error, 'chua_co_htx');
  const coop = await call('POST', '/api/coops', { name: 'HTX Thốt Nốt Đơn Lớn' }, a);
  assert.equal((await call('POST', `/api/coops/${coop.body.coopId}/join`, {}, b)).status, 200);
  const order = (await call('GET', '/api/coops/mine', undefined, a)).body.coop.order;
  assert.equal(order.kgTarget, COOP_ORDER_KG_PER_MEMBER * 2);
  assert.deepEqual([order.kgFilled, order.mine, order.npcId], [0, 0, npcOf('xuat_khau').id]);
  assert.equal(SPECIALTIES[order.specialtyId].regionId, 'ag_baynui');
  assert.ok(order.expiresAt > Date.now() + 6 * 86400_000);
  assert.equal((await call('GET', '/api/coops/mine', undefined, b)).body.coop.order.id, order.id, 'cả hợp tác xã chung một đơn');

  const ma = await meOf(a), mb = await meOf(b);
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,$3,'A',500), ($2,$3,'B',500)`, [ma.user.id, mb.user.id, order.specialtyId]);
  const over = await call('POST', '/api/coops/order/contribute', { quality: 'A', kg: order.kgTarget + 1 }, a);
  assert.deepEqual([over.status, over.body.error], [409, 'vuot_don']);
  const ref = SPECIALTIES[order.specialtyId].refPrice;
  const ca = await call('POST', '/api/coops/order/contribute', { quality: 'A', kg: 150 }, a);
  assert.deepEqual(ca.body, { paid: ref * 150, completed: false });
  assert.deepEqual((({ kgFilled, mine }) => [kgFilled, mine])((await call('GET', '/api/coops/mine', undefined, a)).body.coop.order), [150, 150]);
  const cb = await call('POST', '/api/coops/order/contribute', { quality: 'B', kg: 50 }, b);
  const paidB = Math.round(ref * 0.85 * 50);
  assert.deepEqual(cb.body, { paid: paidB, completed: true });
  assert.equal((await meOf(a)).user.cash, ma.user.cash + ref * 150 + Math.round(ref * 150 * COOP_ORDER_BONUS));
  assert.equal((await meOf(b)).user.cash, mb.user.cash + paidB + Math.round(paidB * COOP_ORDER_BONUS));
  const next = (await call('GET', '/api/coops/mine', undefined, a)).body.coop.order;
  assert.ok(next.id !== order.id && next.kgFilled === 0 && next.mine === 0);
  // Đơn quá hạn bị đóng và có đơn mới.
  await db.query(`update coop_orders set expires_at = now() - interval '1 minute' where id = $1`, [next.id]);
  assert.equal((await call('POST', '/api/coops/order/contribute', { quality: 'A', kg: 1 }, a)).body.error, 'khong_co_don');
  assert.ok((await call('GET', '/api/coops/mine', undefined, a)).body.coop.order.id !== next.id);
  assert.equal((await db.query('select status from coop_orders where id = $1', [next.id])).rows[0].status, 'expired');
});

test('đơn hàng cá nhân: tất định trong ngày, giao hàng hạng thấp trước, không giao hai lần', async () => {
  const cookie = await signup('nhan_don');
  assert.deepEqual((await call('GET', '/api/orders', undefined, cookie)).body.orders, []);
  await call('POST', '/api/onboard', { regionId: 'ld_dalat' }, cookie);
  const first = (await call('GET', '/api/orders', undefined, cookie)).body;
  assert.deepEqual((await call('GET', '/api/orders', undefined, cookie)).body, first, 'cùng ngày thì đơn không đổi');
  assert.equal(first.orders.length, ORDERS_PER_DAY);
  assert.ok(first.resetsAt > Date.now() && first.resetsAt <= Date.now() + 86400_000);
  const [o0, o1, o2] = first.orders;
  assert.deepEqual([o0.title, o1.title, o2.title], ['Đơn thu mua', 'Giỏ quà biếu', 'Mâm ngũ quả']);
  assert.deepEqual([o0.npcId, o1.npcId, o2.npcId], [npcOf('thuong_lai').id, npcOf('sieu_thi').id, npcOf('sieu_thi').id]);
  const regionOf = (it: any) => SPECIALTIES[it.specialtyId].regionId;
  assert.equal(o0.items.length, 1); assert.equal(regionOf(o0.items[0]), 'ld_dalat');
  assert.ok(o0.items[0].kg >= 10 && o0.items[0].kg <= 30);
  assert.equal(o1.items.length, 2); assert.equal(regionOf(o1.items[0]), 'ld_dalat');
  assert.ok(regionOf(o1.items[1]) !== 'ld_dalat' && REGIONS[regionOf(o1.items[1])].zone === 'taynguyen');
  assert.ok(o1.items.every((it: any) => it.kg >= 5 && it.kg <= 15));
  assert.equal(new Set(o2.items.map(regionOf)).size, 3); assert.ok(o2.items.map(regionOf).includes('ld_dalat'));
  assert.ok(o2.items.every((it: any) => it.kg >= 3 && it.kg <= 8));
  for (const o of first.orders) {
    assert.equal(o.done, false);
    assert.equal(o.reward, Math.round((o.items.reduce((n: number, it: any) => n + SPECIALTIES[it.specialtyId].refPrice * it.kg, 0) * ORDER_PREMIUM) / 1000) * 1000);
  }
  const other = await signup('nhan_don_khac');
  await call('POST', '/api/onboard', { regionId: 'ld_dalat' }, other);
  assert.notDeepEqual((await call('GET', '/api/orders', undefined, other)).body.orders.map((o: any) => o.items), first.orders.map((o: any) => o.items), 'mỗi người một bộ đơn');

  const short = await call('POST', '/api/orders/0/deliver', {}, cookie);
  assert.deepEqual([short.status, short.body.error], [409, 'khong_du_hang']);
  assert.equal((await call('GET', '/api/orders', undefined, cookie)).body.orders[0].done, false, 'thiếu hàng thì đơn vẫn còn');
  const me = await meOf(cookie), it = o0.items[0];
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,$2,'C',$3), ($1,$2,'A',$4)`, [me.user.id, it.specialtyId, it.kg - 2, 7]);
  const ok = await call('POST', '/api/orders/0/deliver', {}, cookie);
  assert.deepEqual(ok.body, { reward: o0.reward });
  const after = await meOf(cookie);
  assert.equal(after.user.cash, me.user.cash + o0.reward);
  assert.deepEqual(after.inventory, [{ specialtyId: it.specialtyId, quality: 'A', kg: 5 }], 'lấy hết hạng thấp rồi mới tới hạng cao');
  const again = await call('POST', '/api/orders/0/deliver', {}, cookie);
  assert.deepEqual([again.status, again.body.error], [409, 'da_giao']);
  assert.equal((await call('GET', '/api/orders', undefined, cookie)).body.orders[0].done, true);
  assert.equal((await call('POST', '/api/orders/9/deliver', {}, cookie)).status, 404);
});

test('hàm thuần: trọng số vòng quay, ô theo vai, chuyến xe, cá nhân hoá', () => {
  const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
  const empty = spinWeights(ROLE_TARGETS.rural, { nong_dan: 0, xuong: 0, thuong_lai: 0 });
  assert.ok(Math.abs(sum(empty) - 1) < 1e-9);
  for (const r of ROLES) assert.ok(Math.abs(empty[r] - ROLE_TARGETS.rural[r]) < 1e-9, 'chưa có ai thì đúng tỉ lệ mong muốn');
  // Vùng toàn nhà vườn: vòng quay nghiêng mạnh về hai vai đang thiếu.
  const lopsided = spinWeights(ROLE_TARGETS.rural, { nong_dan: 20, xuong: 0, thuong_lai: 0 });
  assert.ok(Math.abs(sum(lopsided) - 1) < 1e-9);
  assert.ok(lopsided.nong_dan < ROLE_TARGETS.rural.nong_dan && lopsided.xuong > ROLE_TARGETS.rural.xuong && lopsided.thuong_lai > ROLE_TARGETS.rural.thuong_lai);
  // Đúng tỉ lệ thì giữ nguyên.
  const balanced = spinWeights(ROLE_TARGETS.urban, { nong_dan: 30, xuong: 30, thuong_lai: 40 });
  for (const r of ROLES) assert.ok(Math.abs(balanced[r] - ROLE_TARGETS.urban[r]) < 1e-9);
  assert.ok(Math.abs(sum(ROLE_TARGETS.rural) - 1) < 1e-9 && Math.abs(sum(ROLE_TARGETS.urban) - 1) < 1e-9);
  assert.equal(SEASON_DAYS, 30);

  assert.deepEqual(SMALL_TILES, [7, 8, 9, 10, 13, 14, 15, 16]);
  assert.deepEqual(allowedTiles('ground', null), []);
  assert.equal(allowedTiles('ground', 'nong_dan').length, 30);
  assert.deepEqual(allowedTiles('rooftop', 'nong_dan'), ROOFTOP_TILES);
  assert.deepEqual(allowedTiles('ground', 'xuong'), SMALL_TILES);
  assert.deepEqual(allowedTiles('rooftop', 'thuong_lai'), SMALL_TILES);

  const sea = tripInfo('dt_caibe', 'qng_lyson');
  assert.equal(sea.needsBoat, true, 'ra đảo phải qua bến tàu');
  assert.equal(tripInfo('qng_lyson', 'dt_caibe').needsBoat, true);
  const near = tripInfo('dt_caibe', 'dt_caolanh');
  assert.equal(near.needsBoat, false);
  const nearPlan = tripPlan('dt_caibe', 'dt_caolanh');
  assert.equal(near.fuel, Math.round((nearPlan.fuelNeededL * TRUCK.fuelPrice + nearPlan.tolls * TRUCK.tollFee) / 1000) * 1000, 'fuel = ước tính xăng + phí đường');
  assert.ok(near.fuel > 0 && sea.fuel > near.fuel);
  assert.ok(FUEL_PER_KM > 0);
  for (const from of Object.keys(REGIONS)) {
    const t = tripInfo(from, 'hn_phudien');
    assert.ok(t.seconds >= 30 && t.seconds <= 75, `thời lượng màn lái ngoài khoảng: ${from}`);
  }

  assert.equal(cleanName('  Vườn   <b>chú</b>\u0000 Tư  '), 'Vườn b chú /b Tư');
  assert.equal([...cleanName('x'.repeat(60))].length, 24);
  assert.equal(validStyle({ ...DEFAULT_STYLE, roof: '#000000' }), null);
  assert.deepEqual(validStyle({ ...DEFAULT_STYLE, gateName: ' Vườn  nhà ' }), { ...DEFAULT_STYLE, gateName: 'Vườn nhà' });
  assert.equal(validDecor([{ item: 'chau_hoa', x: 0, z: 0, rot: 0 }]), null, 'không đặt trong ruộng');
  assert.equal(validDecor([{ item: 'chau_hoa', x: 0, z: -10, rot: 0 }]), null, 'không đặt trong nhà');
  assert.equal(validDecor([{ item: 'chau_hoa', x: 12, z: 7, rot: 0 }]), null, 'không đặt ngoài lô');
  assert.equal(validDecor([{ item: 'chau_hoa', x: 8, z: 7, rot: 1 }]), null, 'góc xoay phải là bội của 90 độ');
  assert.equal(validDecor([{ item: 'khong_co', x: 8, z: 7, rot: 0 }]), null);
  assert.deepEqual(validDecor([{ item: 'chau_hoa', x: 8.04, z: 7.26, rot: Math.PI / 2 }]), [{ item: 'chau_hoa', x: 8, z: 7.3, rot: Math.PI / 2 }]);
  assert.equal(DECOR_ITEMS.length, 10);
  assert.equal(HOUSE_TYPES[0].price, 0);
});

test('vòng quay vai trò: cần có đất, kết quả do vòng quay, mỗi mùa một lần, nghiêng về vai đang thiếu', async () => {
  const cookie = await signupRaw('nguoi_quay');
  assert.equal((await meOf(cookie)).user.role, null);
  assert.equal((await callOn(spinApp, 'POST', '/api/role/spin', {}, cookie)).body.error, 'chua_co_dat');
  const ob = await call('POST', '/api/onboard', { regionId: 'lch_tamduong' }, cookie);
  const noRole = await call('POST', `/api/plots/${ob.body.plotId}/plant`, { tile: SMALL_TILES[0], specialtyId: 'che_tam_duong' }, cookie);
  assert.deepEqual([noRole.status, noRole.body.error], [409, 'chua_co_vai']);

  nextRole = 'xuong';
  const spin = await callOn(spinApp, 'POST', '/api/role/spin', {}, cookie);
  assert.equal(spin.status, 200, JSON.stringify(spin.body));
  assert.equal(spin.body.role, 'xuong');
  for (const r of ROLES) assert.ok(Math.abs(spin.body.weights[r] - ROLE_TARGETS.rural[r]) < 1e-9, 'vùng chưa có ai thì đúng tỉ lệ nông thôn');
  assert.ok(Math.abs(spin.body.nextSpinAt - Date.now() - SEASON_DAYS * 86400_000) < 5000);
  const me = await meOf(cookie);
  assert.deepEqual([me.user.role, me.user.truckRegionId, me.user.avatar], ['xuong', 'lch_tamduong', null]);
  assert.equal(me.user.roleNextSpinAt, spin.body.nextSpinAt);
  assert.equal((await call('GET', `/api/plots/${ob.body.plotId}`, undefined, cookie)).body.plot.ownerRole, 'xuong');
  const again = await callOn(spinApp, 'POST', '/api/role/spin', {}, cookie);
  assert.deepEqual([again.status, again.body.error], [409, 'chua_den_mua']);

  // Hết mùa thì quay lại được, và vai mới có hiệu lực.
  await db.query(`update users set role_assigned_at = now() - interval '31 days' where username = 'nguoi_quay'`);
  nextRole = 'thuong_lai';
  assert.equal((await callOn(spinApp, 'POST', '/api/role/spin', {}, cookie)).body.role, 'thuong_lai');
  assert.equal((await meOf(cookie)).user.role, 'thuong_lai');

  // Người mới vào một vùng toàn thương lái còn chơi: vòng quay nghiêng khỏi vai đó. Người lâu không vào thì không tính.
  const idle = await signup('thuong_lai_cu', 'thuong_lai');
  await call('POST', '/api/onboard', { regionId: 'lch_tamduong' }, idle);
  await db.query(`update users set last_seen_at = now() - interval '8 days' where username = 'thuong_lai_cu'`);
  const fresh = await signupRaw('nguoi_moi');
  await call('POST', '/api/onboard', { regionId: 'lch_tamduong' }, fresh);
  nextRole = 'nong_dan';
  const spin2 = await callOn(spinApp, 'POST', '/api/role/spin', {}, fresh);
  assert.equal(spin2.body.role, 'nong_dan');
  assert.deepEqual(spin2.body.weights, spinWeights(ROLE_TARGETS.rural, { nong_dan: 0, xuong: 0, thuong_lai: 1 }));
  assert.deepEqual(lastWeights, spin2.body.weights);
  assert.ok(spin2.body.weights.thuong_lai < ROLE_TARGETS.rural.thuong_lai);

  // Ở phố thì dùng tỉ lệ đô thị.
  const pho = await signupRaw('quay_o_pho');
  await call('POST', '/api/onboard', { lat: 16.06, lng: 108.22, rooftop: true }, pho);
  const spin3 = await callOn(spinApp, 'POST', '/api/role/spin', {}, pho);
  const cityMates = await db.query(`select role, count(*)::int as n from users where home_region_id = (select home_region_id from users where username = 'quay_o_pho') and username <> 'quay_o_pho' and role is not null group by role`);
  const counts = { nong_dan: 0, xuong: 0, thuong_lai: 0 } as Record<RoleId, number>;
  for (const r of cityMates.rows) counts[r.role as RoleId] = r.n;
  assert.deepEqual(spin3.body.weights, spinWeights(ROLE_TARGETS.urban, counts));
});

test('ô trồng theo vai: thương lái và chủ xưởng chỉ có vườn nhỏ, cây cũ ở ô bị khoá vẫn chăm được', async () => {
  const cookie = await signup('vuon_nho', 'thuong_lai');
  const ob = await call('POST', '/api/onboard', { regionId: 'qng_lyson' }, cookie);
  const locked = await call('POST', `/api/plots/${ob.body.plotId}/plant`, { tile: 0, specialtyId: 'hanh_ly_son' }, cookie);
  assert.deepEqual([locked.status, locked.body.error], [409, 'o_bi_khoa']);
  assert.equal((await call('POST', `/api/plots/${ob.body.plotId}/plant`, { tile: SMALL_TILES[0], specialtyId: 'hanh_ly_son' }, cookie)).status, 200);
  await setRole('vuon_nho', 'xuong');
  assert.equal((await call('POST', `/api/plots/${ob.body.plotId}/plant`, { tile: 29, specialtyId: 'hanh_ly_son' }, cookie)).body.error, 'o_bi_khoa');
  assert.equal((await call('POST', `/api/plots/${ob.body.plotId}/plant`, { tile: SMALL_TILES[7], specialtyId: 'hanh_ly_son' }, cookie)).status, 200);
  // Cây trồng từ khi còn là nhà vườn nằm ở ô nay bị khoá: vẫn thu hoạch được.
  const old = await ripePlanting(ob.body.plotId, 0, 'hanh_ly_son');
  assert.equal((await call('POST', `/api/plantings/${old}/step`, {}, cookie)).body.harvested.kg, CROPS.hanh.yieldKg);
  await setRole('vuon_nho', 'nong_dan');
  assert.equal((await call('POST', `/api/plots/${ob.body.plotId}/plant`, { tile: 29, specialtyId: 'hanh_ly_son' }, cookie)).status, 200);
});

test('giá đất theo vùng: trong khoảng 15–200 triệu, vùng giá trị cao đắt hơn, đảo đắt hơn', async () => {
  const prices = Object.keys(REGIONS).map((id) => landPrice(id));
  for (const id of Object.keys(REGIONS)) {
    const p = landPrice(id);
    assert.ok(p >= 15_000_000 && p <= 200_000_000 && p % 1_000_000 === 0, `giá đất ngoài khoảng: ${id} ${p}`);
    assert.equal(landPrice(id), p, 'tính một lần, lần sau như cũ');
  }
  assert.ok(Math.max(...prices) >= Math.min(...prices) * 2, 'vùng giá trị cao phải đắt hơn hẳn vùng giá trị thấp');
  // Chỉ số giá trị của vùng = trung bình (giá × sản lượng / giờ trồng) của các đặc sản; đất đắt theo đúng thứ tự đó.
  const value = (id: string) => {
    const sps = Object.values(SPECIALTIES).filter((sp) => sp.regionId === id);
    return sps.reduce((sum, sp) => sum + (sp.refPrice * CROPS[sp.crop].yieldKg) / CROPS[sp.crop].growHours, 0) / sps.length;
  };
  const land = Object.values(REGIONS).filter((r) => !r.island).sort((x, y) => value(x.id) - value(y.id));
  for (let i = 1; i < land.length; i++) assert.ok(landPrice(land[i].id) >= landPrice(land[i - 1].id), `sai thứ tự giá đất: ${land[i].id}`);
  const vals = Object.keys(REGIONS).map(value).sort((x, y) => x - y), n = vals.length;
  const median = n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2;
  for (const r of Object.values(REGIONS)) {
    const raw = 50_000_000 * Math.pow(value(r.id) / median, 0.7) * (r.island ? 1.3 : 1);
    assert.equal(landPrice(r.id), Math.min(200_000_000, Math.max(15_000_000, Math.round(raw / 1_000_000) * 1_000_000)), `đảo nhân 1,3: ${r.id}`);
  }
  assert.ok(Object.values(REGIONS).some((r) => r.island));

  // Mua đất trừ đúng giá của vùng.
  const cookie = await signup('mua_dat_vung');
  await call('POST', '/api/onboard', { regionId: 'ld_dalat' }, cookie);
  const me = await meOf(cookie);
  const cheap = land[0].id === 'ld_dalat' ? land[1].id : land[0].id;
  await db.query('update users set cash = $2 where id = $1', [me.user.id, landPrice(cheap) - 1]);
  assert.equal((await call('POST', '/api/plots/buy', { regionId: cheap }, cookie)).body.error, 'khong_du_tien');
  await db.query('update users set cash = $2 where id = $1', [me.user.id, landPrice(cheap) + 500]);
  assert.equal((await call('POST', '/api/plots/buy', { regionId: cheap }, cookie)).status, 200);
  assert.equal((await meOf(cookie)).user.cash, 500);
  const led = await db.query('select delta from ledger where user_id = $1 and reason = $2', [me.user.id, `mua_dat:${cheap}`]);
  assert.equal(led.rows[0].delta, -landPrice(cheap));
});

test('lộ trình xe tải: tất định, nút giao cuối là lối ra, trạm thu phí và trạm xăng chỉ ở đường bộ', () => {
  const ids = Object.keys(REGIONS);
  for (const from of ['dt_caibe', 'hn_phudien', 'qng_lyson', 'ld_dalat']) {
    for (const to of ids) {
      if (to === from) continue;
      const p = tripPlan(from, to), info = tripInfo(from, to);
      assert.deepEqual(tripPlan(from, to), p, 'cùng cặp vùng phải ra cùng lộ trình');
      const road = roadKm(p.km, p.needsBoat);
      assert.deepEqual([p.km, p.needsBoat, p.seconds], [info.km, info.needsBoat, info.seconds]);
      assert.equal(p.needsBoat, !!(REGIONS[from].island || REGIONS[to].island));
      assert.equal(road, p.needsBoat ? Math.round(p.km * 0.6) : p.km);
      assert.equal(p.tolls, road >= 40 ? Math.max(1, Math.floor(road / TRUCK.tollEveryKm)) : 0, `${from}>${to}`);
      assert.equal(p.tollFee, TRUCK.tollFee);
      assert.equal(p.fuelNeededL, Math.round(road * TRUCK.lPer100km / 10) / 10);
      assert.ok(p.junctions.length >= 2 && p.junctions.length <= 5);
      assert.equal(p.junctions[p.junctions.length - 1].name, `Lối ra ${REGIONS[to].name}`);
      p.junctions.forEach((j, i) => {
        assert.ok(j.dir === 'L' || j.dir === 'R');
        assert.ok(j.atKm >= 0 && j.atKm <= road && (i === 0 || j.atKm >= p.junctions[i - 1].atKm), `nút giao ngoài đường bộ: ${from}>${to}`);
        if (i < p.junctions.length - 1) assert.match(j.name, /^Nút giao /);
      });
      assert.deepEqual(p.stationsAtKm, Array.from({ length: Math.max(0, Math.ceil(road / TRUCK.stationEveryKm) - 1) }, (_, i) => (i + 1) * TRUCK.stationEveryKm));
      assert.ok(p.stationsAtKm.every((k) => k > 0 && k < road), `trạm xăng nằm ngoài biển: ${from}>${to}`);
    }
  }
  const far = tripPlan('dt_caibe', 'hn_phudien'), near = tripPlan('dt_caibe', 'dt_caolanh');
  assert.ok(far.junctions.length > near.junctions.length && far.tolls > near.tolls && far.stationsAtKm.length > near.stationsAtKm.length);
  const dirs = new Set(ids.filter((id) => id !== 'dt_caibe').flatMap((id) => tripPlan('dt_caibe', id).junctions.map((j) => j.dir)));
  assert.equal(dirs.size, 2, 'có cả rẽ trái lẫn rẽ phải');
});

test('xe tải: nạp ETC, đổ xăng, cứu hộ khi thiếu xăng, phí đường trừ ETC trước rồi tới tiền mặt có phụ thu', async () => {
  const farmer = await signup('nd_khong_xe');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, farmer);
  assert.deepEqual([(await call('POST', '/api/truck/etc', { amount: 50_000 }, farmer)).status, (await call('POST', '/api/truck/refuel', { liters: 5 }, farmer)).body.error], [403, 'chi_thuong_lai']);

  const cookie = await signup('tai_xe_etc', 'thuong_lai');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, cookie);
  const id = (await meOf(cookie)).user.id;
  const setUser = (cash: number, fuel: number, etc: number) => db.query('update users set cash = $2, fuel_l = $3, etc = $4 where id = $1', [id, cash, fuel, etc]);

  // Nạp ETC.
  await setUser(100_000, 30, 0);
  assert.equal((await call('POST', '/api/truck/etc', { amount: 9_999 }, cookie)).status, 400);
  assert.equal((await call('POST', '/api/truck/etc', { amount: 5_000_001 }, cookie)).status, 400);
  const poor = await call('POST', '/api/truck/etc', { amount: 100_001 }, cookie);
  assert.deepEqual([poor.status, poor.body.error], [409, 'khong_du_tien']);
  assert.deepEqual((await call('POST', '/api/truck/etc', { amount: 60_000 }, cookie)).body, { etc: 60_000, cash: 40_000 });
  assert.equal((await db.query(`select delta from ledger where user_id = $1 and reason = 'nap_etc'`, [id])).rows[0].delta, -60_000);

  // Đổ xăng: tối đa tới đầy bình.
  assert.equal((await call('POST', '/api/truck/refuel', { liters: 0 }, cookie)).status, 400);
  assert.equal((await call('POST', '/api/truck/refuel', { liters: 'abc' }, cookie)).status, 400);
  const noCash = await call('POST', '/api/truck/refuel', { liters: 10 }, cookie);
  assert.deepEqual([noCash.status, noCash.body.error], [409, 'khong_du_tien']);
  await setUser(2_000_000, 30, 60_000);
  assert.deepEqual((await call('POST', '/api/truck/refuel', { liters: 4.5 }, cookie)).body, { fuelL: 34.5, cost: Math.round(4.5 * TRUCK.fuelPrice), cash: 2_000_000 - Math.round(4.5 * TRUCK.fuelPrice) });
  const fill = await call('POST', '/api/truck/refuel', { liters: 500 }, cookie);
  assert.deepEqual([fill.body.fuelL, fill.body.cost], [TRUCK.tankL, Math.round(25.5 * TRUCK.fuelPrice)]);
  const full = await call('POST', '/api/truck/refuel', { liters: 1 }, cookie);
  assert.deepEqual([full.status, full.body.error], [409, 'binh_day']);
  let me = await meOf(cookie);
  assert.deepEqual([me.user.fuelL, me.user.etc, me.user.cash], [TRUCK.tankL, 60_000, 2_000_000 - 30 * TRUCK.fuelPrice]);
  assert.equal((await db.query(`select sum(delta)::bigint as d from ledger where user_id = $1 and reason = 'do_xang'`, [id])).rows[0].d, -30 * TRUCK.fuelPrice);

  // Chuyến xa: bình 60 lít + đổ dọc đường 20 lít vẫn thiếu → cứu hộ giá gấp rưỡi; ETC không đủ → phần thiếu trả tiền mặt +20%.
  const plan = tripPlan('dt_caibe', 'hn_phudien'), road = roadKm(plan.km, plan.needsBoat);
  const cash0 = 20_000_000;
  await setUser(cash0, 60, 60_000);
  const trip = await call('POST', '/api/trips/start', { toRegionId: 'hn_phudien' }, cookie);
  assert.deepEqual([trip.body.fuelL, trip.body.etc, trip.body.cash], [60, 60_000, cash0]);
  assert.deepEqual(trip.body.plan, plan);
  const used = ((road + 25) * TRUCK.lPer100km) / 100, rescue = used - 80;
  assert.ok(rescue > 0 && plan.tolls * TRUCK.tollFee > 60_000);
  const fuelCost = Math.round(20 * TRUCK.fuelPrice + rescue * TRUCK.fuelPrice * TRUCK.rescueMult);
  const tollCash = Math.round((plan.tolls * TRUCK.tollFee - 60_000) * (1 + TRUCK.etcCashSurcharge));
  const done = await callOn(spinApp, 'POST', `/api/trips/${trip.body.tripId}/finish`, { refuelL: 20, detourKm: 25 }, cookie);
  assert.deepEqual(done.body, {
    regionId: 'hn_phudien', fuelUsedL: Math.round(used * 10) / 10, fuelCost, rescueL: Math.round(rescue * 10) / 10,
    tollCost: 60_000 + tollCash, tollFromEtc: 60_000, fuelL: 0, etc: 0, cash: cash0 - fuelCost - tollCash,
  });
  me = await meOf(cookie);
  assert.deepEqual([me.user.fuelL, me.user.etc, me.user.cash, me.user.truckRegionId], [0, 0, cash0 - fuelCost - tollCash, 'hn_phudien']);
  const led = await db.query(`select reason, delta from ledger where user_id = $1 and reason in ('xang:hn_phudien','phi_duong:hn_phudien') order by reason`, [id]);
  assert.deepEqual(led.rows, [{ reason: 'phi_duong:hn_phudien', delta: -tollCash }, { reason: 'xang:hn_phudien', delta: -fuelCost }]);
  const stuck = await call('POST', '/api/trips/start', { toRegionId: 'dt_caibe' }, cookie);
  assert.deepEqual([stuck.status, stuck.body.error], [409, 'het_xang']);

  // ETC đủ thì không tốn tiền mặt; đổ dư xăng thì bình chỉ đầy tới 60 lít; vòng lạc bị chặn theo quãng đường bộ.
  const back = tripPlan('hn_phudien', 'hp_thanhha'), backRoad = roadKm(back.km, back.needsBoat);
  await setUser(9_000_000, 40, 1_000_000);
  const t2 = await call('POST', '/api/trips/start', { toRegionId: 'hp_thanhha' }, cookie);
  const d2 = await callOn(spinApp, 'POST', `/api/trips/${t2.body.tripId}/finish`, { refuelL: 9999, detourKm: 99999 }, cookie);
  const used2 = (backRoad * 2 * TRUCK.lPer100km) / 100;
  assert.deepEqual(d2.body, {
    regionId: 'hp_thanhha', fuelUsedL: Math.round(used2 * 10) / 10, fuelCost: TRUCK.tankL * 4 * TRUCK.fuelPrice, rescueL: 0,
    tollCost: back.tolls * TRUCK.tollFee, tollFromEtc: back.tolls * TRUCK.tollFee, fuelL: TRUCK.tankL,
    etc: 1_000_000 - back.tolls * TRUCK.tollFee, cash: 9_000_000 - TRUCK.tankL * 4 * TRUCK.fuelPrice,
  });

  // Hết tiền vẫn tới nơi: trừ tới 0 chứ không chặn.
  await setUser(10_000, 1, 0);
  const t3 = await call('POST', '/api/trips/start', { toRegionId: 'hn_phudien' }, cookie);
  const d3 = await callOn(spinApp, 'POST', `/api/trips/${t3.body.tripId}/finish`, { refuelL: -5, detourKm: 'x' }, cookie);
  assert.equal(d3.status, 200, JSON.stringify(d3.body));
  assert.deepEqual([d3.body.cash, d3.body.regionId, d3.body.fuelL], [0, 'hn_phudien', 0]);
  assert.ok(d3.body.rescueL > 0 && d3.body.fuelCost + (d3.body.tollCost - d3.body.tollFromEtc) === 10_000);
});

test('chuyến xe: chỉ thương lái, tốn xăng, phải lái tới nơi; bán theo vùng xe đang đỗ', async () => {
  const farmer = await signup('khong_co_xe');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, farmer);
  const no = await call('POST', '/api/trips/start', { toRegionId: 'dt_caolanh' }, farmer);
  assert.deepEqual([no.status, no.body.error], [403, 'chi_thuong_lai']);

  const cookie = await signup('tai_xe', 'thuong_lai');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, cookie);
  const start0 = await meOf(cookie);
  assert.equal(start0.user.truckRegionId, 'dt_caibe');
  assert.equal((await call('POST', '/api/trips/start', { toRegionId: 'dt_caibe' }, cookie)).status, 400, 'xe đang ở đó rồi');
  assert.equal((await call('POST', '/api/trips/start', { toRegionId: 'khong_co' }, cookie)).status, 400);
  assert.deepEqual([start0.user.fuelL, start0.user.etc], [TRUCK.startFuelL, 0]);
  await db.query('update users set fuel_l = 0 where id = $1', [start0.user.id]);
  const dry = await call('POST', '/api/trips/start', { toRegionId: 'dt_caolanh' }, cookie);
  assert.deepEqual([dry.status, dry.body.error], [409, 'het_xang']);
  await db.query('update users set fuel_l = 30 where id = $1', [start0.user.id]);

  const info = tripInfo('dt_caibe', 'dt_caolanh');
  const trip = await call('POST', '/api/trips/start', { toRegionId: 'dt_caolanh' }, cookie);
  assert.equal(trip.status, 200, JSON.stringify(trip.body));
  const plan = tripPlan('dt_caibe', 'dt_caolanh');
  assert.deepEqual({ ...trip.body, tripId: 0 }, { tripId: 0, fromRegionId: 'dt_caibe', toRegionId: 'dt_caolanh', plan, fuelL: 30, etc: 0, cash: START_CASH, truck: TRUCK });
  assert.equal((await meOf(cookie)).user.cash, START_CASH, 'xuất phát không trừ tiền trước');
  assert.ok(info.fuel > 0);
  const early = await call('POST', `/api/trips/${trip.body.tripId}/finish`, {}, cookie);
  assert.deepEqual([early.status, early.body.error], [409, 'chua_toi_noi']);
  assert.equal((await callOn(spinApp, 'POST', `/api/trips/${trip.body.tripId}/finish`, {}, farmer)).status, 404, 'không phải chuyến của mình');
  // Tới nơi: xăng trừ theo quãng đường; chưa nạp ETC nên phí đường trả tiền mặt có phụ thu.
  const usedL = (roadKm(plan.km, false) * TRUCK.lPer100km) / 100;
  assert.ok(usedL < 30 && plan.tolls >= 1);
  const tollCash = Math.round(plan.tolls * TRUCK.tollFee * (1 + TRUCK.etcCashSurcharge));
  assert.deepEqual((await callOn(spinApp, 'POST', `/api/trips/${trip.body.tripId}/finish`, {}, cookie)).body, {
    regionId: 'dt_caolanh', fuelUsedL: Math.round(usedL * 10) / 10, fuelCost: 0, rescueL: 0, tollCost: tollCash, tollFromEtc: 0,
    fuelL: Math.round((30 - usedL) * 10) / 10, etc: 0, cash: START_CASH - tollCash, fineCost: 0, fines: [],
  });
  assert.equal((await meOf(cookie)).user.cash, START_CASH - tollCash);
  assert.equal((await callOn(spinApp, 'POST', `/api/trips/${trip.body.tripId}/finish`, {}, cookie)).status, 404, 'chuyến đã xong');
  assert.equal((await meOf(cookie)).user.truckRegionId, 'dt_caolanh');
  assert.ok((await call('GET', '/api/travel', undefined, cookie)).body.visited.includes('dt_caolanh'), 'tới nơi thì được ghi là đã tới');

  // Xe đỗ ở Cao Lãnh: xoài Cao Lãnh là hàng tại vườn, xoài Hòa Lộc của vùng nhà lại thành hàng phương xa.
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'xoai_cao_lanh','A',2), ($1,'xoai_hoa_loc','A',2)`, [start0.user.id]);
  const there = await call('POST', '/api/sell/npc', { specialtyId: 'xoai_cao_lanh', quality: 'A', kg: 1 }, cookie);
  assert.deepEqual([there.body.dump, there.body.marketRegionId], [false, 'dt_caolanh']);
  assert.equal(there.body.unitPrice, npcPrice(SPECIALTIES.xoai_cao_lanh.refPrice, 'A', 'dt_caolanh', 'dt_caolanh', there.body.mods));
  const carried = await call('POST', '/api/sell/npc', { specialtyId: 'xoai_hoa_loc', quality: 'A', kg: 1 }, cookie);
  assert.equal(carried.body.unitPrice, npcPrice(SPECIALTIES.xoai_hoa_loc.refPrice, 'A', 'dt_caibe', 'dt_caolanh', carried.body.mods));
  assert.ok(carried.body.unitPrice > SPECIALTIES.xoai_hoa_loc.refPrice, 'chở đi vùng khác thì được giá hàng phương xa');
  // Người bán tháo luôn thấp hơn thương lái bán tại vườn.
  const farmerMe = await meOf(farmer);
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'xoai_hoa_loc','B',1)`, [farmerMe.user.id]);
  const dump = await call('POST', '/api/sell/npc', { specialtyId: 'xoai_hoa_loc', quality: 'B', kg: 1 }, farmer);
  assert.equal(dump.body.dump, true);
  assert.equal(dump.body.unitPrice, Math.round((SPECIALTIES.xoai_hoa_loc.refPrice * DUMP_RATIO * 0.85) / 100) * 100);
  assert.ok(dump.body.unitPrice < npcPrice(SPECIALTIES.xoai_hoa_loc.refPrice, 'B', 'dt_caibe', 'dt_caibe'));
});

test('cá nhân hoá: kiểu nhà, màu, tên, đồ trang trí, nhân vật; người khác nhìn thấy', async () => {
  const cookie = await signup('chu_nha'), guest = await signup('khach_tham');
  const ob = await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, cookie);
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, guest);
  const plotId = ob.body.plotId;
  const paid = HOUSE_TYPES.find((h) => h.price > 0)!;

  assert.equal((await call('POST', `/api/plots/${plotId}/style`, { ...DEFAULT_STYLE, wall: 'do' }, cookie)).status, 400);
  assert.equal((await call('POST', `/api/plots/${plotId}/style`, DEFAULT_STYLE, guest)).status, 404, 'không sửa được lô của người khác');
  const free = await call('POST', `/api/plots/${plotId}/style`, { ...DEFAULT_STYLE, roof: ROOF_COLORS[3], gateName: '  Vườn <chú> Tư ', stallName: 'Sạp Xoài Ngọt' }, cookie);
  assert.equal(free.status, 200, JSON.stringify(free.body));
  assert.deepEqual(free.body, { style: { ...DEFAULT_STYLE, roof: ROOF_COLORS[3], gateName: 'Vườn chú Tư', stallName: 'Sạp Xoài Ngọt' }, ownedHouses: [HOUSE_TYPES[0].id], cost: 0 });
  const buy = await call('POST', `/api/plots/${plotId}/style`, { ...DEFAULT_STYLE, house: paid.id }, cookie);
  assert.deepEqual([buy.body.cost, buy.body.ownedHouses], [paid.price, [HOUSE_TYPES[0].id, paid.id]]);
  assert.equal((await meOf(cookie)).user.cash, START_CASH - paid.price);
  // Đổi về kiểu cũ rồi đổi lại kiểu đã mua: không tính tiền lần nữa.
  assert.equal((await call('POST', `/api/plots/${plotId}/style`, DEFAULT_STYLE, cookie)).body.cost, 0);
  assert.equal((await call('POST', `/api/plots/${plotId}/style`, { ...DEFAULT_STYLE, house: paid.id, gateName: 'Vườn chú Tư' }, cookie)).body.cost, 0);
  assert.equal((await meOf(cookie)).user.cash, START_CASH - paid.price);
  await db.query('update users set cash = 0 where username = $1', ['khach_tham']);
  const guestPlot = (await meOf(guest)).plots[0].id;
  assert.equal((await call('POST', `/api/plots/${guestPlot}/style`, { ...DEFAULT_STYLE, house: paid.id }, guest)).body.error, 'khong_du_tien');

  const pot = DECOR_ITEMS.find((d) => d.id === 'chau_hoa')!, pond = DECOR_ITEMS.find((d) => d.id === 'ao_ca')!;
  assert.equal((await call('POST', `/api/plots/${plotId}/decor`, { items: [{ item: 'chau_hoa', x: 0, z: 0, rot: 0 }] }, cookie)).status, 400, 'không đặt trong ruộng');
  const d1 = await call('POST', `/api/plots/${plotId}/decor`, { items: [{ item: 'chau_hoa', x: 8, z: 7, rot: 0 }, { item: 'chau_hoa', x: -8, z: 7, rot: 0 }] }, cookie);
  assert.equal(d1.body.cost, pot.price * 2);
  // Dời chỗ không tốn tiền; thêm món mới chỉ tính món mới; bỏ món không hoàn tiền.
  const d2 = await call('POST', `/api/plots/${plotId}/decor`, { items: [{ item: 'chau_hoa', x: 8, z: 6, rot: Math.PI }, { item: 'chau_hoa', x: -8, z: 7, rot: 0 }, { item: 'ao_ca', x: 8, z: -10, rot: 0 }] }, cookie);
  assert.equal(d2.body.cost, pond.price);
  const d3 = await call('POST', `/api/plots/${plotId}/decor`, { items: [{ item: 'ao_ca', x: 8, z: -10, rot: 0 }] }, cookie);
  assert.deepEqual([d3.body.cost, d3.body.decor], [0, [{ item: 'ao_ca', x: 8, z: -10, rot: 0 }]]);
  assert.equal((await meOf(cookie)).user.cash, START_CASH - paid.price - pot.price * 2 - pond.price);
  assert.equal((await call('POST', `/api/plots/${guestPlot}/decor`, { items: [{ item: 'ao_ca', x: 8, z: -10, rot: 0 }] }, guest)).body.error, 'khong_du_tien');
  assert.equal((await call('POST', `/api/plots/${plotId}/decor`, { items: [] }, guest)).status, 404);

  assert.equal((await call('POST', '/api/avatar', { ...DEFAULT_AVATAR, hat: 'vuong_mien' }, cookie)).status, 400);
  const av = await call('POST', '/api/avatar', { ...DEFAULT_AVATAR, hat: 'khan_ran' }, cookie);
  assert.deepEqual(av.body, { avatar: { ...DEFAULT_AVATAR, hat: 'khan_ran' } });
  assert.deepEqual((await meOf(cookie)).user.avatar, { ...DEFAULT_AVATAR, hat: 'khan_ran' });

  // Khách ghé thăm và hàng xóm đều thấy nhà, đồ trang trí và trang phục của chủ vườn.
  const seen = (await call('GET', `/api/plots/${plotId}`, undefined, guest)).body.plot;
  assert.deepEqual(seen.style, { ...DEFAULT_STYLE, house: paid.id, gateName: 'Vườn chú Tư' });
  assert.deepEqual(seen.decor, [{ item: 'ao_ca', x: 8, z: -10, rot: 0 }]);
  assert.deepEqual(seen.ownerAvatar, { ...DEFAULT_AVATAR, hat: 'khan_ran' });
  assert.equal(seen.ownedHouses, undefined, 'người khác không thấy danh sách kiểu nhà đã mua');
  await befriend(cookie, guest);
  const neighbor = (await call('GET', '/api/village', undefined, guest)).body.neighbors[0].plot;
  assert.deepEqual([neighbor.style.house, neighbor.decor.length, neighbor.ownerAvatar.hat, neighbor.ownerRole], [paid.id, 1, 'khan_ran', 'nong_dan']);
  assert.deepEqual((await call('GET', '/api/village', undefined, cookie)).body.center.plot.ownedHouses, [HOUSE_TYPES[0].id, paid.id]);
});

test('nhịp chơi: người mới chờ ngắn hơn, càng thu hoạch nhiều càng về nhịp thường', async () => {
  assert.deepEqual([0, 4, 5, 19, 20, 500].map(paceFactor), [30, 30, 6, 6, 2, 2]);
  const cookie = await signup('tan_binh');
  const ob = await call('POST', '/api/onboard', { regionId: 'qng_lyson' }, cookie);
  const sp = SPECIALTIES.toi_ly_son, base = stepWaitMs(sp, 1);
  const waitOf = async (tile: number) => {
    const before = Date.now();
    const r = await callOn(paceApp, 'POST', `/api/plots/${ob.body.plotId}/plant`, { tile, specialtyId: sp.id }, cookie);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const row = await db.query('select step_ready_at from plantings where id = $1', [r.body.plantingId]);
    return new Date(row.rows[0].step_ready_at).getTime() - before;
  };
  const near = (actual: number, want: number, note: string) => assert.ok(Math.abs(actual - want) < 5000, `${note}: ${actual} so với ${want}`);
  near(await waitOf(0), base / 30, 'chưa thu hoạch lần nào');
  assert.equal((await callOn(paceApp, 'GET', '/api/me', undefined, cookie)).body.config.pace, 30);
  await db.query(`update users set harvests = 5 where username = 'tan_binh'`);
  near(await waitOf(1), base / 6, 'đã thu 5 lần');
  await db.query(`update users set harvests = 20 where username = 'tan_binh'`);
  near(await waitOf(2), base / 2, 'đã thu 20 lần');
  const me = (await callOn(paceApp, 'GET', '/api/me', undefined, cookie)).body;
  assert.deepEqual([me.user.harvests, me.config.pace], [20, 2]);
  assert.equal((await meOf(cookie)).config.pace, 1, 'app kiểm thử cố định nhịp 1');

  // Thu hoạch (tự thu hoặc được phụ thu hoạch) đều tăng số lần thu của CHỦ vườn.
  const pid = await ripePlanting(ob.body.plotId, 9, sp.id);
  assert.ok((await call('POST', `/api/plantings/${pid}/step`, {}, cookie)).body.harvested);
  assert.equal((await meOf(cookie)).user.harvests, 21);
  const helper = await signup('ban_phu_thu');
  await call('POST', '/api/onboard', { regionId: 'qng_lyson' }, helper);
  await befriend(cookie, helper);
  const pid2 = await ripePlanting(ob.body.plotId, 10, sp.id);
  assert.ok((await call('POST', `/api/plantings/${pid2}/help`, {}, helper)).body.harvested);
  assert.equal((await meOf(cookie)).user.harvests, 22);
  assert.equal((await meOf(helper)).user.harvests, 0, 'người phụ không được tính');
});

test('vé du lịch theo phương tiện', async () => {
  const modes = (a: string, b: string) => travelOptions(a, b).map((o) => o.mode);
  assert.deepEqual(modes('dt_caibe', 'vl_cholach'), ['xe_khach'], 'đất liền gần chỉ có xe khách');
  assert.deepEqual(modes('dt_caibe', 'ld_dalat'), ['xe_khach', 'tau_hoa'], 'từ 150 km có tàu hoả');
  assert.deepEqual(modes('dt_caibe', 'hn_phudien'), ['xe_khach', 'tau_hoa', 'may_bay'], 'từ 400 km có máy bay');
  assert.deepEqual(modes('gl_hoainhon', 'qng_lyson'), ['tau_thuy'], 'ra đảo gần chỉ có tàu thuỷ');
  assert.deepEqual(modes('hn_phudien', 'ag_phuquoc'), ['tau_thuy', 'may_bay'], 'ra đảo xa có thêm máy bay');
  assert.deepEqual(modes('dt_caibe', 'dt_caibe'), []);
  assert.deepEqual(modes('dt_caibe', 'khong_co'), []);
  for (const o of travelOptions('dt_caibe', 'hn_phudien')) {
    const m = TRAVEL_MODES[o.mode];
    assert.equal(o.fare, Math.round((m.base + m.perKm * o.km) / 1000) * 1000);
    assert.ok(m.seconds > 0 && m.name && m.icon);
  }

  const cookie = await signup('mua_ve');
  assert.equal((await call('POST', '/api/travel', { regionId: 'hn_phudien' }, cookie)).body.error, 'chua_co_dat');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, cookie);
  const me0 = await meOf(cookie);
  await db.query('update users set cash = 5000000 where id = $1', [me0.user.id]);
  const opts = travelOptions('dt_caibe', 'hn_phudien');
  const plane = opts.find((o) => o.mode === 'may_bay')!, train = opts.find((o) => o.mode === 'tau_hoa')!;
  const bad1 = await call('POST', '/api/travel', { regionId: 'vl_cholach', mode: 'may_bay' }, cookie);
  assert.deepEqual([bad1.status, bad1.body.error], [400, 'phuong_tien_sai']);
  assert.equal((await call('POST', '/api/travel', { regionId: 'hn_phudien', mode: 'xe_dap' }, cookie)).body.error, 'phuong_tien_sai');
  assert.deepEqual((await call('POST', '/api/travel', { regionId: 'hn_phudien', mode: 'may_bay' }, cookie)).body, { cost: plane.fare, isNew: true, mode: 'may_bay' });
  assert.deepEqual((await call('POST', '/api/travel', { regionId: 'hn_phudien', mode: 'tau_hoa' }, cookie)).body, { cost: train.fare, isNew: false, mode: 'tau_hoa' });
  assert.equal((await meOf(cookie)).user.cash, 5000000 - plane.fare - train.fare);
  const reasons = await db.query(`select reason from ledger where user_id = $1 and reason like 've:%' order by id`, [me0.user.id]);
  assert.deepEqual(reasons.rows.map((r: any) => r.reason), ['ve:may_bay:hn_phudien', 've:tau_hoa:hn_phudien']);
  await db.query('update users set cash = 1000 where id = $1', [me0.user.id]);
  const poor = await call('POST', '/api/travel', { regionId: 'vl_cholach' }, cookie);
  assert.deepEqual([poor.status, poor.body.error], [409, 'khong_du_tien']);
});

test('tài khoản thử nghiệm: đổi vai, tiền, vùng, làm chín cây, thêm hàng, quay lại vòng quay', async () => {
  const normal = await signup('nguoi_thuong');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, normal);
  assert.equal((await meOf(normal)).user.tester, false);
  for (const [path, body] of [['role', { role: 'xuong' }], ['cash', { amount: 5 }], ['region', { regionId: 'ld_dalat' }], ['ripen', {}], ['stock', { specialtyId: 'toi_ly_son', kg: 1 }], ['season', {}]] as const) {
    const r = await call('POST', `/api/test/${path}`, body, normal);
    assert.deepEqual([r.status, r.body.error], [403, 'khong_co_quyen'], path);
  }

  const t = await signupRaw('thu_nghiem');
  assert.equal((await meOf(t)).user.tester, true);
  assert.equal((await call('POST', '/api/test/region', { regionId: 'ld_dalat' }, t)).body.error, 'chua_co_dat');
  const ob = await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, t);
  assert.equal((await call('POST', '/api/test/role', { role: 'vua' }, t)).status, 400);
  assert.deepEqual((await call('POST', '/api/test/role', { role: 'thuong_lai' }, t)).body, { role: 'thuong_lai' });
  let me = await meOf(t);
  assert.deepEqual([me.user.role, me.user.truckRegionId, me.user.roleNextSpinAt > Date.now()], ['thuong_lai', 'dt_caibe', true]);
  assert.deepEqual((await call('POST', '/api/test/role', { role: 'nong_dan' }, t)).body, { role: 'nong_dan' }, 'đổi vai không cần chờ hết mùa');

  assert.equal((await call('POST', '/api/test/cash', { amount: -1 }, t)).status, 400);
  assert.deepEqual((await call('POST', '/api/test/cash', { amount: 999_000_000 }, t)).body, { cash: 999_000_000 });
  me = await meOf(t);
  assert.equal(me.user.cash, 999_000_000);
  const ledger = await db.query('select coalesce(sum(delta),0)::bigint as s from ledger where user_id = $1', [me.user.id]);
  assert.equal(ledger.rows[0].s, 999_000_000, 'sổ cái khớp số dư');

  assert.deepEqual((await call('POST', '/api/test/stock', { specialtyId: 'toi_ly_son', kg: 50 }, t)).body, { ok: true });
  assert.equal((await call('POST', '/api/test/stock', { specialtyId: 'khong_co', kg: 1 }, t)).status, 400);
  assert.deepEqual((await meOf(t)).inventory, [{ specialtyId: 'toi_ly_son', quality: 'A', kg: 50 }]);
  assert.ok((await call('GET', '/api/collection', undefined, t)).body.specialties.includes('toi_ly_son'));

  // Làm chín: mọi cây tới hạn ngay (dùng app thời gian thật để cây chưa tự tới hạn).
  const p1 = await callOn(slowApp, 'POST', `/api/plots/${ob.body.plotId}/plant`, { tile: 0, specialtyId: 'xoai_hoa_loc' }, t);
  const p2 = await callOn(slowApp, 'POST', `/api/plots/${ob.body.plotId}/plant`, { tile: 1, specialtyId: 'khom_tan_phuoc' }, t);
  assert.deepEqual([p1.status, p2.status], [200, 200]);
  assert.equal((await callOn(slowApp, 'POST', `/api/plantings/${p1.body.plantingId}/step`, {}, t)).body.error, 'chua_den_luc');
  assert.deepEqual((await call('POST', '/api/test/ripen', {}, t)).body, { count: 2 });
  assert.equal((await callOn(slowApp, 'POST', `/api/plantings/${p1.body.plantingId}/step`, {}, t)).status, 200);

  // Chuyển vùng: lô nhà đổi vùng và kiểu, cây trên lô bị xoá, xe về vùng mới.
  assert.equal((await call('POST', '/api/test/region', { regionId: 'khong_co' }, t)).status, 400);
  assert.equal((await call('POST', '/api/test/region', { regionId: 'ld_dalat', kind: 'tang_ham' }, t)).status, 400);
  assert.deepEqual((await call('POST', '/api/test/truck', {}, t)).body, { fuelL: TRUCK.tankL, etc: 2_000_000 });
  assert.equal((await call('POST', '/api/plots/buy', { regionId: 'qng_lyson' }, t)).status, 200);
  assert.equal((await call('POST', '/api/test/region', { regionId: 'qng_lyson' }, t)).body.error, 'da_co_dat');
  assert.equal((await call('POST', '/api/coops', { name: 'HTX Thử Nghiệm' }, t)).status, 200);
  assert.deepEqual((await call('POST', '/api/test/region', { regionId: 'hcm_laithieu', kind: 'rooftop' }, t)).body, { regionId: 'hcm_laithieu', kind: 'rooftop' });
  me = await meOf(t);
  assert.deepEqual([me.user.homeRegionId, me.user.homeKind, me.user.truckRegionId, me.user.coopId], ['hcm_laithieu', 'rooftop', 'hcm_laithieu', null]);
  const village = (await call('GET', '/api/village', undefined, t)).body;
  assert.deepEqual([village.center.plot.regionId, village.center.plot.kind, village.center.plantings.length], ['hcm_laithieu', 'rooftop', 0]);
  assert.deepEqual((await call('POST', '/api/test/region', { regionId: 'hcm_laithieu' }, t)).body, { regionId: 'hcm_laithieu', kind: 'rooftop' }, 'không truyền kind thì giữ nguyên');

  // Về lại vòng quay.
  assert.deepEqual((await call('POST', '/api/test/season', {}, t)).body, { ok: true });
  me = await meOf(t);
  assert.deepEqual([me.user.role, me.user.roleNextSpinAt], [null, null]);
  nextRole = 'xuong';
  assert.equal((await callOn(spinApp, 'POST', '/api/role/spin', {}, t)).body.role, 'xuong');

  // Tên trong danh sách được đánh dấu cả khi đăng nhập (so khớp không phân biệt hoa thường, bỏ khoảng trắng).
  await signupRaw('thu_sau');
  await db.query(`update users set is_tester = false where username = 'thu_sau'`);
  const login = await call('POST', '/api/auth/login', { username: 'thu_sau', password: 'matkhau123' });
  assert.equal((await meOf(login.cookie!)).user.tester, true);
});

test('phạt quá tốc độ: đúng khung Nghị định 168, trừ khi tới nơi, không âm tiền', async () => {
  assert.equal(speedFine(4), null);
  assert.deepEqual([5, 9, 10, 20, 21, 35, 36].map((v) => speedFine(v)!.fine), [900_000, 900_000, 5_000_000, 5_000_000, 7_000_000, 7_000_000, 13_000_000]);
  for (const f of SPEED_FINES) assert.ok(f.fine >= f.min && f.fine <= f.max);
  const cookie = await signup('chay_nhanh', 'thuong_lai');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, cookie);
  await call('POST', '/api/test/truck', {}, cookie); // không phải tester: bị từ chối, không sao
  const me = await meOf(cookie);
  await db.query('update users set etc = 5000000, fuel_l = 60 where id = $1', [me.user.id]);
  const trip = await call('POST', '/api/trips/start', { toRegionId: 'dt_caolanh' }, cookie);
  const done = await callOn(spinApp, 'POST', `/api/trips/${trip.body.tripId}/finish`, { speeding: [3, 12, 40, 'x', 999, 7, 8, 50] }, cookie);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  // 3 km/h không phạt; 'x' thành 0; 999 kẹp về 200; chỉ lấy 6 phần tử đầu.
  assert.deepEqual(done.body.fines.map((f: any) => [f.overKmh, f.fine, f.points]), [[12, 5_000_000, 2], [40, 13_000_000, 6], [200, 13_000_000, 6], [7, 900_000, 0]]);
  assert.equal(done.body.fineCost, START_CASH, 'tiền phạt nhiều hơn tiền mặt thì chỉ trừ tới hết');
  assert.equal(done.body.cash, 0);
  assert.equal((await meOf(cookie)).user.cash, 0);
});

test('thu mua sỉ: chỉ thương lái, đúng vùng xe đỗ, theo sức chở và nguồn hàng; bảng mua gì bán gì', async () => {
  assert.equal(tripPlan('dt_caibe', 'dt_caolanh').cargoKg, TRUCK.cargoKg);
  assert.ok(TRAVEL_VS_TRUCK.ve.points.length && TRAVEL_VS_TRUCK.xe_tai.points.length);
  for (const l of Object.values(LIMIT_REASONS)) assert.ok(l.title && l.limit && l.reason.length > 20);
  const farmer = await signup('nha_vuon_si');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, farmer);
  const no = await call('POST', '/api/wholesale/buy', { specialtyId: 'xoai_hoa_loc', kg: 10 }, farmer);
  assert.deepEqual([no.status, no.body.error], [403, 'chi_thuong_lai']);
  const viewF = await call('GET', '/api/regions/dt_caolanh/trade', undefined, farmer);
  assert.deepEqual([viewF.body.canBuy, viewF.body.cargo.capacityKg], [false, 0]);
  assert.equal(viewF.body.whyNot, LIMIT_REASONS.wholesale_role.reason);

  const cookie = await signup('lai_buon_si', 'thuong_lai');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, cookie);
  const me = await meOf(cookie);
  await db.query('update users set cash = 500000000, fuel_l = 60 where id = $1', [me.user.id]);
  // Ở nhà: mua được đặc sản vùng nhà, không mua được đặc sản vùng khác.
  const far = await call('POST', '/api/wholesale/buy', { specialtyId: 'xoai_cao_lanh', kg: 10 }, cookie);
  assert.deepEqual([far.status, far.body.error], [409, 'khac_vung']);
  const unit = wholesalePrice(SPECIALTIES.xoai_hoa_loc.refPrice);
  assert.equal(unit, Math.round((SPECIALTIES.xoai_hoa_loc.refPrice * WHOLESALE_RATIO) / 100) * 100);
  const buy = await call('POST', '/api/wholesale/buy', { specialtyId: 'xoai_hoa_loc', kg: 200 }, cookie);
  assert.equal(buy.status, 200, JSON.stringify(buy.body));
  assert.deepEqual([buy.body.unitPrice, buy.body.total, buy.body.cargo, buy.body.supplyLeftKg],
    [unit, unit * 200, { capacityKg: TRUCK.cargoKg, usedKg: 200, freeKg: TRUCK.cargoKg - 200 }, WHOLESALE_SUPPLY_KG - 200]);
  const full = await call('POST', '/api/wholesale/buy', { specialtyId: 'xoai_hoa_loc', kg: TRUCK.cargoKg - 199 }, cookie);
  assert.deepEqual([full.status, full.body.error], [409, 'day_xe']);
  assert.equal((await call('POST', '/api/wholesale/buy', { specialtyId: 'xoai_hoa_loc', kg: TRUCK.cargoKg + 1 }, cookie)).status, 400);
  // Mua tại nhà rồi bán ngay tại nhà là lỗ; chở đi vùng khác mới lời.
  assert.ok(npcPrice(SPECIALTIES.xoai_hoa_loc.refPrice, 'A', 'dt_caibe', 'dt_caibe') < unit);
  const homeView = await call('GET', '/api/regions/dt_caibe/trade', undefined, cookie);
  const row = homeView.body.buy.find((b: any) => b.specialtyId === 'xoai_hoa_loc');
  assert.deepEqual([homeView.body.here, homeView.body.canBuy, row.sellAt, row.wholesalePrice, row.maxKg], [true, true, 'vung_khac', unit, TRUCK.cargoKg - 200]);
  assert.ok(row.marginPerKg > 0);
  // Chưa tới Cao Lãnh: xem được bảng nhưng chưa mua được.
  const away = await call('GET', '/api/regions/dt_caolanh/trade', undefined, cookie);
  assert.deepEqual([away.body.here, away.body.canBuy], [false, false]);
  assert.match(away.body.whyNot, /Cái Bè/);
  const sellRow = away.body.sell.find((x: any) => x.specialtyId === 'xoai_hoa_loc');
  assert.ok(sellRow.kg === 200 && sellRow.diffPerKg > 0, 'hàng nhà chở sang vùng khác bán được giá hơn');
  // Lái xe tới nơi: sức chở tính lại, mua được đặc sản ở đó, mang về nhà bán có lời.
  const trip = await call('POST', '/api/trips/start', { toRegionId: 'dt_caolanh' }, cookie);
  await callOn(spinApp, 'POST', `/api/trips/${trip.body.tripId}/finish`, {}, cookie);
  const there = await call('GET', '/api/regions/dt_caolanh/trade', undefined, cookie);
  assert.deepEqual([there.body.here, there.body.canBuy, there.body.cargo.freeKg], [true, true, TRUCK.cargoKg]);
  const r2 = there.body.buy.find((b: any) => b.specialtyId === 'xoai_cao_lanh');
  assert.deepEqual([r2.sellAt, r2.maxKg], ['nha', TRUCK.cargoKg]);
  assert.ok(r2.marginPerKg > 0);
  const buy2 = await call('POST', '/api/wholesale/buy', { specialtyId: 'xoai_cao_lanh', kg: TRUCK.cargoKg }, cookie);
  assert.equal(buy2.status, 200, JSON.stringify(buy2.body));
  const inv = (await meOf(cookie)).inventory;
  assert.equal(inv.find((i: any) => i.specialtyId === 'xoai_cao_lanh' && i.quality === 'A').kg, TRUCK.cargoKg);
  assert.equal((await call('POST', '/api/wholesale/buy', { specialtyId: 'xoai_hoa_loc', kg: 1 }, cookie)).body.error, 'khac_vung');
  // Nguồn hàng trong ngày của vùng là chung cho mọi thương lái.
  await db.query(`insert into wholesale_buys (user_id, region_id, specialty_id, kg, unit_price) values ($1,'dt_caolanh','xoai_cao_lanh',$2,1)`, [me.user.id, WHOLESALE_SUPPLY_KG - TRUCK.cargoKg - 5]);
  await db.query('update users set cargo_used = 0 where id = $1', [me.user.id]);
  const out = await call('POST', '/api/wholesale/buy', { specialtyId: 'xoai_cao_lanh', kg: 6 }, cookie);
  assert.deepEqual([out.status, out.body.error], [409, 'het_hang']);
  assert.equal((await call('POST', '/api/wholesale/buy', { specialtyId: 'xoai_cao_lanh', kg: 5 }, cookie)).status, 200);
});

test('xuất khẩu: báo giá theo đường và thị trường, quyền theo vai, tiền về khi lô tới nơi', async () => {
  // Hàm thuần.
  const ref = SPECIALTIES.xoai_hoa_loc.refPrice;
  const q = exportQuote('xoai_hoa_loc', 'A', 500, 'container', 'trung_quoc', 'dt_caibe');
  assert.equal(q.ok, true);
  assert.equal(q.spoilKg, Math.floor(500 * EXPORT_MODES.container.spoil));
  assert.equal(q.unitPrice, Math.round((ref * EXPORT_MARKETS.trung_quoc.priceMult) / 100) * 100);
  assert.equal(q.payout, q.unitPrice * q.arriveKg);
  assert.equal(q.net, q.payout - q.freight);
  assert.ok(q.inlandKm > 1000 && /Cửa khẩu/.test(q.gatewayName), 'Cái Bè ra cửa khẩu phía Bắc là rất xa');
  assert.equal(exportQuote('xoai_hoa_loc', 'A', 499, 'container', 'trung_quoc', 'dt_caibe').ok, false, 'chưa đủ kg tối thiểu');
  assert.equal(exportQuote('xoai_hoa_loc', 'A', 500, 'tau_lon', 'trung_quoc', 'dt_caibe').ok, false, 'đường này không tới thị trường đó');
  assert.equal(exportQuote('xoai_hoa_loc', 'B', 50, 'hang_khong', 'nhat_han', 'dt_caibe').ok, false, 'thị trường khó tính chỉ nhận Loại 1');
  assert.equal(exportQuote('xoai_hoa_loc', 'A', 50, 'hang_khong', 'nhat_han', 'dt_caibe').spoilKg, 0);
  // Hàng khô hao ít hơn hàng tươi trên cùng chuyến tàu lớn.
  const dry = Object.values(SPECIALTIES).find((sp) => ['cn', 'lua'].includes(CROPS[sp.crop].kind))!;
  assert.ok(exportQuote(dry.id, 'A', 5000, 'tau_lon', 'au_my', dry.regionId).spoilKg < exportQuote('xoai_hoa_loc', 'A', 5000, 'tau_lon', 'au_my', 'dt_caibe').spoilKg);
  // Tàu lớn rẻ cước mỗi kg hơn máy bay rất nhiều.
  assert.ok(EXPORT_MODES.tau_lon.perKgFee * 10 < EXPORT_MODES.hang_khong.perKgFee);
  assert.deepEqual(exportModesFor('nong_dan', false), ['xe_tai', 'hang_khong']);
  assert.ok(exportModesFor('nong_dan', true).includes('container') && !exportModesFor('nong_dan', true).includes('tau_lon'));
  assert.equal(exportModesFor('thuong_lai', false).length, 6);
  for (let id = 1; id < 30; id++) { const r = coopOrderRoute(id, 100); assert.ok(EXPORT_MARKETS[r.market].modes.includes(r.exportMode)); }

  const farmer = await signup('xk_nha_vuon');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, farmer);
  const fm = await meOf(farmer);
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'xoai_hoa_loc','A',800), ($1,'xoai_hoa_loc','B',100)`, [fm.user.id]);
  await db.query('update users set cash = 100000000 where id = $1', [fm.user.id]);
  const opts = await call('GET', '/api/export/options', undefined, farmer);
  assert.equal(opts.status, 200, JSON.stringify(opts.body));
  assert.deepEqual([opts.body.allowedModes, opts.body.active, opts.body.maxActive, opts.body.fromRegionId], [['xe_tai', 'hang_khong'], 0, EXPORT_MAX_ACTIVE, 'dt_caibe']);
  const a = opts.body.stock.find((x: any) => x.quality === 'A');
  assert.ok(a.quotes[0].ok && a.quotes.some((x: any) => !x.ok && x.mode === 'container'), 'đường không được phép vẫn hiện, kèm lý do');
  const denied = await call('POST', '/api/export/ship', { specialtyId: 'xoai_hoa_loc', grade: 'A', kg: 600, mode: 'container', market: 'trung_quoc' }, farmer);
  assert.deepEqual([denied.status, denied.body.error], [403, 'khong_duoc_duong_nay']);
  const small = await call('POST', '/api/export/ship', { specialtyId: 'xoai_hoa_loc', grade: 'A', kg: 10, mode: 'xe_tai', market: 'trung_quoc' }, farmer);
  assert.deepEqual([small.status, small.body.error], [409, 'lo_hang_sai']);
  assert.equal((await call('POST', '/api/export/ship', { specialtyId: 'xoai_hoa_loc', grade: 'A', kg: 100, mode: 'bay', market: 'trung_quoc' }, farmer)).status, 400);
  const quote = exportQuote('xoai_hoa_loc', 'A', 300, 'xe_tai', 'lao_cam', 'dt_caibe');
  const ship = await call('POST', '/api/export/ship', { specialtyId: 'xoai_hoa_loc', grade: 'A', kg: 300, mode: 'xe_tai', market: 'lao_cam' }, farmer);
  assert.equal(ship.status, 200, JSON.stringify(ship.body));
  assert.deepEqual([ship.body.quote, ship.body.cash, ship.body.shipment.status, ship.body.shipment.payout], [quote, 100000000 - quote.freight, 'dang_di', quote.payout]);
  assert.match(ship.body.shipment.gatewayName, /Mộc Bài/);
  assert.equal((await meOf(farmer)).inventory.find((i: any) => i.quality === 'A').kg, 500);
  // TIME_SCALE của bộ thử rất lớn nên lô tới nơi sau khoảng 1 giây; đọc lại là tiền về, chỉ một lần.
  await sleep(1100);
  const list = await call('GET', '/api/export/shipments', undefined, farmer);
  assert.deepEqual([list.body.justPaid.length, list.body.shipments[0].status, list.body.shipments[0].arriveKg], [1, 'da_toi', quote.arriveKg]);
  assert.equal((await meOf(farmer)).user.cash, 100000000 - quote.freight + quote.payout);
  assert.equal((await call('GET', '/api/export/shipments', undefined, farmer)).body.justPaid.length, 0);
  assert.equal((await meOf(farmer)).user.cash, 100000000 - quote.freight + quote.payout);
  // Tối đa số lô cùng lúc (dùng máy chủ chạy giờ thật để lô chưa tới).
  for (let i = 0; i < EXPORT_MAX_ACTIVE; i++) assert.equal((await callOn(slowApp, 'POST', '/api/export/ship', { specialtyId: 'xoai_hoa_loc', grade: 'A', kg: 50, mode: 'xe_tai', market: 'lao_cam' }, farmer)).status, 200);
  const many = await callOn(slowApp, 'POST', '/api/export/ship', { specialtyId: 'xoai_hoa_loc', grade: 'A', kg: 50, mode: 'xe_tai', market: 'lao_cam' }, farmer);
  assert.deepEqual([many.status, many.body.error], [409, 'qua_nhieu_lo']);
  // /api/me cũng chốt lô đã tới và báo lại.
  await db.query(`update export_shipments set arrives_at = now() - interval '1 second' where user_id = $1 and paid_at is null`, [fm.user.id]);
  const meAfter = await meOf(farmer);
  assert.equal(meAfter.exportPaid.length, EXPORT_MAX_ACTIVE);
  assert.equal((await meOf(farmer)).exportPaid, undefined);
  // Thương lái đi được container; không đủ tiền cước thì bị từ chối và kho còn nguyên.
  const trader = await signup('xk_thuong_lai', 'thuong_lai');
  await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, trader);
  const tm = await meOf(trader);
  await db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,'xoai_hoa_loc','A',600)`, [tm.user.id]);
  await db.query('update users set cash = 1000 where id = $1', [tm.user.id]);
  const poor = await call('POST', '/api/export/ship', { specialtyId: 'xoai_hoa_loc', grade: 'A', kg: 600, mode: 'container', market: 'trung_quoc' }, trader);
  assert.deepEqual([poor.status, poor.body.error], [409, 'khong_du_tien']);
  await db.query('update users set cash = 100000000 where id = $1', [tm.user.id]);
  assert.equal((await call('POST', '/api/export/ship', { specialtyId: 'xoai_hoa_loc', grade: 'A', kg: 600, mode: 'container', market: 'trung_quoc' }, trader)).status, 200);
  assert.equal((await call('POST', '/api/export/ship', { specialtyId: 'xoai_hoa_loc', grade: 'A', kg: 1, mode: 'xe_tai', market: 'lao_cam' }, trader)).body.error, 'lo_hang_sai');

  // Đơn lớn hợp tác xã cho biết đi đường nào, thị trường nào.
  assert.equal((await call('POST', '/api/coops', { name: 'HTX xuất khẩu thử' }, trader)).status, 200);
  const mine = await call('GET', '/api/coops/mine', undefined, trader);
  const o = mine.body.coop.order;
  assert.ok(EXPORT_MARKETS[o.market as keyof typeof EXPORT_MARKETS].modes.includes(o.exportMode));
  assert.deepEqual([o.exportMode, o.market], [(await call('GET', '/api/coops/mine', undefined, trader)).body.coop.order.exportMode, o.market]);
  void QUALITY_MULT;
});
