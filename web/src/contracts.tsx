// Thẻ "Hợp đồng" trong Kho: công ty xuất nhập khẩu (NPC) đặt hợp đồng thu mua số lượng lớn, giao từng phần,
// nhiều người cùng giao (có bảng xếp hạng). Công ty cũng bán lại máy nhập khẩu.
import { useCallback, useEffect, useState } from 'react';
import { QUALITY_NAMES, fmtMoney } from '../../shared/rules.ts';
import type { Quality } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { fmtDuration, useAction } from './ui.ts';
import { canUse } from '../../shared/roles.ts';

interface ContractView {
  id: string; companyId: string; specialtyId: string; processed: boolean; minGrade: Quality; kg: number; price: number; expiresAt: number;
  name: string; emoji: string; companyName: string; province: string; marketName: string; deliveredKg: number; remainingKg: number; myKg: number; refPrice: number;
  leaderboard?: { userId: number; name: string; kg: number; me: boolean }[];
}
interface CompanyView {
  id: string; name: string; short: string; province: string; emoji: string; note: string;
  markets: { id: string; name: string; icon: string }[]; shop: { kind: string; name: string; emoji: string; price: number }[]; contracts: ContractView[];
}
const GRADES: Quality[] = ['A', 'B', 'C'];
const rank: Record<Quality, number> = { A: 3, B: 2, C: 1 };

