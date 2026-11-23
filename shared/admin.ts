// Trung tâm phục vụ hành chính công: sổ đất độc bản, chuyển nhượng qua công chứng – đăng ký – thuế, thuế hộ kinh doanh theo quý,
// giấy phép xây dựng, bốc số thứ tự. Dùng chung cho máy chủ (server/src/admin.ts) và giao diện (web/src/admin/**).
//
// NGUỒN (tra 24/11/2026; mục nào ghi "ước tính" là chưa đối chiếu được văn bản gốc):
// - Phí công chứng hợp đồng chuyển nhượng quyền sử dụng đất tính theo giá trị: Thông tư 257/2016/TT-BTC, sửa đổi bởi
//   Thông tư 111/2017/TT-BTC (thuvienphapluat.vn). Bậc dưới 50 triệu: 50.000đ; 100 triệu – 1 tỷ: 0,1%; trên 100 tỷ: 32,2 triệu + 0,02%,
//   tối đa 70 triệu — đã thấy trong bảng trích dẫn. Các bậc giữa (1–100 tỷ) theo bảng phổ biến của thông tư, chưa đối chiếu từng dòng.
//   Giá trị tính phí không thấp hơn giá đất nhà nước (bảng giá đất tỉnh).
// - Thù lao soạn thảo hợp đồng: do tổ chức công chứng thu, trần do UBND tỉnh quy định — ƯỚC TÍNH 800.000đ.
// - Đăng ký biến động khi chuyển nhượng: không quá 10 ngày làm việc, không tính thời gian thực hiện nghĩa vụ tài chính
//   (Điều 22 Nghị định 101/2024/NĐ-CP; luatvietnam.vn, thuvienphapluat.vn). NĐ 151/2025 có thể rút ngắn một số thủ tục — chưa xác minh.
// - Thuế TNCN chuyển nhượng 2% (bên bán), lệ phí trước bạ 0,5% (bên mua): shared/realPrices.ts.
// - Giấy chứng nhận mẫu mới (Thông tư 10/2024/TT-BTNMT, áp dụng từ 01/8/2024): có mã QR, mã giấy chứng nhận; số phát hành (số seri)
//   gồm 02 chữ cái tiếng Việt và 08 chữ số (baomoi.com dẫn quy định).
// - Hộ kinh doanh: bỏ thuế khoán từ 01/01/2026, tự kê khai theo doanh thu thực tế, kỳ kê khai theo quý (Nghị quyết 198/2025/QH15,
//   Nghị định 68/2026/NĐ-CP). Ngưỡng doanh thu không chịu thuế GTGT, TNCN: 1 tỷ đồng/năm theo Nghị định 141/2026/NĐ-CP (báo chí dẫn,
//   chưa thấy văn bản gốc). Tỉ lệ trên doanh thu: phân phối hàng hoá GTGT 1% + TNCN 0,5%; sản xuất, chế biến GTGT 3% + TNCN 1,5%
//   (tỉ lệ của Thông tư 40/2021/TT-BTC; với mốc mới chỉ thấy ví dụ 1% + 0,5% cho phân phối). Cá nhân tự trồng trọt bán sản phẩm
//   chưa qua chế biến: không chịu thuế GTGT, không tính TNCN. Tiền chậm nộp 0,03%/ngày (Luật Quản lý thuế 2019, Điều 59).
// - Lệ phí cấp giấy phép xây dựng do HĐND tỉnh quy định: phổ biến 75.000đ nhà ở riêng lẻ, 150.000đ công trình khác; nhiều tỉnh 0đ
//   khi nộp trực tuyến (thuviennhadat.vn). Thời hạn cấp phép công trình 20 ngày, nhà ở riêng lẻ 15 ngày (Luật Xây dựng; ghi theo trí nhớ, cần rà).
//
// VÌ SAO KHÔNG DÙNG TIỀN MÃ HOÁ / NFT để làm đất "độc bản": tài sản số, tiền mã hoá ở Việt Nam mới được thí điểm có kiểm soát; dùng NFT
// gắn với tài sản trong game có thể bị xem là phát hành tài sản số/huy động vốn trái phép và kéo theo nghĩa vụ pháp lý cho nhà phát hành.
// Thay vào đó máy chủ giữ SỔ BIẾN ĐỘNG dạng chuỗi băm: mỗi bản ghi chứa mã băm của bản ghi trước, sửa hay xoá một dòng là cả chuỗi
// phía sau lệch mã — ai cũng tra và kiểm được ở Quầy đăng ký đất đai.

