import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortalService } from '@core/services/portal.service';
import { BookingDetail } from '@core/models/portal.model';
import { BookingDraftService } from './booking-draft.service';
import { BookingSteps } from './booking-steps';
import { ShippingLabel } from './shipping-label';

/** Step 5: what happened — booked, failed (nothing booked) or awaiting confirmation with the courier. */
import { CourierLogo } from '@shared/components/courier-logo';

@Component({
  selector: 'ecb-booking-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CourierLogo, Icon, RouterLink, CurrencyPipe, BookingSteps, ShippingLabel],
  template: `
    <section class="page">
      <ecb-booking-steps [current]="3" />
      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
      @if (booking(); as b) {
        <div class="result" [class.result--bad]="b.status === 'FAILED'" [class.result--wait]="b.status !== 'BOOKED' && b.status !== 'FAILED'" aria-live="polite">

          <header class="hero">
            @if (b.status === 'BOOKED') { <span class="burst" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span> }
            @if (b.status === 'BOOKED') {
              <svg class="check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M14 27l8 8 16-17" /></svg>
              <h1>You're booked!</h1>
              <p>{{ b.providerName }} has your shipment. {{ etaText(b) }}</p>
            } @else if (b.status === 'FAILED') {
              <span class="mark"><ecb-icon name="error" /></span>
              <h1>Not booked</h1>
              <p>Nothing was booked and nothing is payable. You can choose another courier.</p>
            } @else {
              <span class="mark"><ecb-icon name="hourglass_top" /></span>
              <h1>Awaiting confirmation</h1>
              <p>{{ b.providerName }} may have accepted this booking. Our team is confirming it. Please do not book it again.</p>
            }
            @if (b.status !== 'FAILED') {
              <button type="button" class="refpill" (click)="copy(b.bookingReference || b.bookingId)" aria-label="Copy booking reference">
                <span class="refpill__k">Reference</span>
                <span class="refpill__v">{{ b.bookingReference || shortId(b.bookingId) }}</span>
                <ecb-icon [name]="copied() ? 'check_circle' : 'content_copy'" />
              </button>
            }
          </header>

          @if (b.status !== 'FAILED') {
            <article class="waybill">
              <div class="wb__main">
                <div class="wb__route">
                  <div class="wb__city">
                    <span class="wb__k"><ecb-icon name="location_on" /> From</span>
                    <strong>{{ b.pickup.city || b.pickup.pincode }}</strong>
                    <span class="wb__sub">{{ b.pickup.name }} · {{ b.pickup.pincode }}</span>
                  </div>
                  <div class="wb__way" aria-hidden="true">
                    <span class="wb__line"></span>
                    <span class="wb__ship"><ecb-icon [name]="modeIcon(b)" /></span>
                  </div>
                  <div class="wb__city wb__city--to">
                    <span class="wb__k">To <ecb-icon name="home" /></span>
                    <strong>{{ b.delivery.city || b.delivery.pincode }}</strong>
                    <span class="wb__sub">{{ b.delivery.name }} · {{ b.delivery.pincode }}</span>
                  </div>
                </div>

                <dl class="wb__facts">
                  <div><dt><ecb-icon name="scale" /> Weight</dt><dd>{{ b.parcel?.chargeableWeightKg ?? b.parcel?.actualWeightKg ?? '—' }} kg</dd></div>
                  <div><dt><ecb-icon name="inventory_2" /> Packages</dt><dd>{{ b.parcel?.packageCount ?? '—' }}</dd></div>
                  <div><dt><ecb-icon name="description" /> Contents</dt><dd>{{ b.parcel?.contents || '—' }}</dd></div>
                  <div><dt><ecb-icon [name]="b.parcel?.paymentMode === 'COD' ? 'payments' : 'account_balance_wallet'" /> Payment</dt><dd>{{ b.parcel?.paymentMode === 'COD' ? 'Cash on delivery' : 'Prepaid' }}</dd></div>
                </dl>
              </div>

              <aside class="wb__stub">
                <ecb-courier-logo [code]="b.providerCode" [name]="b.providerName" style="--logo-size:2.8rem" />
                <div class="wb__svc">{{ b.serviceName || b.providerName }}</div>
                <svg class="barcode" [attr.viewBox]="'0 0 ' + bars().width + ' 40'" preserveAspectRatio="none" aria-hidden="true">
                  @for (r of bars().rects; track $index) { <rect [attr.x]="r.x" y="0" [attr.width]="r.w" height="40" /> }
                </svg>
                <div class="wb__trk">{{ b.trackingNumber || 'Tracking no. issued at pickup' }}</div>
                <div class="wb__amt num-tabular">{{ b.totalAmount | currency: b.currency : 'symbol' : '1.2-2' }}</div>
              </aside>
            </article>

            @if (b.status === 'BOOKED') {
              <ol class="track" aria-label="What happens next">
                <li class="done"><span class="n"><ecb-icon name="check_circle" /></span><strong>Booked</strong><small>Done</small></li>
                <li class="now"><span class="n"><ecb-icon name="event_available" /></span><strong>Pickup</strong><small>Next: from your address</small></li>
                <li><span class="n"><ecb-icon name="local_shipping" /></span><strong>In transit</strong><small>On its way</small></li>
                <li><span class="n"><ecb-icon name="home" /></span><strong>Delivered</strong><small>To {{ b.delivery.name || 'the receiver' }}</small></li>
              </ol>
            }
            @if (b.message) { <p class="msg"><ecb-icon name="schedule" /> {{ b.message }}</p> }
          }

          <div class="actions">
            @if (b.status === 'FAILED') {
              <a class="btn btn--ghost" routerLink="/dashboard">Go to dashboard</a>
              <a class="btn btn--primary btn--cta" [routerLink]="['/book/rates', b.quoteId]">Choose another courier</a>
            } @else {
              <button class="btn btn--ghost" type="button" (click)="printLabel()"><ecb-icon name="print" /> Print label</button>
              <a class="btn btn--ghost" [routerLink]="['/shipments', b.bookingId]"><ecb-icon name="visibility" /> {{ b.labelDownloadable ? 'View shipment and label' : 'View shipment' }}</a>
              <a class="btn btn--primary btn--cta" routerLink="/book" (click)="startNew()">Book another shipment <ecb-icon name="arrow_forward" /></a>
            }
          </div>

          @if (showLabel() && b.status !== 'FAILED') {
            <section class="labelbox">
              <div class="labelbox__bar">
                <div><strong>{{ labelCount(b) > 1 ? labelCount(b) + ' shipping labels' : 'Shipping label' }}</strong>
                  <span class="text-caption"> Prints on A4, four to a sheet. {{ labelCount(b) > 1 ? 'One for each package: cut along the dashed lines and stick each on its own box.' : 'Cut along the dashed lines and stick it on the parcel.' }}</span></div>
                <button class="btn btn--primary" type="button" (click)="printLabel()"><ecb-icon name="print" /> Print{{ labelCount(b) > 1 ? ' all ' + labelCount(b) : '' }}</button>
              </div>
              @for (n of labelNumbers(b); track n) { <ecb-shipping-label [booking]="b" [index]="n" [total]="labelCount(b)" /> }
            </section>
          }
        </div>
      } @else if (!error()) {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  styles: [`
    .result { --tone:var(--success); display:flex; flex-direction:column; gap:22px; max-width:900px; width:100%; margin-inline:auto; }
    .result--bad { --tone:var(--danger); } .result--wait { --tone:var(--warning); }

    .hero { position:relative; overflow:hidden; text-align:center; color:#fff; padding:38px 24px 34px; border-radius:var(--r-card);
      background:radial-gradient(520px 260px at 50% -10%, rgb(255 255 255 / 22%), transparent 70%), linear-gradient(150deg, color-mix(in srgb, var(--tone) 88%, #fff), color-mix(in srgb, var(--tone) 62%, #000)); box-shadow:var(--shadow-md); }
    .hero h1 { margin:14px 0 6px; font:800 clamp(1.8rem, 4vw, 2.5rem)/1.1 var(--font-display); }
    .hero p { margin:0 auto; max-width:34rem; font:500 1rem/1.5 var(--font-sans); opacity:.94; }
    .check { width:5.2rem; height:5.2rem; }
    .check circle { fill:rgb(255 255 255 / 18%); stroke:#fff; stroke-width:2.5; stroke-dasharray:152; stroke-dashoffset:152; animation:draw .7s ease-out forwards; }
    .check path { fill:none; stroke:#fff; stroke-width:4; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:44; stroke-dashoffset:44; animation:draw .45s .55s ease-out forwards; }
    @keyframes draw { to { stroke-dashoffset:0; } }
    .mark { display:inline-grid; place-items:center; width:5rem; height:5rem; border-radius:50%; background:rgb(255 255 255 / 20%); font-size:2.4rem; }
    .burst i { position:absolute; left:50%; top:70px; width:10px; height:10px; border-radius:3px; opacity:0; animation:pop 1.3s .6s ease-out forwards; }
    .burst i:nth-child(3n) { background:#fff; } .burst i:nth-child(3n+1) { background:#ffd166; } .burst i:nth-child(3n+2) { background:#9be7c4; border-radius:50%; }
    .burst i:nth-child(1) { --x:-210px; --y:-20px; } .burst i:nth-child(2) { --x:-150px; --y:-58px; } .burst i:nth-child(3) { --x:-90px; --y:-78px; } .burst i:nth-child(4) { --x:-40px; --y:-90px; }
    .burst i:nth-child(5) { --x:40px; --y:-90px; } .burst i:nth-child(6) { --x:90px; --y:-78px; } .burst i:nth-child(7) { --x:150px; --y:-58px; } .burst i:nth-child(8) { --x:210px; --y:-20px; }
    .burst i:nth-child(9) { --x:-250px; --y:30px; } .burst i:nth-child(10) { --x:250px; --y:30px; }
    @keyframes pop { 0% { opacity:1; transform:translate(0,0) rotate(0) scale(.4); } 100% { opacity:0; transform:translate(var(--x), var(--y)) rotate(200deg) scale(1.1); } }
    .refpill { margin-top:22px; display:inline-flex; align-items:center; gap:12px; padding:10px 20px; border-radius:999px; border:0; cursor:pointer;
      background:var(--surface); color:var(--content-fg); box-shadow:var(--shadow-md); font:inherit; white-space:nowrap; }
    .refpill:hover { box-shadow:var(--shadow-hover); }
    .refpill__k { font:700 .68rem var(--font-sans); letter-spacing:.12em; text-transform:uppercase; color:var(--content-muted); }
    .refpill__v { font:800 1.15rem ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing:.04em; }
    .refpill ecb-icon { color:var(--occpl-color-primary); }

    /* the waybill: a ticket with a tear-off stub */
    .waybill { display:grid; grid-template-columns:minmax(0,1fr) 240px; margin-top:14px; background:var(--surface); border-radius:var(--r-card); box-shadow:var(--shadow-md); border:1px solid var(--surface-border); position:relative; }
    .wb__main { padding:26px 28px; display:flex; flex-direction:column; gap:24px; min-width:0; }
    .wb__route { display:grid; grid-template-columns:minmax(0,1fr) minmax(60px,1fr) minmax(0,1fr); gap:14px; align-items:center; }
    .wb__city { display:flex; flex-direction:column; gap:3px; min-width:0; }
    .wb__city--to { text-align:right; align-items:flex-end; }
    .wb__city strong { font:800 clamp(1.4rem, 3vw, 2rem)/1.1 var(--font-display); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
    .wb__k { display:inline-flex; align-items:center; gap:6px; font:700 .7rem var(--font-sans); letter-spacing:.12em; text-transform:uppercase; color:var(--tone); }
    .wb__sub { font:400 .8rem var(--font-sans); color:var(--content-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
    .wb__way { position:relative; height:2.4rem; }
    .wb__line { position:absolute; left:0; right:0; top:50%; border-top:3px dashed var(--surface-border); transform:translateY(-50%); }
    .wb__ship { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); display:grid; place-items:center; width:2.6rem; height:2.6rem; border-radius:50%; background:var(--occpl-gradient-button); color:#fff; box-shadow:0 6px 16px rgb(214 31 69 / 30%); }
    .wb__facts { margin:0; display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; padding-top:20px; border-top:1px solid var(--surface-border); }
    .wb__facts dt { display:flex; align-items:center; gap:6px; font:700 .68rem var(--font-sans); letter-spacing:.1em; text-transform:uppercase; color:var(--content-muted); }
    .wb__facts dd { margin:4px 0 0; font:700 .95rem var(--font-sans); overflow-wrap:anywhere; }
    .wb__stub { position:relative; padding:24px 22px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; border-left:2px dashed var(--surface-border); background:var(--occpl-color-neutral-surface); border-radius:0 var(--r-card) var(--r-card) 0; }
    .wb__stub::before, .wb__stub::after { content:''; position:absolute; left:-13px; width:24px; height:24px; border-radius:50%; background:var(--background, #eef0f6); box-shadow:inset 0 0 0 1px var(--surface-border); }
    .wb__stub::before { top:-12px; } .wb__stub::after { bottom:-12px; }
    .wb__svc { font:700 .85rem var(--font-sans); }
    .barcode { width:100%; height:44px; margin-top:4px; fill:var(--content-fg); }
    .wb__trk { font:600 .68rem ui-monospace, SFMono-Regular, Menlo, monospace; color:var(--content-muted); overflow-wrap:anywhere; }
    .wb__amt { margin-top:auto; font:800 1.7rem var(--font-display); background:var(--occpl-gradient-button); -webkit-background-clip:text; background-clip:text; color:transparent; }

    .track { list-style:none; margin:0; padding:20px 24px; display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; background:var(--surface); border:1px solid var(--surface-border); border-radius:var(--r-card); }
    .track li { position:relative; display:flex; flex-direction:column; align-items:center; text-align:center; gap:2px; font:500 .78rem var(--font-sans); color:var(--content-muted); }
    .track li:not(:last-child)::after { content:''; position:absolute; top:1.3rem; left:calc(50% + 1.6rem); right:calc(-50% + 1.6rem); border-top:3px dotted var(--surface-border); }
    .track .n { display:grid; place-items:center; width:2.6rem; height:2.6rem; border-radius:50%; background:var(--occpl-color-neutral-surface); border:2px solid var(--surface-border); font-size:1.15rem; margin-bottom:4px; }
    .track strong { font:700 .88rem var(--font-sans); color:var(--content-fg); }
    .track .done .n { background:var(--success); border-color:var(--success); color:#fff; }
    .track .done:not(:last-child)::after { border-top-style:solid; border-top-color:var(--success); }
    .track .now .n { border-color:var(--occpl-color-primary); color:var(--occpl-color-primary); animation:pulse 1.8s ease-out infinite; }
    @keyframes pulse { 0% { box-shadow:0 0 0 0 rgb(214 31 69 / 45%); } 100% { box-shadow:0 0 0 14px rgb(214 31 69 / 0%); } }
    .msg { margin:0; display:flex; gap:8px; align-items:center; font:500 .9rem var(--font-sans); color:var(--content-muted); }
    .actions { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }
    .btn--cta { padding-inline:2rem; box-shadow:0 10px 24px rgb(214 31 69 / 30%); }

    .labelbox { display:flex; flex-direction:column; align-items:center; gap:14px; padding:18px; border:1px dashed var(--surface-border); border-radius:var(--r-card); background:var(--occpl-color-neutral-surface); }
    .labelbox__bar { width:100%; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
    .labelbox ecb-shipping-label { box-shadow:var(--shadow-md); max-width:100%; overflow-x:auto; }
    .labelbox { max-height:none; }
    @media (prefers-reduced-motion: reduce) { .check circle, .check path { animation:none; stroke-dashoffset:0; } .burst { display:none; } .track .now .n { animation:none; } }
    @media (max-width: 760px) {
      .waybill { grid-template-columns:1fr; }
      .wb__stub { border-left:0; border-top:2px dashed var(--surface-border); border-radius:0 0 var(--r-card) var(--r-card); }
      .wb__stub::before, .wb__stub::after { top:-12px; bottom:auto; }
      .wb__stub::before { left:-12px; } .wb__stub::after { left:auto; right:-12px; }
      .wb__facts { grid-template-columns:repeat(2, minmax(0,1fr)); }
      .track { grid-template-columns:repeat(2, minmax(0,1fr)); row-gap:18px; } .track li::after { display:none; }
      .actions .btn { flex:1; }
    }
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
  readonly showLabel = signal(false);

  /** Shows the label, then prints just that (the page's own print rule hides everything else while body has `printing-label`). */
  printLabel(): void {
    this.showLabel.set(true);
    setTimeout(() => {
      // copies of the labels go into their own container on the body, so the print rule can hide the whole app and give each label a page
      const root = document.createElement('div');
      root.id = 'ecb-print-root';
      let sheet: HTMLElement | null = null;
      document.querySelectorAll('.labelbox .ecb-label').forEach((l, i) => {
        if (i % 4 === 0) { sheet = document.createElement('div'); sheet.className = 'ecb-sheet'; root.appendChild(sheet); }
        sheet!.appendChild(l.cloneNode(true));
      });
      document.body.appendChild(root);
      document.body.classList.add('printing-label');
      const done = () => { document.body.classList.remove('printing-label'); root.remove(); };
      window.addEventListener('afterprint', done, { once: true });
      window.print();
    }, 150);
  }

  /** One label per package (at least one). */
  protected labelCount(b: BookingDetail): number { return Math.max(1, Math.min(999, Number(b.parcel?.packageCount ?? 1) || 1)); }
  protected labelNumbers(b: BookingDetail): number[] { return Array.from({ length: this.labelCount(b) }, (_, i) => i + 1); }

  protected shortId(id: string): string { return id.slice(-8).toUpperCase(); }

  protected etaText(b: BookingDetail): string {
    const lo = b.etaMinDays, hi = b.etaMaxDays;
    if (lo == null && hi == null) return 'We will arrange the pickup next.';
    const d = hi ?? lo;
    return lo != null && hi != null && lo !== hi ? `Expected delivery in ${lo}-${hi} days.` : `Expected delivery in ${d} day${d === 1 ? '' : 's'}.`;
  }

  protected modeIcon(b: BookingDetail): string {
    return /air|prm|premium|express/i.test(`${b.transportMode ?? ''} ${b.serviceName ?? ''}`) ? 'flight' : 'local_shipping';
  }

  /** A barcode-style strip drawn from the reference, so every ticket looks its own (decorative, not scannable). */
  protected readonly bars = computed(() => {
    const text = this.booking()?.bookingReference || this.booking()?.bookingId || 'OCCPL';
    const rects: { x: number; w: number }[] = [];
    let x = 0;
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      for (let i = 0; i < 3; i++) {
        const w = ((c >> (i * 2)) & 3) + 1;
        rects.push({ x, w });
        x += w + 1 + ((c >> i) & 1);
      }
      x += 2;
    }
    return { rects, width: x };
  });
  copy(text: string | null | undefined): void {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => { this.copied.set(true); setTimeout(() => this.copied.set(false), 1500); }, () => undefined);
  }
}
