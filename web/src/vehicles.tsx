// Bãi xe & đại lý: xe đang dùng, xe đang có, mua xe mới, thi và nhận giấy phép lái xe.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { REGIONS } from '../../shared/catalog.ts';
import { fmtMoney } from '../../shared/rules.ts';
import type { LicenseClass, VehicleSpec } from '../../shared/vehicles.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { useAction } from './ui.ts';
import './vehicles.css';
import { ExamGame } from './drive/ExamGame.tsx';
import { MotoExam } from './drive/MotoExam.tsx';
import { PhuotPanel } from './phuot.tsx';

type Group = VehicleSpec['group'];
interface CatalogRow extends VehicleSpec { unit: string; powerName: string; rangeKm: number; roadPrice: number; parkPrice: number; tollGroupName: string; licenseName: string; owned: number; canBuy: boolean; why: string | null }
interface OwnedRow { id: number; kind: string; name: string; emoji: string; power: string; unit: string; tank: number; cargoKg: number; energy: number; odoKm: number; regionId: string | null; active: boolean; resaleValue: number }
interface ExamPart { passed?: boolean; at?: number | null; best?: number | null; pass?: number; fee?: number; required?: boolean }
interface LicenseRow { cls: LicenseClass; name: string; covers: string; price: number; minLevel: number; includes: LicenseClass[]; owned: boolean; covered: boolean; canBuy: boolean; why: string | null;
  termYears?: number | null; issuedAt?: number | null; expiresAt?: number | null; expired?: boolean; daysLeft?: number | null; points?: number; maxPoints?: number; suspended?: boolean;
  exam?: { theory?: ExamPart; yard?: ExamPart }; renew?: { mode: 'doi' | 'thi_ly_thuyet' | 'thi_lai'; fee: number; needTheory?: boolean; needYard?: boolean } | null }
const dmy = (t?: number | null) => (t ? new Date(t).toLocaleDateString('vi-VN') : '—');
export interface GarageData { level: number; cash: number; atHome: boolean; active: number | null; maxOwned: number; resale: number; catalog: CatalogRow[]; owned: OwnedRow[]; licenses: LicenseRow[]; rules?: { continuousHours: number; dailyHours: number; weeklyHours: number } }

