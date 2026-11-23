// Sân sát hạch lái xe trong hình: hình sân, mô hình xe hai bánh (bicycle model), chấm điểm và lái mẫu.
// File này không phụ thuộc thư viện vẽ để chạy thử được bằng node.
// Trục: X sang đông, Y lên bắc; góc xe 0 = hướng đông, tăng ngược chiều kim đồng hồ. Điểm gốc của xe là giữa cầu sau.

export type ExamClass = 'B' | 'C1' | 'C' | 'CE';
export interface CarSpec { cls: ExamClass; name: string; len: number; wid: number; wb: number; rear: number; maxSteer: number; limitKmh: number; scale: number }
/** Kích thước xe sát hạch theo hạng (xấp xỉ xe tập lái phổ biến). Hạng CE dùng xe hạng C, chưa có rơ moóc. */
export const CAR_SPECS: Record<ExamClass, CarSpec> = {
  B: { cls: 'B', name: 'Ô tô con (hạng B)', len: 4.4, wid: 1.7, wb: 2.6, rear: 0.9, maxSteer: 0.66, limitKmh: 24, scale: 1 },
  C1: { cls: 'C1', name: 'Xe tải nhẹ (hạng C1)', len: 6.0, wid: 2.0, wb: 3.5, rear: 1.3, maxSteer: 0.66, limitKmh: 24, scale: 1.35 },
  C: { cls: 'C', name: 'Xe tải (hạng C)', len: 7.6, wid: 2.3, wb: 4.5, rear: 1.7, maxSteer: 0.66, limitKmh: 20, scale: 1.73 },
  CE: { cls: 'CE', name: 'Xe tải (hạng CE, chưa kéo rơ moóc)', len: 7.6, wid: 2.3, wb: 4.5, rear: 1.7, maxSteer: 0.66, limitKmh: 20, scale: 1.73 },
};

export type Prim = { t: 'rect'; cx: number; cy: number; hl: number; hw: number; ang: number } | { t: 'arc'; cx: number; cy: number; r0: number; r1: number; a0: number; a1: number };
const TAU = Math.PI * 2;
export const wrap = (a: number) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
/** Điểm có nằm trong hình không; m > 0 nới hình ra m mét. */
export function inPrim(p: Prim, x: number, y: number, m = 0): boolean {
  if (p.t === 'rect') { const dx = x - p.cx, dy = y - p.cy, c = Math.cos(p.ang), s = Math.sin(p.ang); return Math.abs(dx * c + dy * s) <= p.hl + m && Math.abs(-dx * s + dy * c) <= p.hw + m; }
  const dx = x - p.cx, dy = y - p.cy, r = Math.hypot(dx, dy); if (r < p.r0 - m || r > p.r1 + m) return false;
  const pad = m / Math.max(1, r); let a = (Math.atan2(dy, dx) - (p.a0 - pad)) % TAU; if (a < 0) a += TAU; return a <= p.a1 - p.a0 + 2 * pad;
}
const rectXY = (x0: number, y0: number, x1: number, y1: number): Prim => ({ t: 'rect', cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hl: Math.abs(x1 - x0) / 2, hw: Math.abs(y1 - y0) / 2, ang: 0 });

/** Một đoạn của đường chạy mẫu. dir = 1 tiến, −1 lùi; k = độ cong theo xe (dương = đánh lái trái). */
export interface Piece { x0: number; y0: number; h0: number; len: number; k: number; dir: 1 | -1; s0: number; w: number; hint?: string }
export interface Pose { x: number; y: number; h: number }
export function pieceAt(p: Piece, d: number): Pose {
  if (Math.abs(p.k) < 1e-9) return { x: p.x0 + p.dir * d * Math.cos(p.h0), y: p.y0 + p.dir * d * Math.sin(p.h0), h: p.h0 };
  const h = p.h0 + p.dir * p.k * d; return { x: p.x0 + (Math.sin(h) - Math.sin(p.h0)) / p.k, y: p.y0 - (Math.cos(h) - Math.cos(p.h0)) / p.k, h };
}

