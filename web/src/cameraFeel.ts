// Cảm giác điều khiển góc nhìn dùng chung cho mọi cảnh (làng, hoạt cảnh trò chơi, tham quan).
// Người chơi phàn nàn góc quay "quá nhạy, dễ lệch": độ nhạy cũ khoảng 0,006–0,008 rad mỗi điểm ảnh, không có vùng chết,
// thả tay là đứng yên ở góc lệch. Bộ số dưới đây: độ nhạy còn khoảng một nửa, chạm nhầm dưới 6 điểm ảnh không xoay,
// thả tay thì trôi nhẹ rồi dừng, để yên một lúc thì tự về hướng mặc định (sau lưng nhân vật / hướng nhìn của cabin).
import type * as THREE from 'three';

export const CAMERA_FEEL = {
  /** Xoay ngang (rad) cho mỗi điểm ảnh kéo. */
  yawPerPx: 0.0034,
  /** Xoay dọc (rad) cho mỗi điểm ảnh kéo — chậm hơn ngang để khó lệch chân trời. */
  pitchPerPx: 0.0024,
  /** Kéo dưới ngần này (điểm ảnh) coi như chạm, không xoay. */
  deadzonePx: 6,
  /** Quán tính sau khi thả tay: hằng số tắt dần (giây). */
  inertiaTau: 0.18,
  /** Thả tay bao lâu (giây) thì bắt đầu tự về hướng mặc định. */
  returnDelay: 1.6,
  /** Tốc độ tự về (1/giây, càng lớn về càng nhanh). */
  returnRate: 2.2,
  /** Giới hạn lệch khi nhìn quanh từ ghế ngồi (rad). */
  maxYaw: 1.9, maxPitchUp: 0.6, maxPitchDown: 0.75,
  /** Cần điều khiển đi bộ ở làng: kéo bao xa (điểm ảnh) thì chạy hết tốc, và đường cong đáp ứng (>1 = mịn ở giữa). */
  stickFullPx: 72, stickCurve: 1.35, stickDeadPx: 10,
} as const;

/** Trạng thái kéo để nhìn quanh: gắn vào một phần tử, đọc yaw/pitch lệch mỗi khung qua update(dt). */
export class LookDrag {
  yaw = 0; pitch = 0;
  private vy = 0; private vp = 0; private idle = 99; private ptr: { id: number; x: number; y: number; on: boolean } | null = null;
  private off: (() => void)[] = [];
  /** limited = true: kẹp theo maxYaw/maxPitch và tự về 0; false: xoay tự do (quay quanh cảnh), không tự về. */
  constructor(el: HTMLElement, public limited = true, private feel = CAMERA_FEEL) {
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void) => { el.addEventListener(t, f as EventListener); this.off.push(() => el.removeEventListener(t, f as EventListener)); };
    on('pointerdown', (e) => { if (this.ptr) return; this.ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false }; this.vy = this.vp = 0; try { el.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } });
    on('pointermove', (e) => {
      const p = this.ptr; if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!p.on) { if (Math.hypot(dx, dy) < this.feel.deadzonePx) return; p.on = true; p.x = e.clientX; p.y = e.clientY; return; }
      p.x = e.clientX; p.y = e.clientY;
      const a = -dx * this.feel.yawPerPx, b = -dy * this.feel.pitchPerPx;
      this.add(a, b); this.vy = a * 60; this.vp = b * 60; this.idle = 0;
    });
    const end = (e: PointerEvent) => { if (this.ptr?.id === e.pointerId) this.ptr = null; };
    on('pointerup', end); on('pointercancel', end);
  }
  get dragging(): boolean { return !!this.ptr?.on; }
  private add(a: number, b: number) {
    this.yaw += a; this.pitch += b;
    if (this.limited) this.yaw = Math.max(-this.feel.maxYaw, Math.min(this.feel.maxYaw, this.yaw));
    this.pitch = Math.max(-this.feel.maxPitchDown, Math.min(this.feel.maxPitchUp, this.pitch));
  }
  /** Gọi mỗi khung với dt (giây): quán tính sau khi thả, rồi tự về 0 nếu limited. */
  update(dt: number) {
    if (this.dragging) return;
    if (Math.abs(this.vy) + Math.abs(this.vp) > 1e-3) { const k = Math.exp(-dt / this.feel.inertiaTau); this.add(this.vy * dt, this.vp * dt); this.vy *= k; this.vp *= k; }
    this.idle += dt;
    if (this.limited && this.idle > this.feel.returnDelay) { const k = 1 - Math.exp(-dt * this.feel.returnRate); this.yaw -= this.yaw * k; this.pitch -= this.pitch * k; }
  }
  reset() { this.yaw = this.pitch = this.vy = this.vp = 0; this.idle = 99; }
  dispose() { for (const f of this.off) f(); this.off = []; }
}

/** Làm mượt vị trí và hướng máy ảnh khi đổi góc nhìn: hoà từ ảnh chụp trạng thái cũ sang trạng thái mới trong `sec` giây. */
export class CamBlend {
  private from: { p: THREE.Vector3; q: THREE.Quaternion } | null = null; private t = 1; private sec = 0.6;
  start(cam: THREE.Camera, sec = 0.6) { this.from = { p: cam.position.clone(), q: cam.quaternion.clone() }; this.t = 0; this.sec = sec; }
  /** Gọi sau khi đặt camera về đích của khung này. */
  apply(cam: THREE.Camera, dt: number) {
    if (!this.from || this.t >= 1) return;
    this.t = Math.min(1, this.t + dt / this.sec); const k = this.t * this.t * (3 - 2 * this.t);
    const to = cam.quaternion.clone(); cam.position.lerpVectors(this.from.p, cam.position.clone(), k); cam.quaternion.slerpQuaternions(this.from.q, to, k);
  }
}
