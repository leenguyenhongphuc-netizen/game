// Bản đồ một tỉnh: bờ biển thật, sông, mốc địa danh và ghim các điểm tham quan đúng toạ độ.
// Thêm tỉnh mới: thêm một bản ghi vào PROVINCE_MAPS (khung, sông, mốc); không phải sửa component.
import { useEffect, useMemo, useRef } from 'react';
import type { Sight } from '../../../shared/sights.ts';
import { makeProj, ringPath, usePanZoom } from './geo.ts';
import type { BBox } from './geo.ts';
import type { Ring } from './vn-outline.ts';
import type { MapRegion } from './VietnamMap.tsx';

type LL = [number, number]; // [kinh độ, vĩ độ]
export interface ProvinceMapData {
  box: BBox;
  /** Đất liền chi tiết dùng cho khung này. */
  land: Ring;
  rivers: { name: string; pts: LL[]; label?: LL; width?: number }[];
  /** Đảo nhỏ vẽ tay: tâm, bán kính ngang/dọc theo độ, góc xoay. */
  islets?: { name?: string; at: LL; rx: number; ry: number; rot?: number }[];
  towns: { name: string; at: LL; big?: boolean }[];
  peaks?: { name: string; at: LL; pass?: boolean }[];
  /** Nhãn vùng nước, tỉnh bạn, nước bạn. */
  labels: { text: string; at: LL; kind: 'sea' | 'bay' | 'next' }[];
  /** Tuyến tàu ra đảo (nét đứt trên biển). */
  routes?: { name: string; pts: LL[] }[];
}

// Bờ biển Đà Nẵng – Quảng Nam chấm theo các mốc thật (từ nam ra bắc): Dung Quất, Kỳ Hà, Tam Thanh, Cửa Đại, An Bàng, Non Nước,
// Mỹ Khê, bán đảo Sơn Trà, cửa sông Hàn, Nam Ô, mũi Hải Vân, Lăng Cô. Nguồn 1:10 triệu quá thô ở mức phóng này nên phải chấm tay.
const DA_NANG_LAND: Ring = [
  [108.95, 15.2], [108.9, 15.26], [108.83, 15.33], [108.79, 15.4], [108.73, 15.415], [108.7, 15.44], [108.695, 15.485], [108.64, 15.51], [108.57, 15.575], [108.52, 15.65],
  [108.47, 15.73], [108.43, 15.81], [108.405, 15.872], [108.37, 15.9], [108.335, 15.925], [108.3, 15.965], [108.275, 16.0], [108.258, 16.04], [108.25, 16.075], [108.262, 16.097],
  [108.3, 16.1], [108.335, 16.105], [108.348, 16.122], [108.33, 16.14], [108.295, 16.146], [108.26, 16.14], [108.232, 16.128], [108.222, 16.108], [108.212, 16.09], [108.19, 16.077],
  [108.16, 16.082], [108.135, 16.105], [108.125, 16.13], [108.14, 16.16], [108.17, 16.185], [108.2, 16.2], [108.212, 16.215], [108.18, 16.222], [108.13, 16.225], [108.08, 16.235],
  [108.03, 16.27], [107.95, 16.31], [107.85, 16.36], [107.3, 16.6], [107.3, 15.0], [108.95, 15.0],
];

// Bờ biển Quảng Ngãi chấm theo các mốc thật (từ nam ra bắc): Sa Huỳnh, Đức Phổ, Mộ Đức, cửa Cổ Luỹ (sông Trà Khúc), Mỹ Khê, cảng Sa Kỳ,
// mũi Ba Làng An, vịnh Dung Quất, rồi nối sang Kỳ Hà, Tam Thanh của Đà Nẵng.
const QUANG_NGAI_LAND: Ring = [
  [109.07, 14.3], [109.075, 14.52], [109.085, 14.6], [109.075, 14.665], [109.05, 14.72], [109.04, 14.8], [109.0, 14.88], [108.965, 14.96], [108.935, 15.05], [108.905, 15.115],
  [108.895, 15.15], [108.91, 15.19], [108.94, 15.215], [108.948, 15.24], [108.925, 15.268], [108.885, 15.3], [108.855, 15.36], [108.835, 15.4], [108.8, 15.415], [108.77, 15.4],
  [108.73, 15.415], [108.7, 15.44], [108.695, 15.485], [108.64, 15.51], [108.57, 15.575], [108.5, 15.68], [108.0, 15.9], [108.0, 14.3],
];

