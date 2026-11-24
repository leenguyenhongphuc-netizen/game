// Thẻ "Mô tô nước" ở các bãi biển du lịch (Mỹ Khê, Trần Phú – Nha Trang, Bãi Trường – Phú Quốc): chọn gói 15/30 phút,
// trả tiền ở máy chủ rồi chạy tự do trong vùng phao vàng; hết giờ hoặc bấm "Trả xe" thì báo máy chủ để nhận EXP.
import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { api } from '../api.ts';
import { fmtMoney } from '../../../shared/rules.ts';
import { SeaRide } from './SeaRide.tsx';

interface Beach { id: string; name: string; province: string; here: boolean; plans: { minutes: number; price: number }[]; source: string }
interface Rental { id: number; beachId: string; minutes: number; endsAt: number }

export function JetSkiPanel({ refresh, only }: { refresh?: () => void; /** chỉ hiện bãi này (đặt ở điểm tham quan bãi biển) */ only?: string }): JSX.Element {
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ride, setRide] = useState<Rental | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { try { const d = await api<{ beaches: Beach[]; rentals: Rental[] }>('GET', '/api/sea/jetski'); setBeaches(d.beaches); setRentals(d.rentals); } catch (e) { setErr((e as Error).message); } }, []);
  useEffect(() => { void load(); }, [load]);
  const rent = async (b: Beach, minutes: number) => {
    setBusy(true); setErr(null);
    try { const r = await api<{ rental: Rental }>('POST', '/api/sea/jetski/rent', { beachId: b.id, minutes }); refresh?.(); setRide(r.rental); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const done = async () => {
    const r = ride; setRide(null); if (!r) return;
    try { const f = await api<{ xp: number }>('POST', `/api/sea/jetski/${r.id}/finish`, {}); setMsg(f.xp ? `🏄 Đã trả mô tô nước · +${f.xp} EXP` : '🏄 Đã trả mô tô nước'); } catch { /* lỗi mạng: lượt thuê tự hết hạn */ }
    refresh?.(); void load();
  };
  const list = only ? beaches.filter((b) => b.id === only) : beaches;
  return (
    <div className="jet-panel">
      <h3>🏄 Mô tô nước</h3>
      <p className="muted">Chạy tự do trong vùng phao vàng trước bãi, có ca nô kéo phao chuối, thuyền thúng và người chơi khác cùng bãi. Giá tham chiếu giá thuê thật ở bãi biển (15 phút).</p>
      {err && <p className="error" role="alert">{err}</p>}
      {msg && <p className="ok" role="status">{msg}</p>}
      {list.map((b) => {
        const open = rentals.find((r) => r.beachId === b.id && r.endsAt > Date.now());
        return (
          <div className="row-line" key={b.id}>
            <div className="grow"><strong>{b.name}</strong><small>{b.province}{b.here ? '' : ` · tới ${b.province} mới thuê được`}</small></div>
            {open ? <button className="primary" onClick={() => setRide(open)}>Chạy tiếp</button>
              : b.plans.map((p) => <button key={p.minutes} className="primary" disabled={busy || !b.here} onClick={() => void rent(b, p.minutes)}>{p.minutes} phút · {fmtMoney(p.price)}</button>)}
          </div>
        );
      })}
      {ride && <SeaRide mode="jetski" beachId={ride.beachId} endsAt={ride.endsAt} onDone={() => void done()} onFail={() => { setErr('Thiết bị chưa dựng được cảnh 3D.'); void done(); }} />}
    </div>
  );
}
