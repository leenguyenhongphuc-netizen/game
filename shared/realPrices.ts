// Giá tham chiếu đời thực của Việt Nam. Mọi con số nhiên liệu, điện, phí đường, lương, thuế đất trong game lấy từ đây.
// Không import module game nào khác ở đây (rules.ts, vehicles.ts dùng file này).
//
// Cách cập nhật: sửa REF_PRICES (đổi `value`, `since`, `source`) — máy chủ ghi bảng này vào `ref_prices` khi khởi động
// và trả ở `/api/ref-prices` (`/api/prices` là giá đặc sản). Một tác vụ tuỳ chọn có thể ghi giá mới vào `ref_prices` (bản ghi mới thắng bản tĩnh).
// Số liệu tra ngày 23/11/2026 từ báo chí dẫn văn bản chính thức; khi khác nhau giữa các nguồn, lấy theo văn bản/kỳ điều hành gần nhất.

export type RefPriceKey =
  | 'xang_e10_ron95' | 'xang_e5_ron92' | 'dau_do_005s' | 'dau_do_0001s'
  | 'dien_bac1' | 'dien_bac2' | 'dien_bac3' | 'dien_bac4' | 'dien_bac5' | 'dien_vat'
  | 'sac_cong_cong' | 'sac_dc_nhanh'
  | 'phi_cao_toc_nhom1' | 'phi_cao_toc_bot'
  | 'luong_vung1' | 'luong_vung2' | 'luong_vung3' | 'luong_vung4'
  | 'le_phi_truoc_ba' | 'thue_tncn_chuyen_nhuong'
  | 'taxi_mo_cua' | 'taxi_km_2_25' | 'taxi_km_26' | 'xe_trung_chuyen_km'
  | 'xe_khach_mo_ve' | 'xe_khach_km_ngan' | 'xe_khach_km_dai'
  | 'tau_mo_ve' | 'tau_ghe_mem_km' | 'may_bay_co_ban' | 'may_bay_km' | 'tau_cao_toc_mo_ve' | 'tau_cao_toc_km';

export interface RefPrice { key: RefPriceKey; name: string; value: number; unit: string; since: string; source: string; note?: string }

