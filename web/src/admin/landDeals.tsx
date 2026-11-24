// Hồ sơ chuyển nhượng đất và tra cứu thửa: dùng ở Sổ địa chính (properties.tsx) và tại các quầy Trung tâm hành chính công.
import { useState } from 'react';
import { fmtMoney } from '../../../shared/rules.ts';
import { DEAL_STEPS } from '../../../shared/admin.ts';
import type { DealStatus } from '../../../shared/admin.ts';
import { api } from '../api.ts';
import { fmtDuration, useAction } from '../ui.ts';
import { openAdminCenter } from './open.ts';

export interface LotLite {
  id: number; province: string; use: string; useName: string; emoji: string; areaM2: number; parcelCode: string | null; serial: string | null;
  sheet: number | null; parcel: number | null; ownerName: string | null; statePrice: number;
}
export interface DealView {
  id: number; status: DealStatus; statusName: string; role: 'ban' | 'mua' | null; price: number; lot: LotLite | null; sellerName: string; buyerName: string;
  notaryFee: number; sellerSigned: boolean; buyerSigned: boolean; appointUntil: number | null; sellerTax: number; buyerFee: number; certFee: number;
  sellerPaid: boolean; buyerPaid: boolean; taxNoticeAt: number | null; readyAt: number | null; doneAt: number | null; newSerial: string | null; cancelReason: string | null;
}
export const short = (v: number) => (v >= 1e9 ? `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỉ` : v >= 1e6 ? `${Math.round(v / 1e6).toLocaleString('vi-VN')} triệu` : fmtMoney(v));
const CANCEL: Record<string, string> = {
  qua_hen_cong_chung: 'quá hạn hẹn công chứng', ben_ban_huy: 'bên bán huỷ', ben_mua_huy: 'bên mua huỷ', ban_cho_nguoi_khac: 'bên bán đã bán cho người khác',
  thoi_rao: 'bên bán thôi rao', tra_gia_moi: 'bạn trả giá mới', tra_dat: 'thửa trả lại Nhà nước',
};
const COUNTER_OF: Partial<Record<DealStatus, 'cong_chung' | 'dat_dai' | 'thue'>> = { hen_cong_chung: 'cong_chung', da_cong_chung: 'dat_dai', cho_nop_thue: 'thue', cho_tra_ket_qua: 'dat_dai' };

/** Việc bạn cần làm tiếp ở bước hiện tại (null = đang chờ bên kia hoặc chờ cơ quan xử lý). */
export function myTodo(d: DealView, now = Date.now()): string | null {
  const ban = d.role === 'ban';
  switch (d.status) {
    case 'de_nghi': return ban ? 'Đồng ý hoặc từ chối giá' : null;
    case 'hen_cong_chung': return (ban ? d.sellerSigned : d.buyerSigned) ? null : 'Tới Quầy 1 ký hợp đồng (bên kia cũng phải có mặt)';
    case 'da_cong_chung': return 'Tới Quầy 2 nộp hồ sơ đăng ký biến động';
    case 'cho_nop_thue': return (ban ? d.sellerPaid : d.buyerPaid) ? null : ban ? `Tới Quầy 3 nộp thuế TNCN ${short(d.sellerTax)}` : `Tới Quầy 3 nộp lệ phí trước bạ ${short(d.buyerFee)} và lệ phí cấp sổ`;
    case 'cho_tra_ket_qua': return !ban && d.readyAt != null && d.readyAt <= now ? 'Tới Quầy 2 nhận giấy chứng nhận mới' : null;
    default: return null;
  }
}

