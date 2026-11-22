// Giữ cho mọi cảnh 3D chạy mượt trên điện thoại, máy tính bảng:
//  1. Ngân sách điểm ảnh: không vẽ nhiều điểm ảnh hơn mức máy kham nổi (iPad DPR 2 dễ lên cả chục triệu điểm).
//  2. Tự thích nghi: khung hình chậm thì hạ một bậc chất lượng, ổn định lâu thì nâng lại (có trễ để không dao động).
//  3. Chỉ cảnh trên cùng được vẽ: cảnh bị hoạt cảnh khác che kín thì nghỉ hẳn; tab ẩn cũng nghỉ.
//  4. Ô đo ?fps=1 (hoặc localStorage vv-fps=1) và window.__perf để người chơi chụp gửi lại.
import type { WebGLRenderer } from 'three';

export type QualityPref = 'thap' | 'vua' | 'cao' | 'tu_dong';
/** Bậc chất lượng: 0 cao nhất … 3 thấp nhất. */
export type QualityLevel = 0 | 1 | 2 | 3;
export interface PerfStats { name: string; fps: number; ms: number; level: QualityLevel; pref: QualityPref; pixelRatio: number; pixels: number; calls: number; triangles: number; width: number; height: number; locked: boolean }

const SCALE = [1, 0.85, 0.7, 0.6] as const;
const PREF_KEY = 'vv-quality', LEVEL_KEY = 'vv-quality-level', FPS_KEY = 'vv-fps';
const SLOW_MS = 22, FAST_MS = 17.6; // 60 Hz chạy trọn là 16,7 ms mỗi khung: dưới 17,6 coi như đủ mượt
const LS = { get(k: string) { try { return localStorage.getItem(k); } catch { return null; } }, set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } } };

const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
const UA = nav.userAgent ?? '';
/** Điện thoại, máy tính bảng (kể cả iPad tự xưng là Macintosh). */
export const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(UA) || (/Macintosh/i.test(UA) && (nav.maxTouchPoints ?? 0) > 1) || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && (nav.maxTouchPoints ?? 0) > 0);
/** Chạy dưới bộ kiểm tự động: giữ nguyên bậc cao để ảnh chụp ổn định (máy thử không có GPU nên lúc nào cũng "chậm"). */
const AUTOMATED = !!(nav as Navigator & { webdriver?: boolean }).webdriver && LS.get('vv-quality-auto') !== '1'; // vv-quality-auto=1: thử cơ chế tự thích nghi ngay cả khi chạy tự động
/** Số điểm ảnh tối đa mỗi khung. */
const BUDGET = IS_MOBILE ? 1_400_000 : (nav.hardwareConcurrency ?? 4) >= 8 ? 5_000_000 : 3_000_000;
const DPR_CAP = 2;

export function qualityPref(): QualityPref { const v = LS.get(PREF_KEY); return v === 'thap' || v === 'vua' || v === 'cao' ? v : 'tu_dong'; }
/** Người chơi tự chọn mức đồ hoạ (để gắn vào Hồ sơ): 'thap' | 'vua' | 'cao' | 'tu_dong'. Áp ngay cho cảnh đang chạy. */
export function setQualityPref(p: QualityPref) { LS.set(PREF_KEY, p); for (const q of stack) q.applyPref(); }
const fixedLevel = (p: QualityPref): QualityLevel | null => (p === 'thap' ? 3 : p === 'vua' ? 1 : p === 'cao' ? 0 : null);
function startLevel(): QualityLevel { const f = fixedLevel(qualityPref()); if (f !== null) return f; if (AUTOMATED) return 0; const n = Number(LS.get(LEVEL_KEY)); return (n >= 0 && n <= 3 ? Math.round(n) : 0) as QualityLevel; }

