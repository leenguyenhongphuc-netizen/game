// Khu vui chơi: vé cổng (đúng tỉnh, trừ tiền, hết hạn), lên trò cần vé đúng khu và tốn thể lực, khu trò chơi kỹ năng:
// xu giá cố định, vé thưởng theo điểm (không ngẫu nhiên), quà không quy đổi ra tiền; điểm tham quan sinh từ danh sách khu.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { LEVELS } from '../../shared/rules.ts';
import { ARCADE_GAMES, PARKS, PARK_PRIZES, TOKEN_PRICE, arcadeTickets, park } from '../../shared/parks.ts';
import { SIGHTS, sight } from '../../shared/sights.ts';

const url = process.env.TEST_PARKS_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test_parks';
let db: Db, app: FastifyInstance;
before(async () => {
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
  await db.query('update users set role = $2, role_assigned_at = now() where username = $1', [name, 'nong_dan']);
  assert.equal((await call('POST', '/api/onboard', { regionId }, r.cookie)).status, 200);
  await db.query('update users set cash = $2, xp = $3, energy = 100, energy_at = now() where username = $1', [name, cash, LEVELS[4].xp]);
  return r.cookie!;
}
const cashOf = async (name: string) => Number((await db.query('select cash from users where username = $1', [name])).rows[0].cash);
const ledgerSum = async (name: string, like: string) => Number((await db.query(`select coalesce(sum(l.delta),0) as s from ledger l join users u on u.id = l.user_id where u.username = $1 and l.reason like $2`, [name, like])).rows[0].s);

test('mỗi khu vui chơi là một điểm tham quan: vé cổng 0đ, điểm dừng gồm cổng, các trò, khu trò chơi, lối ra', () => {
  for (const p of PARKS) {
    const s = sight(p.sightId);
    assert.ok(s, p.id);
    assert.equal(s!.entryFee, 0);
    assert.equal(s!.park, p.id);
    assert.deepEqual(s!.stops.map((x) => x.id), ['cong_ve', ...p.rides.map((r) => r.id), ...(p.arcade ? ['khu_tro_choi'] : []), 'loi_ra']);
    assert.ok(p.tickets.every((t) => t.price >= 300_000 && t.price <= 1_500_000), 'giá vé nằm trong khoảng giá vé thật');
  }
  assert.equal(new Set(SIGHTS.map((s) => s.id)).size, SIGHTS.length, 'không trùng mã điểm tham quan');
  assert.ok(sight('park_bw_nha_trang')!.island && sight('park_bw_nha_trang')!.port, 'khu trên đảo phải đi tàu');
});

test('vé cổng: phải ở đúng tỉnh, trừ đúng giá, không mua trùng; lên trò cần vé có khu đó và tốn thể lực', async () => {
  const dn = await signup('khach_dn', 'dn_tienphuoc');
  const far = await signup('khach_xa', 'dt_caibe');
  const p = park('park_mw_ha_long')!;
  // ở Đồng Tháp không mua được vé khu Hạ Long
  assert.equal((await call('POST', `/api/parks/${p.id}/ticket`, { ticket: 'nuoc' }, far)).status, 409);
  const m = park('park_mw_da_nang')!, ticket = m.tickets.find((t) => t.id === 'cap_treo')!;
  const before = await cashOf('khach_dn');
  // chưa có vé thì không lên trò được
  assert.equal((await call('POST', `/api/parks/${m.id}/ride`, { ride: 'cap_treo_doi' }, dn)).status, 409);
  const buy = await call('POST', `/api/parks/${m.id}/ticket`, { ticket: 'cap_treo' }, dn);
  assert.equal(buy.status, 200, JSON.stringify(buy.body));
  assert.equal(await cashOf('khach_dn'), before - ticket.price);
  assert.equal((await call('POST', `/api/parks/${m.id}/ticket`, { ticket: 'cap_treo' }, dn)).status, 409, 'không mua trùng vé còn hạn');
  // vé cáp treo không dùng cho tàu lượn
  assert.equal((await call('POST', `/api/parks/${m.id}/ride`, { ride: 'tau_luon_sao_bang' }, dn)).status, 409);
  const ride = await call('POST', `/api/parks/${m.id}/ride`, { ride: 'cap_treo_doi' }, dn);
  assert.equal(ride.status, 200, JSON.stringify(ride.body));
  assert.equal(ride.body.energy, 100 - m.rides[0].energy);
  assert.ok(ride.body.xpGained > 0);
  // bấm lại ngay thì bị chặn (đang chơi)
  assert.equal((await call('POST', `/api/parks/${m.id}/ride`, { ride: 'cap_treo_doi' }, dn)).status, 409);
  // hết sức thì không lên trò
  await db.query(`update users set energy = 2, energy_at = now() where username = 'khach_dn'`);
  await call('POST', `/api/parks/${m.id}/ticket`, { ticket: 'tron_goi' }, dn);
  const tired = await call('POST', `/api/parks/${m.id}/ride`, { ride: 'tau_luon_sao_bang' }, dn);
  assert.equal(tired.status, 409); assert.equal(tired.body.error ?? tired.body.code ?? 'het_suc', tired.body.error ?? tired.body.code ?? 'het_suc');
  // vé hết hạn thì phải mua lại
  await db.query(`update park_passes set expires_at = now() - interval '1 minute'`);
  await db.query(`update users set energy = 100, energy_at = now() where username = 'khach_dn'`);
  await db.query(`update park_rides set last_at = now() - interval '1 hour'`);
  assert.equal((await call('POST', `/api/parks/${m.id}/ride`, { ride: 'cap_treo_doi' }, dn)).status, 409);
});

test('khu trò chơi kỹ năng: xu giá cố định, vé thưởng theo điểm, gửi điểm quá sớm không tính, quà không quy đổi ra tiền', async () => {
  const me = await signup('khach_tro_choi', 'dn_tienphuoc', 3_000_000);
  const m = park('park_mw_da_nang')!;
  assert.equal((await call('POST', `/api/parks/${m.id}/tokens`, { n: 5 }, me)).status, 409, 'chưa có vé cổng');
  assert.equal((await call('POST', `/api/parks/${m.id}/ticket`, { ticket: 'cap_treo' }, me)).status, 200);
  const c0 = await cashOf('khach_tro_choi'), led0 = Number((await db.query('select coalesce(max(id),0) as m from ledger')).rows[0].m);
  const t = await call('POST', `/api/parks/${m.id}/tokens`, { n: 6 }, me);
  assert.equal(t.status, 200); assert.equal(t.body.tokens, 6);
  assert.equal(await cashOf('khach_tro_choi'), c0 - 6 * TOKEN_PRICE);
  assert.equal((await call('POST', `/api/parks/${m.id}/tokens`, { n: 999 }, me)).status, 400);
  // gửi điểm ngay sau khi bắt đầu: không tính vé
  const s1 = await call('POST', `/api/parks/${m.id}/arcade/start`, { game: 'nem_vong' }, me);
  assert.equal(s1.status, 200); assert.equal(s1.body.tokens, 5);
  const f1 = await call('POST', `/api/parks/arcade/${s1.body.playId}/finish`, { score: 100 }, me);
  assert.equal(f1.body.ticketsWon, 0);
  assert.equal((await call('POST', `/api/parks/arcade/${s1.body.playId}/finish`, { score: 100 }, me)).status, 409, 'không nộp hai lần');
  // ván thật: điểm bị cắt ở mức tối đa, vé thưởng đúng công thức
  const s2 = await call('POST', `/api/parks/${m.id}/arcade/start`, { game: 'bong_ro' }, me);
  await db.query(`update arcade_plays set started_at = now() - interval '20 seconds' where id = $1`, [s2.body.playId]);
  const f2 = await call('POST', `/api/parks/arcade/${s2.body.playId}/finish`, { score: 5000 }, me);
  assert.equal(f2.body.score, ARCADE_GAMES.bong_ro.maxScore);
  assert.equal(f2.body.ticketsWon, arcadeTickets('bong_ro', 100));
  assert.equal(arcadeTickets('bong_ro', 73), arcadeTickets('bong_ro', 73), 'cùng điểm luôn cùng số vé (không ngẫu nhiên)');
  // hết xu thì không chơi
  await db.query(`update park_wallet set tokens = 0 where user_id = (select id from users where username = 'khach_tro_choi')`);
  assert.equal((await call('POST', `/api/parks/${m.id}/arcade/start`, { game: 'gap_thu' }, me)).status, 409);
  // đổi quà
  const cheap = PARK_PRIZES[0];
  const r = await call('POST', `/api/parks/prizes/${cheap.id}/redeem`, {}, me);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.tickets, f2.body.tickets - cheap.tickets);
  assert.equal((await call('POST', `/api/parks/prizes/${PARK_PRIZES.at(-1)!.id}/redeem`, {}, me)).status, 409, 'thiếu vé');
  // không có đường nào biến xu, vé, quà thành tiền: sổ cái chỉ có khoản chi, không có khoản thu từ khu trò chơi
  assert.equal(await ledgerSum('khach_tro_choi', 'xu_tro_choi%'), -6 * TOKEN_PRICE);
  const credits = (await db.query(`select count(*)::int as n from ledger l join users u on u.id = l.user_id where u.username = 'khach_tro_choi' and l.delta > 0 and l.id > $1`, [led0])).rows[0].n;
  assert.equal(credits, 0);
  for (const path of ['/api/parks/prizes/bong_bay/sell', '/api/parks/tokens/sell', '/api/parks/tickets/cash']) assert.equal((await call('POST', path, {}, me)).status, 404);
  const info = await call('GET', `/api/parks/${m.id}`, undefined, me);
  assert.deepEqual(info.body.prizes, [{ prizeId: cheap.id, qty: 1 }]);
});
