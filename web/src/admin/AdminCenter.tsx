// Trung tâm phục vụ hành chính công (màn hình đầy đủ): cảnh 3D AdminScene + lớp điều khiển: lấy số thứ tự, bảng gọi số,
// đi tới quầy, làm thủ tục ở từng quầy (công chứng, đất đai, thuế, giấy phép xây dựng, hợp tác xã, bằng lái).
import { useCallback, useEffect, useRef, useState } from 'react';
import './admin.css';
import { fmtMoney } from '../../../shared/rules.ts';
import { COUNTERS, PERMIT_DAYS, PERMIT_FEE, counterOf } from '../../../shared/admin.ts';
import type { CounterId } from '../../../shared/admin.ts';
import { BUILDINGS, LAND_USES } from '../../../shared/land.ts';
import type { BuildingKind } from '../../../shared/land.ts';
import { api } from '../api.ts';
import { fmtDuration, useAction } from '../ui.ts';
import { AdminScene } from './AdminScene.ts';
import type { Spot } from './AdminScene.ts';
import { DealCard, LotLookup } from './landDeals.tsx';
import type { DealView } from './landDeals.tsx';

interface Ticket { counter: CounterId; no: string; callAt: number }
interface CenterData { province: string; called: Record<string, { no: string; at: number }>; here: number; tickets: Ticket[]; deals: number; now: number }

export interface AdminCenterProps {
  province: string;
  /** Mở thẳng tới quầy này (đi bộ tới trước quầy). */
  counter?: CounterId;
  onClose: () => void;
  /** Quầy 6: mở bảng thi, đổi bằng lái có sẵn. */
  onLicense?: () => void;
  /** Quầy 5: mở bảng hợp tác xã (nhánh hợp tác xã). */
  onCoop?: () => void;
  /** Sau khi làm thủ tục có đổi tiền, tài sản. */
  onChanged?: () => void;
}

