// Xe của người chơi khác và cư dân ảo trên cùng tuyến cao tốc (cảnh DriveScene).
// Máy chủ trả mỗi xe cách mình bao nhiêu km theo trục chuyến đi; giữa hai nhịp thì ngoại suy theo tốc độ km/giây của họ.
import * as THREE from 'three';
import type { PresenceIn, PresenceOther } from '../../../shared/social.ts';
import { hash32 } from '../../../shared/social.ts';
import { PresenceLink, disposeTag, dropSay, hexOf, nameTag, syncSay } from '../presence.ts';
import { playerVehicle } from './DriveExtras.ts';
import type { VehGroup } from './DriveExtras.ts';
import { bakeColored } from '../scene/batch.ts';

const GROUPS: VehGroup[] = ['ba_gac', 'ban_tai', 'tai_nhe', 'tai_trung', 'tai_nang', 'dau_keo'];
interface Item {
  o: PresenceOther; look: string; obj: THREE.Group; tag: THREE.Sprite; lane: number; wheels: THREE.Object3D[];
  /** vị trí trên trục của mình (km) tại thời điểm nhận, tốc độ km/s theo trục của mình, lúc nhận */
  pos0: number; v: number; t0: number; shown: number | null;
}
export interface DriveMe { key: string; dir: 1 | -1; km: number; totalKm: number }
/** (vật, khoảng cách theo đơn vị cảnh, cùng chiều?, làn) → có vẽ được không */
export type PlaceFn = (obj: THREE.Object3D, ds: number, same: boolean, lane: number) => boolean;

export class OtherCars {
  private items = new Map<number, Item>();
  private link: PresenceLink;
  private myKm = 0; private myKmps = 0; private lastKm: number | null = null;
  constructor(private world: THREE.Group, private getMe: () => DriveMe | null) {
    this.link = new PresenceLink(() => this.state(), (list, at) => this.set(list, at.local));
  }
  private state(): PresenceIn | null {
    const me = this.getMe(); if (!me) return null;
    return { scene: 'highway', key: me.key, dir: me.dir, km: Math.round(me.km * 100) / 100, totalKm: Math.round(me.totalKm * 10) / 10, kmps: Math.round(this.myKmps * 100) / 100 };
  }
  private set(list: PresenceOther[], local: number) {
    const keep = new Set<number>();
    for (const o of list) {
      if (o.aheadKm === undefined) continue;
      keep.add(o.id);
      const group = (GROUPS.includes(o.vehicle?.group as VehGroup) ? o.vehicle!.group : 'tai_nhe') as VehGroup, color = hexOf(o.vehicle?.color, 0xf08a6c);
      const look = `${group}|${color}|${o.name}`;
      let it = this.items.get(o.id);
      if (it && it.look !== look) { this.drop(it); it = undefined; }
      if (!it) {
        const v = playerVehicle(group, color, { electric: false }), wheels: THREE.Object3D[] = [];
        const obj = bakeColored(v.root, false); obj.visible = false;
        const tag = nameTag(o, 1.15); tag.position.set(0, 4.6, 0); obj.add(tag);
        it = { o, look, obj, tag, wheels, lane: (hash32(`lan:${o.id}`) % 3) - 1, pos0: 0, v: 0, t0: local, shown: null };
        this.world.add(obj); this.items.set(o.id, it);
      }
      // vị trí tuyệt đối trên trục của mình lúc nhận (bù tuổi số liệu), vận tốc dọc trục
      const age = (o.ageMs ?? 0) / 1000, v = (o.sameDir ? 1 : -1) * (o.kmps ?? 0);
      syncSay(it.obj, o, 5.3, 1, 1.7); // bong bóng chat (web/src/chat)
      it.o = o; it.pos0 = this.myKm + o.aheadKm + v * age; it.v = v; it.t0 = local;
    }
    for (const [id, it] of this.items) if (!keep.has(id)) { this.drop(it); this.items.delete(id); }
  }
  private drop(it: Item) { it.obj.removeFromParent(); disposeTag(it.tag); dropSay(it.obj); it.obj.traverse((m) => { const g = (m as THREE.Mesh).geometry; if ((m as THREE.Mesh).isMesh && g) g.dispose(); }); }

  /** Xe người chơi thật đang hiện: điểm thân xe và bảng tên để chạm mở thẻ (chat/tapPick.ts). */
  pickables(): { id: number; pts: THREE.Vector3[] }[] {
    const out: { id: number; pts: THREE.Vector3[] }[] = [];
    for (const it of this.items.values()) { if (it.o.bot || !it.obj.visible) continue; const p = it.obj.getWorldPosition(new THREE.Vector3()); out.push({ id: it.o.id, pts: [p.clone().setY(p.y + 1.5), p.clone().setY(p.y + 4.6)] }); }
    return out;
  }

  /** Gọi mỗi khung từ DriveScene. kmU = số km ứng với một đơn vị cảnh (đường trong cảnh được nén lại). */
  frame(dt: number, myKm: number | null, kmU: number, myLane: number, place: PlaceFn) {
    if (myKm === null) { for (const it of this.items.values()) it.obj.visible = false; this.lastKm = null; return; }
    if (this.lastKm !== null && dt > 0) { const inst = Math.max(0, (myKm - this.lastKm) / dt); this.myKmps += (inst - this.myKmps) * Math.min(1, dt * 1.5); }
    this.lastKm = myKm; this.myKm = myKm;
    const now = performance.now();
    for (const it of this.items.values()) {
      const t = Math.min(6, (now - it.t0) / 1000), want = it.pos0 + it.v * t - myKm;
      // làm mượt khi nhịp mới tới lệch với chỗ đang vẽ
      it.shown = it.shown === null || Math.abs(want - it.shown) > 20 ? want : it.shown + (want - it.shown) * Math.min(1, dt * 3);
      const ds = it.shown / Math.max(1e-6, kmU);
      let lane = it.lane; if (it.o.sameDir && Math.abs(ds) < 9 && lane === myLane) lane = myLane >= 1 ? myLane - 1 : myLane + 1; // không chồng lên xe mình
      it.obj.visible = place(it.obj, ds, !!it.o.sameDir, lane);
      it.tag.visible = it.obj.visible && Math.abs(ds) < 90;
    }
  }
  /** Danh sách gần đây (dùng cho bảng thông tin, kiểm thử). */
  nearby(): { name: string; bot: boolean; aheadKm: number; sameDir: boolean }[] {
    return [...this.items.values()].map((it) => ({ name: it.o.name, bot: it.o.bot, aheadKm: Math.round((it.shown ?? 0) * 10) / 10, sameDir: !!it.o.sameDir })).sort((a, b) => Math.abs(a.aheadKm) - Math.abs(b.aheadKm));
  }
  dispose() { this.link.stop(); for (const it of this.items.values()) this.drop(it); this.items.clear(); }
}
