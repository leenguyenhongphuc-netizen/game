import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CROPS, REGIONS, SPECIALTIES, specialtiesOfRegion } from '../../shared/catalog.ts';
import {
  COOP_CREATE_COST, COOP_MAX_MEMBERS, GIFT_DAILY_LIMIT, GIFT_MAX_KG, HELP_DAILY_LIMIT, HELP_REWARD, LAND_PRICE, LATE_GRACE_MS, MAX_FRIENDS,
  QUALITIES, REGION_SET_REWARD, ROOFTOP_TILES, SOUVENIR_MAX_KG, SOUVENIR_RATIO, START_CASH, TILE_COUNT, TRAVEL_COST, glutFactor, inVietnam,
  marketDayAt, nearestRegion, npcPrice, qualityFromLate, region as findRegion, seedCost, snapCell, specialty as findSpecialty, stepCount,
  stepWaitMs, urbanCoreAt, weatherAt,
} from '../../shared/rules.ts';
import type { MarketDay, PriceMods, Quality, Weather } from '../../shared/rules.ts';
import type { Db, Q } from './db.ts';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const SESSION_DAYS = 30;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
/** Giá rao bán phải nằm trong khoảng này so với giá tham chiếu, để chợ không thành kênh chuyển tiền. */
const LISTING_MIN_RATIO = 0.3;
const LISTING_MAX_RATIO = 3;

export interface AppOptions {
  db: Db;
  timeScale?: number;
  /** Ngưỡng tính chăm sóc trễ; mặc định LATE_GRACE_MS chia cho timeScale. */
  lateGraceMs?: number;
  adminToken?: string;
  secureCookies?: boolean;
  staticDir?: string;
  rateLimit?: boolean;
  /** Bật khi chạy sau proxy (Cloudflare, Vercel, Caddy) để lấy đúng địa chỉ người dùng cho giới hạn tần suất. */
  trustProxy?: boolean;
  /** Thay hàm thời tiết và chợ phiên (dùng cho kiểm thử để kết quả không phụ thuộc ngày giờ thật). */
  weatherAt?: (regionId: string, nowMs: number) => Weather;
  marketDayAt?: (nowMs: number) => MarketDay;
}

class HttpError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
const bad = (code: string, message: string, status = 400) => new HttpError(status, code, message);