export function AdminCenter({ province, counter, onClose, onLicense, onCoop, onChanged }: AdminCenterProps) {
  const host = useRef<HTMLDivElement>(null), scene = useRef<AdminScene | null>(null);
  const [near, setNear] = useState<Spot | null>(null);
  const [data, setData] = useState<CenterData | null>(null);
  const [panel, setPanel] = useState<CounterId | 'kiosk' | null>(null);
  const [ring, setRing] = useState<Ticket | null>(null);
  const [now, setNow] = useState(Date.now());
  const rung = useRef(new Set<string>());

  useEffect(() => {
    if (!host.current) return;
    const s = new AdminScene(host.current, province, { onNear: setNear });
    scene.current = s;
    if (counter) setTimeout(() => s.goToSpot(counter), 600);
    return () => { s.dispose(); scene.current = null; };
  }, [province, counter]);

  const load = useCallback(async () => {
    try { const d = await api<CenterData>('GET', `/api/admin/center?province=${encodeURIComponent(province)}`); setData(d); scene.current?.setCalled(d.called); } catch { /* mạng chập chờn: lần sau */ }
  }, [province]);
  useEffect(() => { void load(); const t = setInterval(() => { void load(); setNow(Date.now()); }, 2500); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // số của mình được gọi: chuông + biểu ngữ
  useEffect(() => {
    for (const t of data?.tickets ?? []) if (t.callAt <= now && !rung.current.has(t.no)) { rung.current.add(t.no); setRing(t); }
  }, [data, now]);

  const ticketFor = (c: CounterId) => data?.tickets.find((t) => t.counter === c) ?? null;
  const go = (s: Spot) => { setPanel(null); scene.current?.goToSpot(s); };
  const nearCounter = near && near !== 'kiosk' ? counterOf(near) : null, tk = nearCounter ? ticketFor(nearCounter.id) : null;

  return (
    <div className="admin-center" role="dialog" aria-label={`Trung tâm phục vụ hành chính công ${province}`}>
      <div className="admin-3d" ref={host} />
      <div className="admin-top">
        <button className="ghost admin-back" onClick={onClose} aria-label="Rời trung tâm">←</button>
        <div className="admin-title"><strong>Trung tâm hành chính công</strong><small>{province} · 👥 {Math.max(1, data?.here ?? 1)} người đang ở đây</small></div>
      </div>
      <div className="admin-chips" aria-label="Đi tới quầy">
        <button className="chip" aria-label="Đi tới máy lấy số" title="Máy lấy số" onClick={() => go('kiosk')}>🎫</button>
        {COUNTERS.map((c) => <button key={c.id} className="chip" aria-label={`Đi tới Quầy ${c.no} · ${c.name}`} title={`Quầy ${c.no} · ${c.name}`} onClick={() => go(c.id)}>{c.emoji}<small>{c.no}</small></button>)}
      </div>
      {ring && (
        <div className="admin-ring" role="status">
          <span>🔔 Mời số <b>{ring.no}</b> đến <b>Quầy {counterOf(ring.counter)?.no}</b></span>
          <button className="primary" onClick={() => { go(ring.counter); setRing(null); }}>Đi tới</button>
          <button className="ghost" aria-label="Đóng" onClick={() => setRing(null)}>✕</button>
        </div>
      )}
      <div className="admin-bottom">
        {near === 'kiosk' && <button className="primary admin-act" onClick={() => setPanel('kiosk')}>🎫 Lấy số thứ tự</button>}
        {nearCounter && (tk && tk.callAt <= now
          ? <button className="primary admin-act" onClick={() => setPanel(nearCounter.id)}>{nearCounter.emoji} Làm việc tại Quầy {nearCounter.no} · {nearCounter.short}</button>
          : tk ? <p className="admin-wait">Số của bạn <b>{tk.no}</b> · chờ gọi khoảng {Math.max(1, Math.ceil((tk.callAt - now) / 1000))} giây</p>
          : <div className="admin-wait"><span>Quầy {nearCounter.no} làm việc theo số thứ tự.</span><button className="ghost" onClick={() => go('kiosk')}>🎫 Tới máy lấy số</button></div>)}
        {!near && <p className="admin-hint">Chạm xuống sàn để đi. {data && data.deals > 0 ? `Bạn có ${data.deals} hồ sơ đất đang làm ở tỉnh này.` : 'Lấy số ở máy cạnh cửa rồi tới quầy khi được gọi.'}</p>}
      </div>
      {panel === 'kiosk' && <Kiosk province={province} tickets={data?.tickets ?? []} onClose={() => setPanel(null)} onTaken={() => void load()} />}
      {panel && panel !== 'kiosk' && (
        <CounterPanel id={panel} province={province} onClose={() => setPanel(null)} onLicense={onLicense} onCoop={onCoop} onChanged={() => { void load(); onChanged?.(); }} />
      )}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="admin-sheet" role="dialog" aria-label={title}>
      <div className="admin-sheet-head"><strong>{title}</strong><button className="ghost" aria-label="Đóng" onClick={onClose}>✕</button></div>
      <div className="admin-sheet-body">{children}</div>
    </div>
  );
}

function Kiosk({ province, tickets, onClose, onTaken }: { province: string; tickets: Ticket[]; onClose: () => void; onTaken: () => void }) {
  const [got, setGot] = useState<{ no: string; counter: CounterId; callAt: number; ahead?: number } | null>(null);
  const act = useAction(onTaken);
  return (
    <Sheet title="Máy lấy số thứ tự" onClose={onClose}>
      <p className="muted">Chọn lĩnh vực cần làm. Khi bảng gọi đến số của bạn, đi tới đúng quầy.</p>
      <div className="kiosk-grid">
        {COUNTERS.map((c) => {
          const mine = tickets.find((t) => t.counter === c.id);
          return (
            <button key={c.id} className="kiosk-btn" disabled={act.busy} onClick={() => act.run(async () => {
              const r = await api<{ ticket: Ticket; ahead?: number }>('POST', '/api/admin/ticket', { province, counter: c.id }); setGot({ ...r.ticket, ahead: r.ahead });
            })}>
              <span aria-hidden="true">{c.emoji}</span><strong>Quầy {c.no} · {c.short}</strong><small>{mine ? `Đã có số ${mine.no}` : c.desc}</small>
            </button>
          );
        })}
      </div>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {got && <div className="ticket" role="status"><small>SỐ THỨ TỰ</small><b>{got.no}</b><small>Quầy {counterOf(got.counter)?.no} · {counterOf(got.counter)?.name}{got.ahead ? ` · ${got.ahead} người trước bạn` : ''}</small></div>}
    </Sheet>
  );
}

interface LandResp { deals: DealView[] }
function useDeals() {
  const [deals, setDeals] = useState<DealView[] | null>(null);
  const load = useCallback(async () => setDeals((await api<LandResp>('GET', '/api/land')).deals), []);
  useEffect(() => { void load(); }, [load]);
  return { deals, load };
}

function CounterPanel({ id, province, onClose, onLicense, onCoop, onChanged }: { id: CounterId; province: string; onClose: () => void; onLicense?: () => void; onCoop?: () => void; onChanged: () => void }) {
  const c = counterOf(id)!;
  const { deals, load } = useDeals();
  const changed = () => { void load(); onChanged(); };
  const here = (deals ?? []).filter((d) => d.lot?.province === province && d.status !== 'da_huy' && d.status !== 'hoan_tat');
  const at = id === 'cong_chung' || id === 'dat_dai' || id === 'thue' ? id : null;
  const mineHere = here.filter((d) => (id === 'cong_chung' ? d.status === 'hen_cong_chung' : id === 'dat_dai' ? ['da_cong_chung', 'dang_xu_ly', 'cho_tra_ket_qua'].includes(d.status) : id === 'thue' ? d.status === 'cho_nop_thue' : false));
  return (
    <Sheet title={`Quầy ${c.no} · ${c.name}`} onClose={onClose}>
      <p className="admin-staff">👩‍💼 <i>{GREET[id]}</i></p>
      {at && (
        <>
          <h4>Hồ sơ chuyển nhượng đất của bạn ở {province}</h4>
          {deals === null && <p className="hint">Đang tìm hồ sơ…</p>}
          {deals && mineHere.length === 0 && <p className="hint">{EMPTY[id]}</p>}
          {mineHere.map((d) => <DealCard key={d.id} d={d} at={at} onChanged={changed} />)}
        </>
      )}
      {id === 'cong_chung' && <NotaryInfo />}
      {id === 'dat_dai' && <><h4>Tra cứu thửa đất</h4><LotLookup /></>}
      {id === 'thue' && <TaxDesk province={province} onChanged={onChanged} />}
      {id === 'xay_dung' && <PermitDesk province={province} onChanged={onChanged} />}
      {id === 'htx' && (
        <div className="admin-desk">
          <p>Thủ tục đăng ký thành lập, thay đổi hợp tác xã theo Luật Hợp tác xã 2023: tối thiểu 5 thành viên chính thức, điều lệ, phương án sản xuất kinh doanh, góp vốn điều lệ.</p>
          {onCoop ? <button className="primary" onClick={onCoop}>🤝 Mở hồ sơ hợp tác xã</button> : <p className="hint">Quầy đang chuẩn bị, sẽ mở cùng bản cập nhật hợp tác xã.</p>}
        </div>
      )}
      {id === 'bang_lai' && (
        <div className="admin-desk">
          <p>Cấp mới (sau khi đạt sát hạch), đổi, cấp lại giấy phép lái xe. Giấy phép lái xe có thời hạn; quá hạn phải đổi hoặc thi lại lý thuyết.</p>
          {onLicense ? <button className="primary" onClick={onLicense}>🪪 Thi, đổi bằng lái</button> : <p className="hint">Mở mục Xe → Bằng lái trong game.</p>}
        </div>
      )}
    </Sheet>
  );
}
const GREET: Record<CounterId, string> = {
  cong_chung: 'Chào anh/chị. Hợp đồng chuyển nhượng phải có mặt cả bên bán và bên mua để công chứng viên đọc và chứng kiến ký.',
  dat_dai: 'Bộ phận một cửa đất đai xin nghe. Anh/chị nộp hồ sơ đăng ký biến động, nhận kết quả hay tra cứu thửa?',
  thue: 'Chi cục thuế xin chào. Anh/chị nộp thuế chuyển nhượng hay kê khai thuế hộ kinh doanh theo quý?',
  xay_dung: 'Phòng quản lý đô thị. Công trình trên đất thương mại, khu công nghiệp phải có giấy phép xây dựng trước khi khởi công.',
  htx: 'Bộ phận đăng ký hợp tác xã xin chào.',
  bang_lai: 'Bộ phận cấp, đổi giấy phép lái xe xin chào.',
};
const EMPTY: Record<CounterId, string> = {
  cong_chung: 'Không có hợp đồng nào đang hẹn công chứng. Thoả thuận giá trong Sổ địa chính trước.',
  dat_dai: 'Không có hồ sơ chờ nộp hay chờ trả kết quả.',
  thue: 'Không có thông báo thuế chuyển nhượng nào chờ nộp.',
  xay_dung: '', htx: '', bang_lai: '',
};

function NotaryInfo() {
  return (
    <details className="admin-desk"><summary>Biểu phí công chứng (Thông tư 257/2016/TT-BTC)</summary>
      <ul className="fee-list">
        <li>Dưới 50 triệu: 50.000đ</li><li>50–100 triệu: 100.000đ</li><li>100 triệu – 1 tỷ: 0,1% giá trị</li><li>1–3 tỷ: 1 triệu + 0,06% phần vượt 1 tỷ</li>
        <li>3–5 tỷ: 2,2 triệu + 0,05% phần vượt 3 tỷ</li><li>5–10 tỷ: 3,2 triệu + 0,04% phần vượt 5 tỷ</li><li>10–100 tỷ: 5,2 triệu + 0,03% phần vượt 10 tỷ</li><li>Trên 100 tỷ: 32,2 triệu + 0,02% phần vượt, tối đa 70 triệu</li>
      </ul>
      <small className="muted">Giá trị tính phí không thấp hơn giá đất theo bảng giá của tỉnh. Cộng thù lao soạn thảo hợp đồng.</small>
    </details>
  );
}

interface TaxRow { quarter: number; name: string; from: number; to: number; deadline: number; revenue: number; taxable: number; gtgt: number; tncn: number; total: number; penalty: number; state: 'da_nop' | 'dang_dien_ra' | 'qua_han' | 'can_ke_khai'; lateDays: number }
function TaxDesk({ province, onChanged }: { province: string; onChanged: () => void }) {
  const [d, setD] = useState<{ groupName: string; quarters: TaxRow[] } | null>(null);
  const load = useCallback(async () => setD(await api('GET', '/api/admin/tax')), []);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); onChanged(); });
  return (
    <div className="admin-desk">
      <h4>Thuế hộ kinh doanh theo quý</h4>
      {d ? <p className="muted">{d.groupName}. Doanh thu cả năm đến 1 tỷ đồng không phải nộp. Hạn nộp: ngày cuối tháng đầu của quý sau; chậm nộp tính 0,03% mỗi ngày.</p> : <p className="hint">Đang mở sổ thuế…</p>}
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {d?.quarters.map((t) => (
        <div className={`tax-row ${t.state}`} key={t.quarter}>
          <div className="grow"><strong>{t.name}</strong><small>Doanh thu {fmtMoney(t.revenue)} · thuế {fmtMoney(t.total)}{t.penalty ? ` · chậm nộp ${fmtMoney(t.penalty)}` : ''}</small>
            <small>{t.state === 'da_nop' ? '✅ Đã kê khai, nộp' : t.state === 'dang_dien_ra' ? `Đang trong kỳ, kết thúc sau ${fmtDuration(t.to - Date.now())}` : t.state === 'qua_han' ? `⚠️ Quá hạn ${t.lateDays} ngày` : `Hạn nộp còn ${fmtDuration(t.deadline - Date.now())}`}</small></div>
          {(t.state === 'can_ke_khai' || t.state === 'qua_han') && <button className="primary" disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/admin/tax/file', { province, quarter: t.quarter }))}>Kê khai, nộp {t.total + t.penalty ? fmtMoney(t.total + t.penalty) : '0đ'}</button>}
        </div>
      ))}
    </div>
  );
}

