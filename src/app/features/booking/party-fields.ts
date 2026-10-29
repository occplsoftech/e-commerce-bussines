import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, switchMap, catchError, of } from 'rxjs';
import { PortalService } from '@core/services/portal.service';
import { PincodeInfo, PortalAddress } from '@core/models/portal.model';
import { PINCODE } from './booking-validators';

/** Contact + address + pincode for pickup or delivery. A valid pincode fills the city and state and shows coverage. */
@Component({
  selector: 'ecb-party-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <fieldset class="app-card party" [formGroup]="group()">
      <legend class="text-h2">{{ title() }}</legend>
      @if (saved().length > 0) {
        <div class="field">
          <label [for]="id('saved')">Use a saved address</label>
          <select [id]="id('saved')" (change)="useSaved($any($event.target).value)">
            <option value="">— Choose —</option>
            @for (a of saved(); track a.id) { <option [value]="a.id">{{ label(a) }}</option> }
          </select>
        </div>
      }
      <div class="grid-2">
        <div class="field">
          <label [for]="id('name')">{{ nameLabel() }} <span class="req">*</span></label>
          <input [id]="id('name')" formControlName="name" maxlength="100" autocomplete="name" [class.invalid]="bad('name')" />
          @if (bad('name')) { <span class="error">Required.</span> }
        </div>
        <div class="field">
          <label [for]="id('phone')">Phone <span class="req">*</span></label>
          <input [id]="id('phone')" formControlName="phone" inputmode="tel" maxlength="16" autocomplete="tel" [class.invalid]="bad('phone')" />
          @if (bad('phone')) { <span class="error">Enter a 10-digit Indian mobile number.</span> }
        </div>
      </div>
      <div class="field">
        <label [for]="id('address')">Address <span class="req">*</span></label>
        <textarea [id]="id('address')" formControlName="address" rows="2" maxlength="300" autocomplete="street-address" [class.invalid]="bad('address')"></textarea>
        @if (bad('address')) { <span class="error">Enter the full address (at least 10 characters).</span> }
      </div>
      <div class="grid-3">
        <div class="field">
          <label [for]="id('pincode')">Pincode <span class="req">*</span></label>
          <input [id]="id('pincode')" formControlName="pincode" inputmode="numeric" maxlength="6" autocomplete="postal-code" [class.invalid]="bad('pincode')" />
          @if (bad('pincode')) { <span class="error">6 digits, not starting with 0.</span> }
        </div>
        <div class="field">
          <label [for]="id('city')">City <span class="req">*</span></label>
          <input [id]="id('city')" formControlName="city" maxlength="80" autocomplete="address-level2" [class.invalid]="bad('city')" />
        </div>
        <div class="field">
          <label [for]="id('state')">State <span class="req">*</span></label>
          <input [id]="id('state')" formControlName="state" maxlength="80" autocomplete="address-level1" [class.invalid]="bad('state')" />
        </div>
      </div>
      <div class="coverage" aria-live="polite">
        @if (checking()) { <span class="text-caption">Checking pincode…</span> }
        @else if (info(); as i) {
          @if (!i.known) {
            <span class="badge badge--warn">Not in OCCPL's network</span>
            <span class="text-caption">Other courier partners may still serve it — rates will show what is available.</span>
          } @else {
            <span class="badge" [class.badge--ok]="i.serviceable" [class.badge--warn]="!i.serviceable">
              {{ i.serviceable ? 'Served by OCCPL network' : 'Not served by OCCPL network' }}
            </span>
            @if (i.district) { <span class="text-caption">{{ i.area ? i.area + ', ' : '' }}{{ i.district }}</span> }
            @if (i.odaApplicable) { <span class="badge badge--warn">Out-of-delivery-area surcharge may apply</span> }
          }
        }
      </div>
    </fieldset>
  `,
  styles: [`
    .party { border:1px solid var(--surface-border); padding:20px 20px 24px; margin:0; display:flex; flex-direction:column; gap:14px; min-width:0; }
    legend { margin-left:8px; padding:3px 14px; border-radius:999px; background:var(--occpl-color-info-surface); color:var(--occpl-color-accent); font:700 .8rem var(--font-sans) !important; letter-spacing:.06em; text-transform:uppercase; }
    .coverage { display:flex; align-items:center; gap:8px; flex-wrap:wrap; min-height:24px; }
  `]
})
export class PartyFields implements OnInit {
  readonly group = input.required<FormGroup>();
  readonly title = input.required<string>();
  readonly nameLabel = input('Contact name');
  readonly prefix = input.required<string>();
  /** Saved addresses to offer; the default one for {@link kind} fills an empty form once. */
  readonly saved = input<PortalAddress[]>([]);
  readonly kind = input<'pickup' | 'delivery' | null>(null);
  private defaultApplied = false;

  private readonly portal = inject(PortalService);
  private readonly destroyRef = inject(DestroyRef);
  readonly info = signal<PincodeInfo | null>(null);
  readonly checking = signal(false);

  ngOnInit(): void {
    const pincode = this.group().get('pincode')!;
    pincode.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter((v: string) => {
        const ok = PINCODE.test((v ?? '').trim());
        if (!ok) this.info.set(null);
        return ok;
      }),
      switchMap((v: string) => {
        this.checking.set(true);
        return this.portal.pincode(v.trim()).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((info) => {
      this.checking.set(false);
      this.info.set(info);
      if (info?.known) {
        this.autofill('city', info.city ?? info.district, info.pincode);
        this.autofill('state', info.state, info.pincode);
      }
    });
  }

  /** Pincode of a saved address just applied: its own city and state are kept rather than replaced by the master's. */
  private savedPincode: string | null = null;

  /** The pincode decides the city and state, so a new pincode replaces them; with a saved address, only empty fields are filled. */
  private autofill(field: 'city' | 'state', value: string | null | undefined, pin: string): void {
    const c = this.group().get(field);
    if (!c || !value) return;
    if (pin === this.savedPincode && (c.value ?? '').toString() !== '') return;
    c.setValue(value);
  }

  constructor() {
    effect(() => {
      const list = this.saved();
      if (this.defaultApplied || list.length === 0) return;
      this.defaultApplied = true;
      const wanted = list.find((a) => this.kind() === 'pickup' ? a.defaultPickup : this.kind() === 'delivery' && a.defaultDelivery);
      if (wanted && !this.group().get('address')!.value && !this.group().get('pincode')!.value) this.apply(wanted);
    });
  }

  useSaved(id: string): void {
    const a = this.saved().find((x) => x.id === id);
    if (a) this.apply(a);
  }

  /** Fills address, pincode and city; name, phone and state stay as typed. */
  private apply(a: PortalAddress): void {
    const address = [a.addressLine1, a.addressLine2, a.landmark ? 'Near ' + a.landmark : null].filter((x) => !!x).join(', ');
    this.savedPincode = a.pincode ?? null;
    this.group().patchValue({ address: address.slice(0, 300), pincode: a.pincode ?? '', city: a.city ?? this.group().get('city')!.value });
    this.group().markAsDirty();
  }

  label(a: PortalAddress): string {
    return [a.addressLine1, a.city, a.pincode].filter((x) => !!x).join(', ') + (this.isDefault(a) ? ' (default)' : '');
  }

  private isDefault(a: PortalAddress): boolean {
    return this.kind() === 'pickup' ? a.defaultPickup : this.kind() === 'delivery' ? a.defaultDelivery : false;
  }

  id(field: string): string { return `${this.prefix()}-${field}`; }

  bad(field: string): boolean {
    const c = this.group().get(field)!;
    return c.invalid && (c.touched || c.dirty);
  }
}