async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, 32);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [, saltHex, keyHex] = stored.split('$');
  const key = await scryptAsync(pw, Buffer.from(saltHex, 'hex'), 32);
  return timingSafeEqual(key, Buffer.from(keyHex, 'hex'));
}
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function int(v: unknown, min: number, max: number, field: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw bad('du_lieu_sai', `Giá trị "${field}" không hợp lệ.`);
  return v;
}
function quality(v: unknown): Quality {
  if (typeof v !== 'string' || !QUALITIES.includes(v as Quality)) throw bad('du_lieu_sai', 'Hạng chất lượng không hợp lệ.');
  return v as Quality;
}
function idParam(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw bad('khong_tim_thay', 'Không tìm thấy.', 404);
  return n;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { db } = opts;
  const timeScale = opts.timeScale ?? 1;
  const lateGraceMs = opts.lateGraceMs ?? LATE_GRACE_MS / timeScale;
  const weatherOf = opts.weatherAt ?? weatherAt;
  const marketDayOf = opts.marketDayAt ?? marketDayAt;
  /** Thời gian chờ bước kế, đã tính thời tiết của vùng. */
  const waitMs = (sp: (typeof SPECIALTIES)[string], regionId: string, now: number) =>
    Math.max(1000, Math.round(stepWaitMs(sp, timeScale) * weatherOf(regionId, now).growth));
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, trustProxy: !!opts.trustProxy });
  await app.register(cookie);
  if (opts.rateLimit !== false) await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.code, message: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: 'yeu_cau_sai', message: err.message });
    app.log.error(err);
    console.error(err);
    return reply.status(500).send({ error: 'loi_may_chu', message: 'Máy chủ gặp lỗi, vui lòng thử lại.' });
  });

  // ---------------------------------------------------------------- phiên đăng nhập
  async function startSession(reply: any, userId: number) {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
    await db.query('insert into sessions (token_hash, user_id, expires_at) values ($1,$2,$3)', [sha256(token), userId, expires]);
    reply.setCookie('sid', token, { path: '/', httpOnly: true, sameSite: 'lax', secure: !!opts.secureCookies, expires });
  }
  async function requireUser(req: FastifyRequest): Promise<number> {
    const token = req.cookies.sid;
    if (!token) throw bad('chua_dang_nhap', 'Bạn chưa đăng nhập.', 401);
    const { rows } = await db.query('select user_id from sessions where token_hash = $1 and expires_at > now()', [sha256(token)]);
    if (!rows[0]) throw bad('chua_dang_nhap', 'Phiên đăng nhập đã hết hạn.', 401);
    return rows[0].user_id;
  }
  async function addCash(q: Q, userId: number, delta: number, reason: string) {
    await q.query('update users set cash = cash + $2 where id = $1', [userId, delta]);
    await q.query('insert into ledger (user_id, delta, reason) values ($1,$2,$3)', [userId, delta, reason]);
  }
  async function addInventory(q: Q, userId: number, specialtyId: string, ql: Quality, kg: number) {
    await q.query(
      `insert into inventory (user_id, specialty_id, quality, kg) values ($1,$2,$3,$4)
       on conflict (user_id, specialty_id, quality) do update set kg = inventory.kg + excluded.kg`,
      [userId, specialtyId, ql, kg],
    );
  }
  async function takeInventory(q: Q, userId: number, specialtyId: string, ql: Quality, kg: number) {
    const { rowCount } = await q.query(
      'update inventory set kg = kg - $4 where user_id = $1 and specialty_id = $2 and quality = $3 and kg >= $4',
      [userId, specialtyId, ql, kg],
    );
    if (!rowCount) throw bad('khong_du_hang', 'Kho không đủ hàng.', 409);
  }
  async function currentPrice(q: Q, specialtyId: string): Promise<number> {
    const { rows } = await q.query(
      'select price from price_ticks where specialty_id = $1 order by observed_at desc, id desc limit 1', [specialtyId]);
    return rows[0]?.price ?? SPECIALTIES[specialtyId].refPrice;
  }
  /** Ghi một đặc sản vào sổ sưu tập; đủ trọn bộ một vùng thì thưởng một lần. */
  async function collect(q: Q, userId: number, specialtyId: string) {
    const ins = await q.query('insert into collection (user_id, specialty_id) values ($1,$2) on conflict do nothing', [userId, specialtyId]);
    if (!ins.rowCount) return;
    const regionId = SPECIALTIES[specialtyId].regionId;
    const ids = specialtiesOfRegion(regionId).map((sp) => sp.id);
    const have = await q.query('select count(*)::int as n from collection where user_id = $1 and specialty_id = any($2::text[])', [userId, ids]);
    if (have.rows[0].n < ids.length) return;
    const rw = await q.query('insert into collection_rewards (user_id, region_id) values ($1,$2) on conflict do nothing', [userId, regionId]);
    if (rw.rowCount) await addCash(q, userId, REGION_SET_REWARD, `bo_suu_tap:${regionId}`);
  }
  /** Các yếu tố thị trường áp vào giá thương lái cho một người bán một đặc sản. */
  async function priceMods(q: Q, userId: number, specialtyId: string, now: number): Promise<PriceMods> {
    const [sold, coop, home] = await Promise.all([
      q.query(`select coalesce(sum(kg),0)::int as kg from npc_sales where specialty_id = $1 and created_at > now() - interval '24 hours'`, [specialtyId]),
      q.query('select 1 from coop_members where user_id = $1', [userId]),
      q.query(`select 1 from plots where user_id = $1 and is_home and kind = 'rooftop'`, [userId]),
    ]);
    return { glut: glutFactor(sold.rows[0].kg), marketDay: marketDayOf(now).active, coop: coop.rows.length > 0, city: home.rows.length > 0 };
  }

  // ---------------------------------------------------------------- tài khoản
  app.post('/api/auth/register', authLimit, async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const username = typeof b.username === 'string' ? b.username.trim().toLowerCase() : '';
    const password = typeof b.password === 'string' ? b.password : '';
    const displayName = (typeof b.displayName === 'string' ? b.displayName.trim() : '') || username;
    if (!USERNAME_RE.test(username)) throw bad('ten_sai', 'Tên tài khoản gồm 3–20 ký tự: chữ thường, số, dấu _.');
    if (password.length < 8 || password.length > 72) throw bad('mat_khau_sai', 'Mật khẩu cần từ 8 đến 72 ký tự.');
    if (displayName.length > 30) throw bad('ten_sai', 'Tên hiển thị tối đa 30 ký tự.');
    const hash = await hashPassword(password);
    const userId = await db.tx(async (q) => {
      const { rows } = await q.query(
        `insert into users (username, display_name, pass_hash, cash) values ($1,$2,$3,0)
         on conflict (username) do nothing returning id`, [username, displayName, hash]);
      if (!rows[0]) throw bad('ten_da_dung', 'Tên tài khoản đã có người dùng.', 409);
      await addCash(q, rows[0].id, START_CASH, 'von_khoi_dau');
      return rows[0].id as number;
    });
    await startSession(reply, userId);
    return { ok: true };
  });

  app.post('/api/auth/login', authLimit, async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const username = typeof b.username === 'string' ? b.username.trim().toLowerCase() : '';
    const password = typeof b.password === 'string' ? b.password : '';
    const { rows } = await db.query('select id, pass_hash from users where username = $1', [username]);
    const ok = rows[0] && password.length <= 72 && (await verifyPassword(password, rows[0].pass_hash));
    if (!ok) throw bad('sai_thong_tin', 'Tên tài khoản hoặc mật khẩu không đúng.', 401);
    await startSession(reply, rows[0].id);
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.cookies.sid) await db.query('delete from sessions where token_hash = $1', [sha256(req.cookies.sid)]);
    reply.clearCookie('sid', { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', async (req) => {
    const userId = await requireUser(req);
    const [u, plots, inv, coop] = await Promise.all([
      db.query('select id, username, display_name, cash, home_region_id from users where id = $1', [userId]),
      db.query('select id, region_id, is_home, kind from plots where user_id = $1 order by is_home desc, id', [userId]),
      db.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > 0 order by specialty_id, quality', [userId]),
      db.query('select coop_id from coop_members where user_id = $1', [userId]),
    ]);
    const user = u.rows[0];
    return {
      user: {
        id: user.id, username: user.username, displayName: user.display_name, cash: user.cash, homeRegionId: user.home_region_id,
        homeKind: plots.rows.find((p) => p.is_home)?.kind ?? null, coopId: coop.rows[0]?.coop_id ?? null,
      },
      plots: plots.rows.map((p) => ({ id: p.id, regionId: p.region_id, isHome: p.is_home, kind: p.kind })),
      inventory: inv.rows.map((i) => ({ specialtyId: i.specialty_id, quality: i.quality, kg: i.kg })),
      config: { timeScale, now: Date.now() },
    };
  });

  // ---------------------------------------------------------------- định vị và lô đất
  function readLatLng(src: Record<string, unknown>): { lat: number; lng: number } {
    const lat = Number(src.lat), lng = Number(src.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw bad('du_lieu_sai', 'Toạ độ không hợp lệ.');
    return { lat, lng };
  }

  app.get('/api/geo/nearest', async (req) => {
    await requireUser(req);
    const { lat, lng } = readLatLng(req.query as Record<string, unknown>);
    if (!inVietnam(lat, lng)) throw bad('ngoai_viet_nam', 'Vị trí của bạn nằm ngoài Việt Nam, hãy tự chọn vùng trồng.', 422);
    const { region, km } = nearestRegion(lat, lng);
    const core = urbanCoreAt(lat, lng);
    return { regionId: region.id, km, urban: core ? { id: core.id, name: core.name } : null };
  });

  app.post('/api/onboard', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    let regionId: string, cell: { lat: number; lng: number };
    const rooftop = b.rooftop === true;
    if (rooftop && typeof b.regionId === 'string') throw bad('khong_o_pho', 'Vườn sân thượng chỉ dành cho người đang ở trung tâm thành phố.', 409);
    if (typeof b.regionId === 'string') {
      const r = findRegion(b.regionId);
      if (!r) throw bad('du_lieu_sai', 'Vùng trồng không tồn tại.');
      regionId = r.id; cell = snapCell(r.lat, r.lng);
    } else {
      const { lat, lng } = readLatLng(b);
      if (!inVietnam(lat, lng)) throw bad('ngoai_viet_nam', 'Vị trí của bạn nằm ngoài Việt Nam, hãy tự chọn vùng trồng.', 422);
      if (rooftop && !urbanCoreAt(lat, lng)) throw bad('khong_o_pho', 'Vườn sân thượng chỉ dành cho người đang ở trung tâm thành phố.', 409);
      regionId = nearestRegion(lat, lng).region.id; cell = snapCell(lat, lng);
    }
    return db.tx(async (q) => {
      const { rows } = await q.query('select home_region_id from users where id = $1 for update', [userId]);
      if (rows[0].home_region_id) throw bad('da_co_dat', 'Bạn đã nhận lô đất đầu tiên rồi.', 409);
      await q.query('update users set home_region_id = $2 where id = $1', [userId, regionId]);
      const plot = await q.query(
        'insert into plots (user_id, region_id, cell_lat, cell_lng, is_home, kind) values ($1,$2,$3,$4,true,$5) returning id',
        [userId, regionId, cell.lat, cell.lng, rooftop ? 'rooftop' : 'ground']);
      return { plotId: plot.rows[0].id, regionId, kind: rooftop ? 'rooftop' : 'ground' };
    });
  });

  app.post('/api/plots/buy', async (req) => {
    const userId = await requireUser(req);
    const r = findRegion(String((req.body as any)?.regionId ?? ''));
    if (!r) throw bad('du_lieu_sai', 'Vùng trồng không tồn tại.');
    return db.tx(async (q) => {
      const { rows } = await q.query('select cash, home_region_id from users where id = $1 for update', [userId]);
      if (!rows[0].home_region_id) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      if (rows[0].cash < LAND_PRICE) throw bad('khong_du_tien', 'Bạn chưa đủ tiền mua đất.', 409);
      const cell = snapCell(r.lat, r.lng);
      const plot = await q.query(
        `insert into plots (user_id, region_id, cell_lat, cell_lng) values ($1,$2,$3,$4)
         on conflict (user_id, region_id) do nothing returning id`, [userId, r.id, cell.lat, cell.lng]);
      if (!plot.rows[0]) throw bad('da_co_dat', 'Bạn đã có đất ở vùng này.', 409);
      await addCash(q, userId, -LAND_PRICE, `mua_dat:${r.id}`);
      return { plotId: plot.rows[0].id };
    });
  });

  app.get('/api/plots/:id', async (req) => {
    const userId = await requireUser(req);
    const plotId = idParam((req.params as any).id);
    const { rows } = await db.query(
      `select p.id, p.user_id, p.region_id, p.is_home, p.kind, u.display_name
       from plots p join users u on u.id = p.user_id where p.id = $1`, [plotId]);
    const p = rows[0];
    if (!p) throw bad('khong_tim_thay', 'Không tìm thấy lô đất.', 404);
    const [tiles, stall] = await Promise.all([
      db.query('select id, tile, specialty_id, step_index, step_ready_at, late_count from plantings where plot_id = $1 order by tile', [plotId]),
      db.query(`select id, specialty_id, quality, kg, price from listings where seller_id = $1 and status = 'open' order by id desc limit 50`, [p.user_id]),
    ]);
    return {
      plot: { id: p.id, regionId: p.region_id, isHome: p.is_home, kind: p.kind, ownerName: p.display_name, mine: p.user_id === userId },
      plantings: tiles.rows.map((t) => ({
        id: t.id, tile: t.tile, specialtyId: t.specialty_id, stepIndex: t.step_index,
        stepReadyAt: new Date(t.step_ready_at).getTime(), lateCount: t.late_count,
      })),
      stall: stall.rows.map((l) => ({ id: l.id, specialtyId: l.specialty_id, quality: l.quality, kg: l.kg, price: l.price })),
      now: Date.now(),
    };
  });

  app.get('/api/regions/:id/farms', async (req) => {
    await requireUser(req);
    const r = findRegion((req.params as any).id);
    if (!r) throw bad('khong_tim_thay', 'Vùng trồng không tồn tại.', 404);
    const { rows } = await db.query(
      `select p.id, u.display_name, p.is_home,
              (select count(*)::int from plantings g where g.plot_id = p.id) as growing
       from plots p join users u on u.id = p.user_id where p.region_id = $1 order by p.id desc limit 50`, [r.id]);
    const count = await db.query('select count(*)::int as n from plots where region_id = $1', [r.id]);
    return { total: count.rows[0].n, farms: rows.map((f) => ({ plotId: f.id, ownerName: f.display_name, isHome: f.is_home, growing: f.growing })) };
  });

  // ---------------------------------------------------------------- trồng trọt
  app.post('/api/plots/:id/plant', async (req) => {
    const userId = await requireUser(req);
    const plotId = idParam((req.params as any).id);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const tile = int(b.tile, 0, TILE_COUNT - 1, 'tile');
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    return db.tx(async (q) => {
      const u = await q.query('select cash from users where id = $1 for update', [userId]);
      const p = await q.query('select region_id, kind from plots where id = $1 and user_id = $2', [plotId, userId]);
      if (!p.rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy lô đất của bạn.', 404);
      if (p.rows[0].kind === 'rooftop' && !ROOFTOP_TILES.includes(tile)) throw bad('o_bi_khoa', 'Vườn sân thượng chỉ trồng được 12 ô ở giữa.', 409);
      if (p.rows[0].region_id !== sp.regionId) throw bad('sai_vung', `${sp.name} chỉ trồng được ở ${REGIONS[sp.regionId].name}.`, 409);
      const cost = seedCost(sp);
      if (u.rows[0].cash < cost) throw bad('khong_du_tien', 'Bạn không đủ tiền mua giống.', 409);
      const ready = new Date(Date.now() + waitMs(sp, sp.regionId, Date.now()));
      const ins = await q.query(
        `insert into plantings (plot_id, tile, specialty_id, step_index, step_ready_at) values ($1,$2,$3,1,$4)
         on conflict (plot_id, tile) do nothing returning id`, [plotId, tile, sp.id, ready]);
      if (!ins.rows[0]) throw bad('o_da_trong', 'Ô đất này đang có cây.', 409);
      await addCash(q, userId, -cost, `giong:${sp.id}`);
      return { plantingId: ins.rows[0].id, cost };
    });
  });

  app.post('/api/plantings/:id/step', async (req) => {
    const userId = await requireUser(req);
    const plantingId = idParam((req.params as any).id);
    return db.tx(async (q) => {
      const { rows } = await q.query(
        `select g.id, g.specialty_id, g.step_index, g.step_ready_at, g.late_count, p.region_id
         from plantings g join plots p on p.id = g.plot_id
         where g.id = $1 and p.user_id = $2 for update of g`, [plantingId, userId]);
      const g = rows[0];
      if (!g) throw bad('khong_tim_thay', 'Không tìm thấy cây trồng.', 404);
      const sp = SPECIALTIES[g.specialty_id];
      const now = Date.now();
      const readyAt = new Date(g.step_ready_at).getTime();
      if (now < readyAt) throw bad('chua_den_luc', 'Chưa đến lúc làm bước này.', 409);
      const late = g.late_count + (now > readyAt + lateGraceMs ? 1 : 0);
      if (g.step_index >= stepCount(sp) - 1) {
        const ql = qualityFromLate(late);
        const kg = CROPS[sp.crop].yieldKg;
        await q.query('delete from plantings where id = $1', [plantingId]);
        await addInventory(q, userId, sp.id, ql, kg);
        await collect(q, userId, sp.id);
        return { harvested: { specialtyId: sp.id, quality: ql, kg } };
      }
      const next = new Date(now + waitMs(sp, g.region_id, now));
      await q.query('update plantings set step_index = step_index + 1, step_ready_at = $2, late_count = $3 where id = $1', [plantingId, next, late]);
      return { stepIndex: g.step_index + 1, stepReadyAt: next.getTime(), lateCount: late };
    });
  });

  app.post('/api/plantings/:id/help', async (req) => {
    const userId = await requireUser(req);
    const plantingId = idParam((req.params as any).id);
    return db.tx(async (q) => {
      const { rows } = await q.query(
        `select g.id, g.specialty_id, g.step_index, g.step_ready_at, g.late_count, p.region_id, p.user_id as owner_id
         from plantings g join plots p on p.id = g.plot_id
         where g.id = $1 for update of g`, [plantingId]);
      const g = rows[0];
      if (!g) throw bad('khong_tim_thay', 'Không tìm thấy cây trồng.', 404);
      if (g.owner_id === userId) throw bad('cay_cua_minh', 'Đây là cây của bạn, hãy tự chăm sóc.', 409);
      if (!(await areFriends(q, userId, g.owner_id))) throw bad('khong_phai_ban', 'Chỉ bạn bè mới chăm giúp được.', 403);
      const sp = SPECIALTIES[g.specialty_id];
      const now = Date.now();
      const readyAt = new Date(g.step_ready_at).getTime();
      if (now < readyAt) throw bad('chua_den_luc', 'Chưa đến lúc làm bước này.', 409);
      if (g.step_index >= stepCount(sp) - 1) throw bad('chu_vuon_thu_hoach', 'Thu hoạch là việc của chủ vườn.', 409);
      // Khoá tài khoản người giúp để hai lượt giúp cùng lúc không vượt giới hạn ngày.
      await q.query('select id from users where id = $1 for update', [userId]);
      const used = await q.query(
        `select count(*)::int as n from ledger where user_id = $1 and reason like 'cham_giup:%' and created_at >= date_trunc('day', now())`, [userId]);
      if (used.rows[0].n >= HELP_DAILY_LIMIT) throw bad('het_luot', `Hôm nay bạn đã chăm giúp đủ ${HELP_DAILY_LIMIT} lượt.`, 409);
      const late = g.late_count + (now > readyAt + lateGraceMs ? 1 : 0);
      const next = new Date(now + waitMs(sp, g.region_id, now));
      await q.query('update plantings set step_index = step_index + 1, step_ready_at = $2, late_count = $3 where id = $1', [plantingId, next, late]);
      await addCash(q, userId, HELP_REWARD, `cham_giup:${plantingId}`);
      return { stepIndex: g.step_index + 1, stepReadyAt: next.getTime(), lateCount: late, reward: HELP_REWARD };
    });
  });

  // ---------------------------------------------------------------- bạn bè và xóm
  const pair = (x: number, y: number): [number, number] => (x < y ? [x, y] : [y, x]);
  async function areFriends(q: Q, x: number, y: number): Promise<boolean> {
    if (x === y) return false;
    const { rows } = await q.query(`select 1 from friendships where user_a = $1 and user_b = $2 and status = 'accepted'`, pair(x, y));
    return rows.length > 0;
  }
  /** Khoá hai tài khoản theo thứ tự mã rồi kiểm tra chưa bên nào đủ số bạn. */
  async function ensureFriendRoom(q: Q, x: number, y: number) {
    await q.query('select id from users where id in ($1,$2) order by id for update', [x, y]);
    const { rows } = await q.query(
      `select u.id, (select count(*)::int from friendships f where f.status = 'accepted' and (f.user_a = u.id or f.user_b = u.id)) as n
       from users u where u.id in ($1,$2)`, [x, y]);
    if (rows.some((r) => r.n >= MAX_FRIENDS)) throw bad('day_ban', `Mỗi người có tối đa ${MAX_FRIENDS} bạn.`, 409);
  }

  app.get('/api/friends', async (req) => {
    const userId = await requireUser(req);
    const { rows } = await db.query(
      `select f.status, f.requested_by, u.id, u.username, u.display_name, u.home_region_id,
              (select p.id from plots p where p.user_id = u.id and p.is_home limit 1) as plot_id
       from friendships f
       join users u on u.id = case when f.user_a = $1 then f.user_b else f.user_a end
       where f.user_a = $1 or f.user_b = $1
       order by f.accepted_at nulls last, f.created_at`, [userId]);
    const brief = (r: any) => ({ userId: r.id, username: r.username, displayName: r.display_name });
    return {
      friends: rows.filter((r) => r.status === 'accepted').map((r) => ({ ...brief(r), homeRegionId: r.home_region_id, plotId: r.plot_id })),
      incoming: rows.filter((r) => r.status === 'pending' && r.requested_by !== userId).map(brief),
      outgoing: rows.filter((r) => r.status === 'pending' && r.requested_by === userId).map(brief),
    };
  });

  app.post('/api/friends', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const username = typeof b.username === 'string' ? b.username.trim().toLowerCase() : '';
    const target = await db.query('select id from users where username = $1', [username]);
    if (!target.rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy tài khoản này.', 404);
    const otherId = target.rows[0].id as number;
    if (otherId === userId) throw bad('tu_ket_ban', 'Bạn không thể kết bạn với chính mình.', 409);
    const [a, c] = pair(userId, otherId);
    return db.tx(async (q) => {
      await q.query('select id from users where id in ($1,$2) order by id for update', [a, c]);
      const { rows } = await q.query('select status, requested_by from friendships where user_a = $1 and user_b = $2 for update', [a, c]);
      const f = rows[0];
      if (!f) {
        await q.query(`insert into friendships (user_a, user_b, requested_by, status) values ($1,$2,$3,'pending')`, [a, c, userId]);
        return { status: 'requested' };
      }
      if (f.status === 'accepted') throw bad('da_ket_ban', 'Hai bạn đã là bạn bè.', 409);
      if (f.requested_by === userId) throw bad('da_ket_ban', 'Bạn đã gửi lời mời rồi, hãy chờ người kia chấp nhận.', 409);
      await ensureFriendRoom(q, a, c);
      await q.query(`update friendships set status = 'accepted', accepted_at = now() where user_a = $1 and user_b = $2`, [a, c]);
      return { status: 'accepted' };
    });
  });

  app.post('/api/friends/:userId/accept', async (req) => {
    const userId = await requireUser(req);
    const otherId = idParam((req.params as any).userId);
    if (otherId === userId) throw bad('khong_tim_thay', 'Không có lời mời nào đang chờ.', 404);
    const [a, c] = pair(userId, otherId);
    return db.tx(async (q) => {
      await q.query('select id from users where id in ($1,$2) order by id for update', [a, c]);
      const { rows } = await q.query(
        `select 1 from friendships where user_a = $1 and user_b = $2 and status = 'pending' and requested_by = $3 for update`, [a, c, otherId]);
      if (!rows[0]) throw bad('khong_tim_thay', 'Không có lời mời nào đang chờ.', 404);
      await ensureFriendRoom(q, a, c);
      await q.query(`update friendships set status = 'accepted', accepted_at = now() where user_a = $1 and user_b = $2`, [a, c]);
      return { ok: true };
    });
  });

  app.delete('/api/friends/:userId', async (req) => {
    const userId = await requireUser(req);
    const otherId = idParam((req.params as any).userId);
    const { rowCount } = await db.query('delete from friendships where user_a = $1 and user_b = $2', pair(userId, otherId));
    if (!rowCount || otherId === userId) throw bad('khong_tim_thay', 'Hai bạn chưa có quan hệ bạn bè.', 404);
    return { ok: true };
  });

  app.get('/api/village', async (req) => {
    const userId = await requireUser(req);
    const raw = (req.query as Record<string, unknown>).plotId;
    const cols = `p.id, p.user_id, p.region_id, p.is_home, p.kind, u.display_name`;
    let center: any;
    if (raw === undefined || raw === '') {
      const { rows } = await db.query(`select ${cols} from plots p join users u on u.id = p.user_id where p.user_id = $1 and p.is_home limit 1`, [userId]);
      if (!rows[0]) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      center = rows[0];
    } else {
      const { rows } = await db.query(`select ${cols} from plots p join users u on u.id = p.user_id where p.id = $1`, [idParam(raw)]);
      if (!rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy lô đất.', 404);
      center = rows[0];
    }
    const friends = await db.query(
      `select case when user_a = $1 then user_b else user_a end as id, accepted_at
       from friendships where status = 'accepted' and (user_a = $1 or user_b = $1) order by accepted_at, created_at`, [userId]);
    const friendIds: number[] = friends.rows.map((r) => r.id);
    let neighbors: any[] = [];
    if (center.user_id === userId && center.is_home && friendIds.length) {
      const { rows } = await db.query(
        `select ${cols} from plots p join users u on u.id = p.user_id where p.is_home and p.user_id = any($1::bigint[])`, [friendIds]);
      const byOwner = new Map(rows.map((r) => [r.user_id, r]));
      neighbors = friendIds.map((id) => byOwner.get(id)).filter(Boolean).slice(0, MAX_FRIENDS);
    }
    const all = [center, ...neighbors];
    const [tiles, stalls] = await Promise.all([
      db.query(
        `select id, plot_id, tile, specialty_id, step_index, step_ready_at, late_count
         from plantings where plot_id = any($1::bigint[]) order by plot_id, tile`, [all.map((p) => p.id)]),
      db.query(
        `select id, seller_id, specialty_id, quality, kg, price from (
           select l.*, row_number() over (partition by seller_id order by id desc) as rn
           from listings l where l.status = 'open' and l.seller_id = any($1::bigint[])
         ) t where rn <= 50 order by id desc`, [[...new Set(all.map((p) => p.user_id))]]),
    ]);
    const lot = (p: any) => ({
      plot: {
        id: p.id, regionId: p.region_id, isHome: p.is_home, kind: p.kind, ownerId: p.user_id, ownerName: p.display_name,
        mine: p.user_id === userId, friend: friendIds.includes(p.user_id),
      },
      plantings: tiles.rows.filter((t) => t.plot_id === p.id).map((t) => ({
        id: t.id, tile: t.tile, specialtyId: t.specialty_id, stepIndex: t.step_index,
        stepReadyAt: new Date(t.step_ready_at).getTime(), lateCount: t.late_count,
      })),
      stall: stalls.rows.filter((l) => l.seller_id === p.user_id).map((l) => ({ id: l.id, specialtyId: l.specialty_id, quality: l.quality, kg: l.kg, price: l.price })),
    });
    const now = Date.now();
    return { center: lot(center), neighbors: neighbors.map(lot), now, weather: weatherOf(center.region_id, now), marketDay: marketDayOf(now) };
  });

  // ---------------------------------------------------------------- bán hàng
  app.post('/api/sell/npc', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const ql = quality(b.quality);
    const kg = int(b.kg, 1, 1_000_000, 'kg');
    return db.tx(async (q) => {
      const u = await q.query('select home_region_id from users where id = $1 for update', [userId]);
      await takeInventory(q, userId, sp.id, ql, kg);
      const mods = await priceMods(q, userId, sp.id, Date.now());
      const unit = npcPrice(await currentPrice(q, sp.id), ql, sp.regionId, u.rows[0].home_region_id, mods);
      await q.query('insert into npc_sales (user_id, specialty_id, kg) values ($1,$2,$3)', [userId, sp.id, kg]);
      await addCash(q, userId, unit * kg, `ban_thuong_lai:${sp.id}`);
      return { unitPrice: unit, total: unit * kg, mods };
    });
  });

  app.get('/api/market', async (req) => {
    const userId = await requireUser(req);
    const query = req.query as Record<string, unknown>;
    const params: unknown[] = [userId];
    // mine=1: tin của chính mình; mặc định: tin của người khác.
    let where = `l.status = 'open' and l.kg > 0 and l.seller_id ${query.mine === '1' ? '=' : '<>'} $1`;
    if (typeof query.specialtyId === 'string' && findSpecialty(query.specialtyId)) { params.push(query.specialtyId); where += ' and l.specialty_id = $2'; }
    const { rows } = await db.query(
      `select l.id, l.seller_id, l.specialty_id, l.quality, l.kg, l.price, u.display_name, u.home_region_id
       from listings l join users u on u.id = l.seller_id where ${where} order by l.id desc limit 100`, params);
    return {
      listings: rows.map((l) => ({
        id: l.id, sellerId: l.seller_id, sellerName: l.display_name, sellerRegionId: l.home_region_id,
        specialtyId: l.specialty_id, quality: l.quality, kg: l.kg, price: l.price,
      })),
    };
  });

  app.post('/api/market/listings', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const ql = quality(b.quality);
    const kg = int(b.kg, 1, 1_000_000, 'kg');
    const price = int(b.price, 1, 1_000_000_000, 'price');
    return db.tx(async (q) => {
      const ref = await currentPrice(q, sp.id);
      if (price < ref * LISTING_MIN_RATIO || price > ref * LISTING_MAX_RATIO) {
        throw bad('gia_ngoai_khung', `Giá rao phải từ ${Math.ceil(ref * LISTING_MIN_RATIO)}đ đến ${Math.floor(ref * LISTING_MAX_RATIO)}đ mỗi kg.`, 409);
      }
      await takeInventory(q, userId, sp.id, ql, kg);
      const ins = await q.query(
        'insert into listings (seller_id, specialty_id, quality, kg, price) values ($1,$2,$3,$4,$5) returning id',
        [userId, sp.id, ql, kg, price]);
      return { listingId: ins.rows[0].id };
    });
  });

  app.post('/api/market/listings/:id/buy', async (req) => {
    const userId = await requireUser(req);
    const listingId = idParam((req.params as any).id);
    const kg = int((req.body as any)?.kg, 1, 1_000_000, 'kg');
    return db.tx(async (q) => {
      const { rows } = await q.query(`select * from listings where id = $1 and status = 'open' for update`, [listingId]);
      const l = rows[0];
      if (!l) throw bad('khong_tim_thay', 'Tin rao không còn.', 404);
      if (l.seller_id === userId) throw bad('tu_mua', 'Bạn không thể mua hàng của chính mình.', 409);
      if (l.kg < kg) throw bad('khong_du_hang', 'Tin rao không còn đủ hàng.', 409);
      const total = l.price * kg;
      // Khoá cả hai tài khoản theo thứ tự mã để hai giao dịch chéo nhau không khoá chết.
      const locked = await q.query('select id, cash from users where id in ($1,$2) order by id for update', [userId, l.seller_id]);
      if (locked.rows.find((r) => r.id === userId).cash < total) throw bad('khong_du_tien', 'Bạn không đủ tiền.', 409);
      await q.query(`update listings set kg = kg - $2, status = case when kg - $2 = 0 then 'sold' else 'open' end where id = $1`, [listingId, kg]);
      await addCash(q, userId, -total, `mua_cho:${listingId}`);
      await addCash(q, l.seller_id, total, `ban_cho:${listingId}`);
      await addInventory(q, userId, l.specialty_id, l.quality, kg);
      await collect(q, userId, l.specialty_id);
      return { total };
    });
  });

  app.delete('/api/market/listings/:id', async (req) => {
    const userId = await requireUser(req);
    const listingId = idParam((req.params as any).id);
    return db.tx(async (q) => {
      const { rows } = await q.query(
        `update listings set status = 'cancelled' where id = $1 and seller_id = $2 and status = 'open' returning specialty_id, quality, kg`,
        [listingId, userId]);
      if (!rows[0]) throw bad('khong_tim_thay', 'Tin rao không còn.', 404);
      if (rows[0].kg > 0) await addInventory(q, userId, rows[0].specialty_id, rows[0].quality, rows[0].kg);
      return { ok: true };
    });
  });

  // ---------------------------------------------------------------- bảng giá
  app.get('/api/prices', async () => {
    const { rows } = await db.query(
      `select specialty_id, price, source, observed_at, rn from (
         select *, row_number() over (partition by specialty_id order by observed_at desc, id desc) as rn from price_ticks
       ) t where rn <= 2`);
    const out: Record<string, { price: number; prev: number | null; source: string; observedAt: number; glut?: number }> = {};
    for (const r of rows) {
      if (!SPECIALTIES[r.specialty_id]) continue;
      if (Number(r.rn) === 1) out[r.specialty_id] = { price: r.price, prev: out[r.specialty_id]?.prev ?? null, source: r.source, observedAt: new Date(r.observed_at).getTime() };
      else out[r.specialty_id] = { ...(out[r.specialty_id] ?? { price: r.price, source: r.source, observedAt: 0 }), prev: r.price };
    }
    const sold = await db.query(`select specialty_id, sum(kg)::int as kg from npc_sales where created_at > now() - interval '24 hours' group by specialty_id`);
    const kgOf = new Map(sold.rows.map((r) => [r.specialty_id, r.kg]));
    for (const id of Object.keys(out)) out[id].glut = glutFactor(kgOf.get(id) ?? 0);
    return { prices: out, marketDay: marketDayOf(Date.now()) };
  });

  app.get('/api/prices/:id/history', async (req) => {
    const sp = findSpecialty((req.params as any).id);
    if (!sp) throw bad('khong_tim_thay', 'Đặc sản không tồn tại.', 404);
    const { rows } = await db.query(
      'select price, source, observed_at from price_ticks where specialty_id = $1 order by observed_at desc, id desc limit 90', [sp.id]);
    return { history: rows.reverse().map((r) => ({ price: r.price, source: r.source, observedAt: new Date(r.observed_at).getTime() })) };
  });

  /** Cổng nạp giá tham chiếu, dành cho tác tử thu thập giá. Tắt nếu không cấu hình ADMIN_TOKEN. */
  app.post('/api/admin/prices', async (req) => {
    const given = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
    const want = opts.adminToken ?? '';
    const ok = want.length >= 16 && given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
    if (!ok) throw bad('khong_co_quyen', 'Không có quyền.', 401);
    const ticks = (req.body as any)?.ticks;
    if (!Array.isArray(ticks) || ticks.length === 0 || ticks.length > 500) throw bad('du_lieu_sai', 'Cần mảng "ticks" từ 1 đến 500 phần tử.');
    const clean = ticks.map((t: any) => {
      const sp = findSpecialty(String(t?.specialtyId ?? ''));
      if (!sp) throw bad('du_lieu_sai', `Đặc sản không tồn tại: ${t?.specialtyId}`);
      const source = typeof t.source === 'string' && t.source.trim() ? t.source.trim().slice(0, 200) : '';
      if (!source) throw bad('du_lieu_sai', 'Mỗi giá cần ghi nguồn ("source").');
      const observedAt = t.observedAt ? new Date(t.observedAt) : new Date();
      if (Number.isNaN(observedAt.getTime()) || observedAt.getTime() > Date.now() + 60_000) throw bad('du_lieu_sai', 'Thời điểm ghi nhận không hợp lệ.');
      return { id: sp.id, price: int(t.price, 500, 50_000_000, 'price'), source, observedAt };
    });
    await db.tx(async (q) => {
      for (const t of clean) {
        await q.query('insert into price_ticks (specialty_id, price, source, observed_at) values ($1,$2,$3,$4)', [t.id, t.price, t.source, t.observedAt]);
      }
    });
    return { inserted: clean.length };
  });

  // ---------------------------------------------------------------- hợp tác xã
  app.post('/api/coops', async (req) => {
    const userId = await requireUser(req);
    const raw = (req.body as any)?.name;
    const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
    if (name.length < 3 || name.length > 30) throw bad('ten_sai', 'Tên hợp tác xã cần từ 3 đến 30 ký tự.');
    return db.tx(async (q) => {
      const u = await q.query('select cash, home_region_id from users where id = $1 for update', [userId]);
      if (!u.rows[0].home_region_id) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      const member = await q.query('select 1 from coop_members where user_id = $1', [userId]);
      if (member.rows[0]) throw bad('da_co_htx', 'Bạn đang ở trong một hợp tác xã rồi.', 409);
      if (u.rows[0].cash < COOP_CREATE_COST) throw bad('khong_du_tien', 'Bạn chưa đủ tiền lập hợp tác xã.', 409);
      const ins = await q.query(
        'insert into coops (name, region_id, owner_id) values ($1,$2,$3) on conflict (name) do nothing returning id', [name, u.rows[0].home_region_id, userId]);
      if (!ins.rows[0]) throw bad('ten_da_dung', 'Tên hợp tác xã này đã có người dùng.', 409);
      await q.query('insert into coop_members (coop_id, user_id) values ($1,$2)', [ins.rows[0].id, userId]);
      await addCash(q, userId, -COOP_CREATE_COST, `lap_htx:${ins.rows[0].id}`);
      return { coopId: ins.rows[0].id };
    });
  });

  app.get('/api/coops', async (req) => {
    const userId = await requireUser(req);
    const raw = (req.query as Record<string, unknown>).regionId;
    let regionId: string | null = null;
    if (typeof raw === 'string' && raw) {
      const r = findRegion(raw);
      if (!r) throw bad('khong_tim_thay', 'Vùng trồng không tồn tại.', 404);
      regionId = r.id;
    } else {
      const u = await db.query('select home_region_id from users where id = $1', [userId]);
      regionId = u.rows[0].home_region_id;
    }
    if (!regionId) return { coops: [] };
    const { rows } = await db.query(
      `select c.id, c.name, c.region_id, u.display_name,
              (select count(*)::int from coop_members m where m.coop_id = c.id) as members
       from coops c join users u on u.id = c.owner_id where c.region_id = $1 order by members desc, c.id limit 50`, [regionId]);
    return { coops: rows.map((c) => ({ id: c.id, name: c.name, regionId: c.region_id, ownerName: c.display_name, members: c.members })) };
  });

  app.get('/api/coops/mine', async (req) => {
    const userId = await requireUser(req);
    const { rows } = await db.query(
      `select c.id, c.name, c.region_id, c.owner_id from coop_members m join coops c on c.id = m.coop_id where m.user_id = $1`, [userId]);
    const c = rows[0];
    if (!c) return { coop: null };
    const members = await db.query(
      `select u.id, u.display_name,
              (select coalesce(sum(s.kg),0)::int from npc_sales s where s.user_id = u.id and s.created_at > now() - interval '7 days') as kg_week
       from coop_members m join users u on u.id = m.user_id where m.coop_id = $1 order by kg_week desc, m.joined_at`, [c.id]);
    return {
      coop: {
        id: c.id, name: c.name, regionId: c.region_id, ownerId: c.owner_id,
        kgWeek: members.rows.reduce((sum, m) => sum + m.kg_week, 0),
        members: members.rows.map((m) => ({ userId: m.id, displayName: m.display_name, kgWeek: m.kg_week })),
      },
    };
  });

  app.post('/api/coops/leave', async (req) => {
    const userId = await requireUser(req);
    return db.tx(async (q) => {
      const { rows } = await q.query('select coop_id from coop_members where user_id = $1', [userId]);
      if (!rows[0]) throw bad('chua_co_htx', 'Bạn chưa ở trong hợp tác xã nào.', 409);
      const coopId = rows[0].coop_id;
      const coop = await q.query('select owner_id from coops where id = $1 for update', [coopId]);
      await q.query('delete from coop_members where user_id = $1', [userId]);
      if (coop.rows[0].owner_id === userId) {
        const next = await q.query('select user_id from coop_members where coop_id = $1 order by joined_at, user_id limit 1', [coopId]);
        if (next.rows[0]) await q.query('update coops set owner_id = $2 where id = $1', [coopId, next.rows[0].user_id]);
        else await q.query('delete from coops where id = $1', [coopId]);
      }
      return { ok: true };
    });
  });

  app.post('/api/coops/:id/join', async (req) => {
    const userId = await requireUser(req);
    const coopId = idParam((req.params as any).id);
    return db.tx(async (q) => {
      const coop = await q.query('select region_id from coops where id = $1 for update', [coopId]);
      if (!coop.rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy hợp tác xã.', 404);
      const u = await q.query('select home_region_id from users where id = $1 for update', [userId]);
      const member = await q.query('select 1 from coop_members where user_id = $1', [userId]);
      if (member.rows[0]) throw bad('da_co_htx', 'Bạn đang ở trong một hợp tác xã rồi.', 409);
      if (u.rows[0].home_region_id !== coop.rows[0].region_id) throw bad('khac_vung', 'Hợp tác xã chỉ nhận người có vườn nhà cùng vùng trồng.', 409);
      const count = await q.query('select count(*)::int as n from coop_members where coop_id = $1', [coopId]);
      if (count.rows[0].n >= COOP_MAX_MEMBERS) throw bad('htx_day', `Hợp tác xã đã đủ ${COOP_MAX_MEMBERS} thành viên.`, 409);
      await q.query('insert into coop_members (coop_id, user_id) values ($1,$2)', [coopId, userId]);
      return { ok: true };
    });
  });

  // ---------------------------------------------------------------- du lịch và quà đặc sản
  async function hasBeenTo(q: Q, userId: number, regionId: string): Promise<{ owns: boolean; visited: boolean }> {
    const [plot, visit] = await Promise.all([
      q.query('select 1 from plots where user_id = $1 and region_id = $2', [userId, regionId]),
      q.query('select 1 from visits where user_id = $1 and region_id = $2', [userId, regionId]),
    ]);
    return { owns: plot.rows.length > 0, visited: visit.rows.length > 0 };
  }

  app.get('/api/travel', async (req) => {
    const userId = await requireUser(req);
    const { rows } = await db.query(
      `select region_id from visits where user_id = $1 union select region_id from plots where user_id = $1`, [userId]);
    return { visited: rows.map((r) => r.region_id).sort() };
  });

  app.post('/api/travel', async (req) => {
    const userId = await requireUser(req);
    const r = findRegion(String((req.body as any)?.regionId ?? ''));
    if (!r) throw bad('du_lieu_sai', 'Vùng trồng không tồn tại.');
    return db.tx(async (q) => {
      const u = await q.query('select cash from users where id = $1 for update', [userId]);
      const been = await hasBeenTo(q, userId, r.id);
      const cost = been.owns || been.visited ? 0 : TRAVEL_COST;
      if (u.rows[0].cash < cost) throw bad('khong_du_tien', 'Bạn không đủ tiền đi du lịch.', 409);
      await q.query('insert into visits (user_id, region_id) values ($1,$2) on conflict do nothing', [userId, r.id]);
      if (cost > 0) await addCash(q, userId, -cost, `du_lich:${r.id}`);
      return { cost, isNew: !been.owns && !been.visited };
    });
  });

  app.post('/api/souvenir', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const r = findRegion(String(b.regionId ?? ''));
    if (!r) throw bad('du_lieu_sai', 'Vùng trồng không tồn tại.');
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp || sp.regionId !== r.id) throw bad('du_lieu_sai', 'Đặc sản này không thuộc vùng bạn chọn.');
    const kg = int(b.kg, 1, SOUVENIR_MAX_KG, 'kg');
    return db.tx(async (q) => {
      const u = await q.query('select cash from users where id = $1 for update', [userId]);
      const been = await hasBeenTo(q, userId, r.id);
      if (!been.owns && !been.visited) throw bad('chua_toi', `Bạn chưa tới ${r.name}, hãy đi du lịch tới đó trước.`, 409);
      const unit = Math.round((await currentPrice(q, sp.id)) * SOUVENIR_RATIO);
      if (u.rows[0].cash < unit * kg) throw bad('khong_du_tien', 'Bạn không đủ tiền mua quà đặc sản.', 409);
      await addCash(q, userId, -unit * kg, `qua_dac_san:${sp.id}`);
      await addInventory(q, userId, sp.id, 'A', kg);
      await collect(q, userId, sp.id);
      return { unitPrice: unit, total: unit * kg };
    });
  });

  app.get('/api/collection', async (req) => {
    const userId = await requireUser(req);
    const [c, r] = await Promise.all([
      db.query('select specialty_id from collection where user_id = $1 order by first_at, specialty_id', [userId]),
      db.query('select region_id from collection_rewards where user_id = $1 order by region_id', [userId]),
    ]);
    return { specialties: c.rows.map((x) => x.specialty_id).filter((id) => SPECIALTIES[id]), regionsRewarded: r.rows.map((x) => x.region_id) };
  });

  // ---------------------------------------------------------------- quà tặng
  app.post('/api/gifts', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const toId = int(b.toUserId, 1, Number.MAX_SAFE_INTEGER, 'toUserId');
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const ql = quality(b.quality);
    const kg = int(b.kg, 1, GIFT_MAX_KG, 'kg');
    const message = typeof b.message === 'string' ? b.message.trim().slice(0, 120) : '';
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      if (!(await areFriends(q, userId, toId))) throw bad('khong_phai_ban', 'Chỉ tặng quà được cho bạn bè.', 403);
      const used = await q.query(`select count(*)::int as n from gifts where from_id = $1 and created_at >= date_trunc('day', now())`, [userId]);
      if (used.rows[0].n >= GIFT_DAILY_LIMIT) throw bad('het_luot', `Hôm nay bạn đã tặng đủ ${GIFT_DAILY_LIMIT} món quà.`, 409);
      await takeInventory(q, userId, sp.id, ql, kg);
      await addInventory(q, toId, sp.id, ql, kg);
      await collect(q, toId, sp.id);
      const ins = await q.query(
        'insert into gifts (from_id, to_id, specialty_id, quality, kg, message) values ($1,$2,$3,$4,$5,$6) returning id', [userId, toId, sp.id, ql, kg, message]);
      return { giftId: ins.rows[0].id };
    });
  });

  app.get('/api/gifts', async (req) => {
    const userId = await requireUser(req);
    const [inbox, unseen] = await Promise.all([
      db.query(
        `select g.id, u.display_name, g.specialty_id, g.quality, g.kg, g.message, g.created_at, g.seen
         from gifts g join users u on u.id = g.from_id where g.to_id = $1 order by g.id desc limit 50`, [userId]),
      db.query('select count(*)::int as n from gifts where to_id = $1 and not seen', [userId]),
    ]);
    return {
      inbox: inbox.rows.map((g) => ({
        id: g.id, fromName: g.display_name, specialtyId: g.specialty_id, quality: g.quality, kg: g.kg, message: g.message,
        createdAt: new Date(g.created_at).getTime(), seen: g.seen,
      })),
      unseen: unseen.rows[0].n,
    };
  });

  app.post('/api/gifts/seen', async (req) => {
    const userId = await requireUser(req);
    await db.query('update gifts set seen = true where to_id = $1 and not seen', [userId]);
    return { ok: true };
  });

  app.get('/api/health', async () => ({ ok: true }));

  // ---------------------------------------------------------------- giao diện tĩnh
  const staticDir = opts.staticDir ?? fileURLToPath(new URL('../../web/dist', import.meta.url));
  if (existsSync(staticDir)) {
    await app.register(fastifyStatic, { root: staticDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== 'GET' || req.url.startsWith('/api/')) return reply.status(404).send({ error: 'khong_tim_thay', message: 'Không tìm thấy.' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
