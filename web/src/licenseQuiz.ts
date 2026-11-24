// Ngân hàng câu hỏi thi lý thuyết (soạn theo Luật Trật tự, an toàn giao thông đường bộ 2024, QCVN 41 về báo hiệu,
// Thông tư 38/2024 về tốc độ – khoảng cách). `lie: true` = câu điểm liệt (lỗi nguy hiểm: cồn, ma tuý, đi ngược chiều,
// vượt đèn đỏ, không đội mũ bảo hiểm…): trả lời sai câu này là trượt cả bài dù đủ điểm.
// Đây là câu hỏi tự soạn để chơi, không phải bộ đề chính thức 600/250 câu của cơ quan sát hạch.
import { QUIZ } from './vehicles.tsx';
import { THEORY_SPEC, isMotoClass } from '../../shared/vehicles.ts';
import type { LicenseClass } from '../../shared/vehicles.ts';

export interface QQ { q: string; a: string[]; ok: number; why: string; lie?: boolean }

/** Câu chung cho mọi hạng (luật, biển báo, nhường đường). */
const COMMON: QQ[] = [
  { q: 'Người điều khiển phương tiện trong máu hoặc hơi thở có nồng độ cồn thì bị xử lý thế nào?', a: ['Được lái nếu dưới mức cho phép', 'Bị cấm: luật không cho phép có nồng độ cồn khi lái xe', 'Chỉ bị nhắc nhở'], ok: 1, why: 'Luật 2024 cấm điều khiển phương tiện khi trong máu hoặc hơi thở có nồng độ cồn, ở mọi mức.', lie: true },
  { q: 'Người lái xe sử dụng chất ma tuý thì sao?', a: ['Bị nghiêm cấm', 'Được lái nếu tỉnh táo', 'Chỉ cấm khi đi cao tốc'], ok: 0, why: 'Nghiêm cấm điều khiển phương tiện khi trong cơ thể có chất ma tuý, chất kích thích bị cấm.', lie: true },
  { q: 'Đi vào đường có biển "Cấm đi ngược chiều" (tròn đỏ có vạch trắng ngang) được không?', a: ['Được nếu đường vắng', 'Không được đi vào theo chiều đặt biển', 'Được nếu bấm còi'], ok: 1, why: 'Biển P.102 cấm mọi xe đi vào theo chiều đặt biển. Đi ngược chiều là lỗi đặc biệt nguy hiểm.', lie: true },
  { q: 'Đèn tín hiệu giao thông màu đỏ nghĩa là gì?', a: ['Cấm đi', 'Đi chậm', 'Được rẽ phải mọi lúc'], ok: 0, why: 'Đèn đỏ là cấm đi. Chỉ được rẽ khi có biển hoặc đèn mũi tên xanh cho phép.', lie: true },
  { q: 'Gặp người điều khiển giao thông ra hiệu tay giơ thẳng đứng, bạn làm gì?', a: ['Đi tiếp', 'Mọi xe phải dừng lại', 'Chỉ xe máy dừng'], ok: 1, why: 'Tay giơ thẳng đứng: người tham gia giao thông ở mọi hướng phải dừng lại.' },
  { q: 'Hiệu lệnh của người điều khiển giao thông và đèn tín hiệu khác nhau, bạn chấp hành theo cái nào?', a: ['Đèn tín hiệu', 'Hiệu lệnh của người điều khiển giao thông', 'Biển báo'], ok: 1, why: 'Thứ tự ưu tiên chấp hành: hiệu lệnh của người điều khiển giao thông, rồi đèn tín hiệu, biển báo, vạch kẻ đường.' },
  { q: 'Biển tam giác viền đỏ, nền vàng là loại biển gì?', a: ['Biển cấm', 'Biển báo nguy hiểm và cảnh báo', 'Biển chỉ dẫn'], ok: 1, why: 'Biển hình tam giác viền đỏ nền vàng là biển báo nguy hiểm, cảnh báo điều sắp gặp phía trước.' },
  { q: 'Biển hình tròn nền xanh, có hình vẽ màu trắng là biển gì?', a: ['Biển hiệu lệnh', 'Biển cấm', 'Biển phụ'], ok: 0, why: 'Biển tròn nền xanh là biển hiệu lệnh: buộc phải làm theo (hướng đi, tốc độ tối thiểu…).' },
  { q: 'Biển "STOP" hình bát giác đỏ yêu cầu gì?', a: ['Giảm tốc rồi đi', 'Dừng hẳn trước vạch dừng rồi mới được đi', 'Chỉ dừng khi có xe'], ok: 1, why: 'Biển P.124 "Dừng lại": mọi xe phải dừng hẳn, quan sát an toàn rồi mới đi tiếp.' },
  { q: 'Tại nơi giao nhau không có đèn, không có biển ưu tiên, bạn phải nhường xe nào?', a: ['Xe đi từ bên trái', 'Xe đi từ bên phải', 'Xe to hơn'], ok: 1, why: 'Nơi giao nhau không có báo hiệu: nhường đường cho xe đi đến từ bên phải.' },
  { q: 'Vào vòng xuyến (nút giao có đảo tròn), bạn nhường xe nào?', a: ['Xe đi từ bên trái (xe đang trong vòng xuyến)', 'Xe đi từ bên phải', 'Không cần nhường'], ok: 0, why: 'Ở nơi giao nhau có vòng xuyến, phải nhường đường cho xe đi đến từ bên trái.' },
  { q: 'Xe nào được quyền ưu tiên đi trước khi đang làm nhiệm vụ khẩn cấp?', a: ['Xe chữa cháy, xe quân sự, công an, cứu thương', 'Xe khách', 'Xe tải chở hàng tươi'], ok: 0, why: 'Xe ưu tiên khi làm nhiệm vụ khẩn cấp có còi, đèn: chữa cháy, quân sự, công an, cứu thương, cứu hộ…' },
  { q: 'Vạch kẻ đường liền màu vàng ở giữa đường nghĩa là gì?', a: ['Được đè vạch để vượt', 'Không được đè lên, phân chia hai chiều xe chạy', 'Chỉ dành cho xe buýt'], ok: 1, why: 'Vạch liền phân chia hai chiều: không được lấn, đè lên vạch.' },
  { q: 'Dừng xe trên đường phố phải cách lề đường tối đa bao nhiêu?', a: ['0,25 m', '1 m', '2 m'], ok: 0, why: 'Khi dừng, đỗ trên đường phố, bánh xe gần nhất không cách lề quá 0,25 m.' },
  { q: 'Khi chuyển hướng (rẽ trái, rẽ phải), người lái phải làm gì trước?', a: ['Bấm còi liên tục', 'Giảm tốc, có tín hiệu báo hướng rẽ, quan sát an toàn', 'Tăng tốc cho nhanh'], ok: 1, why: 'Phải giảm tốc độ, bật xi nhan báo hướng rẽ và quan sát, nhường người đi bộ, xe đi ngược chiều.' },
  { q: 'Bấm còi trong khu đông dân cư từ 22 giờ đến 5 giờ sáng được không?', a: ['Được thoải mái', 'Không được, trừ xe ưu tiên làm nhiệm vụ', 'Chỉ được bấm hai lần'], ok: 1, why: 'Cấm dùng còi trong khu đông dân cư từ 22 giờ đến 5 giờ, trừ xe ưu tiên đang làm nhiệm vụ.' },
  { q: 'Gặp vạch kẻ đường dành cho người đi bộ qua đường có người đang đi, bạn làm gì?', a: ['Bấm còi để họ tránh', 'Giảm tốc và dừng lại nhường người đi bộ', 'Lách qua phía sau họ'], ok: 1, why: 'Phải giảm tốc độ và nhường đường cho người đi bộ đang qua đường trên vạch.' },
  { q: 'Gây tai nạn giao thông rồi bỏ chạy để trốn tránh trách nhiệm thì sao?', a: ['Không sao nếu không ai thấy', 'Bị nghiêm cấm; phải dừng lại, giữ hiện trường, cấp cứu và báo cơ quan chức năng', 'Chỉ bồi thường sau'], ok: 1, why: 'Người gây tai nạn phải dừng ngay, giữ hiện trường, cấp cứu người bị nạn và báo công an. Bỏ trốn bị nghiêm cấm.', lie: true },
  { q: 'Đua xe, tổ chức đua xe trái phép trên đường bộ thì sao?', a: ['Được nếu đường vắng', 'Bị nghiêm cấm', 'Được nếu đội mũ'], ok: 1, why: 'Nghiêm cấm đua xe, cổ vũ, tổ chức đua xe trái phép.', lie: true },
  { q: 'Qua đường sắt không có rào chắn, khi có tàu đang tới bạn làm gì?', a: ['Tăng tốc vượt qua', 'Dừng cách ray gần nhất tối thiểu 5 m, chờ tàu qua', 'Bấm còi rồi đi'], ok: 1, why: 'Tàu hoả luôn được ưu tiên. Dừng xe cách ray gần nhất ít nhất 5 m, chờ tàu qua hẳn mới đi.' },
];

