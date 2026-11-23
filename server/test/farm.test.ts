import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Db } from '../src/db.ts';
import { CROPS, SPECIALTIES, specialtiesOfRegion } from '../../shared/catalog.ts';
import { LEVELS } from '../../shared/rules.ts';
import {
  FARM_MACHINES, FIELD_BLOCK_TILES, FIELD_YIELD_MULT, HELI_TOUR_FEE, HIRE_COST_PER_TILE, fieldBlockPrice, fieldMaxBlocks, fieldSeedCost, fieldSteps, workKindOf, workPlan,
} from '../../shared/farm.ts';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://vuon:vuon@localhost:5432/vuon_test';
let db: Db, app: FastifyInstance;
before(async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  db = await openDb(url);
  app = await buildApp({ db, timeScale: 1e9, lateGraceMs: 600_000, adminToken: 'test-admin-token-0123456789', rateLimit: false, staticDir: '/nonexistent',
    marketEventsAt: () => [], inSeason: () => false, paceFactor: () => 1, testerUsernames: ['ruong_thu'], tripMinFactor: 0,
    weatherAt: () => ({ kind: 'nang', label: 'Nắng đẹp', icon: '☀️', growth: 1, until: Date.now() + 3600_000 }), marketDayAt: () => ({ active: false, startsAt: 0, endsAt: 0 }) });
});
after(async () => { await app.close(); await db.close(); });

type Res = { status: number; body: any; cookie?: string };
async function call(method: string, path: string, body?: unknown, cookie?: string): Promise<Res> {
  const r = await app.inject({ method: method as any, url: path, payload: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) } });
  const set = r.headers['set-cookie'], first = Array.isArray(set) ? set[0] : set;
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, cookie: first?.split(';')[0] };
}
async function signup(name: string, role: 'nong_dan' | 'xuong' | 'thuong_lai', level = 8, regionId = 'dt_caibe', cash = 5_000_000_000): Promise<string> {
  const r = await call('POST', '/api/auth/register', { username: name, password: 'matkhau123', displayName: name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await db.query('update users set role = $2, role_assigned_at = now(), xp = $3 where username = $1', [name, role, LEVELS[level - 1].xp]);
  const o = await call('POST', '/api/onboard', { regionId }, r.cookie);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  await db.query('update users set cash = $2, energy = 250 where username = $1', [name, cash]);
  return r.cookie!;
}
const cashOf = async (name: string) => Number((await db.query('select cash from users where username = $1', [name])).rows[0].cash);
const finishJobs = () => db.query("update field_jobs set ends_at = now() - interval '1 second' where not done");
const readyNow = () => db.query("update fields set step_ready_at = now() - interval '1 second' where specialty_id is not null");

test('luật cánh đồng: hạn mức theo cấp, phân loại việc, kế hoạch làm việc', () => {
  assert.equal(fieldMaxBlocks(4), 0);
  assert.equal(fieldMaxBlocks(5), 2);
  assert.equal(fieldMaxBlocks(30), 40);
  assert.equal(workKindOf('Thu hoạch'), 'thu');
  assert.equal(workKindOf('Bón phân nuôi trái'), 'bon');
  assert.equal(workKindOf('Lên mô, đào hố'), 'dat');
  const hire = workPlan('bon', 'thue', 1000, []);
  assert.equal(hire.cost, 1000 * HIRE_COST_PER_TILE);
  assert.equal(workPlan('bon', 'drone', 1000, []).ok, false);
  const dr = workPlan('bon', 'drone', 1000, ['drone']);
  assert.ok(dr.ok && dr.hours < hire.hours && dr.cost < hire.cost, 'drone nhanh và rẻ hơn thuê người');
  assert.equal(workPlan('khac', 'may', 100, ['may_cay']).ok, false, 'việc tỉa cành không làm bằng máy');
});

test('nhà nông mua ruộng, trồng, chăm bằng máy, drone và thuê người rồi thu hoạch vào kho', async () => {
  const ck = await signup('ruong_thu', 'nong_dan', 10);
  let r = await call('GET', '/api/fields', undefined, ck);
  assert.equal(r.status, 200);
  assert.equal(r.body.maxBlocks, fieldMaxBlocks(10));
  const before = await cashOf('ruong_thu');
  r = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 5 }, ck);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const fieldId = r.body.fieldId;
  assert.ok(before - (await cashOf('ruong_thu')) >= 5 * fieldBlockPrice('dt_caibe'));
  // vượt hạn mức
  r = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 10 }, ck);
  assert.equal(r.status, 409);
  // máy
  for (const k of ['may_cay', 'may_gieo', 'drone', 'he_tuoi', 'may_thu']) {
    r = await call('POST', '/api/farm/machines/buy', { kind: k }, ck);
    assert.equal(r.status, 200, `${k}: ${JSON.stringify(r.body)}`);
  }
  r = await call('POST', '/api/farm/machines/buy', { kind: 'may_cay' }, ck);
  assert.equal(r.status, 409, 'không mua trùng máy');
  // trồng
  const sp = specialtiesOfRegion('dt_caibe')[0];
  const c0 = await cashOf('ruong_thu');
  r = await call('POST', `/api/fields/${fieldId}/plant`, { specialtyId: sp.id }, ck);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(c0 - (await cashOf('ruong_thu')), fieldSeedCost(sp, 5 * FIELD_BLOCK_TILES));
  // làm lần lượt từng bước với cách làm phù hợp
  const steps = fieldSteps(sp.id);
  for (let i = 0; i < steps.length; i++) {
    await readyNow();
    const f = (await call('GET', '/api/fields', undefined, ck)).body.fields.find((x: any) => x.id === fieldId);
    assert.equal(f.stepIndex, i);
    const methods: string[] = f.step.methods;
    const method = methods.includes('drone') ? 'drone' : methods.includes('may') ? 'may' : 'thue';
    const path = i === steps.length - 1 ? `/api/fields/${fieldId}/harvest` : `/api/fields/${fieldId}/work`;
    r = await call('POST', path, { step: i, method }, ck);
    assert.equal(r.status, 200, `bước ${i} ${steps[i].name} (${method}): ${JSON.stringify(r.body)}`);
    // đang làm thì không làm chồng
    const again = await call('POST', `/api/fields/${fieldId}/work`, { step: i, method: 'thue' }, ck);
    assert.equal(again.status, 409);
    await finishJobs();
  }
  r = await call('GET', '/api/fields', undefined, ck);
  const harvested = r.body.settled.find((s: any) => s.harvested);
  assert.ok(harvested, 'thu hoạch được chốt khi lượt làm xong');
  assert.equal(harvested.harvested.kg, Math.round(CROPS[sp.crop].yieldKg * 500 * FIELD_YIELD_MULT));
  const inv = await db.query("select sum(kg)::int as kg from inventory i join users u on u.id = i.user_id where u.username = 'ruong_thu' and specialty_id = $1", [sp.id]);
  assert.equal(inv.rows[0].kg, harvested.harvested.kg);
  assert.equal(r.body.fields.find((x: any) => x.id === fieldId).specialtyId, null, 'thu hoạch xong ruộng trống lại');
  // trực thăng thuê
  const c1 = await cashOf('ruong_thu');
  r = await call('POST', '/api/farm/heli/tour', {}, ck);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(c1 - (await cashOf('ruong_thu')), HELI_TOUR_FEE);
  assert.ok(r.body.fields.length >= 1);
  // bán ruộng
  r = await call('POST', `/api/fields/${fieldId}/sell`, {}, ck);
  assert.equal(r.status, 200);
});

