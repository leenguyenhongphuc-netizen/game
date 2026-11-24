// Đi phượt theo đoàn (máy chủ): lập đoàn, mời bạn, vào đoàn bằng mã, sẵn sàng, xuất phát cùng lúc, báo vị trí khi chạy,
// thưởng thêm EXP khi cả đoàn về đích cùng nhau. Luật chung ở shared/convoy.ts. Bảng tạo lười (lần gọi đầu).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { CONVOY_COLORS, CONVOY_MAX, CONVOY_RULES, makeCode, normCode } from '../../shared/convoy.ts';
import type { ConvoyInvite, ConvoyStatus, ConvoyView } from '../../shared/convoy.ts';
import { PHUOT_BY_ID } from '../../shared/moto.ts';

const CONVOY_SCHEMA = `
create table if not exists convoys (
  id bigserial primary key,
  code text not null unique,
  route_id text not null,
  leader_id bigint not null references users(id) on delete cascade,
  status text not null default 'lap',
  created_at timestamptz not null default now(),
  started_at timestamptz
);
create table if not exists convoy_members (
  convoy_id bigint not null references convoys(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  pick text,
  trip_id bigint,
  km real not null default 0,
  at_stop text,
  seen_at timestamptz,
  finished_at timestamptz,
  aborted boolean not null default false,
  base_xp integer not null default 0,
  bonus_paid boolean not null default false,
  primary key (convoy_id, user_id)
);
create index if not exists convoy_members_user on convoy_members (user_id);
create table if not exists convoy_invites (
  convoy_id bigint not null references convoys(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  invited_at timestamptz not null default now(),
  primary key (convoy_id, user_id)
);
`;

export interface ConvoyDeps {
  db: Db;
  requireUser: (req: FastifyRequest) => Promise<number>;
  bad: (code: string, message: string, status?: number) => Error;
  addXp?: (q: Q, userId: number, n: number, source?: any) => Promise<unknown>;
}

