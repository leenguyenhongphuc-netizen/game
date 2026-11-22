// Bản đồ Việt Nam: đường bờ biển, biên giới thật (Natural Earth), ghim từng vùng trồng theo toạ độ thật.
import { useMemo } from 'react';
import { haversineKm } from '../../../shared/rules.ts';
import { makeProj, ringPath, usePanZoom } from './geo.ts';
import { NEIGHBOR_LAND, VN_ISLANDS, VN_MAIN } from './vn-outline.ts';

export interface MapRegion { id: string; name: string; province: string; lat: number; lng: number; zone: string; island?: boolean }
export interface VietnamMapProps {
  regions: MapRegion[];
  homeId?: string | null;
  /** Vùng người chơi đang đứng (nhà, hoặc nơi đang tham quan / xe tải đang đỗ). */
  currentId?: string | null;
  visited: Set<string> | string[];
  /** Vùng người chơi có đất. */
  owned?: string[];
  /** Các tỉnh đã có điểm tham quan: ghim của vùng thuộc tỉnh đó thêm dấu 🏛. */
  sightProvinces: string[];
  selectedId?: string | null;
  onSelect: (regionId: string) => void;
}

const BOX = { lat0: 7.6, lat1: 23.7, lng0: 101.8, lng1: 115.2 };
const P = makeProj(BOX);
const LAND = ringPath(P, VN_MAIN) + VN_ISLANDS.map((r) => ringPath(P, r)).join('');
const BG = NEIGHBOR_LAND.map((r) => ringPath(P, r)).join('');
/** Đảo nhỏ không có trong nguồn dữ liệu: vẽ chấm đúng toạ độ. */
const SMALL_ISLANDS: [number, number, number][] = [[109.12, 15.38, 5], [108.51, 15.95, 4.5], [107.34, 17.16, 3], [107.72, 20.13, 3], [103.47, 9.3, 3.5], [108.94, 10.53, 3.5]];
/** Hai quần đảo: các chấm theo vị trí những đảo, bãi chính. */
const HOANG_SA: [number, number][] = [[111.2, 16.53], [111.6, 16.5], [111.75, 16.97], [112.33, 16.83], [112.73, 16.67], [111.62, 16.06], [112.02, 16.34], [111.2, 15.78], [112.9, 16.05]];
const TRUONG_SA: [number, number][] = [[111.92, 8.65], [114.42, 11.43], [114.33, 10.18], [115.03, 10.73], [113.31, 8.86], [112.9, 7.9], [114.28, 11.08], [114.6, 9.9], [112.25, 8.1], [113.85, 10.38], [114.7, 8.1], [113.6, 9.6]];
const PLACE_LABELS: { name: string; lng: number; lat: number; dx?: number; dy?: number; anchor?: 'start' | 'end' | 'middle'; minZoom: number }[] = [
  { name: 'Phú Quốc', lng: 103.97, lat: 10.25, dx: -10, anchor: 'end', minZoom: 1 },
  { name: 'Côn Đảo', lng: 106.61, lat: 8.69, dx: 10, anchor: 'start', minZoom: 1 },
  { name: 'Cát Bà', lng: 107.05, lat: 20.75, dx: 10, anchor: 'start', minZoom: 1.6 },
  { name: 'Lý Sơn', lng: 109.12, lat: 15.38, dx: 9, anchor: 'start', minZoom: 1 },
  { name: 'Cù Lao Chàm', lng: 108.51, lat: 15.95, dx: 9, dy: -4, anchor: 'start', minZoom: 1.6 },
  { name: 'Hà Nội', lng: 105.85, lat: 21.03, minZoom: 99 },
];
const COUNTRY_LABELS: [string, number, number][] = [['TRUNG QUỐC', 107.6, 23.35], ['LÀO', 103.6, 18.6], ['CAM-PU-CHIA', 104.7, 12.6], ['THÁI LAN', 102.5, 15.6]];
const ZONE_COLOR: Record<string, string> = { bac: '#5b8def', trung: '#e58a2b', taynguyen: '#b0522d', nam: '#2f9e55', dao: '#12a5b8' };

