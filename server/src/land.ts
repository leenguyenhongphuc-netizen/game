// Sổ địa chính: quỹ đất từng tỉnh (shared/land.ts), cấp sổ cho từng thửa, rao bán và chuyển nhượng giữa người chơi,
// và giá tham chiếu đời thực (/api/prices). Đăng ký từ app.ts qua registerLand.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { levelOf } from '../../shared/rules.ts';
import type { Role } from '../../shared/rules.ts';
import {
  LAND_USES, LAND_USE_ORDER, RESALE_MAX, RESALE_MIN, buyCost, canBuyLand, certNo, lotPrice, provinceLandSummary, releasedLots, sellerNet,
} from '../../shared/land.ts';
import type { LandUse } from '../../shared/land.ts';
import { isProvince } from '../../shared/economy.ts';
import { REF_PRICES, setLivePrices } from '../../shared/realPrices.ts';
import type { RefPriceKey } from '../../shared/realPrices.ts';

// Bảng land_lots, land_transfers, ref_prices nằm trong schema.ts.

const isUse = (v: unknown): v is LandUse => typeof v === 'string' && Object.hasOwn(LAND_USES, v);

/** Số thửa còn trong quỹ đất đợt 1 của tỉnh (đã cấp sổ thì trừ ra; thửa thu hồi về nhà nước không còn chủ thì vẫn tính là đã cấp). */
export async function lotsLeft(q: Q, province: string, use: LandUse): Promise<number> {
  const n = Number((await q.query('select count(*)::int as n from land_lots where province = $1 and use = $2', [province, use])).rows[0].n);
  return Math.max(0, releasedLots(province, use) - n);
}
/** Cấp sổ một thửa mới cho người chơi (người gọi đã trừ tiền). Trả về id thửa. */
export async function issueLot(q: Q, userId: number, province: string, use: LandUse, price: number, fieldId: number | null = null): Promise<number> {
  const ins = await q.query('insert into land_lots (province, use, owner_id, area_m2, price_paid, field_id) values ($1,$2,$3,$4,$5,$6) returning id',
    [province, use, userId, LAND_USES[use].lotM2, price, fieldId]);
  const id = Number(ins.rows[0].id);
  await q.query('update land_lots set cert_no = $2 where id = $1', [id, certNo(province, use, id)]);
  return id;
}

