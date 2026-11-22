// Thẻ hướng dẫn trồng: xem từng bước bằng hình, biết một vụ mất bao lâu và thu được gì.
import { useEffect, useState } from 'react';
import { CROPS, processOf } from '../../shared/catalog.ts';
import type { Specialty } from '../../shared/catalog.ts';
import { fmtMoney, stepWaitMs } from '../../shared/rules.ts';
import { fmtDuration } from './ui.ts';

/** Biểu tượng cho từng công việc, đoán theo tên bước. */
export function stepIcon(name: string): string {
  const n = name.toLowerCase();
  if (/thu hoạch|thu hái|gặt|nhổ/.test(n)) return '🧺';
  if (/sơ chế|phơi|sấy/.test(n)) return '☀️';
  if (/thụ phấn/.test(n)) return '🐝';
  if (/hoa|nụ/.test(n)) return '🌸';
  if (/bao trái|sâu|bệnh|phòng/.test(n)) return '🛡️';
  if (/tỉa|cắt|bấm|khoanh/.test(n)) return '✂️';
  if (/bón/.test(n)) return '🪣';
  if (/cỏ/.test(n)) return '🌿';
  if (/tưới|nước|ẩm/.test(n)) return '💧';
  if (/giàn|trụ|che|lưới/.test(n)) return '🪵';
  if (/trồng|giống|gieo|hom|cấy|ươm/.test(n)) return '🌱';
  return '⛏️';
}

export type StepKind = 'dat' | 'trong' | 'tuoi' | 'bon' | 'co' | 'tia' | 'gian' | 'baove' | 'hoa' | 'ong' | 'thu' | 'phoi';
/** Loại động tác của một bước, đoán theo tên bước — quyết định hoạt ảnh minh hoạ. */
export function stepKind(name: string): StepKind {
  const n = name.toLowerCase();
  if (/^(làm|chuẩn bị|cày|xới|lên) (đất|luống|liếp|mô)|^đào hố/.test(n)) return 'dat';
  if (/thu hoạch|thu hái|gặt|nhổ/.test(n)) return 'thu';
  if (/sơ chế|phơi|sấy/.test(n)) return 'phoi';
  if (/thụ phấn/.test(n)) return 'ong';
  if (/hoa|nụ/.test(n)) return 'hoa';
  if (/bao trái|sâu|bệnh|phòng/.test(n)) return 'baove';
  if (/tỉa|cắt|bấm|khoanh/.test(n)) return 'tia';
  if (/bón/.test(n)) return 'bon';
  if (/cỏ/.test(n)) return 'co';
  if (/tưới|nước|ẩm/.test(n)) return 'tuoi';
  if (/giàn|trụ|che|lưới/.test(n)) return 'gian';
  if (/trồng|giống|gieo|hom|cấy|ươm/.test(n)) return 'trong';
  return 'dat';
}
/** Câu ngắn tả việc nhân vật làm trong hoạt ảnh. */
export const KIND_VERB: Record<StepKind, string> = {
  dat: 'Cuốc đất, lên luống', trong: 'Đặt cây giống xuống hố', tuoi: 'Tưới nước quanh gốc', bon: 'Rải phân quanh gốc',
  co: 'Nhổ sạch cỏ dại', tia: 'Cắt bỏ cành thừa', gian: 'Dựng trụ, căng giàn', baove: 'Bọc trái, phòng sâu bệnh',
  hoa: 'Chăm cho hoa nở đều', ong: 'Ong đi thụ phấn cho hoa', thu: 'Hái trái bỏ vào sọt', phoi: 'Phơi sấy cho khô',
};

