import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PortalService } from '@core/services/portal.service';
import { BookingDetail as Detail, BookingParty, TrackingView } from '@core/models/portal.model';
import { shipmentStatusView } from '@shared/utils/booking-status';
import { errorMessage, saveBlob } from '@shared/utils/http-error';
import { TransportModePipe } from '@features/booking/transport-mode.pipe';
import { PaymentLabelPipe } from '@features/booking/payment-mode.pipe';
import { TrackingTimeline } from './tracking-timeline';
import { ShipmentProgress } from './shipment-progress';
import { LabelSheet } from '@features/booking/label-sheet';
import { BookingPhotos } from '@features/booking/booking-photos';

/** One booking: its status flow, who, what, the frozen price, live tracking history from the courier and the label download. */
import { CourierLogo } from '@shared/components/courier-logo';

/** Today plus {@code days}, as YYYY-MM-DD in India time (what the date input and the server both use). */
function isoDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

@Component({
  selector: 'ecb-booking-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CourierLogo, Icon, RouterLink, CurrencyPipe, DatePipe, DecimalPipe, TransportModePipe, PaymentLabelPipe, TrackingTimeline, ShipmentProgress, LabelSheet, BookingPhotos],
  template: `
    <section class="page">
      <div class="page__head" data-icon="description">
        <div>
          <a class="back" routerLink="/shipments"><ecb-icon name="arrow_back" /> Shipments</a>
          <h1 class="text-display">Shipment@if (booking()?.trackingNumber; as awb) { <span class="awb">{{ awb }}</span> }</h1>
        </div>
        @if (booking(); as b) {
          <div class="page__actions">
            @if (b.status === 'BOOKED' || b.status === 'OUTCOME_UNKNOWN') {
              <button class="btn btn--ghost" type="button" (click)="printLabel()"><ecb-icon name="print" /> Print label</button>
            }
            @if (b.cancellable) {
              <button class="btn btn--ghost" type="button" (click)="confirmingCancel.set(true)" [disabled]="confirmingCancel() || cancelling()"><ecb-icon name="cancel" /> Cancel booking</button>
            }
            @if (b.labelDownloadable) {
              <button class="btn btn--primary" type="button" (click)="downloadLabel(b)" [disabled]="downloading()">
                <ecb-icon name="print" /> {{ downloading() ? 'Preparing…' : 'Download label' }}
              </button>
            }
          </div>
        }
      </div>

      @if (confirmingCancel()) {
        <article class="app-card box cancelbox" role="alertdialog" aria-labelledby="cancel-title">
          <h2 id="cancel-title" class="text-h2">Cancel this booking?</h2>
          <p class="text-caption">The pickup is called off and the tracking number is released. If you paid from your wallet, the amount goes back to it. This cannot be undone once the parcel is collected.</p>
          <label class="field"><span>Reason (optional)</span>
            <input type="text" maxlength="150" [value]="cancelReason()" (input)="cancelReason.set($any($event.target).value)" placeholder="e.g. wrong address" /></label>
          <div class="cancelbox__actions">
            <button class="btn btn--primary" type="button" (click)="cancelBooking()" [disabled]="cancelling()">{{ cancelling() ? 'Cancelling…' : 'Yes, cancel booking' }}</button>
            <button class="btn btn--ghost" type="button" (click)="confirmingCancel.set(false)" [disabled]="cancelling()">Keep booking</button>
          </div>
        </article>
      }
      @if (cancelMessage()) { <p class="alert alert--ok" role="status">{{ cancelMessage() }}</p> }
      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
      @if (labelError()) { <p class="alert alert--warn" role="alert">{{ labelError() }}</p> }

      @if (booking(); as b) {
        <article class="app-card box progress">
          <div class="row">
            <h2 class="text-h2">Status</h2>
            @if (b.status === 'BOOKED' && tracking()?.status) {
              <span class="text-caption">Courier says: <strong>{{ tracking()!.status }}</strong>@if (tracking()!.currentLocation) { · {{ tracking()!.currentLocation }} }</span>
            } @else if (b.deliveryStatus; as d) {
              <span class="text-caption">Last update: <strong>{{ d.text || d.stage }}</strong>@if (d.location) { · {{ d.location }} }
                @if (d.checkedAt) { · checked {{ d.checkedAt | date: 'd MMM, h:mm a' }} }</span>
            }
          </div>
          <ecb-shipment-progress [booking]="b" [tracking]="tracking()" />
        </article>
        <div class="layout">
          <div class="col">
            <article class="app-card box">
              <div class="row">
                <h2 class="text-h2 prov"><ecb-courier-logo [code]="b.providerCode" [name]="b.providerName" style="--logo-size:2.5rem" /> {{ b.providerName }}@if (b.serviceName) { · {{ b.serviceName }} }</h2>
                <span [class]="'badge badge--' + statusView(b).tone">{{ statusView(b).label }}</span>
              </div>
              @if (b.status === 'OUTCOME_UNKNOWN') {
                <p class="alert alert--warn">The courier may have accepted this booking. Our team is confirming it — please do not book it again.</p>
              } @else if (b.status === 'CANCELLED') {
                <p class="alert alert--warn">This booking was cancelled before pickup. Nothing is payable.</p>
              } @else if (b.status === 'FAILED') {
                <p class="alert alert--error">Nothing was booked and nothing is payable.@if (b.message) { {{ b.message }} }</p>
              }
              <dl class="facts">
                <div><dt>Tracking number</dt><dd class="mono">{{ b.trackingNumber || (b.providerCode === 'OCCPL_NETWORK' ? 'Issued when the parcel is collected' : '—') }}</dd></div>
                @if (b.bookingReference) { <div><dt>Courier reference</dt><dd class="mono">{{ b.bookingReference }}</dd></div> }
                <div><dt>Booked</dt><dd>{{ (b.bookedAt || b.createdAt) | date: 'medium' }}</dd></div>
                @if (b.transportMode) { <div><dt>Mode</dt><dd>{{ b.transportMode | titlecaseMode }}</dd></div> }
                @if (b.etaMaxDays) { <div><dt>Estimated delivery</dt><dd>{{ eta(b) }}</dd></div> }
                <div><dt>Booking ID</dt><dd class="mono small">{{ b.bookingId }}</dd></div>
              </dl>
            </article>

            <article class="app-card box">
              <div class="row">
                <h2 class="text-h2">Tracking history</h2>
                @if (b.status === 'BOOKED') {
                  <button class="btn btn--ghost" type="button" (click)="refreshTracking()" [disabled]="tracking() === undefined">
                    <ecb-icon name="refresh" /> Refresh
                  </button>
                }
              </div>
              @if (b.status !== 'BOOKED') {
                <p class="text-caption">Tracking starts once the booking is confirmed.</p>
              } @else if (tracking() === undefined) {
                <p class="text-caption">Asking {{ b.providerName }}…</p>
              } @else if (tracking(); as t) {
                @if (!t.available) { <p class="text-caption">{{ t.message }}</p> }
                <ecb-tracking-timeline [items]="t.events" />
                <p class="text-caption">Updated {{ t.retrievedAt | date: 'shortTime' }}</p>
              } @else {
                <p class="text-caption">{{ trackingError() }}</p>
              }
            </article>
          </div>

          <div class="col">
            @if (b.status === 'BOOKED' && (b.cancellable || b.pickupDate)) {
              <article class="app-card box pickupbox">
                <div class="row">
                  <h2 class="text-h2">Pickup time</h2>
                  @if (b.cancellable && !rescheduling()) {
                    <button class="btn btn--ghost" type="button" (click)="startReschedule(b)"><ecb-icon name="event" /> Change pickup time</button>
                  }
                </div>
                @if (!rescheduling()) {
                  <p class="pickup__now">@if (b.pickupDate) { <strong>{{ b.pickupDate | date: 'EEE, d MMM yyyy' }}</strong>@if (b.pickupSlot) { · {{ b.pickupSlot }} } } @else { No time chosen. Our branch will contact you to arrange it. }</p>
                } @else {
                  <div class="pickup__form">
                    <label class="field"><span>Pickup date</span>
                      <input type="date" [min]="minDate()" [max]="maxDate()" [value]="newDate()" (input)="newDate.set($any($event.target).value)" /></label>
                    <label class="field"><span>Time slot</span>
                      <select [value]="newSlot()" (change)="newSlot.set($any($event.target).value)">
                        <option value="">Any time</option>
                        @for (s of b.pickupSlots ?? []; track s) { <option [value]="s" [selected]="s === newSlot()">{{ s }}</option> }
                      </select></label>
                  </div>
                  <div class="cancelbox__actions">
                    <button class="btn btn--primary" type="button" (click)="saveReschedule()" [disabled]="savingPickup() || !newDate()">{{ savingPickup() ? 'Saving…' : 'Save pickup time' }}</button>
                    <button class="btn btn--ghost" type="button" (click)="rescheduling.set(false)" [disabled]="savingPickup()">Keep current time</button>
                  </div>
                }
                @if (pickupMessage()) { <p class="alert alert--ok" role="status">{{ pickupMessage() }}</p> }
                @if (pickupError()) { <p class="alert alert--error" role="alert">{{ pickupError() }}</p> }
              </article>
            }
            <article class="app-card box">
              <h2 class="text-h2">Route</h2>
              <div class="parties">
                <div><h3 class="text-h3">Pickup</h3><p>{{ party(b.pickup) }}</p></div>
                <div><h3 class="text-h3">Delivery</h3><p>{{ party(b.delivery) }}</p></div>
              </div>
            </article>
            @if (b.parcel; as p) {
              <article class="app-card box">
                <h2 class="text-h2">Parcel</h2>
                <dl class="facts">
                  <div><dt>Contents</dt><dd>{{ p.contents || '—' }}</dd></div>
                  <div><dt>Packages</dt><dd>{{ p.packageCount }}</dd></div>
                  <div><dt>Weight</dt><dd>{{ p.actualWeightKg | number: '1.0-3' }} kg@if (p.chargeableWeightKg) { (charged {{ p.chargeableWeightKg | number: '1.0-3' }} kg) }</dd></div>
                  @if (p.length) { <div><dt>Size</dt><dd>{{ p.length }} × {{ p.breadth }} × {{ p.height }} {{ (p.dimensionUnit || 'cm') === 'IN' ? 'in' : 'cm' }}</dd></div> }
                  <div><dt>Declared value</dt><dd>{{ p.declaredValue | currency: 'INR' : 'symbol' : '1.2-2' }}</dd></div>
                  <div><dt>Payment</dt><dd>{{ p.paymentMode | paymentLabel }}</dd></div>
                </dl>
              </article>
            }
            @if (b.status !== 'FAILED') {
              <article class="app-card box"><ecb-booking-photos [bookingId]="b.bookingId" [editable]="b.status === 'BOOKED' || b.status === 'OUTCOME_UNKNOWN'" /></article>
            }
            <article class="app-card box">
              <h2 class="text-h2">Price</h2>
              <table class="charges">
                <tbody>
                  @for (c of b.charges; track $index) {
                    <tr><td>{{ c.label }}</td><td class="num num-tabular">{{ c.amount | currency: b.currency : 'symbol' : '1.2-2' }}</td></tr>
                  }
                  <tr class="total"><td>Total</td><td class="num num-tabular">{{ b.totalAmount | currency: b.currency : 'symbol' : '1.2-2' }}</td></tr>
                </tbody>
              </table>
              <p class="text-caption">The price you confirmed when booking.</p>
            </article>
          </div>
        </div>
        @if (showLabel()) { <ecb-label-sheet [booking]="b" /> }
      } @else if (!error()) {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  styles: [`
    .back { display:inline-flex; align-items:center; gap:4px; font:600 13px var(--font-sans); color:var(--content-muted); text-decoration:none; }
    .prov { display:flex; align-items:center; gap:12px; margin:0; }
    .back ecb-icon { font-size:18px; }
    .awb { margin-left:12px; font:600 .5em ui-monospace, SFMono-Regular, Menlo, monospace; color:var(--content-muted); vertical-align:middle; }
    .progress { margin-bottom:0; }
    .pickup__now { margin:0; font:500 15px var(--font-sans); }
    .pickup__form { display:flex; gap:12px; flex-wrap:wrap; }
    .pickup__form select { padding:10px 12px; border:1px solid var(--surface-border); border-radius:var(--r-field); background:var(--surface); color:inherit; font:400 14px var(--font-sans); }
    .cancelbox { border:1px solid var(--occpl-color-primary); }
    .cancelbox__actions { display:flex; gap:10px; flex-wrap:wrap; }
    .field { display:flex; flex-direction:column; gap:4px; font:500 13px var(--font-sans); max-width:420px; }
    .field input { padding:10px 12px; border:1px solid var(--surface-border); border-radius:var(--r-field); background:var(--surface); color:inherit; font:400 14px var(--font-sans); }
    .layout { display:grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap:16px; align-items:start; }
    .col { display:flex; flex-direction:column; gap:16px; min-width:0; }
    .box { padding:20px; display:flex; flex-direction:column; gap:12px; }
    .row { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
    h2, h3 { margin:0; }
    .facts { margin:0; display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:12px 16px; }
    dt { font:600 12px var(--font-sans); color:var(--content-muted); text-transform:uppercase; letter-spacing:.04em; }
    dd { margin:4px 0 0; font:500 14px var(--font-sans); overflow-wrap:anywhere; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .small { font-size:12px; }
    .parties { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .parties p { margin:4px 0 0; font:400 14px/1.5 var(--font-sans); overflow-wrap:anywhere; white-space:pre-line; }
    .charges { width:100%; border-collapse:collapse; font:400 14px var(--font-sans); }
    .charges td { padding:6px 0; border-bottom:1px solid var(--surface-border); }
    .charges .total td { font-weight:700; border-bottom:0; }
    .num { text-align:right; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    @media (max-width: 520px) { .parties { grid-template-columns: 1fr; } }
  `]
})
export class BookingDetail implements OnInit {
  readonly bookingId = input.required<string>();
  private readonly portal = inject(PortalService);
  readonly booking = signal<Detail | null>(null);
  /** undefined while asking, null when the request failed. */
  readonly tracking = signal<TrackingView | null | undefined>(undefined);
  readonly error = signal<string | null>(null);
  readonly trackingError = signal('Tracking could not be loaded. Please try again.');
  readonly labelError = signal<string | null>(null);
  readonly downloading = signal(false);
  readonly rescheduling = signal(false);
  readonly savingPickup = signal(false);
  readonly newDate = signal('');
  readonly newSlot = signal('');
  readonly pickupMessage = signal('');
  readonly pickupError = signal('');
  /** Today and 14 days on, as YYYY-MM-DD in the customer's own date (India). */
  readonly minDate = () => isoDate(0);
  readonly maxDate = () => isoDate(14);

  startReschedule(b: Detail): void {
    this.pickupMessage.set('');
    this.pickupError.set('');
    this.newDate.set(b.pickupDate ?? isoDate(0));
    this.newSlot.set(b.pickupSlot ?? '');
    this.rescheduling.set(true);
  }

  saveReschedule(): void {
    this.savingPickup.set(true);
    this.pickupError.set('');
    this.portal.reschedulePickup(this.bookingId(), this.newDate(), this.newSlot()).subscribe({
      next: () => {
        this.savingPickup.set(false);
        this.rescheduling.set(false);
        this.pickupMessage.set('Pickup time updated. The branch will collect on the new date.');
        this.portal.booking(this.bookingId()).subscribe((b) => this.booking.set(b));
      },
      error: async (e: HttpErrorResponse) => {
        this.savingPickup.set(false);
        this.pickupError.set(await errorMessage(e, 'The pickup time could not be changed. Please try again.'));
      }
    });
  }

  readonly confirmingCancel = signal(false);
  readonly cancelling = signal(false);
  readonly cancelReason = signal('');
  readonly cancelMessage = signal('');

  cancelBooking(): void {
    this.cancelling.set(true);
    this.error.set(null);
    this.portal.cancelBooking(this.bookingId(), this.cancelReason()).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.confirmingCancel.set(false);
        this.cancelMessage.set('Booking cancelled. If you paid from your wallet, the amount has been credited back.');
        this.portal.booking(this.bookingId()).subscribe((b) => this.booking.set(b));
      },
      error: async (e: HttpErrorResponse) => {
        this.cancelling.set(false);
        this.confirmingCancel.set(false);
        this.error.set(await errorMessage(e, 'The booking could not be cancelled. Please try again.'));
      }
    });
  }
  readonly showLabel = signal(false);
  private readonly sheet = viewChild(LabelSheet);

  /** Print the label again: our own label (Code 128 of the reference), four to an A4 sheet. */
  printLabel(): void {
    this.showLabel.set(true);
    setTimeout(() => this.sheet()?.print(), 150);
  }

  ngOnInit(): void {
    this.portal.booking(this.bookingId()).subscribe({
      next: (b) => {
        this.booking.set(b);
        if (b.status === 'BOOKED') this.refreshTracking();
      },
      error: () => this.error.set('This booking was not found.')
    });
  }

  refreshTracking(): void {
    this.tracking.set(undefined);
    this.portal.tracking(this.bookingId()).subscribe({
      next: (t) => {
        this.tracking.set(t);
        const b = this.booking();
        if (b && t.trackingNumber && !b.trackingNumber) this.booking.set({ ...b, trackingNumber: t.trackingNumber });
      },
      error: async (e: HttpErrorResponse) => {
        this.trackingError.set(await errorMessage(e, 'Tracking could not be loaded. Please try again.'));
        this.tracking.set(null);
      }
    });
  }

  downloadLabel(b: Detail): void {
    this.labelError.set(null);
    this.downloading.set(true);
    this.portal.label(b.bookingId).subscribe({
      next: (pdf) => {
        this.downloading.set(false);
        saveBlob(pdf, `label-${b.trackingNumber || b.bookingId}.pdf`);
      },
      error: async (e: HttpErrorResponse) => {
        this.downloading.set(false);
        this.labelError.set(await errorMessage(e, 'The label could not be downloaded. Please try again.'));
      }
    });
  }

  statusView(b: Detail) { return shipmentStatusView(b); }

  party(p: BookingParty): string {
    return [p.name, p.phone, p.address, [p.city, p.state].filter((x) => !!x).join(', '), p.pincode].filter((x) => !!x).join('\n');
  }

  eta(b: Detail): string {
    if (!b.etaMaxDays) return '—';
    return b.etaMinDays && b.etaMinDays !== b.etaMaxDays ? `${b.etaMinDays}–${b.etaMaxDays} days` : `${b.etaMaxDays} days`;
  }
}
