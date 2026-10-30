import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PortalService } from '@core/services/portal.service';
import { RateOption, RateQuote } from '@core/models/portal.model';
import { BookingDraftService } from './booking-draft.service';
import { BookingSteps } from './booking-steps';
import { BannerChip, RouteBanner } from './route-banner';

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
import { CourierLogo } from '@shared/components/courier-logo';

@Component({
  selector: 'ecb-compare-rates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CourierLogo, Icon, RouterLink, CurrencyPipe, DatePipe, DecimalPipe, BookingSteps, RouteBanner],
  template: `
    <section class="page">
      <div class="page__head" data-icon="compare_arrows">
        <div>
          <h1 class="text-display">Compare &amp; select a courier</h1>
          <p class="text-caption">Every price below is final, with taxes and charges. Pick the one that suits the parcel.</p>
        </div>
        <div class="page__actions"><a class="btn btn--ghost" routerLink="/book">Edit shipment</a></div>
      </div>

      <ecb-booking-steps [current]="1" />

      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }

      @if (quote(); as q) {
        <ecb-route-banner [fromPin]="q.pickupPincode" [fromPlace]="place('pickup')" [toPin]="q.deliveryPincode" [toPlace]="place('delivery')" [chips]="chips(q)" />

        @if (expired()) {
          <p class="alert alert--warn" role="status">These rates have expired. Refresh them before booking.
            <button class="btn btn--ghost" type="button" (click)="refresh()" [disabled]="refreshing()">Refresh rates</button></p>
        } @else {
          <p class="valid"><ecb-icon name="schedule" /> Rates valid until <strong>{{ q.expiresAt | date: 'shortTime' }}</strong></p>
        }

        @if (q.options.length === 0) {
          <div class="app-card empty">
            <ecb-icon name="sentiment_dissatisfied" />
            <p>No courier could price this shipment. Check the pincodes and package, or try again later.</p>
          </div>
        } @else {
          <div class="toolbar">
            <span class="text-caption"><strong>{{ q.options.length }}</strong> service(s) available</span>
            <span class="seg" role="radiogroup" aria-label="Sort by">
              <button type="button" role="radio" [attr.aria-checked]="sort() === 'price'" [class.on]="sort() === 'price'" (click)="sort.set('price')"><ecb-icon name="sell" /> Lowest price</button>
              <button type="button" role="radio" [attr.aria-checked]="sort() === 'fastest'" [class.on]="sort() === 'fastest'" (click)="sort.set('fastest')"><ecb-icon name="bolt" /> Fastest</button>
              <button type="button" role="radio" [attr.aria-checked]="sort() === 'name'" [class.on]="sort() === 'name'" (click)="sort.set('name')">A–Z</button>
            </span>
          </div>

          <div class="options" role="radiogroup" aria-label="Courier services">
            @for (o of sorted(); track o.optionId) {
              <article class="app-card option" [class.chosen]="selected()?.optionId === o.optionId" [attr.data-mode]="modeOf(o)">
                <span class="option__stripe" aria-hidden="true"></span>
                <div class="option__main">
                  <div class="option__who">
                    <ecb-courier-logo [code]="o.providerCode" [name]="o.providerName" style="--logo-size:3.6rem" />
                    <div class="option__id">
                      <div class="option__name">{{ o.providerName }}</div>
                      <div class="text-caption">{{ o.serviceName }}</div>
                      <div class="tags">
                        @if (o.optionId === cheapestId()) { <span class="tag tag--cheap"><ecb-icon name="sell" /> Cheapest</span> }
                        @if (o.optionId === fastestId() && o.optionId !== cheapestId()) { <span class="tag tag--fast"><ecb-icon name="bolt" /> Fastest</span> }
                        @if (o.optionId === fastestId() && o.optionId === cheapestId()) { <span class="tag tag--fast"><ecb-icon name="bolt" /> Fastest</span> }
                      </div>
                    </div>
                  </div>
                  <ul class="facts">
                    <li class="fact fact--mode"><ecb-icon [name]="modeIcon(o)" /> {{ modeLabel(o) }}</li>
                    <li class="fact"><ecb-icon name="schedule" /> {{ eta(o) }}</li>
                    <li class="fact"><ecb-icon name="scale" /> {{ o.chargeableWeightKg !== null ? (o.chargeableWeightKg | number: '1.0-3') + ' kg' : '—' }}</li>
                  </ul>
                  <div class="option__price">
                    <div class="total num-tabular">{{ o.totalAmount | currency: o.currency : 'symbol' : '1.2-2' }}</div>
                    <div class="text-caption">incl. taxes</div>
                    <button class="btn" type="button" role="radio" [attr.aria-checked]="selected()?.optionId === o.optionId"
                            [class.btn--primary]="selected()?.optionId !== o.optionId" [class.btn--ghost]="selected()?.optionId === o.optionId"
                            [disabled]="expired()" (click)="choose(o)">
                      @if (selected()?.optionId === o.optionId) { <ecb-icon name="check_circle" /> Selected } @else { Select }
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
            <h2 class="text-h3">Not available for this shipment</h2>
            <ul>
              @for (u of q.unavailable; track u.providerCode) { <li><strong>{{ u.providerName }}</strong> — {{ u.reason || 'Rate could not be retrieved.' }}</li> }
            </ul>
          </article>
        }

        @if (selected(); as s) {
          <div class="next app-card" role="status">
            <div class="next__who"><ecb-courier-logo [code]="s.providerCode" [name]="s.providerName" style="--logo-size:2.6rem" />
              <div><strong>{{ s.providerName }}</strong><div class="text-caption">{{ s.serviceName }}</div></div></div>
            <div class="next__total num-tabular">{{ s.totalAmount | currency: s.currency : 'symbol' : '1.2-2' }}</div>
            <a class="btn btn--primary btn--cta" [routerLink]="['/book/confirm', q.quoteId, s.optionId]">Continue <ecb-icon name="arrow_forward" /></a>
          </div>
        }
      } @else if (!error()) {
        <p class="text-caption">Loading rates…</p>
      }
    </section>
  `,
  styles: [`
    .valid { margin:0; display:flex; align-items:center; gap:8px; font:500 .85rem var(--font-sans); color:var(--content-muted); }
    .toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
    .seg { display:inline-flex; padding:3px; border-radius:999px; background:var(--surface); border:1px solid var(--surface-border); }
    .seg button { display:inline-flex; align-items:center; gap:6px; border:0; background:transparent; padding:.45rem 1rem; border-radius:999px; font:700 .85rem var(--font-sans); color:var(--content-muted); cursor:pointer; }
    .seg button.on { background:var(--occpl-gradient-button); color:#fff; box-shadow:0 4px 12px rgb(214 31 69 / 25%); }
    .options { display:flex; flex-direction:column; gap:14px; }
    .option { --tone:var(--occpl-color-accent); position:relative; overflow:hidden; padding:20px 22px 14px 28px; transition:box-shadow .2s, border-color .2s, transform .2s; display:flex; flex-direction:column; gap:10px; }
    .option[data-mode='air'] { --tone:var(--occpl-color-sky); }
    .option[data-mode='surface'] { --tone:var(--occpl-color-teal); }
    .option[data-mode='cargo'] { --tone:var(--occpl-color-amber); }
    .option__stripe { position:absolute; left:0; top:0; bottom:0; width:6px; background:var(--tone); }
    .option:hover { box-shadow:var(--shadow-hover); transform:translateY(-2px); }
    .option.chosen { border-color:var(--occpl-color-primary); box-shadow:0 0 0 3px var(--occpl-color-info-surface), var(--shadow-hover); }
    .option__main { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1.4fr) auto; gap:18px; align-items:center; }
    .option__who { display:flex; align-items:center; gap:16px; min-width:0; }
    .option__name { font:700 1.1rem var(--font-display); }
    .tags { display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }
    .tag { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:999px; font:700 .72rem var(--font-sans); letter-spacing:.03em; }
    .tag--cheap { background:var(--success-bg, #e3f6ec); color:var(--success); }
    .tag--fast { background:var(--occpl-color-info-surface); color:var(--occpl-color-accent); }
    .facts { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:8px; }
    .fact { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; background:var(--occpl-color-neutral-surface); font:600 .82rem var(--font-sans); }
    .fact--mode { background:color-mix(in srgb, var(--tone) 14%, transparent); color:var(--tone); }
    .option__price { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
    .option__price .btn { margin-top:8px; min-width:8.5rem; }
    .total { font:800 1.9rem/1.1 var(--font-display); background:var(--occpl-gradient-button); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .breakdown summary { cursor:pointer; font:600 13px var(--font-sans); color:var(--brand-700); }
    .breakdown table { width:100%; max-width:480px; border-collapse:collapse; margin-top:8px; font:400 13px var(--font-sans); }
    .breakdown td { padding:6px 0; border-bottom:1px solid var(--surface-border); }
    .breakdown .amt { text-align:right; }
    .breakdown .sum td { font-weight:700; border-bottom:0; }
    .unavailable { padding:16px 18px; background:var(--occpl-color-neutral-surface); }
    .unavailable h2 { margin:0 0 8px; }
    .unavailable ul { margin:0; padding-left:18px; color:var(--content-muted); font:400 13px/1.6 var(--font-sans); }
    .empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:32px; text-align:center; color:var(--content-muted); }
    .next { position:sticky; bottom:12px; z-index:2; border-top:3px solid var(--occpl-color-primary); display:flex; align-items:center; gap:16px; padding:12px 18px; flex-wrap:wrap; box-shadow:var(--shadow-md); }
    .next__who { display:flex; align-items:center; gap:12px; margin-right:auto; }
    .next__total { font:800 1.4rem var(--font-display); }
    .btn--cta { padding-inline:2rem; box-shadow:0 10px 24px rgb(214 31 69 / 30%); }
    @media (max-width: 860px) {
      .option__main { grid-template-columns:minmax(0,1fr); }
      .option__price { flex-direction:row; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
      .option__price .btn { margin-top:0; }
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

  readonly cheapestId = computed(() => sortOptions(this.quote()?.options ?? [], 'price')[0]?.optionId ?? null);
  /** Only named "fastest" when at least one service gives a delivery estimate. */
  readonly fastestId = computed(() => {
    const first = sortOptions(this.quote()?.options ?? [], 'fastest')[0];
    return first && (first.etaMaxDays ?? first.etaMinDays) != null ? first.optionId : null;
  });
  private readonly draft = inject(BookingDraftService).draft;

  place(side: 'pickup' | 'delivery'): string {
    const p = this.draft()?.[side];
    return p ? [p.city, p.state].filter((x) => !!x).join(', ') : '';
  }

  chips(q: RateQuote): BannerChip[] {
    const out: BannerChip[] = [{ icon: 'scale', text: `${q.actualWeightKg} kg` }, { icon: 'inventory_2', text: `${q.packageCount} package${q.packageCount === 1 ? '' : 's'}` }];
    if (q.volumetricWeightKg) out.push({ icon: 'straighten', text: `${q.volumetricWeightKg} kg volumetric` });
    out.push(q.paymentMode === 'COD' ? { icon: 'payments', text: 'Cash on delivery' } : q.paymentMode === 'TOPAY' ? { icon: 'sell', text: 'To Pay' } : { icon: 'account_balance_wallet', text: 'Prepaid' });
    return out;
  }

  modeOf(o: RateOption): 'air' | 'surface' | 'cargo' | 'other' {
    const m = `${o.transportMode ?? ''} ${o.serviceName ?? ''}`.toLowerCase();
    if (/air|prm|premium|express/.test(m)) return 'air';
    if (/crg|cargo/.test(m)) return 'cargo';
    if (/srf|surface|road/.test(m)) return 'surface';
    return 'other';
  }
  /** The carrier's short codes (SRF, CRG, PRM) written out; anything else as the shared pipe shows it. */
  modeLabel(o: RateOption): string {
    const code = (o.transportMode ?? '').toUpperCase();
    const names: Record<string, string> = { SRF: 'Surface', SURFACE: 'Surface', CRG: 'Cargo', CARGO: 'Cargo', PRM: 'Premium', PREMIUM: 'Premium', AIR: 'Air' };
    return names[code] ?? (code ? code.charAt(0) + code.slice(1).toLowerCase() : 'Standard');
  }
  modeIcon(o: RateOption): string { const m = this.modeOf(o); return m === 'air' ? 'flight' : m === 'cargo' ? 'inventory_2' : 'local_shipping'; }

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
    // the API leaves an unknown estimate out of its JSON, so it arrives as undefined as often as null
    if (o.etaMinDays == null && o.etaMaxDays == null) return 'Not provided';
    if (o.etaMinDays != null && o.etaMaxDays != null && o.etaMinDays !== o.etaMaxDays) return `${o.etaMinDays}-${o.etaMaxDays} days`;
    const d = o.etaMaxDays ?? o.etaMinDays;
    return `${d} day${d === 1 ? '' : 's'}`;
  }
}
