import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PortalService } from '@core/services/portal.service';
import { BookingStatus, BookingSummary, Page } from '@core/models/portal.model';
import { BOOKING_STATUS_VIEW } from '@shared/utils/booking-status';

const FILTERS: { value: BookingStatus | ''; label: string }[] = [
  { value: '', label: 'All bookings' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'OUTCOME_UNKNOWN', label: 'Awaiting confirmation' },
  { value: 'FAILED', label: 'Not booked' }
];

/** The customer's bookings made in the portal, newest first, with a status filter and paging. */
import { CourierLogo } from '@shared/components/courier-logo';

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

      <div class="field filter">
        <label for="status-filter">Show</label>
        <select id="status-filter" [ngModel]="status()" (ngModelChange)="setStatus($event)">
          @for (f of filters; track f.value) { <option [value]="f.value">{{ f.label }}</option> }
        </select>
      </div>

      @if (error()) {
        <p class="alert alert--error" role="alert">{{ error() }} <button class="btn btn--ghost" type="button" (click)="load()">Retry</button></p>
      }

      <article class="app-card list" aria-live="polite">
        @if (!page()) {
          <p class="text-caption pad">{{ error() ? 'Not available.' : 'Loading…' }}</p>
        } @else if (page()!.content.length === 0) {
          <div class="empty">
            <ecb-icon name="local_shipping" />
            <p>{{ status() ? 'No bookings with this status.' : 'No bookings yet.' }}</p>
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
    .filter { max-width:260px; margin-bottom:16px; }
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
  readonly filters = FILTERS;
  readonly page = signal<Page<BookingSummary> | null>(null);
  readonly status = signal<BookingStatus | ''>('');
  readonly error = signal<string | null>(null);
  private current = 0;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const s = q.get('status') ?? '';
    this.status.set(FILTERS.some((f) => f.value === s) ? (s as BookingStatus | '') : '');
    this.current = Math.max(0, Number(q.get('page') ?? 0) || 0);
    this.load();
  }

  load(): void {
    this.error.set(null);
    this.portal.bookings(this.status(), this.current).subscribe({
      next: (p) => this.page.set(p),
      error: () => this.error.set('Could not load your shipments.')
    });
  }

  setStatus(value: BookingStatus | ''): void {
    this.status.set(value);
    this.go(0);
  }

  go(page: number): void {
    this.current = Math.max(0, page);
    this.page.set(null);
    this.router.navigate([], { queryParams: { status: this.status() || null, page: this.current || null }, replaceUrl: true });
    this.load();
  }

  view(b: BookingSummary) { return BOOKING_STATUS_VIEW[b.status]; }
}
