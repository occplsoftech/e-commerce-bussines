import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { KycService } from '@features/kyc/kyc.service';
import { CustomerNameStore } from '@core/services/customer-name.store';
import { PortalService } from '@core/services/portal.service';
import { BookingSummary, DashboardInsights, InsightsPeriod } from '@core/models/portal.model';
import { BarChart } from '@shared/components/charts/bar-chart';
import { SpendChart } from '@shared/components/charts/spend-chart';
import { ChartSlice } from '@shared/components/charts/chart-series';
import { shipmentStatusView } from '@shared/utils/booking-status';

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'AWAITING_PICKUP', label: 'Awaiting pickup', color: 'var(--occpl-color-amber)' },
  { key: 'PICKED_UP', label: 'Picked up', color: 'var(--occpl-color-sky)' },
  { key: 'IN_TRANSIT', label: 'In transit', color: 'var(--occpl-color-accent)' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', color: 'var(--occpl-color-primary)' },
  { key: 'DELIVERED', label: 'Delivered', color: 'var(--occpl-color-success)' },
  { key: 'RETURNED', label: 'Returned', color: 'var(--occpl-color-danger)' }
];
const PERIOD_KEY = 'ecb.dashboard.period';


/**
 * The customer dashboard (12.2): for a period, every booking whatever the courier — spend, where the parcels are, delivered on time,
 * the couriers used, and the shipments that need attention (late, or a failed delivery waiting for an answer); then the latest bookings.
 */
