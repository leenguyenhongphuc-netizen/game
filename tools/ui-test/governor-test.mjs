// Phép thử bộ điều tiết chất lượng (web/src/perf.ts): node tools/ui-test/governor-test.mjs
// Máy khoẻ có vài khung trễ lúc tải KHÔNG được bị hạ bậc hay ép nhịp 30; máy thật sự yếu thì hạ bậc trước, nhịp 30 sau cùng.
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = globalThis; globalThis.addEventListener = () => {}; globalThis.location = { search: '' };
globalThis.document = { hidden: false };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'iPhone', maxTouchPoints: 5, hardwareConcurrency: 6 }, configurable: true });
store.set('vv-quality-level', '3'); store.set('vv-pace30', JSON.stringify({ on: true, at: Date.now() })); // trạng thái bị khoá của bản lỗi
const { Quality, __resetGovernor } = await import('../../web/src/perf.ts');
const fakeRenderer = () => ({ setPixelRatio() {}, setSize() {}, info: { render: { calls: 0, triangles: 0 } }, shadowMap: {}, domElement: { addEventListener() {} } });
function run(name, dts, { interacted = true, busy = false } = {}) {
  __resetGovernor({ interacted }); store.delete('vv-q2-level');
  const q = new Quality(fakeRenderer(), { name }); q.resize(430, 932); q.busy = busy;
  let now = 1000, drawn = 0; for (const dt of dts) { now += dt; if (q.tick(now)) drawn++; }
  const r = { level: q.level, pace30: q.half, drawn, frames: dts.length }; q.dispose(); return r;
}
const rep = (n, v) => Array.from({ length: n }, () => v);
let fail = 0; const check = (label, ok, r) => { console.log(`${ok ? 'ĐẠT ' : 'HỎNG'} ${label}`, JSON.stringify(r)); if (!ok) fail++; };
check('khoá cũ của bản lỗi đã bị xoá', !store.has('vv-pace30') && !store.has('vv-quality-level'), [...store.keys()]);
let r = run('đều 60', rep(1200, 16.7)); check('đều 16,7 ms: giữ bậc 0, vẽ mọi khung', r.level === 0 && !r.pace30 && r.drawn === r.frames, r);
r = run('trễ lúc tải', [200, 150, 90, 80, 120, 16.7, 180, ...rep(60, 16.7), 90, 110, ...rep(1200, 16.7)]); check('vài khung 80–200 ms lúc đầu rồi đều: không hạ bậc, không nhịp 30', r.level === 0 && !r.pace30, r);
r = run('khựng lẻ', Array.from({ length: 1800 }, (_, i) => (i % 97 === 0 ? 120 : 16.7))); check('khựng lẻ mỗi ~1,6 giây (GC): không đổi gì', r.level === 0 && !r.pace30, r);
r = run('rớt 1/4', Array.from({ length: 1800 }, (_, i) => (i % 4 === 0 ? 33.4 : 16.7))); check('rớt 1 khung mỗi 4 khung (≈48 khung/giây): không ép nhịp 30', !r.pace30, r);
r = run('yếu 30', rep(900, 34)); check('máy 30 khung/giây kéo dài: hạ tới bậc 3 rồi mới nhịp 30', r.level === 3 && r.pace30, r);
r = run('yếu chưa chạm', rep(900, 34), { interacted: false }); check('chưa tương tác: hạ bậc nhưng không ép nhịp', r.level === 3 && !r.pace30, r);
r = run('yếu 45', rep(1500, 22)); check('máy ~45 khung/giây: hạ bậc, không nhịp 30', r.level >= 1 && !r.pace30, r);
process.exit(fail ? 1 : 0);