test('chỉ nhà nông mua ruộng; drone không bay vùng khác; máy bận thì lượt sau xếp hàng', async () => {
  const x = await signup('ruong_xuong', 'xuong', 10);
  let r = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 1 }, x);
  assert.equal(r.status, 403);
  const ck = await signup('ruong_hai', 'nong_dan', 12);
  const sp = specialtiesOfRegion('dt_caibe')[0];
  const ids: number[] = [];
  for (let i = 0; i < 2; i++) {
    r = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 4 }, ck);
    ids.push(r.body.fieldId);
    await call('POST', `/api/fields/${r.body.fieldId}/plant`, { specialtyId: sp.id }, ck);
  }
  await call('POST', '/api/farm/machines/buy', { kind: 'may_cay' }, ck);
  const kind0 = fieldSteps(sp.id)[0].kind;
  if (FARM_MACHINES.may_cay.works.includes(kind0)) {
    const a = await call('POST', `/api/fields/${ids[0]}/work`, { method: 'may' }, ck);
    const b = await call('POST', `/api/fields/${ids[1]}/work`, { method: 'may' }, ck);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.ok(b.body.startsAt >= a.body.endsAt, 'cùng một máy cày: ruộng thứ hai chờ máy rảnh');
  }
  // ruộng vùng khác: drone không bay tới
  await db.query("update fields set region_id = 'ld_dalat' where id = $1", [ids[1]]);
  await call('POST', '/api/farm/machines/buy', { kind: 'drone' }, ck);
  await finishJobs(); await call('GET', '/api/fields', undefined, ck);
  // tìm một bước drone làm được rồi thử trên ruộng vùng khác
  await db.query("update fields set specialty_id = $2, step_index = $3, step_ready_at = now() - interval '1 second' where id = $1",
    [ids[1], sp.id, fieldSteps(sp.id).findIndex((s) => FARM_MACHINES.drone.works.includes(s.kind))]);
  if (fieldSteps(sp.id).some((s) => FARM_MACHINES.drone.works.includes(s.kind))) {
    r = await call('POST', `/api/fields/${ids[1]}/work`, { method: 'drone' }, ck);
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'ngoai_tam_bay');
  }
  assert.ok(SPECIALTIES[sp.id]);
});

