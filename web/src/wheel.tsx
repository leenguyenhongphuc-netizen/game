// Vòng quay giao vai trò: máy chủ chọn vai (nghiêng về vai vùng đang thiếu), vòng quay chỉ trình diễn kết quả.
import { useState } from 'react';
import { ROLES, ROLE_INFO, SEASON_DAYS } from '../../shared/rules.ts';
import type { Role } from '../../shared/rules.ts';
import { api } from './api.ts';

const COLORS: Record<Role, string> = { nong_dan: '#8fd67c', xuong: '#6fb7d9', thuong_lai: '#f2b25c' };

export function RoleWheel({ regionName, onDone }: { regionName: string; onDone: () => void }) {
  const [angle, setAngle] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'spinning' | 'done'>('ready');
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slice = 360 / ROLES.length;

  async function spin() {
    setPhase('spinning'); setError(null);
    try {
      const r = await api<{ role: Role }>('POST', '/api/role/spin', {});
      const i = ROLES.indexOf(r.role);
      // Kim ở đỉnh; quay sao cho tâm lát của vai được giao dừng dưới kim.
      setAngle(360 * 6 + (360 - (i * slice + slice / 2)));
      setTimeout(() => { setRole(r.role); setPhase('done'); }, 4300);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.'); setPhase('ready');
    }
  }

  const gradient = ROLES.map((r, i) => `${COLORS[r]} ${i * slice}deg ${(i + 1) * slice}deg`).join(', ');
  return (
    <main className="auth">
      <div className="brand">
        <h1>Vòng quay vai trò</h1>
        <p>Xóm {regionName} cần đủ người trồng, người chế biến và người thu mua. Quay để biết mùa này bạn làm gì. Mỗi mùa dài {SEASON_DAYS} ngày, hết mùa được quay lại.</p>
      </div>
      <div className="wheel-wrap">
        <div className="wheel-pin" aria-hidden="true">▼</div>
        <div className="wheel" style={{ background: `conic-gradient(${gradient})`, transform: `rotate(${angle}deg)` }} aria-hidden="true">
          {ROLES.map((r, i) => (
            <div key={r} className="wheel-label" style={{ transform: `rotate(${i * slice + slice / 2}deg) translateY(-92px)` }}>
              <span>{ROLE_INFO[r].icon}</span><b>{ROLE_INFO[r].name}</b>
            </div>
          ))}
        </div>
      </div>
      {phase !== 'done' && <button className="primary spin-btn" disabled={phase === 'spinning'} onClick={spin}>{phase === 'spinning' ? 'Đang quay…' : 'Quay'}</button>}
      {error && <p className="error" role="alert">{error}</p>}
      {phase === 'done' && role && (
        <div className="card role-result" role="status">
          <span className="emoji big">{ROLE_INFO[role].icon}</span>
          <h2>Mùa này bạn là {ROLE_INFO[role].name}</h2>
          <p>{ROLE_INFO[role].desc}</p>
          <button className="primary" onClick={onDone}>Vào xóm</button>
        </div>
      )}
    </main>
  );
}
