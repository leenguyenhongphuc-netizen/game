// Nhịp gửi vị trí của mình và nhận người cùng cảnh (làng, cao tốc, trạm dừng…) — xem server/src/social.ts.
// Không có WebSocket (Vercel serverless): gửi một yêu cầu vài giây một lần, máy chủ báo nhịp tiếp theo;
// ẩn tab thì dừng, mất kết nối/chưa đăng nhập thì lùi dần chứ không báo lỗi lên màn hình.
import * as THREE from 'three';
import type { PresenceIn, PresenceOther, PresenceOut } from '../../shared/social.ts';
import { PRESENCE_INTERVAL } from '../../shared/social.ts';
import { boardCanvas } from './scene/tex.ts';
import type { PublicMsg } from '../../shared/chat.ts';
import { BUBBLE_MS, PUBLIC_LOG_MAX } from '../../shared/chat.ts';

export type { PresenceOther };
export interface PresenceListener { (others: PresenceOther[], at: { server: number; local: number }, out: PresenceOut): void }

/** Đang có bao nhiêu người chơi (kể cả mình) theo lần đếm gần nhất — App có thể hiện ở thanh trên. */
export const presenceStats = { online: 0, lastOk: 0 };
/** Chat công cộng của cảnh đang đứng (web/src/chat/**): khoá cảnh, nhật ký tin, người quanh đây; về cùng nhịp hiện diện. */
export const chatStore = {
  where: null as { scene: PresenceIn['scene']; key: string } | null,
  lastId: 0, log: [] as PublicMsg[], near: [] as PresenceOther[], seenAt: 0,
  subs: new Set<() => void>(),
  emit() { for (const f of this.subs) f(); },
  /** Tin vừa gửi: thêm ngay vào nhật ký, nhịp sau máy chủ trả lại thì bỏ trùng theo mã. */
  push(m: PublicMsg) { if (!this.log.some((x) => x.id === m.id)) { this.log = [...this.log, m].slice(-PUBLIC_LOG_MAX); this.emit(); } },
};
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
    // đổi cảnh thì nhật ký chat làm lại từ đầu
    if (!chatStore.where || chatStore.where.scene !== st.scene || chatStore.where.key !== st.key) { chatStore.where = { scene: st.scene, key: st.key }; chatStore.lastId = 0; chatStore.log = []; chatStore.emit(); }
    const body: PresenceIn = { ...st, count: Date.now() - this.lastCount > 30_000, chatSince: chatStore.lastId };
    try {
      const res = await fetch('/api/presence', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 401 || res.status === 404) { this.fails = 99; throw new Error('khong_dang_nhap'); }
      if (!res.ok) throw new Error(String(res.status));
      const out = (await res.json()) as PresenceOut;
      this.fails = 0; this.sent++; presenceStats.lastOk = Date.now();
      if (typeof out.online === 'number') { presenceStats.online = out.online; this.lastCount = Date.now(); }
      if (!this.stopped) {
        if (out.chat?.length) { const fresh = out.chat.filter((m) => !chatStore.log.some((x) => x.id === m.id)); chatStore.lastId = Math.max(chatStore.lastId, ...out.chat.map((m) => m.id)); if (fresh.length) chatStore.log = [...chatStore.log, ...fresh].slice(-PUBLIC_LOG_MAX); }
        chatStore.near = out.others ?? []; chatStore.seenAt = Date.now(); chatStore.emit();
        this.listener(out.others ?? [], { server: out.at, local: performance.now() }, out);
      }
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
    chatStore.where = null; chatStore.near = []; chatStore.log = []; chatStore.lastId = 0; chatStore.emit();
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

/** Bong bóng chat trên đầu: vẽ chữ xuống dòng trong khung trắng bo tròn có đuôi. */
export function sayBubble(text: string, h = 0.95): THREE.Sprite {
  const c = document.createElement('canvas'), g = c.getContext('2d')!, W = 512, pad = 26, font = '600 34px "Baloo 2", system-ui, sans-serif';
  g.font = font;
  const lines: string[] = []; let cur = '';
  for (const w of text.split(/\s+/)) { const t = cur ? `${cur} ${w}` : w; if (g.measureText(t).width > W - pad * 2 && cur) { lines.push(cur); cur = w; } else cur = t; if (lines.length >= 3) break; }
  if (cur && lines.length < 3) lines.push(cur);
  const lw = Math.min(W - pad * 2, Math.max(60, ...lines.map((l) => g.measureText(l).width))), bw = lw + pad * 2, bh = lines.length * 42 + pad * 1.4, tail = 22;
  c.width = Math.ceil(bw) + 8; c.height = Math.ceil(bh + tail) + 8;
  g.font = font; g.fillStyle = 'rgba(255,255,255,0.96)'; g.strokeStyle = 'rgba(90,60,30,0.35)'; g.lineWidth = 3;
  const x0 = 4, y0 = 4, r = 22;
  g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + bw, y0, x0 + bw, y0 + bh, r); g.arcTo(x0 + bw, y0 + bh, x0, y0 + bh, r);
  g.lineTo(x0 + bw / 2 + 14, y0 + bh); g.lineTo(x0 + bw / 2, y0 + bh + tail); g.lineTo(x0 + bw / 2 - 14, y0 + bh);
  g.arcTo(x0, y0 + bh, x0, y0, r); g.arcTo(x0, y0, x0 + bw, y0, r); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#3b2a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, x0 + bw / 2, y0 + pad * 0.7 + 21 + i * 42));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(h * (c.width / c.height), h, 1); sp.renderOrder = 9; sp.center.set(0.5, 0);
  return sp;
}
/** Gắn/gỡ bong bóng chat của một người khác lên vật chứa (thân người, xe). y: độ cao gốc bong bóng theo toạ độ của vật chứa; k: tỉ lệ vật chứa. */
export function syncSay(holder: THREE.Object3D, o: PresenceOther, y: number, k = 1, h = 0.95) {
  const ud = holder.userData as { sayId?: number; saySp?: THREE.Sprite; sayUntil?: number };
  const want = o.say && !o.bot ? o.say : null;
  if (want && want.id !== ud.sayId) {
    if (ud.saySp) { holder.remove(ud.saySp); disposeTag(ud.saySp); }
    const sp = sayBubble(want.text, h); sp.position.y = y / k; sp.scale.multiplyScalar(1 / k); holder.add(sp);
    ud.sayId = want.id; ud.saySp = sp; ud.sayUntil = Date.now() + BUBBLE_MS;
  }
  if (ud.saySp && (Date.now() > (ud.sayUntil ?? 0))) { holder.remove(ud.saySp); disposeTag(ud.saySp); ud.saySp = undefined; }
}
/** Gỡ bong bóng khi bỏ vật chứa. */
export function dropSay(holder: THREE.Object3D) { const ud = holder.userData as { saySp?: THREE.Sprite }; if (ud.saySp) { holder.remove(ud.saySp); disposeTag(ud.saySp); ud.saySp = undefined; } }
