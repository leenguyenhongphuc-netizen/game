// Người chơi thấy nhau (hiện diện) và cư dân ảo trên chợ. Dùng CSDL kiểm thử riêng (vuon_test_social).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { REGIONS, SPECIALTIES } from '../../shared/catalog.ts';
import { BOTS_PER_REGION, botDisplayName, highwayKey } from '../../shared/social.ts';

const url = process.env.TEST_SOCIAL_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test_social';
let db: Db, app: FastifyInstance;
before(async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  app = await buildApp({ db, timeScale: 1e9, lateGraceMs: 600_000, adminToken: 'test-admin-token-0123456789', rateLimit: false, staticDir: '/nonexistent', bots: true,
    marketEventsAt: () => [], inSeason: () => false, paceFactor: () => 1, testerUsernames: ['cho_thu'], tripMinFactor: 0,
    marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }) });
});
after(async () => { await app.close(); await db.close(); });

type Res = { status: number; body: any; cookie?: string };
async function call(method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}): Promise<Res> {
  const r = await app.inject({ method: method as any, url: path, payload: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers } });
  const set = r.headers['set-cookie'], first = Array.isArray(set) ? set[0] : set;
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, cookie: first?.split(';')[0] };
}
async function signup(name: string, regionId = 'dt_caibe'): Promise<string> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name.toUpperCase() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await db.query(`update users set role = 'nong_dan', role_assigned_at = now() where username = $1`, [name]);
  const o = await call('POST', '/api/onboard', { regionId }, r.cookie);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  return r.cookie!;
}
const ADMIN = { authorization: 'Bearer test-admin-token-0123456789' };
const cashOf = async (name: string) => Number((await db.query('select cash from users where username = $1', [name])).rows[0].cash);

test('hiện diện: cùng cảnh thấy nhau, khác cảnh không thấy, quá hạn thì biến mất, rời cảnh thì xoá', async () => {
  const a = await signup('lan_a'), b = await signup('lan_b'), c = await signup('lan_c');
  await call('POST', '/api/admin/bots', { enabled: false }, undefined, ADMIN); // tách riêng phần người thật
  let r = await call('POST', '/api/presence', { scene: 'village', key: 'plot:1', x: 1, z: 2, yaw: 0.5, speed: 3 }, a);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.others.length, 0);
  assert.equal(r.body.interval, 5000, 'một mình thì gửi thưa');
  r = await call('POST', '/api/presence', { scene: 'village', key: 'plot:1', x: 4, z: 2, walk: true, count: true }, b);
  assert.equal(r.body.others.length, 1);
  const seen = r.body.others[0];
  assert.equal(seen.name, 'LAN_A'); assert.equal(seen.x, 1); assert.equal(seen.z, 2); assert.equal(seen.bot, false);
  assert.ok(!('username' in seen), 'không lộ tên tài khoản');
  assert.equal(r.body.interval, 2500);
  assert.ok(r.body.online >= 2);
  r = await call('POST', '/api/presence', { scene: 'village', key: 'plot:2', x: 0, z: 0 }, c);
  assert.equal(r.body.others.length, 0, 'khác làng thì không thấy');
  await db.query(`update presence set updated_at = now() - interval '20 seconds' where user_id = (select id from users where username = 'lan_a')`);
  r = await call('POST', '/api/presence', { scene: 'village', key: 'plot:1', x: 4, z: 2 }, b);
  assert.equal(r.body.others.length, 0, 'quá 10 giây không gửi nhịp thì coi như đã đi');
  await call('POST', '/api/presence', { scene: 'village', key: 'plot:1', x: 1, z: 2 }, a);
  assert.equal((await call('POST', '/api/presence/leave', {}, a)).status, 200);
  r = await call('POST', '/api/presence', { scene: 'village', key: 'plot:1', x: 4, z: 2 }, b);
  assert.equal(r.body.others.length, 0);
  assert.equal((await call('POST', '/api/presence', { scene: 'vu_tru', key: 'x' }, b)).status, 400);
  assert.equal((await call('POST', '/api/presence', { scene: 'village', key: 'plot:1' })).status, 401);
});

