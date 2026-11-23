// Ảnh từng vai (E4): thẻ Kho theo vai, bộ chọn giống Đà Lạt, hợp tác xã theo luật.
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { execSync } from 'node:child_process';
const BASE = 'http://localhost:3147', OUT = '/tmp/claude-0/-home-user-game/1e835db3-e7fb-5289-b635-675a73176ff9/scratchpad/e4';
execSync(`mkdir -p ${OUT}`);
const ONLY = process.argv[2];
const sql = (q) => execSync(`psql postgres://vuon:vuon@localhost:5432/vuon_ui_e4 -qtAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const browser = await chromium.launch();
const stamp = Date.now() % 100000;
async function account(name, role, region = 'ld_dalat', open = true) {
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro Max'], deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const u = `${name}${stamp}`;
  let r = await page.request.post(`${BASE}/api/auth/register`, { data: { username: u, password: 'matkhau123', displayName: u } });
  if (!r.ok()) throw new Error(await r.text());
  sql(`update users set role = '${role}', role_assigned_at = now(), cash = 900000000, xp = 20000 where username = '${u}'`);
  r = await page.request.post(`${BASE}/api/onboard`, { data: { regionId: region } });
  if (!r.ok()) throw new Error(await r.text());
  sql(`update users set truck_region = home_region_id where username = '${u}'`);
  if (open) { await page.goto(BASE); await page.waitForTimeout(4000); }
  return { page, ctx, u, id: Number(sql(`select id from users where username = '${u}'`)) };
}
const tap = async (page, text) => { await page.getByRole('button', { name: text, exact: false }).first().click(); await page.waitForTimeout(700); };
const shot = (page, f) => page.screenshot({ path: `${OUT}/${f}` });

if (!ONLY || ONLY === 'kho') for (const [role, name] of [['nong_dan', 'Nhà vườn'], ['xuong', 'Chủ xưởng'], ['thuong_lai', 'Thương lái']]) {
  const a = await account(`e4${role.slice(0, 4)}`, role);
  await tap(a.page, 'Kho');
  await shot(a.page, `kho-${role}.png`);
  console.log(role, (await a.page.locator('.modal .tabs').first().innerText()).replace(/\n/g, ' | '));
  await a.ctx.close();
}

// Bộ chọn giống Đà Lạt
if (!ONLY || ONLY === 'giong') {
  const a = await account('e4giong', 'nong_dan');
  await shot(a.page, 'giong-1-thanh-nhanh.png');
  const more = a.page.locator('.seed-more');
  console.log('nút tất cả:', await more.count(), 'chip nhanh:', await a.page.locator('.seed-chip').count());
  if (await more.count()) {
    await more.click(); await a.page.waitForTimeout(600);
    await shot(a.page, 'giong-2-bang-tat-ca.png');
    await a.page.fill('.seed-picker input[type=search]', 'hoa');
    await a.page.waitForTimeout(400);
    await shot(a.page, 'giong-3-tim-hoa.png');
    console.log('tìm "hoa":', await a.page.locator('.sp-card').count(), 'thẻ');
    await a.page.fill('.seed-picker input[type=search]', 'ca phe');
    await a.page.waitForTimeout(300);
    console.log('tìm "ca phe":', await a.page.locator('.sp-card strong').allInnerTexts());
    await a.page.fill('.seed-picker input[type=search]', '');
    await a.page.locator('.sp-card .sp-pick').nth(3).click(); await a.page.waitForTimeout(500);
    await shot(a.page, 'giong-4-da-chon.png');
    const ov = await a.page.evaluate(() => [...document.querySelectorAll('.seed-bar, .seed-picker')].map((e) => e.scrollWidth - e.clientWidth));
    console.log('tràn ngang:', ov);
  }
  // ngang
  await a.page.setViewportSize({ width: 932, height: 430 });
  await a.page.waitForTimeout(800);
  if (await a.page.locator('.seed-more').count()) { await a.page.locator('.seed-more').click(); await a.page.waitForTimeout(600); }
  await shot(a.page, 'giong-5-ngang.png');
  await a.ctx.close();
}

// Hợp tác xã: người sáng lập + 4 người
if (!ONLY || ONLY === 'htx') {
  const f = await account('e4htx', 'nong_dan');
  const others = [];
  for (let i = 1; i <= 4; i++) others.push(await account(`e4xv${i}`, 'nong_dan', 'ld_dalat', false));
  await tap(f.page, 'Xóm'); await tap(f.page, 'Hợp tác xã');
  await shot(f.page, 'htx-1-chua-co.png');
  await f.page.fill('.coop-new input', `Dâu tây Đà Lạt ${stamp}`);
  await f.page.locator('.coop-new button').click(); await f.page.waitForTimeout(1200);
  await shot(f.page, 'htx-2-dang-van-dong.png');
  const coopId = Number(sql(`select id from coops order by id desc limit 1`));
  // mời 1 người, 3 người tự xin vào
  await f.page.locator('.coop-steps .row-line', { hasText: others[0].u }).first().getByRole('button', { name: 'Mời' }).click(); await f.page.waitForTimeout(800);
  await others[0].page.goto(BASE); await others[0].page.waitForTimeout(4000);
  await tap(others[0].page, 'Xóm'); await tap(others[0].page, 'Hợp tác xã');
  await shot(others[0].page, 'htx-3-loi-moi.png');
  await others[0].page.getByRole('button', { name: 'Đồng ý' }).first().click(); await others[0].page.waitForTimeout(800);
  for (const o of others.slice(1)) { const r = await o.page.request.post(`${BASE}/api/coops/${coopId}/join`, { data: {} }); console.log('join', r.status()); }
  await f.page.getByRole('button', { name: 'Bạn bè' }).click(); await tap(f.page, 'Hợp tác xã');
  await shot(f.page, 'htx-4-du-5-nguoi.png');
  await f.page.locator('.coop-steps button.wide').click(); await f.page.waitForTimeout(1000);
  await shot(f.page, 'htx-5-cho-cap.png');
  sql(`update coops set reg_due_at = now() - interval '1 second' where id = ${coopId}`);
  await f.page.getByRole('button', { name: 'Bạn bè' }).click(); await tap(f.page, 'Hợp tác xã');
  await shot(f.page, 'htx-6-hoat-dong.png');
  for (const x of [f, ...others]) await x.ctx.close();
}
await browser.close();
