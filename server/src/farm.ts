// Nông trại quy mô lớn: cánh đồng theo khối 100 ô, máy nông nghiệp, drone, trực thăng tham quan. Đăng ký từ app.ts qua registerFarm.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { CROPS, REGIONS, SPECIALTIES } from '../../shared/catalog.ts';
import type { Quality } from '../../shared/rules.ts';
import { IN_SEASON_YIELD, landFees, levelOf, qualityFromLate } from '../../shared/rules.ts';
import { xpFor } from '../../shared/progress.ts';
import type { XpSource } from '../../shared/progress.ts';
import {
  FARM_MACHINES, FARM_MACHINE_KINDS, FIELD_BLOCK_TILES, FIELD_MAX_BLOCKS_PER_FIELD, FIELD_MIN_LEVEL, FIELD_RESALE, HELI_TOUR_FEE, HELI_TOUR_MIN_LEVEL,
  METHOD_NAMES, ROBOT_MIN_LEVEL, WORK_METHODS, WORK_NAMES, driveMachineFor, driveSpeedOk, driveTileCap, fieldPhase, fieldBlockPrice, fieldColor, fieldMaxBlocks, fieldRegionAllowed, fieldSeedCost, fieldStepWaitMs, fieldSteps, fieldYieldKg, methodsFor, workPlan,
} from '../../shared/farm.ts';
import { issueLot, lotsLeft } from './land.ts';
import type { FarmMachineKind, WorkMethod } from '../../shared/farm.ts';

type Xp = { xpGained: number; xp: number; level: number; title: string; levelUp: boolean };
type EnergyOut = { energy: number; energyMax: number; energyFullAt: number | null };
export interface FarmDeps {
  db: Db;
  timeScale: number;
  lateGraceMs: number;
  requireUser: (req: FastifyRequest) => Promise<number>;
  requireTester: (req: FastifyRequest) => Promise<number>;
  bad: (code: string, message: string, status?: number) => Error;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
  addXp: (q: Q, userId: number, n: number, source?: XpSource) => Promise<Xp>;
  addInventory: (q: Q, userId: number, specialtyId: string, ql: Quality, kg: number) => Promise<void>;
  spendEnergy: (q: Q, userId: number, cost: number, what: string) => Promise<EnergyOut>;
  /** Hệ số thời tiết của vùng (1 = bình thường; mưa chậm, nắng gắt nhanh). */
  weatherGrowth: (regionId: string, now: number) => number;
  inSeason: (cropId: string, now: number) => boolean;
}

const HOUR = 3600_000;

