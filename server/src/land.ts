// Sổ địa chính: quỹ đất từng tỉnh (shared/land.ts), mỗi thửa có MÃ THỬA và SỐ PHÁT HÀNH giấy chứng nhận độc bản,
// mọi biến động ghi vào sổ biến động dạng chuỗi băm (land_ledger). Mua bán giữa người chơi đi đúng thủ tục: thoả thuận giá →
// công chứng (hai bên có mặt) → đăng ký biến động → thuế → nhận sổ mới; các quầy nằm ở Trung tâm hành chính công (server/src/admin.ts).
// Giá tham chiếu đời thực (/api/ref-prices) cũng ở đây. Đăng ký từ app.ts qua registerLand.
import { createHash, randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { levelOf } from '../../shared/rules.ts';
import type { Role } from '../../shared/rules.ts';
import {
  CERT_FEE, LAND_USES, LAND_USE_ORDER, PROVINCE_LAND, RESALE_MAX, RESALE_MIN, buyCost, canBuyLand, lotPrice, provinceLandSummary, releasedLots, sellerNet,
} from '../../shared/land.ts';
import type { LandUse } from '../../shared/land.ts';
import {
  ACTIVE_DEAL, DEAL_NAMES, GENESIS_HASH, LEDGER_NAMES, NOTARY_APPOINT_DAYS, NOTARY_DRAFT_FEE, PRESENT_MS, REGISTER_WORKDAYS, SERIAL_RE, TAX_NOTICE_WORKDAYS,
  calDaysMs, ledgerPayload, makeSerial, notaryFee, parcelCode, parcelOf, workDaysMs,
} from '../../shared/admin.ts';
import type { DealStatus, LedgerKind } from '../../shared/admin.ts';
import { isProvince } from '../../shared/economy.ts';
import { REF_PRICES, registrationFee, setLivePrices, transferTax } from '../../shared/realPrices.ts';
import type { RefPriceKey } from '../../shared/realPrices.ts';

export const LAND_SCHEMA = `
alter table land_lots add column if not exists parcel_code text;
alter table land_lots add column if not exists sheet_no int;
alter table land_lots add column if not exists parcel_no int;
alter table land_lots add column if not exists state text not null default 'co_chu';
alter table land_lots add column if not exists tenure text not null default 'so_do';
alter table land_lots add column if not exists lease_until timestamptz;
alter table land_lots add column if not exists lease_no text;
alter table fields add column if not exists lease_until timestamptz;
alter table fields add column if not exists lease_rent bigint not null default 0;
create unique index if not exists land_lots_parcel_uq on land_lots (parcel_code);
create table if not exists land_certs (
  serial text primary key,
  lot_id bigint not null references land_lots(id),
  owner_id bigint references users(id) on delete set null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text
);
create unique index if not exists land_certs_live_uq on land_certs (lot_id) where revoked_at is null;
create table if not exists land_ledger (
  id bigserial primary key,
  lot_id bigint not null references land_lots(id),
  kind text not null,
  data jsonb not null,
  at bigint not null,
  prev_hash text not null,
  hash text not null unique
);
create index if not exists land_ledger_lot_idx on land_ledger (lot_id, id);
create table if not exists land_deals (
  id bigserial primary key,
  lot_id bigint not null references land_lots(id),
  seller_id bigint not null references users(id),
  buyer_id bigint not null references users(id),
  price bigint not null,
  status text not null default 'de_nghi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  appoint_until timestamptz,
  seller_signed_at timestamptz, buyer_signed_at timestamptz, notarized_at timestamptz,
  notary_fee bigint not null default 0,
  escrow bigint not null default 0,
  submitted_at timestamptz, tax_notice_at timestamptz,
  seller_tax bigint not null default 0, buyer_fee bigint not null default 0, cert_fee bigint not null default 0,
  seller_paid_at timestamptz, buyer_paid_at timestamptz,
  ready_at timestamptz, done_at timestamptz, cancelled_at timestamptz, cancel_reason text,
  new_serial text
);
create index if not exists land_deals_lot_idx on land_deals (lot_id);
create index if not exists land_deals_seller_idx on land_deals (seller_id);
create index if not exists land_deals_buyer_idx on land_deals (buyer_id);
create unique index if not exists land_deals_one_live_uq on land_deals (lot_id) where status in ('hen_cong_chung','da_cong_chung','dang_xu_ly','cho_nop_thue','cho_tra_ket_qua');
`;

const isUse = (v: unknown): v is LandUse => typeof v === 'string' && Object.hasOwn(LAND_USES, v);

// ---------------------------------------------------------------- sổ biến động (chuỗi băm)
const LEDGER_LOCK = 77_120_224;
export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
/** Ghi một biến động vào cuối chuỗi. Khoá cả chuỗi trong giao dịch để không có hai bản ghi cùng trỏ một mã trước. */
export async function appendLedger(q: Q, lotId: number, kind: LedgerKind, data: Record<string, unknown>): Promise<string> {
  await q.query('select pg_advisory_xact_lock($1)', [LEDGER_LOCK]);
  const prev = (await q.query('select hash from land_ledger order by id desc limit 1')).rows[0]?.hash ?? GENESIS_HASH;
  const at = Date.now(), hash = sha256(ledgerPayload({ prev, lotId, kind, at, data }));
  await q.query('insert into land_ledger (lot_id, kind, data, at, prev_hash, hash) values ($1,$2,$3,$4,$5,$6)', [lotId, kind, JSON.stringify(data), at, prev, hash]);
  return hash;
}
/** Kiểm cả chuỗi: mỗi bản ghi trỏ đúng mã của bản ghi liền trước và mã của nó khớp nội dung. */
export async function verifyLedger(q: Q): Promise<{ ok: boolean; count: number; brokenAt: number | null; head: string }> {
  const { rows } = await q.query('select id, lot_id, kind, data, at, prev_hash, hash from land_ledger order by id');
  let prev = GENESIS_HASH;
  for (const r of rows) {
    const want = sha256(ledgerPayload({ prev: r.prev_hash, lotId: Number(r.lot_id), kind: r.kind, at: Number(r.at), data: r.data }));
    if (r.prev_hash !== prev || want !== r.hash) return { ok: false, count: rows.length, brokenAt: Number(r.id), head: prev };
    prev = r.hash;
  }
  return { ok: true, count: rows.length, brokenAt: null, head: prev };
}

// ---------------------------------------------------------------- số phát hành, mã thửa
async function newSerial(q: Q, lotId: number, ownerId: number): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const s = makeSerial(() => randomInt(0, 1_000_000) / 1_000_000);
    const r = await q.query('insert into land_certs (serial, lot_id, owner_id) values ($1,$2,$3) on conflict (serial) do nothing returning serial', [s, lotId, ownerId]);
    if (r.rows[0]) return s;
  }
  throw new Error('Không cấp được số phát hành giấy chứng nhận.');
}
async function revokeCert(q: Q, lotId: number, reason: string): Promise<string | null> {
  const r = await q.query('update land_certs set revoked_at = now(), revoke_reason = $2 where lot_id = $1 and revoked_at is null returning serial', [lotId, reason]);
  return r.rows[0]?.serial ?? null;
}
/** Đánh mã thửa cho một thửa mới trong tỉnh (khoá theo tỉnh để số thửa không trùng). */
async function assignParcel(q: Q, lotId: number, province: string): Promise<{ code: string; sheet: number; parcel: number }> {
  await q.query('select pg_advisory_xact_lock(hashtext($1))', [`thua:${province}`]);
  const seq = Number((await q.query('select count(*)::int as n from land_lots where province = $1 and parcel_code is not null', [province])).rows[0].n);
  const { sheet, parcel } = parcelOf(seq), code = parcelCode(PROVINCE_LAND[province]?.code ?? 'XX', sheet, parcel);
  await q.query('update land_lots set parcel_code = $2, sheet_no = $3, parcel_no = $4, cert_no = $2 where id = $1', [lotId, code, sheet, parcel]);
  return { code, sheet, parcel };
}

