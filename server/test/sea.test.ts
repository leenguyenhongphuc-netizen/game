// Biển mở: thuê mô tô nước (đúng tỉnh, đúng gói, trừ tiền và thể lực, không thuê trùng, EXP khi chạy đủ một phút),
// cảnh hiện diện 'sea' (thấy tàu người khác cùng vùng biển, không trộn cư dân ảo), địa lý biển tất định và bến không nằm trên đất.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { LEVELS } from '../../shared/rules.ts';
import { JETSKI_BEACHES, JETSKI_ENERGY, SEA_ROUTE_IDS, jetSkiPrice, seaRoute, seaRouteFor } from '../../shared/sea.ts';
import { buildFerryWorld, buildJetSkiWorld, lanePos, pathLength } from '../../web/src/sea/seaWorld.ts';

const url = process.env.TEST_SEA_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test_sea';
let db: Db, app: FastifyInstance;
before(async () => {
  // tạo CSDL thử nếu chưa có (cần quyền createdb; không có thì phải tạo tay)
  const admin = new pg.Client({ connectionString: url.replace(/\/[^/]+$/, '/postgres') });
  try { await admin.connect(); const name = url.split('/').pop()!; const ok = await admin.query('select 1 from pg_database where datname = $1', [name]); if (!ok.rowCount) await admin.query(`create database "${name}"`); } catch { /* đã có hoặc không có quyền */ } finally { await admin.end().catch(() => {}); }
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  app = await buildApp({ db, timeScale: 1, lateGraceMs: 60_000, adminToken: 'test-admin-token-0123456789', rateLimit: false, staticDir: '/nonexistent', marketEventsAt: () => [], inSeason: () => false,
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
async function signup(name: string, regionId: string, cash = 5_000_000): Promise<string> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await db.query('update users set role = $2, role_assigned_at = now() where username = $1', [name, 'thuong_lai']);
  assert.equal((await call('POST', '/api/onboard', { regionId }, r.cookie)).status, 200);
  await db.query('update users set cash = $2, xp = $3, energy = 100, energy_at = now() where username = $1', [name, cash, LEVELS[4].xp]);
  return r.cookie!;
}
const cashOf = async (name: string) => Number((await db.query('select cash from users where username = $1', [name])).rows[0].cash);

test('địa lý biển: mỗi tuyến ra đảo dựng được, bến hai đầu nằm trên mặt nước, có luồng, phao hai màu, tàu bè; tất định', () => {
  for (const id of SEA_ROUTE_IDS) {
    const r = seaRoute(id)!, w = buildFerryWorld(r, true), w2 = buildFerryWorld(r, true);
    assert.ok(!w.isLand(w.start.x, w.start.z) && !w.isLand(w.goal.x, w.goal.z), `${id}: bến không được nằm trên đất`);
    assert.ok(w.path.length >= 2 && pathLength(w.path) > 300, `${id}: có luồng gợi ý`);
    assert.ok(w.buoys.some((b) => b.red) && w.buoys.some((b) => !b.red), `${id}: có cả phao đỏ và phao xanh`);
    assert.ok(w.lanes.some((l) => l.kind === 'tau_khach') && w.lanes.some((l) => l.kind === 'tau_ca'), `${id}: có tàu khách và tàu cá`);
    assert.deepEqual(w.lanes.map((l) => lanePos(l, 1234.5)), w2.lanes.map((l) => lanePos(l, 1234.5)), `${id}: hai máy thấy tàu bè ở cùng chỗ`);
    // luồng gợi ý đi toàn trên nước
    for (let i = 1; i < w.path.length; i++) { const a = w.path[i - 1], b = w.path[i]; for (let t = 0; t <= 1; t += 0.05) assert.ok(!w.isLand(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), `${id}: luồng cắt qua đất`); }
    const back = buildFerryWorld(r, false);
    assert.ok(Math.hypot(back.start.x - w.goal.x, back.start.z - w.goal.z) < 1 && Math.hypot(back.goal.x - w.start.x, back.goal.z - w.start.z) < 1, `${id}: chiều về đổi đầu bến`);
  }
  assert.equal(seaRoute('hp_catba')!.karst, true);
  assert.ok(buildFerryWorld(seaRoute('hp_catba')!, true).karsts.length > 30, 'Cát Bà – Lan Hạ có đảo đá vôi');
  assert.deepEqual(seaRouteFor('hp_haiphong_khong_co', 'hp_catba')?.toIsland, true);
  assert.equal(seaRouteFor('hp_catba', 'dt_caibe')?.toIsland, false);
  assert.equal(seaRouteFor('dt_caibe', 'hn_phudien'), null);
  for (const b of JETSKI_BEACHES) { const w = buildJetSkiWorld(b); assert.ok(w.zone && !w.isLand(w.zone.cx, w.zone.cz) && !w.isLand(w.start.x, w.start.z), `${b.id}: vùng phao trên mặt nước`); }
});

test('thuê mô tô nước: đúng tỉnh, đúng gói, trừ tiền và thể lực, không thuê trùng; chạy đủ một phút mới có EXP', async () => {
  const far = await signup('jet_xa', 'dt_caibe');
  assert.equal((await call('POST', '/api/sea/jetski/rent', { beachId: 'my_khe', minutes: 15 }, far)).body.error, 'chua_toi_noi');
  const dn = await signup('jet_dn', 'dn_tienphuoc');
  const list = (await call('GET', '/api/sea/jetski', undefined, dn)).body;
  assert.equal(list.beaches.find((b: any) => b.id === 'my_khe').here, true);
  assert.equal((await call('POST', '/api/sea/jetski/rent', { beachId: 'my_khe', minutes: 20 }, dn)).status, 400, 'chỉ có gói 15/30 phút');
  const price = jetSkiPrice(JETSKI_BEACHES.find((b) => b.id === 'my_khe')!, 15), before = await cashOf('jet_dn');
  const r = await call('POST', '/api/sea/jetski/rent', { beachId: 'my_khe', minutes: 15 }, dn);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(await cashOf('jet_dn'), before - price);
  assert.equal(r.body.energy, 100 - JETSKI_ENERGY);
  assert.ok(r.body.rental.endsAt - r.body.rental.startedAt >= 15 * 60_000 - 2000);
  assert.equal((await call('POST', '/api/sea/jetski/rent', { beachId: 'my_khe', minutes: 15 }, dn)).body.error, 'dang_thue');
  // trả ngay: chưa đủ một phút thì không có EXP
  const f1 = await call('POST', `/api/sea/jetski/${r.body.rental.id}/finish`, {}, dn);
  assert.equal(f1.body.xp, 0);
  // lượt thứ hai: giả như đã chạy 5 phút
  const r2 = await call('POST', '/api/sea/jetski/rent', { beachId: 'my_khe', minutes: 30 }, dn);
  assert.equal(r2.status, 200);
  await db.query("update jetski_rentals set started_at = now() - interval '5 minutes' where id = $1", [r2.body.rental.id]);
  const f2 = await call('POST', `/api/sea/jetski/${r2.body.rental.id}/finish`, {}, dn);
  assert.ok(f2.body.xp > 0);
  assert.equal((await call('POST', `/api/sea/jetski/${r2.body.rental.id}/finish`, {}, dn)).body.already, true, 'không cộng EXP hai lần');
  const poor = await signup('jet_ngheo', 'dn_tienphuoc', 100_000);
  assert.equal((await call('POST', '/api/sea/jetski/rent', { beachId: 'my_khe', minutes: 15 }, poor)).body.error, 'khong_du_tien');
});

test("hiện diện cảnh 'sea': thấy tàu người khác cùng vùng biển, khác vùng thì không, không có cư dân ảo", async () => {
  const a = await signup('tau_a', 'dt_caibe'), b = await signup('tau_b', 'dt_caibe'), c = await signup('tau_c', 'dt_caibe');
  assert.equal((await call('POST', '/api/presence', { scene: 'sea', key: 'tau:hp_catba', x: 10, z: 20, yaw: 1, speed: 12 }, a)).status, 200);
  await call('POST', '/api/presence', { scene: 'sea', key: 'jet:my_khe', x: 0, z: 0 }, c);
  const seen = await call('POST', '/api/presence', { scene: 'sea', key: 'tau:hp_catba', x: 0, z: 0 }, b);
  assert.equal(seen.status, 200);
  const names = seen.body.others.map((o: any) => o.name);
  assert.ok(names.includes('tau_a') && !names.includes('tau_c'));
  const ta = seen.body.others.find((o: any) => o.name === 'tau_a');
  assert.equal(ta.x, 10); assert.equal(ta.z, 20); assert.equal(ta.speed, 12);
  assert.ok(seen.body.others.every((o: any) => !o.bot), 'biển không trộn cư dân ảo (tàu bè do trình duyệt tự chạy)');
});
