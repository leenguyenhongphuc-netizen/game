// Kinh tế mở rộng: lô xuất khẩu nhiều mặt hàng, sức mua thị trường, đơn theo vai, công ty xuất nhập khẩu,
// siêu thị ở mọi tỉnh, siêu thị riêng và xưởng chi nhánh. Dùng CSDL kiểm thử riêng (vuon_test_econ).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { PROVINCES, SPECIALTIES, specialtiesOfRegion } from '../../shared/catalog.ts';
import { LEVELS, WORKSHOP_MAX_MACHINES } from '../../shared/rules.ts';
import {
  BRANCH_MACHINE_SLOTS, COMPANIES, CONTRACTS_PER_COMPANY, EXPORT_DEMAND_EASY_KG, PROPERTY_KINDS, SHOP_CONSIGN_FEE, contractsOfDay, exportBundleQuote,
  exportDemandFactor, exportTrend, propertyCost,
} from '../../shared/economy.ts';

const url = process.env.TEST_ECON_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test_econ';
let db: Db, app: FastifyInstance;
before(async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  app = await buildApp({ db, buildPermits: false, timeScale: 1e9, lateGraceMs: 60_000, adminToken: 'test-admin-token-0123456789', rateLimit: false, staticDir: '/nonexistent', marketEventsAt: () => [], inSeason: () => false,
    paceFactor: () => 1, tripMinFactor: 0, marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }) } as any);
});
after(async () => { await app.close(); await db.close(); });

type Res = { status: number; body: any; cookie?: string };
async function call(method: string, path: string, body?: unknown, cookie?: string): Promise<Res> {
  const r = await app.inject({ method: method as any, url: path, payload: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) } });
  const set = r.headers['set-cookie'], first = Array.isArray(set) ? set[0] : set;
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, cookie: first?.split(';')[0] };
}
async function signup(name: string, role: 'nong_dan' | 'xuong' | 'thuong_lai', regionId = 'dt_caibe', cash = 2_000_000_000): Promise<string> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await db.query('update users set role = $2, role_assigned_at = now() where username = $1', [name, role]);
  assert.equal((await call('POST', '/api/onboard', { regionId }, r.cookie)).status, 200);
  await db.query('update users set cash = $2 where username = $1', [name, cash]);
  return r.cookie!;
}
const idOf = async (name: string) => Number((await db.query('select id from users where username = $1', [name])).rows[0].id);
const cashOf = async (name: string) => Number((await db.query('select cash from users where username = $1', [name])).rows[0].cash);
const setLevel = (name: string, level: number) => db.query('update users set xp = $2 where username = $1', [name, LEVELS[level - 1].xp]);
const give = async (name: string, specialtyId: string, quality: string, kg: number) =>
  db.query(`insert into inventory (user_id, specialty_id, quality, kg) values ($1,$2,$3,$4) on conflict (user_id, specialty_id, quality) do update set kg = inventory.kg + excluded.kg`, [await idOf(name), specialtyId, quality, kg]);

test('hàm thuần: sức mua thị trường, giá dao động, lô gộp tính cước một lần', () => {
  assert.equal(exportDemandFactor(0, EXPORT_DEMAND_EASY_KG), 1);
  assert.ok(exportDemandFactor(0, 20_000) < 1 && exportDemandFactor(20_000, 20_000) < exportDemandFactor(0, 20_000), 'xả càng nhiều giá càng rớt');
  assert.ok(exportDemandFactor(1e9, 1000) >= 0.65 - 1e-9);
  const t = exportTrend('au_my', 'xoai_cat_hoa_loc', 20000);
  assert.ok(t >= 0.92 && t <= 1.08 && t === exportTrend('au_my', 'xoai_cat_hoa_loc', 20000));
  const [a, b] = specialtiesOfRegion('dt_caibe');
  const opts = { refOf: (id: string) => SPECIALTIES[id].refPrice, day: 20000 };
  // một mặt hàng 150 kg không đủ tối thiểu container (200 kg), gộp hai mặt hàng thì đủ
  const one = exportBundleQuote([{ specialtyId: a.id, grade: 'A' as const, kg: 150 }], 'container', 'trung_quoc', 'dt_caibe', opts);
  assert.equal(one.ok, false); assert.match(one.reason!, /từ 200 kg/);
  const two = exportBundleQuote([{ specialtyId: a.id, grade: 'A' as const, kg: 150 }, { specialtyId: b.id, grade: 'B' as const, kg: 100 }], 'container', 'trung_quoc', 'dt_caibe', opts);
  assert.equal(two.ok, true, two.reason ?? ''); assert.equal(two.kg, 250);
  assert.equal(two.freight, two.lines.reduce((s, l) => s + l.freight, 0));
  assert.equal(two.net, two.payout - two.freight);
  assert.ok(two.lines[0].freight > two.lines[1].freight, 'cước chia theo kg');
  // thị trường chỉ nhận Loại 1: dòng loại 2 bị loại kèm lý do, dòng còn lại vẫn đi
  const picky = exportBundleQuote([{ specialtyId: a.id, grade: 'A' as const, kg: 300 }, { specialtyId: b.id, grade: 'B' as const, kg: 100 }], 'hang_khong', 'nhat_han', 'dt_caibe', opts);
  assert.equal(picky.ok, true); assert.equal(picky.kg, 300);
  assert.equal(picky.lines[1].ok, false); assert.match(picky.lines[1].reason!, /Loại 1/);
  // hợp đồng trong ngày tất định, mỗi công ty hai hợp đồng, giá trên giá tham chiếu
  const cs = contractsOfDay(20000, (id) => SPECIALTIES[id].refPrice);
  assert.equal(cs.length, COMPANIES.length * CONTRACTS_PER_COMPANY);
  assert.deepEqual(cs, contractsOfDay(20000, (id) => SPECIALTIES[id].refPrice));
  assert.ok(cs.every((c) => c.price > SPECIALTIES[c.specialtyId].refPrice && c.kg >= 500));
  assert.ok(PROVINCES.every((p) => propertyCost('sieu_thi', p).total > 0));
});

