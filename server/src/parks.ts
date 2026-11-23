// Khu vui chơi (Moon World, Bim Wonder): vé cổng, lượt chơi tốn thể lực và cho EXP, khu trò chơi kỹ năng dùng xu,
// vé thưởng đổi quà trang trí. Không có cờ bạc: điểm do người chơi tự làm ra, quà không bán/không tặng/không quy đổi ra tiền
// (không có đường nào biến xu, vé thưởng hay quà thành tiền trong game) — xem lý do pháp lý ở đầu shared/parks.ts.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { ARCADE_GAMES, PARKS, PARK_PRIZES, PASS_HOURS, TOKEN_MAX_BUY, TOKEN_PRICE, ZONE_NAMES, arcadeTickets, park as findPark, prize as findPrize } from '../../shared/parks.ts';
import type { ArcadeGameId, Park, ParkZone } from '../../shared/parks.ts';

export const PARKS_SCHEMA = `
create table if not exists park_passes (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  park_id text not null,
  ticket_id text not null,
  zones text[] not null,
  price bigint not null,
  bought_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists park_passes_user_idx on park_passes (user_id, park_id, expires_at);
create table if not exists park_rides (
  user_id bigint not null references users(id) on delete cascade,
  park_id text not null, ride_id text not null,
  n int not null default 0, last_at timestamptz,
  primary key (user_id, park_id, ride_id)
);
create table if not exists park_wallet (
  user_id bigint primary key references users(id) on delete cascade,
  tokens int not null default 0 check (tokens >= 0),
  tickets int not null default 0 check (tickets >= 0)
);
create table if not exists park_prizes (
  user_id bigint not null references users(id) on delete cascade,
  prize_id text not null, qty int not null default 0,
  primary key (user_id, prize_id)
);
create table if not exists arcade_plays (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  park_id text not null, game text not null,
  started_at timestamptz not null default now(),
  score int, tickets int, finished_at timestamptz
);
`;

type Energy = { cur: number; max: number; baseMs: number; now: number };
export interface ParkDeps {
  db: Db;
  requireUser: (req: FastifyRequest) => Promise<number>;
  bad: (code: string, message: string, status?: number) => Error;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
  addXp: (q: Q, userId: number, n: number, source?: any) => Promise<{ xpGained: number; level: number; levelUp: boolean }>;
  energyState: (q: Q, userId: number, lock?: boolean) => Promise<Energy>;
  setEnergy: (q: Q, userId: number, e: Energy, value: number) => Promise<{ energy: number; energyMax: number; energyFullAt: number | null }>;
  /** Các tỉnh người chơi đang có mặt (vùng nhà, vùng đang đi tour/xe). */
  provincesOf: (q: Q, userId: number) => Promise<string[]>;
  /** Thời gian trong game trôi nhanh gấp mấy lần (máy thử); vé tính theo giờ thật nên không dùng. */
  timeScale?: number;
}

