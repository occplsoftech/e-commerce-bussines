import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortalService } from '@core/services/portal.service';
import { BookingDetail } from '@core/models/portal.model';
import { BookingDraftService } from './booking-draft.service';
import { BookingSteps } from './booking-steps';

/** Step 5: what happened — booked, failed (nothing booked) or awaiting confirmation with the courier. */
import { CourierLogo } from '@shared/components/courier-logo';

@Component({
  selector: 'ecb-booking-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CourierLogo, Icon, RouterLink, CurrencyPipe, BookingSteps],
  template: `
    <section class="page">
      <div class="page__head"><div><h1 class="text-display">Booking result</h1></div></div>
      <ecb-booking-steps [current]="3" />
      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
      @if (booking(); as b) {
        <article class="app-card hero" [class.hero--bad]="b.status === 'FAILED'" [class.hero--wait]="b.status !== 'BOOKED' && b.status !== 'FAILED'" [attr.aria-live]="'polite'">
          <div class="hero__top">
            @if (b.status === 'BOOKED') {
              <span class="burst" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
              <svg class="check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M14 27l8 8 16-17" /></svg>
              <h2>Booked with {{ b.providerName }}</h2>
              <p>Your pickup is lined up. We will take it from here.</p>
            } @else if (b.status === 'FAILED') {
              <span class="mark"><ecb-icon name="error" /></span>
              <h2>Not booked</h2>
              <p>Nothing was booked and nothing is payable. You can choose another courier.</p>
            } @else {
              <span class="mark"><ecb-icon name="hourglass_top" /></span>
              <h2>Awaiting confirmation</h2>
              <p>{{ b.providerName }} may have accepted this booking. Our team is confirming it — please do not book it again.</p>
            }
          </div>

          <div class="hero__body">
            @if (b.message) { <p class="msg">{{ b.message }}</p> }
            <div class="refs">
              <div class="ref ref--wide">
                <span class="k">Courier</span>
                <span class="v v--row"><ecb-courier-logo [code]="b.providerCode" [name]="b.providerName" style="--logo-size:2rem" /> {{ b.providerName }}</span>
              </div>
              @if (b.bookingReference) {
                <div class="ref"><span class="k">Courier reference</span>
                  <span class="v mono">{{ b.bookingReference }} <button type="button" class="copy" (click)="copy(b.bookingReference)" aria-label="Copy reference"><ecb-icon name="content_copy" /></button></span></div>
              }
              <div class="ref"><span class="k">Tracking number</span><span class="v mono">{{ b.trackingNumber || 'Issued when collected' }}</span></div>
              <div class="ref"><span class="k">Amount</span><span class="v amt">{{ b.totalAmount | currency: b.currency : 'symbol' : '1.2-2' }}</span></div>
              <div class="ref"><span class="k">Booking ID</span>
                <span class="v mono small">{{ b.bookingId }} <button type="button" class="copy" (click)="copy(b.bookingId)" aria-label="Copy booking ID"><ecb-icon name="content_copy" /></button></span></div>
            </div>
            @if (copied()) { <p class="copied" role="status">Copied</p> }

            @if (b.status === 'BOOKED') {
              <h3 class="next-h">What happens next</h3>
              <ol class="next">
                <li class="done"><span class="n"><ecb-icon name="check_circle" /></span><strong>Booked</strong><small>Done</small></li>
                <li><span class="n"><ecb-icon name="event_available" /></span><strong>Pickup</strong><small>From your address</small></li>
                <li><span class="n"><ecb-icon name="local_shipping" /></span><strong>In transit</strong><small>On its way</small></li>
                <li><span class="n"><ecb-icon name="home" /></span><strong>Delivered</strong><small>To the receiver</small></li>
              </ol>
            }

            <div class="actions">
              @if (b.status === 'FAILED') { <a class="btn btn--ghost" routerLink="/dashboard">Go to dashboard</a> }
              @else { <a class="btn btn--ghost" [routerLink]="['/shipments', b.bookingId]">View shipment{{ b.labelDownloadable ? ' and label' : '' }}</a> }
              @if (b.status === 'FAILED') { <a class="btn btn--primary btn--cta" [routerLink]="['/book/rates', b.quoteId]">Choose another courier</a> }
              @else { <a class="btn btn--primary btn--cta" routerLink="/book" (click)="startNew()">Book another shipment <ecb-icon name="arrow_forward" /></a> }
            </div>
          </div>
        </article>
      } @else if (!error()) {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  styles: [`
    .hero { --tone:var(--success); padding:0; overflow:hidden; max-width:820px; margin-inline:auto; width:100%; }
    .hero--bad { --tone:var(--danger); } .hero--wait { --tone:var(--warning); }
    .hero__top { position:relative; text-align:center; padding:34px 24px 28px; color:#fff; background:linear-gradient(135deg, color-mix(in srgb, var(--tone) 90%, #fff), color-mix(in srgb, var(--tone) 70%, #000)); overflow:hidden; }
    .hero__top h2 { margin:14px 0 4px; font:800 1.7rem var(--font-display); }
    .hero__top p { margin:0; font:500 .95rem var(--font-sans); opacity:.92; }
    .check { width:5rem; height:5rem; }
    .check circle { fill:rgb(255 255 255 / 18%); stroke:#fff; stroke-width:2.5; stroke-dasharray:152; stroke-dashoffset:152; animation:draw .7s ease-out forwards; }
    .check path { fill:none; stroke:#fff; stroke-width:4; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:44; stroke-dashoffset:44; animation:draw .45s .55s ease-out forwards; }
    @keyframes draw { to { stroke-dashoffset:0; } }
    .mark { display:inline-grid; place-items:center; width:5rem; height:5rem; border-radius:50%; background:rgb(255 255 255 / 20%); font-size:2.4rem; }
    .burst i { position:absolute; left:50%; top:62px; width:9px; height:9px; border-radius:50%; opacity:0; animation:pop 1.1s .6s ease-out forwards; }
    .burst i:nth-child(odd) { background:#fff; } .burst i:nth-child(even) { background:#ffd166; }
    .burst i:nth-child(1) { --x:-120px; --y:-30px; } .burst i:nth-child(2) { --x:-80px; --y:-60px; } .burst i:nth-child(3) { --x:-40px; --y:-80px; }
    .burst i:nth-child(4) { --x:40px; --y:-80px; } .burst i:nth-child(5) { --x:80px; --y:-60px; } .burst i:nth-child(6) { --x:120px; --y:-30px; }
    .burst i:nth-child(7) { --x:-150px; --y:10px; } .burst i:nth-child(8) { --x:150px; --y:10px; }
    @keyframes pop { 0% { opacity:1; transform:translate(0,0) scale(.4); } 100% { opacity:0; transform:translate(var(--x), var(--y)) scale(1.1); } }
    .hero__body { padding:24px; display:flex; flex-direction:column; gap:16px; }
    .msg { margin:0; font:500 .95rem/1.5 var(--font-sans); }
    .refs { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px; }
    .ref { padding:12px 14px; border-radius:var(--r-card); background:var(--occpl-color-neutral-surface); display:flex; flex-direction:column; gap:4px; min-width:0; }
    .ref--wide { grid-column:1 / -1; }
    .k { font:700 .7rem var(--font-sans); letter-spacing:.1em; text-transform:uppercase; color:var(--content-muted); }
    .v { font:600 1rem var(--font-sans); overflow-wrap:anywhere; }
    .v--row { display:flex; align-items:center; gap:10px; }
    .v.amt { font:800 1.4rem var(--font-display); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; } .small { font-size:.85rem; }
    .copy { border:0; background:transparent; cursor:pointer; color:var(--occpl-color-primary); padding:2px 6px; border-radius:8px; vertical-align:middle; }
    .copy:hover { background:var(--occpl-color-info-surface); }
    .copied { margin:-8px 0 0; font:600 .8rem var(--font-sans); color:var(--success); }
    .next-h { margin:4px 0 0; font:700 1rem var(--font-display); }
    .next { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; }
    .next li { position:relative; display:flex; flex-direction:column; align-items:center; text-align:center; gap:2px; font:500 .8rem var(--font-sans); color:var(--content-muted); }
    .next li:not(:last-child)::after { content:''; position:absolute; top:1.3rem; left:calc(50% + 1.6rem); right:calc(-50% + 1.6rem); border-top:3px dotted var(--surface-border); }
    .next .n { display:grid; place-items:center; width:2.6rem; height:2.6rem; border-radius:50%; background:var(--occpl-color-neutral-surface); border:2px solid var(--surface-border); font-size:1.15rem; margin-bottom:4px; }
    .next strong { font:700 .85rem var(--font-sans); color:var(--content-fg); }
    .next .done .n { background:var(--success); border-color:var(--success); color:#fff; }
    .actions { display:flex; gap:12px; flex-wrap:wrap; justify-content:flex-end; margin-top:4px; }
    .btn--cta { padding-inline:2rem; box-shadow:0 10px 24px rgb(214 31 69 / 30%); }
    @media (prefers-reduced-motion: reduce) { .check circle, .check path { animation:none; stroke-dashoffset:0; } .burst { display:none; } }
    @media (max-width: 560px) { .refs { grid-template-columns:1fr; } .next .n { width:2.2rem; height:2.2rem; } .actions .btn { flex:1; } }
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

  readonly copied = signal(false);
  copy(text: string | null | undefined): void {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => { this.copied.set(true); setTimeout(() => this.copied.set(false), 1500); }, () => undefined);
  }
}
