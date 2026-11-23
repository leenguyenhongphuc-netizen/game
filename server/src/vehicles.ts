// Xe chở hàng (mua, bán, chọn xe), giấy phép lái xe, xe điện, trạm dừng nghỉ. Đăng ký từ app.ts qua registerVehicles.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { levelOf, roadKm } from '../../shared/rules.ts';
import { ITEMS, ITEM_BAG_MAX } from '../../shared/items.ts';
import {
  EXAM, LICENSE_MONTH_MS, LICENSE_POINTS, LICENSE_RENEW_FEE, LICENSE_TERM_YEARS, LICENSE_YEAR_MS, needsYard, renewMode,
  CHARGE, DEFAULT_VEHICLE, DRIVE_RULES, ENERGY_PRICE, LICENSES, LICENSE_ORDER, POWER_NAMES, TOLL_GROUP_NAMES, VEHICLES, VEHICLE_MAX_OWNED, VEHICLE_RESALE,
  licenseCovers, parkPrice, rangeKm, restStopItems, roadPrice, tripPlanFor, truckOf, unitOf,
} from '../../shared/vehicles.ts';
import type { ExamPart, LicenseClass, TruckInfo, VehicleSpec, VehicleTripPlan } from '../../shared/vehicles.ts';

type EnergyState = { cur: number; max: number; baseMs: number; now: number };
export interface VehicleDeps {
  db: Db;
  requireUser: (req: FastifyRequest) => Promise<number>;
  requireTester: (req: FastifyRequest) => Promise<number>;
  bad: (code: string, message: string, status?: number) => Error;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
  energyState: (q: Q, userId: number, lock?: boolean) => Promise<EnergyState>;
  setEnergy: (q: Q, userId: number, e: EnergyState, value: number) => Promise<{ energy: number; energyMax: number; energyFullAt: number | null }>;
  bagOf: (q: Q, userId: number) => Promise<{ itemId: string; qty: number }[]>;
  licenseTimeScale?: number;
  /** Kiểm thử: chia thời gian làm bài tối thiểu. */
  examHurry?: number;
}
const round1 = (v: number) => Math.round(v * 10) / 10;

