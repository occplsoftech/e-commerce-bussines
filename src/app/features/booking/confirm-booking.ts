import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PortalService } from '@core/services/portal.service';
import { RateOption, RateQuote } from '@core/models/portal.model';
import { BookingDraftService } from './booking-draft.service';
import { BookingSteps } from './booking-steps';

/** A fresh key per confirmation, reused for every retry of it (the server then returns the same booking). */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  return c?.randomUUID ? c.randomUUID() : `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

/** Step 4: review the shipment and the frozen price, then book once. */
import { CourierLogo } from '@shared/components/courier-logo';

@Component({
  selector: 'ecb-confirm-booking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CourierLogo, RouterLink, CurrencyPipe, DecimalPipe, BookingSteps],
  template: `
    <section class="page">
      <div class="page__head">
        <div><h1 class="text-display">Confirm booking</h1><p class="text-caption">Check the details, then book. You will not be charged twice if you click again.</p></div>
        <div class="page__actions"><a class="btn btn--ghost" [routerLink]="['/book/rates', quoteId()]">Back to rates</a></div>
      </div>
      <ecb-booking-steps [current]="3" />

      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }

      @if (option(); as o) {
        <div class="grid-2">
          <article class="app-card box">
            <h2 class="text-h2">Courier</h2>
            <p class="big"><ecb-courier-logo [code]="o.providerCode" [name]="o.providerName" /> {{ o.providerName }} <span class="text-caption">{{ o.serviceName }}</span></p>
            <table>
              <tbody>
                @for (l of o.breakdown; track $index) {
                  <tr><td>{{ l.label }}</td><td class="amt num-tabular">{{ l.amount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr>
                }
                <tr class="sum"><td>Total payable</td><td class="amt num-tabular">{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr>
              </tbody>
            </table>
            @if (o.providerCode === 'OCCPL_NETWORK') {
              <p class="alert alert--info">OCCPL collects the parcel from your pickup address; the tracking number is issued when it is collected.</p>
            }
          </article>
          <article class="app-card box">
            <h2 class="text-h2">Shipment</h2>
            @if (draft(); as d) {
              <dl>
                <dt>Pickup</dt><dd>{{ d.pickup.name }}, {{ d.pickup.phone }}<br>{{ d.pickup.address }}, {{ d.pickup.city }} {{ d.pickup.pincode }}</dd>
                <dt>Delivery</dt><dd>{{ d.delivery.name }}, {{ d.delivery.phone }}<br>{{ d.delivery.address }}, {{ d.delivery.city }} {{ d.delivery.pincode }}</dd>
                <dt>Package</dt><dd>{{ d.package.packageCount }} × {{ d.package.length }}×{{ d.package.breadth }}×{{ d.package.height }} {{ d.package.dimensionUnit === 'IN' ? 'in' : 'cm' }},
                  {{ d.package.actualWeightKg | number: '1.0-3' }} kg · {{ d.package.contents }}</dd>
                <dt>Value / payment</dt><dd>{{ d.package.declaredValue | currency: 'INR' : 'symbol' : '1.2-2' }} · {{ d.package.paymentMode === 'COD' ? 'Cash on delivery' : 'Prepaid' }}</dd>
              </dl>
            } @else {
              <p class="text-caption">Pincodes {{ quote()?.pickupPincode }} → {{ quote()?.deliveryPincode }}, {{ quote()?.packageCount }} package(s).</p>
            }
          </article>
        </div>
        <label class="agree"><input type="checkbox" [checked]="agreed()" (change)="agreed.set($any($event.target).checked)" />
          I confirm the details are correct and the contents are allowed for shipping.</label>
        <div class="actions">
          <button class="btn btn--primary" type="button" (click)="confirm()" [disabled]="!agreed() || submitting() || expired()">
            {{ submitting() ? 'Booking…' : 'Book for ' + (o.totalAmount | currency: o.currency : 'symbol' : '1.2-2') }}
          </button>
        </div>
        @if (expired()) { <p class="alert alert--warn">These rates have expired. Go back and refresh them.</p> }
      } @else if (!error()) {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  styles: [`
    .box { padding:20px; display:flex; flex-direction:column; gap:12px; }
    .box h2 { margin:0; }
    .big { font:700 18px var(--font-sans); margin:0; display:flex; align-items:center; gap:12px; }
    table { width:100%; border-collapse:collapse; font:400 13px var(--font-sans); }
    td { padding:6px 0; border-bottom:1px solid var(--surface-border); }
    .amt { text-align:right; }
    .sum td { font-weight:700; border-bottom:0; font-size:15px; }
    dl { margin:0; display:grid; grid-template-columns:max-content 1fr; gap:8px 16px; font:400 14px/1.5 var(--font-sans); }
    dt { font:600 12px var(--font-sans); color:var(--content-muted); text-transform:uppercase; letter-spacing:.04em; padding-top:2px; }
    dd { margin:0; overflow-wrap:anywhere; }
    .agree { display:flex; gap:10px; align-items:flex-start; font:500 14px var(--font-sans); }
    .actions { display:flex; justify-content:flex-end; }
    @media (max-width: 560px) { .actions .btn { width:100%; } dl { grid-template-columns:1fr; } }
  `]
})
export class ConfirmBooking implements OnInit {
  readonly quoteId = input.required<string>();
  readonly optionId = input.required<string>();
  private readonly portal = inject(PortalService);
  private readonly router = inject(Router);
  readonly draft = inject(BookingDraftService).draft;

  readonly quote = signal<RateQuote | null>(null);
  readonly error = signal<string | null>(null);
  readonly agreed = signal(false);
  readonly submitting = signal(false);
  readonly option = computed<RateOption | null>(() => this.quote()?.options.find((o) => o.optionId === this.optionId()) ?? null);
  readonly expired = computed(() => {
    const q = this.quote();
    return !!q && (q.status === 'EXPIRED' || new Date(q.expiresAt).getTime() <= Date.now());
  });
  /** One key for this confirmation; a retry after a network error reuses it. */
  private readonly key = newIdempotencyKey();

  ngOnInit(): void {
    this.portal.quote(this.quoteId()).subscribe({
      next: (q) => {
        this.quote.set(q);
        if (!this.option()) this.error.set('That courier service is not part of these rates. Go back and choose again.');
      },
      error: () => this.error.set('Could not load the rates.')
    });
  }

  confirm(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.portal.book(this.quoteId(), this.optionId(), this.key).subscribe({
      next: (b) => this.router.navigate(['/book/result', b.bookingId]),
      error: (e: HttpErrorResponse) => {
        this.submitting.set(false);
        const code = e.error?.errorCode as string | undefined;
        if (code === 'QUOTE_EXPIRED') this.error.set('These rates have expired. Go back and refresh them before booking.');
        else if (code === 'QUOTE_ALREADY_BOOKED') this.error.set('This quote has already been booked. Check your dashboard.');
        else if (e.status === 0 || e.status >= 500) this.error.set('We could not confirm the booking. Click Book again — you will not be booked twice.');
        else this.error.set(e.error?.message ?? 'The booking could not be made.');
      }
    });
  }
}
