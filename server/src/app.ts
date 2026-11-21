import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CROPS, PROVINCES, REGIONS, SPECIALTIES, npcOf, recipeOf, specialtiesOfRegion } from '../../shared/catalog.ts';
import wardData from '../../shared/wards.json' with { type: 'json' };
import {
  COOP_ORDER_BONUS, COOP_ORDER_DAYS, COOP_ORDER_KG_PER_MEMBER, FLOATING_BONUS, HARVEST_HELP_SHARE, IN_SEASON_YIELD, MARKET_DAY_BONUS,
  ORDERS_PER_DAY, ORDER_PREMIUM, PROCESS_SLOTS_XUONG, QUALITY_MULT, ROLES, ROLE_TARGETS, SEASON_DAYS, STALL_WALKIN_KG_PER_HOUR,
  STALL_WALKIN_MAX_RATIO, DUMP_RATIO, allowedTiles, inSeason, marketEventsAt, spinWeights, supplyKg, tripInfo,
  COOP_CREATE_COST, COOP_MAX_MEMBERS, GIFT_DAILY_LIMIT, GIFT_MAX_KG, HELP_DAILY_LIMIT, HELP_REWARD, LAND_PRICE, LATE_GRACE_MS, MAX_FRIENDS,
  QUALITIES, REGION_SET_REWARD, SOUVENIR_DAILY_BUYS, SOUVENIR_MAX_KG, SOUVENIR_RATIO, START_CASH, TILE_COUNT, TRAVEL_COST, glutFactor, inVietnam,
  marketDayAt, nearestRegion, npcPrice, qualityFromLate, region as findRegion, seedCost, snapCell, specialty as findSpecialty, stepCount,
  stepWaitMs, urbanCoreAt, weatherAt,
} from '../../shared/rules.ts';
import type { MarketDay, MarketEvent, PriceMods, Quality, Role, Weather } from '../../shared/rules.ts';
import { DECOR_ITEMS, HOUSE_TYPES, validAvatar, validDecor, validStyle } from '../../shared/custom.ts';
import type { DecorPlacement, PlotStyle } from '../../shared/custom.ts';
import type { Db, Q } from './db.ts';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const SESSION_DAYS = 30;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
/** Giá rao bán phải nằm trong khoảng này so với giá tham chiếu, để chợ không thành kênh chuyển tiền. */
const LISTING_MIN_RATIO = 0.3;
const LISTING_MAX_RATIO = 3;
const WARDS = wardData as Record<string, string[]>;
const DAY_MS = 86400_000, VN_TZ_MS = 7 * 3600_000;

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
  /** Thay lịch chợ theo tuần và cách xét chính vụ (cũng cho kiểm thử). */
  marketEventsAt?: (regionId: string, nowMs: number) => MarketEvent[];
  inSeason?: (cropId: string, nowMs: number) => boolean;
  /** Thay cách chọn vai từ trọng số vòng quay (kiểm thử). Mặc định chọn ngẫu nhiên theo trọng số. */
  pickRole?: (weights: Record<Role, number>) => Role;
  /** Phần thời lượng màn lái tối thiểu phải trôi qua trước khi chuyến xe được tính là tới nơi (mặc định 0.8). */
  tripMinFactor?: number;
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
  /** Sự kiện chợ của một vùng; chợ phiên luôn khớp với marketDayOf. */
  const eventsOf = opts.marketEventsAt ?? ((regionId: string, now: number): MarketEvent[] =>
    marketEventsAt(regionId, now).map((e) => (e.id === 'cho_phien' ? { ...e, ...marketDayOf(now) } : e)));
  const inSeasonOf = opts.inSeason ?? inSeason;
  const tripMinFactor = opts.tripMinFactor ?? 0.8;
  const pickRole = opts.pickRole ?? ((weights: Record<Role, number>): Role => {
    let x = randomInt(1_000_000) / 1_000_000;
    for (const r of ROLES) { x -= weights[r]; if (x < 0) return r; }
    return ROLES[ROLES.length - 1];
  });
  const SEASON_MS = SEASON_DAYS * DAY_MS;
  /** Kiểu nhà, màu sắc và tên của lô, bỏ phần ghi chú nội bộ. */
  const styleOut = (raw: any): PlotStyle | null => (raw ? validStyle(raw) : null);
  const decorOut = (raw: any): DecorPlacement[] => (raw ? validDecor(raw) ?? [] : []);
  const avatarOut = (raw: any) => (raw ? validAvatar(raw) : null);
  /** Các kiểu nhà chủ lô đã có (kiểu miễn phí luôn có sẵn). */
  const ownedOut = (raw: any): string[] => [...new Set([
    ...HOUSE_TYPES.filter((h) => h.price === 0).map((h) => h.id as string),
    ...(Array.isArray(raw?.owned) ? (raw.owned as unknown[]).filter((id): id is string => HOUSE_TYPES.some((h) => h.id === id)) : []),
  ])];
  const floatingAt = (regionId: string | null, now: number) => !!regionId && eventsOf(regionId, now).some((e) => e.id === 'cho_noi' && e.active);
  /** Sản lượng một ô khi thu hoạch, có cộng thêm nếu đúng chính vụ. */
  const harvestKg = (cropId: string, now: number) => {
    const season = inSeasonOf(cropId, now);
    return { kg: season ? Math.round(CROPS[cropId].yieldKg * IN_SEASON_YIELD) : CROPS[cropId].yieldKg, inSeason: season };
  };
  const wardOk = (province: unknown, name: unknown): province is string =>
    typeof province === 'string' && typeof name === 'string' && Object.hasOwn(WARDS, province) && WARDS[province].includes(name);
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
    // Ghi nhận còn chơi, tối đa 5 phút một lần; dùng để cân bằng vòng quay vai trò.
    await db.query(`update users set last_seen_at = now() where id = $1 and (last_seen_at is null or last_seen_at < now() - interval '5 minutes')`, [rows[0].user_id]);
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
  /** Hệ số được mùa mất giá: tính cả lượng đã bán 24 giờ qua lẫn diện tích đang trồng trên toàn máy chủ. */
  async function glutOf(q: Q, specialtyId: string): Promise<number> {
    const [sold, planted] = await Promise.all([
      q.query(`select coalesce(sum(kg),0)::int as kg from npc_sales where specialty_id = $1 and created_at > now() - interval '24 hours'`, [specialtyId]),
      q.query('select count(*)::int as n from plantings where specialty_id = $1', [specialtyId]),
    ]);
    return glutFactor(supplyKg(sold.rows[0].kg, planted.rows[0].n, CROPS[SPECIALTIES[specialtyId].crop].yieldKg));
  }
  /** Các yếu tố thị trường áp vào giá doanh nghiệp trả cho thương lái bán một đặc sản tại vùng chợ (nơi xe đang đỗ). */
  async function priceMods(q: Q, userId: number, specialtyId: string, now: number, marketRegionId: string, homeRegionId: string | null): Promise<PriceMods> {
    const [glut, coop, home] = await Promise.all([
      glutOf(q, specialtyId),
      q.query('select 1 from coop_members where user_id = $1', [userId]),
      q.query(`select 1 from plots where user_id = $1 and is_home and kind = 'rooftop'`, [userId]),
    ]);
    return {
      glut, marketDay: marketDayOf(now).active, coop: coop.rows.length > 0,
      city: home.rows.length > 0 && marketRegionId === homeRegionId, floating: floatingAt(marketRegionId, now),
    };
  }
  /** Khách vãng lai của thương lái ở phố mua dần hàng bày giá hợp lý; tính dồn theo thời gian đã trôi qua. */
  async function settleWalkIns(q: Q, userId: number, now: number): Promise<{ kg: number; total: number } | null> {
    const u = await q.query('select role from users where id = $1 for update', [userId]);
    if (u.rows[0]?.role !== 'thuong_lai') return null;
    const home = await q.query(`select 1 from plots where user_id = $1 and is_home and kind = 'rooftop'`, [userId]);
    if (!home.rows[0]) return null;
    const { rows } = await q.query(
      `select id, specialty_id, kg, price, coalesce(walkin_at, created_at) as since from listings
       where seller_id = $1 and status = 'open' and kg > 0 order by id for update`, [userId]);
    let kgSum = 0, total = 0;
    for (const l of rows) {
      if (!SPECIALTIES[l.specialty_id]) continue;
      if (l.price > (await currentPrice(q, l.specialty_id)) * STALL_WALKIN_MAX_RATIO) continue;
      const hours = ((now - new Date(l.since).getTime()) / 3600_000) * timeScale;
      const kg = Math.min(l.kg, Math.floor(hours * STALL_WALKIN_KG_PER_HOUR));
      if (kg <= 0) continue;
      await q.query(`update listings set kg = kg - $2, walkin_at = $3, status = case when kg - $2 = 0 then 'sold' else 'open' end where id = $1`, [l.id, kg, new Date(now)]);
      await addCash(q, userId, l.price * kg, `khach_vang_lai:${l.id}`);
      kgSum += kg; total += l.price * kg;
    }
    return kgSum > 0 ? { kg: kgSum, total } : null;
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
    const walkin = await db.tx((q) => settleWalkIns(q, userId, Date.now()));
    const [u, plots, inv, coop] = await Promise.all([
      db.query('select id, username, display_name, cash, home_region_id, role, role_assigned_at, truck_region, avatar from users where id = $1', [userId]),
      db.query('select id, region_id, is_home, kind, ward_name from plots where user_id = $1 order by is_home desc, id', [userId]),
      db.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > 0 order by specialty_id, quality', [userId]),
      db.query('select coop_id from coop_members where user_id = $1', [userId]),
    ]);
    const user = u.rows[0];
    return {
      user: {
        id: user.id, username: user.username, displayName: user.display_name, cash: user.cash, homeRegionId: user.home_region_id,
        homeKind: plots.rows.find((p) => p.is_home)?.kind ?? null, coopId: coop.rows[0]?.coop_id ?? null, role: user.role ?? null,
        roleNextSpinAt: user.role && user.role_assigned_at ? new Date(user.role_assigned_at).getTime() + SEASON_MS : null,
        truckRegionId: user.truck_region ?? user.home_region_id ?? null, avatar: avatarOut(user.avatar),
      },
      plots: plots.rows.map((p) => ({ id: p.id, regionId: p.region_id, isHome: p.is_home, kind: p.kind, wardName: p.ward_name })),
      inventory: inv.rows.map((i) => ({ specialtyId: i.specialty_id, quality: i.quality, kg: i.kg })),
      config: { timeScale, now: Date.now() },
      walkin,
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
    const hasWard = b.wardName !== undefined || b.wardProvince !== undefined;
    if (hasWard && !wardOk(b.wardProvince, b.wardName)) throw bad('xa_khong_hop_le', 'Xã, phường không có trong danh sách.');
    return db.tx(async (q) => {
      const { rows } = await q.query('select home_region_id from users where id = $1 for update', [userId]);
      if (rows[0].home_region_id) throw bad('da_co_dat', 'Bạn đã nhận lô đất đầu tiên rồi.', 409);
      await q.query('update users set home_region_id = $2 where id = $1', [userId, regionId]);
      const plot = await q.query(
        'insert into plots (user_id, region_id, cell_lat, cell_lng, is_home, kind, ward_name, ward_province) values ($1,$2,$3,$4,true,$5,$6,$7) returning id',
        [userId, regionId, cell.lat, cell.lng, rooftop ? 'rooftop' : 'ground', hasWard ? b.wardName : null, hasWard ? b.wardProvince : null]);
      return { plotId: plot.rows[0].id, regionId, kind: rooftop ? 'rooftop' : 'ground' };
    });
  });

  app.get('/api/wards', async (req) => {
    await requireUser(req);
    const province = (req.query as Record<string, unknown>).province;
    if (typeof province !== 'string' || !(PROVINCES as readonly string[]).includes(province) || !Object.hasOwn(WARDS, province)) throw bad('du_lieu_sai', 'Tỉnh, thành phố không hợp lệ.');
    return { wards: WARDS[province] };
  });

  app.post('/api/plots/:id/ward', async (req) => {
    const userId = await requireUser(req);
    const plotId = idParam((req.params as any).id);
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (!wardOk(b.wardProvince, b.wardName)) throw bad('xa_khong_hop_le', 'Xã, phường không có trong danh sách.');
    const { rowCount } = await db.query('update plots set ward_name = $3, ward_province = $4 where id = $1 and user_id = $2', [plotId, userId, b.wardName, b.wardProvince]);
    if (!rowCount) throw bad('khong_tim_thay', 'Không tìm thấy lô đất của bạn.', 404);
    return { ok: true };
  });

  /** Vòng quay giao vai trò: nghiêng về vai mà vùng nhà đang thiếu; mỗi mùa quay lại được một lần. */
  app.post('/api/role/spin', async (req) => {
    const userId = await requireUser(req);
    return db.tx(async (q) => {
      const u = await q.query('select home_region_id, role, role_assigned_at from users where id = $1 for update', [userId]);
      const home = await q.query('select kind from plots where user_id = $1 and is_home limit 1', [userId]);
      if (!u.rows[0].home_region_id || !home.rows[0]) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước khi quay vai trò.', 409);
      const now = Date.now();
      const assignedAt = u.rows[0].role && u.rows[0].role_assigned_at ? new Date(u.rows[0].role_assigned_at).getTime() : null;
      if (assignedAt !== null && now < assignedAt + SEASON_MS) throw bad('chua_den_mua', 'Mùa này bạn đã có vai trò rồi, hết mùa mới quay lại được.', 409);
      const active = await q.query(
        `select role, count(*)::int as n from users
         where home_region_id = $1 and id <> $2 and role is not null and last_seen_at > now() - interval '7 days' group by role`,
        [u.rows[0].home_region_id, userId]);
      const counts = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
      for (const r of active.rows) if (ROLES.includes(r.role)) counts[r.role as Role] = r.n;
      const weights = spinWeights(home.rows[0].kind === 'rooftop' ? ROLE_TARGETS.urban : ROLE_TARGETS.rural, counts);
      const role = pickRole(weights);
      if (!ROLES.includes(role)) throw new Error('pickRole trả về vai trò không hợp lệ');
      await q.query('update users set role = $2, role_assigned_at = $3, truck_region = home_region_id where id = $1', [userId, role, new Date(now)]);
      return { role, weights, nextSpinAt: now + SEASON_MS };
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
      `select p.id, p.user_id, p.region_id, p.is_home, p.kind, p.ward_name, p.ward_province, p.style, p.decor, u.display_name, u.role as owner_role, u.avatar as owner_avatar
       from plots p join users u on u.id = p.user_id where p.id = $1`, [plotId]);
    const p = rows[0];
    if (!p) throw bad('khong_tim_thay', 'Không tìm thấy lô đất.', 404);
    const [tiles, stall] = await Promise.all([
      db.query('select id, tile, specialty_id, step_index, step_ready_at, late_count from plantings where plot_id = $1 order by tile', [plotId]),
      db.query(`select id, specialty_id, quality, kg, price from listings where seller_id = $1 and status = 'open' order by id desc limit 50`, [p.user_id]),
    ]);
    return {
      plot: {
        id: p.id, regionId: p.region_id, isHome: p.is_home, kind: p.kind, wardName: p.ward_name, wardProvince: p.ward_province, ownerName: p.display_name, mine: p.user_id === userId,
        ownerRole: p.owner_role ?? null, style: styleOut(p.style), decor: decorOut(p.decor), ownerAvatar: avatarOut(p.owner_avatar),
        ...(p.user_id === userId ? { ownedHouses: ownedOut(p.style) } : {}),
      },
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
      `select p.id, u.display_name, p.is_home, p.ward_name,
              (select count(*)::int from plantings g where g.plot_id = p.id) as growing
       from plots p join users u on u.id = p.user_id where p.region_id = $1 order by p.id desc limit 50`, [r.id]);
    const count = await db.query('select count(*)::int as n from plots where region_id = $1', [r.id]);
    return { total: count.rows[0].n, farms: rows.map((f) => ({ plotId: f.id, ownerName: f.display_name, isHome: f.is_home, growing: f.growing, wardName: f.ward_name })) };
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
      const u = await q.query('select cash, role from users where id = $1 for update', [userId]);
      const p = await q.query('select region_id, kind from plots where id = $1 and user_id = $2', [plotId, userId]);
      if (!p.rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy lô đất của bạn.', 404);
      if (!u.rows[0].role) throw bad('chua_co_vai', 'Hãy quay vòng quay để nhận vai trò trước khi trồng.', 409);
      if (!allowedTiles(p.rows[0].kind, u.rows[0].role).includes(tile)) {
        throw bad('o_bi_khoa', u.rows[0].role === 'nong_dan' ? 'Vườn sân thượng chỉ trồng được 12 ô ở giữa.' : 'Vai trò của bạn chỉ có vườn nhỏ 8 ô ở giữa.', 409);
      }
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
        const h = harvestKg(sp.crop, now);
        await q.query('delete from plantings where id = $1', [plantingId]);
        await addInventory(q, userId, sp.id, ql, h.kg);
        await collect(q, userId, sp.id);
        return { harvested: { specialtyId: sp.id, quality: ql, kg: h.kg, inSeason: h.inSeason } };
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
      const sp = SPECIALTIES[g.specialty_id];
      const isHarvest = g.step_index >= stepCount(sp) - 1;
      const friend = await areFriends(q, userId, g.owner_id);
      // Khách du lịch đã tới vùng này được phụ thu hoạch; các bước chăm sóc khác chỉ dành cho bạn bè.
      const tourist = !friend && isHarvest && (await q.query('select 1 from visits where user_id = $1 and region_id = $2', [userId, g.region_id])).rows.length > 0;
      if (!friend && !tourist) throw bad('khong_phai_ban', isHarvest ? 'Hãy đi du lịch tới vùng này hoặc kết bạn với chủ vườn để phụ thu hoạch.' : 'Chỉ bạn bè mới chăm giúp được.', 403);
      const now = Date.now();
      const readyAt = new Date(g.step_ready_at).getTime();
      if (now < readyAt) throw bad('chua_den_luc', 'Chưa đến lúc làm bước này.', 409);
      // Khoá tài khoản người giúp để hai lượt giúp cùng lúc không vượt giới hạn ngày.
      await q.query('select id from users where id = $1 for update', [userId]);
      const used = await q.query(
        `select count(*)::int as n from ledger where user_id = $1 and reason like 'cham_giup:%' and created_at >= date_trunc('day', now())`, [userId]);
      if (used.rows[0].n >= HELP_DAILY_LIMIT) throw bad('het_luot', `Hôm nay bạn đã chăm giúp đủ ${HELP_DAILY_LIMIT} lượt.`, 409);
      const late = g.late_count + (now > readyAt + lateGraceMs ? 1 : 0);
      if (isHarvest) {
        // Phụ thu hoạch: chủ vườn nhận phần lớn, người phụ được chia một phần làm quà vườn.
        const ql = qualityFromLate(late);
        const h = harvestKg(sp.crop, now);
        const share = Math.min(h.kg, Math.max(1, Math.round(h.kg * HARVEST_HELP_SHARE)));
        await q.query('delete from plantings where id = $1', [plantingId]);
        if (h.kg - share > 0) await addInventory(q, g.owner_id, sp.id, ql, h.kg - share);
        await addInventory(q, userId, sp.id, ql, share);
        await collect(q, g.owner_id, sp.id);
        await collect(q, userId, sp.id);
        await q.query('insert into ledger (user_id, delta, reason) values ($1,0,$2)', [userId, `cham_giup:${plantingId}`]);
        return { harvested: { specialtyId: sp.id, quality: ql, kg: h.kg, share, inSeason: h.inSeason } };
      }
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
    const cols = `p.id, p.user_id, p.region_id, p.is_home, p.kind, p.ward_name, p.ward_province, p.style, p.decor, u.display_name, u.role as owner_role, u.avatar as owner_avatar`;
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
        id: p.id, regionId: p.region_id, isHome: p.is_home, kind: p.kind, wardName: p.ward_name, wardProvince: p.ward_province, ownerId: p.user_id, ownerName: p.display_name,
        mine: p.user_id === userId, friend: friendIds.includes(p.user_id),
        ownerRole: p.owner_role ?? null, style: styleOut(p.style), decor: decorOut(p.decor), ownerAvatar: avatarOut(p.owner_avatar),
        ...(p.user_id === userId ? { ownedHouses: ownedOut(p.style) } : {}),
      },
      plantings: tiles.rows.filter((t) => t.plot_id === p.id).map((t) => ({
        id: t.id, tile: t.tile, specialtyId: t.specialty_id, stepIndex: t.step_index,
        stepReadyAt: new Date(t.step_ready_at).getTime(), lateCount: t.late_count,
      })),
      stall: stalls.rows.filter((l) => l.seller_id === p.user_id).map((l) => ({ id: l.id, specialtyId: l.specialty_id, quality: l.quality, kg: l.kg, price: l.price })),
    });
    const now = Date.now();
    return { center: lot(center), neighbors: neighbors.map(lot), now, weather: weatherOf(center.region_id, now), marketDay: marketDayOf(now), events: eventsOf(center.region_id, now) };
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
      const u = await q.query('select home_region_id, role, truck_region from users where id = $1 for update', [userId]);
      await takeInventory(q, userId, sp.id, ql, kg);
      const now = Date.now();
      const ref = await currentPrice(q, sp.id);
      if (u.rows[0].role !== 'thuong_lai') {
        // Không phải thương lái: chỉ bán tháo được, giá thấp và không có thưởng nào.
        const unit = Math.round((ref * DUMP_RATIO * QUALITY_MULT[ql]) / 100) * 100;
        await q.query('insert into npc_sales (user_id, specialty_id, kg) values ($1,$2,$3)', [userId, sp.id, kg]);
        await addCash(q, userId, unit * kg, `ban_thao:${sp.id}`);
        return { unitPrice: unit, total: unit * kg, mods: {}, npcId: npcOf('thuong_lai').id, dump: true };
      }
      // Thương lái bán tại nơi xe đang đỗ: hàng của vùng đó là giá tại vườn, hàng vùng khác là hàng phương xa.
      const market: string = u.rows[0].truck_region ?? u.rows[0].home_region_id;
      const mods = await priceMods(q, userId, sp.id, now, market, u.rows[0].home_region_id);
      const unit = npcPrice(ref, ql, sp.regionId, market, mods);
      await q.query('insert into npc_sales (user_id, specialty_id, kg) values ($1,$2,$3)', [userId, sp.id, kg]);
      await addCash(q, userId, unit * kg, `ban_thuong_lai:${sp.id}`);
      return { unitPrice: unit, total: unit * kg, mods, npcId: npcOf('thuong_lai').id, dump: false, marketRegionId: market };
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
    const out: Record<string, { price: number; prev: number | null; source: string; observedAt: number; glut?: number; planted?: number }> = {};
    for (const r of rows) {
      if (!SPECIALTIES[r.specialty_id]) continue;
      if (Number(r.rn) === 1) out[r.specialty_id] = { price: r.price, prev: out[r.specialty_id]?.prev ?? null, source: r.source, observedAt: new Date(r.observed_at).getTime() };
      else out[r.specialty_id] = { ...(out[r.specialty_id] ?? { price: r.price, source: r.source, observedAt: 0 }), prev: r.price };
    }
    const sold = await db.query(`select specialty_id, sum(kg)::int as kg from npc_sales where created_at > now() - interval '24 hours' group by specialty_id`);
    const kgOf = new Map(sold.rows.map((r) => [r.specialty_id, r.kg]));
    const planted = await db.query('select specialty_id, count(*)::int as n from plantings group by specialty_id');
    const tilesOf = new Map(planted.rows.map((r) => [r.specialty_id, r.n]));
    for (const id of Object.keys(out)) {
      out[id].planted = tilesOf.get(id) ?? 0;
      out[id].glut = glutFactor(supplyKg(kgOf.get(id) ?? 0, out[id].planted!, CROPS[SPECIALTIES[id].crop].yieldKg));
    }
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
    // Đơn lớn: luôn có một đơn đang mở; đơn hết hạn thì đóng và nhận đơn mới.
    const order = await db.tx(async (q) => {
      await q.query('select id from coops where id = $1 for update', [c.id]);
      await q.query(`update coop_orders set status = 'expired' where coop_id = $1 and status = 'open' and expires_at <= now()`, [c.id]);
      let o = (await q.query(`select * from coop_orders where coop_id = $1 and status = 'open' order by id desc limit 1`, [c.id])).rows[0];
      if (!o) {
        const choices = specialtiesOfRegion(c.region_id);
        const sp = choices[Math.floor(Math.random() * choices.length)];
        const count = await q.query('select count(*)::int as n from coop_members where coop_id = $1', [c.id]);
        o = (await q.query(
          `insert into coop_orders (coop_id, specialty_id, npc_id, kg_target, expires_at) values ($1,$2,$3,$4,$5) returning *`,
          [c.id, sp.id, npcOf('xuat_khau').id, COOP_ORDER_KG_PER_MEMBER * Math.max(1, count.rows[0].n), new Date(Date.now() + COOP_ORDER_DAYS * DAY_MS)])).rows[0];
      }
      const mine = await q.query('select kg from coop_contribs where order_id = $1 and user_id = $2', [o.id, userId]);
      return {
        id: o.id, specialtyId: o.specialty_id, npcId: o.npc_id, kgTarget: o.kg_target, kgFilled: o.kg_filled,
        expiresAt: new Date(o.expires_at).getTime(), mine: mine.rows[0]?.kg ?? 0,
      };
    });
    return {
      coop: {
        id: c.id, name: c.name, regionId: c.region_id, ownerId: c.owner_id,
        kgWeek: members.rows.reduce((sum, m) => sum + m.kg_week, 0),
        members: members.rows.map((m) => ({ userId: m.id, displayName: m.display_name, kgWeek: m.kg_week })),
        order,
      },
    };
  });

  app.post('/api/coops/order/contribute', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const ql = quality(b.quality);
    const kg = int(b.kg, 1, 1_000_000, 'kg');
    return db.tx(async (q) => {
      const m = await q.query('select coop_id from coop_members where user_id = $1', [userId]);
      if (!m.rows[0]) throw bad('chua_co_htx', 'Bạn chưa ở trong hợp tác xã nào.', 409);
      const o = (await q.query(
        `select * from coop_orders where coop_id = $1 and status = 'open' and expires_at > now() order by id desc limit 1 for update`, [m.rows[0].coop_id])).rows[0];
      if (!o || !SPECIALTIES[o.specialty_id]) throw bad('khong_co_don', 'Hợp tác xã chưa có đơn hàng nào đang mở.', 409);
      if (kg > o.kg_target - o.kg_filled) throw bad('vuot_don', `Đơn chỉ còn thiếu ${o.kg_target - o.kg_filled} kg.`, 409);
      await takeInventory(q, userId, o.specialty_id, ql, kg);
      const value = Math.round((await currentPrice(q, o.specialty_id)) * QUALITY_MULT[ql] * kg);
      await addCash(q, userId, value, `gop_don:${o.id}`);
      await q.query(
        `insert into coop_contribs (order_id, user_id, kg, value) values ($1,$2,$3,$4)
         on conflict (order_id, user_id) do update set kg = coop_contribs.kg + excluded.kg, value = coop_contribs.value + excluded.value`, [o.id, userId, kg, value]);
      const completed = o.kg_filled + kg >= o.kg_target;
      await q.query(`update coop_orders set kg_filled = kg_filled + $2, status = $3 where id = $1`, [o.id, kg, completed ? 'done' : 'open']);
      if (completed) {
        const all = await q.query('select user_id, value from coop_contribs where order_id = $1 order by user_id', [o.id]);
        for (const r of all.rows) await addCash(q, r.user_id, Math.round(r.value * COOP_ORDER_BONUS), `thuong_don:${o.id}`);
      }
      return { paid: value, completed };
    });
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
      const today = await q.query(`select count(*)::int as n from ledger where user_id = $1 and reason like 'qua_dac_san:%' and created_at >= date_trunc('day', now())`, [userId]);
      if (today.rows[0].n >= SOUVENIR_DAILY_BUYS) throw bad('het_luot', `Mỗi ngày chỉ mua quà đặc sản ${SOUVENIR_DAILY_BUYS} lần.`, 409);
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

  // ---------------------------------------------------------------- xưởng chế biến
  const slotsOf = (role: string | null) => (role === 'xuong' ? PROCESS_SLOTS_XUONG : 0);

  app.get('/api/workshop', async (req) => {
    const userId = await requireUser(req);
    const [u, jobs, products] = await Promise.all([
      db.query('select role from users where id = $1', [userId]),
      db.query('select id, specialty_id, kg_in, kg_out, ready_at from process_jobs where user_id = $1 order by id', [userId]),
      db.query('select specialty_id, kg from products where user_id = $1 and kg > 0 order by specialty_id', [userId]),
    ]);
    return {
      slots: slotsOf(u.rows[0].role),
      jobs: jobs.rows.filter((j) => SPECIALTIES[j.specialty_id]).map((j) => ({ id: j.id, specialtyId: j.specialty_id, kgIn: j.kg_in, kgOut: j.kg_out, readyAt: new Date(j.ready_at).getTime() })),
      products: products.rows.filter((p) => SPECIALTIES[p.specialty_id]).map((p) => ({ specialtyId: p.specialty_id, kg: p.kg })),
    };
  });

  app.post('/api/workshop/start', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const ql = quality(b.quality);
    const kg = int(b.kg, 1, 1_000_000, 'kg');
    return db.tx(async (q) => {
      const u = await q.query('select role from users where id = $1 for update', [userId]);
      if (u.rows[0].role !== 'xuong') throw bad('chi_chu_xuong', 'Chỉ chủ xưởng mới chế biến được. Hãy bán nông sản cho chủ xưởng qua sạp.', 403);
      const running = await q.query('select count(*)::int as n from process_jobs where user_id = $1', [userId]);
      if (running.rows[0].n >= slotsOf(u.rows[0].role)) throw bad('het_cho', 'Xưởng đã kín dây chuyền, hãy nhận hàng xong rồi làm mẻ mới.', 409);
      await takeInventory(q, userId, sp.id, ql, kg);
      const recipe = recipeOf(CROPS[sp.crop]);
      // Làm tròn xuống để chia nhỏ mẻ không được lợi; mẻ quá ít thì từ chối.
      const kgOut = Math.floor(kg * recipe.ratio * QUALITY_MULT[ql] + 1e-9);
      if (kgOut < 1) throw bad('qua_it', `Cần ít nhất ${Math.ceil(1 / (recipe.ratio * QUALITY_MULT[ql]))} kg để chế biến một mẻ.`, 409);
      const ms = (recipe.hours * 3600_000) / timeScale;
      const readyAt = new Date(Date.now() + Math.round(ms));
      const ins = await q.query(
        'insert into process_jobs (user_id, specialty_id, kg_in, kg_out, ready_at) values ($1,$2,$3,$4,$5) returning id', [userId, sp.id, kg, kgOut, readyAt]);
      return { jobId: ins.rows[0].id, kgOut, readyAt: readyAt.getTime() };
    });
  });

  app.post('/api/workshop/collect/:id', async (req) => {
    const userId = await requireUser(req);
    const jobId = idParam((req.params as any).id);
    return db.tx(async (q) => {
      const { rows } = await q.query('select specialty_id, kg_out, ready_at from process_jobs where id = $1 and user_id = $2 for update', [jobId, userId]);
      const j = rows[0];
      if (!j) throw bad('khong_tim_thay', 'Không tìm thấy mẻ hàng.', 404);
      if (Date.now() < new Date(j.ready_at).getTime()) throw bad('chua_xong', 'Mẻ hàng chưa chế biến xong.', 409);
      await q.query('delete from process_jobs where id = $1', [jobId]);
      await q.query(
        `insert into products (user_id, specialty_id, kg) values ($1,$2,$3)
         on conflict (user_id, specialty_id) do update set kg = products.kg + excluded.kg`, [userId, j.specialty_id, j.kg_out]);
      return { specialtyId: j.specialty_id, kg: j.kg_out };
    });
  });

  app.post('/api/workshop/sell', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const kg = int(b.kg, 1, 1_000_000, 'kg');
    return db.tx(async (q) => {
      const u = await q.query('select home_region_id from users where id = $1 for update', [userId]);
      const { rowCount } = await q.query('update products set kg = kg - $3 where user_id = $1 and specialty_id = $2 and kg >= $3', [userId, sp.id, kg]);
      if (!rowCount) throw bad('khong_du_hang', 'Không đủ thành phẩm.', 409);
      const now = Date.now();
      const bonus = (marketDayOf(now).active ? MARKET_DAY_BONUS : 0) + (floatingAt(u.rows[0].home_region_id, now) ? FLOATING_BONUS : 0);
      const unit = Math.round(((await currentPrice(q, sp.id)) * recipeOf(CROPS[sp.crop]).value * (1 + bonus)) / 100) * 100;
      await addCash(q, userId, unit * kg, `ban_che_bien:${sp.id}`);
      return { unitPrice: unit, total: unit * kg, npcId: npcOf('che_bien').id };
    });
  });

  // ---------------------------------------------------------------- đơn hàng cá nhân theo ngày
  const vnDay = (now: number) => Math.floor((now + VN_TZ_MS) / DAY_MS);
  const dayString = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
  /** Bộ sinh số tất định theo chuỗi hạt giống, để đơn trong ngày của một người luôn như nhau. */
  function seeded(seed: string): () => number {
    let h = 2166136261;
    for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function ordersFor(userId: number, homeRegionId: string, day: number) {
    const pick = <T>(list: T[], r: () => number): T => list[Math.floor(r() * list.length)];
    const kg = (min: number, max: number, r: () => number) => min + Math.floor(r() * (max - min + 1));
    const others = Object.keys(REGIONS).filter((id) => id !== homeRegionId).sort();
    const sameZone = others.filter((id) => REGIONS[id].zone === REGIONS[homeRegionId].zone);
    const home = specialtiesOfRegion(homeRegionId);
    const out: { slot: number; npcId: string; title: string; items: { specialtyId: string; kg: number }[] }[] = [];
    for (let slot = 0; slot < ORDERS_PER_DAY; slot++) {
      const r = seeded(`${userId}:${day}:${slot}`);
      if (slot === 0) out.push({ slot, npcId: npcOf('thuong_lai').id, title: 'Đơn thu mua', items: [{ specialtyId: pick(home, r).id, kg: kg(10, 30, r) }] });
      else if (slot === 1) {
        const other = pick(sameZone.length ? sameZone : others, r);
        out.push({ slot, npcId: npcOf('sieu_thi').id, title: 'Giỏ quà biếu', items: [
          { specialtyId: pick(home, r).id, kg: kg(5, 15, r) }, { specialtyId: pick(specialtiesOfRegion(other), r).id, kg: kg(5, 15, r) }] });
      } else {
        const a = pick(others, r), rest = others.filter((id) => id !== a), c = pick(rest, r);
        out.push({ slot, npcId: npcOf('sieu_thi').id, title: 'Mâm ngũ quả', items: [homeRegionId, a, c].map((regionId) => ({ specialtyId: pick(specialtiesOfRegion(regionId), r).id, kg: kg(3, 8, r) })) });
      }
    }
    return out;
  }
  async function orderReward(q: Q, items: { specialtyId: string; kg: number }[]): Promise<number> {
    let sum = 0;
    for (const it of items) sum += (await currentPrice(q, it.specialtyId)) * it.kg;
    return Math.round((sum * ORDER_PREMIUM) / 1000) * 1000;
  }

  app.get('/api/orders', async (req) => {
    const userId = await requireUser(req);
    const u = await db.query('select home_region_id from users where id = $1', [userId]);
    const day = vnDay(Date.now());
    if (!u.rows[0].home_region_id) return { orders: [], resetsAt: (day + 1) * DAY_MS - VN_TZ_MS };
    const done = await db.query('select slot from order_done where user_id = $1 and day = $2', [userId, dayString(day)]);
    const doneSlots = new Set(done.rows.map((r) => r.slot));
    const orders = [];
    for (const o of ordersFor(userId, u.rows[0].home_region_id, day)) orders.push({ ...o, reward: await orderReward(db, o.items), done: doneSlots.has(o.slot) });
    return { orders, resetsAt: (day + 1) * DAY_MS - VN_TZ_MS };
  });

  app.post('/api/orders/:slot/deliver', async (req) => {
    const userId = await requireUser(req);
    const slot = Number((req.params as any).slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= ORDERS_PER_DAY) throw bad('khong_tim_thay', 'Không tìm thấy đơn hàng.', 404);
    return db.tx(async (q) => {
      const u = await q.query('select home_region_id from users where id = $1 for update', [userId]);
      if (!u.rows[0].home_region_id) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      const day = vnDay(Date.now());
      const order = ordersFor(userId, u.rows[0].home_region_id, day)[slot];
      const mark = await q.query('insert into order_done (user_id, day, slot) values ($1,$2,$3) on conflict do nothing', [userId, dayString(day), slot]);
      if (!mark.rowCount) throw bad('da_giao', 'Đơn này hôm nay bạn đã giao rồi.', 409);
      for (const it of order.items) {
        // Giao hàng hạng thấp trước để giữ hàng đẹp lại cho người chơi.
        const stock = await q.query(
          `select quality, kg from inventory where user_id = $1 and specialty_id = $2 and kg > 0 order by quality desc for update`, [userId, it.specialtyId]);
        if (stock.rows.reduce((sum, r) => sum + r.kg, 0) < it.kg) throw bad('khong_du_hang', `Kho chưa đủ ${it.kg} kg ${SPECIALTIES[it.specialtyId].name}.`, 409);
        let need = it.kg;
        for (const r of stock.rows) {
          const take = Math.min(need, r.kg);
          if (take > 0) await takeInventory(q, userId, it.specialtyId, r.quality, take);
          need -= take;
        }
      }
      const reward = await orderReward(q, order.items);
      await addCash(q, userId, reward, `don_hang:${slot}`);
      return { reward };
    });
  });

  // ---------------------------------------------------------------- chuyến xe của thương lái
  app.post('/api/trips/start', async (req) => {
    const userId = await requireUser(req);
    const to = findRegion(String((req.body as any)?.toRegionId ?? ''));
    if (!to) throw bad('du_lieu_sai', 'Vùng trồng không tồn tại.');
    return db.tx(async (q) => {
      const u = await q.query('select cash, role, home_region_id, truck_region from users where id = $1 for update', [userId]);
      if (u.rows[0].role !== 'thuong_lai') throw bad('chi_thuong_lai', 'Chỉ thương lái mới có xe chở hàng đi vùng khác.', 403);
      const from: string | null = u.rows[0].truck_region ?? u.rows[0].home_region_id;
      if (!from || !findRegion(from)) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      if (from === to.id) throw bad('du_lieu_sai', 'Xe của bạn đang ở vùng này rồi.');
      const info = tripInfo(from, to.id);
      if (u.rows[0].cash < info.fuel) throw bad('khong_du_tien', 'Bạn không đủ tiền xăng cho chuyến này.', 409);
      await addCash(q, userId, -info.fuel, `xang:${to.id}`);
      const ins = await q.query(
        'insert into trips (user_id, from_region, to_region, min_seconds) values ($1,$2,$3,$4) returning id', [userId, from, to.id, info.seconds]);
      return { tripId: ins.rows[0].id, fromRegionId: from, toRegionId: to.id, ...info };
    });
  });

  app.post('/api/trips/:id/finish', async (req) => {
    const userId = await requireUser(req);
    const tripId = idParam((req.params as any).id);
    return db.tx(async (q) => {
      const { rows } = await q.query(
        'select to_region, min_seconds, started_at from trips where id = $1 and user_id = $2 and finished_at is null for update', [tripId, userId]);
      const t = rows[0];
      if (!t) throw bad('khong_tim_thay', 'Không tìm thấy chuyến xe đang chạy.', 404);
      if (Date.now() - new Date(t.started_at).getTime() < t.min_seconds * 1000 * tripMinFactor) throw bad('chua_toi_noi', 'Xe chưa tới nơi.', 409);
      await q.query('update trips set finished_at = now() where id = $1', [tripId]);
      await q.query('update users set truck_region = $2 where id = $1', [userId, t.to_region]);
      await q.query('insert into visits (user_id, region_id) values ($1,$2) on conflict do nothing', [userId, t.to_region]);
      return { regionId: t.to_region };
    });
  });

  // ---------------------------------------------------------------- cá nhân hoá nhà, sạp, sân vườn, nhân vật
  app.post('/api/plots/:id/style', async (req) => {
    const userId = await requireUser(req);
    const plotId = idParam((req.params as any).id);
    const style = validStyle(req.body);
    if (!style) throw bad('du_lieu_sai', 'Kiểu nhà, màu sắc hoặc tên không hợp lệ.');
    return db.tx(async (q) => {
      const u = await q.query('select cash from users where id = $1 for update', [userId]);
      const p = await q.query('select style from plots where id = $1 and user_id = $2 for update', [plotId, userId]);
      if (!p.rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy lô đất của bạn.', 404);
      const owned = ownedOut(p.rows[0].style);
      let cost = 0;
      if (!owned.includes(style.house)) {
        cost = HOUSE_TYPES.find((h) => h.id === style.house)!.price;
        if (u.rows[0].cash < cost) throw bad('khong_du_tien', 'Bạn không đủ tiền đổi kiểu nhà này.', 409);
        await addCash(q, userId, -cost, `kieu_nha:${style.house}`);
        owned.push(style.house);
      }
      await q.query('update plots set style = $2 where id = $1', [plotId, JSON.stringify({ ...style, owned })]);
      return { style, ownedHouses: owned, cost };
    });
  });

  app.post('/api/plots/:id/decor', async (req) => {
    const userId = await requireUser(req);
    const plotId = idParam((req.params as any).id);
    const items = validDecor((req.body as any)?.items);
    if (!items) throw bad('du_lieu_sai', 'Đồ trang trí hoặc vị trí đặt không hợp lệ.');
    return db.tx(async (q) => {
      const u = await q.query('select cash from users where id = $1 for update', [userId]);
      const p = await q.query('select decor from plots where id = $1 and user_id = $2 for update', [plotId, userId]);
      if (!p.rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy lô đất của bạn.', 404);
      const count = (list: DecorPlacement[], id: string) => list.filter((d) => d.item === id).length;
      const before = decorOut(p.rows[0].decor);
      let cost = 0;
      for (const d of DECOR_ITEMS) cost += Math.max(0, count(items, d.id) - count(before, d.id)) * d.price;
      if (u.rows[0].cash < cost) throw bad('khong_du_tien', 'Bạn không đủ tiền mua thêm đồ trang trí.', 409);
      if (cost > 0) await addCash(q, userId, -cost, `trang_tri:${plotId}`);
      await q.query('update plots set decor = $2 where id = $1', [plotId, JSON.stringify(items)]);
      return { decor: items, cost };
    });
  });

  app.post('/api/avatar', async (req) => {
    const userId = await requireUser(req);
    const avatar = validAvatar(req.body);
    if (!avatar) throw bad('du_lieu_sai', 'Trang phục hoặc màu xe không hợp lệ.');
    await db.query('update users set avatar = $2 where id = $1', [userId, JSON.stringify(avatar)]);
    return { avatar };
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
