// Cảnh vườn 3D: địa hình theo vùng, nhà, sạp, cây trồng, nhân vật và hiệu ứng.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CROPS, REGIONS, SPECIALTIES, processOf } from '../../../shared/catalog.ts';
import type { Zone } from '../../../shared/catalog.ts';
import { PLOT_COLS, PLOT_ROWS, TILE_COUNT } from '../../../shared/rules.ts';
import type { Listing, Planting } from '../api.ts';
import { GEO, buildPlant, fruitColor, mat, mesh, rng } from './plants.ts';
import type { Stage } from './plants.ts';

const TILE = 2;
const HALF_X = (PLOT_COLS * TILE) / 2, HALF_Z = (PLOT_ROWS * TILE) / 2;
export function tilePos(tile: number): THREE.Vector3 {
  const c = tile % PLOT_COLS, r = Math.floor(tile / PLOT_COLS);
  return new THREE.Vector3((c - (PLOT_COLS - 1) / 2) * TILE, 0, (r - (PLOT_ROWS - 1) / 2) * TILE);
}

interface Theme { grass: number; sea: boolean; mountains: number; hill: number; trees: 'palm' | 'pine' | 'leaf' }
const THEMES: Record<Zone, Theme> = {
  bac: { grass: 0x7fbf5f, sea: false, mountains: 9, hill: 5, trees: 'leaf' },
  trung: { grass: 0x9cc36a, sea: false, mountains: 5, hill: 3, trees: 'leaf' },
  taynguyen: { grass: 0x86b85a, sea: false, mountains: 7, hill: 6, trees: 'pine' },
  nam: { grass: 0x76c26a, sea: false, mountains: 0, hill: 1, trees: 'palm' },
  dao: { grass: 0x8fc46c, sea: true, mountains: 2, hill: 1.5, trees: 'palm' },
};

type Sky = { sky: number; sun: number; sunI: number; sunPos: [number, number, number]; hemiSky: number; hemiGround: number; hemiI: number; night: boolean };
function skyFor(hour: number): Sky {
  if (hour >= 7 && hour < 16.5) return { sky: 0x9fd9f2, sun: 0xfff3d9, sunI: 2.8, sunPos: [14, 22, 10], hemiSky: 0xe4f5ff, hemiGround: 0x8a9a5b, hemiI: 1.5, night: false };
  if ((hour >= 5.3 && hour < 7) || (hour >= 16.5 && hour < 18.6)) return { sky: 0xf6c7a0, sun: 0xffb46e, sunI: 2.4, sunPos: [22, 9, 8], hemiSky: 0xffd9b8, hemiGround: 0x8a7a5b, hemiI: 1.2, night: false };
  return { sky: 0x1d2c50, sun: 0xa9bcff, sunI: 1.1, sunPos: [-12, 20, 8], hemiSky: 0x7f95d6, hemiGround: 0x2a3550, hemiI: 1.1, night: true };
}

export interface SceneState { regionId: string; plantings: Planting[]; stall: Listing[]; selected: number | null; clockOffset: number }
export interface SceneOptions { interactive: boolean; onSelect?: (tile: number | null) => void; hour?: number }

interface Critter { obj: THREE.Group; target: THREE.Vector3; wait: number; speed: number }