/** Tỉ lệ điểm ảnh cho một khung cỡ w×h (px CSS) ở bậc cho trước. */
export function pixelRatioFor(w: number, h: number, level: QualityLevel = 0): number {
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, DPR_CAP);
  const fit = Math.sqrt(BUDGET / Math.max(1, w * h));
  return Math.max(0.5, Math.min(dpr, fit) * SCALE[level]);
}
/** Tham số tạo WebGLRenderer: mật độ điểm ảnh đã cao thì bỏ khử răng cưa MSAA (đắt mà khó thấy khác). */
export function rendererParams(host?: HTMLElement | null): { antialias: boolean; powerPreference: 'high-performance' } {
  const w = host?.clientWidth || (typeof innerWidth !== 'undefined' ? innerWidth : 1280), h = host?.clientHeight || (typeof innerHeight !== 'undefined' ? innerHeight : 720);
  return { antialias: !(IS_MOBILE && pixelRatioFor(w, h, startLevel()) >= 1.9), powerPreference: 'high-performance' };
}
/** Cỡ bản đồ bóng đổ nên dùng. */
export const SHADOW_MAP = IS_MOBILE ? 1024 : 2048;

const stack: Quality[] = [];
let box: HTMLDivElement | null = null;
const wantBox = () => { try { return new URLSearchParams(location.search).get('fps') === '1' || LS.get(FPS_KEY) === '1'; } catch { return false; } };

export interface QualityOptions {
  /** Tên cảnh, hiện trong ô đo. */
  name: string;
  /** Gọi khi bậc đổi (và một lần lúc khởi tạo): cảnh tự tắt bóng, kéo sương gần lại, bớt hạt… */
  onLevel?: (level: QualityLevel) => void;
}

export class Quality {
  level: QualityLevel;
  private w = 1; private h = 1; private ratio = 1;
  private last = 0; private acc = 0; private n = 0; private avg = 16.7;
  private calm = 0;          // số giây liên tục mượt
  private hold = 0;          // thời điểm sớm nhất được đổi bậc tiếp
  private raisedAt = 0;      // lần nâng bậc gần nhất
  private backoff = 6;       // phải mượt bao nhiêu giây mới nâng; nâng hụt thì gấp đôi
  private shown = 0; private disposed = false;
  private half = false; private halfUntil = 0; private skip = false;
  /** Lần tick vừa rồi trả false vì đang chủ động chạy nửa nhịp (30 khung/giây) chứ không phải vì cảnh bị che: cảnh KHÔNG được bỏ thời gian đã trôi. */
  throttled = false;
  private renderer: WebGLRenderer; private opts: QualityOptions;

  constructor(renderer: WebGLRenderer, opts: QualityOptions) {
    this.renderer = renderer; this.opts = opts; this.level = startLevel();
    stack.push(this);
    (window as unknown as { __perf?: () => PerfStats | null }).__perf = () => stack[stack.length - 1]?.stats() ?? null;
    this.opts.onLevel?.(this.level);
    // iOS hay thu hồi ngữ cảnh đồ hoạ khi chuyển ứng dụng: three.js tự nạp lại tài nguyên, ở đây đặt lại cỡ khung và bóng đổ để không còn màn đen.
    renderer.domElement.addEventListener('webglcontextrestored', () => { if (this.disposed) return; this.last = 0; this.apply(); renderer.shadowMap.needsUpdate = true; this.opts.onLevel?.(this.level); });
  }

  /** Cảnh này có đang là cảnh trên cùng không (cảnh bị che thì đừng vẽ). */
  get active() { return stack[stack.length - 1] === this && !(typeof document !== 'undefined' && document.hidden); }
  get locked() { return AUTOMATED || fixedLevel(qualityPref()) !== null; }
  get pixelRatio() { return this.ratio; }

  /** Gọi mỗi khi khung chứa đổi cỡ: đặt tỉ lệ điểm ảnh theo ngân sách rồi đặt cỡ canvas. */
  resize(w: number, h: number) { this.w = Math.max(1, w); this.h = Math.max(1, h); this.apply(); }
  private apply() {
    this.ratio = pixelRatioFor(this.w, this.h, this.level);
    this.renderer.setPixelRatio(this.ratio); this.renderer.setSize(this.w, this.h, false);
  }
  applyPref() { const f = fixedLevel(qualityPref()); if (f !== null && f !== this.level) this.setLevel(f); }
  private setLevel(l: QualityLevel) {
    if (l === this.level) return;
    this.level = l; this.apply(); this.opts.onLevel?.(l);
    if (!this.locked) LS.set(LEVEL_KEY, String(l));
  }