export function registerVehicles(app: FastifyInstance, d: VehicleDeps) {
  const { db, bad } = d;
  const licensesOf = async (q: Q, userId: number): Promise<string[]> =>
    (await q.query('select cls from user_licenses where user_id = $1', [userId])).rows.map((r) => r.cls as string);
  const lts = Math.max(1e-9, d.licenseTimeScale ?? 1), YEAR = LICENSE_YEAR_MS / lts, MONTH = LICENSE_MONTH_MS / lts;
  const termMs = (cls: LicenseClass) => (LICENSE_TERM_YEARS[cls] === null ? null : LICENSE_TERM_YEARS[cls]! * YEAR);
  /** Cấp mới hoặc cấp lại: ngày cấp là bây giờ, hạn theo hạng, đủ 12 điểm. */
  const grantLicense = (q: Q, userId: number, cls: LicenseClass) => {
    const term = termMs(cls), exp = term === null ? null : new Date(Date.now() + term);
    return q.query(`insert into user_licenses (user_id, cls, issued_at, expires_at, points, points_at, suspended) values ($1,$2,now(),$3,$4,null,false)
      on conflict (user_id, cls) do update set issued_at = now(), expires_at = excluded.expires_at, points = excluded.points, points_at = null, suspended = false`, [userId, cls, exp, LICENSE_POINTS]);
  };
  type Lic = { cls: LicenseClass; issuedAt: number; expiresAt: number | null; expired: boolean; overdueMs: number; daysLeft: number | null; points: number; suspended: boolean };
  /** Tình trạng từng bằng đang có. Bằng cấp trước khi có hạn (expires_at trống ở hạng có thời hạn) được tính hạn từ ngày cấp. */
  async function licenseRows(q: Q, userId: number): Promise<Lic[]> {
    const now = Date.now();
    const { rows } = await q.query('select cls, issued_at, expires_at, points, points_at, suspended from user_licenses where user_id = $1', [userId]);
    return rows.filter((r) => Object.hasOwn(LICENSES, r.cls)).map((r) => {
      const cls = r.cls as LicenseClass, issuedAt = new Date(r.issued_at).getTime(), term = termMs(cls);
      const expiresAt = term === null ? null : r.expires_at ? new Date(r.expires_at).getTime() : issuedAt + term;
      // 12 "tháng" không bị trừ điểm thì phục hồi đủ điểm (bằng đang bị khoá thì không tự phục hồi).
      const restored = !r.suspended && r.points < LICENSE_POINTS && r.points_at && now - new Date(r.points_at).getTime() >= 12 * MONTH;
      return { cls, issuedAt, expiresAt, expired: expiresAt !== null && now >= expiresAt, overdueMs: expiresAt === null ? 0 : Math.max(0, now - expiresAt),
        daysLeft: expiresAt === null ? null : Math.round(((expiresAt - now) / 86400_000) * 10) / 10, points: restored ? LICENSE_POINTS : r.points, suspended: !!r.suspended };
    });
  }
  /** Bằng (còn hạn, không bị khoá) đang dùng để lái chiếc xe này; không có thì báo lỗi rõ lý do. */
  async function requireValidLicense(q: Q, userId: number, spec: VehicleSpec): Promise<Lic> {
    const mine = (await licenseRows(q, userId)).filter((l) => l.cls === spec.license || LICENSES[l.cls].includes.includes(spec.license));
    const ok = mine.find((l) => !l.expired && !l.suspended);
    if (ok) return ok;
    const need = LICENSES[spec.license].name;
    if (!mine.length) throw bad('thieu_bang_lai', `${spec.name} cần bằng lái ${need}. Hãy thi bằng ở Bãi xe trước khi lên đường.`, 409);
    if (mine.some((l) => l.suspended)) throw bad('bang_bi_khoa', `Bằng lái ${LICENSES[mine.find((l) => l.suspended)!.cls].name} của bạn đã bị trừ hết ${LICENSE_POINTS} điểm. Hãy thi lại lý thuyết để phục hồi điểm rồi mới được lái.`, 409);
    throw bad('bang_het_han', `Bằng lái ${LICENSES[mine[0].cls].name} của bạn đã hết hạn. Hãy đổi bằng (hoặc thi lại nếu quá hạn lâu) ở Bãi xe.`, 409);
  }
  /** Trừ điểm bằng lái sau một chuyến có vi phạm tốc độ. Hết điểm thì bằng bị tạm khoá. */
  async function deductPoints(q: Q, userId: number, spec: VehicleSpec, pts: number) {
    if (!(pts > 0)) return null;
    const lic = (await licenseRows(q, userId)).filter((l) => (l.cls === spec.license || LICENSES[l.cls].includes.includes(spec.license)) && !l.expired && !l.suspended)[0];
    if (!lic) return null;
    const left = Math.max(0, lic.points - pts), suspended = left === 0;
    await q.query('update user_licenses set points = $3, points_at = now(), suspended = $4 where user_id = $1 and cls = $2', [userId, lic.cls, left, suspended]);
    return { cls: lic.cls, name: LICENSES[lic.cls].name, deducted: lic.points - left, points: left, max: LICENSE_POINTS, suspended,
      message: suspended ? `Bằng ${LICENSES[lic.cls].name} bị trừ hết điểm và tạm khoá. Thi lại lý thuyết để phục hồi.` : `Bằng ${LICENSES[lic.cls].name} bị trừ ${lic.points - left} điểm, còn ${left}/${LICENSE_POINTS}.` };
  }
  /** Kết quả thi gần nhất còn hiệu lực (trong 1 "năm") của từng phần. */
  async function examState(q: Q, userId: number, cls: LicenseClass) {
    const since = new Date(Date.now() - YEAR);
    const { rows } = await q.query(`select part, max(score) filter (where passed) as best, max(finished_at) filter (where passed) as at, max(score) as top
      from license_exams where user_id = $1 and cls = $2 and finished_at >= $3 group by part`, [userId, cls, since]);
    const of = (part: ExamPart) => { const r = rows.find((x) => x.part === part); return { passed: !!r?.at, at: r?.at ? new Date(r.at).getTime() : null, best: r?.top ?? null, pass: EXAM[part].pass, fee: EXAM[part].fee }; };
    return { theory: of('ly_thuyet'), yard: { ...of('sa_hinh'), required: needsYard(cls) } };
  }

  /** Chiếc xe đang dùng. Thương lái (và người chơi cũ) chưa có xe thì được cấp xe tải nhẹ 990 kg cùng bằng B. */
  async function truck(q: Q, userId: number, grant = false): Promise<{ has: boolean; id: number | null; spec: VehicleSpec; tk: TruckInfo; odoKm: number }> {
    const u = (await q.query('select role, vehicle_id, fuel_l from users where id = $1', [userId])).rows[0];
    let v = u.vehicle_id ? (await q.query('select id, kind, odo_km from vehicles where id = $1 and user_id = $2', [u.vehicle_id, userId])).rows[0] : undefined;
    if (!v) {
      v = (await q.query('select id, kind, odo_km, energy from vehicles where user_id = $1 order by id limit 1', [userId])).rows[0];
      if (v) await q.query('update users set vehicle_id = $2, fuel_l = $3 where id = $1', [userId, v.id, v.energy]);
      else if (u.role === 'thuong_lai' || grant) {
        v = (await q.query('insert into vehicles (user_id, kind, energy, price_paid) values ($1,$2,$3,0) returning id, kind, odo_km', [userId, DEFAULT_VEHICLE, u.fuel_l])).rows[0];
        await q.query('update users set vehicle_id = $2 where id = $1', [userId, v.id]);
        await grantLicense(q, userId, 'B');
      }
    }
    const spec = VEHICLES[v?.kind] ?? VEHICLES[DEFAULT_VEHICLE];
    return { has: !!v, id: v ? Number(v.id) : null, spec, tk: truckOf(spec), odoKm: v ? Number(v.odo_km) : 0 };
  }
  const planFor = (spec: VehicleSpec, from: string, to: string): VehicleTripPlan => tripPlanFor(spec, from, to);
  /** Tổng kWh (hoặc lít) nạp ở các trạm dọc đường mà màn lái gửi lên trong `charges`. */
  function chargedKwh(body: Record<string, unknown>, tk: TruckInfo): number {
    const list = Array.isArray(body.charges) ? body.charges.slice(0, 12) : [];
    let sum = 0;
    for (const c of list) { const n = Number((c as any)?.kwh); if (Number.isFinite(n) && n > 0) sum += n; }
    return Math.min(tk.tankL * 100, sum);
  }
  const atHome = (u: { truck_region: string | null; home_region_id: string | null }) => !u.truck_region || u.truck_region === u.home_region_id;

  /** Việc phải làm khi một chuyến xe tới nơi: cộng công-tơ-mét, phí đăng kiểm bảo hiểm, đồ mua ở trạm dừng, mệt vì không nghỉ. */
  async function afterTrip(q: Q, userId: number, plan: VehicleTripPlan, body: Record<string, unknown>, cashIn: number) {
    let cash = cashIn;
    const road = roadKm(plan.km, plan.needsBoat);
    const odo = (await q.query('update vehicles set odo_km = odo_km + $2 where id = (select vehicle_id from users where id = $1) returning odo_km', [userId, road])).rows[0];
    const upkeepCost = Math.min(cash, plan.upkeepCost);
    if (upkeepCost > 0) { await d.addCash(q, userId, -upkeepCost, 'dang_kiem_bao_hiem'); cash -= upkeepCost; }
    const seen = new Set<number>(), bought: { atKm: number; itemId: string; qty: number; total: number; used: boolean }[] = [];
    let gained = 0, wc = 0, restCost = 0;
    for (const r of Array.isArray(body.rests) ? body.rests.slice(0, 12) : []) {
      const atKm = Number((r as any)?.atKm), stop = plan.restStops.find((s) => s.atKm === atKm);
      if (!stop || seen.has(atKm)) continue;
      seen.add(atKm);
      if ((r as any).wc === true) wc++;
      const sells = restStopItems(stop.province);
      for (const it of Array.isArray((r as any).items) ? (r as any).items.slice(0, 6) : []) {
        const itemId = String(it?.itemId ?? ''), qty = Math.floor(Number(it?.qty ?? 1));
        if (!sells.includes(itemId) || !ITEMS[itemId] || !(qty >= 1 && qty <= 10)) continue;
        const total = ITEMS[itemId].price * qty;
        if (total > cash) continue;
        const use = it?.use !== false;
        if (!use) {
          const have = (await q.query('select qty from user_items where user_id = $1 and item_id = $2 for update', [userId, itemId])).rows[0]?.qty ?? 0;
          if (have + qty > ITEM_BAG_MAX) continue;
          await q.query('insert into user_items (user_id, item_id, qty) values ($1,$2,$3) on conflict (user_id, item_id) do update set qty = user_items.qty + excluded.qty', [userId, itemId, qty]);
        } else gained += ITEMS[itemId].energy * qty;
        await d.addCash(q, userId, -total, `tram_dung:${itemId}`);
        cash -= total; restCost += total;
        bought.push({ atKm, itemId, qty, total, used: use });
      }
    }
    const missed = Math.max(0, plan.restsNeeded - seen.size), energyLost = missed * DRIVE_RULES.missedRestEnergy;
    const e = await d.energyState(q, userId, true);
    const energy = await d.setEnergy(q, userId, e, e.cur + gained + wc * DRIVE_RULES.wcEnergy - energyLost);
    return {
      cash, upkeepCost, odoKm: odo ? round1(Number(odo.odo_km)) : null,
      rests: { needed: plan.restsNeeded, taken: seen.size, missed, wc, cost: restCost, bought },
      fatigue: missed > 0 ? { missed, energyLost,
        message: `Bạn lái ${plan.driveHours} giờ mà nghỉ thiếu ${missed} lần. Luật quy định không lái liên tục quá ${DRIVE_RULES.continuousHours} giờ: lái mệt rất dễ ngủ gật. Mất thêm ${energyLost} thể lực.` } : null,
      ...energy, items: await d.bagOf(q, userId),
    };
  }

  /** Quầy ở trạm dừng nghỉ của chuyến đang chạy, cho /api/shop/buy với shopId dạng rest:<mã chuyến>:<km>. */
  async function restShop(q: Q, userId: number, shopId: string) {
    const [, tripRaw, kmRaw] = shopId.split(':');
    const t = (await q.query('select from_region, to_region from trips where id = $1 and user_id = $2 and finished_at is null', [Number(tripRaw) || 0, userId])).rows[0];
    if (!t) throw bad('khong_tim_thay', 'Bạn không ở trên chuyến xe nào để ghé trạm dừng.', 404);
    const { spec } = await truck(q, userId);
    const stop = planFor(spec, t.from_region, t.to_region).restStops.find((s) => s.atKm === Number(kmRaw));
    if (!stop) throw bad('khong_tim_thay', 'Chuyến này không có trạm dừng ở cây số đó.', 404);
    return { id: shopId, name: stop.name, items: restStopItems(stop.province).map((itemId) => ({ itemId })) };
  }

  /** Thông tin xe đang dùng, gộp vào /api/me. */
  async function meOut(q: Q, userId: number) {
    const t = await truck(q, userId);
    return { vehicle: t.has ? { id: t.id, kind: t.spec.kind, name: t.spec.name, emoji: t.spec.emoji, cargoKg: t.spec.cargoKg, power: t.spec.power, unit: unitOf(t.spec.power), tank: t.spec.tank, per100: t.spec.per100, maxKmh: t.spec.maxKmh, cold: !!t.spec.cold } : null };
  }
  /** Tài khoản thử: bảo đảm có xe và đổ đầy. */
  async function testFill(userId: number): Promise<number> {
    return db.tx(async (q) => {
      const t = await truck(q, userId, true);
      await q.query('update users set fuel_l = $2 where id = $1', [userId, t.spec.tank]);
      return t.spec.tank;
    });
  }

  // ---------------------------------------------------------------- API
  app.get('/api/vehicles', async (req) => {
    const userId = await d.requireUser(req);
    await db.tx((q) => truck(q, userId));
    const [u, owned, lic] = await Promise.all([
      db.query('select cash, xp, role, vehicle_id, fuel_l, truck_region, home_region_id from users where id = $1', [userId]),
      db.query('select id, kind, energy, odo_km, price_paid from vehicles where user_id = $1 order by id', [userId]),
      licensesOf(db, userId),
    ]);
    const licRows = await licenseRows(db, userId), licYearDays = Math.round((YEAR / 86400_000) * 1000) / 1000;
    const me = u.rows[0], level = levelOf(me.xp).level, home = atHome(me);
    const count = (kind: string) => owned.rows.filter((v) => v.kind === kind).length;
    return {
      level, cash: Number(me.cash), atHome: home, active: me.vehicle_id ? Number(me.vehicle_id) : null, maxOwned: VEHICLE_MAX_OWNED, resale: VEHICLE_RESALE,
      catalog: Object.values(VEHICLES).map((v) => {
        const why = level < v.minLevel ? `Cần cấp ${v.minLevel}` : !licenseCovers(lic, v.license) ? `Cần bằng lái ${LICENSES[v.license].name}`
          : owned.rows.length >= VEHICLE_MAX_OWNED ? `Bãi xe chỉ chứa ${VEHICLE_MAX_OWNED} chiếc` : !home ? 'Xe đang ở xa: về nhà mới nhận xe mới được' : Number(me.cash) < v.price ? 'Chưa đủ tiền' : null;
        return { ...v, unit: unitOf(v.power), powerName: POWER_NAMES[v.power], rangeKm: rangeKm(v), roadPrice: roadPrice(v.power), parkPrice: parkPrice(v.power),
          tollGroupName: TOLL_GROUP_NAMES[v.tollGroup], licenseName: LICENSES[v.license].name, owned: count(v.kind), canBuy: !why, why };
      }),
      owned: owned.rows.map((v) => {
        const spec = VEHICLES[v.kind] ?? VEHICLES[DEFAULT_VEHICLE], active = Number(v.id) === Number(me.vehicle_id);
        const energy = round1(Number(active ? me.fuel_l : v.energy));
        return { id: Number(v.id), kind: spec.kind, name: spec.name, emoji: spec.emoji, power: spec.power, unit: unitOf(spec.power), tank: spec.tank, cargoKg: spec.cargoKg,
          energy, ...(spec.power === 'dien' ? { chargeKwh: energy } : { fuelL: energy }), odoKm: round1(Number(v.odo_km)),
          regionId: active ? (me.truck_region ?? me.home_region_id) : me.home_region_id, active, resaleValue: Math.round(Number(v.price_paid) * VEHICLE_RESALE) };
      }),
      licenses: await Promise.all(LICENSE_ORDER.map(async (cls) => {
        const info = LICENSES[cls], row = licRows.find((l) => l.cls === cls), has = !!row, covered = licenseCovers(lic, cls);
        const exam = await examState(db, userId, cls);
        const ready = exam.theory.passed && (!exam.yard.required || exam.yard.passed);
        const why = has ? 'Đã có' : level < info.minLevel ? `Cần cấp ${info.minLevel}` : !exam.theory.passed ? 'Chưa đạt lý thuyết' : !ready ? 'Chưa đạt sa hình' : Number(me.cash) < info.price ? 'Chưa đủ tiền' : null;
        const mode = row ? (row.suspended ? 'thi_ly_thuyet' as const : renewMode(row.overdueMs * lts)) : null;
        return { cls, ...info, owned: has, covered, canBuy: !why, why, termYears: LICENSE_TERM_YEARS[cls],
          issuedAt: row?.issuedAt ?? null, expiresAt: row?.expiresAt ?? null, expired: row?.expired ?? false, daysLeft: row?.daysLeft ?? null,
          points: row?.points ?? null, maxPoints: LICENSE_POINTS, suspended: row?.suspended ?? false, exam,
          renew: row && (row.expiresAt !== null || row.suspended) ? { mode, fee: LICENSE_RENEW_FEE, needTheory: mode !== 'doi', needYard: mode === 'thi_lai' && needsYard(cls) } : null };
      })),
      licenseRules: { yearDays: licYearDays, points: LICENSE_POINTS, exam: EXAM, renewFee: LICENSE_RENEW_FEE },
      energyPrice: ENERGY_PRICE, charge: CHARGE, rules: DRIVE_RULES,
    };
  });

  app.post('/api/licenses/buy', async (req) => {
    const userId = await d.requireUser(req);
    const cls = String(((req.body ?? {}) as any).cls ?? '') as LicenseClass;
    if (!Object.hasOwn(LICENSES, cls)) throw bad('du_lieu_sai', 'Hạng giấy phép lái xe không hợp lệ.');
    return db.tx(async (q) => {
      const u = (await q.query('select cash, xp from users where id = $1 for update', [userId])).rows[0];
      const info = LICENSES[cls];
      if ((await licensesOf(q, userId)).includes(cls)) throw bad('da_co', `Bạn đã có bằng ${info.name}.`, 409);
      if (levelOf(u.xp).level < info.minLevel) throw bad('chua_du_cap', `Cần đạt cấp ${info.minLevel} mới được thi bằng ${info.name}.`, 409);
      const exam = await examState(q, userId, cls);
      if (!exam.theory.passed) throw bad('chua_thi_ly_thuyet', `Bạn cần đạt bài thi lý thuyết hạng ${info.name} trước (từ ${EXAM.ly_thuyet.pass}/100 điểm).`, 409);
      if (exam.yard.required && !exam.yard.passed) throw bad('chua_thi_sa_hinh', `Bạn cần đạt bài thi sa hình hạng ${info.name} (từ ${EXAM.sa_hinh.pass}/100 điểm) rồi mới được cấp bằng.`, 409);
      if (Number(u.cash) < info.price) throw bad('khong_du_tien', `Lệ phí học và cấp bằng ${info.name} là ${info.price.toLocaleString('vi-VN')}đ.`, 409);
      await d.addCash(q, userId, -info.price, `bang_lai:${cls}`);
      await grantLicense(q, userId, cls);
      return { ok: true, cls, price: info.price, cash: Number(u.cash) - info.price, licenses: await licensesOf(q, userId) };
    });
  });

  const clsOf = (v: unknown): LicenseClass => { const c = String(v ?? '') as LicenseClass; if (!Object.hasOwn(LICENSES, c)) throw bad('du_lieu_sai', 'Hạng giấy phép lái xe không hợp lệ.'); return c; };
  const partOf = (v: unknown): ExamPart => { if (v !== 'ly_thuyet' && v !== 'sa_hinh') throw bad('du_lieu_sai', 'Phần thi không hợp lệ.'); return v; };
  /** Bắt đầu một lượt thi: thu lệ phí, trả mã lượt thi để nộp kết quả. */
  app.post('/api/licenses/exam/start', async (req) => {
    const userId = await d.requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>, cls = clsOf(b.cls), part = partOf(b.part);
    return db.tx(async (q) => {
      const u = (await q.query('select cash, xp from users where id = $1 for update', [userId])).rows[0];
      const info = LICENSES[cls], ex = EXAM[part];
      if (levelOf(u.xp).level < info.minLevel) throw bad('chua_du_cap', `Cần đạt cấp ${info.minLevel} mới được thi bằng ${info.name}.`, 409);
      if (part === 'sa_hinh' && !needsYard(cls)) throw bad('khong_can_thi', `Hạng ${info.name} không phải thi sa hình trong trò chơi.`, 409);
      if (part === 'sa_hinh' && !(await examState(q, userId, cls)).theory.passed) throw bad('chua_thi_ly_thuyet', 'Phải đạt lý thuyết trước rồi mới được vào sân sa hình.', 409);
      if (Number(u.cash) < ex.fee) throw bad('khong_du_tien', `Lệ phí thi ${ex.name.toLowerCase()} là ${ex.fee.toLocaleString('vi-VN')}đ.`, 409);
      await d.addCash(q, userId, -ex.fee, `le_phi_thi:${cls}:${part}`);
      await q.query('delete from license_exams where user_id = $1 and finished_at is null', [userId]);
      const row = (await q.query('insert into license_exams (user_id, cls, part) values ($1,$2,$3) returning id', [userId, cls, part])).rows[0];
      return { ok: true, examId: Number(row.id), cls, part, fee: ex.fee, pass: ex.pass, minSeconds: ex.minSeconds, cash: Number(u.cash) - ex.fee };
    });
  });
  /** Nộp kết quả một phần thi. Lý thuyết đạt mà bằng đang bị khoá vì hết điểm thì được phục hồi điểm. */
  app.post('/api/licenses/exam', async (req) => {
    const userId = await d.requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>, cls = clsOf(b.cls), part = partOf(b.part);
    const score = Number(b.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) throw bad('du_lieu_sai', 'Điểm thi phải từ 0 đến 100.');
    return db.tx(async (q) => {
      const ex = (await q.query(`select id, started_at from license_exams where user_id = $1 and cls = $2 and part = $3 and finished_at is null ${b.examId ? 'and id = $4' : ''} order by id desc limit 1 for update`,
        b.examId ? [userId, cls, part, Number(b.examId) || 0] : [userId, cls, part])).rows[0];
      if (!ex) throw bad('chua_bat_dau', 'Bạn chưa đăng ký lượt thi này. Hãy bấm bắt đầu thi trước.', 409);
      const took = (Date.now() - new Date(ex.started_at).getTime()) / 1000;
      if (took < EXAM[part].minSeconds / Math.max(1, d.examHurry ?? 1)) throw bad('qua_nhanh', 'Bài thi nộp quá nhanh, không hợp lệ. Hãy thi lại.', 409);
      const s = Math.round(score), passed = s >= EXAM[part].pass;
      await q.query('update license_exams set finished_at = now(), score = $2, passed = $3 where id = $1', [ex.id, s, passed]);
      let restored = false;
      if (passed && part === 'ly_thuyet') restored = !!(await q.query('update user_licenses set points = $3, points_at = null, suspended = false where user_id = $1 and cls = $2 and suspended', [userId, cls, LICENSE_POINTS])).rowCount;
      return { ok: true, cls, part, score: s, pass: EXAM[part].pass, passed, restoredPoints: restored, exam: await examState(q, userId, cls) };
    });
  });
  /** Đổi bằng: còn hạn hoặc quá hạn ngắn thì đổi thẳng; quá hạn lâu phải có kết quả thi lại còn hiệu lực. */
  app.post('/api/licenses/renew', async (req) => {
    const userId = await d.requireUser(req);
    const cls = clsOf(((req.body ?? {}) as any).cls);
    return db.tx(async (q) => {
      const u = (await q.query('select cash from users where id = $1 for update', [userId])).rows[0];
      const row = (await licenseRows(q, userId)).find((l) => l.cls === cls), info = LICENSES[cls];
      if (!row) throw bad('chua_co', `Bạn chưa có bằng ${info.name} để đổi.`, 409);
      if (row.expiresAt === null) throw bad('khong_thoi_han', `Bằng ${info.name} không có thời hạn, không cần đổi.`, 409);
      if (row.suspended) throw bad('bang_bi_khoa', 'Bằng đang bị khoá vì hết điểm: thi lại lý thuyết để phục hồi trước.', 409);
      const mode = renewMode(row.overdueMs * lts);
      if (mode !== 'doi') {
        // Chỉ tính bài thi làm sau ngày hết hạn (và sau lần cấp gần nhất).
        const after = new Date(Math.max(row.expiresAt, row.issuedAt));
        const done = (await q.query(`select part from license_exams where user_id = $1 and cls = $2 and passed and finished_at >= $3`, [userId, cls, after])).rows.map((r) => r.part as string);
        if (!done.includes('ly_thuyet')) throw bad('chua_thi_ly_thuyet', `Bằng quá hạn đã lâu: phải thi lại lý thuyết${mode === 'thi_lai' && needsYard(cls) ? ' và sa hình' : ''} rồi mới được cấp lại.`, 409);
        if (mode === 'thi_lai' && needsYard(cls) && !done.includes('sa_hinh')) throw bad('chua_thi_sa_hinh', 'Bằng quá hạn trên 1 năm: phải thi lại cả sa hình rồi mới được cấp lại.', 409);
      }
      if (Number(u.cash) < LICENSE_RENEW_FEE) throw bad('khong_du_tien', `Lệ phí đổi bằng là ${LICENSE_RENEW_FEE.toLocaleString('vi-VN')}đ.`, 409);
      await d.addCash(q, userId, -LICENSE_RENEW_FEE, `doi_bang:${cls}`);
      const term = termMs(cls)!, exp = new Date(Date.now() + term);
      await q.query('update user_licenses set issued_at = now(), expires_at = $3 where user_id = $1 and cls = $2', [userId, cls, exp]);
      return { ok: true, cls, mode, fee: LICENSE_RENEW_FEE, cash: Number(u.cash) - LICENSE_RENEW_FEE, expiresAt: exp.getTime() };
    });
  });
  /** Tài khoản thử: cấp ngay một bằng, tuỳ chọn cho hết hạn (expired: true hoặc overdueMonths) hay đặt số điểm; passExams: true thì ghi sẵn hai phần thi đạt mà chưa cấp bằng. */
  app.post('/api/test/license', async (req) => {
    const userId = await d.requireTester(req);
    const b = (req.body ?? {}) as Record<string, unknown>, cls = clsOf(b.cls);
    return db.tx(async (q) => {
      if (b.passExams === true) {
        for (const part of ['ly_thuyet', 'sa_hinh'] as ExamPart[]) await q.query('insert into license_exams (user_id, cls, part, finished_at, score, passed) values ($1,$2,$3,now(),100,true)', [userId, cls, part]);
        return { ok: true, cls, exam: await examState(q, userId, cls) };
      }
      await grantLicense(q, userId, cls);
      const months = b.expired === true ? Math.max(0.1, Number(b.overdueMonths ?? 1)) : 0;
      if (months > 0 && termMs(cls) !== null) await q.query('update user_licenses set expires_at = $3 where user_id = $1 and cls = $2', [userId, cls, new Date(Date.now() - months * MONTH)]);
      if (b.points !== undefined) { const p = Math.max(0, Math.min(LICENSE_POINTS, Math.floor(Number(b.points) || 0))); await q.query('update user_licenses set points = $3, points_at = now(), suspended = $4 where user_id = $1 and cls = $2', [userId, cls, p, p === 0]); }
      return { ok: true, license: (await licenseRows(q, userId)).find((l) => l.cls === cls) };
    });
  });

  app.post('/api/vehicles/buy', async (req) => {
    const userId = await d.requireUser(req);
    const kind = String(((req.body ?? {}) as any).kind ?? '');
    if (!Object.hasOwn(VEHICLES, kind)) throw bad('du_lieu_sai', 'Loại xe không tồn tại.');
    const spec = VEHICLES[kind];
    return db.tx(async (q) => {
      const u = (await q.query('select cash, xp, vehicle_id, truck_region, home_region_id from users where id = $1 for update', [userId])).rows[0];
      if (!u.home_region_id) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      await truck(q, userId);
      if (levelOf(u.xp).level < spec.minLevel) throw bad('chua_du_cap', `Cần đạt cấp ${spec.minLevel} mới mua được ${spec.name}.`, 409);
      if (!licenseCovers(await licensesOf(q, userId), spec.license)) throw bad('thieu_bang_lai', `${spec.name} cần bằng lái ${LICENSES[spec.license].name} (${LICENSES[spec.license].covers}).`, 409);
      const n = (await q.query('select count(*)::int as n from vehicles where user_id = $1', [userId])).rows[0].n;
      if (n >= VEHICLE_MAX_OWNED) throw bad('day_bai_xe', `Bãi xe của bạn chỉ chứa được ${VEHICLE_MAX_OWNED} chiếc. Hãy bán bớt một chiếc.`, 409);
      if (!atHome(u)) throw bad('xe_o_xa', 'Xe của bạn đang ở vùng khác. Hãy về nhà rồi mới nhận xe mới.', 409);
      if (Number(u.cash) < spec.price) throw bad('khong_du_tien', 'Bạn không đủ tiền mua chiếc xe này.', 409);
      await d.addCash(q, userId, -spec.price, `mua_xe:${kind}`);
      const start = round1(spec.tank / 2);
      const v = (await q.query('insert into vehicles (user_id, kind, energy, price_paid) values ($1,$2,$3,$4) returning id', [userId, kind, start, spec.price])).rows[0];
      const cur = (await q.query('select vehicle_id from users where id = $1', [userId])).rows[0].vehicle_id;
      if (!cur) await q.query('update users set vehicle_id = $2, fuel_l = $3, cargo_used = 0 where id = $1', [userId, v.id, start]);
      return { ok: true, vehicleId: Number(v.id), kind, price: spec.price, cash: Number(u.cash) - spec.price, active: !cur };
    });
  });

  app.post('/api/vehicles/:id/activate', async (req) => {
    const userId = await d.requireUser(req);
    const id = Number((req.params as any).id);
    return db.tx(async (q) => {
      const u = (await q.query('select vehicle_id, fuel_l, truck_region, home_region_id from users where id = $1 for update', [userId])).rows[0];
      const v = (await q.query('select id, kind, energy from vehicles where id = $1 and user_id = $2', [id || 0, userId])).rows[0];
      if (!v) throw bad('khong_tim_thay', 'Không tìm thấy chiếc xe này.', 404);
      if ((await q.query('select 1 from trips where user_id = $1 and finished_at is null', [userId])).rows[0]) throw bad('dang_chay', 'Bạn đang trên một chuyến xe.', 409);
      if (!atHome(u)) throw bad('xe_o_xa', 'Các xe khác đang để ở nhà. Hãy lái xe về nhà rồi mới đổi xe.', 409);
      if (u.vehicle_id && Number(u.vehicle_id) !== Number(v.id)) await q.query('update vehicles set energy = $2 where id = $1', [u.vehicle_id, u.fuel_l]);
      await q.query('update users set vehicle_id = $2, fuel_l = $3, cargo_used = 0, truck_region = home_region_id where id = $1', [userId, v.id, v.energy]);
      const spec = VEHICLES[v.kind] ?? VEHICLES[DEFAULT_VEHICLE];
      return { ok: true, active: Number(v.id), kind: spec.kind, name: spec.name, cargoKg: spec.cargoKg, energy: round1(Number(v.energy)), unit: unitOf(spec.power) };
    });
  });

  app.post('/api/vehicles/:id/sell', async (req) => {
    const userId = await d.requireUser(req);
    const id = Number((req.params as any).id);
    return db.tx(async (q) => {
      const u = (await q.query('select cash, role, vehicle_id, truck_region, home_region_id from users where id = $1 for update', [userId])).rows[0];
      const v = (await q.query('select id, kind, price_paid from vehicles where id = $1 and user_id = $2', [id || 0, userId])).rows[0];
      if (!v) throw bad('khong_tim_thay', 'Không tìm thấy chiếc xe này.', 404);
      if ((await q.query('select 1 from trips where user_id = $1 and finished_at is null', [userId])).rows[0]) throw bad('dang_chay', 'Bạn đang trên một chuyến xe.', 409);
      const active = Number(u.vehicle_id) === Number(v.id);
      if (active && !atHome(u)) throw bad('xe_o_xa', 'Hãy lái xe về nhà rồi mới bán.', 409);
      const others = (await q.query('select id, energy from vehicles where user_id = $1 and id <> $2 order by id', [userId, v.id])).rows;
      if (u.role === 'thuong_lai' && others.length === 0) throw bad('xe_cuoi', 'Thương lái phải giữ ít nhất một chiếc xe để đi buôn.', 409);
      const refund = Math.round(Number(v.price_paid) * VEHICLE_RESALE);
      await q.query('delete from vehicles where id = $1', [v.id]);
      if (refund > 0) await d.addCash(q, userId, refund, `ban_xe:${v.kind}`);
      if (active) {
        const next = others[0];
        await q.query('update users set vehicle_id = $2, fuel_l = $3, cargo_used = 0 where id = $1', [userId, next ? next.id : null, next ? next.energy : 0]);
      }
      return { ok: true, refund, cash: Number(u.cash) + refund, active: active ? (others[0] ? Number(others[0].id) : null) : Number(u.vehicle_id) };
    });
  });

  /** Các trạm dừng nghỉ của chuyến đang chạy, kèm món bán ở từng trạm. */
  app.get('/api/trips/:id/reststops', async (req) => {
    const userId = await d.requireUser(req);
    const t = (await db.query('select id, from_region, to_region from trips where id = $1 and user_id = $2', [Number((req.params as any).id) || 0, userId])).rows[0];
    if (!t) throw bad('khong_tim_thay', 'Không tìm thấy chuyến xe.', 404);
    const { spec } = await truck(db, userId);
    const plan = planFor(spec, t.from_region, t.to_region);
    return {
      tripId: Number(t.id), restsNeeded: plan.restsNeeded, driveHours: plan.driveHours, rules: DRIVE_RULES,
      stops: plan.restStops.map((s) => ({
        ...s, shopId: `rest:${t.id}:${s.atKm}`, wcEnergy: DRIVE_RULES.wcEnergy,
        items: restStopItems(s.province).map((itemId) => ({ itemId, name: ITEMS[itemId].name, emoji: ITEMS[itemId].emoji, price: ITEMS[itemId].price, energy: ITEMS[itemId].energy, kind: ITEMS[itemId].kind, ...(ITEMS[itemId].regional ? { regional: ITEMS[itemId].regional } : {}) })),
      })),
    };
  });

  /** Tài khoản thử: nhận ngay một loại xe (kèm bằng lái) và chuyển sang dùng xe đó, đầy bình. */
  app.post('/api/test/vehicle', async (req) => {
    const userId = await d.requireTester(req);
    const kind = String(((req.body ?? {}) as any).kind ?? DEFAULT_VEHICLE);
    if (!Object.hasOwn(VEHICLES, kind)) throw bad('du_lieu_sai', 'Loại xe không tồn tại.');
    const spec = VEHICLES[kind];
    return db.tx(async (q) => {
      const u = (await q.query('select vehicle_id, fuel_l from users where id = $1 for update', [userId])).rows[0];
      if (u.vehicle_id) await q.query('update vehicles set energy = $2 where id = $1', [u.vehicle_id, u.fuel_l]);
      await grantLicense(q, userId, spec.license);
      const v = (await q.query('insert into vehicles (user_id, kind, energy, price_paid) values ($1,$2,$3,0) returning id', [userId, kind, spec.tank])).rows[0];
      await q.query('update users set vehicle_id = $2, fuel_l = $3, cargo_used = 0, truck_region = home_region_id where id = $1', [userId, v.id, spec.tank]);
      return { ok: true, vehicleId: Number(v.id), kind, energy: spec.tank, unit: unitOf(spec.power) };
    });
  });

  return { truck, planFor, chargedKwh, afterTrip, restShop, meOut, testFill, licensesOf, requireValidLicense, deductPoints };
}
export type VehicleApi = ReturnType<typeof registerVehicles>;
