// Danh mục vùng trồng, loại cây và đặc sản.
// Giá tham chiếu (refPrice, đồng/kg) ở đây là GIÁ MẪU để khởi động hệ thống,
// không phải giá thị trường đã kiểm chứng. Giá thật được nạp qua /api/admin/prices.

export type Kind = 'trai' | 'leo' | 'ngan' | 'cu' | 'cn' | 'lua';
export type Zone = 'bac' | 'trung' | 'taynguyen' | 'nam' | 'dao';

export interface Step { name: string; desc: string }
export interface Crop {
  id: string; name: string; emoji: string; kind: Kind;
  refPrice: number;   // đồng/kg (giá mẫu)
  yieldKg: number;    // kg mỗi ô 25 m² mỗi vụ
  growHours: number;  // tổng thời gian thật của một vụ khi TIME_SCALE = 1
  process?: string;   // quy trình riêng; mặc định dùng quy trình theo kind
}
export interface Specialty { id: string; name: string; crop: string; regionId: string; refPrice: number }
export interface Region {
  id: string; name: string; province: string; formerProvince?: string;
  zone: Zone; lat: number; lng: number; island?: boolean;
}

/** 34 tỉnh, thành phố sau sắp xếp đơn vị hành chính năm 2025. */
export const PROVINCES = [
  'Hà Nội', 'Huế', 'Lai Châu', 'Điện Biên', 'Sơn La', 'Lạng Sơn', 'Quảng Ninh', 'Thanh Hóa', 'Nghệ An',
  'Hà Tĩnh', 'Cao Bằng', 'Tuyên Quang', 'Lào Cai', 'Thái Nguyên', 'Phú Thọ', 'Bắc Ninh', 'Hưng Yên',
  'Hải Phòng', 'Ninh Bình', 'Quảng Trị', 'Đà Nẵng', 'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Lâm Đồng',
  'Đắk Lắk', 'TP. Hồ Chí Minh', 'Đồng Nai', 'Tây Ninh', 'Cần Thơ', 'Vĩnh Long', 'Đồng Tháp', 'Cà Mau', 'An Giang',
] as const;

export const ZONE_NAMES: Record<Zone, string> = {
  bac: 'Miền Bắc', trung: 'Miền Trung', taynguyen: 'Tây Nguyên', nam: 'Miền Nam', dao: 'Biển đảo',
};

// ---------------------------------------------------------------------------
// Quy trình canh tác. Bước đầu làm ngay khi xuống giống, bước cuối là thu hoạch.
// Nội dung là bản rút gọn để chơi; cần chuyên gia nông nghiệp rà lại trước khi phát hành.
// ---------------------------------------------------------------------------
const s = (name: string, desc: string): Step => ({ name, desc });

