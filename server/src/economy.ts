// Kinh tế mở rộng: lô xuất khẩu nhiều mặt hàng, công ty xuất nhập khẩu (NPC) đặt hợp đồng thu mua,
// tài sản thương mại ở tỉnh khác (siêu thị riêng, xưởng chi nhánh). Đăng ký từ app.ts qua registerEconomy.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { CROPS, REGIONS, SPECIALTIES, recipeOf } from '../../shared/catalog.ts';
import { EXPORT_MARKETS, EXPORT_MODES, MACHINES, SUPER_MAX_RATIO, SUPER_MIN_RATIO, haversineKm, levelOf } from '../../shared/rules.ts';
import type { ExportMarket, ExportMode, MachineKind, Quality, Role } from '../../shared/rules.ts';
import { canUse } from '../../shared/roles.ts';
import {
  BRANCH_MACHINE_SLOTS, COMPANIES, CONTRACT_SHIP_PER_KG_KM, PROPERTY_FARMER_LEVEL, PROPERTY_KINDS, SHOP_CONSIGN_FEE,
  company as findCompany, isProvince, contractDaysOpen, contractsOfDay, econDay, exportBundleQuote, propertyCost, provinceTraffic, shopKgPerHour,
} from '../../shared/economy.ts';
import type { BundleLineIn, Contract, PropertyKind } from '../../shared/economy.ts';
import { LAND_USES, canBuild } from '../../shared/land.ts';
import type { LandUse } from '../../shared/land.ts';
import { issueLot, lotsLeft } from './land.ts';

type XpOut = { xpGained: number; xp: number; level: number; title: string; levelUp: boolean };
export interface EconomyDeps {
  db: Db;
  /** Dùng một giấy phép xây dựng đã cấp (server/src/admin.ts); không có thì không đòi giấy phép. */
  usePermit?: (q: Q, userId: number, province: string, kind: string) => Promise<void>;
  timeScale: number;
  requireUser: (req: FastifyRequest) => Promise<number>;
  bad: (code: string, message: string, status?: number) => Error;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
  addXp: (q: Q, userId: number, n: number, source?: any) => Promise<XpOut>;
  addInventory: (q: Q, userId: number, specialtyId: string, ql: Quality, kg: number) => Promise<void>;
  takeInventory: (q: Q, userId: number, specialtyId: string, ql: Quality, kg: number) => Promise<void>;
  addProduct: (q: Q, userId: number, specialtyId: string, kg: number) => Promise<void>;
  takeProduct: (q: Q, userId: number, specialtyId: string, kg: number) => Promise<void>;
  currentPrice: (q: Q, specialtyId: string) => Promise<number>;
  productRef: (q: Q, specialtyId: string) => Promise<number>;
  /** Bối cảnh xuất khẩu của người chơi (giảm cước, số lô đang đi, vùng gửi...). */
  exportContext: (q: Q, userId: number) => Promise<{ cash: number; role: Role | null; from: string | null; modes: ExportMode[]; active: number; maxActive: number; discount: number; valueBonus: number }>;
  shipmentOut: (row: any) => unknown;
  /** Các tỉnh người chơi đang có mặt (vùng nhà, nơi tham quan, nơi xe đỗ). */
  provincesOf: (q: Q, userId: number) => Promise<string[]>;
}

const GRADE_RANK: Record<Quality, number> = { A: 3, B: 2, C: 1 };
const isQuality = (v: unknown): v is Quality => v === 'A' || v === 'B' || v === 'C';
const round1k = (v: number) => Math.round(v / 1000) * 1000;
const productName = (id: string) => { const sp = SPECIALTIES[id]; return sp ? `${recipeOf(CROPS[sp.crop]).name} ${sp.name}` : id; };