export function VietnamMap({ regions, homeId, currentId, visited, owned = [], sightProvinces, selectedId, onSelect }: VietnamMapProps) {
  const pz = usePanZoom(P, 9);
  const u = pz.unit, z = pz.zoom;
  const seen = useMemo(() => (visited instanceof Set ? visited : new Set(visited)), [visited]);
  const pins = useMemo(() => regions.map((r) => ({ r, x: P.x(r.lng), y: P.y(r.lat) })), [regions]);
  const cur = pins.find((p) => p.r.id === currentId), sel = pins.find((p) => p.r.id === selectedId);
  const km = cur && sel && cur !== sel ? Math.round(haversineKm(cur.r.lat, cur.r.lng, sel.r.lat, sel.r.lng)) : 0;

  const onClick = (e: React.MouseEvent) => {
    const t = pz.tap(e); if (!t) return;
    let best: (typeof pins)[number] | null = null, bd = 24 * u; // chạm trong bán kính 24 điểm ảnh quanh ghim gần nhất
    for (const p of pins) { const d = Math.hypot(p.x - t[0], p.y - t[1]); if (d < bd) { bd = d; best = p; } }
    if (best) onSelect(best.r.id);
  };
  const state = (id: string) => (id === homeId ? 'home' : id === currentId ? 'here' : owned.includes(id) ? 'owned' : seen.has(id) ? 'seen' : 'new');
  const showNames = z >= 2.6;
  // vẽ ghim thường trước, ghim quan trọng sau cùng để nổi lên trên
  const order = [...pins].sort((a, b) => rank(a.r.id) - rank(b.r.id));
  function rank(id: string) { return id === selectedId ? 4 : id === currentId ? 3 : id === homeId ? 2 : 0; }

  return (
    <div className="vmap">
      <svg ref={pz.ref} className="vmap-svg" viewBox={`${pz.view.x} ${pz.view.y} ${pz.view.w} ${pz.view.h}`} style={{ aspectRatio: `${P.w} / ${P.h}` }}
        role="group" aria-label="Bản đồ Việt Nam và các vùng trồng" {...pz.handlers} onClick={onClick}>
        <defs>
          <pattern id="vm-wave" width="46" height="22" patternUnits="userSpaceOnUse">
            <path d="M0 11q6-6 12 0t12 0" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={P.w} height={P.h} fill="#9ed6ee" />
        <rect x="0" y="0" width={P.w} height={P.h} fill="url(#vm-wave)" />
        <path d={BG} fill="#e9e2c6" stroke="#d3c9a4" strokeWidth={1.2 * u} />
        <path d={LAND} fill="#bfe3a0" stroke="#56310f" strokeWidth={Math.max(1.6 * u, 0.6)} strokeLinejoin="round" />
        <path d={LAND} fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth={5 * u} strokeLinejoin="round" style={{ mixBlendMode: 'soft-light' }} />
        {SMALL_ISLANDS.map(([lng, lat, r], i) => <circle key={i} cx={P.x(lng)} cy={P.y(lat)} r={Math.max(r * 0.55, 2.2 * u)} fill="#bfe3a0" stroke="#56310f" strokeWidth={1.2 * u} />)}
        {[HOANG_SA, TRUONG_SA].map((arr, k) => (
          <g key={k}>{arr.map(([lng, lat], i) => <circle key={i} cx={P.x(lng)} cy={P.y(lat)} r={Math.max(2.4, 2 * u)} fill="#bfe3a0" stroke="#56310f" strokeWidth={Math.max(0.8, u)} />)}</g>
        ))}
        <g className="vm-text" style={{ fontSize: 11.5 * u }}>
          {COUNTRY_LABELS.map(([n, lng, lat]) => <text key={n} x={P.x(lng)} y={P.y(lat)} className="vm-country" textAnchor="middle">{n}</text>)}
          <text x={P.x(111.3)} y={P.y(13.4)} className="vm-sea" textAnchor="middle" style={{ fontSize: 17 * u }}>Biển Đông</text>
          <text x={P.x(112)} y={P.y(17.3) - 6 * u} className="vm-isle" textAnchor="middle"><tspan x={P.x(112)}>Quần đảo Hoàng Sa</tspan><tspan x={P.x(112)} dy={13 * u}>(Việt Nam)</tspan></text>
          <text x={P.x(113.5)} y={P.y(7.75) - 13 * u} className="vm-isle" textAnchor="middle"><tspan x={P.x(113.5)}>Quần đảo Trường Sa</tspan><tspan x={P.x(113.5)} dy={13 * u}>(Việt Nam)</tspan></text>
          {PLACE_LABELS.filter((l) => z >= l.minZoom).map((l) => (
            <text key={l.name} x={P.x(l.lng) + (l.dx ?? 0) * u} y={P.y(l.lat) + (l.dy ?? 4) * u} className="vm-isle" textAnchor={l.anchor ?? 'middle'} style={{ fontSize: 10.5 * u }}>{l.name}</text>
          ))}
        </g>
        {cur && sel && cur !== sel && (
          <g pointerEvents="none">
            <line x1={cur.x} y1={cur.y} x2={sel.x} y2={sel.y} stroke="#c0391f" strokeWidth={2.4 * u} strokeDasharray={`${7 * u} ${5 * u}`} strokeLinecap="round" />
            <g transform={`translate(${(cur.x + sel.x) / 2} ${(cur.y + sel.y) / 2})`}>
              <rect x={-26 * u} y={-10 * u} width={52 * u} height={20 * u} rx={10 * u} fill="#fff6dc" stroke="#c0391f" strokeWidth={1.6 * u} />
              <text className="vm-km" textAnchor="middle" y={4.2 * u} style={{ fontSize: 11.5 * u }}>{km} km</text>
            </g>
          </g>
        )}
        {order.map(({ r, x, y }) => {
          const s = state(r.id), on = r.id === selectedId, big = on || s === 'home' || s === 'here';
          const rad = (big ? 8.5 : 6) * u, label = showNames || big;
          return (
            <g key={r.id} className={`vm-pin ${s}${on ? ' on' : ''}`} data-region={r.id} role="button" tabIndex={0} aria-label={`${r.name}, ${r.province}`} aria-pressed={on}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r.id); } }}>
              {on && <circle cx={x} cy={y} r={rad + 5 * u} fill="none" stroke="#c0391f" strokeWidth={2.2 * u} />}
              <circle cx={x} cy={y} r={rad} fill={s === 'new' ? '#fffdf4' : s === 'seen' ? ZONE_COLOR[r.zone] ?? '#888' : s === 'owned' ? '#ffcf3a' : s === 'home' ? '#e2573c' : '#2f7d26'}
                stroke={s === 'new' ? ZONE_COLOR[r.zone] ?? '#56310f' : '#56310f'} strokeWidth={(s === 'new' ? 2.2 : 1.6) * u} />
              {s === 'home' && <path d={`M${x - 4.2 * u} ${y + 0.4 * u}L${x} ${y - 4 * u}L${x + 4.2 * u} ${y + 0.4 * u}V${y + 4 * u}H${x - 4.2 * u}Z`} fill="#fff" />}
              {s === 'here' && <circle cx={x} cy={y} r={3 * u} fill="#fff" />}
              {sightProvinces.includes(r.province) && <text x={x + rad * 0.9} y={y - rad * 0.7} style={{ fontSize: 10 * u }} pointerEvents="none">🏛</text>}
              {label && (
                <text x={x} y={y + rad + 11 * u} textAnchor="middle" className={`vm-name${big ? ' strong' : ''}`} style={{ fontSize: (big ? 11.5 : 10) * u }} pointerEvents="none">{r.name}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="vmap-zoom">
        <button type="button" aria-label="Phóng to" onClick={() => pz.zoomAt(1.6)}>+</button>
        <button type="button" aria-label="Thu nhỏ" onClick={() => pz.zoomAt(1 / 1.6)} disabled={z <= 1.01}>−</button>
        {cur && <button type="button" aria-label="Về chỗ tôi đang đứng" onClick={() => pz.focus(cur.x, cur.y, 3.2)}>◎</button>}
      </div>
      <ul className="vmap-legend" aria-label="Chú giải">
        <li><i className="home" />Nhà</li><li><i className="here" />Đang ở</li><li><i className="owned" />Có đất</li><li><i className="seen" />Đã tới</li><li><i className="new" />Chưa tới</li><li><span aria-hidden="true">🏛</span>Có điểm tham quan</li>
      </ul>
      {!showNames && <p className="vmap-tip">Chụm hai ngón hoặc bấm + để phóng to và hiện tên từng vùng.</p>}
    </div>
  );
}
