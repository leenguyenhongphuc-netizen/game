// Người làm thuê và robot làm vườn trên cánh đồng lớn: mỗi loại vài InstancedMesh dùng chung (thân, đầu, nón / thân, vòm, bánh),
// nên 12 người + 12 robot vẫn chỉ ~6 lần vẽ. Mỗi khung chỉ đặt lại ma trận.
import * as THREE from 'three';

const MAX = 12;
export interface CrewPose { x: number; z: number; yaw: number; working: boolean }

function im(geo: THREE.BufferGeometry, color: number, emissive = 0): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color, emissive }), MAX);
  m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
  return m;
}

export class FieldCrews {
  readonly group = new THREE.Group();
  // người: thân áo, quần, đầu, nón lá, cuốc/bình phun trên vai
  private shirt = im(new THREE.CylinderGeometry(0.28, 0.34, 0.75, 7).translate(0, 1.05, 0), 0xffffff);
  private legs = im(new THREE.BoxGeometry(0.42, 0.62, 0.26).translate(0, 0.36, 0), 0x3b4a6b);
  private head = im(new THREE.SphereGeometry(0.22, 8, 6).translate(0, 1.62, 0), 0xe6b58e);
  private hat = im(new THREE.ConeGeometry(0.46, 0.3, 10).translate(0, 1.86, 0), 0xf1d98a);
  private tool = im(new THREE.BoxGeometry(0.06, 0.06, 1.1).translate(0.32, 1.1, 0.35), 0x7a5230);
  // robot: thân hộp trắng, vòm cảm biến xanh, cụm bánh xích, tay gắp
  private rBody = im(new THREE.BoxGeometry(0.9, 0.55, 1.1).translate(0, 0.62, 0), 0xf2f4f6);
  private rDome = im(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.9, 0.15), 0x3aa0e0, 0x0a3550);
  private rTrack = im(new THREE.BoxGeometry(1.1, 0.34, 1.2).translate(0, 0.17, 0), 0x2b2f36);
  private rArm = im(new THREE.BoxGeometry(0.12, 0.12, 0.8).translate(0, 0.5, 0.85), 0xff9f1c);
  private tmp = new THREE.Object3D();
  private shirtColors = [0x4f8fd8, 0xe0574a, 0x58b368, 0xf2a33a, 0x8f6bd1, 0x2fb3b3];

  constructor() {
    for (const m of [this.shirt, this.legs, this.head, this.hat, this.tool, this.rBody, this.rDome, this.rTrack, this.rArm]) this.group.add(m);
    const c = new THREE.Color();
    for (let i = 0; i < MAX; i++) this.shirt.setColorAt(i, c.setHex(this.shirtColors[i % this.shirtColors.length]));
    this.group.name = 'to-lam-thue';
  }

  /** Đặt vị trí tổ người (people) và tổ robot (robots) cho khung này. t: thời gian (giây) để lắc người khi cuốc, robot rung nhẹ. */
  set(people: CrewPose[], robots: CrewPose[], t: number) {
    const o = this.tmp;
    const n = Math.min(MAX, people.length);
    for (let i = 0; i < n; i++) {
      const p = people[i], bob = p.working ? Math.abs(Math.sin(t * 6 + i)) * 0.08 : 0;
      o.position.set(p.x, 0, p.z); o.rotation.set(p.working ? 0.25 + bob : 0, p.yaw, 0); o.scale.setScalar(1); o.updateMatrix();
      for (const m of [this.shirt, this.legs, this.head, this.hat]) m.setMatrixAt(i, o.matrix);
      o.rotation.set(p.working ? -0.6 + Math.sin(t * 6 + i) * 0.7 : 0, p.yaw, 0); o.updateMatrix(); this.tool.setMatrixAt(i, o.matrix);
    }
    for (const m of [this.shirt, this.legs, this.head, this.hat, this.tool]) { m.count = n; m.instanceMatrix.needsUpdate = true; }
    if (this.shirt.instanceColor) this.shirt.instanceColor.needsUpdate = true;
    const r = Math.min(MAX, robots.length);
    for (let i = 0; i < r; i++) {
      const p = robots[i];
      o.position.set(p.x, p.working ? Math.sin(t * 20 + i) * 0.02 : 0, p.z); o.rotation.set(0, p.yaw, 0); o.scale.setScalar(1); o.updateMatrix();
      for (const m of [this.rBody, this.rDome, this.rTrack]) m.setMatrixAt(i, o.matrix);
      o.rotation.set(p.working ? 0.3 + Math.sin(t * 5 + i) * 0.3 : 0, p.yaw, 0); o.updateMatrix(); this.rArm.setMatrixAt(i, o.matrix);
    }
    for (const m of [this.rBody, this.rDome, this.rTrack, this.rArm]) { m.count = r; m.instanceMatrix.needsUpdate = true; }
  }

  dispose() {
    for (const m of [this.shirt, this.legs, this.head, this.hat, this.tool, this.rBody, this.rDome, this.rTrack, this.rArm]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
  }
}
