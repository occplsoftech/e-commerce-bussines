import { HttpErrorResponse } from '@angular/common/http';

/**
 * The server's message from an error response, also when the request expected a file (the body is then a
 * Blob holding the JSON error). Falls back to {@code fallback}.
 */
export async function errorMessage(err: unknown, fallback: string): Promise<string> {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  const body = err.error;
  if (body instanceof Blob) {
    try {
      const parsed = JSON.parse(await readText(body));
      return typeof parsed?.message === 'string' ? parsed.message : fallback;
    } catch {
      return fallback;
    }
  }
  return typeof body?.message === 'string' ? body.message : fallback;
}

function readText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Saves a downloaded file under {@code fileName} without leaving it in memory. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
