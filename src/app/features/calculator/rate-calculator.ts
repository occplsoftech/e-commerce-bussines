import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { Icon } from '@shared/components/icon';
import { CourierLogo } from '@shared/components/courier-logo';
import { PortalService } from '@core/services/portal.service';
import { PincodeInfo, RateOption, RateQuote } from '@core/models/portal.model';
import { BookingDraftService } from '@features/booking/booking-draft.service';
import { TransportModePipe } from '@features/booking/transport-mode.pipe';
import { pincodeValidator, positiveNumber, wholeNumber } from '@features/booking/booking-validators';

type Lookup = { state: 'idle' } | { state: 'loading' } | { state: 'ok'; text: string } | { state: 'bad'; text: string };

/**
 * Rate calculator: two pincodes and a package give every courier's price at a glance — the quick check before booking.
 * "Book" carries the pincodes and package into the booking form, which asks for the addresses.
 */
@Component({
  selector: 'ecb-rate-calculator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, CourierLogo, ReactiveFormsModule, RouterLink, CurrencyPipe, DecimalPipe, TransportModePipe],
  template: `
    <div class="layout">
    <section class="calc">
      <header class="calc__banner">
        <span class="calc__badge"><ecb-icon name="calculate" /></span>
        <div>
          <h1>Rate calculator</h1>
          <p>Compare your couriers · rates only · GST inclusive</p>
        </div>
      </header>

      <div class="calc__body">
        <div class="tabs" role="tablist">
          <span class="tab tab--on" role="tab" aria-selected="true"><ecb-icon name="filter" /> Rate calculator</span>
          <a class="tab" routerLink="/book" role="tab" aria-selected="false"><ecb-icon name="bolt" /> Shipment booking</a>
        </div>

        <form [formGroup]="form" (ngSubmit)="check()" novalidate>
          <p class="step step--from"><span class="dot"></span> Step 1 — Pickup location</p>
          <input class="big" [class.big--ok]="from().state === 'ok'" formControlName="pickupPincode" inputmode="numeric" maxlength="6"
                 placeholder="Pickup pincode" aria-label="Pickup pincode" autocomplete="off" />
          <p class="lookup" [class.ok]="from().state === 'ok'" [class.bad]="from().state === 'bad'" aria-live="polite">
            @if (from().state === 'ok') { <ecb-icon name="check_circle" /> {{ lookupText(from()) }} }
            @else if (from().state === 'bad') { {{ lookupText(from()) }} }
          </p>

          <p class="step step--to"><span class="dot"></span> Step 2 — Where to deliver?</p>
          <input class="big" [class.big--ok]="to().state === 'ok'" formControlName="deliveryPincode" inputmode="numeric" maxlength="6"
                 placeholder="Delivery pincode" aria-label="Delivery pincode" autocomplete="off" />
          <p class="lookup" [class.ok]="to().state === 'ok'" [class.bad]="to().state === 'bad'" aria-live="polite">
            @if (to().state === 'ok') { <ecb-icon name="check_circle" /> {{ lookupText(to()) }} }
            @else if (to().state === 'bad') { {{ lookupText(to()) }} }
          </p>

          <p class="step step--pkg"><span class="dot"></span> Step 3 — Package</p>
          <div class="trio">
            <label class="chip chip--blue"><input type="number" min="1" max="999" step="1" formControlName="packageCount" inputmode="numeric" aria-label="Number of boxes" /><span>BX</span></label>
            <label class="chip chip--orange"><input type="number" min="0" step="0.001" formControlName="actualWeightKg" inputmode="decimal" aria-label="Total weight in kg" placeholder="Weight" /><span>KG</span></label>
            <label class="chip chip--green"><b>₹</b><input type="number" min="0" step="0.01" formControlName="declaredValue" inputmode="decimal" aria-label="Shipment value in rupees" placeholder="Value" /></label>
          </div>

          <div class="pair">
            <button class="outline" type="button" (click)="dims.set(!dims())" [attr.aria-expanded]="dims()">
              <ecb-icon [name]="dims() ? 'close' : 'add'" /> Dimensions
            </button>
            <button class="outline outline--warm" type="button" (click)="cod.set(!cod())" [attr.aria-pressed]="cod()">
              <ecb-icon [name]="cod() ? 'check_circle' : 'add'" /> {{ cod() ? 'Cash on delivery' : 'Services' }}
            </button>
          </div>

          @if (dims()) {
            <div class="dims" formGroupName="dimensions">
              <input type="number" min="0" step="0.1" formControlName="length" placeholder="Length" aria-label="Length" />
              <input type="number" min="0" step="0.1" formControlName="breadth" placeholder="Breadth" aria-label="Breadth" />
              <input type="number" min="0" step="0.1" formControlName="height" placeholder="Height" aria-label="Height" />
              <select formControlName="unit" aria-label="Dimension unit"><option value="CM">cm</option><option value="IN">in</option></select>
              <p class="hint">Per box. Without dimensions the weight you enter is used.</p>
            </div>
          }

          @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }

          <button class="go" type="submit" [disabled]="loading()">
            <ecb-icon name="filter" /> {{ loading() ? 'Checking rates…' : 'Check rates' }} <ecb-icon name="arrow_forward" />
          </button>
          <p class="note"><ecb-icon name="check_circle" /> Rates only · GST inclusive · Press Book on a rate to continue</p>
        </form>

      </div>
    </section>

    <section class="results" aria-live="polite" aria-label="Rates from all couriers">
      <header class="results__head">
        <h2>Rates from all couriers</h2>
        @if (quote(); as q) { <span class="results__count">{{ q.options.length }} {{ q.options.length === 1 ? 'rate' : 'rates' }}</span> }
      </header>
      @if (loading()) {
        <p class="results__hint">Asking every courier…</p>
      } @else if (!quote()) {
        <div class="results__empty">
          <ecb-icon name="local_shipping" />
          <p>Enter the pincodes and package on the left, then press <strong>Check rates</strong>. Every courier's price appears here.</p>
        </div>
      }
      @if (quote(); as q) {
        @if (modes().length > 1) {
          <div class="filters" role="group" aria-label="Filter by mode">
            <button type="button" class="pill" [class.pill--on]="mode() === ''" (click)="mode.set('')">All ({{ q.options.length }})</button>
            @for (m of modes(); track m.mode) {
              <button type="button" class="pill" [class.pill--on]="mode() === m.mode" (click)="mode.set(m.mode)">{{ m.mode | titlecaseMode }} ({{ m.count }})</button>
            }
          </div>
        }

        @if (q.options.length === 0) {
          <p class="empty">No courier could price this. Check the pincodes and weight, or try again later.</p>
        }

        @for (o of shown(); track $index; let first = $first) {
          <article class="rate">
            <div class="rate__top">
              <ecb-courier-logo [code]="o.providerCode" [name]="o.providerName" style="--logo-size:2.75rem" />
              <div class="rate__who">
                <h2>{{ o.providerName }}</h2>
                <p>{{ o.serviceName }}{{ o.transportMode ? ' · ' + (o.transportMode | titlecaseMode) : '' }}</p>
              </div>
              <div class="rate__price">
                @if (o === cheapest()) { <span class="lowest">↓ Lowest</span> }
                <strong>{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</strong>
                @if (o.chargeableWeightKg) { <small>@{{ o.totalAmount / o.chargeableWeightKg | currency: o.currency : 'symbol' : '1.2-2' }}/Kg</small> }
              </div>
            </div>
            <div class="rate__meta">
              @if (o.etaMinDays) { <span><ecb-icon name="schedule" /> {{ o.etaMinDays }}{{ o.etaMaxDays && o.etaMaxDays !== o.etaMinDays ? ' - ' + o.etaMaxDays : '' }} days</span> }
              @if (o.chargeableWeightKg) { <span>Chargeable {{ o.chargeableWeightKg | number: '1.0-3' }} kg</span> }
              <details class="rate__breakup">
                <summary>View breakup →</summary>
                <table>
                  <tbody>
                    @for (l of o.breakdown; track $index) { <tr><td>{{ l.label }}</td><td class="amt">{{ l.amount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr> }
                    <tr class="sum"><td>Total</td><td class="amt">{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr>
                  </tbody>
                </table>
              </details>
            </div>
            <button class="book" type="button" (click)="book()">Book — {{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</button>
          </article>
        }

        @if (q.unavailable.length) {
          <p class="unavail">Not available: @for (u of q.unavailable; track u.providerCode; let last = $last) { <strong>{{ u.providerName }}</strong>{{ last ? '' : ', ' }} }</p>
        }
      }
    </section>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .layout { display:grid; grid-template-columns:minmax(0, 27rem) minmax(0, 1fr); gap:20px; align-items:start; max-width:76rem; margin:0 auto; }
    .calc { position:sticky; top:96px; background:var(--occpl-color-surface); border:1px solid var(--surface-border); border-radius:28px; overflow:hidden; box-shadow:var(--occpl-shadow-md); }
    .calc__banner { display:flex; align-items:center; gap:16px; padding:22px 24px; color:#fff; background:var(--occpl-gradient-brand); }
    .calc__banner h1 { margin:0; font:800 1.4rem var(--font-display); letter-spacing:.04em; text-transform:uppercase; }
    .calc__banner p { margin:2px 0 0; opacity:.85; font-size:.95rem; }
    .calc__badge { display:grid; place-items:center; width:3.25rem; height:3.25rem; border-radius:16px; background:rgb(255 255 255 / 18%); font-size:1.5rem; }
    .calc__body { padding:20px 24px 28px; display:flex; flex-direction:column; gap:12px; }
    .tabs { display:grid; grid-template-columns:1fr 1fr; padding:6px; border-radius:20px; background:var(--occpl-color-neutral-surface); }
    .tab { display:flex; align-items:center; justify-content:center; gap:8px; min-height:2.75rem; border-radius:16px; text-decoration:none; font:700 .85rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; color:var(--content-muted); }
    .tab--on { background:var(--occpl-color-text); color:var(--occpl-color-surface); }
    form { display:flex; flex-direction:column; gap:8px; }
    .step { display:flex; align-items:center; gap:8px; margin:8px 0 0; font:800 .85rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; }
    .dot { width:.55rem; height:.55rem; border-radius:50%; background:currentColor; }
    .step--from { color:var(--occpl-color-teal); } .step--to { color:var(--occpl-color-primary); } .step--pkg { color:var(--content-fg); }
    .big { width:100%; min-height:3.6rem; padding:0 22px; border:3px solid var(--surface-border); border-radius:20px; font:800 1.5rem var(--font-sans); background:var(--occpl-color-surface); color:var(--content-fg); }
    .big--ok { border-color:var(--occpl-color-teal); }
    .big:focus-visible { outline:none; border-color:var(--occpl-color-accent); box-shadow:0 0 0 4px var(--occpl-color-info-surface); }
    .lookup { display:flex; align-items:center; gap:8px; min-height:1.5rem; margin:0; font:700 1rem var(--font-sans); }
    .lookup.ok { color:var(--occpl-color-teal); } .lookup.bad { color:var(--danger); }
    .trio { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
    .chip { display:flex; align-items:center; gap:6px; min-height:3.4rem; padding:0 16px; border:2px solid; border-radius:18px; font:800 .75rem var(--font-sans); }
    .chip input { flex:1; min-width:0; width:100%; border:0; background:transparent; font:800 1.4rem var(--font-sans); color:inherit; padding:0; min-height:0; box-shadow:none; }
    .chip input:focus-visible { outline:none; box-shadow:none; }
    .chip b { font-size:1.2rem; }
    .chip--blue { border-color:#bfd2fb; background:#f3f7ff; color:#1d4ed8; }
    .chip--orange { border-color:#fde1c8; background:#fffaf4; color:#ea580c; }
    .chip--green { border-color:#c7ecdc; background:#f4fcf8; color:#0b7a55; }
    .pair { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .outline { display:flex; align-items:center; justify-content:center; gap:8px; min-height:3.2rem; border:3px solid var(--surface-border); border-radius:18px; background:transparent; font:800 .95rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; color:var(--content-fg); cursor:pointer; }
    .outline--warm { border-color:#f9c9b0; color:#ea580c; }
    .dims { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)) 5rem; gap:10px; }
    .dims .hint { grid-column:1 / -1; margin:0; font-size:.85rem; color:var(--content-muted); }
    .go { display:flex; align-items:center; justify-content:center; gap:10px; min-height:3.6rem; margin-top:6px; border:0; border-radius:22px; background:var(--occpl-gradient-button); color:#fff; font:800 1.1rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; cursor:pointer; box-shadow:var(--occpl-shadow-md); }
    .go:disabled { opacity:.6; cursor:wait; }
    .note { display:flex; align-items:center; justify-content:center; gap:8px; margin:0; font-size:.9rem; color:var(--content-muted); text-align:center; }
    .results { display:flex; flex-direction:column; gap:12px; min-width:0; }
    .results__head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 4px; }
    .results__head h2 { margin:0; font:800 1.2rem var(--font-display); text-transform:uppercase; letter-spacing:.04em; }
    .results__count { padding:4px 12px; border-radius:999px; background:var(--occpl-color-info-surface); color:var(--occpl-color-accent); font:700 .8rem var(--font-sans); }
    .results__empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:56px 24px; text-align:center; color:var(--content-muted); border:2px dashed var(--surface-border); border-radius:24px; font-size:2.2rem; }
    .results__empty p { margin:0; font-size:1rem; max-width:24rem; }
    .results__hint { margin:0; color:var(--content-muted); }
    .filters { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
    .pill { padding:8px 18px; border:0; border-radius:14px; background:var(--occpl-color-neutral-surface); color:var(--content-muted); font:800 .8rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
    .pill--on { background:var(--occpl-color-text); color:var(--occpl-color-surface); }
    .rate { border:2px solid var(--surface-border); border-radius:24px; overflow:hidden; background:var(--occpl-color-surface); }
    .rate__top { display:flex; gap:14px; align-items:flex-start; padding:18px 20px 8px; }
    .rate__who { flex:1; min-width:0; }
    .rate__who h2 { margin:0; font:800 1.15rem var(--font-display); text-transform:uppercase; }
    .rate__who p { margin:2px 0 0; color:var(--content-muted); }
    .rate__price { display:flex; flex-direction:column; align-items:flex-end; }
    .rate__price strong { font:800 1.7rem var(--font-display); }
    .rate__price small { color:var(--content-muted); }
    .lowest { padding:2px 10px; border-radius:8px; background:var(--occpl-color-success-surface); color:var(--occpl-color-success); border:1px solid var(--occpl-color-success); font:800 .7rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; }
    .rate__meta { display:flex; align-items:center; gap:16px; flex-wrap:wrap; padding:4px 20px 16px; color:var(--content-muted); }
    .rate__meta span { display:inline-flex; align-items:center; gap:6px; }
    .rate__breakup { margin-left:auto; }
    .rate__breakup summary { cursor:pointer; color:var(--occpl-color-primary); font:800 .8rem var(--font-sans); letter-spacing:.06em; text-transform:uppercase; }
    .rate__breakup table { margin-top:8px; border-collapse:collapse; font-size:.9rem; color:var(--content-fg); }
    .rate__breakup td { padding:4px 0; border-bottom:1px solid var(--surface-border); }
    .rate__breakup .amt { text-align:right; padding-left:24px; }
    .rate__breakup .sum td { font-weight:700; border-bottom:0; }
    .book { width:100%; min-height:3.2rem; border:0; background:var(--occpl-gradient-button); color:#fff; font:800 1rem var(--font-sans); letter-spacing:.1em; text-transform:uppercase; cursor:pointer; }
    .empty, .unavail { margin:8px 0 0; color:var(--content-muted); text-align:center; }
    @media (max-width: 64rem) { .layout { grid-template-columns:minmax(0, 1fr); } .calc { position:static; } }
    @media (max-width: 560px) { .calc__body { padding:16px; } .big { font-size:1.25rem; } .rate__top { flex-wrap:wrap; } .rate__price { align-items:flex-start; } }
  `]
})
export class RateCalculator {
  private readonly fb = inject(FormBuilder);
  private readonly portal = inject(PortalService);
  private readonly router = inject(Router);
  private readonly drafts = inject(BookingDraftService);

