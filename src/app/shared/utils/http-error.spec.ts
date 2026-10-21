import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from './http-error';

describe('errorMessage', () => {
  it('reads the message from a JSON error body', async () => {
    const e = new HttpErrorResponse({ status: 422, error: { message: 'Pincode not found' } });
    expect(await errorMessage(e, 'fallback')).toBe('Pincode not found');
  });

  it('reads the message from a Blob body (file downloads)', async () => {
    const blob = new Blob([JSON.stringify({ message: 'Shiprocket has not generated the label yet.' })], { type: 'application/json' });
    const e = new HttpErrorResponse({ status: 422, error: blob });
    expect(await errorMessage(e, 'fallback')).toBe('Shiprocket has not generated the label yet.');
  });

  it('falls back for anything else', async () => {
    expect(await errorMessage(new HttpErrorResponse({ status: 500, error: new Blob(['oops']) }), 'fallback')).toBe('fallback');
    expect(await errorMessage(new Error('x'), 'fallback')).toBe('fallback');
  });
});