export const PROVINCE_MAPS: Record<string, ProvinceMapData> = {
  'Quảng Ngãi': {
    box: { lat0: 14.6, lat1: 15.55, lng0: 108.38, lng1: 109.26 },
    land: QUANG_NGAI_LAND,
    rivers: [
      // Trà Khúc: Sơn Hà → Sơn Tịnh → TP Quảng Ngãi → cửa Cổ Luỹ
      { name: 'Sông Trà Khúc', pts: [[108.42, 14.98], [108.52, 15.06], [108.64, 15.1], [108.74, 15.135], [108.8, 15.128], [108.86, 15.14], [108.9, 15.15]], label: [108.6, 15.07], width: 1.5 },
      // Trà Bồng: thị trấn Trà Bồng → Châu Ổ → cửa Sa Cần (vịnh Dung Quất)
      { name: 'Sông Trà Bồng', pts: [[108.44, 15.24], [108.56, 15.265], [108.68, 15.29], [108.76, 15.305], [108.81, 15.35], [108.83, 15.4]], label: [108.66, 15.315] },
      // Sông Vệ: Nghĩa Hành → Mộ Đức → nhập cửa Cổ Luỹ
      { name: 'Sông Vệ', pts: [[108.62, 14.84], [108.74, 14.93], [108.84, 15.02], [108.89, 15.09], [108.9, 15.15]], label: [108.73, 14.89] },
    ],
    islets: [
      { name: 'Đảo Lý Sơn', at: [109.12, 15.38], rx: 0.034, ry: 0.014, rot: -12 },
      { name: 'Đảo Bé', at: [109.085, 15.432], rx: 0.009, ry: 0.006 },
    ],
    towns: [
      { name: 'TP. Quảng Ngãi', at: [108.8, 15.122], big: true }, { name: 'Cảng Sa Kỳ', at: [108.925, 15.21] },
      { name: 'Dung Quất', at: [108.79, 15.39] }, { name: 'Đức Phổ', at: [108.96, 14.81] }, { name: 'Sa Huỳnh', at: [109.065, 14.665] },
    ],
    peaks: [{ name: 'Trường Sơn', at: [108.5, 14.78] }, { name: 'Mũi Ba Làng An', at: [108.955, 15.262], pass: true }],
    labels: [
      { text: 'Biển Đông', at: [109.14, 14.98], kind: 'sea' }, { text: 'Vịnh Dung Quất', at: [108.86, 15.455], kind: 'bay' }, { text: 'Cửa Cổ Luỹ', at: [108.955, 15.14], kind: 'bay' },
      { text: 'Đà Nẵng', at: [108.5, 15.5], kind: 'next' }, { text: 'Gia Lai', at: [108.75, 14.64], kind: 'next' },
    ],
    routes: [{ name: 'Tàu cao tốc Sa Kỳ – Lý Sơn, khoảng 30 km', pts: [[108.935, 15.215], [109.0, 15.28], [109.07, 15.345], [109.1, 15.372]] }],
  },
  'Đà Nẵng': {
    box: { lat0: 15.3, lat1: 16.3, lng0: 107.68, lng1: 108.74 },
    land: DA_NANG_LAND,
    rivers: [
      // Vu Gia: Thạnh Mỹ → Ái Nghĩa → Cẩm Lệ → sông Hàn → vịnh Đà Nẵng
      { name: 'Sông Vu Gia', pts: [[107.72, 15.62], [107.84, 15.77], [107.98, 15.84], [108.11, 15.88], [108.15, 15.95], [108.2, 16.01]], label: [107.9, 15.84] },
      { name: 'Sông Hàn', pts: [[108.2, 16.01], [108.225, 16.035], [108.226, 16.06], [108.223, 16.085], [108.215, 16.105]], width: 1.5 },
      // Thu Bồn: Hiệp Đức → Nông Sơn → Giao Thuỷ → Câu Lâu → Hội An → Cửa Đại
      { name: 'Sông Thu Bồn', pts: [[108.2, 15.35], [108.1, 15.58], [108.03, 15.7], [108.08, 15.79], [108.12, 15.84], [108.2, 15.855], [108.26, 15.86], [108.33, 15.873], [108.39, 15.88]], label: [108.19, 15.8], width: 1.5 },
      { name: '', pts: [[108.11, 15.88], [108.12, 15.84]] }, // nhánh Quảng Huế nối Vu Gia với Thu Bồn
    ],
    islets: [
      { name: 'Cù Lao Chàm', at: [108.51, 15.95], rx: 0.03, ry: 0.016, rot: -35 },
      { at: [108.44, 15.97], rx: 0.007, ry: 0.005 }, { at: [108.47, 15.99], rx: 0.006, ry: 0.004 }, { at: [108.53, 15.91], rx: 0.006, ry: 0.004 },
    ],
    towns: [
      { name: 'Đà Nẵng', at: [108.2, 16.072], big: true }, { name: 'Tam Kỳ', at: [108.474, 15.573] },
      { name: 'Ái Nghĩa', at: [108.11, 15.88] }, { name: 'Thạnh Mỹ', at: [107.84, 15.77] },
    ],
    peaks: [
      { name: 'Đèo Hải Vân', at: [108.11, 16.2], pass: true }, { name: 'Bạch Mã', at: [107.86, 16.2] }, { name: 'Hòn Kẽm Đá Dừng', at: [107.98, 15.64] },
    ],
    labels: [
      { text: 'Biển Đông', at: [108.62, 15.75], kind: 'sea' }, { text: 'Vịnh Đà Nẵng', at: [108.19, 16.14], kind: 'bay' }, { text: 'Cửa Đại', at: [108.47, 15.862], kind: 'bay' },
      { text: 'TP. Huế', at: [107.9, 16.26], kind: 'next' }, { text: 'Quảng Ngãi', at: [108.6, 15.33], kind: 'next' },
    ],
    routes: [{ name: 'Tàu Cửa Đại – Cù Lao Chàm', pts: [[108.4, 15.88], [108.44, 15.91], [108.49, 15.94]] }],
  },
};
/** Tỉnh đã có bản đồ riêng. */
export const hasProvinceMap = (province: string) => province in PROVINCE_MAPS;

