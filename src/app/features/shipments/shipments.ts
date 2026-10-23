import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Icon } from '@shared/components/icon';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PortalService } from '@core/services/portal.service';
import { BookingFilter, BookingSummary, Page } from '@core/models/portal.model';
import { BOOKING_STATUS_VIEW } from '@shared/utils/booking-status';
import { CourierLogo } from '@shared/components/courier-logo';

/** Every booking status; "Submitting" covers both of the server's in-flight states. */
const STATUSES: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'OUTCOME_UNKNOWN', label: 'Awaiting confirmation' },
  { value: 'PENDING,SUBMITTING', label: 'Submitting' },
  { value: 'FAILED', label: 'Not booked' }
];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY: BookingFilter = { status: '', provider: '', from: '', to: '' };

/** The customer's bookings made in the portal, newest first, filtered by status, courier and booking date, with paging. */

@Component({
  selector: 'ecb-shipments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CourierLogo, Icon, RouterLink, FormsModule, DatePipe, CurrencyPipe],
  template: `
    <section class="page">
      <div class="page__head">
        <div>
          <h1 class="text-display">Shipments</h1>
          <p class="text-caption">Bookings you made here. Open one to track it or download its label.</p>
        </div>
        <div class="page__actions">
          <a class="btn btn--primary" routerLink="/book"><ecb-icon name="add" /> Book a shipment</a>
        </div>
      </div>

      <form class="app-card filters" role="search" aria-label="Filter shipments" (submit)="$event.preventDefault()">
        <div class="field">
          <label for="status-filter">Status</label>
          <select id="status-filter" [ngModel]="filter().status" name="status" (ngModelChange)="set('status', $event)">
            @for (f of statuses; track f.value) { <option [value]="f.value">{{ f.label }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="courier-filter">Courier partner</label>
          <select id="courier-filter" [ngModel]="filter().provider" name="provider" (ngModelChange)="set('provider', $event)">
            <option value="">All couriers</option>
            @for (c of couriers(); track c.code) { <option [value]="c.code">{{ c.name }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="from-filter">From date</label>
          <input id="from-filter" type="date" name="from" [max]="filter().to || today" [ngModel]="filter().from" (ngModelChange)="set('from', $event)" />
        </div>
        <div class="field">
          <label for="to-filter">To date</label>
          <input id="to-filter" type="date" name="to" [min]="filter().from" [max]="today" [ngModel]="filter().to" (ngModelChange)="set('to', $event)" />
        </div>
        <div class="quick">
          <button class="btn btn--ghost" type="button" (click)="lastDays(7)">Last 7 days</button>
          <button class="btn btn--ghost" type="button" (click)="lastDays(30)">Last 30 days</button>
          @if (filtered()) { <button class="btn btn--ghost" type="button" (click)="clear()">Clear filters</button> }
        </div>
      </form>

      @if (error()) {
        <p class="alert alert--error" role="alert">{{ error() }} <button class="btn btn--ghost" type="button" (click)="load()">Retry</button></p>
      }

      <article class="app-card list" aria-live="polite">
        @if (!page()) {
          <p class="text-caption pad">{{ error() ? 'Not available.' : 'Loading…' }}</p>
        } @else if (page()!.content.length === 0) {
          <div class="empty">
            <ecb-icon name="local_shipping" />
            <p>{{ filtered() ? 'No shipments match these filters.' : 'No bookings yet.' }}</p>
            @if (filtered()) { <button class="btn btn--ghost" type="button" (click)="clear()">Clear filters</button> }
            <a class="btn btn--primary" routerLink="/book">Book a shipment</a>
          </div>
        } @else {
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Booked</th><th>Courier</th><th>Route</th><th>Recipient</th><th>Tracking no.</th><th class="num">Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                @for (b of page()!.content; track b.bookingId) {
                  <tr>
                    <td><a [routerLink]="['/shipments', b.bookingId]">{{ b.createdAt | date: 'mediumDate' }}</a></td>
                    <td><span class="prov"><ecb-courier-logo [code]="b.providerCode" [name]="b.providerName" style="--logo-size:2rem" /><span>{{ b.providerName }}@if (b.serviceName) { <div class="sub">{{ b.serviceName }}</div> }</span></span></td>
                    <td>{{ b.pickupCity || b.pickupPincode }} → {{ b.deliveryCity || b.deliveryPincode }}</td>
                    <td>{{ b.deliveryName || '—' }}</td>
                    <td class="mono">{{ b.trackingNumber || '—' }}</td>
                    <td class="num num-tabular">{{ b.totalAmount | currency: b.currency : 'symbol' : '1.2-2' }}</td>
                    <td><span [class]="'badge badge--' + view(b).tone">{{ view(b).label }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <ul class="cards">
            @for (b of page()!.content; track b.bookingId) {
              <li>
                <a [routerLink]="['/shipments', b.bookingId]">
                  <div class="row"><strong>{{ b.deliveryName || 'Shipment' }}</strong><span [class]="'badge badge--' + view(b).tone">{{ view(b).label }}</span></div>
                  <div class="sub">{{ b.pickupCity || b.pickupPincode }} → {{ b.deliveryCity || b.deliveryPincode }} · {{ b.providerName }}</div>
                  <div class="row sub"><span>{{ b.createdAt | date: 'mediumDate' }}</span><span>{{ b.totalAmount | currency: b.currency : 'symbol' : '1.2-2' }}</span></div>
                </a>
              </li>
            }
          </ul>
          <nav class="pager" aria-label="Pages">
            <button class="btn btn--ghost" type="button" [disabled]="page()!.first" (click)="go(page()!.page - 1)">Previous</button>
            <span class="text-caption">Page {{ page()!.page + 1 }} of {{ page()!.totalPages || 1 }}</span>
            <button class="btn btn--ghost" type="button" [disabled]="!page()!.hasNext" (click)="go(page()!.page + 1)">Next</button>
          </nav>
        }
      </article>
    </section>
  `,
  styles: [`
    .filters { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px 16px; align-items:end; padding:16px 18px; margin-bottom:16px; }
    .filters .field { margin:0; }
    .filters input, .filters select { width:100%; }
    .quick { grid-column:1 / -1; display:flex; gap:8px; flex-wrap:wrap; }
    .quick .btn { min-height:2.2rem; padding:0 14px; }
    @media (max-width: 900px) { .filters { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 520px) { .filters { grid-template-columns:1fr; } }
    .list { padding:0; overflow:hidden; }
    .pad { padding:20px; }
    .empty { padding:40px 20px; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; }
    .prov { display:flex; align-items:center; gap:10px; }
    .empty ecb-icon { font-size:40px; color:var(--content-muted); }
    .sub { font:400 12px var(--font-sans); color:var(--content-muted); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .num { text-align:right; }
    .cards { display:none; list-style:none; margin:0; padding:0; }
    .cards li { border-top:1px solid var(--surface-border); }
    .cards a { display:flex; flex-direction:column; gap:4px; padding:14px 16px; color:inherit; text-decoration:none; }
    .row { display:flex; justify-content:space-between; gap:8px; align-items:center; }
    .pager { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:12px 16px; border-top:1px solid var(--surface-border); }
    @media (max-width: 720px) { .table-wrap { display:none; } .cards { display:block; } }
  `]
})
export class Shipments implements OnInit {
  private readonly portal = inject(PortalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly statuses = STATUSES;
  readonly today = isoDate(new Date());
  readonly page = signal<Page<BookingSummary> | null>(null);
  readonly filter = signal<BookingFilter>(EMPTY);
  readonly couriers = signal<{ code: string; name: string }[]>([]);
  readonly filtered = computed(() => Object.values(this.filter()).some((v) => !!v));
  readonly error = signal<string | null>(null);
  private current = 0;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const status = q.get('status') ?? '';
    const date = (v: string | null) => (v && DATE.test(v) ? v : '');
    this.filter.set({
      status: STATUSES.some((f) => f.value === status) ? status : '',
      provider: (q.get('provider') ?? '').toUpperCase(),
      from: date(q.get('from')),
      to: date(q.get('to'))
    });
    this.current = Math.max(0, Number(q.get('page') ?? 0) || 0);
    this.portal.bookingCouriers().subscribe({ next: (c) => this.couriers.set(c), error: () => undefined });
    this.load();
  }