test('xuất khẩu gộp lô: báo giá nhiều mặt hàng, gửi một lô, trừ kho, một lô đang đi, tới nơi trả tiền; kiểu cũ vẫn chạy', async () => {
  const me = await signup('xk_gop', 'thuong_lai');
  const [a, b] = specialtiesOfRegion('dt_caibe');
  await give('xk_gop', a.id, 'A', 400); await give('xk_gop', b.id, 'B', 300);
  const items = [{ specialtyId: a.id, grade: 'A', kg: 150 }, { specialtyId: b.id, grade: 'B', kg: 100 }];
  const qt = await call('POST', '/api/export/quote', { items, market: 'trung_quoc' }, me);
  assert.equal(qt.status, 200, JSON.stringify(qt.body));
  const cont = qt.body.quotes.find((x: any) => x.mode === 'container');
  assert.deepEqual([cont.ok, cont.kg, cont.lines.length], [true, 250, 2]);
  assert.ok(qt.body.discount > 0, 'thương lái được giảm cước');
  const all = await call('POST', '/api/export/quote', { items }, me);
  assert.ok(all.body.quotes.some((x: any) => x.market === 'au_my' && x.lines[1].ok === false), 'mọi thị trường, kèm lý do loại');
  const before = await cashOf('xk_gop');
  const ship = await call('POST', '/api/export/ship', { items, mode: 'container', market: 'trung_quoc' }, me);
  assert.equal(ship.status, 200, JSON.stringify(ship.body));
  assert.equal(ship.body.shipments.length, 2);
  assert.equal(await cashOf('xk_gop'), before - ship.body.quote.freight);
  const inv = (await db.query('select specialty_id, quality, kg from inventory where user_id = $1 order by specialty_id', [await idOf('xk_gop')])).rows;
  assert.equal(inv.find((r) => r.specialty_id === a.id).kg, 250); assert.equal(inv.find((r) => r.specialty_id === b.id).kg, 200);
  assert.equal((await call('GET', '/api/export/options', undefined, me)).body.active, 1, 'cả lô tính là một lô đang đi');
  // gộp nhiều mặt hàng mà có mặt hàng bị loại thì không gửi
  const bad = await call('POST', '/api/export/ship', { items: [{ specialtyId: a.id, grade: 'A', kg: 100 }, { specialtyId: b.id, grade: 'B', kg: 100 }], mode: 'hang_khong', market: 'nhat_han' }, me);
  assert.equal(bad.body.error, 'lo_hang_sai');
  // kiểu cũ một mặt hàng
  const old = await call('POST', '/api/export/ship', { specialtyId: a.id, grade: 'A', kg: 100, mode: 'xe_tai', market: 'trung_quoc' }, me);
  assert.equal(old.status, 200, JSON.stringify(old.body));
  await db.query(`update export_shipments set arrives_at = now() - interval '1 second'`);
  const paid = (await call('GET', '/api/export/shipments', undefined, me)).body.justPaid;
  assert.equal(paid.length, 3);
  // sức mua: lô thứ hai cùng thị trường cùng mặt hàng không được giá cao hơn lô đầu
  await db.query(`update export_shipments set arrive_kg = 30000 where specialty_id = $1`, [a.id]);
  const again = await call('POST', '/api/export/quote', { items: [{ specialtyId: a.id, grade: 'A', kg: 250 }], market: 'trung_quoc' }, me);
  const line = again.body.quotes.find((x: any) => x.mode === 'container').lines[0];
  assert.ok(line.demand < 1 && line.unitPrice < cont.lines[0].unitPrice);
});