export const REF_PRICES: Record<RefPriceKey, RefPrice> = {
  // Kỳ điều hành 19/11/2026 (Liên Bộ Công Thương – Tài chính), giá Petrolimex vùng 1.
  xang_e10_ron95: { key: 'xang_e10_ron95', name: 'Xăng E10 RON95-III', value: 19_100, unit: 'đ/lít', since: '2026-11-19', source: 'Bảng giá Petrolimex vùng 1 (baomoi.com, techz.vn 23/11/2026)' },
  xang_e5_ron92: { key: 'xang_e5_ron92', name: 'Xăng E5 RON92-II', value: 18_570, unit: 'đ/lít', since: '2026-11-19', source: 'Bảng giá Petrolimex vùng 1 (baomoi.com, techz.vn 23/11/2026)' },
  dau_do_005s: { key: 'dau_do_005s', name: 'Dầu DO 0,05S-II', value: 26_340, unit: 'đ/lít', since: '2026-11-19', source: 'Bảng giá Petrolimex vùng 1 (baolaocai.vn 20/11/2026)' },
  dau_do_0001s: { key: 'dau_do_0001s', name: 'Dầu DO 0,001S-V', value: 28_140, unit: 'đ/lít', since: '2026-11-19', source: 'Bảng giá Petrolimex vùng 1 (baolaocai.vn 20/11/2026)' },
  // Biểu giá điện sinh hoạt 5 bậc, QĐ 2892/QĐ-BCT ngày 31/10/2026, hiệu lực 1/11/2026, giá chưa VAT.
  dien_bac1: { key: 'dien_bac1', name: 'Điện sinh hoạt bậc 1 (0–100 kWh)', value: 1_901, unit: 'đ/kWh', since: '2026-11-01', source: 'QĐ 2892/QĐ-BCT (nhandan.vn, baophapluat.vn)' },
  dien_bac2: { key: 'dien_bac2', name: 'Điện sinh hoạt bậc 2 (101–200 kWh)', value: 2_289, unit: 'đ/kWh', since: '2026-11-01', source: 'QĐ 2892/QĐ-BCT (nhandan.vn)' },
  dien_bac3: { key: 'dien_bac3', name: 'Điện sinh hoạt bậc 3 (201–400 kWh)', value: 2_894, unit: 'đ/kWh', since: '2026-11-01', source: 'QĐ 2892/QĐ-BCT (nhandan.vn)' },
  dien_bac4: { key: 'dien_bac4', name: 'Điện sinh hoạt bậc 4 (401–700 kWh)', value: 3_456, unit: 'đ/kWh', since: '2026-11-01', source: 'QĐ 2892/QĐ-BCT (nhandan.vn)' },
  dien_bac5: { key: 'dien_bac5', name: 'Điện sinh hoạt bậc 5 (trên 700 kWh)', value: 3_844, unit: 'đ/kWh', since: '2026-11-01', source: 'QĐ 2892/QĐ-BCT (baophapluat.vn: "cao nhất 3.844 đồng/kWh")' },
  dien_vat: { key: 'dien_vat', name: 'Thuế GTGT tiền điện', value: 0.08, unit: 'tỉ lệ', since: '2026-01-01', source: 'Mức giảm 2% thuế GTGT (10% → 8%) đang áp dụng', note: 'Cần kiểm lại khi hết thời hạn giảm thuế.' },
  // Sạc xe điện công cộng.
  sac_cong_cong: { key: 'sac_cong_cong', name: 'Sạc xe điện V-GREEN (bình quân)', value: 3_858, unit: 'đ/kWh', since: '2026-07-22', source: 'Tuổi Trẻ News 22/7/2026: V-Green giữ mức 3.858 đ/kWh' },
  sac_dc_nhanh: { key: 'sac_dc_nhanh', name: 'Sạc nhanh DC trạm độc lập (180 kW)', value: 8_000, unit: 'đ/kWh', since: '2026-07-22', source: 'Tuổi Trẻ: Charge+ 6.000 đ/kWh AC 22 kW, 8.000 đ/kWh DC 180 kW', note: 'Trạm ngoài hệ thống hãng xe.' },
  // Phí cao tốc do Nhà nước đầu tư: 900–1.300 đ/km nhóm 1; nhóm 2 ×1,5, nhóm 3 ×2, nhóm 4 ×3, nhóm 5 ×4. BOT bình quân 1.721 đ/km.
  phi_cao_toc_nhom1: { key: 'phi_cao_toc_nhom1', name: 'Phí cao tốc Nhà nước đầu tư, nhóm 1 (mức 1)', value: 1_300, unit: 'đ/km', since: '2026-03-02', source: '5 tuyến cao tốc Bắc – Nam (plo.vn, nguoiquansat.vn); mức 2 là 900 đ/km' },
  phi_cao_toc_bot: { key: 'phi_cao_toc_bot', name: 'Phí cao tốc BOT bình quân, xe con', value: 1_721, unit: 'đ/km', since: '2026-03-02', source: 'Bộ Xây dựng (lsvn.vn) — bình quân các tuyến BOT' },
  // Lương tối thiểu vùng 2026 (NĐ 293/2025/NĐ-CP). Từ 1/1/2027 theo NĐ 399/2026/NĐ-CP: 5,70/5,08/4,45/4,04 triệu.
  luong_vung1: { key: 'luong_vung1', name: 'Lương tối thiểu vùng I', value: 5_310_000, unit: 'đ/tháng', since: '2026-01-01', source: 'NĐ 293/2025/NĐ-CP (thuvienphapluat.vn)' },
  luong_vung2: { key: 'luong_vung2', name: 'Lương tối thiểu vùng II', value: 4_730_000, unit: 'đ/tháng', since: '2026-01-01', source: 'NĐ 293/2025/NĐ-CP' },
  luong_vung3: { key: 'luong_vung3', name: 'Lương tối thiểu vùng III', value: 4_140_000, unit: 'đ/tháng', since: '2026-01-01', source: 'NĐ 293/2025/NĐ-CP' },
  luong_vung4: { key: 'luong_vung4', name: 'Lương tối thiểu vùng IV', value: 3_700_000, unit: 'đ/tháng', since: '2026-01-01', source: 'NĐ 293/2025/NĐ-CP' },
  // Thuế, phí đất đai khi sang tên.
  le_phi_truoc_ba: { key: 'le_phi_truoc_ba', name: 'Lệ phí trước bạ nhà đất', value: 0.005, unit: 'tỉ lệ', since: '2022-03-01', source: 'NĐ 10/2022/NĐ-CP: 0,5%, tối đa 500 triệu/tài sản/lần' },
  thue_tncn_chuyen_nhuong: { key: 'thue_tncn_chuyen_nhuong', name: 'Thuế TNCN chuyển nhượng bất động sản', value: 0.02, unit: 'tỉ lệ', since: '2026-01-01', source: '2% giá chuyển nhượng (thuvienphapluat.vn, dnse.com.vn)' },
  // Giao thông công cộng (tra ngày 24/11/2026). Giá vé thay đổi theo ngày và hãng; lấy mức phổ biến hạng thường.
  taxi_mo_cua: { key: 'taxi_mo_cua', name: 'Taxi xe 4 chỗ: giá mở cửa (km đầu)', value: 20_000, unit: 'đ', since: '2025-01-01', source: 'Bảng giá taxi điện 4–5 chỗ (greensm.com, viettelstore.vn 2025): mở cửa 20.000đ km đầu' },
  taxi_km_2_25: { key: 'taxi_km_2_25', name: 'Taxi xe 4 chỗ: km 2–25', value: 15_500, unit: 'đ/km', since: '2025-01-01', source: 'greensm.com, viettelstore.vn: 14.000–16.000 đ/km' },
  taxi_km_26: { key: 'taxi_km_26', name: 'Taxi xe 4 chỗ: từ km 26', value: 13_500, unit: 'đ/km', since: '2025-01-01', source: 'greensm.com, viettelstore.vn: 12.000–15.500 đ/km' },
  xe_trung_chuyen_km: { key: 'xe_trung_chuyen_km', name: 'Xe buýt/xe trung chuyển ra ga, sân bay', value: 1_200, unit: 'đ/km', since: '2026-01-01', source: 'Ước tính theo giá xe khách chặng ngắn (vé 20.000đ + ~1.200 đ/km)', note: 'Ước tính, chưa có bảng giá chung.' },
  xe_khach_mo_ve: { key: 'xe_khach_mo_ve', name: 'Xe khách giường nằm: phần cố định mỗi vé', value: 100_000, unit: 'đ', since: '2026-10-24', source: 'Hiệu chỉnh theo vé Sài Gòn – Đà Lạt từ 375.000–400.000đ (vietnamtourism.com 24/10/2026, mia.vn)' },
  xe_khach_km_ngan: { key: 'xe_khach_km_ngan', name: 'Xe khách giường nằm: 500 km đầu', value: 800, unit: 'đ/km', since: '2026-10-24', source: 'Sài Gòn – Đà Lạt ~300 km đường bộ ≈ 340.000đ (vietnamtourism.com)' },
  xe_khach_km_dai: { key: 'xe_khach_km_dai', name: 'Xe khách giường nằm: từ km 501', value: 500, unit: 'đ/km', since: '2026-10-24', source: 'Đà Nẵng – Hà Nội 18–57 USD (12go.asia); Hà Nội – Sài Gòn ~1,0–1,1 triệu' },
  tau_mo_ve: { key: 'tau_mo_ve', name: 'Tàu khách: phần cố định mỗi vé', value: 30_000, unit: 'đ', since: '2026-10-21', source: 'Ước tính để vé chặng ngắn không quá rẻ' },
  tau_ghe_mem_km: { key: 'tau_ghe_mem_km', name: 'Tàu SE ghế ngồi mềm điều hoà', value: 590, unit: 'đ/km', since: '2026-10-21', source: 'Hà Nội – Sài Gòn (1.726 km) ghế mềm từ 1.030.000–1.075.000đ (vietnamtourism.com 21/10/2026, mia.vn); nằm khoang 6 1,26–1,64 triệu' },
  may_bay_co_ban: { key: 'may_bay_co_ban', name: 'Vé máy bay phổ thông nội địa: phần cố định (gồm thuế, phí sân bay)', value: 600_000, unit: 'đ', since: '2026-11-01', source: 'Hiệu chỉnh theo vé Hà Nội – Đà Nẵng ~68 USD (12go.asia), Hà Nội – Sài Gòn 1,5–2,5 triệu' },
  tau_cao_toc_mo_ve: { key: 'tau_cao_toc_mo_ve', name: 'Tàu cao tốc ra đảo: phần cố định mỗi vé', value: 100_000, unit: 'đ', since: '2025-10-01', source: 'Hiệu chỉnh theo Rạch Giá – Phú Quốc 330.000–350.000đ, 2 giờ 45 phút (sunparadiseland.com 10/2025)' },
  tau_cao_toc_km: { key: 'tau_cao_toc_km', name: 'Tàu cao tốc ra đảo: theo km đường biển', value: 2_200, unit: 'đ/km', since: '2025-10-01', source: 'như trên', note: 'Tuyến Côn Đảo thực tế đắt hơn công thức (tàu lớn, tuyến dài).' },
  may_bay_km: { key: 'may_bay_km', name: 'Vé máy bay phổ thông nội địa: theo km bay', value: 1_100, unit: 'đ/km', since: '2026-11-01', source: 'như trên' },
};

