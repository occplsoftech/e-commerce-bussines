import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { Icon } from '@shared/components/icon';
import { TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { PortalService } from '@core/services/portal.service';
import { NotificationService } from '@core/services/notification.service';
import { AddressRequest, AddressType, AddressUsage, PortalAddress } from '@core/models/portal.model';
import { pincodeValidator } from '@features/booking/booking-validators';
import { errorMessage } from '@shared/utils/http-error';

/** The customer's saved pickup/delivery addresses: list, add, edit, remove. */
@Component({
  selector: 'ecb-address-book',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ReactiveFormsModule, TitleCasePipe],
  template: `
    <article class="app-card box">
      <div class="row">
        <h2 class="text-h2">Saved addresses</h2>
        @if (!editing()) { <button class="btn btn--ghost" type="button" (click)="startAdd()"><ecb-icon name="add" /> Add address</button> }
      </div>
      <p class="text-caption">Saved addresses can be picked when you book a shipment.</p>

      @if (editing()) {
        <form class="editor" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <h3 class="text-h3">{{ editingId() ? 'Edit address' : 'New address' }}</h3>
          @if (formError()) { <p class="alert alert--error" role="alert">{{ formError() }}</p> }
          <div class="field">
            <label for="addr-line1">Address <span class="req">*</span></label>
            <input id="addr-line1" formControlName="addressLine1" maxlength="255" autocomplete="address-line1" [class.invalid]="bad('addressLine1')" />
            @if (bad('addressLine1')) { <span class="error">Required.</span> }
          </div>
          <div class="grid-2">
            <div class="field">
              <label for="addr-line2">Address line 2</label>
              <input id="addr-line2" formControlName="addressLine2" maxlength="255" autocomplete="address-line2" />
            </div>
            <div class="field">
              <label for="addr-landmark">Landmark</label>
              <input id="addr-landmark" formControlName="landmark" maxlength="150" />
            </div>
          </div>
          <div class="grid-3">
            <div class="field">
              <label for="addr-pincode">Pincode <span class="req">*</span></label>
              <input id="addr-pincode" formControlName="pincode" inputmode="numeric" maxlength="6" autocomplete="postal-code" [class.invalid]="bad('pincode')" />
              @if (bad('pincode')) { <span class="error">6 digits, not starting with 0.</span> }
            </div>
            <div class="field">
              <label for="addr-type">Type</label>
              <select id="addr-type" formControlName="addressType">
                <option value="OFFICE">Office</option><option value="WAREHOUSE">Warehouse</option><option value="HOME">Home</option>
              </select>
            </div>
            <div class="field">
              <label for="addr-usage">Used for</label>
              <select id="addr-usage" formControlName="addressUsage">
                <option value="BOTH">Pickup and delivery</option><option value="PICKUP">Pickup only</option><option value="DELIVERY">Delivery only</option>
              </select>
            </div>
          </div>
          <div class="checks">
            <label><input type="checkbox" formControlName="defaultPickup" [attr.disabled]="form.value.addressUsage === 'DELIVERY' ? true : null" /> Default pickup address</label>
            <label><input type="checkbox" formControlName="defaultDelivery" [attr.disabled]="form.value.addressUsage === 'PICKUP' ? true : null" /> Default delivery address</label>
          </div>
          <div class="actions">
            <button class="btn btn--ghost" type="button" (click)="cancel()">Cancel</button>
            <button class="btn btn--primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save address' }}</button>
          </div>
        </form>
      }

      @if (addresses() === null) {
        <p class="text-caption">Loading…</p>
      } @else if (addresses()!.length === 0 && !editing()) {
        <p class="text-caption">No saved addresses yet.</p>
      } @else {
        <ul class="addresses">
          @for (a of addresses(); track a.id) {
            <li>
              <div class="addr">
                {{ a.addressLine1 }}{{ a.addressLine2 ? ', ' + a.addressLine2 : '' }}{{ a.landmark ? ' (near ' + a.landmark + ')' : '' }}
                <div class="text-caption">{{ place(a) }}</div>
              </div>
              <div class="tags">
                @if (a.defaultPickup) { <span class="badge badge--info">Default pickup</span> }
                @if (a.defaultDelivery) { <span class="badge badge--info">Default delivery</span> }
                @if (a.addressType) { <span class="badge">{{ a.addressType | titlecase }}</span> }
                @if (a.addressUsage && a.addressUsage !== 'BOTH') { <span class="badge">{{ a.addressUsage | titlecase }} only</span> }
              </div>
              <div class="item-actions">
                <button class="btn btn--ghost" type="button" (click)="startEdit(a)" [attr.aria-label]="'Edit ' + a.addressLine1">Edit</button>
                <button class="btn btn--ghost danger" type="button" (click)="remove(a)" [attr.aria-label]="'Remove ' + a.addressLine1">Remove</button>
              </div>
            </li>
          }
        </ul>
      }
    </article>
  `,
  styles: [`
    .box { padding:20px; display:flex; flex-direction:column; gap:12px; }
    .row { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
    h2, h3 { margin:0; }
    .editor { display:flex; flex-direction:column; gap:12px; padding:16px; border:1px solid var(--surface-border); border-radius:var(--r-field); }
    .checks { display:flex; gap:20px; flex-wrap:wrap; font:500 14px var(--font-sans); }
    .checks label { display:inline-flex; align-items:center; gap:8px; }
    .actions { display:flex; justify-content:flex-end; gap:8px; }
    .addresses { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; }
    .addresses li { padding:12px 0; border-top:1px solid var(--surface-border); display:grid; grid-template-columns:1fr auto; gap:6px 12px; }
    .addr { font:400 14px/1.5 var(--font-sans); overflow-wrap:anywhere; }
    .tags { display:flex; gap:6px; flex-wrap:wrap; grid-column:1; }
    .item-actions { grid-column:2; grid-row:1 / span 2; display:flex; gap:4px; align-items:flex-start; }
    .danger { color:var(--danger); }
    @media (max-width: 560px) { .addresses li { grid-template-columns:1fr; } .item-actions { grid-column:1; grid-row:auto; } }
  `]
})
export class AddressBook implements OnInit {
  private readonly portal = inject(PortalService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  /** Emits the current list after every change, so the parent can refresh what it shows. */
  readonly changed = output<PortalAddress[]>();

  readonly addresses = signal<PortalAddress[] | null>(null);
  readonly editing = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  private version: number | null = null;

  readonly form = this.fb.nonNullable.group({
    addressLine1: ['', [Validators.required, Validators.maxLength(255)]],
    addressLine2: ['', [Validators.maxLength(255)]],
    landmark: ['', [Validators.maxLength(150)]],
    pincode: ['', [Validators.required, pincodeValidator]],
    addressType: ['OFFICE' as AddressType],
    addressUsage: ['BOTH' as AddressUsage],
    defaultPickup: [false],
    defaultDelivery: [false]
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.portal.addresses().subscribe({
      next: (list) => { this.addresses.set(list); this.changed.emit(list); },
      error: () => this.addresses.set([])
    });
  }

  startAdd(): void {
    this.form.reset();
    this.editingId.set(null);
    this.version = null;
    this.formError.set(null);
    this.editing.set(true);
  }

  startEdit(a: PortalAddress): void {
    this.form.reset({
      addressLine1: a.addressLine1, addressLine2: a.addressLine2 ?? '', landmark: a.landmark ?? '', pincode: a.pincode ?? '',
      addressType: a.addressType ?? 'OFFICE', addressUsage: a.addressUsage ?? 'BOTH',
      defaultPickup: a.defaultPickup, defaultDelivery: a.defaultDelivery
    });
    this.editingId.set(a.id);
    this.version = a.version;
    this.formError.set(null);
    this.editing.set(true);
  }

  cancel(): void { this.editing.set(false); }

  bad(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.touched || c.dirty);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body: AddressRequest = {
      addressType: v.addressType, addressUsage: v.addressUsage, addressLine1: v.addressLine1.trim(),
      addressLine2: v.addressLine2.trim() || null, landmark: v.landmark.trim() || null, pincode: v.pincode.trim(),
      defaultPickup: v.defaultPickup && v.addressUsage !== 'DELIVERY',
      defaultDelivery: v.defaultDelivery && v.addressUsage !== 'PICKUP',
      expectedVersion: this.version
    };
    const id = this.editingId();
    this.saving.set(true);
    this.formError.set(null);
    (id ? this.portal.updateAddress(id, body) : this.portal.addAddress(body)).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.notify.success(id ? 'Address updated.' : 'Address saved.');
        this.load();
      },
      error: async (e: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(await errorMessage(e, 'The address could not be saved. Please try again.'));
      }
    });
  }

  remove(a: PortalAddress): void {
    if (!confirm('Remove this address from your address book?')) return;
    this.portal.removeAddress(a.id).subscribe({
      next: () => { this.notify.success('Address removed.'); this.load(); },
      error: () => this.notify.error('The address could not be removed. Please try again.')
    });
  }

  place(a: PortalAddress): string {
    return [a.area, a.city, a.district, a.pincode].filter((x, i, all) => !!x && all.indexOf(x) === i).join(', ');
  }
}
