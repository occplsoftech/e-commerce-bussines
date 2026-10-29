import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PortalService } from '@core/services/portal.service';
import { RateOption, RateQuote } from '@core/models/portal.model';
import { BookingDraftService } from './booking-draft.service';
import { BookingSteps } from './booking-steps';
import { RouteBanner } from './route-banner';
import { Icon } from '@shared/components/icon';

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
  imports: [CourierLogo, Icon, RouterLink, CurrencyPipe, DecimalPipe, BookingSteps, RouteBanner],
  template: `
    <section class="page">
      <div class="page__head">
        <div><h1 class="text-display">Confirm booking</h1><p class="text-caption">One last look. You will not be charged twice if you click again.</p></div>
        <div class="page__actions"><a class="btn btn--ghost" [routerLink]="['/book/rates', quoteId()]">Back to rates</a></div>
      </div>
      <ecb-booking-steps [current]="2" />

      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
      @if (walletProblem()) { <p><a class="btn btn--primary" routerLink="/wallet">Add money to your wallet</a></p> }

      @if (option(); as o) {
        <ecb-route-banner [fromPin]="quote()?.pickupPincode" [fromPlace]="draft() ? draft()!.pickup.city : ''" [toPin]="quote()?.deliveryPincode" [toPlace]="draft() ? draft()!.delivery.city : ''" />

        <div class="grid-2 cols">
          <article class="app-card ticket">
            <header class="ticket__head">
              <ecb-courier-logo [code]="o.providerCode" [name]="o.providerName" style="--logo-size:3.4rem" />
              <div><div class="ticket__name">{{ o.providerName }}</div><div class="text-caption">{{ o.serviceName }}</div></div>
            </header>
            <table>
              <tbody>
                @for (l of o.breakdown; track $index) {
                  <tr><td>{{ l.label }}</td><td class="amt num-tabular">{{ l.amount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr>
                }
              </tbody>
            </table>
            <div class="ticket__total">
              <span>Total payable</span>
              <strong class="num-tabular">{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</strong>
            </div>
            @if (o.providerCode === 'OCCPL_NETWORK') {
              <p class="note"><ecb-icon name="local_shipping" /> OCCPL collects the parcel from your pickup address; the tracking number is issued when it is collected.</p>
            }
          </article>

          <article class="app-card ship">
            <h2 class="text-h2">Shipment</h2>
            @if (draft(); as d) {
              <ol class="tl">
                <li class="tl__from">
                  <span class="tl__dot"><ecb-icon name="location_on" /></span>
                  <div><span class="tl__k">Pickup</span>
                    <strong>{{ d.pickup.name }}</strong> <span class="ph"><ecb-icon name="call" /> {{ d.pickup.phone }}</span>
                    <div class="adr">{{ d.pickup.address }}, {{ d.pickup.city }} {{ d.pickup.pincode }}</div></div>
                </li>
                <li class="tl__to">
                  <span class="tl__dot tl__dot--to"><ecb-icon name="home" /></span>
                  <div><span class="tl__k">Delivery</span>
                    <strong>{{ d.delivery.name }}</strong> <span class="ph"><ecb-icon name="call" /> {{ d.delivery.phone }}</span>
                    <div class="adr">{{ d.delivery.address }}, {{ d.delivery.city }} {{ d.delivery.pincode }}</div></div>
                </li>
              </ol>
              <ul class="facts">
                <li><ecb-icon name="inventory_2" /> {{ d.package.packageCount }} × {{ d.package.length }}×{{ d.package.breadth }}×{{ d.package.height }} {{ d.package.dimensionUnit === 'IN' ? 'in' : 'cm' }}</li>
                <li><ecb-icon name="scale" /> {{ d.package.actualWeightKg | number: '1.0-3' }} kg</li>
                <li><ecb-icon name="description" /> {{ d.package.contents }}</li>
                <li><ecb-icon name="sell" /> {{ d.package.declaredValue | currency: 'INR' : 'symbol' : '1.2-2' }}</li>
                <li><ecb-icon [name]="d.package.paymentMode === 'COD' ? 'payments' : 'account_balance_wallet'" /> {{ d.package.paymentMode === 'COD' ? 'Cash on delivery' : 'Prepaid' }}</li>
              </ul>
            } @else {
              <p class="text-caption">Pincodes {{ quote()?.pickupPincode }} → {{ quote()?.deliveryPincode }}, {{ quote()?.packageCount }} package(s).</p>
            }
          </article>
        </div>

        <label class="agree" [class.on]="agreed()"><input type="checkbox" [checked]="agreed()" (change)="agreed.set($any($event.target).checked)" />
          <span>I confirm the details are correct and the contents are allowed for shipping.</span></label>
        <ul class="trust">
          <li><ecb-icon name="verified_user" /> The price is final</li>
          <li><ecb-icon name="refresh" /> Safe to retry: never booked twice</li>
        </ul>
        <div class="actions">
          <button class="btn btn--primary btn--cta" type="button" (click)="confirm()" [disabled]="!agreed() || submitting() || expired()">
            {{ submitting() ? 'Booking…' : 'Book for ' + (o.totalAmount | currency: o.currency : 'symbol' : '1.2-2') }} <ecb-icon name="arrow_forward" />
          </button>
        </div>
        @if (expired()) { <p class="alert alert--warn">These rates have expired. Go back and refresh them.</p> }
      } @else if (!error()) {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  styles: [`
    .cols { align-items:start; }
    .ticket { padding:0; overflow:hidden; display:flex; flex-direction:column; }
    .ticket__head { display:flex; align-items:center; gap:14px; padding:18px 22px; background:var(--occpl-color-neutral-surface); border-bottom:2px dashed var(--surface-border); }
    .ticket__name { font:700 1.15rem var(--font-display); }
    .ticket table { width:100%; border-collapse:collapse; font:400 14px var(--font-sans); margin:6px 0; }
    .ticket td { padding:9px 22px; border-bottom:1px solid var(--surface-border); }
    .ticket tr:last-child td { border-bottom:0; }
    .amt { text-align:right; }
    .ticket__total { display:flex; justify-content:space-between; align-items:center; padding:18px 22px; color:#fff; background:var(--occpl-gradient-brand); }
    .ticket__total span { font:600 .85rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; opacity:.9; }
    .ticket__total strong { font:800 1.9rem var(--font-display); }
    .note { margin:0; padding:14px 22px; display:flex; gap:10px; align-items:flex-start; background:var(--occpl-color-info-surface); color:var(--occpl-color-accent); font:500 .85rem/1.5 var(--font-sans); }
    .ship { padding:22px; display:flex; flex-direction:column; gap:16px; }
    .ship h2 { margin:0; }
    .tl { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:0; }
    .tl li { position:relative; display:flex; gap:14px; padding-bottom:22px; }
    .tl li:last-child { padding-bottom:0; }
    .tl li:not(:last-child)::before { content:''; position:absolute; left:1.15rem; top:2.4rem; bottom:.2rem; border-left:3px dotted var(--surface-border); }
    .tl__dot { display:grid; place-items:center; flex:none; width:2.4rem; height:2.4rem; border-radius:50%; background:var(--occpl-color-teal); color:#fff; font-size:1.1rem; }
    .tl__dot--to { background:var(--occpl-color-accent); }
    .tl__k { display:block; font:700 .72rem var(--font-sans); letter-spacing:.1em; text-transform:uppercase; color:var(--content-muted); }
    .ph { display:inline-flex; align-items:center; gap:4px; font:500 .85rem var(--font-sans); color:var(--content-muted); margin-left:6px; }
    .adr { font:400 .9rem/1.5 var(--font-sans); overflow-wrap:anywhere; }
    .facts { list-style:none; margin:0; padding:14px 0 0; border-top:1px solid var(--surface-border); display:flex; flex-wrap:wrap; gap:8px; }
    .facts li { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; background:var(--occpl-color-neutral-surface); font:600 .82rem var(--font-sans); }
    .agree { display:flex; gap:12px; align-items:flex-start; padding:14px 16px; border:2px solid var(--surface-border); border-radius:var(--r-card); font:500 14px var(--font-sans); cursor:pointer; background:var(--surface); transition:border-color .15s, background .15s; }
    .agree.on { border-color:var(--success); background:var(--success-bg, #e3f6ec); }
    .agree input { margin-top:3px; accent-color:var(--occpl-color-primary); width:1.1rem; height:1.1rem; }
    .trust { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:8px 20px; font:500 .8rem var(--font-sans); color:var(--content-muted); }
    .trust li { display:inline-flex; align-items:center; gap:6px; }
    .trust ecb-icon { color:var(--success); }
    .actions { display:flex; justify-content:flex-end; }
    .btn--cta { padding-inline:2.2rem; font-size:1.05rem; box-shadow:0 10px 24px rgb(214 31 69 / 30%); }
    @media (max-width: 560px) { .actions .btn { width:100%; } }
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
  /** The wallet could not pay (short balance, suspended): the customer can fix that on the wallet page and come back. */
  readonly walletProblem = computed(() => /wallet/i.test(this.error() ?? ''));
  /**
   * One key per attempt. A retry after a network error or a server error reuses it (the server may have booked, and answers with
   * that booking). A definite refusal (4xx) starts a new key: the refused attempt is on record as failed under the old one, so
   * reusing it after the customer tops up the wallet would only return that failed booking.
   */
  private key = newIdempotencyKey();

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
        if (e.status >= 400 && e.status < 500) this.key = newIdempotencyKey();
        if (code === 'QUOTE_EXPIRED') this.error.set('These rates have expired. Go back and refresh them before booking.');
        else if (code === 'QUOTE_ALREADY_BOOKED') this.error.set('This quote has already been booked. Check your dashboard.');
        else if (e.status === 0 || e.status >= 500) this.error.set('We could not confirm the booking. Click Book again — you will not be booked twice.');
        else this.error.set(e.error?.message ?? 'The booking could not be made.');
      }
    });
  }
}
