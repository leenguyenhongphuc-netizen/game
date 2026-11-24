// Người chơi giả: dùng nút ◀ ▶, giữ GA/PHANH theo phản xạ có độ trễ, chạm vạch dừng, bật xi nhan theo nút nhấp nháy.
import { ExamSim, idleInput } from '../web/src/drive/ExamCourse.ts';
import { ExamAssist } from '../web/src/drive/ExamAssist.ts';
import type { AssistLevel } from '../web/src/drive/ExamAssist.ts';
const level = (process.argv[2] ?? 'de') as AssistLevel, runs = Number(process.argv[3] ?? 10), cls = (process.argv[4] ?? 'B') as 'B';
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const res: string[] = []; let good = 0;
for (let r = 0; r < runs; r++) {
  seed = 1000 + r * 7919;
  const sim = new ExamSim(cls, { danger: true }), as = new ExamAssist(level), raw = idleInput();
  const dt = 0.02; let think = 0, nudge = 0, nudgeT = 0;
  const q: { at: number; f: () => void }[] = []; const later = (d: number, f: () => void) => q.push({ at: sim.t + d, f });
  const pending = new Set<string>(); const once = (k: string, d: number, f: () => void) => { if (pending.has(k)) return; pending.add(k); later(d, () => { pending.delete(k); f(); }); };
  const tapped = new Set<number>();
  while (!sim.done && sim.t < 20 * 60) {
    for (let i = q.length - 1; i >= 0; i--) if (q[i].at <= sim.t) { const a = q.splice(i, 1)[0]; a.f(); }
    think -= dt;
    if (think <= 0) {
      think = 0.1;
      const ref = as.ref, need = as.need;
      if (need.belt) once('belt', 0.6 + rnd(), () => { raw.belt = true; });
      if (raw.gear === 'P') once('gear', 1 + rnd(), () => { raw.gear = 'D'; });
      if (raw.hand && raw.gear !== 'P') once('hand', 0.4 + rnd() * 0.6, () => { raw.hand = false; });
      if (need.left) once('L', 0.3 + rnd() * 0.5, () => { raw.left = true; raw.right = false; });
      if (need.right) once('R', 0.3 + rnd() * 0.5, () => { raw.right = true; raw.left = false; });
      if (ref && !ref.left && raw.left && !need.left) once('Loff', 1 + rnd(), () => { if (!as.ref?.left) raw.left = false; });
      if (need.hazard) once('H', 0.5 + rnd() * 0.9, () => { raw.hazard = true; raw.brake = 1; raw.gas = 0; });
      if (!sim.danger && raw.hazard) once('Hoff', 0.8 + rnd(), () => { raw.hazard = false; });
      // chạm vạch dừng khi tới gần
      sim.c.stops.forEach((st, i) => {
        if (st.state !== 'cho' || tapped.has(i) || pending.has('tap')) return; const F = sim.front, al = (st.x - F.x) * Math.cos(st.h) + (st.y - F.y) * Math.sin(st.h), lat = -(st.x - F.x) * Math.sin(st.h) + (st.y - F.y) * Math.cos(st.h);
        if (al > 0 && al < 14 && Math.abs(lat) < 3 && Math.cos(sim.th - st.h) > 0.9) once('tap', 0.3 + rnd() * 0.5, () => { if (as.setGoal(sim, st.x - Math.cos(st.h) * 0.05, st.y - Math.sin(st.h) * 0.05)) { tapped.add(i); raw.gas = 0; raw.brake = 0; } });
      });
      // bàn đạp theo phản xạ (trễ 0,2–0,5 s), không đụng khi xe đang tự chạy tới đích
      if (ref && !as.goal && !(sim.danger && raw.hazard)) {
        const wantGas = ref.gas > 0.08 && ref.brake < 0.5, wantBrake = ref.brake >= 0.5;
        once('ped', 0.2 + rnd() * 0.3, () => { if (as.goal) return; raw.gas = wantGas ? 1 : 0; raw.brake = wantBrake ? 1 : 0; });
      }
      if (sim.danger) { raw.gas = 0; once('dbrake', 0.6 + rnd() * 0.8, () => { raw.brake = 1; }); }
      // tay lóng ngóng: thỉnh thoảng bấm nhầm ◀/▶
      if (nudgeT <= 0 && rnd() < (process.env.NONUDGE ? 0 : 0.03)) { nudge = rnd() < 0.5 ? 1 : -1; nudgeT = 0.15 + rnd() * 0.35; }
    }
    if (nudgeT > 0) { nudgeT -= dt; if (nudgeT <= 0) nudge = 0; }
    sim.step(dt, as.apply(sim, raw, nudge, false, dt));
  }
  const ok = sim.passed; if (ok) good++;
  res.push(`${r}: ${sim.outReason ? 'TRUẤT ' + sim.outReason : sim.score} ${Math.round(sim.t)}s ${sim.log.map((l) => `[${l.item}] ${l.text}`).join('; ')}`);
}
console.log(res.join('\n')); console.log(`${level}: đạt ${good}/${runs}`);
