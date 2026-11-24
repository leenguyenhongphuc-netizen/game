// Mô hình và chất liệu bổ sung cho màn lái: biển giới hạn tốc độ, tổ CSGT, trạm dừng nghỉ, ca-bin (góc nhìn người lái),
// phà thép, mặt biển có sóng, vệt nước, hải đăng, tàu hàng, chim biển, mây, vài kiểu nhà cửa ven đường.
import * as THREE from 'three';
import { GEO, mat, mesh } from '../scene/plants.ts';

const box = (c: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, o?: { emissive?: number; rough?: number }) => mesh(GEO.box, mat(c, o), x, y, z, sx, sy, sz);
const cyl = (c: number, x: number, y: number, z: number, r: number, h: number, o?: { emissive?: number; rough?: number }) => mesh(GEO.cyl, mat(c, o), x, y, z, r, h, r);

function canvasSprite(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, fog = true): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog }));
}

/** Biển tròn viền đỏ "tốc độ tối đa cho phép" (P.127). */
export function limitSprite(v: number, size = 2.3): THREE.Sprite {
  const sp = canvasSprite(160, 160, (g) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(80, 80, 78, 0, 7); g.fill();
    g.fillStyle = '#d7261c'; g.beginPath(); g.arc(80, 80, 74, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(80, 80, 56, 0, 7); g.fill();
    g.fillStyle = '#16181c'; g.font = `800 ${v >= 100 ? 62 : 76}px "Baloo 2", "Be Vietnam Pro", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), 80, 86);
  });
  sp.scale.set(size, size, 1); return sp;
}
/** Biển tròn xanh "tốc độ tối thiểu" (R.306). */
export function minSprite(v: number, size = 1.9): THREE.Sprite {
  const sp = canvasSprite(160, 160, (g) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(80, 80, 78, 0, 7); g.fill();
    g.fillStyle = '#1f5fbf'; g.beginPath(); g.arc(80, 80, 72, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.font = '800 76px "Baloo 2", "Be Vietnam Pro", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), 80, 86);
  });
  sp.scale.set(size, size, 1); return sp;
}

/** Tổ CSGT: xe đặc chủng, chiến sĩ cầm gậy, máy bắn tốc độ trên chân ba càng. Mặt quay về hướng xe tới (+z). */
export function policeUnit(): { root: THREE.Group; lights: THREE.Mesh[] } {
  const g = new THREE.Group();
  // xe
  g.add(box(0xf7f7f2, 1.6, 0.7, -3, 1.8, 0.7, 4.2), box(0xf7f7f2, 1.6, 1.3, -2.8, 1.6, 0.6, 2.3), box(0x1f4fa8, 1.6, 0.72, -3, 1.84, 0.22, 4.24), box(0x9fd3ea, 1.6, 1.32, -1.62, 1.45, 0.45, 0.06, { rough: 0.3 }), box(0x9fd3ea, 1.6, 1.32, -3.98, 1.45, 0.45, 0.06, { rough: 0.3 }));
  for (const [x, z] of [[0.72, -4.3], [2.48, -4.3], [0.72, -1.7], [2.48, -1.7]]) { const w = cyl(0x2c3038, x, 0.36, z, 0.36, 0.28); w.rotation.z = Math.PI / 2; g.add(w); }
  const red = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: 0xff3b30 })), blue = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: 0x2f7bff }));
  red.position.set(1.25, 1.72, -2.8); red.scale.set(0.6, 0.2, 0.3); blue.position.set(1.95, 1.72, -2.8); blue.scale.set(0.6, 0.2, 0.3); g.add(red, blue);
  // chiến sĩ: quần áo vàng kaki, mũ kê-pi, gậy đen trắng
  const cop = (x: number, z: number, baton: boolean) => {
    g.add(cyl(0xcfa94a, x - 0.13, 0.45, z, 0.11, 0.9), cyl(0xcfa94a, x + 0.13, 0.45, z, 0.11, 0.9), cyl(0xd9b354, x, 1.25, z, 0.27, 0.75), mesh(GEO.ball, mat(0xf2cfa5), x, 1.86, z, 0.21), cyl(0xcfa94a, x, 2.04, z, 0.25, 0.1), cyl(0xcfa94a, x, 2.12, z, 0.17, 0.12), box(0x1c1c1c, x, 2.01, z + 0.2, 0.3, 0.03, 0.16));
    g.add(box(0xfff06a, x, 1.3, z, 0.57, 0.16, 0.57, { emissive: 0xfff06a }));
    if (baton) { const b = new THREE.Group(); b.position.set(x - 0.35, 1.5, z + 0.1); b.rotation.z = 0.9; b.add(cyl(0xffffff, 0, 0.35, 0, 0.045, 0.7), cyl(0x1c1c1c, 0, 0.2, 0, 0.05, 0.2), cyl(0xe0342b, 0, 0.6, 0, 0.05, 0.16)); g.add(b); }
  };
  cop(-0.2, 0.6, true); cop(0.9, 1.6, false);
  // máy bắn tốc độ
  for (const a of [0, 2.09, 4.19]) { const l = cyl(0x30343c, 0.9 + Math.cos(a) * 0.22, 0.6, 2.5 + Math.sin(a) * 0.22, 0.03, 1.25); l.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); g.add(l); }
  g.add(box(0x23262c, 0.9, 1.32, 2.5, 0.3, 0.24, 0.42), cyl(0x4a90d9, 0.9, 1.32, 2.74, 0.09, 0.06, { rough: 0.2 }));
  // cọc tiêu
  for (let i = 0; i < 3; i++) g.add(mesh(GEO.cone, mat(0xf0682a), -0.9, 0.3, 4 + i * 2.6, 0.22, 0.6, 0.22), cyl(0xffffff, -0.9, 0.34, 4 + i * 2.6, 0.13, 0.08));
  return { root: g, lights: [red, blue] };
}

/** Trạm dừng nghỉ: nhà hàng mái đỏ, nhà vệ sinh, bãi đỗ có xe, bàn ghế dù. Gốc toạ độ ở mép làn phụ (như trạm xăng). */
export function restStop(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0xb8bec6, 6.5, 0.02, 0, 15, 0.04, 30, { rough: 1 }));
  for (let i = 0; i < 6; i++) g.add(box(0xffffff, 2.3, 0.05, -11 + i * 4.4, 2.6, 0.02, 0.14));
  g.add(box(0xffffff, 1.0, 0.05, 0, 0.14, 0.02, 22.2));
  // xe đang đỗ
  const car = (c: number, z: number) => { g.add(box(c, 2.4, 0.6, z, 1.7, 0.6, 3.6), box(c, 2.4, 1.08, z + 0.1, 1.5, 0.45, 1.9), box(0xbfe6f7, 2.4, 1.1, z - 0.87, 1.36, 0.36, 0.05, { rough: 0.3 })); };
  car(0xd9482b, -8.8); car(0xffffff, 4.4); car(0x4a78c8, 8.8);
  // nhà hàng
  g.add(box(0xfff3da, 10, 1.9, -3, 6.5, 3.8, 13), box(0x8ec9dc, 6.72, 1.9, -3, 0.06, 2.2, 10.5, { rough: 0.3 }), box(0xd4523a, 10, 4.1, -3, 7.6, 0.5, 14.2), box(0xb8432e, 10, 4.6, -3, 5.4, 0.5, 12));
  g.add(box(0xe8dcc0, 5.6, 3.3, -3, 2.4, 0.14, 13.4));
  for (const z of [-8.6, -3, 2.6]) g.add(cyl(0xf3f4f6, 4.6, 1.65, z, 0.1, 3.3));
  // nhà vệ sinh
  g.add(box(0xe9eef2, 10.5, 1.4, 9, 4.6, 2.8, 4.4), box(0x4a90d9, 10.5, 2.95, 9, 5, 0.3, 4.8), box(0x7a4a22, 8.18, 1.1, 8, 0.06, 2.0, 0.9), box(0x7a4a22, 8.18, 1.1, 10, 0.06, 2.0, 0.9));
  // bàn ghế có dù
  for (const [x, z, c] of [[5.4, 6.2, 0xf4c430], [5.4, 11.2, 0xe8457f]] as [number, number, number][]) g.add(cyl(0xc9975a, x, 0.75, z, 0.6, 0.08), cyl(0x8f97a3, x, 1.2, z, 0.04, 2.4), mesh(GEO.cone, mat(c), x, 2.5, z, 1.3, 0.6, 1.3));
  for (const z of [-13.5, 13.5]) { g.add(cyl(0x9a7150, 12.6, 0.9, z, 0.2, 1.8), mesh(GEO.ball, mat(0x5cb85f), 12.6, 2.6, z, 1.5)); }
  return g;
}

/** Nội thất ca-bin nhìn từ ghế lái (gắn vào máy quay; máy quay nhìn về -z). */
export function cabin(bodyColor: number): { root: THREE.Group; wheel: THREE.Group; needle: THREE.Mesh; roof: THREE.Group } {
  const g = new THREE.Group();
  const m = (c: number, rough = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, fog: false });
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  const dark = m(0x2b2f36), mid = m(0x3d434c), body = m(bodyColor, 0.6);
  add(GEO.box, body, 0.42, -0.98, -2.15, 2.1, 0.22, 1.1);                 // nắp ca-pô
  add(GEO.box, dark, 0.42, -0.72, -1.25, 2.9, 0.46, 0.8);                 // táp-lô
  add(GEO.box, mid, 0.42, -0.5, -1.42, 2.9, 0.08, 0.5);
  add(GEO.box, mid, 0, -0.46, -1.08, 0.74, 0.3, 0.3);                     // cụm đồng hồ
  const dial = add(GEO.cyl, new THREE.MeshBasicMaterial({ color: 0xf6f1e3, fog: false }), 0, -0.44, -0.925, 0.115, 0.01, 0.115); dial.rotation.x = Math.PI / 2 - 0.25;
  const needle = add(GEO.box, new THREE.MeshBasicMaterial({ color: 0xe0342b, fog: false }), 0, -0.44, -0.915, 0.012, 0.1, 0.004); needle.geometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); needle.rotation.x = -0.25;
  // cột A, mép trần, gương
  const pl = add(GEO.box, dark, -1.02, 0.12, -1.7, 0.055, 1.9, 0.08); pl.rotation.z = 0.2; pl.rotation.x = -0.35;
  const pr = add(GEO.box, dark, 1.86, 0.12, -1.7, 0.055, 1.9, 0.08); pr.rotation.z = -0.2; pr.rotation.x = -0.35;
  const roof = new THREE.Group(); g.add(roof);
  roof.add(add(GEO.box, dark, 0.42, 0.86, -1.1, 3.0, 0.2, 0.6), add(GEO.box, dark, 0.42, 0.62, -1.2, 0.34, 0.1, 0.05));                  // mép trần, gương trong
  roof.add(add(GEO.box, new THREE.MeshStandardMaterial({ color: 0x9fb7c9, roughness: 0.15, metalness: 0.6, fog: false }), 0.42, 0.62, -1.17, 0.3, 0.07, 0.02));
  for (const sx of [-1, 1]) { const x = 0.42 + sx * 1.78; add(GEO.box, dark, x, -0.3, -1.6, 0.05, 0.05, 0.3); add(GEO.box, dark, x + sx * 0.12, -0.2, -1.72, 0.2, 0.3, 0.05); add(GEO.box, new THREE.MeshStandardMaterial({ color: 0x9fb7c9, roughness: 0.15, metalness: 0.6, fog: false }), x + sx * 0.12, -0.2, -1.69, 0.16, 0.25, 0.02); }
  // vô-lăng
  const col = new THREE.Group(); col.position.set(0, -0.55, -0.82); col.rotation.x = -0.42; g.add(col);
  const wheel = new THREE.Group(); col.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.028, 8, 28), dark); wheel.add(rim);
  for (const a of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]) { const s = new THREE.Mesh(GEO.box, mid); s.scale.set(0.24, 0.04, 0.03); s.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0); s.rotation.z = a; wheel.add(s); }
  const hub = new THREE.Mesh(GEO.cyl, mid); hub.scale.set(0.06, 0.04, 0.06); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  g.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) { me.castShadow = false; me.receiveShadow = false; me.frustumCulled = false; me.renderOrder = 10; } });
  return { root: g, wheel, needle, roof };
}

/** Phà thép chở xe: thân, boong, cửa dốc, lan can, ca-bin lái, ống khói, phao cứu sinh. Mũi hướng -z. */
export function ferry(extra: THREE.Object3D[] = []): THREE.Group {
  const g = new THREE.Group(), hull = 0x2f4a6b, deck = 0x8a929c, white = 0xf4f1e8;
  g.add(box(hull, 0, 0.35, 0.6, 4.6, 1.3, 11), box(0xb23a2e, 0, -0.2, 0.6, 4.5, 0.3, 10.8), box(deck, 0, 1.04, 0.6, 4.4, 0.1, 10.8), box(0xffffff, 0, 0.92, 0.6, 4.66, 0.1, 11.06));
  const bow = mesh(GEO.cone, mat(hull), 0, 0.35, -5.9, 2.3, 2.6, 0.65); bow.rotation.x = -Math.PI / 2; g.add(bow);
  const ramp = box(0x6f7882, 0, 1.25, -5.4, 3.2, 0.1, 1.8); ramp.rotation.x = 0.5; g.add(ramp);
  // vạch đỗ trên boong
  for (const x of [-1.1, 1.1]) g.add(box(0xf2c94c, x, 1.1, -0.6, 0.08, 0.02, 7));
  // lan can
  for (const sx of [-1, 1]) { g.add(box(white, sx * 2.2, 1.95, 0.2, 0.06, 0.06, 9.6), box(white, sx * 2.2, 1.55, 0.2, 0.05, 0.05, 9.6)); for (let z = -4.4; z <= 5; z += 1.2) g.add(box(white, sx * 2.2, 1.5, z, 0.06, 0.95, 0.06)); for (const z of [-2, 2.4]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.09, 6, 12), mat(0xf0682a)); r.position.set(sx * 2.26, 1.55, z); r.rotation.y = Math.PI / 2; r.castShadow = true; g.add(r); } }
  // tháp lái phía đuôi
  g.add(box(white, 0, 2.2, 4.6, 4.2, 2.3, 2.4), box(0x2f3a4a, 0, 2.5, 3.38, 3.6, 0.7, 0.05), box(white, 0, 3.95, 4.5, 3.0, 1.3, 1.9), box(0x9fd3ea, 0, 4.05, 3.53, 2.6, 0.6, 0.05, { rough: 0.25 }), box(0x9fd3ea, -1.51, 4.05, 4.4, 0.05, 0.6, 1.3, { rough: 0.25 }), box(0x9fd3ea, 1.51, 4.05, 4.4, 0.05, 0.6, 1.3, { rough: 0.25 }), box(0xd9dde2, 0, 4.66, 4.5, 3.4, 0.12, 2.3));
  g.add(cyl(0xe0342b, 1.0, 5.6, 5.1, 0.42, 1.8), cyl(0x1c1c1c, 1.0, 6.4, 5.1, 0.44, 0.3), cyl(0xffffff, 1.0, 5.8, 5.1, 0.43, 0.3));
  g.add(cyl(0x8f97a3, -0.9, 5.7, 4.4, 0.04, 2.0), box(0x8f97a3, -0.9, 6.3, 4.4, 0.9, 0.05, 0.05), box(0xe0342b, -0.55, 6.5, 4.42, 0.62, 0.42, 0.03), mesh(GEO.ball, mat(0xffd23f), -0.55, 6.5, 4.45, 0.1));
  for (const o of extra) g.add(o);
  return g;
}

/** Tàu hàng chở container đi xa ngoài luồng. */
export function cargoShip(): THREE.Group {
  const g = new THREE.Group(), cols = [0xc0392b, 0x2e7d6b, 0x3b6fb5, 0xd98a2b, 0xf2c94c];
  g.add(box(0x1f2f45, 0, 1.2, 0, 7, 3.2, 40), box(0xa8362b, 0, -0.3, 0, 6.9, 0.6, 39.8));
  const bow = mesh(GEO.cone, mat(0x1f2f45), 0, 1.2, -22.5, 3.5, 5, 1.6); bow.rotation.x = -Math.PI / 2; g.add(bow);
  for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 1 + ((i + j) % 3); k++) g.add(box(cols[(i * 3 + j + k) % 5], -1.6 + j * 3.2, 3.6 + k * 1.5, -15 + i * 4.2, 3.0, 1.4, 3.9));
  g.add(box(0xf4f1e8, 0, 5.6, 16.5, 6, 6, 4.5), box(0x2f3a4a, 0, 7.4, 14.22, 5.4, 0.8, 0.06), cyl(0xe0342b, 0, 9.8, 17.5, 0.9, 2.6));
  return g;
}

export function lighthouse(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(GEO.sphere, mat(0x8f9aa3, { rough: 1 }), 0, 0.2, 0, 7, 2.2, 6), mesh(GEO.sphere, mat(0xa3acb2, { rough: 1 }), 3.5, 0, 2, 3.5, 1.4, 3));
  for (let i = 0; i < 5; i++) g.add(cyl(i % 2 ? 0xe0342b : 0xffffff, 0, 2.6 + i * 2.2, 0, 1.25 - i * 0.14, 2.2));
  g.add(cyl(0x2f3a4a, 0, 13.9, 0, 0.95, 0.3), cyl(0xfff3b0, 0, 14.6, 0, 0.6, 1.1, { emissive: 0xffe08a }), mesh(GEO.cone, mat(0xe0342b), 0, 15.7, 0, 0.9, 1.1, 0.9));
  return g;
}

/** Chim biển: hai cánh đập quanh trục dọc thân. */
export function bird(): { root: THREE.Group; wings: THREE.Mesh[] } {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const body = new THREE.Mesh(GEO.box, m); body.scale.set(0.16, 0.12, 0.6); g.add(body);
  const wings: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.34).translate(0.5 * sx, 0, 0), m); wings.push(w); g.add(w); }
  return { root: g, wings };
}

/** Mây trôi và mặt trời ở xa (không bị sương che). */
export function skyDecor(): THREE.Group {
  const g = new THREE.Group();
  const cloud = canvasSprite(256, 128, (c) => { const grd = c.createRadialGradient(128, 70, 10, 128, 70, 120); grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = grd; for (const [x, y, r] of [[80, 78, 44], [128, 62, 56], [176, 78, 46], [128, 86, 60]]) { c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0, 0, 7); c.fill(); } }, false);
  for (let i = 0; i < 9; i++) { const s = cloud.clone(); const a = -1.25 + i * 0.31 + Math.sin(i * 7.1) * 0.08; s.position.set(Math.sin(a) * 330, 62 + (i * 37 % 48), -Math.cos(a) * 330); const k = 70 + (i * 53 % 60); s.scale.set(k, k * 0.42, 1); g.add(s); }
  const sun = canvasSprite(128, 128, (c) => { const grd = c.createRadialGradient(64, 64, 6, 64, 64, 64); grd.addColorStop(0, 'rgba(255,253,235,1)'); grd.addColorStop(0.28, 'rgba(255,244,190,0.95)'); grd.addColorStop(1, 'rgba(255,240,170,0)'); c.fillStyle = grd; c.fillRect(0, 0, 128, 128); }, false);
  sun.position.set(150, 150, -300); sun.scale.set(90, 90, 1); g.add(sun);
  return g;
}

/** Mặt biển: sóng lăn tăn, phản chiếu trời theo góc nhìn, lấp lánh nắng, bọt trắng; tự hoà vào sương xa. */
export function seaMaterial(fog: THREE.Fog): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uOff: { value: new THREE.Vector2() }, uDeep: { value: new THREE.Color(0x0f6fa6) }, uShallow: { value: new THREE.Color(0x2fa8cc) }, uSky: { value: new THREE.Color(0xbfe6fa) }, uFog: { value: fog.color }, uNear: { value: fog.near }, uFar: { value: fog.far }, uSun: { value: new THREE.Vector3(0.35, 0.55, -0.75).normalize() } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform float uT, uNear, uFar; uniform vec2 uOff; uniform vec3 uDeep, uShallow, uSky, uFog, uSun; varying vec3 vW;
      float h(vec2 p){ return sin(p.x*0.33+uT*1.1)*0.5 + sin(p.y*0.47-uT*1.5+p.x*0.11)*0.35 + sin((p.x-p.y)*0.95+uT*2.1)*0.15; }
      void main(){
        vec2 p = vec2(vW.x + uOff.x, uOff.y - vW.z);
        float e = 0.4, hx = h(p+vec2(e,0.))-h(p-vec2(e,0.)), hz = h(p+vec2(0.,e))-h(p-vec2(0.,e));
        vec3 n = normalize(vec3(-hx*0.8, 1.0, hz*0.8));
        vec3 v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 col = mix(uDeep, uShallow, 0.5 + 0.5*h(p*0.45));
        col = mix(col, uSky, clamp(fr*0.55 + 0.04, 0.0, 0.8));
        float sp = pow(max(dot(reflect(-uSun, n), v), 0.0), 48.0); col += vec3(1.0, 0.96, 0.82) * sp * 0.45;
        float foam = smoothstep(0.86, 1.0, h(p*1.9) + 0.3*sin(p.x*2.7+uT*1.3)); col = mix(col, vec3(1.0), foam*0.22);
        col = mix(col, uFog, smoothstep(uNear, uFar, length(cameraPosition - vW)));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Vệt nước hình chữ V sau đuôi tàu (đặt làm con của tàu, đuôi tàu ở +z). */
export function wake(): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d')!;
  for (let y = 0; y < 256; y += 2) { const q = y / 256, half = 10 + q * 50, a = (1 - q) * 0.75; g.fillStyle = `rgba(255,255,255,${a * 0.35})`; g.fillRect(64 - half, y, half * 2, 2); g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(64 - half - 3, y, 6, 2); g.fillRect(64 + half - 3, y, 6, 2); if ((y / 2) % 7 < 3) g.fillRect(64 - half * 0.5 + Math.sin(y) * 6, y, half * 0.6, 2); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 30).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 }));
  m.position.set(0, 0.06, 20.5); m.renderOrder = 2; return m;
}

// ---------------------------------------------------------------- cảnh ven đường bổ sung
export const MORE: Record<string, () => THREE.Group> = {
  // Nhà ống ba tầng ven quốc lộ
  tube: () => { const g = new THREE.Group(), c = [0xfff0c9, 0xd9ecf5, 0xffe0d2, 0xe3f2d5][Math.floor(Math.random() * 4)], f = 2 + Math.floor(Math.random() * 2); g.scale.setScalar(0.72); g.add(box(c, 0, f * 1.45, 0, 3.0, f * 2.9, 6)); for (let i = 0; i < f; i++) { g.add(box(0x7fb6d1, 0, 1.6 + i * 2.9, 3.02, 1.6, 1.3, 0.05, { rough: 0.3 })); if (i) g.add(box(0xe9eef2, 0, 0.55 + i * 2.9, 3.4, 2.9, 0.7, 0.7)); } g.add(box(0x7a4a22, 0, 1.0, 3.03, 1.9, 2.0, 0.05), box(0xd4523a, 0, f * 2.9 + 0.15, 0, 3.2, 0.3, 6.2), cyl(0xb8bec6, 0.9, f * 2.9 + 0.9, -1.5, 0.45, 1.2)); return g; },
  // Đồi chè bậc thang
  tea: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { g.add(mesh(GEO.sphere, mat(i % 2 ? 0x3f9a55 : 0x4fae62, { rough: 1 }), 0, -0.5 + i * 0.9, -i * 1.6, 9 - i * 1.7, 1.5, 5.4 - i * 0.9)); for (let j = 0; j < 5 - i; j++) g.add(box(0x2f7d45, -5.6 + i * 1.3 + j * 2.6, 0.75 + i * 0.9, 2.2 - i * 1.9, 2.0, 0.34, 0.5)); } return g; },
  // Cột Km: trụ trắng đầu đỏ
  kmpost: () => { const g = new THREE.Group(); g.add(box(0xf7f7f2, 0, 0.45, 0, 0.5, 0.9, 0.3), box(0xd7261c, 0, 0.98, 0, 0.5, 0.26, 0.3), box(0x1c1c1c, 0, 0.5, 0.16, 0.3, 0.16, 0.02)); return g; },
  // Cột đèn cao áp trên cao tốc
  lamp: () => { const g = new THREE.Group(); g.add(cyl(0x9aa1ab, 0, 3.6, 0, 0.09, 7.2), box(0x9aa1ab, -0.9, 7.15, 0, 1.9, 0.08, 0.1), box(0xfff3b0, -1.7, 7.06, 0, 0.6, 0.1, 0.26, { emissive: 0xffe08a })); return g; },
  // Ruộng lúa có bờ và người nông dân
  paddy: () => { const g = new THREE.Group(), gold = Math.random() < 0.35; g.add(box(gold ? 0xe2c95f : 0x7fcf6c, 0, 0.05, 0, 12, 0.1, 8), box(0x8fd8ea, 0, 0.02, 0, 12.6, 0.04, 8.6, { rough: 0.25 })); for (let i = 0; i < 9; i++) g.add(box(gold ? 0xd1b445 : 0x63b85a, -5 + i * 1.25, 0.14, 0, 0.36, 0.14, 7.4)); g.add(cyl(0x7a5c8f, 2, 0.6, 1.5, 0.2, 0.9), mesh(GEO.ball, mat(0xf2cfa5), 2, 1.2, 1.5, 0.18), mesh(new THREE.ConeGeometry(0.42, 0.22, 10), mat(0xf2dc9a), 2, 1.42, 1.5)); return g; },
};

// ---------------------------------------------------------------- xe của người chơi theo loại, trạm sạc
export type VehGroup = 'ba_gac' | 'ban_tai' | 'tai_nhe' | 'tai_trung' | 'tai_nang' | 'dau_keo';
const wheelZ = (x: number, z: number, r = 0.42, w = 0.3) => { const m = mesh(GEO.cyl, mat(0x3a3f4a), x, r, z, r, w, r); m.rotation.z = Math.PI / 2; return m; };
const FRUIT = [0xe8457f, 0xf4c430, 0xf08a24, 0x9bd64a, 0x6a3d9a, 0xdc342b];
/**
 * Mô hình xe người chơi lái (đầu xe hướng -z, gốc toạ độ gần trục giữa như buildTruck cũ).
 * `rearZ`: vị trí đèn hậu; `back`: máy quay cần lùi thêm bấy nhiêu vì xe dài.
 */
export function playerVehicle(group: VehGroup, color: number, o: { electric?: boolean; cold?: boolean } = {}): { root: THREE.Group; rearZ: number; back: number; halfW: number } {
  const g = new THREE.Group(), dark = 0x4a5160, glass = 0xbfe6f7;
  const boxC = o.cold ? 0xf4f7fa : 0xe9d2a6, topC = o.cold ? 0x8fc4e8 : 0xc9a877;
  const lamps = (y: number, z: number, x = 0.6) => g.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), -x, y, z, 0.14), mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), x, y, z, 0.14));
  const tails = (y: number, z: number, x = 0.7) => g.add(box(0xe0342b, -x, y, z, 0.3, 0.16, 0.06), box(0xe0342b, x, y, z, 0.3, 0.16, 0.06));
  const fruit = (x0: number, z0: number, nx: number, nz: number, y: number, step = 0.6) => { for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) g.add(mesh(GEO.ball, mat(FRUIT[(i + j) % FRUIT.length], { rough: 0.5 }), x0 + i * step, y + ((i + j) % 2) * 0.12, z0 + j * step, 0.3)); };
  let rearZ = 2.34, back = 0, halfW = 1.0;
  if (group === 'ba_gac') {
    // đầu xe máy kéo thùng hai bánh
    g.add(box(color, 0, 0.78, -1.5, 0.46, 0.5, 1.5), box(0x2b2f36, 0, 1.08, -1.1, 0.5, 0.14, 0.8), box(dark, 0, 1.3, -2.0, 1.0, 0.08, 0.1), box(color, 0, 1.05, -2.15, 0.34, 0.5, 0.2));
    g.add(wheelZ(0, -2.2, 0.4, 0.2), wheelZ(-0.78, 0.75, 0.38), wheelZ(0.78, 0.75, 0.38));
    g.add(box(dark, 0, 0.56, 0.55, 1.5, 0.14, 2.5), box(boxC, 0, 0.95, 0.55, 1.6, 0.6, 2.5), box(topC, 0, 1.28, 0.55, 1.7, 0.1, 2.6));
    fruit(-0.45, -0.2, 2, 3, 1.5, 0.6);
    g.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), 0, 1.0, -2.3, 0.14)); tails(0.9, 1.84, 0.6); rearZ = 1.86; halfW = 0.85;
  } else if (group === 'ban_tai') {
    g.add(box(dark, 0, 0.55, 0.1, 1.9, 0.3, 4.6), box(color, 0, 0.95, -1.75, 1.9, 0.55, 1.2), box(color, 0, 1.2, -0.35, 1.9, 1.05, 1.9), box(glass, 0, 1.5, -1.32, 1.6, 0.5, 0.06, { rough: 0.3 }), box(0xfff6dc, 0, 1.76, -0.35, 1.7, 0.08, 1.7));
    g.add(box(color, 0, 0.95, 1.55, 1.9, 0.6, 1.9), box(dark, 0, 1.0, 1.55, 1.6, 0.4, 1.6));
    fruit(-0.45, 1.05, 2, 2, 1.32, 0.9);
    for (const [x, z] of [[-0.95, -1.55], [0.95, -1.55], [-0.95, 1.5], [0.95, 1.5]]) g.add(wheelZ(x, z));
    lamps(0.95, -2.37); tails(0.95, 2.52); rearZ = 2.54;
  } else if (group === 'tai_trung' || group === 'tai_nang') {
    const heavy = group === 'tai_nang', L = heavy ? 6.6 : 4.6, W = heavy ? 2.3 : 2.15, H = heavy ? 2.3 : 1.9, z0 = -0.4 + L / 2;
    g.add(box(dark, 0, 0.7, z0 - 0.9, W - 0.2, 0.3, L + 2.2), box(color, 0, 1.65, -1.55, W, 1.7, 1.5), box(color, 0, 1.05, -2.36, W, 0.5, 0.3), box(glass, 0, 2.0, -2.32, W - 0.3, 0.7, 0.06, { rough: 0.3 }), box(0xfff6dc, 0, 2.55, -1.55, W - 0.2, 0.1, 1.3));
    g.add(box(boxC, 0, 0.95 + H / 2, z0, W, H, L), box(topC, 0, 0.95 + H + 0.05, z0, W + 0.1, 0.12, L + 0.1));
    if (!o.cold) for (let i = 0; i < Math.round(L / 1.1); i++) g.add(box(0xb8956a, W / 2 + 0.01, 0.95 + H / 2, z0 - L / 2 + 0.55 + i * 1.1, 0.04, H - 0.2, 0.1), box(0xb8956a, -W / 2 - 0.01, 0.95 + H / 2, z0 - L / 2 + 0.55 + i * 1.1, 0.04, H - 0.2, 0.1));
    else g.add(box(0x3f8fd6, W / 2 + 0.01, 1.6, z0, 0.04, 0.3, L - 0.4), box(0x3f8fd6, -W / 2 - 0.01, 1.6, z0, 0.04, 0.3, L - 0.4), box(0xd9dee4, 0, 2.0 + H, z0 - L / 2 + 0.5, 1.3, 0.5, 0.7));
    const rear = z0 + L / 2, ax = heavy ? [rear - 0.9, rear - 2.0] : [rear - 1.1];
    for (const x of [-(W / 2 - 0.1), W / 2 - 0.1]) { g.add(wheelZ(x, -1.6, 0.48, 0.34)); for (const z of ax) g.add(wheelZ(x, z, 0.48, 0.4)); }
    lamps(1.05, -2.53, 0.75); tails(1.0, rear + 0.02, 0.8); rearZ = rear + 0.04; back = heavy ? 4.2 : 2.0; halfW = W / 2;
  } else if (group === 'dau_keo') {
    // đầu kéo ba trục + sơ mi rơ moóc chở container 40 feet
    const W = 2.4, L = 9.6, z0 = 0.9 + L / 2, cc = o.cold ? 0xf4f7fa : 0x2e7d6b;
    g.add(box(dark, 0, 0.75, -0.6, 2.0, 0.3, 4.4), box(color, 0, 1.85, -1.75, W, 2.1, 1.7), box(color, 0, 1.05, -2.66, W, 0.6, 0.3), box(glass, 0, 2.3, -2.62, W - 0.3, 0.8, 0.06, { rough: 0.3 }), box(0xfff6dc, 0, 3.0, -1.6, W - 0.2, 0.25, 1.4));
    g.add(cyl(0x8f97a3, -0.95, 2.4, -0.75, 0.09, 2.6), cyl(0x8f97a3, 0.95, 2.4, -0.75, 0.09, 2.6));
    g.add(box(0x3a3f4a, 0, 0.95, z0, 2.1, 0.22, L), box(cc, 0, 2.35, z0, W, 2.6, L));
    for (let i = 0; i < 16; i++) g.add(box(o.cold ? 0xd5dbe2 : 0x25665a, W / 2 + 0.01, 2.35, z0 - L / 2 + 0.3 + i * 0.6, 0.04, 2.4, 0.12), box(o.cold ? 0xd5dbe2 : 0x25665a, -W / 2 - 0.01, 2.35, z0 - L / 2 + 0.3 + i * 0.6, 0.04, 2.4, 0.12));
    g.add(box(0xfff6dc, 0, 2.35, z0 + L / 2 + 0.01, W - 0.3, 2.3, 0.04));
    const rear = z0 + L / 2;
    for (const x of [-1.05, 1.05]) { g.add(wheelZ(x, -1.9, 0.5, 0.34)); for (const z of [-0.2, 0.75, rear - 0.8, rear - 1.8, rear - 2.8]) g.add(wheelZ(x, z, 0.5, 0.42)); }
    lamps(1.1, -2.83, 0.8); tails(1.1, rear + 0.05, 0.9); rearZ = rear + 0.07; back = 9.5; halfW = 1.2;
  } else {
    // tải nhẹ: như xe cũ, thùng hở chở trái cây (thùng lạnh thì kín)
    g.add(box(dark, 0, 0.62, 0.3, 1.9, 0.3, 4.1), box(color, 0, 1.45, -1.35, 1.9, 1.4, 1.3), box(color, 0, 1.0, -2.1, 1.9, 0.6, 0.5), box(glass, 0, 1.75, -2.02, 1.6, 0.6, 0.06, { rough: 0.3 }), box(0xfff6dc, 0, 2.2, -1.35, 1.7, 0.1, 1.1));
    if (o.cold) g.add(box(boxC, 0, 1.75, 0.95, 2.05, 2.0, 2.75), box(0x3f8fd6, 1.04, 1.5, 0.95, 0.04, 0.3, 2.4), box(0x3f8fd6, -1.04, 1.5, 0.95, 0.04, 0.3, 2.4), box(0xd9dee4, 0, 2.95, 0, 1.2, 0.4, 0.6));
    else { g.add(box(boxC, 0, 1.15, 0.95, 2.0, 0.8, 2.7), box(topC, 0, 1.6, 0.95, 2.1, 0.12, 2.8)); fruit(-0.6, 0, 3, 4, 1.85, 0.6); }
    for (const [x, z] of [[-0.95, -1.5], [0.95, -1.5], [-0.95, 1.4], [0.95, 1.4]]) g.add(wheelZ(x, z));
    lamps(0.95, -2.37); tails(0.95, 2.32);
  }
  if (o.electric) {
    // xe điện: dải xanh lá phát sáng quanh ca-bin và nắp cổng sạc
    const zc = group === 'ba_gac' ? -1.5 : group === 'dau_keo' ? -1.75 : group === 'ban_tai' ? -0.35 : -1.45, w = halfW + 0.02, y = group === 'ba_gac' ? 0.7 : 1.05;
    g.add(box(0x35d07f, w, y, zc, 0.05, 0.16, 1.3, { emissive: 0x1e9a58 }), box(0x35d07f, -w, y, zc, 0.05, 0.16, 1.3, { emissive: 0x1e9a58 }), box(0x35d07f, 0, y, zc - (group === 'ba_gac' ? 0.78 : group === 'dau_keo' ? 1.08 : group === 'ban_tai' ? 2.02 : 0.92), halfW * 1.6, 0.12, 0.05, { emissive: 0x1e9a58 }));
  }
  return { root: g, rearZ, back, halfW };
}

/** Trạm sạc nhanh: mái che xanh lá, bốn trụ sạc có đèn, tủ điện. Gốc toạ độ ở mép làn phụ (như trạm xăng). */
export function chargerStation(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0xb8bec6, 4.5, 0.02, 0, 11, 0.04, 16, { rough: 1 }), box(0x2fbf71, 4.2, 5.3, 0, 8.4, 0.45, 9), box(0xffffff, 4.2, 5.0, 0, 8.6, 0.16, 9.2));
  for (const [x, z] of [[0.8, -3.6], [0.8, 3.6], [7.6, -3.6], [7.6, 3.6]]) g.add(cyl(0xf3f4f6, x, 2.6, z, 0.2, 5.2));
  for (const z of [-3, -1, 1, 3]) g.add(box(0x9aa1ab, 1.5, 0.12, z, 0.9, 0.24, 0.9), box(0xf6f8fa, 1.5, 1.1, z, 0.5, 1.9, 0.6), box(0x35d07f, 1.24, 1.5, z, 0.03, 0.5, 0.4, { emissive: 0x1e9a58 }), box(0x22262c, 1.2, 0.8, z + 0.36, 0.1, 0.5, 0.08));
  g.add(box(0xe9eef2, 11, 1.3, 0, 3, 2.6, 5), box(0x2fbf71, 11, 2.75, 0, 3.3, 0.3, 5.3), box(0xf4c430, 9.48, 1.6, 0, 0.04, 0.6, 0.6));
  // tấm pin mặt trời trên mái
  for (const z of [-3, 0, 3]) g.add(box(0x23406e, 4.2, 5.62, z, 7.2, 0.06, 2.4, { rough: 0.3 }));
  return g;
}
/** Trụ sạc lẻ đặt ở trạm dừng nghỉ. */
export function chargerPosts(): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-1.2, 1.2]) g.add(box(0xf6f8fa, 0, 1.0, z, 0.5, 1.8, 0.6), box(0x35d07f, -0.27, 1.4, z, 0.03, 0.5, 0.4, { emissive: 0x1e9a58 }));
  return g;
}
