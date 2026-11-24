// Sổ địa chính: quỹ đất theo tỉnh, giá khác nhau, quyền theo vai, mua thửa, rao bán, chuyển nhượng có thuế phí,
// công trình dùng thửa đã có, cánh đồng trừ quỹ đất nông nghiệp; giá tham chiếu đời thực.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { PROVINCES } from '../../shared/catalog.ts';
import { LEVELS, TRUCK } from '../../shared/rules.ts';
import { BUILDINGS, CERT_FEE, PROVINCE_LAND, buildingCost, landPriceM2, lotPrice, releasedLots } from '../../shared/land.ts';
import { REF_PRICES, fuelPriceNow, householdPowerBill, registrationFee, transferTax } from '../../shared/realPrices.ts';
import { NOTARY_DRAFT_FEE, TAX_EPOCH, notaryFee, quarterIndex, quarterStart, quarterTax } from '../../shared/admin.ts';
import { ENERGY_PRICE } from '../../shared/vehicles.ts';
import { fieldBlockPrice, fieldLeaseMax, fieldLeaseRent } from '../../shared/farm.ts';
import { SPECIALTIES } from '../../shared/catalog.ts';

const url = process.env.TEST_LAND_DATABASE_URL ?? process.env.TEST_ECON_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test_econ';
let db: Db, app: FastifyInstance;
before(async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  app = await buildApp({ db, timeScale: 1e9, lateGraceMs: 60_000, adminToken: 'test-admin-token-0123456789', rateLimit: false, staticDir: '/nonexistent', marketEventsAt: () => [], inSeason: () => false,
    paceFactor: () => 1, tripMinFactor: 0, marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }) } as any);
  await app.ready();
});
after(async () => { await app.close(); await db.close(); });

type Res = { status: number; body: any; cookie?: string };
async function call(method: string, path: string, body?: unknown, cookie?: string): Promise<Res> {
  const r = await app.inject({ method: method as any, url: path, payload: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) } });
  const set = r.headers['set-cookie'], first = Array.isArray(set) ? set[0] : set;
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, cookie: first?.split(';')[0] };
}
async function signup(name: string, role: 'nong_dan' | 'xuong' | 'thuong_lai', level = 20, regionId = 'dt_caibe', cash = 50_000_000_000): Promise<string> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await db.query('update users set role = $2, role_assigned_at = now() where username = $1', [name, role]);
  assert.equal((await call('POST', '/api/onboard', { regionId }, r.cookie)).status, 200);
  await db.query('update users set cash = $2, xp = $3 where username = $1', [name, cash, LEVELS[level - 1].xp]);
  return r.cookie!;
}
const cashOf = async (name: string) => Number((await db.query('select cash from users where username = $1', [name])).rows[0].cash);
const q = (p: string) => encodeURIComponent(p);
/** Đứng trong Trung tâm hành chính công của tỉnh (nhịp hiện diện). */
const here = async (cookie: string, province: string) => assert.equal((await call('POST', '/api/presence', { scene: 'admin', key: province, x: 0, z: 0 }, cookie)).status, 200);
const away = async (cookie: string) => { await call('POST', '/api/presence/leave', {}, cookie); };

