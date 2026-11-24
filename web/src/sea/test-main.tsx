// Trang thử biển mở (chỉ có khi chạy Vite dev): sea-test.html?che=tau&tuyen=hp_catba&di=dao|ve[&tu=1][&nhanh=4]
// hoặc ?che=jet&bai=my_khe. tu=1: tự lái theo luồng; nhanh=n: chạy n bước vật lý mỗi khung (máy thử chậm).
import { createRoot } from 'react-dom/client';
import { SeaRide } from './SeaRide.tsx';
import '../styles.css';

const q = new URLSearchParams(location.search), w = window as unknown as { __seaAuto?: boolean; __seaFast?: number; __seaDone?: unknown };
if (q.get('tu') === '1') w.__seaAuto = true;
if (q.get('nhanh')) w.__seaFast = Number(q.get('nhanh')) || 1;
const done = (s: unknown) => { w.__seaDone = s; document.title = 'XONG'; };
const root = createRoot(document.getElementById('root')!);
if (q.get('che') === 'jet') root.render(<SeaRide mode="jetski" beachId={q.get('bai') ?? 'my_khe'} endsAt={Date.now() + 15 * 60_000} onDone={done} />);
else root.render(<SeaRide mode="ferry" routeId={q.get('tuyen') ?? 'hp_catba'} toIsland={q.get('di') !== 've'} cargo={{ group: 'tai_nhe', color: 0xf08a6c }} onDone={done} onCancel={() => { document.title = 'HUY'; }} />);
