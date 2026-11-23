// Trang thử sân sát hạch: /exam-test.html?cls=B|C1|C&auto=1 (tự lái mẫu ngay khi vào thi)
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExamGame } from './ExamGame.tsx';
import type { ExamResult } from './ExamGame.tsx';

function Test() {
  const q = new URLSearchParams(location.search);
  if (q.get('auto') === '1') (window as unknown as { __examAuto?: boolean }).__examAuto = true;
  const [res, setRes] = useState<ExamResult | null | 'dong'>(null);
  if (res) return <pre id="result" style={{ padding: 16 }}>{JSON.stringify(res, null, 1)}</pre>;
  return <ExamGame cls={q.get('cls') ?? 'B'} fee={Number(q.get('fee') ?? 0) || undefined} practiceOnly={q.get('tap') === '1'} onClose={(r) => setRes(r ?? 'dong')} />;
}
createRoot(document.getElementById('root')!).render(<Test />);
