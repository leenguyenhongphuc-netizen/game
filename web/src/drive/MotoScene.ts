// Màn chạy xe máy trên quốc lộ, đường đèo: đường uốn lượn dựng theo cung đường, địa hình núi đá / đèo ven biển / đường biển / đồng bằng,
// xe ngược chiều, xe chậm phía trước, điểm dừng chụp ảnh, cây xăng, quán nghỉ, người chơi khác cùng tuyến.
// Người chơi chỉ lo ga, phanh và đổi làn; xe tự bám cua (tay lái quá nhạy từng bị chê ở sân thi) nhưng vào cua quá nhanh thì trượt ngã.
import * as THREE from 'three';
import type { PresenceIn, PresenceOther } from '../../../shared/social.ts';
import { hash32 } from '../../../shared/social.ts';
import { PresenceLink, disposeTag, nameTag } from '../presence.ts';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { bakeColored } from '../scene/batch.ts';
import { Quality, rendererParams, stepDt } from '../perf.ts';
import { buildBus, buildMinibus, buildTaxi, seaSurface } from './RideParts.ts';
import type { Sea } from './RideParts.ts';
import { gradient, makeSign } from './RideKit.ts';
import { HELMETS, RIDER_SHIRTS, buildMoto } from './MotoParts.ts';
import type { MotoLook, MotoModel, MotoStyle } from './MotoParts.ts';
import { WEATHER_GRIP, weatherAt } from '../../../shared/moto.ts';
import type { PhuotWeather, WeatherSpan } from '../../../shared/moto.ts';

export type MotoTheme = 'karst' | 'pass_sea' | 'coast' | 'plain';
export interface MotoStop { id: string; name: string; atKm: number; kind: 'photo' | 'fuel' | 'cafe'; note?: string }
export interface MotoHud {
  kmh: number; kmDone: number; kmTotal: number; progress: number;
  fuel: number; tank: number; unit: string; dry: boolean;
  next: { name: string; kind: MotoStop['kind']; inKm: number } | null;
  /** Đang đứng ở một điểm dừng (đã dừng hẳn). */
  at: MotoStop | null;
  /** Có thể bấm "Dừng ở đây" (đang tới gần điểm dừng). */
  canStop: boolean;
  /** Cảnh báo: cua gắt phía trước (tốc độ khuyên), xe ngược chiều, xe chậm. */
  warn: { text: string; urgent: boolean } | null;
  lane: -1 | 1; lean: number; falls: number; others: number; stopping: boolean; done: boolean;
  /** Thời tiết đang gặp. */
  weather: PhuotWeather;
}
export interface MotoSceneOpts {
  theme: MotoTheme; km: number; seconds: number; twisty: number; stops: MotoStop[]; look: MotoLook;
  bike: { tank: number; per100: number; fuel: number; unit: string; maxKmh: number };
  title: string; startName: string; endName: string;
  /** Khoá cảnh hiện diện (cùng khoá thì thấy nhau trên đường). */
  presenceKey?: string;
  /** Thời tiết theo từng đoạn km (máy chủ chọn theo mùa); không có = nắng ráo. */
  weather?: WeatherSpan[];
  seed?: number;
  autopilot?: boolean;
  onTick?: (h: MotoHud) => void;
  onStop?: (s: MotoStop) => void;
  onEvent?: (text: string, kind: 'good' | 'bad' | 'info') => void;
  onArrive?: () => void;
}

const LANE = 1.75, ROAD_HALF = 3.6, STEP = 2, CRUISE = 16.7; // 60 km/h
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Nhiễu giá trị 1 chiều mượt (để dựng độ cao). */
function noise1(seed: number) {
  const r = rng(seed), v = Array.from({ length: 4096 }, () => r() * 2 - 1);
  return (x: number) => { const i = Math.floor(x), f = x - i, a = v[((i % 4096) + 4096) % 4096], b = v[(((i + 1) % 4096) + 4096) % 4096]; return lerp(a, b, smooth(f)); };
}
function noise2(seed: number) {
  const h = (x: number, y: number) => (hash32(`${seed}:${x}:${y}`) / 4294967296) * 2 - 1;
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), fx), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), fx), fy);
  };
}

interface Sample { x: number; z: number; y: number; hx: number; hz: number; k: number }
interface Traffic { obj: THREE.Group; s: number; v: number; lane: -1 | 1; len: number; slow: boolean }
interface Other { o: PresenceOther; m: MotoModel; tag: THREE.Sprite; pos0: number; v: number; t0: number; shown: number | null; lane: number; look: string }

const THEME_SKY: Record<MotoTheme, { sky: number; fog: number; near: number; far: number }> = {
  karst: { sky: 0xbfdcec, fog: 0xc7dbe4, near: 120, far: 620 },
  pass_sea: { sky: 0xa9dcf5, fog: 0xbfe2f2, near: 160, far: 760 },
  coast: { sky: 0x9fd6f5, fog: 0xc6e6f4, near: 180, far: 820 },
  plain: { sky: 0xb4e0f5, fog: 0xcfe9f2, near: 150, far: 640 },
};

/** Công trình riêng ở vài điểm dừng nổi tiếng (dựng thêm vào nhóm của điểm dừng; sx = phía vực/biển). */
function landmark(id: string, g: THREE.Group, sx: number) {
  const brick = mat(0x9a7a5a), stone = mat(0xb9ad98), roof = mat(0x5a4a3a), red = mat(0xc0392b);
  if (id === 'hai_van_quan') { // cổng thành cổ trên đỉnh đèo: hai trụ gạch, vòm cổng, mái
    const gx = sx * 1.5; // cổng đứng bên đường (trước đây đè lên mặt đường, xe và máy quay chui qua tường gạch)
    g.add(mesh(GEO.box, brick, gx, 2.2, -2.6, 3, 4.4, 2.4), mesh(GEO.box, brick, gx, 2.2, 2.6, 3, 4.4, 2.4), mesh(GEO.box, brick, gx, 4.9, 0, 3, 1.2, 7.6));
    g.add(mesh(GEO.box, stone, gx, 5.7, 0, 3.4, 0.4, 8.2), mesh(GEO.box, roof, gx, 6.4, 0, 2.6, 1.0, 5.4), mesh(GEO.box, mat(0xe8d9a8), gx - sx * 1.55, 4.9, 0, 0.05, 0.6, 2.4));
  } else if (id === 'ma_pi_leng') { // cột cờ, bia đá ghi tên đèo
    g.add(mesh(GEO.box, stone, -sx * 4, 1.2, 0, 0.6, 2.4, 2.2), mesh(GEO.box, red, -sx * 4.31, 1.6, 0, 0.02, 0.5, 1.6));
    g.add(mesh(GEO.cyl, mat(0xdcdcdc), -sx * 4, 4, -3, 0.08, 8, 0.08), mesh(GEO.box, red, -sx * 3.4, 7.4, -3, 1.2, 0.8, 0.03));
  } else if (id === 'cot_moc_0' || id === 'cong_troi_quan_ba') { // cột mốc trắng đỏ / cổng trời
    if (id === 'cot_moc_0') g.add(mesh(GEO.box, mat(0xf6f6f2), -sx * 4, 1.3, 0, 1.2, 2.6, 0.6), mesh(GEO.box, red, -sx * 4, 2.9, 0, 1.2, 0.6, 0.62), mesh(GEO.cyl, mat(0xdcdcdc), -sx * 5.5, 5, 0, 0.1, 10, 0.1), mesh(GEO.box, red, -sx * 4.7, 9.2, 0, 1.6, 1.0, 0.03));
    else for (const z of [-4, 4]) g.add(mesh(GEO.box, stone, -sx * 4, 2.5, z, 0.8, 5, 0.8)), g.add(mesh(GEO.box, roof, -sx * 4, 5.2, 0, 1.0, 0.6, 9.6));
  } else if (id === 'vinh_vinh_hy' || id === 'binh_tien' || id === 'dam_lap_an' || id === 'vinh_da_nang') { // thuyền thúng, ghe dưới vịnh
    for (let i = 0; i < 4; i++) { const x = sx * (16 + i * 9), z = -8 + i * 5; g.add(mesh(GEO.box, mat(0x2f6fb8), x, -g.position.y + 0.3, z, 1.4, 0.5, 4), mesh(GEO.box, mat(0xd94f3a), x, -g.position.y + 0.65, z, 1.2, 0.2, 2)); }
  } else if (id === 'canh_dong_nho') { // giàn nho
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.add(mesh(GEO.cyl, mat(0x7a5a3a), -sx * (6 + i * 2.4), 0.9, -3 + j * 3, 0.05, 1.8, 0.05));
    g.add(mesh(GEO.box, mat(0x5f9a3a), -sx * 9.6, 1.85, 0, 8, 0.25, 7.6));
  } else if (id === 'doc_tham_ma') { // biển dốc + hàng rào đá
    for (let i = 0; i < 6; i++) g.add(mesh(GEO.box, stone, -sx * 4, 0.4, -6 + i * 2.2, 0.7, 0.8, 1.8));
  }
}