/** Giá đang dùng (máy chủ có thể nạp bản ghi mới hơn từ bảng ref_prices). */
const live: Partial<Record<RefPriceKey, number>> = {};
export function setLivePrices(v: Partial<Record<RefPriceKey, number>>): void { Object.assign(live, v); }
export const refPrice = (k: RefPriceKey): number => live[k] ?? REF_PRICES[k].value;

export type FuelKind = 'ron95' | 'e5' | 'do' | 'do_cao_cap' | 'dien_dc' | 'dien_nha';
/** Giá một đơn vị nhiên liệu ngay lúc này (đ/lít hoặc đ/kWh, đã gồm thuế). Dùng cho trụ bơm, trụ sạc, cả bảng giá trạm. */
export function fuelPriceNow(kind: FuelKind): number {
  switch (kind) {
    case 'ron95': return refPrice('xang_e10_ron95');
    case 'e5': return refPrice('xang_e5_ron92');
    case 'do': return refPrice('dau_do_005s');
    case 'do_cao_cap': return refPrice('dau_do_0001s');
    case 'dien_dc': return refPrice('sac_cong_cong');
    // Sạc ở nhà: phần điện tăng thêm thường rơi vào bậc 3 của hộ gia đình, cộng thuế GTGT.
    case 'dien_nha': return Math.round(refPrice('dien_bac3') * (1 + refPrice('dien_vat')));
  }
}