test('số liệu: đủ 34 tỉnh, giá khác nhau theo tỉnh, quỹ đất hữu hạn; giá thật dùng cho xăng, điện, phí đường', () => {
  assert.ok(PROVINCES.every((p) => PROVINCE_LAND[p] && releasedLots(p, 'thuong_mai') >= 10 && lotPrice(p, 'nong_nghiep') > 0));
  assert.ok(landPriceM2('Hà Nội', 'thuong_mai') > 5 * landPriceM2('Đồng Tháp', 'thuong_mai'), 'thủ đô đắt hơn tỉnh nông thôn nhiều lần');
  assert.ok(landPriceM2('Đà Nẵng', 'cong_nghiep') > landPriceM2('Lai Châu', 'cong_nghiep'));
  assert.ok(releasedLots('Đồng Tháp', 'nong_nghiep') > releasedLots('Đồng Tháp', 'cong_nghiep'), 'tỉnh nông nghiệp nhiều đất ruộng hơn đất KCN');
  assert.equal(TRUCK.fuelPrice, REF_PRICES.xang_e10_ron95.value);
  assert.equal(ENERGY_PRICE.dau, REF_PRICES.dau_do_005s.value);
  assert.equal(fuelPriceNow('dien_dc'), REF_PRICES.sac_cong_cong.value);
  assert.equal(householdPowerBill(100), Math.round(100 * 1_901 * 1.08));
  assert.equal(householdPowerBill(250), Math.round((100 * 1_901 + 100 * 2_289 + 50 * 2_894) * 1.08));
  assert.equal(registrationFee(4_000_000_000), 20_000_000);
  assert.equal(registrationFee(1e12), 500_000_000, 'trước bạ tối đa 500 triệu');
  assert.equal(transferTax(1_000_000_000), 20_000_000);
  assert.equal(fieldBlockPrice('dt_caibe'), lotPrice('Đồng Tháp', 'nong_nghiep'));
});

test('/api/ref-prices trả bảng giá thật kèm nguồn và ngày hiệu lực', async () => {
  const r = await call('GET', '/api/ref-prices');
  assert.equal(r.status, 200);
  const ron = r.body.prices.find((p: any) => p.key === 'xang_e10_ron95');
  assert.equal(ron.value, REF_PRICES.xang_e10_ron95.value);
  assert.ok(ron.source && ron.since);
});

