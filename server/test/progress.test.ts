// Kiểm thử tiến trình nhân vật: EXP mọi hoạt động có trần ngày, nhiệm vụ ngày, thành tựu, thưởng cấp,
// nâng cấp đất, giống lai, máy nhập khẩu, ghép máy, hộp quà.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { CROPS, SPECIALTIES, specialtiesOfRegion } from '../../shared/catalog.ts';
import { EXPORT_MAX_ACTIVE, EXPORT_MODES, LEVELS, exportMaxActive, exportQuote, levelOf, levelPerks, seedCost, stepCount, weatherInfo } from '../../shared/rules.ts';
import type { Weather } from '../../shared/rules.ts';
import {
  ACHIEVEMENTS, BOX_EXPORT_MIN, DAILY_QUEST_COUNT, GIFT_BOXES, IMPORT_MACHINES, LAND_UPGRADE_LEVELS, LEVEL_UNLOCKS, MACHINE_MERGE, SEED_FUSIONS, XP_RULES,
  boostCost, canCross, dailyQuestsFor, fusionRate, growFx, importCost, landUpgradeCost, levelReward, xpFor,
} from '../../shared/progress.ts';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test';
let db: Db, app: FastifyInstance, slowApp: FastifyInstance;
const sunny = (_r: string, nowMs: number): Weather => ({ kind: 'nang', ...weatherInfo('nang'), until: nowMs + 3600_000 });

before(async () => {
  const pg = (await import('pg')).default;
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  const base = { db, timeScale: 1e9, lateGraceMs: 60_000, rateLimit: false, staticDir: '/nonexistent', weatherAt: sunny, marketEventsAt: () => [], inSeason: () => false, paceFactor: () => 1,
    marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }), testerUsernames: ['tp_vuon', 'tp_xuong', 'tp_lai'] };
  app = await buildApp(base);
  slowApp = await buildApp({ ...base, timeScale: 1 });
});
after(async () => { await app.close(); await slowApp.close(); await db.close(); });