test('đơn hàng theo vai: thương lái có đơn sỉ lớn, chủ xưởng có đơn thành phẩm; thưởng và EXP ghi rõ', async () => {
  const tl = await signup('don_tl', 'thuong_lai'), xw = await signup('don_xw', 'xuong');
  await setLevel('don_tl', 10);
  const o1 = (await call('GET', '/api/orders', undefined, tl)).body;
  assert.equal(o1.orders.length, 4);
  assert.equal(o1.orders[3].kind, 'si_lon');
  assert.ok(o1.orders[3].items[0].kg >= 150 * o1.scale - 1);
  assert.ok(o1.orders[3].xp > o1.orders[0].xp);
  const o2 = (await call('GET', '/api/orders', undefined, xw)).body;
  const pOrder = o2.orders[3];
  assert.equal(pOrder.kind, 'xuong'); assert.equal(pOrder.items[0].processed, true);
  assert.equal((await call('POST', '/api/orders/3/deliver', {}, xw)).body.error, 'khong_du_hang');
  await db.query('insert into products (user_id, specialty_id, kg) values ($1,$2,$3)', [await idOf('don_xw'), pOrder.items[0].specialtyId, pOrder.items[0].kg]);
  const before = await cashOf('don_xw');
  const d = await call('POST', '/api/orders/3/deliver', {}, xw);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.reward, pOrder.reward);
  assert.equal(await cashOf('don_xw'), before + pOrder.reward);
});

test('công ty xuất nhập khẩu: hợp đồng, giao từng phần, phí chành xe, đủ hàng thì dừng, bảng xếp hạng', async () => {
  const me = await signup('hd_giao', 'nong_dan');
  const list = (await call('GET', '/api/companies', undefined, me)).body;
  assert.equal(list.companies.length, COMPANIES.length);
  assert.ok(list.companies.every((c: any) => c.contracts.length >= CONTRACTS_PER_COMPANY && c.shop.length > 0));
  const c = list.companies.flatMap((x: any) => x.contracts).find((x: any) => !x.processed && x.minGrade === 'B') ?? list.companies.flatMap((x: any) => x.contracts).find((x: any) => !x.processed);
  assert.ok(c, 'có hợp đồng hàng tươi');
  await give('hd_giao', c.specialtyId, 'C', 100); await give('hd_giao', c.specialtyId, 'A', c.kg + 100);
  assert.equal((await call('POST', `/api/contracts/${c.id}/deliver`, { grade: 'C', kg: 50 }, me)).body.error, 'sai_loai');
  const before = await cashOf('hd_giao');
  const d1 = await call('POST', `/api/contracts/${c.id}/deliver`, { grade: 'A', kg: 100 }, me);
  assert.equal(d1.status, 200, JSON.stringify(d1.body));
  assert.equal(d1.body.total, c.price * 100);
  assert.ok(d1.body.selfDelivered || d1.body.shipFee > 0, 'không tự chở thì mất phí chành xe');
  assert.equal(await cashOf('hd_giao'), before + d1.body.net);
  const d2 = await call('POST', `/api/contracts/${c.id}/deliver`, { grade: 'A', kg: 1_000_000 }, me);
  assert.equal(d2.body.kg, c.kg - 100, 'giao vượt thì chỉ nhận phần còn thiếu');
  assert.equal((await call('POST', `/api/contracts/${c.id}/deliver`, { grade: 'A', kg: 1 }, me)).body.error, 'du_hang');
  const det = (await call('GET', `/api/companies/${c.companyId}/contracts`, undefined, me)).body;
  const mine = det.contracts.find((x: any) => x.id === c.id);
  assert.deepEqual([mine.remainingKg, mine.leaderboard[0].kg, mine.leaderboard[0].me], [0, c.kg, true]);
  assert.equal((await call('POST', '/api/contracts/khong-co-0-0/deliver', { kg: 1 }, me)).status, 404);
});

