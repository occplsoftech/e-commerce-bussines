import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BookingDetail } from '@core/models/portal.model';
import { code128B } from '@shared/utils/code128';

/** A 100 × 150 mm shipping label for a booking: where it goes, who it is for, and a scannable Code 128 of its reference. */
@Component({
  selector: 'ecb-shipping-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @let b = booking();
    <div class="ecb-label" role="document" [attr.aria-label]="'Shipping label ' + code()">
      <header class="l-head">
        <strong>OCCPL SOFTECH</strong>
        <span>{{ b.providerName }}{{ b.serviceName ? ' · ' + b.serviceName : '' }}</span>
      </header>

      <section class="l-to">
        <span class="l-k">Deliver to</span>
        <div class="l-name">{{ b.delivery.name }}</div>
        <div class="l-phone">{{ b.delivery.phone }}</div>
        <div class="l-addr">{{ b.delivery.address }}</div>
        <div class="l-city"><span>{{ b.delivery.city }}{{ b.delivery.state ? ', ' + b.delivery.state : '' }}</span><strong>{{ b.delivery.pincode }}</strong></div>
      </section>

      <section class="l-code">
        <svg [attr.viewBox]="'-10 0 ' + (barcode().width + 20) + ' 60'" preserveAspectRatio="none" role="img" [attr.aria-label]="code()">
          @for (r of barcode().bars; track r.x) { <rect [attr.x]="r.x" y="0" [attr.width]="r.w" height="60" /> }
        </svg>
        <div class="l-codetext">{{ code() }}</div>
      </section>

      <section class="l-grid">
        <div><span class="l-k">Weight</span><strong>{{ b.parcel?.chargeableWeightKg ?? b.parcel?.actualWeightKg ?? '—' }} kg</strong></div>
        <div><span class="l-k">Packages</span><strong>{{ b.parcel?.packageCount ?? 1 }}</strong></div>
        <div><span class="l-k">Payment</span><strong>{{ b.parcel?.paymentMode === 'COD' ? 'COD' : 'PREPAID' }}</strong></div>
        <div><span class="l-k">Booked</span><strong>{{ (b.bookedAt || b.createdAt) | date: 'dd MMM yyyy' }}</strong></div>
      </section>

      @if (b.parcel?.contents) { <div class="l-contents"><span class="l-k">Contents</span> {{ b.parcel!.contents }}</div> }

      <section class="l-from">
        <span class="l-k">From</span>
        {{ b.pickup.name }}, {{ b.pickup.phone }}<br>
        {{ b.pickup.address }}, {{ b.pickup.city }} {{ b.pickup.pincode }}
      </section>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .ecb-label { box-sizing:border-box; width:100mm; min-height:150mm; padding:4mm; background:#fff; color:#000; border:1.5px solid #000; display:flex; flex-direction:column; gap:2.5mm;
      font:400 9pt/1.3 Arial, Helvetica, sans-serif; }
    .l-head { display:flex; justify-content:space-between; align-items:baseline; gap:3mm; padding-bottom:2mm; border-bottom:2px solid #000; }
    .l-head strong { font-size:12pt; letter-spacing:.04em; }
    .l-head span { font-size:8pt; text-align:right; }
    .l-k { display:block; font-size:6.5pt; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#444; }
    .l-to { padding-bottom:2mm; border-bottom:1px dashed #000; }
    .l-name { font-size:13pt; font-weight:700; }
    .l-phone { font-size:9pt; }
    .l-addr { font-size:10pt; margin:1mm 0; overflow-wrap:anywhere; }
    .l-city { display:flex; justify-content:space-between; align-items:baseline; gap:3mm; font-size:10pt; }
    .l-city strong { font-size:20pt; letter-spacing:.06em; }
    .l-code svg { display:block; width:100%; height:16mm; fill:#000; }
    .l-codetext { text-align:center; font:700 10pt ui-monospace, Menlo, Consolas, monospace; letter-spacing:.08em; margin-top:1mm; }
    .l-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:2mm; padding:2mm 0; border-top:1px solid #000; border-bottom:1px solid #000; }
    .l-grid strong { font-size:9pt; }
    .l-contents { font-size:8.5pt; }
    .l-contents .l-k { display:inline; margin-right:1mm; }
    .l-from { margin-top:auto; font-size:8pt; padding-top:2mm; border-top:1px dashed #000; }
  `]
})
export class ShippingLabel {
  readonly booking = input.required<BookingDetail>();

  /** What the barcode carries: the tracking number once there is one, else the booking reference, else the booking id. */
  protected readonly code = computed(() => {
    const b = this.booking();
    return b.trackingNumber || b.bookingReference || b.bookingId;
  });
  protected readonly barcode = computed(() => code128B(this.code()));
}