export function registerParks(app: FastifyInstance, d: ParkDeps) {
  const { db, bad } = d;
  app.addHook('onReady', async () => { await db.query(PARKS_SCHEMA); });
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;
  const parkOf = (req: FastifyRequest): Park => {
    const p = findPark(String((req.params as { id?: string }).id ?? ''));
    if (!p) throw bad('khong_tim_thay', 'Không có khu vui chơi này.', 404);
    return p;
  };
  async function passes(q: Q, userId: number, parkId: string) {
    const { rows } = await q.query('select ticket_id, zones, expires_at from park_passes where user_id = $1 and park_id = $2 and expires_at > now() order by expires_at desc', [userId, parkId]);
    return rows.map((r) => ({ ticketId: r.ticket_id as string, zones: r.zones as ParkZone[], expiresAt: new Date(r.expires_at).getTime() }));
  }
  async function wallet(q: Q, userId: number, lock = false) {
    await q.query('insert into park_wallet (user_id) values ($1) on conflict do nothing', [userId]);
    const { rows } = await q.query(`select tokens, tickets from park_wallet where user_id = $1${lock ? ' for update' : ''}`, [userId]);
    return { tokens: Number(rows[0].tokens), tickets: Number(rows[0].tickets) };
  }
  async function prizesOf(q: Q, userId: number) {
    const { rows } = await q.query('select prize_id, qty from park_prizes where user_id = $1 and qty > 0', [userId]);
    return rows.filter((r) => findPrize(r.prize_id)).map((r) => ({ prizeId: r.prize_id as string, qty: Number(r.qty) }));
  }
  async function mustBeThere(q: Q, userId: number, p: Park) {
    const prov = await d.provincesOf(q, userId);
    if (!prov.includes(p.province)) throw bad('khac_tinh', `Bạn cần tới ${p.province} rồi vào ${p.name} mới mua vé được.`, 409);
  }

  app.get('/api/parks', async (req) => {
    await d.requireUser(req);
    return { parks: PARKS, tokenPrice: TOKEN_PRICE, prizes: PARK_PRIZES, games: Object.values(ARCADE_GAMES), passHours: PASS_HOURS };
  });

  app.get('/api/parks/:id', async (req) => {
    const userId = await d.requireUser(req), p = parkOf(req);
    const [ps, w, pr, rides] = await Promise.all([
      passes(db, userId, p.id), wallet(db, userId), prizesOf(db, userId),
      db.query('select ride_id, n from park_rides where user_id = $1 and park_id = $2', [userId, p.id]),
    ]);
    return { park: p, passes: ps, ...w, prizes: pr, rides: Object.fromEntries(rides.rows.map((r) => [r.ride_id, Number(r.n)])), tokenPrice: TOKEN_PRICE, games: Object.values(ARCADE_GAMES), prizeList: PARK_PRIZES };
  });

  // ------------------------------------------------------------------ vé cổng
  app.post('/api/parks/:id/ticket', async (req) => {
    const userId = await d.requireUser(req), p = parkOf(req);
    const t = p.tickets.find((x) => x.id === String(body(req).ticket ?? ''));
    if (!t) throw bad('du_lieu_sai', 'Không có loại vé này.');
    return db.tx(async (q) => {
      const u = (await q.query('select cash from users where id = $1 for update', [userId])).rows[0];
      await mustBeThere(q, userId, p);
      const have = await passes(q, userId, p.id);
      if (have.some((h) => t.zones.every((z) => h.zones.includes(z)))) throw bad('da_co_ve', 'Bạn đang có vé còn hạn dùng được cho các khu này.', 409);
      if (Number(u.cash) < t.price) throw bad('khong_du_tien', `Vé ${t.name} giá ${t.price.toLocaleString('vi-VN')}đ, bạn chưa đủ tiền.`, 409);
      await d.addCash(q, userId, -t.price, `ve_khu_vui_choi:${p.id}:${t.id}`);
      const exp = new Date(Date.now() + PASS_HOURS * 3_600_000);
      await q.query('insert into park_passes (user_id, park_id, ticket_id, zones, price, expires_at) values ($1,$2,$3,$4,$5,$6)', [userId, p.id, t.id, t.zones, t.price, exp]);
      return { ok: true, passes: await passes(q, userId, p.id), cash: Number(u.cash) - t.price };
    });
  });

  // ------------------------------------------------------------------ lên trò
  app.post('/api/parks/:id/ride', async (req) => {
    const userId = await d.requireUser(req), p = parkOf(req);
    const r = p.rides.find((x) => x.id === String(body(req).ride ?? ''));
    if (!r) throw bad('du_lieu_sai', 'Không có trò này.');
    return db.tx(async (q) => {
      const ps = await passes(q, userId, p.id);
      if (!ps.some((x) => x.zones.includes(r.zone))) throw bad('chua_co_ve', `Trò này thuộc ${ZONE_NAMES[r.zone].toLowerCase()}, bạn cần vé có khu này. Mua ở cổng soát vé.`, 409);
      const e = await d.energyState(q, userId, true);
      if (e.cur < r.energy) throw bad('het_suc', `Bạn đã mệt (cần ${r.energy} thể lực, đang có ${e.cur}). Ăn uống ở quầy hàng hoặc nghỉ một lúc đã.`, 409);
      const energy = await d.setEnergy(q, userId, e, e.cur - r.energy);
      const prev = (await q.query('select n, last_at from park_rides where user_id = $1 and park_id = $2 and ride_id = $3 for update', [userId, p.id, r.id])).rows[0];
      // chặn bấm liên tục: một trò phải chơi xong hoạt cảnh mới lên lượt mới
      if (prev?.last_at && Date.now() - new Date(prev.last_at).getTime() < r.seconds * 500) throw bad('dang_choi', 'Bạn vừa chơi trò này xong, đợi một chút rồi lên lượt mới.', 409);
      const fresh = !prev || !prev.last_at || Date.now() - new Date(prev.last_at).getTime() > 12 * 3_600_000;
      await q.query(`insert into park_rides (user_id, park_id, ride_id, n, last_at) values ($1,$2,$3,1,now())
        on conflict (user_id, park_id, ride_id) do update set n = park_rides.n + 1, last_at = now()`, [userId, p.id, r.id]);
      const xp = await d.addXp(q, userId, fresh ? r.xp : Math.ceil(r.xp / 2), 'vui_choi');
      return { ok: true, ride: r.id, times: (prev ? Number(prev.n) : 0) + 1, ...energy, ...xp };
    });
  });

  // ------------------------------------------------------------------ khu trò chơi kỹ năng
  app.post('/api/parks/:id/tokens', async (req) => {
    const userId = await d.requireUser(req), p = parkOf(req);
    if (!p.arcade) throw bad('khong_tim_thay', 'Khu này không có khu trò chơi.', 404);
    const n = Math.floor(Number(body(req).n));
    if (!Number.isFinite(n) || n < 1 || n > TOKEN_MAX_BUY) throw bad('du_lieu_sai', `Mỗi lần mua 1–${TOKEN_MAX_BUY} xu.`);
    return db.tx(async (q) => {
      const u = (await q.query('select cash from users where id = $1 for update', [userId])).rows[0];
      if (!(await passes(q, userId, p.id)).length) throw bad('chua_co_ve', 'Mua vé vào cổng trước rồi mới vào khu trò chơi được.', 409);
      const cost = n * TOKEN_PRICE;
      if (Number(u.cash) < cost) throw bad('khong_du_tien', 'Bạn không đủ tiền mua xu.', 409);
      await d.addCash(q, userId, -cost, `xu_tro_choi:${p.id}`);
      await wallet(q, userId);
      await q.query('update park_wallet set tokens = tokens + $2 where user_id = $1', [userId, n]);
      return { ok: true, ...(await wallet(q, userId)), cash: Number(u.cash) - cost };
    });
  });

  app.post('/api/parks/:id/arcade/start', async (req) => {
    const userId = await d.requireUser(req), p = parkOf(req);
    const g = ARCADE_GAMES[String(body(req).game ?? '') as ArcadeGameId];
    if (!g || !p.arcade) throw bad('du_lieu_sai', 'Không có trò này.');
    return db.tx(async (q) => {
      const w = await wallet(q, userId, true);
      if (w.tokens < g.tokens) throw bad('het_xu', `Trò này cần ${g.tokens} xu, bạn còn ${w.tokens}.`, 409);
      await q.query('update park_wallet set tokens = tokens - $2 where user_id = $1', [userId, g.tokens]);
      // lượt bỏ dở quá 10 phút thì coi như xong, không được nộp điểm nữa
      const { rows } = await q.query('insert into arcade_plays (user_id, park_id, game) values ($1,$2,$3) returning id', [userId, p.id, g.id]);
      return { ok: true, playId: Number(rows[0].id), game: g, tokens: w.tokens - g.tokens };
    });
  });

  app.post('/api/parks/arcade/:play/finish', async (req) => {
    const userId = await d.requireUser(req);
    const playId = Number((req.params as { play: string }).play);
    if (!Number.isSafeInteger(playId)) throw bad('khong_tim_thay', 'Không có lượt chơi này.', 404);
    const score0 = Number(body(req).score);
    return db.tx(async (q) => {
      const pl = (await q.query('select game, started_at, finished_at from arcade_plays where id = $1 and user_id = $2 for update', [playId, userId])).rows[0];
      if (!pl) throw bad('khong_tim_thay', 'Không có lượt chơi này.', 404);
      if (pl.finished_at) throw bad('da_xong', 'Lượt này đã tính điểm rồi.', 409);
      const g = ARCADE_GAMES[pl.game as ArcadeGameId], ms = Date.now() - new Date(pl.started_at).getTime();
      if (ms > 10 * 60_000) throw bad('het_gio', 'Lượt chơi đã quá lâu, không tính điểm.', 409);
      // nộp điểm sớm hơn thời gian tối thiểu của một ván thật thì không tính (0 vé), vẫn đóng lượt
      const score = ms < g.minMs || !Number.isFinite(score0) ? 0 : Math.max(0, Math.min(g.maxScore, Math.round(score0)));
      const tickets = arcadeTickets(g.id, score);
      await q.query('update arcade_plays set score = $2, tickets = $3, finished_at = now() where id = $1', [playId, score, tickets]);
      await wallet(q, userId);
      await q.query('update park_wallet set tickets = tickets + $2 where user_id = $1', [userId, tickets]);
      return { ok: true, score, ticketsWon: tickets, ...(await wallet(q, userId)) };
    });
  });

  app.post('/api/parks/prizes/:prize/redeem', async (req) => {
    const userId = await d.requireUser(req);
    const pz = findPrize(String((req.params as { prize: string }).prize));
    if (!pz) throw bad('khong_tim_thay', 'Không có món quà này.', 404);
    return db.tx(async (q) => {
      const w = await wallet(q, userId, true);
      if (w.tickets < pz.tickets) throw bad('thieu_ve', `Cần ${pz.tickets} vé thưởng, bạn có ${w.tickets}.`, 409);
      await q.query('update park_wallet set tickets = tickets - $2 where user_id = $1', [userId, pz.tickets]);
      await q.query(`insert into park_prizes (user_id, prize_id, qty) values ($1,$2,1) on conflict (user_id, prize_id) do update set qty = park_prizes.qty + 1`, [userId, pz.id]);
      return { ok: true, prize: pz, ...(await wallet(q, userId)), prizes: await prizesOf(q, userId) };
    });
  });
}