export class MotoScene {
  private renderer: THREE.WebGLRenderer;
  private quality: Quality;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.2, 2200);
  private ro: ResizeObserver;
  private path: Sample[] = [];
  private L = 1; private kmU = 1;
  private s = 4; private v = 0; private lat = LANE; private laneWant: -1 | 1 = 1;
  private throttle = 0; private brakeIn = 0; private leanA = 0;
  private fuel: number; private dry = false;
  private bike: MotoModel;
  private stopsS: { stop: MotoStop; s: number; done: boolean }[] = [];
  private stopping: { s: number; stop: MotoStop } | null = null;
  private at: MotoStop | null = null;
  private paused = false; private arrived = false; private disposed = false;
  private falls = 0; private fallT = 0; private slideT = 0;
  private traffic: Traffic[] = [];
  private sea: Sea | null = null;
  private others = new Map<number, Other>();
  private link: PresenceLink | null = null;
  private kmps = 0; private lastS = 4;
  private wx: PhuotWeather = 'nang'; private grip = 1; private rain: THREE.LineSegments | null = null; private rainV: Float32Array | null = null;
  private roadMat: THREE.MeshPhongMaterial | null = null; private fogWant = { near: 150, far: 700 }; private sun: THREE.DirectionalLight | null = null; private hemi: THREE.HemisphereLight | null = null;
  private convoyColors = new Map<number, string>();
  private tickAcc = 0; private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3(); private camInit = false;
  private wheelSpin = 0; private hudWarn: MotoHud['warn'] = null;
  private auto: boolean;
  private shade: THREE.Mesh;

  constructor(private host: HTMLElement, private opts: MotoSceneOpts) {
    this.renderer = new THREE.WebGLRenderer(rendererParams(host));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.quality = new Quality(this.renderer, { name: 'Đi phượt' });
    this.auto = opts.autopilot ?? (globalThis as { __motoAuto?: boolean }).__motoAuto === true;
    this.fuel = Math.max(0, opts.bike.fuel);
    const sky = THEME_SKY[opts.theme];
    this.scene.background = gradient(opts.theme === 'karst' ? 0x8fc6e6 : 0x6fb9ea, sky.sky);
    this.scene.fog = new THREE.Fog(sky.fog, sky.near, sky.far);
    this.hemi = new THREE.HemisphereLight(0xfdfcf4, opts.theme === 'coast' ? 0xc8b07a : 0x5d7a46, 1.45); this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff0d2, 1.75); sun.position.set(-60, 120, 40); this.scene.add(sun); this.sun = sun;

    this.buildPath();
    this.buildTerrain();
    this.buildRoad();
    this.buildRoadside();
    this.buildStops();
    this.buildTraffic();
    if (opts.theme === 'pass_sea' || opts.theme === 'coast') { this.sea = seaSurface(1800, 90); this.sea.mesh.position.y = 0; this.scene.add(this.sea.mesh); }

    this.bike = buildMoto(opts.look, true);
    this.scene.add(this.bike.root);
    // bóng mờ dưới xe
    const sh = document.createElement('canvas'); sh.width = sh.height = 64; const g = sh.getContext('2d')!; const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.shade = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
    this.scene.add(this.shade);

    this.buildRain();
    this.applyWeather(weatherAt(opts.weather ?? [], 0), true);
    if (opts.presenceKey) this.link = new PresenceLink(() => this.presenceState(), (list, at) => this.setOthers(list, at.local));
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
    (window as unknown as { __moto?: MotoScene }).__moto = this;
  }

  // ---------------------------------------------------------------- điều khiển
  setThrottle(v: number) { this.throttle = clamp(v, 0, 1); }
  setBrake(v: number) { this.brakeIn = clamp(v, 0, 1); }
  /** Đổi làn: -1 sang làn trái (để vượt), 1 về làn phải. */
  setLane(l: -1 | 1) { this.laneWant = l; }
  /** Xin dừng ở điểm dừng sắp tới: xe tự phanh vào đúng chỗ. */
  stopAhead(): boolean {
    const n = this.nextStop(); if (!n || n.s - this.s > 260) return false;
    this.stopping = { s: n.s, stop: n.stop }; return true;
  }
  /** Rời điểm dừng (sau khi chụp ảnh, đổ xăng, nghỉ quán) hoặc bỏ qua. */
  resume() { this.paused = false; if (this.at) { const st = this.stopsS.find((x) => x.stop === this.at); if (st) st.done = true; } this.at = null; this.stopping = null; }
  addFuel(amount: number) { this.fuel = clamp(this.fuel + Math.max(0, amount), 0, this.opts.bike.tank); if (this.fuel > 0.05) this.dry = false; }
  get fuelNow() { return this.fuel; }
  get kmNow() { return clamp((this.s / this.L) * this.opts.km, 0, this.opts.km); }
  get drawCalls() { return this.renderer.info.render.calls; }
  /** Thử tự động: chạy nhanh (bỏ qua chờ), tua thời gian. */
  setAuto(on: boolean) { this.auto = on; }

  // ---------------------------------------------------------------- dựng cảnh
  private buildPath() {
    const o = this.opts, r = rng(o.seed ?? hash32(o.title)), twisty = clamp(o.twisty, 0.2, 1.2);
    this.L = Math.max(900, o.seconds * CRUISE * 1.05); this.kmU = o.km / this.L;
    // chuỗi đoạn thẳng xen khúc cua; hướng chung là -z, lệch quá thì cua ngược lại (đường uốn như rắn, không tự cắt)
    let x = 0, z = 0, h = 0, s = 0;
    const segs: { len: number; k: number }[] = [{ len: 60, k: 0 }];
    let side = r() < 0.5 ? -1 : 1;
    while (segs.reduce((a, b) => a + b.len, 0) < this.L + 200) {
      const straight = o.theme === 'plain' ? 80 + r() * 160 : (1.25 - twisty) * (30 + r() * 90) + 10;
      segs.push({ len: straight, k: 0 });
      const R = o.theme === 'plain' ? 160 + r() * 200 : lerp(90, 20, twisty) + r() * lerp(120, 40, twisty);
      const ang = (o.theme === 'plain' ? 0.25 + r() * 0.4 : lerp(0.5, 1.9, twisty) * (0.45 + r() * 0.75));
      segs.push({ len: R * ang, k: side / R });
      side = -side;
    }
    const ny = noise1((o.seed ?? 7) + 11);
    for (const sg of segs) {
      for (let d = 0; d < sg.len; d += STEP) {
        // hướng lệch quá xa so với -z thì cua đang làm bị nắn bớt
        const kk = Math.abs(h) > 1.35 && Math.sign(sg.k) === Math.sign(h) ? sg.k * 0.25 : sg.k;
        h += kk * STEP; const hx = Math.sin(h), hz = -Math.cos(h);
        x += hx * STEP; z += hz * STEP; s += STEP;
        this.path.push({ x, z, y: 0, hx, hz, k: kk });
        if (s > this.L + 200) break;
      }
      if (s > this.L + 200) break;
    }
    // độ cao theo tuyến
    const n = this.path.length;
    for (let i = 0; i < n; i++) {
      const t = i / n, sMeters = i * STEP, wob = ny(sMeters / 220) * 0.6 + ny(sMeters / 70 + 40) * 0.15;
      let y: number;
      if (o.theme === 'karst') y = 60 + 70 * smooth(clamp(t * 1.4, 0, 1)) + 26 * wob - 30 * smooth(clamp((t - 0.88) / 0.12, 0, 1));
      else if (o.theme === 'pass_sea') y = 6 + Math.min(70, this.L * 0.035) * Math.pow(Math.sin(Math.PI * clamp(t * 1.02, 0, 1)), 1.25) + 4 * wob;
      else if (o.theme === 'coast') y = 9 + 7 * wob + 16 * Math.max(0, Math.sin(t * Math.PI * 3.2)) ** 2;
      else y = 1.2 + 0.6 * wob;
      this.path[i].y = y;
    }
    // làm mượt độ cao (tránh dốc gắt)
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < n - 1; i++) this.path[i].y = (this.path[i - 1].y + this.path[i].y * 2 + this.path[i + 1].y) / 4;
  }
  /** Mẫu đường ở vị trí s (nội suy). */
  private at_(s: number): Sample {
    const f = clamp(s / STEP, 0, this.path.length - 1.001), i = Math.floor(f), t = f - i, a = this.path[i], b = this.path[i + 1];
    return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), y: lerp(a.y, b.y, t), hx: lerp(a.hx, b.hx, t), hz: lerp(a.hz, b.hz, t), k: lerp(a.k, b.k, t) };
  }
  /** Điểm trên đường: s dọc tuyến, lat lệch ngang (+ bên phải chiều đi). */
  private point(s: number, lat: number, out = new THREE.Vector3()): THREE.Vector3 {
    const p = this.at_(s); return out.set(p.x - p.hz * lat, p.y, p.z + p.hx * lat);
  }

  private buildTerrain() {
    const o = this.opts, pts = this.path;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const M = 420; minX -= M; maxX += M; minZ -= M; maxZ += M;
    const cell = this.path.length > 1600 ? 11 : 9, nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
    // lưới băm các mẫu đường để tìm mẫu gần nhất nhanh
    const B = 40, buckets = new Map<string, number[]>();
    for (let i = 0; i < pts.length; i += 2) { const k = `${Math.floor(pts[i].x / B)},${Math.floor(pts[i].z / B)}`; (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(i); }
    // lưới thô (100 m) tìm mẫu gần nhất bằng vét cạn, cho các điểm xa đường
    const CB = 100, cnx = Math.ceil((maxX - minX) / CB) + 1, cnz = Math.ceil((maxZ - minZ) / CB) + 1, coarse = new Int32Array(cnx * cnz);
    for (let j = 0; j < cnz; j++) for (let i = 0; i < cnx; i++) {
      const x = minX + i * CB, z = minZ + j * CB; let best = 0, bd = Infinity;
      for (let q = 0; q < pts.length; q += 6) { const d = (pts[q].x - x) ** 2 + (pts[q].z - z) ** 2; if (d < bd) { bd = d; best = q; } }
      coarse[j * cnx + i] = best;
    }
    const nearest = (x: number, z: number): number => {
      const bx = Math.floor(x / B), bz = Math.floor(z / B); let best = -1, bd = Infinity;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const l = buckets.get(`${bx + dx},${bz + dz}`); if (!l) continue;
        for (const q of l) { const d = (pts[q].x - x) ** 2 + (pts[q].z - z) ** 2; if (d < bd) { bd = d; best = q; } }
      }
      if (best < 0) { const ci = clamp(Math.round((x - minX) / CB), 0, cnx - 1), cj = clamp(Math.round((z - minZ) / CB), 0, cnz - 1); best = coarse[cj * cnx + ci]; }
      // tinh chỉnh quanh mẫu tìm được
      for (let q = Math.max(0, best - 3); q <= Math.min(pts.length - 1, best + 3); q++) { const d = (pts[q].x - x) ** 2 + (pts[q].z - z) ** 2; if (d < bd) { bd = d; best = q; } }
      return best;
    };
    const n2 = noise2((o.seed ?? 3) + 5), pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
    const c = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();
    const pal = {
      karst: { a: 0x8fa58a, b: 0x9aa3a0, c: 0x6f9a55, low: 0x5e8f4a },
      pass_sea: { a: 0x4f8f45, b: 0x6ea957, c: 0x3e7a3a, low: 0xe8d9a8 },
      coast: { a: 0xc8b878, b: 0xb5a865, c: 0x9fa56a, low: 0xf0e0b0 },
      plain: { a: 0x8fd67c, b: 0xe2c95f, c: 0x79c96d, low: 0x6cc5e0 },
    }[o.theme];
    this.heights = { minX, minZ, cell, nx, nz, h: new Float32Array(nx * nz) };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = minX + i * cell, z = minZ + j * cell, q = nearest(x, z), p = pts[q];
      const dxv = x - p.x, dzv = z - p.z, side = -dxv * p.hz + dzv * p.hx; // > 0: bên phải chiều đi
      const a = Math.hypot(dxv, dzv), nz_ = n2(x / 60, z / 60), big = n2(x / 260 + 9, z / 260 - 4);
      let y: number;
      if (a < ROAD_HALF + 1.6) y = p.y - 0.45;
      else {
        const d = a - ROAD_HALF - 1.6;
        if (o.theme === 'plain') y = p.y - 0.5 + 0.3 * nz_ + Math.max(0, d - 120) * 0.02 * (1 + big);
        else if (side < 0) { // phía núi
          const slope = o.theme === 'karst' ? 0.95 : o.theme === 'pass_sea' ? 0.7 : 0.28;
          y = p.y - 0.3 + d * slope * (0.75 + 0.35 * nz_) + Math.max(0, d - 60) * slope * 0.35 * (1 + big);
        } else { // phía vực / biển
          if (o.theme === 'karst') y = Math.max(p.y - d * 0.9 * (0.8 + 0.3 * nz_), 4 + 12 * big + 6 * nz_);
          else if (o.theme === 'pass_sea') y = Math.max(p.y - d * 0.75, -8 - d * 0.02) + (d > 4 ? 0 : 0);
          else y = d < 6 ? p.y - 0.4 - d * 0.5 : Math.max(-6 - d * 0.01, p.y - 3.4 - (d - 6) * 1.1); // kè đá rồi bãi cát xuống biển
          if (o.theme !== 'karst' && y < p.y - 2) y = Math.min(y, p.y - 2) + 1.2 * nz_;
        }
      }
      const k = j * nx + i; this.heights.h[k] = y;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      // màu: theo độ cao và nhiễu
      const t = clamp((nz_ + 1) / 2, 0, 1);
      cA.setHex(pal.a); cB.setHex(pal.b); c.copy(cA).lerp(cB, t);
      if (o.theme === 'karst' && side < 0 && a > 18 && nz_ > 0.15) c.lerp(cB.setHex(0xa9b0ac), 0.55); // mặt đá tai mèo
      if (o.theme === 'plain') { const tile = (Math.floor(x / 26) + Math.floor(z / 18)) % 3; c.setHex(tile === 0 ? 0x8fd67c : tile === 1 ? 0xa6db7c : 0xd9c25c); }
      if ((o.theme === 'pass_sea' || o.theme === 'coast') && y < 2.5) c.setHex(pal.low);
      if (o.theme === 'karst' && y < 9) c.setHex(pal.low);
      if (a < ROAD_HALF + 4) c.lerp(cA.setHex(0x8a7a55), 0.35); // lề đất
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    const idx: number[] = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; idx.push(a, d, b, b, d, e); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); m.userData.own = true;
    this.scene.add(m);
    // sông dưới thung lũng (núi đá) / kênh ruộng (đồng bằng)
    if (o.theme === 'karst' || o.theme === 'plain') {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: o.theme === 'karst' ? 0x3fae9a : 0x6cc5e0 }));
      w.position.set((minX + maxX) / 2, o.theme === 'karst' ? 8.5 : 0.25, (minZ + maxZ) / 2); w.userData.own = true; this.scene.add(w);
    }
  }
  private heights = { minX: 0, minZ: 0, cell: 1, nx: 1, nz: 1, h: new Float32Array(1) };
  /** Độ cao địa hình tại (x, z). */
  private groundY(x: number, z: number): number {
    const H = this.heights, fx = clamp((x - H.minX) / H.cell, 0, H.nx - 1.001), fz = clamp((z - H.minZ) / H.cell, 0, H.nz - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * H.nx + i;
    return lerp(lerp(H.h[k], H.h[k + 1], tx), lerp(H.h[k + H.nx], H.h[k + H.nx + 1], tx), tz);
  }

  private buildRoad() {
    // mặt đường nhựa hai làn: vạch mép trắng liền, vạch giữa trắng nét đứt
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const g = cv.getContext('2d')!;
    g.fillStyle = this.opts.theme === 'karst' ? '#6f747c' : '#666b73'; g.fillRect(0, 0, 128, 256);
    const r = rng(4); for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'; g.fillRect(r() * 128, r() * 256, 1.5, 1.5); }
    g.fillStyle = '#f4f4ee'; g.fillRect(5, 0, 4, 256); g.fillRect(119, 0, 4, 256);
    g.fillStyle = this.opts.theme === 'karst' ? '#f2c94c' : '#f4f4ee'; g.fillRect(62, 0, 4, 150);
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const n = this.path.length, pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = this.path[i];
      for (const [k, lat] of [[0, -ROAD_HALF], [1, ROAD_HALF]] as const) {
        const o = (i * 2 + k) * 3; pos[o] = p.x - p.hz * lat; pos[o + 1] = p.y + 0.02; pos[o + 2] = p.z + p.hx * lat;
        uv[(i * 2 + k) * 2] = k; uv[(i * 2 + k) * 2 + 1] = (i * STEP) / 12;
      }
      if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    this.roadMat = new THREE.MeshPhongMaterial({ map: tex, specular: 0x000000, shininess: 8 });
    const m = new THREE.Mesh(geo, this.roadMat); m.userData.own = true; m.renderOrder = 1;
    m.material.polygonOffset = true; m.material.polygonOffsetFactor = -2; m.material.polygonOffsetUnits = -2;
    this.scene.add(m);
  }

  private buildRoadside() {
    const o = this.opts, r = rng((o.seed ?? 1) + 99), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    // hộ lan / cọc tiêu bên vực (trắng sọc đỏ) — một lần vẽ
    const postGeo = new THREE.BoxGeometry(0.13, 0.62, 0.13);
    const nPost = Math.floor(this.L / 5);
    const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), nPost); posts.userData.own = true;
    const red = new THREE.Color(0xe0342b), white = new THREE.Color(0xf6f6f2);
    let pi = 0;
    for (let s = 10; s < this.L && pi < nPost; s += 5) {
      const side = o.theme === 'plain' ? (pi % 2 ? 1 : -1) : 1;
      this.point(s, side * (ROAD_HALF + 0.7), p); m4.compose(p.setY(p.y + 0.31), q.identity(), sc.set(1, 1, 1)); posts.setMatrixAt(pi, m4); posts.setColorAt(pi, Math.floor(s / 5) % 2 ? red : white); pi++;
    }
    posts.count = pi; this.scene.add(posts);
    // cây cối: một lưới mẫu, rải theo lối (InstancedMesh)
    const tree = new THREE.Group();
    if (o.theme === 'coast') { tree.add(mesh(GEO.cyl, mat(0x8a6a3a), 0, 2.2, 0, 0.18, 4.4, 0.18)); for (let k = 0; k < 6; k++) { const lf = mesh(GEO.box, mat(0x5f9a3a), Math.cos(k) * 0.9, 4.4, Math.sin(k) * 0.9, 1.8, 0.1, 0.45); lf.rotation.y = k; lf.rotation.z = 0.35; tree.add(lf); } }
    else if (o.theme === 'karst') { tree.add(mesh(GEO.cyl, mat(0x6a4a2a), 0, 0.9, 0, 0.12, 1.8, 0.12), mesh(GEO.cone, mat(0x4f7f3f), 0, 2.4, 0, 1.0, 2.6, 1.0)); }
    else { tree.add(mesh(GEO.cyl, mat(0x6a4a2a), 0, 1.1, 0, 0.16, 2.2, 0.16), mesh(GEO.ball, mat(0x4f8f45), 0, 2.8, 0, 1.5, 1.3, 1.5), mesh(GEO.ball, mat(0x5fa050), 0.6, 3.2, 0.3, 0.9)); }
    const tb = bakeColored(tree); const tGeo = (tb.children[0] as THREE.Mesh).geometry, tMat = (tb.children[0] as THREE.Mesh).material as THREE.Material;
    const N = o.theme === 'coast' ? 260 : 700, trees = new THREE.InstancedMesh(tGeo, tMat, N); trees.userData.own = true; let ti = 0;
    for (let tries = 0; tries < N * 4 && ti < N; tries++) {
      const s = r() * this.L, side = r() < (o.theme === 'karst' || o.theme === 'pass_sea' ? 0.75 : 0.5) ? -1 : 1, d = ROAD_HALF + 5 + r() * (r() < 0.6 ? 40 : 160);
      this.point(s, side * d, p); const y = this.groundY(p.x, p.z);
      if ((o.theme === 'pass_sea' || o.theme === 'coast') && y < 2) continue;
      if (o.theme === 'karst' && y < 10) continue;
      const k = 0.7 + r() * 0.8; m4.compose(p.setY(y - 0.1), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.3), sc.set(k, k * (0.8 + r() * 0.5), k)); trees.setMatrixAt(ti++, m4);
    }
    trees.count = ti; this.scene.add(trees);
    // núi đá tai mèo hình chóp mũ (núi đá) hoặc núi xa (đèo, biển)
    if (o.theme === 'karst' || o.theme === 'pass_sea') {
      // núi đá vôi dáng "tai mèo": sườn dốc đứng, đỉnh tròn, mặt đá lồi lõm; núi xa ven biển thoải hơn
      const peak = new THREE.CylinderGeometry(1, 1, 1, 10, 6, true); peak.translate(0, 0.5, 0); // không đáy: chân núi cắm sâu xuống đất, không lộ mặt đáy ở sườn vực
      const pa = peak.attributes.position, jr = rng(77);
      for (let i = 0; i < pa.count; i++) {
        const y = pa.getY(i), f = Math.max(o.theme === 'karst' ? 0.16 : 0.06, Math.pow(1 - y, o.theme === 'karst' ? 0.62 : 0.9)), j = y > 0.99 ? 1 : 0.84 + jr() * 0.3;
        pa.setX(i, pa.getX(i) * f * j); pa.setZ(i, pa.getZ(i) * f * j);
      }
      peak.computeVertexNormals();
      const pc = new Float32Array(pa.count * 3), cc = new THREE.Color();
      for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); cc.setHex(o.theme === 'karst' ? (y > 0.7 ? 0x6f9a55 : y > 0.35 && jr() < 0.5 ? 0x7f9f6a : 0x9aa3a0) : (y > 0.4 ? 0x3e7a3a : 0x5f8f4f)); pc.set([cc.r, cc.g, cc.b], i * 3); }
      peak.setAttribute('color', new THREE.BufferAttribute(pc, 3));
      const NP = o.theme === 'karst' ? 160 : 60, peaks = new THREE.InstancedMesh(peak, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), NP); peaks.userData.own = true;
      let k = 0;
      for (let tries = 0; tries < NP * 5 && k < NP; tries++) {
        const s = r() * this.L, side = o.theme === 'pass_sea' ? -1 : r() < 0.5 ? -1 : 1;
        const hgt = o.theme === 'karst' ? 40 + r() * 80 : 70 + r() * 120, w = hgt * (o.theme === 'karst' ? 0.32 + r() * 0.16 : 0.9 + r() * 0.5), d = w + 35 + r() * 300;
        this.point(s, side * d, p);
        // không đặt núi đè lên đoạn đường khác (đường uốn qua lại)
        let clash = false; for (let qq = 0; qq < this.path.length; qq += 10) if ((this.path[qq].x - p.x) ** 2 + (this.path[qq].z - p.z) ** 2 < (w + 25) ** 2) { clash = true; break; }
        if (clash) continue;
        let y = Infinity; for (const [ox, oz] of [[0, 0], [w * 0.7, 0], [-w * 0.7, 0], [0, w * 0.7], [0, -w * 0.7]]) y = Math.min(y, this.groundY(p.x + ox, p.z + oz)); y -= 8;
        m4.compose(p.setY(y), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.3), sc.set(w, hgt, w * (0.8 + r() * 0.4))); peaks.setMatrixAt(k++, m4);
      }
      peaks.count = k; this.scene.add(peaks);
    }
    // dãy núi xa bao quanh (che chân trời trống); ven biển chỉ có núi phía đất liền
    if (o.theme !== 'plain') {
      let cx = 0, cz = 0; for (const q of this.path) { cx += q.x; cz += q.z; } cx /= this.path.length; cz /= this.path.length;
      let rad = 0; for (const q of this.path) rad = Math.max(rad, Math.hypot(q.x - cx, q.z - cz));
      const hill = new THREE.ConeGeometry(1, 1, 8, 2); hill.translate(0, 0.5, 0);
      const NB = 46, back = new THREE.InstancedMesh(hill, new THREE.MeshLambertMaterial({ color: o.theme === 'karst' ? 0x8fa39a : o.theme === 'coast' ? 0xb9b48a : 0x6f9a78, flatShading: true }), NB); back.userData.own = true;
      let k = 0;
      for (let i = 0; i < NB; i++) {
        const a = (i / NB) * Math.PI * 2 + r() * 0.1, x = cx + Math.cos(a) * (rad + 260 + r() * 160), z = cz + Math.sin(a) * (rad + 260 + r() * 160);
        if (o.theme === 'coast' || o.theme === 'pass_sea') { const q = this.path[Math.floor(this.path.length / 2)]; if ((x - q.x) * -q.hz + (z - q.z) * q.hx > 0) continue; } // phía biển không có núi
        const h = 120 + r() * 160, w = h * (1.1 + r() * 0.8); m4.compose(new THREE.Vector3(x, -10, z), q.identity(), sc.set(w, h, w)); back.setMatrixAt(k++, m4);
      }
      back.count = k; this.scene.add(back);
    }
    // nhà ven đường: nhà trình tường người Mông (núi đá), nhà mái ngói (khác) — gộp một lưới
    const houses = new THREE.Group();
    const nh = o.theme === 'plain' ? 26 : 14;
    for (let i = 0; i < nh; i++) {
      const s = 40 + r() * (this.L - 80), side = o.theme === 'plain' ? (r() < 0.5 ? -1 : 1) : -1, d = ROAD_HALF + 9 + r() * 10;
      this.point(s, side * d, p); const y = this.groundY(p.x, p.z), hp = this.at_(s), yaw = Math.atan2(hp.hx, hp.hz);
      const hh = new THREE.Group(); hh.position.set(p.x, y, p.z); hh.rotation.y = yaw + (side < 0 ? Math.PI / 2 : -Math.PI / 2);
      const wall = o.theme === 'karst' ? 0xc79a6a : 0xf3e5c6, roof = o.theme === 'karst' ? 0x7a6a5a : o.theme === 'coast' ? 0x4f86c6 : 0xc0563a;
      hh.add(mesh(GEO.box, mat(wall), 0, 1.4, 0, 5, 2.8, 4), mesh(GEO.box, mat(0x6a4a2a), 0, 1.0, 2.01, 1.0, 2.0, 0.05), mesh(GEO.box, mat(0x9fd8f0), 1.6, 1.6, 2.01, 0.9, 0.8, 0.05));
      const rf = mesh(GEO.cone, mat(roof), 0, 3.6, 0, 4.2, 1.8, 3.4); rf.rotation.y = Math.PI / 4; hh.add(rf);
      houses.add(hh);
    }
    this.scene.add(bakeColored(houses));
    // cột cây số ven đường (trắng đầu đỏ) mỗi ~10 km thật
    const kmPost = new THREE.Group(), every = Math.max(30, 10 / this.kmU);
    for (let s = every; s < this.L - 20; s += every) { this.point(s, ROAD_HALF + 1.4, p); const g = new THREE.Group(); g.position.set(p.x, this.at_(s).y, p.z); g.add(mesh(GEO.box, mat(0xf6f6f2), 0, 0.45, 0, 0.42, 0.9, 0.16), mesh(GEO.box, mat(0xe0342b), 0, 0.98, 0, 0.42, 0.22, 0.17)); kmPost.add(g); }
    this.scene.add(bakeColored(kmPost));
  }

  private buildStops() {
    const p = new THREE.Vector3();
    for (const st of this.opts.stops) {
      const s = clamp((st.atKm / this.opts.km) * this.L, 40, this.L - 30);
      this.stopsS.push({ stop: st, s, done: false });
      const hp = this.at_(s), yaw = Math.atan2(-hp.hx, -hp.hz), g = new THREE.Group();
      const side = st.kind === 'photo' && this.opts.theme !== 'plain' ? 1 : -1; // điểm ngắm cảnh đặt phía vực / biển
      this.point(s, side * (ROAD_HALF + 4), p); g.position.set(p.x, hp.y, p.z); g.rotation.y = yaw;
      const sx = side; // trục x cục bộ: + phía phải đường
      if (st.kind === 'photo') {
        landmark(st.id, g, sx);
        g.add(mesh(GEO.box, mat(0xd9c7a0), 0, -0.1, 0, 6, 0.3, 5)); // bãi đứng ngắm
        for (let k = -2; k <= 2; k++) g.add(mesh(GEO.box, mat(0x8a5a2e), sx * 2.8, 0.55, k * 1.1, 0.12, 1.1, 0.12));
        g.add(mesh(GEO.box, mat(0x8a5a2e), sx * 2.8, 1.05, 0, 0.1, 0.1, 4.6));
        g.add(mesh(GEO.cyl, mat(0xdcdcdc), -sx * 2, 2.2, 1.8, 0.06, 4.4, 0.06), mesh(GEO.box, mat(0xe0342b), -sx * 1.55, 4.0, 1.8, 0.9, 0.6, 0.03), mesh(GEO.box, mat(0xffd23f), -sx * 1.55, 4.0, 1.81, 0.2, 0.2, 0.02));
      } else if (st.kind === 'fuel') {
        g.add(mesh(GEO.box, mat(0xb8bec6), 0, -0.05, 0, 9, 0.2, 10));
        for (const x of [-3, 3]) g.add(mesh(GEO.cyl, mat(0xf3f4f6), x, 2.2, 0, 0.18, 4.4, 0.18));
        g.add(mesh(GEO.box, mat(0xffffff), 0, 4.5, 0, 8, 0.35, 6), mesh(GEO.box, mat(0x1f6fb8), 0, 4.25, 0, 8.1, 0.18, 6.1));
        for (const z of [-1.4, 1.4]) g.add(mesh(GEO.box, mat(0xf0f0f0), 0, 0.85, z, 0.7, 1.7, 0.5), mesh(GEO.box, mat(0x1f6fb8), 0, 1.4, z + 0.26, 0.6, 0.3, 0.02));
        g.add(mesh(GEO.box, mat(0xf3e5c6), -sx * 3.5, 1.4, -3.5, 4, 2.8, 3), mesh(GEO.box, mat(0x1f6fb8), -sx * 3.5, 2.95, -3.5, 4.2, 0.3, 3.2));
      } else {
        // quán nước: nhà gỗ mái lá, bàn ghế nhựa đỏ, xe máy đỗ trước quán
        g.add(mesh(GEO.box, mat(0xc79a6a), -sx * 2.5, 1.3, 0, 4.5, 2.6, 4), mesh(GEO.cone, mat(0x8a6a3a), -sx * 2.5, 3.3, 0, 3.8, 1.6, 3.2).rotateY(Math.PI / 4));
        for (const z of [-1.6, 1.6]) g.add(mesh(GEO.cyl, mat(0xe0342b), sx * 0.6, 0.35, z, 0.45, 0.06, 0.45), mesh(GEO.box, mat(0xe0342b), sx * 1.4, 0.22, z, 0.35, 0.44, 0.35), mesh(GEO.box, mat(0xe0342b), sx * -0.2, 0.22, z, 0.35, 0.44, 0.35));
        g.add(mesh(GEO.box, mat(0xffd23f), -sx * 0.2, 2.9, 0, 0.05, 0.7, 2.6));
      }
      g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
      const b2 = bakeColored(g); b2.position.set(p.x, hp.y, p.z); b2.rotation.y = yaw; this.scene.add(b2);
      // biển tên điểm dừng
      const icon = st.kind === 'photo' ? '📸' : st.kind === 'fuel' ? '⛽' : '☕';
      const sp = makeSign(`${icon} ${st.name}`, st.kind === 'photo' ? '#1f6fb8' : st.kind === 'fuel' ? '#f08a24' : '#2f8f4c'); sp.scale.set(7.5, 1.9, 1);
      this.point(s - 30, -(ROAD_HALF + 2.4), p); sp.position.set(p.x, this.at_(s - 30).y + 3.6, p.z); this.scene.add(sp);
    }
    // cổng chào điểm đến
    const end = new THREE.Group(), ep = this.at_(this.L - 8), eyaw = Math.atan2(-ep.hx, -ep.hz);
    for (const x of [-5.2, 5.2]) end.add(mesh(GEO.box, mat(0xb9855a), x, 2.6, 0, 0.5, 5.2, 0.5));
    end.add(mesh(GEO.box, mat(0xf08a6c), 0, 5.4, 0, 12, 0.5, 0.8));
    const eb = bakeColored(end); eb.position.set(ep.x, ep.y, ep.z); eb.rotation.y = eyaw; this.scene.add(eb);
    const es = makeSign(`Chào mừng tới ${this.opts.endName}`, '#f08a6c'); es.scale.set(10, 2.5, 1); es.position.set(ep.x, ep.y + 6.8, ep.z); this.scene.add(es);
  }

  private buildTraffic() {
    // vài xe ngược chiều (làn trái) và một xe chậm cùng chiều (xe tải, xe khách), quay vòng theo vị trí người chơi
    const mk = [buildMinibus, buildBus, buildTaxi];
    for (let i = 0; i < 4; i++) {
      const slow = i === 3, obj = bakeColored(mk[i % 3]()); obj.scale.setScalar(slow ? 0.95 : 0.9);
      this.scene.add(obj);
      this.traffic.push({ obj, s: slow ? 260 : 300 + i * 260, v: slow ? 8 : 12 + i * 1.5, lane: slow ? 1 : -1, len: 9, slow });
    }
  }

  // ---------------------------------------------------------------- người chơi khác cùng tuyến
  private presenceState(): PresenceIn | null {
    if (this.disposed || !this.opts.presenceKey) return null;
    return { scene: 'highway', key: this.opts.presenceKey, dir: 1, km: Math.round(this.kmNow * 100) / 100, totalKm: this.opts.km, kmps: Math.round(this.kmps * 100) / 100 };
  }
  private setOthers(list: PresenceOther[], local: number) {
    const keep = new Set<number>();
    for (const o of list) {
      if (o.aheadKm === undefined) continue;
      keep.add(o.id);
      const styles: MotoStyle[] = ['so', 'con_tay', 'adventure', 'ga', 'so'], st = styles[hash32(`moto:${o.id}`) % styles.length];
      const shirt = o.avatar?.shirt && /^#[0-9a-f]{6}$/i.test(o.avatar.shirt) ? parseInt(o.avatar.shirt.slice(1), 16) : RIDER_SHIRTS[o.id % RIDER_SHIRTS.length];
      const team = this.convoyColors.get(o.id) ?? '', look = `${st}|${shirt}|${o.name}|${team}`;
      let it = this.others.get(o.id);
      if (it && it.look !== look) { this.dropOther(it); it = undefined; }
      if (!it) {
        const m = buildMoto({ style: st, color: [0xc0392b, 0x2b2f38, 0x1f6fb8, 0xf4c430][o.id % 4], shirt, helmet: HELMETS[o.id % HELMETS.length] }, true);
        const tag = nameTag(team ? { ...o, name: `🏁 ${o.name}` } : o, 0.9); tag.position.set(0, 2.4, 0); m.root.add(tag);
        if (team) { // cờ đuôi màu đoàn cắm sau yên
          const col = parseInt(team.slice(1), 16);
          m.root.add(mesh(GEO.cyl, mat(0xdddddd), 0, 1.6, 0.85, 0.02, 1.5, 0.02), mesh(GEO.box, mat(col), 0, 2.15, 1.05, 0.03, 0.34, 0.42));
        }
        it = { o, m, tag, pos0: 0, v: 0, t0: local, shown: null, lane: 0.9 + (hash32(`lane:${o.id}`) % 3) * 0.55, look };
        this.scene.add(m.root); this.others.set(o.id, it);
      }
      const age = (o.ageMs ?? 0) / 1000, v = (o.sameDir ? 1 : -1) * (o.kmps ?? 0);
      it.o = o; it.pos0 = this.kmNow + o.aheadKm + v * age; it.v = v; it.t0 = local;
    }
    for (const [id, it] of this.others) if (!keep.has(id)) { this.dropOther(it); this.others.delete(id); }
  }
  // ---------------------------------------------------------------- thời tiết
  /** Mưa: các vệt nước rơi quanh máy quay, một lần vẽ (LineSegments), cập nhật theo dt. */
  private buildRain() {
    const N = 700, v = new Float32Array(N * 6), r = rng(77);
    for (let i = 0; i < N; i++) { const x = (r() - 0.5) * 60, y = r() * 26, z = (r() - 0.5) * 60; v.set([x, y, z, x + 0.05, y - 0.9, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
    m.frustumCulled = false; m.visible = false; m.userData.own = true; this.rain = m; this.rainV = v; this.scene.add(m);
  }
  private applyWeather(kind: PhuotWeather, initial = false) {
    this.wx = kind; this.grip = WEATHER_GRIP[kind];
    const sky = THEME_SKY[this.opts.theme], fog = this.scene.fog as THREE.Fog;
    const want = kind === 'mua' ? { color: 0x9aa7ae, near: 40, far: 300 } : kind === 'suong' ? { color: 0xd4dadd, near: 12, far: 150 } : { color: sky.fog, near: sky.near, far: sky.far };
    fog.color.setHex(want.color); this.fogWant = { near: want.near, far: want.far };
    if (initial) { fog.near = want.near; fog.far = want.far; }
    const old = this.scene.background as THREE.Texture | null;
    this.scene.background = kind === 'mua' ? gradient(0x6d7d88, 0xa9b5bc) : kind === 'suong' ? gradient(0xc9d2d6, 0xdfe5e7) : gradient(this.opts.theme === 'karst' ? 0x8fc6e6 : 0x6fb9ea, sky.sky);
    if (old && old.isTexture) old.dispose();
    if (this.sun) this.sun.intensity = kind === 'nang' ? 1.75 : kind === 'mua' ? 0.75 : 1.0;
    if (this.hemi) this.hemi.intensity = kind === 'nang' ? 1.45 : 1.25;
    if (this.roadMat) {
      // mặt đường ướt: tối màu hơn và bóng loáng
      this.roadMat.color.setHex(kind === 'mua' ? 0x9a9fa6 : 0xffffff);
      this.roadMat.specular.setHex(kind === 'mua' ? 0x6b7280 : 0x000000); this.roadMat.shininess = kind === 'mua' ? 70 : 8; this.roadMat.needsUpdate = true;
    }
    if (this.rain) this.rain.visible = kind === 'mua';
    if (!initial) this.opts.onEvent?.(kind === 'mua' ? '🌧️ Trời đổ mưa: đường trơn, giảm tốc trước khi vào cua. Ghé quán mua áo mưa để đỡ mất sức.' : kind === 'suong' ? '🌫️ Sương mù kéo xuống: tầm nhìn ngắn, đi chậm.' : '☀️ Trời đã tạnh ráo.', kind === 'nang' ? 'good' : 'info');
  }
  private tickRain(dt: number) {
    if (!this.rain?.visible || !this.rainV) return;
    const v = this.rainV, fall = 22 * dt;
    for (let i = 0; i < v.length; i += 6) { let y = v[i + 1] - fall; if (y < -4) y += 30; v[i + 1] = y; v[i + 4] = y - 0.9; }
    this.rain.position.set(this.camPos.x, this.camPos.y - 8, this.camPos.z);
    (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
  /** Tô màu đoàn cho người cùng đoàn (mã người chơi → màu #rrggbb). */
  setConvoy(colors: Map<number, string>) {
    const changed = colors.size !== this.convoyColors.size || [...colors].some(([k, c]) => this.convoyColors.get(k) !== c);
    if (!changed) return;
    this.convoyColors = new Map(colors);
    for (const [id, it] of this.others) { this.dropOther(it); this.others.delete(id); }
  }
  get weather() { return this.wx; }

  private dropOther(it: Other) { it.m.root.removeFromParent(); disposeTag(it.tag); }
  /** Danh sách người cùng tuyến gần đây (bảng thông tin, kiểm thử). */
  nearby(): { name: string; bot: boolean; aheadKm: number }[] {
    return [...this.others.values()].map((it) => ({ name: it.o.name, bot: it.o.bot, aheadKm: Math.round((it.shown ?? 0) * 10) / 10 })).sort((a, b) => Math.abs(a.aheadKm) - Math.abs(b.aheadKm));
  }

  // ---------------------------------------------------------------- vòng lặp
  private nextStop() { return this.stopsS.find((x) => !x.done && x.s > this.s - 6) ?? null; }
  /** Tốc độ an toàn ở cua (m/s) quanh vị trí s, nhìn trước một quãng. */
  private safeAhead(look: number): { v: number; at: number } {
    let worst = { v: 30, at: 0 };
    for (let d = 0; d <= look; d += 6) {
      const k = Math.abs(this.at_(this.s + d).k); if (k < 1e-4) continue;
      const vs = Math.sqrt((3.6 * this.grip) / k); // gia tốc ngang ~3,6 m/s² là vào cua thoải mái (đường ướt kém bám hơn)
      // cần phanh kịp: v² = vs² + 2·a·d (đường ướt phanh dài hơn)
      const vAllow = Math.sqrt(vs * vs + 2 * 3.2 * this.grip * d);
      if (vAllow < worst.v) worst = { v: vAllow, at: d };
    }
    return worst;
  }

  private resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.quality.resize(w, h); this.camera.aspect = w / h; this.camera.fov = w < h ? 68 : 58; this.camera.updateProjectionMatrix();
  }

  private frame() {
    if (this.disposed) return;
    if (!this.quality.tick()) return;
    // kiểm thử tăng tốc: chạy nhiều bước vật lý nhỏ mỗi khung (không phóng to dt, tránh vượt qua điểm dừng)
    const fast = Math.max(1, Math.min(40, Math.round((window as unknown as { __rideStep?: number }).__rideStep ?? 1)));
    const dt = Math.min(0.05, stepDt(1 / 60));
    for (let i = 0; i < fast && !this.disposed; i++) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private update(dt: number) {
    const o = this.opts, vmax = o.bike.maxKmh / 3.6;
    const t = performance.now() / 1000;
    // --- tự lái (kiểm thử): giữ tốc độ an toàn, ghé mọi điểm dừng
    if (this.auto && !this.paused && !this.arrived && this.fallT <= 0) {
      const safe = this.safeAhead(70), want = Math.min(vmax * 0.95, safe.v * 0.92);
      this.throttle = this.v < want - 0.5 ? 1 : 0; this.brakeIn = this.v > want + 1.5 ? 0.8 : 0;
      const n = this.nextStop(); if (n && !this.stopping && n.s - this.s < 120) this.stopping = { s: n.s, stop: n.stop };
      const slow = this.traffic.find((x) => x.slow && x.s - this.s > 0 && x.s - this.s < 40);
      const oncoming = this.traffic.some((x) => !x.slow && x.s - this.s > -10 && x.s - this.s < 160);
      this.laneWant = slow && !oncoming ? -1 : 1;
      if (this.dry) this.addFuel(1);
    }
    // --- vận tốc
    let acc = 0;
    if (this.paused || this.arrived) { this.v = Math.max(0, this.v - 12 * dt); }
    else if (this.fallT > 0) { this.fallT -= dt; this.v = Math.max(0, this.v - 14 * dt); if (this.fallT <= 0) { this.lat = LANE; this.laneWant = 1; this.opts.onEvent?.('Dựng xe dậy, đi tiếp cẩn thận nhé.', 'info'); } }
    else {
      const climb = (this.at_(this.s + 4).y - this.at_(this.s - 4).y) / 8; // độ dốc
      if (this.dry) { acc = -2.2; }
      else acc = this.throttle * (3.0 - Math.max(0, climb) * 6) - this.brakeIn * 7.5 * this.grip - 0.35 - climb * 3;
      if (this.stopping) {
        const left = this.stopping.s - this.s;
        const want = left <= 0.5 ? 0 : Math.min(vmax, Math.sqrt(2 * 3.5 * Math.max(0, left - 1)) + 0.4);
        if (this.v > want) acc = Math.min(acc, -6); else acc = Math.max(acc, 1.5);
        if (left < 1.2 && this.v < 0.8) { this.v = 0; this.at = this.stopping.stop; this.paused = true; this.stopping = null; this.opts.onStop?.(this.at); }
      }
      this.v = clamp(this.v + acc * dt, 0, vmax);
    }
    this.s = Math.min(this.L, this.s + this.v * dt);
    // --- nhiên liệu theo km thật đã chạy
    const dKm = Math.max(0, (this.s - this.lastS) * this.kmU); this.lastS = this.s;
    if (!this.dry && dKm > 0) { this.fuel -= (dKm * o.bike.per100) / 100; if (this.fuel <= 0) { this.fuel = 0; this.dry = true; this.opts.onEvent?.(o.bike.unit === 'kWh' ? 'Hết pin giữa đường!' : 'Hết xăng giữa đèo! Gọi người chở xăng lên (đắt gấp mấy lần cây xăng).', 'bad'); } }
    this.kmps += ((dt > 0 ? dKm / dt : 0) - this.kmps) * Math.min(1, dt * 1.5);
    // --- cua: quá nhanh thì trượt, quá nữa thì ngã
    const here = this.at_(this.s), latAcc = this.v * this.v * Math.abs(here.k);
    this.hudWarn = null;
    if (this.fallT <= 0 && !this.paused) {
      if (latAcc > 7.2 * this.grip) {
        this.falls++; this.fallT = 2.4; this.v *= 0.3; this.opts.onEvent?.(this.wx === 'mua' ? 'Đường ướt trơn, vào cua quá nhanh nên xe trượt ngã! Trời mưa phải đi chậm hơn nhiều.' : 'Vào cua quá nhanh, xe trượt ngã! Mất chút thời gian và thể lực.', 'bad');
      } else if (latAcc > 5.2 * this.grip) { this.slideT = 0.6; this.hudWarn = { text: this.wx === 'mua' ? 'Đường trơn, bánh xe đang trượt: nhả ga!' : 'Bánh xe đang trượt, giảm ga!', urgent: true }; }
      else {
        const safe = this.safeAhead(80);
        if (safe.v < this.v - 1.5 && safe.at > 4) this.hudWarn = { text: `${this.wx === 'mua' ? '⚠️ Đường trơn! ' : ''}Cua gắt phía trước: giảm còn ${Math.round(safe.v * 3.6)} km/h`, urgent: safe.at < 30 };
      }
    }
    this.slideT = Math.max(0, this.slideT - dt);
    // --- làn đường và xe khác
    const laneX = this.laneWant * LANE; this.lat += (laneX - this.lat) * Math.min(1, dt * 2.2);
    for (const tr of this.traffic) {
      tr.s += (tr.slow ? tr.v : -tr.v) * dt;
      if (tr.slow && tr.s < this.s - 60) tr.s = this.s + 260 + Math.random() * 240;
      if (!tr.slow && tr.s < this.s - 40) tr.s = this.s + 320 + Math.random() * 360;
      if (tr.s > this.L - 15) tr.s = tr.slow ? this.s + 200 : this.L - 15 - Math.random() * 100;
      const pt = this.point(tr.s, tr.lane * LANE), hp = this.at_(tr.s);
      tr.obj.position.copy(pt); tr.obj.rotation.set(0, Math.atan2(-hp.hx, -hp.hz) + (tr.slow ? 0 : Math.PI), 0);
      // va chạm: cùng làn và chồng lên nhau
      const ds = tr.s - this.s, sameLane = Math.abs(this.lat - tr.lane * LANE) < 1.3;
      if (this.fallT <= 0 && !this.paused && sameLane && Math.abs(ds) < tr.len / 2 + 1) {
        if (tr.slow && ds > 0) { this.v = Math.min(this.v, tr.v * 0.7); this.hudWarn = { text: 'Bám đuôi xe chậm: sang làn trái vượt khi đường thoáng', urgent: false }; }
        else if (!tr.slow) { this.falls++; this.fallT = 3; this.v = 0; this.laneWant = 1; this.opts.onEvent?.('Va chạm với xe ngược chiều! Lấn làn khi khuất tầm nhìn rất nguy hiểm.', 'bad'); }
      }
      if (!tr.slow && this.laneWant === -1 && ds > 0 && ds < 120) this.hudWarn = { text: 'Xe ngược chiều! Về làn phải ngay', urgent: true };
      else if (tr.slow && ds > 0 && ds < 35 && this.laneWant === 1 && !this.hudWarn) this.hudWarn = { text: 'Xe chậm phía trước: bấm ◀ để vượt khi thoáng', urgent: false };
    }
    // --- đặt xe, nghiêng khi vào cua
    const bp = this.point(this.s, this.lat), hp = this.at_(this.s);
    this.bike.root.position.copy(bp);
    this.bike.root.rotation.set(0, Math.atan2(-hp.hx, -hp.hz), 0);
    const leanWant = this.fallT > 0 ? -1.35 : clamp(-Math.atan((this.v * this.v * hp.k) / 9.8), -0.75, 0.75) + (this.slideT > 0 ? Math.sin(t * 40) * 0.05 : 0);
    this.leanA += (leanWant - this.leanA) * Math.min(1, dt * (this.fallT > 0 ? 6 : 4));
    this.bike.lean.rotation.z = this.leanA;
    this.wheelSpin -= (this.v * dt) / 0.3; for (const w of this.bike.wheels) w.rotation.x = this.wheelSpin;
    (this.bike.brake.material as THREE.MeshBasicMaterial).color.setHex(this.brakeIn > 0.05 || (this.stopping && this.v > 0.5) ? 0xff2a1a : 0x5a1410);
    this.shade.position.set(bp.x, bp.y + 0.04, bp.z); this.shade.rotation.y = this.bike.root.rotation.y;
    // --- người chơi khác
    const now = performance.now();
    for (const it of this.others.values()) {
      const tt = Math.min(6, (now - it.t0) / 1000), want = it.pos0 + it.v * tt - this.kmNow;
      it.shown = it.shown === null || Math.abs(want - it.shown) > 20 ? want : it.shown + (want - it.shown) * Math.min(1, dt * 3);
      const ds = it.shown / Math.max(1e-6, this.kmU), s2 = this.s + ds, visible = Math.abs(ds) < 420 && s2 > 2 && s2 < this.L - 2;
      it.m.root.visible = visible;
      if (!visible) continue;
      let lat = it.o.sameDir ? it.lane : -it.lane; if (it.o.sameDir && Math.abs(ds) < 6 && Math.abs(lat - this.lat) < 0.9) lat = this.lat > 1.6 ? lat - 1.1 : lat + 1.1;
      const p2 = this.point(s2, lat), h2 = this.at_(s2), vv = Math.abs(it.v) / Math.max(1e-6, this.kmU);
      it.m.root.position.copy(p2); it.m.root.rotation.set(0, Math.atan2(-h2.hx, -h2.hz) + (it.o.sameDir ? 0 : Math.PI), 0);
      it.m.lean.rotation.z = clamp(-Math.atan((vv * vv * h2.k * (it.o.sameDir ? 1 : -1)) / 9.8), -0.6, 0.6);
      for (const w of it.m.wheels) w.rotation.x -= (vv * dt) / 0.3;
      it.tag.visible = Math.abs(ds) < 120;
    }
    // --- máy quay sau lưng, hơi cao, nhìn theo đường phía trước
    const portrait = this.camera.aspect < 1, back = this.point(Math.max(0, this.s - (portrait ? 6.8 : 6.2)), this.lat * 0.7), look = this.point(this.s + 10, this.lat * 0.5);
    back.y += portrait ? 3.1 : 2.5; look.y += portrait ? 0.2 : 0.7;
    if (!this.camInit) { this.camPos.copy(back); this.camLook.copy(look); this.camInit = true; }
    const k = 1 - Math.pow(0.0009, dt);
    this.camPos.lerp(back, k); this.camLook.lerp(look, k);
    // không cho máy quay chui xuống đất (sườn núi)
    const gy = this.groundY(this.camPos.x, this.camPos.z); if (this.camPos.y < gy + 1.2) this.camPos.y = gy + 1.2;
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    if (this.sea) { this.sea.mesh.position.x = this.camPos.x; this.sea.mesh.position.z = this.camPos.z; this.sea.tick(t, 0); }
    // --- thời tiết đổi theo km, sương/mưa kéo tới từ từ
    const wNow = weatherAt(o.weather ?? [], this.kmNow); if (wNow !== this.wx) this.applyWeather(wNow);
    { const fog = this.scene.fog as THREE.Fog, kf = Math.min(1, dt * 0.6); fog.near += (this.fogWant.near - fog.near) * kf; fog.far += (this.fogWant.far - fog.far) * kf; }
    this.tickRain(dt);
    // --- tới đích
    if (!this.arrived && this.s >= this.L - 10) { this.arrived = true; this.v = 0; this.opts.onArrive?.(); }
    // --- bảng thông tin
    this.tickAcc += dt;
    if (this.tickAcc > 0.12) { this.tickAcc = 0; this.opts.onTick?.(this.hud()); }
    // tự lái: tự rời điểm dừng sau một nhịp (UI tự xử lý hành động)
  }

  hud(): MotoHud {
    const n = this.nextStop(), km = this.kmNow;
    return {
      kmh: Math.round(this.v * 3.6), kmDone: Math.round(km * 10) / 10, kmTotal: this.opts.km, progress: clamp(this.s / this.L, 0, 1),
      fuel: Math.round(this.fuel * 100) / 100, tank: this.opts.bike.tank, unit: this.opts.bike.unit, dry: this.dry,
      next: n ? { name: n.stop.name, kind: n.stop.kind, inKm: Math.max(0, Math.round((n.stop.atKm - km) * 10) / 10) } : null,
      at: this.at, canStop: !!n && !this.stopping && !this.paused && n.s - this.s < 260 && n.s - this.s > 2,
      warn: this.hudWarn, lane: this.laneWant, lean: this.leanA, falls: this.falls, others: this.others.size, stopping: !!this.stopping, done: this.arrived, weather: this.wx,
    };
  }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.renderer.setAnimationLoop(null); this.ro.disconnect(); this.link?.stop(); this.quality.dispose();
    for (const it of this.others.values()) this.dropOther(it);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.own) { m.geometry.dispose(); const mm = m.material as THREE.Material & { map?: THREE.Texture }; mm.map?.dispose(); mm.dispose(); } });
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
    if ((window as unknown as { __moto?: MotoScene }).__moto === this) delete (window as unknown as { __moto?: MotoScene }).__moto;
  }
}
