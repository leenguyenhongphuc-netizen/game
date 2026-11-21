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

/** Hình minh hoạ cây lớn dần theo bước (0 = mới làm đất, 1 = thu hoạch). */
function StageArt({ t, icon, fruit, last }: { t: number; icon: string; fruit: string; last: boolean }) {
  const h = 8 + t * 46;                      // chiều cao thân
  const leaves = t < 0.12 ? 0 : Math.min(4, 1 + Math.floor(t * 4));
  const top = 78 - h;
  return (
    <svg className="stage-art" viewBox="0 0 120 100" role="img" aria-hidden="true">
      <rect x="0" y="0" width="120" height="100" rx="14" fill="#dff3ff" />
      <circle cx="98" cy="20" r="10" fill="#ffd95e" />
      <ellipse cx="60" cy="88" rx="56" ry="16" fill="#9fd47c" />
      <ellipse cx="60" cy="80" rx="26" ry="8" fill="#a8744a" />
      <ellipse cx="60" cy="78" rx="20" ry="5" fill="#8a5a34" />
      {t >= 0.12 && <path d={`M60 78 Q${57 + t * 4} ${78 - h / 2} 60 ${top}`} stroke="#5d8f3a" strokeWidth={3 + t * 3} fill="none" strokeLinecap="round" />}
      {Array.from({ length: leaves }, (_, i) => {
        const y = 78 - (h * (i + 1)) / (leaves + 0.4), side = i % 2 ? 1 : -1, r = 7 + t * 9;
        return <ellipse key={i} cx={60 + side * (r * 0.9)} cy={y} rx={r} ry={r * 0.55} fill={i % 2 ? '#6fc15a' : '#58ad48'} transform={`rotate(${side * -24} ${60 + side * r * 0.9} ${y})`} />;
      })}
      {t >= 0.5 && <circle cx="60" cy={top} r={10 + t * 8} fill="#58ad48" />}
      {t >= 0.55 && t < 0.8 && [[-9, 2], [8, -3], [0, -9]].map(([dx, dy], i) => <circle key={i} cx={60 + dx} cy={top + dy} r="3.2" fill="#ffb3d1" stroke="#fff" strokeWidth="1" />)}
      {t >= 0.8 && [[-10, 4], [9, 0], [0, -9]].map(([dx, dy], i) => <text key={i} x={60 + dx} y={top + dy + 5} fontSize="13" textAnchor="middle">{fruit}</text>)}
      {last && <text x="22" y="86" fontSize="22" textAnchor="middle">🧺</text>}
      <circle cx="22" cy="24" r="16" fill="#fff" stroke="#7a4a22" strokeWidth="2.5" />
      <text x="22" y="31" fontSize="18" textAnchor="middle">{icon}</text>
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
        <StageArt t={steps.length > 1 ? i / (steps.length - 1) : 1} icon={stepIcon(st.name)} fruit={crop.emoji} last={last} />
        <div className="step-body">
          <small>Bước {i + 1}/{steps.length}{i === current ? ' · cây đang ở bước này' : ''}</small>
          <strong>{st.name}</strong>
          <p>{st.desc}</p>
          <span className="tag">{last ? `Nhận ${crop.yieldKg} kg ${sp.name}` : `Chờ ${fmtDuration(wait)} rồi làm bước kế`}</span>
        </div>
      </div>
      <div className="step-nav">
        <button disabled={i === 0} onClick={() => setI(i - 1)}>◀ Trước</button>
        <button disabled={last} onClick={() => setI(i + 1)}>Tiếp ▶</button>
      </div>
    </div>
  );
}
