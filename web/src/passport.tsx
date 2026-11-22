// Hộ chiếu du lịch (con dấu check-in, cấp bậc) và giấy chứng nhận quyền sử dụng đất — trình bày như giấy tờ thật.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { REGIONS } from '../../shared/catalog.ts';
import { fmtMoney, levelPerks } from '../../shared/rules.ts';
import { SIGHTS, sightsOfProvince } from '../../shared/sights.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import './passport.css';

export interface PassportStamp { kind: 'stop' | 'sight' | 'region'; sightId?: string; stopId?: string; regionId?: string; name: string; province: string; at: number | null }
export interface PassportData {
  holder: string; issuedAt: number; no: string; xp: number; level: number; title: string; nextXp: number | null; prevXp: number;
  perks: { energyMax: number; exportActive: number; superDailyKg: number };
  levels: { level: number; xp: number; title: string }[]; xpTable: Record<string, number>;
  stamps: PassportStamp[]; sights: { done: number; total: number }; regions: { done: number; total: number };
  provinces: { province: string; done: number; total: number }[];
}
interface CertData {
  title: string; no: string; plotId: number; owner: string; province: string; ward: string | null; regionId: string; regionName: string;
  tiles: number; areaM2: number; purpose: string; term: string; expiresAt: number | null; issuedAt: number; origin: string; price: number;
  fees: { registration: number; certificate: number; total: number }; issuer: string; note: string;
}

const INKS = ['#b3261e', '#1f4fa8', '#5b2a86', '#0f6b4f'];
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const fmtDate = (ms: number | null | undefined) => { if (!ms) return ''; const d = new Date(ms), p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`; };
const XP_LABELS: Record<string, string> = {
  stop: 'Check-in một điểm dừng', sight: 'Tham quan trọn một địa danh', region: 'Lần đầu tới một vùng trồng', harvest: 'Thu hoạch một ô', order: 'Giao xong một đơn hàng',
  export: 'Lô xuất khẩu tới nơi', process: 'Thu một mẻ chế biến', land: 'Mua thêm một thửa đất', consignSold: 'Bán được hàng ký gửi', help: 'Chăm giúp vườn bạn',
};

/** Bông sen cách điệu tự vẽ — dùng thay quốc huy trên bìa và làm hình chìm. */
export function Lotus({ size = 96, color = '#e9c46a' }: { size?: number; color?: string }) {
  const petal = (rot: number, len: number, w: number, k: number) => <path key={k} d={`M50 62 C${50 - w} ${62 - len * 0.5} ${50 - w * 0.5} ${62 - len} 50 ${62 - len} C${50 + w * 0.5} ${62 - len} ${50 + w} ${62 - len * 0.5} 50 62Z`} transform={`rotate(${rot} 50 62)`} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="1.6" /><circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="0.8" strokeDasharray="1.5 3" />
      {[-64, -38, 38, 64].map((r, i) => petal(r, 30, 11, i))}{[-20, 20].map((r, i) => petal(r, 38, 11, i + 4))}{petal(0, 44, 10, 6)}
      <path d="M26 66 Q50 80 74 66 M32 72 Q50 82 68 72" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M18 60 q-6 -14 2 -30 M82 60 q6 -14 -2 -30" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((i) => <g key={i}><ellipse cx={17 - i * 0.6 + (i % 2) * 3} cy={54 - i * 6} rx="2.2" ry="3.6" fill={color} transform={`rotate(${-24} ${17} ${54 - i * 6})`} /><ellipse cx={83 + i * 0.6 - (i % 2) * 3} cy={54 - i * 6} rx="2.2" ry="3.6" fill={color} transform={`rotate(${24} ${83} ${54 - i * 6})`} /></g>)}
    </svg>
  );
}

/** Đường viền răng cưa của con dấu. */
function scallop(cx: number, cy: number, r: number, n: number, depth: number): string {
  let d = '';
  for (let i = 0; i <= n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r - depth : r; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`; }
  return d + 'Z';
}
/** Chia tên dài thành tối đa hai dòng cân nhau. */
function twoLines(s: string, max = 13): string[] {
  if (s.length <= max) return [s];
  const w = s.split(' '); let best = 1, diff = Infinity;
  for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < diff) { diff = d; best = i; } }
  return [w.slice(0, best).join(' '), w.slice(best).join(' ')];
}

