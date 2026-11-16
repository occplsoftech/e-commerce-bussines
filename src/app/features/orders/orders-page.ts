import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Icon } from '@shared/components/icon';
import { BulkBookingService } from '@features/booking/bulk-booking.service';
import { OrderCounts, OrderQuoteRow, OrderStatus, OrdersService, PortalOrder } from './orders.service';

/**
 * Orders to ship (13.3): orders that arrived from the customer's own system. Book one (the booking form opens filled in) or several at
 * once (priced like bulk booking, reviewed, then booked from the wallet). A booked order shows its tracking number.
 */
@Component({
  selector: 'ecb-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, CurrencyPipe, DatePipe],
  template: `
    <section class="page">
      <div class="page__head" data-icon="inbox">
        <div>
          <h1 class="text-display">Orders to ship</h1>
          <p class="text-caption">Orders sent from your website or system arrive here. Check them and book: one at a time, or many at once.</p>
        </div>
        <div class="page__actions"><a class="btn btn--ghost" routerLink="/developer"><ecb-icon name="key" /> Connect your system</a></div>
      </div>

      <div class="tabs" role="tablist">
        @for (t of tabs; track t.value) {
          <button type="button" role="tab" [attr.aria-selected]="tab() === t.value" [class.on]="tab() === t.value" (click)="show(t.value)">
            {{ t.label }} <span class="count">{{ count(t.value) }}</span></button>
        }
      </div>

      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }

      @if (review(); as rows) {
        <article class="app-card review">
          <div class="review__head">
            <h2 class="text-h2">Review {{ rows.length }} order{{ rows.length === 1 ? '' : 's' }}</h2>
            <button class="btn btn--ghost" type="button" (click)="review.set(null)">Back</button>
          </div>
          <div class="scroll">
            <table>
              <thead><tr><th>Order</th><th>Buyer</th><th>Courier</th><th class="num">Price</th></tr></thead>
              <tbody>
                @for (r of rows; track r.orderId) {
                  <tr [class.bad]="!r.ok">
                    <td class="mono">{{ r.orderNumber || '—' }}</td>
                    <td>{{ r.deliveryName }} <span class="sub">{{ r.deliveryPincode }}</span></td>
                    <td>@if (r.ok) { {{ r.providerName }} <span class="sub">{{ r.serviceName }}{{ r.basis === 'BUSINESS_RATE' ? ' · your rate' : ' · cheapest' }}</span> }
                        @else { <span class="err">{{ r.error }}</span> }</td>
                    <td class="num num-tabular">@if (r.total != null) { {{ r.total | currency: 'INR' : 'symbol' : '1.2-2' }} }</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="review__bar">
            <span class="text-caption">{{ okRows().length }} ready · {{ rows.length - okRows().length }} need attention. Paid from your wallet.</span>
            <button class="btn btn--primary" type="button" [disabled]="!okRows().length || booking()" (click)="bookAll()">
              {{ booking() ? 'Booking…' : 'Book ' + okRows().length + ' for ' + (okTotal() | currency: 'INR' : 'symbol' : '1.2-2') }}</button>
          </div>
        </article>
      }

      @if (results(); as res) {
        <p class="alert" [class.alert--ok]="res.booked === res.total" role="status">
          {{ res.booked }} of {{ res.total }} booked.@if (res.failed.length) { Not booked: {{ res.failed.join('; ') }} }</p>
      }

      @if (!review()) {
        <article class="app-card list">
          @if (tab() === 'NEW' && orders().length) {
            <div class="bulkbar">
              <label><input type="checkbox" [checked]="allPicked()" (change)="pickAll($any($event.target).checked)" /> Select all</label>
              <button class="btn btn--primary" type="button" [disabled]="!picked().size || quoting()" (click)="quote()">
                {{ quoting() ? 'Pricing…' : 'Book selected (' + picked().size + ')' }}</button>
            </div>
          }
          @if (loading()) { <p class="empty">Loading…</p> }
          @else if (!orders().length) {
            <div class="empty">
              <ecb-icon name="inbox" />
              @if (tab() === 'NEW') { <p>No orders waiting. Orders your website or system sends appear here.</p>
                <a class="btn btn--ghost" routerLink="/developer">Set up the API</a> }
              @else { <p>Nothing here.</p> }
            </div>
          } @else {
            <div class="scroll">
              <table>
                <thead><tr>@if (tab() === 'NEW') { <th></th> }<th>Order</th><th>Received</th><th>Buyer</th><th>Payment</th><th class="num">Value</th><th></th></tr></thead>
                <tbody>
                  @for (o of orders(); track o.id) {
                    <tr>
                      @if (tab() === 'NEW') { <td><input type="checkbox" [checked]="picked().has(o.id)" (change)="toggle(o.id)" [attr.aria-label]="'Select ' + o.orderNumber" /></td> }
                      <td class="mono">{{ o.orderNumber }}<span class="sub">{{ o.items?.length ? o.items!.length + ' item' + (o.items!.length === 1 ? '' : 's') : o.parcel.contents }}</span></td>
                      <td>{{ o.receivedAt | date: 'd MMM, h:mm a' }}</td>
                      <td>{{ o.buyer.name }}<span class="sub">{{ o.buyer.city || '' }} {{ o.buyer.pincode }}</span></td>
                      <td>@if (o.payment.mode === 'COD') { <span class="badge badge--warn">COD {{ o.payment.codAmount | currency: 'INR' : 'symbol' : '1.0-0' }}</span> } @else { <span class="badge">Prepaid</span> }</td>
                      <td class="num num-tabular">{{ o.parcel.declaredValue | currency: 'INR' : 'symbol' : '1.0-0' }}</td>
                      <td class="actions">
                        @switch (o.status) {
                          @case ('NEW') {
                            <a class="btn btn--primary btn--sm" routerLink="/book" [queryParams]="{ order: o.id }">Book</a>
                            <button class="btn btn--ghost btn--sm" type="button" (click)="archive(o)">Archive</button>
                          }
                          @case ('BOOKED') {
                            @if (o.bookingId) { <a [routerLink]="['/shipments', o.bookingId]" class="mono">{{ o.trackingNumber || 'View shipment' }}</a> }
                          }
                          @default { <button class="btn btn--ghost btn--sm" type="button" (click)="restore(o)">Restore</button> }
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </article>
      }
    </section>
  `,
  styles: [`
    .tabs { display:flex; gap:8px; flex-wrap:wrap; }
    .tabs button { border:1px solid var(--surface-border); background:var(--occpl-color-surface); color:var(--content-fg); border-radius:999px;
      padding:7px 14px; font:600 13px var(--font-sans); cursor:pointer; }
    .tabs button.on { background:var(--occpl-gradient-brand); color:#fff; border-color:transparent; }
    .count { display:inline-block; min-width:20px; margin-left:4px; padding:0 6px; border-radius:999px; background:rgb(0 0 0 / 8%); font-size:12px; }
    .tabs button.on .count { background:rgb(255 255 255 / 25%); }
    .list, .review { padding:0; overflow:hidden; }
    .bulkbar, .review__head, .review__bar { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:14px 20px; }
    .bulkbar { border-bottom:1px solid var(--surface-border); }
    .bulkbar label { display:flex; align-items:center; gap:8px; font:600 14px var(--font-sans); }
    .review__head h2 { margin:0; }
    .review__bar { border-top:1px solid var(--surface-border); }
    .scroll { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; font:400 14px var(--font-sans); }
    th { text-align:left; font:600 12px var(--font-sans); text-transform:uppercase; letter-spacing:.04em; color:var(--content-muted); padding:12px 16px; background:var(--surface-muted); }
    td { padding:12px 16px; border-top:1px solid var(--surface-border); vertical-align:top; }
    .num { text-align:right; }
    .sub { display:block; font-size:12px; color:var(--content-muted); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .actions { white-space:nowrap; text-align:right; }
    .actions .btn + .btn { margin-left:6px; }
    .btn--sm { padding:6px 12px; font-size:13px; }
    tr.bad td { background:color-mix(in srgb, var(--occpl-color-danger) 5%, transparent); }
    .err { color:var(--occpl-color-danger); font-size:13px; }
    .empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:40px 20px; text-align:center; color:var(--content-muted); }
    .empty ecb-icon { font-size:40px; color:var(--brand-300); }
  `]
})
export class OrdersPage implements OnInit {
  private readonly svc = inject(OrdersService);
  private readonly bulk = inject(BulkBookingService);
  private readonly router = inject(Router);