export type ItemId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export interface ItemInfo { id: ItemId; name: string; say: string; tip: string }
export const ITEMS: ItemInfo[] = [
  { id: 1, name: 'Xuất phát', say: 'Thắt dây an toàn, bật xi nhan trái rồi cho xe qua vạch xuất phát.', tip: 'Trước khi lăn bánh: thắt dây an toàn, nhả phanh tay, bật xi nhan trái. Qua vạch khoảng 5 m thì tắt xi nhan.' },
  { id: 2, name: 'Dừng xe nhường đường cho người đi bộ', say: 'Dừng xe trước vạch dừng, cản trước cách vạch không quá 50 cm.', tip: 'Về chậm từ xa, canh mũi xe sát vạch dừng mà không đè lên. Dừng hẳn rồi mới đi tiếp.' },
  { id: 3, name: 'Dừng và khởi hành xe trên dốc', say: 'Dừng trước vạch dừng trên dốc, khởi hành trong 30 giây, không để xe tụt quá 50 cm.', tip: 'Dừng xong kéo phanh tay. Khi đi: đạp ga nhẹ cho xe ghì máy rồi mới nhả phanh tay, xe sẽ không tụt.' },
  { id: 4, name: 'Qua vệt bánh xe và đường hẹp vuông góc', say: 'Cho hai bánh bên phải đi lọt vệt bánh xe, rồi qua đường hẹp vuông góc không đè vạch.', tip: 'Canh bánh phải vào giữa vệt. Vào đường vuông góc: đi sát mép ngoài, đầu xe qua góc mới đánh hết lái.' },
  { id: 5, name: 'Qua ngã tư có đèn tín hiệu', say: 'Đèn đỏ thì dừng trước vạch; đèn xanh bật xi nhan trái rồi rẽ trái qua ngã tư.', tip: 'Đèn vàng cũng phải dừng nếu chưa qua vạch. Rẽ thì bật xi nhan trước khi vào ngã tư.' },
  { id: 6, name: 'Qua đường vòng quanh co', say: 'Lái xe qua đường vòng chữ S, không để bánh xe đè vạch.', tip: 'Vào cua trái thì bám mép phải, vào cua phải thì bám mép trái; giữ ga đều, không phanh gấp trong cua.' },
  { id: 7, name: 'Ghép xe dọc vào nơi đỗ', say: 'Tiến qua nơi đỗ, lùi vào chuồng cho bánh sau qua vạch kiểm tra, rồi tiến ra. Thời gian 2 phút.', tip: 'Tiến tới khi vai ngang mép chuồng thì dừng, đánh hết lái về phía chuồng và lùi chậm. Xe song song chuồng thì trả thẳng lái, lùi tới khi nghe báo.' },
  { id: 8, name: 'Tạm dừng ở chỗ có đường sắt chạy qua', say: 'Dừng xe trước vạch dừng, cản trước cách vạch không quá 50 cm.', tip: 'Ngoài đời: dừng cách ray gần nhất tối thiểu 5 m, quan sát hai phía rồi mới qua.' },
  { id: 9, name: 'Thay đổi số trên đường bằng', say: 'Tăng tốc trên 24 km/h trước biển 20 xanh, giảm xuống dưới 24 km/h trước biển 20 trắng.', tip: 'Đạp ga dứt khoát ngay từ biển bắt đầu. Qua biển xanh thì nhả ga, rà phanh cho tốc độ xuống trước biển trắng.' },
  { id: 10, name: 'Ghép xe ngang vào nơi đỗ', say: 'Tiến qua nơi đỗ, lùi ghép ngang vào ô, rồi tiến ra. Thời gian 2 phút.', tip: 'Tiến quá ô nửa thân xe, đánh hết lái phải lùi tới khi xe chéo khoảng 45 độ, trả lái lùi thẳng một nhịp, rồi đánh hết lái trái cho xe song song.' },
  { id: 11, name: 'Kết thúc', say: 'Bật xi nhan phải và cho xe qua vạch kết thúc.', tip: 'Bật xi nhan phải trước vạch kết thúc. Ngoài đời còn phải về số, kéo phanh tay, tắt máy.' },
];

export interface Gate { name: string; x: number; y: number; h: number; hw: number; hit: boolean }
export interface StopLine { item: ItemId; kind: 'bo_hanh' | 'doc' | 'den' | 'duong_sat'; x: number; y: number; h: number; hw: number; state: 'cho' | 'da_dung' | 'xong'; still: number; stopAlong: number; timer: number }
export interface Bay { item: 7 | 10; rect: Prim; inx: number; iny: number; check: number; ok: boolean; t0: number; timeHit: number }
export interface Course {
  spec: CarSpec; pieces: Piece[]; total: number; marks: Record<string, Pose & { s: number }>;
  road: Prim[]; gates: Gate[]; stops: StopLine[]; bays: Bay[];
  ramp: { x0: number; x1: number; x2: number; x3: number; hw: number; top: number };
  track: { x0: number; x1: number; yc: number; hw: number };
  light: { x: number; y: number; red: number; green: number; yellow: number };
  rail: Pose; signs: { x: number; y: number; h: number; text: string; color: string }[]; cones: { x: number; y: number }[];
  zebra: Pose & { w: number }; bounds: { x0: number; y0: number; x1: number; y1: number };
}

