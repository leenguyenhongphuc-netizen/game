// Giữ cho mọi cảnh 3D chạy mượt trên điện thoại, máy tính bảng:
//  1. Ngân sách điểm ảnh: không vẽ nhiều điểm ảnh hơn mức máy kham nổi (iPad DPR 2 dễ lên cả chục triệu điểm).
//  2. Tự thích nghi: khung hình chậm thì hạ một bậc chất lượng, ổn định lâu thì nâng lại (có trễ để không dao động).
//  3. Chỉ cảnh trên cùng được vẽ: cảnh bị hoạt cảnh khác che kín thì nghỉ hẳn; tab ẩn cũng nghỉ.
//  4. Ô đo ?fps=1 (hoặc localStorage vv-fps=1) và window.__perf để người chơi chụp gửi lại.
import type { WebGLRenderer } from 'three';

export type QualityPref = 'thap' | 'vua' | 'cao' | 'tu_dong';
/** Bậc chất lượng: 0 cao nhất … 3 thấp nhất. */
export type QualityLevel = 0 | 1 | 2 | 3;
export interface PerfStats { jitter: number; late: number; levelChanges: number; pace30: boolean; name: string; fps: number; ms: number; level: QualityLevel; pref: QualityPref; pixelRatio: number; pixels: number; calls: number; triangles: number; width: number; height: number; locked: boolean }

const SCALE = [1, 0.85, 0.7, 0.6] as const;
// Khoá v2: bản trước lưu nhầm bậc thấp và nhịp 30 cho cả máy khoẻ (phản ứng với khung trễ lúc đang tải) nên bỏ hẳn các khoá cũ.
const PREF_KEY = 'vv-quality', LEVEL_KEY = 'vv-q2-level', FPS_KEY = 'vv-fps';
const LS = { get(k: string) { try { return localStorage.getItem(k); } catch { return null; } }, set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } } };

try { for (const k of ['vv-quality-level', 'vv-quality-level-at', 'vv-pace30']) localStorage.removeItem(k); } catch { /* bỏ qua */ }

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
function startLevel(): QualityLevel { const f = fixedLevel(qualityPref()); if (f !== null) return f; if (AUTOMATED) return 0; let n = Number(LS.get(LEVEL_KEY)); n = n >= 0 && n <= 3 ? Math.round(n) : 0; if (n > 0 && Date.now() - Number(LS.get(LEVEL_KEY + '-at') ?? 0) > 86_400_000) { n--; LS.set(LEVEL_KEY, String(n)); LS.set(LEVEL_KEY + '-at', String(Date.now())); } return n as QualityLevel; }

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

/** Nhịp vẽ chung của máy trong phiên này: 0 = theo màn hình, 30 = đều 30 khung/giây. Chốt một lần, không bật tắt qua lại. */
let pace30 = false, levelChanges = 0;
/** Người chơi đã chạm/bấm chưa: trước đó máy còn đang tải, dựng cảnh nên không lấy số đo làm căn cứ hạ nhịp. */
let interacted = false;
if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, () => { interacted = true; }, { passive: true, capture: true });
/** Dùng cho phép thử: đặt lại trạng thái chung của bộ điều tiết. */
export function __resetGovernor(opts: { interacted?: boolean } = {}) { pace30 = false; levelChanges = 0; interacted = !!opts.interacted; }
const fake = () => (window as unknown as { __fakeDt?: number[] }).__fakeDt;
let fakeI = 0;
/** Bước thời gian (giây) cho mô phỏng: thời gian thật kẹp 1–100 ms. Khi thử, window.__fakeDt = [16, 33, 50] ép nhịp không đều để soát chuyển động có đều theo thời gian không. */
export function stepDt(realSeconds: number): number {
  const f = fake(); if (f && f.length) return f[fakeI++ % f.length] / 1000;
  return Math.min(0.1, Math.max(0.001, realSeconds));
}
/** Hệ số làm mượt không phụ thuộc số khung: rate60 là phần tiến lại mỗi khung ở 60 khung/giây. */
export function ease(rate60: number, dt: number): number { return 1 - Math.pow(1 - rate60, dt * 60); }
/** Ghi vết từng khung khi window.__trace là một mảng (để đo độ đều của chuyển động). */
export function trace(rec: Record<string, number>) { const t = (window as unknown as { __trace?: Record<string, number>[] }).__trace; if (t && t.length < 20000) t.push(rec); }