test('siêu thị mọi tỉnh; mua đất mở siêu thị riêng, bày hàng, khách mua, thu phí ký gửi; xưởng chi nhánh thêm chỗ máy', async () => {
  const owner = await signup('chu_st', 'xuong', 'dt_caibe', 20_000_000_000), guest = await signup('khach_ky_gui', 'thuong_lai');
  // tỉnh không có điểm tham quan vẫn có siêu thị
  assert.equal((await call('GET', `/api/supermarket?province=${encodeURIComponent('Đồng Tháp')}`, undefined, owner)).status, 200);
  assert.equal((await call('GET', '/api/supermarket', undefined, owner)).status, 200);
  // cấp thấp chưa mở được
  assert.equal((await call('POST', '/api/properties/buy', { province: 'Đồng Tháp', kind: 'sieu_thi' }, owner)).status, 403);
  await setLevel('chu_st', 20);
  const view = (await call('GET', `/api/properties?province=${encodeURIComponent('Đồng Tháp')}`, undefined, owner)).body;
  assert.equal(view.kinds.find((k: any) => k.kind === 'sieu_thi').blocked, null);
  const before = await cashOf('chu_st');
  const buy = await call('POST', '/api/properties/buy', { province: 'Đồng Tháp', kind: 'sieu_thi' }, owner);
  assert.equal(buy.status, 200, JSON.stringify(buy.body));
  assert.equal(await cashOf('chu_st'), before - propertyCost('sieu_thi', 'Đồng Tháp').total);
  assert.equal((await call('POST', '/api/properties/buy', { province: 'Đồng Tháp', kind: 'sieu_thi' }, owner)).body.error, 'da_co');
  const pid = buy.body.property.id;
  assert.equal((await call('POST', `/api/properties/${pid}/collect`, {}, owner)).body.error, 'dang_xay');
  await db.query(`update properties set ready_at = now() - interval '1 second'`);
  const sp = specialtiesOfRegion('dt_caibe')[0];
  await give('chu_st', sp.id, 'A', 200); await give('khach_ky_gui', sp.id, 'A', 200);
  const ref = (await call('GET', `/api/properties/${pid}`, undefined, owner)).body.stockable.find((x: any) => x.specialtyId === sp.id).refPrice;
  assert.equal((await call('POST', `/api/properties/${pid}/stock`, { specialtyId: sp.id, grade: 'A', kg: 100, price: ref * 3 }, owner)).body.error, 'gia_sai');
  assert.equal((await call('POST', `/api/properties/${pid}/stock`, { specialtyId: sp.id, grade: 'A', kg: 100, price: ref }, owner)).status, 200);
  const gs = await call('POST', `/api/properties/${pid}/stock`, { specialtyId: sp.id, grade: 'A', kg: 100, price: ref }, guest);
  assert.deepEqual([gs.status, gs.body.fee], [200, SHOP_CONSIGN_FEE]);
  // thời gian trôi (TIME_SCALE rất lớn): khách mua hết hàng
  await db.query(`update properties set sold_at = now() - interval '1 second' where id = $1`, [pid]);
  const guestBefore = await cashOf('khach_ky_gui');
  const det = (await call('GET', `/api/properties/${pid}`, undefined, owner)).body;
  assert.equal(det.shelves.length, 0, 'bán hết hàng trên kệ');
  const fee = Math.round(ref * 100 * SHOP_CONSIGN_FEE);
  assert.equal(det.property.pending, ref * 100 + fee);
  assert.ok((await cashOf('khach_ky_gui')) >= guestBefore, 'người ký gửi đã được trả');
  const ownerBefore = await cashOf('chu_st');
  const col = await call('POST', `/api/properties/${pid}/collect`, {}, owner);
  assert.equal(col.body.collected, ref * 100 + fee);
  assert.equal(await cashOf('chu_st'), ownerBefore + ref * 100 + fee);
  assert.equal((await call('POST', `/api/properties/${pid}/collect`, {}, guest)).status, 404);
  // xưởng chi nhánh: phải ở tỉnh khác, thêm chỗ đặt máy
  assert.equal((await call('POST', '/api/properties/buy', { province: 'Đồng Tháp', kind: 'xuong' }, owner)).body.error, 'cung_tinh');
  assert.equal((await call('POST', '/api/properties/buy', { province: 'Cần Thơ', kind: 'xuong' }, owner)).status, 200);
  await db.query(`update properties set ready_at = now() - interval '1 second'`);
  const list = (await call('GET', '/api/properties', undefined, owner)).body;
  assert.equal(list.branchSlots, BRANCH_MACHINE_SLOTS);
  assert.equal(list.mine.length, 2);
  await db.query(`insert into machines (user_id, kind) select $1, k from unnest($2::text[]) k`, [await idOf('chu_st'), Array(WORKSHOP_MAX_MACHINES).fill('may_rua')]);
  const extra = await call('POST', '/api/workshop/machines/buy', { kind: 'may_say' }, owner);
  assert.notEqual(extra.body.error, 'het_cho_may', 'chi nhánh cho đặt thêm máy');
  // thương lái không mở được xưởng chi nhánh
  await setLevel('khach_ky_gui', 20);
  assert.equal((await call('POST', '/api/properties/buy', { province: 'Cần Thơ', kind: 'xuong' }, guest)).status, 403);
  assert.ok(PROPERTY_KINDS.sieu_thi.roles.includes('thuong_lai'));
});
