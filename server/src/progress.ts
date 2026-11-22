// Tiến trình nhân vật: sổ EXP có trần ngày, nhiệm vụ ngày, thành tựu, thưởng lên cấp,
// nâng cấp đất, máy nhập khẩu và dung hợp. Đăng ký vào app bằng registerProgress().
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomInt } from 'node:crypto';
import { CROPS, REGIONS, SPECIALTIES, recipeOf } from '../../shared/catalog.ts';
import { LEVELS, MACHINES, MACHINE_MAX_LEVEL, WORKSHOP_MAX_MACHINES, WORKSHOP_MAX_PER_KIND, levelOf, levelPerks, machineUpgradeCost } from '../../shared/rules.ts';
import type { MachineKind, Quality, Role } from '../../shared/rules.ts';
import {
  ACHIEVEMENTS, BOX_EXPORT_BONUS, BOX_EXPORT_LEVEL, BOX_EXPORT_MIN, FUSION_KEEP_ON_FAIL, GIFT_BOXES, IMPORT_CUSTOMS_MINUTES, IMPORT_MACHINES, IMPORT_MAX_PENDING,
  IMPORT_STAGE_NAMES, IMPORT_TRUCK_MINUTES, LAND_UPGRADES, LAND_UPGRADE_LEVELS, LAND_UPGRADE_MAX, LEVEL_UNLOCKS, MACHINE_MERGE, SEED_FUSIONS, SEED_TRAITS, XP_RULES,
  boostCost, canCross, cleanUpgrades, dailyQuestsFor, dailyRewardMult, fusionRate, giftBox, importCost, importMachine, isSeedTrait, landUpgradeCost, levelReward, xpFor,
} from '../../shared/progress.ts';
import type { ImportStage, LandUpgradeKind, SeedTrait, XpSource } from '../../shared/progress.ts';
import type { Db, Q } from './db.ts';

const DAY_MS = 86400_000, VN_TZ_MS = 7 * 3600_000;
/** Ngày theo giờ Việt Nam và thời điểm bắt đầu ngày đó. */
export const vnDay = (now = Date.now()) => Math.floor((now + VN_TZ_MS) / DAY_MS);
const dayStart = (day: number) => new Date(day * DAY_MS - VN_TZ_MS);

/** Ghi một lần nhận EXP vào sổ và áp trần mỗi ngày của nguồn đó; trả về số EXP thật sự được cộng. */
export async function logXp(q: Q, userId: number, source: XpSource, n: number): Promise<number> {
  const rule = XP_RULES[source] ?? XP_RULES.khac;
  let grant = Math.max(0, Math.floor(n));
  if (rule.dailyCap !== undefined && grant > 0) {
    const { rows } = await q.query('select coalesce(sum(xp),0)::int as s from xp_log where user_id = $1 and source = $2 and created_at >= $3', [userId, source, dayStart(vnDay())]);
    grant = Math.max(0, Math.min(grant, rule.dailyCap - rows[0].s));
  }
  await q.query('insert into xp_log (user_id, source, xp) values ($1,$2,$3)', [userId, source, grant]);
  return grant;
}

export interface ProgressDeps {
  db: Db; timeScale: number;
  bad: (code: string, message: string, status?: number) => Error;
  requireUser: (req: FastifyRequest) => Promise<number>;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
  addXp: (q: Q, userId: number, n: number, source?: XpSource) => Promise<{ xpGained: number; xp: number; level: number; title: string; levelUp: boolean }>;
  addInventory: (q: Q, userId: number, specialtyId: string, ql: Quality, kg: number) => Promise<void>;
  takeInventory: (q: Q, userId: number, specialtyId: string, ql: Quality, kg: number) => Promise<void>;
  addProduct: (q: Q, userId: number, specialtyId: string, kg: number) => Promise<void>;
  takeProduct: (q: Q, userId: number, specialtyId: string, kg: number) => Promise<void>;
  currentPrice: (q: Q, specialtyId: string) => Promise<number>;
  ensureStarter: (q: Q, userId: number) => Promise<void>;
  /** Chỉ tài khoản thử nghiệm; có thì mới mở các endpoint thử của phần này. */
  requireTester?: (req: FastifyRequest) => Promise<number>;
}

/** Máy nhập khẩu: đổi tên và tốc độ của một máy trong danh sách máy của xưởng theo cột `origin`. */
export function applyImport<T extends { name: string; time: number }>(m: T, origin: unknown): T & { origin: string | null; originName: string | null; yieldBonus: number } {
  const imp = importMachine(origin);
  if (!imp) return Object.assign(m, { origin: null, originName: null, yieldBonus: 0 });
  return Object.assign(m, { name: `${imp.name} (${imp.origin})`, time: Math.round(m.time * imp.speed * 1000) / 1000, origin: imp.id, originName: imp.origin, yieldBonus: imp.yieldBonus });
}