/** Số thửa còn trong quỹ đất đợt 1 của tỉnh: thửa đã có chủ tính là đã cấp; thửa trả lại Nhà nước thì cấp lại được. */
export async function lotsLeft(q: Q, province: string, use: LandUse): Promise<number> {
  const n = Number((await q.query(`select count(*)::int as n from land_lots where province = $1 and use = $2 and state <> 'nha_nuoc'`, [province, use])).rows[0].n);
  return Math.max(0, releasedLots(province, use) - n);
}
/**
 * Cấp sổ một thửa cho người chơi (người gọi đã trừ tiền). Ưu tiên giao lại thửa Nhà nước đã thu hồi (cùng mã thửa, sổ mới),
 * hết mới mở thửa mới trong quỹ đất. Trả về id thửa.
 */
export async function issueLot(q: Q, userId: number, province: string, use: LandUse, price: number, fieldId: number | null = null): Promise<number> {
  const old = (await q.query(`select id from land_lots where province = $1 and use = $2 and state = 'nha_nuoc' order by id limit 1 for update skip locked`, [province, use])).rows[0];
  let id: number;
  if (old) {
    id = Number(old.id);
    await q.query(`update land_lots set owner_id = $2, price_paid = $3, field_id = $4, property_id = null, listing_price = null, listed_at = null, acquired_at = now(), state = 'co_chu',
      tenure = 'so_do', lease_until = null, lease_no = null where id = $1`, [id, userId, Math.round(price), fieldId]);
  } else {
    const ins = await q.query('insert into land_lots (province, use, owner_id, area_m2, price_paid, field_id) values ($1,$2,$3,$4,$5,$6) returning id',
      [province, use, userId, LAND_USES[use].lotM2, Math.round(price), fieldId]);
    id = Number(ins.rows[0].id);
    await assignParcel(q, id, province);
  }
  const serial = await newSerial(q, id, userId);
  const lot = (await q.query('select parcel_code, area_m2 from land_lots where id = $1', [id])).rows[0];
  await appendLedger(q, id, 'cap_lan_dau', { parcel: lot.parcel_code, serial, owner: userId, use, area: Number(lot.area_m2), price: Math.round(price), province });
  return id;
}
/**
 * Nhà nước cho thuê một thửa đất nông nghiệp trả tiền hằng năm (gắn với một cánh đồng). Người thuê không có giấy chứng nhận,
 * chỉ có số hợp đồng thuê; thửa không chuyển nhượng được. Trả về id thửa.
 */