/** Một con dấu mực: `stop` tròn, `sight` tròn lớn hai vòng có ảnh mờ, `region` chữ nhật kiểu dấu nhập cảnh. */
export function StampMark({ stamp, size }: { stamp: PassportStamp; size?: number }) {
  const key = stamp.sightId ? `${stamp.sightId}:${stamp.stopId ?? ''}` : stamp.regionId ?? stamp.name;
  const h = hash(key + stamp.kind), ink = INKS[h % INKS.length], rot = ((h >> 3) % 19) - 9, date = fmtDate(stamp.at);
  const uid = `st${h.toString(36)}`;
  const style: CSSProperties = { transform: `rotate(${rot}deg)`, color: ink };
  if (stamp.kind === 'region') {
    const lines = twoLines(stamp.name.toUpperCase(), 14);
    return (
      <svg className="pp-stamp k-region" viewBox="0 0 132 84" width={size ?? 124} style={style} role="img" aria-label={`Dấu đã tới ${stamp.name}${date ? ` ngày ${date}` : ''}`}>
        <rect x="3" y="3" width="126" height="78" rx="7" fill="none" stroke="currentColor" strokeWidth="2.6" /><rect x="8" y="8" width="116" height="68" rx="4" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2.4" />
        <text x="66" y="22" textAnchor="middle" className="pp-st-s">ĐÃ ĐẾN · VÙNG TRỒNG</text>
        {lines.map((l, i) => <text key={i} x="66" y={(lines.length === 1 ? 46 : 39) + i * 15} textAnchor="middle" className="pp-st-b" fontSize={lines.length === 1 && l.length < 10 ? 17 : 13.5}>{l}</text>)}
        <text x="66" y="70" textAnchor="middle" className="pp-st-s">{stamp.province}{date ? ` · ${date}` : ''}</text>
      </svg>
    );
  }
  const big = stamp.kind === 'sight', lines = twoLines(stamp.name, big ? 14 : 12);
  return (
    <svg className={`pp-stamp k-${stamp.kind}`} viewBox="0 0 120 120" width={size ?? 112} style={style} role="img" aria-label={`${big ? 'Dấu chứng nhận tham quan' : 'Dấu check-in'} ${stamp.name}${date ? ` ngày ${date}` : ''}`}>
      <defs>
        <clipPath id={`${uid}c`}><circle cx="60" cy="60" r="39" /></clipPath>
        <path id={`${uid}t`} d="M60 60 m-47 0 a47 47 0 1 1 94 0" /><path id={`${uid}b`} d="M60 60 m-49 0 a49 49 0 0 0 98 0" />
      </defs>
      {big && stamp.sightId && <image href={`/art/sights/${stamp.sightId}-s.jpg`} x="16" y="16" width="88" height="88" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${uid}c)`} opacity="0.3" onError={(e) => { (e.currentTarget as SVGImageElement).style.display = 'none'; }} />}
      {big ? <path d={scallop(60, 60, 58, 28, 3.2)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /> : <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="2.6" />}
      <circle cx="60" cy="60" r={big ? 40 : 41} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray={big ? undefined : '3 2.4'} />
      <text className="pp-st-arc"><textPath href={`#${uid}t`} startOffset="50%" textAnchor="middle">{big ? '★ CHỨNG NHẬN THAM QUAN ★' : 'CHECK-IN · VƯỜN VIỆT'}</textPath></text>
      <text className="pp-st-arc"><textPath href={`#${uid}b`} startOffset="50%" textAnchor="middle">{stamp.province.toUpperCase()}</textPath></text>
      {lines.map((l, i) => <text key={i} x="60" y={(lines.length === 1 ? 60 : 53) + i * 13.5} textAnchor="middle" className="pp-st-b" fontSize={l.length > 13 ? 10 : 12}>{l}</text>)}
      {date && <text x="60" y={lines.length === 1 ? 77 : 84} textAnchor="middle" className="pp-st-d">{date}</text>}
    </svg>
  );
}