  load(): void {
    this.error.set(null);
    this.portal.bookings(this.filter(), this.current).subscribe({
      next: (p) => this.page.set(p),
      error: (e: HttpErrorResponse) => this.error.set(typeof e.error?.message === 'string' && e.status === 422
        ? e.error.message : 'Could not load your shipments.')
    });
  }

  set(key: keyof BookingFilter, value: string): void {
    const next = { ...this.filter(), [key]: value ?? '' } as BookingFilter;
    // Keep the range valid: moving one end past the other moves both.
    if (next.from && next.to && next.from > next.to) {
      if (key === 'from') next.to = next.from; else next.from = next.to;
    }
    this.filter.set(next);
    this.go(0);
  }

  lastDays(days: number): void {
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    this.filter.update((f) => ({ ...f, from: isoDate(from), to: this.today }));
    this.go(0);
  }

  clear(): void {
    this.filter.set(EMPTY);
    this.go(0);
  }

  go(page: number): void {
    this.current = Math.max(0, page);
    this.page.set(null);
    const f = this.filter();
    this.router.navigate([], {
      queryParams: { status: f.status || null, provider: f.provider || null, from: f.from || null, to: f.to || null, page: this.current || null },
      replaceUrl: true
    });
    this.load();
  }

  view(b: BookingSummary) { return BOOKING_STATUS_VIEW[b.status]; }
}

/** yyyy-MM-dd in the browser's local time (an Indian customer's calendar day). */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
