import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PortalService } from '@core/services/portal.service';
import { RateOption, RateQuote } from '@core/models/portal.model';
import { BookingDraftService } from './booking-draft.service';
import { BookingSteps } from './booking-steps';
import { TransportModePipe } from './transport-mode.pipe';

export type SortKey = 'price' | 'fastest' | 'name';

/** Fastest = lowest maximum delivery days; services without an estimate go last (never assumed fast). */
export function sortOptions(options: RateOption[], key: SortKey): RateOption[] {
  const copy = [...options];
  const eta = (o: RateOption) => o.etaMaxDays ?? o.etaMinDays ?? Number.POSITIVE_INFINITY;
  const name = (o: RateOption) => `${o.providerName} ${o.serviceName ?? ''}`.toLowerCase();
  if (key === 'fastest') copy.sort((a, b) => eta(a) - eta(b) || a.totalAmount - b.totalAmount);
  else if (key === 'name') copy.sort((a, b) => name(a).localeCompare(name(b)));
  else copy.sort((a, b) => a.totalAmount - b.totalAmount);
  return copy;
}

/** Steps 2-3: the priced courier services for a quote, sortable, with the full breakdown, and selection. */
@Component({
  selector: 'ecb-compare-rates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, CurrencyPipe, DatePipe, DecimalPipe, BookingSteps, TransportModePipe],
  template: `
    <section class="page">
      <div class="page__head">
        <div>
          <h1 class="text-display">Compare rates</h1>
          @if (quote(); as q) {
            <p class="text-caption">{{ q.pickupPincode }} → {{ q.deliveryPincode }} · {{ q.packageCount }} package(s) ·
              {{ q.actualWeightKg | number: '1.0-3' }} kg actual, {{ q.volumetricWeightKg | number: '1.0-3' }} kg volumetric (L×B×H/5000)
              · {{ q.paymentMode === 'COD' ? 'Cash on delivery' : 'Prepaid' }}</p>
          }
        </div>
        <div class="page__actions"><a class="btn btn--ghost" routerLink="/book">Edit shipment</a></div>
      </div>

      <ecb-booking-steps [current]="selected() ? 2 : 1" />

      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }

      @if (quote(); as q) {
        @if (expired()) {
          <p class="alert alert--warn" role="status">These rates have expired. Refresh them before booking.
            <button class="btn btn--ghost" type="button" (click)="refresh()" [disabled]="refreshing()">Refresh rates</button></p>
        } @else {
          <p class="text-caption">Rates valid until {{ q.expiresAt | date: 'shortTime' }}. Amounts include taxes and charges shown in each breakdown.</p>
        }

        @if (q.options.length === 0) {
          <div class="app-card empty">
            <ecb-icon name="sentiment_dissatisfied" />
            <p>No courier could price this shipment. Check the pincodes and package, or try again later.</p>
          </div>
        } @else {
          <div class="toolbar">
            <label for="sort">Sort by</label>
            <select id="sort" [value]="sort()" (change)="sort.set($any($event.target).value)">
              <option value="price">Lowest price</option>
              <option value="fastest">Fastest delivery</option>
              <option value="name">Courier name</option>
            </select>
            <span class="text-caption">{{ q.options.length }} service(s)</span>
          </div>

          <div class="options" role="radiogroup" aria-label="Courier services">
            @for (o of sorted(); track o.optionId) {
              <article class="app-card option" [class.chosen]="selected()?.optionId === o.optionId">
                <div class="option__main">
                  <div class="option__who">
                    <div class="option__name">{{ o.providerName }}</div>
                    <div class="text-caption">{{ o.serviceName }}{{ o.transportMode ? ' · ' + (o.transportMode | titlecaseMode) : '' }}</div>
                  </div>
                  <div class="option__facts">
                    <div><span class="k">Delivery</span><span class="v">{{ eta(o) }}</span></div>
                    <div><span class="k">Chargeable</span><span class="v">{{ o.chargeableWeightKg !== null ? (o.chargeableWeightKg | number: '1.0-3') + ' kg' : '—' }}</span></div>
                  </div>
                  <div class="option__price">
                    <div class="total num-tabular">{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</div>
                    <button class="btn" type="button" role="radio" [attr.aria-checked]="selected()?.optionId === o.optionId"
                            [class.btn--primary]="selected()?.optionId !== o.optionId" [class.btn--ghost]="selected()?.optionId === o.optionId"
                            [disabled]="expired()" (click)="choose(o)">
                      {{ selected()?.optionId === o.optionId ? 'Selected' : 'Select' }}
                    </button>
                  </div>
                </div>
                <details class="breakdown">
                  <summary>Price breakdown</summary>
                  <table>
                    <tbody>
                      @for (l of o.breakdown; track $index) {
                        <tr><td>{{ l.label }}</td><td class="num-tabular amt">{{ l.amount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr>
                      }
                      <tr class="sum"><td>Total payable</td><td class="num-tabular amt">{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</td></tr>
                    </tbody>
                  </table>
                </details>
              </article>
            }
          </div>
        }

        @if (q.unavailable.length) {
          <article class="app-card unavailable">
            <h2 class="text-h3">Rates not available</h2>
            <ul>
              @for (u of q.unavailable; track u.providerCode) { <li><strong>{{ u.providerName }}</strong> — {{ u.reason || 'Rate could not be retrieved.' }}</li> }
            </ul>
          </article>
        }

        @if (selected(); as s) {
          <div class="next app-card" role="status">
            <div><strong>{{ s.providerName }}</strong> {{ s.serviceName }} · {{ s.totalAmount | currency: s.currency : 'symbol' : '1.2-2' }}</div>
            <a class="btn btn--primary" [routerLink]="['/book/confirm', q.quoteId, s.optionId]">Continue to confirm <ecb-icon name="arrow_forward" /></a>
          </div>
        }
      } @else if (!error()) {
        <p class="text-caption">Loading rates…</p>
      }
    </section>
  `,
  styles: [`
    .toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font:600 13px var(--font-sans); }
    .toolbar select { font:500 14px var(--font-sans); min-height:2.25rem; padding:4px 12px; border-radius:var(--r-field); border:1px solid var(--surface-border); background:var(--surface); }
    .options { display:flex; flex-direction:column; gap:12px; }
    .option { padding:18px 20px; transition:box-shadow .15s, border-color .15s, transform .15s; display:flex; flex-direction:column; gap:10px; }
    .option:hover { box-shadow:var(--shadow-hover); }
    .option.chosen { border-color:var(--occpl-color-primary); border-left:5px solid var(--occpl-color-primary); box-shadow:var(--shadow-hover); }
    .option__main { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,2fr) auto; gap:16px; align-items:center; }
    .option__name { font:700 16px var(--font-sans); }
    .option__facts { display:flex; gap:24px; flex-wrap:wrap; }
    .option__facts .k { display:block; font:600 11px var(--font-sans); text-transform:uppercase; letter-spacing:.04em; color:var(--content-muted); }
    .option__facts .v { font:600 14px var(--font-sans); }
    .option__price { display:flex; align-items:center; gap:14px; justify-content:flex-end; }
    .total { font:800 1.5rem var(--font-display); background:var(--occpl-gradient-button); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .breakdown summary { cursor:pointer; font:600 13px var(--font-sans); color:var(--brand-700); }
    .breakdown table { width:100%; max-width:480px; border-collapse:collapse; margin-top:8px; font:400 13px var(--font-sans); }
    .breakdown td { padding:6px 0; border-bottom:1px solid var(--surface-border); }
    .breakdown .amt { text-align:right; }
    .breakdown .sum td { font-weight:700; border-bottom:0; }
    .unavailable { padding:16px 18px; }
    .unavailable h2 { margin:0 0 8px; }
    .unavailable ul { margin:0; padding-left:18px; color:var(--content-muted); font:400 13px/1.6 var(--font-sans); }
    .empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:32px; text-align:center; color:var(--content-muted); }
    .next { position:sticky; bottom:12px; border-bottom:3px solid var(--occpl-color-primary); display:flex; justify-content:space-between; align-items:center; gap:12px; padding:14px 18px; flex-wrap:wrap; }
    @media (max-width: 760px) {
      .option__main { grid-template-columns:minmax(0,1fr); }
      .option__price { justify-content:space-between; }
    }
  `]
})
export class CompareRates implements OnInit {
  readonly quoteId = input.required<string>();
  private readonly portal = inject(PortalService);
  private readonly drafts = inject(BookingDraftService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly quote = signal<RateQuote | null>(null);
  readonly error = signal<string | null>(null);
  readonly sort = signal<SortKey>('price');
  readonly selected = signal<RateOption | null>(null);
  readonly refreshing = signal(false);
  private readonly now = signal(Date.now());
  readonly sorted = computed(() => sortOptions(this.quote()?.options ?? [], this.sort()));
  readonly expired = computed(() => {
    const q = this.quote();
    return !!q && (q.status === 'EXPIRED' || new Date(q.expiresAt).getTime() <= this.now());
  });

  ngOnInit(): void {
    const timer = setInterval(() => this.now.set(Date.now()), 30_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    this.portal.quote(this.quoteId()).subscribe({
      next: (q) => this.quote.set(q),
      error: (e: HttpErrorResponse) => this.error.set(e.status === 404 ? 'This comparison was not found.' : 'Could not load the rates.')
    });
  }

  choose(o: RateOption): void {
    this.selected.set(o);
    try { sessionStorage.setItem('ecb.booking.selection', JSON.stringify({ quoteId: this.quoteId(), optionId: o.optionId })); } catch { /* ignore */ }
  }

  refresh(): void {
    const draft = this.drafts.draft();
    if (!draft) { this.router.navigateByUrl('/book'); return; }
    this.refreshing.set(true);
    this.portal.compareRates(draft).subscribe({
      next: (q) => { this.refreshing.set(false); this.selected.set(null); this.router.navigate(['/book/rates', q.quoteId]); this.quote.set(q); },
      error: () => { this.refreshing.set(false); this.error.set('Rates could not be refreshed. Please try again.'); }
    });
  }

  eta(o: RateOption): string {
    if (o.etaMinDays === null && o.etaMaxDays === null) return 'Not provided';
    if (o.etaMinDays !== null && o.etaMaxDays !== null && o.etaMinDays !== o.etaMaxDays) return `${o.etaMinDays}-${o.etaMaxDays} days`;
    const d = o.etaMaxDays ?? o.etaMinDays;
    return `${d} day${d === 1 ? '' : 's'}`;
  }
}