  readonly dims = signal(false);
  readonly cod = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly quote = signal<RateQuote | null>(null);
  readonly mode = signal('');

  readonly form = this.fb.nonNullable.group({
    pickupPincode: ['', [Validators.required, pincodeValidator]],
    deliveryPincode: ['', [Validators.required, pincodeValidator]],
    packageCount: [1, [Validators.required, wholeNumber(1, 999)]],
    actualWeightKg: this.fb.control<number | null>(null, [Validators.required, positiveNumber(1000, 3)]),
    declaredValue: this.fb.control<number | null>(null, [Validators.required, positiveNumber(10_000_000, 2)]),
    dimensions: this.fb.group({
      length: this.fb.control<number | null>(null, [positiveNumber(500, 1)]),
      breadth: this.fb.control<number | null>(null, [positiveNumber(500, 1)]),
      height: this.fb.control<number | null>(null, [positiveNumber(500, 1)]),
      unit: this.fb.nonNullable.control<'CM' | 'IN'>('CM')
    })
  });

  readonly from = this.lookup('pickupPincode');
  readonly to = this.lookup('deliveryPincode');

  readonly cheapest = computed<RateOption | null>(() => {
    const opts = this.quote()?.options ?? [];
    return opts.length ? opts.reduce((a, b) => (b.totalAmount < a.totalAmount ? b : a)) : null;
  });
  readonly modes = computed(() => {
    const counts = new Map<string, number>();
    for (const o of this.quote()?.options ?? []) counts.set(o.transportMode ?? 'OTHER', (counts.get(o.transportMode ?? 'OTHER') ?? 0) + 1);
    return [...counts].map(([mode, count]) => ({ mode, count }));
  });
  readonly shown = computed(() => (this.quote()?.options ?? []).filter((o) => !this.mode() || (o.transportMode ?? 'OTHER') === this.mode()));

