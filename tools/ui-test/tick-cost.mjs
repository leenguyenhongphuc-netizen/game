// Đo xem nhịp đồng hồ 1 giây của App (setInterval 1000 ms vẽ lại cả cây React) có làm hụt khung ở màn làng không.
// Chạy hai lượt cùng điều kiện: A — giữ nguyên; B — chặn các setInterval 1000 ms (giả lập bỏ nhịp). Mỗi lượt cho nhân vật đi
// (giữ phím W/D) 12 giây, ghi khoảng cách giữa các khung (rAF) và thời điểm mỗi nhịp 1 giây chạy; so độ dài khung ngay sau nhịp.
//   API ở cổng 3000 (TESTER) + Vite: node tools/ui-test/tick-cost.mjs [base]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.argv[2] || 'http://localhost:5221';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
async function run(block, user) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript((block) => {
    const w = window; w.__ticks = []; w.__frames = [];
    const si = w.setInterval.bind(w);
    w.setInterval = (fn, ms, ...a) => si((...x) => { if (ms === 1000) { w.__ticks.push(performance.now()); if (block) return; } return fn(...x); }, ms, ...a);
    const raf = w.requestAnimationFrame.bind(w); w.requestAnimationFrame = (cb) => (w.__noRaf ? 0 : raf(cb));
    const loop = (t) => { w.__frames.push(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  }, block);
  const pg = await ctx.newPage();
  await pg.goto(BASE + '/');
  const api = (m, p, d) => pg.evaluate(([m, p, d]) => fetch(p, { method: m, headers: { 'content-type': 'application/json' }, body: d ? JSON.stringify(d) : undefined }).then((r) => r.status), [m, p, d]);
  await api('POST', '/api/auth/register', { username: user, password: 'matkhau123' });
  await api('POST', '/api/auth/login', { username: user, password: 'matkhau123' });
  await api('POST', '/api/onboard', { regionId: 'ld_dalat' });
  console.log('api', await api('POST', '/api/auth/register', { username: user, password: 'matkhau123' }), await api('POST', '/api/onboard', { regionId: 'ld_dalat' }), await api('POST', '/api/role/spin'));
  await pg.goto(BASE + '/');
  await pg.getByRole('button', { name: 'Quay', exact: true }).click(); await pg.getByRole('button', { name: 'Vào xóm' }).click({ timeout: 60000 });
  await pg.waitForSelector('canvas', { timeout: 60000 });
  await pg.waitForTimeout(6000);
  // Dừng vòng vẽ 3D (rAF thành rỗng) để chỉ còn việc React vẽ lại theo nhịp; đo thời gian chạy JS 10 giây qua CDP.
  await pg.evaluate(() => { window.__noRaf = true; });
  await pg.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Performance.enable');
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  await pg.evaluate(() => { window.__frames.length = 0; window.__ticks.length = 0; });
  const m0 = await m(); await pg.waitForTimeout(10000); const m1 = await m();
  const script = (m1.ScriptDuration - m0.ScriptDuration) * 1000, task = (m1.TaskDuration - m0.TaskDuration) * 1000, layout = (m1.LayoutDuration - m0.LayoutDuration) * 1000, recalc = (m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000;
  await pg.screenshot({ path: '/tmp/claude-0/-home-user-game/1e835db3-e7fb-5289-b635-675a73176ff9/scratchpad/l6/tick-' + block + '.png' });
  const { frames, ticks } = await pg.evaluate(() => ({ frames: window.__frames, ticks: window.__ticks }));
  await ctx.close();
  void frames;
  return { block, ticks: ticks.length, scriptMs: Math.round(script), taskMs: Math.round(task), layoutMs: Math.round(layout), styleMs: Math.round(recalc), perTickMs: ticks.length ? +((task) / ticks.length).toFixed(1) : null };
}
const stamp = Date.now() % 100000;
console.log(JSON.stringify(await run(false, 'l6a' + stamp)));
console.log(JSON.stringify(await run(true, 'l6b' + stamp)));
await b.close();
