// Hiện diện người chơi (thấy nhau trong làng, trên cao tốc, ở trạm dừng) và cư dân ảo giữ cho chợ luôn có người.
// Chạy được trên Vercel serverless + Postgres: không WebSocket, mỗi người gửi một yêu cầu vài giây một lần,
// yêu cầu đó vừa ghi vị trí của mình vừa đọc người cùng cảnh (một câu truy vấn).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import type { Db, Q } from './db.ts';
import { REGIONS, SPECIALTIES, specialtiesOfRegion } from '../../shared/catalog.ts';
import { DUMP_RATIO, LEVELS, QUALITIES, QUALITY_MULT, npcPrice } from '../../shared/rules.ts';
import type { Quality } from '../../shared/rules.ts';
import { VEHICLES } from '../../shared/vehicles.ts';
import { HATS, SHIRT_COLORS, TRUCK_COLORS } from '../../shared/custom.ts';
import { xpFor } from '../../shared/progress.ts';
import type { XpSource } from '../../shared/progress.ts';
import {
  BOTS_PER_REGION, BOT_BATCH, BOT_BUY_MAX_RATIO, BOT_FARM_KG_PER_HOUR, BOT_LISTING_HOURS, BOT_MAX_LISTINGS, BOT_START_CASH, BOT_STOCK_CAP, BOT_TICK_MS,
  HIGHWAY_WINDOW_KM, PRESENCE_INTERVAL, PRESENCE_MAX, PRESENCE_SCENES, PRESENCE_TTL_MS, botDisplayName, hash32, rand01,
} from '../../shared/social.ts';
import type { PresenceOther, PresenceOut, PresenceScene } from '../../shared/social.ts';

type BotRole = 'nong_dan' | 'thuong_lai' | 'xuong';
export interface SocialDeps {
  db: Db;
  timeScale: number;
  /** false: tắt hẳn cư dân ảo (kiểm thử, hoặc biến môi trường BOTS=off). */
  bots: boolean;
  requireUser: (req: FastifyRequest) => Promise<number>;
  requireTester: (req: FastifyRequest) => Promise<number>;
  requireAdmin: (req: FastifyRequest) => void;
  bad: (code: string, message: string, status?: number) => Error;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
  addXp: (q: Q, userId: number, n: number, source?: XpSource) => Promise<unknown>;
  addInventory: (q: Q, userId: number, specialtyId: string, ql: Quality, kg: number) => Promise<void>;
  takeInventory: (q: Q, userId: number, specialtyId: string, ql: Quality, kg: number) => Promise<void>;
  currentPrice: (q: Q, specialtyId: string) => Promise<number>;
}


const num = (v: unknown, lo: number, hi: number): number | null => { const n = Number(v); return typeof v === 'number' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };
const HOUR = 3600_000;
const VEH_GROUPS = ['tai_nhe', 'tai_trung', 'tai_nang', 'ban_tai', 'dau_keo', 'tai_nhe'];

interface BotRow { id: number; display_name: string; role: BotRole; home_region_id: string; avatar: { shirt?: string; hat?: string; truck?: string } | null }

