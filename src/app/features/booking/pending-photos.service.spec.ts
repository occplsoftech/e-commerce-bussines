import { PendingPhotos, MAX_PARCEL_PHOTOS } from './pending-photos.service';
import { PaymentIconPipe, PaymentLabelPipe } from './payment-mode.pipe';

const file = (name: string, type: string, size = 1000) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('PendingPhotos', () => {
  it('keeps photos only, up to the limit, each up to 5 MB', () => {
    const p = new PendingPhotos();
    const note = p.add([file('a.jpg', 'image/jpeg'), file('b.pdf', 'application/pdf'), file('c.png', 'image/png', 6 * 1024 * 1024), file('d.webp', 'image/webp')]);
    expect(p.files().map((f) => f.name)).toEqual(['a.jpg', 'd.webp']);
    expect(note).toContain('2 file(s) left out');
    p.add(Array.from({ length: 10 }, (_, i) => file(`x${i}.jpg`, 'image/jpeg')));
    expect(p.files().length).toBe(MAX_PARCEL_PHOTOS);
  });

  it('removes one and clears all', () => {
    const p = new PendingPhotos();
    p.add([file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg')]);
    p.remove(0);
    expect(p.files().map((f) => f.name)).toEqual(['b.jpg']);
    p.clear();
    expect(p.files()).toEqual([]);
  });
});

describe('payment mode pipes', () => {
  it('reads Prepaid, To Pay and Cash on delivery', () => {
    const label = new PaymentLabelPipe(), icon = new PaymentIconPipe();
    expect(label.transform('PREPAID')).toBe('Prepaid');
    expect(label.transform('TOPAY')).toBe('To Pay');
    expect(label.transform('COD')).toBe('Cash on delivery');
    expect(label.transform(null)).toBe('Prepaid');
    expect(icon.transform('TOPAY')).toBe('sell');
  });
});
