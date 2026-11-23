// Theo dõi vị trí xe khi tự vào ô (gỡ lỗi khu trạm): node tools/ui-test/stop-dbg.mjs [rest|fuel] [lot|pump]
import { chromium } from 'playwright';
const kind = process.argv[2] ?? 'rest', bay = process.argv[3] ?? 'lot';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 430, height: 932 } });
await p.goto(`http://127.0.0.1:5291/drive-test.html?stop=${kind}`); await new Promise((r) => setTimeout(r, 4000));
console.log(await p.evaluate((k) => window.__stop.park(k), bay));
for (let i = 0; i < 12; i++) { await new Promise((r) => setTimeout(r, 1000)); console.log(JSON.stringify(await p.evaluate(() => ({ ...window.__stop.pos(), ph: window.__stop.state().phase, fps: window.__stop.info() })))); }
await b.close();