export class Quality {
  level: QualityLevel;
  private w = 1; private h = 1; private ratio = 1;
  private last = 0; private acc = 0; private n = 0; private avg = 16.7;
  private late = 0; private sq = 0; private jitter = 0; private lateShown = 0;
  private base = 16.7;       // chu kỳ làm tươi ước lượng của màn hình (ms)
  private lows: number[] = [];
  private age = 0;           // số ms cảnh đã thật sự chạy
  private bad = 0;           // số giây liên tiếp bị chậm
  private crawl = 0;         // số giây liên tiếp dưới 40 khung/giây ở bậc thấp nhất
  private shown = ''; private disposed = false;
  /** Cảnh báo cho biết nhân vật/xe đang di chuyển: không đổi cỡ bộ đệm lúc này (đổi cỡ gây khựng thấy rõ). */
  busy = false;
  /** Lần tick vừa rồi trả false vì đang chủ động giữ nhịp 30 khung/giây chứ không phải vì cảnh bị che: cảnh KHÔNG được bỏ thời gian đã trôi. */
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
  get half() { return pace30; }

  /** Gọi mỗi khi khung chứa đổi cỡ: đặt tỉ lệ điểm ảnh theo ngân sách rồi đặt cỡ canvas. */
  resize(w: number, h: number) { this.w = Math.max(1, w); this.h = Math.max(1, h); this.apply(); }
  private apply() {
    this.ratio = pixelRatioFor(this.w, this.h, this.level);
    this.renderer.setPixelRatio(this.ratio); this.renderer.setSize(this.w, this.h, false);
  }
  applyPref() { const f = fixedLevel(qualityPref()); if (f !== null && f !== this.level) this.setLevel(f); }
  private setLevel(l: QualityLevel) {
    if (l === this.level) return;
    this.level = l; levelChanges++; this.apply(); this.opts.onLevel?.(l);
    if (!this.locked) { LS.set(LEVEL_KEY, String(l)); LS.set(LEVEL_KEY + '-at', String(Date.now())); }
  }