export function registerProgress(app: FastifyInstance, d: ProgressDeps) {
  const { db, bad, requireUser, addCash, addXp } = d;
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number, field: string) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw bad('du_lieu_sai', `Giá trị "${field}" không hợp lệ.`);
    return v;
  };
  const idOf = (v: unknown) => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw bad('khong_tim_thay', 'Không tìm thấy.', 404); return n; };
  const minutes = (m: number) => (m * 60_000) / d.timeScale;
  /** Trừ tiền, từ chối nếu không đủ. */
  async function pay(q: Q, userId: number, amount: number, reason: string, what: string) {
    const { rows } = await q.query('select cash from users where id = $1 for update', [userId]);
    if (Number(rows[0].cash) < amount) throw bad('khong_du_tien', `Bạn không đủ tiền ${what} (cần ${amount.toLocaleString('vi-VN')}đ).`, 409);
    if (amount > 0) await addCash(q, userId, -amount, reason);
    return Number(rows[0].cash) - amount;
  }
  const userOf = async (q: Q, userId: number) => {
    const { rows } = await q.query('select xp, role, cash, home_region_id from users where id = $1', [userId]);
    return { xp: rows[0].xp as number, role: (rows[0].role ?? null) as Role | null, cash: Number(rows[0].cash), level: levelOf(rows[0].xp).level, home: (rows[0].home_region_id ?? null) as string | null };
  };
  const claimed = async (q: Q, userId: number, kind: string) => new Set((await q.query('select ref from progress_claims where user_id = $1 and kind = $2', [userId, kind])).rows.map((r) => r.ref as string));
  async function claim(q: Q, userId: number, kind: string, ref: string) {
    const ins = await q.query('insert into progress_claims (user_id, kind, ref) values ($1,$2,$3) on conflict do nothing', [userId, kind, ref]);
    if (!ins.rowCount) throw bad('da_nhan', 'Bạn đã nhận phần thưởng này rồi.', 409);
  }
  /** Số lần làm từng việc (đếm theo sổ EXP) kể từ một thời điểm. */
  async function counts(q: Q, userId: number, since: Date | null) {
    const { rows } = await q.query(`select source, count(*)::int as n, coalesce(sum(xp),0)::int as xp from xp_log where user_id = $1 ${since ? 'and created_at >= $2' : ''} group by source`, since ? [userId, since] : [userId]);
    const out: Record<string, { n: number; xp: number }> = {};
    for (const r of rows) out[r.source] = { n: r.n, xp: r.xp };
    return out;
  }
  const sumOf = (c: Record<string, { n: number }>, sources: XpSource[]) => sources.reduce((a, s) => a + (c[s]?.n ?? 0), 0);

  // ---------------------------------------------------------------- tổng quan tiến trình
  async function dailyState(q: Q, userId: number, role: Role | null, level: number) {
    const day = vnDay(), today = await counts(q, userId, dayStart(day)), got = await claimed(q, userId, `ngay:${day}`), mult = dailyRewardMult(level);
    return {
      today, day,
      list: dailyQuestsFor(userId, day, role).map((qd) => {
        const progress = Math.min(qd.goal, sumOf(today, qd.sources));
        return { id: qd.id, text: qd.text, progress, goal: qd.goal, reward: { xp: Math.round(qd.xp * mult), cash: Math.round((qd.cash * mult) / 1000) * 1000 }, done: progress >= qd.goal, claimed: got.has(qd.id) };
      }),
    };
  }
  async function achievementState(q: Q, userId: number, level: number) {
    const [all, got, sights, regions] = await Promise.all([
      counts(q, userId, null), claimed(q, userId, 'thanh_tuu'),
      q.query('select count(*)::int as n from sight_visits where user_id = $1 and done_at is not null', [userId]),
      q.query('select count(*)::int as n from (select region_id from visits where user_id = $1 union select region_id from plots where user_id = $1) t', [userId]),
    ]);
    return ACHIEVEMENTS.map((a) => {
      const raw = a.metric === 'level' ? level : a.metric === 'sights' ? sights.rows[0].n : a.metric === 'regions' ? regions.rows[0].n : sumOf(all, a.sources ?? []);
      const progress = Math.min(a.goal, raw);
      return { id: a.id, text: a.text, progress, goal: a.goal, reward: { xp: a.xp, cash: a.cash }, done: progress >= a.goal, claimed: got.has(a.id) };
    });
  }

  app.get('/api/progress', async (req) => {
    const userId = await requireUser(req);
    const u = await userOf(db, userId), lv = levelOf(u.xp);
    const [daily, achievements, log, lvGot] = await Promise.all([
      dailyState(db, userId, u.role, lv.level), achievementState(db, userId, lv.level),
      db.query('select source, xp, created_at from xp_log where user_id = $1 and xp > 0 order by id desc limit 20', [userId]),
      claimed(db, userId, 'cap'),
    ]);
    return {
      xp: lv.xp, level: lv.level, title: lv.title, nextXp: lv.nextXp, prevXp: lv.prevXp, maxLevel: LEVELS.length, perks: levelPerks(lv.level),
      unlocks: LEVEL_UNLOCKS.filter((l) => l.level <= lv.level), nextUnlocks: LEVEL_UNLOCKS.filter((l) => l.level > lv.level).slice(0, 3), levels: LEVEL_UNLOCKS,
      levelRewards: LEVEL_UNLOCKS.filter((l) => l.level > 1 && l.level <= lv.level).map((l) => ({ level: l.level, reward: l.reward, claimed: lvGot.has(String(l.level)) })),
      daily: daily.list, dailyResetsAt: (daily.day + 1) * DAY_MS - VN_TZ_MS,
      achievements,
      xpLog: log.rows.map((r) => ({ at: new Date(r.created_at).getTime(), source: r.source as string, label: XP_RULES[r.source as XpSource]?.label ?? r.source, xp: r.xp as number })),
      xpRules: (Object.keys(XP_RULES) as XpSource[]).filter((s) => XP_RULES[s].xp > 0).map((s) => ({ source: s, ...XP_RULES[s], todayXp: daily.today[s]?.xp ?? 0 })),
    };
  });

  app.post('/api/progress/daily/:id/claim', async (req) => {
    const userId = await requireUser(req), id = String((req.params as any).id);
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const u = await userOf(q, userId), st = await dailyState(q, userId, u.role, u.level), qd = st.list.find((x) => x.id === id);
      if (!qd) throw bad('khong_tim_thay', 'Nhiệm vụ này không có trong hôm nay.', 404);
      if (!qd.done) throw bad('chua_xong', 'Bạn chưa làm xong nhiệm vụ này.', 409);
      await claim(q, userId, `ngay:${st.day}`, id);
      await addCash(q, userId, qd.reward.cash, `nhiem_vu:${id}`);
      const xp = await addXp(q, userId, qd.reward.xp, 'nhiem_vu');
      return { ok: true, id, reward: qd.reward, cash: u.cash + qd.reward.cash, ...xp };
    });
  });

  app.post('/api/progress/achievements/:id/claim', async (req) => {
    const userId = await requireUser(req), id = String((req.params as any).id);
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const u = await userOf(q, userId), a = (await achievementState(q, userId, u.level)).find((x) => x.id === id);
      if (!a) throw bad('khong_tim_thay', 'Không có thành tựu này.', 404);
      if (!a.done) throw bad('chua_xong', 'Bạn chưa đạt thành tựu này.', 409);
      await claim(q, userId, 'thanh_tuu', id);
      await addCash(q, userId, a.reward.cash, `thanh_tuu:${id}`);
      const xp = await addXp(q, userId, a.reward.xp, 'thanh_tuu');
      return { ok: true, id, reward: a.reward, cash: u.cash + a.reward.cash, ...xp };
    });
  });

  app.post('/api/progress/levels/:level/claim', async (req) => {
    const userId = await requireUser(req), level = Number((req.params as any).level);
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const u = await userOf(q, userId);
      if (!Number.isInteger(level) || level < 2 || level > LEVELS.length) throw bad('khong_tim_thay', 'Không có mốc cấp này.', 404);
      if (level > u.level) throw bad('chua_xong', `Bạn chưa đạt cấp ${level}.`, 409);
      await claim(q, userId, 'cap', String(level));
      const reward = levelReward(level);
      await addCash(q, userId, reward, `len_cap:${level}`);
      return { ok: true, level, reward, cash: u.cash + reward };
    });
  });

  // ---------------------------------------------------------------- nâng cấp đất
  const upgradesOut = (raw: unknown, level: number) => {
    const up = cleanUpgrades(raw);
    return (Object.keys(LAND_UPGRADES) as LandUpgradeKind[]).map((kind) => {
      const cur = up[kind] ?? 0, next = cur + 1, max = cur >= LAND_UPGRADE_MAX;
      return { kind, ...LAND_UPGRADES[kind], level: cur, maxLevel: LAND_UPGRADE_MAX, nextCost: max ? null : landUpgradeCost(kind, next), needLevel: max ? null : LAND_UPGRADE_LEVELS[next - 1], canUpgrade: !max && level >= LAND_UPGRADE_LEVELS[next - 1] };
    });
  };
  app.get('/api/plots/:id/upgrades', async (req) => {
    const userId = await requireUser(req), plotId = idOf((req.params as any).id);
    const [p, u] = await Promise.all([db.query('select upgrades, is_home, kind from plots where id = $1 and user_id = $2', [plotId, userId]), userOf(db, userId)]);
    if (!p.rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy lô đất của bạn.', 404);
    const factory = u.role === 'xuong' && p.rows[0].is_home;
    return { plotId, factory, upgrades: factory ? [] : upgradesOut(p.rows[0].upgrades, u.level), level: u.level, cash: u.cash };
  });
  app.post('/api/plots/:id/upgrade', async (req) => {
    const userId = await requireUser(req), plotId = idOf((req.params as any).id), kind = body(req).kind as LandUpgradeKind;
    if (typeof kind !== 'string' || !Object.hasOwn(LAND_UPGRADES, kind)) throw bad('du_lieu_sai', 'Hạng mục nâng cấp không tồn tại.');
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const p = await q.query('select upgrades, is_home from plots where id = $1 and user_id = $2 for update', [plotId, userId]);
      if (!p.rows[0]) throw bad('khong_tim_thay', 'Không tìm thấy lô đất của bạn.', 404);
      const u = await userOf(q, userId);
      if (u.role === 'xuong' && p.rows[0].is_home) throw bad('xuong_khong_trong', 'Lô này là nhà xưởng, không có đất trồng để nâng cấp. Chủ xưởng nâng cấp máy trong mục Xưởng.', 409);
      const up = cleanUpgrades(p.rows[0].upgrades), next = (up[kind] ?? 0) + 1;
      if (next > LAND_UPGRADE_MAX) throw bad('cap_toi_da', `${LAND_UPGRADES[kind].name} đã ở cấp cao nhất.`, 409);
      if (u.level < LAND_UPGRADE_LEVELS[next - 1]) throw bad('chua_du_cap', `Cần đạt cấp ${LAND_UPGRADE_LEVELS[next - 1]} mới nâng ${LAND_UPGRADES[kind].name.toLowerCase()} lên cấp ${next}.`, 409);
      const cost = landUpgradeCost(kind, next);
      const cash = await pay(q, userId, cost, `nang_dat:${kind}`, 'nâng cấp đất');
      up[kind] = next;
      await q.query('update plots set upgrades = $2 where id = $1', [plotId, JSON.stringify(up)]);
      const xp = await addXp(q, userId, xpFor('nang_dat'), 'nang_dat');
      // `level` là cấp của hạng mục vừa nâng; cấp nhân vật nằm ở playerLevel
      return { ...xp, playerLevel: xp.level, ok: true, plotId, kind, level: next, cost, cash, upgrades: upgradesOut(up, xp.level) };
    });
  });

  // ---------------------------------------------------------------- máy nhập khẩu
  const stagesOf = (r: any) => {
    const legs: { stage: ImportStage; name: string; etaAt: number }[] = [
      { stage: 'tau_bien', name: IMPORT_STAGE_NAMES.tau_bien, etaAt: new Date(r.port_at).getTime() },
      { stage: 'thong_quan', name: IMPORT_STAGE_NAMES.thong_quan, etaAt: new Date(r.cleared_at).getTime() },
      { stage: 'xe_ve_xuong', name: IMPORT_STAGE_NAMES.xe_ve_xuong, etaAt: new Date(r.arrive_at).getTime() },
    ];
    return legs;
  };
  const importOut = (r: any, now: number) => {
    const m = importMachine(r.import_id)!, legs = stagesOf(r), cur = legs.find((l) => now < l.etaAt);
    return { id: Number(r.id), importId: m.id, kind: m.kind, name: m.name, origin: m.origin, flag: m.flag, port: m.port, orderedAt: new Date(r.ordered_at).getTime(), legs,
      stage: (cur?.stage ?? 'da_toi') as ImportStage | 'da_toi', arrived: !cur, arriveAt: legs[2].etaAt, total: Number(r.cost) };
  };
  const catalogOut = (level: number, cash: number) => IMPORT_MACHINES.map((m) => {
    const cost = importCost(m);
    return { ...m, emoji: MACHINES[m.kind].emoji, baseName: MACHINES[m.kind].name, recipes: MACHINES[m.kind].recipes, cost, minutes: m.seaMinutes + IMPORT_CUSTOMS_MINUTES + IMPORT_TRUCK_MINUTES,
      canOrder: level >= m.minLevel && cash >= cost.total, whyNot: level < m.minLevel ? `Cần đạt cấp ${m.minLevel}.` : cash < cost.total ? 'Chưa đủ tiền.' : null };
  });
  app.get('/api/workshop/imports', async (req) => {
    const userId = await requireUser(req), u = await userOf(db, userId), now = Date.now();
    const { rows } = await db.query('select * from machine_imports where user_id = $1 and installed_at is null order by id', [userId]);
    return { isWorkshop: u.role === 'xuong', level: u.level, cash: u.cash, catalog: catalogOut(u.level, u.cash), orders: rows.filter((r) => importMachine(r.import_id)).map((r) => importOut(r, now)),
      maxPending: IMPORT_MAX_PENDING, now, note: 'Thuế nhập khẩu, thuế giá trị gia tăng và phí thông quan được tính gọn cho dễ chơi; ngoài đời còn tuỳ mã hàng và hiệp định thương mại.' };
  });
  app.post('/api/workshop/machines/import', async (req) => {
    const userId = await requireUser(req), m = importMachine(body(req).kind ?? body(req).importId);
    if (!m) throw bad('du_lieu_sai', 'Loại máy nhập khẩu không tồn tại.');
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const u = await userOf(q, userId);
      if (u.role !== 'xuong') throw bad('chi_chu_xuong', 'Chỉ chủ xưởng mới nhập máy chế biến được.', 403);
      if (u.level < m.minLevel) throw bad('chua_du_cap', `Cần đạt cấp ${m.minLevel} mới nhập được ${m.name.toLowerCase()}.`, 409);
      const pending = await q.query('select count(*)::int as n from machine_imports where user_id = $1 and installed_at is null', [userId]);
      if (pending.rows[0].n >= IMPORT_MAX_PENDING) throw bad('dang_cho_may', `Bạn đang có ${IMPORT_MAX_PENDING} máy trên đường về; lắp xong rồi hãy đặt tiếp.`, 409);
      const cost = importCost(m), cash = await pay(q, userId, cost.total, `nhap_may:${m.id}`, 'nhập máy');
      const now = Date.now(), port = now + minutes(m.seaMinutes), cleared = port + minutes(IMPORT_CUSTOMS_MINUTES), arrive = cleared + minutes(IMPORT_TRUCK_MINUTES);
      const ins = await q.query('insert into machine_imports (user_id, import_id, cost, port_at, cleared_at, arrive_at) values ($1,$2,$3,$4,$5,$6) returning *',
        [userId, m.id, cost.total, new Date(port), new Date(cleared), new Date(arrive)]);
      const out = importOut(ins.rows[0], now);
      return { ok: true, orderId: out.id, legs: out.legs, cost, cash, order: out };
    });
  });
  app.post('/api/workshop/imports/:id/install', async (req) => {
    const userId = await requireUser(req), id = idOf((req.params as any).id);
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      await d.ensureStarter(q, userId);
      const { rows } = await q.query('select * from machine_imports where id = $1 and user_id = $2 and installed_at is null for update', [id, userId]);
      const r = rows[0], m = r ? importMachine(r.import_id) : undefined;
      if (!r || !m) throw bad('khong_tim_thay', 'Không tìm thấy đơn nhập máy.', 404);
      if (Date.now() < new Date(r.arrive_at).getTime()) throw bad('chua_toi', 'Máy chưa về tới xưởng.', 409);
      const have = await q.query('select kind from machines where user_id = $1', [userId]);
      if (have.rows.length >= WORKSHOP_MAX_MACHINES) throw bad('het_cho_may', `Nhà xưởng chỉ đặt được ${WORKSHOP_MAX_MACHINES} máy. Hãy ghép hoặc bớt máy rồi lắp.`, 409);
      if (have.rows.filter((x) => x.kind === m.kind).length >= WORKSHOP_MAX_PER_KIND) throw bad('du_may', `Xưởng đã có đủ ${WORKSHOP_MAX_PER_KIND} ${MACHINES[m.kind].name.toLowerCase()}. Hãy ghép hai máy cũ thành một rồi lắp máy mới.`, 409);
      const ins = await q.query('insert into machines (user_id, kind, origin) values ($1,$2,$3) returning id', [userId, m.kind, m.id]);
      await q.query('update machine_imports set installed_at = now() where id = $1', [id]);
      const xp = await addXp(q, userId, xpFor('nhap_may'), 'nhap_may');
      return { ok: true, machineId: Number(ins.rows[0].id), kind: m.kind, name: `${m.name} (${m.origin})`, origin: m.id, ...xp };
    });
  });

  // ---------------------------------------------------------------- dung hợp
  const productRef = async (q: Q, specialtyId: string) => Math.round(((await d.currentPrice(q, specialtyId)) * recipeOf(CROPS[SPECIALTIES[specialtyId].crop]).value) / 100) * 100;
  /** Tài khoản thử nghiệm có thể ép kết quả dung hợp để kiểm thử (POST /api/test/fusion-luck). */
  const forced = new Map<number, boolean>();
  const roll = (rate: number, userId: number) => forced.get(userId) ?? randomInt(1_000_000) / 1_000_000 < rate;
  const keep = (n: number) => Math.floor(n * FUSION_KEEP_ON_FAIL);
  async function fusionLog(q: Q, userId: number, recipeId: string, success: boolean, detail: unknown) {
    await q.query('insert into fusion_log (user_id, recipe_id, success, detail) values ($1,$2,$3,$4)', [userId, recipeId, success, JSON.stringify(detail)]);
  }
  /** Chốt một lần dung hợp: cộng EXP theo kết quả. */
  const fusionXp = (q: Q, userId: number, success: boolean) => addXp(q, userId, xpFor(success ? 'dung_hop' : 'dung_hop_hong'), success ? 'dung_hop' : 'dung_hop_hong');

  app.get('/api/fusion', async (req) => {
    const userId = await requireUser(req), u = await userOf(db, userId);
    const [inv, prod, mach, seeds, boxes, hist] = await Promise.all([
      db.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > 0 order by specialty_id', [userId]),
      db.query('select specialty_id, kg from products where user_id = $1 and kg > 0 order by specialty_id', [userId]),
      db.query(`select m.id, m.kind, m.level, m.origin, (select count(*)::int from process_jobs j where j.machine_id = m.id) as busy from machines m where m.user_id = $1 order by m.id`, [userId]),
      db.query('select specialty_id, trait, qty from user_seeds where user_id = $1 and qty > 0 order by specialty_id', [userId]),
      db.query('select box_id, qty, value from gift_boxes where user_id = $1 and qty > 0', [userId]),
      db.query('select recipe_id, success, detail, created_at from fusion_log where user_id = $1 order by id desc limit 10', [userId]),
    ]);
    const stockA = inv.rows.filter((r) => r.quality === 'A' && SPECIALTIES[r.specialty_id]);
    const products = prod.rows.filter((r) => SPECIALTIES[r.specialty_id]);
    const machines = mach.rows.filter((r) => Object.hasOwn(MACHINES, r.kind));
    const lock = (min: number) => (u.level < min ? `Cần đạt cấp ${min}.` : null);
    const roleLock = (role: Role, name: string) => (u.role !== role ? `Chỉ ${name} làm được.` : null);
    const recipes = [
      ...SEED_FUSIONS.map((f) => {
        const t = SEED_TRAITS[f.trait], ok = stockA.filter((r) => r.kg >= f.kgEach);
        const pairs = ok.flatMap((a) => ok.filter((b) => canCross(a.specialty_id, b.specialty_id)).map((b) => [a.specialty_id, b.specialty_id] as [string, string]));
        return { id: f.id, kind: 'giong' as const, name: `Lai tạo ${t.name.toLowerCase()}`, emoji: t.emoji, note: `Chọn hai đặc sản cùng loại cây hoặc cùng nhóm cây làm bố mẹ. ${t.effect}`,
          inputs: [{ type: 'nong_san', count: 2, kgEach: f.kgEach, quality: 'A', rule: 'Hai đặc sản khác nhau, cùng loại cây hoặc cùng nhóm cây, hàng Loại 1' }],
          extras: { cost: f.cost, boostCost: boostCost(f.cost) }, successRate: fusionRate(f.successRate, u.level, false), boostedRate: fusionRate(f.successRate, u.level, true), keepOnFail: FUSION_KEEP_ON_FAIL,
          result: { type: 'giong', trait: f.trait, name: t.name, packets: f.packets, note: `${f.packets} gói giống của đặc sản thứ nhất, mỗi gói trồng một ô không tốn tiền giống.` },
          minLevel: f.minLevel, have: pairs.length > 0, options: pairs.slice(0, 40), whyNot: lock(f.minLevel) ?? (u.role === 'xuong' ? 'Chủ xưởng không trồng trọt.' : pairs.length ? null : `Cần hai đặc sản lai được với nhau, mỗi loại ${f.kgEach} kg Loại 1.`) };
      }),
      ...GIFT_BOXES.map((b) => {
        const ok = products.filter((r) => r.kg >= b.kgEach).map((r) => r.specialty_id as string);
        return { id: b.id, kind: 'san_pham' as const, name: `Phối ${b.name.toLowerCase()}`, emoji: b.emoji, note: b.note,
          inputs: [{ type: 'thanh_pham', count: b.kinds, kgEach: b.kgEach, rule: `${b.kinds} loại thành phẩm khác nhau${b.id === 'hop_ba_mien' ? ' của ba vùng trồng khác nhau' : ''}` }],
          extras: { cost: b.packCost, boostCost: boostCost(b.packCost) }, successRate: fusionRate(b.successRate, u.level, false), boostedRate: fusionRate(b.successRate, u.level, true), keepOnFail: FUSION_KEEP_ON_FAIL,
          result: { type: 'hop_qua', boxId: b.id, name: b.name, boxes: b.boxes, valueMult: b.valueMult, note: `${b.boxes} hộp, tổng giá trị bằng ${Math.round(b.valueMult * 100)}% giá các thành phẩm bỏ vào.` },
          minLevel: b.minLevel, have: ok.length >= b.kinds, options: ok, whyNot: lock(b.minLevel) ?? roleLock('xuong', 'chủ xưởng') ?? (ok.length >= b.kinds ? null : `Cần ${b.kinds} loại thành phẩm, mỗi loại ${b.kgEach} kg.`) };
      }),
      (() => {
        const free = machines.filter((m) => !m.busy && MACHINES[m.kind as MachineKind].slots > 0 && m.level < MACHINE_MAX_LEVEL) as { id: number; kind: string; level: number; origin: string | null; busy: number }[];
        const pairs = free.flatMap((a) => free.filter((b) => b.id > a.id && b.kind === a.kind && b.level === a.level && (b.origin ?? null) === (a.origin ?? null)).map((b) => [Number(a.id), Number(b.id)] as [number, number]));
        return { id: MACHINE_MERGE.id, kind: 'may' as const, name: 'Ghép hai máy cùng loại', emoji: '🛠️', note: 'Tháo hai máy cùng loại, cùng cấp (đang không chạy mẻ nào) để ráp thành một máy cấp cao hơn. Rẻ hơn nâng cấp nhưng mất một máy; thất bại thì giữ nguyên cả hai máy, chỉ mất tiền linh kiện.',
          inputs: [{ type: 'may', count: 2, rule: 'Hai máy chế biến cùng loại, cùng cấp, cùng xuất xứ, đang rảnh' }],
          extras: { cost: null as number | null, costRule: `Linh kiện bằng ${Math.round(MACHINE_MERGE.partsRatio * 100)}% giá nâng cấp máy đó`, boostCost: null as number | null }, successRate: fusionRate(MACHINE_MERGE.successRate, u.level, false), boostedRate: fusionRate(MACHINE_MERGE.successRate, u.level, true), keepOnFail: 1,
          result: { type: 'may', note: 'Một máy cùng loại cao hơn một cấp, trả lại một chỗ đặt máy.' },
          minLevel: MACHINE_MERGE.minLevel, have: pairs.length > 0, options: pairs, whyNot: lock(MACHINE_MERGE.minLevel) ?? roleLock('xuong', 'chủ xưởng') ?? (pairs.length ? null : 'Cần hai máy cùng loại, cùng cấp, đang rảnh và chưa ở cấp cao nhất.') };
      })(),
    ];
    return {
      level: u.level, role: u.role, cash: u.cash, recipes,
      seeds: seeds.rows.filter((r) => SPECIALTIES[r.specialty_id] && isSeedTrait(r.trait)).map((r) => ({ specialtyId: r.specialty_id as string, trait: r.trait as SeedTrait, qty: r.qty as number, name: `${SPECIALTIES[r.specialty_id].name} · ${SEED_TRAITS[r.trait as SeedTrait].name.toLowerCase()}`, effect: SEED_TRAITS[r.trait as SeedTrait].effect })),
      boxes: boxes.rows.filter((r) => giftBox(r.box_id)).map((r) => { const b = giftBox(r.box_id)!; return { boxId: b.id, name: b.name, emoji: b.emoji, qty: r.qty as number, value: Number(r.value), exportValue: Math.round((Number(r.value) * (1 + BOX_EXPORT_BONUS)) / 100) * 100 }; }),
      boxExport: { bonus: BOX_EXPORT_BONUS, minBoxes: BOX_EXPORT_MIN, minLevel: BOX_EXPORT_LEVEL },
      history: hist.rows.map((r) => ({ recipeId: r.recipe_id as string, success: r.success as boolean, detail: r.detail, at: new Date(r.created_at).getTime() })),
      rule: 'Tỉ lệ thành công ghi rõ ở từng công thức: mỗi cấp nhân vật thêm 1,5 điểm phần trăm, vật tư tăng cường thêm 15 điểm, tối đa 95%. Thất bại được trả lại một nửa nguyên liệu.',
    };
  });

  app.post('/api/fusion', async (req) => {
    const userId = await requireUser(req), b = body(req), recipeId = String(b.recipeId ?? ''), boost = b.boost === true;
    const inputs = Array.isArray(b.inputs) ? b.inputs : [];
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const u = await userOf(q, userId);
      const needLevel = (min: number) => { if (u.level < min) throw bad('chua_du_cap', `Cần đạt cấp ${min} mới dùng được công thức này.`, 409); };
      const seedF = SEED_FUSIONS.find((f) => f.id === recipeId), box = giftBox(recipeId);
      if (seedF) {
        needLevel(seedF.minLevel);
        if (u.role === 'xuong') throw bad('xuong_khong_trong', 'Chủ xưởng không trồng trọt nên không lai giống.', 409);
        const [a, c] = inputs.map(String);
        if (inputs.length !== 2 || !canCross(a, c)) throw bad('nguyen_lieu_sai', 'Hãy chọn hai đặc sản khác nhau, cùng loại cây hoặc cùng nhóm cây.', 409);
        const extra = seedF.cost + (boost ? boostCost(seedF.cost) : 0), rate = fusionRate(seedF.successRate, u.level, boost);
        const cash = await pay(q, userId, extra, `lai_giong:${seedF.id}`, 'mua vật tư lai giống');
        await d.takeInventory(q, userId, a, 'A', seedF.kgEach);
        await d.takeInventory(q, userId, c, 'A', seedF.kgEach);
        const success = roll(rate, userId);
        let kept: unknown = null, result: unknown = null;
        if (success) {
          await q.query(`insert into user_seeds (user_id, specialty_id, trait, qty) values ($1,$2,$3,$4) on conflict (user_id, specialty_id, trait) do update set qty = user_seeds.qty + excluded.qty`, [userId, a, seedF.trait, seedF.packets]);
          result = { type: 'giong', specialtyId: a, trait: seedF.trait, packets: seedF.packets, name: `${SPECIALTIES[a].name} · ${SEED_TRAITS[seedF.trait].name.toLowerCase()}` };
        } else {
          const back = keep(seedF.kgEach);
          if (back > 0) { await d.addInventory(q, userId, a, 'A', back); await d.addInventory(q, userId, c, 'A', back); }
          kept = [{ specialtyId: a, kg: back }, { specialtyId: c, kg: back }];
        }
        await fusionLog(q, userId, seedF.id, success, { inputs: [a, c], boost, rate, result });
        return { ok: true, success, successRate: rate, result, kept, spent: extra, cash, ...(await fusionXp(q, userId, success)) };
      }
      if (box) {
        needLevel(box.minLevel);
        if (u.role !== 'xuong') throw bad('chi_chu_xuong', 'Chỉ chủ xưởng mới phối hộp quà được.', 403);
        const ids = [...new Set(inputs.map(String))];
        if (ids.length !== box.kinds || inputs.length !== box.kinds || ids.some((id) => !SPECIALTIES[id])) throw bad('nguyen_lieu_sai', `Hãy chọn đúng ${box.kinds} loại thành phẩm khác nhau.`, 409);
        if (box.id === 'hop_ba_mien' && new Set(ids.map((id) => REGIONS[SPECIALTIES[id].regionId]?.zone)).size < 3) throw bad('nguyen_lieu_sai', 'Hộp ba miền cần thành phẩm của ba miền khác nhau.', 409);
        const extra = box.packCost + (boost ? boostCost(box.packCost) : 0), rate = fusionRate(box.successRate, u.level, boost);
        const cash = await pay(q, userId, extra, `phoi_hop:${box.id}`, 'mua bao bì');
        let worth = 0;
        for (const id of ids) { await d.takeProduct(q, userId, id, box.kgEach); worth += (await productRef(q, id)) * box.kgEach; }
        const success = roll(rate, userId);
        let kept: unknown = null, result: unknown = null;
        if (success) {
          const value = Math.round((worth * box.valueMult) / box.boxes / 100) * 100;
          // giá trị một hộp là bình quân theo số hộp đang có
          await q.query(`insert into gift_boxes (user_id, box_id, qty, value) values ($1,$2,$3,$4)
            on conflict (user_id, box_id) do update set value = case when gift_boxes.qty + excluded.qty = 0 then excluded.value else round((gift_boxes.value * gift_boxes.qty + excluded.value * excluded.qty)::numeric / (gift_boxes.qty + excluded.qty)) end, qty = gift_boxes.qty + excluded.qty`,
            [userId, box.id, box.boxes, value]);
          result = { type: 'hop_qua', boxId: box.id, name: box.name, boxes: box.boxes, value };
        } else {
          const back = keep(box.kgEach);
          if (back > 0) for (const id of ids) await d.addProduct(q, userId, id, back);
          kept = ids.map((id) => ({ specialtyId: id, kg: back }));
        }
        await fusionLog(q, userId, box.id, success, { inputs: ids, boost, rate, result });
        return { ok: true, success, successRate: rate, result, kept, spent: extra, cash, ...(await fusionXp(q, userId, success)) };
      }
      if (recipeId === MACHINE_MERGE.id) {
        needLevel(MACHINE_MERGE.minLevel);
        if (u.role !== 'xuong') throw bad('chi_chu_xuong', 'Chỉ chủ xưởng mới ghép máy được.', 403);
        const ids = [...new Set(inputs.map((x) => Number(x)))];
        if (ids.length !== 2 || ids.some((x) => !Number.isInteger(x) || x <= 0)) throw bad('nguyen_lieu_sai', 'Hãy chọn hai máy để ghép.', 409);
        const { rows } = await q.query('select id, kind, level, origin from machines where user_id = $1 and id = any($2::bigint[]) order by id for update', [userId, ids]);
        if (rows.length !== 2 || !Object.hasOwn(MACHINES, rows[0].kind)) throw bad('khong_tim_thay', 'Không tìm thấy máy.', 404);
        const [m1, m2] = rows, kind = m1.kind as MachineKind;
        if (m1.kind !== m2.kind || m1.level !== m2.level || (m1.origin ?? null) !== (m2.origin ?? null)) throw bad('nguyen_lieu_sai', 'Hai máy phải cùng loại, cùng cấp và cùng xuất xứ.', 409);
        if (!MACHINES[kind].slots) throw bad('khong_nang_duoc', 'Máy phụ trợ không ghép được.', 409);
        if (m1.level >= MACHINE_MAX_LEVEL) throw bad('cap_toi_da', 'Hai máy đã ở cấp cao nhất.', 409);
        const busy = await q.query('select 1 from process_jobs where user_id = $1 and machine_id = any($2::bigint[]) limit 1', [userId, ids]);
        if (busy.rows[0]) throw bad('may_dang_chay', 'Hãy lấy hết mẻ đang chạy trên hai máy trước khi ghép.', 409);
        const parts = Math.round((machineUpgradeCost(kind, m1.level) * MACHINE_MERGE.partsRatio) / 1000) * 1000;
        const extra = parts + (boost ? boostCost(parts) : 0), rate = fusionRate(MACHINE_MERGE.successRate, u.level, boost);
        const cash = await pay(q, userId, extra, `ghep_may:${kind}`, 'mua linh kiện');
        const success = roll(rate, userId);
        let result: unknown = null;
        if (success) {
          await q.query('delete from machines where id = $1', [m2.id]);
          await q.query('update machines set level = level + 1 where id = $1', [m1.id]);
          result = { type: 'may', machineId: Number(m1.id), kind, level: m1.level + 1, removedMachineId: Number(m2.id) };
        }
        await fusionLog(q, userId, MACHINE_MERGE.id, success, { inputs: ids, boost, rate, result });
        return { ok: true, success, successRate: rate, result, kept: success ? null : [{ machineId: Number(m1.id) }, { machineId: Number(m2.id) }], spent: extra, cash, ...(await fusionXp(q, userId, success)) };
      }
      throw bad('khong_tim_thay', 'Không có công thức dung hợp này.', 404);
    });
  });

  /** Bán hộp quà: doanh nghiệp quà tặng mua đủ giá; xuất khẩu được thêm 20% nhưng cần gom đủ số hộp và đủ cấp. */
  app.post('/api/fusion/boxes/sell', async (req) => {
    const userId = await requireUser(req), b = body(req), box = giftBox(b.boxId), qty = num(b.qty, 1, 100_000, 'qty');
    const channel = b.channel === 'xuat_khau' ? 'xuat_khau' : 'doanh_nghiep';
    if (!box) throw bad('du_lieu_sai', 'Loại hộp quà không tồn tại.');
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const u = await userOf(q, userId);
      const { rows } = await q.query('select qty, value from gift_boxes where user_id = $1 and box_id = $2 for update', [userId, box.id]);
      if (!rows[0] || rows[0].qty < qty) throw bad('khong_du_hang', 'Bạn không có đủ hộp quà.', 409);
      if (channel === 'xuat_khau') {
        if (u.level < BOX_EXPORT_LEVEL) throw bad('chua_du_cap', `Cần đạt cấp ${BOX_EXPORT_LEVEL} mới xuất khẩu hộp quà.`, 409);
        if (qty < BOX_EXPORT_MIN) throw bad('lo_hang_sai', `Xuất khẩu hộp quà cần gom ít nhất ${BOX_EXPORT_MIN} hộp một lô.`, 409);
      }
      const unit = Math.round((Number(rows[0].value) * (channel === 'xuat_khau' ? 1 + BOX_EXPORT_BONUS : 1)) / 100) * 100, total = unit * qty;
      await q.query('update gift_boxes set qty = qty - $3 where user_id = $1 and box_id = $2', [userId, box.id, qty]);
      await addCash(q, userId, total, `ban_hop_qua:${box.id}:${channel}`);
      const xp = await addXp(q, userId, xpFor('ban_hop_qua', total), 'ban_hop_qua');
      return { ok: true, boxId: box.id, qty, channel, unitPrice: unit, total, cash: u.cash + total, ...xp };
    });
  });

  // ---------------------------------------------------------------- túi giống lai (cho màn chọn giống khi trồng)
  app.get('/api/seeds', async (req) => {
    const userId = await requireUser(req);
    const { rows } = await db.query('select specialty_id, trait, qty from user_seeds where user_id = $1 and qty > 0 order by specialty_id, trait', [userId]);
    return { seeds: rows.filter((r) => SPECIALTIES[r.specialty_id] && isSeedTrait(r.trait)).map((r) => ({ specialtyId: r.specialty_id as string, regionId: SPECIALTIES[r.specialty_id].regionId, trait: r.trait as SeedTrait, qty: r.qty as number,
      name: `${SPECIALTIES[r.specialty_id].name} · ${SEED_TRAITS[r.trait as SeedTrait].name.toLowerCase()}`, emoji: SEED_TRAITS[r.trait as SeedTrait].emoji, effect: SEED_TRAITS[r.trait as SeedTrait].effect })) };
  });

  // ---------------------------------------------------------------- endpoint thử (chỉ tài khoản thử nghiệm)
  const requireTester = d.requireTester;
  if (requireTester) {
    app.post('/api/test/xp', async (req) => {
      const userId = await requireTester(req), value = num(body(req).value, 0, 10_000_000, 'value');
      await db.query('update users set xp = $2 where id = $1', [userId, value]);
      const lv = levelOf(value);
      return { xp: lv.xp, level: lv.level, title: lv.title };
    });
    app.post('/api/test/product', async (req) => {
      const userId = await requireTester(req), b = body(req), id = String(b.specialtyId ?? '');
      if (!SPECIALTIES[id]) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
      await db.tx((q) => d.addProduct(q, userId, id, num(b.kg, 1, 100_000, 'kg')));
      return { ok: true };
    });
    app.post('/api/test/fusion-luck', async (req) => {
      const userId = await requireTester(req), mode = body(req).mode;
      if (mode === 'luon_dat') forced.set(userId, true); else if (mode === 'luon_hong') forced.set(userId, false); else forced.delete(userId);
      return { mode: forced.has(userId) ? (forced.get(userId) ? 'luon_dat' : 'luon_hong') : 'ngau_nhien' };
    });
    app.post('/api/test/import-arrive', async (req) => {
      const userId = await requireTester(req);
      const { rowCount } = await db.query(`update machine_imports set port_at = now() - interval '3 seconds', cleared_at = now() - interval '2 seconds', arrive_at = now() - interval '1 second' where user_id = $1 and installed_at is null`, [userId]);
      return { ok: true, orders: rowCount ?? 0 };
    });
  }
}

/** Dùng một gói giống lai khi trồng; trả về false nếu không có gói nào. */
export async function useSeed(q: Q, userId: number, specialtyId: string, trait: string): Promise<boolean> {
  const { rowCount } = await q.query('update user_seeds set qty = qty - 1 where user_id = $1 and specialty_id = $2 and trait = $3 and qty > 0', [userId, specialtyId, trait]);
  return !!rowCount;
}