/** Dựng sân theo hạng xe: mọi kích thước nhân theo cỡ xe (hạng B là chuẩn). */
export function buildCourse(cls: ExamClass): Course {
  const spec = CAR_SPECS[cls], u = spec.scale, W = 3.5 * u;
  const pieces: Piece[] = []; const marks: Course['marks'] = {}; const road: Prim[] = [];
  let x = 0, y = 0, h = 0, s = 0;
  const add = (len: number, k: number, dir: 1 | -1, w: number, hint?: string) => {
    const p: Piece = { x0: x, y0: y, h0: h, len, k, dir, s0: s, w, hint }; pieces.push(p);
    if (w > 0 && dir === 1) {
      if (k === 0) { const m = pieceAt(p, len / 2); road.push({ t: 'rect', cx: m.x, cy: m.y, hl: len / 2 + 0.3, hw: w / 2, ang: h }); }
      else { const R = 1 / k, cx = x - R * Math.sin(h), cy = y + R * Math.cos(h), aS = k > 0 ? h - Math.PI / 2 : h + Math.PI / 2, aE = aS + k * len; road.push({ t: 'arc', cx, cy, r0: Math.abs(R) - w / 2, r1: Math.abs(R) + w / 2, a0: Math.min(aS, aE) - 0.02, a1: Math.max(aS, aE) + 0.02 }); }
    }
    const e = pieceAt(p, len); x = e.x; y = e.y; h = e.h; s += len;
  };
  const fwd = (d: number, w = W, hint?: string) => add(d * u, 0, 1, w, hint);
  const turn = (R: number, deg: number, w = W, hint?: string) => add(Math.abs(deg) * Math.PI / 180 * R * u, (deg > 0 ? 1 : -1) / (R * u), 1, w, hint);
  const back = (d: number, hint?: string) => add(d * u, 0, -1, 0, hint);
  const backTurn = (R: number, deg: number, hint?: string) => add(Math.abs(deg) * Math.PI / 180 * R * u, (deg > 0 ? 1 : -1) / (R * u), -1, 0, hint); // deg > 0: đánh lái trái khi lùi
  const mark = (name: string) => { marks[name] = { x, y, h, s }; };

  // Bài 1–3: đường thẳng hướng đông: vạch xuất phát, vạch người đi bộ, dốc
  mark('begin'); fwd(6); mark('start'); fwd(8); mark('i2'); fwd(12); mark('stop2'); fwd(8); mark('i3'); fwd(6); mark('ramp0'); fwd(7); mark('stop3'); fwd(5); mark('ramp1'); fwd(3); mark('ramp2'); fwd(12); mark('ramp3'); fwd(3);
  // Bài 4: vệt bánh xe rồi đường vuông góc (hai góc vuông: trái, phải)
  mark('i4'); fwd(6); mark('track0'); fwd(8); mark('track1'); fwd(4.1);
  const cornerX = x; mark('corner');
  fwd(3, 0); turn(4, 90, 0, 'Đầu xe qua góc thì đánh hết lái trái'); fwd(4, 0); turn(4, -90, 0, 'Đầu xe qua góc thì đánh hết lái phải'); fwd(3, 0);
  { const a = cornerX, k = u, hwv = 1.9 * k; // ba hình chữ nhật tạo hai góc vuông, lòng đường 3,8 m (hạng B)
    road.push(rectXY(a - 2 * k, -hwv, a + 8.9 * k, hwv), rectXY(a + 5.1 * k, -hwv, a + 8.9 * k, 12 * k + hwv), rectXY(a + 5.1 * k, 12 * k - hwv, a + 16 * k, 12 * k + hwv)); }
  // Bài 5: ngã tư đèn tín hiệu, rẽ trái
  mark('i5'); fwd(9); mark('stop5'); fwd(1.5); const ix = x + 6 * u, iy = y; turn(6, 90); mark('after5');
  road.push(rectXY(ix - W, iy - 9 * u, ix + W, iy + 9 * u), rectXY(ix - 9 * u, iy - W, ix + 9 * u, iy + W));
  // Bài 6: đường vòng quanh co (chữ S)
  fwd(5); mark('i6'); fwd(2); turn(7.5, 115, W * 1.1); turn(7.5, -115, W * 1.1); fwd(3); mark('after6'); turn(6, 90);
  // Bài 7: ghép dọc (chuồng nằm bên phải đường, vuông góc với đường)
  fwd(4); mark('i7'); fwd(10, W, 'Tiến qua chuồng, dừng khi xe vượt mép chuồng');
  const A = { x, y, h }; mark('bayA');
  backTurn(4, -90, 'Lùi chậm, đánh hết lái phải'); back(2.6, 'Trả thẳng lái, lùi tới khi nghe báo đã vào chuồng'); mark('bayIn');
  fwd(2.6, 0, 'Tiến ra, thẳng lái'); turn(4, -90, 0, 'Đánh hết lái phải để ra khỏi chuồng');
  { // sân trống trước chuồng và chuồng: xe đang hướng tây, chuồng ở phía bắc
    const bx = A.x + 4 * u, hwB = spec.wid / 2 + 0.5 * u, mouth = A.y + 2.75 * u, depth = spec.len + 1.2 * u;
    road.push(rectXY(bx - 11 * u, A.y - 3.5 * u, bx + 6 * u, mouth), rectXY(bx - hwB, mouth - 0.2, bx + hwB, mouth + depth));
  }
  fwd(10); mark('out7');
  // Bài 8: đường sắt
  fwd(4); mark('i8'); fwd(8); mark('stop8'); fwd(8);
  // Bài 9: thay đổi số trên đường bằng
  mark('i9'); fwd(26); mark('blue'); fwd(22); mark('white'); fwd(12); mark('end9');
  turn(6, 90); fwd(18); turn(6, 90);
  // Bài 10: ghép ngang (ô đỗ song song bên phải đường)
  fwd(4); mark('i10'); fwd(16, W, 'Tiến qua ô đỗ, dừng khi đuôi xe vượt đầu ô');
  const P = { x, y, h }; mark('parA');
  const R10 = 4.2, D10 = (W / 2 + spec.wid / 2 + 0.45 * u) / u, al = Math.acos(1 - D10 / (2 * R10)) * 180 / Math.PI;
  backTurn(R10, -al, 'Lùi, đánh hết lái phải'); backTurn(R10, al, 'Đánh hết lái trái cho xe song song ô'); mark('parIn');
  turn(R10, al, 0, 'Tiến ra, đánh hết lái trái'); turn(R10, -al, 0, 'Đánh lái phải cho xe thẳng làn');
  { const hwB = spec.wid / 2 + 0.45 * u, yb = P.y - W / 2 - hwB, xr = marks.parIn.x; // xe hướng đông, ô ở phía nam
    road.push(rectXY(xr - spec.rear - 1.0 * u, yb - hwB, xr + (spec.len - spec.rear) + 3.4 * u, yb + hwB + 0.2)); }
  fwd(11); mark('out10');
  // Bài 11: kết thúc
  fwd(6); mark('finish'); fwd(8); mark('end');

  const g = (name: string, hw = W / 2 + 1.2): Gate => ({ name, x: marks[name].x, y: marks[name].y, h: marks[name].h, hw, hit: false });
  const gates = ['start', 'i2', 'i3', 'i4', 'track1', 'i5', 'after5', 'i6', 'after6', 'i7', 'out7', 'i8', 'i9', 'blue', 'white', 'end9', 'i10', 'out10', 'finish'].map((n) => g(n, n === 'out7' || n === 'out10' ? W / 2 + 1.5 : W / 2 + 1.2));
  const st = (item: ItemId, kind: StopLine['kind'], name: string): StopLine => ({ item, kind, x: marks[name].x, y: marks[name].y, h: marks[name].h, hw: W / 2 + 1, state: 'cho', still: 0, stopAlong: 0, timer: 0 });
  const stops = [st(2, 'bo_hanh', 'stop2'), st(3, 'doc', 'stop3'), st(5, 'den', 'stop5'), st(8, 'duong_sat', 'stop8')];
  const bays: Bay[] = [];
  { const bx = A.x + 4 * u, hwB = spec.wid / 2 + 0.5 * u, mouth = A.y + 2.75 * u, depth = spec.len + 1.2 * u;
    bays.push({ item: 7, rect: rectXY(bx - hwB, mouth, bx + hwB, mouth + depth), inx: 0, iny: 1, check: marks.bayIn.y - 0.5 * u, ok: false, t0: 0, timeHit: 0 }); }
  { const hwB = spec.wid / 2 + 0.45 * u, yb = P.y - W / 2 - hwB, xr = marks.parIn.x;
    bays.push({ item: 10, rect: rectXY(xr - spec.rear - 1.0 * u, yb - hwB, xr + (spec.len - spec.rear) + 3.4 * u, yb + hwB), inx: 0, iny: -1, check: -(yb + hwB - 0.25), ok: false, t0: 0, timeHit: 0 }); }
  const ramp = { x0: marks.ramp0.x, x1: marks.ramp1.x, x2: marks.ramp2.x, x3: marks.ramp3.x, hw: W / 2 + 0.4, top: (marks.ramp1.x - marks.ramp0.x) * 0.1 };
  const track = { x0: marks.track0.x, x1: marks.track1.x, yc: -spec.wid / 2 + 0.11, hw: 0.3 };
  const light = { x: marks.stop5.x + 1.2 * u, y: marks.stop5.y - W / 2 - 1.2, red: 7, green: 9, yellow: 2 };
  const rail = { x: marks.stop8.x - 2.5 * u, y: marks.stop8.y, h: marks.stop8.h };
  const sg = (name: string, text: string, color: string, side = -1) => { const m = marks[name]; return { x: m.x - Math.sin(m.h) * side * (W / 2 + 1.1), y: m.y + Math.cos(m.h) * side * (W / 2 + 1.1), h: m.h, text, color }; };
  const signs = [sg('start', '1', '#1f6fd0'), sg('i2', '2', '#1f6fd0'), sg('i3', '3', '#1f6fd0'), sg('i4', '4', '#1f6fd0'), sg('i5', '5', '#1f6fd0'), sg('i6', '6', '#1f6fd0'), sg('i7', '7', '#1f6fd0'), sg('i8', '8', '#1f6fd0'), sg('i9', '9', '#1f6fd0'), sg('blue', '20', '#1f6fd0', 1), sg('white', '20', '#f4f4f4', 1), sg('i10', '10', '#1f6fd0'), sg('finish', '11', '#1f6fd0')];
  const cones: Course['cones'] = [];
  for (const b of bays) if (b.rect.t === 'rect') for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cones.push({ x: b.rect.cx + sx * (b.rect.hl + 0.25), y: b.rect.cy + sy * (b.rect.hw + 0.25) });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pieces) for (let d = 0; d <= p.len; d += 2) { const q = pieceAt(p, d); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  return { spec, pieces, total: s, marks, road, gates, stops, bays, ramp, track, light, rail, signs, cones, zebra: { ...marks.stop2, x: marks.stop2.x + 2.2 * u, w: 3 * u }, bounds: { x0: x0 - 14, y0: y0 - 14, x1: x1 + 14, y1: y1 + 14 } };
}