type Res = { status: number; body: any; cookie?: string };
async function callOn(target: FastifyInstance, method: string, path: string, body?: unknown, cookie?: string): Promise<Res> {
  const r = await target.inject({ method: method as any, url: path, payload: body as any, headers: cookie ? { cookie } : {} });
  const set = r.headers['set-cookie'];
  const raw = Array.isArray(set) ? set[0] : set;
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, cookie: raw ? String(raw).split(';')[0] : undefined };
}
const call = (method: string, path: string, body?: unknown, cookie?: string) => callOn(app, method, path, body, cookie);
const ok = async (method: string, path: string, body: unknown, cookie: string, target = app) => {
  const r = await callOn(target, method, path, body, cookie);
  assert.equal(r.status, 200, `${method} ${path}: ${JSON.stringify(r.body)}`);
  return r.body;
};
async function signup(name: string, role: 'nong_dan' | 'xuong' | 'thuong_lai', regionId = 'dt_caibe') {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const cookie = r.cookie!;
  await db.query('update users set role = $2, role_assigned_at = now(), truck_region = home_region_id where username = $1', [name, role]);
  const ob = await ok('POST', '/api/onboard', { regionId }, cookie);
  await ok('POST', '/api/test/cash', { amount: 500_000_000 }, cookie);
  const me = (await call('GET', '/api/me', undefined, cookie)).body;
  return { cookie, plotId: ob.plotId as number, userId: me.user.id as number };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('hàm thuần: 30 cấp, bảng mở khoá, EXP theo giá trị, tác dụng nâng cấp, thuế nhập máy, tỉ lệ dung hợp, hàng lẻ tàu viễn dương', () => {
  assert.equal(LEVELS.length, 30);
  assert.deepEqual(LEVELS.map((l) => l.level), Array.from({ length: 30 }, (_, i) => i + 1));
  for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].xp > LEVELS[i - 1].xp, 'ngưỡng EXP phải tăng dần');
  assert.equal(levelOf(1e9).level, 30);
  assert.equal(LEVEL_UNLOCKS.length, 30);
  assert.equal(LEVEL_UNLOCKS[1].reward, levelReward(2));
  // mọi mốc cấp nêu trong luật đều có trong bảng mở khoá
  for (const f of SEED_FUSIONS) assert.ok(LEVEL_UNLOCKS[f.minLevel - 1].unlocks.some((t) => t.startsWith('Lai tạo')));
  for (const m of IMPORT_MACHINES) assert.ok(LEVEL_UNLOCKS[m.minLevel - 1].unlocks.some((t) => t.includes(m.origin)));
  assert.ok(LEVEL_UNLOCKS[LAND_UPGRADE_LEVELS[2] - 1].unlocks.includes('Nâng cấp đất lên cấp 3'));
  assert.ok(levelPerks(30).energyMax <= 250 && levelPerks(30).energyMax > levelPerks(1).energyMax);
  // EXP theo giá trị có trần mỗi lần
  assert.equal(xpFor('trong'), XP_RULES.trong.xp);
  assert.equal(xpFor('ban_dn', 0), 2);
  assert.equal(xpFor('ban_dn', 1_000_000), 2 + 5);
  assert.equal(xpFor('ban_dn', 1e12), 2 + XP_RULES.ban_dn.maxBonus!);
  // nâng cấp đất và giống lai
  const fx = growFx({ tuoi: 2, cai_tao: 3, nha_mang: 2, cam_bien: 1 }, 'chin_som');
  assert.ok(Math.abs(fx.waitMult - 0.9 * 0.75) < 1e-9 && Math.abs(fx.yieldMult - 1.15) < 1e-9 && Math.abs(fx.graceMult - 1.2) < 1e-9);
  assert.ok(Math.abs(fx.weather(1.3) - 1.21) < 1e-9, 'nhà màng cấp 2 bớt 30% mức chậm lớn');
  assert.equal(fx.weather(0.8), 0.8, 'thời tiết thuận thì giữ nguyên');
  assert.equal(growFx(null, 'thuong_hang').forceA, true);
  assert.deepEqual(growFx({ tuoi: 99, la: 3 } as any).waitMult, 0.75, 'cấp vượt trần bị kẹp ở 5');
  assert.equal(landUpgradeCost('tuoi', 1), 500_000);
  assert.ok(landUpgradeCost('tuoi', 5) > landUpgradeCost('tuoi', 4));
  // thuế, phí nhập máy
  const c = importCost(IMPORT_MACHINES[0]);
  assert.equal(c.total, c.price + c.freight + c.duty + c.vat + c.fees);
  assert.ok(c.duty > 0 && c.vat > c.duty);
  // tỉ lệ dung hợp minh bạch và có trần
  assert.equal(fusionRate(0.6, 1, false), 0.6);
  assert.equal(fusionRate(0.6, 11, false), 0.75);
  assert.equal(fusionRate(0.6, 11, true), 0.9);
  assert.equal(fusionRate(0.9, 30, true), 0.95);
  assert.equal(boostCost(100_000), 100_000);
  // nhiệm vụ ngày: 3 việc, cố định theo người và ngày, đúng vai
  const qd = dailyQuestsFor(7, 20000, 'xuong');
  assert.equal(qd.length, DAILY_QUEST_COUNT);
  assert.deepEqual(qd, dailyQuestsFor(7, 20000, 'xuong'));
  assert.ok(qd.every((x) => !x.roles || x.roles.includes('xuong')));
  assert.equal(new Set(qd.map((x) => x.id)).size, 3);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  // xuất khẩu: không còn trần theo cấp; tàu viễn dương nhận hàng lẻ từ 200 kg, cước mỗi kg cao hơn nguyên container
  assert.equal(exportMaxActive(1), EXPORT_MAX_ACTIVE);
  assert.equal(EXPORT_MODES.tau_lon.minKg, 200);
  const dry = Object.values(SPECIALTIES).find((sp) => CROPS[sp.crop].kind === 'cn')!;
  const small = exportQuote(dry.id, 'A', 200, 'tau_lon', 'au_my', dry.regionId), big = exportQuote(dry.id, 'A', 20_000, 'tau_lon', 'au_my', dry.regionId);
  assert.deepEqual([small.ok, small.lcl, big.ok, big.lcl], [true, true, true, false]);
  assert.ok(small.freight / 200 > big.freight / 20_000, 'hàng lẻ có cước mỗi kg cao hơn');
  assert.ok(small.freight < EXPORT_MODES.tau_lon.baseFee, 'lô nhỏ không phải gánh cả phí nguyên container');
});

