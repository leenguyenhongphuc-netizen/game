// Trò chuyện: lọc từ tục và thông tin cá nhân, chat chung kèm nhịp hiện diện, chống spam, chỉ bạn bè mới nhắn riêng,
// chặn và báo cáo, loa phát thanh. Dùng CSDL kiểm thử riêng (vuon_test_chat).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { BROADCAST_PRICE, PUBLIC_MAX, filterText } from '../../shared/chat.ts';
import { LEVELS } from '../../shared/rules.ts';

const url = process.env.TEST_CHAT_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test_chat';
let db: Db, app: FastifyInstance;
before(async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  app = await buildApp({ db, timeScale: 1e9, lateGraceMs: 600_000, adminToken: 'test-admin-token-0123456789', rateLimit: false, staticDir: '/nonexistent', bots: false,
    marketEventsAt: () => [], inSeason: () => false, paceFactor: () => 1, testerUsernames: [], tripMinFactor: 0,
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
async function signup(name: string): Promise<{ cookie: string; id: number }> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name.toUpperCase() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await db.query(`update users set role = 'nong_dan', role_assigned_at = now() where username = $1`, [name]);
  const o = await call('POST', '/api/onboard', { regionId: 'dt_caibe' }, r.cookie);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  return { cookie: r.cookie!, id: Number((await db.query('select id from users where username = $1', [name])).rows[0].id) };
}
const ADMIN = { authorization: 'Bearer test-admin-token-0123456789' };
/** Bỏ chống spam bằng cách đẩy lùi thời điểm các tin đã gửi. */
const age = (table: string) => db.query(`update ${table} set created_at = created_at - interval '5 minutes'`);

test('bộ lọc: che từ tục (có dấu, không dấu, viết lặp, viết liền), số điện thoại, đường dẫn; không che chữ thường', () => {
  const masked = (s: string) => filterText(s, 200).masked;
  for (const s of ['đm thằng này', 'dmmm', 'ĐỊT', 'đồ chó đẻ', 'ditme', 'cái lồn', 'gọi 0912 345 678', '+84 912345678', 'vào zalo: abc', 'xem fb.com/x', 'www.abc.vn', 'mail a.b@gmail.com'])
    assert.ok(masked(s), `phải che: ${s}`);
  for (const s of ['Chào cả nhà, buổi sáng vui nhé!', 'đi đèo Hải Vân', 'xe 125cc', 'mua 2 lon bia', 'lớn lên làm nông', 'đủ tiền chưa', 'các bạn ơi', 'cụ ông'])
    assert.ok(!masked(s), `không được che: ${s}`);
  assert.equal(filterText('chào đm nhé', 80).text, 'chào *** nhé');
  assert.equal([...filterText('a'.repeat(200), PUBLIC_MAX).text].length, PUBLIC_MAX);
});

test('chat chung: gửi, lọc, chống spam, về theo nhịp hiện diện thành bong bóng và nhật ký; chặn thì không thấy', async () => {
  const a = await signup('chat_a'), b = await signup('chat_b');
  const key = { scene: 'sight', key: 'hoi_an' };
  await call('POST', '/api/presence', { ...key, x: 0, z: 0 }, a.cookie);
  let r = await call('POST', '/api/chat/public', { ...key, text: 'Chào mọi người!' }, a.cookie);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call('POST', '/api/chat/public', { ...key, text: 'tin thứ hai' }, a.cookie);
  assert.equal(r.status, 429, 'cách nhau ít nhất 3 giây');
  r = await call('POST', '/api/chat/public', { ...key, text: 'x'.repeat(PUBLIC_MAX + 1) }, a.cookie);
  assert.equal(r.status, 400, 'quá 80 ký tự');
  await age('chat_public');
  r = await call('POST', '/api/chat/public', { ...key, text: 'dm' }, a.cookie);
  assert.equal(r.status, 400, 'chỉ toàn từ tục thì không gửi');
  r = await call('POST', '/api/chat/public', { ...key, text: 'gọi tui 0912345678 nha' }, a.cookie);
  assert.equal(r.status, 200); assert.equal(r.body.text, 'gọi tui *** nha'); assert.equal(r.body.masked, true);
  const raw = (await db.query('select raw from chat_public order by id desc limit 1')).rows[0].raw;
  assert.ok(raw.includes('0912345678'), 'nguyên văn lưu lại để xử lý báo cáo');
  r = await call('POST', '/api/chat/public', { scene: 'xyz', key: 'k', text: 'hi' }, a.cookie);
  assert.equal(r.status, 400);

  r = await call('POST', '/api/presence', { ...key, x: 1, z: 1, chatSince: 0 }, b.cookie);
  assert.deepEqual(r.body.chat.map((m: any) => m.text), ['Chào mọi người!', 'gọi tui *** nha']);
  assert.equal(r.body.chat[0].name, 'CHAT_A');
  const other = r.body.others.find((o: any) => o.name === 'CHAT_A');
  assert.equal(other.say.text, 'gọi tui *** nha', 'bong bóng tin mới nhất');
  const last = r.body.chat.at(-1).id;
  r = await call('POST', '/api/presence', { ...key, x: 1, z: 1, chatSince: last }, b.cookie);
  assert.equal(r.body.chat.length, 0, 'chỉ trả tin mới hơn');
  r = await call('POST', '/api/presence', { ...key, x: 1, z: 1 }, b.cookie);
  assert.equal(r.body.chat, undefined, 'không xin nhật ký thì không trả');
  r = await call('POST', '/api/presence', { scene: 'sight', key: 'my_son', x: 1, z: 1, chatSince: 0 }, b.cookie);
  assert.equal(r.body.chat.length, 0, 'cảnh khác không thấy');
  // chặn: không thấy tin và bong bóng của người bị chặn
  assert.equal((await call('POST', `/api/chat/block/${a.id}`, {}, b.cookie)).status, 200);
  r = await call('POST', '/api/presence', { ...key, x: 1, z: 1, chatSince: 0 }, b.cookie);
  assert.equal(r.body.chat.length, 0);
  assert.equal(r.body.others.find((o: any) => o.name === 'CHAT_A')?.say, undefined);
  assert.equal((await call('DELETE', `/api/chat/block/${a.id}`, undefined, b.cookie)).status, 200);
  // tối đa 10 tin mỗi phút
  await db.query(`insert into chat_public (user_id, scene, scene_key, text, raw, created_at) select $1, 'sight', 'hoi_an', 'x', 'x', now() - interval '20 seconds' from generate_series(1, 10)`, [a.id]);
  assert.equal((await call('POST', '/api/chat/public', { ...key, text: 'nữa' }, a.cookie)).status, 429);
});

test('kết bạn bằng thẻ người chơi; chỉ bạn bè mới nhắn riêng; chặn thì huỷ bạn và không nhắn được; báo cáo lưu nguyên văn', async () => {
  const a = await signup('dm_a'), b = await signup('dm_b'), c = await signup('dm_c');
  let r = await call('GET', `/api/players/${b.id}/card`, undefined, a.cookie);
  assert.equal(r.status, 200);
  assert.equal(r.body.name, 'DM_B'); assert.equal(r.body.friend, 'none'); assert.equal(r.body.level, 1); assert.ok(r.body.region.includes(','));
  assert.ok(!('username' in r.body), 'không lộ tên tài khoản');
  r = await call('POST', `/api/chat/dm/${b.id}`, { text: 'chào' }, a.cookie);
  assert.equal(r.status, 403, 'chưa là bạn thì không nhắn riêng');
  assert.equal((await call('POST', `/api/friends/by-id/${b.id}`, {}, a.cookie)).body.status, 'requested');
  assert.equal((await call('GET', `/api/players/${a.id}/card`, undefined, b.cookie)).body.friend, 'incoming');
  assert.equal((await call('GET', '/api/chat/poll', undefined, b.cookie)).body.requests, 1);
  assert.equal((await call('POST', `/api/friends/by-id/${a.id}`, {}, b.cookie)).body.status, 'accepted', 'gửi ngược = chấp nhận');
  r = await call('POST', `/api/chat/dm/${b.id}`, { text: 'Chào bạn, mai đi Hội An không? ' + 'rất dài '.repeat(100) }, a.cookie);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call('POST', `/api/chat/dm/${b.id}`, { text: 'x'.repeat(2001) }, a.cookie);
  assert.equal(r.status, 400, 'quá 2.000 ký tự');
  r = await call('GET', '/api/chat/poll', undefined, b.cookie);
  assert.equal(r.body.unread, 1);
  r = await call('GET', '/api/chat/threads', undefined, b.cookie);
  assert.equal(r.body.threads[0].name, 'DM_A'); assert.equal(r.body.threads[0].unread, 1);
  r = await call('GET', `/api/chat/dm/${a.id}`, undefined, b.cookie);
  assert.equal(r.body.msgs.length, 1); assert.equal(r.body.canSend, true);
  await call('POST', `/api/chat/dm/${a.id}/read`, {}, b.cookie);
  assert.equal((await call('GET', '/api/chat/poll', undefined, b.cookie)).body.unread, 0);
  r = await call('POST', `/api/chat/dm/${a.id}`, { text: 'đmm' }, b.cookie);
  assert.equal(r.status, 400, 'toàn từ tục thì không gửi');
  // báo cáo
  await age('chat_dm');
  await call('POST', `/api/chat/dm/${b.id}`, { text: 'cho xin số điện thoại 0987654321' }, a.cookie);
  r = await call('POST', '/api/chat/report', { userId: a.id, reason: 'thong_tin_ca_nhan', note: 'xin số' }, b.cookie);
  assert.equal(r.status, 200);
  const rep = await call('GET', '/api/admin/chat-reports', undefined, undefined, ADMIN);
  assert.ok(JSON.stringify(rep.body.reports[0].context).includes('0987654321'), 'người kiểm duyệt thấy nguyên văn');
  assert.equal((await call('GET', '/api/admin/chat-reports', undefined, b.cookie)).status, 401);
  // chặn: huỷ bạn, không nhắn được hai chiều
  assert.equal((await call('POST', `/api/chat/block/${a.id}`, {}, b.cookie)).status, 200);
  assert.equal((await call('GET', `/api/players/${a.id}/card`, undefined, b.cookie)).body.friend, 'none');
  assert.equal((await call('GET', `/api/players/${b.id}/card`, undefined, a.cookie)).body.blockedMe, true);
  await age('chat_dm');
  assert.equal((await call('POST', `/api/chat/dm/${b.id}`, { text: 'alo' }, a.cookie)).status, 403);
  assert.equal((await call('POST', `/api/friends/by-id/${b.id}`, {}, a.cookie)).status, 403, 'bị chặn thì không gửi lời mời được');
  // người lạ vẫn không nhắn được
  assert.equal((await call('POST', `/api/chat/dm/${a.id}`, { text: 'hi' }, c.cookie)).status, 403);
});

test('loa phát thanh: đủ cấp, trả tiền, 1 lượt/giờ, xếp hàng nối đuôi, lọc nội dung; quản trị phát miễn phí; mọi người nhận theo nhịp', async () => {
  const a = await signup('loa_a'), b = await signup('loa_b');
  let r = await call('POST', '/api/chat/broadcast', { text: 'Chợ phiên Cái Bè sáng nay!' }, a.cookie);
  assert.equal(r.status, 403, 'chưa đủ cấp');
  const lv10 = LEVELS.find((l) => l.level === 10)!;
  await db.query('update users set xp = $1, cash = $2 where id in ($3,$4)', [lv10.xp, BROADCAST_PRICE * 3, a.id, b.id]);
  r = await call('POST', '/api/chat/broadcast', { text: 'gọi 0912345678 mua sầu riêng' }, a.cookie);
  assert.equal(r.status, 400, 'loa không được có số điện thoại');
  r = await call('POST', '/api/chat/broadcast', { text: 'Chợ phiên Cái Bè sáng nay!' }, a.cookie);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const first = r.body.broadcast;
  assert.equal(Number((await db.query('select cash from users where id = $1', [a.id])).rows[0].cash), BROADCAST_PRICE * 2);
  r = await call('POST', '/api/chat/broadcast', { text: 'lần nữa' }, a.cookie);
  assert.equal(r.status, 429, '1 lượt mỗi giờ');
  r = await call('POST', '/api/chat/broadcast', { text: 'Ghé vườn mình chơi nhé' }, b.cookie);
  assert.equal(r.status, 200);
  assert.ok(r.body.broadcast.startsAt >= first.endsAt - 5, 'xếp hàng sau lượt trước');
  r = await call('POST', '/api/admin/broadcast', { text: 'Bảo trì lúc 23 giờ' }, undefined, ADMIN);
  assert.equal(r.status, 200); assert.equal(r.body.broadcast.admin, true);
  assert.equal((await call('POST', '/api/admin/broadcast', { text: 'x' }, a.cookie)).status, 401);
  r = await call('GET', '/api/chat/poll?b=0', undefined, b.cookie);
  assert.deepEqual(r.body.broadcasts.map((x: any) => x.text), ['Chợ phiên Cái Bè sáng nay!', 'Ghé vườn mình chơi nhé', 'Bảo trì lúc 23 giờ']);
  r = await call('GET', `/api/chat/poll?b=${r.body.broadcasts[1].id}`, undefined, b.cookie);
  assert.deepEqual(r.body.broadcasts.map((x: any) => x.from), ['Ban quản trị Vườn Việt'], 'chỉ lượt mới hơn');
  const reason = (await db.query(`select reason from ledger where user_id = $1 and reason like 'loa:%'`, [a.id])).rows;
  assert.equal(reason.length, 1, 'trừ tiền có ghi sổ');
});