test('hiện diện trên cao tốc: quy về trục chuyến đi của mình, cùng chiều và ngược chiều', async () => {
  const a = await signup('xe_a'), b = await signup('xe_b'), c = await signup('xe_c');
  const ab = highwayKey('dt_caibe', 'hn_hoaiduc'), ba = highwayKey('hn_hoaiduc', 'dt_caibe');
  assert.equal(ab.key, ba.key); assert.equal(ab.dir, -ba.dir);
  await call('POST', '/api/presence', { scene: 'highway', key: ab.key, dir: ab.dir, km: 100, totalKm: 500, kmps: 6 }, a);
  // b đi chiều ngược lại, đã đi 300 km → cách đầu của a 200 km
  await call('POST', '/api/presence', { scene: 'highway', key: ba.key, dir: ba.dir, km: 300, totalKm: 500, kmps: 5 }, b);
  // c cùng chiều a, đi trước 30 km
  let r = await call('POST', '/api/presence', { scene: 'highway', key: ab.key, dir: ab.dir, km: 130, totalKm: 500, kmps: 7 }, c);
  const seenA = r.body.others.find((o: any) => o.name === 'XE_A');
  assert.ok(seenA, JSON.stringify(r.body));
  assert.equal(seenA.aheadKm, -30); assert.equal(seenA.sameDir, true); assert.equal(seenA.kmps, 6);
  const seenB = r.body.others.find((o: any) => o.name === 'XE_B');
  assert.ok(seenB, 'b ngược chiều, cách 70 km, trong tầm 80 km');
  assert.equal(seenB.aheadKm, 70); assert.equal(seenB.sameDir, false);
  r = await call('POST', '/api/presence', { scene: 'highway', key: ab.key, dir: ab.dir, km: 450, totalKm: 500, kmps: 7 }, c);
  assert.ok(!r.body.others.some((o: any) => !o.bot), 'xa quá 80 km thì không trả về');
});

test('cư dân ảo: lập tài khoản, bày hàng lên chợ, không in tiền', async () => {
  await call('POST', '/api/admin/bots', { enabled: true }, undefined, ADMIN);
  const t = await signup('cho_thu');
  const r = await call('POST', '/api/test/bots/tick', { all: true }, t);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const n = Object.keys(REGIONS).length * BOTS_PER_REGION;
  assert.equal(r.body.stats.seeded, n);
  assert.ok(r.body.stats.listed > 10, JSON.stringify(r.body.stats));
  const bots = (await db.query('select id, username, display_name, cash, role, last_seen_at from users where is_bot')).rows;
  assert.equal(bots.length, n);
  assert.ok(bots.every((b) => b.username.startsWith('bot.') && b.last_seen_at === null), 'không tính vào vòng quay vai trò');
  assert.equal(bots[0].display_name, botDisplayName(0));
  // không đăng nhập được bằng tên cư dân
  assert.equal((await call('POST', '/api/auth/login', { username: bots[0].username, password: 'matkhau123' })).status, 401);
  // chợ có hàng của cư dân cho người chơi
  const m = await call('GET', '/api/market', undefined, t);
  assert.ok(m.body.listings.length > 10, 'chợ phải có người bày hàng');
  // tiền của mỗi cư dân khớp sổ cái (vốn lập một lần + mua bán)
  const bad = (await db.query(`select u.id from users u left join (select user_id, sum(delta) s from ledger group by user_id) l on l.user_id = u.id where u.is_bot and u.cash <> coalesce(l.s, 0)`)).rows;
  assert.equal(bad.length, 0, 'tiền cư dân phải khớp sổ cái');
});