test('EXP từ mọi hoạt động, trần mỗi ngày, sổ EXP, nhiệm vụ ngày, thành tựu, thưởng lên cấp', async () => {
  const u = await signup('tp_vuon', 'nong_dan');
  const sp = specialtiesOfRegion('dt_caibe')[0];
  // trồng và chăm đều có EXP
  const plant = await ok('POST', `/api/plots/${u.plotId}/plant`, { tile: 0, specialtyId: sp.id }, u.cookie);
  assert.deepEqual([plant.xpGained, plant.xp, plant.level], [XP_RULES.trong.xp, XP_RULES.trong.xp, 1]);
  await sleep(1100);
  const care = await ok('POST', `/api/plantings/${plant.plantingId}/step`, {}, u.cookie);
  assert.equal(care.xpGained, XP_RULES.cham.xp);
  // bày sạp: mỗi lần 1 EXP, trần 10 EXP mỗi ngày; quá trần vẫn bày được nhưng không thêm EXP
  await ok('POST', '/api/test/stock', { specialtyId: sp.id, kg: 100 }, u.cookie);
  const gains: number[] = [];
  for (let i = 0; i < 12; i++) gains.push((await ok('POST', '/api/market/listings', { specialtyId: sp.id, quality: 'A', kg: 1, price: sp.refPrice }, u.cookie)).xpGained);
  assert.deepEqual(gains, [...Array(10).fill(1), 0, 0]);
  // bán cho doanh nghiệp có phần EXP theo giá trị
  const sell = await ok('POST', '/api/sell/npc', { specialtyId: sp.id, quality: 'A', kg: 50 }, u.cookie);
  assert.equal(sell.xpGained, xpFor('ban_dn', sell.total));
  // trang trí
  const deco = await ok('POST', `/api/plots/${u.plotId}/decor`, { items: [] }, u.cookie);
  assert.equal(deco.xpGained, XP_RULES.trang_tri.xp);
  // tổng quan tiến trình
  const pr = (await ok('GET', '/api/progress', undefined, u.cookie));
  assert.equal(pr.maxLevel, 30);
  assert.equal(pr.daily.length, 3);
  assert.ok(pr.nextUnlocks.length === 3 && pr.nextUnlocks[0].level === 2);
  assert.ok(pr.xpLog.length > 0 && pr.xpLog[0].label);
  assert.equal(pr.xpRules.find((r: any) => r.source === 'bay_sap').todayXp, 10);
  assert.equal(pr.levelRewards.length, 0);
  // nhiệm vụ ngày: chưa xong thì không nhận được; làm đủ thì nhận tiền và EXP đúng một lần
  const quest = pr.daily[0];
  assert.equal((await call('POST', '/api/progress/daily/khong_co/claim', {}, u.cookie)).status, 404);
  if (!quest.done) assert.deepEqual([(await call('POST', `/api/progress/daily/${quest.id}/claim`, {}, u.cookie)).body.error], ['chua_xong']);
  const src = (await import('../../shared/progress.ts')).DAILY_QUESTS.find((x) => x.id === quest.id)!.sources[0];
  for (let i = 0; i < quest.goal; i++) await db.query('insert into xp_log (user_id, source, xp) values ($1,$2,0)', [u.userId, src]);
  const before = (await call('GET', '/api/me', undefined, u.cookie)).body.user;
  const got = await ok('POST', `/api/progress/daily/${quest.id}/claim`, {}, u.cookie);
  assert.deepEqual([got.reward.xp > 0, got.xpGained, got.cash], [true, got.reward.xp, before.cash + got.reward.cash]);
  assert.deepEqual([(await call('POST', `/api/progress/daily/${quest.id}/claim`, {}, u.cookie)).status, (await call('POST', `/api/progress/daily/${quest.id}/claim`, {}, u.cookie)).body.error], [409, 'da_nhan']);
  // thành tựu đếm theo sổ EXP
  assert.equal((await call('POST', '/api/progress/achievements/thu_hoach_10/claim', {}, u.cookie)).body.error, 'chua_xong');
  for (let i = 0; i < 10; i++) await db.query(`insert into xp_log (user_id, source, xp) values ($1,'thu_hoach',0)`, [u.userId]);
  const ach = await ok('POST', '/api/progress/achievements/thu_hoach_10/claim', {}, u.cookie);
  assert.equal(ach.reward.cash, ACHIEVEMENTS.find((a) => a.id === 'thu_hoach_10')!.cash);
  assert.equal((await call('POST', '/api/progress/achievements/thu_hoach_10/claim', {}, u.cookie)).body.error, 'da_nhan');
  // thưởng lên cấp: nhận tay, mỗi cấp một lần
  await ok('POST', '/api/test/xp', { value: 100 }, u.cookie);
  assert.equal((await call('POST', '/api/progress/levels/3/claim', {}, u.cookie)).body.error, 'chua_xong');
  const cashBefore = (await call('GET', '/api/me', undefined, u.cookie)).body.user.cash;
  const lv = await ok('POST', '/api/progress/levels/2/claim', {}, u.cookie);
  assert.deepEqual([lv.reward, lv.cash], [levelReward(2), cashBefore + levelReward(2)]);
  assert.equal((await call('POST', '/api/progress/levels/2/claim', {}, u.cookie)).body.error, 'da_nhan');
  const pr2 = await ok('GET', '/api/progress', undefined, u.cookie);
  assert.deepEqual(pr2.levelRewards, [{ level: 2, reward: levelReward(2), claimed: true }]);
  assert.ok(pr2.achievements.find((a: any) => a.id === 'thu_hoach_10').claimed);
});