@Component({
  selector: 'ecb-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, DatePipe, CurrencyPipe, BarChart, SpendChart],
  template: `
    <section class="page">
      <div class="page__head" data-icon="space_dashboard">
        <div>
          <h1 class="text-display">Hello{{ customer.name() ? ', ' + customer.name() : '' }}</h1>
          @if (customer.website(); as site) {
            <a class="site" [href]="site" target="_blank" rel="noopener noreferrer">{{ site }}</a>
          }
          <p class="text-caption">Your shipments with every courier, at a glance.</p>
        </div>
        <div class="page__actions">
          <a class="btn btn--primary" routerLink="/book"><ecb-icon name="add" /> Book a shipment</a>
        </div>
      </div>

      @if (kyc.current(); as k) {
        @if (k.status !== 'COMPLETE') {
          <a class="kyc-nudge" routerLink="/kyc">
            <ecb-icon [name]="k.status === 'UNDER_REVIEW' ? 'hourglass_top' : 'verified_user'" />
            @if (k.status === 'UNDER_REVIEW') {
              <span><strong>KYC under review</strong> — your documents are with your courier company for approval.</span>
              <span class="kyc-nudge__go">View →</span>
            } @else {
              <span><strong>Complete your KYC</strong> — {{ k.requiredUploaded + k.requiredApproved + (k.emailVerified ? 1 : 0) + (k.mobileVerified ? 1 : 0) }} of
                {{ k.requiredTotal * 2 + 2 }} steps done. Verify your e-mail and mobile and upload your business documents.</span>
              <span class="kyc-nudge__go">Continue →</span>
            }
          </a>
        }
      }

      @if (error()) {
        <p class="alert alert--error" role="alert">{{ error() }} <button class="btn btn--ghost" type="button" (click)="load()">Retry</button></p>
      }

      <div class="period" role="radiogroup" aria-label="Period">
        @for (p of periods; track p.value) {
          <button type="button" role="radio" [attr.aria-checked]="period() === p.value" [class.on]="period() === p.value" (click)="choose(p.value)">{{ p.label }}</button>
        }
        @if (data(); as d) { <span class="period__range">{{ d.from | date: 'd MMM' }} – {{ d.to | date: 'd MMM y' }}</span> }
      </div>

      <div class="kpis" aria-live="polite">
        <article class="kpi kpi--hero">
          <ecb-icon name="inventory_2" class="kpi__icon" />
          <div><div class="kpi__value num-tabular">{{ data() ? data()!.shipments : '—' }}</div><div class="kpi__label">Shipments booked</div></div>
        </article>
        <article class="kpi" style="--c:var(--occpl-color-sky)">
          <ecb-icon name="payments" class="kpi__icon" />
          <div><div class="kpi__value num-tabular">{{ data() ? (data()!.spend | currency: 'INR' : 'symbol' : '1.0-0') : '—' }}</div>
            <div class="kpi__label">Spend@if (data()?.shipments) { · avg {{ data()!.averageSpend | currency: 'INR' : 'symbol' : '1.0-0' }} }</div></div>
        </article>
        <article class="kpi" style="--c:var(--occpl-color-success)">
          <ecb-icon name="schedule" class="kpi__icon" />
          <div><div class="kpi__value num-tabular">{{ data()?.onTimePercent != null ? data()!.onTimePercent + '%' : '—' }}</div>
            <div class="kpi__label">Delivered on time@if (data()?.onTimeMeasured) { · of {{ data()!.onTimeMeasured }} }</div></div>
        </article>
        <a class="kpi kpi--link" [class.kpi--alert]="(data()?.needAttention ?? 0) > 0" style="--c:var(--occpl-color-amber)" href="#attention" (click)="scrollTo($event)">
          <ecb-icon name="error" class="kpi__icon" />
          <div><div class="kpi__value num-tabular">{{ data() ? data()!.needAttention : '—' }}</div><div class="kpi__label">Need attention</div></div>
        </a>
      </div>

      <div class="charts">
        <article class="app-card chart">
          <h2 class="text-h2">Spend {{ period() === 'LAST_90_DAYS' ? 'per week' : 'per day' }}</h2>
          @if (data(); as d) {
            @if (d.shipments === 0) { <p class="text-caption">No bookings in this period.</p> }
            @else { <ecb-spend-chart [data]="d.spendSeries" [weekly]="period() === 'LAST_90_DAYS'" ariaLabel="Spend over time" /> }
          } @else { <p class="text-caption">Loading…</p> }
        </article>
        <article class="app-card chart">
          <h2 class="text-h2">Where your parcels are</h2>
          @if (data()) { <ecb-bar-chart [data]="stages()" ariaLabel="Shipments by stage" /> } @else { <p class="text-caption">Loading…</p> }
        </article>
      </div>

      @if (data()?.couriers?.length) {
        <article class="app-card couriers">
          <div class="recent__head"><h2 class="text-h2">Couriers you used</h2></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Courier</th><th class="num">Shipments</th><th class="num">Spend</th><th>Share of spend</th><th class="num">On time</th></tr></thead>
              <tbody>
                @for (c of data()!.couriers; track c.providerCode) {
                  <tr>
                    <td><strong>{{ c.providerName }}</strong></td>
                    <td class="num num-tabular">{{ c.shipments }}</td>
                    <td class="num num-tabular">{{ c.spend | currency: 'INR' : 'symbol' : '1.2-2' }}</td>
                    <td><span class="share"><span [style.width.%]="share(c.spend)"></span></span> <span class="text-caption">{{ share(c.spend) }}%</span></td>
                    <td class="num num-tabular">{{ c.onTimePercent != null ? c.onTimePercent + '%' : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </article>
      }

      @if (data(); as d) {
        <div class="attention" id="attention">
          <article class="app-card list">
            <div class="recent__head"><h2 class="text-h2">Late shipments <span class="count" [class.count--bad]="d.lateCount > 0">{{ d.lateCount }}</span></h2></div>
            @if (!d.late.length) { <p class="text-caption pad">Nothing late. Every shipment is within the courier's estimate.</p> }
            @else {
              <ul>
                @for (l of d.late; track l.bookingId) {
                  <li><a [routerLink]="['/shipments', l.bookingId]">
                    <span>@if (l.trackingNumber) { <strong class="mono">{{ l.trackingNumber }}</strong> } @else { <strong>Not collected yet</strong> } · {{ l.providerName }}@if (l.deliveryName) { · to {{ l.deliveryName }} }
                      <br><span class="text-caption">{{ l.lastStatus || 'No update yet' }} · due {{ l.promisedBy | date: 'd MMM' }}</span></span>
                    <span class="late">{{ l.daysLate }} {{ l.daysLate === 1 ? 'day' : 'days' }} late</span></a></li>
                }
              </ul>
              @if (d.lateCount > d.late.length) { <p class="text-caption pad">and {{ d.lateCount - d.late.length }} more</p> }
            }
          </article>
          <article class="app-card list">
            <div class="recent__head"><h2 class="text-h2">Delivery failed — answer needed <span class="count" [class.count--warn]="d.needAnswerCount > 0">{{ d.needAnswerCount }}</span></h2></div>
            @if (!d.needAnswer.length) { <p class="text-caption pad">No failed deliveries waiting for you.</p> }
            @else {
              <ul>
                @for (n of d.needAnswer; track n.bookingId) {
                  <li><a [routerLink]="['/shipments', n.bookingId]">
                    <span><strong class="mono">{{ n.trackingNumber || '—' }}</strong> · {{ n.providerName }}@if (n.deliveryName) { · to {{ n.deliveryName }} }</span>
                    <span class="answer">Choose what to do →</span></a></li>
                }
              </ul>
            }
          </article>
        </div>
      }

      <article class="app-card recent">
        <div class="recent__head"><h2 class="text-h2">Recent shipments</h2> <a routerLink="/shipments" class="text-caption">All shipments →</a></div>
        @if (!recent()) {
          <p class="text-caption pad">{{ error() ? 'Not available.' : 'Loading…' }}</p>
        } @else if (recent()!.length === 0) {
          <div class="empty">
            <ecb-icon name="inventory_2" />
            <p>No shipments yet. Book your first one — it takes a couple of minutes.</p>
            <a class="btn btn--primary" routerLink="/book">Book a shipment</a>
          </div>
        } @else {
          <div class="table-wrap">
            <table>
              <thead><tr><th>Tracking no.</th><th>Booked</th><th>Courier</th><th>Recipient</th><th class="num">Price</th><th>Status</th></tr></thead>
              <tbody>
                @for (b of recent()!; track b.bookingId) {
                  <tr>
                    <td class="mono"><a [routerLink]="['/shipments', b.bookingId]">{{ b.trackingNumber || b.bookingReference || '—' }}</a></td>
                    <td>{{ (b.bookedAt || b.createdAt) | date: 'mediumDate' }}</td>
                    <td>{{ b.providerName }}</td>
                    <td>{{ b.deliveryName || '—' }}@if (b.deliveryCity) { <span class="text-caption"> · {{ b.deliveryCity }}</span> }</td>
                    <td class="num num-tabular">{{ b.totalAmount | currency: b.currency : 'symbol' : '1.2-2' }}</td>
                    <td><span [class]="'badge badge--' + view(b).tone">{{ view(b).label }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </article>
    </section>
  `,
  styles: [`
    .kyc-nudge { display:flex; align-items:center; gap:14px; padding:14px 18px; border-radius:18px; text-decoration:none; color:var(--content-fg);
      background:var(--warning-bg); border:1px solid color-mix(in srgb, var(--warning) 40%, transparent); font-size:.95rem; }
    .kyc-nudge ecb-icon { font-size:1.5rem; color:var(--warning); flex:none; }
    .kyc-nudge span { flex:1; }
    .kyc-nudge__go { flex:none !important; font-weight:800; color:var(--occpl-color-link); }
    .kpis { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:16px; }
    .kpi { --c:var(--occpl-color-accent); position:relative; display:flex; align-items:center; gap:14px; padding:18px; border-radius:22px; overflow:hidden;
      background:color-mix(in srgb, var(--c) 12%, var(--occpl-color-surface)); border:1px solid color-mix(in srgb, var(--c) 30%, var(--surface-border)); }
    .kpi::after { content:''; position:absolute; right:-18px; top:-18px; width:84px; height:84px; border-radius:50%; background:color-mix(in srgb, var(--c) 18%, transparent); }
    .kpi__icon { display:grid; place-items:center; width:46px; height:46px; border-radius:14px; background:var(--c); color:#fff; font-size:1.3rem; position:relative; z-index:1; }
    .kpi__value { font:800 1.7rem var(--font-display); color:var(--content-fg); }
    .kpi__label { font:600 .85rem var(--font-sans); color:var(--content-muted); }
    .kpi--hero { background:var(--occpl-gradient-brand); border-color:transparent; }
    .kpi--hero .kpi__icon { background:rgb(255 255 255 / 22%); }
    .kpi--hero .kpi__value, .kpi--hero .kpi__label { color:#fff; }
    .kpi--hero .kpi__value { font-size:2.4rem; }
    .kpi--hero::after { background:rgb(255 255 255 / 12%); }
    .charts { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:16px; }
    .chart { padding:20px; display:flex; flex-direction:column; gap:12px; }
    .chart h2 { margin:0; }
    @media (max-width: 64rem) { .kpis { grid-template-columns:repeat(2, minmax(0, 1fr)); } .charts { grid-template-columns:minmax(0, 1fr); } }
    .period { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
    .period button { border:1px solid var(--surface-border); background:var(--occpl-color-surface); color:var(--content-fg); border-radius:999px;
      padding:7px 14px; font:600 13px var(--font-sans); cursor:pointer; }
    .period button.on { background:var(--occpl-gradient-brand); color:#fff; border-color:transparent; }
    .period__range { margin-left:auto; font:600 13px var(--font-sans); color:var(--content-muted); }
    .kpi--link { text-decoration:none; color:inherit; }
    .kpi--alert { outline:2px solid color-mix(in srgb, var(--c) 55%, transparent); }
    .couriers, .list { padding:0; overflow:hidden; }
    .share { display:inline-block; width:120px; height:8px; border-radius:999px; background:var(--surface-muted); overflow:hidden; vertical-align:middle; }
    .share span { display:block; height:100%; background:var(--occpl-color-primary); border-radius:999px; }
    .num { text-align:right; }
    .attention { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:16px; scroll-margin-top:90px; }
    @media (max-width: 64rem) { .attention { grid-template-columns:minmax(0, 1fr); } }
    .list ul { list-style:none; margin:0; padding:0; }
    .list li a { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 20px; border-top:1px solid var(--surface-border);
      text-decoration:none; color:var(--content-fg); font-size:14px; }
    .list li:first-child a { border-top:0; }
    .list li a:hover { background:var(--surface-muted); }
    .late { flex:none; font:800 12px var(--font-sans); color:var(--occpl-color-danger); }
    .answer { flex:none; font:700 12px var(--font-sans); color:var(--occpl-color-link); }
    .count { display:inline-block; min-width:24px; padding:1px 8px; margin-left:6px; border-radius:999px; background:var(--surface-muted);
      font:800 13px var(--font-sans); text-align:center; vertical-align:middle; }
    .count--bad { background:color-mix(in srgb, var(--occpl-color-danger) 15%, transparent); color:var(--occpl-color-danger); }
    .count--warn { background:var(--warning-bg); color:var(--warning); }
    .recent { padding:0; overflow:hidden; }
    .recent__head { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:18px 20px; border-bottom:1px solid var(--surface-border); }
    .recent__head h2 { margin:0; }
    .site { font:500 13px var(--font-sans); }
    .pad { padding:20px; }
    .empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:40px 20px; text-align:center; color:var(--content-muted); }
    .empty ecb-icon { font-size:40px; color:var(--brand-300); }
    .table-wrap { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; font:400 14px var(--font-sans); }
    th { text-align:left; font:600 12px var(--font-sans); text-transform:uppercase; letter-spacing:.04em; color:var(--content-muted); padding:12px 20px; background:var(--surface-muted); }
    td { padding:14px 20px; border-top:1px solid var(--surface-border); white-space:nowrap; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  `]
})
export class Dashboard implements OnInit {
  protected readonly customer = inject(CustomerNameStore);
  private readonly portal = inject(PortalService);
  protected readonly kyc = inject(KycService);
  readonly periods: { value: InsightsPeriod; label: string }[] = [
    { value: 'LAST_7_DAYS', label: 'Last 7 days' }, { value: 'LAST_30_DAYS', label: 'Last 30 days' },
    { value: 'LAST_90_DAYS', label: 'Last 90 days' }, { value: 'THIS_MONTH', label: 'This month' }];
  readonly period = signal<InsightsPeriod>(Dashboard.savedPeriod());
  readonly data = signal<DashboardInsights | null>(null);
  readonly recent = signal<BookingSummary[] | null>(null);
  readonly error = signal<string | null>(null);