export async function leaseLot(q: Q, userId: number, province: string, rentPerYear: number, fieldId: number, until: Date): Promise<number> {
  const old = (await q.query(`select id from land_lots where province = $1 and use = 'nong_nghiep' and state = 'nha_nuoc' order by id limit 1 for update skip locked`, [province])).rows[0];
  let id: number;
  if (old) id = Number(old.id);
  else {
    id = Number((await q.query(`insert into land_lots (province, use, owner_id, area_m2, price_paid, field_id) values ($1,'nong_nghiep',$2,$3,0,$4) returning id`,
      [province, userId, LAND_USES.nong_nghiep.lotM2, fieldId])).rows[0].id);
    await assignParcel(q, id, province);
  }
  const code = (await q.query('select parcel_code from land_lots where id = $1', [id])).rows[0].parcel_code as string;
  const leaseNo = `HĐT-${code}-${String(id).padStart(5, '0')}`;
  await q.query(`update land_lots set owner_id = $2, price_paid = 0, field_id = $3, property_id = null, listing_price = null, listed_at = null, acquired_at = now(), state = 'co_chu',
    tenure = 'thue', lease_until = $4, lease_no = $5 where id = $1`, [id, userId, fieldId, until, leaseNo]);
  await appendLedger(q, id, 'cho_thue', { parcel: code, lease: leaseNo, to: userId, rent: Math.round(rentPerYear), until: until.getTime(), province });
  return id;
}
/** Gia hạn thuê các thửa của một cánh đồng. */
export async function renewFieldLease(q: Q, fieldId: number, until: Date, rentPerYear: number): Promise<void> {
  const lots = (await q.query(`update land_lots set lease_until = $2 where field_id = $1 and tenure = 'thue' and state = 'co_chu' returning id, parcel_code, lease_no, owner_id`, [fieldId, until])).rows;
  for (const l of lots) await appendLedger(q, Number(l.id), 'gia_han_thue', { parcel: l.parcel_code, lease: l.lease_no, to: Number(l.owner_id), rent: Math.round(rentPerYear), until: until.getTime() });
}
/** Bán ruộng cho Nhà nước: các thửa của cánh đồng về quỹ đất, sổ bị thu hồi, ghi sổ biến động. */
export async function surrenderFieldLots(q: Q, fieldId: number): Promise<number> {
  const lots = (await q.query(`select id, owner_id, parcel_code, tenure, lease_no from land_lots where field_id = $1 and state = 'co_chu' for update`, [fieldId])).rows;
  for (const l of lots) {
    await q.query(`update land_deals set status = 'da_huy', cancelled_at = now(), cancel_reason = 'tra_dat' where lot_id = $1 and status = any($2::text[])`, [l.id, ACTIVE_DEAL]);
    const serial = await revokeCert(q, Number(l.id), 'tra_lai_nha_nuoc');
    await q.query(`update land_lots set owner_id = null, field_id = null, listing_price = null, listed_at = null, state = 'nha_nuoc', tenure = 'so_do', lease_until = null, lease_no = null where id = $1`, [l.id]);
    const from = l.owner_id == null ? null : Number(l.owner_id);
    if (l.tenure === 'thue') await appendLedger(q, Number(l.id), 'het_thue', { parcel: l.parcel_code, lease: l.lease_no, from });
    else await appendLedger(q, Number(l.id), 'thu_hoi', { parcel: l.parcel_code, serial, from });
  }
  return lots.length;
}
/** Thửa cũ (trước khi có sổ biến động) chưa có mã thửa/sổ: đánh mã, cấp sổ, ghi bản ghi cấp lần đầu. */
export async function backfillLand(db: Db): Promise<number> {
  const ids = (await db.query(`select id from land_lots where parcel_code is null order by id`)).rows.map((r) => Number(r.id));
  for (const id of ids) {
    await db.tx(async (q) => {
      const l = (await q.query('select * from land_lots where id = $1 for update', [id])).rows[0];
      if (!l || l.parcel_code) return;
      const p = await assignParcel(q, id, l.province);
      if (l.owner_id == null) { await q.query(`update land_lots set state = 'nha_nuoc' where id = $1`, [id]); return; }
      const serial = await newSerial(q, id, Number(l.owner_id));
      await appendLedger(q, id, 'cap_lan_dau', { parcel: p.code, serial, owner: Number(l.owner_id), use: l.use, area: Number(l.area_m2), price: Number(l.price_paid), province: l.province });
    });
  }
  return ids.length;
}

export interface LandDeps {
  db: Db;
  timeScale: number;
  requireUser: (req: FastifyRequest) => Promise<number>;
  bad: (code: string, message: string, status?: number) => Error;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
  addXp: (q: Q, userId: number, n: number, source?: any) => Promise<unknown>;
}

export async function seedRefPrices(db: Db): Promise<void> {
  for (const p of Object.values(REF_PRICES)) {
    await db.query('insert into ref_prices (key, value, unit, since, source) values ($1,$2,$3,$4,$5) on conflict (key, since) do nothing', [p.key, p.value, p.unit, p.since, p.source]);
  }
  await loadRefPrices(db);
}
/** Nạp giá mới nhất mỗi khoá (bản ghi có ngày hiệu lực mới nhất thắng) vào bộ nhớ dùng chung. */
export async function loadRefPrices(db: Db): Promise<Record<string, { value: number; since: string; source: string; unit: string }>> {
  const { rows } = await db.query('select distinct on (key) key, value, since, source, unit from ref_prices order by key, since desc, updated_at desc');
  const out: Record<string, { value: number; since: string; source: string; unit: string }> = {};
  const live: Partial<Record<RefPriceKey, number>> = {};
  for (const r of rows) {
    const since = r.since instanceof Date ? r.since.toISOString().slice(0, 10) : String(r.since);
    out[r.key] = { value: Number(r.value), since, source: r.source, unit: r.unit };
    if (Object.hasOwn(REF_PRICES, r.key)) live[r.key as RefPriceKey] = Number(r.value);
  }
  setLivePrices(live);
  return out;
}

/** Người chơi có đang đứng trong Trung tâm hành chính công của tỉnh này không (nhịp hiện diện gần đây). */
export async function presentAt(q: Q, userId: number, province: string): Promise<boolean> {
  const r = await q.query(`select 1 from presence where user_id = $1 and scene = 'admin' and scene_key = $2 and updated_at > now() - ($3 || ' milliseconds')::interval`, [userId, province, String(PRESENT_MS)]);
  return r.rows.length > 0;
}

