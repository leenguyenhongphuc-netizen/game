// Cầu nối giữa cảnh 3D cánh đồng (web/src/scene/fields.ts, chạy trong World) và phần giao diện React (fieldHud.tsx, fields.tsx).
// Cảnh ghi trạng thái (đang đứng ở ruộng nào, có máy lái được không, đang lái, hoạt cảnh), giao diện gửi yêu cầu (ra đồng, lên máy,
// hạ giàn, xem hoạt cảnh). Không phụ thuộc React hay three để dùng được ở cả hai phía.
import type { FarmMachineKind, WorkKind, WorkMethod } from '../../shared/farm.ts';

export interface DriveState {
  machine: FarmMachineKind; implementDown: boolean;
  /** Ô đã làm (cả phần đã gửi máy chủ) / tổng ô, của cánh đồng đang lái trên. */
  fieldId: number | null; done: number; total: number; kind: WorkKind | null;
  speed: number; note: string | null;
}
export interface SceneState { fieldId: number; title: string; sub: string; t: number; dur: number }
export interface JobBar { fieldId: number; label: string; method: WorkMethod; progress: number; endsAt: number }
export interface ZoneState {
  /** Có cánh đồng dựng trong cảnh. */
  present: boolean;
  /** Đang đứng (hoặc lái) trong khu cánh đồng. */
  inZone: boolean;
  /** Cánh đồng dưới chân, kèm mã thửa của khối đang đứng. */
  here: { fieldId: number; cert: string | null; block: number } | null;
  /** Đứng cạnh máy đậu bên ruộng và có việc cho máy đó. */
  canDrive: { machine: FarmMachineKind; label: string } | null;
  driving: DriveState | null;
  scene: SceneState | null;
  jobs: JobBar[];
  routing: boolean;
}
export interface PendingDrive { fieldId: number; tiles: number[]; meters: number; seconds: number }

type Req =
  | { kind: 'goto'; fieldId: number | null }
  | { kind: 'scene'; fieldId: number; work: WorkKind; method: WorkMethod; machine: FarmMachineKind | null; label: string }
  | { kind: 'skip' }
  | { kind: 'drive'; on: boolean }
  | { kind: 'implement'; down?: boolean }
  | { kind: 'synced'; fieldId: number; tiles: number[]; ok: boolean; note?: string };

const listeners = new Set<() => void>();
let state: ZoneState = { present: false, inZone: false, here: null, canDrive: null, driving: null, scene: null, jobs: [], routing: false };
const queue: Req[] = [];
let machines: FarmMachineKind[] = [];
const pending = new Map<number, PendingDrive>();

export const fieldZone = {
  get: (): ZoneState => state,
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); },
  /** Cảnh cập nhật trạng thái; chỉ báo cho giao diện khi có gì đổi. */
  patch(p: Partial<ZoneState>) {
    let changed = false;
    for (const k of Object.keys(p) as (keyof ZoneState)[]) if (JSON.stringify(state[k]) !== JSON.stringify(p[k])) { changed = true; break; }
    if (!changed) return;
    state = { ...state, ...p };
    for (const fn of listeners) fn();
  },
  // ---- yêu cầu từ giao diện; cảnh lấy ra mỗi khung
  request(r: Req) { queue.push(r); },
  take(): Req[] { return queue.splice(0); },
  /** Máy nông nghiệp người chơi đang có (giao diện tải từ /api/fields). */
  setMachines(list: FarmMachineKind[]) { machines = list; },
  machines: (): FarmMachineKind[] => machines,
  // ---- ô vừa làm khi tự lái, chờ gửi máy chủ
  addDriven(fieldId: number, tiles: number[], meters: number, seconds: number) {
    const p = pending.get(fieldId) ?? { fieldId, tiles: [], meters: 0, seconds: 0 };
    p.tiles.push(...tiles); p.meters += meters; p.seconds += seconds; pending.set(fieldId, p);
  },
  /** Thêm quãng đường/thời gian cho mọi lô đang chờ (máy chạy mà chưa có ô mới vẫn tính đường). */
  addTravel(meters: number, seconds: number) { for (const p of pending.values()) { p.meters += meters; p.seconds += seconds; } },
  takePending(): PendingDrive[] { const out = [...pending.values()].filter((p) => p.tiles.length); for (const p of out) pending.delete(p.fieldId); return out; },
};
export type FieldReq = Req;
