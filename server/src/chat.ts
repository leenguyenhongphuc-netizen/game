// Trò chuyện: chat công cộng theo cảnh (bong bóng trên đầu, đi kèm nhịp hiện diện), chat riêng giữa bạn bè,
// loa phát thanh toàn máy chủ, kết bạn bằng thẻ người chơi, chặn và báo cáo. Luật và bộ lọc ở shared/chat.ts.
// Không có WebSocket (Vercel): chat công cộng về theo nhịp /api/presence, hộp thư và loa về theo nhịp /api/chat/poll.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { REGIONS } from '../../shared/catalog.ts';
import { MAX_FRIENDS, levelOf } from '../../shared/rules.ts';
import {
  BROADCAST_COOLDOWN_MS, BROADCAST_MAX, BROADCAST_MIN_LEVEL, BROADCAST_PRICE, BROADCAST_SHOW_MS, BUBBLE_MS, CHAT_KEEP_DAYS, DM_MAX, DM_MIN_GAP_MS, DM_PER_MIN,
  PUBLIC_LOG_MAX, PUBLIC_LOG_MS, PUBLIC_MAX, PUBLIC_MIN_GAP_MS, PUBLIC_PER_MIN, REPORT_REASONS, filterText,
} from '../../shared/chat.ts';
import type { Broadcast, ChatPoll, ChatThread, DmMsg, PlayerCard, PublicMsg } from '../../shared/chat.ts';
import { PRESENCE_SCENES } from '../../shared/social.ts';
import type { PresenceScene } from '../../shared/social.ts';

export const CHAT_SCHEMA = `
create table if not exists chat_public (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  scene text not null, scene_key text not null,
  text text not null, raw text not null, masked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists chat_public_scene_idx on chat_public (scene, scene_key, id);
create index if not exists chat_public_user_idx on chat_public (user_id, created_at);
create table if not exists chat_dm (
  id bigserial primary key,
  from_id bigint not null references users(id) on delete cascade,
  to_id bigint not null references users(id) on delete cascade,
  text text not null, raw text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists chat_dm_pair_idx on chat_dm (least(from_id, to_id), greatest(from_id, to_id), id);
create index if not exists chat_dm_unread_idx on chat_dm (to_id) where read_at is null;
create index if not exists chat_dm_from_idx on chat_dm (from_id, created_at);
create table if not exists user_blocks (
  blocker bigint not null references users(id) on delete cascade,
  blocked bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
create table if not exists chat_reports (
  id bigserial primary key,
  reporter bigint not null references users(id) on delete cascade,
  target bigint not null references users(id) on delete cascade,
  reason text not null, note text,
  context jsonb,
  status text not null default 'moi',
  created_at timestamptz not null default now()
);
create table if not exists broadcasts (
  id bigserial primary key,
  user_id bigint references users(id) on delete set null,
  sender text not null,
  text text not null, raw text not null,
  paid bigint not null default 0,
  starts_at timestamptz not null, ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists broadcasts_ends_idx on broadcasts (ends_at);
`;

export interface ChatDeps {
  db: Db;
  requireUser: (req: FastifyRequest) => Promise<number>;
  requireAdmin: (req: FastifyRequest) => void;
  bad: (code: string, message: string, status?: number) => Error;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
}
export interface ChatFeed { msgs: PublicMsg[]; say: Map<number, { id: number; text: string }> }

const pair = (x: number, y: number): [number, number] => (x < y ? [x, y] : [y, x]);
const ms = (d: Date | string) => new Date(d).getTime();
const BLOCKED_EITHER = `exists (select 1 from user_blocks b where (b.blocker = $1 and b.blocked = %U) or (b.blocker = %U and b.blocked = $1))`;
const blockedSql = (col: string) => BLOCKED_EITHER.replaceAll('%U', col);

