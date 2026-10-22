import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CustomerNameStore } from '@core/services/customer-name.store';
import { PortalService } from '@core/services/portal.service';
import { PortalDashboard } from '@core/models/portal.model';
import { BarChart } from '@shared/components/charts/bar-chart';
import { DonutChart } from '@shared/components/charts/donut-chart';
import { ChartSlice } from '@shared/components/charts/chart-series';
import { STATUS_VIEW } from '@shared/utils/shipment-status';

/** Counts by stage, recent shipments and the quick "Book a shipment" action. */
@Component({
  selector: 'ecb-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, DatePipe, BarChart, DonutChart],
  template: `
    <section class="page">
      <div class="page__head">
        <div>
          <h1 class="text-display">Hello{{ customer.name() ? ', ' + customer.name() : '' }}</h1>
          @if (customer.website(); as site) {
            <a class="site" [href]="site" target="_blank" rel="noopener noreferrer">{{ site }}</a>
          }
          <p class="text-caption">Your shipments at a glance.</p>
        </div>
        <div class="page__actions">
          <a class="btn btn--primary" routerLink="/book"><ecb-icon name="add" /> Book a shipment</a>
        </div>
      </div>

      @if (error()) {
        <p class="alert alert--error" role="alert">{{ error() }} <button class="btn btn--ghost" type="button" (click)="load()">Retry</button></p>
      }

      <div class="kpis" aria-live="polite">
        @for (k of kpis(); track k.label; let first = $first) {
          <article class="kpi" [class.kpi--hero]="first" [style.--c]="k.color">
            <ecb-icon [name]="k.icon" class="kpi__icon" />
            <div>
              <div class="kpi__value num-tabular">{{ data() ? k.value : '—' }}</div>
              <div class="kpi__label">{{ k.label }}</div>
            </div>
          </article>
        }
      </div>

      <div class="charts">
        <article class="app-card chart">
          <h2 class="text-h2">Shipments by stage</h2>
          @if (data()) { <ecb-bar-chart [data]="slices()" ariaLabel="Shipments by stage" /> } @else { <p class="text-caption">Loading…</p> }
        </article>
        <article class="app-card chart">
          <h2 class="text-h2">Share of shipments</h2>
          @if (data()) {
            @if (total() === 0) { <p class="text-caption">Your chart appears once you have booked a shipment.</p> }
            @else { <ecb-donut-chart [data]="slices()" ariaLabel="Share of shipments by stage" centerLabel="Shipments" /> }
          } @else { <p class="text-caption">Loading…</p> }
        </article>
      </div>

      <article class="app-card recent">
        <div class="recent__head"><h2 class="text-h2">Recent shipments</h2></div>
        @if (!data()) {
          <p class="text-caption pad">{{ error() ? 'Not available.' : 'Loading…' }}</p>
        } @else if (data()!.recentShipments.length === 0) {
          <div class="empty">
            <ecb-icon name="inventory_2" />
            <p>No shipments yet. Book your first one — it takes a couple of minutes.</p>
            <a class="btn btn--primary" routerLink="/book">Book a shipment</a>
          </div>
        } @else {
          <div class="table-wrap">
            <table>
              <thead><tr><th>Tracking no.</th><th>Booked</th><th>Recipient</th><th>Packages</th><th>Status</th></tr></thead>
              <tbody>
                @for (s of data()!.recentShipments; track s.id) {
                  <tr>
                    <td class="mono"><a [routerLink]="['/shipments/track', s.id]">{{ s.trackingNumber || s.shipmentNumber }}</a></td>
                    <td>{{ s.bookingDate ? (s.bookingDate | date: 'mediumDate') : (s.createdAt | date: 'mediumDate') }}</td>
                    <td>{{ s.receiverName || '—' }}</td>
                    <td class="num-tabular">{{ s.packages ?? '—' }}</td>
                    <td><span class="badge" [class]="'badge badge--' + status(s.status).tone">{{ status(s.status).label }}</span></td>
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
    .kpis { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:16px; }
    .kpi { --c:var(--occpl-color-accent); position:relative; display:flex; align-items:center; gap:14px; padding:18px; border-radius:22px; overflow:hidden;
      background:color-mix(in srgb, var(--c) 12%, var(--occpl-color-surface)); border:1px solid color-mix(in srgb, var(--c) 30%, var(--surface-border)); }
    .kpi::after { content:''; position:absolute; right:-18px; top:-18px; width:84px; height:84px; border-radius:50%; background:color-mix(in srgb, var(--c) 18%, transparent); }
    .kpi__icon { display:grid; place-items:center; width:46px; height:46px; border-radius:14px; background:var(--c); color:#fff; font-size:1.3rem; position:relative; z-index:1; }
    .kpi__value { font:800 1.7rem var(--font-display); color:var(--content-fg); }
    .kpi__label { font:600 .85rem var(--font-sans); color:var(--content-muted); }
    .kpi--hero { grid-column:span 2; background:var(--occpl-gradient-brand); border-color:transparent; }
    .kpi--hero .kpi__icon { background:rgb(255 255 255 / 22%); }
    .kpi--hero .kpi__value, .kpi--hero .kpi__label { color:#fff; }
    .kpi--hero .kpi__value { font-size:2.4rem; }
    .kpi--hero::after { background:rgb(255 255 255 / 12%); }
    .charts { display:grid; grid-template-columns:minmax(0, 3fr) minmax(0, 2fr); gap:16px; }
    .chart { padding:20px; display:flex; flex-direction:column; gap:12px; }
    .chart h2 { margin:0; }
    @media (max-width: 64rem) { .kpis { grid-template-columns:repeat(2, minmax(0, 1fr)); } .charts { grid-template-columns:minmax(0, 1fr); } }
    @media (max-width: 36rem) { .kpi--hero { grid-column:auto; } }
    .recent { padding:0; overflow:hidden; }
    .recent__head { padding:18px 20px; border-bottom:1px solid var(--surface-border); }
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
  readonly data = signal<PortalDashboard | null>(null);
  readonly error = signal<string | null>(null);

  readonly kpis = () => {
    const d = this.data();
    return [
      { label: 'Total shipments', value: d?.totalShipments ?? 0, icon: 'inventory_2', color: 'var(--occpl-color-primary)' },
      { label: 'Pending bookings', value: d?.pendingBookings ?? 0, icon: 'hourglass_top', color: 'var(--occpl-color-amber)' },
      { label: 'Booked', value: d?.booked ?? 0, icon: 'event_available', color: 'var(--occpl-color-sky)' },
      { label: 'In transit', value: d?.inTransit ?? 0, icon: 'local_shipping', color: 'var(--occpl-color-accent)' },
      { label: 'Delivered', value: d?.delivered ?? 0, icon: 'task_alt', color: 'var(--occpl-color-success)' },
      { label: 'Returned', value: d?.returned ?? 0, icon: 'undo', color: 'var(--occpl-color-teal)' },
      { label: 'Cancelled', value: d?.cancelled ?? 0, icon: 'block', color: 'var(--occpl-color-danger)' }
    ];
  };

  /** The stages shown in both charts, each in the colour of its tile. */
  readonly slices = computed<ChartSlice[]>(() => this.kpis().slice(1).map((k) => ({ label: k.label, value: k.value, color: k.color })));
  readonly total = computed(() => this.slices().reduce((n, s) => n + s.value, 0));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.error.set(null);
    this.portal.dashboard().subscribe({
      next: (d) => this.data.set(d),
      error: () => this.error.set('Could not load your dashboard.')
    });
  }

  status(s: keyof typeof STATUS_VIEW) { return STATUS_VIEW[s]; }
}