const kg = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tấn` : `${n.toLocaleString('vi-VN')} kg`);
const num = (n: number, d = 0) => n.toLocaleString('vi-VN', { maximumFractionDigits: d });
/** Tiền năng lượng cho mỗi km khi chở đầy (nạp dọc đường). */
const perKm = (v: { per100: number; roadPrice: number }) => Math.round((v.per100 * v.roadPrice) / 100);

/** Hình xe nhìn ngang, tự vẽ theo nhóm xe; xe điện có tia sét và dải xanh, thùng lạnh màu trắng có máy lạnh. */
export function VehicleArt({ group, color = '#f08a6c', electric, cold, size = 150, moto }: { group: Group; color?: string; electric?: boolean; cold?: boolean; size?: number; moto?: VehicleSpec['moto'] }): JSX.Element {
  const O = '#56310f', boxC = cold ? '#f4f7fa' : '#e9d2a6', S = { stroke: O, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const wheel = (x: number, r = 9) => <g key={x}><circle cx={x} cy={66} r={r} fill="#3b2a17" {...S} /><circle cx={x} cy={66} r={r * 0.36} fill="#d8d2c4" /></g>;
  const glass = '#bfe9ff';
  const fruits = (x0: number, n: number, y: number) => Array.from({ length: n }, (_, i) => <circle key={i} cx={x0 + i * 11} cy={y - (i % 2) * 3} r={6} fill={['#ff8a3d', '#ffd23f', '#7ccf4f', '#e8457f', '#6a3d9a'][i % 5]} {...S} strokeWidth={1.6} />);
  let body: JSX.Element;
  if (group === 'xe_may') {
    // xe máy nhìn ngang: bánh lớn hai đầu, dáng theo loại (xe số, tay ga, côn tay, adventure)
    const adv = moto === 'adventure', ga = moto === 'ga' || moto === 'dien', r = adv ? 15 : ga ? 11 : 13, y = 76 - r - 2;
    const bw = (x: number) => <g key={x}><circle cx={x} cy={y} r={r} fill="#3b2a17" {...S} /><circle cx={x} cy={y} r={r * 0.45} fill="#d8d2c4" /></g>;
    body = (
      <>
        {ga ? <path d={`M50 ${y - 4}h46l14-22h12l-4 24H58z`} fill={color} {...S} />
          : adv ? <path d={`M48 ${y - 10}l16-22h36l14 10-6 14H62z`} fill={color} {...S} />
          : moto === 'con_tay' ? <path d={`M52 ${y - 8}l14-18h30l16 8-8 12H64z`} fill={color} {...S} />
          : <path d={`M54 ${y - 6}l18-14h22l14 6-4 10H66z`} fill={color} {...S} />}
        <path d={`M${ga ? 62 : 66} ${y - (ga ? 14 : adv ? 30 : 22)}h34`} stroke="#2b2f36" strokeWidth="7" strokeLinecap="round" />
        <path d={`M112 ${y}l-6 -${adv ? 40 : 30}h10`} fill="none" {...S} strokeWidth={3.2} />
        {adv && <><rect x="40" y={y - 30} width="18" height="20" rx="3" fill="#a7adb5" {...S} /><path d={`M110 ${y - 48}l8 -10`} stroke="#bfe9ff" strokeWidth="5" /></>}
        {moto === 'so' && <rect x="40" y={y - 22} width="20" height="4" fill="#8d939c" />}
        {bw(52)}{bw(114)}
        <circle cx="120" cy={y - (adv ? 36 : 26)} r="4" fill="#ffe27a" stroke={O} strokeWidth="1.5" />
      </>);
  }
  else if (group === 'ba_gac') body = (
    <>
      <path d="M96 40h34l6 12v10H96z" fill={color} {...S} /><path d="M118 28l10 12" fill="none" {...S} strokeWidth={3} /><rect x="100" y="36" width="16" height="6" rx="3" fill="#2b2f36" {...S} />
      <rect x="22" y="38" width="70" height="22" rx="3" fill={boxC} {...S} /><path d="M22 46h70" stroke="#b8956a" strokeWidth="1.6" />{fruits(34, 5, 34)}
      {wheel(44)}{wheel(132, 8)}
    </>);
  else if (group === 'ban_tai') body = (
    <>
      <path d="M14 44h62v18H14z" fill={color} {...S} /><path d="M76 62V34h34l14 14h18v14z" fill={color} {...S} /><path d="M82 38h24l11 10H82z" fill={glass} stroke={O} strokeWidth="1.6" />
      {fruits(24, 5, 40)}{wheel(40)}{wheel(120)}
    </>);
  else if (group === 'dau_keo') body = (
    <>
      <rect x="4" y="22" width="104" height="36" rx="2" fill={cold ? '#f4f7fa' : '#2e7d6b'} {...S} />{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${12 + i * 8} 25v30`} stroke={cold ? '#c9d2dc' : '#25665a'} strokeWidth="2" />)}
      <path d="M4 58h110v5H4z" fill="#3a3f4a" {...S} /><path d="M114 62V24h20l12 14v24z" fill={color} {...S} /><path d="M120 28h12l9 11h-21z" fill={glass} stroke={O} strokeWidth="1.6" /><path d="M112 14v26" {...S} strokeWidth={3} stroke="#8f97a3" />
      {wheel(16, 8)}{wheel(34, 8)}{wheel(52, 8)}{wheel(104, 8)}{wheel(136, 8)}
    </>);
  else if (group === 'tai_nang' || group === 'tai_trung') { const heavy = group === 'tai_nang'; body = (
    <>
      <rect x={heavy ? 6 : 20} y={heavy ? 18 : 24} width={heavy ? 100 : 82} height={heavy ? 42 : 36} rx="3" fill={boxC} {...S} />
      {!cold && Array.from({ length: heavy ? 8 : 6 }, (_, i) => <path key={i} d={`M${(heavy ? 16 : 30) + i * 12} ${heavy ? 21 : 27}v${heavy ? 36 : 30}`} stroke="#b8956a" strokeWidth="1.8" />)}
      {cold && <><path d={`M${heavy ? 6 : 20} 40h${heavy ? 100 : 82}`} stroke="#3f8fd6" strokeWidth="5" /><rect x={heavy ? 92 : 88} y={heavy ? 10 : 16} width="14" height="8" rx="2" fill="#d9dee4" {...S} /></>}
      <path d="M110 62V28h22l12 14v20z" fill={color} {...S} /><path d="M116 32h13l9 11h-22z" fill={glass} stroke={O} strokeWidth="1.6" />
      {heavy ? <>{wheel(24)}{wheel(46)}{wheel(128)}</> : <>{wheel(42)}{wheel(128)}</>}
    </>); }
  else body = (
    <>
      {cold ? <><rect x="18" y="22" width="78" height="38" rx="3" fill={boxC} {...S} /><path d="M18 42h78" stroke="#3f8fd6" strokeWidth="5" /><rect x="80" y="14" width="14" height="8" rx="2" fill="#d9dee4" {...S} /></>
        : <><rect x="18" y="40" width="78" height="20" rx="3" fill={boxC} {...S} /><path d="M18 48h78" stroke="#b8956a" strokeWidth="1.6" />{fruits(28, 6, 36)}</>}
      <path d="M100 62V30h24l14 14v18z" fill={color} {...S} /><path d="M106 34h15l10 11h-25z" fill={glass} stroke={O} strokeWidth="1.6" />
      {wheel(40)}{wheel(120)}
    </>);
  return (
    <svg className="veh-art" viewBox="0 0 160 80" width={size} height={size / 2} role="img" aria-label="Hình xe">
      <ellipse cx="80" cy="76" rx="70" ry="3.5" fill="#0002" />
      {body}
      {electric && <><rect x="2" y="2" width="30" height="16" rx="8" fill="#1f9d5a" stroke="#fff" strokeWidth="2" /><path d="M19 4l-7 7h5l-2 5 7-7h-5z" fill="#ffe27a" /></>}
    </svg>);
}

