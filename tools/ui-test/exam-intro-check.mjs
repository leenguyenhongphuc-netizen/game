// Màn giới thiệu sân thi trên nhiều cỡ màn: không có gì tràn ngang ra khỏi khung. node tools/ui-test/exam-intro-check.mjs [base]
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5291';
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
let bad = 0;
for (const [w, h] of [[360, 780], [390, 844], [430, 932], [844, 390], [932, 430], [768, 1024], [1280, 800]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`${base}/exam-test.html?cls=B`); await new Promise((r) => setTimeout(r, 1500));
  const r = await p.evaluate(() => { const c = document.querySelector('.exam-card'); const cr = c.getBoundingClientRect(); const out = [...c.querySelectorAll('*')].filter((e) => { const q = e.getBoundingClientRect(); return q.width && (q.left < cr.left - 1 || q.right > cr.right + 1); }).map((e) => e.className || e.tagName); return { sw: c.scrollWidth, cw: c.clientWidth, left: cr.left, right: innerWidth - cr.right, out: out.slice(0, 4) }; });
  const ok = r.sw <= r.cw + 1 && r.left >= 0 && r.right >= 0 && !r.out.length; if (!ok) bad++;
  console.log(`${w}x${h}`, ok ? 'ổn' : 'TRÀN', JSON.stringify(r));
  await p.close();
}
await b.close(); process.exit(bad ? 1 : 0);