test('nâng cấp đất: cần đủ cấp và đủ tiền, tăng sản lượng; chủ xưởng không nâng được', async () => {
  const u = await signup('tp_lai', 'thuong_lai');
  const sp = specialtiesOfRegion('dt_caibe')[0];
  const view = await ok('GET', `/api/plots/${u.plotId}/upgrades`, undefined, u.cookie);
  assert.deepEqual(view.upgrades.map((x: any) => [x.kind, x.level, x.canUpgrade]), [['cai_tao', 0, true], ['tuoi', 0, true], ['nha_mang', 0, true], ['cam_bien', 0, true]]);
  const up = await ok('POST', `/api/plots/${u.plotId}/upgrade`, { kind: 'cai_tao' }, u.cookie);
  assert.deepEqual([up.level, up.cost, up.cash, up.xpGained, up.playerLevel], [1, landUpgradeCost('cai_tao', 1), 500_000_000 - landUpgradeCost('cai_tao', 1), XP_RULES.nang_dat.xp, 1]);
  // cấp 2 cần nhân vật cấp 3
  const no = await call('POST', `/api/plots/${u.plotId}/upgrade`, { kind: 'cai_tao' }, u.cookie);
  assert.deepEqual([no.status, no.body.error], [409, 'chua_du_cap']);
  await ok('POST', '/api/test/xp', { value: 300 }, u.cookie);
  assert.equal((await ok('POST', `/api/plots/${u.plotId}/upgrade`, { kind: 'cai_tao' }, u.cookie)).level, 2);
  assert.equal((await call('POST', `/api/plots/${u.plotId}/upgrade`, { kind: 'la' }, u.cookie)).status, 400);
  const plot = await ok('GET', `/api/plots/${u.plotId}`, undefined, u.cookie);
  assert.deepEqual(plot.plot.upgrades, { cai_tao: 2 });
  // thu hoạch được thêm 10%
  const { rows } = await db.query(`insert into plantings (plot_id, tile, specialty_id, step_index, step_ready_at) values ($1,0,$2,$3, now() - interval '1 second') returning id`, [u.plotId, sp.id, stepCount(sp) - 1]);
  const h = await ok('POST', `/api/plantings/${rows[0].id}/step`, {}, u.cookie);
  assert.equal(h.harvested.kg, Math.round(CROPS[sp.crop].yieldKg * 1.1));
});