export function registerChat(app: FastifyInstance, d: ChatDeps) {
  const { db, bad } = d;
  const tooFast = (msg: string) => bad('qua_nhanh', msg, 429);
  const idOf = (v: unknown): number => { const n = Number(v); if (!Number.isSafeInteger(n) || n <= 0) throw bad('du_lieu_sai', 'Mã người chơi không hợp lệ.'); return n; };
  let lastSweep = 0;
  /** Dọn nhật ký quá hạn lưu (chạy thưa, kèm một yêu cầu bất kỳ). */
  async function sweep() {
    if (Date.now() - lastSweep < 3600_000) return; lastSweep = Date.now();
    await db.query(`delete from chat_public where created_at < now() - interval '${CHAT_KEEP_DAYS} days'`);
    await db.query(`delete from chat_dm where created_at < now() - interval '${CHAT_KEEP_DAYS * 6} days'`);
  }
  async function isBlocked(q: Q, a: number, b: number): Promise<{ either: boolean; byMe: boolean; byThem: boolean }> {
    const { rows } = await q.query('select blocker from user_blocks where (blocker = $1 and blocked = $2) or (blocker = $2 and blocked = $1)', [a, b]);
    const byMe = rows.some((r) => Number(r.blocker) === a), byThem = rows.some((r) => Number(r.blocker) === b);
    return { either: byMe || byThem, byMe, byThem };
  }
  async function friendState(q: Q, me: number, other: number): Promise<PlayerCard['friend']> {
    const { rows } = await q.query('select status, requested_by from friendships where user_a = $1 and user_b = $2', pair(me, other));
    const f = rows[0]; if (!f) return 'none';
    if (f.status === 'accepted') return 'friends';
    return Number(f.requested_by) === me ? 'outgoing' : 'incoming';
  }
  async function userBrief(q: Q, id: number) {
    const { rows } = await q.query('select id, display_name, role, home_region_id, xp, is_bot from users where id = $1', [id]);
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------- thẻ người chơi, kết bạn bằng mã người chơi
  app.get('/api/players/:id/card', async (req): Promise<PlayerCard> => {
    const me = await d.requireUser(req), id = idOf((req.params as { id: string }).id);
    const u = await userBrief(db, id);
    if (!u) throw bad('khong_tim_thay', 'Không tìm thấy người chơi.', 404);
    const bl = await isBlocked(db, me, id);
    const r = u.home_region_id ? REGIONS[u.home_region_id] : null;
    return {
      userId: id, name: u.display_name, role: u.role ?? null, level: levelOf(Number(u.xp) || 0).level,
      // chỉ lộ vùng trồng (huyện/tỉnh) như ở xóm, không lộ xã/phường hay toạ độ
      region: r ? `${r.name}, ${r.province}` : null, bot: !!u.is_bot,
      friend: id === me ? 'none' : await friendState(db, me, id), blocked: bl.byMe, blockedMe: bl.byThem,
    };
  });

  app.post('/api/friends/by-id/:id', async (req) => {
    const me = await d.requireUser(req), id = idOf((req.params as { id: string }).id);
    if (id === me) throw bad('tu_ket_ban', 'Bạn không thể kết bạn với chính mình.', 409);
    const u = await userBrief(db, id);
    if (!u) throw bad('khong_tim_thay', 'Không tìm thấy người chơi.', 404);
    if (u.is_bot) throw bad('cu_dan_ao', 'Đây là cư dân của xóm, không kết bạn được.', 409);
    const [a, c] = pair(me, id);
    return db.tx(async (q) => {
      if ((await isBlocked(q, me, id)).either) throw bad('da_chan', 'Không thể kết bạn với người này.', 403);
      await q.query('select id from users where id in ($1,$2) order by id for update', [a, c]);
      const { rows } = await q.query('select status, requested_by from friendships where user_a = $1 and user_b = $2 for update', [a, c]);
      const f = rows[0];
      if (!f) { await q.query(`insert into friendships (user_a, user_b, requested_by, status) values ($1,$2,$3,'pending')`, [a, c, me]); return { status: 'requested' }; }
      if (f.status === 'accepted') throw bad('da_ket_ban', 'Hai bạn đã là bạn bè.', 409);
      if (Number(f.requested_by) === me) throw bad('da_ket_ban', 'Bạn đã gửi lời mời rồi, hãy chờ người kia chấp nhận.', 409);
      const cnt = await q.query(`select u.id, (select count(*)::int from friendships f where f.status = 'accepted' and (f.user_a = u.id or f.user_b = u.id)) as n from users u where u.id in ($1,$2)`, [a, c]);
      if (cnt.rows.some((r) => r.n >= MAX_FRIENDS)) throw bad('day_ban', `Mỗi người có tối đa ${MAX_FRIENDS} bạn.`, 409);
      await q.query(`update friendships set status = 'accepted', accepted_at = now() where user_a = $1 and user_b = $2`, [a, c]);
      return { status: 'accepted' };
    });
  });

  // ---------------------------------------------------------------- chặn, báo cáo
  app.get('/api/chat/blocks', async (req) => {
    const me = await d.requireUser(req);
    const { rows } = await db.query('select b.blocked, u.display_name from user_blocks b join users u on u.id = b.blocked where b.blocker = $1 order by b.created_at desc', [me]);
    return { blocks: rows.map((r) => ({ userId: Number(r.blocked), name: r.display_name })) };
  });
  app.post('/api/chat/block/:id', async (req) => {
    const me = await d.requireUser(req), id = idOf((req.params as { id: string }).id);
    if (id === me) throw bad('du_lieu_sai', 'Không thể tự chặn mình.');
    if (!(await userBrief(db, id))) throw bad('khong_tim_thay', 'Không tìm thấy người chơi.', 404);
    await db.tx(async (q) => {
      await q.query('insert into user_blocks (blocker, blocked) values ($1,$2) on conflict do nothing', [me, id]);
      // chặn thì huỷ luôn quan hệ bạn bè / lời mời, người kia không nhắn riêng được nữa
      await q.query('delete from friendships where user_a = $1 and user_b = $2', pair(me, id));
    });
    return { ok: true };
  });
  app.delete('/api/chat/block/:id', async (req) => {
    const me = await d.requireUser(req), id = idOf((req.params as { id: string }).id);
    await db.query('delete from user_blocks where blocker = $1 and blocked = $2', [me, id]);
    return { ok: true };
  });
  app.post('/api/chat/report', async (req) => {
    const me = await d.requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const id = idOf(b.userId), reason = String(b.reason ?? '');
    if (!(reason in REPORT_REASONS)) throw bad('du_lieu_sai', 'Hãy chọn lý do báo cáo.');
    if (id === me || !(await userBrief(db, id))) throw bad('khong_tim_thay', 'Không tìm thấy người chơi.', 404);
    const recent = (await db.query(`select count(*)::int as n from chat_reports where reporter = $1 and created_at > now() - interval '1 hour'`, [me])).rows[0].n;
    if (recent >= 10) throw tooFast('Bạn đã gửi nhiều báo cáo, hãy chờ một lúc.');
    const note = typeof b.note === 'string' ? b.note.slice(0, 500) : null;
    // lưu kèm 20 tin gần nhất của người bị báo cáo (công cộng + gửi cho mình) để người kiểm duyệt xem nguyên văn
    const pub = await db.query(`select id, scene, scene_key, raw, created_at from chat_public where user_id = $1 and created_at > now() - interval '1 day' order by id desc limit 20`, [id]);
    const dm = await db.query(`select id, raw, created_at from chat_dm where from_id = $1 and to_id = $2 order by id desc limit 20`, [id, me]);
    const { rows } = await db.query('insert into chat_reports (reporter, target, reason, note, context) values ($1,$2,$3,$4,$5) returning id',
      [me, id, reason, note, JSON.stringify({ public: pub.rows, dm: dm.rows })]);
    return { ok: true, id: Number(rows[0].id) };
  });
  // người kiểm duyệt (ADMIN_TOKEN) xem báo cáo
  app.get('/api/admin/chat-reports', async (req) => {
    d.requireAdmin(req);
    const { rows } = await db.query(`select r.*, a.display_name as reporter_name, t.display_name as target_name from chat_reports r join users a on a.id = r.reporter join users t on t.id = r.target order by r.id desc limit 100`);
    return { reports: rows };
  });

  // ---------------------------------------------------------------- chat công cộng
  async function recentPublic(q: Q, me: number, scene: string, key: string, after: number): Promise<PublicMsg[]> {
    const { rows } = await q.query(
      `select c.id, c.user_id, c.text, c.created_at, u.display_name, u.is_bot from chat_public c join users u on u.id = c.user_id
       where c.scene = $2 and c.scene_key = $3 and c.id > $4 and c.created_at > now() - interval '${Math.round(PUBLIC_LOG_MS / 1000)} seconds'
         and not ${blockedSql('c.user_id')}
       order by c.id desc limit ${PUBLIC_LOG_MAX}`, [me, scene, key, after]);
    return rows.reverse().map((r) => ({ id: Number(r.id), userId: Number(r.user_id), name: r.display_name, text: r.text, at: ms(r.created_at), ...(r.is_bot ? { bot: true } : {}) }));
  }
  /** Gọi từ /api/presence: tin mới trong cảnh kể từ `after` và tin còn hiện bong bóng của từng người. */
  async function feed(me: number, scene: string, key: string, after: number | null): Promise<ChatFeed> {
    const msgs = after === null ? [] : await recentPublic(db, me, scene, key, after);
    const { rows } = await db.query(
      `select distinct on (c.user_id) c.user_id, c.id, c.text from chat_public c
       where c.scene = $2 and c.scene_key = $3 and c.created_at > now() - interval '${Math.round(BUBBLE_MS / 1000)} seconds' and c.user_id <> $1
         and not ${blockedSql('c.user_id')}
       order by c.user_id, c.id desc`, [me, scene, key]);
    const say = new Map<number, { id: number; text: string }>();
    for (const r of rows) say.set(Number(r.user_id), { id: Number(r.id), text: r.text });
    return { msgs, say };
  }
  app.get('/api/chat/public', async (req) => {
    const me = await d.requireUser(req);
    const qs = req.query as Record<string, string>;
    const scene = String(qs.scene ?? ''), key = String(qs.key ?? '').slice(0, 80);
    if (!PRESENCE_SCENES.includes(scene as PresenceScene) || !key) throw bad('du_lieu_sai', 'Cảnh không hợp lệ.');
    return { msgs: await recentPublic(db, me, scene, key, Number(qs.after) || 0) };
  });
  app.post('/api/chat/public', async (req) => {
    const me = await d.requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const scene = String(b.scene ?? ''), key = typeof b.key === 'string' ? b.key.slice(0, 80) : '';
    if (!PRESENCE_SCENES.includes(scene as PresenceScene) || !key) throw bad('du_lieu_sai', 'Cảnh không hợp lệ.');
    const raw = typeof b.text === 'string' ? b.text : '';
    if ([...raw.trim()].length > PUBLIC_MAX) throw bad('qua_dai', `Tin chat chung tối đa ${PUBLIC_MAX} ký tự.`);
    const f = filterText(raw.replace(/\n+/g, ' '), PUBLIC_MAX);
    if (!f.text || f.text === '***') { if (f.masked) throw bad('bi_chan', 'Tin nhắn có từ ngữ hoặc thông tin không được phép.'); throw bad('du_lieu_sai', 'Hãy gõ nội dung.'); }
    const { rows: rl } = await db.query(
      `select count(*) filter (where created_at > now() - interval '1 minute')::int as n, max(created_at) as last from chat_public where user_id = $1 and created_at > now() - interval '1 minute'`, [me]);
    if (rl[0].last && Date.now() - ms(rl[0].last) < PUBLIC_MIN_GAP_MS) throw tooFast('Chậm lại chút nhé, mỗi tin cách nhau 3 giây.');
    if (rl[0].n >= PUBLIC_PER_MIN) throw tooFast(`Tối đa ${PUBLIC_PER_MIN} tin mỗi phút ở chat chung.`);
    const { rows } = await db.query('insert into chat_public (user_id, scene, scene_key, text, raw, masked) values ($1,$2,$3,$4,$5,$6) returning id, created_at',
      [me, scene, key, f.text, raw.slice(0, 500), f.masked]);
    void sweep().catch(() => {});
    return { id: Number(rows[0].id), text: f.text, masked: f.masked, at: ms(rows[0].created_at) };
  });

  // ---------------------------------------------------------------- chat riêng (chỉ bạn bè)
  async function mustFriend(q: Q, me: number, other: number) {
    if (other === me) throw bad('du_lieu_sai', 'Không thể nhắn cho chính mình.');
    const bl = await isBlocked(q, me, other);
    if (bl.either) throw bad('da_chan', bl.byMe ? 'Bạn đã chặn người này. Bỏ chặn để nhắn tin.' : 'Người này không nhận tin nhắn từ bạn.', 403);
    if ((await friendState(q, me, other)) !== 'friends') throw bad('chua_ket_ban', 'Chỉ nhắn riêng được khi hai người đã là bạn bè.', 403);
  }
  app.get('/api/chat/threads', async (req): Promise<{ threads: ChatThread[] }> => {
    const me = await d.requireUser(req);
    const { rows } = await db.query(
      `with fr as (
         select case when f.user_a = $1 then f.user_b else f.user_a end as uid from friendships f where f.status = 'accepted' and (f.user_a = $1 or f.user_b = $1)
       )
       select u.id, u.display_name,
              (select row_to_json(m) from (select text, created_at, from_id from chat_dm where least(from_id, to_id) = least($1::bigint, u.id) and greatest(from_id, to_id) = greatest($1::bigint, u.id) order by id desc limit 1) m) as last,
              (select count(*)::int from chat_dm where from_id = u.id and to_id = $1 and read_at is null) as unread
       from fr join users u on u.id = fr.uid where not ${blockedSql('u.id')}`, [me]);
    const threads = rows.map((r) => ({ userId: Number(r.id), name: r.display_name, unread: r.unread, last: r.last ? { text: r.last.text, at: ms(r.last.created_at), mine: Number(r.last.from_id) === me } : null }))
      .sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0) || a.name.localeCompare(b.name, 'vi'));
    return { threads };
  });
  app.get('/api/chat/dm/:id', async (req): Promise<{ msgs: DmMsg[]; canSend: boolean; reason?: string }> => {
    const me = await d.requireUser(req), id = idOf((req.params as { id: string }).id);
    const after = Number((req.query as Record<string, string>).after) || 0;
    const { rows } = await db.query(
      `select id, from_id, to_id, text, created_at, read_at from chat_dm
       where least(from_id, to_id) = least($1::bigint, $2::bigint) and greatest(from_id, to_id) = greatest($1::bigint, $2::bigint) and id > $3
       order by id desc limit 100`, [me, id, after]);
    // người đã chặn mình vẫn đọc được lịch sử cũ của chính mình, nhưng không thấy tin mới của người bị chặn
    const bl = await isBlocked(db, me, id);
    const msgs = rows.reverse().filter((r) => !(bl.byMe && Number(r.from_id) === id && r.read_at === null))
      .map((r) => ({ id: Number(r.id), from: Number(r.from_id), to: Number(r.to_id), text: r.text, at: ms(r.created_at), read: r.read_at !== null }));
    let canSend = true, reason: string | undefined;
    try { await mustFriend(db, me, id); } catch (e) { canSend = false; reason = (e as Error).message; }
    return { msgs, canSend, ...(reason ? { reason } : {}) };
  });
  app.post('/api/chat/dm/:id', async (req) => {
    const me = await d.requireUser(req), id = idOf((req.params as { id: string }).id);
    const raw = typeof (req.body as Record<string, unknown> | null)?.text === 'string' ? String((req.body as Record<string, unknown>).text) : '';
    if ([...raw.trim()].length > DM_MAX) throw bad('qua_dai', `Mỗi tin nhắn tối đa ${DM_MAX.toLocaleString('vi-VN')} ký tự.`);
    await mustFriend(db, me, id);
    const f = filterText(raw, DM_MAX);
    if (!f.text || f.text === '***') { if (f.masked) throw bad('bi_chan', 'Tin nhắn có từ ngữ hoặc thông tin không được phép.'); throw bad('du_lieu_sai', 'Hãy gõ nội dung.'); }
    const { rows: rl } = await db.query(
      `select count(*)::int as n, max(created_at) as last from chat_dm where from_id = $1 and created_at > now() - interval '1 minute'`, [me]);
    if (rl[0].last && Date.now() - ms(rl[0].last) < DM_MIN_GAP_MS) throw tooFast('Gửi chậm lại chút nhé.');
    if (rl[0].n >= DM_PER_MIN) throw tooFast(`Tối đa ${DM_PER_MIN} tin mỗi phút.`);
    const { rows } = await db.query('insert into chat_dm (from_id, to_id, text, raw) values ($1,$2,$3,$4) returning id, created_at', [me, id, f.text, raw.slice(0, DM_MAX)]);
    void sweep().catch(() => {});
    return { id: Number(rows[0].id), text: f.text, masked: f.masked, at: ms(rows[0].created_at) };
  });
  app.post('/api/chat/dm/:id/read', async (req) => {
    const me = await d.requireUser(req), id = idOf((req.params as { id: string }).id);
    await db.query('update chat_dm set read_at = now() where from_id = $2 and to_id = $1 and read_at is null', [me, id]);
    return { ok: true };
  });

  // ---------------------------------------------------------------- loa phát thanh, nhịp hộp thư
  const toBroadcast = (r: Record<string, unknown>): Broadcast => ({ id: Number(r.id), text: String(r.text), from: String(r.sender), admin: r.user_id === null, startsAt: ms(r.starts_at as string), endsAt: ms(r.ends_at as string) });
  /** Xếp lượt loa nối đuôi lượt đang/đã xếp (khoá tư vấn để hai người mua cùng lúc không chồng giờ). */
  async function enqueue(q: Q, userId: number | null, sender: string, text: string, raw: string, paid: number): Promise<Broadcast> {
    await q.query('select pg_advisory_xact_lock(7710042)');
    const { rows } = await q.query(
      `insert into broadcasts (user_id, sender, text, raw, paid, starts_at, ends_at)
       select $1, $2, $3, $4, $5, s, s + ($6 || ' milliseconds')::interval from (select greatest(now(), coalesce(max(ends_at), now())) as s from broadcasts) x
       returning *`, [userId, sender, text, raw, paid, String(BROADCAST_SHOW_MS)]);
    return toBroadcast(rows[0]);
  }
  app.post('/api/chat/broadcast', async (req) => {
    const me = await d.requireUser(req);
    const raw = typeof (req.body as Record<string, unknown> | null)?.text === 'string' ? String((req.body as Record<string, unknown>).text) : '';
    if ([...raw.trim()].length > BROADCAST_MAX) throw bad('qua_dai', `Loa phát thanh tối đa ${BROADCAST_MAX} ký tự.`);
    const f = filterText(raw.replace(/\n+/g, ' '), BROADCAST_MAX);
    if (!f.text || f.masked) throw bad('bi_chan', f.masked ? 'Nội dung loa không được có từ tục, số điện thoại hay đường dẫn.' : 'Hãy gõ nội dung.');
    return db.tx(async (q) => {
      const u = (await q.query('select display_name, xp, cash, is_bot from users where id = $1 for update', [me])).rows[0];
      if (u.is_bot) throw bad('khong_co_quyen', 'Không có quyền.', 403);
      if (levelOf(Number(u.xp) || 0).level < BROADCAST_MIN_LEVEL) throw bad('chua_du_cap', `Từ cấp ${BROADCAST_MIN_LEVEL} mới mua được lượt loa phát thanh.`, 403);
      const last = (await q.query('select max(created_at) as t from broadcasts where user_id = $1', [me])).rows[0].t;
      if (last && Date.now() - ms(last) < BROADCAST_COOLDOWN_MS) throw tooFast('Mỗi người chỉ phát loa 1 lần mỗi giờ.');
      if (Number(u.cash) < BROADCAST_PRICE) throw bad('khong_du_tien', 'Bạn không đủ tiền mua lượt loa.', 409);
      const bc = await enqueue(q, me, u.display_name, f.text, raw.slice(0, 500), BROADCAST_PRICE);
      await d.addCash(q, me, -BROADCAST_PRICE, `loa:${bc.id}`);
      return { broadcast: bc, waitMs: Math.max(0, bc.startsAt - Date.now()) };
    });
  });
  app.post('/api/admin/broadcast', async (req) => {
    d.requireAdmin(req);
    const raw = typeof (req.body as Record<string, unknown> | null)?.text === 'string' ? String((req.body as Record<string, unknown>).text) : '';
    const text = raw.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) throw bad('du_lieu_sai', 'Hãy gõ nội dung.');
    return { broadcast: await db.tx((q) => enqueue(q, null, 'Ban quản trị Vườn Việt', text, raw.slice(0, 500), 0)) };
  });
  app.get('/api/chat/broadcasts', async (req) => {
    await d.requireUser(req);
    const { rows } = await db.query('select * from broadcasts where starts_at <= now() + interval \'10 minutes\' order by starts_at desc limit 30');
    return { broadcasts: rows.map(toBroadcast) };
  });
  app.get('/api/chat/poll', async (req): Promise<ChatPoll> => {
    const me = await d.requireUser(req);
    const after = Number((req.query as Record<string, string>).b) || 0;
    const { rows } = await db.query(
      `select (select count(*)::int from chat_dm m where m.to_id = $1 and m.read_at is null and not ${blockedSql('m.from_id')}
                 and exists (select 1 from friendships f where f.status = 'accepted' and f.user_a = least(m.from_id, $1::bigint) and f.user_b = greatest(m.from_id, $1::bigint))) as unread,
              (select count(*)::int from friendships f where f.status = 'pending' and f.requested_by <> $1 and (f.user_a = $1 or f.user_b = $1)) as requests`, [me]);
    const bc = await db.query(`select * from broadcasts where id > $1 and ends_at > now() order by starts_at limit 10`, [after]);
    return { unread: rows[0].unread, requests: rows[0].requests, broadcasts: bc.rows.map(toBroadcast), at: Date.now() };
  });

  return { feed };
}