export class FarmScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private env = new THREE.Group();
  private plantLayer = new THREE.Group();
  private stallGoods = new THREE.Group();
  private tiles: THREE.Mesh[] = [];
  private plants = new Map<number, { key: string; group: THREE.Group; born: number }>();
  private markers: THREE.Mesh[] = [];
  private ring: THREE.Mesh;
  private farmer = new THREE.Group();
  private farmerParts: { legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Group; armR: THREE.Group };
  private farmerTarget = new THREE.Vector3(-3, 0, -6.6);
  private workUntil = 0;
  private chickens: Critter[] = [];
  private clouds: THREE.Group[] = [];
  private birds: { obj: THREE.Group; r: number; h: number; a: number; w: THREE.Mesh[] }[] = [];
  private smoke: THREE.Mesh[] = [];
  private sparks: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private water: THREE.Mesh | null = null;
  private state: SceneState | null = null;
  private regionId = '';
  private ro: ResizeObserver;
  private down: { x: number; y: number; t: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private sky: Sky;
  private disposed = false;
  autoRotate = false;
  private container: HTMLElement;
  private opts: SceneOptions;

  constructor(container: HTMLElement, opts: SceneOptions) {
    this.container = container; this.opts = opts;
    const now = new Date();
    this.sky = skyFor(opts.hour ?? now.getHours() + now.getMinutes() / 60);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.sky.night ? 1.25 : 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';

    this.scene.background = new THREE.Color(this.sky.sky);
    this.scene.fog = new THREE.Fog(this.sky.sky, 60, 170);
    const hemi = new THREE.HemisphereLight(this.sky.hemiSky, this.sky.hemiGround, this.sky.hemiI);
    const sun = new THREE.DirectionalLight(this.sky.sun, this.sky.sunI);
    sun.position.set(...this.sky.sunPos);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    this.scene.add(hemi, sun, this.env, this.plantLayer);
    const orb = mesh(GEO.ball, new THREE.MeshBasicMaterial({ color: this.sky.night ? 0xf2f4ff : 0xfff4c2, fog: false }), 0, 0, 0, this.sky.night ? 5 : 8);
    orb.castShadow = false; orb.position.set(...this.sky.sunPos).normalize().multiplyScalar(230); this.scene.add(orb);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enablePan: false, enableDamping: true, dampingFactor: 0.08, minPolarAngle: 0.55, maxPolarAngle: 1.3, minDistance: 13, maxDistance: 58, rotateSpeed: 0.6 });
    this.controls.enabled = opts.interactive;

    this.buildPlot();
    this.buildHouse();
    this.buildStall();
    this.farmerParts = this.buildFarmer();
    this.buildSkyLife();
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.22, 4, 1), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.rotation.z = Math.PI / 4; this.ring.visible = false;
    this.scene.add(this.ring);
    for (let i = 0; i < 28; i++) { const m = mesh(GEO.ball, mat(0xffffff), 0, -10, 0, 0.08); m.castShadow = false; m.visible = false; this.scene.add(m); this.sparks.push({ m, v: new THREE.Vector3(), life: 0 }); }

    const el = this.renderer.domElement;
    if (opts.interactive) {
      el.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
      el.addEventListener('pointerup', (e) => {
        const d = this.down; this.down = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 600) return;
        const rect = el.getBoundingClientRect();
        this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
        const hit = this.raycaster.intersectObjects(this.tiles, false)[0];
        opts.onSelect?.(hit ? (hit.object.userData.tile as number) : null);
      });
    }
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize(true);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ dựng cảnh tĩnh
  private buildPlot() {
    const yard = mesh(GEO.box, mat(0xc9ab78), 0, 0.02, 0, HALF_X * 2 + 1.6, 0.06, HALF_Z * 2 + 1.6); yard.castShadow = false; this.scene.add(yard);
    for (let t = 0; t < TILE_COUNT; t++) {
      const p = tilePos(t);
      const tile = mesh(GEO.box, mat((t + Math.floor(t / PLOT_COLS)) % 2 ? 0x9a6a43 : 0xa37248), p.x, 0.07, p.z, TILE - 0.16, 0.08, TILE - 0.16);
      tile.castShadow = false; tile.userData.tile = t; this.tiles.push(tile); this.scene.add(tile);
      const marker = mesh(new THREE.OctahedronGeometry(0.34, 0), mat(0xffd23f, { emissive: 0xffb300, rough: 0.4 }), p.x, 2.4, p.z);
      marker.castShadow = false; marker.visible = false; this.markers.push(marker); this.scene.add(marker);
    }
    // Hàng rào gỗ, chừa cổng phía nhà
    const wood = mat(0x8a5f3a), fx = HALF_X + 0.75, fz = HALF_Z + 0.75;
    const post = (x: number, z: number) => this.scene.add(mesh(GEO.box, wood, x, 0.45, z, 0.14, 0.9, 0.14));
    const rail = (x: number, z: number, sx: number, sz: number) => { this.scene.add(mesh(GEO.box, wood, x, 0.62, z, sx, 0.08, sz), mesh(GEO.box, wood, x, 0.32, z, sx, 0.08, sz)); };
    for (let x = -fx; x <= fx + 0.01; x += (fx * 2) / 9) { post(x, fz); if (Math.abs(x) > 1.2) post(x, -fz); }
    for (let z = -fz + (fz * 2) / 7; z < fz - 0.01; z += (fz * 2) / 7) { post(-fx, z); post(fx, z); }
    rail(0, fz, fx * 2, 0.06); rail(-fx, 0, 0.06, fz * 2); rail(fx, 0, 0.06, fz * 2);
    rail(-(fx + 1.2) / 2, -fz, fx - 1.2, 0.06); rail((fx + 1.2) / 2, -fz, fx - 1.2, 0.06);
    // Lối đi lát đá ra nhà và sạp
    const stone = mat(0xd9cbb0);
    for (let i = 0; i < 5; i++) { const s = mesh(GEO.cyl, stone, (i % 2 ? 0.15 : -0.15), 0.04, -fz - 0.5 - i * 0.75, 0.42, 0.05, 0.36); s.castShadow = false; this.scene.add(s); }
    for (let i = 0; i < 5; i++) { const s = mesh(GEO.cyl, stone, 1 + i * 0.9, 0.04, -fz - 2.2 + (i % 2 ? 0.15 : 0), 0.4, 0.05, 0.34); s.castShadow = false; this.scene.add(s); }
  }

  private buildHouse() {
    const h = new THREE.Group(); h.position.set(-4.2, 0, -10.6);
    const wall = mat(0xf1e2c0), roof = mat(0xb8523a), woodDark = mat(0x6b4a2e);
    const glow = this.sky.night ? mat(0xffe08a, { emissive: 0xffc24a }) : mat(0x9ad0e6, { rough: 0.3 });
    h.add(mesh(GEO.box, mat(0xb9a98a), 0, 0.15, 0, 6.4, 0.3, 4.4), mesh(GEO.box, wall, 0, 1.45, 0, 5.6, 2.3, 3.6));
    const roofGeo = new THREE.CylinderGeometry(0.01, 3.1, 1.7, 4, 1); // mái bốn mặt
    const r = mesh(roofGeo, roof, 0, 3.45, 0, 1.35, 1, 0.95); r.rotation.y = Math.PI / 4; h.add(r);
    h.add(mesh(GEO.box, woodDark, 0, 1.05, 1.82, 0.9, 1.5, 0.08));
    for (const x of [-1.8, 1.8]) h.add(mesh(GEO.box, glow, x, 1.6, 1.82, 0.9, 0.8, 0.06), mesh(GEO.box, woodDark, x, 1.6, 1.84, 1.0, 0.08, 0.05));
    // Hiên nhà
    h.add(mesh(GEO.box, roof, 0, 2.5, 2.5, 6.2, 0.12, 1.5));
    for (const x of [-2.9, -1, 1, 2.9]) h.add(mesh(GEO.cyl, woodDark, x, 1.35, 3.1, 0.08, 2.3, 0.08));
    h.add(mesh(GEO.box, mat(0x9c8f7c), 1.9, 4.1, -0.3, 0.5, 0.9, 0.5));
    // Lu nước và chậu cây trước hiên
    h.add(mesh(GEO.cyl, mat(0x9a5b3c), -3.3, 0.55, 3.2, 0.42, 0.8, 0.42), mesh(GEO.cyl, mat(0x4f8fae, { rough: 0.2 }), -3.3, 0.94, 3.2, 0.36, 0.03, 0.36));
    h.add(mesh(GEO.cyl, mat(0xa9623f), 3.3, 0.4, 3.3, 0.3, 0.45, 0.3), mesh(GEO.ball, mat(0x3f9a4c), 3.3, 0.85, 3.3, 0.38));
    this.scene.add(h);
    if (this.sky.night) { const lamp = new THREE.PointLight(0xffc878, 40, 16, 1.6); lamp.position.set(-4.2, 2.2, -7.2); this.scene.add(lamp); }
    for (let i = 0; i < 7; i++) { const s = mesh(GEO.ball, mat(0xf2f2f2, { transparent: 0.6 }), 0, 0, 0, 0.2); s.castShadow = false; s.userData.phase = i / 7; this.smoke.push(s); this.scene.add(s); }
  }

  private buildStall() {
    const s = new THREE.Group(); s.position.set(5.2, 0, -8.6);
    const wood = mat(0x9a6a3f);
    s.add(mesh(GEO.box, wood, 0, 0.55, 0, 3.4, 1.1, 1.3), mesh(GEO.box, mat(0xc79a62), 0, 1.13, 0.05, 3.6, 0.08, 1.5));
    for (const x of [-1.65, 1.65]) for (const z of [-0.6, 0.6]) s.add(mesh(GEO.cyl, wood, x, 1.4, z, 0.06, 2.8, 0.06));
    for (let i = 0; i < 8; i++) { const strip = mesh(GEO.box, mat(i % 2 ? 0xfff6e0 : 0xe2572b), -1.58 + i * 0.45, 2.85, 0.1, 0.45, 0.08, 2.0); strip.rotation.x = 0.22; s.add(strip); }
    s.add(mesh(GEO.box, mat(0xf6e7c1), 0, 2.45, 1.02, 2.0, 0.42, 0.06));
    s.add(this.stallGoods);
    this.scene.add(s);
  }

  private buildFarmer() {
    const f = this.farmer; f.position.copy(this.farmerTarget);
    const skin = mat(0xe2b58a), shirt = mat(0x8a5a3c), pants = mat(0x3c3a44);
    const legL = mesh(GEO.box, pants, -0.12, 0.3, 0, 0.16, 0.6, 0.18), legR = mesh(GEO.box, pants, 0.12, 0.3, 0, 0.16, 0.6, 0.18);
    f.add(legL, legR, mesh(GEO.cyl, shirt, 0, 0.95, 0, 0.26, 0.75, 0.2), mesh(GEO.ball, skin, 0, 1.52, 0, 0.21));
    const hat = mesh(new THREE.ConeGeometry(0.5, 0.3, 10), mat(0xead9a0), 0, 1.78, 0); f.add(hat); // nón lá
    const arm = (x: number) => { const g = new THREE.Group(); g.position.set(x, 1.25, 0); g.add(mesh(GEO.box, shirt, 0, -0.26, 0, 0.13, 0.55, 0.14), mesh(GEO.ball, skin, 0, -0.56, 0, 0.08)); f.add(g); return g; };
    const armL = arm(-0.34), armR = arm(0.34);
    this.scene.add(f);
    return { legL, legR, armL, armR };
  }

  private buildSkyLife() {
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Group(); const r = rng(100 + i);
      for (let k = 0; k < 4; k++) { const b = mesh(GEO.ball, mat(this.sky.night ? 0x51608c : 0xffffff, { rough: 1 }), k * 2.2 - 3 + r(), r() * 0.8, r() * 1.5, 2 + r() * 1.3, 1.1 + r() * 0.5, 1.8); b.castShadow = false; b.receiveShadow = false; c.add(b); }
      c.position.set(-70 + i * 24, 26 + r() * 8, -45 + r() * 50); c.userData.speed = 0.6 + r() * 0.6; this.clouds.push(c); this.scene.add(c);
    }
    if (!this.sky.night) for (let i = 0; i < 5; i++) {
      const b = new THREE.Group(); const w: THREE.Mesh[] = [];
      for (const side of [-1, 1]) { const wing = mesh(GEO.box, mat(0x2f2f38), side * 0.3, 0, 0, 0.6, 0.03, 0.2); wing.castShadow = false; w.push(wing); b.add(wing); }
      this.birds.push({ obj: b, r: 16 + i * 4, h: 13 + i * 1.5, a: i * 1.3, w }); this.scene.add(b);
    }
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group(); const col = mat(i % 2 ? 0xf4ead2 : 0xb8703e);
      g.add(mesh(GEO.ball, col, 0, 0.3, 0, 0.24, 0.22, 0.3), mesh(GEO.ball, col, 0, 0.55, 0.2, 0.13), mesh(GEO.cone, mat(0xf2a01e), 0, 0.54, 0.35, 0.04, 0.1, 0.04), mesh(GEO.box, mat(0xd0342b), 0, 0.7, 0.2, 0.04, 0.1, 0.12), mesh(GEO.cone, col, 0, 0.42, -0.3, 0.1, 0.25, 0.1));
      (g.children[2] as THREE.Mesh).rotation.x = Math.PI / 2;
      g.position.set(-8.5 + i * 0.8, 0, -7 + i * 0.4);
      this.chickens.push({ obj: g, target: g.position.clone(), wait: i * 0.7, speed: 1.1 + i * 0.15 }); this.scene.add(g);
    }
  }

  private buildEnvironment(regionId: string) {
    this.env.clear(); this.water = null;
    const zone = REGIONS[regionId]?.zone ?? 'nam';
    const th = THEMES[zone];
    const r = rng([...regionId].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const g = new THREE.PlaneGeometry(320, 320, 64, 64); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(th.grass), sand = new THREE.Color(0xe8d9a8), rock = new THREE.Color(0x7d8a6a), dark = new THREE.Color(th.grass).multiplyScalar(0.8);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z * 1.1);
      const n = Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.17) + Math.sin(x * 0.07 + z * 0.11) * 1.4;
      let y = 0;
      if (th.sea) { y = d < 21 ? 0 : -Math.min(3, (d - 21) * 0.28); c.copy(d < 19 ? grass : sand); if (d < 19 && n > 1) c.copy(dark); }
      else { const k = Math.max(0, d - 24) / 30; y = k * k * th.hill * (2.2 + n) + (d > 18 ? n * 0.25 : 0); c.copy(y > 7 ? rock : n > 1 ? dark : grass); }
      pos.setY(i, y); colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    ground.receiveShadow = true; ground.position.y = -0.02; this.env.add(ground);
    if (th.sea) {
      this.water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: this.sky.night ? 0x1f4a6e : 0x3fa7c9, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88 }));
      this.water.position.y = -0.55; this.water.receiveShadow = true; this.env.add(this.water);
      const boat = new THREE.Group(); boat.add(mesh(GEO.box, mat(0x2f6f9a), 0, 0, 0, 2.6, 0.5, 0.9), mesh(GEO.box, mat(0xd94b3a), 0, 0.3, 0, 2.7, 0.1, 1.0), mesh(GEO.cyl, mat(0x6b4a2e), 0.2, 1.0, 0, 0.04, 1.6, 0.04));
      boat.position.set(-27, -0.35, 14); boat.rotation.y = 0.6; boat.userData.boat = true; this.env.add(boat);
    } else if (zone === 'nam') {
      const canal = mesh(GEO.box, new THREE.MeshStandardMaterial({ color: 0x5aa0a8, roughness: 0.25, transparent: true, opacity: 0.9 }), 0, 0.03, 12.5, 200, 0.05, 4.5); canal.castShadow = false; this.env.add(canal);
      const bridge = mesh(GEO.box, mat(0x8a5f3a), -9, 0.35, 12.5, 1.2, 0.1, 5.4); this.env.add(bridge);
    }
    for (let i = 0; i < th.mountains; i++) {
      const a = Math.PI * (0.95 + (i / Math.max(1, th.mountains - 1)) * 1.1) + r() * 0.2, dist = 85 + r() * 40, h = 22 + r() * 26;
      const m = mesh(new THREE.ConeGeometry(18 + r() * 14, h, 6), mat(zone === 'taynguyen' ? 0x5f8a5a : 0x6f8f7a, { rough: 1 }), Math.cos(a) * dist, h / 2 - 2, Math.sin(a) * dist); m.castShadow = false; m.rotation.y = r() * 3; this.env.add(m);
    }
    let placed = 0, guard = 0;
    while (placed < 46 && guard++ < 400) {
      const a = r() * Math.PI * 2, d = 11 + r() * (th.sea ? 8 : 36), x = Math.cos(a) * d, z = Math.sin(a) * d * 0.9;
      if (Math.abs(x) < HALF_X + 2.5 && Math.abs(z) < HALF_Z + 2.5) continue;
      if (x > -9.5 && x < 8.5 && z < -5 && z > -14) continue; // nhà và sạp
      if (z > 8 && Math.abs(x) < 12) continue; // giữ khoảng trống phía máy quay
      if (zone === 'nam' && Math.abs(z - 12.5) < 3.2) continue;
      const k = Math.max(0, Math.hypot(x, z * 1.1) - 24) / 30;
      const t = this.makeTree(th.trees, r); t.position.set(x, th.sea ? 0 : k * k * th.hill * 2.2, z); t.rotation.y = r() * 6; t.scale.setScalar(0.85 + r() * 0.6);
      t.userData.sway = r() * 6; this.env.add(t); placed++;
    }
    for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 9 + r() * 12; const x = Math.cos(a) * d, z = Math.sin(a) * d; if ((Math.abs(x) < HALF_X + 1.2 && Math.abs(z) < HALF_Z + 1.2) || (z < -6 && x > -8 && x < 8)) continue; const b = mesh(GEO.ball, mat(i % 3 ? 0x4fa457 : 0xe7c84a), x, 0.14, z, 0.28 + r() * 0.2, 0.2, 0.28); this.env.add(b); }
  }

  private makeTree(kind: Theme['trees'], r: () => number): THREE.Group {
    const g = new THREE.Group();
    if (kind === 'pine') {
      g.add(mesh(GEO.cyl, mat(0x6b4a2e), 0, 0.6, 0, 0.14, 1.2, 0.14));
      for (let i = 0; i < 3; i++) g.add(mesh(GEO.cone, mat(i % 2 ? 0x2f6e46 : 0x3b8052), 0, 1.5 + i * 0.85, 0, 1.15 - i * 0.28, 1.4, 1.15 - i * 0.28));
    } else if (kind === 'palm') {
      const h = 3 + r() * 1.4; const trunk = mesh(GEO.cyl, mat(0x8a6a45), 0.15, h / 2, 0, 0.13, h, 0.13); trunk.rotation.z = -0.08; g.add(trunk);
      for (let i = 0; i < 7; i++) { const p = new THREE.Group(); p.position.set(0.3, h, 0); p.rotation.y = (i / 7) * 6.28; p.rotation.z = -0.5; p.add(mesh(GEO.sphere, mat(i % 2 ? 0x3f9a4c : 0x58b060), 0.95, 0, 0, 1.05, 0.06, 0.26)); g.add(p); }
      g.add(mesh(GEO.ball, mat(0x7a9a3a), 0.3, h - 0.2, 0.15, 0.17), mesh(GEO.ball, mat(0x7a9a3a), 0.15, h - 0.22, -0.1, 0.17));
    } else {
      g.add(mesh(GEO.cyl, mat(0x6b4a2e), 0, 0.8, 0, 0.16, 1.6, 0.16));
      g.add(mesh(GEO.ball, mat(0x3b8a48), -0.5, 2.0, 0.1, 0.95), mesh(GEO.ball, mat(0x4fa457), 0.55, 2.1, -0.1, 1.0), mesh(GEO.ball, mat(0x6cc06a), 0, 2.75, 0.1, 1.05));
    }
    return g;
  }

  // ------------------------------------------------------------ trạng thái động
  setState(state: SceneState) {
    if (state.regionId !== this.regionId) { this.regionId = state.regionId; this.buildEnvironment(state.regionId); }
    const prevSelected = this.state?.selected ?? null;
    this.state = state;
    const seen = new Set<number>();
    for (const p of state.plantings) {
      seen.add(p.tile);
      const crop = CROPS[SPECIALTIES[p.specialtyId].crop];
      const last = processOf(crop).length - 1;
      const prog = p.stepIndex / last;
      const stage: Stage = p.stepIndex >= last ? 3 : prog < 0.3 ? 0 : prog < 0.65 ? 1 : 2;
      const key = `${p.id}:${stage}`;
      const cur = this.plants.get(p.tile);
      if (cur?.key === key) continue;
      if (cur) this.plantLayer.remove(cur.group);
      const group = buildPlant(crop, stage, p.id * 7 + p.tile);
      group.position.copy(tilePos(p.tile)); group.userData.sway = p.tile * 0.7;
      this.plantLayer.add(group);
      this.plants.set(p.tile, { key, group, born: this.clock.elapsedTime });
    }
    for (const [tile, cur] of this.plants) if (!seen.has(tile)) { this.plantLayer.remove(cur.group); this.plants.delete(tile); }
    if (state.selected !== null && state.selected !== prevSelected) {
      const p = tilePos(state.selected); this.farmerTarget.set(p.x, 0, p.z + 1.05);
    }
    // Hàng bày trên sạp
    this.stallGoods.clear();
    const kinds = [...new Set(state.stall.map((l) => SPECIALTIES[l.specialtyId].crop))].slice(0, 4);
    kinds.forEach((cropId, i) => {
      const x = -1.2 + i * 0.8; const r = rng(i + 3);
      this.stallGoods.add(mesh(GEO.box, mat(0xb98a55), x, 1.3, 0.1, 0.62, 0.26, 0.62));
      const color = fruitColor(cropId);
      for (let k = 0; k < 6; k++) this.stallGoods.add(mesh(GEO.ball, mat(color, { rough: 0.5 }), x + (r() - 0.5) * 0.4, 1.5 + (k > 3 ? 0.14 : 0), 0.1 + (r() - 0.5) * 0.4, 0.13));
    });
  }

  /** Hiệu ứng khi vừa làm xong một bước trên ô đất. */
  burst(tile: number, kind: 'water' | 'soil' | 'leaf' | 'harvest') {
    const color = { water: 0x6ec6f2, soil: 0x9a6a43, leaf: 0x7fd36a, harvest: 0xffd84a }[kind];
    const p = tilePos(tile);
    for (const s of this.sparks) {
      s.m.material = mat(color, kind === 'harvest' ? { emissive: 0xffb300, rough: 0.4 } : { rough: 0.5 });
      s.m.position.set(p.x + (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.8, p.z + (Math.random() - 0.5) * 1.2);
      s.v.set((Math.random() - 0.5) * 2.4, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 2.4);
      s.life = 0.9 + Math.random() * 0.5; s.m.visible = true;
    }
    this.farmerTarget.set(p.x, 0, p.z + 1.05);
    this.workUntil = this.clock.elapsedTime + 1.4;
  }

  /** Toạ độ màn hình (px, tính trong khung chứa) của tâm một ô đất; dùng cho kiểm thử tự động. */
  screenPos(tile: number): { x: number; y: number } {
    const v = tilePos(tile).setY(0.1).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.container.clientWidth, y: ((1 - v.y) / 2) * this.container.clientHeight };
  }

  private resize(first = false) {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (first) {
      const portrait = w / h < 0.9;
      // Màn ngang: dịch vườn sang trái để chừa chỗ cho bảng thao tác bên phải.
      this.controls.target.set(portrait ? 0.6 : 2.5, 0.5, portrait ? 0 : -1.5);
      const dist = portrait ? 47 : 25;
      this.camera.position.set(this.controls.target.x + dist * 0.42, dist * 0.6, dist * 0.68 + this.controls.target.z);
      this.controls.update();
    }
  }

  private frame() {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    const st = this.state;
    this.controls.autoRotate = this.autoRotate; this.controls.autoRotateSpeed = 0.5;
    this.controls.update();
    // Cây: lớn dần khi vừa đổi giai đoạn, đung đưa theo gió
    for (const [, p] of this.plants) {
      const k = Math.min(1, (t - p.born) / 0.5); const ease = 1 - Math.pow(1 - k, 3);
      p.group.scale.setScalar(0.6 + 0.4 * ease + (k < 1 ? Math.sin(k * Math.PI) * 0.12 : 0));
      p.group.rotation.z = Math.sin(t * 1.3 + p.group.userData.sway) * 0.025;
    }
    for (const o of this.env.children) {
      if (o.userData.sway !== undefined) o.rotation.z = Math.sin(t * 0.9 + o.userData.sway) * 0.03;
      if (o.userData.boat) { o.position.y = -0.35 + Math.sin(t * 1.2) * 0.08; o.rotation.z = Math.sin(t * 0.9) * 0.05; }
    }
    if (this.water) this.water.position.y = -0.55 + Math.sin(t * 0.8) * 0.06;
    // Dấu báo đến giờ chăm sóc
    const now = Date.now() + (st?.clockOffset ?? 0);
    const byTile = new Map((st?.plantings ?? []).map((p) => [p.tile, p]));
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i], p = byTile.get(i);
      const ready = !!p && now >= p.stepReadyAt;
      m.visible = ready;
      if (ready) { m.position.y = 2.5 + Math.sin(t * 3 + i) * 0.18; m.rotation.y = t * 2; }
    }
    if (st && st.selected !== null) { const p = tilePos(st.selected); this.ring.visible = true; this.ring.position.set(p.x, 0.16, p.z); (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(t * 5) * 0.25; this.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.03); } else this.ring.visible = false;
    this.moveFarmer(dt, t);
    this.moveCritters(dt, t);
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt; s.v.y -= 9 * dt; s.m.position.addScaledVector(s.v, dt); s.m.scale.setScalar(Math.max(0.01, 0.1 * s.life));
      if (s.life <= 0 || s.m.position.y < 0) { s.life = 0; s.m.visible = false; }
    }
    this.renderer.render(this.scene, this.camera);
  }

  private moveFarmer(dt: number, t: number) {
    const f = this.farmer, d = new THREE.Vector3().subVectors(this.farmerTarget, f.position); d.y = 0;
    const dist = d.length();
    const { legL, legR, armL, armR } = this.farmerParts;
    if (dist > 0.08) {
      d.normalize(); f.position.addScaledVector(d, Math.min(dist, 4.2 * dt));
      f.rotation.y = Math.atan2(d.x, d.z);
      const sw = Math.sin(t * 11) * 0.6; legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw; armR.rotation.x = sw;
      f.position.y = Math.abs(Math.sin(t * 11)) * 0.05;
    } else {
      legL.rotation.x = legR.rotation.x = 0; f.position.y = 0;
      if (this.state?.selected !== null && this.state) f.rotation.y = Math.PI; // quay mặt vào ô đất
      if (t < this.workUntil) { const sw = Math.sin(t * 14); armL.rotation.x = -1.3 + sw * 0.5; armR.rotation.x = -1.3 - sw * 0.5; f.position.y = Math.abs(sw) * 0.04; }
      else { armL.rotation.x = Math.sin(t * 1.5) * 0.05; armR.rotation.x = -Math.sin(t * 1.5) * 0.05; }
    }
  }

  private moveCritters(dt: number, t: number) {
    for (const c of this.chickens) {
      const d = new THREE.Vector3().subVectors(c.target, c.obj.position); const dist = d.length();
      if (dist < 0.1) {
        c.wait -= dt;
        c.obj.children[1].position.y = 0.55 - Math.max(0, Math.sin(t * 6 + c.speed * 9)) * 0.22; // mổ thóc
        if (c.wait <= 0) { c.wait = 1.5 + Math.random() * 3; const side = Math.random(); c.target.set(side < 0.5 ? -8 - Math.random() * 3 : -7.5 + Math.random() * 15, 0, side < 0.5 ? -6 + Math.random() * 11 : 6.6 + Math.random() * 1.6); }
      } else { d.normalize(); c.obj.position.addScaledVector(d, Math.min(dist, c.speed * dt)); c.obj.rotation.y = Math.atan2(d.x, d.z); c.obj.position.y = Math.abs(Math.sin(t * 14)) * 0.04; c.obj.children[1].position.y = 0.55; }
    }
    for (const c of this.clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 95) c.position.x = -95; }
    for (const b of this.birds) {
      b.a += dt * 0.25; b.obj.position.set(Math.cos(b.a) * b.r, b.h + Math.sin(b.a * 3) * 0.8, Math.sin(b.a) * b.r - 6); b.obj.rotation.y = -b.a;
      const flap = Math.sin(t * 9 + b.r) * 0.6; b.w[0].rotation.z = flap; b.w[1].rotation.z = -flap;
    }
    for (const s of this.smoke) {
      const k = (t * 0.22 + s.userData.phase) % 1;
      s.position.set(-2.3 + Math.sin(k * 5) * 0.3 + k * 0.8, 4.7 + k * 3.2, -10.9); s.scale.setScalar(0.14 + k * 0.4);
      (s.material as THREE.MeshStandardMaterial).opacity = 0.6;
      s.visible = k < 0.95;
    }
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect(); this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