export function registerConvoy(app: FastifyInstance, d: ConvoyDeps) {
  const { db, bad } = d;
  let ready: Promise<unknown> | null = null;
  const ensure = () => (ready ??= db.query(CONVOY_SCHEMA).catch((e) => { ready = null; throw e; }));
  const idOf = (req: FastifyRequest) => Number((req.params as { id?: string }).id) || 0;
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;

  /** Đoàn đang lập quá lâu mà không chạy thì giải tán. */
  const expire = (q: Q) => q.query(`update convoys set status = 'giai_tan' where status = 'lap' and created_at < now() - ($1 || ' minutes')::interval`, [String(CONVOY_RULES.formMinutes)]);
  /** Đoàn hiện tại của người chơi (đang lập hoặc đang chạy). */
  async function currentOf(q: Q, userId: number): Promise<{ id: number; status: ConvoyStatus } | null> {
    const r = (await q.query(`select c.id, c.status from convoys c join convoy_members m on m.convoy_id = c.id
      where m.user_id = $1 and c.status in ('lap','chay') and (c.status = 'lap' or c.started_at > now() - interval '4 hours') order by c.id desc limit 1`, [userId])).rows[0];
    return r ? { id: Number(r.id), status: r.status } : null;
  }
  async function view(q: Q, convoyId: number, me: number): Promise<ConvoyView | null> {
    const c = (await q.query('select * from convoys where id = $1', [convoyId])).rows[0];
    if (!c) return null;
    const ms = (await q.query(`select m.*, u.display_name, extract(epoch from now() - m.seen_at) as ago from convoy_members m join users u on u.id = m.user_id
      where m.convoy_id = $1 order by (m.user_id = $2) desc, m.joined_at`, [convoyId, c.leader_id])).rows;
    const inv = Number(c.leader_id) === me ? (await q.query('select i.user_id, u.display_name from convoy_invites i join users u on u.id = i.user_id where i.convoy_id = $1 order by i.invited_at', [convoyId])).rows : [];
    return {
      id: Number(c.id), code: c.code, routeId: c.route_id, status: c.status, leaderId: Number(c.leader_id), startedAt: c.started_at ? new Date(c.started_at).getTime() : null,
      members: ms.map((m, i) => ({
        userId: Number(m.user_id), name: m.display_name, color: CONVOY_COLORS[i % CONVOY_COLORS.length], leader: Number(m.user_id) === Number(c.leader_id), me: Number(m.user_id) === me,
        ready: !!m.pick, km: Math.round(Number(m.km) * 100) / 100, atStop: m.at_stop ?? null, finished: !!m.finished_at, aborted: !!m.aborted,
        seenAgoSec: m.ago === null ? null : Math.round(Number(m.ago)),
      })),
      invited: inv.map((r) => ({ userId: Number(r.user_id), name: r.display_name })),
      myPick: ms.find((m) => Number(m.user_id) === me)?.pick ?? null,
    };
  }
  async function invitesOf(q: Q, userId: number): Promise<ConvoyInvite[]> {
    const rows = (await q.query(`select c.id, c.code, c.route_id, u.display_name as leader, (select count(*) from convoy_members m where m.convoy_id = c.id) as n
      from convoy_invites i join convoys c on c.id = i.convoy_id join users u on u.id = c.leader_id where i.user_id = $1 and c.status = 'lap' order by i.invited_at desc limit 10`, [userId])).rows;
    return rows.map((r) => ({ convoyId: Number(r.id), code: r.code, routeId: r.route_id, leader: r.leader, members: Number(r.n) }));
  }
  async function leaveLap(q: Q, userId: number) {
    const cur = await currentOf(q, userId);
    if (!cur || cur.status !== 'lap') return;
    const c = (await q.query('select leader_id from convoys where id = $1 for update', [cur.id])).rows[0];
    await q.query('delete from convoy_members where convoy_id = $1 and user_id = $2', [cur.id, userId]);
    if (Number(c.leader_id) === userId) {
      const next = (await q.query('select user_id from convoy_members where convoy_id = $1 order by joined_at limit 1', [cur.id])).rows[0];
      if (next) await q.query('update convoys set leader_id = $2 where id = $1', [cur.id, next.user_id]);
      else await q.query(`update convoys set status = 'giai_tan' where id = $1`, [cur.id]);
    }
  }
  async function join(q: Q, convoyId: number, userId: number) {
    const c = (await q.query('select * from convoys where id = $1 for update', [convoyId])).rows[0];
    if (!c || c.status !== 'lap') throw bad('khong_tim_thay', 'Đoàn này không còn nhận thêm người (đã xuất phát hoặc đã giải tán).', 404);
    const n = Number((await q.query('select count(*) as n from convoy_members where convoy_id = $1', [convoyId])).rows[0].n);
    const already = (await q.query('select 1 from convoy_members where convoy_id = $1 and user_id = $2', [convoyId, userId])).rows[0];
    if (!already) {
      if (n >= CONVOY_MAX) throw bad('day', `Đoàn đã đủ ${CONVOY_MAX} xe.`, 409);
      await leaveLap(q, userId);
      await q.query('insert into convoy_members (convoy_id, user_id) values ($1,$2)', [convoyId, userId]);
    }
    await q.query('delete from convoy_invites where convoy_id = $1 and user_id = $2', [convoyId, userId]);
  }

  app.get('/api/convoys/mine', async (req) => {
    const userId = await d.requireUser(req); await ensure(); await expire(db);
    const cur = await currentOf(db, userId);
    return { convoy: cur ? await view(db, cur.id, userId) : null, invites: await invitesOf(db, userId) };
  });
  app.post('/api/convoys', async (req) => {
    const userId = await d.requireUser(req); await ensure();
    const route = PHUOT_BY_ID[String(body(req).routeId ?? '')];
    if (!route) throw bad('du_lieu_sai', 'Không có cung đường này.');
    return db.tx(async (q) => {
      const cur = await currentOf(q, userId);
      if (cur?.status === 'chay') throw bad('dang_chay', 'Bạn đang chạy cùng một đoàn khác.', 409);
      await leaveLap(q, userId);
      let id = 0;
      for (let i = 0; i < 8 && !id; i++) {
        const r = (await q.query(`insert into convoys (code, route_id, leader_id) values ($1,$2,$3) on conflict (code) do nothing returning id`, [makeCode(), route.id, userId])).rows[0];
        if (r) id = Number(r.id);
      }
      if (!id) throw bad('loi', 'Không tạo được mã đoàn, thử lại.', 500);
      await q.query('insert into convoy_members (convoy_id, user_id) values ($1,$2)', [id, userId]);
      return { ok: true, convoy: await view(q, id, userId) };
    });
  });
  app.post('/api/convoys/join', async (req) => {
    const userId = await d.requireUser(req); await ensure(); await expire(db);
    const code = normCode(body(req).code);
    return db.tx(async (q) => {
      const c = (await q.query('select id from convoys where code = $1', [code])).rows[0];
      if (!c) throw bad('khong_tim_thay', 'Không có đoàn nào mang mã này.', 404);
      await join(q, Number(c.id), userId);
      return { ok: true, convoy: await view(q, Number(c.id), userId) };
    });
  });
  app.post('/api/convoys/:id/accept', async (req) => {
    const userId = await d.requireUser(req); await ensure();
    return db.tx(async (q) => {
      if (!(await q.query('select 1 from convoy_invites where convoy_id = $1 and user_id = $2', [idOf(req), userId])).rows[0]) throw bad('khong_tim_thay', 'Lời mời không còn.', 404);
      await join(q, idOf(req), userId);
      return { ok: true, convoy: await view(q, idOf(req), userId) };
    });
  });
  app.post('/api/convoys/:id/decline', async (req) => {
    const userId = await d.requireUser(req); await ensure();
    await db.query('delete from convoy_invites where convoy_id = $1 and user_id = $2', [idOf(req), userId]);
    return { ok: true };
  });
  /** Trưởng đoàn mời một người bạn (đã kết bạn). Người cùng tuyến chưa là bạn thì vào bằng mã đoàn. */
  app.post('/api/convoys/:id/invite', async (req) => {
    const userId = await d.requireUser(req); await ensure();
    const other = Number(body(req).userId) || 0;
    return db.tx(async (q) => {
      const c = (await q.query('select * from convoys where id = $1', [idOf(req)])).rows[0];
      if (!c || Number(c.leader_id) !== userId) throw bad('khong_duoc', 'Chỉ trưởng đoàn mới mời được.', 403);
      if (c.status !== 'lap') throw bad('dang_chay', 'Đoàn đã xuất phát.', 409);
      const [a, b] = userId < other ? [userId, other] : [other, userId];
      if (!(await q.query(`select 1 from friendships where user_a = $1 and user_b = $2 and status = 'accepted'`, [a, b])).rows[0]) throw bad('khong_phai_ban', 'Chỉ mời được bạn bè. Người khác hãy gửi mã đoàn.', 403);
      if ((await q.query('select 1 from convoy_members where convoy_id = $1 and user_id = $2', [c.id, other])).rows[0]) return { ok: true, already: true };
      await q.query('insert into convoy_invites (convoy_id, user_id) values ($1,$2) on conflict do nothing', [c.id, other]);
      return { ok: true };
    });
  });
  /** Chọn xe, sẵn sàng (pick = "xe:<id>" hoặc "thue:<loại>"; rỗng = bỏ sẵn sàng). */
  app.post('/api/convoys/:id/ready', async (req) => {
    const userId = await d.requireUser(req); await ensure();
    const pick = String(body(req).pick ?? '').slice(0, 40);
    if (pick && !/^(xe:\d+|thue:[a-z0-9_]+)$/.test(pick)) throw bad('du_lieu_sai', 'Chọn xe không hợp lệ.');
    const r = await db.query(`update convoy_members m set pick = nullif($3, '') from convoys c where c.id = m.convoy_id and m.convoy_id = $1 and m.user_id = $2 and c.status = 'lap'`, [idOf(req), userId, pick]);
    if (!r.rowCount) throw bad('khong_tim_thay', 'Bạn không ở trong đoàn đang lập này.', 404);
    return { ok: true, convoy: await view(db, idOf(req), userId) };
  });
  /** Trưởng đoàn cho xuất phát: mọi máy trong đoàn thấy trạng thái "chạy" và tự lên đường với xe đã chọn. */
  app.post('/api/convoys/:id/start', async (req) => {
    const userId = await d.requireUser(req); await ensure();
    return db.tx(async (q) => {
      const c = (await q.query('select * from convoys where id = $1 for update', [idOf(req)])).rows[0];
      if (!c || Number(c.leader_id) !== userId) throw bad('khong_duoc', 'Chỉ trưởng đoàn mới cho xuất phát.', 403);
      if (c.status !== 'lap') throw bad('dang_chay', 'Đoàn đã xuất phát rồi.', 409);
      const ms = (await q.query('select user_id, pick from convoy_members where convoy_id = $1', [c.id])).rows;
      if (ms.length < 2) throw bad('it_nguoi', 'Đoàn cần ít nhất 2 xe. Mời thêm bạn hoặc gửi mã đoàn.', 409);
      if (!ms.find((m) => Number(m.user_id) === userId)?.pick) throw bad('chua_chon_xe', 'Trưởng đoàn hãy chọn xe trước.', 409);
      // ai chưa chọn xe thì rời đoàn (không giữ cả đoàn chờ)
      await q.query('delete from convoy_members where convoy_id = $1 and pick is null', [c.id]);
      await q.query(`update convoys set status = 'chay', started_at = now() where id = $1`, [c.id]);
      await q.query('delete from convoy_invites where convoy_id = $1', [c.id]);
      return { ok: true, convoy: await view(q, Number(c.id), userId) };
    });
  });
  app.post('/api/convoys/:id/leave', async (req) => {
    const userId = await d.requireUser(req); await ensure();
    return db.tx(async (q) => {
      const c = (await q.query('select status from convoys where id = $1', [idOf(req)])).rows[0];
      if (!c) return { ok: true };
      if (c.status === 'lap') await leaveLap(q, userId);
      else await q.query('update convoy_members set aborted = true, finished_at = coalesce(finished_at, now()) where convoy_id = $1 and user_id = $2', [idOf(req), userId]);
      await maybeClose(q, idOf(req));
      return { ok: true };
    });
  });
  /** Đang chạy: báo km và điểm đang đứng, nhận lại vị trí cả đoàn. */
  app.post('/api/convoys/:id/pos', async (req) => {
    const userId = await d.requireUser(req); await ensure();
    const b = body(req), km = Math.max(0, Math.min(2000, Number(b.km) || 0)), at = b.atStop ? String(b.atStop).slice(0, 40) : null;
    await db.query('update convoy_members set km = greatest(km, $3), at_stop = $4, seen_at = now() where convoy_id = $1 and user_id = $2 and finished_at is null', [idOf(req), userId, km, at]);
    const v = await view(db, idOf(req), userId);
    if (!v || !v.members.some((m) => m.me)) throw bad('khong_tim_thay', 'Bạn không ở trong đoàn này.', 404);
    return { convoy: v };
  });

  async function maybeClose(q: Q, convoyId: number) {
    const open = (await q.query('select count(*) as n from convoy_members where convoy_id = $1 and finished_at is null', [convoyId])).rows[0];
    if (Number(open.n) === 0) await q.query(`update convoys set status = 'xong' where id = $1 and status = 'chay'`, [convoyId]);
  }

  return {
    ensure,
    /** Gắn chuyến phượt vừa bắt đầu vào đoàn (đoàn phải đang chạy, đúng tuyến, người chơi là thành viên). */
    async attachTrip(q: Q, userId: number, convoyId: number, routeId: string, tripId: number) {
      await ensure();
      const r = (await q.query(`select c.route_id, c.status from convoys c join convoy_members m on m.convoy_id = c.id where c.id = $1 and m.user_id = $2`, [convoyId, userId])).rows[0];
      if (!r) throw bad('khong_tim_thay', 'Bạn không ở trong đoàn này.', 404);
      if (r.status !== 'chay') throw bad('chua_xuat_phat', 'Trưởng đoàn chưa cho xuất phát.', 409);
      if (r.route_id !== routeId) throw bad('du_lieu_sai', 'Đoàn đi cung đường khác.');
      await q.query('update convoy_members set trip_id = $3, km = 0, at_stop = null, seen_at = now() where convoy_id = $1 and user_id = $2', [convoyId, userId, tripId]);
    },
    /**
     * Một thành viên kết thúc chuyến. Khi mọi người trong đoàn đã xong, ai về đích (không bỏ dở) cách nhau trong
     * CONVOY_RULES.togetherMinutes được thưởng thêm EXP = bonusXpRatio × EXP chuyến của chính họ. Trả về EXP thưởng của người vừa xong (nếu có ngay).
     */
    async onFinish(q: Q, userId: number, tripId: number, aborted: boolean, baseXp: number): Promise<{ convoyId: number; bonusXp: number; together: number } | null> {
      await ensure();
      const m = (await q.query('select convoy_id from convoy_members where user_id = $1 and trip_id = $2', [userId, tripId])).rows[0];
      if (!m) return null;
      const cid = Number(m.convoy_id);
      await q.query('update convoy_members set finished_at = now(), aborted = $3, base_xp = $4 where convoy_id = $1 and user_id = $2', [cid, userId, aborted, Math.max(0, Math.round(baseXp))]);
      const ms = (await q.query('select user_id, finished_at, aborted, base_xp, bonus_paid from convoy_members where convoy_id = $1 for update', [cid])).rows;
      await maybeClose(q, cid);
      if (ms.some((x) => !x.finished_at)) return { convoyId: cid, bonusXp: 0, together: 0 };
      const done = ms.filter((x) => !x.aborted).sort((a, b) => new Date(a.finished_at).getTime() - new Date(b.finished_at).getTime());
      // nhóm về đích cùng nhau: lớn nhất trong các khung cửa sổ togetherMinutes
      let best: typeof done = [];
      for (let i = 0; i < done.length; i++) {
        const t0 = new Date(done[i].finished_at).getTime(), grp = done.filter((x) => { const t = new Date(x.finished_at).getTime(); return t >= t0 && t - t0 <= CONVOY_RULES.togetherMinutes * 60_000; });
        if (grp.length > best.length) best = grp;
      }
      let mine = 0;
      if (best.length >= 2) for (const x of best) {
        if (x.bonus_paid) continue;
        const n = Math.round(Number(x.base_xp) * CONVOY_RULES.bonusXpRatio);
        await q.query('update convoy_members set bonus_paid = true where convoy_id = $1 and user_id = $2', [cid, x.user_id]);
        if (n > 0 && d.addXp) await d.addXp(q, Number(x.user_id), n, 'chuyen_xe');
        if (Number(x.user_id) === userId) mine = n;
      }
      return { convoyId: cid, bonusXp: mine, together: best.length };
    },
  };
}
export type ConvoyApi = ReturnType<typeof registerConvoy>;