// ---------------------------------------------------------------- câu hỏi thi lý thuyết
interface Q { q: string; a: [string, string, string]; ok: 0 | 1 | 2; why: string }
/** Câu hỏi theo quy định hiện hành (Luật Trật tự, an toàn giao thông đường bộ 2024 và thông tư về tốc độ, khoảng cách). */
export const QUIZ: Q[] = [
  { q: 'Người lái xe được phép có nồng độ cồn trong máu hoặc hơi thở ở mức nào?', a: ['Không được có nồng độ cồn', 'Dưới 0,25 mg/lít khí thở', 'Tuỳ loại xe'], ok: 0, why: 'Luật cấm điều khiển phương tiện mà trong máu hoặc hơi thở có nồng độ cồn. Đã uống rượu bia thì không lái xe.' },
  { q: 'Biển tròn viền đỏ, nền trắng, ghi số 80 nghĩa là gì?', a: ['Tốc độ tối thiểu 80 km/h', 'Tốc độ tối đa cho phép 80 km/h', 'Còn 80 km tới trạm'], ok: 1, why: 'Đó là biển "Tốc độ tối đa cho phép": không được chạy nhanh hơn số ghi trên biển.' },
  { q: 'Biển tròn nền xanh ghi số 60 trên đường cao tốc nghĩa là gì?', a: ['Tốc độ tối đa 60 km/h', 'Tốc độ tối thiểu cho phép 60 km/h', 'Khoảng cách tối thiểu 60 m'], ok: 1, why: 'Biển nền xanh là biển hiệu lệnh: xe phải chạy không chậm hơn tốc độ ghi trên biển khi điều kiện cho phép.' },
  { q: 'Tốc độ tối đa cho phép trên đường cao tốc ở Việt Nam không vượt quá bao nhiêu?', a: ['100 km/h', '120 km/h', '140 km/h'], ok: 1, why: 'Tốc độ khai thác tối đa trên cao tốc không quá 120 km/h, và luôn phải theo biển báo của từng đoạn.' },
  { q: 'Trong khu đông dân cư, trên đường hai chiều không có dải phân cách giữa, ô tô chạy tối đa bao nhiêu?', a: ['50 km/h', '60 km/h', '70 km/h'], ok: 0, why: 'Trong khu đông dân cư: 50 km/h trên đường hai chiều hoặc đường một chiều có một làn xe cơ giới; 60 km/h trên đường đôi hoặc đường một chiều có từ hai làn.' },
  { q: 'Người lái xe ô tô không được lái liên tục quá bao lâu?', a: ['2 giờ', '4 giờ', '6 giờ'], ok: 1, why: 'Không lái xe liên tục quá 4 giờ; phải dừng nghỉ rồi mới đi tiếp.' },
  { q: 'Một ngày, người lái xe ô tô kinh doanh vận tải được lái tối đa bao nhiêu giờ?', a: ['8 giờ', '10 giờ', '12 giờ'], ok: 1, why: 'Thời gian lái xe không quá 10 giờ trong một ngày và không quá 48 giờ trong một tuần.' },
  { q: 'Làn dừng khẩn cấp trên đường cao tốc dùng để làm gì?', a: ['Vượt xe khi đường đông', 'Chỉ dừng, đỗ khi xe gặp sự cố hoặc trường hợp khẩn cấp', 'Xe tải chạy chậm'], ok: 1, why: 'Không được chạy xe trên làn dừng khẩn cấp; chỉ vào khi xe hỏng hoặc có việc khẩn cấp, và phải bật đèn cảnh báo.' },
  { q: 'Trên đường cao tốc, việc nào sau đây bị cấm?', a: ['Chạy đúng làn', 'Lùi xe, quay đầu xe', 'Bật đèn xi nhan khi chuyển làn'], ok: 1, why: 'Cấm lùi xe, quay đầu, đi ngược chiều trên cao tốc. Đi lố lối ra thì phải chạy tiếp tới lối ra kế.' },
  { q: 'Chạy 90 km/h trên đường khô ráo, khoảng cách an toàn tối thiểu với xe trước là bao nhiêu?', a: ['35 m', '55 m', '70 m'], ok: 2, why: 'Tốc độ trên 80 đến 100 km/h: giữ tối thiểu 70 m. Trời mưa, sương mù thì phải giữ xa hơn.' },
  { q: 'Chạy 120 km/h trên cao tốc khô ráo, khoảng cách an toàn tối thiểu là bao nhiêu?', a: ['70 m', '100 m', '50 m'], ok: 1, why: 'Tốc độ trên 100 đến 120 km/h: giữ tối thiểu 100 m.' },
  { q: 'Ai trên xe ô tô phải thắt dây an toàn?', a: ['Chỉ người lái', 'Người lái và người ngồi ghế trước', 'Người lái và mọi người ngồi ở chỗ có trang bị dây an toàn'], ok: 2, why: 'Người lái và người được chở phải thắt dây an toàn tại những vị trí có trang bị.' },
  { q: 'Đang lái xe, người lái có được cầm điện thoại để nghe gọi không?', a: ['Được nếu đường vắng', 'Không được dùng tay cầm và sử dụng điện thoại', 'Được nếu chạy chậm'], ok: 1, why: 'Cấm người lái dùng tay cầm và sử dụng điện thoại hoặc thiết bị điện tử khác khi xe đang chạy.' },
  { q: 'Nghe còi, thấy đèn của xe cứu thương đang làm nhiệm vụ phía sau, bạn làm gì?', a: ['Tăng tốc chạy trước', 'Giảm tốc, tránh hoặc dừng sát lề phải để nhường đường', 'Giữ nguyên làn'], ok: 1, why: 'Mọi xe phải nhanh chóng giảm tốc độ, tránh hoặc dừng lại sát lề phải để nhường đường cho xe ưu tiên.' },
  { q: 'Khi vào đường cao tốc, bạn phải làm gì?', a: ['Bật xi nhan, chạy trên làn tăng tốc, nhường xe đang chạy trên đường', 'Vào thẳng làn trong cùng', 'Dừng lại chờ ở đầu lối vào làn chính'], ok: 0, why: 'Phải có tín hiệu xin vào, nhường đường cho xe đang chạy trên cao tốc, và tăng tốc trên làn tăng tốc trước khi nhập làn.' },
  { q: 'Gặp đèn vàng khi chưa tới vạch dừng, bạn phải làm gì?', a: ['Tăng ga chạy qua', 'Dừng lại trước vạch dừng', 'Bấm còi rồi đi'], ok: 1, why: 'Đèn vàng phải dừng trước vạch dừng; chỉ khi đang đi trên vạch hoặc đã qua vạch thì được đi tiếp.' },
  { q: 'Thông thường, vượt xe khác phải vượt về bên nào?', a: ['Bên trái', 'Bên phải', 'Bên nào trống thì vượt'], ok: 0, why: 'Vượt xe phải vượt về bên trái, trừ vài trường hợp đặc biệt như xe phía trước đang rẽ trái.' },
  { q: 'Xe tải chở trái cây được chở tối đa bao nhiêu?', a: ['Chở được bao nhiêu thì chở', 'Không quá khối lượng hàng cho phép ghi trong giấy kiểm định', 'Gấp đôi tải trọng nếu đi đường ngắn'], ok: 1, why: 'Chở quá tải làm hỏng đường, phanh kém và bị phạt nặng. Hàng còn phải chằng buộc chắc, không để rơi vãi.' },
  { q: 'Giấy phép lái xe hạng B lái được loại xe tải nào?', a: ['Mọi xe tải', 'Xe tải có khối lượng toàn bộ theo thiết kế đến 3.500 kg', 'Xe đầu kéo'], ok: 1, why: 'Hạng B: ô tô tải đến 3.500 kg (tính cả xe và hàng). Trên 3.500 đến 7.500 kg cần hạng C1, nặng hơn cần hạng C, kéo rơ moóc cần CE.' },
  { q: 'Giấy phép lái xe có bao nhiêu điểm, và hết điểm thì sao?', a: ['12 điểm; bị trừ hết thì không được lái cho tới khi kiểm tra lại kiến thức', '10 điểm; hết điểm chỉ bị nhắc nhở', 'Không có điểm'], ok: 0, why: 'Từ năm 2025 mỗi giấy phép có 12 điểm. Vi phạm bị trừ điểm; hết điểm phải kiểm tra lại kiến thức pháp luật mới được lái tiếp.' },
  { q: 'Trời mưa to, sương mù làm tầm nhìn kém, bạn nên làm gì?', a: ['Chạy như bình thường', 'Giảm tốc độ, bật đèn, giữ khoảng cách xa hơn', 'Bám sát xe trước để dễ nhìn'], ok: 1, why: 'Đường trơn và tầm nhìn kém thì quãng đường phanh dài hơn nhiều: phải chạy chậm lại và giữ khoảng cách lớn hơn mức tối thiểu.' },
];
const PASS = 4, ASK = 5;

