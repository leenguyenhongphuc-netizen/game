// Hoạ tiết sinh bằng canvas (không tải ảnh ngoài): cỏ, đường đất, luống đất, bóng mây, biển gỗ.
import * as THREE from 'three';
import { rng } from './plants.ts';

const cache = new Map<string, THREE.CanvasTexture>();
function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void, repeat = true): THREE.CanvasTexture {
  let t = cache.get(key);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!, rng(key.length * 977 + w));
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
const css = (n: number) => '#' + n.toString(16).padStart(6, '0');

/**
 * Lớp vân cỏ nhân với màu đỉnh của mặt đất: nền gần trắng, điểm thêm vệt cỏ sẫm/sáng và đốm đất.
 * Lặp lại được theo cả hai chiều (mọi nét vẽ đều được vẽ thêm bản bọc mép).
 */
export function grassTex(urban = false): THREE.CanvasTexture {
  return make(`grass${urban ? 'U' : ''}`, 256, 256, (g, r) => {
    g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, 256, 256);
    const wrap = (fn: (ox: number, oy: number) => void) => { for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) fn(ox, oy); };
    for (let i = 0; i < 46; i++) { // mảng loang lớn
      const x = r() * 256, y = r() * 256, rad = 18 + r() * 34, dark = r() < 0.55;
      wrap((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gr.addColorStop(0, dark ? 'rgba(190,206,170,0.5)' : 'rgba(255,255,240,0.55)'); gr.addColorStop(1, 'rgba(240,240,236,0)'); g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2); });
    }
    if (urban) { g.strokeStyle = 'rgba(150,150,150,0.35)'; g.lineWidth = 1; for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); } return; }
    for (let i = 0; i < 800; i++) { // ngọn cỏ
      const x = r() * 256, y = r() * 256, l = 2 + r() * 4, a = -Math.PI / 2 + (r() - 0.5) * 0.9, k = r();
      g.strokeStyle = k < 0.5 ? 'rgba(130,170,115,0.3)' : k < 0.85 ? 'rgba(255,255,230,0.38)' : 'rgba(215,210,130,0.3)'; g.lineWidth = 1.4;
      wrap((ox, oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke(); });
    }
  });
}

/** Đường đất: hạt sỏi, hai vệt bánh xe sẫm chạy dọc (theo chiều u), mép mờ dần sang trong suốt. */
export function roadTex(color: number, paved = false): THREE.CanvasTexture {
  return make(`road${color}${paved ? 'P' : ''}`, 256, 128, (g, r) => {
    const base = new THREE.Color(color);
    g.fillStyle = css(color); g.fillRect(0, 0, 256, 128);
    const tone = (k: number, a: number) => { const c = base.clone().multiplyScalar(k); return `rgba(${Math.round(Math.min(1, c.r) * 255)},${Math.round(Math.min(1, c.g) * 255)},${Math.round(Math.min(1, c.b) * 255)},${a})`; };
    if (paved) {
      g.fillStyle = tone(0.96, 0.6); for (let i = 0; i < 260; i++) g.fillRect(r() * 256, r() * 128, 2, 2); // hạt nhạt, thưa: hạt đậm nhỏ hơn một điểm ảnh làm mặt đường lấp lánh khi đi
      g.fillStyle = 'rgba(255,255,255,0.9)'; for (let x = 10; x < 256; x += 64) g.fillRect(x, 62, 34, 4);
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(0, 8, 256, 2.5); g.fillRect(0, 117.5, 256, 2.5);
      return;
    }
    for (const y of [44, 84]) { const gr = g.createLinearGradient(0, y - 11, 0, y + 11); gr.addColorStop(0, tone(0.85, 0)); gr.addColorStop(0.5, tone(0.9, 0.42)); gr.addColorStop(1, tone(0.85, 0)); g.fillStyle = gr; g.fillRect(0, y - 11, 256, 22); }
    { const gr = g.createLinearGradient(0, 52, 0, 76); gr.addColorStop(0, tone(1.06, 0)); gr.addColorStop(0.5, tone(1.05, 0.5)); gr.addColorStop(1, tone(1.06, 0)); g.fillStyle = gr; g.fillRect(0, 52, 256, 24); }
    for (let i = 0; i < 420; i++) { const k = r(); g.fillStyle = k < 0.5 ? tone(0.86, 0.35) : k < 0.85 ? tone(1.1, 0.45) : 'rgba(160,150,135,0.4)'; const s = 0.6 + r() * 1.3; g.beginPath(); g.ellipse(r() * 256, 6 + r() * 116, s, s * 0.7, 0, 0, 6.3); g.fill(); }
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(120,150,90,0.5)'; g.fillRect(r() * 256, r() < 0.5 ? 2 + r() * 10 : 116 + r() * 10, 2 + r() * 3, 2); }
  });
}
/** Bản đồ alpha cho đường: mép trên dưới mờ dần để đường hoà vào cỏ. */
export function edgeFade(): THREE.CanvasTexture {
  return make('edgefade', 8, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.09, '#fff'); gr.addColorStop(0.91, '#fff'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  });
}