test('cư dân ảo mua hàng giá hợp lý của người chơi, bỏ qua hàng giá cắt cổ', async () => {
  const t = (await call('POST', '/api/auth/login', { username: 'cho_thu', password: 'matkhau123' })).cookie!;
  const sp = Object.values(SPECIALTIES).find((s) => s.regionId === 'dt_caibe')!;
  await call('POST', '/api/test/stock', { specialtyId: sp.id, kg: 300, grade: 'A' }, t);
  const ref = Number((await db.query('select price from price_ticks where specialty_id = $1 order by observed_at desc, id desc limit 1', [sp.id])).rows[0].price);
  const fair = await call('POST', '/api/market/listings', { specialtyId: sp.id, quality: 'A', kg: 50, price: Math.round(ref * 1.0) }, t);
  const dear = await call('POST', '/api/market/listings', { specialtyId: sp.id, quality: 'A', kg: 50, price: Math.round(ref * 2.5) }, t);
  assert.equal(fair.status, 200, JSON.stringify(fair.body)); assert.equal(dear.status, 200);
  await db.query(`update listings set created_at = now() - interval '5 minutes' where id in ($1,$2)`, [fair.body.listingId, dear.body.listingId]);
  const before = await cashOf('cho_thu');
  // vài lượt để mọi thương lái ảo đều được chạy
  for (let i = 0; i < 4; i++) await call('POST', '/api/test/bots/tick', { all: true }, t);
  const after = await cashOf('cho_thu');
  const st = (await db.query('select id, kg, status from listings where id in ($1,$2) order by id', [fair.body.listingId, dear.body.listingId])).rows;
  assert.ok(st[0].kg < 50, `tin giá hợp lý phải được mua: ${JSON.stringify(st)}`);
  assert.equal(st[1].kg, 50, 'tin giá cắt cổ không ai mua');
  assert.equal(after - before, (50 - st[0].kg) * Math.round(ref * 1.0), 'người bán nhận đúng tiền');
});

test('cư dân ảo hiện trong cảnh; công tắc tắt thì biến mất và gỡ hàng', async () => {
  const t = (await call('POST', '/api/auth/login', { username: 'cho_thu', password: 'matkhau123' })).cookie!;
  let r = await call('POST', '/api/presence', { scene: 'rest_stop', key: 'Trạm dừng nghỉ thử', x: 0, z: 0 }, t);
  const bots = r.body.others.filter((o: any) => o.bot);
  assert.ok(bots.length >= 1, 'trạm dừng luôn có người');
  assert.equal(bots[0].script.kind, 'rest');
  assert.ok(bots[0].vehicle?.group);
  // cao tốc: tổng hợp vài lượt khoá khác nhau để chắc có xe trong tầm nhìn
  let hw = 0;
  for (let i = 0; i < 6; i++) { r = await call('POST', '/api/presence', { scene: 'highway', key: `a${i}|b${i}`, dir: 1, km: 250, totalKm: 500, kmps: 6 }, t); hw += r.body.others.filter((o: any) => o.bot).length; }
  assert.ok(hw > 0, 'cao tốc có xe của cư dân ảo');
  assert.equal((await call('POST', '/api/admin/bots', { enabled: false })).status, 401);
  const off = await call('POST', '/api/admin/bots', { enabled: false }, undefined, { authorization: 'Bearer test-admin-token-0123456789' });
  assert.equal(off.status, 200);
  const open = (await db.query(`select count(*)::int n from listings l join users u on u.id = l.seller_id where u.is_bot and l.status = 'open'`)).rows[0].n;
  assert.equal(open, 0, 'tắt cư dân thì gỡ hết hàng của họ');
  // máy chủ khác (cache 60 s) — ở đây cùng máy chủ nên tắt ngay
  r = await call('POST', '/api/presence', { scene: 'rest_stop', key: 'Trạm dừng nghỉ thử', x: 0, z: 0 }, t);
  assert.equal(r.body.others.filter((o: any) => o.bot).length, 0);
  await call('POST', '/api/admin/bots', { enabled: true }, undefined, { authorization: 'Bearer test-admin-token-0123456789' });
});
