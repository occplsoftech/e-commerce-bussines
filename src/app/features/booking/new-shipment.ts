import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingDraftService, ShipmentDraft } from './booking-draft.service';
import { PartyFields } from './party-fields';
import { mobileValidator, normaliseMobile, pincodeValidator, positiveNumber, wholeNumber } from './booking-validators';

const STEPS = ['Shipment details', 'Compare rates', 'Select courier', 'Confirm booking', 'Booking result'] as const;

/**
 * Step 1 of booking: pickup, delivery and package. "Compare rates" validates everything and keeps the
 * draft; the comparison itself is the next step (rates always come from the server, never from here).
 */
@Component({
  selector: 'ecb-new-shipment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PartyFields],
  template: `
    <section class="page">
      <div class="page__head">
        <div>
          <h1 class="text-display">Book a shipment</h1>
          <p class="text-caption">Fields marked * are required.</p>
        </div>
      </div>

      <ol class="steps" aria-label="Booking steps">
        @for (s of steps; track s; let i = $index) {
          <li [class.current]="i === step()" [class.done]="i < step()" [attr.aria-current]="i === step() ? 'step' : null">
            <span class="steps__n">{{ i + 1 }}</span><span class="steps__label">{{ s }}</span>
          </li>
        }
      </ol>

      <form [formGroup]="form" (ngSubmit)="compare()" novalidate class="form">
        <div class="grid-2 parties">
          <ecb-party-fields [group]="form.controls.pickup" title="Pickup" prefix="pickup" />
          <ecb-party-fields [group]="form.controls.delivery" title="Delivery" nameLabel="Recipient name" prefix="delivery" />
        </div>

        <fieldset class="app-card pkg" formGroupName="package">
          <legend class="text-h2">Package</legend>
          <div class="grid-4">
            <div class="field">
              <label for="weight">Actual weight (kg) <span class="req">*</span></label>
              <input id="weight" type="number" step="0.001" min="0" formControlName="actualWeightKg" inputmode="decimal" [class.invalid]="bad('package.actualWeightKg')" />
              @if (bad('package.actualWeightKg')) { <span class="error">More than 0, up to 1000 kg, 3 decimals.</span> }
            </div>
            <div class="field">
              <label for="count">Number of packages <span class="req">*</span></label>
              <input id="count" type="number" step="1" min="1" formControlName="packageCount" inputmode="numeric" [class.invalid]="bad('package.packageCount')" />
              @if (bad('package.packageCount')) { <span class="error">1 to 999.</span> }
            </div>
            <div class="field">
              <label for="value">Shipment value (₹) <span class="req">*</span></label>
              <input id="value" type="number" step="0.01" min="0" formControlName="declaredValue" inputmode="decimal" [class.invalid]="bad('package.declaredValue')" />
              @if (bad('package.declaredValue')) { <span class="error">More than 0, 2 decimals.</span> }
            </div>
            <div class="field">
              <label for="mode">Payment mode <span class="req">*</span></label>
              <select id="mode" formControlName="paymentMode">
                <option value="PREPAID">Prepaid</option>
                <option value="COD">Cash on delivery (COD)</option>
              </select>
              <span class="hint">COD is offered only by couriers that support it.</span>
            </div>
          </div>
          <div class="grid-4">
            <div class="field">
              <label for="len">Length <span class="req">*</span></label>
              <input id="len" type="number" step="0.1" min="0" formControlName="length" inputmode="decimal" [class.invalid]="bad('package.length')" />
            </div>
            <div class="field">
              <label for="bre">Breadth <span class="req">*</span></label>
              <input id="bre" type="number" step="0.1" min="0" formControlName="breadth" inputmode="decimal" [class.invalid]="bad('package.breadth')" />
            </div>
            <div class="field">
              <label for="hei">Height <span class="req">*</span></label>
              <input id="hei" type="number" step="0.1" min="0" formControlName="height" inputmode="decimal" [class.invalid]="bad('package.height')" />
            </div>
            <div class="field">
              <label for="unit">Dimension unit</label>
              <select id="unit" formControlName="dimensionUnit">
                <option value="CM">Centimetres</option>
                <option value="IN">Inches</option>
              </select>
            </div>
          </div>
          @if (dimsBad()) { <span class="error">Each dimension must be more than 0 and at most 500, with 1 decimal.</span> }
          <p class="hint">Dimensions are per package. Each courier works out its own volumetric weight from them; the chargeable weight is shown with every rate.</p>
          <div class="field">
            <label for="contents">Contents <span class="req">*</span></label>
            <input id="contents" formControlName="contents" maxlength="200" placeholder="e.g. Cotton garments" [class.invalid]="bad('package.contents')" />
            @if (bad('package.contents')) { <span class="error">Describe what is being shipped.</span> }
          </div>
        </fieldset>

        @if (notice()) { <p class="alert alert--info" role="status">{{ notice() }}</p> }

        <div class="actions">
          <button class="btn btn--ghost" type="button" (click)="reset()">Clear</button>
          <button class="btn btn--primary" type="submit">Compare rates <span class="material-icons">arrow_forward</span></button>
        </div>
      </form>
    </section>
  `,
  styles: [`
    .steps { list-style:none; margin:0; padding:0; display:flex; gap:8px; flex-wrap:wrap; }
    .steps li { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:var(--r-pill);
      background:var(--surface); border:1px solid var(--surface-border); font:600 13px var(--font-sans); color:var(--content-muted); }
    .steps__n { display:grid; place-items:center; width:22px; height:22px; border-radius:50%; background:var(--surface-muted); font-size:12px; }
    .steps li.current { border-color:var(--brand-300); color:var(--brand-700); background:var(--brand-50); }
    .steps li.current .steps__n { background:var(--brand-600); color:#fff; }
    .steps li.done .steps__n { background:var(--success); color:#fff; }
    @media (max-width: 700px) { .steps__label { display:none; } .steps li.current .steps__label { display:inline; } }
    .form { display:flex; flex-direction:column; gap:20px; }
    .parties { align-items:start; }
    .pkg { border:1px solid var(--surface-border); padding:20px; margin:0; display:flex; flex-direction:column; gap:14px; min-width:0; }
    legend { padding:0 6px; margin-left:-6px; }
    .error { font:500 12px var(--font-sans); color:var(--danger); }
    .hint { font:400 12px var(--font-sans); color:var(--content-muted); margin:0; }
    .actions { display:flex; justify-content:flex-end; gap:12px; flex-wrap:wrap; }
    @media (max-width: 560px) { .actions .btn { flex:1; } }
  `]
})
export class NewShipment {
  private readonly fb = inject(FormBuilder);
  private readonly drafts = inject(BookingDraftService);
  readonly steps = STEPS;
  readonly step = signal(0);
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
      paymentMode: this.fb.nonNullable.control<'PREPAID' | 'COD'>('PREPAID')
    })
  });

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

  bad(path: string): boolean {
    const c = this.form.get(path)!;
    return c.invalid && (c.touched || c.dirty);
  }

  dimsBad(): boolean {
    return ['length', 'breadth', 'height'].some((f) => this.bad('package.' + f));
  }

  compare(): void {
    this.notice.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notice.set('Please correct the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    const draft: ShipmentDraft = {
      pickup: { ...v.pickup, phone: normaliseMobile(v.pickup.phone) },
      delivery: { ...v.delivery, phone: normaliseMobile(v.delivery.phone) },
      package: v.package as ShipmentDraft['package']
    };
    this.drafts.save(draft);
    // The rate comparison service is being connected; until it is, nothing is priced here.
    this.notice.set('Your shipment details are saved. Live rate comparison is being connected and will be available shortly.');
  }

  reset(): void {
    this.form.reset();
    this.drafts.clear();
    this.notice.set(null);
  }
}