export function ContractsPanel({ me, refresh }: { me: Me; refresh: () => void }) {
  const [data, setData] = useState<{ companies: CompanyView[]; shipPerKgKm: number } | null>(null);
  const [products, setProducts] = useState<{ specialtyId: string; kg: number }[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [board, setBoard] = useState<Record<string, ContractView['leaderboard']>>({});
  const [kgOf, setKgOf] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    setData(await api('GET', '/api/companies'));
    setProducts((await api<{ products?: { specialtyId: string; kg: number }[] }>('GET', '/api/workshop')).products ?? []);
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, [load]);
  const act = useAction(() => { void load(); refresh(); });
  const openCompany = async (id: string) => {
    setOpen(open === id ? null : id);
    if (open === id) return;
    const r = await api<{ contracts: ContractView[] }>('GET', `/api/companies/${id}/contracts`);
    setBoard((b) => ({ ...b, ...Object.fromEntries(r.contracts.map((c) => [c.id, c.leaderboard])) }));
  };
  if (!data) return <p className="hint">Đang tải hợp đồng…</p>;
  /** Hàng phù hợp hợp đồng: loại cao nhất trước. */
  const stockFor = (c: ContractView) => c.processed
    ? [{ grade: 'A' as Quality, kg: products.find((p) => p.specialtyId === c.specialtyId)?.kg ?? 0 }]
    : GRADES.filter((g) => rank[g] >= rank[c.minGrade]).map((g) => ({ grade: g, kg: me.inventory.filter((i) => i.specialtyId === c.specialtyId && i.quality === g).reduce((s, i) => s + i.kg, 0) }));
  return (
    <div className="contracts">
      <p className="muted">Công ty xuất nhập khẩu đặt hàng số lượng lớn với giá cao hơn giá tham chiếu (thấp hơn tự xuất khẩu, vì họ chịu cước và rủi ro giá). Giao từng phần, nhiều người cùng giao; ai giao trước được trước. Tự chở tới tỉnh có kho thì không mất phí, không thì thuê chành xe ({data.shipPerKgKm.toLocaleString('vi-VN')}đ/kg/km).</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {msg && <p className="notice" role="status">{msg}</p>}
      {data.companies.map((co) => (
        <div className="row contract-company" key={co.id}>
          <button type="button" className="row-line row-toggle" aria-expanded={open === co.id} onClick={() => void openCompany(co.id)}>
            <span className="emoji" aria-hidden="true">{co.emoji}</span>
            <div className="grow"><strong>{co.short}</strong><br /><small>Kho ở {co.province} · {co.markets.map((m) => m.icon).join(' ')} · {co.contracts.length} hợp đồng</small></div>
            <span aria-hidden="true">{open === co.id ? '▴' : '▾'}</span>
          </button>
          {open === co.id && (
            <div className="contract-body">
              <p className="muted">{co.name}. {co.note}</p>
              {co.contracts.length === 0 && <p className="hint">Hôm nay công ty đã gom đủ hàng.</p>}
              {co.contracts.filter((c) => !(c.processed && me.user.role === 'nong_dan')).map((c) => {
                const stock = stockFor(c), best = stock.find((s) => s.kg > 0), left = c.remainingKg;
                const want = Math.min(kgOf[c.id] ?? Math.min(best?.kg ?? 0, left), best?.kg ?? 0, left);
                return (
                  <div className="contract" key={c.id}>
                    <div className="row-line">
                      <span className="emoji" aria-hidden="true">{c.processed ? '📦' : c.emoji}</span>
                      <div className="grow">
                        <strong>{c.name}</strong> <small>{c.processed ? 'thành phẩm' : `từ ${QUALITY_NAMES[c.minGrade]}`} · đi {c.marketName}</small><br />
                        <small>{fmtMoney(c.price)}/kg <span className="up">(+{Math.round((c.price / Math.max(1, c.refPrice) - 1) * 100)}% giá tham chiếu)</span> · hạn {fmtDuration(Math.max(0, c.expiresAt - now))}</small>
                      </div>
                    </div>
                    <div className="bar" aria-label={`Đã giao ${c.deliveredKg}/${c.kg} kg`}><i style={{ width: `${Math.round((c.deliveredKg / c.kg) * 100)}%` }} /></div>
                    <small>Đã gom {c.deliveredKg.toLocaleString('vi-VN')}/{c.kg.toLocaleString('vi-VN')} kg{c.myKg ? ` · bạn giao ${c.myKg.toLocaleString('vi-VN')} kg` : ''}</small>
                    {left > 0 && (best ? (
                      <div className="row-actions">
                        <label>Giao <input type="number" inputMode="numeric" min={1} max={Math.min(best.kg, left)} value={want} onChange={(e) => setKgOf({ ...kgOf, [c.id]: Number(e.target.value) || 0 })} /> kg {c.processed ? '' : QUALITY_NAMES[best.grade]}</label>
                        <button className="primary" disabled={act.busy || want < 1} onClick={() => act.run(async () => {
                          const r = await api<{ kg: number; net: number; shipFee: number }>('POST', `/api/contracts/${c.id}/deliver`, { specialtyId: c.specialtyId, grade: best.grade, kg: want });
                          setMsg(`Đã giao ${r.kg} kg, nhận ${fmtMoney(r.net)}${r.shipFee ? ` (đã trừ ${fmtMoney(r.shipFee)} chành xe)` : ''}.`);
                          setKgOf({ ...kgOf, [c.id]: 0 });
                        })}>Giao hàng<small>≈ {fmtMoney(want * c.price)}</small></button>
                      </div>
                    ) : <small className="hint">Kho chưa có {c.name} đạt loại yêu cầu — {me.user.role === 'nong_dan' ? 'trồng, thu hoạch' : me.user.role === 'xuong' ? 'chế biến' : 'thu mua sỉ'} rồi quay lại.</small>)}
                    {(board[c.id]?.length ?? 0) > 0 && (
                      <ol className="contract-board">{board[c.id]!.slice(0, 5).map((r) => <li key={r.userId} className={r.me ? 'me' : ''}>{r.name}: {r.kg.toLocaleString('vi-VN')} kg</li>)}</ol>
                    )}
                  </div>
                );
              })}
              {co.shop.length > 0 && canUse(me.user.role, 'mua_may') && (
                <>
                  <h4>Máy nhập khẩu công ty bán lại</h4>
                  {co.shop.map((m) => <div className="row-line" key={m.kind}><span className="emoji" aria-hidden="true">{m.emoji}</span><div className="grow">{m.name}</div><span className="price">{fmtMoney(m.price)}</span></div>)}
                  <small className="muted">Giá tham khảo của công ty. Chủ xưởng mua và lắp máy ở Xưởng (mua máy, nhập máy).</small>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
