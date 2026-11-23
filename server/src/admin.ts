// Trung tâm phục vụ hành chính công (mỗi tỉnh một trung tâm, cùng bố cục): bốc số thứ tự, thuế hộ kinh doanh theo quý,
// giấy phép xây dựng. Các bước chuyển nhượng đất (công chứng, đăng ký biến động, nộp thuế, nhận sổ) nằm ở server/src/land.ts.
// Đăng ký từ app.ts qua registerAdmin; trả về usePermit để /api/properties/buy đòi giấy phép trước khi khởi công.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { levelOf } from '../../shared/rules.ts';
import type { Role } from '../../shared/rules.ts';
import { isProvince } from '../../shared/economy.ts';
import { BUILDINGS, LAND_USES, canBuild } from '../../shared/land.ts';
import type { BuildingKind } from '../../shared/land.ts';
import {
  ACTIVE_DEAL, ADMIN_DAY_MS, COUNTERS, DEAL_STEPS, LATE_RATE_PER_DAY, PERMIT_DAYS, PERMIT_FEE, SALE_REASONS, TAX_EPOCH, TAX_RATE,
  calDaysMs, counterOf, quarterDeadline, quarterIndex, quarterName, quarterStart, quarterTax, taxGroupOf, ticketLabel, ticketWaitMs,
} from '../../shared/admin.ts';
import { presentAt } from './land.ts';

export const ADMIN_SCHEMA = `
create table if not exists admin_tickets (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  province text not null,
  counter text not null,
  no text not null,
  issued_at timestamptz not null default now(),
  call_at timestamptz not null
);
create index if not exists admin_tickets_idx on admin_tickets (province, counter, call_at desc);
create table if not exists admin_queue (province text not null, counter text not null, day int not null, last int not null default 0, primary key (province, counter, day));
create table if not exists tax_returns (
  user_id bigint not null references users(id) on delete cascade,
  quarter int not null,
  revenue bigint not null,
  tax bigint not null,
  penalty bigint not null default 0,
  filed_at timestamptz not null default now(),
  province text,
  primary key (user_id, quarter)
);
create table if not exists building_permits (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  province text not null,
  kind text not null,
  fee bigint not null,
  applied_at timestamptz not null default now(),
  ready_at timestamptz not null,
  used_at timestamptz,
  property_id bigint
);
create index if not exists building_permits_user_idx on building_permits (user_id, province, kind);
`;

export interface AdminDeps {
  db: Db;
  timeScale: number;
  requireUser: (req: FastifyRequest) => Promise<number>;
  bad: (code: string, message: string, status?: number) => Error;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
}