/** Cao độ mặt sân (chỉ có ở dốc bài 3). */
export function heightAt(c: Course, x: number, y: number): number {
  const r = c.ramp; if (Math.abs(y) > r.hw || x <= r.x0 || x >= r.x3) return 0;
  if (x < r.x1) return (x - r.x0) / (r.x1 - r.x0) * r.top; if (x <= r.x2) return r.top; return (r.x3 - x) / (r.x3 - r.x2) * r.top;
}
function slopeX(c: Course, x: number, y: number): number { const r = c.ramp; if (Math.abs(y) > r.hw || x <= r.x0 || x >= r.x3) return 0; if (x < r.x1) return r.top / (r.x1 - r.x0); if (x <= r.x2) return 0; return -r.top / (r.x3 - r.x2); }

export type Gear = 'D' | 'R' | 'P';
export interface Input { steer: number; gas: number; brake: number; gear: Gear; hand: boolean; left: boolean; right: boolean; hazard: boolean; belt: boolean }
export const idleInput = (): Input => ({ steer: 0, gas: 0, brake: 0, gear: 'P', hand: true, left: false, right: false, hazard: false, belt: false });
export interface Penalty { item: ItemId | 0; points: number; text: string; out?: boolean; t: number }
export interface SimEvent { type: 'item' | 'penalty' | 'ok' | 'say' | 'end'; item?: ItemId; text?: string; points?: number }

/** Bảng điểm trừ đang cài (để hiển thị và để người rà đối chiếu quy trình sát hạch). */
export const RULES: { item: ItemId | 0; text: string; points: number | 'truat' }[] = [
  { item: 1, text: 'Không thắt dây an toàn', points: 5 }, { item: 1, text: 'Không bật xi nhan trái khi xuất phát', points: 5 }, { item: 1, text: 'Quá 20 giây chưa xuất phát', points: 5 }, { item: 1, text: 'Quá 30 giây chưa xuất phát', points: 'truat' },
  { item: 2, text: 'Không dừng xe ở vạch dừng', points: 5 }, { item: 2, text: 'Dừng xe chưa đến vạch (cách quá 50 cm)', points: 5 }, { item: 2, text: 'Dừng xe quá vạch dừng', points: 5 },
  { item: 3, text: 'Không dừng xe ở vạch dừng trên dốc', points: 'truat' }, { item: 3, text: 'Dừng xe chưa đến vạch (cách quá 50 cm)', points: 5 }, { item: 3, text: 'Dừng xe quá vạch dừng', points: 'truat' }, { item: 3, text: 'Xe tụt dốc quá 50 cm', points: 'truat' }, { item: 3, text: 'Quá 30 giây không khởi hành qua vạch', points: 'truat' },
  { item: 4, text: 'Bánh xe bên phải không qua vệt bánh xe', points: 'truat' }, { item: 4, text: 'Bánh xe đè vạch giới hạn', points: 5 },
  { item: 5, text: 'Vượt đèn đỏ', points: 10 }, { item: 5, text: 'Dừng xe quá vạch dừng', points: 5 }, { item: 5, text: 'Không bật xi nhan khi rẽ', points: 5 },
  { item: 6, text: 'Bánh xe đè vạch giới hạn (mỗi 5 giây)', points: 5 },
  { item: 7, text: 'Bánh xe đè vạch', points: 5 }, { item: 7, text: 'Không ghép được xe vào nơi đỗ', points: 'truat' }, { item: 7, text: 'Quá 2 phút', points: 5 },
  { item: 8, text: 'Không dừng xe ở vạch dừng', points: 5 }, { item: 8, text: 'Dừng xe chưa đến vạch (cách quá 50 cm)', points: 5 }, { item: 8, text: 'Dừng xe quá vạch dừng', points: 5 },
  { item: 9, text: 'Không đạt tốc độ trước biển 20 xanh', points: 5 }, { item: 9, text: 'Không giảm tốc độ trước biển 20 trắng', points: 5 },
  { item: 10, text: 'Bánh xe đè vạch', points: 5 }, { item: 10, text: 'Không ghép được xe vào nơi đỗ', points: 'truat' }, { item: 10, text: 'Quá 2 phút', points: 5 },
  { item: 11, text: 'Không bật xi nhan phải khi qua vạch kết thúc', points: 5 },
  { item: 0, text: 'Xe lên vỉa hè (bánh ra ngoài vạch quá 70 cm)', points: 'truat' }, { item: 0, text: 'Chạy quá tốc độ quy định (mỗi 3 giây)', points: 1 }, { item: 0, text: 'Quá tổng thời gian 18 phút (mỗi 3 giây)', points: 1 },
  { item: 0, text: 'Tình huống nguy hiểm: không phanh dừng trong 3 giây', points: 10 }, { item: 0, text: 'Tình huống nguy hiểm: không bật đèn khẩn cấp trong 5 giây', points: 10 },
];

