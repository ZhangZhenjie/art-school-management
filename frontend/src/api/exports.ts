import api from './client';

/** Trigger a browser download from an Axios `responseType: 'blob'` reply. */
function triggerDownload(blob: Blob, fallbackName: string, contentDisposition?: string) {
  let filename = fallbackName;
  if (contentDisposition) {
    // RFC 5987 — filename*=UTF-8''xxx
    const m = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (m) filename = decodeURIComponent(m[1]);
    else {
      const m2 = /filename="?([^";]+)"?/i.exec(contentDisposition);
      if (m2) filename = m2[1];
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function download(path: string, fallback: string, params?: Record<string, unknown>) {
  const res = await api.get(path, { params, responseType: 'blob' });
  triggerDownload(res.data as Blob, fallback, res.headers['content-disposition'] as string | undefined);
}

export const exportsApi = {
  students: () => download('/export/students', '学生及配套.xlsx'),
  monthlySessions: (month?: string) =>
    download('/export/monthly-sessions', `${month ?? 'current'}-课时消耗.xlsx`, month ? { month } : undefined),
  revenue: (month?: string) =>
    download('/export/revenue', `${month ?? 'current'}-营收明细.xlsx`, month ? { month } : undefined),
};