/** Câu riêng xe máy (hạng A1, A). */
const MOTO: QQ[] = [
  { q: 'Người ngồi trên xe mô tô, xe gắn máy có bắt buộc đội mũ bảo hiểm không?', a: ['Chỉ người lái', 'Người lái và người ngồi sau đều phải đội và cài quai đúng quy cách', 'Không bắt buộc trong nội thành'], ok: 1, why: 'Người lái và người được chở trên xe mô tô, xe gắn máy phải đội mũ bảo hiểm và cài quai đúng quy cách.', lie: true },
  { q: 'Xe mô tô hai bánh được chở tối đa mấy người (kể cả người lái) trong trường hợp thường?', a: ['2 người (thêm 1 trẻ em dưới 12 tuổi được phép)', '3 người lớn', '4 người'], ok: 0, why: 'Chỉ được chở một người; được chở tối đa hai người khi chở người bệnh đi cấp cứu, áp giải người, hoặc trẻ em dưới 12 tuổi.' },
  { q: 'Người lái xe mô tô có được buông cả hai tay khi đang chạy không?', a: ['Được nếu đường thẳng', 'Không được', 'Được khi chạy chậm'], ok: 1, why: 'Cấm buông cả hai tay, dùng chân điều khiển, nằm trên yên hay quay người về phía sau khi lái.', lie: true },
  { q: 'Xe mô tô, xe gắn máy có được đi vào đường cao tốc không?', a: ['Được', 'Không được', 'Được nếu trên 125 cm³'], ok: 1, why: 'Đường cao tốc chỉ dành cho ô tô và một số loại xe máy chuyên dùng; xe mô tô, xe gắn máy không được vào.' },
  { q: 'Hạng giấy phép A1 được lái loại xe nào?', a: ['Mô tô hai bánh dung tích đến 125 cm³ hoặc công suất điện đến 11 kW', 'Mọi loại mô tô', 'Ô tô dưới 9 chỗ'], ok: 0, why: 'Theo Luật 2024: A1 lái mô tô hai bánh đến 125 cm³ hoặc động cơ điện đến 11 kW.' },
  { q: 'Muốn lái mô tô 300 cm³ đi phượt, cần giấy phép hạng nào?', a: ['A1', 'A', 'B1'], ok: 1, why: 'Mô tô hai bánh trên 125 cm³ hoặc trên 11 kW cần hạng A (lái được cả xe hạng A1).' },
  { q: 'Tốc độ tối đa của xe gắn máy (dưới 50 cm³) là bao nhiêu?', a: ['40 km/h', '50 km/h', '60 km/h'], ok: 0, why: 'Xe gắn máy (kể cả xe máy điện) chạy tối đa 40 km/h.' },
  { q: 'Ngoài khu đông dân cư, trên đường đôi, mô tô chạy tối đa bao nhiêu (theo Thông tư 38/2024)?', a: ['60 km/h', '70 km/h', '90 km/h'], ok: 1, why: 'Ngoài khu đông dân cư, xe mô tô chạy tối đa 70 km/h, trừ khi biển báo cho phép khác.' },
  { q: 'Khi đi xe máy dưới trời mưa, đường trơn, bạn nên làm gì?', a: ['Phanh gấp khi vào cua', 'Giảm tốc từ xa, phanh nhẹ đều cả hai bánh, tránh nghiêng xe mạnh', 'Chỉ dùng phanh trước'], ok: 1, why: 'Mặt đường ướt làm bánh dễ trượt: giảm tốc sớm, phanh nhẹ và đều, vào cua chậm.' },
  { q: 'Phanh xe máy an toàn nhất là phanh thế nào?', a: ['Chỉ bóp phanh trước thật mạnh', 'Dùng đồng thời phanh trước và phanh sau, nhả ga trước', 'Chỉ đạp phanh sau'], ok: 1, why: 'Nhả ga, phanh đồng thời cả hai bánh để xe giảm tốc êm và không bị trượt.' },
  { q: 'Đi xe máy có được dùng ô (dù) hoặc điện thoại khi đang chạy không?', a: ['Được nếu cầm chắc', 'Không được', 'Chỉ được nghe điện thoại'], ok: 1, why: 'Cấm sử dụng ô, điện thoại di động, thiết bị âm thanh (trừ thiết bị trợ thính) khi điều khiển xe mô tô.' },
  { q: 'Xe máy kéo, đẩy xe khác hoặc chở vật cồng kềnh quá kích thước có được không?', a: ['Được', 'Không được', 'Được ban ngày'], ok: 1, why: 'Cấm kéo, đẩy xe khác, mang vác, chở vật cồng kềnh khi điều khiển xe mô tô.' },
  { q: 'Đi xe máy ban đêm cần bật đèn gì?', a: ['Không cần', 'Đèn chiếu sáng; gặp xe ngược chiều thì chuyển đèn chiếu gần', 'Chỉ bật đèn khẩn cấp'], ok: 1, why: 'Từ 18 giờ đến 6 giờ và khi trời tối phải bật đèn; gặp xe ngược chiều chuyển sang đèn chiếu gần.' },
  { q: 'Khi chuyển làn đường bằng xe máy, bạn phải làm gì?', a: ['Chuyển ngay', 'Có tín hiệu báo trước, quan sát gương, chỉ chuyển ở nơi được phép', 'Bấm còi rồi chuyển'], ok: 1, why: 'Chỉ chuyển làn ở nơi cho phép, có tín hiệu báo trước và bảo đảm an toàn.' },
  { q: 'Lên dốc cao bằng xe số, bạn nên làm gì?', a: ['Về số thấp, giữ ga đều', 'Để số cao cho nhanh', 'Tắt máy thả trôi'], ok: 0, why: 'Lên dốc dùng số thấp để xe có lực kéo, không chết máy. Xuống dốc cũng giữ số thấp, phanh nhẹ ngắt quãng.' },
  { q: 'Đổ đèo dài bằng xe máy, cách đúng là gì?', a: ['Tắt máy, về số 0 cho tiết kiệm', 'Giữ số thấp, phanh nhẹ ngắt quãng, không bóp phanh liên tục', 'Bóp chặt phanh sau cả đoạn'], ok: 1, why: 'Bóp phanh liên tục làm nóng má phanh, mất phanh. Giữ số thấp để máy ghìm xe, phanh nhẹ từng nhịp.' },
  { q: 'Đi xe máy trên đường có làn riêng cho xe thô sơ và xe máy, bạn đi làn nào?', a: ['Làn bên trái cùng', 'Làn bên phải dành cho xe máy theo vạch, biển', 'Làn nào cũng được'], ok: 1, why: 'Đi đúng làn quy định theo biển và vạch; xe chạy chậm đi về bên phải.' },
  { q: 'Bằng lái hạng A1 có thời hạn bao lâu?', a: ['5 năm', '10 năm', 'Không thời hạn'], ok: 2, why: 'Giấy phép hạng A1, A, B1 không có thời hạn.' },
];