/** Lớp động tác chồng lên hình cây: mỗi loại bước một hoạt ảnh riêng (chạy bằng CSS trong styles.css). */
function ActionLayer({ kind, top, fruit }: { kind: StepKind; top: number; fruit: string }) {
  switch (kind) {
    case 'dat': return (
      <g>
        <g className="aa-swing" style={{ transformOrigin: '96px 30px' }}>
          <line x1="96" y1="30" x2="76" y2="68" stroke="#8a5a34" strokeWidth="4" strokeLinecap="round" />
          <path d="M70 62 L84 70 L78 76 L66 68 Z" fill="#8d99a6" stroke="#5c6772" strokeWidth="1.5" />
        </g>
        {[[52, 74], [66, 72], [58, 70]].map(([x, y], i) => <circle key={i} className="aa-pop" style={{ animationDelay: `${i * 0.12}s` }} cx={x} cy={y} r="3" fill="#8a5a34" />)}
      </g>);
    case 'trong': return (
      <g>
        <g className="aa-drop">
          <path d="M60 60 Q58 50 60 44" stroke="#5d8f3a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="54" cy="46" rx="7" ry="4" fill="#6fc15a" transform="rotate(-24 54 46)" /><ellipse cx="66" cy="44" rx="7" ry="4" fill="#58ad48" transform="rotate(24 66 44)" />
          <path d="M54 60 h12 l-2 9 h-8 z" fill="#8a5a34" />
        </g>
        <path className="aa-bob" d="M60 22 v10 m-5 -5 l5 6 l5 -6" stroke="#2f7d32" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>);
    case 'tuoi': return (
      <g>
        <g className="aa-tilt" style={{ transformOrigin: '94px 34px' }}>
          <rect x="84" y="26" width="22" height="18" rx="4" fill="#4aa3d8" stroke="#2c6f9c" strokeWidth="1.5" />
          <path d="M84 32 L70 24" stroke="#2c6f9c" strokeWidth="4" strokeLinecap="round" /><circle cx="69" cy="23.5" r="4" fill="#4aa3d8" stroke="#2c6f9c" strokeWidth="1.5" />
          <path d="M106 30 q8 5 0 12" stroke="#2c6f9c" strokeWidth="3" fill="none" />
        </g>
        {[0, 1, 2, 3, 4].map((i) => <path key={i} className="aa-rain" style={{ animationDelay: `${i * 0.18}s` }} d={`M${64 - i * 3} ${30 + (i % 2) * 3} q-2 4 0 6 q2 -2 0 -6`} fill="#5cc0f0" />)}
        <ellipse className="aa-puddle" cx="60" cy="80" rx="16" ry="3.5" fill="#5cc0f0" opacity="0.5" />
      </g>);
    case 'bon': return (
      <g>
        <g className="aa-tilt" style={{ transformOrigin: '92px 32px' }}>
          <path d="M82 22 h20 l3 22 h-26 z" fill="#f2e3b4" stroke="#b8974a" strokeWidth="1.5" /><text x="92" y="38" fontSize="10" textAnchor="middle" fill="#7a5a12">NPK</text>
        </g>
        {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} className="aa-rain" style={{ animationDelay: `${i * 0.14}s` }} cx={70 - (i % 3) * 5} cy={34 + (i % 2) * 4} r="2" fill={i % 2 ? '#d9a441' : '#f4f4f4'} stroke="#8a6a1e" strokeWidth="0.6" />)}
      </g>);
    case 'co': return (
      <g>
        {[36, 84].map((x, i) => (
          <g key={x} className="aa-pull" style={{ animationDelay: `${i * 0.5}s` }}>
            <path d={`M${x} 80 q-4 -8 -6 -12 M${x} 80 q0 -9 1 -14 M${x} 80 q4 -7 7 -11`} stroke="#9bb04a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d={`M${x} 80 q-2 3 -3 6 M${x} 80 q2 3 2 6`} stroke="#8a5a34" strokeWidth="1.5" fill="none" />
          </g>))}
      </g>);
    case 'tia': return (
      <g>
        <text className="aa-snip" x="88" y={Math.max(30, top + 8)} fontSize="20" textAnchor="middle">✂️</text>
        <g className="aa-fall"><ellipse cx="80" cy={Math.max(34, top + 12)} rx="9" ry="4.5" fill="#7fb85a" transform={`rotate(20 80 ${Math.max(34, top + 12)})`} /><path d={`M72 ${Math.max(36, top + 14)} l8 -3`} stroke="#5d8f3a" strokeWidth="2" /></g>
      </g>);
    case 'gian': return (
      <g>
        {[38, 82].map((x) => <rect key={x} className="aa-rise" style={{ transformOrigin: `${x}px 80px` }} x={x - 2} y="34" width="4" height="46" rx="1.5" fill="#a8744a" />)}
        <path className="aa-draw" d="M38 38 H82 M38 50 H82 M38 62 H82" stroke="#d8c08a" strokeWidth="2" fill="none" />
      </g>);
    case 'baove': return (
      <g>
        {[[-10, 4], [9, 0], [0, -9]].map(([dx, dy], i) => (
          <g key={i} className="aa-wrap" style={{ animationDelay: `${i * 0.35}s`, transformOrigin: `${60 + dx}px ${top + dy}px` }}>
            <path d={`M${54 + dx} ${top + dy - 6} h12 l-1 13 h-10 z`} fill="#f6efd8" stroke="#b8a878" strokeWidth="1.2" />
            <path d={`M${54 + dx} ${top + dy - 6} h12`} stroke="#b8a878" strokeWidth="2" />
          </g>))}
        <text className="aa-bob" x="96" y="40" fontSize="18" textAnchor="middle">🛡️</text>
      </g>);
    case 'hoa': return (
      <g>{[[-12, 3], [10, -2], [0, -11], [-4, 8], [13, 9]].map(([dx, dy], i) => (
        <g key={i} className="aa-bloom" style={{ animationDelay: `${i * 0.22}s`, transformOrigin: `${60 + dx}px ${top + dy}px` }}>
          {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx={60 + dx} cy={top + dy - 3.2} rx="2" ry="3.2" fill="#ffb3d1" transform={`rotate(${a} ${60 + dx} ${top + dy})`} />)}
          <circle cx={60 + dx} cy={top + dy} r="1.8" fill="#ffd95e" />
        </g>))}</g>);
    case 'ong': return (
      <g>
        {[[-12, 3], [10, -2], [0, -11]].map(([dx, dy], i) => <g key={i}><circle cx={60 + dx} cy={top + dy} r="4" fill="#ffb3d1" stroke="#fff" strokeWidth="1" /><circle cx={60 + dx} cy={top + dy} r="1.6" fill="#ffd95e" /></g>)}
        <text className="aa-bee" x="60" y={top} fontSize="16" textAnchor="middle">🐝</text>
        {[0, 1, 2].map((i) => <circle key={i} className="aa-pop" style={{ animationDelay: `${0.3 + i * 0.4}s` }} cx={52 + i * 9} cy={top - 4 + (i % 2) * 6} r="1.4" fill="#ffd95e" />)}
      </g>);
    case 'thu': return (
      <g>
        <path d="M10 74 h26 l-3 16 h-20 z" fill="#c98f4e" stroke="#7a4a22" strokeWidth="1.5" /><path d="M10 74 q13 -14 26 0" stroke="#7a4a22" strokeWidth="2" fill="none" />
        {[0, 1, 2].map((i) => <text key={i} className="aa-pick" style={{ animationDelay: `${i * 0.45}s`, ['--dx' as string]: `${-36 + i * 2}px`, ['--dy' as string]: `${72 - top}px` }} x={60 + (i - 1) * 9} y={top + 5} fontSize="13" textAnchor="middle">{fruit}</text>)}
      </g>);
    case 'phoi': return (
      <g>
        <g className="aa-spin" style={{ transformOrigin: '98px 20px' }}>{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="98" y1="4" x2="98" y2="8" stroke="#f5b93a" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${a} 98 20)`} />)}</g>
        <path d="M22 70 h76 l-6 8 h-64 z" fill="#d8b98a" stroke="#8a6a3a" strokeWidth="1.5" />
        {[0, 1, 2, 3, 4].map((i) => <text key={i} x={34 + i * 13} y="71" fontSize="11" textAnchor="middle">{fruit}</text>)}
        {[0, 1, 2].map((i) => <path key={i} className="aa-steam" style={{ animationDelay: `${i * 0.5}s` }} d={`M${40 + i * 20} 60 q-4 -5 0 -9 q4 -4 0 -9`} stroke="#f0a35a" strokeWidth="2" fill="none" strokeLinecap="round" />)}
      </g>);
  }
}

/** Hình minh hoạ: cây lớn dần theo bước (0 = mới làm đất, 1 = thu hoạch) và động tác của bước đó. */
export function StageArt({ t, kind, fruit }: { t: number; kind: StepKind; fruit: string }) {
  const dry = kind === 'phoi';
  const h = 8 + t * 46;                      // chiều cao thân
  const leaves = t < 0.12 ? 0 : Math.min(4, 1 + Math.floor(t * 4));
  const top = 78 - h;
  return (
    <svg className="stage-art" viewBox="0 0 120 100" role="img" aria-label={KIND_VERB[kind]}>
      <rect x="0" y="0" width="120" height="100" rx="14" fill="#dff3ff" />
      {!dry && <circle cx="98" cy="20" r="10" fill="#ffd95e" />}
      {dry && <circle cx="98" cy="20" r="9" fill="#ffc83a" />}
      <ellipse cx="60" cy="88" rx="56" ry="16" fill="#9fd47c" />
      {!dry && <>
        <ellipse cx="60" cy="80" rx="26" ry="8" fill="#a8744a" />
        <ellipse cx="60" cy="78" rx="20" ry="5" fill="#8a5a34" />
        {t >= 0.12 && <path d={`M60 78 Q${57 + t * 4} ${78 - h / 2} 60 ${top}`} stroke="#5d8f3a" strokeWidth={3 + t * 3} fill="none" strokeLinecap="round" />}
        {Array.from({ length: leaves }, (_, i) => {
          const y = 78 - (h * (i + 1)) / (leaves + 0.4), side = i % 2 ? 1 : -1, r = 7 + t * 9;
          return <ellipse key={i} cx={60 + side * (r * 0.9)} cy={y} rx={r} ry={r * 0.55} fill={i % 2 ? '#6fc15a' : '#58ad48'} transform={`rotate(${side * -24} ${60 + side * r * 0.9} ${y})`} />;
        })}
        {t >= 0.5 && <circle cx="60" cy={top} r={10 + t * 8} fill="#58ad48" />}
        {t >= 0.8 && kind !== 'thu' && kind !== 'baove' && [[-10, 4], [9, 0], [0, -9]].map(([dx, dy], i) => <text key={i} x={60 + dx} y={top + dy + 5} fontSize="13" textAnchor="middle">{fruit}</text>)}
        {kind === 'baove' && [[-10, 4], [9, 0], [0, -9]].map(([dx, dy], i) => <circle key={i} cx={60 + dx} cy={top + dy} r="4" fill="#9ed36a" stroke="#5d8f3a" strokeWidth="1" />)}
      </>}
      <ActionLayer kind={kind} top={top} fruit={fruit} />
    </svg>
  );
}

function seasonText(months: number[]): string {
  if (months.length >= 12) return 'Quanh năm';
  const s = [...months].sort((a, b) => a - b);
  // ghép các tháng liền nhau, tính cả vòng qua tháng 12 → 1
  const runs: number[][] = [];
  for (const m of s) { const r = runs[runs.length - 1]; if (r && r[r.length - 1] === m - 1) r.push(m); else runs.push([m]); }
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1].at(-1) === 12) runs[0] = [...runs.pop()!, ...runs[0]];
  return runs.map((r) => (r.length === 1 ? `T${r[0]}` : `T${r[0]}–${r[r.length - 1]}`)).join(', ');
}

export function CropGuide({ sp, pace, price, current, onClose }: {
  sp: Specialty; pace: number; price: number;
  /** Bước cây đang ở (không truyền khi chỉ xem tham khảo). */
  current?: number;
  onClose: () => void;
}) {
  const crop = CROPS[sp.crop], steps = processOf(crop), wait = stepWaitMs(sp, pace);
  const [i, setI] = useState(current ?? 0);
  useEffect(() => { setI(current ?? 0); }, [current, sp.id]);
  const st = steps[i], last = i === steps.length - 1;
  return (
    <div className="ctx-detail guide" role="dialog" aria-label={`Quy trình trồng ${sp.name}`}>
      <div className="sheet-head"><span className="emoji" aria-hidden="true">{crop.emoji}</span><h3>{sp.name}</h3><button className="round" aria-label="Đóng" onClick={onClose}>✕</button></div>
      <div className="facts">
        <div><span aria-hidden="true">⏱️</span><b>{fmtDuration(wait * (steps.length - 1))}</b><small>một vụ</small></div>
        <div><span aria-hidden="true">🧺</span><b>{crop.yieldKg} kg</b><small>mỗi ô, mỗi vụ</small></div>
        <div><span aria-hidden="true">💰</span><b>{fmtMoney(price * crop.yieldKg)}</b><small>bán được khoảng</small></div>
        <div><span aria-hidden="true">📅</span><b>{seasonText(crop.season)}</b><small>chính vụ +15%</small></div>
      </div>
      <div className="track" role="tablist" aria-label="Các bước">
        {steps.map((s, k) => (
          <button key={k} role="tab" aria-selected={k === i} aria-label={`Bước ${k + 1}: ${s.name}`}
            className={current !== undefined && k < current ? 'done' : k === current ? 'now' : ''} onClick={() => setI(k)}>{stepIcon(s.name)}</button>
        ))}
      </div>
      <div className="step-card">
        <StageArt key={i} t={steps.length > 1 ? i / (steps.length - 1) : 1} kind={stepKind(st.name)} fruit={crop.emoji} />
        <div className="step-body">
          <small>Bước {i + 1}/{steps.length}{i === current ? ' · cây đang ở bước này' : current !== undefined && i < current ? ' · đã làm xong' : ''}</small>
          <strong>{st.name}</strong>
          <p>{st.desc}</p>
        </div>
      </div>
      <ol className="step-flow">
        <li><span aria-hidden="true">👣</span><div><b>Bạn làm gì</b>{current === undefined ? 'Khi tự trồng: đứng lên ô có dấu ⭐, nhân vật tự làm.' : 'Đứng lên ô có dấu ⭐, nhân vật tự làm.'}</div></li>
        <li><span aria-hidden="true">{stepIcon(st.name)}</span><div><b>Trong vườn</b>{KIND_VERB[stepKind(st.name)]}.</div></li>
        <li><span aria-hidden="true">{last ? '🧺' : '⏱️'}</span><div><b>{last ? 'Kết quả' : 'Sau đó'}</b>{last ? `Nhận ${crop.yieldKg} kg ${sp.name} vào kho.` : <>Chờ {fmtDuration(wait)}, rồi tới <em>{steps[i + 1].name}</em>.</>}</div></li>
      </ol>
      <div className="step-nav">
        <button disabled={i === 0} onClick={() => setI(i - 1)}>◀ Trước</button>
        <button disabled={last} onClick={() => setI(i + 1)}>Tiếp ▶</button>
      </div>
    </div>
  );
}