  protected lookupText(l: Lookup): string { return l.state === 'ok' || l.state === 'bad' ? l.text : ''; }

  /** City and state next to a pincode as soon as six digits are typed. */
  private lookup(control: 'pickupPincode' | 'deliveryPincode') {
    return toSignal(
      this.form.controls[control].valueChanges.pipe(
        map((v) => String(v ?? '').trim()),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((v): import('rxjs').Observable<Lookup> => {
          if (!/^[1-9][0-9]{5}$/.test(v)) return of<Lookup>({ state: 'idle' });
          return this.portal.pincode(v).pipe(
            map((info: PincodeInfo): Lookup => info.known
              ? { state: 'ok', text: [info.area, info.city ?? info.district].filter(Boolean).join(', ') || v }
              : { state: 'bad', text: 'Pincode not found in our directory' }),
            catchError(() => of<Lookup>({ state: 'idle' }))
          );
        })
      ),
      { initialValue: { state: 'idle' } as Lookup }
    );
  }

  check(): void {
    this.error.set(null);
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Enter both pincodes, the number of boxes, the weight and the value.'); return; }
    const v = this.form.getRawValue();
    const d = v.dimensions;
    const haveDims = d.length && d.breadth && d.height;
    this.loading.set(true);
    this.portal.estimateRates({
      pickupPincode: v.pickupPincode.trim(), deliveryPincode: v.deliveryPincode.trim(), packageCount: v.packageCount,
      actualWeightKg: v.actualWeightKg!, declaredValue: v.declaredValue!,
      length: haveDims ? d.length : null, breadth: haveDims ? d.breadth : null, height: haveDims ? d.height : null,
      dimensionUnit: d.unit, paymentMode: this.cod() ? 'COD' : 'PREPAID'
    }).subscribe({
      next: (q) => { this.loading.set(false); this.mode.set(''); this.quote.set(q); },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.status === 400 || e.status === 422 || e.status === 429
          ? (e.error?.message ?? 'Please check the details.') : 'Rates could not be checked right now. Please try again.');
      }
    });
  }

  /** Carries the pincodes and package into the booking form, which asks for the addresses. */
  book(): void {
    const v = this.form.getRawValue();
    const d = v.dimensions;
    const empty = { name: '', phone: '', address: '', city: '', state: '' };
    this.drafts.save({
      pickup: { ...empty, pincode: v.pickupPincode.trim() },
      delivery: { ...empty, pincode: v.deliveryPincode.trim() },
      package: {
        actualWeightKg: v.actualWeightKg, length: d.length, breadth: d.breadth, height: d.height, dimensionUnit: d.unit,
        packageCount: v.packageCount, contents: '', declaredValue: v.declaredValue, paymentMode: this.cod() ? 'COD' : 'PREPAID'
      }
    });
    this.router.navigate(['/book']);
  }
}