export const PROCESSES: Record<string, Step[]> = {
  trai: [
    s('Làm đất, đào hố', 'Dọn cỏ, đào hố, bón lót phân chuồng hoai và vôi trước khi trồng.'),
    s('Trồng cây giống', 'Đặt cây ghép vào hố, lấp đất ngang cổ rễ, cắm cọc chống gió.'),
    s('Tưới nước, giữ ẩm', 'Tưới đều và tủ gốc bằng rơm để giữ ẩm cho cây bén rễ.'),
    s('Tỉa cành tạo tán', 'Cắt cành vượt, cành sâu bệnh để tán thông thoáng, đón nắng đều.'),
    s('Bón thúc ra hoa', 'Bón lân và kali trước mùa hoa để cây phân hoá mầm hoa.'),
    s('Thụ phấn, tỉa trái non', 'Hỗ trợ thụ phấn và tỉa bớt trái xấu để dồn dinh dưỡng.'),
    s('Bao trái, phòng sâu bệnh', 'Bao trái chống ruồi vàng, theo dõi sâu bệnh, hạn chế thuốc gần ngày hái.'),
    s('Thu hoạch', 'Hái đúng độ chín, nhẹ tay, phân loại ngay tại vườn.'),
  ],
  leo: [
    s('Dựng trụ, làm giàn', 'Chôn trụ, căng dây giàn chắc chắn trước khi đặt cây.'),
    s('Trồng hom giống', 'Đặt hom sát trụ, buộc cố định để cây leo lên.'),
    s('Tưới nước, tủ gốc', 'Tưới nhỏ giọt và tủ gốc giữ ẩm.'),
    s('Tỉa cành, buộc dây', 'Tỉa cành yếu, buộc cành khoẻ lên giàn.'),
    s('Bón thúc ra hoa', 'Bón phân hữu cơ và kali để nuôi hoa.'),
    s('Tỉa chùm, phòng bệnh', 'Tỉa bớt trái, phòng nấm bệnh khi trời ẩm.'),
    s('Thu hoạch', 'Cắt trái chín, xếp sọt, tránh dập.'),
  ],
  ngan: [
    s('Làm đất, lên luống', 'Cày xới, lên luống cao, bón lót.'),
    s('Xuống giống', 'Trồng cây con hoặc chồi giống đúng mật độ.'),
    s('Tưới nước', 'Giữ ẩm đều, tránh úng.'),
    s('Bón thúc', 'Bón thúc theo từng đợt sinh trưởng.'),
    s('Phòng sâu bệnh', 'Thăm vườn thường xuyên, ưu tiên biện pháp sinh học.'),
    s('Thu hoạch', 'Thu đúng lứa, phân loại.'),
  ],
  cu: [
    s('Làm luống', 'Xới tơi đất, lên luống, bón lót.'),
    s('Xuống giống', 'Tách tép hoặc củ giống, trồng đúng khoảng cách.'),
    s('Tưới nước', 'Tưới nhẹ hằng ngày khi cây còn nhỏ.'),
    s('Làm cỏ, bón thúc', 'Nhổ cỏ bằng tay, bón thúc khi củ bắt đầu phình.'),
    s('Ngừng tưới', 'Ngừng nước trước khi nhổ để củ chắc, để được lâu.'),
    s('Thu hoạch, phơi', 'Nhổ củ, phơi nắng nhẹ rồi bó treo nơi khô thoáng.'),
  ],
  cn: [
    s('Làm đất, trồng cây che bóng', 'Đào hố, bón lót, trồng cây chắn gió và che bóng.'),
    s('Trồng cây giống', 'Trồng đầu mùa mưa để cây bén rễ.'),
    s('Tưới mùa khô', 'Tưới gốc theo đợt trong mùa khô.'),
    s('Tỉa cành tạo hình', 'Hãm ngọn, tỉa cành tăm, tạo bộ khung khoẻ.'),
    s('Bón phân', 'Bón phân hữu cơ kết hợp vô cơ theo mùa.'),
    s('Phòng sâu bệnh', 'Kiểm tra rệp, nấm rễ; vệ sinh vườn.'),
    s('Thu hái', 'Hái đúng độ chín, không tuốt xanh.'),
    s('Sơ chế, phơi sấy', 'Sơ chế và phơi sấy đến độ ẩm bảo quản.'),
  ],
  lua: [
    s('Làm đất, ngâm ủ giống', 'Cày bừa, san phẳng ruộng; ngâm ủ hạt giống cho nứt nanh.'),
    s('Gieo cấy', 'Gieo sạ hoặc cấy mạ theo hàng.'),
    s('Giữ nước mặt ruộng', 'Giữ mực nước nông, tháo nước khi lúa đẻ nhánh đủ.'),
    s('Bón thúc đẻ nhánh, đón đòng', 'Bón đúng thời điểm lúa đẻ nhánh và làm đòng.'),
    s('Thăm đồng, phòng rầy', 'Theo dõi rầy nâu, đạo ôn; chỉ xử lý khi tới ngưỡng.'),
    s('Gặt, phơi thóc', 'Gặt khi lúa chín 85–90%, phơi thóc đến độ ẩm bảo quản.'),
  ],
  thanh_long: [
    s('Đúc trụ, làm đất', 'Chôn trụ xi măng, lên mô đất quanh trụ, bón lót phân chuồng.'),
    s('Đặt hom giống', 'Đặt 3–4 hom quanh mỗi trụ, buộc hom áp vào trụ.'),
    s('Tưới nước, tủ gốc', 'Tủ rơm quanh gốc, tưới đều vì rễ thanh long ăn nông.'),
    s('Tỉa cành tạo tán', 'Để cành khoẻ vắt qua đầu trụ, tỉa cành ốm, cành sát đất.'),
    s('Chong đèn ra hoa trái vụ', 'Thắp đèn ban đêm để kích cây ra hoa ngoài mùa chính.'),
    s('Tỉa nụ, thụ phấn', 'Mỗi cành giữ 1–2 nụ đẹp; thụ phấn bổ sung lúc hoa nở đêm.'),
    s('Bao trái', 'Bao trái chống ruồi đục trái và nám nắng.'),
    s('Thu hoạch', 'Cắt trái khi vỏ đỏ đều, tai còn xanh cứng.'),
  ],
  nho: [
    s('Làm giàn', 'Dựng trụ và căng lưới thép thành giàn cao ngang đầu.'),
    s('Trồng cây ghép', 'Trồng gốc ghép, dẫn thân chính lên giàn.'),
    s('Tưới, bón định kỳ', 'Tưới rãnh, bón phân hữu cơ; nho cần nắng và ít mưa.'),
    s('Cắt cành tạo vụ', 'Cắt cành sau thu hoạch để cây bật chồi mang hoa cho vụ mới.'),
    s('Tỉa chùm, tỉa trái', 'Tỉa bớt trái nhỏ để chùm thoáng, trái to đều.'),
    s('Che lưới chống chim, dơi', 'Phủ lưới quanh giàn khi trái bắt đầu chín.'),
    s('Thu hoạch', 'Cắt chùm vào sáng sớm, giữ lớp phấn trên vỏ.'),
  ],
  toi: [
    s('Trải đất, phủ cát', 'Trải lớp đất đỏ bazan rồi phủ cát trắng san hô lên trên.'),
    s('Tách tép, xuống giống', 'Tách tép tỏi giống, cắm từng tép theo hàng.'),
    s('Tưới sáng chiều', 'Tưới nước ngọt hai lần mỗi ngày vì cát thoát nước nhanh.'),
    s('Bón thúc, làm cỏ', 'Bón thúc khi tỏi bắt đầu phình củ, nhổ cỏ bằng tay.'),
    s('Ngừng tưới', 'Ngừng nước khoảng một tuần trước khi nhổ để củ chắc.'),
    s('Nhổ tỏi, phơi', 'Nhổ cả cây, phơi nắng rồi bó treo nơi thoáng gió.'),
  ],
  khom: [
    s('Lên liếp', 'Đào mương, lên liếp cao trên đất phèn để rửa phèn.'),
    s('Trồng chồi giống', 'Chọn chồi nách đều nhau, trồng hàng kép.'),
    s('Giữ nước mương', 'Giữ nước trong mương để ém phèn và tưới.'),
    s('Bón phân', 'Bón đạm và kali vào nách lá.'),
    s('Xử lý ra hoa đồng loạt', 'Xử lý cho cả liếp ra hoa cùng lúc để thu một lứa.'),
    s('Che nắng cho trái', 'Túm lá hoặc che trái để tránh rám nắng.'),
    s('Thu hoạch', 'Bẻ trái khi vỏ hoe vàng 2–3 hàng mắt.'),
  ],
  vai_thieu: [
    s('Làm đất, đào hố', 'Đào hố trên đất đồi, bón lót phân chuồng hoai.'),
    s('Trồng cành chiết', 'Trồng cành chiết hoặc cây ghép, tủ gốc giữ ẩm.'),
    s('Tưới nước, giữ ẩm', 'Tưới đủ ẩm khi cây ra lộc.'),
    s('Tỉa cành sau thu', 'Tỉa cành ngay sau vụ để cây ra lộc thu khoẻ.'),
    s('Khoanh vỏ hãm lộc đông', 'Khoanh vỏ cành để hãm lộc đông, giúp cây phân hoá mầm hoa.'),
    s('Chăm hoa, nuôi ong thụ phấn', 'Đặt ong mật trong vườn lúc hoa nở, không phun thuốc.'),
    s('Phòng sâu đục cuống', 'Theo dõi sâu đục cuống quả, giữ thời gian cách ly trước khi hái.'),
    s('Thu hoạch', 'Hái sáng sớm, bó chùm, đưa đi ngay trong ngày.'),
  ],
  sau_rieng: [
    s('Lên mô, đào hố', 'Đắp mô cao để thoát nước, bón lót phân hữu cơ.'),
    s('Trồng cây ghép', 'Trồng cây ghép, che nắng và cắm cọc cho cây con.'),
    s('Tưới nước, tủ gốc', 'Giữ ẩm đều, tuyệt đối không để úng rễ.'),
    s('Tỉa cành tạo tán', 'Giữ cành ngang khoẻ, tỉa cành đứng và cành sát đất.'),
    s('Xiết nước tạo khô hạn', 'Ngừng tưới, phủ bạt gốc để cây gặp khô hạn và ra hoa.'),
    s('Thụ phấn ban đêm', 'Dùng chổi lông thụ phấn bổ sung khi hoa nở vào chập tối.'),
    s('Tỉa trái, phòng bệnh', 'Tỉa trái méo, giữ trái ở cành khoẻ; phòng nấm thối trái.'),
    s('Thu hoạch', 'Cắt trái đủ ngày tuổi, không để rụng, không hái non.'),
  ],
};