export class ExamSim {
  c: Course; x = 0; y = 0; th = 0; v = 0; delta = 0; t = 0;
  score = 100; item: ItemId = 1; log: Penalty[] = []; done = false; passed = false; outReason: string | null = null;
  practice: boolean; events: SimEvent[] = []; lightT = 0;
  private outT = -99; private overT = 0; private lateT = 0; private startWarn = false; private prevAlong: number[] = [];
  private trackMiss = [false, false]; private trackSeen = [false, false]; private trackDone = false;
  danger: { t0: number; stopped: boolean; hazard: boolean; judged: boolean } | null = null; private dangerAt: number; private dangerUsed = false;
  input: Input = idleInput();
  constructor(cls: ExamClass, opts: { practice?: boolean; from?: ItemId; danger?: boolean } = {}) {
    this.c = buildCourse(cls); this.practice = !!opts.practice;
    this.dangerAt = opts.danger === false ? -1 : this.c.marks.out7.s; // tình huống nguy hiểm: báo trên đoạn thẳng sau bài 7
    this.resetTo(opts.from ?? 1);
  }
  /** Đặt xe vào đầu một bài (chế độ tập). */
  resetTo(id: ItemId) {
    const m = this.c.marks, start: Record<number, string> = { 1: 'begin', 2: 'start', 3: 'i3', 4: 'i4', 5: 'i5', 6: 'after5', 7: 'after6', 8: 'out7', 9: 'i8', 10: 'end9', 11: 'out10' };
    let p = m[start[id]]; const back = id === 1 ? 0 : (this.c.spec.wb + (this.c.spec.len - this.c.spec.wb - this.c.spec.rear)) + 1.5;
    if (id === 9) p = { ...m.i9, s: m.i9.s }; if (id === 7) p = m.i7; if (id === 10) p = m.i10;
    this.x = p.x - Math.cos(p.h) * back; this.y = p.y - Math.sin(p.h) * back; this.th = p.h; this.v = 0; this.delta = 0; this.item = id;
    for (const g of this.c.gates) g.hit = m[g.name].s < p.s - 0.01; for (const s of this.c.stops) { s.state = s.item < id ? 'xong' : 'cho'; s.still = 0; }
    for (const b of this.c.bays) { b.ok = b.item < id; b.t0 = 0; b.timeHit = 0; }
    this.prevAlong = []; this.auto = null; this.trackDone = id > 4; this.trackMiss = [false, false]; this.trackSeen = [false, false];
    this.emit({ type: 'item', item: id, text: ITEMS[id - 1].say });
  }
  private emit(e: SimEvent) { this.events.push(e); }
  private pen(item: ItemId | 0, points: number, text: string) { this.score = Math.max(0, this.score - points); this.log.push({ item, points, text, t: this.t }); this.emit({ type: 'penalty', item: item || undefined, points, text }); }
  private out(item: ItemId | 0, text: string) {
    this.log.push({ item, points: 0, text, out: true, t: this.t }); this.emit({ type: 'penalty', item: item || undefined, points: 0, text: `Truất quyền thi: ${text}` });
    if (!this.practice) { this.outReason = text; this.finish(); }
  }
  private finish() { if (this.done) return; this.done = true; this.passed = !this.outReason && this.score >= 80; this.emit({ type: 'end' }); }
  get front() { const L = this.c.spec.len - this.c.spec.rear; return { x: this.x + Math.cos(this.th) * L, y: this.y + Math.sin(this.th) * L }; }
  wheels(): { x: number; y: number }[] { // trước trái, trước phải, sau trái, sau phải
    const s = this.c.spec, c = Math.cos(this.th), n = Math.sin(this.th), hw = s.wid / 2 - 0.11, out: { x: number; y: number }[] = [];
    for (const a of [s.wb, 0]) for (const b of [hw, -hw]) out.push({ x: this.x + c * a - n * b, y: this.y + n * a + c * b }); return out;
  }
  lightColor(): 'do' | 'vang' | 'xanh' { const l = this.c.light, p = this.lightT % (l.red + l.green + l.yellow); return p < l.red ? 'do' : p < l.red + l.green ? 'xanh' : 'vang'; }
  get kmh() { return Math.abs(this.v) * 3.6; }