function Quiz({ title, onPass, onClose }: { title: string; onPass: (right: number) => void; onClose: () => void }) {
  const picks = useMemo(() => [...QUIZ.keys()].sort(() => Math.random() - 0.5).slice(0, ASK), []);
  const [i, setI] = useState(0), [right, setRight] = useState(0), [chosen, setChosen] = useState<number | null>(null);
  const done = i >= ASK, q = QUIZ[picks[Math.min(i, ASK - 1)]];
  return (
    <div className="quiz-wrap" role="dialog" aria-label={`Thi lý thuyết ${title}`}>
      <div className="quiz">
        <header><strong>📝 Thi lý thuyết · {title}</strong><button type="button" className="round" aria-label="Đóng" onClick={onClose}>×</button></header>
        {!done ? (
          <>
            <p className="quiz-step">Câu {i + 1}/{ASK} · đúng {right} · cần đúng {PASS} câu</p>
            <h3>{q.q}</h3>
            <div className="quiz-opts">
              {q.a.map((t, k) => (
                <button type="button" key={k} disabled={chosen !== null} className={chosen === null ? '' : k === q.ok ? 'ok' : k === chosen ? 'bad' : ''} onClick={() => { setChosen(k); if (k === q.ok) setRight((r) => r + 1); }}>{t}</button>
              ))}
            </div>
            {chosen !== null && <p className={`quiz-why ${chosen === q.ok ? 'ok' : 'bad'}`} role="status"><b>{chosen === q.ok ? 'Đúng. ' : 'Chưa đúng. '}</b>{q.why}</p>}
            {chosen !== null && <button type="button" className="go wide" onClick={() => { setChosen(null); setI(i + 1); }}>{i + 1 < ASK ? 'Câu tiếp' : 'Xem kết quả'}</button>}
          </>
        ) : right >= PASS ? (
          <>
            <h3>🎉 Đạt {right}/{ASK} câu</h3><p>Bạn đã qua phần lý thuyết của {title}.</p>
            <button type="button" className="go wide" onClick={() => onPass(right)}>Nộp bài</button>
          </>
        ) : (
          <>
            <h3>Chưa đạt: {right}/{ASK} câu</h3><p>Cần đúng ít nhất {PASS} câu. Đọc lại phần giải thích rồi thi lại nhé, thi lại không mất tiền.</p>
            <button type="button" className="go wide" onClick={onClose}>Để sau thi lại</button>
          </>
        )}
      </div>
    </div>);
}

