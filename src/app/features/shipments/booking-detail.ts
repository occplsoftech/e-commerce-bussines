import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PortalService } from '@core/services/portal.service';
import { BookingDetail as Detail, BookingParty, ProofOfDelivery, TrackingView } from '@core/models/portal.model';
import { RuntimeConfigService } from '@core/config/runtime-config.service';
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
            @if (returnable(b)) {
              <a class="btn btn--ghost" routerLink="/book" [queryParams]="{ returnOf: b.bookingId }"><ecb-icon name="undo" /> Book a return pickup</a>
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
                @if (b.returnOfBookingId) {
                  <div><dt>Return pickup</dt><dd>Collected from your buyer and brought back to you ·
                    <a [routerLink]="['/shipments', b.returnOfBookingId]">original shipment</a></dd></div>
                }
                @if (b.codAmount) {
                  <div><dt>Cash on delivery</dt><dd>{{ b.codAmount | currency: b.currency : 'symbol' : '1.2-2' }}
                    <span class="small cod-state">@if (b.codCollectedAt) { · collected {{ b.codCollectedAt | date: 'd MMM' }}, credited to your wallet } @else { · to be collected on delivery }</span></dd></div>
                }
                @if (b.rtoCharge) {
                  <div><dt>Return charge (RTO)</dt><dd>{{ b.rtoCharge | currency: b.currency : 'symbol' : '1.2-2' }}
                    <span class="small cod-state"> · the forward freight, taken from your wallet@if (b.rtoChargedAt) { on {{ b.rtoChargedAt | date: 'd MMM' }} }</span></dd></div>
                }
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
            @if (b.proofOfDelivery; as pod) {
              <article class="app-card box podbox">
                <div class="row">
                  <h2 class="text-h2">Proof of delivery</h2>
                  <button class="btn btn--primary" type="button" (click)="printPod(b, pod)"><ecb-icon name="download" /> Download POD</button>
                </div>
                <p class="pod__who">Delivered to <strong>{{ pod.deliveredTo || 'the receiver' }}</strong>@if (pod.deliveredAt) { on {{ pod.deliveredAt | date: 'EEE, d MMM yyyy, h:mm a' }} }</p>
                @if (pod.photoUrl || pod.signatureUrl) {
                  <div class="pod__imgs">
                    @if (pod.photoUrl) { <a [href]="pod.photoUrl" target="_blank" rel="noopener"><img [src]="pod.photoUrl" alt="Delivery photo" /><span>Photo</span></a> }
                    @if (pod.signatureUrl) { <a [href]="pod.signatureUrl" target="_blank" rel="noopener"><img [src]="pod.signatureUrl" alt="Receiver's signature" /><span>Signature</span></a> }
                  </div>
                } @else if (pod.photoPending) {
                  <p class="text-caption">The delivery photo is being checked. It appears here once approved.</p>
                }
              </article>
            }
            @if (b.deliveryIssue; as d) {
              <article class="app-card box issuebox" [class.issuebox--done]="!d.open">
                <h2 class="text-h2">{{ d.open ? 'Delivery attempt failed' : 'Earlier delivery attempt' }}</h2>
                <p class="issue__why"><strong>{{ d.reason || 'Not delivered' }}</strong>@if (d.note) { · {{ d.note }} }
                  @if (d.at) { <span class="text-caption"> · {{ d.at | date: 'd MMM, h:mm a' }}</span> } · attempt {{ d.attempts }}</p>
                @if (d.open && d.choice) {
                  <p class="alert alert--ok">You asked: <strong>{{ d.choiceLabel }}</strong>@if (d.choiceDate) { on {{ d.choiceDate | date: 'EEE, d MMM' }} }.
                    The branch will act on it. You can change your answer until then.</p>
                }
                @if (d.open) {
                  @if (!choosing()) {
                    <div class="cancelbox__actions">
                      <button class="btn btn--primary" type="button" (click)="startChoice('REATTEMPT', d)"><ecb-icon name="replay" /> Deliver again</button>
                      <button class="btn btn--ghost" type="button" (click)="startChoice('CHANGE_ADDRESS', d)"><ecb-icon name="edit_location" /> New address</button>
                      <button class="btn btn--ghost" type="button" (click)="startChoice('RETURN', d)"><ecb-icon name="undo" /> Return to me</button>
                    </div>
                  } @else {
                    @switch (choosing()) {
                      @case ('REATTEMPT') {
                        <label class="field"><span>Deliver again on</span>
                          <input type="date" [min]="minDate()" [max]="isoDays(7)" [value]="choiceDate()" (input)="choiceDate.set($any($event.target).value)" /></label>
                      }
                      @case ('CHANGE_ADDRESS') {
                        <label class="field field--wide"><span>New delivery address (same pincode)</span>
                          <textarea rows="2" maxlength="500" [value]="choiceAddress()" (input)="choiceAddress.set($any($event.target).value)"></textarea></label>
                        <label class="field"><span>Receiver's mobile (optional)</span>
                          <input type="tel" maxlength="14" [value]="choicePhone()" (input)="choicePhone.set($any($event.target).value)" /></label>
                      }
                      @case ('RETURN') { <p class="alert alert--warn">The shipment will be sent back to the pickup address. Return charges may apply.</p> }
                    }
                    <div class="cancelbox__actions">
                      <button class="btn btn--primary" type="button" (click)="sendChoice()" [disabled]="sendingChoice() || !choiceReady()">{{ sendingChoice() ? 'Sending…' : 'Confirm' }}</button>
                      <button class="btn btn--ghost" type="button" (click)="choosing.set(null)" [disabled]="sendingChoice()">Back</button>
                    </div>
                  }
                }
                @if (choiceMessage()) { <p class="alert alert--ok" role="status">{{ choiceMessage() }}</p> }
                @if (choiceError()) { <p class="alert alert--error" role="alert">{{ choiceError() }}</p> }
              </article>
            }
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
    .cod-state { color:var(--content-muted); }
    .pod__who { margin:0; font:500 14px var(--font-sans); }
    .pod__imgs { display:flex; gap:12px; flex-wrap:wrap; }
    .pod__imgs a { display:flex; flex-direction:column; gap:4px; align-items:center; text-decoration:none; color:var(--content-muted); font:500 12px var(--font-sans); }
    .pod__imgs img { width:140px; height:140px; object-fit:cover; border-radius:10px; border:1px solid var(--surface-border); background:#fff; }
    .issuebox { border:1px solid var(--danger, #b3123a); }
    .issuebox--done { border-color:var(--surface-border); }
    .issue__why { margin:0; font:500 14px var(--font-sans); }
    .field--wide { max-width:none; }
    .field textarea { padding:10px 12px; border:1px solid var(--surface-border); border-radius:var(--r-field); background:var(--surface); color:inherit; font:400 14px var(--font-sans); resize:vertical; }
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
  private readonly runtime = inject(RuntimeConfigService).config;

  /** Opens an A4 proof-of-delivery sheet and the print dialog (choose "Save as PDF" to keep a file). */
  printPod(b: Detail, pod: ProofOfDelivery): void {
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const when = pod.deliveredAt ? new Date(pod.deliveredAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    const party = (p: BookingParty | null | undefined) => p ? `${esc(p.name)}<br>${esc(p.phone)}<br>${esc(p.address)}<br>${esc([p.city, p.pincode].filter(Boolean).join(' '))}` : '—';
    const img = (url: string | null, label: string) => url ? `<figure><img src="${esc(url)}" alt="${label}"><figcaption>${label}</figcaption></figure>` : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>POD ${esc(b.trackingNumber || pod.shipmentNumber)}</title>
<style>body{font:14px/1.5 Arial,sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0 0 4px}.muted{color:#555}
table{width:100%;border-collapse:collapse;margin:16px 0}td{border:1px solid #bbb;padding:8px 10px;vertical-align:top;width:50%}
th{text-align:left;font-size:12px;text-transform:uppercase;color:#555;padding:4px 0}.imgs{display:flex;gap:16px}
figure{margin:0}img{width:260px;height:260px;object-fit:contain;border:1px solid #bbb}figcaption{font-size:12px;color:#555}
@page{size:A4;margin:14mm}</style></head><body>
<h1>Proof of delivery</h1><div class="muted">${esc(this.runtime().companyName)}</div>
<table><tr><td><b>AWB / Tracking no.</b><br>${esc(b.trackingNumber || pod.trackingNumber || '—')}</td><td><b>Shipment no.</b><br>${esc(pod.shipmentNumber || '—')}</td></tr>
<tr><td><b>Delivered to</b><br>${esc(pod.deliveredTo || '—')}</td><td><b>Delivered on</b><br>${esc(when)}</td></tr>
<tr><td><b>From</b><br>${party(b.pickup)}</td><td><b>To</b><br>${party(b.delivery)}</td></tr></table>
<div class="imgs">${img(pod.photoUrl, 'Delivery photo')}${img(pod.signatureUrl, "Receiver's signature")}</div>
${!pod.photoUrl && !pod.signatureUrl ? '<p class="muted">No photo or signature on record.</p>' : ''}
<p class="muted">Generated ${esc(new Date().toLocaleString('en-IN'))}</p>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { this.error.set('Allow pop-ups for this site to download the POD.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  readonly choosing = signal<'REATTEMPT' | 'CHANGE_ADDRESS' | 'RETURN' | null>(null);
  readonly choiceDate = signal('');
  readonly choiceAddress = signal('');
  readonly choicePhone = signal('');
  readonly sendingChoice = signal(false);
  readonly choiceMessage = signal('');
  readonly choiceError = signal('');
  protected isoDays(days: number): string { return isoDate(days); }

  startChoice(kind: 'REATTEMPT' | 'CHANGE_ADDRESS' | 'RETURN', d: { choiceDate: string | null; receiverAddress: string | null; receiverPhone: string | null }): void {
    this.choiceMessage.set('');
    this.choiceError.set('');
    this.choiceDate.set(d.choiceDate ?? isoDate(1));
    this.choiceAddress.set(kind === 'CHANGE_ADDRESS' ? (d.receiverAddress ?? '') : '');
    this.choicePhone.set(kind === 'CHANGE_ADDRESS' ? (d.receiverPhone ?? '') : '');
    this.choosing.set(kind);
  }

  choiceReady(): boolean {
    switch (this.choosing()) {
      case 'REATTEMPT': return !!this.choiceDate();
      case 'CHANGE_ADDRESS': return this.choiceAddress().trim().length >= 10;
      case 'RETURN': return true;
      default: return false;
    }
  }

  sendChoice(): void {
    const kind = this.choosing();
    if (!kind) return;
    this.sendingChoice.set(true);
    this.choiceError.set('');
    const body = kind === 'REATTEMPT' ? { choice: kind, date: this.choiceDate() }
      : kind === 'CHANGE_ADDRESS' ? { choice: kind, address: this.choiceAddress().trim(), phone: this.choicePhone().trim() || null }
      : { choice: kind };
    this.portal.chooseDelivery(this.bookingId(), body).subscribe({
      next: () => {
        this.sendingChoice.set(false);
        this.choosing.set(null);
        this.choiceMessage.set('Thank you. We have passed this to the branch.');
        this.portal.booking(this.bookingId()).subscribe((b) => this.booking.set(b));
      },
      error: async (e: HttpErrorResponse) => {
        this.sendingChoice.set(false);
        this.choiceError.set(await errorMessage(e, 'Your answer could not be sent. Please try again.'));
      }
    });
  }

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

  /** A delivered booking (not itself a return) can be picked up back from the buyer, on OCCPL Network. */
  returnable(b: Detail): boolean {
    return b.status === 'BOOKED' && b.deliveryStatus?.stage === 'DELIVERED' && !b.returnOfBookingId;
  }

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