/** Tiền điện sinh hoạt một tháng (đã gồm VAT) theo biểu 5 bậc. */
export function householdPowerBill(kWh: number): number {
  const tiers: [number, RefPriceKey][] = [[100, 'dien_bac1'], [200, 'dien_bac2'], [400, 'dien_bac3'], [700, 'dien_bac4'], [Infinity, 'dien_bac5']];
  let left = Math.max(0, kWh), prev = 0, sum = 0;
  for (const [top, k] of tiers) { const n = Math.min(left, top - prev); sum += n * refPrice(k); left -= n; prev = top; if (left <= 0) break; }
  return Math.round(sum * (1 + refPrice('dien_vat')));
}

/** Đơn giá cao tốc bình quân cho xe nhóm 1: trộn tuyến Nhà nước (mức 1 1.300, mức 2 900) và BOT (1.721). */
export const tollPerKmGroup1 = (): number => Math.round((refPrice('phi_cao_toc_nhom1') + 900 + refPrice('phi_cao_toc_bot')) / 3);
/** Hệ số phí theo 5 nhóm xe, theo biểu phí 5 tuyến cao tốc Bắc – Nam (nhóm 2 = 1.950 đ/km, nhóm 5 = 5.200 đ/km khi nhóm 1 = 1.300). */
export const TOLL_GROUP_RATIO: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 1, 2: 1.5, 3: 2, 4: 3, 5: 4 };

/** Lệ phí trước bạ người mua nộp khi nhận đất (0,5%, tối đa 500 triệu). */
export const registrationFee = (price: number): number => Math.min(500_000_000, Math.round(price * refPrice('le_phi_truoc_ba')));
/** Thuế TNCN người bán nộp khi chuyển nhượng (2% giá bán). */
export const transferTax = (price: number): number => Math.round(price * refPrice('thue_tncn_chuyen_nhuong'));