test('lai tạo giống: thất bại trả nửa nguyên liệu, thành công ra gói giống trồng không tốn tiền và có tác dụng', async () => {
  const u = { ...(await login('tp_vuon')) };
  const home = specialtiesOfRegion('dt_caibe');
  const a = home.find((x) => Object.values(SPECIALTIES).some((y) => canCross(x.id, y.id)))!, c = Object.values(SPECIALTIES).find((y) => canCross(a.id, y.id))!;
  const f = SEED_FUSIONS.find((x) => x.trait === 'thuong_hang')!;
  await ok('POST', '/api/test/stock', { specialtyId: a.id, kg: 200 }, u.cookie);
  await ok('POST', '/api/test/stock', { specialtyId: c.id, kg: 200 }, u.cookie);
  await ok('POST', '/api/test/cash', { amount: 100_000_000 }, u.cookie);
  // chưa đủ cấp
  assert.equal((await call('POST', '/api/fusion', { recipeId: f.id, inputs: [a.id, c.id] }, u.cookie)).body.error, 'chua_du_cap');
  await ok('POST', '/api/test/xp', { value: LEVELS[f.minLevel - 1].xp }, u.cookie);
  const list = await ok('GET', '/api/fusion', undefined, u.cookie);
  const r = list.recipes.find((x: any) => x.id === f.id);
  assert.deepEqual([r.kind, r.have, r.successRate, r.boostedRate, r.keepOnFail], ['giong', true, fusionRate(f.successRate, f.minLevel, false), fusionRate(f.successRate, f.minLevel, true), 0.5]);
  assert.ok(r.options.some((p: string[]) => p[0] === a.id && p[1] === c.id));
  assert.equal((await call('POST', '/api/fusion', { recipeId: f.id, inputs: [a.id, a.id] }, u.cookie)).body.error, 'nguyen_lieu_sai');
  const invOf = async (id: string) => (await db.query(`select coalesce(sum(kg),0)::int as kg from inventory where user_id = $1 and specialty_id = $2 and quality = 'A'`, [u.userId, id])).rows[0].kg as number;
  const a0 = await invOf(a.id), c0 = await invOf(c.id);
  // ép thất bại: mất tiền vật tư, được trả lại một nửa nguyên liệu
  await ok('POST', '/api/test/fusion-luck', { mode: 'luon_hong' }, u.cookie);
  const fail = await ok('POST', '/api/fusion', { recipeId: f.id, inputs: [a.id, c.id] }, u.cookie);
  assert.deepEqual([fail.success, fail.result, fail.spent, fail.cash, fail.xpGained], [false, null, f.cost, 100_000_000 - f.cost, XP_RULES.dung_hop_hong.xp]);
  assert.deepEqual([await invOf(a.id), await invOf(c.id)], [a0 - f.kgEach / 2, c0 - f.kgEach / 2]);
  // ép thành công, có mua vật tư tăng cường
  await ok('POST', '/api/test/fusion-luck', { mode: 'luon_dat' }, u.cookie);
  const win = await ok('POST', '/api/fusion', { recipeId: f.id, inputs: [a.id, c.id], boost: true }, u.cookie);
  assert.deepEqual([win.success, win.result.trait, win.result.packets, win.spent, win.successRate, win.xpGained], [true, 'thuong_hang', f.packets, f.cost + boostCost(f.cost), fusionRate(f.successRate, f.minLevel, true), XP_RULES.dung_hop.xp]);
  assert.deepEqual((await ok('GET', '/api/seeds', undefined, u.cookie)).seeds.map((x: any) => [x.specialtyId, x.trait, x.qty]), [[a.id, 'thuong_hang', f.packets]]);
  // trồng bằng gói giống: không tốn tiền giống, ô mang đặc tính; thu hoạch luôn Loại 1 và thêm 10%
  const cash0 = (await call('GET', '/api/me', undefined, u.cookie)).body.user.cash;
  const p = await ok('POST', `/api/plots/${u.plotId}/plant`, { tile: 5, specialtyId: a.id, seed: 'thuong_hang' }, u.cookie);
  assert.deepEqual([p.cost, p.trait, (await call('GET', '/api/me', undefined, u.cookie)).body.user.cash], [0, 'thuong_hang', cash0]);
  assert.ok(seedCost(a) > 0);
  assert.equal((await ok('GET', `/api/plots/${u.plotId}`, undefined, u.cookie)).plantings.find((x: any) => x.tile === 5).trait, 'thuong_hang');
  await db.query(`update plantings set step_index = $2, step_ready_at = now() - interval '1 second', late_count = 5 where id = $1`, [p.plantingId, stepCount(a) - 1]);
  const h = await ok('POST', `/api/plantings/${p.plantingId}/step`, {}, u.cookie);
  assert.deepEqual([h.harvested.quality, h.harvested.kg], ['A', Math.round(CROPS[a.crop].yieldKg * 1.1)]);
  assert.equal((await call('POST', `/api/plots/${u.plotId}/plant`, { tile: 6, specialtyId: a.id, seed: 'chin_som' }, u.cookie)).body.error, 'het_giong');
  assert.equal((await ok('GET', '/api/fusion', undefined, u.cookie)).history.length, 2);
});

