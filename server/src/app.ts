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
  STALL_WALKIN_MAX_RATIO, DUMP_RATIO, allowedTiles, inSeason, marketEventsAt, spinWeights, supplyKg, tripInfo, TRUCK, landPrice, roadKm, tripPlan,
  COOP_CREATE_COST, COOP_MAX_MEMBERS, GIFT_DAILY_LIMIT, GIFT_MAX_KG, HELP_DAILY_LIMIT, HELP_REWARD, LAND_PRICE, LATE_GRACE_MS, MAX_FRIENDS,
  QUALITIES, REGION_SET_REWARD, SOUVENIR_DAILY_BUYS, SOUVENIR_MAX_KG, SOUVENIR_RATIO, START_CASH, TILE_COUNT, glutFactor, inVietnam, paceFactor, travelOptions,
  marketDayAt, nearestRegion, npcPrice, qualityFromLate, region as findRegion, seedCost, snapCell, specialty as findSpecialty, stepCount,
  stepWaitMs, urbanCoreAt, weatherAt, speedFine, wholesalePrice, wholesaleSupplyKg, wholesaleQuote, bulkSellFactor, spoilRate, BULK_EASY_KG, EXPORT_MODES, EXPORT_MARKETS, EXPORT_GATEWAYS, EXPORT_MAX_ACTIVE,
  exportModesFor, exportQuote, coopOrderRoute, LIMIT_REASONS, TRAVEL_VS_TRUCK, haversineKm, taxiFare,
  SIGHT_REWARD, SIGHT_TAXI_SECONDS, sightRoute, SUPER_DAILY_KG, SUPER_FEE, SUPER_MAX_LOTS, SUPER_MAX_LOT_KG, SUPER_MIN_KG,
  SUPER_NPC_GUESTS, SUPER_NPC_KG, SUPER_NPC_RATIO, superPriceRange,
  ENERGY_COST, ENERGY_REGEN_MINUTES, LEVELS, XP, energyAt, levelOf, levelPerks, tripEnergy, LAND_CERT_NAME, landFees,
  MACHINES, MACHINE_MAX_LEVEL, WORKSHOP_MAX_MACHINES, WORKSHOP_MAX_PER_KIND, WORKSHOP_RUN_FEE_PER_KG, machineStats, machineUpgradeCost, machinesForRecipe, starterMachine,
  exportDiscount, exportMaxActive,
} from '../../shared/rules.ts';
import type { ExportMarket, ExportMode, MachineKind, MarketDay, MarketEvent, PriceMods, Quality, Role, Weather } from '../../shared/rules.ts';
import { HOME_SHOP_ITEMS, ITEMS, ITEM_BAG_MAX, SHOP_KINDS, regionalItems } from '../../shared/items.ts';
import type { ShopKind } from '../../shared/items.ts';
import { DECOR_ITEMS, HOUSE_TYPES, validAvatar, validDecor, validStyle } from '../../shared/custom.ts';
import type { DecorPlacement, PlotStyle } from '../../shared/custom.ts';
import { SIGHTS, SIGHT_PROVINCES, sight as findSight, sightsOfProvince } from '../../shared/sights.ts';
import { cleanUpgrades, growFx, isSeedTrait, xpFor } from '../../shared/progress.ts';
import type { GrowFx, XpSource } from '../../shared/progress.ts';
import { applyImport, logXp, registerProgress, useSeed } from './progress.ts';
import type { Db, Q } from './db.ts';
import { registerVehicles } from './vehicles.ts';
import { registerShopping } from './shopping.ts';
import { registerEconomy } from './economy.ts';
import { ORDER_KIND_NAMES, ORDER_PREMIUM_V2, SUPER_PROVINCES, machineBatchKg, orderBonus, orderScale } from '../../shared/economy.ts';
import { registerFarm } from './farm.ts';

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
  /** Thay hệ số nhịp chơi theo số lần đã thu hoạch (kiểm thử dùng () => 1). */
  paceFactor?: (harvests: number) => number;
  /** Tên tài khoản được đánh dấu là tài khoản thử nghiệm khi đăng ký hoặc đăng nhập. */
  testerUsernames?: string[];
  /** Tua nhanh thời hạn bằng lái (mặc định 1: một "năm bằng lái" dài LICENSE_YEAR_DAYS ngày thật). Tách khỏi timeScale để máy chủ thử không làm bằng hết hạn giữa chừng. */
  licenseTimeScale?: number;
  /** Kiểm thử: chia thời gian làm bài thi tối thiểu. */
  examHurry?: number;
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
  const paceOf = opts.paceFactor ?? paceFactor;
  const testers = new Set((opts.testerUsernames ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean));
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
  const waitMs = (sp: (typeof SPECIALTIES)[string], regionId: string, now: number, harvests: number, fx: GrowFx = growFx()) =>
    Math.max(1000, Math.round((stepWaitMs(sp, timeScale) * fx.weather(weatherOf(regionId, now).growth) * fx.waitMult) / paceOf(harvests)));
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
  /** Cộng điểm kinh nghiệm; trả về cấp sau khi cộng và có lên cấp không. */
  async function addXp(q: Q, userId: number, n0: number, source: XpSource = 'khac') {
    // ghi sổ EXP theo nguồn và áp trần mỗi ngày của nguồn đó
    const n = await logXp(q, userId, source, n0);
    const { rows } = await q.query('update users set xp = xp + $2 where id = $1 returning xp', [userId, n]);
    const after = levelOf(rows[0].xp), before = levelOf(rows[0].xp - n);
    return { xpGained: n, xp: after.xp, level: after.level, title: after.title, levelUp: after.level > before.level };
  }
  const regenMs = (ENERGY_REGEN_MINUTES * 60_000) / timeScale;
  /** Thể lực hiện có (đã cộng phần hồi theo thời gian) và mốc tính hồi tiếp theo. */
  async function energyState(q: Q, userId: number, lock = false) {
    const { rows } = await q.query(`select xp, energy, energy_at from users where id = $1${lock ? ' for update' : ''}`, [userId]);
    const now = Date.now(), atMs = new Date(rows[0].energy_at).getTime();
    const max = levelPerks(levelOf(rows[0].xp).level).energyMax;
    const cur = energyAt(rows[0].energy, atMs, now, max, timeScale);
    // mốc mới: giữ lại phần thời gian lẻ đã trôi để không mất công hồi dở
    const baseMs = cur >= max ? now : Math.min(now, atMs + Math.max(0, cur - Math.max(0, rows[0].energy)) * regenMs);
    return { cur, max, baseMs, now };
  }
  type Energy = Awaited<ReturnType<typeof energyState>>;
  const energyOut = (e: Energy, cur = e.cur) => ({ energy: cur, energyMax: e.max, energyFullAt: cur >= e.max ? null : Math.round(e.baseMs + (e.max - cur) * regenMs) });
  async function setEnergy(q: Q, userId: number, e: Energy, value: number) {
    const v = Math.max(0, Math.min(e.max, Math.round(value)));
    await q.query('update users set energy = $2, energy_at = $3 where id = $1', [userId, v, new Date(v >= e.max ? e.now : e.baseMs)]);
    return energyOut(e, v);
  }
  /** Trừ thể lực cho một việc tốn sức; không đủ thì từ chối với lời gợi ý ăn uống, nghỉ ngơi. */
  async function spendEnergy(q: Q, userId: number, cost: number, what: string) {
    const e = await energyState(q, userId, true);
    if (e.cur < cost) throw bad('het_suc', `Bạn đã hết sức để ${what} (cần ${cost} thể lực, đang có ${e.cur}). Hãy ăn uống ở tiệm tạp hoá hay quầy hàng, hoặc nghỉ một lúc cho hồi sức.`, 409);
    return setEnergy(q, userId, e, e.cur - cost);
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
    await addXp(q, userId, xpFor('tem'), 'tem');
    const regionId = SPECIALTIES[specialtyId].regionId;
    const ids = specialtiesOfRegion(regionId).map((sp) => sp.id);
    const have = await q.query('select count(*)::int as n from collection where user_id = $1 and specialty_id = any($2::text[])', [userId, ids]);
    if (have.rows[0].n < ids.length) return;
    const rw = await q.query('insert into collection_rewards (user_id, region_id) values ($1,$2) on conflict do nothing', [userId, regionId]);
    if (rw.rowCount) { await addCash(q, userId, REGION_SET_REWARD, `bo_suu_tap:${regionId}`); await addXp(q, userId, xpFor('bo_tem'), 'bo_tem'); }
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
      if (testers.has(username)) await q.query('update users set is_tester = true where id = $1', [rows[0].id]);
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
    if (testers.has(username)) await db.query('update users set is_tester = true where id = $1 and not is_tester', [rows[0].id]);
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
    const exportPaid = await db.tx((q) => settleExports(q, userId));
    const [u, plots, inv, coop, bag, en] = await Promise.all([
      db.query('select id, username, display_name, cash, home_region_id, role, role_assigned_at, truck_region, tour_region, avatar, harvests, is_tester, fuel_l, etc, xp, (select count(*)::int from sight_visits sv where sv.user_id = users.id and sv.done_at is not null) as sights_done from users where id = $1', [userId]),
      db.query('select id, region_id, is_home, kind, ward_name from plots where user_id = $1 order by is_home desc, id', [userId]),
      db.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > 0 order by specialty_id, quality', [userId]),
      db.query('select coop_id from coop_members where user_id = $1', [userId]),
      db.query('select item_id, qty from user_items where user_id = $1 and qty > 0 order by item_id', [userId]),
      energyState(db, userId),
    ]);
    const user = u.rows[0], lv = levelOf(user.xp);
    const vehMe = await veh.meOut(db, userId), equipped = await shopping.equippedOf(db, userId);
    return {
      user: {
        ...vehMe, equipped,
        id: user.id, username: user.username, displayName: user.display_name, cash: user.cash, homeRegionId: user.home_region_id,
        homeKind: plots.rows.find((p) => p.is_home)?.kind ?? null, coopId: coop.rows[0]?.coop_id ?? null, role: user.role ?? null,
        roleNextSpinAt: user.role && user.role_assigned_at ? new Date(user.role_assigned_at).getTime() + SEASON_MS : null,
        truckRegionId: user.truck_region ?? user.home_region_id ?? null, fuelL: Number(user.fuel_l), etc: user.etc, avatar: avatarOut(user.avatar),
        harvests: user.harvests, tester: !!user.is_tester, tourRegionId: user.tour_region ?? null, sightsDone: user.sights_done,
        xp: lv.xp, level: lv.level, title: lv.title, nextXp: lv.nextXp, prevXp: lv.prevXp, ...energyOut(en),
      },
      items: bag.rows.filter((r) => ITEMS[r.item_id]).map((r) => ({ itemId: r.item_id, qty: r.qty })),
      plots: plots.rows.map((p) => ({ id: p.id, regionId: p.region_id, isHome: p.is_home, kind: p.kind, wardName: p.ward_name })),
      inventory: inv.rows.map((i) => ({ specialtyId: i.specialty_id, quality: i.quality, kg: i.kg })),
      config: { timeScale, now: Date.now(), pace: paceOf(user.harvests) },
      walkin,
      ...(exportPaid.length ? { exportPaid } : {}),
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
      await ensureStarter(q, userId);
      const xp = await addXp(q, userId, xpFor('quay_vai'), 'quay_vai');
      return { role, weights, nextSpinAt: now + SEASON_MS, ...xp };
    });
  });

  app.post('/api/plots/buy', async (req) => {
    const userId = await requireUser(req);
    const r = findRegion(String((req.body as any)?.regionId ?? ''));
    if (!r) throw bad('du_lieu_sai', 'Vùng trồng không tồn tại.');
    return db.tx(async (q) => {
      const { rows } = await q.query('select cash, home_region_id from users where id = $1 for update', [userId]);
      if (!rows[0].home_region_id) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      const price = landPrice(r.id), fees = landFees(price);
      if (rows[0].cash < price + fees.total) throw bad('khong_du_tien', `Bạn chưa đủ tiền mua đất (giá đất cộng lệ phí trước bạ và phí cấp giấy là ${(price + fees.total).toLocaleString('vi-VN')}đ).`, 409);
      const cell = snapCell(r.lat, r.lng);
      const plot = await q.query(
        `insert into plots (user_id, region_id, cell_lat, cell_lng, price_paid, fees_paid) values ($1,$2,$3,$4,$5,$6)
         on conflict (user_id, region_id) do nothing returning id`, [userId, r.id, cell.lat, cell.lng, price, fees.total]);
      if (!plot.rows[0]) throw bad('da_co_dat', 'Bạn đã có đất ở vùng này.', 409);
      await addCash(q, userId, -price, `mua_dat:${r.id}`);
      await addCash(q, userId, -fees.registration, `le_phi_truoc_ba:${r.id}`);
      await addCash(q, userId, -fees.certificate, `phi_cap_giay:${r.id}`);
      const xp = await addXp(q, userId, XP.land, 'mua_dat');
      return { plotId: plot.rows[0].id, price, fees, total: price + fees.total, certificateNo: certNo(Number(plot.rows[0].id), r.id), ...xp };
    });
  });

  app.get('/api/plots/:id', async (req) => {
    const userId = await requireUser(req);
    const plotId = idParam((req.params as any).id);
    const { rows } = await db.query(
      `select p.id, p.user_id, p.region_id, p.is_home, p.kind, p.ward_name, p.ward_province, p.style, p.decor, p.upgrades, u.display_name, u.role as owner_role, u.avatar as owner_avatar
       from plots p join users u on u.id = p.user_id where p.id = $1`, [plotId]);
    const p = rows[0];
    if (!p) throw bad('khong_tim_thay', 'Không tìm thấy lô đất.', 404);
    if (p.owner_role === 'xuong' && p.is_home) await db.tx((q) => ensureStarter(q, Number(p.user_id)));
    const [tiles, stall, mach] = await Promise.all([
      db.query('select id, tile, specialty_id, step_index, step_ready_at, late_count, trait from plantings where plot_id = $1 order by tile', [plotId]),
      db.query(`select id, specialty_id, quality, kg, price from listings where seller_id = $1 and status = 'open' order by id desc limit 50`, [p.user_id]),
      p.owner_role === 'xuong' && p.is_home ? machinesOf(db, Number(p.user_id)) : Promise.resolve(null),
    ]);
    return {
      ...(mach ? { factory: { machines: mach.map((m) => ({ id: m.id, kind: m.kind, name: m.name, emoji: m.emoji, level: m.level, slots: m.slots, busy: m.jobs.length, support: m.support })) } } : {}),
      plot: {
        id: p.id, regionId: p.region_id, isHome: p.is_home, kind: p.kind, wardName: p.ward_name, wardProvince: p.ward_province, ownerName: p.display_name, mine: p.user_id === userId,
        ownerRole: p.owner_role ?? null, style: styleOut(p.style), decor: decorOut(p.decor), ownerAvatar: avatarOut(p.owner_avatar), upgrades: cleanUpgrades(p.upgrades),
        ...(p.user_id === userId ? { ownedHouses: ownedOut(p.style) } : {}),
      },
      plantings: tiles.rows.map((t) => ({
        id: t.id, tile: t.tile, specialtyId: t.specialty_id, stepIndex: t.step_index,
        stepReadyAt: new Date(t.step_ready_at).getTime(), lateCount: t.late_count, trait: isSeedTrait(t.trait) ? t.trait : null,
      })),
      stall: stall.rows.map((l) => ({ id: l.id, specialtyId: l.specialty_id, quality: l.quality, kg: l.kg, price: l.price })),
      now: Date.now(),
    };
  });

  /** Số vào sổ cấp giấy chứng nhận: ổn định theo mã thửa. */
  const certNo = (plotId: number, regionId: string) => `CN ${String(plotId).padStart(6, '0')}/${regionId.split('_')[0].toUpperCase()}`;
  app.get('/api/plots/:id/certificate', async (req) => {
    const userId = await requireUser(req);
    const plotId = idParam((req.params as any).id);
    const { rows } = await db.query(
      `select p.id, p.user_id, p.region_id, p.is_home, p.kind, p.ward_name, p.ward_province, p.created_at, p.price_paid, p.fees_paid, u.display_name, u.role
       from plots p join users u on u.id = p.user_id where p.id = $1 and p.user_id = $2`, [plotId, userId]);
    const p = rows[0];
    if (!p) throw bad('khong_tim_thay', 'Không tìm thấy lô đất của bạn.', 404);
    const r = REGIONS[p.region_id];
    const factory = p.is_home && p.role === 'xuong', rooftop = p.kind === 'rooftop';
    const perennial = specialtiesOfRegion(p.region_id).some((sp) => ['trai', 'cn'].includes(CROPS[sp.crop].kind));
    const price = p.is_home ? 0 : Number(p.price_paid ?? landPrice(p.region_id));
    const fees = p.is_home ? { registration: 0, certificate: 0, total: 0 } : landFees(price);
    return {
      title: LAND_CERT_NAME, no: certNo(Number(p.id), p.region_id), plotId: Number(p.id), owner: p.display_name,
      province: p.ward_province ?? r.province, ward: p.ward_name ?? null, regionId: p.region_id, regionName: r.name,
      tiles: rooftop ? 12 : TILE_COUNT, areaM2: (rooftop ? 12 : TILE_COUNT) * 25,
      purpose: factory ? 'Đất cơ sở sản xuất phi nông nghiệp' : rooftop ? 'Đất ở tại đô thị (vườn sân thượng)' : perennial ? 'Đất trồng cây lâu năm' : 'Đất trồng cây hằng năm',
      term: rooftop ? 'Lâu dài' : '50 năm', expiresAt: rooftop ? null : new Date(p.created_at).getTime() + 50 * 365.25 * DAY_MS,
      issuedAt: new Date(p.created_at).getTime(),
      origin: p.is_home ? 'Nhà nước giao đất không thu tiền sử dụng đất' : 'Nhận chuyển nhượng quyền sử dụng đất',
      price, fees, issuer: `Văn phòng đăng ký đất đai ${r.province}`,
      note: 'Theo Luật Đất đai 2024: đất nông nghiệp giao cho cá nhân có thời hạn 50 năm, hết hạn được tiếp tục sử dụng. Trong game đã đơn giản hoá: không có hạn mức, thuế sử dụng đất hay thủ tục công chứng.',
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
      const u = await q.query('select cash, role, harvests from users where id = $1 for update', [userId]);
      const p = await q.query('select region_id, kind, upgrades from plots where id = $1 and user_id = $2', [plotId, userId]);
      if (!p.rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy lô đất của bạn.', 404);
      if (!u.rows[0].role) throw bad('chua_co_vai', 'Hãy quay vòng quay để nhận vai trò trước khi trồng.', 409);
      if (u.rows[0].role === 'xuong') throw bad('xuong_khong_trong', 'Chủ xưởng không trồng trọt: lô đất của bạn là nhà xưởng. Hãy mua nông sản ở sạp, chợ hoặc siêu thị về chế biến.', 409);
      if (!allowedTiles(p.rows[0].kind, u.rows[0].role).includes(tile)) {
        throw bad('o_bi_khoa', u.rows[0].role === 'nong_dan' ? 'Vườn sân thượng chỉ trồng được 12 ô ở giữa.' : 'Vai trò của bạn chỉ có vườn nhỏ 8 ô ở giữa.', 409);
      }
      if (p.rows[0].region_id !== sp.regionId) throw bad('sai_vung', `${sp.name} chỉ trồng được ở ${REGIONS[sp.regionId].name}.`, 409);
      // trồng bằng gói giống lai (kết quả lai tạo giống) thì không tốn tiền giống
      const trait = isSeedTrait(b.seed) ? b.seed : null;
      if (b.seed !== undefined && b.seed !== null && !trait) throw bad('du_lieu_sai', 'Loại giống lai không tồn tại.');
      const cost = trait ? 0 : seedCost(sp);
      if (u.rows[0].cash < cost) throw bad('khong_du_tien', 'Bạn không đủ tiền mua giống.', 409);
      const ready = new Date(Date.now() + waitMs(sp, sp.regionId, Date.now(), u.rows[0].harvests, growFx(p.rows[0].upgrades, trait)));
      const ins = await q.query(
        `insert into plantings (plot_id, tile, specialty_id, step_index, step_ready_at, trait) values ($1,$2,$3,1,$4,$5)
         on conflict (plot_id, tile) do nothing returning id`, [plotId, tile, sp.id, ready, trait]);
      if (!ins.rows[0]) throw bad('o_da_trong', 'Ô đất này đang có cây.', 409);
      if (trait && !(await useSeed(q, userId, sp.id, trait))) throw bad('het_giong', 'Bạn không còn gói giống lai này.', 409);
      const en = await spendEnergy(q, userId, ENERGY_COST.plant, 'trồng cây');
      if (cost > 0) await addCash(q, userId, -cost, `giong:${sp.id}`);
      const xp = await addXp(q, userId, xpFor('trong'), 'trong');
      return { plantingId: ins.rows[0].id, cost, trait, ...en, ...xp };
    });
  });

  app.post('/api/plantings/:id/step', async (req) => {
    const userId = await requireUser(req);
    const plantingId = idParam((req.params as any).id);
    return db.tx(async (q) => {
      const { rows } = await q.query(
        `select g.id, g.specialty_id, g.step_index, g.step_ready_at, g.late_count, g.trait, p.upgrades, p.region_id, u.harvests
         from plantings g join plots p on p.id = g.plot_id join users u on u.id = p.user_id
         where g.id = $1 and p.user_id = $2 for update of g`, [plantingId, userId]);
      const g = rows[0];
      if (!g) throw bad('khong_tim_thay', 'Không tìm thấy cây trồng.', 404);
      const sp = SPECIALTIES[g.specialty_id];
      const now = Date.now();
      const readyAt = new Date(g.step_ready_at).getTime();
      if (now < readyAt) throw bad('chua_den_luc', 'Chưa đến lúc làm bước này.', 409);
      const fx = growFx(g.upgrades, g.trait);
      const late = g.late_count + (now > readyAt + lateGraceMs * fx.graceMult ? 1 : 0);
      if (g.step_index >= stepCount(sp) - 1) {
        const en = await spendEnergy(q, userId, ENERGY_COST.harvest, 'thu hoạch');
        const ql = fx.forceA ? 'A' : qualityFromLate(late);
        const h0 = harvestKg(sp.crop, now), h = { ...h0, kg: Math.round(h0.kg * fx.yieldMult) };
        await q.query('delete from plantings where id = $1', [plantingId]);
        await addInventory(q, userId, sp.id, ql, h.kg);
        await collect(q, userId, sp.id);
        await q.query('update users set harvests = harvests + 1 where id = $1', [userId]);
        const xp = await addXp(q, userId, XP.harvest, 'thu_hoach');
        return { harvested: { specialtyId: sp.id, quality: ql, kg: h.kg, inSeason: h.inSeason }, ...en, ...xp };
      }
      const en = await spendEnergy(q, userId, ENERGY_COST.care, 'chăm cây');
      const next = new Date(now + waitMs(sp, g.region_id, now, g.harvests, fx));
      await q.query('update plantings set step_index = step_index + 1, step_ready_at = $2, late_count = $3 where id = $1', [plantingId, next, late]);
      const xp = await addXp(q, userId, xpFor('cham'), 'cham');
      return { stepIndex: g.step_index + 1, stepReadyAt: next.getTime(), lateCount: late, ...en, ...xp };
    });
  });

  app.post('/api/plantings/:id/help', async (req) => {
    const userId = await requireUser(req);
    const plantingId = idParam((req.params as any).id);
    return db.tx(async (q) => {
      const { rows } = await q.query(
        `select g.id, g.specialty_id, g.step_index, g.step_ready_at, g.late_count, p.region_id, p.user_id as owner_id, u.harvests
         from plantings g join plots p on p.id = g.plot_id join users u on u.id = p.user_id
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
      await spendEnergy(q, userId, ENERGY_COST.help, 'chăm giúp');
      await addXp(q, userId, XP.help, 'giup');
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
        await q.query('update users set harvests = harvests + 1 where id = $1', [g.owner_id]);
        await q.query('insert into ledger (user_id, delta, reason) values ($1,0,$2)', [userId, `cham_giup:${plantingId}`]);
        return { harvested: { specialtyId: sp.id, quality: ql, kg: h.kg, share, inSeason: h.inSeason } };
      }
      const next = new Date(now + waitMs(sp, g.region_id, now, g.harvests));
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
      await addXp(q, userId, xpFor('ket_ban'), 'ket_ban');
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
      // Vai khác tự lái xe chở hàng tới vùng khác thì cũng bán được giá tại nơi xe đỗ như thương lái.
      const drove = !!u.rows[0].truck_region && u.rows[0].truck_region !== u.rows[0].home_region_id;
      if (u.rows[0].role !== 'thuong_lai' && !drove) {
        // Không phải thương lái: chỉ bán tháo được, giá thấp và không có thưởng nào.
        const unit = Math.round((ref * DUMP_RATIO * QUALITY_MULT[ql]) / 100) * 100;
        await q.query('insert into npc_sales (user_id, specialty_id, kg) values ($1,$2,$3)', [userId, sp.id, kg]);
        await addCash(q, userId, unit * kg, `ban_thao:${sp.id}`);
        const xp = await addXp(q, userId, xpFor('ban_dn', unit * kg), 'ban_dn');
        return { unitPrice: unit, total: unit * kg, mods: {}, npcId: npcOf('thuong_lai').id, dump: true, ...xp };
      }
      // Thương lái bán tại nơi xe đang đỗ: hàng của vùng đó là giá tại vườn, hàng vùng khác là hàng phương xa.
      const market: string = u.rows[0].truck_region ?? u.rows[0].home_region_id;
      const mods = await priceMods(q, userId, sp.id, now, market, u.rows[0].home_region_id);
      // Bán số lượng lớn một lúc: chợ vùng chỉ tiêu thụ được có hạn nên giá trung bình rớt dần theo lượng đã xả trong 24 giờ.
      await q.query('select pg_advisory_xact_lock(hashtext($1))', [`cho:${market}:${sp.id}`]);
      const soldHere = await soldAt(q, market, sp.id);
      const bulk = bulkSellFactor(soldHere, kg), base = npcPrice(ref, ql, sp.regionId, market, mods);
      const unit = Math.round((base * bulk) / 100) * 100;
      await q.query('insert into npc_sales (user_id, specialty_id, kg, market_region) values ($1,$2,$3,$4)', [userId, sp.id, kg, market]);
      await addCash(q, userId, unit * kg, `ban_thuong_lai:${sp.id}`);
      const xp = await addXp(q, userId, xpFor('ban_dn', unit * kg), 'ban_dn');
      return { unitPrice: unit, total: unit * kg, mods, npcId: npcOf('thuong_lai').id, dump: false, marketRegionId: market, basePrice: base, bulkFactor: Math.round(bulk * 1000) / 1000, soldHere24hKg: soldHere + kg, ...xp };
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
      const xp = await addXp(q, userId, xpFor('bay_sap'), 'bay_sap');
      return { listingId: ins.rows[0].id, ...xp };
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
      await addXp(q, l.seller_id, xpFor('ban_sap', total), 'ban_sap');
      const xp = await addXp(q, userId, xpFor('mua_sap', total), 'mua_sap');
      return { total, ...xp };
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
  /** Đường và thị trường xuất khẩu của một đơn lớn; đơn cũ chưa ghi thì suy ra theo mã đơn. */
  const orderRoute = (o: any): { exportMode: ExportMode; market: ExportMarket } =>
    o.export_mode && o.market && EXPORT_MODES[o.export_mode as ExportMode] && EXPORT_MARKETS[o.market as ExportMarket]
      ? { exportMode: o.export_mode, market: o.market } : coopOrderRoute(Number(o.id), o.kg_target);
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
      const xp = await addXp(q, userId, xpFor('htx_lap'), 'htx_lap');
      return { coopId: ins.rows[0].id, ...xp };
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
        const route = coopOrderRoute(Number(o.id), o.kg_target);
        await q.query('update coop_orders set export_mode = $2, market = $3 where id = $1', [o.id, route.exportMode, route.market]);
        o.export_mode = route.exportMode; o.market = route.market;
      }
      const mine = await q.query('select kg from coop_contribs where order_id = $1 and user_id = $2', [o.id, userId]);
      return {
        id: o.id, specialtyId: o.specialty_id, npcId: o.npc_id, kgTarget: o.kg_target, kgFilled: o.kg_filled,
        expiresAt: new Date(o.expires_at).getTime(), mine: mine.rows[0]?.kg ?? 0, ...orderRoute(o),
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
      const xp = await addXp(q, userId, xpFor('htx_gop', value), 'htx_gop');
      return { paid: value, completed, ...orderRoute(o), ...xp };
    });
  });

  /** Rời hợp tác xã đang ở; chủ rời thì chuyển quyền, không còn ai thì xoá. Trả vùng của HTX vừa rời, hoặc null nếu không ở HTX nào. */
  async function leaveCoop(q: Q, userId: number): Promise<string | null> {
    const { rows } = await q.query('select coop_id from coop_members where user_id = $1', [userId]);
    if (!rows[0]) return null;
    const coopId = rows[0].coop_id;
    const coop = await q.query('select owner_id, region_id from coops where id = $1 for update', [coopId]);
    await q.query('delete from coop_members where user_id = $1', [userId]);
    if (coop.rows[0].owner_id === userId) {
      const next = await q.query('select user_id from coop_members where coop_id = $1 order by joined_at, user_id limit 1', [coopId]);
      if (next.rows[0]) await q.query('update coops set owner_id = $2 where id = $1', [coopId, next.rows[0].user_id]);
      else await q.query('delete from coops where id = $1', [coopId]);
    }
    return coop.rows[0].region_id;
  }

  app.post('/api/coops/leave', async (req) => {
    const userId = await requireUser(req);
    return db.tx(async (q) => {
      if (!(await leaveCoop(q, userId))) throw bad('chua_co_htx', 'Bạn chưa ở trong hợp tác xã nào.', 409);
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
      const xp = await addXp(q, userId, xpFor('htx_vao'), 'htx_vao');
      return { ok: true, ...xp };
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
    const body = (req.body ?? {}) as Record<string, unknown>;
    const r = findRegion(String(body.regionId ?? ''));
    if (!r) throw bad('du_lieu_sai', 'Vùng trồng không tồn tại.');
    return db.tx(async (q) => {
      const u = await q.query('select cash, home_region_id from users where id = $1 for update', [userId]);
      const home = u.rows[0].home_region_id as string | null;
      if (!home) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước khi đi du lịch.', 409);
      if (home === r.id) throw bad('du_lieu_sai', 'Bạn đang ở vùng này rồi.');
      const options = travelOptions(home, r.id);
      const option = body.mode === undefined ? options[0] : options.find((o) => o.mode === body.mode);
      if (!option) throw bad('phuong_tien_sai', 'Không có phương tiện này cho chuyến đi bạn chọn.');
      if (u.rows[0].cash < option.fare) throw bad('khong_du_tien', 'Bạn không đủ tiền mua vé.', 409);
      const been = await hasBeenTo(q, userId, r.id);
      await q.query('insert into visits (user_id, region_id) values ($1,$2) on conflict do nothing', [userId, r.id]);
      await addCash(q, userId, -option.fare, `ve:${option.mode}:${r.id}`);
      await q.query('update users set tour_region = $2 where id = $1', [userId, r.id]);
      const isNew = !been.owns && !been.visited;
      const xp = isNew ? await addXp(q, userId, XP.region, 'vung_moi') : null;
      return { cost: option.fare, isNew, mode: option.mode, ...(xp ?? {}) };
    });
  });
  /** Về nhà sau chuyến tham quan bằng vé: người chơi không còn "đang ở" vùng kia nữa. */
  app.post('/api/travel/home', async (req) => {
    const userId = await requireUser(req);
    await db.query('update users set tour_region = null where id = $1', [userId]);
    return { ok: true };
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
      const xp = await addXp(q, userId, xpFor('qua_luu_niem'), 'qua_luu_niem');
      return { unitPrice: unit, total: unit * kg, ...xp };
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
      const xp = await addXp(q, userId, xpFor('qua'), 'qua');
      return { giftId: ins.rows[0].id, ...xp };
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
  /** Tên thành phẩm: đặc sản kèm cách chế biến. */
  const productName = (specialtyId: string) => `${SPECIALTIES[specialtyId].name} (${recipeOf(CROPS[SPECIALTIES[specialtyId].crop]).name.toLowerCase()})`;
  /** Giá tham chiếu một kg thành phẩm = giá nông sản hiện hành × hệ số giá trị của công thức. */
  const productRef = async (q: Q, specialtyId: string) => Math.round(((await currentPrice(q, specialtyId)) * recipeOf(CROPS[SPECIALTIES[specialtyId].crop]).value) / 100) * 100;
  const isMachine = (k: unknown): k is MachineKind => typeof k === 'string' && Object.hasOwn(MACHINES, k);
  /** Xưởng mới (hoặc xưởng có từ trước khi có máy) được cấp sẵn một máy hợp với đặc sản vùng nhà. */
  async function ensureStarter(q: Q, userId: number) {
    const u = await q.query('select role, home_region_id from users where id = $1 for update', [userId]);
    if (u.rows[0]?.role !== 'xuong' || !u.rows[0].home_region_id) return;
    const has = await q.query('select 1 from machines where user_id = $1 limit 1', [userId]);
    if (!has.rows[0]) await q.query('insert into machines (user_id, kind) values ($1,$2)', [userId, starterMachine(u.rows[0].home_region_id)]);
  }
  /** Các máy của một xưởng kèm mẻ đang chạy trên từng máy. Mẻ cũ chưa gắn máy được xếp vào máy chế biến đầu tiên. */
  async function machinesOf(q: Q, userId: number) {
    const [m, j] = await Promise.all([
      q.query('select id, kind, level, origin from machines where user_id = $1 order by id', [userId]),
      q.query('select id, machine_id, specialty_id, kg_in, kg_out, ready_at from process_jobs where user_id = $1 order by id', [userId]),
    ]);
    const list = m.rows.filter((r) => isMachine(r.kind)).map((r) => {
      const kind = r.kind as MachineKind, info = MACHINES[kind], st = machineStats(kind, r.level);
      return applyImport({ id: Number(r.id), kind, name: info.name, emoji: info.emoji, level: r.level as number, slots: st.slots, time: st.time, recipes: info.recipes, support: info.slots === 0, batchKg: machineBatchKg(r.level, !!r.origin),
        bonus: info.bonus ?? null, upgradeCost: r.level < MACHINE_MAX_LEVEL ? machineUpgradeCost(kind, r.level) : null, jobs: [] as ReturnType<typeof jobOut>[] }, r.origin);
    });
    const orphan: ReturnType<typeof jobOut>[] = [];
    for (const r of j.rows) {
      if (!SPECIALTIES[r.specialty_id]) continue;
      const host = list.find((x) => x.id === Number(r.machine_id));
      (host ? host.jobs : orphan).push(jobOut(r));
    }
    return Object.assign(list, { orphan });
  }
  const jobOut = (j: any) => ({ id: Number(j.id), machineId: j.machine_id === null || j.machine_id === undefined ? null : Number(j.machine_id), specialtyId: j.specialty_id as string,
    recipeId: recipeOf(CROPS[SPECIALTIES[j.specialty_id].crop]).id, kgIn: j.kg_in as number, kgOut: j.kg_out as number, readyAt: new Date(j.ready_at).getTime() });
  /** Cộng dồn tác dụng của các máy phụ trợ (mỗi loại chỉ tính một lần). */
  function workshopBonus(machines: { kind: MachineKind }[]) {
    const kinds = new Set(machines.map((m) => m.kind));
    let y = 0, v = 0, g = 0;
    for (const k of kinds) { const bn = MACHINES[k].bonus; if (bn) { y += bn.yield ?? 0; v += bn.value ?? 0; g = Math.max(g, bn.grade ?? 0); } }
    return { yield: y, value: v, grade: g };
  }
  const valueBonusOf = async (q: Q, userId: number) => workshopBonus((await q.query('select kind from machines where user_id = $1', [userId])).rows.filter((r) => isMachine(r.kind)) as { kind: MachineKind }[]).value;
  const RECIPE_LIST = [...new Map(Object.values(CROPS).map((c) => [recipeOf(c).id, recipeOf(c)])).values()];

  app.get('/api/workshop', async (req) => {
    const userId = await requireUser(req);
    await db.tx((q) => ensureStarter(q, userId));
    const [u, machines, products, inv] = await Promise.all([
      db.query('select role, cash from users where id = $1', [userId]),
      machinesOf(db, userId),
      db.query('select specialty_id, kg from products where user_id = $1 and kg > 0 order by specialty_id', [userId]),
      db.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > 0 order by specialty_id, quality', [userId]),
    ]);
    const isXuong = u.rows[0].role === 'xuong';
    const bonus = workshopBonus(machines);
    const jobs = [...machines.flatMap((m) => m.jobs), ...machines.orphan].sort((x, y) => x.id - y.id);
    const outProducts = [];
    for (const p of products.rows) {
      if (!SPECIALTIES[p.specialty_id]) continue;
      const r = recipeOf(CROPS[SPECIALTIES[p.specialty_id].crop]);
      outProducts.push({ specialtyId: p.specialty_id as string, kg: p.kg as number, name: productName(p.specialty_id), recipeId: r.id, refPrice: await productRef(db, p.specialty_id) });
    }
    const count = (k: MachineKind) => machines.filter((m) => m.kind === k).length;
    return {
      slots: isXuong ? machines.reduce((sum, m) => sum + m.slots, 0) : 0,
      jobs,
      products: outProducts.map((p) => ({ specialtyId: p.specialtyId, kg: p.kg })),
      productInfo: outProducts,
      isWorkshop: isXuong,
      machines: isXuong ? machines.map((m) => ({ ...m })) : [],
      catalog: (Object.keys(MACHINES) as MachineKind[]).map((kind) => ({ kind, ...MACHINES[kind], owned: count(kind),
        canBuy: isXuong && machines.length < WORKSHOP_MAX_MACHINES && count(kind) < (MACHINES[kind].slots ? WORKSHOP_MAX_PER_KIND : 1) && Number(u.rows[0].cash) >= MACHINES[kind].price })),
      recipes: RECIPE_LIST.map((r) => ({ ...r, machines: machinesForRecipe(r.id) })),
      stock: inv.rows.filter((i) => SPECIALTIES[i.specialty_id]).map((i) => {
        const r = recipeOf(CROPS[SPECIALTIES[i.specialty_id].crop]), kinds = machinesForRecipe(r.id);
        return { specialtyId: i.specialty_id as string, quality: i.quality as Quality, kg: i.kg as number, recipeId: r.id, machineKinds: kinds, canProcess: isXuong && machines.some((m) => kinds.includes(m.kind)) };
      }),
      bonus, runFeePerKg: WORKSHOP_RUN_FEE_PER_KG, energyCost: ENERGY_COST.process, maxMachines: WORKSHOP_MAX_MACHINES, maxPerKind: WORKSHOP_MAX_PER_KIND, maxLevel: MACHINE_MAX_LEVEL,
      limits: { machines: LIMIT_REASONS.workshop_machines, tiles: LIMIT_REASONS.tiles_xuong },
    };
  });

  app.post('/api/workshop/machines/buy', async (req) => {
    const userId = await requireUser(req);
    const kind = ((req.body ?? {}) as Record<string, unknown>).kind;
    if (!isMachine(kind)) throw bad('du_lieu_sai', 'Loại máy không tồn tại.');
    return db.tx(async (q) => {
      await ensureStarter(q, userId);
      const u = await q.query('select role, cash from users where id = $1 for update', [userId]);
      if (u.rows[0].role !== 'xuong') throw bad('chi_chu_xuong', 'Chỉ chủ xưởng mới mua máy chế biến được.', 403);
      const have = await q.query('select kind from machines where user_id = $1', [userId]);
      const maxMachines = WORKSHOP_MAX_MACHINES + (await econ.branchSlots(q, userId));
      if (have.rows.length >= maxMachines) throw bad('het_cho_may', `Nhà xưởng chỉ đặt được ${maxMachines} máy; mở xưởng chi nhánh ở tỉnh khác để đặt thêm.`, 409);
      const cap = MACHINES[kind].slots ? WORKSHOP_MAX_PER_KIND : 1;
      if (have.rows.filter((r) => r.kind === kind).length >= cap) throw bad('du_may', MACHINES[kind].slots ? `Mỗi loại máy chế biến chỉ đặt được ${cap} cái; hãy nâng cấp máy đang có.` : 'Máy phụ trợ chỉ cần một cái.', 409);
      if (Number(u.rows[0].cash) < MACHINES[kind].price) throw bad('khong_du_tien', 'Bạn không đủ tiền mua máy.', 409);
      await addCash(q, userId, -MACHINES[kind].price, `mua_may:${kind}`);
      const ins = await q.query('insert into machines (user_id, kind) values ($1,$2) returning id', [userId, kind]);
      return { ok: true, machineId: Number(ins.rows[0].id), kind, price: MACHINES[kind].price, cash: Number(u.rows[0].cash) - MACHINES[kind].price, ...(await addXp(q, userId, xpFor('mua_may'), 'mua_may')) };
    });
  });

  app.post('/api/workshop/machines/:id/upgrade', async (req) => {
    const userId = await requireUser(req);
    const id = idParam((req.params as any).id);
    return db.tx(async (q) => {
      const u = await q.query('select role, cash from users where id = $1 for update', [userId]);
      if (u.rows[0].role !== 'xuong') throw bad('chi_chu_xuong', 'Chỉ chủ xưởng mới nâng cấp máy được.', 403);
      const m = await q.query('select kind, level from machines where id = $1 and user_id = $2 for update', [id, userId]);
      if (!m.rows[0] || !isMachine(m.rows[0].kind)) throw bad('khong_tim_thay', 'Không tìm thấy máy.', 404);
      const kind = m.rows[0].kind as MachineKind;
      if (!MACHINES[kind].slots) throw bad('khong_nang_duoc', 'Máy phụ trợ không có cấp nâng.', 409);
      if (m.rows[0].level >= MACHINE_MAX_LEVEL) throw bad('cap_toi_da', 'Máy đã ở cấp cao nhất.', 409);
      const cost = machineUpgradeCost(kind, m.rows[0].level);
      if (Number(u.rows[0].cash) < cost) throw bad('khong_du_tien', 'Bạn không đủ tiền nâng cấp máy.', 409);
      await addCash(q, userId, -cost, `nang_may:${kind}`);
      await q.query('update machines set level = level + 1 where id = $1', [id]);
      const xp = await addXp(q, userId, xpFor('nang_may'), 'nang_may');
      // `level` ở đây là cấp của máy; cấp nhân vật nằm ở playerLevel
      return { ...xp, playerLevel: xp.level, ok: true, machineId: id, level: m.rows[0].level + 1, cost, ...machineStats(kind, m.rows[0].level + 1), cash: Number(u.rows[0].cash) - cost };
    });
  });

  app.post('/api/workshop/start', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const ql = quality(b.quality ?? b.grade);
    const kg = int(b.kg, 1, 1_000_000, 'kg');
    return db.tx(async (q) => {
      await ensureStarter(q, userId);
      const u = await q.query('select role, cash from users where id = $1 for update', [userId]);
      if (u.rows[0].role !== 'xuong') throw bad('chi_chu_xuong', 'Chỉ chủ xưởng mới chế biến được. Hãy bán nông sản cho chủ xưởng qua sạp.', 403);
      const recipe = recipeOf(CROPS[sp.crop]);
      const machines = await machinesOf(q, userId);
      const able = machines.filter((m) => m.recipes.includes(recipe.id));
      if (!able.length) throw bad('thieu_may', `Xưởng chưa có máy làm "${recipe.name}". Cần mua ${machinesForRecipe(recipe.id).map((k) => MACHINES[k].name).join(' hoặc ')}.`, 409);
      let host = able.find((m) => m.jobs.length < m.slots);
      if (b.machineId !== undefined && b.machineId !== null) {
        const want = machines.find((m) => m.id === idParam(b.machineId));
        if (!want) throw bad('khong_tim_thay', 'Không tìm thấy máy.', 404);
        if (!want.recipes.includes(recipe.id)) throw bad('may_khong_hop', `${want.name} không làm được "${recipe.name}".`, 409);
        host = want.jobs.length < want.slots ? want : undefined;
      }
      if (!host) throw bad('het_cho', 'Máy đã kín mẻ, hãy nhận hàng xong rồi làm mẻ mới (hoặc nâng cấp, mua thêm máy).', 409);
      if (kg > host.batchKg) throw bad('qua_me', `${host.name} cấp ${host.level} chỉ nhận ${host.batchKg} kg mỗi mẻ; chia thành nhiều mẻ hoặc nâng cấp máy.`, 409);
      const bonus = workshopBonus(machines);
      // hàng loại thấp ra ít thành phẩm hơn; có kho lạnh thì thiệt ít đi
      const gradeMult = 1 - (1 - QUALITY_MULT[ql]) * (1 - bonus.grade);
      // Làm tròn xuống để chia nhỏ mẻ không được lợi; mẻ quá ít thì từ chối.
      const kgOut = Math.floor(kg * recipe.ratio * gradeMult * (1 + bonus.yield) * (1 + host.yieldBonus) + 1e-9);
      if (kgOut < 1) throw bad('qua_it', `Cần ít nhất ${Math.ceil(1 / (recipe.ratio * gradeMult * (1 + bonus.yield)))} kg để chế biến một mẻ.`, 409);
      const fee = WORKSHOP_RUN_FEE_PER_KG * kg;
      if (Number(u.rows[0].cash) < fee) throw bad('khong_du_tien', 'Bạn không đủ tiền điện và bảo trì cho mẻ này.', 409);
      await takeInventory(q, userId, sp.id, ql, kg);
      const en = await spendEnergy(q, userId, ENERGY_COST.process, 'đứng máy');
      await addCash(q, userId, -fee, `dien_bao_tri:${sp.id}`);
      const ms = ((recipe.hours * 3600_000) / timeScale) * host.time;
      const readyAt = new Date(Date.now() + Math.round(ms));
      const ins = await q.query(
        'insert into process_jobs (user_id, specialty_id, kg_in, kg_out, ready_at, machine_id) values ($1,$2,$3,$4,$5,$6) returning id', [userId, sp.id, kg, kgOut, readyAt, host.id]);
      const xp = await addXp(q, userId, xpFor('che_bien'), 'che_bien');
      return { jobId: ins.rows[0].id, machineId: host.id, recipeId: recipe.id, kgOut, fee, readyAt: readyAt.getTime(), ...en, ...xp };
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
      await addProduct(q, userId, j.specialty_id, j.kg_out);
      const xp = await addXp(q, userId, XP.process, 'lay_me');
      return { specialtyId: j.specialty_id, kg: j.kg_out, name: productName(j.specialty_id), ...xp };
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
      await takeProduct(q, userId, sp.id, kg);
      const now = Date.now();
      const bonus = (marketDayOf(now).active ? MARKET_DAY_BONUS : 0) + (floatingAt(u.rows[0].home_region_id, now) ? FLOATING_BONUS : 0);
      const pack = await valueBonusOf(q, userId);
      await q.query('select pg_advisory_xact_lock(hashtext($1))', [`che_bien:${sp.id}`]);
      const bulk = bulkSellFactor(await soldAt(q, 'che_bien', sp.id), kg);
      const unit = Math.round(((await currentPrice(q, sp.id)) * recipeOf(CROPS[sp.crop]).value * (1 + bonus) * (1 + pack) * bulk) / 100) * 100;
      await q.query('insert into npc_sales (user_id, specialty_id, kg, market_region) values ($1,$2,$3,$4)', [userId, sp.id, kg, 'che_bien']);
      await addCash(q, userId, unit * kg, `ban_che_bien:${sp.id}`);
      const xp = await addXp(q, userId, xpFor('ban_thanh_pham', unit * kg), 'ban_thanh_pham');
      return { unitPrice: unit, total: unit * kg, npcId: npcOf('che_bien').id, bulkFactor: Math.round(bulk * 1000) / 1000, ...xp };
    });
  });
  async function addProduct(q: Q, userId: number, specialtyId: string, kg: number) {
    await q.query(
      `insert into products (user_id, specialty_id, kg) values ($1,$2,$3)
       on conflict (user_id, specialty_id) do update set kg = products.kg + excluded.kg`, [userId, specialtyId, kg]);
  }
  async function takeProduct(q: Q, userId: number, specialtyId: string, kg: number) {
    const { rowCount } = await q.query('update products set kg = kg - $3 where user_id = $1 and specialty_id = $2 and kg >= $3', [userId, specialtyId, kg]);
    if (!rowCount) throw bad('khong_du_hang', 'Không đủ thành phẩm.', 409);
  }

  // ---------------------------------------------------------------- đơn hàng cá nhân theo ngày
  const vnDay = (now: number) => Math.floor((now + VN_TZ_MS) / DAY_MS);
  const dayString = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
  /** Bộ sinh số tất định theo chuỗi hạt giống, để đơn trong ngày của một người luôn như nhau. */
  function seeded(seed: string): () => number {
    let h = 2166136261;
    for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** Đơn trong ngày: ba đơn chung (khối lượng lớn dần theo cấp) và một đơn riêng theo vai. */
  const ORDER_SLOTS = ORDERS_PER_DAY + 1;
  type OrderItem = { specialtyId: string; kg: number; processed?: boolean };
  function ordersFor(userId: number, homeRegionId: string, day: number, level = 1, role: Role | null = null) {
    const pick = <T>(list: T[], r: () => number): T => list[Math.floor(r() * list.length)];
    const s = orderScale(level);
    const kg = (min: number, max: number, r: () => number) => Math.round((min + Math.floor(r() * (max - min + 1))) * s);
    const others = Object.keys(REGIONS).filter((id) => id !== homeRegionId).sort();
    const sameZone = others.filter((id) => REGIONS[id].zone === REGIONS[homeRegionId].zone);
    const home = specialtiesOfRegion(homeRegionId);
    const out: { slot: number; npcId: string; title: string; kind: string; items: OrderItem[] }[] = [];
    for (let slot = 0; slot < ORDER_SLOTS; slot++) {
      const r = seeded(`${userId}:${day}:${slot}`);
      if (slot === 0) out.push({ slot, npcId: npcOf('thuong_lai').id, title: ORDER_KIND_NAMES.thu_mua, kind: 'thu_mua', items: [{ specialtyId: pick(home, r).id, kg: kg(10, 30, r) }] });
      else if (slot === 1) {
        const other = pick(sameZone.length ? sameZone : others, r);
        out.push({ slot, npcId: npcOf('sieu_thi').id, title: ORDER_KIND_NAMES.qua_bieu, kind: 'qua_bieu', items: [
          { specialtyId: pick(home, r).id, kg: kg(5, 15, r) }, { specialtyId: pick(specialtiesOfRegion(other), r).id, kg: kg(5, 15, r) }] });
      } else if (slot === 2) {
        const a = pick(others, r), rest = others.filter((id) => id !== a), c = pick(rest, r);
        out.push({ slot, npcId: npcOf('sieu_thi').id, title: ORDER_KIND_NAMES.mam_ngu_qua, kind: 'mam_ngu_qua', items: [homeRegionId, a, c].map((regionId) => ({ specialtyId: pick(specialtiesOfRegion(regionId), r).id, kg: kg(3, 8, r) })) });
      } else if (role === 'xuong') {
        // đơn vừa cho xưởng: thành phẩm chế biến từ đặc sản cùng miền
        const region = pick([homeRegionId, ...sameZone], r);
        out.push({ slot, npcId: npcOf('che_bien').id, title: ORDER_KIND_NAMES.xuong, kind: 'xuong', items: [{ specialtyId: pick(specialtiesOfRegion(region), r).id, kg: kg(4, 10, r), processed: true }] });
      } else if (role === 'thuong_lai') {
        // đơn lớn cho thương lái: hàng vùng khác, phải đi gom bằng xe
        out.push({ slot, npcId: npcOf('thuong_lai').id, title: ORDER_KIND_NAMES.si_lon, kind: 'si_lon', items: [{ specialtyId: pick(specialtiesOfRegion(pick(others, r)), r).id, kg: kg(150, 300, r) }] });
      } else {
        out.push({ slot, npcId: npcOf('thuong_lai').id, title: 'Đơn thu mua lớn', kind: 'thu_mua', items: [{ specialtyId: pick(home, r).id, kg: kg(40, 80, r) }] });
      }
    }
    return out;
  }
  async function orderReward(q: Q, items: OrderItem[], level = 1): Promise<number> {
    let sum = 0;
    for (const it of items) sum += (it.processed ? await productRef(q, it.specialtyId) : await currentPrice(q, it.specialtyId)) * it.kg;
    return Math.round((sum * ORDER_PREMIUM_V2) / 1000) * 1000 + orderBonus(level);
  }
  /** Điểm kinh nghiệm của đơn: đơn riêng theo vai được gấp đôi, cấp cao thêm chút. */
  const orderXp = (slot: number, level: number) => (XP.order + Math.floor(level / 2)) * (slot >= ORDERS_PER_DAY ? 2 : 1);
  async function orderUser(q: Q, userId: number, lock = false) {
    const u = (await q.query(`select home_region_id, role, xp from users where id = $1${lock ? ' for update' : ''}`, [userId])).rows[0];
    return { home: (u.home_region_id ?? null) as string | null, role: (u.role ?? null) as Role | null, level: levelOf(Number(u.xp)).level };
  }

  app.get('/api/orders', async (req) => {
    const userId = await requireUser(req);
    const u = await orderUser(db, userId);
    const day = vnDay(Date.now());
    if (!u.home) return { orders: [], resetsAt: (day + 1) * DAY_MS - VN_TZ_MS };
    const done = await db.query('select slot from order_done where user_id = $1 and day = $2', [userId, dayString(day)]);
    const doneSlots = new Set(done.rows.map((r) => r.slot));
    const orders = [];
    for (const o of ordersFor(userId, u.home, day, u.level, u.role)) {
      const items = o.items.map((it) => ({ ...it, name: it.processed ? productName(it.specialtyId) : SPECIALTIES[it.specialtyId].name }));
      orders.push({ ...o, items, reward: await orderReward(db, o.items, u.level), bonus: orderBonus(u.level), xp: orderXp(o.slot, u.level), done: doneSlots.has(o.slot) });
    }
    return { orders, resetsAt: (day + 1) * DAY_MS - VN_TZ_MS, premium: ORDER_PREMIUM_V2, scale: orderScale(u.level) };
  });

  app.post('/api/orders/:slot/deliver', async (req) => {
    const userId = await requireUser(req);
    const slot = Number((req.params as any).slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= ORDER_SLOTS) throw bad('khong_tim_thay', 'Không tìm thấy đơn hàng.', 404);
    return db.tx(async (q) => {
      const u = await orderUser(q, userId, true);
      if (!u.home) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      const day = vnDay(Date.now());
      const order = ordersFor(userId, u.home, day, u.level, u.role)[slot];
      const mark = await q.query('insert into order_done (user_id, day, slot) values ($1,$2,$3) on conflict do nothing', [userId, dayString(day), slot]);
      if (!mark.rowCount) throw bad('da_giao', 'Đơn này hôm nay bạn đã giao rồi.', 409);
      for (const it of order.items) {
        if (it.processed) {
          const have = (await q.query('select kg from products where user_id = $1 and specialty_id = $2', [userId, it.specialtyId])).rows[0]?.kg ?? 0;
          if (have < it.kg) throw bad('khong_du_hang', `Kho chưa đủ ${it.kg} kg ${productName(it.specialtyId)}.`, 409);
          await takeProduct(q, userId, it.specialtyId, it.kg);
          continue;
        }
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
      const reward = await orderReward(q, order.items, u.level);
      await addCash(q, userId, reward, `don_hang:${slot}`);
      const xp = await addXp(q, userId, orderXp(slot, u.level), 'giao_don');
      return { reward, ...xp };
    });
  });

  // xe cộ, giấy phép lái xe, trạm dừng nghỉ và mua sắm nằm ở vehicles.ts, shopping.ts
  const veh = registerVehicles(app, { db, requireUser, requireTester: (r) => requireTester(r), bad, addCash, energyState, setEnergy, bagOf: (q, u) => bagOf(q, u), licenseTimeScale: opts.licenseTimeScale ?? 1, examHurry: opts.examHurry });
  const shopping = registerShopping(app, { db, requireUser, bad, addCash, provincesOf: async (q, u) => (await whereabouts(q, u)).provinces, licensesOf: veh.licensesOf });
  // lô xuất khẩu nhiều mặt hàng, công ty xuất nhập khẩu, siêu thị riêng và xưởng chi nhánh nằm ở economy.ts
  const econ = registerEconomy(app, { db, timeScale, requireUser, bad, addCash, addXp, addInventory, takeInventory, addProduct, takeProduct, currentPrice,
    productRef: (q, id) => productRef(q, id), exportContext: (q, u) => exportContext(q, u), shipmentOut: (r) => shipmentOut(r), provincesOf: async (q, u) => (await whereabouts(q, u)).provinces });

  // ---------------------------------------------------------------- chuyến xe của thương lái
  const round1 = (v: number) => Math.round(v * 10) / 10;
  function num(v: unknown, min: number, max: number): number {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  }

  /** Nạp tiền vào tài khoản thu phí không dừng (ETC) của xe tải. */
  app.post('/api/truck/etc', async (req) => {
    const userId = await requireUser(req);
    const amount = int((req.body as any)?.amount, 10_000, 5_000_000, 'amount');
    return db.tx(async (q) => {
      const u = await q.query('select cash, role, etc from users where id = $1 for update', [userId]);
      if (!(await veh.truck(q, userId)).has) throw bad('chua_co_xe', 'Bạn chưa có xe để nạp ETC. Hãy mua xe trước.', 403);
      if (u.rows[0].cash < amount) throw bad('khong_du_tien', 'Bạn không đủ tiền để nạp ETC.', 409);
      await addCash(q, userId, -amount, 'nap_etc');
      await q.query('update users set etc = etc + $2 where id = $1', [userId, amount]);
      return { etc: u.rows[0].etc + amount, cash: u.rows[0].cash - amount };
    });
  });

  /** Đổ xăng tại chỗ (xe đang đỗ): tối đa tới đầy bình. */
  app.post('/api/truck/refuel', async (req) => {
    const userId = await requireUser(req);
    const want = Number((req.body as any)?.liters);
    if (!Number.isFinite(want) || want <= 0) throw bad('du_lieu_sai', 'Số lít xăng không hợp lệ.');
    return db.tx(async (q) => {
      const u = await q.query('select cash, role, fuel_l from users where id = $1 for update', [userId]);
      const mine = await veh.truck(q, userId), tk = mine.tk;
      if (!mine.has) throw bad('chua_co_xe', 'Bạn chưa có xe để nạp nhiên liệu. Hãy mua xe trước.', 403);
      const have = Number(u.rows[0].fuel_l), room = round1(tk.tankL - have);
      if (room <= 0) throw bad('binh_day', tk.power === 'dien' ? 'Pin đã đầy.' : 'Bình xăng đã đầy.', 409);
      const liters = round1(Math.min(want, room)), cost = Math.round(liters * tk.parkPrice);
      if (u.rows[0].cash < cost) throw bad('khong_du_tien', 'Bạn không đủ tiền đổ xăng.', 409);
      if (cost > 0) await addCash(q, userId, -cost, 'do_xang');
      const fuelL = round1(have + liters);
      await q.query('update users set fuel_l = $2 where id = $1', [userId, fuelL]);
      return { fuelL, cost, cash: u.rows[0].cash - cost };
    });
  });

  app.post('/api/trips/start', async (req) => {
    const userId = await requireUser(req);
    const to = findRegion(String((req.body as any)?.toRegionId ?? ''));
    if (!to) throw bad('du_lieu_sai', 'Vùng trồng không tồn tại.');
    return db.tx(async (q) => {
      const u = await q.query('select cash, role, home_region_id, truck_region, fuel_l, etc from users where id = $1 for update', [userId]);
      const mine = await veh.truck(q, userId), tk = mine.tk;
      if (!mine.has) throw bad('chua_co_xe', 'Bạn chưa có xe chở hàng. Hãy mua một chiếc xe (và thi bằng lái) trước khi đi vùng khác.', 403);
      await veh.requireValidLicense(q, userId, mine.spec);
      const from: string | null = u.rows[0].truck_region ?? u.rows[0].home_region_id;
      if (!from || !findRegion(from)) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      if (from === to.id) throw bad('du_lieu_sai', 'Xe của bạn đang ở vùng này rồi.');
      if (!(Number(u.rows[0].fuel_l) > 0)) throw bad('het_xang', 'Xe đã hết xăng, hãy đổ xăng trước khi đi.', 409);
      const plan = veh.planFor(mine.spec, from, to.id);
      const en = await spendEnergy(q, userId, tripEnergy(plan.km), 'lái chuyến xe này');
      const ins = await q.query(
        'insert into trips (user_id, from_region, to_region, min_seconds) values ($1,$2,$3,$4) returning id', [userId, from, to.id, plan.seconds]);
      return { tripId: ins.rows[0].id, fromRegionId: from, toRegionId: to.id, plan, fuelL: Number(u.rows[0].fuel_l), etc: u.rows[0].etc, cash: u.rows[0].cash, truck: tk, energyCost: tripEnergy(plan.km), ...en };
    });
  });

  app.post('/api/trips/:id/finish', async (req) => {
    const userId = await requireUser(req);
    const tripId = idParam((req.params as any).id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    return db.tx(async (q) => {
      const u = await q.query('select cash, fuel_l, etc from users where id = $1 for update', [userId]);
      const { rows } = await q.query(
        'select from_region, to_region, min_seconds, started_at from trips where id = $1 and user_id = $2 and finished_at is null for update', [tripId, userId]);
      const t = rows[0];
      if (!t) throw bad('khong_tim_thay', 'Không tìm thấy chuyến xe đang chạy.', 404);
      if (Date.now() - new Date(t.started_at).getTime() < t.min_seconds * 1000 * tripMinFactor) throw bad('chua_toi_noi', 'Xe chưa tới nơi.', 409);
      const mine = await veh.truck(q, userId), tk = mine.tk;
      const plan = veh.planFor(mine.spec, t.from_region, t.to_region), road = roadKm(plan.km, plan.needsBoat);
      const refuelMax = Math.max(tk.tankL * 4, plan.fuelNeededL * 1.5);
      const refuelL = Math.min(refuelMax, num(body.refuelL, 0, refuelMax) + veh.chargedKwh(body, tk)), detourKm = num(body.detourKm, 0, road);
      // Các lần bị công an dừng xe vì quá tốc độ: mỗi lần phạt theo khung của Nghị định 168/2024.
      const fines = (Array.isArray(body.speeding) ? body.speeding.slice(0, 6) : [])
        .map((v) => Math.round(num(v, 0, 200)))
        .map((overKmh) => ({ overKmh, f: speedFine(overKmh) }))
        .filter((x) => x.f)
        .map((x) => ({ overKmh: x.overKmh, fine: x.f!.fine, points: x.f!.points, label: x.f!.label }));
      const have = Number(u.rows[0].fuel_l);
      const used = ((road + detourKm) * tk.lPer100km) / 100;
      // Thiếu xăng giữa đường: gọi cứu hộ, phần thiếu tính giá cao hơn.
      const rescueL = Math.max(0, used - have - refuelL);
      let cash: number = u.rows[0].cash, etc: number = u.rows[0].etc;
      const fuelCost = Math.min(cash, Math.round(refuelL * tk.fuelPrice + rescueL * tk.fuelPrice * tk.rescueMult));
      if (fuelCost > 0) { await addCash(q, userId, -fuelCost, `xang:${t.to_region}`); cash -= fuelCost; }
      // Phí đường: trừ ETC trước; thiếu thì trả tiền mặt có phụ thu.
      const tollCost = plan.tolls * plan.tollFee, tollFromEtc = Math.min(etc, tollCost);
      const tollCash = Math.min(cash, Math.round((tollCost - tollFromEtc) * (1 + tk.etcCashSurcharge)));
      if (tollCash > 0) { await addCash(q, userId, -tollCash, `phi_duong:${t.to_region}`); cash -= tollCash; }
      etc -= tollFromEtc;
      const fineCost = Math.min(cash, fines.reduce((sum, f) => sum + f.fine, 0));
      if (fineCost > 0) { await addCash(q, userId, -fineCost, `phat_toc_do:${tripId}`); cash -= fineCost; }
      const fuelL = round1(Math.min(tk.tankL, Math.max(0, have + refuelL + rescueL - used)));
      await q.query('update trips set finished_at = now() where id = $1', [tripId]);
      await q.query('update users set truck_region = $2, fuel_l = $3, etc = $4, cargo_used = 0 where id = $1', [userId, t.to_region, fuelL, etc]);
      const firstVisit = await q.query('insert into visits (user_id, region_id) values ($1,$2) on conflict do nothing', [userId, t.to_region]);
      if (firstVisit.rowCount && !(await q.query('select 1 from plots where user_id = $1 and region_id = $2', [userId, t.to_region])).rows[0]) await addXp(q, userId, XP.region, 'vung_moi');
      // Hàng tươi vừa thu mua sỉ ở nơi đi bị hao theo quãng đường; thùng lạnh hao ít hơn nhiều.
      const rate = spoilRate(road, !!mine.spec.cold), spoiled: { specialtyId: string; kg: number }[] = [];
      const cargo = await q.query('select specialty_id, sum(kg)::int as kg from wholesale_buys where user_id = $1 and region_id = $2 and not moved group by specialty_id', [userId, t.from_region]);
      for (const c of cargo.rows) {
        const have = (await q.query(`select kg from inventory where user_id = $1 and specialty_id = $2 and quality = 'A' for update`, [userId, c.specialty_id])).rows[0]?.kg ?? 0;
        const lose = Math.min(have, Math.round(Math.min(have, c.kg) * rate));
        if (lose > 0) { await takeInventory(q, userId, c.specialty_id, 'A', lose); spoiled.push({ specialtyId: c.specialty_id, kg: lose }); }
      }
      await q.query('update wholesale_buys set moved = true where user_id = $1 and not moved', [userId]);
      const licensePoints = await veh.deductPoints(q, userId, mine.spec, fines.reduce((n, f) => n + f.points, 0));
      const ex = await veh.afterTrip(q, userId, plan, body, cash);
      // EXP chuyến xe: phần cố định cộng theo quãng đường; chạy đúng tốc độ được thưởng thêm
      const tripKm = REGIONS[t.from_region] && REGIONS[t.to_region] ? haversineKm(REGIONS[t.from_region].lat, REGIONS[t.from_region].lng, REGIONS[t.to_region].lat, REGIONS[t.to_region].lng) : 0;
      if (!fines.length) await addXp(q, userId, xpFor('chuyen_xe_sach'), 'chuyen_xe_sach');
      const xpTrip = await addXp(q, userId, xpFor('chuyen_xe', Math.round(tripKm)), 'chuyen_xe');
      return { regionId: t.to_region, fuelUsedL: round1(used), fuelCost, rescueL: round1(rescueL), tollCost: tollFromEtc + tollCash, tollFromEtc, fuelL, etc, fineCost, fines, ...xpTrip, unit: tk.unit, vehicleKind: tk.kind, spoil: { rate, cold: !!mine.spec.cold, items: spoiled, kg: spoiled.reduce((n, x) => n + x.kg, 0) }, license: licensePoints, ...ex };
    });
  });

  // ---------------------------------------------------------------- thu mua sỉ tại vùng (xe tải)
  /** Lượng đã chất lên xe ở điểm đỗ hiện tại; sang ngày mới (giờ Việt Nam) hoặc tới vùng mới thì tính lại từ 0. */
  async function cargoUsed(q: Q, userId: number, lock = false): Promise<number> {
    const today = dayString(vnDay(Date.now()));
    const { rows } = await q.query(`select cargo_used, cargo_day::text as d from users where id = $1${lock ? ' for update' : ''}`, [userId]);
    return rows[0].d === today ? rows[0].cargo_used : 0;
  }
  /** Nguồn hàng sỉ hôm nay của một đặc sản tại vùng: tổng theo mùa vụ và phần cả vùng đã bán. */
  async function wholesaleState(q: Q, regionId: string, specialtyId: string): Promise<{ supply: number; bought: number; left: number }> {
    const start = new Date(vnDay(Date.now()) * DAY_MS - VN_TZ_MS);
    const { rows } = await q.query(
      'select coalesce(sum(kg),0)::int as kg from wholesale_buys where region_id = $1 and specialty_id = $2 and created_at >= $3', [regionId, specialtyId, start]);
    const supply = wholesaleSupplyKg(inSeasonOf(SPECIALTIES[specialtyId].crop, Date.now()));
    return { supply, bought: rows[0].kg, left: Math.max(0, supply - rows[0].kg) };
  }
  /** Lượng một đặc sản mà chợ của vùng đã nhận trong 24 giờ qua (để ép giá khi xả hàng số lượng lớn). */
  async function soldAt(q: Q, marketRegionId: string, specialtyId: string): Promise<number> {
    const { rows } = await q.query(`select coalesce(sum(kg),0)::int as kg from npc_sales where market_region = $1 and specialty_id = $2 and created_at > now() - interval '24 hours'`, [marketRegionId, specialtyId]);
    return rows[0].kg;
  }

  /** Tới một vùng thì mua gì, bán gì, lời bao nhiêu. */
  app.get('/api/regions/:id/trade', async (req) => {
    const userId = await requireUser(req);
    const r = findRegion(String((req.params as any).id));
    if (!r) throw bad('khong_tim_thay', 'Vùng trồng không tồn tại.', 404);
    const u = (await db.query('select role, home_region_id, truck_region from users where id = $1', [userId])).rows[0];
    const home: string | null = u.home_region_id, trader = u.role === 'thuong_lai';
    const truckAt: string | null = trader ? (u.truck_region ?? home) : null;
    const now = Date.now();
    const used = trader ? await cargoUsed(db, userId) : 0;
    const mine = await veh.truck(db, userId), cap = mine.tk.cargoKg;
    const free = trader ? Math.max(0, cap - used) : 0;
    const wantKg = Math.max(0, Math.min(1_000_000, Math.floor(Number((req.query as any)?.kg) || 0)));
    // Chi phí một lượt chạy giữa vùng này và vùng nhà bằng chiếc xe đang lái (năng lượng theo giá dọc đường + phí đường + đăng kiểm).
    let tripCost: { km: number; energy: number; unit: string; energyCost: number; tollCost: number; upkeepCost: number; total: number; spoilRate: number; cold: boolean } | null = null;
    if (trader && home && home !== r.id) {
      const pl = veh.planFor(mine.spec, r.id, home), road = roadKm(pl.km, pl.needsBoat);
      const energyCost = Math.round(pl.energyNeeded * mine.tk.fuelPrice), tollCost = pl.tolls * pl.tollFee;
      tripCost = { km: pl.km, energy: pl.energyNeeded, unit: pl.unit, energyCost, tollCost, upkeepCost: pl.upkeepCost, total: energyCost + tollCost + pl.upkeepCost, spoilRate: spoilRate(road, !!mine.spec.cold), cold: !!mine.spec.cold };
    }
    const here = truckAt === r.id;
    const canBuy = trader && here;
    const whyNot = canBuy ? null : !trader ? LIMIT_REASONS.wholesale_role.reason : `Xe tải của bạn đang ở ${findRegion(truckAt ?? '')?.name ?? 'nơi khác'}. Hãy lái xe tới ${r.name} để thu mua sỉ.`;
    const buy = [];
    for (const sp of specialtiesOfRegion(r.id)) {
      const ref = await currentPrice(db, sp.id), glut = await glutOf(db, sp.id);
      const st = await wholesaleState(db, r.id, sp.id), left = st.left;
      const unit = wholesaleQuote(ref, glut, st.supply, st.bought, 0).firstUnit;
      // Mang về vùng nhà bán (nếu đây không phải vùng nhà); còn mua ngay tại nhà thì phải chở đi vùng khác mới có lời.
      const atHome = home === r.id || !home;
      const sellPrice = atHome ? npcPrice(ref, 'A', sp.regionId, '', { glut })
        : npcPrice(ref, 'A', sp.regionId, home!, trader ? await priceMods(db, userId, sp.id, now, home!, home) : { glut });
      buy.push({
        specialtyId: sp.id, refPrice: ref, wholesalePrice: unit, sellPrice, sellAt: atHome ? 'vung_khac' : 'nha',
        marginPerKg: sellPrice - unit, supplyLeftKg: left, maxKg: canBuy ? Math.min(left, free) : 0,
        supplyTotalKg: st.supply, boughtTodayKg: st.bought, glut, inSeason: inSeasonOf(sp.crop, now),
        // Bảng bậc giá để giao diện báo trước: mua tới mốc này thì giá trung bình là bao nhiêu.
        priceTiers: [1000, 5000, 10000, 15000, 28000, left].filter((k, i, a) => k > 0 && k <= left && a.indexOf(k) === i).map((k) => ({ kg: k, ...wholesaleQuote(ref, glut, st.supply, st.bought, k) })),
        // Chợ nơi sẽ bán (vùng nhà) đã nhận bao nhiêu trong 24 giờ: bán thêm sẽ bị ép giá theo bulkSellFactor.
        sellMarketSold24hKg: atHome ? 0 : await soldAt(db, home!, sp.id), bulkEasyKg: BULK_EASY_KG,
        ...(wantKg > 0 ? { quote: (() => { const k = Math.min(wantKg, left), qd = wholesaleQuote(ref, glut, st.supply, st.bought, k); return { kg: k, unit: qd.unit, total: qd.total }; })() } : {}),
      });
    }
    // Chiều ngược lại: hàng trong kho bán ở đây được bao nhiêu so với bán ở nhà.
    const inv = await db.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > 0 order by specialty_id, quality', [userId]);
    const sell = [];
    for (const i of inv.rows) {
      const sp = SPECIALTIES[i.specialty_id];
      if (!sp) continue;
      const ref = await currentPrice(db, sp.id);
      let priceHere: number, priceHome: number;
      if (trader && home) {
        priceHere = npcPrice(ref, i.quality, sp.regionId, r.id, await priceMods(db, userId, sp.id, now, r.id, home));
        priceHome = npcPrice(ref, i.quality, sp.regionId, home, await priceMods(db, userId, sp.id, now, home, home));
      } else priceHere = priceHome = Math.round((ref * DUMP_RATIO * QUALITY_MULT[i.quality as Quality]) / 100) * 100;
      const soldHere = trader ? await soldAt(db, r.id, sp.id) : 0;
      sell.push({ specialtyId: sp.id, quality: i.quality, kg: i.kg, priceHere, priceHome, diffPerKg: priceHere - priceHome,
        soldHere24hKg: soldHere, avgPriceHereAll: trader ? Math.round((priceHere * bulkSellFactor(soldHere, i.kg)) / 100) * 100 : priceHere });
    }
    sell.sort((a, b) => b.diffPerKg * b.kg - a.diffPerKg * a.kg);
    return {
      regionId: r.id, homeRegionId: home, truckRegionId: truckAt, role: u.role ?? null, here, canBuy, whyNot, canSellHere: trader && here,
      cargo: { capacityKg: trader ? cap : 0, usedKg: used, freeKg: free },
      tripCost, buy, sell, limits: { cargo: LIMIT_REASONS.wholesale_cargo, supply: LIMIT_REASONS.wholesale_supply, souvenir: LIMIT_REASONS.souvenir }, compare: TRAVEL_VS_TRUCK,
    };
  });

  app.post('/api/wholesale/buy', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const kg = int(b.kg, 1, 1_000_000, 'kg');
    return db.tx(async (q) => {
      const u = (await q.query('select cash, role, home_region_id, truck_region from users where id = $1 for update', [userId])).rows[0];
      if (u.role !== 'thuong_lai') throw bad('chi_thuong_lai', 'Chỉ thương lái có xe tải mới thu mua sỉ được.', 403);
      const at: string | null = u.truck_region ?? u.home_region_id;
      if (!at) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      if (sp.regionId !== at) throw bad('khac_vung', `Xe của bạn đang ở ${findRegion(at)?.name}. Chỉ thu mua sỉ được đặc sản của vùng xe đang đỗ.`, 409);
      const cap = (await veh.truck(q, userId)).tk.cargoKg;
      if (kg > cap) throw bad('du_lieu_sai', `Xe của bạn chỉ chở được ${cap} kg mỗi lần.`);
      const used = await cargoUsed(q, userId, true), free = cap - used;
      if (kg > free) throw bad('day_xe', `Thùng xe chỉ còn chở thêm được ${Math.max(0, free)} kg.`, 409);
      // Khoá theo (vùng, đặc sản) để hai thương lái không mua vượt nguồn hàng trong ngày.
      await q.query('select pg_advisory_xact_lock(hashtext($1))', [`si:${at}:${sp.id}`]);
      const st = await wholesaleState(q, at, sp.id), left = st.left;
      if (kg > left) throw bad('het_hang', left > 0 ? `Hôm nay vùng này chỉ còn ${left} kg để thu mua.` : 'Hôm nay vùng này đã hết hàng để thu mua.', 409);
      const unit = wholesaleQuote(await currentPrice(q, sp.id), await glutOf(q, sp.id), st.supply, st.bought, kg).unit;
      if (u.cash < unit * kg) throw bad('khong_du_tien', 'Bạn không đủ tiền thu mua.', 409);
      await addCash(q, userId, -unit * kg, `thu_mua_si:${sp.id}`);
      await addInventory(q, userId, sp.id, 'A', kg);
      await collect(q, userId, sp.id);
      await q.query('insert into wholesale_buys (user_id, region_id, specialty_id, kg, unit_price) values ($1,$2,$3,$4,$5)', [userId, at, sp.id, kg, unit]);
      await q.query('update users set cargo_used = $2, cargo_day = $3 where id = $1', [userId, used + kg, dayString(vnDay(Date.now()))]);
      const xpBuy = await addXp(q, userId, xpFor('mua_si', unit * kg), 'mua_si');
      return { ...xpBuy, unitPrice: unit, total: unit * kg, cash: u.cash - unit * kg, cargo: { capacityKg: cap, usedKg: used + kg, freeKg: free - kg }, supplyLeftKg: left - kg };
    });
  });

  // ---------------------------------------------------------------- xuất khẩu
  const shipmentOut = (s: any) => ({
    id: Number(s.id), specialtyId: s.specialty_id, quality: s.quality, kg: s.kg, arriveKg: s.arrive_kg, mode: s.mode, market: s.market,
    gatewayId: s.gateway_id, gatewayName: EXPORT_GATEWAYS.find((g) => g.id === s.gateway_id)?.name ?? '', freight: Number(s.freight), payout: Number(s.payout),
    createdAt: new Date(s.created_at).getTime(), arrivesAt: new Date(s.arrives_at).getTime(), paidAt: s.paid_at ? new Date(s.paid_at).getTime() : null,
    status: s.paid_at ? 'da_toi' : 'dang_di', processed: !!s.processed, ...(s.processed && SPECIALTIES[s.specialty_id] ? { name: productName(s.specialty_id) } : {}),
  });
  /** Lô nào đã tới nơi thì trả tiền hàng; trả về các lô vừa được chốt. */
  async function settleExports(q: Q, userId: number) {
    const { rows } = await q.query(
      `update export_shipments set paid_at = now() where user_id = $1 and paid_at is null and arrives_at <= now() returning *`, [userId]);
    for (const s of rows) { await addCash(q, userId, Number(s.payout), `xuat_khau:${s.id}`); await addXp(q, userId, XP.export, 'xuat_toi'); }
    return rows.map(shipmentOut);
  }
  async function exportContext(q: Q, userId: number) {
    const [u, coop, active, mach] = await Promise.all([
      q.query('select cash, role, home_region_id, truck_region, xp from users where id = $1', [userId]),
      q.query('select 1 from coop_members where user_id = $1', [userId]),
      q.query('select count(distinct coalesce(bundle_id, id::text))::int as n from export_shipments where user_id = $1 and paid_at is null', [userId]),
      valueBonusOf(q, userId),
    ]);
    const role: Role | null = u.rows[0].role ?? null, inCoop = coop.rows.length > 0, level = levelOf(u.rows[0].xp).level;
    return { cash: Number(u.rows[0].cash), role, inCoop, active: active.rows[0].n as number, level, maxActive: exportMaxActive(level),
      discount: exportDiscount(role, inCoop), valueBonus: mach,
      from: (u.rows[0].home_region_id ?? null) as string | null, modes: exportModesFor(role, inCoop) };
  }

  app.get('/api/export/options', async (req) => {
    const userId = await requireUser(req);
    const justPaid = await db.tx((q) => settleExports(q, userId));
    const ctx = await exportContext(db, userId);
    const [inv, prod] = await Promise.all([
      db.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > 0 order by specialty_id, quality', [userId]),
      db.query('select specialty_id, kg from products where user_id = $1 and kg > 0 order by specialty_id', [userId]),
    ]);
    const quotesFor = (specialtyId: string, ql: Quality, have: number, ref: number, processed: boolean) => {
      const quotes = [];
      for (const market of Object.keys(EXPORT_MARKETS) as ExportMarket[]) for (const mode of EXPORT_MARKETS[market].modes) {
        const kg = Math.min(have, EXPORT_MODES[mode].maxKg);
        quotes.push(exportQuote(specialtyId, ql, kg, mode, market, ctx.from!, ref, { processed, discount: ctx.discount, valueBonus: processed ? ctx.valueBonus : 0 }));
      }
      return quotes.sort((a, b) => Number(b.ok) - Number(a.ok) || b.net - a.net);
    };
    const stock = [], products = [];
    for (const i of inv.rows) {
      if (!SPECIALTIES[i.specialty_id] || !ctx.from) continue;
      const ref = await currentPrice(db, i.specialty_id);
      stock.push({ specialtyId: i.specialty_id, quality: i.quality, kg: i.kg, refPrice: ref, quotes: quotesFor(i.specialty_id, i.quality, i.kg, ref, false) });
    }
    for (const i of prod.rows) {
      if (!SPECIALTIES[i.specialty_id] || !ctx.from) continue;
      const ref = await currentPrice(db, i.specialty_id);
      products.push({ specialtyId: i.specialty_id, quality: 'A' as Quality, kg: i.kg, processed: true, name: productName(i.specialty_id), refPrice: await productRef(db, i.specialty_id), quotes: quotesFor(i.specialty_id, 'A', i.kg, ref, true) });
    }
    return {
      modes: EXPORT_MODES, markets: EXPORT_MARKETS, allowedModes: ctx.modes, role: ctx.role, inCoop: ctx.inCoop, fromRegionId: ctx.from,
      active: ctx.active, maxActive: ctx.maxActive, level: ctx.level, discount: ctx.discount, stock, products, justPaid,
      limits: { role: LIMIT_REASONS.export_role, min: LIMIT_REASONS.export_min, active: LIMIT_REASONS.export_active, grade: LIMIT_REASONS.export_grade, processed: LIMIT_REASONS.export_processed },
    };
  });

  app.post('/api/export/ship', async (req) => {
    const userId = await requireUser(req);
    // lô nhiều mặt hàng { items, mode, market } — kiểu cũ một mặt hàng vẫn nhận như trước
    if (Array.isArray((req.body as any)?.items)) return econ.shipBundle(req, userId);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const processed = b.processed === true;
    const ql = processed ? 'A' : quality(b.grade ?? b.quality);
    const kg = int(b.kg, 1, 1_000_000, 'kg');
    const mode = String(b.mode ?? '') as ExportMode, market = String(b.market ?? '') as ExportMarket;
    if (!Object.hasOwn(EXPORT_MODES, mode) || !Object.hasOwn(EXPORT_MARKETS, market)) throw bad('du_lieu_sai', 'Đường xuất khẩu hoặc thị trường không hợp lệ.');
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const ctx = await exportContext(q, userId);
      if (!ctx.from) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      if (!ctx.modes.includes(mode)) throw bad('khong_duoc_duong_nay', 'Hãy quay vòng quay nhận vai trò trước khi xuất khẩu.', 403);
      if (ctx.active >= ctx.maxActive) throw bad('qua_nhieu_lo', `Bạn đang có ${ctx.maxActive} lô hàng cùng đi một lúc, nhiều bất thường; hãy chờ vài lô tới nơi rồi gửi tiếp.`, 409);
      const qt = exportQuote(sp.id, ql, kg, mode, market, ctx.from, await currentPrice(q, sp.id), { processed, discount: ctx.discount, valueBonus: processed ? ctx.valueBonus : 0 });
      if (!qt.ok) throw bad('lo_hang_sai', qt.reason ?? 'Lô hàng không hợp lệ.', 409);
      if (ctx.cash < qt.freight) throw bad('khong_du_tien', 'Bạn không đủ tiền trả cước.', 409);
      if (processed) await takeProduct(q, userId, sp.id, kg); else await takeInventory(q, userId, sp.id, ql, kg);
      const arrivesAt = new Date(Date.now() + Math.max(1000, Math.round((qt.minutes * 60_000) / timeScale)));
      const ins = await q.query(
        `insert into export_shipments (user_id, specialty_id, quality, kg, arrive_kg, mode, market, gateway_id, freight, payout, arrives_at, processed)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
        [userId, sp.id, ql, kg, qt.arriveKg, mode, market, qt.gatewayId, qt.freight, qt.payout, arrivesAt, processed]);
      await addCash(q, userId, -qt.freight, `cuoc_xuat_khau:${ins.rows[0].id}`);
      const xp = await addXp(q, userId, xpFor('xuat_gui'), 'xuat_gui');
      return { shipment: shipmentOut(ins.rows[0]), quote: qt, cash: ctx.cash - qt.freight, ...xp };
    });
  });

  app.get('/api/export/shipments', async (req) => {
    const userId = await requireUser(req);
    const justPaid = await db.tx((q) => settleExports(q, userId));
    const { rows } = await db.query('select * from export_shipments where user_id = $1 order by id desc limit 30', [userId]);
    return { shipments: rows.map(shipmentOut), justPaid, now: Date.now() };
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
      const xp = await addXp(q, userId, xpFor('trang_tri'), 'trang_tri');
      return { style, ownedHouses: owned, cost, ...xp };
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
      const xp = await addXp(q, userId, xpFor('trang_tri'), 'trang_tri');
      return { decor: items, cost, ...xp };
    });
  });

  app.post('/api/avatar', async (req) => {
    const userId = await requireUser(req);
    const avatar = validAvatar(req.body);
    if (!avatar) throw bad('du_lieu_sai', 'Trang phục hoặc màu xe không hợp lệ.');
    await db.query('update users set avatar = $2 where id = $1', [userId, JSON.stringify(avatar)]);
    return { avatar };
  });

  // ---------------------------------------------------------------- tài khoản thử nghiệm
  /** Chỉ tài khoản được đánh dấu thử nghiệm mới dùng được; mọi thao tác chỉ tác động lên chính tài khoản đó. */
  async function requireTester(req: FastifyRequest): Promise<number> {
    const userId = await requireUser(req);
    const { rows } = await db.query('select is_tester from users where id = $1', [userId]);
    if (!rows[0]?.is_tester) throw bad('khong_co_quyen', 'Chỉ tài khoản thử nghiệm mới dùng được chức năng này.', 403);
    return userId;
  }

  // ---------------------------------------------------------------- điểm tham quan và siêu thị đặc sản
  /** Người chơi đang ở đâu: vùng đang tham quan bằng vé, không thì nơi xe đỗ, không thì vùng nhà. Được coi là "có mặt" ở mọi tỉnh trong ba nơi đó. */
  async function whereabouts(q: Q, userId: number, lock = false) {
    const { rows } = await q.query(`select cash, role, home_region_id, truck_region, tour_region from users where id = $1${lock ? ' for update' : ''}`, [userId]);
    const u = rows[0];
    const ids = [u.tour_region, u.truck_region, u.home_region_id].filter((x): x is string => !!x && !!findRegion(x));
    const regionId = ids[0] ?? null;
    return { cash: Number(u.cash), role: (u.role ?? null) as Role | null, regionId, province: regionId ? findRegion(regionId)!.province : null,
      /** Vùng của người chơi nằm trong một tỉnh (để tính quãng taxi). */
      regionIn: (province: string) => ids.find((id) => findRegion(id)!.province === province) ?? null,
      provinces: [...new Set(ids.map((id) => findRegion(id)!.province))] };
  }
  const routeTo = (regionId: string | null, s: Parameters<typeof sightRoute>[1]) => sightRoute(regionId ? findRegion(regionId) : null, s, SIGHTS);
  const cleanStops = (v: unknown, valid: string[]) => [...new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && valid.includes(x)))];
  const superProvince = (v: unknown) => {
    const p = String(v ?? '');
    if (!SUPER_PROVINCES.includes(p)) throw bad('khong_tim_thay', 'Không có tỉnh này.', 404);
    return p;
  };

  app.get('/api/sights', async (req) => {
    const userId = await requireUser(req);
    const w = await whereabouts(db, userId);
    const asked = (req.query as Record<string, unknown>).province;
    const province = asked === undefined ? (w.province && SIGHT_PROVINCES.includes(w.province) ? w.province : w.provinces.find((p) => SIGHT_PROVINCES.includes(p)) ?? w.province) : String(asked);
    const here = !!province && w.provinces.includes(province);
    const from = (province && w.regionIn(province)) || w.regionId;
    const seen = await db.query('select sight_id, visits, stops, done_at from sight_visits where user_id = $1', [userId]);
    const by = new Map(seen.rows.map((r) => [r.sight_id as string, r]));
    const ride = await shopping.rideOf(db, userId);
    const sights = (province ? sightsOfProvince(province) : []).map((s) => {
      const route = shopping.applyRide(routeTo(from, s), ride), v = by.get(s.id);
      return { ...s, km: route.km, taxiFare: route.total, route, visits: v?.visits ?? 0, done: !!v?.done_at, stopsSeen: cleanStops(v?.stops, s.stops.map((x) => x.id)) };
    });
    return {
      province, regionId: from ?? null, here, sights,
      others: SIGHT_PROVINCES.filter((p) => p !== province).map((p) => ({ province: p, count: sightsOfProvince(p).length })),
    };
  });

  app.post('/api/sights/:id/visit', async (req) => {
    const userId = await requireUser(req);
    const s = findSight(String((req.params as { id: string }).id));
    if (!s) throw bad('khong_tim_thay', 'Điểm tham quan không tồn tại.', 404);
    return db.tx(async (q) => {
      const w = await whereabouts(q, userId, true);
      if (!w.provinces.includes(s.province)) throw bad('khac_tinh', `Bạn cần tới ${s.province} trước rồi mới bắt taxi tới ${s.name} được.`, 409);
      const route = shopping.applyRide(routeTo(w.regionIn(s.province), s), await shopping.rideOf(q, userId)), km = route.km, fare = route.total;
      if (w.cash < fare + s.entryFee) throw bad('khong_du_tien', route.legs.some((l) => l.mode === 'tau_thuy') ? 'Bạn không đủ tiền taxi, vé tàu và vé vào cổng.' : 'Bạn không đủ tiền taxi và vé vào cổng.', 409);
      const en = await energyState(q, userId);
      if (en.cur < ENERGY_COST.stop) throw bad('het_suc', `Bạn đã hết sức để đi bộ tham quan (cần ít nhất ${ENERGY_COST.stop} thể lực, đang có ${en.cur}). Hãy ăn uống hoặc nghỉ một lúc đã.`, 409);
      for (const l of route.legs) await addCash(q, userId, -l.fare, `${l.mode === 'tau_thuy' ? 'tau' : 'taxi'}_tham_quan:${s.id}`);
      if (s.entryFee > 0) await addCash(q, userId, -s.entryFee, `ve_tham_quan:${s.id}`);
      await q.query(
        `insert into sight_visits (user_id, sight_id, visits, is_open) values ($1,$2,1,true)
         on conflict (user_id, sight_id) do update set visits = sight_visits.visits + 1, is_open = true`, [userId, s.id]);
      return { ok: true, km, taxiFare: fare, entryFee: s.entryFee, seconds: SIGHT_TAXI_SECONDS, legs: route.legs, total: fare };
    });
  });

  app.post('/api/sights/:id/finish', async (req) => {
    const userId = await requireUser(req);
    const s = findSight(String((req.params as { id: string }).id));
    if (!s) throw bad('khong_tim_thay', 'Điểm tham quan không tồn tại.', 404);
    const valid = s.stops.map((x) => x.id);
    const now = cleanStops(((req.body ?? {}) as Record<string, unknown>).stops, valid);
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const v = await q.query('select stops, is_open, done_at from sight_visits where user_id = $1 and sight_id = $2 for update', [userId, s.id]);
      if (!v.rows[0]?.is_open) throw bad('chua_vao_cong', 'Bạn chưa bắt taxi tới điểm tham quan này.', 409);
      const before = cleanStops(v.rows[0].stops, valid);
      const stopsSeen = valid.filter((id) => now.includes(id) || before.includes(id));
      const fresh = stopsSeen.filter((id) => !before.includes(id));
      const done = stopsSeen.length === valid.length, firstTime = done && !v.rows[0].done_at;
      const at = new Date(), stopAt = { ...((await q.query('select stop_at from sight_visits where user_id = $1 and sight_id = $2', [userId, s.id])).rows[0]?.stop_at ?? {}) } as Record<string, string>;
      for (const id of fresh) stopAt[id] = at.toISOString();
      await q.query(
        `update sight_visits set stops = $3::jsonb, stop_at = $5::jsonb, is_open = false, done_at = case when $4 and done_at is null then now() else done_at end where user_id = $1 and sight_id = $2`,
        [userId, s.id, JSON.stringify(stopsSeen), done, JSON.stringify(stopAt)]);
      if (firstTime) await addCash(q, userId, SIGHT_REWARD, `thuong_tham_quan:${s.id}`);
      // đi bộ tốn sức theo số điểm dừng mới; không đủ thì trừ hết phần còn lại chứ không huỷ chuyến tham quan
      const e = await energyState(q, userId, true);
      const energy = await setEnergy(q, userId, e, Math.max(0, e.cur - ENERGY_COST.stop * fresh.length));
      const gain = XP.stop * fresh.length + (firstTime ? XP.sight : 0);
      for (let i = 1; i < fresh.length; i++) await addXp(q, userId, 0, 'diem_dung');
      const xp = gain > 0 ? await addXp(q, userId, gain, fresh.length ? 'diem_dung' : 'dia_danh') : { xpGained: 0, ...(({ xp: x, level, title }) => ({ xp: x, level, title }))(levelOf((await q.query('select xp from users where id = $1', [userId])).rows[0].xp)), levelUp: false };
      const newStamps = [
        ...fresh.map((id) => ({ kind: 'stop' as const, sightId: s.id, stopId: id, name: s.stops.find((x) => x.id === id)!.name, province: s.province, at: at.getTime() })),
        ...(firstTime ? [{ kind: 'sight' as const, sightId: s.id, name: s.name, province: s.province, at: at.getTime() }] : []),
      ];
      const ids = sightsOfProvince(s.province).map((x) => x.id);
      const cnt = await q.query('select count(*)::int as n from sight_visits where user_id = $1 and done_at is not null and sight_id = any($2)', [userId, ids]);
      return { ok: true, done: done || !!v.rows[0].done_at, firstTime, reward: firstTime ? SIGHT_REWARD : 0, stopsSeen, sightsDone: cnt.rows[0].n, sightsTotal: ids.length, ...xp, newStamps, ...energy };
    });
  });

  // ---------------------------------------------------------------- hộ chiếu du lịch
  app.get('/api/passport', async (req) => {
    const userId = await requireUser(req);
    const [u, sv, vis, plots] = await Promise.all([
      db.query('select display_name, created_at, xp from users where id = $1', [userId]),
      db.query('select sight_id, stops, stop_at, done_at from sight_visits where user_id = $1', [userId]),
      db.query('select region_id, first_at from visits where user_id = $1', [userId]),
      db.query('select region_id, created_at from plots where user_id = $1', [userId]),
    ]);
    const lv = levelOf(u.rows[0].xp);
    type Stamp = { kind: 'stop' | 'sight' | 'region'; sightId?: string; stopId?: string; regionId?: string; name: string; province: string; at: number | null };
    const stamps: Stamp[] = [];
    const doneSights = new Set<string>();
    for (const r of sv.rows) {
      const st = findSight(r.sight_id);
      if (!st) continue;
      const when = (r.stop_at ?? {}) as Record<string, string>;
      for (const id of cleanStops(r.stops, st.stops.map((x) => x.id))) {
        stamps.push({ kind: 'stop', sightId: st.id, stopId: id, name: st.stops.find((x) => x.id === id)!.name, province: st.province, at: when[id] ? new Date(when[id]).getTime() : r.done_at ? new Date(r.done_at).getTime() : null });
      }
      if (r.done_at) { doneSights.add(st.id); stamps.push({ kind: 'sight', sightId: st.id, name: st.name, province: st.province, at: new Date(r.done_at).getTime() }); }
    }
    const regionAt = new Map<string, number>();
    for (const r of [...vis.rows.map((x) => ({ id: x.region_id as string, at: new Date(x.first_at).getTime() })), ...plots.rows.map((x) => ({ id: x.region_id as string, at: new Date(x.created_at).getTime() }))]) {
      if (REGIONS[r.id]) regionAt.set(r.id, Math.min(regionAt.get(r.id) ?? Infinity, r.at));
    }
    for (const [id, at] of regionAt) stamps.push({ kind: 'region', regionId: id, name: REGIONS[id].name, province: REGIONS[id].province, at });
    stamps.sort((x, y) => (x.at ?? 0) - (y.at ?? 0));
    return {
      holder: u.rows[0].display_name, issuedAt: new Date(u.rows[0].created_at).getTime(), no: `VV${String(userId).padStart(7, '0')}`,
      xp: lv.xp, level: lv.level, title: lv.title, nextXp: lv.nextXp, prevXp: lv.prevXp, perks: levelPerks(lv.level), levels: LEVELS, xpTable: XP,
      stamps,
      sights: { done: doneSights.size, total: SIGHTS.length }, regions: { done: regionAt.size, total: Object.keys(REGIONS).length },
      provinces: SIGHT_PROVINCES.map((province) => ({ province, done: sightsOfProvince(province).filter((x) => doneSights.has(x.id)).length, total: sightsOfProvince(province).length })),
    };
  });

  // ---------------------------------------------------------------- đồ ăn thức uống, quầy hàng
  const SHOP_OWNERS = ['cô Ba', 'chú Tư', 'bà Năm', 'dì Sáu', 'anh Hai', 'chị Bảy', 'ông Tám', 'cô Út'];
  const itemOut = (id: string) => ({ itemId: id, name: ITEMS[id].name, emoji: ITEMS[id].emoji, price: ITEMS[id].price, energy: ITEMS[id].energy, kind: ITEMS[id].kind, ...(ITEMS[id].regional ? { regional: ITEMS[id].regional } : {}) });
  /** 2–4 quầy mọc ngẫu nhiên ở một địa danh, đổi theo ngày (giờ Việt Nam); cùng ngày thì ai cũng thấy như nhau. */
  function shopsOfSight(s: { id: string; province: string }, nowMs: number) {
    const r = seeded(`quay:${s.id}:${vnDay(nowMs)}`);
    const kinds = (Object.keys(SHOP_KINDS) as ShopKind[]).map((k) => ({ k, x: r() })).sort((a, b) => a.x - b.x).map((x) => x.k).slice(0, 2 + Math.floor(r() * 3));
    const local = regionalItems(s.province);
    return kinds.map((k) => {
      const info = SHOP_KINDS[k];
      const extra = info.regional ? local.map((id) => ({ id, x: r() })).sort((a, b) => a.x - b.x).slice(0, 3).map((x) => x.id) : [];
      return { id: `${s.id}:${k}`, kind: k, emoji: info.emoji, name: `${info.name} ${SHOP_OWNERS[Math.floor(r() * SHOP_OWNERS.length)]}`, items: [...new Set([...extra, ...info.items])].map(itemOut) };
    });
  }
  function homeShop(regionId: string) {
    const r = REGIONS[regionId];
    return { id: 'home', kind: 'tap_hoa' as ShopKind, emoji: SHOP_KINDS.tap_hoa.emoji, name: `Tiệm tạp hoá ${r.name}`, items: [...new Set([...HOME_SHOP_ITEMS, ...regionalItems(r.province).slice(0, 2)])].map(itemOut) };
  }
  const bagOf = async (q: Q, userId: number) => (await q.query('select item_id, qty from user_items where user_id = $1 and qty > 0 order by item_id', [userId])).rows.filter((x) => ITEMS[x.item_id]).map((x) => ({ itemId: x.item_id as string, qty: x.qty as number }));

  app.get('/api/sights/:id/shops', async (req) => {
    await requireUser(req);
    const s = findSight(String((req.params as { id: string }).id));
    if (!s) throw bad('khong_tim_thay', 'Điểm tham quan không tồn tại.', 404);
    return { sightId: s.id, shops: shopsOfSight(s, Date.now()), bagMax: ITEM_BAG_MAX };
  });
  app.get('/api/shops/home', async (req) => {
    const userId = await requireUser(req);
    const u = await db.query('select home_region_id from users where id = $1', [userId]);
    if (!u.rows[0].home_region_id) return { shops: [], items: [], bagMax: ITEM_BAG_MAX };
    const e = await energyState(db, userId);
    return { shops: [homeShop(u.rows[0].home_region_id)], items: await bagOf(db, userId), bagMax: ITEM_BAG_MAX, ...energyOut(e) };
  });
  app.get('/api/items', async (req) => {
    const userId = await requireUser(req);
    const e = await energyState(db, userId);
    return { items: (await bagOf(db, userId)).map((x) => ({ ...x, ...itemOut(x.itemId) })), bagMax: ITEM_BAG_MAX, ...energyOut(e) };
  });

  app.post('/api/shop/buy', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const shopId = String(b.shopId ?? ''), itemId = String(b.itemId ?? '');
    const qty = b.qty === undefined ? 1 : int(b.qty, 1, 10, 'qty');
    if (!Object.hasOwn(ITEMS, itemId)) throw bad('du_lieu_sai', 'Món này không có.');
    return db.tx(async (q) => {
      const w = await whereabouts(q, userId, true);
      let shop: { id: string; items: { itemId: string }[] } | undefined;
      if (shopId === 'home') {
        const home = (await q.query('select home_region_id from users where id = $1', [userId])).rows[0].home_region_id;
        if (!home) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
        shop = homeShop(home);
      } else if (shopId.startsWith('rest:')) {
        shop = await veh.restShop(q, userId, shopId);
      } else {
        const s = findSight(String(b.sightId ?? shopId.split(':')[0]));
        if (!s) throw bad('khong_tim_thay', 'Quầy hàng không tồn tại.', 404);
        if (!w.provinces.includes(s.province)) throw bad('khac_tinh', `Bạn phải tới ${s.name} mới mua ở quầy này được.`, 409);
        shop = shopsOfSight(s, Date.now()).find((x) => x.id === shopId);
      }
      if (!shop) throw bad('khong_tim_thay', 'Quầy hàng hôm nay không mở.', 404);
      if (!shop.items.some((x) => x.itemId === itemId)) throw bad('khong_ban', 'Quầy này không bán món đó.', 409);
      const it = ITEMS[itemId], total = it.price * qty;
      if (w.cash < total) throw bad('khong_du_tien', 'Bạn không đủ tiền.', 409);
      const e = await energyState(q, userId, true);
      let energy = energyOut(e);
      if (b.use === true) {
        if (e.cur >= e.max) throw bad('du_suc', 'Bạn đang đầy thể lực, để dành bụng lần sau nhé (hoặc mua bỏ túi).', 409);
        energy = await setEnergy(q, userId, e, e.cur + it.energy * qty);
      } else {
        const have = (await q.query('select qty from user_items where user_id = $1 and item_id = $2 for update', [userId, itemId])).rows[0]?.qty ?? 0;
        if (have + qty > ITEM_BAG_MAX) throw bad('day_tui', `Túi chỉ đựng được ${ITEM_BAG_MAX} phần mỗi món.`, 409);
        await q.query(`insert into user_items (user_id, item_id, qty) values ($1,$2,$3) on conflict (user_id, item_id) do update set qty = user_items.qty + excluded.qty`, [userId, itemId, qty]);
      }
      await addCash(q, userId, -total, `an_uong:${itemId}`);
      return { ok: true, itemId, qty, total, cash: w.cash - total, used: b.use === true, ...energy, items: await bagOf(q, userId) };
    });
  });

  app.post('/api/items/use', async (req) => {
    const userId = await requireUser(req);
    const itemId = String(((req.body ?? {}) as Record<string, unknown>).itemId ?? '');
    if (!Object.hasOwn(ITEMS, itemId)) throw bad('du_lieu_sai', 'Món này không có.');
    return db.tx(async (q) => {
      const e = await energyState(q, userId, true);
      if (e.cur >= e.max) throw bad('du_suc', 'Bạn đang đầy thể lực, chưa cần ăn uống.', 409);
      const { rowCount } = await q.query('update user_items set qty = qty - 1 where user_id = $1 and item_id = $2 and qty >= 1', [userId, itemId]);
      if (!rowCount) throw bad('khong_co', 'Trong túi không còn món này.', 409);
      const energy = await setEnergy(q, userId, e, e.cur + ITEMS[itemId].energy);
      return { ok: true, itemId, gained: energy.energy - e.cur, ...energy, items: await bagOf(q, userId) };
    });
  });

  /** Món nhà bán (NPC) bày hôm nay ở siêu thị một tỉnh: đặc sản các vùng trong tỉnh và vài đặc sản tỉnh khác xoay theo ngày. */
  function npcItems(province: string, nowMs: number): string[] {
    const local = Object.values(REGIONS).filter((r) => r.province === province).flatMap((r) => specialtiesOfRegion(r.id).map((sp) => sp.id));
    const rest = Object.keys(SPECIALTIES).filter((id) => !local.includes(id)).sort();
    const day = Math.floor((nowMs + VN_TZ_MS) / DAY_MS);
    const seed = parseInt(sha256(`${province}:${day}`).slice(0, 8), 16);
    const guests: string[] = [];
    for (let i = 0; i < SUPER_NPC_GUESTS && rest.length; i++) guests.push(rest.splice((seed + i * 7919) % rest.length, 1)[0]);
    return [...local, ...guests];
  }
  const npcSeller = (province: string) => `Tiệm Ba Miền ${province}`;
  async function superShelves(q: Q, userId: number, province: string) {
    const [players, npcSold] = await Promise.all([
      q.query(
        `select s.id, s.seller_id, s.specialty_id, s.quality, s.kg, s.price, s.processed, u.display_name from super_shelves s join users u on u.id = s.seller_id
         where s.province = $1 and s.kg > 0 order by s.price, s.id limit 200`, [province]),
      q.query(
        `select specialty_id, coalesce(sum(kg),0)::int as kg from super_buys where province = $1 and seller_id is null and created_at >= date_trunc('day', now()) group by specialty_id`, [province]),
    ]);
    const sold = new Map(npcSold.rows.map((r) => [r.specialty_id as string, r.kg as number]));
    const shelves: { id: number | string; specialtyId: string; quality: Quality; kg: number; price: number; refPrice: number; seller: string; mine: boolean; npc: boolean; processed: boolean; name: string }[] = [];
    for (const r of players.rows) {
      if (!SPECIALTIES[r.specialty_id]) continue;
      shelves.push({ id: Number(r.id), specialtyId: r.specialty_id, quality: r.quality, kg: r.kg, price: Number(r.price), refPrice: r.processed ? await productRef(q, r.specialty_id) : await currentPrice(q, r.specialty_id),
        seller: r.display_name, mine: Number(r.seller_id) === userId, npc: false, processed: !!r.processed, name: r.processed ? productName(r.specialty_id) : SPECIALTIES[r.specialty_id].name });
    }
    for (const id of npcItems(province, Date.now())) {
      const left = SUPER_NPC_KG - (sold.get(id) ?? 0);
      if (left <= 0) continue;
      const ref = await currentPrice(q, id);
      shelves.push({ id: `npc:${id}`, specialtyId: id, quality: 'A', kg: left, price: Math.round(ref * SUPER_NPC_RATIO), refPrice: ref, seller: npcSeller(province), mine: false, npc: true, processed: false, name: SPECIALTIES[id].name });
    }
    shelves.sort((a, b) => a.specialtyId.localeCompare(b.specialtyId) || Number(a.processed) - Number(b.processed) || a.price - b.price || Number(a.npc) - Number(b.npc));
    return shelves;
  }
  const boughtToday = async (q: Q, userId: number, province: string) => (await q.query(
    `select coalesce(sum(kg),0)::int as kg from super_buys where user_id = $1 and province = $2 and created_at >= date_trunc('day', now())`, [userId, province])).rows[0].kg as number;

  app.get('/api/supermarket', async (req) => {
    const userId = await requireUser(req);
    const w = await whereabouts(db, userId);
    const asked = (req.query as Record<string, unknown>).province;
    const province = superProvince(asked ?? w.province ?? SUPER_PROVINCES[0]);
    const here = w.provinces.includes(province);
    const earned = await db.tx(async (q) => {
      const r = await q.query('select super_earned from users where id = $1 for update', [userId]);
      if (Number(r.rows[0].super_earned) > 0) await q.query('update users set super_earned = 0 where id = $1', [userId]);
      return Number(r.rows[0].super_earned);
    });
    const shelves = await superShelves(db, userId, province);
    const inv = await db.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > 0 order by specialty_id, quality', [userId]);
    const consignable = [];
    for (const i of inv.rows) {
      if (!SPECIALTIES[i.specialty_id]) continue;
      const ref = await currentPrice(db, i.specialty_id);
      consignable.push({ specialtyId: i.specialty_id, quality: i.quality, kg: i.kg, refPrice: ref, ...superPriceRange(ref), processed: false, name: SPECIALTIES[i.specialty_id].name });
    }
    const prod = await db.query('select specialty_id, kg from products where user_id = $1 and kg > 0 order by specialty_id', [userId]);
    for (const i of prod.rows) {
      if (!SPECIALTIES[i.specialty_id]) continue;
      const ref = await productRef(db, i.specialty_id);
      consignable.push({ specialtyId: i.specialty_id, quality: 'A' as Quality, kg: i.kg, refPrice: ref, ...superPriceRange(ref), processed: true, name: productName(i.specialty_id) });
    }
    const mine = shelves.filter((s) => s.mine);
    const dailyKg = levelPerks(levelOf((await db.query('select xp from users where id = $1', [userId])).rows[0].xp).level).superDailyKg;
    return {
      province, here, shelves, mine, consignable, earned, feeRatio: SUPER_FEE,
      boughtTodayKg: await boughtToday(db, userId, province), dailyKg, lots: mine.length, maxLots: SUPER_MAX_LOTS, minKg: SUPER_MIN_KG, maxLotKg: SUPER_MAX_LOT_KG,
      limits: { buy: LIMIT_REASONS.super_buy, consign: LIMIT_REASONS.super_consign, price: LIMIT_REASONS.super_price },
    };
  });

  app.post('/api/supermarket/consign', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const processed = b.processed === true;
    const ql = processed ? 'A' : quality(b.grade ?? b.quality);
    const kg = int(b.kg, SUPER_MIN_KG, SUPER_MAX_LOT_KG, 'kg');
    const price = int(b.price, 1, 1_000_000_000, 'price');
    return db.tx(async (q) => {
      const w = await whereabouts(q, userId, true);
      const province = superProvince(b.province ?? w.province);
      if (!w.provinces.includes(province)) throw bad('khac_tinh', `Bạn phải chở hàng tới ${province} mới ký gửi lên kệ được.`, 409);
      const { minPrice, maxPrice } = superPriceRange(processed ? await productRef(q, sp.id) : await currentPrice(q, sp.id));
      if (price < minPrice || price > maxPrice) throw bad('gia_sai', `Giá bán phải từ ${minPrice.toLocaleString('vi-VN')}đ đến ${maxPrice.toLocaleString('vi-VN')}đ mỗi kg.`, 409);
      const lots = await q.query('select count(*)::int as n from super_shelves where seller_id = $1 and kg > 0', [userId]);
      if (lots.rows[0].n >= SUPER_MAX_LOTS) throw bad('het_ke', `Bạn đang bày ${SUPER_MAX_LOTS} lô, chờ bán bớt hoặc rút một lô về.`, 409);
      if (processed) await takeProduct(q, userId, sp.id, kg); else await takeInventory(q, userId, sp.id, ql, kg);
      const ins = await q.query('insert into super_shelves (province, seller_id, specialty_id, quality, kg, price, processed) values ($1,$2,$3,$4,$5,$6,$7) returning id', [province, userId, sp.id, ql, kg, price, processed]);
      const xp = await addXp(q, userId, xpFor('ky_gui'), 'ky_gui');
      return { ok: true, shelfId: Number(ins.rows[0].id), province, processed, ...xp };
    });
  });

  app.post('/api/supermarket/buy', async (req) => {
    const userId = await requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const kg = int(b.kg, 1, levelPerks(LEVELS.length).superDailyKg, 'kg');
    const raw = b.shelfId;
    const npcId = typeof raw === 'string' && raw.startsWith('npc:') ? raw.slice(4) : null;
    return db.tx(async (q) => {
      const w = await whereabouts(q, userId, true);
      let province: string, specialtyId: string, ql: Quality, price: number, sellerId: number | null = null, processed = false;
      if (npcId) {
        province = superProvince(b.province ?? w.province);
        if (!findSpecialty(npcId) || !npcItems(province, Date.now()).includes(npcId)) throw bad('khong_tim_thay', 'Kệ hàng không còn.', 404);
        // khoá theo tỉnh để hai người không cùng mua vượt lượng hàng trong ngày của nhà bán
        await q.query('select pg_advisory_xact_lock(hashtext($1))', [`super:${province}:${npcId}`]);
        const sold = await q.query(`select coalesce(sum(kg),0)::int as kg from super_buys where province = $1 and seller_id is null and specialty_id = $2 and created_at >= date_trunc('day', now())`, [province, npcId]);
        if (SUPER_NPC_KG - sold.rows[0].kg < kg) throw bad('het_hang', 'Kệ này không còn đủ hàng.', 409);
        specialtyId = npcId; ql = 'A'; price = Math.round((await currentPrice(q, npcId)) * SUPER_NPC_RATIO);
      } else {
        const sh = await q.query('select * from super_shelves where id = $1 for update', [idParam(raw)]);
        const s = sh.rows[0];
        if (!s || s.kg <= 0) throw bad('khong_tim_thay', 'Kệ hàng không còn.', 404);
        if (Number(s.seller_id) === userId) throw bad('hang_cua_ban', 'Đây là hàng bạn ký gửi; muốn lấy lại thì rút hàng về kho.', 409);
        if (s.kg < kg) throw bad('het_hang', 'Kệ này không còn đủ hàng.', 409);
        province = s.province; specialtyId = s.specialty_id; ql = s.quality; price = Number(s.price); sellerId = Number(s.seller_id); processed = !!s.processed;
      }
      if (!w.provinces.includes(province)) throw bad('khac_tinh', `Bạn phải tới ${province} mới mua ở siêu thị này được.`, 409);
      const used = await boughtToday(q, userId, province);
      const dailyKg = levelPerks(levelOf((await q.query('select xp from users where id = $1', [userId])).rows[0].xp).level).superDailyKg;
      if (used + kg > dailyKg) throw bad('het_luot', `Mỗi ngày chỉ mua ${dailyKg} kg ở một siêu thị; hôm nay bạn còn mua được ${Math.max(0, dailyKg - used)} kg.`, 409);
      const total = price * kg;
      if (w.cash < total) throw bad('khong_du_tien', 'Bạn không đủ tiền.', 409);
      await addCash(q, userId, -total, `sieu_thi_mua:${specialtyId}`);
      if (processed) await addProduct(q, userId, specialtyId, kg);
      else { await addInventory(q, userId, specialtyId, ql, kg); await collect(q, userId, specialtyId); }
      let sellerGets = 0;
      if (sellerId !== null) {
        sellerGets = Math.round(total * (1 - SUPER_FEE));
        await q.query('update super_shelves set kg = kg - $2 where id = $1', [idParam(raw), kg]);
        await addCash(q, sellerId, sellerGets, `sieu_thi_ban:${specialtyId}`);
        await q.query('update users set super_earned = super_earned + $2 where id = $1', [sellerId, sellerGets]);
        await addXp(q, sellerId, XP.consignSold, 'ky_gui_ban');
      }
      await q.query('insert into super_buys (user_id, province, seller_id, specialty_id, kg, price, processed) values ($1,$2,$3,$4,$5,$6,$7)', [userId, province, sellerId, specialtyId, kg, price, processed]);
      const xp = await addXp(q, userId, xpFor('mua_sieu_thi'), 'mua_sieu_thi');
      return { ok: true, specialtyId, quality: ql, kg, unitPrice: price, total, cash: w.cash - total, leftTodayKg: dailyKg - used - kg, processed, ...xp };
    });
  });

  app.post('/api/supermarket/withdraw', async (req) => {
    const userId = await requireUser(req);
    const id = idParam(((req.body ?? {}) as Record<string, unknown>).shelfId);
    return db.tx(async (q) => {
      const sh = await q.query('select * from super_shelves where id = $1 and seller_id = $2 for update', [id, userId]);
      const s = sh.rows[0];
      if (!s || s.kg <= 0) throw bad('khong_tim_thay', 'Không tìm thấy lô hàng của bạn.', 404);
      await q.query('update super_shelves set kg = 0 where id = $1', [id]);
      if (s.processed) await addProduct(q, userId, s.specialty_id, s.kg); else await addInventory(q, userId, s.specialty_id, s.quality, s.kg);
      return { ok: true, specialtyId: s.specialty_id, quality: s.quality, kg: s.kg, processed: !!s.processed };
    });
  });

  app.post('/api/test/role', async (req) => {
    const userId = await requireTester(req);
    const role = (req.body as any)?.role;
    if (typeof role !== 'string' || !ROLES.includes(role as Role)) throw bad('du_lieu_sai', 'Vai trò không hợp lệ.');
    await db.query('update users set role = $2, role_assigned_at = now(), truck_region = home_region_id where id = $1', [userId, role]);
    await db.tx((q) => ensureStarter(q, userId));
    return { role };
  });

  app.post('/api/test/truck', async (req) => {
    const userId = await requireTester(req);
    const etc = 2_000_000;
    const fuelL = await veh.testFill(userId);
    await db.query('update users set etc = $2 where id = $1', [userId, etc]);
    return { fuelL, etc };
  });

  app.post('/api/test/cash', async (req) => {
    const userId = await requireTester(req);
    const amount = int((req.body as any)?.amount, 0, 1e12, 'amount');
    return db.tx(async (q) => {
      const { rows } = await q.query('select cash from users where id = $1 for update', [userId]);
      if (amount !== rows[0].cash) await addCash(q, userId, amount - rows[0].cash, 'thu_nghiem');
      return { cash: amount };
    });
  });

  app.post('/api/test/region', async (req) => {
    const userId = await requireTester(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const r = findRegion(String(b.regionId ?? ''));
    if (!r) throw bad('du_lieu_sai', 'Vùng trồng không tồn tại.');
    if (b.kind !== undefined && b.kind !== 'ground' && b.kind !== 'rooftop') throw bad('du_lieu_sai', 'Kiểu vườn không hợp lệ.');
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const home = await q.query('select id, region_id, kind from plots where user_id = $1 and is_home for update', [userId]);
      if (!home.rows[0]) throw bad('chua_co_dat', 'Bạn chưa có lô nhà để chuyển.', 409);
      const kind = (b.kind as string | undefined) ?? home.rows[0].kind;
      if (home.rows[0].region_id !== r.id) {
        const other = await q.query('select 1 from plots where user_id = $1 and region_id = $2', [userId, r.id]);
        if (other.rows[0]) throw bad('da_co_dat', 'Bạn đã có một lô đất khác ở vùng này.', 409);
      }
      await q.query('delete from plantings where plot_id = $1', [home.rows[0].id]);
      const cell = snapCell(r.lat, r.lng);
      await q.query('update plots set region_id = $2, kind = $3, cell_lat = $4, cell_lng = $5, ward_name = null, ward_province = null where id = $1', [home.rows[0].id, r.id, kind, cell.lat, cell.lng]);
      await q.query('update users set home_region_id = $2, truck_region = $2, tour_region = null where id = $1', [userId, r.id]);
      const coop = await q.query('select c.region_id from coop_members m join coops c on c.id = m.coop_id where m.user_id = $1', [userId]);
      if (coop.rows[0] && coop.rows[0].region_id !== r.id) await leaveCoop(q, userId);
      return { regionId: r.id, kind };
    });
  });

  app.post('/api/test/ripen', async (req) => {
    const userId = await requireTester(req);
    const { rowCount } = await db.query(
      'update plantings set step_ready_at = now() where plot_id in (select id from plots where user_id = $1)', [userId]);
    return { count: rowCount ?? 0 };
  });

  app.post('/api/test/stock', async (req) => {
    const userId = await requireTester(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sp = findSpecialty(String(b.specialtyId ?? ''));
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const kg = int(b.kg, 1, 10000, 'kg');
    const ql = b.grade === undefined ? 'A' : quality(b.grade);
    await db.tx(async (q) => { await addInventory(q, userId, sp.id, ql, kg); await collect(q, userId, sp.id); });
    return { ok: true };
  });

  app.post('/api/test/energy', async (req) => {
    const userId = await requireTester(req);
    const value = int((req.body as any)?.value, 0, 1000, 'value');
    return db.tx(async (q) => { const e = await energyState(q, userId, true); return setEnergy(q, userId, e, value); });
  });

  app.post('/api/test/season', async (req) => {
    const userId = await requireTester(req);
    await db.query('update users set role = null, role_assigned_at = null where id = $1', [userId]);
    return { ok: true };
  });

  registerProgress(app, { db, timeScale, bad, requireUser, addCash, addXp, addInventory, takeInventory, addProduct, takeProduct, currentPrice, ensureStarter, requireTester: (r) => requireTester(r) });
  registerFarm(app, { db, timeScale, lateGraceMs, requireUser, requireTester: (r) => requireTester(r), bad, addCash, addXp, addInventory, spendEnergy, weatherGrowth: (r, t) => weatherOf(r, t).growth, inSeason: inSeasonOf });

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