test('tự lái máy cày trên ruộng: ô đi qua được tính, chạy quá nhanh hoặc quá nhiều ô bị chặn, đủ ô thì sang bước', async () => {
  const ck = await signup('ruong_lai', 'nong_dan', 12);
  const sp = specialtiesOfRegion('dt_caibe').find((s) => fieldSteps(s.id).some((st) => st.kind === 'dat'))!;
  assert.ok(sp, 'có đặc sản bắt đầu bằng làm đất');
  let r = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 1 }, ck);
  const id = r.body.fieldId;
  await call('POST', `/api/fields/${id}/plant`, { specialtyId: sp.id }, ck);
  const datIdx = fieldSteps(sp.id).findIndex((s) => s.kind === 'dat');
  await db.query("update fields set step_index = $2, step_ready_at = now() - interval '1 second' where id = $1", [id, datIdx]);
  // chưa có máy cày: không lái được
  r = await call('POST', `/api/fields/${id}/drive`, { tiles: [0, 1], meters: 4, seconds: 2 }, ck);
  assert.equal(r.body.error, 'khong_lai_duoc');
  await call('POST', '/api/farm/machines/buy', { kind: 'may_cay' }, ck);
  // chạy quá nhanh
  r = await call('POST', `/api/fields/${id}/drive`, { tiles: [0], meters: 500, seconds: 2 }, ck);
  assert.equal(r.body.error, 'qua_nhanh');
  // quá nhiều ô so với quãng đường
  r = await call('POST', `/api/fields/${id}/drive`, { tiles: Array.from({ length: 80 }, (_, i) => i), meters: 4, seconds: 2 }, ck);
  assert.equal(r.body.error, 'qua_nhieu_o');
  const cash0 = await cashOf('ruong_lai');
  r = await call('POST', `/api/fields/${id}/drive`, { step: datIdx, tiles: Array.from({ length: 40 }, (_, i) => i), meters: 40, seconds: 8 }, ck);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.done, 40);
  assert.equal(await cashOf('ruong_lai'), cash0 - 40 * FARM_MACHINES.may_cay.costPerTile, 'trả tiền dầu theo ô');
  // gửi lại ô cũ không tính thêm
  r = await call('POST', `/api/fields/${id}/drive`, { tiles: [0, 1, 2], meters: 6, seconds: 2 }, ck);
  assert.equal(r.body.added, 0);
  const g = await call('GET', '/api/fields', undefined, ck);
  assert.equal(g.body.fields.find((f: { id: number }) => f.id === id).drive.done, 40);
  // lái nốt
  r = await call('POST', `/api/fields/${id}/drive`, { tiles: Array.from({ length: 60 }, (_, i) => 40 + i), meters: 60, seconds: 12 }, ck);
  assert.equal(r.body.finished, true);
  const after = (await call('GET', '/api/fields', undefined, ck)).body.fields.find((f: { id: number }) => f.id === id);
  assert.equal(after.stepIndex, datIdx + 1, 'đủ ô thì sang bước kế');
  assert.equal(after.drive, null);
  assert.ok(after.certNos.length === 1 && /^[A-Z]+\.\d{4}\.\d{4}$/.test(after.certNos[0]), 'khối ruộng gắn mã thửa (sổ địa chính)');
});

test('thuê robot làm vườn: từ cấp 8, rẻ và nhanh hơn thuê người, không làm việc tỉa cành', async () => {
  const hire = workPlan('bon', 'thue', 1000, []), bot = workPlan('bon', 'robot', 1000, []);
  assert.ok(bot.ok && bot.cost < hire.cost && bot.hours < hire.hours);
  assert.equal(workPlan('khac', 'robot', 100, []).ok, false);
  const ck = await signup('ruong_robot', 'nong_dan', 7);
  const sp = specialtiesOfRegion('dt_caibe')[0];
  const r0 = await call('POST', '/api/fields/buy', { regionId: 'dt_caibe', blocks: 1 }, ck);
  const id = r0.body.fieldId;
  await call('POST', `/api/fields/${id}/plant`, { specialtyId: sp.id }, ck);
  const first = fieldSteps(sp.id)[0].kind;
  let r = await call('POST', `/api/fields/${id}/work`, { method: 'robot' }, ck);
  if (first === 'khac') assert.equal(r.status, 409);
  else assert.equal(r.body.error, 'chua_du_cap');
  await db.query('update users set xp = $2 where username = $1', ['ruong_robot', LEVELS[8].xp]);
  r = await call('POST', `/api/fields/${id}/work`, { method: 'robot' }, ck);
  if (first !== 'khac') { assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.method, 'robot'); }
});