// ---------------------------------------------------------------- bảng bãi xe
const GROUP_NAMES: Record<Group, string> = { xe_may: 'Xe máy, mô tô', ba_gac: 'Xe ba gác', ban_tai: 'Bán tải', tai_nhe: 'Tải nhẹ', tai_trung: 'Tải trung', tai_nang: 'Tải nặng', dau_keo: 'Đầu kéo container' };

function Specs({ v }: { v: CatalogRow }) {
  return (
    <dl className="veh-specs">
      {v.group === 'xe_may' && <div><dt>Động cơ</dt><dd>{v.cc ? `${v.cc} cm³` : `${v.kw ?? '?'} kW điện`}</dd></div>}
      <div><dt>Tải trọng</dt><dd>{kg(v.cargoKg)}</dd></div>
      <div><dt>{v.power === 'dien' ? 'Pin' : 'Bình'}</dt><dd>{num(v.tank)} {v.unit}</dd></div>
      <div><dt>Tiêu hao</dt><dd>{num(v.per100, 1)} {v.unit}/100 km</dd></div>
      <div><dt>Tầm hoạt động</dt><dd>~{num(v.rangeKm)} km</dd></div>
      <div><dt>Tiền {v.power === 'dien' ? 'điện' : v.power === 'dau' ? 'dầu' : 'xăng'}</dt><dd>{fmtMoney(perKm(v))}/km</dd></div>
      {v.group === 'xe_may' ? <div><dt>Đường đi</dt><dd>quốc lộ, ≤ {v.maxKmh} km/h</dd></div>
        : <div><dt>Cao tốc</dt><dd>{v.noHighway ? 'không được vào' : `tối đa ${v.maxKmh} km/h`}</dd></div>}
      {v.group !== 'xe_may' && <div><dt>Phí đường</dt><dd>nhóm {v.tollGroup}</dd></div>}
      <div><dt>Bằng lái</dt><dd>{v.licenseName}</dd></div>
    </dl>);
}

