import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Icon } from '@shared/components/icon';
import { CourierLogo } from '@shared/components/courier-logo';
import { PortalService } from '@core/services/portal.service';
import { InternationalCountry, InternationalKind, RateOption, RateQuote } from '@core/models/portal.model';
import { pincodeValidator, positiveNumber, wholeNumber } from '@features/booking/booking-validators';

/**
 * International rate calculator (sKart): pickup pincode, destination country and postcode, and the parcel give each
 * international service's price (DHL, FedEx, Aramex, Skynet…), GST and markup included. Rates only for now: international
 * booking comes later.
 */
@Component({
  selector: 'ecb-international-rates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, CourierLogo, ReactiveFormsModule, CurrencyPipe],
  template: `
    @if (countries() !== null && countries()!.length === 0) {
      <div class="empty">
        <ecb-icon name="local_shipping" />
        <p>International rates are not available yet. Your courier company has not connected an international courier.</p>
      </div>
    } @else {
      <form class="bar" [formGroup]="form" (ngSubmit)="check()" novalidate>
        <div class="bar__row">
          <div class="f">
            <label for="ir-from">From pincode</label>
            <input id="ir-from" formControlName="originPincode" inputmode="numeric" maxlength="6" placeholder="Pickup" autocomplete="off" />
          </div>
          <div class="f">
            <label for="ir-country">To country</label>
            <input id="ir-country" formControlName="destinationCountry" list="ir-countries" placeholder="Type to search" autocomplete="off" />
            <datalist id="ir-countries">
              @for (c of countries() ?? []; track c.id) { <option [value]="c.name">{{ c.region }}</option> }
            </datalist>
          </div>
          <div class="f">
            <label for="ir-zip">Postcode</label>
            <input id="ir-zip" formControlName="destinationPostcode" maxlength="20" [placeholder]="postcodeNeeded() ? 'Required' : 'Optional'" autocomplete="off" />
          </div>
          <div class="f">
            <label for="ir-kind">Type</label>
            <select id="ir-kind" formControlName="kind">
              <option value="PARCEL">Parcel</option>
              <option value="DOCUMENT">Document</option>
              <option value="COMMERCIAL">Commercial</option>
            </select>
          </div>
          <div class="f">
            <label for="ir-kg">Weight (kg)</label>
            <input id="ir-kg" type="number" min="0" step="0.01" formControlName="weightKg" inputmode="decimal" placeholder="Total" />
          </div>
          @if (form.controls.kind.value !== 'DOCUMENT') {
            <div class="f">
              <label for="ir-pcs">Pieces</label>
              <input id="ir-pcs" type="number" min="1" max="99" step="1" formControlName="pieces" inputmode="numeric" />
            </div>
            <div class="f">
              <label for="ir-len">Longest side (cm)</label>
              <input id="ir-len" type="number" min="0" step="1" formControlName="maxLengthCm" inputmode="numeric" placeholder="Optional" />
            </div>
          }
          <button class="go" type="submit" [class.go--wide]="form.controls.kind.value === 'DOCUMENT'" [disabled]="loading()">{{ loading() ? 'Checking…' : 'Check rates' }}</button>
        </div>
        @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
      </form>

      @if (loading()) {
        <p class="hint">Asking the international couriers…</p>
      } @else if (!quote()) {
        <div class="empty">
          <ecb-icon name="local_shipping" />
          <p>Choose the country and parcel above and press <strong>Check rates</strong> — DHL, FedEx, Aramex and more appear here.</p>
        </div>
      } @else {
        @if (quote()!.options.length === 0) {
          <p class="hint">No international service could price this. Check the country, postcode and weight.</p>
        }
        <div class="grid">
          @for (o of shown(); track $index) {
            <article class="rate">
              @if (o === cheapest()) { <span class="lowest">↓ Lowest</span> }
              <ecb-courier-logo [code]="o.providerCode" [name]="o.providerName" style="--logo-size:2.75rem" />
              <h2>{{ o.serviceName }}</h2>
              <p class="rate__svc">{{ o.providerName }}@if (o.etaMaxDays) { · {{ o.etaMaxDays }} days }</p>
              <strong class="rate__price">{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</strong>
              <small>GST included</small>
              <details class="rate__breakup">
                <summary>View breakup →</summary>
                <table>
                  <tbody>
                    @for (l of o.breakdown; track $index) { <tr><td>{{ l.label }}</td><td class="amt">{{ l.amount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr> }
                    <tr class="sum"><td>Total</td><td class="amt">{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr>
                  </tbody>
                </table>
              </details>
            </article>
          }
        </div>
        @if (quote()!.unavailable.length) {
          <p class="hint">Not available: @for (u of quote()!.unavailable; track u.providerCode; let last = $last) { <strong>{{ u.providerName }}</strong> ({{ u.reason }}){{ last ? '' : ', ' }} }</p>
        }
        <p class="hint">International booking is coming soon. Contact your courier company to book one of these services.</p>
      }
    }
  `,
  styles: [`
    :host { display:flex; flex-direction:column; gap:16px; }
    .bar { background:var(--occpl-color-surface); border:1px solid var(--surface-border); border-top:5px solid var(--occpl-color-accent); border-radius:24px; padding:18px 20px; box-shadow:var(--occpl-shadow-md); display:flex; flex-direction:column; gap:12px; }
    .bar__row { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr); gap:12px 14px; align-items:end; }
    .f { display:flex; flex-direction:column; gap:6px; min-width:0; }
    .f label { white-space:nowrap; }
    .f label { font:700 .75rem var(--font-sans); letter-spacing:.1em; text-transform:uppercase; color:var(--content-muted); }
    .f input, .f select { width:100%; min-height:3.25rem; padding:0 14px; border:2px solid var(--surface-border); border-radius:14px; font:800 1.05rem var(--font-sans); background:var(--occpl-color-surface); color:var(--content-fg); }
    .f input:focus-visible, .f select:focus-visible { outline:none; border-color:var(--occpl-color-accent); box-shadow:0 0 0 4px var(--occpl-color-info-surface); }
    .go { min-height:3.25rem; padding:0 26px; border:0; border-radius:14px; background:var(--occpl-gradient-button); color:#fff; font:800 .95rem var(--font-sans); letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
    .go:disabled { opacity:.6; cursor:wait; }
    .go--wide { grid-column:span 3; }
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
    .hint { margin:0; color:var(--content-muted); text-align:center; }
    .empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:56px 24px; text-align:center; color:var(--content-muted); border:2px dashed var(--surface-border); border-radius:24px; font-size:2.2rem; }
    .empty p { margin:0; font-size:1rem; max-width:28rem; }
    @media (max-width: 70rem) { .bar__row { grid-template-columns:repeat(2, minmax(0, 1fr)); } .go { grid-column:1 / -1; } .grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 40rem) { .bar__row { grid-template-columns:repeat(2, minmax(0, 1fr)); } .grid { grid-template-columns:minmax(0, 1fr); } }
  `]
})
export class InternationalRates implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly portal = inject(PortalService);

  /** null while loading the list. */
  readonly countries = signal<InternationalCountry[] | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly quote = signal<RateQuote | null>(null);

  readonly form = this.fb.nonNullable.group({
    originPincode: ['', [Validators.required, pincodeValidator]],
    destinationCountry: ['', [Validators.required]],
    destinationPostcode: [''],
    kind: this.fb.nonNullable.control<InternationalKind>('PARCEL'),
    weightKg: this.fb.control<number | null>(null, [Validators.required, positiveNumber(500, 3)]),
    pieces: [1, [wholeNumber(1, 99)]],
    maxLengthCm: this.fb.control<number | null>(null, [positiveNumber(500, 0)])
  });

  readonly cheapest = computed<RateOption | null>(() => {
    const opts = this.quote()?.options ?? [];
    return opts.length ? opts.reduce((a, b) => (b.totalAmount < a.totalAmount ? b : a)) : null;
  });
  readonly shown = computed(() => [...(this.quote()?.options ?? [])].sort((a, b) => a.totalAmount - b.totalAmount));

  ngOnInit(): void {
    this.portal.internationalCountries().subscribe({
      next: (list) => this.countries.set(list),
      error: () => this.countries.set([])
    });
  }

  /** The chosen country, matched by name regardless of case. */
  private country(): InternationalCountry | undefined {
    const name = this.form.controls.destinationCountry.value.trim().toLowerCase();
    return (this.countries() ?? []).find((c) => c.name.toLowerCase() === name);
  }

  postcodeNeeded(): boolean { return this.country()?.postcodeRequired ?? false; }

  check(): void {
    this.error.set(null);
    const country = this.country();
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Enter the pickup pincode, the country and the weight.'); return; }
    if (!country) { this.error.set('Choose the country from the list.'); return; }
    const v = this.form.getRawValue();
    if (country.postcodeRequired && !v.destinationPostcode.trim()) { this.error.set(`Enter the postcode in ${country.name}.`); return; }
    this.loading.set(true);
    this.portal.estimateInternational({
      originPincode: v.originPincode.trim(), destinationCountry: country.name, destinationPostcode: v.destinationPostcode.trim(),
      kind: v.kind, weightKg: v.weightKg!, pieces: v.kind === 'DOCUMENT' ? 1 : v.pieces,
      maxLengthCm: v.kind === 'DOCUMENT' ? null : v.maxLengthCm
    }).subscribe({
      next: (q) => { this.loading.set(false); this.quote.set(q); },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.status === 400 || e.status === 422 || e.status === 429
          ? (e.error?.message ?? 'Please check the details.') : 'Rates could not be checked right now. Please try again.');
      }
    });
  }
}