export function registerAdmin(app: FastifyInstance, d: AdminDeps) {
  const { db, bad } = d;
  app.addHook('onReady', async () => { await db.query(ADMIN_SCHEMA); });
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;
  const ms = (v: unknown) => (v == null ? null : new Date(v as string).getTime());
  const provinceOf = (v: unknown) => { const p = String(v ?? ''); if (!isProvince(p)) throw bad('du_lieu_sai', 'Tỉnh không hợp lệ.'); return p; };
  async function mustBeHere(q: Q, userId: number, province: string, where: string) {
    if (!(await presentAt(q, userId, province))) throw bad('chua_den_trung_tam', `Hãy tới Trung tâm hành chính công ${province}, ${where}.`, 409);
  }

  // ------------------------------------------------ số thứ tự
  async function lastCalled(q: Q, province: string) {
    const { rows } = await q.query(`select distinct on (counter) counter, no, call_at from admin_tickets where province = $1 and call_at <= now() and call_at > now() - interval '30 minutes'
      order by counter, call_at desc`, [province]);
    return Object.fromEntries(rows.map((r) => [r.counter, { no: r.no, at: ms(r.call_at) }]));
  }
  app.get('/api/admin/center', async (req) => {
    const userId = await d.requireUser(req);
    const province = provinceOf((req.query as Record<string, unknown>).province);
    const here = Number((await db.query(`select count(*)::int as n from presence where scene = 'admin' and scene_key = $1 and updated_at > now() - interval '15 seconds'`, [province])).rows[0].n);
    const mine = (await db.query(`select counter, no, issued_at, call_at from admin_tickets where user_id = $1 and province = $2 and issued_at > now() - interval '20 minutes' order by id desc`, [userId, province])).rows
      .map((r) => ({ counter: r.counter, no: r.no, issuedAt: ms(r.issued_at), callAt: ms(r.call_at) }));
    const deals = Number((await db.query(`select count(*)::int as n from land_deals d join land_lots l on l.id = d.lot_id where (d.seller_id = $1 or d.buyer_id = $1) and l.province = $2 and d.status = any($3::text[])`,
      [userId, province, ACTIVE_DEAL])).rows[0].n);
    return { province, counters: COUNTERS, called: await lastCalled(db, province), here, tickets: mine, deals, steps: DEAL_STEPS, now: Date.now() };
  });
  app.post('/api/admin/ticket', async (req) => {
    const userId = await d.requireUser(req);
    const b = body(req), province = provinceOf(b.province), c = counterOf(String(b.counter ?? ''));
    if (!c) throw bad('du_lieu_sai', 'Quầy không hợp lệ.');
    return db.tx(async (q) => {
      await mustBeHere(q, userId, province, 'máy lấy số ở sảnh');
      const live = (await q.query(`select no, call_at from admin_tickets where user_id = $1 and province = $2 and counter = $3 and issued_at > now() - interval '10 minutes' order by id desc limit 1`, [userId, province, c.id])).rows[0];
      if (live) return { ticket: { counter: c.id, no: live.no, callAt: ms(live.call_at) }, reused: true };
      const day = Math.floor((Date.now() + 7 * 3600_000) / 86_400_000);
      const seq = Number((await q.query(`insert into admin_queue (province, counter, day, last) values ($1,$2,$3,1)
        on conflict (province, counter, day) do update set last = admin_queue.last + 1 returning last`, [province, c.id, day])).rows[0].last);
      const waiting = (await q.query(`select count(*)::int as n, max(call_at) as tail from admin_tickets where province = $1 and counter = $2 and call_at > now()`, [province, c.id])).rows[0];
      // hàng chờ ảo: mỗi quầy luôn có vài người dân đến trước (0–2 người, đổi theo số thứ tự)
      const ahead = Number(waiting.n) + (seq % 3), tail = Math.max(Date.now(), ms(waiting.tail) ?? 0);
      const callAt = new Date(Math.max(Date.now() + ticketWaitMs(ahead), tail + 3_000));
      const no = ticketLabel(c.no, seq + 100);
      await q.query('insert into admin_tickets (user_id, province, counter, no, call_at) values ($1,$2,$3,$4,$5)', [userId, province, c.id, no, callAt]);
      return { ticket: { counter: c.id, no, callAt: callAt.getTime() }, ahead };
    });
  });

  // ------------------------------------------------ thuế hộ kinh doanh theo quý
  async function revenueBetween(q: Q, userId: number, from: number, to: number): Promise<number> {
    const r = await q.query(`select coalesce(sum(delta), 0)::bigint as s from ledger where user_id = $1 and delta > 0 and created_at >= to_timestamp($2 / 1000.0) and created_at < to_timestamp($3 / 1000.0)
      and split_part(reason, ':', 1) = any($4::text[])`, [userId, from, to, SALE_REASONS]);
    return Number(r.rows[0].s);
  }
  async function quarters(q: Q, userId: number) {
    const u = (await q.query('select role, created_at from users where id = $1', [userId])).rows[0];
    const role = (u.role ?? null) as Role | null, group = taxGroupOf(role), now = Date.now(), cur = quarterIndex(now);
    const first = Math.min(cur, Math.max(quarterIndex(Math.max(TAX_EPOCH, ms(u.created_at)!)), cur - 7));
    const filed = Object.fromEntries((await q.query('select * from tax_returns where user_id = $1 and quarter >= $2', [userId, first])).rows.map((r) => [Number(r.quarter), r]));
    const out = [];
    for (let qi = first; qi <= cur; qi++) {
      const yearStart = quarterStart(qi - (qi % 4));
      const revenue = await revenueBetween(q, userId, quarterStart(qi), quarterStart(qi + 1));
      const cumBefore = await revenueBetween(q, userId, yearStart, quarterStart(qi));
      const t = quarterTax(group, cumBefore, revenue), deadline = quarterDeadline(qi), f = filed[qi];
      const ended = now >= quarterStart(qi + 1), lateDays = !f && now > deadline ? Math.ceil((now - deadline) / ADMIN_DAY_MS) : 0;
      const penalty = f ? Number(f.penalty) : Math.round(t.total * LATE_RATE_PER_DAY * lateDays);
      out.push({ quarter: qi, name: quarterName(qi), from: quarterStart(qi), to: quarterStart(qi + 1), deadline, revenue, cumBefore, ...t, penalty,
        state: f ? 'da_nop' : !ended ? 'dang_dien_ra' : now > deadline ? 'qua_han' : 'can_ke_khai', filedAt: f ? ms(f.filed_at) : null, lateDays });
    }
    return { group, groupName: TAX_RATE[group].name, quarters: out.reverse() };
  }
  /** Còn nợ thuế quá hạn không (chặn xin giấy phép xây dựng). */
  async function overdue(q: Q, userId: number): Promise<number> {
    const t = await quarters(q, userId);
    return t.quarters.filter((x) => x.state === 'qua_han' && x.total > 0).reduce((s, x) => s + x.total + x.penalty, 0);
  }
  app.get('/api/admin/tax', async (req) => {
    const userId = await d.requireUser(req);
    return quarters(db, userId);
  });
  /** Quầy 3 · Kê khai và nộp thuế một quý đã kết thúc (kể cả kỳ 0đ vẫn phải nộp tờ khai). */
  app.post('/api/admin/tax/file', async (req) => {
    const userId = await d.requireUser(req);
    const b = body(req), province = provinceOf(b.province), qi = Number(b.quarter);
    if (!Number.isInteger(qi)) throw bad('du_lieu_sai', 'Kỳ tính thuế không hợp lệ.');
    return db.tx(async (q) => {
      await mustBeHere(q, userId, province, 'Quầy 3 · Chi cục thuế');
      const u = (await q.query('select cash from users where id = $1 for update', [userId])).rows[0];
      const t = (await quarters(q, userId)).quarters.find((x) => x.quarter === qi);
      if (!t) throw bad('khong_tim_thay', 'Không có kỳ tính thuế này.', 404);
      if (t.state === 'da_nop') throw bad('da_nop', 'Kỳ này đã kê khai và nộp.', 409);
      if (t.state === 'dang_dien_ra') throw bad('chua_het_ky', 'Quý chưa kết thúc, chưa kê khai được.', 409);
      const due = t.total + t.penalty;
      if (Number(u.cash) < due) throw bad('khong_du_tien', `Cần ${due.toLocaleString('vi-VN')}đ để nộp thuế${t.penalty ? ' và tiền chậm nộp' : ''}.`, 409);
      if (t.total) await d.addCash(q, userId, -t.total, `thue_hkd:${qi}`);
      if (t.penalty) await d.addCash(q, userId, -t.penalty, `cham_nop_thue:${qi}`);
      await q.query('insert into tax_returns (user_id, quarter, revenue, tax, penalty, province) values ($1,$2,$3,$4,$5,$6)', [userId, qi, t.revenue, t.total, t.penalty, province]);
      return { ok: true, paid: due, cash: Number(u.cash) - due };
    });
  });

  // ------------------------------------------------ giấy phép xây dựng
  const permitOut = (r: any) => {
    const ready = ms(r.ready_at)!;
    return { id: Number(r.id), province: r.province, kind: r.kind as BuildingKind, name: BUILDINGS[r.kind as BuildingKind]?.name ?? r.kind, fee: Number(r.fee),
      appliedAt: ms(r.applied_at), readyAt: ready, ready: ready <= Date.now(), used: r.used_at != null };
  };
  app.get('/api/admin/permits', async (req) => {
    const userId = await d.requireUser(req);
    const rows = (await db.query('select * from building_permits where user_id = $1 order by id desc limit 20', [userId])).rows;
    return { permits: rows.map(permitOut), fee: PERMIT_FEE, days: PERMIT_DAYS };
  });
  /** Quầy 4 · Nộp hồ sơ xin phép xây dựng: phải là chủ đủ số thửa trống đúng loại đất ở tỉnh đó. */
  app.post('/api/admin/permits', async (req) => {
    const userId = await d.requireUser(req);
    const b = body(req), province = provinceOf(b.province), kind = String(b.kind ?? '') as BuildingKind;
    if (!Object.hasOwn(BUILDINGS, kind)) throw bad('du_lieu_sai', 'Loại công trình không hợp lệ.');
    return db.tx(async (q) => {
      await mustBeHere(q, userId, province, 'Quầy 4 · Phòng quản lý đô thị');
      const u = (await q.query('select role, xp, cash from users where id = $1 for update', [userId])).rows[0];
      const why = canBuild(kind, u.role ?? null, levelOf(Number(u.xp)).level);
      if (why) throw bad('chua_du_dieu_kien', why, 403);
      const debt = await overdue(q, userId);
      if (debt > 0) throw bad('no_thue', `Bạn còn nợ thuế quá hạn ${debt.toLocaleString('vi-VN')}đ. Nộp ở Quầy 3 rồi mới xin phép xây dựng.`, 409);
      const b0 = BUILDINGS[kind];
      const free = Number((await q.query(`select count(*)::int as n from land_lots l where owner_id = $1 and province = $2 and use = $3 and state = 'co_chu'
        and property_id is null and field_id is null and listing_price is null`, [userId, province, b0.use])).rows[0].n);
      if (free < b0.lots) throw bad('thieu_dat', `Cần đứng tên ${b0.lots} thửa ${LAND_USES[b0.use].short.toLowerCase()} trống ở ${province} (đang có ${free}). Mua đất trong Sổ địa chính trước.`, 409);
      const open = (await q.query('select 1 from building_permits where user_id = $1 and province = $2 and kind = $3 and used_at is null', [userId, province, kind])).rows.length;
      if (open) throw bad('da_nop', 'Bạn đã có hồ sơ/giấy phép chưa dùng cho công trình này ở tỉnh này.', 409);
      if (Number(u.cash) < PERMIT_FEE) throw bad('khong_du_tien', `Cần ${PERMIT_FEE.toLocaleString('vi-VN')}đ lệ phí.`, 409);
      await d.addCash(q, userId, -PERMIT_FEE, `le_phi_gpxd:${province}`);
      const ins = await q.query('insert into building_permits (user_id, province, kind, fee, ready_at) values ($1,$2,$3,$4,$5) returning *',
        [userId, province, kind, PERMIT_FEE, new Date(Date.now() + calDaysMs(PERMIT_DAYS, d.timeScale))]);
      return { ok: true, permit: permitOut(ins.rows[0]) };
    });
  });

  /** Dùng một giấy phép đã cấp cho công trình (gọi trong /api/properties/buy, cùng giao dịch). */
  async function usePermit(q: Q, userId: number, province: string, kind: string): Promise<void> {
    const r = (await q.query('select * from building_permits where user_id = $1 and province = $2 and kind = $3 and used_at is null order by id limit 1 for update', [userId, province, kind])).rows[0];
    const name = BUILDINGS[kind as BuildingKind]?.name.toLowerCase() ?? 'công trình';
    if (!r) throw bad('can_giay_phep', `Cần giấy phép xây dựng ${name} ở ${province}: nộp hồ sơ tại Quầy 4, Trung tâm hành chính công ${province}.`, 409);
    if (ms(r.ready_at)! > Date.now()) throw bad('cho_giay_phep', `Giấy phép xây dựng ${name} đang thẩm định, còn ${Math.ceil((ms(r.ready_at)! - Date.now()) / 60_000)} phút.`, 409);
    await q.query('update building_permits set used_at = now() where id = $1', [r.id]);
  }
  return { usePermit };
}