export function GaragePanel({ me, refresh }: { me: Me; refresh: () => void }): JSX.Element {
  const [data, setData] = useState<GarageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'daily' | 'bang' | 'phuot'>(() => { try { const t = sessionStorage.getItem('vv-garage-tab'); sessionStorage.removeItem('vv-garage-tab'); return t === 'phuot' || t === 'bang' ? t : 'daily'; } catch { return 'daily'; } });
  const [filter, setFilter] = useState<'tat_ca' | 'xe_may' | 'xang_dau' | 'dien' | 'lanh'>('tat_ca');
  const [open, setOpen] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<LicenseRow | null>(null);
  const [yard, setYard] = useState<{ l: LicenseRow; practice: boolean } | null>(null);
  const theoryExam = useRef<{ id: number | string | null; until: number }>({ id: null, until: 0 });
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => api<GarageData>('GET', '/api/vehicles').then((d) => { setData(d); setLoadError(null); }).catch((e) => setLoadError(e instanceof Error ? e.message : 'Không tải được bãi xe.')), []);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); refresh(); });
  const color = me.user.avatar?.truck ?? '#f08a6c';
  const YARD_CLASSES = ['A1', 'A', 'B', 'C1', 'C', 'CE'];
  /** Còn phải thi phần nào để nhận bằng (hoặc đổi bằng). */
  const needs = (l: LicenseRow) => {
    const hasYard = l.exam?.yard?.required ?? YARD_CLASSES.includes(l.cls);
    if (l.owned) { const r = l.renew; return { hasYard: hasYard && !!(r?.needYard ?? r?.mode === 'thi_lai'), theory: !!(r?.needTheory ?? (r && r.mode !== 'doi')) || (!!l.suspended && !l.exam?.theory?.passed), yard: !!(r?.needYard ?? r?.mode === 'thi_lai') }; }
    return { hasYard, theory: !l.exam?.theory?.passed, yard: hasYard && !l.exam?.yard?.passed };
  };
  const startTheory = async (l: LicenseRow) => {
    try { const r = await api<{ examId?: number | string; minSeconds?: number }>('POST', '/api/licenses/exam/start', { cls: l.cls, part: 'ly_thuyet' }); theoryExam.current = { id: r?.examId ?? null, until: Date.now() + (r?.minSeconds ?? 0) * 1000 }; setQuiz(l); refresh(); }
    catch (e) { setNote(e instanceof Error ? e.message : 'Chưa vào thi được.'); }
  };
  /** Bước cuối: nhận bằng mới hoặc đổi bằng. `quiet` = gọi ngay sau khi vừa đạt phần thi, còn thiếu phần khác thì chỉ nhắc. */
  const conclude = async (l: LicenseRow, quiet = false) => {
    const run = async () => {
      if (l.owned) { if (l.renew) { await api('POST', '/api/licenses/renew', { cls: l.cls }); setNote(`Đã đổi ${l.name}.`); } else setNote(`Đã phục hồi điểm cho ${l.name}.`); }
      else { await api('POST', '/api/licenses/buy', { cls: l.cls }); setNote(`Đã nhận ${l.name}. Giờ bạn lái được: ${l.covers.toLowerCase()}.`); }
    };
    if (quiet) { try { await run(); } catch (e) { setNote(e instanceof Error ? e.message : null); } void load(); refresh(); } else await act.run(run);
  };
  if (!data) return <div className="garage"><p className="hint">{loadError ?? 'Đang mở bãi xe…'}</p></div>;
  const byKind = Object.fromEntries(data.catalog.map((c) => [c.kind, c])) as Record<string, CatalogRow>;
  const active = data.owned.find((o) => o.active) ?? null, cur = active ? byKind[active.kind] : null;
  const list = data.catalog.filter((c) => (filter === 'tat_ca' ? true : filter === 'xe_may' ? c.group === 'xe_may' : filter === 'dien' ? c.power === 'dien' : filter === 'lanh' ? !!c.cold : c.power !== 'dien' && !c.cold && c.group !== 'xe_may'));
  const cmp = (v: CatalogRow) => {
    if (!cur || cur.kind === v.kind) return null;
    const dc = v.cargoKg - cur.cargoKg, dk = perKm(v) - perKm(cur);
    return `So với xe đang dùng: chở ${dc >= 0 ? 'hơn' : 'ít hơn'} ${kg(Math.abs(dc))}, tiền ${v.power === 'dien' ? 'điện' : 'nhiên liệu'} ${dk > 0 ? `đắt hơn ${fmtMoney(dk)}` : dk < 0 ? `rẻ hơn ${fmtMoney(-dk)}` : 'ngang nhau'} mỗi km${v.power === 'dien' && cur.power !== 'dien' ? ', nhưng phải dừng sạc khoảng 35 phút mỗi lần' : ''}.`;
  };
  return (
    <div className="garage">
      <p className="muted">Mua xe đúng với lượng hàng bạn chở: xe to chở nhiều nhưng tốn nhiên liệu, phí đường cao hơn và cần bằng lái hạng cao hơn. Xe máy rẻ, cực ít hao xăng, chở được một bao hàng nhỏ đi chợ phiên và đi phượt, nhưng không được vào cao tốc. Ai cũng mua được xe để chở hàng của mình đi bán; thu mua sỉ vẫn là việc của thương lái.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {note && <p className="veh-note" role="status">{note}</p>}
      <section className="veh-now">
        <h3>Xe đang dùng</h3>
        {active && cur ? (
          <div className="veh-card on">
            <div className="veh-head"><VehicleArt group={cur.group} color={color} electric={cur.power === 'dien'} cold={cur.cold} moto={cur.moto} /><div><strong>{cur.name}</strong><small>{cur.powerName} · đang có {num(active.energy, 1)}/{num(active.tank)} {active.unit} · đã chạy {num(active.odoKm)} km</small><small>Đang đỗ ở {REGIONS[active.regionId ?? '']?.name ?? 'nhà'}</small></div></div>
            <Specs v={cur} />
            <p className="veh-tip">{cur.note}</p>
          </div>
        ) : <p className="hint">Bạn chưa có xe. Chọn một chiếc ở đại lý bên dưới; nhớ thi bằng lái đúng hạng trước.</p>}
      </section>
      {data.owned.length > 1 && (
        <section>
          <h3>Xe trong bãi ({data.owned.length}/{data.maxOwned})</h3>
          {!data.atHome && <p className="hint">Xe đang ở xa nhà nên chưa đổi hoặc bán xe được.</p>}
          {data.owned.filter((o) => !o.active).map((o) => { const v = byKind[o.kind]; return (
            <div className="veh-row" key={o.id}>
              {v && <VehicleArt group={v.group} color={color} electric={v.power === 'dien'} cold={v.cold} size={96} moto={v.moto} />}
              <div className="grow"><strong>{o.name}</strong><small>{kg(o.cargoKg)} · {num(o.energy, 1)}/{num(o.tank)} {o.unit}</small></div>
              <div className="veh-acts">
                <button type="button" className="go" disabled={act.busy || !data.atHome} onClick={() => act.run(async () => { await api('POST', `/api/vehicles/${o.id}/activate`); setNote(`Đã chuyển sang lái ${o.name}.`); })}>Lái xe này</button>
                <button type="button" disabled={act.busy || !data.atHome} onClick={() => { if (confirm(`Bán ${o.name} lấy ${fmtMoney(o.resaleValue)}?`)) void act.run(async () => { await api('POST', `/api/vehicles/${o.id}/sell`); setNote(`Đã bán ${o.name}, nhận ${fmtMoney(o.resaleValue)}.`); }); }}>Bán {fmtMoney(o.resaleValue)}</button>
              </div>
            </div>); })}
        </section>
      )}
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'daily'} onClick={() => setTab('daily')}>Đại lý xe</button>
        <button type="button" role="tab" aria-selected={tab === 'bang'} onClick={() => setTab('bang')}>Bằng lái ({data.licenses.filter((l) => l.owned).length})</button>
        <button type="button" role="tab" aria-selected={tab === 'phuot'} onClick={() => setTab('phuot')}>🏍️ Đi phượt</button>
      </div>
      {tab === 'phuot' && <PhuotPanel me={me} refresh={() => { void load(); refresh(); }} openGarage={() => setTab('bang')} />}
      {tab === 'daily' && (
        <section className="veh-shop">
          <div className="veh-filter" role="group" aria-label="Lọc loại xe">
            {([['tat_ca', 'Tất cả'], ['xe_may', '🏍️ Xe máy'], ['xang_dau', 'Ô tô xăng, dầu'], ['dien', '⚡ Điện'], ['lanh', '❄ Thùng lạnh']] as const).map(([k, t]) => <button type="button" key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{t}</button>)}
          </div>
          {filter === 'dien' && <p className="veh-tip">Xe điện: tiền điện mỗi km rẻ hơn hẳn xăng dầu và phí bảo dưỡng thấp hơn, nhưng xe đắt hơn, tầm ngắn hơn và phải dừng sạc nhanh khoảng 35 phút ở trạm sạc hoặc trạm dừng nghỉ. Sạc ở nhà qua đêm rẻ nhất.</p>}
          {list.map((v) => { const isOpen = open === v.kind, c = cmp(v); return (
            <div className={`veh-card${v.owned ? ' owned' : ''}`} key={v.kind}>
              <button type="button" className="veh-head toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : v.kind)}>
                <VehicleArt group={v.group} color={color} electric={v.power === 'dien'} cold={v.cold} size={108} moto={v.moto} />
                <div><strong>{v.name}</strong><small>{GROUP_NAMES[v.group]} · {v.powerName} · chở {kg(v.cargoKg)}</small><small><b>{fmtMoney(v.price)}</b> · {v.licenseName}{v.minLevel > 1 ? ` · cấp ${v.minLevel}` : ''}{v.owned ? ` · đang có ${v.owned}` : ''}</small></div>
              </button>
              {isOpen && (
                <>
                  <Specs v={v} />
                  <p className="veh-tip">{v.note}</p>
                  {c && <p className="veh-cmp">{c}</p>}
                  <button type="button" className="go wide" disabled={act.busy || !v.canBuy} onClick={() => act.run(async () => { await api('POST', '/api/vehicles/buy', { kind: v.kind }); setNote(`Đã mua ${v.name}. Xe mới có nửa bình, đang đỗ ở nhà.`); })}>{v.canBuy ? `Mua ${fmtMoney(v.price)}` : v.why}</button>
                  {!v.canBuy && v.why?.startsWith('Cần bằng lái') && <button type="button" className="wide" onClick={() => setTab('bang')}>Sang mục Bằng lái để thi</button>}
                </>
              )}
            </div>); })}
        </section>
      )}
      {tab === 'bang' && (
        <section className="veh-lic">
          <p className="veh-tip">Muốn có bằng phải qua <b>thi lý thuyết</b> ({ASK} câu, đúng từ {PASS}) và <b>thi sa hình</b> (đạt từ 80/100 điểm): xe máy A1, A thi 4 bài (hình số 8, vạch đường thẳng, vạch cản, đường gồ ghề); ô tô thi 11 bài trong sân sát hạch. Bằng ô tô có thời hạn; hết hạn phải đổi hoặc thi lại. Bị phạt khi lái xe sẽ trừ điểm bằng lái.</p>
          {data.licenses.map((l) => {
            const need = needs(l), holding = l.owned, bad = l.expired || l.suspended;
            return (
              <div className={`lic${l.owned ? ' owned' : l.covered ? ' covered' : ''}${bad ? ' bad' : ''}`} key={l.cls} data-cls={l.cls}>
                <span className="lic-badge" aria-hidden="true">{l.cls}</span>
                <div className="grow">
                  <strong>{l.name}</strong><small>{l.covers}</small>
                  {holding ? (
                    <div className="lic-card">
                      <span>Cấp ngày <b>{dmy(l.issuedAt)}</b></span>
                      <span>{l.expiresAt ? <>Có giá trị đến <b>{dmy(l.expiresAt)}</b>{l.daysLeft != null && !l.expired ? ` (còn ${l.daysLeft} ngày)` : ''}</> : 'Không thời hạn'}</span>
                      {l.points != null && <span>Điểm: <b>{l.points}/{l.maxPoints ?? 12}</b></span>}
                      {l.suspended && <span className="lic-warn">Bằng đang bị khoá vì hết điểm: thi lại lý thuyết để phục hồi</span>}
                      {l.expired && <span className="lic-warn">Bằng đã hết hạn: chưa lái được xe hạng này</span>}
                    </div>
                  ) : <small>{l.covered ? 'Đã được bằng hạng cao hơn bao gồm' : `Lệ phí cấp bằng ${fmtMoney(l.price)}${l.minLevel > 1 ? ` · cần cấp ${l.minLevel}` : ''}`}</small>}
                  {(!l.covered || holding) && (!holding || l.renew || l.suspended) && (
                    <ol className="lic-steps">
                      <li className={need.theory ? '' : 'done'}>{need.theory ? '1' : '✓'} Lý thuyết{l.exam?.theory?.best != null ? ` · cao nhất ${l.exam.theory.best}` : ''}</li>
                      {need.hasYard && <li className={need.yard ? '' : 'done'}>{need.yard ? '2' : '✓'} Sa hình{l.exam?.yard?.best != null ? ` · cao nhất ${l.exam.yard.best}/100` : ''}</li>}
                      <li>{holding ? (l.renew?.mode === 'doi' ? 'Đổi bằng' : 'Cấp lại bằng') : 'Nhận bằng'}</li>
                    </ol>
                  )}
                  <div className="lic-acts">
                    {!l.covered && !holding && !l.canBuy && l.why && <span className="tag">{l.why}</span>}
                    {(holding ? !!l.renew || l.suspended : !l.covered && l.canBuy) && (
                      need.theory ? <button type="button" className="go" disabled={act.busy} onClick={() => void startTheory(l)}>📝 Thi lý thuyết{l.exam?.theory?.fee ? <small>lệ phí {fmtMoney(l.exam.theory.fee)}</small> : null}</button>
                      : need.yard ? <button type="button" className="go" disabled={act.busy} onClick={() => setYard({ l, practice: false })}>🏁 Vào sân thi{l.exam?.yard?.fee ? <small>lệ phí {fmtMoney(l.exam.yard.fee)}</small> : null}</button>
                      : <button type="button" className="go" disabled={act.busy} onClick={() => void conclude(l)}>{holding ? `Đổi bằng${l.renew?.fee ? ` · ${fmtMoney(l.renew.fee)}` : ''}` : `Nhận bằng · ${fmtMoney(l.price)}`}</button>
                    )}
                    {need.hasYard && <button type="button" className="lic-practice" onClick={() => setYard({ l, practice: true })}>🎓 Tập lái sa hình</button>}
                    {(l.owned || l.covered) && !bad && !l.renew && <span className="tag">✓ Đang có hiệu lực</span>}
                  </div>
                </div>
              </div>);
          })}
        </section>
      )}
      {quiz && <Quiz title={quiz.name} onClose={() => setQuiz(null)} onPass={(right) => { const l = quiz; setQuiz(null); void act.run(async () => {
        const wait = theoryExam.current.until - Date.now(); if (wait > 0) await new Promise((r) => window.setTimeout(r, wait + 200));
        await api('POST', '/api/licenses/exam', { cls: l.cls, part: 'ly_thuyet', score: right * 20, examId: theoryExam.current.id });
        const n = needs(l); if (n.hasYard && n.yard) setNote(`Đã đạt lý thuyết ${l.name}. Bước tiếp: vào sân thi sa hình.`); else await conclude({ ...l, exam: { ...l.exam, theory: { ...l.exam?.theory, passed: true } } }, true);
      }); }} />}
      {yard && (yard.l.cls === 'A1' || yard.l.cls === 'A') && <MotoExam cls={yard.l.cls} title={yard.l.name} fee={yard.l.exam?.yard?.fee} practiceOnly={yard.practice} onClose={(r) => { const l = yard.l; setYard(null); void load(); if (r?.passed) void act.run(async () => { await conclude({ ...l, exam: { ...l.exam, yard: { ...l.exam?.yard, passed: true } } }, true); }); else if (r) setNote(`Chưa đạt phần sa hình ${l.name}${r.out ? ` (truất quyền: ${r.out})` : ` (${r.score}/100 điểm)`}. Hãy tập thêm rồi thi lại.`); }} />}
      {yard && yard.l.cls !== 'A1' && yard.l.cls !== 'A' && <ExamGame cls={yard.l.cls} title={yard.l.name} fee={yard.l.exam?.yard?.fee} practiceOnly={yard.practice} onClose={(r) => { const l = yard.l; setYard(null); void load(); if (r?.passed) void act.run(async () => { await conclude({ ...l, exam: { ...l.exam, yard: { ...l.exam?.yard, passed: true } } }, true); }); else if (r) setNote(`Chưa đạt phần sa hình ${l.name}${r.out ? ` (truất quyền: ${r.out})` : ` (${r.score}/100 điểm)`}. Hãy tập thêm rồi thi lại.`); }} />}
    </div>);
}