/** Bóng mây mềm trôi trên mặt đất. */
export function blobTex(): THREE.CanvasTexture {
  return make('blob', 128, 128, (g, r) => {
    for (let i = 0; i < 7; i++) {
      const x = 34 + r() * 60, y = 44 + r() * 40, rad = 22 + r() * 18;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
  }, false);
}

/** Đốm tròn mềm (khói, đom đóm, bóng dưới chân). */
export function softDot(): THREE.CanvasTexture {
  return make('dot', 64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }, false);
}

/**
 * Biển gỗ treo: tấm ván có vân, viền sẫm, hai lỗ đinh. `tone`: 'gold' cho vườn nhà, 'paper' cho biển thường, 'region' cho cổng chào.
 * Trả về canvas để tạo Sprite, kèm tỉ lệ rộng/cao.
 */
const LABEL_FONT = '800 46px "Baloo 2", "Be Vietnam Pro", sans-serif';
try { void document.fonts?.load(LABEL_FONT, 'Tỉa cành ✂️'); } catch { /* bỏ qua */ }
/**
 * Vẽ chữ ra một canvas phụ rồi dò điểm ảnh để biết chữ THỰC SỰ rộng bao nhiêu.
 * measureText có thể lệch với cái được vẽ (phông chưa tải xong, emoji trên iOS rộng hơn số đo) → viên nhãn rộng mà chữ lệch, bị cắt.
 * Quá 560 px thì cắt bớt chữ và thêm "…".
 */
function inkText(text: string, color: string): HTMLCanvasElement {
  const pad = 30, H = 104, MAX = 560;
  const draw = (t: string) => {
    const probe = document.createElement('canvas').getContext('2d')!; probe.font = LABEL_FONT;
    const guess = Math.ceil(probe.measureText(t).width * 1.5 + 120);
    const c = document.createElement('canvas'); c.width = guess + pad * 2; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true })!; g.font = LABEL_FONT; g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, pad, H / 2 - 2);
    const d = g.getImageData(0, 0, c.width, H).data; let l = c.width, r = -1;
    for (let x = 0; x < c.width; x++) { for (let y = 0; y < H; y += 2) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < l) l = x; r = x; break; } }
    return { c, l: r < 0 ? pad : l, r: r < 0 ? pad : r };
  };
  let t = text, m = draw(t);
  while (m.r - m.l > MAX && t.length > 2) { t = t.slice(0, Math.max(1, Math.floor(t.length * MAX / (m.r - m.l)) - 2)).trimEnd() + '…'; m = draw(t); }
  const out = document.createElement('canvas'); out.width = Math.max(1, m.r - m.l + 1); out.height = H;
  out.getContext('2d')!.drawImage(m.c, -m.l, 0); return out;
}
export function boardCanvas(text: string, tone: 'gold' | 'paper' | 'region' | 'float', floatBg?: string): { canvas: HTMLCanvasElement; aspect: number } {
  const pal0 = tone === 'gold' ? '#4a2c0c' : tone === 'region' ? '#ffffff' : tone === 'float' ? '#3b2a17' : '#4a2f14';
  const ink = inkText(text, pal0);
  const tw = ink.width, w = Math.ceil(tw + 76), h = 104;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const put = (dx: number) => g.drawImage(ink, Math.round((w - tw) / 2 + dx), 0);
  if (tone === 'float') { // chữ nổi (+25 kg…): viên thuốc gọn
    g.fillStyle = 'rgba(70,40,15,0.9)'; g.beginPath(); g.roundRect(2, 8, w - 4, h - 16, 44); g.fill();
    g.fillStyle = floatBg ?? '#ffcf3a'; g.beginPath(); g.roundRect(7, 13, w - 14, h - 30, 38); g.fill();
    put(0);
    return { canvas: c, aspect: w / h };
  }
  const pal = tone === 'gold' ? ['#8a5a22', '#f6c64a', '#ffdf7a', '#4a2c0c'] : tone === 'region' ? ['#1f5a3a', '#2f8a56', '#3da066', '#ffffff'] : ['#7a4f26', '#e9cf9c', '#f6e3ba', '#4a2f14'];
  g.fillStyle = 'rgba(40,25,10,0.28)'; g.beginPath(); g.roundRect(6, 14, w - 8, h - 18, 16); g.fill(); // bóng
  g.fillStyle = pal[0]; g.beginPath(); g.roundRect(2, 6, w - 8, h - 18, 16); g.fill();
  g.fillStyle = pal[1]; g.beginPath(); g.roundRect(7, 11, w - 18, h - 28, 11); g.fill();
  g.fillStyle = pal[2]; g.beginPath(); g.roundRect(7, 11, w - 18, (h - 28) * 0.46, 11); g.fill();
  g.strokeStyle = 'rgba(90,55,20,0.16)'; g.lineWidth = 1.5; // vân gỗ
  if (tone !== 'region') for (let y = 22; y < h - 26; y += 11) { g.beginPath(); g.moveTo(16, y); g.bezierCurveTo(w * 0.3, y - 3, w * 0.6, y + 4, w - 22, y - 1); g.stroke(); }
  g.fillStyle = pal[0]; for (const x of [18, w - 24]) { g.beginPath(); g.arc(x, h / 2 - 3, 3.2, 0, 6.3); g.fill(); }
  put(-2);
  return { canvas: c, aspect: w / h };
}