/** Câu riêng ô tô (B, C1, C, CE), cộng thêm bộ QUIZ cũ trong vehicles.tsx (lấy lúc chạy để tránh vòng import). */
const CAR_OWN: QQ[] = [
  { q: 'Khi lùi xe ô tô, người lái phải làm gì?', a: ['Lùi nhanh cho xong', 'Quan sát phía sau, có tín hiệu cần thiết, khi đủ an toàn mới lùi', 'Bấm còi liên tục là đủ'], ok: 1, why: 'Phải quan sát hai bên và phía sau, có tín hiệu cần thiết; nơi khuất tầm nhìn cần người hướng dẫn.' },
  { q: 'Ô tô có được lùi xe ở nơi đường giao nhau, đường hẹp, đường dốc không?', a: ['Được', 'Không được', 'Được ban đêm'], ok: 1, why: 'Cấm lùi xe ở khu vực cấm dừng, phần đường dành cho người đi bộ, nơi giao nhau, nơi tầm nhìn bị che khuất, trong hầm, trên cao tốc.' },
  { q: 'Chở trẻ em dưới 10 tuổi và cao dưới 1,35 m trên ô tô, bé được ngồi đâu?', a: ['Ghế trước cạnh lái', 'Không ngồi hàng ghế trước (trừ xe một hàng ghế), phải dùng thiết bị an toàn phù hợp', 'Đâu cũng được'], ok: 1, why: 'Luật 2024: trẻ dưới 10 tuổi và thấp hơn 1,35 m không ngồi cùng hàng ghế với người lái và phải dùng thiết bị an toàn cho trẻ.' },
  { q: 'Xe tải chở hàng vượt quá chiều cao xếp hàng cho phép thì sao?', a: ['Được nếu chằng buộc chắc', 'Bị cấm', 'Được ban đêm'], ok: 1, why: 'Hàng xếp trên xe không được vượt quá kích thước giới hạn; vượt quá phải có giấy phép lưu hành.' },
  { q: 'Hạng C1 lái được xe tải có khối lượng toàn bộ theo thiết kế bao nhiêu?', a: ['Đến 3.500 kg', 'Trên 3.500 kg đến 7.500 kg', 'Trên 7.500 kg'], ok: 1, why: 'Hạng C1: ô tô tải trên 3.500 kg đến 7.500 kg; nặng hơn cần hạng C.' },
  { q: 'Muốn lái xe đầu kéo kéo sơ mi rơ moóc, cần hạng nào?', a: ['C', 'CE', 'C1'], ok: 1, why: 'Hạng CE: lái xe hạng C kéo rơ moóc có khối lượng theo thiết kế trên 750 kg, xe đầu kéo kéo sơ mi rơ moóc.' },
  { q: 'Dừng xe trên dốc, cách giữ xe an toàn là gì?', a: ['Để số 0, không kéo phanh tay', 'Kéo phanh tay, về số thích hợp, đánh lái bánh xe về phía lề', 'Chỉ đạp phanh chân'], ok: 1, why: 'Kéo phanh tay, cài số (lên dốc số 1, xuống dốc số lùi với xe số sàn), quay bánh về phía lề để xe không trôi.' },
  { q: 'Trên đường cao tốc, xe gặp sự cố phải dừng thì đặt biển cảnh báo cách xe bao xa?', a: ['10 m', 'Tối thiểu 150 m phía sau xe', '50 m'], ok: 1, why: 'Trên cao tốc, đặt biển hoặc tín hiệu cảnh báo phía sau xe tối thiểu 150 m và bật đèn khẩn cấp.' },
  { q: 'Lái ô tô qua đường ngập nước, bạn nên làm gì?', a: ['Chạy thật nhanh', 'Đi số thấp, giữ ga đều, không dừng giữa chừng', 'Tắt máy thả trôi'], ok: 1, why: 'Đi số thấp, giữ ga đều để nước không tràn vào ống xả; qua rồi rà phanh nhẹ cho khô má phanh.' },
  { q: 'Ô tô chạy trên cao tốc phải giữ khoảng cách an toàn ghi trên biển "Cự ly tối thiểu giữa hai xe" thế nào?', a: ['Không cần theo', 'Phải giữ khoảng cách không nhỏ hơn số ghi trên biển', 'Chỉ khi trời mưa'], ok: 1, why: 'Biển P.121 bắt buộc giữ khoảng cách tối thiểu giữa hai xe như ghi trên biển.' },
  { q: 'Người lái ô tô kinh doanh vận tải phải nghỉ bao lâu sau 4 giờ lái liên tục?', a: ['Ít nhất 15 phút', '5 phút', 'Không cần nghỉ'], ok: 0, why: 'Không lái liên tục quá 4 giờ; nghỉ ít nhất 15 phút giữa hai lần lái liên tục.' },
  { q: 'Ô tô vượt xe khác ở đâu thì bị cấm?', a: ['Trên đường thẳng rộng', 'Trên cầu hẹp có một làn xe, đường cong tầm nhìn hạn chế, đầu dốc, nơi giao nhau', 'Trên cao tốc khi có làn trống'], ok: 1, why: 'Cấm vượt trên cầu hẹp một làn, đường cong và đầu dốc tầm nhìn bị che khuất, nơi giao nhau, đường hẹp…' },
  { q: 'Đèn pha (chiếu xa) khi gặp xe ngược chiều ban đêm phải làm gì?', a: ['Giữ nguyên', 'Chuyển sang đèn chiếu gần', 'Tắt hết đèn'], ok: 1, why: 'Gặp xe ngược chiều phải chuyển từ đèn chiếu xa sang đèn chiếu gần để không làm loá mắt người kia.' },
  { q: 'Ô tô dừng, đỗ trên đường phố hai chiều được đỗ bên nào?', a: ['Bên trái', 'Bên phải theo chiều đi', 'Giữa đường'], ok: 1, why: 'Phải dừng, đỗ sát lề bên phải theo chiều đi của mình, nơi không có biển cấm dừng, cấm đỗ.' },
];

const shuffle = <T,>(xs: T[]): T[] => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Bộ câu hỏi cho một hạng (đúng một câu điểm liệt, đúng số câu theo bố cục đề, không trùng). */
export function examFor(cls: LicenseClass): { qs: QQ[]; spec: { questions: number; pass: number; minutes: number } } {
  const spec = THEORY_SPEC[cls];
  const own: QQ[] = isMotoClass(cls) || cls === 'B1' ? MOTO : [...QUIZ.map((c) => ({ ...c, a: [...c.a] })), ...CAR_OWN];
  const pool = [...own, ...COMMON];
  const lie = shuffle(pool.filter((q) => q.lie))[0];
  const rest = shuffle(pool.filter((q) => !q.lie)); // mỗi đề đúng một câu điểm liệt, như đề thi thật
  const n = Math.min(spec.questions, pool.length);
  return { qs: shuffle([lie, ...rest.slice(0, n - 1)]), spec: { ...spec, questions: n, pass: Math.min(spec.pass, n - Math.max(0, spec.questions - spec.pass)) } };
}
export const bankSize = () => ({ moto: MOTO.length + COMMON.length, car: QUIZ.length + CAR_OWN.length + COMMON.length });
