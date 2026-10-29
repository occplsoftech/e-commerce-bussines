import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { PortalService } from '@core/services/portal.service';
import { BookingPhoto } from '@core/models/portal.model';
import { errorMessage } from '@shared/utils/http-error';
import { HttpErrorResponse } from '@angular/common/http';
import { MAX_PARCEL_PHOTOS, MAX_PHOTO_BYTES, PendingPhotos } from './pending-photos.service';

/**
 * The photos on a booking: the ones picked while booking are uploaded when this opens (`uploadPending`), and the customer can add
 * more or remove any until the booking is closed. Pickup staff see the parcel photos on the pickup request.
 */
@Component({
  selector: 'ecb-booking-photos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <section class="bp">
      <div class="bp__head">
        <h2 class="text-h2">Parcel photos</h2>
        <span class="text-caption">{{ parcel().length }} of {{ max }}</span>
      </div>
      @if (busy()) { <p class="text-caption" role="status">Uploading photos…</p> }
      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
      <ul class="bp__grid">
        @for (p of parcel(); track p.id) {
          <li>
            @if (urls()[p.id]; as u) { <a [href]="u" target="_blank" rel="noopener"><img [src]="u" [alt]="p.fileName" /></a> } @else { <span class="bp__ph"><ecb-icon name="inventory_2" /></span> }
            @if (editable()) { <button type="button" (click)="remove(p)" [attr.aria-label]="'Remove ' + p.fileName"><ecb-icon name="close" /></button> }
          </li>
        }
        @if (editable() && parcel().length < max) {
          <li class="bp__add">
            <label><ecb-icon name="add_box" /><span>Add photos</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="pick($event)" [disabled]="busy()" /></label>
          </li>
        }
      </ul>
      @if (!parcel().length && !editable()) { <p class="text-caption">No photos were added.</p> }
    </section>
  `,
  styles: [`
    .bp { display:flex; flex-direction:column; gap:12px; }
    .bp__head { display:flex; justify-content:space-between; align-items:baseline; gap:8px; } .bp__head h2 { margin:0; }
    .bp__grid { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:10px; }
    .bp__grid li { position:relative; aspect-ratio:1; border-radius:12px; overflow:hidden; border:1px solid var(--surface-border); background:var(--occpl-color-neutral-surface); }
    .bp__grid img { width:100%; height:100%; object-fit:cover; display:block; }
    .bp__ph { position:absolute; inset:0; display:grid; place-items:center; color:var(--content-muted); font-size:1.6rem; }
    .bp__grid button { position:absolute; top:4px; right:4px; width:1.7rem; height:1.7rem; border:0; border-radius:50%; background:rgb(0 0 0 / 60%); color:#fff; cursor:pointer; display:grid; place-items:center; }
    .bp__add { border:2px dashed var(--surface-border) !important; background:transparent !important; }
    .bp__add:hover { border-color:var(--occpl-color-primary) !important; }
    .bp__add label { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; cursor:pointer; color:var(--occpl-color-primary); font:600 .78rem var(--font-sans); }
    .bp__add ecb-icon { font-size:1.5rem; }
    .bp__add input { position:absolute; inset:0; opacity:0; cursor:pointer; }
  `]
})
export class BookingPhotos implements OnInit {
  readonly bookingId = input.required<string>();
  /** Upload the photos picked while booking (the result page); the detail page only shows and edits. */
  readonly uploadPending = input(false);
  /** False once the booking is closed (a failed booking takes none). */
  readonly editable = input(true);

  private readonly portal = inject(PortalService);
  private readonly pending = inject(PendingPhotos);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly max = MAX_PARCEL_PHOTOS;
  protected readonly parcel = signal<BookingPhoto[]>([]);
  protected readonly urls = signal<Record<string, string>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => Object.values(this.urls()).forEach((u) => URL.revokeObjectURL(u)));
    this.load();
  }

  private load(): void {
    this.portal.photos(this.bookingId()).subscribe({
      next: (list) => { this.parcel.set(list.filter((p) => p.kind === 'PARCEL')); this.parcel().forEach((p) => this.fetch(p)); if (this.uploadPending()) void this.uploadPendingFiles(); },
      error: () => { this.error.set('Photos could not be loaded.'); if (this.uploadPending()) void this.uploadPendingFiles(); }
    });
  }

  private fetch(p: BookingPhoto): void {
    if (this.urls()[p.id]) return;
    this.portal.photoFile(this.bookingId(), p.id).subscribe({
      next: (blob) => this.urls.update((u) => ({ ...u, [p.id]: URL.createObjectURL(blob) })),
      error: () => undefined
    });
  }

  private async uploadPendingFiles(): Promise<void> {
    const files = [...this.pending.files()];
    if (!files.length) return;
    this.pending.clear();
    await this.uploadAll(files);
  }

  protected pick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    input.value = '';
    const room = this.max - this.parcel().length;
    const ok = chosen.filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= MAX_PHOTO_BYTES).slice(0, room);
    this.error.set(ok.length < chosen.length ? 'Some files were left out: photos only (JPEG, PNG or WebP), up to 5 MB each.' : null);
    if (ok.length) void this.uploadAll(ok);
  }

  private async uploadAll(files: File[]): Promise<void> {
    this.busy.set(true);
    for (const f of files) {
      try {
        const p = await new Promise<BookingPhoto>((res, rej) => this.portal.uploadPhoto(this.bookingId(), f).subscribe({ next: res, error: rej }));
        this.parcel.update((l) => [...l, p]);
        this.fetch(p);
      } catch (e) {
        this.error.set(await errorMessage(e as HttpErrorResponse, `${f.name} could not be uploaded.`));
        break;
      }
    }
    this.busy.set(false);
  }

  protected remove(p: BookingPhoto): void {
    this.portal.deletePhoto(this.bookingId(), p.id).subscribe({
      next: () => this.parcel.update((l) => l.filter((x) => x.id !== p.id)),
      error: async (e: HttpErrorResponse) => this.error.set(await errorMessage(e, 'The photo could not be removed.'))
    });
  }
}