export function registerSocial(app: FastifyInstance, d: SocialDeps) {
  const { db, bad } = d;
  let botCache: { at: number; list: BotRow[] } | null = null;
  let lastTickTry = 0, enabledCache: { at: number; on: boolean } | null = null;

  async function botsOn(): Promise<boolean> {
    if (!d.bots) return false;
    if (enabledCache && Date.now() - enabledCache.at < 60_000) return enabledCache.on;
    const on = !!(await db.query('select enabled from bot_state where id = 1')).rows[0]?.enabled;
    enabledCache = { at: Date.now(), on };
    return on;
  }
  async function botList(): Promise<BotRow[]> {
    if (botCache && Date.now() - botCache.at < 600_000) return botCache.list;
    const { rows } = await db.query('select id, display_name, role, home_region_id, avatar from users where is_bot order by id');
    botCache = { at: Date.now(), list: rows };
    return rows;
  }

  // ---------------------------------------------------------------- hiện diện
  app.post('/api/presence', async (req): Promise<PresenceOut> => {
    const userId = await d.requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const scene = String(b.scene ?? '') as PresenceScene;
    if (!PRESENCE_SCENES.includes(scene)) throw bad('du_lieu_sai', 'Cảnh không hợp lệ.');
    const key = typeof b.key === 'string' ? b.key.slice(0, 80) : '';
    if (!key) throw bad('du_lieu_sai', 'Thiếu khoá cảnh.');
    const hw = scene === 'highway';
    // Cao tốc: x = km đã đi của mình, z = tổng km chuyến, speed = km mỗi giây thật; chiều đi để trong extra.
    const x = hw ? num(b.km, 0, 5000) : num(b.x, -2000, 2000), z = hw ? num(b.totalKm, 0, 5000) : num(b.z, -2000, 2000);
    const yaw = num(b.yaw, -10, 10), speed = hw ? num(b.kmps, 0, 200) : num(b.speed, 0, 100);
    const car = b.car && typeof b.car === 'object' ? b.car as Record<string, unknown> : null;
    const extra = {
      walk: b.walk === true, dir: b.dir === -1 ? -1 : 1,
      ...(car ? { car: { x: num(car.x, -2000, 2000) ?? 0, z: num(car.z, -2000, 2000) ?? 0, yaw: num(car.yaw, -10, 10) ?? 0 } } : {}),
    };
    const { rows } = await db.query(
      `with up as (
         insert into presence (user_id, scene, scene_key, x, z, yaw, speed, extra, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,now())
         on conflict (user_id) do update set scene = excluded.scene, scene_key = excluded.scene_key, x = excluded.x, z = excluded.z, yaw = excluded.yaw,
           speed = excluded.speed, extra = excluded.extra, updated_at = now()
       )
       select p.user_id, p.x, p.z, p.yaw, p.speed, p.extra, (extract(epoch from (now() - p.updated_at)) * 1000)::int as age,
              u.display_name, u.role, u.avatar, u.equipped, v.kind as vkind
       from presence p join users u on u.id = p.user_id left join vehicles v on v.id = u.vehicle_id
       where p.scene = $2 and p.scene_key = $3 and p.user_id <> $1 and p.updated_at > now() - ($9 || ' milliseconds')::interval
       order by p.updated_at desc limit 60`,
      [userId, scene, key, x, z, yaw, speed, JSON.stringify(extra), String(PRESENCE_TTL_MS)]);
    const myKm = x ?? 0, total = z ?? 0, myDir = extra.dir;
    let others: PresenceOther[] = rows.map((r) => {
      const av = r.avatar ?? null, eq = r.equipped ?? null, vk = r.vkind ? VEHICLES[r.vkind] : null;
      const o: PresenceOther = {
        id: Number(r.user_id), name: r.display_name, role: r.role ?? null, bot: false,
        avatar: av ? { shirt: av.shirt, hat: av.hat, truck: av.truck } : null,
        outfit: eq ? { ao: eq.ao ?? null, non: eq.non ?? null, phu_kien: eq.phu_kien ?? null } : null,
        vehicle: { group: vk?.group ?? 'tai_nhe', color: av?.truck ?? TRUCK_COLORS[1] }, ageMs: r.age,
      };
      if (hw) {
        // đưa km của người kia về trục chuyến đi của mình
        const theirDir = r.extra?.dir === -1 ? -1 : 1, theirTotal = Number(r.z) || total, theirKm = Number(r.x) || 0;
        const canon = theirDir === 1 ? theirKm : theirTotal - theirKm, mine = myDir === 1 ? canon : total - canon;
        o.aheadKm = Math.round((mine - myKm) * 100) / 100; o.sameDir = theirDir === myDir; o.kmps = Number(r.speed) || 0;
      } else {
        o.x = Number(r.x) || 0; o.z = Number(r.z) || 0; o.yaw = Number(r.yaw) || 0; o.speed = Number(r.speed) || 0; o.walk = !!r.extra?.walk; o.car = r.extra?.car ?? null;
      }
      return o;
    });
    if (hw) others = others.filter((o) => Math.abs(o.aheadKm!) < HIGHWAY_WINDOW_KM).sort((a, b) => Math.abs(a.aheadKm!) - Math.abs(b.aheadKm!));
    else { const cx = x ?? 0, cz = z ?? 0; others.sort((a, b) => Math.hypot(a.x! - cx, a.z! - cz) - Math.hypot(b.x! - cx, b.z! - cz)); }
    others = others.slice(0, PRESENCE_MAX);
    const realCount = others.length;
    let botsShown = false;
    if (await botsOn()) {
      const extraBots = await virtualBots(scene, key, { km: myKm, total, dir: myDir as 1 | -1 });
      if (extraBots.length) { botsShown = true; others = others.concat(extraBots.slice(0, Math.max(0, PRESENCE_MAX - others.length))); }
      await maybeTick(); // chờ xong: trên Vercel việc chạy sau khi trả lời có thể bị đóng băng giữa chừng
    }
    const out: PresenceOut = { at: Date.now(), interval: hw ? PRESENCE_INTERVAL.highway : realCount > 0 ? PRESENCE_INTERVAL.busy : PRESENCE_INTERVAL.alone, others, bots: botsShown };
    if (b.count === true) out.online = (await db.query(`select count(*)::int as n from presence where updated_at > now() - interval '30 seconds'`)).rows[0].n;
    return out;
  });

  app.post('/api/presence/leave', async (req) => {
    const userId = await d.requireUser(req);
    await db.query('delete from presence where user_id = $1', [userId]);
    return { ok: true };
  });

  /** Cư dân ảo trong cảnh: không ghi gì vào CSDL, vị trí tính từ thời gian nên mọi người cùng cảnh thấy giống nhau. */
  async function virtualBots(scene: PresenceScene, key: string, me: { km: number; total: number; dir: 1 | -1 }): Promise<PresenceOther[]> {
    const bots = await botList(); if (!bots.length) return [];
    const now = Date.now(), out: PresenceOther[] = [];
    const pick = (seed: number, region?: string[]) => {
      const local = region ? bots.filter((b) => region.includes(b.home_region_id)) : [];
      const pool = local.length && rand01(seed, 99) < 0.6 ? local : bots;
      return pool[hash32(String(seed)) % pool.length];
    };
    const base = (b: BotRow, seed: number): PresenceOther => ({
      id: Number(b.id), name: b.display_name, role: b.role, bot: true,
      avatar: b.avatar ? { shirt: b.avatar.shirt, hat: b.avatar.hat, truck: b.avatar.truck } : null, outfit: null,
      vehicle: { group: b.role === 'nong_dan' ? (rand01(seed, 5) < 0.5 ? 'ban_tai' : 'tai_nhe') : VEH_GROUPS[hash32(`${seed}:veh`) % VEH_GROUPS.length], color: b.avatar?.truck ?? TRUCK_COLORS[0] },
      ageMs: 0,
    });
    if (scene === 'village' || scene === 'rest_stop' || scene === 'sight' || scene === 'market' || scene === 'admin') {
      // vài người ghé qua, đổi người mỗi 8 phút; trình duyệt tự cho họ đi theo kịch bản
      const slot = 8 * 60_000, bucket = Math.floor(now / slot), seed0 = hash32(`${scene}:${key}:${bucket}`);
      const n = scene === 'village' ? seed0 % 3 : scene === 'rest_stop' ? 1 + (seed0 % 3) : 1 + (seed0 % 2);
      const used = new Set<number>();
      for (let i = 0; i < n; i++) {
        const seed = hash32(`${seed0}:${i}`), b = pick(seed); if (!b || used.has(b.id)) continue; used.add(b.id);
        out.push({ ...base(b, seed), script: { kind: scene === 'rest_stop' ? 'rest' : 'stroll', seed, t0: bucket * slot } });
      }
      return out;
    }
    // Cao tốc: mỗi tuyến luôn có vài xe của cư dân ảo chạy hai chiều, vị trí là hàm của thời gian theo trục chuẩn của tuyến.
    const total = Math.max(1, me.total), slot = 10 * 60_000, bucket = Math.floor(now / slot), seed0 = hash32(`hw:${key}:${bucket}`);
    const ends = key.split('|'), n = Math.max(4, Math.min(16, Math.round(total / 45) + (seed0 % 3))), tripSec = Math.max(20, Math.min(90, 20 + total / 12)), used = new Set<number>();
    for (let i = 0; i < n; i++) {
      const seed = hash32(`${seed0}:${i}`), b = pick(seed, ends); if (!b || used.has(b.id)) continue; used.add(b.id);
      // rải đều hai chiều (chẵn cùng chiều, lẻ ngược chiều) để đi đâu cũng có xe trước sau
      const dir = i % 2 === 0 ? me.dir : (-me.dir as 1 | -1), kmps = (total / tripSec) * (0.8 + rand01(seed, 2) * 0.4);
      const start = ((Math.floor(i / 2) + rand01(seed, 3) * 0.8) / Math.ceil(n / 2)) * total, run = ((now - bucket * slot) / 1000) * kmps;
      const canon = (((start + dir * run) % total) + total) % total, mine = me.dir === 1 ? canon : total - canon;
      const ahead = mine - me.km; if (Math.abs(ahead) > HIGHWAY_WINDOW_KM) continue;
      out.push({ ...base(b, seed), aheadKm: Math.round(ahead * 100) / 100, sameDir: dir === me.dir, kmps });
    }
    return out;
  }

  // ---------------------------------------------------------------- cư dân ảo: lập, chạy lượt
  async function seedBots(q: Q) {
    const have = (await q.query('select count(*)::int as n from users where is_bot')).rows[0].n;
    const regions = Object.values(REGIONS);
    if (have >= regions.length * BOTS_PER_REGION) return 0;
    let made = 0, idx = 0;
    for (const r of regions) for (let k = 0; k < BOTS_PER_REGION; k++, idx++) {
      const role: BotRole = k === 0 ? 'nong_dan' : idx % 4 === 1 ? 'thuong_lai' : 'xuong';
      const h = hash32(`bot:${r.id}:${k}`);
      const avatar = { shirt: SHIRT_COLORS[h % SHIRT_COLORS.length], hat: HATS[(h >>> 4) % HATS.length].id, truck: TRUCK_COLORS[(h >>> 8) % TRUCK_COLORS.length] };
      const level = 6 + ((h >>> 12) % 8), xp = LEVELS[Math.min(LEVELS.length - 1, level - 1)].xp;
      // tên tài khoản có dấu chấm: người thật không đăng ký được tên như vậy nên không bao giờ trùng; mật khẩu ngẫu nhiên không ai biết
      const ins = await q.query(
        `insert into users (username, display_name, pass_hash, cash, home_region_id, role, role_assigned_at, avatar, xp, is_bot)
         values ($1,$2,$3,$4,$5,$6,now(),$7,$8,true) on conflict (username) do nothing returning id`,
        [`bot.${r.id}.${k}`, botDisplayName(idx), `scrypt$${randomBytes(16).toString('hex')}$${randomBytes(32).toString('hex')}`, BOT_START_CASH[role], r.id, role, JSON.stringify(avatar), xp]);
      if (ins.rows[0]) { made++; await q.query('insert into ledger (user_id, delta, reason) values ($1,$2,$3)', [ins.rows[0].id, BOT_START_CASH[role], 'von_cu_dan']); }
    }
    botCache = null;
    return made;
  }

  async function maybeTick() {
    if (Date.now() - lastTickTry < 30_000) return null;
    lastTickTry = Date.now();
    try { return await tick(false, BOT_BATCH); } catch (e) { console.error('cu_dan_ao', e); return null; }
  }

  async function tick(force: boolean, limit: number) {
    if (!force && !(await botsOn())) return null;
    return db.tx(async (q) => {
      if (!(await q.query('select pg_try_advisory_xact_lock(hashtext($1)) as ok', ['cu_dan_ao'])).rows[0].ok) return null;
      const st = (await q.query('select enabled, last_tick from bot_state where id = 1')).rows[0];
      if (!force && (!st?.enabled || (st.last_tick && Date.now() - new Date(st.last_tick).getTime() < BOT_TICK_MS))) return null;
      await q.query('update bot_state set last_tick = now() where id = 1');
      const seeded = await seedBots(q);
      const bots = (await q.query(`select id, role, home_region_id, cash, bot_at from users where is_bot order by bot_at nulls first, id limit $1`, [limit])).rows;
      const stats = { seeded, bots: bots.length, produced: 0, listed: 0, bought: 0, boughtFromPlayers: 0, sold: 0 };
      for (const b of bots) await actBot(q, b, stats);
      return stats;
    });
  }

  async function actBot(q: Q, b: { id: number; role: BotRole; home_region_id: string; bot_at: Date | null }, stats: Record<string, number>) {
    const now = Date.now(), last = b.bot_at ? new Date(b.bot_at).getTime() : now - HOUR;
    const gameHours = Math.min(12, ((now - last) / HOUR) * d.timeScale);
    const seed = hash32(`${b.id}:${Math.floor(now / 60_000)}`);
    // 1) nhà vườn ảo thu hoạch theo thời gian đã trôi (như vườn thật lớn dần), giữ kho trong giới hạn
    if (b.role === 'nong_dan') {
      for (const sp of specialtiesOfRegion(b.home_region_id).slice(0, 2)) {
        const kg = Math.round(gameHours * BOT_FARM_KG_PER_HOUR); if (kg <= 0) continue;
        const has = Number((await q.query('select coalesce(sum(kg),0) as kg from inventory where user_id = $1 and specialty_id = $2', [b.id, sp.id])).rows[0].kg);
        const add = Math.min(kg, Math.max(0, BOT_STOCK_CAP - has)); if (add <= 0) continue;
        const ql: Quality = rand01(seed, sp.id.length) < 0.35 ? 'A' : rand01(seed, 7) < 0.75 ? 'B' : 'C';
        await d.addInventory(q, b.id, sp.id, ql, add); stats.produced += add;
      }
    }
    // 2) tin rao cũ quá lâu thì gỡ về kho
    const stale = await q.query(
      `update listings set status = 'cancelled' where seller_id = $1 and status = 'open' and created_at < now() - ($2 || ' hours')::interval returning specialty_id, quality, kg`,
      [b.id, String(BOT_LISTING_HOURS)]);
    for (const r of stale.rows) if (r.kg > 0) await d.addInventory(q, b.id, r.specialty_id, r.quality, r.kg);
    // 3) thương lái, chủ xưởng ảo mua tin rao giá hợp lý — ưu tiên hàng của người chơi thật
    if (b.role !== 'nong_dan') {
      let budget = Math.floor(Number((await q.query('select cash from users where id = $1', [b.id])).rows[0].cash) * 0.3), buys = 0;
      const cand = await q.query(
        `select l.id, l.seller_id, l.specialty_id, l.quality, l.kg, l.price, u.is_bot from listings l join users u on u.id = l.seller_id
         where l.status = 'open' and l.kg > 0 and l.seller_id <> $1 and l.created_at < now() - interval '60 seconds'
         order by u.is_bot asc, l.id desc limit 20`, [b.id]);
      for (const l of cand.rows) {
        if (buys >= 2 || budget <= 0 || !SPECIALTIES[l.specialty_id]) continue;
        const ref = await d.currentPrice(q, l.specialty_id), fair = ref * QUALITY_MULT[l.quality as Quality] * BOT_BUY_MAX_RATIO;
        if (l.price > fair || rand01(seed, Number(l.id)) > (l.is_bot ? 0.2 : 0.85)) continue;
        const kg = Math.min(l.kg, Math.floor(budget / l.price), 400); if (kg < 1) continue;
        const locked = await q.query(`select kg from listings where id = $1 and status = 'open' for update skip locked`, [l.id]);
        if (!locked.rows[0] || locked.rows[0].kg < kg) continue;
        const total = l.price * kg;
        await q.query('select id from users where id in ($1,$2) order by id for update', [b.id, l.seller_id]);
        if (Number((await q.query('select cash from users where id = $1', [b.id])).rows[0].cash) < total) continue;
        await q.query(`update listings set kg = kg - $2, status = case when kg - $2 = 0 then 'sold' else 'open' end where id = $1`, [l.id, kg]);
        await d.addCash(q, b.id, -total, `mua_cho:${l.id}`);
        await d.addCash(q, l.seller_id, total, `ban_cho:${l.id}`);
        await d.addInventory(q, b.id, l.specialty_id, l.quality, kg);
        if (!l.is_bot) { await d.addXp(q, l.seller_id, xpFor('ban_sap', total), 'ban_sap'); stats.boughtFromPlayers++; }
        budget -= total; buys++; stats.bought++;
      }
    }
    // 4) bày hàng lên chợ cho đủ vài tin rao
    const open = (await q.query(`select count(*)::int as n from listings where seller_id = $1 and status = 'open'`, [b.id])).rows[0].n;
    if (open < BOT_MAX_LISTINGS) {
      const inv = await q.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg >= 10 order by kg desc limit $2', [b.id, BOT_MAX_LISTINGS - open]);
      for (const [i, r] of inv.rows.entries()) {
        if (!SPECIALTIES[r.specialty_id] || !QUALITIES.includes(r.quality)) continue;
        const ref = await d.currentPrice(q, r.specialty_id);
        const price = Math.max(Math.ceil(ref * 0.3), Math.min(Math.floor(ref * 3), Math.round((ref * QUALITY_MULT[r.quality as Quality] * (0.92 + rand01(seed, 30 + i) * 0.23)) / 100) * 100));
        const kg = Math.min(r.kg, 20 + Math.floor(rand01(seed, 40 + i) * 100));
        await d.takeInventory(q, b.id, r.specialty_id, r.quality, kg);
        await q.query('insert into listings (seller_id, specialty_id, quality, kg, price) values ($1,$2,$3,$4,$5)', [b.id, r.specialty_id, r.quality, kg, price]);
        stats.listed++;
      }
    }
    // 5) hàng dư bán cho doanh nghiệp theo đúng luật người thật: nhà vườn bán tháo, thương lái/chủ xưởng bán ở chợ xa
    const keep = b.role === 'nong_dan' ? BOT_STOCK_CAP : 100;
    const extra = await q.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > $2', [b.id, keep]);
    for (const r of extra.rows) {
      const sp = SPECIALTIES[r.specialty_id]; if (!sp) continue;
      const kg = r.kg - keep, ref = await d.currentPrice(q, sp.id);
      const market = b.role === 'nong_dan' ? b.home_region_id : sp.regionId === b.home_region_id ? farRegion(sp.regionId) : b.home_region_id;
      const unit = b.role === 'nong_dan' ? Math.round((ref * DUMP_RATIO * QUALITY_MULT[r.quality as Quality]) / 100) * 100 : Math.round(npcPrice(ref, r.quality, sp.regionId, market) / 100) * 100;
      await d.takeInventory(q, b.id, sp.id, r.quality, kg);
      await q.query('insert into npc_sales (user_id, specialty_id, kg, market_region) values ($1,$2,$3,$4)', [b.id, sp.id, kg, market]);
      await d.addCash(q, b.id, unit * kg, `ban_npc_cu_dan:${sp.id}`);
      stats.sold += kg;
    }
    await q.query('update users set bot_at = now() where id = $1', [b.id]);
  }
  const farRegion = (id: string) => { const all = Object.keys(REGIONS); return all[(all.indexOf(id) + 7) % all.length]; };

  // ---------------------------------------------------------------- công tắc, thử nghiệm
  app.post('/api/admin/bots', async (req) => {
    d.requireAdmin(req);
    const on = (req.body as { enabled?: unknown } | null)?.enabled;
    if (typeof on !== 'boolean') throw bad('du_lieu_sai', 'Cần "enabled": true hoặc false.');
    await db.query('update bot_state set enabled = $1 where id = 1', [on]);
    enabledCache = null;
    if (!on) await db.query(`update listings set status = 'cancelled' where status = 'open' and seller_id in (select id from users where is_bot)`);
    return { enabled: on };
  });
  app.post('/api/test/bots/tick', async (req) => {
    await d.requireTester(req);
    if (!d.bots) throw bad('tat', 'Cư dân ảo đang tắt ở máy chủ này.', 409);
    const all = (req.body as { all?: unknown } | null)?.all === true;
    return { stats: await tick(true, all ? 1000 : BOT_BATCH) };
  });
  app.get('/api/bots/status', async (req) => {
    await d.requireUser(req);
    const on = await botsOn();
    const r = (await db.query(`select count(*)::int as bots, (select count(*)::int from listings l join users u on u.id = l.seller_id where u.is_bot and l.status = 'open') as listings,
      (select count(*)::int from presence where updated_at > now() - interval '30 seconds') as online from users where is_bot`)).rows[0];
    return { enabled: on, ...r };
  });

  return { tick, maybeTick };
}
