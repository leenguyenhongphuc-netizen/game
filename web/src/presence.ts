// Nhịp gửi vị trí của mình và nhận người cùng cảnh (làng, cao tốc, trạm dừng…) — xem server/src/social.ts.
// Không có WebSocket (Vercel serverless): gửi một yêu cầu vài giây một lần, máy chủ báo nhịp tiếp theo;
// ẩn tab thì dừng, mất kết nối/chưa đăng nhập thì lùi dần chứ không báo lỗi lên màn hình.
import * as THREE from 'three';
import type { PresenceIn, PresenceOther, PresenceOut } from '../../shared/social.ts';
import { PRESENCE_INTERVAL } from '../../shared/social.ts';
import { boardCanvas } from './scene/tex.ts';

export type { PresenceOther };
export interface PresenceListener { (others: PresenceOther[], at: { server: number; local: number }, out: PresenceOut): void }

/** Đang có bao nhiêu người chơi (kể cả mình) theo lần đếm gần nhất — App có thể hiện ở thanh trên. */
export const presenceStats = { online: 0, lastOk: 0 };
/** Tắt hẳn (ví dụ trang thử nghiệm không đăng nhập): window.__presenceOff = true. */
const off = () => !!(globalThis as { __presenceOff?: boolean }).__presenceOff;

export class PresenceLink {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false; private busy = false; private fails = 0; private sent = 0; private lastCount = 0;
  private onVis = () => { if (!document.hidden && !this.stopped) this.schedule(200); };
  constructor(private getState: () => PresenceIn | null, private listener: PresenceListener) {
    document.addEventListener('visibilitychange', this.onVis);
    this.schedule(400);
  }
  private schedule(ms: number) { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => void this.beat(), ms); }
  private async beat() {
    this.timer = null;
    if (this.stopped || off()) return;
    if (document.hidden) return; // khi hiện lại tab sẽ gọi lại
    const st = this.getState();
    if (!st || this.busy) { this.schedule(1500); return; }
    this.busy = true;
    const body: PresenceIn = { ...st, count: Date.now() - this.lastCount > 30_000 };
    try {
      const res = await fetch('/api/presence', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 401 || res.status === 404) { this.fails = 99; throw new Error('khong_dang_nhap'); }
      if (!res.ok) throw new Error(String(res.status));
      const out = (await res.json()) as PresenceOut;
      this.fails = 0; this.sent++; presenceStats.lastOk = Date.now();
      if (typeof out.online === 'number') { presenceStats.online = out.online; this.lastCount = Date.now(); }
      if (!this.stopped) this.listener(out.others ?? [], { server: out.at, local: performance.now() }, out);
      this.schedule(Math.max(1500, out.interval || PRESENCE_INTERVAL.busy));
    } catch {
      this.fails++;
      // chưa đăng nhập: thử lại rất thưa; lỗi mạng: lùi dần tới 30 s
      this.schedule(this.fails >= 99 ? 60_000 : Math.min(30_000, 2_000 * 2 ** Math.min(4, this.fails)));
    } finally { this.busy = false; }
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; if (this.timer) clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.onVis);
    if (this.sent > 0 && !off()) fetch('/api/presence/leave', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}', keepalive: true }).catch(() => {});
  }
}

/** Biển tên nổi trên đầu: tên + biểu tượng vai; cư dân ảo dùng nền giấy, người chơi thật nền vàng. */
export function nameTag(o: PresenceOther, h = 0.62): THREE.Sprite {
  const icon = o.role === 'thuong_lai' ? '🚚 ' : o.role === 'xuong' ? '🏭 ' : o.role === 'nong_dan' ? '🌾 ' : '';
  const { canvas, aspect } = boardCanvas(`${icon}${o.name}`, o.bot ? 'paper' : 'gold');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(h * aspect, h, 1); sp.renderOrder = 7;
  return sp;
}
export function disposeTag(sp: THREE.Sprite) { sp.material.map?.dispose(); sp.material.dispose(); }

/** Làm mượt góc quay (đi đường ngắn nhất). */
export function turnTo(cur: number, want: number, k: number) { const d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)); return cur + d * k; }
export const hexOf = (s: string | undefined, fb: number) => (s && /^#[0-9a-f]{6}$/i.test(s) ? parseInt(s.slice(1), 16) : fb);