// id, tên, emoji, kind, giá mẫu (đ/kg), sản lượng kg/ô, giờ/vụ, quy trình riêng
const cropRows: [string, string, string, Kind, number, number, number, string?][] = [
  ['thanh_long', 'Thanh long', '🐉', 'leo', 18000, 75, 24, 'thanh_long'],
  ['nho', 'Nho', '🍇', 'leo', 45000, 50, 24, 'nho'],
  ['tao', 'Táo', '🍏', 'trai', 20000, 80, 20],
  ['toi', 'Tỏi', '🧄', 'cu', 90000, 25, 12, 'toi'],
  ['hanh', 'Hành', '🧅', 'cu', 30000, 40, 10],
  ['vai', 'Vải', '🍒', 'trai', 30000, 45, 30, 'vai_thieu'],
  ['nhan', 'Nhãn', '🟤', 'trai', 25000, 45, 30],
  ['buoi', 'Bưởi', '🍈', 'trai', 35000, 60, 36],
  ['cam', 'Cam', '🍊', 'trai', 25000, 60, 30],
  ['quyt', 'Quýt', '🍊', 'trai', 30000, 50, 30],
  ['xoai', 'Xoài', '🥭', 'trai', 40000, 55, 30],
  ['sau_rieng', 'Sầu riêng', '🌰', 'trai', 80000, 40, 48, 'sau_rieng'],
  ['mang_cut', 'Măng cụt', '🟣', 'trai', 60000, 30, 42],
  ['chom_chom', 'Chôm chôm', '🔴', 'trai', 25000, 55, 30],
  ['vu_sua', 'Vú sữa', '🟢', 'trai', 40000, 40, 36],
  ['khom', 'Khóm (dứa)', '🍍', 'ngan', 10000, 90, 14, 'khom'],
  ['dua', 'Dừa', '🥥', 'trai', 8000, 100, 36],
  ['chuoi', 'Chuối', '🍌', 'ngan', 12000, 100, 16],
  ['na', 'Na (mãng cầu)', '🍈', 'trai', 45000, 40, 28],
  ['man', 'Mận', '🍑', 'trai', 30000, 50, 26],
  ['dau_tay', 'Dâu tây', '🍓', 'ngan', 150000, 20, 10],
  ['hong', 'Hồng', '🍅', 'trai', 35000, 45, 30],
  ['bo', 'Bơ', '🥑', 'trai', 30000, 50, 34],
  ['le', 'Lê', '🍐', 'trai', 40000, 45, 32],
  ['ca_phe', 'Cà phê', '☕', 'cn', 110000, 12, 40],
  ['ho_tieu', 'Hồ tiêu', '⚫', 'cn', 150000, 8, 40],
  ['che', 'Chè', '🍃', 'cn', 30000, 30, 18],
  ['dieu', 'Điều', '🥜', 'cn', 35000, 15, 36],
  ['mac_ca', 'Mắc ca', '🌰', 'cn', 100000, 12, 44],
  ['que', 'Quế', '🪵', 'cn', 60000, 15, 46],
  ['hoi', 'Hồi', '⭐', 'cn', 150000, 8, 44],
  ['lua', 'Lúa', '🌾', 'lua', 9000, 15, 12],
  ['hat_de', 'Hạt dẻ', '🌰', 'trai', 80000, 15, 36],
  ['mia', 'Mía', '🎋', 'ngan', 5000, 200, 16],
  ['sen', 'Sen', '🪷', 'ngan', 100000, 5, 14],
  ['thot_not', 'Thốt nốt', '🌴', 'trai', 30000, 30, 40],
  ['lon_bon', 'Lòn bon', '🟡', 'trai', 40000, 40, 36],
  ['chanh', 'Chanh', '🍋', 'trai', 20000, 60, 20],
  ['chanh_day', 'Chanh dây', '🟣', 'leo', 15000, 70, 16],
  ['khoai_lang', 'Khoai lang', '🍠', 'cu', 15000, 60, 12],
  ['atiso', 'Atiso', '🌿', 'ngan', 60000, 25, 16],
  ['mang_tay', 'Măng tây', '🎍', 'ngan', 70000, 15, 12],
  ['ca_rot', 'Cà rốt', '🥕', 'cu', 12000, 100, 10],
  ['oi', 'Ổi', '🍐', 'trai', 15000, 80, 18],
  ['dau_da', 'Dâu da', '🟡', 'trai', 35000, 40, 30],
  ['hat_bang', 'Hạt bàng', '🌰', 'trai', 200000, 5, 36],
  ['sim', 'Sim', '🫐', 'ngan', 60000, 15, 20],
];