export function registerLand(app: FastifyInstance, d: LandDeps) {
  const { db, bad } = d;
  app.addHook('onReady', async () => { await db.query(LAND_SCHEMA); await seedRefPrices(db); await backfillLand(db); });
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;
  const idOf = (v: unknown) => { const n = Number(v); if (!Number.isSafeInteger(n) || n <= 0) throw bad('khong_tim_thay', 'Không tìm thấy.', 404); return n; };
  const lotOut = (r: any, userId: number) => ({
    id: Number(r.id), province: r.province, use: r.use as LandUse, useName: LAND_USES[r.use as LandUse]?.short ?? r.use, emoji: LAND_USES[r.use as LandUse]?.emoji,
    areaM2: Number(r.area_m2), pricePaid: Number(r.price_paid), certNo: r.parcel_code ?? r.cert_no, parcelCode: r.parcel_code ?? null,
    sheet: r.sheet_no == null ? null : Number(r.sheet_no), parcel: r.parcel_no == null ? null : Number(r.parcel_no), serial: r.serial ?? null,
    ownerId: r.owner_id == null ? null : Number(r.owner_id),
    ownerName: r.display_name ?? null, mine: Number(r.owner_id) === userId, propertyId: r.property_id == null ? null : Number(r.property_id),
    fieldId: r.field_id == null ? null : Number(r.field_id), listingPrice: r.listing_price == null ? null : Number(r.listing_price),
    statePrice: lotPrice(r.province, r.use as LandUse), acquiredAt: new Date(r.acquired_at).getTime(),
    used: r.property_id != null || r.field_id != null, inDeal: !!r.in_deal,
    tenure: (r.tenure ?? 'so_do') as 'so_do' | 'thue', leaseNo: r.lease_no ?? null, leaseUntil: ms(r.lease_until),
  });
  const LOT_SELECT = `select l.*, u.display_name, c.serial,
    exists(select 1 from land_deals x where x.lot_id = l.id and x.status in ('hen_cong_chung','da_cong_chung','dang_xu_ly','cho_nop_thue','cho_tra_ket_qua')) as in_deal
    from land_lots l left join users u on u.id = l.owner_id left join land_certs c on c.lot_id = l.id and c.revoked_at is null`;
  async function roleLevel(q: Q, userId: number) {
    const u = (await q.query('select role, xp, cash from users where id = $1', [userId])).rows[0];
    return { role: (u.role ?? null) as Role | null, level: levelOf(Number(u.xp)).level, cash: Number(u.cash) };
  }
  const ms = (v: unknown) => (v == null ? null : new Date(v as string).getTime());

  // ------------------------------------------------ chuyển trạng thái theo thời gian (gọi trước khi đọc/ghi một giao dịch)
  async function advance(q: Q, dealId: number): Promise<any> {
    const r = (await q.query('select * from land_deals where id = $1 for update', [dealId])).rows[0];
    if (!r) return null;
    const now = Date.now();
    if (r.status === 'hen_cong_chung' && r.appoint_until && ms(r.appoint_until)! < now) {
      await q.query(`update land_deals set status = 'da_huy', cancelled_at = now(), cancel_reason = 'qua_hen_cong_chung', updated_at = now() where id = $1`, [dealId]);
      return { ...r, status: 'da_huy', cancel_reason: 'qua_hen_cong_chung' };
    }
    if (r.status === 'dang_xu_ly' && ms(r.tax_notice_at)! <= now) {
      await q.query(`update land_deals set status = 'cho_nop_thue', updated_at = now() where id = $1`, [dealId]);
      return { ...r, status: 'cho_nop_thue' };
    }
    return r;
  }
  async function dealOut(q: Q, r: any, userId: number) {
    const lot = (await q.query(`${LOT_SELECT} where l.id = $1`, [r.lot_id])).rows[0];
    const names = Object.fromEntries((await q.query('select id, display_name from users where id = any($1::bigint[])', [[r.seller_id, r.buyer_id]])).rows.map((u) => [Number(u.id), u.display_name]));
    const role = Number(r.seller_id) === userId ? 'ban' : Number(r.buyer_id) === userId ? 'mua' : null;
    const price = Number(r.price);
    const sTax = Number(r.seller_tax) || transferTax(price), bFee = Number(r.buyer_fee) || registrationFee(price);
    return {
      id: Number(r.id), status: r.status as DealStatus, statusName: DEAL_NAMES[r.status as DealStatus], role, price,
      lot: lot ? lotOut(lot, userId) : null, sellerName: names[Number(r.seller_id)] ?? '?', buyerName: names[Number(r.buyer_id)] ?? '?',
      notaryFee: Number(r.notary_fee) || notaryFee(Math.max(price, lot ? lotPrice(lot.province, lot.use) : 0)) + NOTARY_DRAFT_FEE,
      sellerSigned: !!r.seller_signed_at, buyerSigned: !!r.buyer_signed_at, appointUntil: ms(r.appoint_until),
      sellerTax: sTax, buyerFee: bFee, certFee: Number(r.cert_fee) || CERT_FEE, sellerPaid: !!r.seller_paid_at, buyerPaid: !!r.buyer_paid_at,
      taxNoticeAt: ms(r.tax_notice_at), readyAt: ms(r.ready_at), doneAt: ms(r.done_at), newSerial: r.new_serial ?? null,
      cancelReason: r.cancel_reason ?? null, createdAt: ms(r.created_at),
    };
  }
  async function mustBeHere(q: Q, userId: number, province: string, counter: string) {
    if (!(await presentAt(q, userId, province))) throw bad('chua_den_trung_tam', `Hãy tới Trung tâm hành chính công ${province}, ${counter}.`, 409);
  }

  app.get('/api/ref-prices', async () => {
    const live = await loadRefPrices(db);
    return { prices: Object.values(REF_PRICES).map((p) => ({ ...p, ...(live[p.key] ? { value: live[p.key].value, since: live[p.key].since, source: live[p.key].source } : {}) })) };
  });

  app.get('/api/land', async (req) => {
    const userId = await d.requireUser(req);
    const asked = (req.query as Record<string, unknown>).province;
    const province = typeof asked === 'string' && isProvince(asked) ? asked : null;
    const me = await roleLevel(db, userId);
    const mine = (await db.query(`${LOT_SELECT} where l.owner_id = $1 and l.state = 'co_chu' order by l.province, l.use, l.id`, [userId])).rows.map((r) => lotOut(r, userId));
    let summary = null, listings: unknown[] = [];
    if (province) {
      const sold = Object.fromEntries((await db.query(`select use, count(*)::int as n from land_lots where province = $1 and state <> 'nha_nuoc' group by use`, [province])).rows.map((r) => [r.use, Number(r.n)]));
      summary = provinceLandSummary(province, sold).map((r) => ({ ...r, blocked: canBuyLand(r.use, me.role, me.level), cost: buyCost(r.lotPrice) }));
      listings = (await db.query(`${LOT_SELECT} where l.province = $1 and l.listing_price is not null order by l.listing_price limit 50`, [province])).rows.map((r) => lotOut(r, userId));
    }
    const dealIds = (await db.query(`select id from land_deals where (seller_id = $1 or buyer_id = $1) and (status <> all($2::text[]) or updated_at > now() - interval '3 days') order by id desc limit 30`, [userId, ['hoan_tat', 'da_huy']])).rows.map((r) => Number(r.id));
    const deals = [];
    for (const id of dealIds) deals.push(await db.tx(async (q) => dealOut(q, await advance(q, id), userId)));
    return { province, summary, mine, listings, deals, role: me.role, level: me.level, uses: LAND_USE_ORDER, resale: { min: RESALE_MIN, max: RESALE_MAX } };
  });

  /** Mua thửa mới từ quỹ đất nhà nước (đất trống, chưa dựng công trình). */
  app.post('/api/land/buy', async (req) => {
    const userId = await d.requireUser(req);
    const b = body(req);
    const province = String(b.province ?? ''), use = b.use, count = Number(b.count ?? 1);
    if (!isProvince(province)) throw bad('du_lieu_sai', 'Tỉnh không hợp lệ.');
    if (!isUse(use)) throw bad('du_lieu_sai', 'Loại đất không hợp lệ.');
    if (!Number.isInteger(count) || count < 1 || count > 10) throw bad('du_lieu_sai', 'Mỗi lần mua 1–10 thửa.');
    if (use === 'nong_nghiep') throw bad('dung_canh_dong', 'Đất nông nghiệp mua trong mục Cánh đồng (mỗi thửa là một khối ruộng).', 409);
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      const me = await roleLevel(q, userId);
      const why = canBuyLand(use, me.role, me.level);
      if (why) throw bad('chua_du_dieu_kien', why, 403);
      const left = await lotsLeft(q, province, use);
      if (left < count) throw bad('het_dat', `${province} chỉ còn ${left} thửa ${LAND_USES[use].short.toLowerCase()} trong quỹ đất đợt này.`, 409);
      const price = lotPrice(province, use), c = buyCost(price * count), certFee = c.certFee * count, total = c.price + c.registration + certFee;
      if (me.cash < total) throw bad('khong_du_tien', `Cần ${total.toLocaleString('vi-VN')}đ (tiền đất, lệ phí trước bạ, phí cấp sổ).`, 409);
      await d.addCash(q, userId, -c.price, `dat:${use}:${province}`);
      await d.addCash(q, userId, -c.registration, `truoc_ba:${province}`);
      await d.addCash(q, userId, -certFee, `cap_so:${province}`);
      const ids: number[] = [];
      for (let i = 0; i < count; i++) ids.push(await issueLot(q, userId, province, use, price));
      await d.addXp(q, userId, 20 * count, 'mua_dat');
      const lots = (await q.query(`${LOT_SELECT} where l.id = any($1::bigint[]) order by l.id`, [ids])).rows.map((r) => lotOut(r, userId));
      return { lots, cost: { price: c.price, registration: c.registration, certFee, total }, cash: me.cash - total };
    });
  });

  /** Rao bán một thửa trống (chưa dựng công trình, chưa làm ruộng). Giá trong khoảng 70%–300% giá nhà nước. */
  app.post('/api/land/:id/list', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id), price = Number(body(req).price);
    return db.tx(async (q) => {
      const r = (await q.query('select * from land_lots where id = $1 for update', [id])).rows[0];
      if (!r || Number(r.owner_id) !== userId || r.state !== 'co_chu') throw bad('khong_tim_thay', 'Không tìm thấy thửa đất của bạn.', 404);
      if (r.tenure === 'thue') throw bad('dat_thue', 'Đất thuê của Nhà nước không chuyển nhượng được.', 409);
      if (r.property_id != null || r.field_id != null) throw bad('dang_dung', 'Thửa đang có công trình hoặc ruộng, chưa bán được.', 409);
      const live = (await q.query(`select 1 from land_deals where lot_id = $1 and status = any($2::text[]) and status <> 'de_nghi'`, [id, ACTIVE_DEAL])).rows.length;
      if (live) throw bad('dang_giao_dich', 'Thửa đang làm thủ tục chuyển nhượng.', 409);
      const state = lotPrice(r.province, r.use), lo = Math.round(state * RESALE_MIN), hi = Math.round(state * RESALE_MAX);
      if (!Number.isSafeInteger(price) || price < lo || price > hi) throw bad('gia_sai', `Giá rao phải từ ${lo.toLocaleString('vi-VN')}đ đến ${hi.toLocaleString('vi-VN')}đ.`, 409);
      await q.query('update land_lots set listing_price = $2, listed_at = now() where id = $1', [id, price]);
      return { ok: true, lot: lotOut({ ...r, listing_price: price }, userId), seller: sellerNet(price) };
    });
  });
  app.post('/api/land/:id/unlist', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id);
    return db.tx(async (q) => {
      const live = (await q.query(`select 1 from land_deals where lot_id = $1 and status = any($2::text[]) and status <> 'de_nghi'`, [id, ACTIVE_DEAL])).rows.length;
      if (live) throw bad('dang_giao_dich', 'Thửa đang làm thủ tục chuyển nhượng, không thôi rao được.', 409);
      const r = (await q.query('update land_lots set listing_price = null, listed_at = null where id = $1 and owner_id = $2 returning *', [id, userId])).rows[0];
      if (!r) throw bad('khong_tim_thay', 'Không tìm thấy thửa đất của bạn.', 404);
      await q.query(`update land_deals set status = 'da_huy', cancelled_at = now(), cancel_reason = 'thoi_rao', updated_at = now() where lot_id = $1 and status = 'de_nghi'`, [id]);
      return { ok: true, lot: lotOut(r, userId) };
    });
  });
  /** Bỏ kiểu "mua ngay": chuyển nhượng phải qua công chứng, đăng ký biến động, thuế. */
  app.post('/api/land/:id/purchase', async () => { throw bad('phai_cong_chung', 'Mua đất phải trả giá rồi làm thủ tục công chứng, đăng ký biến động ở Trung tâm hành chính công.', 410); });

  /** Bên mua trả giá một thửa đang rao (có thể khác giá rao, trong khung 70%–300% giá nhà nước). */
  app.post('/api/land/:id/offer', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id);
    return db.tx(async (q) => {
      const r = (await q.query('select * from land_lots where id = $1 for update', [id])).rows[0];
      if (!r || r.listing_price == null || r.state !== 'co_chu') throw bad('khong_tim_thay', 'Thửa này không còn rao bán.', 404);
      const sellerId = Number(r.owner_id);
      if (sellerId === userId) throw bad('cua_ban', 'Đây là thửa của bạn.', 409);
      const me = await roleLevel(q, userId);
      const why = canBuyLand(r.use, me.role, me.level);
      if (why) throw bad('chua_du_dieu_kien', why, 403);
      const state = lotPrice(r.province, r.use), lo = Math.round(state * RESALE_MIN), hi = Math.round(state * RESALE_MAX);
      const price = b2n(body(req).price, Number(r.listing_price));
      if (price < lo || price > hi) throw bad('gia_sai', `Giá phải từ ${lo.toLocaleString('vi-VN')}đ đến ${hi.toLocaleString('vi-VN')}đ.`, 409);
      const live = (await q.query(`select 1 from land_deals where lot_id = $1 and status = any($2::text[]) and status <> 'de_nghi'`, [id, ACTIVE_DEAL])).rows.length;
      if (live) throw bad('dang_giao_dich', 'Thửa đang làm thủ tục với người khác.', 409);
      await q.query(`update land_deals set status = 'da_huy', cancelled_at = now(), cancel_reason = 'tra_gia_moi', updated_at = now() where lot_id = $1 and buyer_id = $2 and status = 'de_nghi'`, [id, userId]);
      const ins = await q.query('insert into land_deals (lot_id, seller_id, buyer_id, price) values ($1,$2,$3,$4) returning *', [id, sellerId, userId, price]);
      return { ok: true, deal: await dealOut(q, ins.rows[0], userId) };
    });
  });
  const b2n = (v: unknown, fb: number) => { const n = v === undefined || v === null || v === '' ? fb : Number(v); if (!Number.isSafeInteger(n) || n <= 0) throw bad('gia_sai', 'Giá không hợp lệ.'); return n; };

  async function dealFor(q: Q, req: FastifyRequest, userId: number) {
    const id = idOf((req.params as any).id);
    const r = await advance(q, id);
    if (!r || (Number(r.seller_id) !== userId && Number(r.buyer_id) !== userId)) throw bad('khong_tim_thay', 'Không tìm thấy giao dịch.', 404);
    const lot = (await q.query('select * from land_lots where id = $1 for update', [r.lot_id])).rows[0];
    return { r, lot, seller: Number(r.seller_id) === userId };
  }
  const need = (r: any, st: DealStatus) => { if (r.status !== st) throw bad('sai_buoc', `Giao dịch đang ở bước "${DEAL_NAMES[r.status as DealStatus]}".`, 409); };

  app.get('/api/land/deals/:id', async (req) => {
    const userId = await d.requireUser(req);
    return db.tx(async (q) => { const { r } = await dealFor(q, req, userId); return { deal: await dealOut(q, r, userId) }; });
  });
  /** Bên bán đồng ý giá: hẹn công chứng (các trả giá khác cho thửa này bị huỷ). */
  app.post('/api/land/deals/:id/accept', async (req) => {
    const userId = await d.requireUser(req);
    return db.tx(async (q) => {
      const { r, lot, seller } = await dealFor(q, req, userId);
      if (!seller) throw bad('khong_phai_ben_ban', 'Chỉ bên bán đồng ý giá.', 403);
      need(r, 'de_nghi');
      if (Number(lot.owner_id) !== userId || lot.listing_price == null) throw bad('het_rao', 'Thửa không còn rao bán.', 409);
      const until = new Date(Date.now() + calDaysMs(NOTARY_APPOINT_DAYS)); // hẹn theo lịch thật của game, không tua theo TIME_SCALE
      await q.query(`update land_deals set status = 'hen_cong_chung', appoint_until = $2, updated_at = now() where id = $1`, [r.id, until]);
      await q.query(`update land_deals set status = 'da_huy', cancelled_at = now(), cancel_reason = 'ban_cho_nguoi_khac', updated_at = now() where lot_id = $1 and id <> $2 and status = 'de_nghi'`, [r.lot_id, r.id]);
      return { ok: true, deal: await dealOut(q, (await q.query('select * from land_deals where id = $1', [r.id])).rows[0], userId) };
    });
  });
  /** Huỷ: trước khi hợp đồng được công chứng thì bên nào cũng huỷ được. */
  app.post('/api/land/deals/:id/cancel', async (req) => {
    const userId = await d.requireUser(req);
    return db.tx(async (q) => {
      const { r, seller } = await dealFor(q, req, userId);
      if (!['de_nghi', 'hen_cong_chung'].includes(r.status)) throw bad('da_cong_chung', 'Hợp đồng đã công chứng, không tự huỷ được.', 409);
      await q.query(`update land_deals set status = 'da_huy', cancelled_at = now(), cancel_reason = $2, updated_at = now() where id = $1`, [r.id, seller ? 'ben_ban_huy' : 'ben_mua_huy']);
      return { ok: true };
    });
  });
  /** Quầy 1 · Công chứng: mỗi bên ký khi đang có mặt; bên ký sau phải thấy bên kia cũng đang có mặt. Đủ hai chữ ký: bên mua chuyển tiền vào tài khoản phong toả, nộp phí công chứng. */
  app.post('/api/land/deals/:id/sign', async (req) => {
    const userId = await d.requireUser(req);
    return db.tx(async (q) => {
      const { r, lot, seller } = await dealFor(q, req, userId);
      need(r, 'hen_cong_chung');
      await mustBeHere(q, userId, lot.province, 'Quầy 1 · Văn phòng công chứng');
      const other = seller ? Number(r.buyer_id) : Number(r.seller_id);
      if (!(await presentAt(q, other, lot.province))) throw bad('ben_kia_vang_mat', 'Công chứng viên cần cả hai bên cùng có mặt. Hẹn bên kia tới Trung tâm hành chính công rồi ký.', 409);
      const price = Number(r.price), fee = notaryFee(Math.max(price, lotPrice(lot.province, lot.use))) + NOTARY_DRAFT_FEE;
      if (seller) await q.query('update land_deals set seller_signed_at = coalesce(seller_signed_at, now()), updated_at = now() where id = $1', [r.id]);
      else {
        const buyer = (await q.query('select cash from users where id = $1 for update', [userId])).rows[0];
        if (!r.buyer_signed_at && Number(buyer.cash) < price + fee) throw bad('khong_du_tien', `Bên mua cần ${(price + fee).toLocaleString('vi-VN')}đ (tiền đất chuyển vào tài khoản phong toả và phí công chứng).`, 409);
        await q.query('update land_deals set buyer_signed_at = coalesce(buyer_signed_at, now()), updated_at = now() where id = $1', [r.id]);
      }
      const now = (await q.query('select * from land_deals where id = $1', [r.id])).rows[0];
      if (now.seller_signed_at && now.buyer_signed_at) {
        const buyerId = Number(r.buyer_id), bc = Number((await q.query('select cash from users where id = $1 for update', [buyerId])).rows[0].cash);
        if (bc < price + fee) throw bad('khong_du_tien', 'Bên mua không còn đủ tiền để công chứng.', 409);
        await d.addCash(q, buyerId, -price, `phong_toa_dat:${r.id}`);
        await d.addCash(q, buyerId, -fee, `cong_chung:${r.id}`);
        await q.query(`update land_deals set status = 'da_cong_chung', notarized_at = now(), notary_fee = $2, escrow = $3, updated_at = now() where id = $1`, [r.id, fee, price]);
      }
      return { ok: true, deal: await dealOut(q, (await q.query('select * from land_deals where id = $1', [r.id])).rows[0], userId) };
    });
  });
  /** Quầy 2 · Nộp hồ sơ đăng ký biến động (một bên nộp). Hồ sơ chuyển sang cơ quan thuế xác định nghĩa vụ tài chính. */
  app.post('/api/land/deals/:id/submit', async (req) => {
    const userId = await d.requireUser(req);
    return db.tx(async (q) => {
      const { r, lot } = await dealFor(q, req, userId);
      need(r, 'da_cong_chung');
      await mustBeHere(q, userId, lot.province, 'Quầy 2 · Văn phòng đăng ký đất đai');
      const price = Number(r.price), base = Math.max(price, lotPrice(lot.province, lot.use));
      await q.query(`update land_deals set status = 'dang_xu_ly', submitted_at = now(), tax_notice_at = $2, seller_tax = $3, buyer_fee = $4, cert_fee = $5, updated_at = now() where id = $1`,
        [r.id, new Date(Date.now() + workDaysMs(TAX_NOTICE_WORKDAYS, d.timeScale)), transferTax(base), registrationFee(base), CERT_FEE]);
      return { ok: true, deal: await dealOut(q, (await q.query('select * from land_deals where id = $1', [r.id])).rows[0], userId) };
    });
  });
  /** Quầy 3 · Mỗi bên nộp phần của mình theo thông báo thuế. Đủ hai phần: Văn phòng đăng ký chỉnh lý hồ sơ trong 10 ngày làm việc. */
  app.post('/api/land/deals/:id/pay', async (req) => {
    const userId = await d.requireUser(req);
    return db.tx(async (q) => {
      const { r, lot, seller } = await dealFor(q, req, userId);
      need(r, 'cho_nop_thue');
      await mustBeHere(q, userId, lot.province, 'Quầy 3 · Chi cục thuế');
      if (seller) {
        if (!r.seller_paid_at) {
          // thuế TNCN của bên bán trừ thẳng vào tiền đang phong toả nếu bên bán không đủ tiền mặt
          const cash = Number((await q.query('select cash from users where id = $1 for update', [userId])).rows[0].cash), tax = Number(r.seller_tax);
          if (cash >= tax) await d.addCash(q, userId, -tax, `thue_tncn_dat:${r.id}`);
          else await q.query('update land_deals set escrow = escrow - $2 where id = $1', [r.id, tax]);
          await q.query('update land_deals set seller_paid_at = now(), updated_at = now() where id = $1', [r.id]);
        }
      } else if (!r.buyer_paid_at) {
        const cash = Number((await q.query('select cash from users where id = $1 for update', [userId])).rows[0].cash), due = Number(r.buyer_fee) + Number(r.cert_fee);
        if (cash < due) throw bad('khong_du_tien', `Cần ${due.toLocaleString('vi-VN')}đ (lệ phí trước bạ và lệ phí cấp giấy chứng nhận).`, 409);
        await d.addCash(q, userId, -Number(r.buyer_fee), `truoc_ba:${lot.province}`);
        await d.addCash(q, userId, -Number(r.cert_fee), `cap_so:${lot.province}`);
        await q.query('update land_deals set buyer_paid_at = now(), updated_at = now() where id = $1', [r.id]);
      }
      const now = (await q.query('select * from land_deals where id = $1', [r.id])).rows[0];
      if (now.seller_paid_at && now.buyer_paid_at) {
        await q.query(`update land_deals set status = 'cho_tra_ket_qua', ready_at = $2, updated_at = now() where id = $1`, [r.id, new Date(Date.now() + workDaysMs(REGISTER_WORKDAYS, d.timeScale))]);
      }
      return { ok: true, deal: await dealOut(q, (await q.query('select * from land_deals where id = $1', [r.id])).rows[0], userId) };
    });
  });
  /** Quầy 2 · Trả kết quả: bên mua nhận giấy chứng nhận mới; sổ cũ bị thu hồi; tiền phong toả chuyển cho bên bán; ghi sổ biến động. */
  app.post('/api/land/deals/:id/collect', async (req) => {
    const userId = await d.requireUser(req);
    return db.tx(async (q) => {
      const { r, lot, seller } = await dealFor(q, req, userId);
      need(r, 'cho_tra_ket_qua');
      if (seller) throw bad('khong_phai_ben_mua', 'Bên mua nhận giấy chứng nhận mới.', 403);
      if (ms(r.ready_at)! > Date.now()) throw bad('chua_xong', 'Hồ sơ chưa chỉnh lý xong.', 409);
      await mustBeHere(q, userId, lot.province, 'Quầy 2 · Trả kết quả');
      const sellerId = Number(r.seller_id), price = Number(r.price);
      const oldSerial = await revokeCert(q, Number(lot.id), 'chuyen_nhuong');
      await q.query(`update land_lots set owner_id = $2, price_paid = $3, listing_price = null, listed_at = null, acquired_at = now() where id = $1`, [lot.id, userId, price]);
      const serial = await newSerial(q, Number(lot.id), userId);
      await d.addCash(q, sellerId, Number(r.escrow), `ban_dat:${lot.id}`);
      await q.query('insert into land_transfers (lot_id, seller_id, buyer_id, price, registration, tax) values ($1,$2,$3,$4,$5,$6)', [lot.id, sellerId, userId, price, r.buyer_fee, r.seller_tax]);
      const hash = await appendLedger(q, Number(lot.id), 'chuyen_nhuong', { parcel: lot.parcel_code, from: sellerId, to: userId, price, oldSerial, serial, deal: Number(r.id) });
      await q.query(`update land_deals set status = 'hoan_tat', done_at = now(), new_serial = $2, escrow = 0, updated_at = now() where id = $1`, [r.id, serial]);
      await d.addXp(q, userId, 20, 'mua_dat');
      return { ok: true, serial, hash, deal: await dealOut(q, (await q.query('select * from land_deals where id = $1', [r.id])).rows[0], userId) };
    });
  });

  /** Tra cứu thửa theo số phát hành, mã thửa hoặc số id: thông tin thửa, chủ hiện tại, toàn bộ biến động và kiểm chuỗi băm. */
  app.get('/api/land/lookup', async (req) => {
    const userId = await d.requireUser(req);
    const raw = String((req.query as Record<string, unknown>).q ?? '').trim().toUpperCase();
    if (!raw) throw bad('du_lieu_sai', 'Nhập số phát hành (ví dụ AB 12345678) hoặc mã thửa (ví dụ DN.0001.0007).');
    let lotId: number | null = null;
    if (SERIAL_RE.test(raw)) lotId = Number((await db.query('select lot_id from land_certs where serial = $1', [raw])).rows[0]?.lot_id ?? 0) || null;
    if (!lotId) lotId = Number((await db.query('select id from land_lots where parcel_code = $1', [raw])).rows[0]?.id ?? 0) || null;
    if (!lotId) throw bad('khong_tim_thay', 'Không có thửa hay giấy chứng nhận nào mang số này.', 404);
    const lot = (await db.query(`${LOT_SELECT} where l.id = $1`, [lotId])).rows[0];
    const certs = (await db.query('select serial, issued_at, revoked_at, revoke_reason, owner_id from land_certs where lot_id = $1 order by issued_at', [lotId])).rows;
    const ids = [...new Set(certs.map((c) => Number(c.owner_id)).filter(Boolean))];
    const names = Object.fromEntries((await db.query('select id, display_name from users where id = any($1::bigint[])', [ids])).rows.map((u) => [Number(u.id), u.display_name]));
    const rows = (await db.query('select id, kind, data, at, prev_hash, hash from land_ledger where lot_id = $1 order by id', [lotId])).rows;
    // kiểm từng bản ghi của thửa: mã khớp nội dung và mã trước của nó có thật trong chuỗi
    const prevOk = new Set((await db.query('select hash from land_ledger where hash = any($1::text[])', [rows.map((r) => r.prev_hash)])).rows.map((r) => r.hash));
    const history = rows.map((r) => {
      const okSelf = sha256(ledgerPayload({ prev: r.prev_hash, lotId, kind: r.kind, at: Number(r.at), data: r.data })) === r.hash;
      const okPrev = r.prev_hash === '0'.repeat(64) || prevOk.has(r.prev_hash);
      const name = (id: unknown) => (id == null ? 'Nhà nước' : names[Number(id)] ?? `#${id}`);
      return { id: Number(r.id), kind: r.kind as LedgerKind, kindName: LEDGER_NAMES[r.kind as LedgerKind] ?? r.kind, at: Number(r.at), hash: r.hash, prev: r.prev_hash, ok: okSelf && okPrev,
        serial: r.data.serial ?? null, oldSerial: r.data.oldSerial ?? null, price: r.data.price ?? null,
        from: r.kind === 'cap_lan_dau' || r.kind === 'cho_thue' || r.kind === 'gia_han_thue' ? 'Nhà nước' : name(r.data.from), to: r.kind === 'thu_hoi' || r.kind === 'het_thue' ? 'Nhà nước' : name(r.data.to ?? r.data.owner),
        lease: r.data.lease ?? null, until: r.data.until ?? null };
    });
    return {
      lot: lotOut(lot, userId), owner: lot.owner_id == null ? null : lot.display_name,
      certs: certs.map((c) => ({ serial: c.serial, issuedAt: ms(c.issued_at), revokedAt: ms(c.revoked_at), reason: c.revoke_reason, owner: names[Number(c.owner_id)] ?? null })),
      history, intact: history.every((h) => h.ok),
    };
  });
  /** Kiểm toàn bộ sổ biến động (ai cũng gọi được). */
  app.get('/api/land/ledger/verify', async (req) => {
    await d.requireUser(req);
    return verifyLedger(db);
  });
  app.get('/api/land/:id', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id);
    const r = (await db.query(`${LOT_SELECT} where l.id = $1`, [id])).rows[0];
    if (!r) throw bad('khong_tim_thay', 'Không tìm thấy thửa đất.', 404);
    const history = (await db.query(`select t.price, t.created_at, s.display_name as seller, b.display_name as buyer from land_transfers t
      left join users s on s.id = t.seller_id left join users b on b.id = t.buyer_id where t.lot_id = $1 order by t.id desc limit 20`, [id])).rows
      .map((h) => ({ price: Number(h.price), at: new Date(h.created_at).getTime(), seller: h.seller, buyer: h.buyer }));
    return { lot: lotOut(r, userId), history };
  });
}
