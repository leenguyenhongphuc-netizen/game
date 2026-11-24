// Vòng quay giao vai trò: máy chủ chọn vai (nghiêng về vai vùng đang thiếu), vòng quay chỉ trình diễn kết quả.
import { useState } from 'react';
import { ROLES, ROLE_INFO, SEASON_DAYS } from '../../shared/rules.ts';
import type { Role } from '../../shared/rules.ts';
import { api } from './api.ts';

const COLORS: Record<Role, [string, string]> = { nong_dan: ['#9bdc84', '#7fcb6a'], xuong: ['#8fc9ee', '#6fb7d9'], thuong_lai: ['#ffd38a', '#f2b25c'] };
const SLICES: Role[] = [...ROLES, ...ROLES]; // mỗi vai hai lát đối nhau
const N = SLICES.length, STEP = 360 / N;
const polar = (deg: number, r: number) => { const a = ((deg - 90) * Math.PI) / 180; return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; };
function slicePath(i: number): string {
  const [x0, y0] = polar(i * STEP, 92), [x1, y1] = polar((i + 1) * STEP, 92);
  return `M100 100 L${x0} ${y0} A92 92 0 0 1 ${x1} ${y1} Z`;
}

export function RoleWheel({ regionName, onDone }: { regionName: string; onDone: () => void }) {
  const [angle, setAngle] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'spinning' | 'done'>('ready');
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function spin() {
    setPhase('spinning'); setError(null);
    try {
      const r = await api<{ role: Role }>('POST', '/api/role/spin', {});
      const i = SLICES.indexOf(r.role) + (Math.random() < 0.5 ? ROLES.length : 0);
      setAngle(360 * 6 + (360 - (i * STEP + STEP / 2))); // kim ở đỉnh: đưa tâm lát trúng thưởng về dưới kim
      setTimeout(() => { setRole(r.role); setPhase('done'); }, 4400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.'); setPhase('ready');
    }
  }

  return (
    <main className="wheel-screen">
      <div className="wheel-head">
        <h1>Vòng quay vai trò</h1>
        <p>Xóm {regionName} cần người trồng, người chế biến và người thu mua. Quay để biết mùa này bạn làm gì.</p>
      </div>
      <div className="wheel-wrap">
        <svg className="wheel-pin" viewBox="0 0 40 52" aria-hidden="true"><path d="M20 50 L4 18 A17 17 0 1 1 36 18 Z" fill="#e8573a" stroke="#fff" strokeWidth="3" /><circle cx="20" cy="17" r="6" fill="#fff" /></svg>
        <svg className="wheel" viewBox="0 0 200 200" style={{ transform: `rotate(${angle}deg)` }} aria-hidden="true">
          <circle cx="100" cy="100" r="99" fill="#7a4a22" />
          <circle cx="100" cy="100" r="95" fill="#fff6dc" />
          {SLICES.map((r, i) => <path key={i} d={slicePath(i)} fill={COLORS[r][i < ROLES.length ? 0 : 1]} stroke="#fff6dc" strokeWidth="1.6" />)}
          <defs>{SLICES.map((_, i) => { const [x0, y0] = polar(i * STEP + 5, 78), [x1, y1] = polar((i + 1) * STEP - 5, 78); return <path key={i} id={`arc${i}`} d={`M${x0} ${y0} A78 78 0 0 1 ${x1} ${y1}`} />; })}</defs>
          {SLICES.map((r, i) => (
            <g key={i}>
              <text fontSize="11.5" fontWeight="800" fill="#3b2a17" fontFamily="'Baloo 2', sans-serif"><textPath href={`#arc${i}`} startOffset="50%" textAnchor="middle">{ROLE_INFO[r].name}</textPath></text>
              <text x="100" y="56" textAnchor="middle" fontSize="27" transform={`rotate(${i * STEP + STEP / 2} 100 100)`}>{ROLE_INFO[r].icon}</text>
            </g>
          ))}
          {Array.from({ length: 18 }, (_, i) => { const [x, y] = polar(i * 20 + 10, 95.5); return <circle key={i} cx={x} cy={y} r="2.2" fill={i % 2 ? '#ffd23f' : '#fff'} />; })}
          <circle cx="100" cy="100" r="17" fill="#7a4a22" /><circle cx="100" cy="100" r="13" fill="#ffcf3a" />
          <text x="100" y="106" textAnchor="middle" fontSize="16">🌱</text>
        </svg>
      </div>
      <div className="wheel-action">
      {phase !== 'done' && <button className="primary spin-btn" disabled={phase === 'spinning'} onClick={spin}>{phase === 'spinning' ? 'Đang quay…' : 'Quay'}</button>}
        {phase !== 'done' && <p className="wheel-note">Mỗi mùa dài {SEASON_DAYS} ngày, hết mùa được quay lại.</p>}
        {error && <p className="error wheel-error" role="alert">{error}</p>}
        {phase === 'done' && role && (
          <div className="card role-result" role="status">
            <h2>{ROLE_INFO[role].icon} Mùa này bạn là {ROLE_INFO[role].name}</h2>
            <p>{ROLE_INFO[role].desc}</p>
            <button className="primary" onClick={onDone}>Vào xóm</button>
          </div>
        )}
      </div>
    </main>
  );
}