function Portrait({ me }: { me: Me }) {
  const shirt = me.user.avatar?.shirt ?? '#3f7fd0';
  return (
    <svg className="pp-photo" viewBox="0 0 80 100" aria-hidden="true">
      <rect width="80" height="100" fill="#dfeaf2" /><path d="M8 100 q0 -34 32 -34 q32 0 32 34z" fill={shirt} stroke="#56310f" strokeWidth="2" />
      <circle cx="40" cy="46" r="17" fill="#ffd9a8" stroke="#56310f" strokeWidth="2" /><circle cx="34" cy="47" r="2" fill="#3b2a17" /><circle cx="46" cy="47" r="2" fill="#3b2a17" /><path d="M35 54 q5 4 10 0" fill="none" stroke="#3b2a17" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 38 L40 12 L70 38 q-30 8 -60 0z" fill="#f1dca0" stroke="#56310f" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

type Page = { id: string; label: string };

/** Cuốn hộ chiếu: bìa, trang thông tin, mục lục, mỗi tỉnh một trang dấu, trang vùng trồng. */
export function PassportPanel({ me, refresh }: { me: Me; refresh: () => void }) {
  const [data, setData] = useState<PassportData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [how, setHow] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { let on = true; api<PassportData>('GET', '/api/passport').then((d) => { if (on) setData(d); }).catch((e) => { if (on) setErr(e instanceof Error ? e.message : 'Không mở được hộ chiếu.'); }); return () => { on = false; }; }, [me.user.id]);
  void refresh;
  const pages = useMemo<Page[]>(() => !data ? [] : [{ id: 'bia', label: 'Bìa' }, { id: 'thongtin', label: 'Thông tin' }, { id: 'mucluc', label: 'Mục lục' }, ...data.provinces.map((p) => ({ id: `tinh:${p.province}`, label: p.province })), { id: 'vung', label: 'Vùng trồng' }], [data]);
  if (err) return <p className="error" role="alert">{err}</p>;
  if (!data) return <p className="muted">Đang mở hộ chiếu…</p>;
  const go = (i: number) => setPage(Math.max(0, Math.min(pages.length - 1, i)));
  const cur = pages[page], span = (data.nextXp ?? data.xp) - data.prevXp, pct = data.nextXp === null ? 100 : Math.round(((data.xp - data.prevXp) / Math.max(1, span)) * 100);
  const nextLv = data.levels.find((l) => l.level === data.level + 1), nextPerks = nextLv ? levelPerks(nextLv.level) : null;
  const stampOf = (sightId: string, stopId?: string) => data.stamps.find((s) => s.sightId === sightId && (stopId ? s.kind === 'stop' && s.stopId === stopId : s.kind === 'sight'));
  const regionStamps = data.stamps.filter((s) => s.kind === 'region');

  let body: JSX.Element;
  if (cur.id === 'bia') {
    body = (
      <button type="button" className="pp-cover" onClick={() => go(1)} aria-label="Mở hộ chiếu">
        <span className="pp-cover-top">VƯỜN VIỆT</span>
        <Lotus size={128} />
        <span className="pp-cover-title">HỘ CHIẾU<br />VƯỜN VIỆT</span>
        <span className="pp-cover-sub">Sổ thông hành du lịch · PASSPORT</span>
        <span className="pp-cover-open">Chạm để mở ›</span>
      </button>
    );
  } else if (cur.id === 'thongtin') {
    body = (
      <div className="pp-page pp-info">
        <div className="pp-wm" aria-hidden="true"><Lotus size={220} color="#b98a2a" /></div>
        <h3 className="pp-h">HỘ CHIẾU DU LỊCH <small>Vườn Việt</small></h3>
        <div className="pp-id">
          <Portrait me={me} />
          <dl>
            <div><dt>Họ và tên</dt><dd className="pp-name">{data.holder}</dd></div>
            <div><dt>Số hộ chiếu</dt><dd className="pp-mono">{data.no}</dd></div>
            <div><dt>Ngày cấp</dt><dd>{fmtDate(data.issuedAt)}</dd></div>
            <div><dt>Quê vườn</dt><dd>{me.user.homeRegionId && REGIONS[me.user.homeRegionId] ? `${REGIONS[me.user.homeRegionId].name}, ${REGIONS[me.user.homeRegionId].province}` : 'Chưa nhận đất'}</dd></div>
          </dl>
        </div>
        <div className="pp-rank">
          <span className="pp-shield" aria-hidden="true">{data.level}</span>
          <div className="grow"><b>Cấp {data.level} · {data.title}</b>
            <div className="pp-xp" role="progressbar" aria-valuemin={data.prevXp} aria-valuemax={data.nextXp ?? data.xp} aria-valuenow={data.xp} aria-label="Điểm kinh nghiệm"><i style={{ width: `${pct}%` }} /></div>
            <small>{data.nextXp === null ? `${data.xp} điểm · đã đạt hạng cao nhất` : `${data.xp}/${data.nextXp} điểm · còn ${data.nextXp - data.xp} điểm lên ${nextLv ? nextLv.title : 'cấp kế'}`}</small></div>
        </div>
        <div className="pp-perks">
          <div><b>{data.perks.energyMax}</b><small>thể lực tối đa{nextPerks && nextPerks.energyMax > data.perks.energyMax ? ` → ${nextPerks.energyMax}` : ''}</small></div>
          <div><b>{data.perks.exportActive} lô</b><small>xuất khẩu cùng lúc{nextPerks && nextPerks.exportActive > data.perks.exportActive ? ` → ${nextPerks.exportActive}` : ''}</small></div>
          <div><b>{data.perks.superDailyKg} kg</b><small>mua siêu thị mỗi ngày{nextPerks && nextPerks.superDailyKg > data.perks.superDailyKg ? ` → ${nextPerks.superDailyKg}` : ''}</small></div>
        </div>
        <div className="pp-count"><span>🏛️ {data.sights.done}/{data.sights.total} địa danh</span><span>🧭 {data.regions.done}/{data.regions.total} vùng trồng</span><span>📮 {data.stamps.length} con dấu</span></div>
        <button type="button" className="pp-how" aria-expanded={how} onClick={() => setHow(!how)}>Cách tích điểm và thăng hạng {how ? '▴' : '▾'}</button>
        {how && (
          <div className="pp-howbox">
            <table><tbody>{Object.entries(data.xpTable).map(([k, v]) => <tr key={k}><td>{XP_LABELS[k] ?? k}</td><td>+{v}</td></tr>)}</tbody></table>
            <ol>{data.levels.map((l) => <li key={l.level} className={l.level === data.level ? 'on' : l.level < data.level ? 'past' : ''}><span>{l.level}</span><b>{l.title}</b><small>{l.xp} điểm</small></li>)}</ol>
          </div>
        )}
        <p className="pp-mrz" aria-hidden="true">P&lt;VVN{data.holder.normalize('NFD').replace(/[^\w ]/g, '').replace(/ +/g, '<').toUpperCase().slice(0, 22)}&lt;&lt;&lt;<br />{data.no}&lt;{String(data.level).padStart(2, '0')}VVN{String(data.xp).padStart(6, '0')}&lt;&lt;&lt;&lt;</p>
      </div>
    );
  } else if (cur.id === 'mucluc') {
    body = (
      <div className="pp-page">
        <h3 className="pp-h">MỤC LỤC <small>các trang dấu</small></h3>
        <ul className="pp-toc">
          {data.provinces.map((p) => (
            <li key={p.province}><button type="button" onClick={() => go(pages.findIndex((x) => x.id === `tinh:${p.province}`))}>
              <span className="grow"><b>{p.province}</b><small>{sightsOfProvince(p.province).map((s) => s.name).slice(0, 3).join(' · ')}{p.total > 3 ? '…' : ''}</small></span>
              <span className={`pp-frac${p.done === p.total ? ' full' : ''}`}>{p.done}/{p.total}</span></button></li>
          ))}
          <li><button type="button" onClick={() => go(pages.length - 1)}><span className="grow"><b>Vùng trồng đã tới</b><small>Dấu nhập cảnh từng vùng đặc sản</small></span><span className="pp-frac">{data.regions.done}/{data.regions.total}</span></button></li>
        </ul>
        <p className="pp-tip">Mỗi điểm dừng bạn chụp ảnh khi tham quan được đóng một dấu check-in. Xem đủ mọi điểm dừng của một địa danh thì được dấu chứng nhận lớn.</p>
      </div>
    );
  } else if (cur.id === 'vung') {
    body = (
      <div className="pp-page">
        <h3 className="pp-h">VÙNG TRỒNG ĐÃ TỚI <small>{data.regions.done}/{data.regions.total}</small></h3>
        {regionStamps.length === 0 ? <p className="pp-tip">Chưa có dấu nào. Mua vé hoặc lái xe tới một vùng trồng để được đóng dấu.</p>
          : <div className="pp-grid rg">{regionStamps.map((s) => <StampMark key={s.regionId} stamp={s} />)}</div>}
      </div>
    );
  } else {
    const province = cur.id.slice(5), list = sightsOfProvince(province), info = data.provinces.find((p) => p.province === province);
    body = (
      <div className="pp-page">
        <h3 className="pp-h">{province.toUpperCase()} <small>{info ? `${info.done}/${info.total} địa danh` : ''}</small></h3>
        {list.map((s) => {
          const big = stampOf(s.id), got = s.stops.filter((x) => stampOf(s.id, x.id)).length;
          return (
            <section key={s.id} className="pp-sight">
              <header><span aria-hidden="true">{s.emoji}</span><b>{s.name}</b><small>{got}/{s.stops.length} dấu</small></header>
              <div className="pp-grid">
                {big ? <StampMark stamp={big} /> : <div className="pp-empty big"><span>Dấu chứng nhận</span><small>xem đủ {s.stops.length} điểm</small></div>}
                {s.stops.map((x) => { const st = stampOf(s.id, x.id); return st ? <StampMark key={x.id} stamp={st} /> : <div key={x.id} className="pp-empty"><span>{x.name}</span></div>; })}
              </div>
            </section>
          );
        })}
        {list.length === 0 && <p className="pp-tip">Tỉnh này chưa có địa danh nào được dựng.</p>}
      </div>
    );
  }
  return (
    <div className="pp" data-page={cur.id}>
      <div className={`pp-book${cur.id === 'bia' ? ' closed' : ''}`}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => { const d = drag.current; drag.current = null; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(page + (dx < 0 ? 1 : -1)); }}>
        {body}
      </div>
      <nav className="pp-nav" aria-label="Lật trang hộ chiếu">
        <button type="button" onClick={() => go(page - 1)} disabled={page === 0} aria-label="Trang trước">‹</button>
        <span className="pp-pageno"><b>{cur.label}</b><small>trang {page + 1}/{pages.length}</small></span>
        <button type="button" onClick={() => go(page + 1)} disabled={page === pages.length - 1} aria-label="Trang sau">›</button>
      </nav>
    </div>
  );
}