  /** Gọi ở đầu mỗi khung hình. Trả false nếu cảnh đang bị che, tab ẩn, hoặc đang giữ nhịp 30: bỏ qua khung này. */
  tick(now = performance.now()): boolean {
    if (this.disposed) return false;
    this.throttled = false;
    if (!this.active) { this.last = 0; return false; }
    // Nhịp 30 đều: chỉ vẽ khi đã cách khung trước gần 2 chu kỳ màn hình (tính theo thời gian nên đúng cả với màn 120 Hz).
    if (pace30 && !fake() && this.last && now - this.last < 33.3 - this.base * 0.45) { this.throttled = true; return false; }
    const dt = this.last ? now - this.last : 0; this.last = now;
    if (dt > 0 && dt < 1000) { // khung dài cả giây là do chuyển tab, nạp cảnh: không tính
      this.age += dt;
      if (this.lows.length < 40 && this.age > 300) { this.lows.push(dt); if (this.lows.length === 40) { const q = [...this.lows].sort((a, b) => a - b)[8]; this.base = q < 10 ? 8.33 : q < 13 ? 11.1 : 16.7; } }
      const target = pace30 ? 33.3 : Math.max(this.base, 16.7); // trình duyệt di động vẽ tối đa 60 khung/giây
      this.acc += dt; this.n++; this.sq += dt * dt; if (dt > target * 1.45) this.late++;
      if (this.acc >= 1000 && this.n >= 3) {
        this.avg = this.acc / this.n; this.jitter = Math.sqrt(Math.max(0, this.sq / this.n - this.avg * this.avg));
        const lateRatio = this.late / this.n; this.lateShown = this.late;
        this.acc = 0; this.n = 0; this.sq = 0; this.late = 0;
        if (!this.locked) this.adapt(lateRatio, target);
        if (wantBox()) this.paint();
      }
    }
    return true;
  }
  /**
   * Chỉ can thiệp khi máy THẬT SỰ không kham nổi, và không bao giờ vì vài khung trễ lẻ:
   *  - 3 giây đầu của cảnh (tải tài nguyên, biên dịch shader, dựng hàng xóm) không tính.
   *  - "Chậm" là trung bình cả giây dưới ~48 khung/giây (khung trễ đơn lẻ do GC, tải ảnh không làm đổi trung bình là bao).
   *  - Chậm 2 giây liền thì hạ MỘT bậc chất lượng (tỉ lệ điểm ảnh, bóng); đang di chuyển thì chờ tới 4 giây mới đổi cỡ bộ đệm.
   *  - Nhịp 30 là phương án cuối: đã ở bậc thấp nhất, người chơi đã tương tác, và dưới 40 khung/giây suốt 4 giây liền. Chỉ có hiệu lực trong phiên, không lưu lại.
   *  - Không tự nâng bậc trong phiên; hôm sau mới thử lại bậc cao hơn.
   */
  private adapt(lateRatio: number, target: number) {
    if (this.age < 3000) { this.bad = 0; this.crawl = 0; return; }
    void lateRatio;
    const slow = this.avg > target * 1.25;
    this.bad = slow ? this.bad + 1 : 0;
    this.crawl = this.level === 3 && !pace30 && interacted && this.avg > 25 && this.avg < 70 ? this.crawl + 1 : 0;
    if (!slow) return;
    if (this.level < 3) { if (this.bad >= (this.busy ? 4 : 2)) { this.setLevel((this.level + 1) as QualityLevel); this.bad = 0; } }
    else if (this.crawl >= 4) { pace30 = true; this.crawl = 0; }
  }

  stats(): PerfStats {
    const i = this.renderer.info.render;
    return { jitter: Math.round(this.jitter * 10) / 10, late: this.lateShown, levelChanges, pace30, name: this.opts.name, fps: Math.round(1000 / this.avg), ms: Math.round(this.avg * 10) / 10, level: this.level, pref: qualityPref(), pixelRatio: Math.round(this.ratio * 100) / 100, pixels: Math.round(this.w * this.h * this.ratio * this.ratio), calls: i.calls, triangles: i.triangles, width: this.w, height: this.h, locked: this.locked };
  }
  private paint() {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:calc(4px + env(safe-area-inset-left));top:calc(4px + env(safe-area-inset-top));z-index:99999;font:600 11px/1.25 ui-monospace,Menlo,monospace;color:#d8ffd0;background:#000b;padding:4px 6px;border-radius:6px;pointer-events:none;white-space:pre';
      document.body.appendChild(box);
    }
    const s = this.stats();
    box.textContent = `${s.name} ${s.fps} fps ${s.ms} ms\nbậc ${s.level}${s.locked ? ' (cố định)' : ''}${this.half ? ' · nhịp 30' : ''} · x${s.pixelRatio} · ${(s.pixels / 1e6).toFixed(2)} Mpx\n${s.calls} lần vẽ · ${Math.round(s.triangles / 1000)}k tam giác\nđộ đều ±${s.jitter} ms · trễ ${s.late} khung/giây · đổi bậc ${s.levelChanges} lần`; void this.shown;
  }

  dispose() {
    this.disposed = true; const i = stack.indexOf(this); if (i >= 0) stack.splice(i, 1);
    if (!stack.length && box) { box.remove(); box = null; }
  }
}

/** Để soi cảnh khi gỡ lỗi hiệu năng: window.__scene là cảnh vừa dựng gần nhất. */
export function debugScene(scene: unknown) { (window as unknown as { __scene?: unknown }).__scene = scene; }