  step(dt: number, inp: Input) {
    if (this.done) return; this.input = inp; const s = this.c.spec; this.t += dt; this.lightT += dt;
    // --- vật lý
    const want = Math.max(-1, Math.min(1, inp.steer)) * s.maxSteer, rate = 1.9 * dt; this.delta += Math.max(-rate, Math.min(rate, want - this.delta));
    const g = slopeX(this.c, this.x + Math.cos(this.th) * s.wb / 2, this.y + Math.sin(this.th) * s.wb / 2) * Math.cos(this.th) * 9.81 / Math.hypot(1, 0.1);
    let a = -g; const dir = inp.gear === 'D' ? 1 : inp.gear === 'R' ? -1 : 0;
    a += dir * inp.gas * 2.4 * (dir < 0 ? 0.6 : 1); a -= this.v * 0.06 + Math.sign(this.v) * 0.12 * (Math.abs(this.v) > 0.02 ? 1 : 0);
    const hold = inp.brake * 7 + (inp.hand || inp.gear === 'P' ? 9 : 0);
    let v = this.v + a * dt;
    if (hold > 0) { const dv = hold * dt; if (Math.abs(v) <= dv) v = 0; else v -= Math.sign(v) * dv; }
    if (hold === 0 && Math.abs(a) < 0.12 && Math.abs(v) < 0.03) v = 0;
    const vmax = dir < 0 ? 3 : 11; v = Math.max(dir >= 0 ? -3 : -vmax, Math.min(dir <= 0 ? 3 : vmax, v));
    this.v = v; this.x += Math.cos(this.th) * v * dt; this.y += Math.sin(this.th) * v * dt; this.th = wrap(this.th + v / s.wb * Math.tan(this.delta) * dt);
    // --- chấm điểm
    this.judge(dt, inp);
  }

  private along(p: { x: number; y: number; h: number }, q: { x: number; y: number }) { return (q.x - p.x) * Math.cos(p.h) + (q.y - p.y) * Math.sin(p.h); }
  private lateral(p: { x: number; y: number; h: number }, q: { x: number; y: number }) { return -(q.x - p.x) * Math.sin(p.h) + (q.y - p.y) * Math.cos(p.h); }
  private setItem(id: ItemId) { if (this.item === id) return; this.item = id; this.emit({ type: 'item', item: id, text: ITEMS[id - 1].say }); }

  private judge(dt: number, inp: Input) {
    const c = this.c, F = this.front, W = this.wheels();
    // bài 1: chậm xuất phát
    const g0 = c.gates[0];
    if (!g0.hit && this.item === 1) { if (this.t > 20 && !this.startWarn) { this.startWarn = true; this.pen(1, 5, 'Quá 20 giây chưa xuất phát'); } if (this.t > 30) { this.out(1, 'quá 30 giây chưa xuất phát'); if (this.practice) this.t = 0; } }
    // cổng
    c.gates.forEach((gt, i) => {
      const al = this.along(gt, F), prev = this.prevAlong[i]; this.prevAlong[i] = al;
      if (gt.hit || prev === undefined || !(prev < 0 && al >= 0 && al - prev < 3) || Math.abs(this.lateral(gt, F)) > gt.hw) return;
      gt.hit = true; this.onGate(gt.name, inp);
    });
    // vạch dừng
    for (const st of c.stops) {
      if (st.state === 'xong') continue; const al = this.along(st, F); if (Math.abs(this.lateral(st, F)) > st.hw) continue;
      const still = Math.abs(this.v) < 0.05;
      if (st.state === 'cho') {
        if (al < -6) continue;
        st.still = still ? st.still + dt : 0;
        if (al <= 0.05 && st.still > 0.35) {
          if (st.kind === 'den' && al < -0.5 && this.lightColor() === 'xanh') { /* dừng xa vạch khi đèn xanh thì không tính */ }
          else {
            st.state = 'da_dung'; st.stopAlong = al; st.timer = 0;
            if (-al > 0.5) { if (st.kind !== 'den') this.pen(st.item, 5, `Dừng xe chưa đến vạch (cách ${(-al).toFixed(1)} m)`); } else this.emit({ type: 'ok', item: st.item, text: 'Dừng đúng vị trí' });
          }
        } else if (al > 0.05) {
          if (st.kind === 'den') { const col = this.lightColor(); if (col !== 'xanh') this.pen(5, 10, col === 'do' ? 'Vượt đèn đỏ' : 'Vượt đèn vàng'); st.state = 'xong'; }
          else if (still && st.still > 0.35) { st.state = 'xong'; if (st.kind === 'doc') this.out(3, 'dừng xe quá vạch dừng trên dốc'); else this.pen(st.item, 5, 'Dừng xe quá vạch dừng'); }
          else if (al > 1.2) { st.state = 'xong'; if (st.kind === 'doc') this.out(3, 'không dừng xe ở vạch dừng trên dốc'); else this.pen(st.item, 5, 'Không dừng xe ở vạch dừng'); }
        }
      } else { // đã dừng: theo dõi tụt dốc, thời gian, đèn
        st.timer += dt;
        if (st.kind === 'doc') {
          if (st.stopAlong - al > 0.5) { st.state = 'xong'; this.out(3, 'xe tụt dốc quá 50 cm'); }
          else if (al > 1) st.state = 'xong'; else if (st.timer > 30) { st.state = 'xong'; this.out(3, 'quá 30 giây không khởi hành qua vạch dừng'); }
        } else if (st.kind === 'den') { if (al > 0.05) { const col = this.lightColor(); if (col === 'do') this.pen(5, 10, 'Vượt đèn đỏ'); st.state = 'xong'; } }
        else if (al > 0.3) st.state = 'xong';
      }
    }
    // bài 4: vệt bánh xe (hai bánh bên phải)
    if (!this.trackDone && this.item === 4) {
      const tr = c.track; [W[1], W[3]].forEach((w, i) => { if (w.x >= tr.x0 && w.x <= tr.x1) { this.trackSeen[i] = true; if (Math.abs(w.y - tr.yc) > tr.hw) this.trackMiss[i] = true; } });
      if (W[3].x > tr.x1 + 0.3) { this.trackDone = true; if (this.trackMiss[0] || this.trackMiss[1] || !this.trackSeen[0] || !this.trackSeen[1]) this.out(4, `bánh ${this.trackMiss[0] && this.trackMiss[1] ? 'trước và sau' : this.trackMiss[0] ? 'trước' : 'sau'} bên phải không qua vệt bánh xe`); else this.emit({ type: 'ok', item: 4, text: 'Hai bánh phải qua đúng vệt bánh xe' }); }
    }
    // chuồng ghép dọc, ô ghép ngang
    for (const b of c.bays) {
      if (b.ok || this.item !== b.item) continue; b.timeHit += 0;
      if (this.t - b.t0 > 120 * (b.timeHit + 1) && b.t0 > 0) { b.timeHit++; this.pen(b.item, 5, 'Quá 2 phút chưa ghép xong'); }
      if (Math.abs(this.v) < 0.12 && W.every((w) => inPrim(b.rect, w.x, w.y, 0.02)) && this.x * b.inx + this.y * b.iny >= b.check) { b.ok = true; this.emit({ type: 'ok', item: b.item, text: 'Đã ghép xe đúng vị trí. Cho xe tiến ra.' }); }
    }
    // đè vạch, lên vỉa
    let outW = 0, far = false; for (const w of W) { if (!c.road.some((p) => inPrim(p, w.x, w.y, 0.06))) { outW++; if (!c.road.some((p) => inPrim(p, w.x, w.y, 0.7))) far = true; } }
    if (far) { this.out(0, 'xe lên vỉa hè'); if (this.practice) this.outT = this.t; }
    else if (outW > 0 && this.t - this.outT >= 5) { this.outT = this.t; this.pen(this.item, 5, 'Bánh xe đè vạch'); }
    // tốc độ, tổng thời gian
    if (this.item !== 9 && this.kmh > c.spec.limitKmh + 0.5) { this.overT += dt; if (this.overT >= 3) { this.overT = 0; this.pen(0, 1, `Chạy quá ${c.spec.limitKmh} km/h trong sân`); } } else this.overT = 0;
    if (this.t > 18 * 60) { this.lateT += dt; if (this.lateT >= 3) { this.lateT = 0; this.pen(0, 1, 'Quá tổng thời gian 18 phút'); } }
    // tình huống nguy hiểm
    if (this.danger) {
      const d = this.danger, el = this.t - d.t0; if (Math.abs(this.v) < 0.1) d.stopped = true; if (inp.hazard) d.hazard = true;
      if (!d.judged && el > 3 && !d.stopped) { d.judged = true; this.pen(0, 10, 'Tình huống nguy hiểm: không phanh dừng trong 3 giây'); }
      if (el > 5) { if (!d.hazard) this.pen(0, 10, 'Tình huống nguy hiểm: không bật đèn khẩn cấp'); this.danger = null; this.emit({ type: 'say', text: 'Hết tình huống nguy hiểm. Tắt đèn khẩn cấp và đi tiếp.' }); }
    }
  }