export interface LandDeps {
  db: Db;
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

export function registerLand(app: FastifyInstance, d: LandDeps) {
  const { db, bad } = d;
  app.addHook('onReady', async () => { await seedRefPrices(db); });
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;
  const idOf = (v: unknown) => { const n = Number(v); if (!Number.isSafeInteger(n) || n <= 0) throw bad('khong_tim_thay', 'Không tìm thấy.', 404); return n; };
  const lotOut = (r: any, userId: number) => ({
    id: Number(r.id), province: r.province, use: r.use as LandUse, useName: LAND_USES[r.use as LandUse]?.short ?? r.use, emoji: LAND_USES[r.use as LandUse]?.emoji,
    areaM2: Number(r.area_m2), pricePaid: Number(r.price_paid), certNo: r.cert_no, ownerId: r.owner_id == null ? null : Number(r.owner_id),
    ownerName: r.display_name ?? null, mine: Number(r.owner_id) === userId, propertyId: r.property_id == null ? null : Number(r.property_id),
    fieldId: r.field_id == null ? null : Number(r.field_id), listingPrice: r.listing_price == null ? null : Number(r.listing_price),
    statePrice: lotPrice(r.province, r.use as LandUse), acquiredAt: new Date(r.acquired_at).getTime(),
    used: r.property_id != null || r.field_id != null,
  });
  async function roleLevel(q: Q, userId: number) {
    const u = (await q.query('select role, xp, cash from users where id = $1', [userId])).rows[0];
    return { role: (u.role ?? null) as Role | null, level: levelOf(Number(u.xp)).level, cash: Number(u.cash) };
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
    const mine = (await db.query('select * from land_lots where owner_id = $1 order by province, use, id', [userId])).rows.map((r) => lotOut(r, userId));
    let summary = null, listings: unknown[] = [];
    if (province) {
      const sold = Object.fromEntries((await db.query('select use, count(*)::int as n from land_lots where province = $1 group by use', [province])).rows.map((r) => [r.use, Number(r.n)]));
      summary = provinceLandSummary(province, sold).map((r) => ({ ...r, blocked: canBuyLand(r.use, me.role, me.level), cost: buyCost(r.lotPrice) }));
      listings = (await db.query(`select l.*, u.display_name from land_lots l left join users u on u.id = l.owner_id
        where l.province = $1 and l.listing_price is not null order by l.listing_price limit 50`, [province])).rows.map((r) => lotOut(r, userId));
    }
    return { province, summary, mine, listings, role: me.role, level: me.level, uses: LAND_USE_ORDER, resale: { min: RESALE_MIN, max: RESALE_MAX } };
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
      const lots = (await q.query('select * from land_lots where id = any($1::bigint[]) order by id', [ids])).rows.map((r) => lotOut(r, userId));
      return { lots, cost: { price: c.price, registration: c.registration, certFee, total }, cash: me.cash - total };
    });
  });

  /** Rao bán một thửa trống (chưa dựng công trình, chưa làm ruộng). Giá trong khoảng 70%–300% giá nhà nước. */
  app.post('/api/land/:id/list', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id), price = Number(body(req).price);
    return db.tx(async (q) => {
      const r = (await q.query('select * from land_lots where id = $1 for update', [id])).rows[0];
      if (!r || Number(r.owner_id) !== userId) throw bad('khong_tim_thay', 'Không tìm thấy thửa đất của bạn.', 404);
      if (r.property_id != null || r.field_id != null) throw bad('dang_dung', 'Thửa đang có công trình hoặc ruộng, chưa bán được.', 409);
      const state = lotPrice(r.province, r.use), lo = Math.round(state * RESALE_MIN), hi = Math.round(state * RESALE_MAX);
      if (!Number.isSafeInteger(price) || price < lo || price > hi) throw bad('gia_sai', `Giá rao phải từ ${lo.toLocaleString('vi-VN')}đ đến ${hi.toLocaleString('vi-VN')}đ.`, 409);
      await q.query('update land_lots set listing_price = $2, listed_at = now() where id = $1', [id, price]);
      return { ok: true, lot: lotOut({ ...r, listing_price: price }, userId), seller: sellerNet(price) };
    });
  });
  app.post('/api/land/:id/unlist', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id);
    const r = (await db.query('update land_lots set listing_price = null, listed_at = null where id = $1 and owner_id = $2 returning *', [id, userId])).rows[0];
    if (!r) throw bad('khong_tim_thay', 'Không tìm thấy thửa đất của bạn.', 404);
    return { ok: true, lot: lotOut(r, userId) };
  });
  /** Mua lại thửa người khác rao: người mua trả giá + trước bạ 0,5% + phí sổ; người bán nhận giá − thuế TNCN 2%; sổ sang tên. */
  app.post('/api/land/:id/purchase', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id);
    return db.tx(async (q) => {
      const r = (await q.query('select * from land_lots where id = $1 for update', [id])).rows[0];
      if (!r || r.listing_price == null) throw bad('khong_tim_thay', 'Thửa này không còn rao bán.', 404);
      const sellerId = Number(r.owner_id);
      if (sellerId === userId) throw bad('cua_ban', 'Đây là thửa của bạn.', 409);
      await q.query('select id from users where id = any($1::bigint[]) order by id for update', [[userId, sellerId]]);
      const me = await roleLevel(q, userId);
      const why = canBuyLand(r.use, me.role, me.level);
      if (why) throw bad('chua_du_dieu_kien', why, 403);
      const price = Number(r.listing_price), c = buyCost(price), s = sellerNet(price);
      if (me.cash < c.total) throw bad('khong_du_tien', `Cần ${c.total.toLocaleString('vi-VN')}đ (giá, lệ phí trước bạ, phí sang tên).`, 409);
      await d.addCash(q, userId, -c.price, `mua_lai_dat:${id}`);
      await d.addCash(q, userId, -c.registration, `truoc_ba:${r.province}`);
      await d.addCash(q, userId, -c.certFee, `sang_ten:${id}`);
      await d.addCash(q, sellerId, s.net, `ban_dat:${id}`);
      await q.query('update land_lots set owner_id = $2, price_paid = $3, listing_price = null, listed_at = null, acquired_at = now() where id = $1', [id, userId, price]);
      await q.query('insert into land_transfers (lot_id, seller_id, buyer_id, price, registration, tax) values ($1,$2,$3,$4,$5,$6)', [id, sellerId, userId, price, c.registration, s.tax]);
      await d.addXp(q, userId, 20, 'mua_dat');
      const lot = (await q.query('select * from land_lots where id = $1', [id])).rows[0];
      return { ok: true, lot: lotOut(lot, userId), cost: c, sellerGot: s.net, tax: s.tax, cash: me.cash - c.total };
    });
  });
  app.get('/api/land/:id', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id);
    const r = (await db.query('select l.*, u.display_name from land_lots l left join users u on u.id = l.owner_id where l.id = $1', [id])).rows[0];
    if (!r) throw bad('khong_tim_thay', 'Không tìm thấy thửa đất.', 404);
    const history = (await db.query(`select t.price, t.created_at, s.display_name as seller, b.display_name as buyer from land_transfers t
      left join users s on s.id = t.seller_id left join users b on b.id = t.buyer_id where t.lot_id = $1 order by t.id desc limit 20`, [id])).rows
      .map((h) => ({ price: Number(h.price), at: new Date(h.created_at).getTime(), seller: h.seller, buyer: h.buyer }));
    return { lot: lotOut(r, userId), history };
  });
}