test('xem quỹ đất, mua thửa theo vai, rao bán và sang tên có thuế phí', async () => {
  const tl = await signup('tl_dat', 'thuong_lai'), nd = await signup('nd_dat', 'nong_dan'), cx = await signup('cx_dat', 'xuong');
  const view = (await call('GET', `/api/land?province=${q('Đà Nẵng')}`, undefined, tl)).body;
  const tm = view.summary.find((r: any) => r.use === 'thuong_mai');
  assert.deepEqual([tm.released, tm.sold, tm.left], [releasedLots('Đà Nẵng', 'thuong_mai'), 0, releasedLots('Đà Nẵng', 'thuong_mai')]);
  assert.equal(tm.lotPrice, lotPrice('Đà Nẵng', 'thuong_mai'));
  assert.equal(tm.blocked, null);
  assert.match(view.summary.find((r: any) => r.use === 'cong_nghiep').blocked, /chủ xưởng/);
  // vai không hợp lệ
  assert.equal((await call('POST', '/api/land/buy', { province: 'Đà Nẵng', use: 'cong_nghiep' }, tl)).status, 403);
  assert.equal((await call('POST', '/api/land/buy', { province: 'Đà Nẵng', use: 'o' }, tl)).status, 403, 'đất ở chưa mở');
  assert.equal((await call('POST', '/api/land/buy', { province: 'Đà Nẵng', use: 'nong_nghiep' }, nd)).body.error, 'dung_canh_dong');
  // mua 2 thửa thương mại
  const before = await cashOf('tl_dat'), price = lotPrice('Đà Nẵng', 'thuong_mai');
  const buy = await call('POST', '/api/land/buy', { province: 'Đà Nẵng', use: 'thuong_mai', count: 2 }, tl);
  assert.equal(buy.status, 200, JSON.stringify(buy.body));
  assert.equal(await cashOf('tl_dat'), before - 2 * price - registrationFee(2 * price) - 2 * CERT_FEE);
  assert.match(buy.body.lots[0].parcelCode, /^DN\.\d{4}\.\d{4}$/);
  assert.match(buy.body.lots[0].serial, /^[A-ZĐ]{2} \d{8}$/u);
  assert.notEqual(buy.body.lots[0].serial, buy.body.lots[1].serial);
  const after = (await call('GET', `/api/land?province=${q('Đà Nẵng')}`, undefined, cx)).body.summary.find((r: any) => r.use === 'thuong_mai');
  assert.equal(after.left, tm.left - 2);
  // chủ xưởng mua đất KCN được
  assert.equal((await call('POST', '/api/land/buy', { province: 'Đà Nẵng', use: 'cong_nghiep' }, cx)).status, 200);
  // rao bán: giá ngoài khoảng bị từ chối
  const lot = buy.body.lots[0];
  assert.equal((await call('POST', `/api/land/${lot.id}/list`, { price: price * 10 }, tl)).body.error, 'gia_sai');
  assert.equal((await call('POST', `/api/land/${lot.id}/list`, { price: price * 2 }, cx)).status, 404, 'không phải chủ');
  assert.equal((await call('POST', `/api/land/${lot.id}/list`, { price: price * 2 }, tl)).status, 200);
  const listed = (await call('GET', `/api/land?province=${q('Đà Nẵng')}`, undefined, cx)).body.listings;
  assert.equal(listed.length, 1);
  // chủ xưởng mua lại: không còn "mua ngay" — trả giá, bên bán đồng ý, công chứng (cả hai có mặt), nộp hồ sơ, nộp thuế, nhận sổ mới
  const sellerBefore = await cashOf('tl_dat'), buyerBefore = await cashOf('cx_dat'), p2 = price * 2, dn = 'Đà Nẵng';
  assert.equal((await call('POST', `/api/land/${lot.id}/purchase`, {}, cx)).status, 410);
  const offer = await call('POST', `/api/land/${lot.id}/offer`, { price: p2 }, cx);
  assert.equal(offer.status, 200, JSON.stringify(offer.body));
  const dealId = offer.body.deal.id;
  assert.equal((await call('POST', `/api/land/deals/${dealId}/accept`, {}, cx)).status, 403, 'bên mua không tự đồng ý');
  assert.equal((await call('POST', `/api/land/deals/${dealId}/accept`, {}, tl)).status, 200);
  // ký khi chưa tới trung tâm, hoặc bên kia vắng mặt: không được
  assert.equal((await call('POST', `/api/land/deals/${dealId}/sign`, {}, tl)).body.error, 'chua_den_trung_tam');
  await here(tl, dn);
  assert.equal((await call('POST', `/api/land/deals/${dealId}/sign`, {}, tl)).body.error, 'ben_kia_vang_mat');
  await here(cx, dn);
  assert.equal((await call('POST', `/api/land/deals/${dealId}/sign`, {}, tl)).status, 200);
  assert.equal((await call('POST', `/api/land/${lot.id}/unlist`, {}, tl)).body.error, 'dang_giao_dich', 'đang làm thủ tục thì không rút');
  const signed = await call('POST', `/api/land/deals/${dealId}/sign`, {}, cx);
  assert.equal(signed.body.deal.status, 'da_cong_chung', JSON.stringify(signed.body));
  const nFee = notaryFee(p2) + NOTARY_DRAFT_FEE;
  assert.equal(await cashOf('cx_dat'), buyerBefore - p2 - nFee, 'tiền đất vào tài khoản phong toả + phí công chứng');
  assert.equal((await call('POST', `/api/land/deals/${dealId}/cancel`, {}, tl)).body.error, 'da_cong_chung');
  const sub = await call('POST', `/api/land/deals/${dealId}/submit`, {}, tl);
  assert.equal(sub.body.deal.status, 'dang_xu_ly', JSON.stringify(sub.body));
  // thời gian chạy nhanh (TIME_SCALE rất lớn): thông báo thuế đã ra
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal((await call('POST', `/api/land/deals/${dealId}/pay`, {}, cx)).body.deal.status, 'cho_nop_thue');
  assert.equal((await call('POST', `/api/land/deals/${dealId}/collect`, {}, cx)).body.error, 'sai_buoc', 'bên bán chưa nộp thuế');
  const paid = await call('POST', `/api/land/deals/${dealId}/pay`, {}, tl);
  assert.equal(paid.body.deal.status, 'cho_tra_ket_qua', JSON.stringify(paid.body));
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal((await call('POST', `/api/land/deals/${dealId}/collect`, {}, tl)).status, 403, 'bên bán không nhận sổ');
  const oldSerial = lot.serial;
  const got = await call('POST', `/api/land/deals/${dealId}/collect`, {}, cx);
  assert.equal(got.status, 200, JSON.stringify(got.body));
  assert.notEqual(got.body.serial, oldSerial, 'sổ mới có số phát hành mới');
  assert.equal(await cashOf('cx_dat'), buyerBefore - p2 - nFee - registrationFee(p2) - CERT_FEE);
  assert.equal(await cashOf('tl_dat'), sellerBefore + p2 - transferTax(p2));
  const mineNow = (await call('GET', '/api/land', undefined, cx)).body.mine.find((l: any) => l.id === lot.id);
  assert.equal(mineNow.serial, got.body.serial);
  assert.equal(mineNow.parcelCode, lot.parcelCode, 'mã thửa không đổi qua các đời chủ');
  // tra cứu: sổ cũ đã thu hồi, lịch sử hai biến động, chuỗi băm nguyên vẹn
  const look = (await call('GET', `/api/land/lookup?q=${q(oldSerial)}`, undefined, nd)).body;
  assert.equal(look.lot.id, lot.id);
  assert.deepEqual(look.history.map((h: any) => h.kind), ['cap_lan_dau', 'chuyen_nhuong']);
  assert.equal(look.intact, true);
  assert.ok(look.certs.find((c: any) => c.serial === oldSerial).revokedAt);
  const hist = (await call('GET', `/api/land/${lot.id}`, undefined, nd)).body.history;
  assert.equal(hist[0].price, p2);
  await away(tl); await away(cx);
  // nhà nông không nhận chuyển nhượng đất KCN
  const kcn = (await call('GET', '/api/land', undefined, cx)).body.mine.find((l: any) => l.use === 'cong_nghiep');
  await call('POST', `/api/land/${kcn.id}/list`, { price: lotPrice('Đà Nẵng', 'cong_nghiep') }, cx);
  assert.equal((await call('POST', `/api/land/${kcn.id}/offer`, {}, nd)).status, 403);
});