  private onGate(name: string, inp: Input) {
    const c = this.c, kmh = this.kmh;
    switch (name) {
      case 'start': if (!inp.belt) this.pen(1, 5, 'Không thắt dây an toàn'); if (!inp.left && !inp.hazard) this.pen(1, 5, 'Không bật xi nhan trái khi xuất phát'); break;
      case 'i2': this.setItem(2); break; case 'i3': this.setItem(3); break; case 'i4': this.setItem(4); break;
      case 'i5': this.setItem(5); break;
      case 'after5': if (!inp.left) this.pen(5, 5, 'Không bật xi nhan trái khi rẽ'); break;
      case 'i6': this.setItem(6); break;
      case 'i7': this.setItem(7); c.bays[0].t0 = this.t; break;
      case 'out7': if (!c.bays[0].ok) this.out(7, 'không ghép được xe vào nơi đỗ'); if (this.dangerAt >= 0 && !this.dangerUsed) { this.dangerUsed = true; this.danger = { t0: this.t, stopped: false, hazard: false, judged: false }; this.emit({ type: 'say', text: 'TÌNH HUỐNG NGUY HIỂM! Phanh dừng xe và bật đèn khẩn cấp.' }); } break;
      case 'i8': this.setItem(8); break; case 'i9': this.setItem(9); break;
      case 'blue': if (kmh < 24) this.pen(9, 5, `Không đạt 24 km/h trước biển 20 xanh (mới ${kmh.toFixed(0)} km/h)`); else this.emit({ type: 'ok', item: 9, text: 'Đạt tốc độ, giờ giảm xuống dưới 24 km/h' }); break;
      case 'white': if (kmh > 24) this.pen(9, 5, `Chưa giảm dưới 24 km/h trước biển 20 trắng (còn ${kmh.toFixed(0)} km/h)`); break;
      case 'i10': this.setItem(10); c.bays[1].t0 = this.t; break;
      case 'out10': if (!c.bays[1].ok) this.out(10, 'không ghép được xe vào nơi đỗ'); this.setItem(11); break;
      case 'finish': if (!inp.right) this.pen(11, 5, 'Không bật xi nhan phải khi qua vạch kết thúc'); this.finish(); break;
    }
  }