/** Thẻ một hồ sơ chuyển nhượng: các bước, bước hiện tại, việc cần làm, nút thao tác (chỉ những nút dùng được ở nơi đang đứng). */
export function DealCard({ d, at, onChanged }: { d: DealView; at?: 'cong_chung' | 'dat_dai' | 'thue' | null; onChanged: () => void }) {
  const act = useAction(onChanged);
  const idx = DEAL_STEPS.findIndex((s) => s.status === d.status), done = d.status === 'hoan_tat', dead = d.status === 'da_huy';
  const todo = myTodo(d), where = COUNTER_OF[d.status], post = (p: string) => act.run(() => api('POST', `/api/land/deals/${d.id}/${p}`, {}));
  const ban = d.role === 'ban';
  return (
    <div className={`deal-card${dead ? ' dead' : done ? ' done' : todo ? ' todo' : ''}`}>
      <div className="deal-head">
        <span aria-hidden="true">{d.lot?.emoji ?? '📄'}</span>
        <div className="deal-title">
          <strong>{ban ? 'Bán' : 'Mua'} {d.lot?.useName.toLowerCase()} {d.lot?.parcelCode ?? ''} · {short(d.price)}</strong>
          <small>{ban ? `cho ${d.buyerName}` : `của ${d.sellerName}`} · {d.lot?.province}{d.lot ? ` · ${d.lot.areaM2.toLocaleString('vi-VN')} m²` : ''}</small>
        </div>
        <span className="deal-state">{d.statusName}</span>
      </div>
      {!dead && (
        <ol className="deal-steps" aria-label="Các bước chuyển nhượng">
          {DEAL_STEPS.map((s, i) => <li key={s.status} className={done || i < idx ? 'ok' : i === idx ? 'now' : ''} title={`${s.name} · ${s.where}`}><span>{s.name}</span></li>)}
        </ol>
      )}
      {dead && <small className="muted">Đã huỷ{d.cancelReason ? `: ${CANCEL[d.cancelReason] ?? d.cancelReason}` : ''}.</small>}
      {done && <small className="deal-ok">✅ Đã sang tên. Giấy chứng nhận mới số <b>{d.newSerial}</b>.</small>}
      {d.status === 'hen_cong_chung' && <small>Phí công chứng và thù lao soạn thảo {fmtMoney(d.notaryFee)} (bên mua nộp). Đã ký: bên bán {d.sellerSigned ? '✔' : '—'}, bên mua {d.buyerSigned ? '✔' : '—'}.{d.appointUntil ? ` Hẹn trong ${fmtDuration(d.appointUntil - Date.now())}.` : ''}</small>}
      {d.status === 'dang_xu_ly' && d.taxNoticeAt && <small>Cơ quan thuế ra thông báo sau {fmtDuration(d.taxNoticeAt - Date.now())}.</small>}
      {d.status === 'cho_nop_thue' && <small>Thông báo thuế: bên bán nộp thuế TNCN 2% {fmtMoney(d.sellerTax)} {d.sellerPaid ? '✔' : ''}; bên mua nộp lệ phí trước bạ 0,5% {fmtMoney(d.buyerFee)} + lệ phí cấp sổ {fmtMoney(d.certFee)} {d.buyerPaid ? '✔' : ''}.</small>}
      {d.status === 'cho_tra_ket_qua' && d.readyAt && <small>{d.readyAt > Date.now() ? `Văn phòng đăng ký đang chỉnh lý hồ sơ, in sổ mới: còn ${fmtDuration(d.readyAt - Date.now())}.` : 'Đã có kết quả.'} Tiền đất đang phong toả, chuyển cho bên bán khi bên mua nhận sổ.</small>}
      {todo && <p className="deal-todo">👉 {todo}</p>}
      {act.error && <p className="error" role="alert">{act.error}</p>}
      <div className="deal-acts">
        {d.status === 'de_nghi' && ban && <><button className="primary" disabled={act.busy} onClick={() => post('accept')}>Đồng ý giá</button><button className="ghost" disabled={act.busy} onClick={() => post('cancel')}>Từ chối</button></>}
        {d.status === 'de_nghi' && !ban && <button className="ghost" disabled={act.busy} onClick={() => post('cancel')}>Rút trả giá</button>}
        {d.status === 'hen_cong_chung' && at === 'cong_chung' && !(ban ? d.sellerSigned : d.buyerSigned) && <button className="primary" disabled={act.busy} onClick={() => post('sign')}>Ký hợp đồng chuyển nhượng</button>}
        {d.status === 'hen_cong_chung' && <button className="ghost" disabled={act.busy} onClick={() => post('cancel')}>Huỷ hẹn</button>}
        {d.status === 'da_cong_chung' && at === 'dat_dai' && <button className="primary" disabled={act.busy} onClick={() => post('submit')}>Nộp hồ sơ đăng ký biến động</button>}
        {d.status === 'cho_nop_thue' && at === 'thue' && !(ban ? d.sellerPaid : d.buyerPaid) && <button className="primary" disabled={act.busy} onClick={() => post('pay')}>Nộp {ban ? `thuế ${short(d.sellerTax)}` : `lệ phí ${short(d.buyerFee + d.certFee)}`}</button>}
        {d.status === 'cho_tra_ket_qua' && at === 'dat_dai' && !ban && d.readyAt != null && d.readyAt <= Date.now() && <button className="primary" disabled={act.busy} onClick={() => post('collect')}>Nhận giấy chứng nhận mới</button>}
        {where && !at && d.lot && todo && <button className="ghost" onClick={() => openAdminCenter(d.lot!.province, where)}>🏛️ Tới Trung tâm hành chính công {d.lot.province}</button>}
      </div>
    </div>
  );
}