import { LICENSE_YEAR_MS } from './vehicles.ts';

// ---------------------------------------------------------------- lịch hành chính trong game
/** Một năm hành chính = một "năm bằng lái" (cùng lịch với hạn bằng lái). */
export const ADMIN_YEAR_MS = LICENSE_YEAR_MS;
export const ADMIN_DAY_MS = ADMIN_YEAR_MS / 365;
export const ADMIN_QUARTER_MS = ADMIN_YEAR_MS / 4;
/** Số ngày làm việc → ms thật (5 ngày làm việc = 7 ngày lịch), chia cho TIME_SCALE của máy chủ. */
export const workDaysMs = (days: number, timeScale = 1): number => Math.max(1000, Math.round((days * 7 / 5) * ADMIN_DAY_MS / timeScale));
export const calDaysMs = (days: number, timeScale = 1): number => Math.max(1000, Math.round(days * ADMIN_DAY_MS / timeScale));

export const REGISTER_WORKDAYS = 10;      // đăng ký biến động
export const TAX_NOTICE_WORKDAYS = 3;     // cơ quan thuế xác định nghĩa vụ, ra thông báo (ƯỚC TÍNH)
export const TAX_PAY_DAYS = 30;           // hạn nộp theo thông báo
export const PERMIT_DAYS = 20;            // cấp giấy phép xây dựng công trình
export const NOTARY_APPOINT_DAYS = 30;    // hẹn công chứng quá hạn thì tự huỷ

// ---------------------------------------------------------------- phí công chứng
/** Phí công chứng hợp đồng chuyển nhượng quyền sử dụng đất theo giá trị (TT 257/2016, sửa đổi TT 111/2017). */
export function notaryFee(value: number): number {
  const v = Math.max(0, value);
  let f: number;
  if (v < 50e6) f = 50_000;
  else if (v <= 100e6) f = 100_000;
  else if (v <= 1e9) f = v * 0.001;
  else if (v <= 3e9) f = 1e6 + (v - 1e9) * 0.0006;
  else if (v <= 5e9) f = 2.2e6 + (v - 3e9) * 0.0005;
  else if (v <= 10e9) f = 3.2e6 + (v - 5e9) * 0.0004;
  else if (v <= 100e9) f = 5.2e6 + (v - 10e9) * 0.0003;
  else f = 32.2e6 + (v - 100e9) * 0.0002;
  return Math.round(Math.min(70e6, f));
}
export const NOTARY_DRAFT_FEE = 800_000;
export const PERMIT_FEE = 150_000;

