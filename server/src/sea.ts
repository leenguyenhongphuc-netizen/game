// Thuê mô tô nước ở bãi biển du lịch (giá tham chiếu trong shared/sea.ts): phải đang ở đúng tỉnh, trả tiền theo gói phút,
// tốn thể lực; chạy đủ một phút thì được EXP (một lần mỗi lượt thuê). Một người chỉ có một lượt thuê còn hạn mỗi bãi.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { JETSKI_BEACHES, JETSKI_ENERGY, JETSKI_MIN_RIDE_S, JETSKI_PLANS, JETSKI_XP, jetSkiBeach, jetSkiPrice } from '../../shared/sea.ts';
import type { JetSkiMinutes } from '../../shared/sea.ts';

export const SEA_SCHEMA = `
create table if not exists jetski_rentals (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  beach_id text not null,
  minutes int not null,
  price bigint not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  finished_at timestamptz,
  xp int not null default 0
);
create index if not exists jetski_rentals_user_idx on jetski_rentals (user_id, ends_at);
`;

type Energy = { cur: number; max: number; baseMs: number; now: number };
export interface SeaDeps {
  db: Db;
  requireUser: (req: FastifyRequest) => Promise<number>;
  bad: (code: string, message: string, status?: number) => Error;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
  addXp: (q: Q, userId: number, n: number, source?: any) => Promise<{ xpGained: number; level: number; levelUp: boolean }>;
  energyState: (q: Q, userId: number, lock?: boolean) => Promise<Energy>;
  setEnergy: (q: Q, userId: number, e: Energy, value: number) => Promise<{ energy: number; energyMax: number; energyFullAt: number | null }>;
  provincesOf: (q: Q, userId: number) => Promise<string[]>;
}

export function registerSea(app: FastifyInstance, d: SeaDeps) {
  const { db, bad } = d;
  app.addHook('onReady', async () => { await db.query(SEA_SCHEMA); });
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;
  const view = (r: { id: string | number; beach_id: string; minutes: number; price: string | number; started_at: Date; ends_at: Date; finished_at: Date | null }) =>
    ({ id: Number(r.id), beachId: r.beach_id, minutes: r.minutes, price: Number(r.price), startedAt: new Date(r.started_at).getTime(), endsAt: new Date(r.ends_at).getTime(), finished: !!r.finished_at });

  app.get('/api/sea/jetski', async (req) => {
    const userId = await d.requireUser(req);
    const here = await d.provincesOf(db, userId);
    const { rows } = await db.query('select * from jetski_rentals where user_id = $1 and finished_at is null and ends_at > now() order by id desc', [userId]);
    return {
      beaches: JETSKI_BEACHES.map((b) => ({ ...b, here: here.includes(b.province), plans: JETSKI_PLANS.map((m) => ({ minutes: m, price: jetSkiPrice(b, m) })) })),
      rentals: rows.map(view), energy: JETSKI_ENERGY,
    };
  });

  app.post('/api/sea/jetski/rent', async (req) => {
    const userId = await d.requireUser(req), b = jetSkiBeach(String(body(req).beachId ?? ''));
    if (!b) throw bad('du_lieu_sai', 'Không có bãi biển này.');
    const minutes = Number(body(req).minutes) as JetSkiMinutes;
    if (!JETSKI_PLANS.includes(minutes)) throw bad('du_lieu_sai', `Chỉ cho thuê gói ${JETSKI_PLANS.join(' hoặc ')} phút.`);
    const price = jetSkiPrice(b, minutes);
    return db.tx(async (q) => {
      const u = (await q.query('select cash from users where id = $1 for update', [userId])).rows[0];
      if (!(await d.provincesOf(q, userId)).includes(b.province)) throw bad('chua_toi_noi', `Phải tới ${b.province} mới thuê được mô tô nước ở ${b.name}.`, 409);
      const open = await q.query('select 1 from jetski_rentals where user_id = $1 and beach_id = $2 and finished_at is null and ends_at > now()', [userId, b.id]);
      if (open.rowCount) throw bad('dang_thue', 'Bạn đang có một lượt thuê còn giờ ở bãi này.', 409);
      if (Number(u.cash) < price) throw bad('khong_du_tien', `Gói ${minutes} phút giá ${price.toLocaleString('vi-VN')}đ, bạn chưa đủ tiền.`, 409);
      const e = await d.energyState(q, userId, true);
      if (e.cur < JETSKI_ENERGY) throw bad('het_suc', `Bạn đã mệt (cần ${JETSKI_ENERGY} thể lực). Nghỉ ngơi, ăn uống đã.`, 409);
      const energy = await d.setEnergy(q, userId, e, e.cur - JETSKI_ENERGY);
      await d.addCash(q, userId, -price, `thue_jetski:${b.id}:${minutes}`);
      const r = (await q.query('insert into jetski_rentals (user_id, beach_id, minutes, price, ends_at) values ($1,$2,$3,$4, now() + make_interval(mins => $5::int)) returning *', [userId, b.id, minutes, price, minutes])).rows[0];
      return { ok: true, rental: view(r), cash: Number(u.cash) - price, ...energy };
    });
  });

  /** Trả xe (kể cả hết giờ): chạy đủ một phút thì cộng EXP một lần. */
  app.post('/api/sea/jetski/:id/finish', async (req) => {
    const userId = await d.requireUser(req), id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw bad('du_lieu_sai', 'Mã lượt thuê không hợp lệ.');
    return db.tx(async (q) => {
      const r = (await q.query('select * from jetski_rentals where id = $1 and user_id = $2 for update', [id, userId])).rows[0];
      if (!r) throw bad('khong_tim_thay', 'Không có lượt thuê này.', 404);
      if (r.finished_at) return { ok: true, xp: 0, already: true };
      const rode = (Math.min(Date.now(), new Date(r.ends_at).getTime()) - new Date(r.started_at).getTime()) / 1000;
      await q.query('update jetski_rentals set finished_at = now(), xp = $2 where id = $1', [id, rode >= JETSKI_MIN_RIDE_S ? JETSKI_XP : 0]);
      const xp = rode >= JETSKI_MIN_RIDE_S ? await d.addXp(q, userId, JETSKI_XP, 'vui_choi') : null;
      return { ok: true, xp: xp?.xpGained ?? 0, ...(xp ?? {}) };
    });
  });
}