/** Giấy chứng nhận quyền sử dụng đất của một thửa, phủ toàn màn và cuộn được. */
export function LandCertificate({ plotId, onClose }: { plotId: number; onClose: () => void }) {
  const [c, setC] = useState<CertData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { let on = true; api<CertData>('GET', `/api/plots/${plotId}/certificate`).then((d) => { if (on) setC(d); }).catch((e) => { if (on) setErr(e instanceof Error ? e.message : 'Không mở được giấy chứng nhận.'); }); return () => { on = false; }; }, [plotId]);
  const row = (k: string, v: string | JSX.Element) => <div className="cert-row"><dt>{k}</dt><dd>{v}</dd></div>;
  return (
    <div className="cert-wrap" role="dialog" aria-modal="true" aria-label="Giấy chứng nhận quyền sử dụng đất">
      <button type="button" className="cert-close" onClick={onClose} aria-label="Đóng giấy chứng nhận">✕</button>
      {err && <div className="cert"><p className="error" role="alert">{err}</p></div>}
      {!c && !err && <div className="cert"><p className="muted">Đang lấy giấy chứng nhận…</p></div>}
      {c && (
        <article className="cert">
          <div className="cert-frame">
            <div className="cert-wm" aria-hidden="true"><Lotus size={260} color="#c9788a" /></div>
            <p className="cert-nation">TRÒ CHƠI VƯỜN VIỆT<br /><span>Xóm làng – Vườn tược – Đặc sản</span></p>
            <div className="cert-emblem" aria-hidden="true"><Lotus size={70} color="#b3261e" /></div>
            <h2 className="cert-title">{c.title.toUpperCase()}</h2>
            <p className="cert-no">Số vào sổ cấp giấy: <b>{c.no}</b></p>
            <h3>I. Người sử dụng đất</h3>
            <dl>{row('Ông/bà', <b className="cert-owner">{c.owner}</b>)}{row('Nơi thường trú', `${c.ward ? `${c.ward}, ` : ''}${c.province}`)}</dl>
            <h3>II. Thửa đất</h3>
            <dl>
              {row('Thửa đất số', `${c.plotId} · vùng trồng ${c.regionName}`)}
              {row('Địa chỉ', `${c.ward ? `${c.ward}, ` : ''}${c.province}`)}
              {row('Diện tích', <><b>{c.areaM2.toLocaleString('vi-VN')} m²</b> ({c.tiles} ô × 25 m²)</>)}
              {row('Hình thức sử dụng', 'Sử dụng riêng')}
              {row('Mục đích sử dụng', c.purpose)}
              {row('Thời hạn sử dụng', c.expiresAt ? `${c.term}, đến ngày ${fmtDate(c.expiresAt)}` : c.term)}
              {row('Nguồn gốc sử dụng', c.origin)}
            </dl>
            <h3>III. Nghĩa vụ tài chính</h3>
            <dl>
              {row('Giá chuyển nhượng', c.price > 0 ? fmtMoney(c.price) : 'Không thu tiền')}
              {row('Lệ phí trước bạ', c.fees.registration > 0 ? fmtMoney(c.fees.registration) : 'Miễn')}
              {row('Phí cấp giấy', c.fees.certificate > 0 ? fmtMoney(c.fees.certificate) : 'Miễn')}
              {c.fees.total > 0 && row('Đã nộp đủ', <b>{fmtMoney(c.fees.total)}</b>)}
            </dl>
            <div className="cert-sign">
              <p>{c.province}, ngày {fmtDate(c.issuedAt).replace(/\./g, '/')}<br /><b>{c.issuer.toUpperCase()}</b></p>
              <svg className="cert-seal" viewBox="0 0 120 120" aria-hidden="true">
                <defs><path id={`cs${c.plotId}`} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
                <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="60" cy="60" r="36" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <text className="cert-seal-t"><textPath href={`#cs${c.plotId}`} startOffset="0">VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI ★ VƯỜN VIỆT ★ </textPath></text>
                <path d="M60 34 l6.5 17.5 18.5 .8 -14.5 11.6 5 18 -15.5 -10.4 -15.5 10.4 5 -18 -14.5 -11.6 18.5 -.8z" fill="currentColor" />
              </svg>
            </div>
            <p className="cert-note">{c.note}</p>
            <p className="cert-game">Giấy trong trò chơi Vườn Việt, không có giá trị pháp lý.</p>
          </div>
        </article>
      )}
    </div>
  );
}

/** Tên các địa danh còn thiếu dấu chứng nhận — tiện cho App gợi ý. */
export function missingSights(data: PassportData): string[] { const done = new Set(data.stamps.filter((s) => s.kind === 'sight').map((s) => s.sightId)); return SIGHTS.filter((s) => !done.has(s.id)).map((s) => s.name); }