export type MapSight = Sight & { km?: number; taxiFare?: number; done?: boolean };
export interface ProvinceMapProps {
  province: string;
  sights: MapSight[];
  /** Vùng trồng (chỉ những vùng thuộc tỉnh này được ghim). */
  regions: MapRegion[];
  currentRegionId?: string | null;
  selectedId?: string | null;
  onSelect: (sightId: string) => void;
}

type Box4 = [number, number, number, number];
/** Xếp nhãn tham lam: thử phải, trái, dưới, trên rồi bốn góc chéo; chọn vị trí đầu tiên không đè lên ghim hay nhãn khác.
 *  Không còn chỗ thì bỏ nhãn (ghim vẫn có số, tên nằm ở danh sách bên dưới) — trừ ghim đang chọn (`keep`). */
function placeLabels(items: { id: string; x: number; y: number; w: number }[], u: number, W: number, fixed: Box4[] = [], keep?: string | null) {
  const boxes: Box4[] = [...fixed, ...items.map((p): Box4 => [p.x - 13 * u, p.y - 13 * u, p.x + 17 * u, p.y + 13 * u])];
  const hit = (b: number[]) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const out: Record<string, { x: number; y: number; anchor: 'start' | 'end' | 'middle' }> = {};
  // ghim đang chọn xếp trước để chắc có chỗ
  for (const p of [...items].sort((a, b) => Number(b.id === keep) - Number(a.id === keep))) {
    const h = 13 * u, g = 19 * u, d = 13 * u;
    const cands: { x: number; y: number; anchor: 'start' | 'end' | 'middle'; b: number[] }[] = [
      { x: p.x + g, y: p.y + 4 * u, anchor: 'start', b: [p.x + g, p.y - h / 2, p.x + g + p.w, p.y + h / 2] },
      { x: p.x - 15 * u, y: p.y + 4 * u, anchor: 'end', b: [p.x - 15 * u - p.w, p.y - h / 2, p.x - 15 * u, p.y + h / 2] },
      { x: p.x, y: p.y + 15 * u + 9 * u, anchor: 'middle', b: [p.x - p.w / 2, p.y + 15 * u, p.x + p.w / 2, p.y + 15 * u + h] },
      { x: p.x, y: p.y - 18 * u, anchor: 'middle', b: [p.x - p.w / 2, p.y - 18 * u - h, p.x + p.w / 2, p.y - 17 * u] },
      { x: p.x + d, y: p.y + d + 11 * u, anchor: 'start', b: [p.x + d, p.y + d, p.x + d + p.w, p.y + d + h] },
      { x: p.x + d, y: p.y - d - 6 * u, anchor: 'start', b: [p.x + d, p.y - d - h - 4 * u, p.x + d + p.w, p.y - d - 4 * u] },
      { x: p.x - d, y: p.y + d + 11 * u, anchor: 'end', b: [p.x - d - p.w, p.y + d, p.x - d, p.y + d + h] },
      { x: p.x - d, y: p.y - d - 6 * u, anchor: 'end', b: [p.x - d - p.w, p.y - d - h - 4 * u, p.x - d, p.y - d - 4 * u] },
    ];
    const ok = cands.find((c) => c.b[0] > 2 * u && c.b[2] < W - 2 * u && !hit(c.b)) ?? (p.id === keep ? cands.find((c) => c.b[0] > 2 * u && c.b[2] < W - 2 * u) ?? cands[0] : null);
    if (!ok) continue;
    boxes.push(ok.b as Box4);
    out[p.id] = { x: ok.x, y: ok.y, anchor: ok.anchor };
  }
  return out;
}