test('dựng công trình dùng thửa trống đã có; hết quỹ đất thì không mua được', async () => {
  const tl = await signup('tl_ch', 'thuong_lai');
  const prov = 'Cà Mau';
  await call('POST', '/api/land/buy', { province: prov, use: 'thuong_mai', count: 1 }, tl);
  // chưa có giấy phép xây dựng thì không khởi công được
  assert.equal((await call('POST', '/api/properties/buy', { province: prov, kind: 'cua_hang' }, tl)).body.error, 'can_giay_phep');
  await here(tl, prov);
  const per = await call('POST', '/api/admin/permits', { province: prov, kind: 'cua_hang' }, tl);
  assert.equal(per.status, 200, JSON.stringify(per.body));
  await new Promise((r) => setTimeout(r, 1100));
  const before = await cashOf('tl_ch');
  const shop = await call('POST', '/api/properties/buy', { province: prov, kind: 'cua_hang' }, tl);
  assert.equal(shop.status, 200, JSON.stringify(shop.body));
  assert.equal(await cashOf('tl_ch'), before - BUILDINGS.cua_hang.build - BUILDINGS.cua_hang.permit, 'không phải trả lại tiền đất');
  const lots = (await call('GET', '/api/land', undefined, tl)).body.mine;
  assert.equal(lots[0].propertyId, shop.body.property.id);
  assert.equal((await call('POST', `/api/land/${lots[0].id}/list`, { price: lotPrice(prov, 'thuong_mai') }, tl)).body.error, 'dang_dung');
  // siêu thị cần 4 thửa: phải đứng tên đủ đất trống trước khi xin phép
  assert.equal((await call('POST', '/api/admin/permits', { province: prov, kind: 'sieu_thi' }, tl)).body.error, 'thieu_dat');
  await call('POST', '/api/land/buy', { province: prov, use: 'thuong_mai', count: 4 }, tl);
  assert.equal((await call('POST', '/api/admin/permits', { province: prov, kind: 'sieu_thi' }, tl)).status, 200);
  await new Promise((r) => setTimeout(r, 1100));
  const b2 = await cashOf('tl_ch');
  const st = await call('POST', '/api/properties/buy', { province: prov, kind: 'sieu_thi' }, tl);
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.equal(await cashOf('tl_ch'), b2 - buildingCost('sieu_thi', prov, 0).total);
  assert.equal((await call('POST', '/api/properties/buy', { province: prov, kind: 'sieu_thi' }, tl)).body.error, 'da_co');
  // vét cạn quỹ đất thương mại của tỉnh
  const left = releasedLots(prov, 'thuong_mai') - 5;
  await db.query(`insert into land_lots (province, use, owner_id, area_m2, price_paid) select $1, 'thuong_mai', null, 100, 1 from generate_series(1, $2)`, [prov, left]);
  assert.equal((await call('POST', '/api/land/buy', { province: prov, use: 'thuong_mai' }, tl)).body.error, 'het_dat');
});