/** Đăng nhập lại một tài khoản đã tạo ở kiểm thử trước. */
async function login(name: string) {
  const r = await call('POST', '/api/auth/login', { username: name, password: 'matkhau123' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const me = (await call('GET', '/api/me', undefined, r.cookie)).body;
  return { cookie: r.cookie!, userId: me.user.id as number, plotId: me.plots.find((p: any) => p.isHome).id as number };
}

test('chủ xưởng: ghép máy, nhập máy ngoại theo từng chặng rồi lắp, phối hộp quà và bán', async () => {
  const u = await signup('tp_xuong', 'xuong');
  // chủ xưởng không nâng cấp đất được
  assert.equal((await call('POST', `/api/plots/${u.plotId}/upgrade`, { kind: 'tuoi' }, u.cookie)).body.error, 'xuong_khong_trong');
  const ws0 = await ok('GET', '/api/workshop', undefined, u.cookie);
  const starter = ws0.machines[0];
  assert.deepEqual([ws0.machines.length, starter.origin, starter.yieldBonus], [1, null, 0]);
  // ---- ghép hai máy cùng loại
  const second = await ok('POST', '/api/workshop/machines/buy', { kind: starter.kind }, u.cookie);
  assert.equal(second.xpGained, XP_RULES.mua_may.xp);
  assert.equal((await call('POST', '/api/fusion', { recipeId: MACHINE_MERGE.id, inputs: [starter.id, second.machineId] }, u.cookie)).body.error, 'chua_du_cap');
  await ok('POST', '/api/test/xp', { value: LEVELS[MACHINE_MERGE.minLevel - 1].xp }, u.cookie);
  const merge = (await ok('GET', '/api/fusion', undefined, u.cookie)).recipes.find((x: any) => x.id === MACHINE_MERGE.id);
  assert.deepEqual([merge.kind, merge.have, merge.options, merge.keepOnFail], ['may', true, [[starter.id, second.machineId]], 1]);
  await ok('POST', '/api/test/fusion-luck', { mode: 'luon_hong' }, u.cookie);
  const bad = await ok('POST', '/api/fusion', { recipeId: MACHINE_MERGE.id, inputs: [starter.id, second.machineId] }, u.cookie);
  assert.deepEqual([bad.success, bad.spent > 0, (await ok('GET', '/api/workshop', undefined, u.cookie)).machines.length], [false, true, 2]);
  await ok('POST', '/api/test/fusion-luck', { mode: 'luon_dat' }, u.cookie);
  const good = await ok('POST', '/api/fusion', { recipeId: MACHINE_MERGE.id, inputs: [starter.id, second.machineId] }, u.cookie);
  assert.deepEqual([good.success, good.result.level, good.result.kind], [true, 2, starter.kind]);
  const ws1 = await ok('GET', '/api/workshop', undefined, u.cookie);
  assert.deepEqual(ws1.machines.map((m: any) => [m.id, m.level]), [[starter.id, 2]]);
  // ---- nhập máy ngoại (máy chủ chạy giờ thật để máy chưa về ngay)
  const imp = IMPORT_MACHINES[0], cost = importCost(imp);
  await ok('POST', '/api/test/cash', { amount: 200_000_000 }, u.cookie);
  const cat = await ok('GET', '/api/workshop/imports', undefined, u.cookie, slowApp);
  assert.deepEqual([cat.isWorkshop, cat.catalog.length, cat.catalog[0].cost.total, cat.catalog[0].canOrder], [true, IMPORT_MACHINES.length, cost.total, true]);
  const order = await ok('POST', '/api/workshop/machines/import', { kind: imp.id }, u.cookie, slowApp);
  assert.deepEqual([order.legs.map((l: any) => l.stage), order.cost, order.cash], [['tau_bien', 'thong_quan', 'xe_ve_xuong'], cost, 200_000_000 - cost.total]);
  assert.ok(order.legs[0].etaAt < order.legs[1].etaAt && order.legs[1].etaAt < order.legs[2].etaAt);
  const pending = await ok('GET', '/api/workshop/imports', undefined, u.cookie, slowApp);
  assert.deepEqual([pending.orders.length, pending.orders[0].stage, pending.orders[0].arrived], [1, 'tau_bien', false]);
  assert.equal((await callOn(slowApp, 'POST', `/api/workshop/imports/${order.orderId}/install`, {}, u.cookie)).body.error, 'chua_toi');
  assert.equal((await ok('POST', '/api/test/import-arrive', {}, u.cookie)).orders, 1);
  assert.equal((await ok('GET', '/api/workshop/imports', undefined, u.cookie)).orders[0].stage, 'da_toi');
  const inst = await ok('POST', `/api/workshop/imports/${order.orderId}/install`, {}, u.cookie);
  assert.deepEqual([inst.kind, inst.origin, inst.xpGained], [imp.kind, imp.id, XP_RULES.nhap_may.xp]);
  assert.equal((await call('POST', `/api/workshop/imports/${order.orderId}/install`, {}, u.cookie)).status, 404);
  const ws2 = await ok('GET', '/api/workshop', undefined, u.cookie);
  const foreign = ws2.machines.find((m: any) => m.id === inst.machineId);
  assert.deepEqual([foreign.origin, foreign.originName, foreign.yieldBonus, foreign.time, foreign.name.includes(imp.origin)], [imp.id, imp.origin, imp.yieldBonus, imp.speed, true]);
  assert.equal((await ok('GET', `/api/plots/${u.plotId}`, undefined, u.cookie)).factory.machines.length, 2);
  // ---- phối hộp quà
  const box = GIFT_BOXES[0], ids = Object.keys(SPECIALTIES).slice(0, 2);
  for (const id of ids) await ok('POST', '/api/test/product', { specialtyId: id, kg: 20 }, u.cookie);
  const b0 = (await ok('GET', '/api/fusion', undefined, u.cookie)).recipes.find((x: any) => x.id === box.id);
  assert.deepEqual([b0.kind, b0.have, b0.result.boxes], ['san_pham', true, box.boxes]);
  assert.equal((await call('POST', '/api/fusion', { recipeId: box.id, inputs: [ids[0]] }, u.cookie)).body.error, 'nguyen_lieu_sai');
  const made = await ok('POST', '/api/fusion', { recipeId: box.id, inputs: ids }, u.cookie);
  assert.deepEqual([made.success, made.result.boxes, made.result.value > 0], [true, box.boxes, true]);
  const left = (await db.query('select kg from products where user_id = $1 and specialty_id = $2', [u.userId, ids[0]])).rows[0].kg;
  assert.equal(left, 20 - box.kgEach);
  const boxes = (await ok('GET', '/api/fusion', undefined, u.cookie)).boxes;
  assert.deepEqual([boxes.length, boxes[0].qty, boxes[0].value], [1, box.boxes, made.result.value]);
  // bán cho doanh nghiệp quà tặng; xuất khẩu cần gom đủ hộp
  const sale = await ok('POST', '/api/fusion/boxes/sell', { boxId: box.id, qty: 4 }, u.cookie);
  assert.deepEqual([sale.total, sale.channel], [made.result.value * 4, 'doanh_nghiep']);
  assert.equal((await call('POST', '/api/fusion/boxes/sell', { boxId: box.id, qty: 4, channel: 'xuat_khau' }, u.cookie)).body.error, 'chua_du_cap');
  await ok('POST', '/api/test/xp', { value: LEVELS[9].xp }, u.cookie);
  const ex = await call('POST', '/api/fusion/boxes/sell', { boxId: box.id, qty: 4, channel: 'xuat_khau' }, u.cookie);
  assert.deepEqual([ex.status, ex.body.error, BOX_EXPORT_MIN > 4], [409, 'lo_hang_sai', true]);
  assert.equal((await call('POST', '/api/fusion/boxes/sell', { boxId: box.id, qty: 99 }, u.cookie)).body.error, 'khong_du_hang');
  // nhà vườn không phối hộp quà được
  const farmer = await login('tp_vuon');
  await ok('POST', '/api/test/xp', { value: LEVELS[box.minLevel - 1].xp }, farmer.cookie);
  assert.equal((await call('POST', '/api/fusion', { recipeId: box.id, inputs: ids }, farmer.cookie)).body.error, 'chi_chu_xuong');
});
