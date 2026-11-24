// Trợ lái cho sân sát hạch: ba mức Dễ / Vừa / Thật. Chỉ đổi cách tay người chơi biến thành thao tác trên xe,
// KHÔNG đổi luật chấm điểm (ExamSim chấm y như cũ). Không phụ thuộc thư viện vẽ để chạy thử được bằng node.
import { slopeX } from './ExamCourse.ts';
import type { ExamSim, Input } from './ExamCourse.ts';

export type AssistLevel = 'de' | 'vua' | 'that';
export const ASSIST_NAMES: Record<AssistLevel, string> = { de: 'Dễ', vua: 'Vừa', that: 'Thật' };
export const ASSIST_TIPS: Record<AssistLevel, string> = {
  de: 'Xe tự bám làn, tự về số khi cần lùi, giữ ga vừa phải; bạn chỉ chỉnh thêm bằng ◀ ▶, giữ GA/PHANH, hoặc chạm vào vạch để xe tự chạy tới và dừng đúng chỗ.',
  vua: 'Vô-lăng nhẹ và tự trả về giữa khi buông tay, xe tự giữ dốc và không cho chạy quá tốc độ; vẫn phải tự canh đường.',
  that: 'Như xe thật: vô-lăng giữ nguyên góc khi buông tay, không có trợ giúp.',
};
/** Thao tác cần làm ngay (để giao diện nhấp nháy đúng nút). */
export interface AssistNeed { left: boolean; right: boolean; hazard: boolean; belt: boolean; hand: boolean; gear: Input['gear'] | null; stop: boolean }

export class ExamAssist {
  level: AssistLevel;
  /** Đích người chơi vừa chạm (toạ độ sân): xe tự chạy thẳng tới rồi dừng. */
  goal: { x: number; y: number } | null = null;
  ref: Input | null = null; need: AssistNeed = { left: false, right: false, hazard: false, belt: false, hand: false, gear: null, stop: false };
  /** Số lần trợ lái tự về số (để báo lên giao diện). */
  shifted = 0;
  private goalHold = 0; private stall = 0;
  constructor(level: AssistLevel = 'de') { this.level = level; }

