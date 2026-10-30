import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { MAX_PARCEL_PHOTOS, PendingPhotos } from './pending-photos.service';

/** Step 1: optional photos of the parcel. They are uploaded once the booking is made, and pickup staff see them. */
@Component({
  selector: 'ecb-photo-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="pp">
      <div class="pp__head">
        <span class="lbl">Parcel photos <span class="opt">(optional)</span></span>
        <span class="hint">Pickup staff see these. Up to {{ max }}, 5 MB each.</span>
      </div>
      <ul class="pp__grid">
        @for (t of thumbs(); track t.url; let i = $index) {
          <li><img [src]="t.url" [alt]="t.name" /><button type="button" (click)="remove(i)" [attr.aria-label]="'Remove ' + t.name"><ecb-icon name="close" /></button></li>
        }
        @if (thumbs().length < max) {
          <li class="pp__add">
            <label>
              <ecb-icon name="add_box" /><span>Add photos</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="pick($event)" />
            </label>
          </li>
        }
      </ul>
      @if (notice()) { <p class="pp__note" role="status">{{ notice() }}</p> }
    </div>
  `,
  styles: [`
    .pp { display:flex; flex-direction:column; gap:10px; }
    .pp__head { display:flex; flex-wrap:wrap; gap:4px 12px; align-items:baseline; }
    .lbl { font:600 .85rem var(--font-sans); } .opt { font-weight:400; color:var(--content-muted); }
    .hint { font:400 12px var(--font-sans); color:var(--content-muted); }
    .pp__grid { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fill, minmax(96px, 1fr)); gap:10px; }
    .pp__grid li { position:relative; aspect-ratio:1; border-radius:12px; overflow:hidden; border:1px solid var(--surface-border); background:var(--occpl-color-neutral-surface); }
    .pp__grid img { width:100%; height:100%; object-fit:cover; display:block; }
    .pp__grid button { position:absolute; top:4px; right:4px; width:1.7rem; height:1.7rem; border:0; border-radius:50%; background:rgb(0 0 0 / 60%); color:#fff; cursor:pointer; display:grid; place-items:center; font-size:.95rem; }
    .pp__add { border:2px dashed var(--surface-border) !important; background:transparent !important; }
    .pp__add:hover { border-color:var(--occpl-color-primary) !important; }
    .pp__add label { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; cursor:pointer; color:var(--occpl-color-primary); font:600 .78rem var(--font-sans); text-align:center; }
    .pp__add ecb-icon { font-size:1.5rem; }
    .pp__add input { position:absolute; inset:0; opacity:0; cursor:pointer; }
    .pp__note { margin:0; font:500 .8rem var(--font-sans); color:var(--warning); }
  `]
})
export class PhotoPicker implements OnDestroy {
  private readonly pending = inject(PendingPhotos);
  protected readonly max = MAX_PARCEL_PHOTOS;
  protected readonly notice = signal<string | null>(null);
  private urls: string[] = [];
  protected readonly thumbs = signal<{ url: string; name: string }[]>([]);

  constructor() {
    effect(() => {
      const files = this.pending.files();
      this.urls.forEach((u) => URL.revokeObjectURL(u));
      this.urls = files.map((f) => URL.createObjectURL(f));
      this.thumbs.set(files.map((f, i) => ({ url: this.urls[i], name: f.name })));
    });
  }

  protected pick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.files) this.notice.set(this.pending.add(input.files));
    input.value = '';
  }

  protected remove(i: number): void { this.pending.remove(i); this.notice.set(null); }

  ngOnDestroy(): void { this.urls.forEach((u) => URL.revokeObjectURL(u)); }
}