interface PermitRow { id: number; province: string; kind: BuildingKind; name: string; fee: number; appliedAt: number; readyAt: number; ready: boolean; used: boolean }
function PermitDesk({ province, onChanged }: { province: string; onChanged: () => void }) {
  const [rows, setRows] = useState<PermitRow[] | null>(null);
  const load = useCallback(async () => setRows((await api<{ permits: PermitRow[] }>('GET', '/api/admin/permits')).permits), []);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); onChanged(); });
  return (
    <div className="admin-desk">
      <h4>Xin giấy phép xây dựng ở {province}</h4>
      <p className="muted">Hồ sơ: giấy chứng nhận quyền sử dụng đất đúng loại đất, bản vẽ thiết kế. Lệ phí {fmtMoney(PERMIT_FEE)}, thẩm định trong {PERMIT_DAYS} ngày. Có phép rồi mới khởi công trong mục Tài sản.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      <div className="permit-kinds">
        {(Object.keys(BUILDINGS) as BuildingKind[]).map((k) => (
          <button key={k} className="kiosk-btn" disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/admin/permits', { province, kind: k }))}>
            <span aria-hidden="true">{BUILDINGS[k].emoji}</span><strong>{BUILDINGS[k].name}</strong><small>cần {BUILDINGS[k].lots} thửa {LAND_USES[BUILDINGS[k].use].short.toLowerCase()} trống</small>
          </button>
        ))}
      </div>
      <h4>Hồ sơ của bạn</h4>
      {rows?.length === 0 && <p className="hint">Chưa nộp hồ sơ nào.</p>}
      {rows?.map((p) => (
        <div className="tax-row" key={p.id}><div className="grow"><strong>{p.name} · {p.province}</strong><small>{p.used ? '✅ Đã dùng để khởi công' : p.ready ? '✅ Đã cấp phép, có thể khởi công' : `Đang thẩm định, còn ${fmtDuration(p.readyAt - Date.now())}`}</small></div></div>
      ))}
    </div>
  );
}
