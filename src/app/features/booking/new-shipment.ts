import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingDraftService, ShipmentDraft } from './booking-draft.service';
import { PartyFields } from './party-fields';
import { BookingSteps } from './booking-steps';
import { BannerChip, RouteBanner } from './route-banner';
import { PhotoPicker } from './photo-picker';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PortalService } from '@core/services/portal.service';
import { PortalAddress } from '@core/models/portal.model';
import { differentAddresses, mobileValidator, normaliseMobile, pincodeValidator, positiveNumber, wholeNumber } from './booking-validators';

/**
 * Step 1 of booking: pickup, delivery and package. "Compare rates" validates, keeps the draft and asks the
 * server to price it with every courier (prices always come from the server, never from here).
 */
@Component({
  selector: 'ecb-new-shipment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ReactiveFormsModule, PartyFields, BookingSteps, RouteBanner, PhotoPicker],
  template: `
    <section class="page">
      <div class="page__head" data-icon="add_box">
        <div>
          <h1 class="text-display">Book a shipment</h1>
          <p class="text-caption">Tell us where it is going and what it is. Fields marked * are required.</p>
        </div>
      </div>

      <ecb-booking-steps [current]="0" />
      <ecb-route-banner [fromPin]="v().pickup?.pincode" [fromPlace]="place(v().pickup)" [toPin]="v().delivery?.pincode" [toPlace]="place(v().delivery)" [chips]="chips()" />

      <form [formGroup]="form" (ngSubmit)="compare()" novalidate class="form">
        <div class="grid-2 parties">
          <ecb-party-fields [group]="form.controls.pickup" title="Pickup" prefix="pickup" [saved]="pickupAddresses()" kind="pickup" />
          <ecb-party-fields [group]="form.controls.delivery" title="Delivery" nameLabel="Recipient name" prefix="delivery"
            [saved]="deliveryAddresses()" kind="delivery" />
        </div>

        <fieldset class="app-card pkg" formGroupName="package" aria-label="Package">
          <div class="head">
            <span class="chip"><ecb-icon name="inventory_2" /></span>
            <span><strong>Package</strong><small>What you are sending</small></span>
          </div>

          <div class="grid-3">
            <div class="field">
              <label for="weight">Actual weight (kg) <span class="req">*</span></label>
              <span class="wrap"><ecb-icon name="scale" /><input id="weight" type="number" step="0.001" min="0" formControlName="actualWeightKg" inputmode="decimal" placeholder="0.5" [class.invalid]="bad('package.actualWeightKg')" /></span>
              @if (bad('package.actualWeightKg')) { <span class="error">More than 0, up to 1000 kg, 3 decimals.</span> }
            </div>
            <div class="field">
              <label for="count">Number of packages <span class="req">*</span></label>
              <span class="stepper">
                <button type="button" aria-label="One package fewer" (click)="bump(-1)"><ecb-icon name="remove" /></button>
                <input id="count" type="number" step="1" min="1" formControlName="packageCount" inputmode="numeric" [class.invalid]="bad('package.packageCount')" />
                <button type="button" aria-label="One package more" (click)="bump(1)"><ecb-icon name="add" /></button>
              </span>
              @if (bad('package.packageCount')) { <span class="error">1 to 999.</span> }
            </div>
            <div class="field">
              <label for="value">Shipment value (₹) <span class="req">*</span></label>
              <span class="wrap"><span class="rs">₹</span><input id="value" type="number" step="0.01" min="0" formControlName="declaredValue" inputmode="decimal" placeholder="1000" [class.invalid]="bad('package.declaredValue')" /></span>
              @if (bad('package.declaredValue')) { <span class="error">More than 0, 2 decimals.</span> }
            </div>
          </div>

          <div class="dims">
            <svg class="dims__box" viewBox="0 0 120 96" aria-hidden="true">
              <path d="M18 34 60 14l42 20v42L60 90 18 76z" fill="var(--occpl-color-info-surface)" stroke="var(--occpl-color-accent)" stroke-width="2" stroke-linejoin="round" />
              <path d="M18 34l42 20 42-20M60 54v36" fill="none" stroke="var(--occpl-color-accent)" stroke-width="2" stroke-linejoin="round" />
              <text x="30" y="92" font-size="11" font-weight="700" fill="var(--occpl-color-primary)">L</text>
              <text x="104" y="88" font-size="11" font-weight="700" fill="var(--occpl-color-primary)">B</text>
              <text x="108" y="56" font-size="11" font-weight="700" fill="var(--occpl-color-primary)">H</text>
            </svg>
            <div class="dims__fields">
              <div class="grid-4">
                <div class="field">
                  <label for="len">Length <span class="req">*</span></label>
                  <input id="len" type="number" step="0.1" min="0" formControlName="length" inputmode="decimal" placeholder="30" [class.invalid]="bad('package.length')" />
                </div>
                <div class="field">
                  <label for="bre">Breadth <span class="req">*</span></label>
                  <input id="bre" type="number" step="0.1" min="0" formControlName="breadth" inputmode="decimal" placeholder="20" [class.invalid]="bad('package.breadth')" />
                </div>
                <div class="field">
                  <label for="hei">Height <span class="req">*</span></label>
                  <input id="hei" type="number" step="0.1" min="0" formControlName="height" inputmode="decimal" placeholder="10" [class.invalid]="bad('package.height')" />
                </div>
                <div class="field">
                  <span class="lbl">Unit</span>
                  <span class="seg seg--sm" role="radiogroup" aria-label="Dimension unit">
                    <button type="button" role="radio" [attr.aria-checked]="v().package?.dimensionUnit !== 'IN'" [class.on]="v().package?.dimensionUnit !== 'IN'" (click)="setUnit('CM')">cm</button>
                    <button type="button" role="radio" [attr.aria-checked]="v().package?.dimensionUnit === 'IN'" [class.on]="v().package?.dimensionUnit === 'IN'" (click)="setUnit('IN')">in</button>
                  </span>
                </div>
              </div>
              @if (dimsBad()) { <span class="error">Each dimension must be more than 0 and at most 500, with 1 decimal.</span> }
              <p class="hint"><ecb-icon name="straighten" /> Dimensions are per package. Each courier works out its own volumetric weight; the chargeable weight is shown with every rate.</p>
            </div>
          </div>

          <div class="field">
            <label for="contents">Contents <span class="req">*</span></label>
            <input id="contents" formControlName="contents" maxlength="200" placeholder="e.g. Cotton garments" [class.invalid]="bad('package.contents')" />
            @if (bad('package.contents')) { <span class="error">Describe what is being shipped.</span> }
          </div>

          <ecb-photo-picker />

          <div class="field">
            <span class="lbl">Payment mode <span class="req">*</span></span>
            <span class="pay" role="radiogroup" aria-label="Payment mode">
              <button type="button" role="radio" [attr.aria-checked]="mode() === 'PREPAID'" [class.on]="mode() === 'PREPAID'" (click)="setMode('PREPAID')">
                <span class="pay__ico"><ecb-icon name="account_balance_wallet" /></span>
                <span><strong>Prepaid</strong><small>Freight comes from your wallet when you book</small></span>
              </button>
              <button type="button" role="radio" [attr.aria-checked]="mode() === 'TOPAY'" [class.on]="mode() === 'TOPAY'" (click)="setMode('TOPAY')">
                <span class="pay__ico"><ecb-icon name="sell" /></span>
                <span><strong>To Pay</strong><small>The receiver pays the freight on delivery (OCCPL Network only)</small></span>
              </button>
              <button type="button" role="radio" [attr.aria-checked]="mode() === 'COD'" [class.on]="mode() === 'COD'" (click)="setMode('COD')">
                <span class="pay__ico"><ecb-icon name="payments" /></span>
                <span><strong>Cash on delivery</strong><small>The receiver pays the shipment value on delivery</small></span>
              </button>
            </span>
            <span class="hint">COD is offered only by couriers that support it. To Pay is offered by OCCPL Network only.</span>
          </div>
        </fieldset>

        @if (sameAddress()) { <p class="alert alert--error" role="alert">Pickup and delivery address cannot be the same. Enter the address the parcel is going to.</p> }
        @if (notice()) { <p class="alert alert--info" role="status">{{ notice() }}</p> }

        <div class="actions">
          <button class="btn btn--ghost" type="button" (click)="reset()">Clear</button>
          <button class="btn btn--primary btn--cta" type="submit" [disabled]="comparing()">
            {{ comparing() ? 'Asking couriers…' : 'Compare rates' }} <ecb-icon name="arrow_forward" />
          </button>
        </div>
      </form>
    </section>
  `,
  styles: [`
    .form { display:flex; flex-direction:column; gap:20px; }
    .parties { align-items:start; }
    .pkg { border:1px solid var(--surface-border); border-top:4px solid var(--occpl-color-primary); padding:22px 22px 26px; margin:0; display:flex; flex-direction:column; gap:18px; min-width:0; }
    .head { display:flex; align-items:center; gap:12px; padding:0 8px; }
    .head strong { display:block; font:700 1.1rem var(--font-display); }
    .head small { display:block; font:400 .8rem var(--font-sans); color:var(--content-muted); }
    .chip { display:grid; place-items:center; width:2.6rem; height:2.6rem; border-radius:14px; background:var(--occpl-gradient-button); color:#fff; font-size:1.25rem; box-shadow:0 6px 16px rgb(214 31 69 / 28%); }
    .grid-3 { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:16px; }
    .wrap { position:relative; display:block; }
    .wrap ecb-icon, .wrap .rs { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--content-muted); font:700 1rem var(--font-sans); pointer-events:none; }
    .wrap input { padding-left:38px; width:100%; }
    .stepper { display:flex; align-items:stretch; gap:0; border:1px solid var(--surface-border); border-radius:var(--r-field); overflow:hidden; background:var(--surface); }
    .stepper input { border:0; text-align:center; flex:1; min-width:0; box-shadow:none; border-radius:0; font-weight:700; }
    .stepper button { width:2.8rem; border:0; background:var(--occpl-color-neutral-surface); color:var(--occpl-color-primary); cursor:pointer; font-size:1.1rem; }
    .stepper button:hover { background:var(--occpl-color-info-surface); }
    .dims { display:grid; grid-template-columns:132px minmax(0,1fr); gap:20px; align-items:center; padding:16px; border:1px dashed var(--surface-border); border-radius:var(--r-card); background:var(--occpl-color-neutral-surface); }
    .dims__box { width:120px; height:96px; }
    .lbl { font:600 .85rem var(--font-sans); }
    .seg { display:inline-flex; width:max-content; padding:3px; border-radius:999px; background:var(--surface); border:1px solid var(--surface-border); }
    .seg button { border:0; background:transparent; padding:.45rem 1rem; border-radius:999px; font:700 .85rem var(--font-sans); color:var(--content-muted); cursor:pointer; }
    .seg button.on { background:var(--occpl-gradient-button); color:#fff; box-shadow:0 4px 12px rgb(214 31 69 / 25%); }
    .pay { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; }
    .pay button { display:flex; align-items:center; gap:14px; text-align:left; padding:14px 16px; border-radius:var(--r-card); border:2px solid var(--surface-border); background:var(--surface); cursor:pointer; transition:border-color .15s, box-shadow .15s, transform .15s; color:var(--content-fg); }
    .pay button:hover { transform:translateY(-1px); box-shadow:var(--shadow-sm); }
    .pay button.on { border-color:var(--occpl-color-primary); box-shadow:0 0 0 4px var(--occpl-color-info-surface); }
    .pay strong { display:block; font:700 .95rem var(--font-sans); }
    .pay small { display:block; font:400 .78rem var(--font-sans); color:var(--content-muted); }
    .pay__ico { display:grid; place-items:center; width:2.6rem; height:2.6rem; border-radius:12px; background:var(--occpl-color-info-surface); color:var(--occpl-color-accent); font-size:1.25rem; flex:none; }
    .pay button.on .pay__ico { background:var(--occpl-gradient-button); color:#fff; }
    .error { font:500 12px var(--font-sans); color:var(--danger); }
    .hint { font:400 12px var(--font-sans); color:var(--content-muted); margin:0; display:flex; gap:6px; align-items:flex-start; }
    .actions { display:flex; justify-content:flex-end; gap:12px; flex-wrap:wrap; }
    .btn--cta { padding-inline:2rem; font-size:1.05rem; box-shadow:0 10px 24px rgb(214 31 69 / 30%); }
    @media (max-width: 760px) { .grid-3 { grid-template-columns:1fr; } .dims { grid-template-columns:1fr; justify-items:center; } .dims__fields { width:100%; } .pay { grid-template-columns:1fr; } }
    @media (max-width: 1100px) and (min-width: 761px) { .pay { grid-template-columns:1fr; } }
    @media (max-width: 560px) { .actions .btn { flex:1; } }
  `]
})
export class NewShipment implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly drafts = inject(BookingDraftService);
  private readonly portal = inject(PortalService);
  private readonly router = inject(Router);
  /** Saved addresses offered in each half of the form; loading them is optional. */
  readonly pickupAddresses = signal<PortalAddress[]>([]);
  readonly deliveryAddresses = signal<PortalAddress[]>([]);
  readonly comparing = signal(false);
  readonly notice = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    pickup: this.party(),
    delivery: this.party(),
    package: this.fb.group({
      actualWeightKg: this.fb.control<number | null>(null, [Validators.required, positiveNumber(1000, 3)]),
      length: this.fb.control<number | null>(null, [Validators.required, positiveNumber(500, 1)]),
      breadth: this.fb.control<number | null>(null, [Validators.required, positiveNumber(500, 1)]),
      height: this.fb.control<number | null>(null, [Validators.required, positiveNumber(500, 1)]),
      dimensionUnit: this.fb.nonNullable.control<'CM' | 'IN'>('CM'),
      packageCount: this.fb.control<number | null>(1, [Validators.required, wholeNumber(1, 999)]),
      contents: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
      declaredValue: this.fb.control<number | null>(null, [Validators.required, positiveNumber(10_000_000, 2)]),
      paymentMode: this.fb.nonNullable.control<'PREPAID' | 'COD' | 'TOPAY'>('PREPAID')
    })
  }, { validators: differentAddresses });

  /** The form as it is being filled in, for the route banner and the volumetric hint. */
  protected readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly cod = computed(() => this.v().package?.paymentMode === 'COD');
  protected readonly topay = computed(() => this.v().package?.paymentMode === 'TOPAY');
  protected readonly mode = computed(() => this.v().package?.paymentMode ?? 'PREPAID');

  protected readonly chips = computed<BannerChip[]>(() => {
    const p = this.v().package;
    const out: BannerChip[] = [];
    if (p?.actualWeightKg) out.push({ icon: 'scale', text: `${p.actualWeightKg} kg` });
    if (p?.packageCount) out.push({ icon: 'inventory_2', text: `${p.packageCount} package${Number(p.packageCount) === 1 ? '' : 's'}` });
    const vol = this.volumetric();
    if (vol) out.push({ icon: 'straighten', text: `${vol} kg volumetric` });
    out.push(this.cod() ? { icon: 'payments', text: 'Cash on delivery' } : this.topay() ? { icon: 'sell', text: 'To Pay' } : { icon: 'account_balance_wallet', text: 'Prepaid' });
    return out;
  });

  /** Volumetric weight of one package (L×B×H ÷ 5000, in cm), shown only once all three sizes are valid. */
  private volumetric(): string | null {
    const p = this.v().package;
    const f = p?.dimensionUnit === 'IN' ? 2.54 : 1;
    const [l, b, h] = [p?.length, p?.breadth, p?.height].map((x) => Number(x) * f);
    if (!(l > 0 && b > 0 && h > 0)) return null;
    return (Math.round((l * b * h) / 5000 * 1000) / 1000).toString();
  }

  protected place(p: { city?: string; state?: string } | undefined): string {
    return [p?.city, p?.state].filter((x) => !!x).join(', ');
  }

  protected bump(by: number): void {
    const c = this.form.controls.package.controls.packageCount;
    c.setValue(Math.max(1, Math.min(999, Number(c.value ?? 1) + by)));
    c.markAsDirty();
  }
  protected setMode(m: 'PREPAID' | 'COD' | 'TOPAY'): void { this.form.controls.package.controls.paymentMode.setValue(m); }
  protected setUnit(u: 'CM' | 'IN'): void { this.form.controls.package.controls.dimensionUnit.setValue(u); }

  constructor() {
    const draft = this.drafts.draft();
    if (draft) this.form.patchValue(draft);
  }

  private party() {
    return this.fb.nonNullable.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      phone: ['', [Validators.required, mobileValidator]],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
      pincode: ['', [Validators.required, pincodeValidator]],
      city: ['', [Validators.required, Validators.maxLength(80)]],
      state: ['', [Validators.required, Validators.maxLength(80)]]
    });
  }

  ngOnInit(): void {
    this.portal.addresses().subscribe({
      next: (list) => {
        this.pickupAddresses.set(list.filter((a) => a.addressUsage !== 'DELIVERY'));
        this.deliveryAddresses.set(list.filter((a) => a.addressUsage !== 'PICKUP'));
      },
      error: () => undefined
    });
  }

  bad(path: string): boolean {
    const c = this.form.get(path)!;
    return c.invalid && (c.touched || c.dirty);
  }

  /** True once both addresses are filled in and identical (shown at once, not only after a failed submit). */
  sameAddress(): boolean {
    return !!this.form.errors?.['sameAddress'];
  }

  dimsBad(): boolean {
    return ['length', 'breadth', 'height'].some((f) => this.bad('package.' + f));
  }

  compare(): void {
    this.notice.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notice.set(this.sameAddress() ? null : 'Please correct the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    const draft: ShipmentDraft = {
      pickup: { ...v.pickup, phone: normaliseMobile(v.pickup.phone) },
      delivery: { ...v.delivery, phone: normaliseMobile(v.delivery.phone) },
      package: v.package as ShipmentDraft['package']
    };
    this.drafts.save(draft);
    this.comparing.set(true);
    this.portal.compareRates(draft).subscribe({
      next: (quote) => this.router.navigate(['/book/rates', quote.quoteId]),
      error: (e: HttpErrorResponse) => {
        this.comparing.set(false);
        this.notice.set(e.status === 400 || e.status === 422 || e.status === 429
          ? (e.error?.message ?? 'Please check the shipment details.')
          : 'Rates could not be compared right now. Please try again.');
      }
    });
  }

  reset(): void {
    this.form.reset();
    this.drafts.clear();
    this.notice.set(null);
  }
}