export function registerFarm(app: FastifyInstance, d: FarmDeps) {
  const { db, bad } = d;
  const hours = (h: number) => Math.max(1000, Math.round((h * HOUR) / d.timeScale));

  async function userInfo(q: Q, userId: number, lock = false) {
    const { rows } = await q.query(`select cash, xp, role, home_region_id from users where id = $1${lock ? ' for update' : ''}`, [userId]);
    const u = rows[0];
    return { cash: Number(u.cash), level: levelOf(u.xp).level, role: u.role as string | null, home: u.home_region_id as string | null };
  }
  const machinesOf = async (q: Q, userId: number) =>
    (await q.query('select kind, busy_until from farm_machines where user_id = $1', [userId])).rows
      .filter((r) => Object.hasOwn(FARM_MACHINES, r.kind))
      .map((r) => ({ kind: r.kind as FarmMachineKind, busyUntil: r.busy_until ? new Date(r.busy_until).getTime() : 0 }));

  /** Chốt các lượt làm đã xong: sang bước kế, hoặc thu hoạch vào kho. Gọi ở đầu mọi lệnh. */
  async function settle(q: Q, userId: number) {
    const now = Date.now();
    const { rows } = await q.query(
      `select j.id, j.field_id, j.step_index, j.late, j.ends_at, f.region_id, f.blocks, f.specialty_id, f.late_count
       from field_jobs j join fields f on f.id = j.field_id
       where j.user_id = $1 and not j.done and j.ends_at <= $2 order by j.ends_at for update of j, f`, [userId, new Date(now)]);
    const out: { fieldId: number; harvested?: { specialtyId: string; quality: Quality; kg: number; inSeason: boolean } }[] = [];
    for (const j of rows) {
      await q.query('update field_jobs set done = true where id = $1', [j.id]);
      const sp = SPECIALTIES[j.specialty_id];
      if (!sp) continue;
      const steps = fieldSteps(sp.id), late = j.late_count + (j.late ? 1 : 0), end = new Date(j.ends_at).getTime();
      if (j.step_index >= steps.length - 1) {
        const season = d.inSeason(sp.crop, end), kg = fieldYieldKg(sp.crop, j.blocks * FIELD_BLOCK_TILES, season ? IN_SEASON_YIELD : 1);
        const ql = qualityFromLate(late);
        await d.addInventory(q, userId, sp.id, ql, kg);
        await q.query("update fields set specialty_id = null, step_index = 0, step_ready_at = null, late_count = 0, planted_at = null, drive_step = null, drive_done = '{}' where id = $1", [j.field_id]);
        await q.query('update users set harvests = harvests + 1 where id = $1', [userId]);
        await d.addXp(q, userId, xpFor('thu_hoach') * Math.min(10, j.blocks), 'thu_hoach');
        out.push({ fieldId: j.field_id, harvested: { specialtyId: sp.id, quality: ql, kg, inSeason: season } });
      } else {
        const wait = Math.round(fieldStepWaitMs(sp, d.timeScale) / Math.max(0.2, d.weatherGrowth(j.region_id, end)));
        await q.query('update fields set step_index = step_index + 1, step_ready_at = $2, late_count = $3, drive_step = null, drive_done = \'{}\' where id = $1', [j.field_id, new Date(end + wait), late]);
        await d.addXp(q, userId, xpFor('cham'), 'cham');
        out.push({ fieldId: j.field_id });
      }
    }
    return out;
  }

  async function fieldsOut(q: Q, userId: number) {
    const now = Date.now();
    const { rows } = await q.query(
      `select f.*, j.id as job_id, j.kind as job_kind, j.method as job_method, j.machine as job_machine, j.started_at as job_start, j.ends_at as job_end, j.step_index as job_step
       from fields f left join field_jobs j on j.field_id = f.id and not j.done where f.user_id = $1 order by f.id`, [userId]);
    const certs = new Map<number, string[]>();
    for (const r of (await q.query('select field_id, cert_no from land_lots where owner_id = $1 and field_id is not null order by id', [userId])).rows) {
      const k = Number(r.field_id); if (!certs.has(k)) certs.set(k, []); certs.get(k)!.push(r.cert_no ?? '');
    }
    return rows.map((f) => {
      const sp = f.specialty_id ? SPECIALTIES[f.specialty_id] : null, tiles = f.blocks * FIELD_BLOCK_TILES;
      const steps = sp ? fieldSteps(sp.id) : [];
      const step = sp ? steps[f.step_index] : null;
      const progress = sp ? Math.min(1, f.step_index / Math.max(1, steps.length - 1)) : 0;
      return {
        id: f.id, regionId: f.region_id, regionName: REGIONS[f.region_id]?.name ?? f.region_id, blocks: f.blocks, tiles, areaM2: tiles * 25,
        specialtyId: sp?.id ?? null, name: sp?.name ?? null, cropId: sp?.crop ?? null, emoji: sp ? CROPS[sp.crop].emoji : null,
        stepIndex: f.step_index, stepCount: steps.length, steps: steps.map((s) => s.name),
        step: step ? { name: step.name, kind: step.kind, work: WORK_NAMES[step.kind], methods: methodsFor(step.kind), harvest: f.step_index >= steps.length - 1 } : null,
        readyAt: f.step_ready_at ? new Date(f.step_ready_at).getTime() : null, ready: !!f.step_ready_at && new Date(f.step_ready_at).getTime() <= now && !f.job_id,
        lateCount: f.late_count, expectKg: sp ? fieldYieldKg(sp.crop, tiles) : 0, progress, color: fieldColor(sp?.crop ?? null, progress),
        job: f.job_id ? { id: f.job_id, kind: f.job_kind, method: f.job_method, machine: f.job_machine, startedAt: new Date(f.job_start).getTime(), endsAt: new Date(f.job_end).getTime(), step: f.job_step } : null,
        phase: fieldPhase(sp?.id ?? null, f.step_index), certNos: certs.get(Number(f.id)) ?? [],
        drive: f.drive_step !== null && f.drive_step === f.step_index ? { done: (f.drive_done as number[]).length, tiles: f.drive_done as number[] } : null,
        pricePaid: Number(f.price_paid), resale: Math.round((Number(f.price_paid) * FIELD_RESALE) / 1000) * 1000,
      };
    });
  }

  app.get('/api/fields', async (req) => {
    const userId = await d.requireUser(req);
    return db.tx(async (q) => {
      const done = await settle(q, userId);
      const u = await userInfo(q, userId);
      const fields = await fieldsOut(q, userId), owned = await machinesOf(q, userId);
      const usedBlocks = fields.reduce((s, f) => s + f.blocks, 0), maxBlocks = fieldMaxBlocks(u.level);
      const regions = Object.values(REGIONS).filter((r) => fieldRegionAllowed(u.level, r.id, u.home))
        .map((r) => ({ id: r.id, name: r.name, province: r.province, blockPrice: fieldBlockPrice(r.id), home: r.id === u.home }));
      return {
        level: u.level, role: u.role, cash: u.cash, canOwn: u.role === 'nong_dan' && maxBlocks > 0,
        whyNot: u.role !== 'nong_dan' ? 'Cánh đồng lớn dành cho Nhà nông (chủ xưởng mở rộng bằng máy móc, thương lái bằng xe lớn).' : maxBlocks === 0 ? `Mở từ cấp ${FIELD_MIN_LEVEL}.` : null,
        usedBlocks, maxBlocks, maxPerField: FIELD_MAX_BLOCKS_PER_FIELD, blockTiles: FIELD_BLOCK_TILES, regions, fields, settled: done,
        machines: owned.map((m) => ({ ...FARM_MACHINES[m.kind], busyUntil: m.busyUntil > Date.now() ? m.busyUntil : null })),
        heli: { own: owned.some((m) => m.kind === 'truc_thang'), fee: HELI_TOUR_FEE, minLevel: HELI_TOUR_MIN_LEVEL },
      };
    });
  });

  app.post('/api/fields/buy', async (req) => {
    const userId = await d.requireUser(req);
    const body = (req.body ?? {}) as { regionId?: unknown; blocks?: unknown };
    const regionId = String(body.regionId ?? ''), blocks = Number(body.blocks);
    if (!Number.isInteger(blocks) || blocks < 1 || blocks > FIELD_MAX_BLOCKS_PER_FIELD) throw bad('du_lieu_sai', `Mỗi cánh đồng từ 1 đến ${FIELD_MAX_BLOCKS_PER_FIELD} khối.`, 400);
    return db.tx(async (q) => {
      const u = await userInfo(q, userId, true);
      if (u.role !== 'nong_dan') throw bad('chi_nha_nong', 'Cánh đồng lớn dành cho Nhà nông.', 403);
      const max = fieldMaxBlocks(u.level);
      if (!max) throw bad('chua_du_cap', `Mua cánh đồng từ cấp ${FIELD_MIN_LEVEL}.`, 409);
      if (!fieldRegionAllowed(u.level, regionId, u.home)) throw bad('khac_vung', 'Chỉ mua được ruộng ở vùng nhà; từ cấp 10 mới mua ở vùng khác.', 409);
      const used = Number((await q.query('select coalesce(sum(blocks),0)::int as n from fields where user_id = $1', [userId])).rows[0].n);
      if (used + blocks > max) throw bad('vuot_han_muc', `Cấp ${u.level} được giữ tối đa ${max} khối (${max * FIELD_BLOCK_TILES} ô); bạn đang có ${used}.`, 409);
      const price = blocks * fieldBlockPrice(regionId), fees = landFees(price), total = price + fees.total;
      if (u.cash < total) throw bad('khong_du_tien', 'Không đủ tiền mua ruộng (tính cả lệ phí trước bạ).', 409);
      // mỗi khối là một thửa đất nông nghiệp trong quỹ đất của tỉnh (sổ địa chính, server/src/land.ts)
      const province = REGIONS[regionId].province, left = await lotsLeft(q, province, 'nong_nghiep');
      if (left < blocks) throw bad('het_dat', `${province} chỉ còn ${left} thửa đất nông nghiệp trong quỹ đất đợt này.`, 409);
      await d.addCash(q, userId, -total, `mua ${blocks} khối ruộng`);
      const { rows } = await q.query('insert into fields (user_id, region_id, blocks, price_paid) values ($1,$2,$3,$4) returning id', [userId, regionId, blocks, price]);
      for (let i = 0; i < blocks; i++) await issueLot(q, userId, province, 'nong_nghiep', price / blocks, Number(rows[0].id));
      const xp = await d.addXp(q, userId, xpFor('mua_dat'), 'mua_dat');
      return { ok: true, fieldId: rows[0].id, price, fees, total, cash: u.cash - total, ...xp };
    });
  });

  app.post('/api/fields/:id/sell', async (req) => {
    const userId = await d.requireUser(req);
    const id = Number((req.params as { id: string }).id);
    return db.tx(async (q) => {
      await settle(q, userId);
      const { rows } = await q.query('select * from fields where id = $1 and user_id = $2 for update', [id, userId]);
      const f = rows[0];
      if (!f) throw bad('khong_tim_thay', 'Không tìm thấy cánh đồng.', 404);
      if (f.specialty_id) throw bad('dang_trong', 'Cánh đồng đang có cây; thu hoạch xong mới bán được.', 409);
      const refund = Math.round((Number(f.price_paid) * FIELD_RESALE) / 1000) * 1000;
      await q.query('delete from field_jobs where field_id = $1', [id]);
      await q.query('delete from land_lots where field_id = $1', [id]); // trả thửa về quỹ đất
      await q.query('delete from fields where id = $1', [id]);
      await d.addCash(q, userId, refund, 'bán ruộng');
      return { ok: true, refund };
    });
  });

  app.post('/api/fields/:id/plant', async (req) => {
    const userId = await d.requireUser(req);
    const id = Number((req.params as { id: string }).id);
    const specialtyId = String((req.body as { specialtyId?: unknown } | undefined)?.specialtyId ?? '');
    const sp = SPECIALTIES[specialtyId];
    if (!sp) throw bad('du_lieu_sai', 'Giống không hợp lệ.', 400);
    return db.tx(async (q) => {
      await settle(q, userId);
      const { rows } = await q.query('select * from fields where id = $1 and user_id = $2 for update', [id, userId]);
      const f = rows[0];
      if (!f) throw bad('khong_tim_thay', 'Không tìm thấy cánh đồng.', 404);
      if (f.specialty_id) throw bad('dang_trong', 'Cánh đồng đang có cây.', 409);
      if (sp.regionId !== f.region_id) throw bad('khac_vung', `Ruộng ở ${REGIONS[f.region_id]?.name} chỉ trồng đặc sản của vùng đó.`, 409);
      const tiles = f.blocks * FIELD_BLOCK_TILES, cost = fieldSeedCost(sp, tiles);
      const u = await userInfo(q, userId, true);
      if (u.cash < cost) throw bad('khong_du_tien', `Cần ${cost.toLocaleString('vi-VN')}đ tiền giống.`, 409);
      await d.addCash(q, userId, -cost, `giống ${sp.name} cho ${tiles} ô ruộng`);
      // bước đầu (làm đất) tính là việc kế tiếp phải làm ngay: gieo xong thì sang các bước chăm
      await q.query('update fields set specialty_id = $2, step_index = 0, step_ready_at = now(), late_count = 0, planted_at = now() where id = $1', [id, sp.id]);
      const xp = await d.addXp(q, userId, xpFor('trong'), 'trong');
      return { ok: true, cost, cash: u.cash - cost, ...xp };
    });
  });

  async function doWork(req: FastifyRequest, forceHarvest: boolean) {
    const userId = await d.requireUser(req);
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { step?: unknown; method?: unknown };
    return db.tx(async (q) => {
      await settle(q, userId);
      const { rows } = await q.query('select * from fields where id = $1 and user_id = $2 for update', [id, userId]);
      const f = rows[0];
      if (!f) throw bad('khong_tim_thay', 'Không tìm thấy cánh đồng.', 404);
      if (!f.specialty_id) throw bad('chua_trong', 'Cánh đồng chưa trồng gì.', 409);
      const job = (await q.query('select id from field_jobs where field_id = $1 and not done', [id])).rows[0];
      if (job) throw bad('dang_lam', 'Cánh đồng đang có việc làm dở.', 409);
      const steps = fieldSteps(f.specialty_id), step = steps[f.step_index];
      if (forceHarvest && f.step_index < steps.length - 1) throw bad('chua_den_luc', 'Chưa tới lúc thu hoạch.', 409);
      if (body.step !== undefined && Number(body.step) !== f.step_index) throw bad('sai_buoc', `Bước cần làm bây giờ là "${step.name}".`, 409);
      const now = Date.now(), ready = new Date(f.step_ready_at).getTime();
      if (now < ready) throw bad('chua_den_luc', 'Chưa đến lúc làm bước này.', 409);
      const method = ((WORK_METHODS as string[]).includes(String(body.method)) ? body.method : 'thue') as WorkMethod;
      const owned = await machinesOf(q, userId), allTiles = f.blocks * FIELD_BLOCK_TILES;
      // đã tự lái máy làm được một phần bước này: phần còn lại mới tính tiền, tính giờ
      const drove = f.drive_step === f.step_index ? (f.drive_done as number[]).length : 0, tiles = Math.max(1, allTiles - drove);
      if (method === 'robot' && levelOf((await q.query('select xp from users where id = $1', [userId])).rows[0].xp).level < ROBOT_MIN_LEVEL)
        throw bad('chua_du_cap', `Thuê robot làm vườn từ cấp ${ROBOT_MIN_LEVEL}.`, 409);
      const plan = workPlan(step.kind, method, tiles, owned.map((m) => m.kind));
      if (!plan.ok) throw bad('khong_lam_duoc', plan.why!, 409);
      if (method === 'drone' && (await q.query('select home_region_id from users where id = $1', [userId])).rows[0].home_region_id !== f.region_id)
        throw bad('ngoai_tam_bay', 'Drone chỉ bay cánh đồng ở vùng nhà của bạn.', 409);
      // máy (và chính bạn khi tự làm) chỉ ở một nơi một lúc: lượt mới bắt đầu khi máy rảnh
      let start = now;
      if (plan.machine) start = Math.max(now, owned.find((m) => m.kind === plan.machine)?.busyUntil ?? 0);
      if (method === 'tay') {
        const mine = (await q.query("select max(ends_at) as t from field_jobs where user_id = $1 and method = 'tay' and not done", [userId])).rows[0].t;
        if (mine) start = Math.max(start, new Date(mine).getTime());
      }
      const u = await userInfo(q, userId, true);
      if (u.cash < plan.cost) throw bad('khong_du_tien', `Cần ${plan.cost.toLocaleString('vi-VN')}đ.`, 409);
      const en = plan.energy > 0 ? await d.spendEnergy(q, userId, plan.energy, `${WORK_NAMES[step.kind].toLowerCase()} ${tiles} ô ruộng`) : null;
      if (plan.cost) await d.addCash(q, userId, -plan.cost, `${METHOD_NAMES[method]}: ${step.name} (${tiles} ô)`);
      const ends = start + hours(plan.hours), late = start > ready + d.lateGraceMs;
      const ins = await q.query(
        'insert into field_jobs (field_id, user_id, step_index, kind, method, machine, started_at, ends_at, cost, late) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id',
        [id, userId, f.step_index, step.kind, method, plan.machine ?? null, new Date(start), new Date(ends), plan.cost, late]);
      if (plan.machine) await q.query('update farm_machines set busy_until = $3 where user_id = $1 and kind = $2', [userId, plan.machine, new Date(ends)]);
      return { ok: true, jobId: ins.rows[0].id, step: step.name, kind: step.kind, method, machine: plan.machine ?? null, cost: plan.cost, startsAt: start, endsAt: ends, late, cash: u.cash - plan.cost, ...(en ?? {}) };
    });
  }
  app.post('/api/fields/:id/work', (req) => doWork(req, false));
  app.post('/api/fields/:id/harvest', (req) => doWork(req, true));

  /**
   * Tự lái máy trên ruộng: giao diện gửi theo lô các ô giàn cày/gieo/gặt vừa đi qua, kèm quãng đường và thời gian của đoạn lái.
   * Máy chủ kiểm: đúng máy cho việc của bước, bước đã tới giờ, không có lượt khác đang làm, tốc độ và số ô hợp với quãng đường.
   * Đủ hết ô thì bước xong ngay (như một lượt làm máy kết thúc lúc này) và cánh đồng sang bước kế.
   */
  app.post('/api/fields/:id/drive', async (req) => {
    const userId = await d.requireUser(req);
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { step?: unknown; tiles?: unknown; meters?: unknown; seconds?: unknown };
    const meters = Number(body.meters), seconds = Number(body.seconds);
    const raw = Array.isArray(body.tiles) ? body.tiles : null;
    if (!raw || raw.length > 400 || !Number.isFinite(meters) || !Number.isFinite(seconds)) throw bad('du_lieu_sai', 'Dữ liệu lái máy không hợp lệ.', 400);
    if (!driveSpeedOk(meters, seconds)) throw bad('qua_nhanh', 'Máy không chạy nhanh vậy được.', 409);
    return db.tx(async (q) => {
      await settle(q, userId);
      const f = (await q.query('select * from fields where id = $1 and user_id = $2 for update', [id, userId])).rows[0];
      if (!f) throw bad('khong_tim_thay', 'Không tìm thấy cánh đồng.', 404);
      if (!f.specialty_id) throw bad('chua_trong', 'Cánh đồng chưa trồng gì.', 409);
      if (body.step !== undefined && Number(body.step) !== f.step_index) throw bad('sai_buoc', 'Cánh đồng đã sang bước khác.', 409);
      if ((await q.query('select 1 from field_jobs where field_id = $1 and not done', [id])).rowCount) throw bad('dang_lam', 'Cánh đồng đang có việc làm dở.', 409);
      const steps = fieldSteps(f.specialty_id), step = steps[f.step_index], now = Date.now(), ready = new Date(f.step_ready_at).getTime();
      if (now < ready) throw bad('chua_den_luc', 'Chưa đến lúc làm bước này.', 409);
      const owned = await machinesOf(q, userId), mk = driveMachineFor(step.kind, owned.map((m) => m.kind));
      if (!mk) throw bad('khong_lai_duoc', `Việc "${WORK_NAMES[step.kind]}" không có máy nào của bạn lái được.`, 409);
      const busy = owned.find((m) => m.kind === mk)?.busyUntil ?? 0;
      if (busy > now) throw bad('may_ban', 'Máy đang chạy ở cánh đồng khác.', 409);
      const total = f.blocks * FIELD_BLOCK_TILES;
      const prev: number[] = f.drive_step === f.step_index ? f.drive_done : [];
      const have = new Set(prev), fresh: number[] = [];
      for (const v of raw) { const t = Number(v); if (Number.isInteger(t) && t >= 0 && t < total && !have.has(t)) { have.add(t); fresh.push(t); } }
      if (fresh.length > driveTileCap(meters)) throw bad('qua_nhieu_o', 'Số ô vượt quá bề rộng giàn máy trên quãng đường đã đi.', 409);
      const m = FARM_MACHINES[mk], cost = Math.round(fresh.length * m.costPerTile);
      if (cost) {
        const u = await userInfo(q, userId, true);
        if (u.cash < cost) throw bad('khong_du_tien', 'Không đủ tiền dầu cho máy.', 409);
        await d.addCash(q, userId, -cost, `dầu máy ${m.name.toLowerCase()} ${fresh.length} ô`);
      }
      const done = [...prev, ...fresh];
      let finished = false;
      if (done.length >= total) {
        // đủ ô: ghi một lượt làm máy kết thúc ngay để settle chuyển bước như mọi lượt khác
        const late = now > ready + d.lateGraceMs;
        await q.query('insert into field_jobs (field_id, user_id, step_index, kind, method, machine, started_at, ends_at, cost, late) values ($1,$2,$3,$4,\'may\',$5,$6,$6,0,$7)',
          [id, userId, f.step_index, step.kind, mk, new Date(now - 1), late]);
        await q.query("update fields set drive_step = null, drive_done = '{}' where id = $1", [id]);
        await settle(q, userId);
        finished = true;
      } else {
        await q.query('update fields set drive_step = $2, drive_done = $3 where id = $1', [id, f.step_index, done]);
      }
      return { ok: true, machine: mk, added: fresh.length, done: finished ? total : done.length, total, finished, cost };
    });
  });

  app.get('/api/farm/machines', async (req) => {
    const userId = await d.requireUser(req);
    return db.tx(async (q) => {
      const u = await userInfo(q, userId), owned = await machinesOf(q, userId);
      return {
        level: u.level, cash: u.cash,
        catalog: FARM_MACHINE_KINDS.map((k) => {
          const m = FARM_MACHINES[k], has = owned.find((o) => o.kind === k);
          const why = has ? 'Đã có' : u.role !== 'nong_dan' ? 'Dành cho Nhà nông' : u.level < m.minLevel ? `Cần cấp ${m.minLevel}` : u.cash < m.price ? 'Chưa đủ tiền' : null;
          return { ...m, owned: !!has, busyUntil: has && has.busyUntil > Date.now() ? has.busyUntil : null, canBuy: !why, why };
        }),
      };
    });
  });

  app.post('/api/farm/machines/buy', async (req) => {
    const userId = await d.requireUser(req);
    const kind = String((req.body as { kind?: unknown } | undefined)?.kind ?? '') as FarmMachineKind;
    const m = FARM_MACHINES[kind];
    if (!m) throw bad('du_lieu_sai', 'Máy không hợp lệ.', 400);
    return db.tx(async (q) => {
      const u = await userInfo(q, userId, true);
      if (u.role !== 'nong_dan') throw bad('chi_nha_nong', 'Máy nông nghiệp dành cho Nhà nông.', 403);
      if (u.level < m.minLevel) throw bad('chua_du_cap', `${m.name} mở từ cấp ${m.minLevel}.`, 409);
      if ((await q.query('select 1 from farm_machines where user_id = $1 and kind = $2', [userId, kind])).rowCount) throw bad('da_co', 'Bạn đã có máy này.', 409);
      if (u.cash < m.price) throw bad('khong_du_tien', 'Không đủ tiền mua máy.', 409);
      await d.addCash(q, userId, -m.price, `mua ${m.name}`);
      await q.query('insert into farm_machines (user_id, kind) values ($1,$2)', [userId, kind]);
      const xp = await d.addXp(q, userId, xpFor('mua_may'), 'mua_may');
      return { ok: true, kind, price: m.price, cash: u.cash - m.price, ...xp };
    });
  });

  app.post('/api/farm/heli/tour', async (req) => {
    const userId = await d.requireUser(req);
    const want = (req.body as { fieldIds?: unknown } | undefined)?.fieldIds;
    return db.tx(async (q) => {
      await settle(q, userId);
      const u = await userInfo(q, userId, true);
      const own = (await q.query("select 1 from farm_machines where user_id = $1 and kind = 'truc_thang'", [userId])).rowCount! > 0;
      if (!own && u.level < HELI_TOUR_MIN_LEVEL) throw bad('chua_du_cap', `Thuê trực thăng tham quan từ cấp ${HELI_TOUR_MIN_LEVEL}.`, 409);
      let fields = await fieldsOut(q, userId);
      if (Array.isArray(want) && want.length) fields = fields.filter((f) => want.map(Number).includes(f.id));
      if (!fields.length) throw bad('chua_co_ruong', 'Bạn chưa có cánh đồng nào để bay tham quan.', 409);
      const fee = own ? 0 : HELI_TOUR_FEE;
      if (u.cash < fee) throw bad('khong_du_tien', 'Không đủ tiền thuê trực thăng.', 409);
      if (fee) await d.addCash(q, userId, -fee, 'thuê trực thăng tham quan ruộng');
      return { ok: true, fee, own, cash: u.cash - fee, fields: fields.map((f) => ({ id: f.id, regionName: f.regionName, blocks: f.blocks, cropId: f.cropId, emoji: f.emoji, name: f.name, progress: f.progress, color: f.color, stepName: f.step?.name ?? null, job: f.job ? { kind: f.job.kind, method: f.job.method } : null })) };
    });
  });

  // Kiểm thử: cấp ruộng và máy ngay, tua cho lượt làm xong.
  app.post('/api/test/field', async (req) => {
    const userId = await d.requireTester(req);
    const body = (req.body ?? {}) as { blocks?: unknown; machines?: unknown; finishJobs?: unknown; readyNow?: unknown };
    return db.tx(async (q) => {
      const u = await userInfo(q, userId);
      let fieldId: number | null = null;
      if (body.blocks) {
        const n = Math.min(FIELD_MAX_BLOCKS_PER_FIELD, Math.max(1, Number(body.blocks)));
        fieldId = (await q.query('insert into fields (user_id, region_id, blocks, price_paid) values ($1,$2,$3,0) returning id', [userId, u.home, n])).rows[0].id;
        const province = u.home ? REGIONS[u.home]?.province : null; // mỗi khối cũng là một thửa có sổ như khi mua thật
        if (province) for (let i = 0; i < n; i++) await issueLot(q, userId, province, 'nong_nghiep', 0, Number(fieldId));
      }
      if (Array.isArray(body.machines)) for (const k of body.machines) if (Object.hasOwn(FARM_MACHINES, String(k))) await q.query('insert into farm_machines (user_id, kind) values ($1,$2) on conflict do nothing', [userId, String(k)]);
      if (body.finishJobs) await q.query('update field_jobs set ends_at = now() - interval \'1 second\' where user_id = $1 and not done', [userId]);
      if (body.readyNow) await q.query('update fields set step_ready_at = now() - interval \'1 second\' where user_id = $1 and specialty_id is not null', [userId]);
      if (body.finishJobs) await q.query('update farm_machines set busy_until = null where user_id = $1', [userId]);
      return { ok: true, fieldId };
    });
  });
}
