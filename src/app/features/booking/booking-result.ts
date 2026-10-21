import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortalService } from '@core/services/portal.service';
import { BookingDetail } from '@core/models/portal.model';
import { BookingDraftService } from './booking-draft.service';
import { BookingSteps } from './booking-steps';

/** Step 5: what happened — booked, failed (nothing booked) or awaiting confirmation with the courier. */
@Component({
  selector: 'ecb-booking-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, BookingSteps],
  template: `
    <section class="page">
      <div class="page__head"><div><h1 class="text-display">Booking result</h1></div></div>
      <ecb-booking-steps [current]="4" />
      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
      @if (booking(); as b) {
        <article class="app-card box" [attr.aria-live]="'polite'">
          @switch (b.status) {
            @case ('BOOKED') {
              <span class="material-icons ok">task_alt</span>
              <h2 class="text-h1">Booked with {{ b.providerName }}</h2>
            }
            @case ('FAILED') {
              <span class="material-icons bad">error</span>
              <h2 class="text-h1">Not booked</h2>
              <p class="text-caption">Nothing was booked and nothing is payable. You can choose another courier.</p>
            }
            @default {
              <span class="material-icons warn">hourglass_top</span>
              <h2 class="text-h1">Awaiting confirmation</h2>
              <p class="text-caption">{{ b.providerName }} may have accepted this booking. Our team is confirming it — please do not book it again.</p>
            }
          }
          @if (b.message) { <p>{{ b.message }}</p> }
          <dl>
            <dt>Booking ID</dt><dd class="mono">{{ b.bookingId }}</dd>
            @if (b.bookingReference) { <dt>Courier reference</dt><dd class="mono">{{ b.bookingReference }}</dd> }
            <dt>Tracking number</dt><dd class="mono">{{ b.trackingNumber || 'Issued when the parcel is collected' }}</dd>
            <dt>Amount</dt><dd>{{ b.totalAmount | currency: b.currency : 'symbol' : '1.2-2' }}</dd>
          </dl>
          <div class="actions">
            @if (b.status === 'FAILED') { <a class="btn btn--ghost" routerLink="/dashboard">Go to dashboard</a> }
            @else { <a class="btn btn--ghost" [routerLink]="['/shipments', b.bookingId]">View shipment{{ b.labelDownloadable ? ' and label' : '' }}</a> }
            @if (b.status === 'FAILED') { <a class="btn btn--primary" [routerLink]="['/book/rates', b.quoteId]">Choose another courier</a> }
            @else { <a class="btn btn--primary" routerLink="/book" (click)="startNew()">Book another shipment</a> }
          </div>
        </article>
      } @else if (!error()) {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  styles: [`
    .box { padding:28px; display:flex; flex-direction:column; gap:12px; align-items:flex-start; max-width:720px; }
    .box .material-icons { font-size:44px; }
    .ok { color:var(--success); } .bad { color:var(--danger); } .warn { color:var(--warning); }
    h2 { margin:0; }
    dl { margin:8px 0 0; display:grid; grid-template-columns:max-content 1fr; gap:8px 16px; font:400 14px var(--font-sans); }
    dt { font:600 12px var(--font-sans); color:var(--content-muted); text-transform:uppercase; letter-spacing:.04em; }
    dd { margin:0; overflow-wrap:anywhere; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .actions { display:flex; gap:12px; flex-wrap:wrap; margin-top:8px; }
  `]
})
export class BookingResult implements OnInit {
  readonly bookingId = input.required<string>();
  private readonly portal = inject(PortalService);
  private readonly drafts = inject(BookingDraftService);
  readonly booking = signal<BookingDetail | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.portal.booking(this.bookingId()).subscribe({
      next: (b) => { this.booking.set(b); if (b.status === 'BOOKED') this.drafts.clear(); },
      error: () => this.error.set('This booking was not found.')
    });
  }

  startNew(): void { this.drafts.clear(); }
}