test('cánh đồng trừ quỹ đất nông nghiệp của tỉnh; bán ruộng trả thửa về quỹ', async () => {
  const nd = await signup('nd_ruong', 'nong_dan', 10);
  const before = (await call('GET', `/api/land?province=${q('Đồng Tháp')}`, undefined, nd)).body.summary.find((r: any) => r.use === 'nong_nghiep').left;
  const f = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 3 }, nd);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  const mid = (await call('GET', `/api/land?province=${q('Đồng Tháp')}`, undefined, nd)).body;
  assert.equal(mid.summary.find((r: any) => r.use === 'nong_nghiep').left, before - 3);
  assert.equal(mid.mine.filter((l: any) => l.fieldId === Number(f.body.fieldId)).length, 3);
  assert.equal((await call('POST', `/api/fields/${f.body.fieldId}/sell`, {}, nd)).status, 200);
  assert.equal((await call('GET', `/api/land?province=${q('Đồng Tháp')}`, undefined, nd)).body.summary.find((r: any) => r.use === 'nong_nghiep').left, before);
  // thửa trả về Nhà nước giữ nguyên mã thửa; người sau được giao lại đúng thửa đó với sổ mới
  const back = (await db.query(`select id, parcel_code from land_lots where province = 'Đồng Tháp' and use = 'nong_nghiep' and state = 'nha_nuoc' order by id`)).rows;
  assert.equal(back.length, 3);
  const nd2 = await signup('nd_ruong2', 'nong_dan', 10);
  assert.equal((await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 1 }, nd2)).status, 200);
  const again = (await call('GET', '/api/land', undefined, nd2)).body.mine[0];
  assert.equal(again.parcelCode, back[0].parcel_code);
  const look = (await call('GET', `/api/land/lookup?q=${q(again.parcelCode)}`, undefined, nd2)).body;
  assert.deepEqual(look.history.map((h: any) => h.kind), ['cap_lan_dau', 'thu_hoi', 'cap_lan_dau']);
  assert.equal(look.certs.filter((c: any) => !c.revokedAt).length, 1, 'chỉ một sổ còn hiệu lực');
});

test('sổ biến động chuỗi băm: sửa lén một dòng là bị phát hiện; số phát hành không trùng', async () => {
  const nd = await signup('nd_bam', 'nong_dan', 10);
  const ok = (await call('GET', '/api/land/ledger/verify', undefined, nd)).body;
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.ok(ok.count >= 5);
  const serials = (await db.query('select serial from land_certs')).rows.map((r) => r.serial);
  assert.equal(new Set(serials).size, serials.length);
  // không thể có hai sổ còn hiệu lực cho một thửa
  const lot = (await db.query(`select lot_id from land_certs where revoked_at is null limit 1`)).rows[0].lot_id;
  await assert.rejects(db.query(`insert into land_certs (serial, lot_id) values ('ZZ 00000000', $1)`, [lot]));
  // sửa giá trong một bản ghi cũ: chuỗi gãy đúng tại bản ghi đó
  const row = (await db.query(`select id, lot_id from land_ledger where kind = 'chuyen_nhuong' order by id limit 1`)).rows[0];
  await db.query(`update land_ledger set data = jsonb_set(data, '{price}', '1') where id = $1`, [row.id]);
  const broken = (await call('GET', '/api/land/ledger/verify', undefined, nd)).body;
  assert.equal(broken.ok, false);
  assert.equal(broken.brokenAt, Number(row.id));
  const code = (await db.query('select parcel_code from land_lots where id = $1', [row.lot_id])).rows[0].parcel_code;
  assert.equal((await call('GET', `/api/land/lookup?q=${q(code)}`, undefined, nd)).body.intact, false);
});