interface LookupData {
  lot: LotLite & { ownerName: string | null }; owner: string | null; intact: boolean;
  certs: { serial: string; issuedAt: number; revokedAt: number | null; reason: string | null; owner: string | null }[];
  history: { id: number; kind: string; kindName: string; at: number; hash: string; prev: string; ok: boolean; serial: string | null; oldSerial: string | null; price: number | null; from: string; to: string }[];
}
/** Tra cứu thửa theo số phát hành hoặc mã thửa; hiện toàn bộ biến động và kết quả kiểm chuỗi băm. */
export function LotLookup({ initial = '' }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const [d, setD] = useState<LookupData | null>(null);
  const [all, setAll] = useState<{ ok: boolean; count: number; brokenAt: number | null } | null>(null);
  const act = useAction();
  const find = (v = q) => act.run(async () => { setD(await api<LookupData>('GET', `/api/land/lookup?q=${encodeURIComponent(v.trim())}`)); });
  return (
    <div className="lookup">
      <form className="lookup-form" onSubmit={(e) => { e.preventDefault(); void find(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Số phát hành (AB 12345678) hoặc mã thửa (DN.0001.0007)" aria-label="Số phát hành hoặc mã thửa" />
        <button className="primary" disabled={act.busy || !q.trim()}>Tra cứu</button>
      </form>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {d && (
        <div className="lookup-out">
          <p><b>{d.lot.emoji} Thửa {d.lot.parcelCode}</b> · tờ bản đồ số {d.lot.sheet}, thửa số {d.lot.parcel} · {d.lot.useName} · {d.lot.areaM2.toLocaleString('vi-VN')} m² · {d.lot.province}<br />
            Chủ hiện tại: <b>{d.owner ?? 'Nhà nước quản lý'}</b>{d.lot.serial ? <> · sổ đang hiệu lực <b>{d.lot.serial}</b></> : null}</p>
          <p className={d.intact ? 'deal-ok' : 'error'}>{d.intact ? '🔒 Chuỗi biến động của thửa nguyên vẹn: mọi bản ghi khớp mã băm.' : '⚠️ Có bản ghi bị sửa: mã băm không khớp.'}</p>
          <ol className="ledger">
            {d.history.map((h) => (
              <li key={h.id} className={h.ok ? '' : 'bad'}>
                <strong>{h.kindName}</strong> <small>{new Date(h.at).toLocaleString('vi-VN')}</small><br />
                <small>{h.from} → {h.to}{h.price ? ` · ${short(h.price)}` : ''}{h.serial ? ` · sổ ${h.serial}` : ''}{h.oldSerial ? ` (thu hồi ${h.oldSerial})` : ''}</small><br />
                <code title={h.hash}>#{h.hash.slice(0, 12)}… ← #{h.prev.slice(0, 8)}…</code>
              </li>
            ))}
          </ol>
          <details><summary>Các giấy chứng nhận đã cấp cho thửa ({d.certs.length})</summary>
            <ul>{d.certs.map((c) => <li key={c.serial}><b>{c.serial}</b> · {c.owner ?? '—'} · cấp {new Date(c.issuedAt).toLocaleDateString('vi-VN')}{c.revokedAt ? ` · đã thu hồi (${c.reason === 'chuyen_nhuong' ? 'chuyển nhượng' : 'trả lại Nhà nước'})` : ' · đang hiệu lực'}</li>)}</ul>
          </details>
        </div>
      )}
      <button className="ghost" disabled={act.busy} onClick={() => act.run(async () => setAll(await api('GET', '/api/land/ledger/verify')))}>Kiểm toàn bộ sổ biến động</button>
      {all && <small className={all.ok ? 'deal-ok' : 'error'}>{all.ok ? `🔒 ${all.count.toLocaleString('vi-VN')} bản ghi, chuỗi băm nguyên vẹn.` : `⚠️ Chuỗi gãy ở bản ghi #${all.brokenAt}.`}</small>}
    </div>
  );
}