  /** `raw`: thao tác người chơi (steer là góc vô-lăng −1..1); `nudge`: đang giữ ◀ (+1) hay ▶ (−1); `dragging`: đang kéo vô-lăng. */
  apply(sim: ExamSim, raw: Input, nudge: number, dragging: boolean, dt: number): Input {
    const L = this.level, s = sim.c.spec;
    // vô-lăng
    if (L === 'that') { if (nudge) raw.steer = clamp(raw.steer + nudge * dt * 1.6, -1, 1); }
    else {
      if (nudge) raw.steer = clamp(raw.steer + nudge * dt * (L === 'de' ? 1.1 : 1.0), -1, 1);
      else if (!dragging) raw.steer -= raw.steer * Math.min(1, dt * (L === 'de' ? 2.5 : 1.1)); // tự trả lái khi buông tay
    }
    const ref = L === 'that' ? null : sim.autoInput(dt); this.ref = ref;
    const out: Input = { ...raw };
    if (L === 'that' || !ref) { out.steer = raw.steer; this.need = needOf(sim, raw, null); return out; }
    const dz = Math.abs(raw.steer) < 0.05 ? 0 : raw.steer;
    out.steer = L === 'de' ? clamp(ref.steer + dz * 0.55, -1, 1) : dz;
    // Dễ: xe tự về số theo đường mẫu khi đã dừng hẳn
    if (L === 'de' && raw.gear !== 'P' && Math.abs(sim.v) < 0.05 && ref.gear !== raw.gear && ref.gear !== 'P') { raw.gear = out.gear = ref.gear; this.shifted++; }
    // chạm đích: tự chạy tới rồi dừng
    if (this.goal) {
      if (raw.gas > 0.05 || raw.brake > 0.05) this.goal = null;
      else {
        const dir = out.gear === 'R' ? -1 : 1, F = dir > 0 ? sim.front : { x: sim.x, y: sim.y }, al = ((this.goal.x - F.x) * Math.cos(sim.th) + (this.goal.y - F.y) * Math.sin(sim.th)) * dir;
        const vt = Math.min(dir > 0 ? 2.6 : 1.0, Math.sqrt(2 * 0.9 * Math.max(0, al - 0.12))), sp = sim.v * dir;
        if (al <= 0.12 || vt < 0.05) { out.gas = 0; out.brake = 1; if (Math.abs(sim.v) < 0.05) { this.goalHold += dt; if (this.goalHold > 0.6) { this.goal = null; this.goalHold = 0; } } }
        else {
          const up = Math.max(0, slopeX(sim.c, sim.x + Math.cos(sim.th) * s.wb / 2, sim.y) * 9.81 * Math.cos(sim.th) * dir / 2.4), e = vt - sp;
          out.gas = e > 0 ? clamp(e * 1.4 + 0.15 + up, 0, 1) : 0; out.brake = e < -0.3 ? clamp(-e * 0.6, 0, 1) : 0;
          this.stall = Math.abs(sim.v) < 0.03 ? this.stall + dt : 0; if (this.stall > 1.5) { this.goal = null; this.stall = 0; } // kẹt (đã dừng gần đích): thôi
        }
      }
    }
    // giữ tốc độ vừa phải: không quá giới hạn sân, chậm lại khi đánh lái nhiều; Dễ thì theo tốc độ đường mẫu
    const sp = Math.abs(sim.v);
    if (sim.item !== 9 && sim.kmh > s.limitKmh - 1.5) out.gas = 0;
    if (Math.abs(out.steer) > 0.5 && sp > 2.2) out.gas = Math.min(out.gas, 0.15);
    if (L === 'de' && !this.goal) { // theo tốc độ đường mẫu: tự hãm trước vạch dừng, đèn đỏ, khi lùi ghép xe
      if (sp > sim.refV + 0.2) out.gas = 0;
      if (sp > sim.refV + 0.5 || (sim.refV === 0 && sp > 0.04)) out.brake = Math.max(out.brake, sim.refV === 0 ? 1 : 0.5);
      if (sim.refV === 0) out.gas = 0;
    }
    if (out.gear === 'R' && sp > 1.4) out.gas = 0;
    // giữ dốc: chưa đạp ga thì xe không trôi
    const slope = slopeX(sim.c, sim.x + Math.cos(sim.th) * s.wb / 2, sim.y + Math.sin(sim.th) * s.wb / 2);
    if (slope !== 0 && out.gas < 0.05 && sp < 0.3) out.brake = Math.max(out.brake, 1);
    this.need = needOf(sim, raw, ref);
    return out;
  }
  /** Chạm vào sân ở điểm (x, y): đặt đích nếu điểm ở phía trước (hoặc phía sau khi đang lùi) và không quá xa. */
  setGoal(sim: ExamSim, x: number, y: number): boolean {
    if (this.level === 'that') return false;
    const F = sim.front, al = (x - F.x) * Math.cos(sim.th) + (y - F.y) * Math.sin(sim.th), lat = -(x - F.x) * Math.sin(sim.th) + (y - F.y) * Math.cos(sim.th);
    const back = sim.input.gear === 'R', alB = (x - sim.x) * Math.cos(sim.th) + (y - sim.y) * Math.sin(sim.th);
    if (back ? alB < -0.3 && alB > -12 : al > 0.3 && al < 45 && Math.abs(lat) < 10) { this.goal = { x, y }; this.goalHold = 0; return true; }
    return false;
  }
}
function needOf(sim: ExamSim, raw: Input, ref: Input | null): AssistNeed {
  const m = sim.c.marks, F = sim.front, sNear = sim.autoState() ? sim.c.pieces[sim.autoState()!.i].s0 + sim.autoState()!.d : 0;
  return {
    belt: !raw.belt, hand: raw.hand && raw.gear !== 'P', gear: ref && ref.gear !== raw.gear ? ref.gear : raw.gear === 'P' ? 'D' : null,
    left: !!ref?.left && !raw.left, right: !!ref?.right && !raw.right, hazard: !!sim.danger && !raw.hazard,
    stop: !!ref && ref.brake >= 1 && Math.abs(sim.v) > 0.05 && !sim.danger && sNear > m.start.s && F.x > -1e9,
  };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