export function registerEconomy(app: FastifyInstance, d: EconomyDeps) {
  const { db, bad } = d;
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;
  const intIn = (v: unknown, min: number, max: number, field: string) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw bad('du_lieu_sai', `Giá trị "${field}" không hợp lệ.`);
    return v;
  };
  const idOf = (v: unknown) => { const n = Number(v); if (!Number.isSafeInteger(n) || n <= 0) throw bad('khong_tim_thay', 'Không tìm thấy.', 404); return n; };
  const levelOfUser = async (q: Q, userId: number) => levelOf(Number((await q.query('select xp from users where id = $1', [userId])).rows[0].xp)).level;

  // ---------------------------------------------------------------- lô xuất khẩu nhiều mặt hàng
  function parseItems(raw: unknown): BundleLineIn[] {
    if (!Array.isArray(raw) || !raw.length || raw.length > 12) throw bad('du_lieu_sai', 'Lô hàng cần từ 1 đến 12 mặt hàng.');
    return raw.map((it: any) => {
      if (!it || typeof it !== 'object' || !SPECIALTIES[String(it.specialtyId)]) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
      const processed = it.processed === true, grade = processed ? 'A' : it.grade ?? it.quality;
      if (!isQuality(grade)) throw bad('du_lieu_sai', 'Loại hàng không hợp lệ.');
      return { specialtyId: String(it.specialtyId), grade, kg: intIn(it.kg, 1, 1_000_000, 'kg'), processed };
    });
  }
  /** Lượng mỗi đặc sản đã xuất vào một thị trường trong 24 giờ (mọi người chơi): sức mua có hạn. */
  async function soldMap(q: Q, market: ExportMarket): Promise<Map<string, number>> {
    const { rows } = await q.query(
      `select specialty_id, coalesce(sum(arrive_kg),0)::int as kg from export_shipments where market = $1 and created_at > now() - interval '24 hours' group by specialty_id`, [market]);
    return new Map(rows.map((r) => [r.specialty_id as string, r.kg as number]));
  }
  async function refMap(q: Q, items: BundleLineIn[]) {
    const m = new Map<string, number>();
    for (const it of items) if (!m.has(it.specialtyId)) m.set(it.specialtyId, await d.currentPrice(q, it.specialtyId));
    return m;
  }
  async function bundleQuotes(q: Q, userId: number, items: BundleLineIn[], markets: ExportMarket[]) {
    const ctx = await d.exportContext(q, userId);
    if (!ctx.from) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
    const refs = await refMap(q, items), out = [];
    for (const market of markets) {
      const sold = await soldMap(q, market);
      for (const mode of EXPORT_MARKETS[market].modes) {
        const qt = exportBundleQuote(items, mode, market, ctx.from, { refOf: (id) => refs.get(id)!, soldOf: (id) => sold.get(id) ?? 0, discount: ctx.discount, valueBonus: ctx.valueBonus });
        out.push({ ...qt, allowed: ctx.modes.includes(mode), minKg: EXPORT_MODES[mode].minKg, maxKg: EXPORT_MODES[mode].maxKg });
      }
    }
    return { ctx, quotes: out.sort((a, b) => Number(b.ok) - Number(a.ok) || b.net - a.net) };
  }
  app.post('/api/export/quote', async (req) => {
    const userId = await d.requireUser(req);
    const b = body(req), items = parseItems(b.items);
    const markets = b.market === undefined ? (Object.keys(EXPORT_MARKETS) as ExportMarket[]) : [String(b.market) as ExportMarket];
    if (!markets.every((m) => Object.hasOwn(EXPORT_MARKETS, m))) throw bad('du_lieu_sai', 'Thị trường không hợp lệ.');
    const { quotes, ctx } = await bundleQuotes(db, userId, items, markets);
    return { quotes, discount: ctx.discount, active: ctx.active, maxActive: ctx.maxActive };
  });
  /** Gửi một lô nhiều mặt hàng: mỗi mặt hàng thành một dòng chung mã lô, cước chia theo kg. */
  async function shipBundle(req: FastifyRequest, userId: number) {
    const b = body(req), items = parseItems(b.items);
    const mode = String(b.mode ?? '') as ExportMode, market = String(b.market ?? '') as ExportMarket;
    if (!Object.hasOwn(EXPORT_MODES, mode) || !Object.hasOwn(EXPORT_MARKETS, market)) throw bad('du_lieu_sai', 'Đường xuất khẩu hoặc thị trường không hợp lệ.');
    return db.tx(async (q) => {
      await q.query('select id from users where id = $1 for update', [userId]);
      await q.query('select pg_advisory_xact_lock(hashtext($1))', [`xk:${market}`]);
      const ctx = await d.exportContext(q, userId);
      if (!ctx.from) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      if (!ctx.modes.includes(mode)) throw bad('khong_duoc_duong_nay', 'Hãy quay vòng quay nhận vai trò trước khi xuất khẩu.', 403);
      if (ctx.active >= ctx.maxActive) throw bad('qua_nhieu_lo', `Bạn đang có ${ctx.maxActive} lô hàng cùng đi một lúc; hãy chờ vài lô tới nơi rồi gửi tiếp.`, 409);
      const refs = await refMap(q, items), sold = await soldMap(q, market);
      const qt = exportBundleQuote(items, mode, market, ctx.from, { refOf: (id) => refs.get(id)!, soldOf: (id) => sold.get(id) ?? 0, discount: ctx.discount, valueBonus: ctx.valueBonus });
      if (!qt.ok) throw bad('lo_hang_sai', qt.reason ?? 'Lô hàng không hợp lệ.', 409);
      // gửi cả lô hoặc không gửi: mặt hàng bị loại phải bỏ ra khỏi giỏ trước
      const excluded = qt.lines.filter((l) => !l.ok);
      if (excluded.length) throw bad('lo_hang_sai', `${excluded.map((l) => l.name).join(', ')}: ${excluded[0].reason} Hãy bỏ khỏi giỏ rồi gửi lại.`, 409);
      if (ctx.cash < qt.freight) throw bad('khong_du_tien', 'Bạn không đủ tiền trả cước.', 409);
      const arrivesAt = new Date(Date.now() + Math.max(1000, Math.round((qt.minutes * 60_000) / d.timeScale)));
      const bundleId = `lo-${userId}-${Date.now().toString(36)}`;
      const rows = [];
      for (const l of qt.lines) {
        if (l.processed) await d.takeProduct(q, userId, l.specialtyId, l.kg); else await d.takeInventory(q, userId, l.specialtyId, l.grade, l.kg);
        const ins = await q.query(
          `insert into export_shipments (user_id, specialty_id, quality, kg, arrive_kg, mode, market, gateway_id, freight, payout, arrives_at, processed, bundle_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
          [userId, l.specialtyId, l.grade, l.kg, l.arriveKg, mode, market, qt.gatewayId, l.freight, l.payout, arrivesAt, !!l.processed, bundleId]);
        rows.push(ins.rows[0]);
      }
      await d.addCash(q, userId, -qt.freight, `cuoc_xuat_khau:${bundleId}`);
      const xp = await d.addXp(q, userId, 10 + Math.min(20, qt.lines.length * 3), 'xuat_gui');
      const shipments = rows.map(d.shipmentOut);
      return { bundleId, shipments, shipment: shipments[0], quote: qt, cash: ctx.cash - qt.freight, ...xp };
    });
  }

  // ---------------------------------------------------------------- công ty xuất nhập khẩu
  const refOfContract = (id: string, processed: boolean) => { const sp = SPECIALTIES[id]; return processed ? sp.refPrice * recipeOf(CROPS[sp.crop]).value : sp.refPrice; };
  function openContracts(now = Date.now()): Contract[] {
    const today = econDay(now);
    return contractDaysOpen(today).flatMap((day) => contractsOfDay(day, refOfContract)).filter((c) => c.expiresAt > now);
  }
  function findContract(id: string): Contract | undefined {
    const m = /^([a-z_]+)-(\d+)-(\d+)$/.exec(id);
    if (!m) return undefined;
    return contractsOfDay(Number(m[2]), refOfContract).find((c) => c.id === id);
  }
  async function deliveredOf(q: Q, ids: string[], userId: number) {
    if (!ids.length) return { total: new Map<string, number>(), mine: new Map<string, number>() };
    const { rows } = await q.query(
      `select contract_id, coalesce(sum(kg),0)::int as kg, coalesce(sum(kg) filter (where user_id = $2),0)::int as mine from contract_deliveries where contract_id = any($1) group by contract_id`, [ids, userId]);
    return { total: new Map(rows.map((r) => [r.contract_id as string, r.kg as number])), mine: new Map(rows.map((r) => [r.contract_id as string, r.mine as number])) };
  }
  const contractOut = (c: Contract, total: number, mine: number) => {
    const co = findCompany(c.companyId)!, sp = SPECIALTIES[c.specialtyId];
    return {
      ...c, name: c.processed ? productName(c.specialtyId) : sp.name, emoji: CROPS[sp.crop].emoji,
      companyName: co.short, province: co.province, regionId: co.regionId, marketName: EXPORT_MARKETS[c.market].name,
      deliveredKg: total, remainingKg: Math.max(0, c.kg - total), myKg: mine, refPrice: Math.round(refOfContract(c.specialtyId, c.processed)),
    };
  };
  const companyOut = (c: typeof COMPANIES[number]) => ({
    ...c, markets: c.markets.map((m) => ({ id: m, name: EXPORT_MARKETS[m].name, icon: EXPORT_MARKETS[m].icon })),
    // công ty cũng nhập máy về bán lại, rẻ hơn mua mới ở xưởng 5%
    shop: c.sells.filter((k): k is MachineKind => Object.hasOwn(MACHINES, k)).map((k) => ({ kind: k, name: MACHINES[k as MachineKind].name, emoji: MACHINES[k as MachineKind].emoji, price: Math.round((MACHINES[k as MachineKind].price * 0.95) / 100_000) * 100_000 })),
  });
  app.get('/api/companies', async (req) => {
    const userId = await d.requireUser(req);
    const role = ((await db.query('select role from users where id = $1', [userId])).rows[0]?.role ?? null) as Role | null;
    const open = openContracts();
    const del = await deliveredOf(db, open.map((c) => c.id), userId);
    return {
      companies: COMPANIES.map((c) => { const co = companyOut(c); return { ...co, shop: canUse(role, 'mua_may') ? co.shop : [], contracts: open.filter((x) => x.companyId === c.id).map((x) => contractOut(x, del.total.get(x.id) ?? 0, del.mine.get(x.id) ?? 0)) }; }),
      shipPerKgKm: CONTRACT_SHIP_PER_KG_KM, now: Date.now(),
    };
  });
  app.get('/api/companies/:id/contracts', async (req) => {
    const userId = await d.requireUser(req);
    const co = findCompany(String((req.params as any).id));
    if (!co) throw bad('khong_tim_thay', 'Không tìm thấy công ty.', 404);
    const open = openContracts().filter((c) => c.companyId === co.id);
    const del = await deliveredOf(db, open.map((c) => c.id), userId);
    const board = open.length ? (await db.query(
      `select d.contract_id, d.user_id, u.display_name, sum(d.kg)::int as kg from contract_deliveries d join users u on u.id = d.user_id
       where d.contract_id = any($1) group by d.contract_id, d.user_id, u.display_name order by kg desc`, [open.map((c) => c.id)])).rows : [];
    return {
      company: companyOut(co),
      contracts: open.map((c) => ({ ...contractOut(c, del.total.get(c.id) ?? 0, del.mine.get(c.id) ?? 0),
        leaderboard: board.filter((r) => r.contract_id === c.id).slice(0, 10).map((r) => ({ userId: Number(r.user_id), name: r.display_name, kg: r.kg, me: Number(r.user_id) === userId })) })),
    };
  });
  app.post('/api/contracts/:id/deliver', async (req) => {
    const userId = await d.requireUser(req);
    const c = findContract(String((req.params as any).id));
    if (!c || c.expiresAt <= Date.now() || !contractDaysOpen(econDay(Date.now())).includes(c.day)) throw bad('khong_tim_thay', 'Hợp đồng không còn hiệu lực.', 404);
    const b = body(req);
    if (b.specialtyId !== undefined && b.specialtyId !== c.specialtyId) throw bad('sai_hang', `Hợp đồng này thu mua ${contractOut(c, 0, 0).name}.`, 409);
    const grade: Quality = c.processed ? 'A' : isQuality(b.grade ?? b.quality) ? (b.grade ?? b.quality) as Quality : c.minGrade;
    if (GRADE_RANK[grade] < GRADE_RANK[c.minGrade]) throw bad('sai_loai', `Công ty chỉ nhận từ Loại ${c.minGrade === 'A' ? 1 : 2} trở lên.`, 409);
    const kgWant = intIn(b.kg, 1, 1_000_000, 'kg');
    const co = findCompany(c.companyId)!;
    return db.tx(async (q) => {
      await q.query('select pg_advisory_xact_lock(hashtext($1))', [`hd:${c.id}`]);
      const u = (await q.query('select home_region_id, truck_region, role from users where id = $1 for update', [userId])).rows[0];
      if (c.processed && u.role === 'nong_dan') throw bad('khong_dung_vai', 'Nhà vườn chỉ nhận hợp đồng hàng tươi do mình trồng; hàng chế biến là việc của chủ xưởng và thương lái.', 403);
      if (!u.home_region_id) throw bad('chua_co_dat', 'Hãy nhận lô đất đầu tiên trước.', 409);
      const done = (await q.query('select coalesce(sum(kg),0)::int as kg from contract_deliveries where contract_id = $1', [c.id])).rows[0].kg as number;
      const kg = Math.min(kgWant, c.kg - done);
      if (kg <= 0) throw bad('du_hang', 'Hợp đồng đã đủ hàng.', 409);
      // tự chở tới (xe đang đỗ ở tỉnh có kho công ty, hoặc vùng nhà cùng tỉnh) thì không mất phí; không thì thuê chành xe
      const provinces = await d.provincesOf(q, userId);
      const here = provinces.includes(co.province);
      const from = REGIONS[u.truck_region ?? u.home_region_id] ?? REGIONS[u.home_region_id], to = REGIONS[co.regionId];
      const km = from && to ? Math.round(haversineKm(from.lat, from.lng, to.lat, to.lng)) : 0;
      const shipFee = here ? 0 : round1k(CONTRACT_SHIP_PER_KG_KM * km * kg);
      if (c.processed) await d.takeProduct(q, userId, c.specialtyId, kg); else await d.takeInventory(q, userId, c.specialtyId, grade, kg);
      const gross = c.price * kg, net = gross - shipFee;
      await d.addCash(q, userId, gross, `hop_dong:${c.id}`);
      if (shipFee) await d.addCash(q, userId, -shipFee, `cuoc_giao_hop_dong:${c.id}`);
      await q.query('insert into contract_deliveries (contract_id, company_id, user_id, specialty_id, kg, paid, ship_fee) values ($1,$2,$3,$4,$5,$6,$7)', [c.id, c.companyId, userId, c.specialtyId, kg, gross, shipFee]);
      const xp = await d.addXp(q, userId, 4 + Math.min(40, Math.floor(gross / 2_000_000)), 'ban_dn');
      return { ok: true, contractId: c.id, kg, unitPrice: c.price, total: gross, shipFee, net, selfDelivered: here, km, remainingKg: c.kg - done - kg, ...xp };
    });
  });

  // ---------------------------------------------------------------- tài sản thương mại
  const MAX_PROPS = Object.fromEntries(Object.entries(PROPERTY_KINDS).map(([k, v]) => [k, v.max])) as Record<PropertyKind, number>;
  const isShop = (kind: string) => kind === 'sieu_thi' || kind === 'cua_hang';
  const propOut = (r: any, now = Date.now()) => {
    const kind = r.kind as PropertyKind, info = PROPERTY_KINDS[kind];
    return {
      id: Number(r.id), kind, name: info.name, emoji: info.emoji, province: r.province, ownerId: Number(r.user_id), ownerName: r.display_name ?? null,
      cost: Number(r.cost), readyAt: new Date(r.ready_at).getTime(), ready: new Date(r.ready_at).getTime() <= now,
      pending: Number(r.pending ?? 0), earnedTotal: Number(r.earned_total ?? 0), traffic: provinceTraffic(r.province), shelves: info.shelves, use: info.use, lots: info.lots,
      ...(kind === 'xuong' ? { machineSlots: BRANCH_MACHINE_SLOTS } : {}),
    };
  };
  /** Số chỗ đặt máy thêm từ xưởng chi nhánh đã xây xong. */
  async function branchSlots(q: Q, userId: number): Promise<number> {
    const { rows } = await q.query(`select count(*)::int as n from properties where user_id = $1 and kind = 'xuong' and ready_at <= now()`, [userId]);
    return rows[0].n * BRANCH_MACHINE_SLOTS;
  }
  function eligible(kind: PropertyKind, role: Role | null, level: number): string | null {
    return canBuild(kind, role, level);
  }
  /** Bán hàng trên kệ siêu thị người chơi theo lượng khách đã tới kể từ lần tính trước. Hàng rẻ bán trước; giá càng sát trần càng chậm. */
  async function settleShop(q: Q, propId: number) {
    const p = (await q.query('select * from properties where id = $1 for update', [propId])).rows[0];
    if (!p || !isShop(p.kind)) return p;
    const now = Date.now(), last = Math.max(new Date(p.ready_at).getTime(), new Date(p.sold_at ?? p.ready_at).getTime());
    if (now <= last) return p;
    const hours = ((now - last) * d.timeScale) / 3_600_000;
    const ownerLevel = await levelOfUser(q, Number(p.user_id));
    let capacity = Math.floor(shopKgPerHour(p.province, ownerLevel, p.kind) * hours);
    if (capacity < 1) return p;
    await q.query('update properties set sold_at = $2 where id = $1', [propId, new Date(now)]);
    const shelves = (await q.query('select * from property_shelves where property_id = $1 and kg > 0 for update', [propId])).rows;
    const priced = [];
    for (const s of shelves) { const ref = s.processed ? await d.productRef(q, s.specialty_id) : await d.currentPrice(q, s.specialty_id); priced.push({ s, ratio: Number(s.price) / Math.max(1, ref) }); }
    priced.sort((a, b) => a.ratio - b.ratio);
    let ownerGets = 0;
    for (const { s, ratio } of priced) {
      if (capacity <= 0) break;
      // trên 1,2 lần giá tham chiếu thì khách mua chậm dần, tới trần chỉ còn 30%
      const pull = ratio <= 1.2 ? 1 : Math.max(0.3, 1 - ((ratio - 1.2) / (SUPER_MAX_RATIO - 1.2)) * 0.7);
      const kg = Math.min(s.kg, Math.max(1, Math.floor(capacity * pull)));
      capacity -= kg;
      const total = Number(s.price) * kg;
      await q.query('update property_shelves set kg = kg - $2, sold_kg = sold_kg + $2 where id = $1', [s.id, kg]);
      if (Number(s.seller_id) === Number(p.user_id)) ownerGets += total;
      else {
        const fee = Math.round(total * SHOP_CONSIGN_FEE);
        ownerGets += fee;
        await d.addCash(q, Number(s.seller_id), total - fee, `sieu_thi_rieng_ban:${s.specialty_id}`);
        await q.query('update users set super_earned = super_earned + $2 where id = $1', [s.seller_id, total - fee]);
      }
    }
    if (ownerGets) await q.query('update properties set pending = pending + $2, earned_total = earned_total + $2 where id = $1', [propId, ownerGets]);
    return (await q.query('select * from properties where id = $1', [propId])).rows[0];
  }
  async function shelvesOf(q: Q, propId: number, userId: number) {
    const { rows } = await q.query('select s.*, u.display_name from property_shelves s join users u on u.id = s.seller_id where property_id = $1 and kg > 0 order by s.id', [propId]);
    const out = [];
    for (const r of rows) {
      const ref = r.processed ? await d.productRef(q, r.specialty_id) : await d.currentPrice(q, r.specialty_id);
      out.push({ id: Number(r.id), specialtyId: r.specialty_id, quality: r.quality, processed: !!r.processed, kg: r.kg, soldKg: r.sold_kg, price: Number(r.price), refPrice: ref,
        name: r.processed ? productName(r.specialty_id) : SPECIALTIES[r.specialty_id]?.name ?? r.specialty_id, sellerName: r.display_name, mine: Number(r.seller_id) === userId });
    }
    return out;
  }
  app.get('/api/properties', async (req) => {
    const userId = await d.requireUser(req);
    const asked = (req.query as Record<string, unknown>).province;
    const province = typeof asked === 'string' && isProvince(asked) ? asked : null;
    const u = (await db.query('select role, xp from users where id = $1', [userId])).rows[0];
    const level = levelOf(Number(u.xp)).level, role = (u.role ?? null) as Role | null;
    const mineIds = (await db.query('select id from properties where user_id = $1 order by id', [userId])).rows.map((r) => Number(r.id));
    for (const id of mineIds) await db.tx((q) => settleShop(q, id));
    const mine = (await db.query('select p.*, u.display_name from properties p join users u on u.id = p.user_id where p.user_id = $1 order by p.id', [userId])).rows.map((r) => propOut(r));
    const kinds = (Object.keys(PROPERTY_KINDS) as PropertyKind[]).map((kind) => ({
      kind, ...PROPERTY_KINDS[kind], ...(province ? { cost: propertyCost(kind, province) } : {}),
      blocked: eligible(kind, role, level) ?? (mine.filter((m) => m.kind === kind).length >= MAX_PROPS[kind] ? `Tối đa ${MAX_PROPS[kind]} ${PROPERTY_KINDS[kind].name.toLowerCase()}.` : null),
      ownedHere: province ? mine.some((m) => m.kind === kind && m.province === province) : false,
      max: MAX_PROPS[kind],
    }));
    const inProvince = province ? (await db.query(
      `select p.*, u.display_name from properties p join users u on u.id = p.user_id where p.province = $1 and p.kind in ('sieu_thi', 'cua_hang') and p.ready_at <= now() order by p.id`, [province])).rows.map((r) => propOut(r)) : [];
    return { mine, kinds, province, inProvince, level, role, consignFee: SHOP_CONSIGN_FEE, branchSlots: await branchSlots(db, userId) };
  });
  app.post('/api/properties/buy', async (req) => {
    const userId = await d.requireUser(req);
    const b = body(req);
    const province = String(b.province ?? ''), kind = String(b.kind ?? '') as PropertyKind;
    if (!isProvince(province)) throw bad('du_lieu_sai', 'Tỉnh không hợp lệ.');
    if (!Object.hasOwn(PROPERTY_KINDS, kind)) throw bad('du_lieu_sai', 'Loại công trình không hợp lệ.');
    return db.tx(async (q) => {
      const u = (await q.query('select role, xp, cash, home_region_id from users where id = $1 for update', [userId])).rows[0];
      const level = levelOf(Number(u.xp)).level, why = eligible(kind, u.role ?? null, level);
      if (why) throw bad('chua_du_dieu_kien', why, 403);
      if (kind === 'xuong' && REGIONS[u.home_region_id]?.province === province) throw bad('cung_tinh', 'Xưởng chính đã ở tỉnh này; xưởng chi nhánh phải đặt ở tỉnh khác.', 409);
      const have = (await q.query('select province from properties where user_id = $1 and kind = $2', [userId, kind])).rows;
      if (have.some((r) => r.province === province)) throw bad('da_co', `Bạn đã có ${PROPERTY_KINDS[kind].name.toLowerCase()} ở ${province}.`, 409);
      if (have.length >= MAX_PROPS[kind]) throw bad('qua_nhieu', `Tối đa ${MAX_PROPS[kind]} ${PROPERTY_KINDS[kind].name.toLowerCase()}.`, 409);
      // Công trình dựng trên thửa đất: dùng thửa trống bạn đã có ở tỉnh này trước, thiếu thì mua thêm từ quỹ đất.
      const use = PROPERTY_KINDS[kind].use as LandUse, needTotal = PROPERTY_KINDS[kind].lots;
      const free = (await q.query('select id from land_lots where owner_id = $1 and province = $2 and use = $3 and property_id is null and listing_price is null order by id limit $4 for update', [userId, province, use, needTotal])).rows.map((r) => Number(r.id));
      const needLots = needTotal - free.length;
      const cost = propertyCost(kind, province, needLots);
      if (d.usePermit) {
        if (needLots > 0) throw bad('thieu_dat', `Cần đứng tên ${needTotal} thửa ${LAND_USES[use].short.toLowerCase()} trống ở ${province} trước khi xin phép xây dựng (đang có ${free.length}).`, 409);
        await d.usePermit(q, userId, province, kind);
      }
      if (Number(u.cash) < cost.total) throw bad('khong_du_tien', `Cần ${cost.total.toLocaleString('vi-VN')}đ (${needLots ? `${needLots} thửa đất, trước bạ, ` : ''}xây dựng, giấy phép).`, 409);
      if (needLots > 0) {
        const left = await lotsLeft(q, province, use);
        if (left < needLots) throw bad('het_dat', `${province} chỉ còn ${left} thửa ${LAND_USES[use].short.toLowerCase()} trong quỹ đất đợt này.`, 409);
        await d.addCash(q, userId, -(cost.land), `dat:${use}:${province}`);
        for (let i = 0; i < needLots; i++) free.push(await issueLot(q, userId, province, use, cost.lotPrice));
      }
      await d.addCash(q, userId, -cost.build, `xay_dung:${kind}:${province}`);
      await d.addCash(q, userId, -cost.permit, `giay_phep:${kind}:${province}`);
      const readyAt = new Date(Date.now() + Math.max(1000, Math.round((PROPERTY_KINDS[kind].buildHours * 3_600_000) / d.timeScale)));
      const ins = await q.query('insert into properties (user_id, kind, province, cost, ready_at) values ($1,$2,$3,$4,$5) returning *', [userId, kind, province, cost.total, readyAt]);
      await q.query('update land_lots set property_id = $1 where id = any($2::bigint[])', [ins.rows[0].id, free]);
      const xp = await d.addXp(q, userId, 100, 'mua_dat');
      return { property: propOut(ins.rows[0]), cost, cash: Number(u.cash) - cost.total, ...xp };
    });
  });
  app.get('/api/properties/:id', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id);
    await db.tx((q) => settleShop(q, id));
    const r = (await db.query('select p.*, u.display_name from properties p join users u on u.id = p.user_id where p.id = $1', [id])).rows[0];
    if (!r) throw bad('khong_tim_thay', 'Không tìm thấy công trình.', 404);
    const mine = Number(r.user_id) === userId;
    if (!mine && r.kind !== 'sieu_thi') throw bad('khong_tim_thay', 'Không tìm thấy công trình.', 404);
    const p = propOut(r);
    const out: Record<string, unknown> = { property: mine ? p : { ...p, pending: 0, earnedTotal: 0 }, mine, consignFee: mine ? 0 : SHOP_CONSIGN_FEE };
    if (r.kind === 'sieu_thi') {
      out.shelves = await shelvesOf(db, id, userId);
      out.kgPerHour = shopKgPerHour(r.province, await levelOfUser(db, Number(r.user_id)), r.kind);
      out.priceRange = { minRatio: SUPER_MIN_RATIO, maxRatio: SUPER_MAX_RATIO };
      const inv = await db.query('select specialty_id, quality, kg from inventory where user_id = $1 and kg > 0 order by specialty_id, quality', [userId]);
      const prod = await db.query('select specialty_id, kg from products where user_id = $1 and kg > 0 order by specialty_id', [userId]);
      const stockable = [];
      for (const i of inv.rows) if (SPECIALTIES[i.specialty_id]) stockable.push({ specialtyId: i.specialty_id, quality: i.quality, kg: i.kg, processed: false, name: SPECIALTIES[i.specialty_id].name, refPrice: await d.currentPrice(db, i.specialty_id) });
      for (const i of prod.rows) if (SPECIALTIES[i.specialty_id]) stockable.push({ specialtyId: i.specialty_id, quality: 'A', kg: i.kg, processed: true, name: productName(i.specialty_id), refPrice: await d.productRef(db, i.specialty_id) });
      out.stockable = stockable;
    }
    return out;
  });
  app.post('/api/properties/:id/collect', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id);
    return db.tx(async (q) => {
      const p = await settleShop(q, id);
      if (!p || Number(p.user_id) !== userId) throw bad('khong_tim_thay', 'Không tìm thấy công trình của bạn.', 404);
      if (new Date(p.ready_at).getTime() > Date.now()) throw bad('dang_xay', 'Công trình đang xây, chưa có doanh thu.', 409);
      const amount = Number(p.pending);
      if (amount > 0) {
        await q.query('update properties set pending = 0 where id = $1', [id]);
        await d.addCash(q, userId, amount, `doanh_thu:${p.kind}:${p.province}`);
      }
      return { ok: true, collected: amount, property: propOut({ ...p, pending: 0 }) };
    });
  });
  app.post('/api/properties/:id/stock', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id);
    const b = body(req);
    const sp = SPECIALTIES[String(b.specialtyId ?? '')];
    if (!sp) throw bad('du_lieu_sai', 'Đặc sản không tồn tại.');
    const processed = b.processed === true, grade = processed ? 'A' : b.grade ?? b.quality;
    if (!isQuality(grade)) throw bad('du_lieu_sai', 'Loại hàng không hợp lệ.');
    const kg = intIn(b.kg, 1, 5_000, 'kg'), price = intIn(b.price, 1, 1_000_000_000, 'price');
    return db.tx(async (q) => {
      const p = await settleShop(q, id);
      if (!p || !isShop(p.kind)) throw bad('khong_tim_thay', 'Không tìm thấy cửa hàng.', 404);
      if (new Date(p.ready_at).getTime() > Date.now()) throw bad('dang_xay', 'Siêu thị đang xây, chưa bày hàng được.', 409);
      const provinces = await d.provincesOf(q, userId);
      if (!provinces.includes(p.province)) throw bad('khac_tinh', `Bạn phải chở hàng tới ${p.province} mới bày lên kệ được.`, 409);
      const ref = processed ? await d.productRef(q, sp.id) : await d.currentPrice(q, sp.id);
      const minPrice = Math.round((ref * SUPER_MIN_RATIO) / 100) * 100, maxPrice = Math.round((ref * SUPER_MAX_RATIO) / 100) * 100;
      if (price < minPrice || price > maxPrice) throw bad('gia_sai', `Giá bán phải từ ${minPrice.toLocaleString('vi-VN')}đ đến ${maxPrice.toLocaleString('vi-VN')}đ mỗi kg.`, 409);
      const lots = (await q.query('select count(*)::int as n from property_shelves where property_id = $1 and kg > 0', [id])).rows[0].n as number;
      if (lots >= PROPERTY_KINDS[p.kind as PropertyKind].shelves * 2) throw bad('het_ke', 'Kệ đã kín hàng.', 409);
      if (processed) await d.takeProduct(q, userId, sp.id, kg); else await d.takeInventory(q, userId, sp.id, grade, kg);
      const ins = await q.query('insert into property_shelves (property_id, seller_id, specialty_id, quality, processed, kg, price) values ($1,$2,$3,$4,$5,$6,$7) returning id', [id, userId, sp.id, grade, processed, kg, price]);
      const xp = await d.addXp(q, userId, 3, 'ky_gui');
      return { ok: true, shelfId: Number(ins.rows[0].id), fee: Number(p.user_id) === userId ? 0 : SHOP_CONSIGN_FEE, ...xp };
    });
  });
  app.post('/api/properties/:id/withdraw', async (req) => {
    const userId = await d.requireUser(req);
    const id = idOf((req.params as any).id), shelfId = idOf(body(req).shelfId);
    return db.tx(async (q) => {
      await settleShop(q, id);
      const s = (await q.query('select * from property_shelves where id = $1 and property_id = $2 and seller_id = $3 for update', [shelfId, id, userId])).rows[0];
      if (!s || s.kg <= 0) throw bad('khong_tim_thay', 'Không tìm thấy lô hàng của bạn.', 404);
      await q.query('update property_shelves set kg = 0 where id = $1', [shelfId]);
      if (s.processed) await d.addProduct(q, userId, s.specialty_id, s.kg); else await d.addInventory(q, userId, s.specialty_id, s.quality, s.kg);
      return { ok: true, kg: s.kg };
    });
  });

  return { shipBundle, branchSlots };
}