  readonly stages = computed<ChartSlice[]>(() => {
    const st = this.data()?.stages ?? {};
    return STAGES.map((s) => ({ label: s.label, value: st[s.key] ?? 0, color: s.color }));
  });

  ngOnInit(): void {
    this.load();
    this.portal.bookings({ status: '', delivery: '', provider: '', from: '', to: '' }, 0, 5).subscribe({
      next: (p) => this.recent.set(p.content),
      error: () => this.recent.set([])
    });
    this.kyc.view().subscribe({ error: () => undefined });
  }

  load(): void {
    this.error.set(null);
    this.portal.insights(this.period()).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.error.set('Could not load your dashboard.')
    });
  }

  choose(p: InsightsPeriod): void {
    if (p === this.period()) return;
    this.period.set(p);
    try { localStorage.setItem(PERIOD_KEY, p); } catch { /* the choice is only a convenience */ }
    this.data.set(null);
    this.load();
  }

  /** A courier's share of the period's spend, whole percent. */
  share(spend: number): number {
    const total = this.data()?.spend ?? 0;
    return total > 0 ? Math.round((spend / total) * 100) : 0;
  }

  scrollTo(e: Event): void {
    e.preventDefault();
    document.getElementById('attention')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  view(b: BookingSummary) { return shipmentStatusView(b); }

  private static savedPeriod(): InsightsPeriod {
    try {
      const v = localStorage.getItem(PERIOD_KEY);
      if (v === 'LAST_7_DAYS' || v === 'LAST_30_DAYS' || v === 'LAST_90_DAYS' || v === 'THIS_MONTH') return v;
    } catch { /* storage blocked */ }
    return 'LAST_30_DAYS';
  }
}