/** Tách các ghim chồng lên nhau: đẩy nhau ra cho đủ khoảng, vẫn kéo nhẹ về vị trí thật; `ax, ay` giữ vị trí thật để vẽ đường dẫn. */
function spreadPins<T extends { x: number; y: number; ax: number; ay: number }>(pins: T[], u: number, W: number, H: number, blocks: { x: number; y: number; r: number }[]): T[] {
  const min = 27 * u;
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i], b = pins[j]; let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 0.01) { const ang = (i * 2.4) % 6.283; dx = Math.cos(ang); dy = Math.sin(ang); d = 1; }
      const push = (min - d) / 2; a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push;
    }
    for (const p of pins) {
      for (const o of blocks) { let dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy); if (d >= o.r) continue; if (d < 0.01) { dx = 1; dy = -0.6; d = 1.17; } p.x += (dx / d) * (o.r - d); p.y += (dy / d) * (o.r - d); }
      p.x += (p.ax - p.x) * 0.02; p.y += (p.ay - p.y) * 0.02;
      p.x = Math.min(W - 16 * u, Math.max(16 * u, p.x)); p.y = Math.min(H - 16 * u, Math.max(16 * u, p.y));
    }
  }
  return pins;
}

export function ProvinceMap({ province, sights, regions, currentRegionId, selectedId, onSelect }: ProvinceMapProps) {
  const data = PROVINCE_MAPS[province];
  const P = useMemo(() => makeProj(data?.box ?? { lat0: 0, lat1: 1, lng0: 0, lng1: 1 }), [data]);
  const pz = usePanZoom(P, 5);
  const u = pz.unit;
  const land = useMemo(() => (data ? ringPath(P, data.land) : ''), [data, P]);
  // chỉ ghim vùng trồng nằm trong khung bản đồ (tỉnh sáp nhập có vùng ở rất xa, ví dụ Đăk Hà của Quảng Ngãi)
  const farms = useMemo(() => regions.filter((r) => r.province === province).map((r) => ({ r, x: P.x(r.lng), y: P.y(r.lat) })).filter((f) => f.x > 0 && f.x < P.w && f.y > 0 && f.y < P.h), [regions, province, P]);
  const pins = useMemo(() => spreadPins(sights.map((s, i) => { const x = P.x(s.lng), y = P.y(s.lat); return { s, n: i + 1, x, y, ax: x, ay: y }; }), u, P.w, P.h, farms.map((f) => ({ x: f.x, y: f.y, r: 24 * u }))), [sights, P, u, farms]);
  const labels = useMemo(() => {
    const fixed: [number, number, number, number][] = [];
    for (const t of data?.towns ?? []) { const x = P.x(t.at[0]), y = P.y(t.at[1]), w = t.name.length * (t.big ? 7 : 6) * u; fixed.push([x - 8 * u - w, y - 7 * u, x + 5 * u, y + 7 * u]); }
    for (const { r, x, y } of farms) { const w = Math.max(r.name.length, 14) * 3.2 * u; fixed.push([x - w, y - 20 * u, x + w, y + 24 * u]); }
    return placeLabels(pins.map((p) => ({ id: p.s.id, x: p.x, y: p.y, w: p.s.name.length * 6.3 * u })), u, P.w, fixed, selectedId);
  }, [pins, u, P, data, farms, selectedId]);
  // màn ngang chỉ thấy một dải: mở đầu ở giữa cụm địa danh
  const centred = useRef(false);
  useEffect(() => { if (!centred.current && pz.landscape && pins.length) { centred.current = true; pz.focus(pins.reduce((a, p) => a + p.x, 0) / pins.length, pins.reduce((a, p) => a + p.y, 0) / pins.length, 1); } }, [pz.landscape, pins]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <p className="hint">Tỉnh này chưa có bản đồ chi tiết.</p>;
  const cur = farms.find((f) => f.r.id === currentRegionId), sel = pins.find((p) => p.s.id === selectedId);

  const onClick = (e: React.MouseEvent) => {
    const t = pz.tap(e); if (!t) return;
    let best: (typeof pins)[number] | null = null, bd = 26 * u;
    for (const p of pins) { const d = Math.hypot(p.x - t[0], p.y - t[1]); if (d < bd) { bd = d; best = p; } }
    if (best) onSelect(best.s.id);
  };
  return (
    <div className="vmap pmap">
      <svg ref={pz.ref} className="vmap-svg" viewBox={`${pz.view.x} ${pz.view.y} ${pz.view.w} ${pz.view.h}`} style={{ aspectRatio: `${P.w} / ${P.h}` }} preserveAspectRatio="xMidYMid slice"
        role="group" aria-label={`Bản đồ ${province} và các điểm tham quan`} {...pz.handlers} onClick={onClick}>
        <defs>
          <pattern id="pm-wave" width="46" height="22" patternUnits="userSpaceOnUse"><path d="M0 11q6-6 12 0t12 0" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" /></pattern>
          <linearGradient id="pm-hill" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#7fb86c" stopOpacity=".85" /><stop offset=".42" stopColor="#9fce86" stopOpacity=".45" /><stop offset=".62" stopColor="#c6e6a6" stopOpacity="0" /></linearGradient>
          <clipPath id="pm-land"><path d={land} /></clipPath>
        </defs>
        <rect width={P.w} height={P.h} fill="#9ed6ee" /><rect width={P.w} height={P.h} fill="url(#pm-wave)" />
        <path d={land} fill="#c6e6a6" stroke="#56310f" strokeWidth={2 * u} strokeLinejoin="round" />
        {/* dải cát ven biển và vùng núi phía tây, cắt theo hình đất liền */}
        <g clipPath="url(#pm-land)">
          <path d={land} fill="none" stroke="#f4e3a6" strokeWidth={9 * u} strokeLinejoin="round" />
          <rect x="0" y="0" width={P.w} height={P.h} fill="url(#pm-hill)" />
        </g>
        <path d={land} fill="none" stroke="#56310f" strokeWidth={2 * u} strokeLinejoin="round" />
        {data.islets?.map((it, i) => (
          <ellipse key={i} cx={P.x(it.at[0])} cy={P.y(it.at[1])} rx={Math.abs(P.x(it.at[0] + it.rx) - P.x(it.at[0]))} ry={Math.abs(P.y(it.at[1] + it.ry) - P.y(it.at[1]))}
            transform={`rotate(${it.rot ?? 0} ${P.x(it.at[0])} ${P.y(it.at[1])})`} fill="#c6e6a6" stroke="#56310f" strokeWidth={1.6 * u} />
        ))}
        <g clipPath="url(#pm-land)" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {data.rivers.map((r, i) => <path key={i} d={ringPath(P, r.pts, false)} stroke="#4aa3d8" strokeWidth={(r.width ?? 1) * 3.4 * u} />)}
          {data.rivers.map((r, i) => <path key={`h${i}`} d={ringPath(P, r.pts, false)} stroke="#bfe9ff" strokeWidth={(r.width ?? 1) * 1.2 * u} />)}
        </g>
        {data.routes?.map((r) => <path key={r.name} d={ringPath(P, r.pts, false)} fill="none" stroke="#fff" strokeWidth={2 * u} strokeDasharray={`${5 * u} ${5 * u}`} strokeLinecap="round" pointerEvents="none"><title>{r.name}</title></path>)}
        <g className="vm-text" pointerEvents="none">
          {data.islets?.filter((it) => it.name && !sights.some((x) => Math.abs(x.lng - it.at[0]) < 0.06 && Math.abs(x.lat - it.at[1]) < 0.04)).map((it) => <text key={it.name} x={P.x(it.at[0])} y={P.y(it.at[1] - it.ry) + 11 * u} textAnchor="middle" className="vm-peak" style={{ fontSize: 9.5 * u }}>{it.name}</text>)}
          {data.peaks?.map((m) => {
            const x = P.x(m.at[0]), y = P.y(m.at[1]);
            return (
              <g key={m.name}>
                {m.pass
                  ? <path d={`M${x - 9 * u} ${y + 3 * u}q${4.5 * u} ${-9 * u} ${9 * u} 0t${9 * u} 0`} fill="none" stroke="#7a4a22" strokeWidth={2 * u} strokeLinecap="round" />
                  : <path d={`M${x - 8 * u} ${y + 4 * u}L${x - 1.5 * u} ${y - 6 * u}L${x + 2 * u} ${y - 1 * u}L${x + 4.5 * u} ${y - 4 * u}L${x + 9 * u} ${y + 4 * u}Z`} fill="#8aa56a" stroke="#56310f" strokeWidth={1.3 * u} strokeLinejoin="round" />}
                <text x={x} y={y + 14 * u} textAnchor="middle" className="vm-peak" style={{ fontSize: 9.5 * u }}>{m.name}</text>
              </g>
            );
          })}
          {data.rivers.filter((r) => r.label).map((r) => <text key={r.name} x={P.x(r.label![0])} y={P.y(r.label![1])} className="vm-river" textAnchor="middle" style={{ fontSize: 9.5 * u }}>{r.name}</text>)}
          {data.labels.filter((l) => l.kind !== 'bay' || pz.zoom >= 1.5).map((l) => <text key={l.text} x={P.x(l.at[0])} y={P.y(l.at[1])} textAnchor="middle" className={l.kind === 'sea' ? 'vm-sea' : l.kind === 'bay' ? 'vm-river' : 'vm-country'} style={{ fontSize: (l.kind === 'sea' ? 15 : l.kind === 'next' ? 11 : 9.5) * u }}>{l.text}</text>)}
          {data.towns.map((t) => {
            const x = P.x(t.at[0]), y = P.y(t.at[1]), s = (t.big ? 4 : 3) * u;
            return (
              <g key={t.name}>
                <rect x={x - s} y={y - s} width={2 * s} height={2 * s} fill="#fff" stroke="#56310f" strokeWidth={1.4 * u} />
                <text x={x - s - 3 * u} y={y + 3.5 * u} textAnchor="end" className="vm-town" style={{ fontSize: (t.big ? 11.5 : 10) * u }}>{t.name}</text>
              </g>
            );
          })}
        </g>
        {farms.map(({ r, x, y }) => (
          <g key={r.id} pointerEvents="none">
            <circle cx={x} cy={y} r={7 * u} fill={r.id === currentRegionId ? '#2f7d26' : '#ffcf3a'} stroke="#56310f" strokeWidth={1.6 * u} />
            <text x={x} y={y + 3.6 * u} textAnchor="middle" style={{ fontSize: 9 * u }}>🌱</text>
            <text x={x} y={y - 11 * u} textAnchor="middle" className="vm-name strong" style={{ fontSize: 10 * u }}>{r.name}</text>
            {r.id === currentRegionId && <text x={x} y={y + 19 * u} textAnchor="middle" className="vm-name" style={{ fontSize: 9.5 * u }}>Bạn đang ở đây</text>}
          </g>
        ))}
        {cur && sel && <line x1={cur.x} y1={cur.y} x2={sel.x} y2={sel.y} stroke="#c0391f" strokeWidth={2.4 * u} strokeDasharray={`${7 * u} ${5 * u}`} strokeLinecap="round" pointerEvents="none" />}
        {/* ghim bị đẩy ra khỏi chỗ thật thì có chấm và đường dẫn chỉ về đúng vị trí */}
        {pins.filter((p) => Math.hypot(p.x - p.ax, p.y - p.ay) > 5 * u).map((p) => (
          <g key={`lead-${p.s.id}`} pointerEvents="none">
            <line x1={p.ax} y1={p.ay} x2={p.x} y2={p.y} stroke="#56310f" strokeWidth={1.5 * u} />
            <circle cx={p.ax} cy={p.ay} r={2.6 * u} fill="#c0391f" stroke="#fff" strokeWidth={1 * u} />
          </g>
        ))}
        {pins.map(({ s, n, x, y }) => {
          const on = s.id === selectedId, l = labels[s.id];
          return (
            <g key={s.id} className={`pm-pin${on ? ' on' : ''}${s.done ? ' done' : ''}`} data-sight={s.id} role="button" tabIndex={0} aria-label={`${n}. ${s.name}`} aria-pressed={on}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } }}>
              {on && <circle cx={x} cy={y} r={17 * u} fill="none" stroke="#c0391f" strokeWidth={2.4 * u} />}
              <circle cx={x} cy={y} r={12 * u} fill={on ? '#ffcf3a' : s.done ? '#d7f0c2' : '#fff6dc'} stroke="#56310f" strokeWidth={2 * u} />
              <text x={x} y={y + 4.6 * u} textAnchor="middle" style={{ fontSize: 13 * u }} pointerEvents="none">{s.emoji}</text>
              <circle cx={x + 10 * u} cy={y - 10 * u} r={6.5 * u} fill={s.done ? '#2f7d26' : '#56310f'} />
              <text x={x + 10 * u} y={y - 6.8 * u} textAnchor="middle" className="pm-num" style={{ fontSize: 9 * u }} pointerEvents="none">{s.done ? '✓' : n}</text>
              {l && <text x={l.x} y={l.y} textAnchor={l.anchor} className="vm-name strong" style={{ fontSize: 10.5 * u }} pointerEvents="none">{s.name}</text>}
            </g>
          );
        })}
      </svg>
      <div className="vmap-zoom">
        <button type="button" aria-label="Phóng to" onClick={() => pz.zoomAt(1.6)}>+</button>
        <button type="button" aria-label="Thu nhỏ" onClick={() => pz.zoomAt(1 / 1.6)} disabled={pz.atMin}>−</button>
      </div>
    </div>
  );
}
