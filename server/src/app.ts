import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CROPS, REGIONS, SPECIALTIES } from '../../shared/catalog.ts';
import {
  LAND_PRICE, LATE_GRACE_MS, QUALITIES, START_CASH, TILE_COUNT, inVietnam, nearestRegion, npcPrice,
  qualityFromLate, region as findRegion, seedCost, snapCell, specialty as findSpecialty, stepCount, stepWaitMs,
} from '../../shared/rules.ts';
import type { Quality } from '../../shared/rules.ts';
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
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });
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
    const [u, plots, inv] = await Promise.all([
      db.query('select id, username, display_name, cash, home_region_id from users where id = $1', [userId]),
      db.query('select id, region_id, is_home from plots where user_id = $1 order by is_home desc, id', [userId]),
      db.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > 0 order by specialty_id, quality', [userId]),
    ]);
    const user = u.rows[0];
    return {
      user: { id: user.id, username: user.username, displayName: user.display_name, cash: user.cash, homeRegionId: user.home_region_id },
      plots: plots.rows.map((p) => ({ id: p.id, regionId: p.region_id, isHome: p.is_home })),
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
    return { regionId: region.id, km };
  });

  app.post('/api/onboard', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    let regionId: string, cell: { lat: number; lng: number };
    if (typeof b.regionId === 'string') {
      const r = findRegion(b.regionId);
      if (!r) throw bad('du_lieu_sai', 'Vùng trồng không tồn tại.');
      regionId = r.id; cell = snapCell(r.lat, r.lng);
    } else {
      const { lat, lng } = readLatLng(b);
      if (!inVietnam(lat, lng)) throw bad('ngoai_viet_nam', 'Vị trí của bạn nằm ngoài Việt Nam, hãy tự chọn vùng trồng.', 422);
      regionId = nearestRegion(lat, lng).region.id; cell = snapCell(lat, lng);
    }
    return db.tx(async (q) => {
      const { rows } = await q.query('select home_region_id from users where id = $1 for update', [userId]);
      if (rows[0].home_region_id) throw bad('da_co_dat', 'Bạn đã nhận lô đất đầu tiên rồi.', 409);
      await q.query('update users set home_region_id = $2 where id = $1', [userId, regionId]);
      const plot = await q.query(
        'insert into plots (user_id, region_id, cell_lat, cell_lng, is_home) values ($1,$2,$3,$4,true) returning id',
        [userId, regionId, cell.lat, cell.lng]);
      return { plotId: plot.rows[0].id, regionId };
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
      `select p.id, p.user_id, p.region_id, p.is_home, u.display_name
       from plots p join users u on u.id = p.user_id where p.id = $1`, [plotId]);
    const p = rows[0];
    if (!p) throw bad('khong_tim_thay', 'Không tìm thấy lô đất.', 404);
    const [tiles, stall] = await Promise.all([
      db.query('select id, tile, specialty_id, step_index, step_ready_at, late_count from plantings where plot_id = $1 order by tile', [plotId]),
      db.query(`select id, specialty_id, quality, kg, price from listings where seller_id = $1 and status = 'open' order by id desc limit 50`, [p.user_id]),
    ]);
    return {
      plot: { id: p.id, regionId: p.region_id, isHome: p.is_home, ownerName: p.display_name, mine: p.user_id === userId },
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
      const p = await q.query('select region_id from plots where id = $1 and user_id = $2', [plotId, userId]);
      if (!p.rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy lô đất của bạn.', 404);
      if (p.rows[0].region_id !== sp.regionId) throw bad('sai_vung', `${sp.name} chỉ trồng được ở ${REGIONS[sp.regionId].name}.`, 409);
      const cost = seedCost(sp);
      if (u.rows[0].cash < cost) throw bad('khong_du_tien', 'Bạn không đủ tiền mua giống.', 409);
      const ready = new Date(Date.now() + stepWaitMs(sp, timeScale));
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
        `select g.id, g.specialty_id, g.step_index, g.step_ready_at, g.late_count
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
        return { harvested: { specialtyId: sp.id, quality: ql, kg } };
      }
      const next = new Date(now + stepWaitMs(sp, timeScale));
      await q.query('update plantings set step_index = step_index + 1, step_ready_at = $2, late_count = $3 where id = $1', [plantingId, next, late]);
      return { stepIndex: g.step_index + 1, stepReadyAt: next.getTime(), lateCount: late };
    });
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
      const unit = npcPrice(await currentPrice(q, sp.id), ql, sp.regionId, u.rows[0].home_region_id);
      await addCash(q, userId, unit * kg, `ban_thuong_lai:${sp.id}`);
      return { unitPrice: unit, total: unit * kg };
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
    const out: Record<string, { price: number; prev: number | null; source: string; observedAt: number }> = {};
    for (const r of rows) {
      if (!SPECIALTIES[r.specialty_id]) continue;
      if (Number(r.rn) === 1) out[r.specialty_id] = { price: r.price, prev: out[r.specialty_id]?.prev ?? null, source: r.source, observedAt: new Date(r.observed_at).getTime() };
      else out[r.specialty_id] = { ...(out[r.specialty_id] ?? { price: r.price, source: r.source, observedAt: 0 }), prev: r.price };
    }
    return { prices: out };
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
