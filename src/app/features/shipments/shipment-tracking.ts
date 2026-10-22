import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortalService } from '@core/services/portal.service';
import { ShipmentTracking as Tracking } from '@core/models/portal.model';
import { STATUS_VIEW } from '@shared/utils/shipment-status';
import { TrackingTimeline, TimelineItem } from './tracking-timeline';

/** A shipment booked for the customer at an OCCPL counter: its current status and history. */
@Component({
  selector: 'ecb-shipment-tracking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, DatePipe, TrackingTimeline],
  template: `
    <section class="page">
      <div class="page__head">
        <div>
          <a class="back" routerLink="/dashboard"><ecb-icon name="arrow_back" /> Dashboard</a>
          <h1 class="text-display">Track shipment</h1>
        </div>
      </div>
      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
      @if (data(); as d) {
        <article class="app-card box">
          <div class="row">
            <h2 class="text-h2 mono">{{ d.shipment.trackingNumber || d.shipment.shipmentNumber }}</h2>
            <span [class]="'badge badge--' + status(d).tone">{{ status(d).label }}</span>
          </div>
          <dl class="facts">
            <div><dt>Recipient</dt><dd>{{ d.shipment.receiverName || '—' }}</dd></div>
            <div><dt>Booked</dt><dd>{{ (d.shipment.bookingDate || d.shipment.createdAt) | date: 'mediumDate' }}</dd></div>
            <div><dt>Packages</dt><dd>{{ d.shipment.packages ?? '—' }}</dd></div>
            @if (d.shipment.expectedDeliveryDate) { <div><dt>Expected delivery</dt><dd>{{ d.shipment.expectedDeliveryDate | date: 'mediumDate' }}</dd></div> }
          </dl>
          <ecb-tracking-timeline [items]="items()" />
        </article>
      } @else if (!error()) {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  styles: [`
    .back { display:inline-flex; align-items:center; gap:4px; font:600 13px var(--font-sans); color:var(--content-muted); text-decoration:none; }
    .back ecb-icon { font-size:18px; }
    .box { padding:20px; display:flex; flex-direction:column; gap:16px; max-width:760px; }
    .row { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
    h2 { margin:0; }
    .facts { margin:0; display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:12px 16px; }
    dt { font:600 12px var(--font-sans); color:var(--content-muted); text-transform:uppercase; letter-spacing:.04em; }
    dd { margin:4px 0 0; font:500 14px var(--font-sans); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  `]
})
export class ShipmentTracking implements OnInit {
  readonly shipmentId = input.required<string>();
  private readonly portal = inject(PortalService);
  readonly data = signal<Tracking | null>(null);
  readonly error = signal<string | null>(null);
  readonly items = computed<TimelineItem[]>(() => (this.data()?.steps ?? [])
    .map((s) => ({ at: s.at, status: STATUS_VIEW[s.status]?.label ?? s.status, location: s.location })));

  ngOnInit(): void {
    this.portal.shipmentTracking(this.shipmentId()).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.error.set('This shipment was not found.')
    });
  }

  status(d: Tracking) { return STATUS_VIEW[d.shipment.status]; }
}