test('phí công chứng theo bậc giá trị; thuế hộ kinh doanh theo quý; trung tâm: bốc số, kê khai', async () => {
  assert.equal(notaryFee(30e6), 50_000);
  assert.equal(notaryFee(80e6), 100_000);
  assert.equal(notaryFee(500e6), 500_000);
  assert.equal(notaryFee(2e9), 1_600_000);
  assert.equal(notaryFee(1e12), 70_000_000, 'tối đa 70 triệu');
  // ngưỡng 1 tỷ/năm tính trên cả năm: quý đầu 800 triệu chưa chịu thuế, quý sau 500 triệu thì chịu trên 300 triệu
  assert.equal(quarterTax('phan_phoi', 0, 800e6).total, 0);
  assert.deepEqual(quarterTax('phan_phoi', 800e6, 500e6), { taxable: 300e6, gtgt: 3e6, tncn: 1.5e6, total: 4.5e6 });
  assert.equal(quarterTax('mien', 0, 5e9).total, 0, 'nông dân bán sản phẩm tự trồng');
  const tl = await signup('tl_thue', 'thuong_lai'), prov = 'Huế';
  const center = (await call('GET', `/api/admin/center?province=${q(prov)}`, undefined, tl)).body;
  assert.equal(center.counters.length, 6);
  assert.equal((await call('POST', '/api/admin/ticket', { province: prov, counter: 'thue' }, tl)).body.error, 'chua_den_trung_tam');
  await here(tl, prov);
  const t = (await call('POST', '/api/admin/ticket', { province: prov, counter: 'thue' }, tl)).body.ticket;
  assert.match(t.no, /^3\d{3}$/);
  assert.equal((await call('POST', '/api/admin/ticket', { province: prov, counter: 'thue' }, tl)).body.ticket.no, t.no, 'đang chờ thì không bốc số mới');
  // doanh thu xuất khẩu của quý trước (ghi sổ tiền lùi ngày) → kê khai, nộp; khoản mua đất không phải doanh thu
  const uid = Number((await db.query(`select id from users where username = 'tl_thue'`)).rows[0].id);
  await db.query(`update users set created_at = to_timestamp($2 / 1000.0) where id = $1`, [uid, TAX_EPOCH - 1]);
  const prevQ = quarterIndex(Date.now()) - 1, at = quarterStart(prevQ) + 1000;
  await db.query(`insert into ledger (user_id, delta, reason, created_at) values ($1, 1500000000, 'xuat_khau:x', to_timestamp($2 / 1000.0)), ($1, 900000000, 'mua_dat', to_timestamp($2 / 1000.0))`, [uid, at]);
  const tax = (await call('GET', '/api/admin/tax', undefined, tl)).body;
  const row = tax.quarters.find((x: any) => x.quarter === prevQ);
  if (row) {
    assert.equal(row.revenue, 1_500_000_000, 'chỉ tính khoản bán hàng');
    const cumBefore = row.cumBefore;
    assert.equal(row.total, quarterTax('phan_phoi', cumBefore, 1.5e9).total);
    const cash = await cashOf('tl_thue');
    const f = await call('POST', '/api/admin/tax/file', { province: prov, quarter: prevQ }, tl);
    assert.equal(f.status, 200, JSON.stringify(f.body));
    assert.equal(await cashOf('tl_thue'), cash - row.total - row.penalty);
    assert.equal((await call('POST', '/api/admin/tax/file', { province: prov, quarter: prevQ }, tl)).body.error, 'da_nop');
  }
  const cur = tax.quarters[0];
  assert.equal(cur.state, 'dang_dien_ra');
  assert.equal((await call('POST', '/api/admin/tax/file', { province: prov, quarter: cur.quarter }, tl)).body.error, 'chua_het_ky');
});


