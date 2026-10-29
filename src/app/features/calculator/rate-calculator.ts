import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InternationalRates } from './international-rates';
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
 * Rate calculator: two pincodes and a package give every courier's price at a glance — the quick check before booking. The
 * International tab prices shipments abroad (sKart).
 * "Book" carries the pincodes and package into the booking form, which asks for the addresses.
 */
@Component({
  selector: 'ecb-rate-calculator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, CourierLogo, ReactiveFormsModule, RouterLink, CurrencyPipe, DecimalPipe, TransportModePipe, InternationalRates],
  template: `
    <section class="calc">
      <header class="calc__title">
        <span class="calc__badge"><ecb-icon name="calculate" /></span>
        <div>
          <h1>Rate calculator</h1>
          <p>Compare your couriers · rates only · GST inclusive</p>
        </div>
        <a class="calc__link" routerLink="/book"><ecb-icon name="bolt" /> Shipment booking</a>
      </header>

      <div class="scope" role="tablist" aria-label="Where to">
        <button type="button" role="tab" class="scope__tab" [class.scope__tab--on]="scope() === 'domestic'"
                [attr.aria-selected]="scope() === 'domestic'" (click)="setScope('domestic')">Domestic</button>
        <button type="button" role="tab" class="scope__tab" [class.scope__tab--on]="scope() === 'international'"
                [attr.aria-selected]="scope() === 'international'" (click)="setScope('international')">International</button>
      </div>

      @if (scope() === 'international') {
        <ecb-international-rates />
      } @else {

      <form class="bar" [formGroup]="form" (ngSubmit)="check()" novalidate>
        <div class="bar__row">
          <div class="f f--wide">
            <label for="rc-from">From pincode</label>
            <input id="rc-from" [class.ok]="from().state === 'ok'" formControlName="pickupPincode" inputmode="numeric" maxlength="6" placeholder="Pickup" autocomplete="off" />
            <p class="look" [class.ok]="from().state === 'ok'" [class.bad]="from().state === 'bad'" aria-live="polite">
              @if (from().state === 'ok') { <ecb-icon name="check_circle" /> {{ lookupText(from()) }} } @else if (from().state === 'bad') { {{ lookupText(from()) }} }
            </p>
          </div>
          <div class="f f--wide">
            <label for="rc-to">To pincode</label>
            <input id="rc-to" [class.ok]="to().state === 'ok'" formControlName="deliveryPincode" inputmode="numeric" maxlength="6" placeholder="Delivery" autocomplete="off" />
            <p class="look" [class.ok]="to().state === 'ok'" [class.bad]="to().state === 'bad'" aria-live="polite">
              @if (to().state === 'ok') { <ecb-icon name="check_circle" /> {{ lookupText(to()) }} } @else if (to().state === 'bad') { {{ lookupText(to()) }} }
            </p>
          </div>
          <div class="f">
            <label for="rc-boxes">Boxes</label>
            <input id="rc-boxes" type="number" min="1" max="999" step="1" formControlName="packageCount" inputmode="numeric" />
          </div>
          <div class="f">
            <label for="rc-kg">Weight (kg)</label>
            <input id="rc-kg" type="number" min="0" step="0.001" formControlName="actualWeightKg" inputmode="decimal" placeholder="Total" />
          </div>
          <div class="f">
            <label for="rc-val">Value (₹)</label>
            <input id="rc-val" type="number" min="0" step="0.01" formControlName="declaredValue" inputmode="decimal" placeholder="Shipment" />
          </div>
          <button class="go" type="submit" [disabled]="loading()">{{ loading() ? 'Checking…' : 'Check rates' }}</button>
        </div>

        <div class="bar__opts">
          <button class="opt" type="button" (click)="dims.set(!dims())" [attr.aria-expanded]="dims()"><ecb-icon [name]="dims() ? 'close' : 'add'" /> Dimensions</button>
          <button class="opt opt--warm" type="button" (click)="cod.set(!cod())" [attr.aria-pressed]="cod()"><ecb-icon [name]="cod() ? 'check_circle' : 'add'" /> {{ cod() ? 'Cash on delivery' : 'Cash on delivery?' }}</button>
          @if (dims()) {
            <span class="dims" formGroupName="dimensions">
              <input type="number" min="0" step="0.1" formControlName="length" placeholder="L" aria-label="Length" />
              <input type="number" min="0" step="0.1" formControlName="breadth" placeholder="B" aria-label="Breadth" />
              <input type="number" min="0" step="0.1" formControlName="height" placeholder="H" aria-label="Height" />
              <select formControlName="unit" aria-label="Dimension unit"><option value="CM">cm</option><option value="IN">in</option></select>
              <small>per box; without them the weight is used</small>
            </span>
          }
        </div>
        @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
      </form>

      <div class="toolbar" aria-live="polite">
        @if (quote(); as q) {
          <div class="filters" role="group" aria-label="Filter by mode">
            <button type="button" class="pill" [class.pill--on]="mode() === ''" (click)="mode.set('')">All ({{ q.options.length }})</button>
            @for (m of modes(); track m.mode) {
              <button type="button" class="pill" [class.pill--on]="mode() === m.mode" (click)="mode.set(m.mode)">{{ m.mode | titlecaseMode }} ({{ m.count }})</button>
            }
          </div>
          <label class="sort">Sort
            <select [value]="sort()" (change)="sort.set($any($event.target).value)" aria-label="Sort rates">
              <option value="price">Lowest price</option>
              <option value="fastest">Fastest delivery</option>
              <option value="name">Courier name</option>
            </select>
          </label>
        }
      </div>

      @if (loading()) {
        <p class="hint">Asking every courier…</p>
      } @else if (!quote()) {
        <div class="empty">
          <ecb-icon name="local_shipping" />
          <p>Enter the route and package above and press <strong>Check rates</strong> — every courier's price appears here.</p>
        </div>
      } @else {
        @if (quote()!.options.length === 0) {
          <p class="hint">No courier could price this. Check the pincodes and weight, or try again later.</p>
        }
        <div class="grid">
          @for (o of shown(); track $index) {
            <article class="rate">
              @if (o === cheapest()) { <span class="lowest">↓ Lowest</span> }
              <ecb-courier-logo [code]="o.providerCode" [name]="o.providerName" style="--logo-size:2.75rem" />
              <h2>{{ o.providerName }}</h2>
              <p class="rate__svc">{{ o.serviceName }}{{ o.transportMode ? ' · ' + (o.transportMode | titlecaseMode) : '' }}@if (o.etaMinDays) { · {{ o.etaMinDays }}{{ o.etaMaxDays && o.etaMaxDays !== o.etaMinDays ? '–' + o.etaMaxDays : '' }} days }</p>
              <strong class="rate__price">{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</strong>
              @if (o.chargeableWeightKg) { <small>{{ o.totalAmount / o.chargeableWeightKg | currency: o.currency : 'symbol' : '1.2-2' }} / kg · {{ o.chargeableWeightKg | number: '1.0-3' }} kg chargeable</small> }
              <details class="rate__breakup">
                <summary>View breakup →</summary>
                <table>
                  <tbody>
                    @for (l of o.breakdown; track $index) { <tr><td>{{ l.label }}</td><td class="amt">{{ l.amount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr> }
                    <tr class="sum"><td>Total</td><td class="amt">{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr>
                  </tbody>
                </table>
              </details>
              <button class="book" type="button" (click)="book()">Book</button>
            </article>
          }
        </div>
        @if (quote()!.unavailable.length) {
          <p class="hint">Not available: @for (u of quote()!.unavailable; track u.providerCode; let last = $last) { <strong>{{ u.providerName }}</strong>{{ last ? '' : ', ' }} }</p>
        }
      }
      }
    </section>
  `,
  styles: [`
    :host { display:block; }
    .calc { max-width:80rem; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
    .calc__title { display:flex; align-items:center; gap:14px; }
    .calc__title h1 { margin:0; font:800 1.5rem var(--font-display); letter-spacing:.04em; text-transform:uppercase; }
    .calc__title p { margin:2px 0 0; color:var(--content-muted); }
    .calc__badge { display:grid; place-items:center; width:3rem; height:3rem; border-radius:16px; background:var(--occpl-gradient-brand); color:#fff; font-size:1.4rem; }
    .calc__link { margin-left:auto; display:inline-flex; align-items:center; gap:8px; font:700 .85rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; text-decoration:none; }
    .scope { display:inline-flex; align-self:flex-start; gap:4px; padding:4px; border-radius:16px; background:var(--occpl-color-neutral-surface); }
    .scope__tab { min-height:2.5rem; padding:0 22px; border:0; border-radius:12px; background:transparent; color:var(--content-muted); font:800 .85rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
    .scope__tab--on { background:var(--occpl-color-surface); color:var(--occpl-color-primary); box-shadow:var(--occpl-shadow-sm); }
    .bar { background:var(--occpl-color-surface); border:1px solid var(--surface-border); border-top:5px solid var(--occpl-color-primary); border-radius:24px; padding:18px 20px; box-shadow:var(--occpl-shadow-md); display:flex; flex-direction:column; gap:12px; }
    .bar__row { display:grid; grid-template-columns:1.3fr 1.3fr .6fr .8fr .9fr auto; gap:12px; align-items:start; }
    .f { display:flex; flex-direction:column; gap:6px; min-width:0; }
    .f label { font:700 .75rem var(--font-sans); letter-spacing:.1em; text-transform:uppercase; color:var(--content-muted); }
    .f input { width:100%; min-height:3.25rem; padding:0 16px; border:2px solid var(--surface-border); border-radius:14px; font:800 1.15rem var(--font-sans); background:var(--occpl-color-surface); color:var(--content-fg); }
    .f input.ok { border-color:var(--occpl-color-teal); }
    .f input:focus-visible { outline:none; border-color:var(--occpl-color-accent); box-shadow:0 0 0 4px var(--occpl-color-info-surface); }
    .look { display:flex; align-items:center; gap:6px; min-height:1.25rem; margin:0; font:700 .85rem var(--font-sans); }
    .look.ok { color:var(--occpl-color-teal); } .look.bad { color:var(--danger); }
    .go { align-self:start; margin-top:1.45rem; min-height:3.25rem; padding:0 26px; border:0; border-radius:14px; background:var(--occpl-gradient-button); color:#fff; font:800 .95rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
    .go:disabled { opacity:.6; cursor:wait; }
    .bar__opts { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .opt { display:inline-flex; align-items:center; gap:6px; min-height:2.25rem; padding:0 14px; border:2px solid var(--surface-border); border-radius:12px; background:transparent; font:700 .8rem var(--font-sans); letter-spacing:.06em; text-transform:uppercase; color:var(--content-fg); cursor:pointer; }
    .opt--warm { border-color:#f9c9b0; color:#ea580c; }
    .dims { display:inline-flex; align-items:center; gap:8px; }
    .dims input, .dims select { width:4.5rem; min-height:2.25rem; padding:0 10px; border:2px solid var(--surface-border); border-radius:10px; font:600 .95rem var(--font-sans); background:var(--occpl-color-surface); color:var(--content-fg); }
    .dims small { color:var(--content-muted); }
    .toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; min-height:2.25rem; }
    .filters { display:flex; gap:8px; flex-wrap:wrap; }
    .pill { padding:8px 18px; border:0; border-radius:14px; background:var(--occpl-color-neutral-surface); color:var(--content-muted); font:800 .8rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
    .pill--on { background:var(--occpl-color-text); color:var(--occpl-color-surface); }
    .sort { display:inline-flex; align-items:center; gap:8px; font:600 .9rem var(--font-sans); color:var(--content-muted); }
    .sort select { min-height:2.25rem; padding:0 12px; border:1px solid var(--surface-border); border-radius:10px; background:var(--occpl-color-surface); color:var(--content-fg); font:inherit; }
    .grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:16px; }
    .rate { position:relative; display:flex; flex-direction:column; gap:4px; padding:20px; background:var(--occpl-color-surface); border:1px solid var(--surface-border); border-radius:22px; box-shadow:var(--occpl-shadow-sm); }
    .rate h2 { margin:10px 0 0; font:800 1.15rem var(--font-display); text-transform:uppercase; }
    .rate__svc { margin:0; color:var(--content-muted); }
    .rate__price { margin-top:14px; font:800 1.7rem var(--font-display); }
    .rate small { color:var(--content-muted); }
    .lowest { position:absolute; top:16px; right:16px; padding:2px 10px; border-radius:8px; background:var(--occpl-color-success-surface); color:var(--occpl-color-success); border:1px solid var(--occpl-color-success); font:800 .7rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; }
    .rate__breakup { margin-top:8px; }
    .rate__breakup summary { cursor:pointer; color:var(--occpl-color-primary); font:800 .8rem var(--font-sans); letter-spacing:.06em; text-transform:uppercase; }
    .rate__breakup table { margin-top:8px; width:100%; border-collapse:collapse; font-size:.9rem; }
    .rate__breakup td { padding:4px 0; border-bottom:1px solid var(--surface-border); }
    .rate__breakup .amt { text-align:right; }
    .rate__breakup .sum td { font-weight:700; border-bottom:0; }
    .book { margin-top:auto; padding-top:0; min-height:3rem; border:0; border-radius:14px; background:var(--occpl-gradient-button); color:#fff; font:800 .95rem var(--font-sans); letter-spacing:.1em; text-transform:uppercase; cursor:pointer; margin-top:14px; }
    .hint { margin:0; color:var(--content-muted); text-align:center; }
    .empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:56px 24px; text-align:center; color:var(--content-muted); border:2px dashed var(--surface-border); border-radius:24px; font-size:2.2rem; }
    .empty p { margin:0; font-size:1rem; max-width:26rem; }
    @media (max-width: 70rem) { .bar__row { grid-template-columns:repeat(3, minmax(0, 1fr)); } .go { margin-top:0; grid-column:1 / -1; } .grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 40rem) { .bar__row { grid-template-columns:repeat(2, minmax(0, 1fr)); } .f--wide { grid-column:1 / -1; } .grid { grid-template-columns:minmax(0, 1fr); } .calc__link { display:none; } }
  `]
})
export class RateCalculator {
  private readonly fb = inject(FormBuilder);
  private readonly portal = inject(PortalService);
  private readonly router = inject(Router);
  private readonly drafts = inject(BookingDraftService);
  private readonly route = inject(ActivatedRoute);

  /** Domestic (Indian pincodes) or international (sKart); kept in the address as ?scope=international. */
  readonly scope = signal<'domestic' | 'international'>(
    this.route.snapshot.queryParamMap.get('scope') === 'international' ? 'international' : 'domestic');

  readonly dims = signal(false);
  readonly cod = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly quote = signal<RateQuote | null>(null);
  readonly mode = signal('');
  readonly sort = signal<'price' | 'fastest' | 'name'>('price');

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
  readonly shown = computed(() => {
    const list = (this.quote()?.options ?? []).filter((o) => !this.mode() || (o.transportMode ?? 'OTHER') === this.mode());
    const by = this.sort();
    return [...list].sort((a, b) => by === 'name' ? a.providerName.localeCompare(b.providerName)
      : by === 'fastest' ? (a.etaMinDays ?? 99) - (b.etaMinDays ?? 99) || a.totalAmount - b.totalAmount
      : a.totalAmount - b.totalAmount);
  });

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

  setScope(scope: 'domestic' | 'international'): void {
    this.scope.set(scope);
    this.router.navigate([], { queryParams: { scope: scope === 'international' ? 'international' : null }, replaceUrl: true });
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