  readonly tabs: { value: OrderStatus; label: string }[] = [
    { value: 'NEW', label: 'New' }, { value: 'BOOKED', label: 'Booked' }, { value: 'ARCHIVED', label: 'Archived' }];
  readonly tab = signal<OrderStatus>('NEW');
  readonly orders = signal<PortalOrder[]>([]);
  readonly counts = signal<OrderCounts | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly picked = signal<ReadonlySet<string>>(new Set());
  readonly quoting = signal(false);
  readonly booking = signal(false);
  readonly review = signal<OrderQuoteRow[] | null>(null);
  readonly results = signal<{ booked: number; total: number; failed: string[] } | null>(null);

  readonly okRows = computed(() => (this.review() ?? []).filter((r) => r.ok));
  readonly okTotal = computed(() => this.okRows().reduce((s, r) => s + (r.total ?? 0), 0));
  readonly allPicked = computed(() => this.orders().length > 0 && this.orders().every((o) => this.picked().has(o.id)));

  ngOnInit(): void { this.load(); }

  count(s: OrderStatus): number {
    const c = this.counts();
    return !c ? 0 : s === 'NEW' ? c.newOrders : s === 'BOOKED' ? c.booked : c.archived;
  }

  show(s: OrderStatus): void {
    this.tab.set(s);
    this.picked.set(new Set());
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.counts().subscribe({ next: (c) => this.counts.set(c), error: () => undefined });
    this.svc.list(this.tab(), 0, 100).subscribe({
      next: (p) => { this.orders.set(p.content); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Your orders could not be loaded.'); }
    });
  }

  toggle(id: string): void {
    const next = new Set(this.picked());
    if (!next.delete(id)) next.add(id);
    this.picked.set(next);
  }

  pickAll(on: boolean): void { this.picked.set(on ? new Set(this.orders().map((o) => o.id)) : new Set()); }

  quote(): void {
    this.quoting.set(true);
    this.results.set(null);
    this.svc.quote([...this.picked()]).subscribe({
      next: (rows) => { this.quoting.set(false); this.review.set(rows); },
      error: (e: HttpErrorResponse) => { this.quoting.set(false); this.error.set(e.error?.message ?? 'The orders could not be priced.'); }
    });
  }

  bookAll(): void {
    const rows = this.okRows();
    this.booking.set(true);
    this.bulk.book(rows.map((r, i) => ({ row: i + 1, quoteId: r.quoteId!, optionId: r.optionId! }))).subscribe({
      next: (res) => {
        this.booking.set(false);
        const failed = res.filter((x) => !x.booked).map((x) => `${rows[x.row - 1]?.orderNumber ?? 'row ' + x.row}: ${x.message}`);
        this.results.set({ booked: res.filter((x) => x.booked).length, total: rows.length, failed });
        this.review.set(null);
        this.picked.set(new Set());
        this.load();
      },
      error: (e: HttpErrorResponse) => { this.booking.set(false); this.error.set(e.error?.message ?? 'The orders could not be booked.'); }
    });
  }

  archive(o: PortalOrder): void {
    this.svc.archive(o.id).subscribe({ next: () => this.load(), error: (e: HttpErrorResponse) => this.error.set(e.error?.message ?? 'Could not archive.') });
  }

  restore(o: PortalOrder): void {
    this.svc.restore(o.id).subscribe({ next: () => this.load(), error: (e: HttpErrorResponse) => this.error.set(e.error?.message ?? 'Could not restore.') });
  }
}