test('thuê đất nông nghiệp trả tiền hằng năm: hạn mức theo cấp, hợp đồng thuê (không sổ), không chuyển nhượng', async () => {
  const nd = await signup('nd_thue', 'nong_dan', 10, 'dt_caibe', 50_000_000);
  assert.equal(fieldLeaseMax(10), 2);
  const info = (await call('GET', '/api/fields', undefined, nd)).body;
  assert.deepEqual([info.lease.max, info.lease.used], [2, 0]);
  assert.equal(fieldLeaseRent('dt_caibe', 1), Math.round(fieldBlockPrice('dt_caibe') * 0.01 / 1000) * 1000, 'tiền thuê một năm = 1% giá đất');
  assert.equal((await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 3, tenure: 'thue' }, nd)).body.error, 'vuot_han_muc_thue');
  const before = await cashOf('nd_thue');
  const r = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 2, tenure: 'thue' }, nd);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(await cashOf('nd_thue'), before - fieldLeaseRent('dt_caibe', 2));
  assert.equal((await call('GET', '/api/fields', undefined, nd)).body.lease.used, 2);
  const lots = (await call('GET', '/api/land', undefined, nd)).body.mine.filter((l: any) => l.fieldId === Number(r.body.fieldId));
  assert.equal(lots.length, 2);
  assert.ok(lots.every((l: any) => l.tenure === 'thue' && l.serial === null && /^HĐT-/.test(l.leaseNo)), 'hợp đồng thuê, không có giấy chứng nhận');
  // không chuyển nhượng được (gỡ ruộng khỏi thửa để thử rao bán)
  await db.query('update land_lots set field_id = null where id = $1', [lots[0].id]);
  assert.equal((await call('POST', `/api/land/${lots[0].id}/list`, { price: lotPrice('Đồng Tháp', 'nong_nghiep') }, nd)).body.error, 'dat_thue');
  await db.query('update land_lots set field_id = $2 where id = $1', [lots[0].id, r.body.fieldId]);
  const look = (await call('GET', `/api/land/lookup?q=${q(lots[0].parcelCode)}`, undefined, nd)).body;
  assert.ok(look.history.some((h: any) => h.kind === 'cho_thue'));
  // trả lại sớm: không hoàn tiền thuê, đất về quỹ
  const cash = await cashOf('nd_thue');
  assert.equal((await call('POST', `/api/fields/${r.body.fieldId}/sell`, {}, nd)).status, 200);
  assert.equal(await cashOf('nd_thue'), cash);
  assert.equal((await db.query(`select count(*)::int as n from land_lots where id = any($1::bigint[]) and state = 'nha_nuoc'`, [lots.map((l: any) => l.id)])).rows[0].n, 2);
});

test('ruộng thuê: gia hạn; hết hạn mà ruộng trống thì trả đất; hết hạn thì không gieo vụ mới', async () => {
  const nd = await signup('nd_thue2', 'nong_dan', 10, 'dt_caibe', 50_000_000);
  const r = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 1, tenure: 'thue' }, nd);
  const fid = Number(r.body.fieldId);
  const ren = await call('POST', `/api/fields/${fid}/renew`, {}, nd);
  assert.equal(ren.status, 200, JSON.stringify(ren.body));
  assert.ok(ren.body.leaseUntil > r.body.leaseUntil);
  await db.query(`update fields set lease_until = now() - interval '1 second' where id = $1`, [fid]);
  assert.equal((await call('GET', '/api/fields', undefined, nd)).body.fields.some((f: any) => f.id === fid), false, 'ruộng trống hết hạn: trả đất');
  const r2 = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 1, tenure: 'thue' }, nd);
  const f2 = Number(r2.body.fieldId);
  // ghi hạn đã qua nhưng giữ ruộng (giả lập đang có cây bằng cách gọi gieo trực tiếp sau khi lùi hạn): phải báo hết hạn
  await db.query(`update fields set lease_until = now() + interval '50 milliseconds' where id = $1`, [f2]);
  await new Promise((res) => setTimeout(res, 120));
  const sid = Object.values(SPECIALTIES).find((s) => s.regionId === 'dt_caibe')!.id;
  assert.equal((await call('POST', `/api/fields/${f2}/plant`, { specialtyId: sid }, nd)).body.error, 'het_han_thue');
});
