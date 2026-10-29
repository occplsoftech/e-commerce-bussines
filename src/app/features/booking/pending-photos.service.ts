import { Injectable, signal } from '@angular/core';

export const MAX_PARCEL_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Parcel photos chosen while filling in the shipment, held in memory until the booking exists (a photo belongs to a booking).
 * The result page uploads them and clears this. Files cannot be kept across a page reload.
 */
@Injectable({ providedIn: 'root' })
export class PendingPhotos {
  private readonly _files = signal<File[]>([]);
  readonly files = this._files.asReadonly();

  /** Adds what can be kept; returns a message when something was left out. */
  add(list: FileList | File[]): string | null {
    const incoming = Array.from(list);
    const kept = [...this._files()];
    let skipped = 0;
    for (const f of incoming) {
      if (kept.length >= MAX_PARCEL_PHOTOS || !ACCEPTED.includes(f.type) || f.size > MAX_PHOTO_BYTES) { skipped++; continue; }
      kept.push(f);
    }
    this._files.set(kept);
    return skipped ? `${skipped} file(s) left out: photos only (JPEG, PNG or WebP), up to 5 MB each, at most ${MAX_PARCEL_PHOTOS}.` : null;
  }

  remove(index: number): void { this._files.set(this._files().filter((_, i) => i !== index)); }
  clear(): void { this._files.set([]); }
}