  // ------------------------------------------------------------- lái mẫu (dùng cho gợi ý và kiểm thử tự động)
  private auto: { i: number; d: number; wait: number } | null = null;
  /** Vị trí của xe trên đường mẫu (để vẽ gợi ý). */
  autoState() { return this.auto; }
  /** Trả về thao tác lái mẫu cho bước kế tiếp: bám đường chạy mẫu, dừng đúng vạch, bật tín hiệu đúng lúc. */
  autoInput(dt: number): Input {
    const c = this.c, s = c.spec, P = c.pieces;
    if (!this.auto) { // tìm đoạn gần nhất phía trước
      let best = 0, bd = 1e9; P.forEach((p, i) => { for (let d = 0; d <= p.len; d += 0.5) { const q = pieceAt(p, d), e = Math.hypot(q.x - this.x, q.y - this.y) + Math.abs(wrap(q.h - this.th)) * 3; if (e < bd - 1e-6) { bd = e; best = i; } } });
      let d0 = 0, bd2 = 1e9; for (let d = 0; d <= P[best].len; d += 0.1) { const q = pieceAt(P[best], d), e = Math.hypot(q.x - this.x, q.y - this.y); if (e < bd2) { bd2 = e; d0 = d; } }
      this.auto = { i: best, d: d0, wait: 0 };
    }
    const A = this.auto; let p = P[A.i];
    // chiếu xe lên đoạn hiện tại
    { let bd = 1e9, bdd = A.d; for (let d = Math.max(0, A.d - 0.6); d <= Math.min(p.len, A.d + 1.2); d += 0.02) { const q = pieceAt(p, d), e = Math.hypot(q.x - this.x, q.y - this.y); if (e < bd) { bd = e; bdd = d; } } A.d = bdd; }
    const inp: Input = { steer: 0, gas: 0, brake: 0, gear: p.dir > 0 ? 'D' : 'R', hand: false, left: false, right: false, hazard: false, belt: true };
    const nextP = P[A.i + 1], remain = p.len - A.d;
    const stopAtEnd = !nextP || nextP.dir !== p.dir;
    if (remain < (stopAtEnd ? 0.06 : 0.02) || (stopAtEnd && remain < 0.25 && Math.abs(this.v) < 0.05)) {
      if (!nextP) { inp.brake = 1; return inp; }
      if (stopAtEnd) { if (Math.abs(this.v) > 0.03 || A.wait < 0.6) { A.wait += Math.abs(this.v) > 0.03 ? 0 : dt; inp.brake = 1; inp.steer = Math.atan(s.wb * nextP.k) / s.maxSteer; return inp; } }
      A.i++; A.d = 0; A.wait = 0; p = P[A.i]; inp.gear = p.dir > 0 ? 'D' : 'R';
    }
    const q = pieceAt(p, A.d), e = this.lateral(q, this), eh = wrap(this.th - q.h);
    const fb = p.dir > 0 ? -1.6 * eh - 0.9 * e : 1.6 * eh - 0.9 * e;
    const target = Math.atan(s.wb * p.k) + Math.max(-0.5, Math.min(0.5, fb));
    inp.steer = Math.max(-1, Math.min(1, target / s.maxSteer));
    // tốc độ mong muốn
    const sNow = p.s0 + A.d, m = c.marks; let vt = p.dir < 0 ? 1.1 : Math.abs(p.k) > 1e-6 ? (Math.abs(1 / p.k) < 5 * s.scale ? 1.6 : 2.4) : 4.2;
    if (p.w === 0 && p.dir > 0) vt = Math.min(vt, 1.5);
    if (nextP && nextP.dir === p.dir && Math.abs(nextP.k - p.k) > 0.02 && remain < 2.5) vt = Math.min(vt, 1.2);
    if (Math.abs(target - this.delta) > 0.12) vt = Math.min(vt, 0.35);
    if (stopAtEnd) vt = Math.min(vt, Math.max(0.25, Math.sqrt(2 * 1.2 * Math.max(0, remain - 0.05))));
    if (sNow > m.i9.s - 2 && sNow < m.blue.s + 1) vt = 8.2; else if (sNow >= m.blue.s + 1 && sNow < m.white.s + 2) vt = 5.2;
    if (sNow > m.ramp0.s - 4 && sNow < m.ramp3.s) vt = Math.min(vt, 2.6);
    if (sNow > m.track0.s - 8 && sNow < m.track1.s + 3) vt = Math.min(vt, 1.8);
    // tín hiệu
    if (sNow < m.start.s + 5) inp.left = true; if (sNow > m.i5.s && sNow < m.after5.s + 2) inp.left = true; if (sNow > m.out10.s) inp.right = true;
    // vạch dừng
    let hold = false;
    for (const st of c.stops) {
      if (st.state === 'xong') continue; const al = this.along(st, this.front); if (al < -14 || al > 0.3 || Math.abs(this.lateral(st, this.front)) > st.hw) continue;
      const mustStop = st.kind !== 'den' || this.lightColor() !== 'xanh' || st.state === 'da_dung' && this.lightColor() !== 'xanh';
      if (st.state === 'cho' && mustStop) { const gap = -al - 0.22; vt = Math.min(vt, gap <= 0 ? 0 : Math.max(0.18, Math.sqrt(2 * 1.0 * gap))); if (gap <= 0.02) hold = true; }
      else if (st.state === 'da_dung') { if (st.kind === 'den' ? this.lightColor() !== 'xanh' : st.timer < 1.0) hold = true; }
    }
    if (this.danger) { inp.hazard = true; hold = true; }
    if (hold) { inp.brake = 1; inp.gas = 0; return inp; }
    const up = slopeX(c, this.x + Math.cos(this.th) * s.wb / 2, this.y) * 9.81 * Math.cos(this.th) * p.dir, sp = this.v * p.dir, err = vt - sp;
    if (err > 0) inp.gas = Math.max(0, Math.min(1, err * 1.4 + Math.max(0, up) / 2.4 + 0.08)); else if (err < -0.25) inp.brake = Math.min(1, -err * 0.5);
    if (vt === 0) inp.brake = 1;
    return inp;
  }
  /** Gợi ý thao tác cho đoạn đường mẫu gần xe nhất (chế độ tập). */
  hint(): string | null { const a = this.auto; return a ? this.c.pieces[a.i].hint ?? null : null; }
}

/** Kết quả theo từng bài để hiện bảng điểm. */
export function summarize(sim: ExamSim): { item: ItemInfo; lost: number; out: boolean; notes: string[]; reached: boolean }[] {
  return ITEMS.map((it) => { const ps = sim.log.filter((l) => l.item === it.id); return { item: it, lost: ps.reduce((a, b) => a + b.points, 0), out: ps.some((p) => p.out), notes: ps.map((p) => (p.out ? `Truất quyền: ${p.text}` : `−${p.points}: ${p.text}`)), reached: sim.item >= it.id }; });
}