export const CROPS: Record<string, Crop> = Object.fromEntries(
  cropRows.map(([id, name, emoji, kind, refPrice, yieldKg, growHours, process]) => [
    id, { id, name, emoji, kind, refPrice, yieldKg, growHours, process },
  ]),
);

// id, tên vùng, tỉnh (mới), tỉnh cũ, miền, vĩ độ, kinh độ, đảo?, đặc sản: [id, tên, loại cây, hệ số giá?]
type SpRow = [string, string, string, number?];
const regionRows: [string, string, string, string | null, Zone, number, number, boolean, SpRow[]][] = [
  // ---- Miền Bắc
  ['hn_phudien', 'Phú Diễn', 'Hà Nội', null, 'bac', 21.05, 105.76, false, [
    ['buoi_dien', 'Bưởi Diễn', 'buoi'], ['cam_canh', 'Cam Canh', 'cam', 1.6]]],
  ['tq_hamyen', 'Hàm Yên', 'Tuyên Quang', null, 'bac', 22.07, 105.03, false, [
    ['cam_ham_yen', 'Cam sành Hàm Yên', 'cam'], ['che_shan_tuyet', 'Chè Shan tuyết Hà Giang', 'che', 3]]],
  ['cb_trungkhanh', 'Trùng Khánh', 'Cao Bằng', null, 'bac', 22.83, 106.52, false, [
    ['hat_de_trung_khanh', 'Hạt dẻ Trùng Khánh', 'hat_de'], ['le_cao_bang', 'Lê Cao Bằng', 'le']]],
  ['ls_chilang', 'Chi Lăng', 'Lạng Sơn', null, 'bac', 21.66, 106.6, false, [
    ['na_chi_lang', 'Na Chi Lăng', 'na'], ['hoi_lang_son', 'Hồi Lạng Sơn', 'hoi'], ['hong_bao_lam', 'Hồng Bảo Lâm', 'hong']]],
  ['lc_bacha', 'Bắc Hà', 'Lào Cai', null, 'bac', 22.54, 104.29, false, [
    ['man_bac_ha', 'Mận Tam Hoa Bắc Hà', 'man'], ['que_van_yen', 'Quế Văn Yên', 'que'], ['che_suoi_giang', 'Chè Suối Giàng', 'che', 3]]],
  ['lch_tamduong', 'Tam Đường', 'Lai Châu', null, 'bac', 22.35, 103.6, false, [
    ['che_tam_duong', 'Chè Tam Đường', 'che'], ['mac_ca_lai_chau', 'Mắc ca Lai Châu', 'mac_ca']]],
  ['db_muongthanh', 'Mường Thanh', 'Điện Biên', null, 'bac', 21.39, 103.02, false, [
    ['gao_dien_bien', 'Lúa gạo Điện Biên', 'lua', 1.5], ['ca_phe_muong_ang', 'Cà phê Mường Ảng', 'ca_phe']]],
  ['sl_mocchau', 'Mộc Châu', 'Sơn La', null, 'bac', 20.85, 104.63, false, [
    ['man_moc_chau', 'Mận hậu Mộc Châu', 'man'], ['dau_tay_moc_chau', 'Dâu tây Mộc Châu', 'dau_tay'],
    ['xoai_yen_chau', 'Xoài tròn Yên Châu', 'xoai'], ['nhan_song_ma', 'Nhãn Sông Mã', 'nhan'], ['ca_phe_son_la', 'Cà phê Sơn La', 'ca_phe']]],
  ['tn_tancuong', 'Tân Cương', 'Thái Nguyên', null, 'bac', 21.56, 105.77, false, [
    ['che_tan_cuong', 'Chè Tân Cương', 'che', 2], ['na_la_hien', 'Na La Hiên', 'na'],
    ['quyt_bac_kan', 'Quýt Bắc Kạn', 'quyt'], ['hong_bac_kan', 'Hồng không hạt Bắc Kạn', 'hong']]],
  ['pt_doanhung', 'Đoan Hùng', 'Phú Thọ', null, 'bac', 21.62, 105.18, false, [
    ['buoi_doan_hung', 'Bưởi Đoan Hùng', 'buoi'], ['cam_cao_phong', 'Cam Cao Phong', 'cam'],
    ['thanh_long_lap_thach', 'Thanh long ruột đỏ Lập Thạch', 'thanh_long', 1.3]]],
  ['bn_lucngan', 'Lục Ngạn', 'Bắc Ninh', 'Bắc Giang', 'bac', 21.38, 106.65, false, [
    ['vai_luc_ngan', 'Vải thiều Lục Ngạn', 'vai'], ['cam_luc_ngan', 'Cam Lục Ngạn', 'cam'], ['na_luc_nam', 'Na dai Lục Nam', 'na']]],
  ['qn_dongtrieu', 'Đông Triều', 'Quảng Ninh', null, 'bac', 21.08, 106.52, false, [
    ['na_dong_trieu', 'Na Đông Triều', 'na'], ['cam_van_yen', 'Cam Vạn Yên', 'cam']]],
  ['hp_thanhha', 'Thanh Hà', 'Hải Phòng', 'Hải Dương', 'bac', 20.9, 106.43, false, [
    ['vai_thanh_ha', 'Vải thiều Thanh Hà', 'vai', 1.2], ['oi_thanh_ha', 'Ổi Thanh Hà', 'oi'],
    ['hanh_toi_kinh_mon', 'Hành tỏi Kinh Môn', 'hanh'], ['ca_rot_cam_giang', 'Cà rốt Cẩm Giàng', 'ca_rot']]],
  ['hp_catba', 'Đảo Cát Bà', 'Hải Phòng', null, 'dao', 20.8, 106.99, true, [
    ['cam_gia_luan', 'Cam Gia Luận', 'cam']]],
  ['hy_khoaichau', 'Khoái Châu', 'Hưng Yên', null, 'bac', 20.84, 105.98, false, [
    ['nhan_long_hung_yen', 'Nhãn lồng Hưng Yên', 'nhan', 1.4], ['chuoi_khoai_chau', 'Chuối tiêu hồng Khoái Châu', 'chuoi']]],
  ['nb_tamdiep', 'Tam Điệp', 'Ninh Bình', null, 'bac', 20.16, 105.92, false, [
    ['dua_dong_giao', 'Dứa Đồng Giao', 'khom'], ['chuoi_ngu_dai_hoang', 'Chuối ngự Đại Hoàng', 'chuoi', 2],
    ['gao_tam_xoan', 'Lúa tám xoan Hải Hậu', 'lua', 1.6]]],
  // ---- Miền Trung
  ['th_thoxuan', 'Thọ Xuân', 'Thanh Hóa', null, 'trung', 19.93, 105.52, false, [
    ['buoi_luan_van', 'Bưởi Luận Văn', 'buoi'], ['mia_kim_tan', 'Mía tím Kim Tân', 'mia'], ['cam_van_du', 'Cam Vân Du', 'cam']]],
  ['na_quyhop', 'Quỳ Hợp', 'Nghệ An', null, 'trung', 19.32, 105.18, false, [
    ['cam_vinh', 'Cam Vinh', 'cam', 1.4], ['chanh_leo_que_phong', 'Chanh leo Quế Phong', 'chanh_day']]],
  ['ht_huongkhe', 'Hương Khê', 'Hà Tĩnh', null, 'trung', 18.18, 105.7, false, [
    ['buoi_phuc_trach', 'Bưởi Phúc Trạch', 'buoi'], ['cam_khe_may', 'Cam Khe Mây', 'cam'], ['cam_bu_huong_son', 'Cam bù Hương Sơn', 'cam', 1.3]]],
  ['qt_vinhlinh', 'Vĩnh Linh', 'Quảng Trị', null, 'trung', 17.06, 107.03, false, [
    ['tieu_vinh_linh', 'Hồ tiêu Vĩnh Linh', 'ho_tieu'], ['ca_phe_khe_sanh', 'Cà phê Khe Sanh', 'ca_phe']]],
  ['hue_thuybieu', 'Thủy Biều', 'Huế', null, 'trung', 16.45, 107.55, false, [
    ['thanh_tra_hue', 'Thanh trà Huế', 'buoi', 1.3], ['sen_hue', 'Sen Huế', 'sen'], ['dau_truoi', 'Dâu Truồi', 'dau_da']]],
  ['dn_tienphuoc', 'Tiên Phước', 'Đà Nẵng', 'Quảng Nam', 'trung', 15.49, 108.31, false, [
    ['lon_bon_tien_phuoc', 'Lòn bon Tiên Phước', 'lon_bon'], ['tieu_tien_phuoc', 'Tiêu Tiên Phước', 'ho_tieu'], ['que_tra_my', 'Quế Trà My', 'que']]],
  ['qng_lyson', 'Đảo Lý Sơn', 'Quảng Ngãi', null, 'dao', 15.38, 109.12, true, [
    ['toi_ly_son', 'Tỏi Lý Sơn', 'toi'], ['hanh_ly_son', 'Hành tím Lý Sơn', 'hanh']]],
  ['qng_trabong', 'Trà Bồng', 'Quảng Ngãi', null, 'trung', 15.25, 108.52, false, [
    ['que_tra_bong', 'Quế Trà Bồng', 'que']]],
  ['gl_hoainhon', 'Hoài Nhơn', 'Gia Lai', 'Bình Định', 'trung', 14.52, 109.03, false, [
    ['dua_tam_quan', 'Dừa Tam Quan', 'dua']]],
  ['kh_camlam', 'Cam Lâm', 'Khánh Hòa', null, 'trung', 12.07, 109.1, false, [
    ['xoai_cam_lam', 'Xoài Cam Lâm', 'xoai'], ['sau_rieng_khanh_son', 'Sầu riêng Khánh Sơn', 'sau_rieng']]],
  ['kh_ninhphuoc', 'Ninh Phước', 'Khánh Hòa', 'Ninh Thuận', 'trung', 11.52, 108.93, false, [
    ['nho_ninh_thuan', 'Nho Ninh Thuận', 'nho'], ['tao_ninh_thuan', 'Táo xanh Ninh Thuận', 'tao'],
    ['toi_phan_rang', 'Tỏi Phan Rang', 'toi', 0.8], ['mang_tay_ninh_thuan', 'Măng tây xanh Ninh Thuận', 'mang_tay']]],
  ['ld_hamthuannam', 'Hàm Thuận Nam', 'Lâm Đồng', 'Bình Thuận', 'trung', 10.85, 107.9, false, [
    ['thanh_long_binh_thuan', 'Thanh long Bình Thuận', 'thanh_long']]],
  // ---- Tây Nguyên
  ['qng_dakha', 'Đăk Hà', 'Quảng Ngãi', 'Kon Tum', 'taynguyen', 14.52, 107.92, false, [
    ['ca_phe_dak_ha', 'Cà phê Đăk Hà', 'ca_phe']]],
  ['gl_chuse', 'Chư Sê', 'Gia Lai', null, 'taynguyen', 13.7, 108.08, false, [
    ['tieu_chu_se', 'Hồ tiêu Chư Sê', 'ho_tieu'], ['ca_phe_gia_lai', 'Cà phê Gia Lai', 'ca_phe'], ['chanh_day_gia_lai', 'Chanh dây Gia Lai', 'chanh_day']]],
  ['dl_buonmathuot', 'Buôn Ma Thuột', 'Đắk Lắk', null, 'taynguyen', 12.67, 108.04, false, [
    ['ca_phe_bmt', 'Cà phê Buôn Ma Thuột', 'ca_phe'], ['sau_rieng_krong_pak', 'Sầu riêng Krông Pắc', 'sau_rieng'], ['bo_dak_lak', 'Bơ Đắk Lắk', 'bo']]],
  ['ld_dalat', 'Đà Lạt', 'Lâm Đồng', null, 'taynguyen', 11.94, 108.44, false, [
    ['dau_tay_da_lat', 'Dâu tây Đà Lạt', 'dau_tay'], ['hong_da_lat', 'Hồng Đà Lạt', 'hong'],
    ['atiso_da_lat', 'Atiso Đà Lạt', 'atiso'], ['ca_phe_cau_dat', 'Cà phê Arabica Cầu Đất', 'ca_phe', 1.5]]],
  ['ld_baoloc', 'Bảo Lộc', 'Lâm Đồng', null, 'taynguyen', 11.55, 107.81, false, [
    ['che_bao_loc', 'Chè Bảo Lộc', 'che'], ['sau_rieng_da_huoai', 'Sầu riêng Đạ Huoai', 'sau_rieng'], ['bo_bao_loc', 'Bơ Bảo Lộc', 'bo']]],
  ['ld_daksong', 'Đắk Song', 'Lâm Đồng', 'Đắk Nông', 'taynguyen', 12.25, 107.6, false, [
    ['tieu_dak_song', 'Hồ tiêu Đắk Song', 'ho_tieu'], ['bo_dak_nong', 'Bơ Đắk Nông', 'bo']]],
  // ---- Miền Nam
  ['dna_longkhanh', 'Long Khánh', 'Đồng Nai', null, 'nam', 10.93, 107.24, false, [
    ['chom_chom_long_khanh', 'Chôm chôm Long Khánh', 'chom_chom'], ['sau_rieng_long_khanh', 'Sầu riêng Long Khánh', 'sau_rieng'],
    ['buoi_tan_trieu', 'Bưởi Tân Triều', 'buoi']]],
  ['dna_budang', 'Bù Đăng', 'Đồng Nai', 'Bình Phước', 'nam', 11.77, 107.24, false, [
    ['dieu_binh_phuoc', 'Điều Bình Phước', 'dieu'], ['tieu_loc_ninh', 'Hồ tiêu Lộc Ninh', 'ho_tieu']]],
  ['hcm_laithieu', 'Lái Thiêu', 'TP. Hồ Chí Minh', 'Bình Dương', 'nam', 10.9, 106.7, false, [
    ['mang_cut_lai_thieu', 'Măng cụt Lái Thiêu', 'mang_cut'], ['buoi_bach_dang', 'Bưởi Bạch Đằng', 'buoi']]],
  ['hcm_cangio', 'Cần Giờ', 'TP. Hồ Chí Minh', null, 'nam', 10.41, 106.95, false, [
    ['xoai_can_gio', 'Xoài cát Cần Giờ', 'xoai']]],
  ['hcm_baria', 'Bà Rịa', 'TP. Hồ Chí Minh', 'Bà Rịa – Vũng Tàu', 'nam', 10.5, 107.17, false, [
    ['nhan_xuong_com_vang', 'Nhãn xuồng cơm vàng', 'nhan', 1.6], ['tieu_ba_ria', 'Hồ tiêu Bà Rịa', 'ho_tieu']]],
  ['hcm_condao', 'Côn Đảo', 'TP. Hồ Chí Minh', 'Bà Rịa – Vũng Tàu', 'dao', 8.68, 106.61, true, [
    ['hat_bang_con_dao', 'Hạt bàng Côn Đảo', 'hat_bang']]],
  ['tn_baden', 'Núi Bà Đen', 'Tây Ninh', null, 'nam', 11.37, 106.15, false, [
    ['mang_cau_ba_den', 'Mãng cầu Bà Đen', 'na']]],
  ['tn_benluc', 'Bến Lức', 'Tây Ninh', 'Long An', 'nam', 10.64, 106.49, false, [
    ['chanh_ben_luc', 'Chanh không hạt Bến Lức', 'chanh'], ['khom_ben_luc', 'Khóm Bến Lức', 'khom'],
    ['thanh_long_chau_thanh', 'Thanh long Châu Thành', 'thanh_long']]],
  ['dt_caolanh', 'Cao Lãnh', 'Đồng Tháp', null, 'nam', 10.46, 105.63, false, [
    ['xoai_cao_lanh', 'Xoài Cao Lãnh', 'xoai'], ['quyt_lai_vung', 'Quýt hồng Lai Vung', 'quyt'], ['sen_thap_muoi', 'Sen Tháp Mười', 'sen']]],
  ['dt_caibe', 'Cái Bè', 'Đồng Tháp', 'Tiền Giang', 'nam', 10.34, 106.03, false, [
    ['xoai_hoa_loc', 'Xoài cát Hòa Lộc', 'xoai', 1.6], ['vu_sua_lo_ren', 'Vú sữa Lò Rèn Vĩnh Kim', 'vu_sua'],
    ['sau_rieng_ngu_hiep', 'Sầu riêng Ngũ Hiệp', 'sau_rieng'], ['khom_tan_phuoc', 'Khóm Tân Phước', 'khom'],
    ['thanh_long_cho_gao', 'Thanh long Chợ Gạo', 'thanh_long']]],
  ['vl_binhminh', 'Bình Minh', 'Vĩnh Long', null, 'nam', 10.07, 105.82, false, [
    ['buoi_nam_roi', 'Bưởi Năm Roi', 'buoi'], ['cam_sanh_tam_binh', 'Cam sành Tam Bình', 'cam'], ['khoai_lang_binh_tan', 'Khoai lang Bình Tân', 'khoai_lang']]],
  ['vl_cholach', 'Chợ Lách', 'Vĩnh Long', 'Bến Tre', 'nam', 10.26, 106.13, false, [
    ['dua_ben_tre', 'Dừa Bến Tre', 'dua'], ['buoi_da_xanh', 'Bưởi da xanh Bến Tre', 'buoi', 1.3],
    ['sau_rieng_cai_mon', 'Sầu riêng Cái Mơn', 'sau_rieng'], ['chom_chom_cho_lach', 'Chôm chôm Chợ Lách', 'chom_chom']]],
  ['vl_cauke', 'Cầu Kè', 'Vĩnh Long', 'Trà Vinh', 'nam', 9.87, 106.06, false, [
    ['dua_sap_cau_ke', 'Dừa sáp Cầu Kè', 'dua', 3]]],
  ['ct_phongdien', 'Phong Điền', 'Cần Thơ', null, 'nam', 10.0, 105.67, false, [
    ['dau_ha_chau', 'Dâu Hạ Châu', 'dau_da'], ['khom_cau_duc', 'Khóm Cầu Đúc', 'khom']]],
  ['ct_vinhchau', 'Vĩnh Châu', 'Cần Thơ', 'Sóc Trăng', 'nam', 9.33, 105.98, false, [
    ['hanh_tim_vinh_chau', 'Hành tím Vĩnh Châu', 'hanh']]],
  ['ag_baynui', 'Bảy Núi', 'An Giang', null, 'nam', 10.52, 105.0, false, [
    ['thot_not_bay_nui', 'Thốt nốt Bảy Núi', 'thot_not'], ['xoai_cho_moi', 'Xoài ba màu Chợ Mới', 'xoai', 0.7]]],
  ['ag_taccau', 'Tắc Cậu', 'An Giang', 'Kiên Giang', 'nam', 9.87, 105.13, false, [
    ['khom_tac_cau', 'Khóm Tắc Cậu', 'khom']]],
  ['ag_phuquoc', 'Đảo Phú Quốc', 'An Giang', 'Kiên Giang', 'dao', 10.22, 103.96, true, [
    ['tieu_phu_quoc', 'Hồ tiêu Phú Quốc', 'ho_tieu'], ['sim_phu_quoc', 'Sim rừng Phú Quốc', 'sim']]],
  ['cm_baclieu', 'Bạc Liêu', 'Cà Mau', 'Bạc Liêu', 'nam', 9.28, 105.72, false, [
    ['nhan_co_bac_lieu', 'Nhãn cổ Bạc Liêu', 'nhan'], ['chuoi_xiem_u_minh', 'Chuối xiêm U Minh', 'chuoi']]],
];

export const REGIONS: Record<string, Region> = {};
export const SPECIALTIES: Record<string, Specialty> = {};
for (const [id, name, province, former, zone, lat, lng, island, sps] of regionRows) {
  REGIONS[id] = { id, name, province, formerProvince: former ?? undefined, zone, lat, lng, island: island || undefined };
  for (const [sid, sname, crop, mult] of sps) {
    const base = CROPS[crop];
    if (!base) throw new Error(`Đặc sản ${sid} dùng loại cây không tồn tại: ${crop}`);
    if (SPECIALTIES[sid]) throw new Error(`Trùng mã đặc sản: ${sid}`);
    SPECIALTIES[sid] = { id: sid, name: sname, crop, regionId: id, refPrice: Math.round((base.refPrice * (mult ?? 1)) / 500) * 500 };
  }
}

export function processOf(crop: Crop): Step[] {
  return PROCESSES[crop.process ?? crop.kind];
}
export function specialtiesOfRegion(regionId: string): Specialty[] {
  return Object.values(SPECIALTIES).filter((sp) => sp.regionId === regionId);
}