// ---------------------------------------------------------------- số sổ, mã thửa
/** 02 chữ cái tiếng Việt in hoa (bỏ chữ dễ nhầm) + 08 chữ số. */
export const SERIAL_LETTERS = ['A', 'B', 'C', 'D', 'Đ', 'E', 'G', 'H', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Y'];
export const SERIAL_RE = /^[A-ZĐ]{2} \d{8}$/u;
export function makeSerial(rand: () => number): string {
  const L = () => SERIAL_LETTERS[Math.floor(rand() * SERIAL_LETTERS.length)];
  let d = ''; for (let i = 0; i < 8; i++) d += String(Math.floor(rand() * 10));
  return `${L()}${L()} ${d}`;
}
/** Mã thửa: <mã tỉnh>.<tờ bản đồ 4 số>.<số thửa 4 số> — tờ bản đồ chứa tối đa 250 thửa, đánh số theo thứ tự cấp lần đầu trong tỉnh. */
export const PARCELS_PER_SHEET = 250;
export function parcelOf(seq: number): { sheet: number; parcel: number } { return { sheet: 1 + Math.floor(seq / PARCELS_PER_SHEET), parcel: 1 + (seq % PARCELS_PER_SHEET) }; }
export const parcelCode = (provCode: string, sheet: number, parcel: number): string => `${provCode}.${String(sheet).padStart(4, '0')}.${String(parcel).padStart(4, '0')}`;

// ---------------------------------------------------------------- sổ biến động (chuỗi băm)
export type LedgerKind = 'cap_lan_dau' | 'chuyen_nhuong' | 'thu_hoi' | 'cap_doi';
export const LEDGER_NAMES: Record<LedgerKind, string> = {
  cap_lan_dau: 'Cấp giấy chứng nhận lần đầu', chuyen_nhuong: 'Đăng ký biến động: chuyển nhượng', thu_hoi: 'Trả lại đất cho Nhà nước, thu hồi giấy chứng nhận', cap_doi: 'Cấp đổi giấy chứng nhận',
};
/** Chuỗi chuẩn để băm một bản ghi: thứ tự khoá cố định, không phụ thuộc cách lưu JSON. */
export function ledgerPayload(r: { prev: string; lotId: number; kind: string; at: number; data: Record<string, unknown> }): string {
  const keys = Object.keys(r.data).sort();
  return [r.prev, r.lotId, r.kind, r.at, keys.map((k) => `${k}=${JSON.stringify(r.data[k])}`).join('&')].join('|');
}
export const GENESIS_HASH = '0'.repeat(64);

// ---------------------------------------------------------------- chuyển nhượng
export type DealStatus = 'de_nghi' | 'hen_cong_chung' | 'da_cong_chung' | 'dang_xu_ly' | 'cho_nop_thue' | 'cho_tra_ket_qua' | 'hoan_tat' | 'da_huy';
export const DEAL_STEPS: { status: DealStatus; name: string; where: string; who: string }[] = [
  { status: 'de_nghi', name: 'Thoả thuận giá', where: 'Sổ địa chính', who: 'Bên bán đồng ý hoặc từ chối giá bên mua trả' },
  { status: 'hen_cong_chung', name: 'Ký hợp đồng công chứng', where: 'Quầy 1 · Văn phòng công chứng', who: 'Cả hai bên cùng có mặt và ký' },
  { status: 'da_cong_chung', name: 'Nộp hồ sơ đăng ký biến động', where: 'Quầy 2 · Văn phòng đăng ký đất đai', who: 'Một trong hai bên nộp' },
  { status: 'dang_xu_ly', name: 'Cơ quan thuế xác định nghĩa vụ tài chính', where: 'Chi cục thuế', who: 'Chờ thông báo thuế' },
  { status: 'cho_nop_thue', name: 'Nộp thuế, lệ phí', where: 'Quầy 3 · Chi cục thuế', who: 'Bên bán nộp thuế TNCN 2%, bên mua nộp lệ phí trước bạ 0,5% và lệ phí cấp sổ' },
  { status: 'cho_tra_ket_qua', name: 'Chỉnh lý hồ sơ, in giấy chứng nhận mới', where: 'Văn phòng đăng ký đất đai', who: 'Chờ trả kết quả' },
  { status: 'hoan_tat', name: 'Nhận giấy chứng nhận mới', where: 'Quầy 2 · Trả kết quả', who: 'Bên mua nhận sổ, tiền chuyển cho bên bán' },
];
export const DEAL_NAMES: Record<DealStatus, string> = {
  de_nghi: 'Chờ bên bán đồng ý giá', hen_cong_chung: 'Hẹn ký công chứng', da_cong_chung: 'Đã công chứng, chờ nộp hồ sơ', dang_xu_ly: 'Đang xác định nghĩa vụ thuế',
  cho_nop_thue: 'Chờ nộp thuế, lệ phí', cho_tra_ket_qua: 'Đang chỉnh lý, in sổ mới', hoan_tat: 'Đã sang tên', da_huy: 'Đã huỷ',
};
export const ACTIVE_DEAL: DealStatus[] = ['de_nghi', 'hen_cong_chung', 'da_cong_chung', 'dang_xu_ly', 'cho_nop_thue', 'cho_tra_ket_qua'];
/** Có mặt ở trung tâm hành chính: nhịp hiện diện gần nhất trong khoảng này. */
export const PRESENT_MS = 30_000;

// ---------------------------------------------------------------- thuế hộ kinh doanh
export const HKD_FREE_PER_YEAR = 1_000_000_000;
export type TaxGroup = 'mien' | 'phan_phoi' | 'san_xuat';
export const TAX_RATE: Record<TaxGroup, { gtgt: number; tncn: number; name: string }> = {
  mien: { gtgt: 0, tncn: 0, name: 'Tự trồng trọt bán sản phẩm chưa chế biến: không chịu thuế' },
  phan_phoi: { gtgt: 0.01, tncn: 0.005, name: 'Phân phối, cung cấp hàng hoá: GTGT 1% + TNCN 0,5% trên doanh thu vượt ngưỡng' },
  san_xuat: { gtgt: 0.03, tncn: 0.015, name: 'Sản xuất, chế biến: GTGT 3% + TNCN 1,5% trên doanh thu vượt ngưỡng' },
};
export const taxGroupOf = (role: string | null): TaxGroup => role === 'thuong_lai' ? 'phan_phoi' : role === 'xuong' ? 'san_xuat' : 'mien';
/** Lý do ghi sổ tiền được tính là doanh thu bán hàng (khoản cộng tiền). */
export const SALE_REASONS = ['ban_cho', 'ban_thuong_lai', 'ban_che_bien', 'ban_thao', 'xuat_khau', 'don_hang', 'hop_dong', 'sieu_thi_ban', 'doanh_thu', 'khach_vang_lai', 'gop_don'];
/** Thuế quý chỉ tính từ mốc này (ngày ra mắt Trung tâm hành chính công), các quý trước không phải kê khai. */
export const TAX_EPOCH = Date.UTC(2026, 10, 23);
export const LATE_RATE_PER_DAY = 0.0003;
export const quarterIndex = (ms: number): number => Math.floor(ms / ADMIN_QUARTER_MS);
export const quarterStart = (qi: number): number => qi * ADMIN_QUARTER_MS;
/** Hạn nộp tờ khai và tiền thuế quý: ngày cuối của tháng đầu quý sau (≈ 30 ngày sau khi hết quý). */
export const quarterDeadline = (qi: number): number => quarterStart(qi + 1) + 30 * ADMIN_DAY_MS;
/** Năm hành chính đầu tiên của game được gọi là năm 2026 (mốc 24/11/2026), các năm sau đếm tiếp. */
const YEAR0 = Math.floor(Date.UTC(2026, 10, 24) / ADMIN_YEAR_MS);
export function quarterName(qi: number): string { return `Quý ${(qi % 4) + 1}/${2026 + Math.floor(qi / 4) - YEAR0}`; }
/** Thuế của một quý theo doanh thu cộng dồn trong năm (ngưỡng tính trên cả năm). */
export function quarterTax(group: TaxGroup, cumBefore: number, revenue: number): { taxable: number; gtgt: number; tncn: number; total: number } {
  const r = TAX_RATE[group], taxable = Math.max(0, cumBefore + revenue - HKD_FREE_PER_YEAR) - Math.max(0, cumBefore - HKD_FREE_PER_YEAR);
  const gtgt = Math.round(taxable * r.gtgt), tncn = Math.round(taxable * r.tncn);
  return { taxable, gtgt, tncn, total: gtgt + tncn };
}

// ---------------------------------------------------------------- quầy
export type CounterId = 'cong_chung' | 'dat_dai' | 'thue' | 'xay_dung' | 'htx' | 'bang_lai';
export interface CounterInfo { id: CounterId; no: number; name: string; short: string; emoji: string; desc: string }
export const COUNTERS: CounterInfo[] = [
  { id: 'cong_chung', no: 1, name: 'Văn phòng công chứng', short: 'Công chứng', emoji: '🖋️', desc: 'Ký hợp đồng chuyển nhượng quyền sử dụng đất (hai bên cùng có mặt).' },
  { id: 'dat_dai', no: 2, name: 'Văn phòng đăng ký đất đai', short: 'Đất đai', emoji: '🗺️', desc: 'Nộp hồ sơ đăng ký biến động, nhận giấy chứng nhận, tra cứu thửa đất.' },
  { id: 'thue', no: 3, name: 'Chi cục thuế', short: 'Thuế', emoji: '🧾', desc: 'Nộp thuế chuyển nhượng, lệ phí trước bạ, kê khai thuế hộ kinh doanh theo quý.' },
  { id: 'xay_dung', no: 4, name: 'Phòng quản lý đô thị', short: 'Xây dựng', emoji: '🏗️', desc: 'Cấp giấy phép xây dựng cửa hàng, siêu thị, nhà xưởng.' },
  { id: 'htx', no: 5, name: 'Đăng ký hợp tác xã', short: 'Hợp tác xã', emoji: '🤝', desc: 'Đăng ký thành lập, thay đổi hợp tác xã.' },
  { id: 'bang_lai', no: 6, name: 'Cấp, đổi giấy phép lái xe', short: 'Bằng lái', emoji: '🪪', desc: 'Thi, đổi, cấp lại giấy phép lái xe.' },
];
export const counterOf = (id: string): CounterInfo | undefined => COUNTERS.find((c) => c.id === id);
/** Số thứ tự: chữ số đầu là số quầy, ba số sau đếm trong ngày. */
export const ticketLabel = (counterNo: number, seq: number): string => `${counterNo}${String(seq % 1000).padStart(3, '0')}`;
/** Thời gian chờ gọi số (ms thật): mỗi người phía trước vài giây. */
export const ticketWaitMs = (ahead: number): number => 3_000 + ahead * 4_000;
