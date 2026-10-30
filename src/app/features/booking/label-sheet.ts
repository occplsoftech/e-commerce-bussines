import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { BookingDetail } from '@core/models/portal.model';
import { ShippingLabel } from './shipping-label';

/**
 * The shipping labels of a booking (one per package) with a Print button. Printing copies the labels into a body-level container
 * that the global print rule (styles.scss) shows alone, four to an A4 sheet.
 */
@Component({
  selector: 'ecb-label-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ShippingLabel],
  template: `
    <section class="labelbox">
      <div class="labelbox__bar">
        <div><strong>{{ count() > 1 ? count() + ' shipping labels' : 'Shipping label' }}</strong>
          <span class="text-caption"> Prints on A4, four to a sheet. {{ count() > 1 ? 'One for each package: cut along the dashed lines and stick each on its own box.' : 'Cut along the dashed lines and stick it on the parcel.' }}</span></div>
        <button class="btn btn--primary" type="button" (click)="print()"><ecb-icon name="print" /> Print{{ count() > 1 ? ' all ' + count() : '' }}</button>
      </div>
      @for (n of numbers(); track n) { <ecb-shipping-label [booking]="booking()" [index]="n" [total]="count()" /> }
    </section>
  `,
  styles: [`
    .labelbox { display:flex; flex-direction:column; align-items:center; gap:14px; padding:18px; border:1px dashed var(--surface-border); border-radius:var(--r-card); background:var(--occpl-color-neutral-surface); }
    .labelbox__bar { width:100%; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
    .labelbox ecb-shipping-label { box-shadow:var(--shadow-md); max-width:100%; overflow-x:auto; }
  `]
})
export class LabelSheet {
  readonly booking = input.required<BookingDetail>();
  protected readonly count = computed(() => Math.max(1, Math.min(999, Number(this.booking().parcel?.packageCount ?? 1) || 1)));
  protected readonly numbers = computed(() => Array.from({ length: this.count() }, (_, i) => i + 1));

  /** Copies the labels, four to a sheet, into #ecb-print-root, prints, and cleans up afterwards. */
  print(): void {
    const root = document.createElement('div');
    root.id = 'ecb-print-root';
    let sheet: HTMLElement | null = null;
    document.querySelectorAll('.labelbox .ecb-label').forEach((l, i) => {
      if (i % 4 === 0) { sheet = document.createElement('div'); sheet.className = 'ecb-sheet'; root.appendChild(sheet); }
      sheet!.appendChild(l.cloneNode(true));
    });
    document.body.appendChild(root);
    document.body.classList.add('printing-label');
    const done = () => { document.body.classList.remove('printing-label'); root.remove(); };
    window.addEventListener('afterprint', done, { once: true });
    window.print();
  }
}