  /** Gọi ở đầu mỗi khung hình. Trả false nếu cảnh đang bị che hoặc tab ẩn: bỏ qua khung này. */
  tick(now = performance.now()): boolean {
    if (this.disposed) return false;
    this.throttled = false;
    if (!this.active) { this.last = 0; return false; }
    // Máy không giữ nổi nhịp nhanh dù đã ở bậc thấp nhất: chạy đều 30 khung/giây (khung đều dễ chịu hơn khung giật).
    if (this.half) { if (now > this.halfUntil) { this.half = false; this.skip = false; } else { this.skip = !this.skip; if (this.skip) { this.throttled = true; return false; } } }
    const dt = this.last ? now - this.last : 0; this.last = now;
    if (dt > 0 && dt < 1000) { // khung dài cả giây là do chuyển tab, nạp cảnh: không tính
      this.acc += dt; this.n++;
      if (this.acc >= 1000 && this.n >= 3) {
        this.avg = this.acc / this.n; this.acc = 0; this.n = 0;
        if (!this.locked) this.adapt(now);
        if (wantBox()) this.paint();
      }
    }
    return true;
  }
  private adapt(now: number) {
    if (this.avg > SLOW_MS) {
      this.calm = 0;
      if (this.level === 3 && !this.half && this.avg < 60 && now >= this.hold) { this.half = true; this.halfUntil = now + 30_000; this.hold = now + 2000; }
      if (now >= this.hold && this.level < 3) {
        // vừa nâng xong đã chậm lại: mức đó quá sức máy, lần sau phải mượt lâu gấp đôi mới thử nâng
        if (this.raisedAt && now - this.raisedAt < 12_000) this.backoff = Math.min(600, this.backoff * 2.5);
        this.setLevel((this.level + 1) as QualityLevel); this.hold = now + 1500;
      }
    } else if (this.avg < FAST_MS) {
      this.calm++;
      if (this.calm >= this.backoff && now >= this.hold && this.level > 0) { this.setLevel((this.level - 1) as QualityLevel); this.raisedAt = now; this.hold = now + 3000; this.calm = 0; }
    } else this.calm = Math.max(0, this.calm - 1);
  }

  stats(): PerfStats {
    const i = this.renderer.info.render;
    return { name: this.opts.name, fps: Math.round(1000 / this.avg), ms: Math.round(this.avg * 10) / 10, level: this.level, pref: qualityPref(), pixelRatio: Math.round(this.ratio * 100) / 100, pixels: Math.round(this.w * this.h * this.ratio * this.ratio), calls: i.calls, triangles: i.triangles, width: this.w, height: this.h, locked: this.locked };
  }
  private paint() {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:calc(4px + env(safe-area-inset-left));top:calc(4px + env(safe-area-inset-top));z-index:99999;font:600 11px/1.25 ui-monospace,Menlo,monospace;color:#d8ffd0;background:#000b;padding:4px 6px;border-radius:6px;pointer-events:none;white-space:pre';
      document.body.appendChild(box);
    }
    const s = this.stats(); if (s.fps === this.shown && box.textContent) return; this.shown = s.fps;
    box.textContent = `${s.name} ${s.fps} fps ${s.ms} ms\nbậc ${s.level}${s.locked ? ' (cố định)' : ''}${this.half ? ' · nhịp 30' : ''} · x${s.pixelRatio} · ${(s.pixels / 1e6).toFixed(2)} Mpx\n${s.calls} lần vẽ · ${Math.round(s.triangles / 1000)}k tam giác`;
  }

  dispose() {
    this.disposed = true; const i = stack.indexOf(this); if (i >= 0) stack.splice(i, 1);
    if (!stack.length && box) { box.remove(); box = null; }
  }
}

/** Để soi cảnh khi gỡ lỗi hiệu năng: window.__scene là cảnh vừa dựng gần nhất. */
export function debugScene(scene: unknown) { (window as unknown as { __scene?: unknown }).__scene = scene; }
