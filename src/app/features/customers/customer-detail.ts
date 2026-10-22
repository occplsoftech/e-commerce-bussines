import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '@shared/components/icon';
import { PortalService } from '@core/services/portal.service';
import { NotificationService } from '@core/services/notification.service';
import { SubCustomer } from '@core/models/portal.model';
import { AddressBook } from '@features/profile/address-book';
import { mobileValidator, normaliseMobile } from '@features/booking/booking-validators';
import { errorMessage } from '@shared/utils/http-error';

/** One of the customer's own customers: their details and their addresses (as many as needed). */
@Component({
  selector: 'ecb-customer-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ReactiveFormsModule, RouterLink, AddressBook],
  template: `
    <section class="page">
      <a class="back" routerLink="/customers"><ecb-icon name="arrow_back" /> My customers</a>

      @if (loadError()) {
        <p class="alert alert--error" role="alert">This customer was not found.</p>
      } @else if (customer(); as c) {
        <div class="page__head">
          <div>
            <h1 class="text-display">{{ c.displayName }}</h1>
            <p class="text-caption">Code <span class="mono">{{ c.customerCode }}</span> · registered by you</p>
          </div>
          <div class="page__actions">
            @if (c.status === 'ACTIVE') { <button class="btn btn--ghost danger" type="button" (click)="remove()">Remove customer</button> }
          </div>
        </div>

        <form class="app-card box" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <h2 class="text-h2">Details</h2>
          @if (formError()) { <p class="alert alert--error" role="alert">{{ formError() }}</p> }
          <div class="grid-2">
            <div class="field">
              <label for="d-first">First name <span class="req">*</span></label>
              <input id="d-first" formControlName="firstName" maxlength="100" [class.invalid]="bad('firstName')" />
            </div>
            <div class="field">
              <label for="d-last">Last name</label>
              <input id="d-last" formControlName="lastName" maxlength="100" />
            </div>
            <div class="field">
              <label for="d-company">Company</label>
              <input id="d-company" formControlName="companyName" maxlength="150" />
            </div>
            <div class="field">
              <label for="d-mobile">Mobile <span class="req">*</span></label>
              <input id="d-mobile" formControlName="mobile" inputmode="tel" maxlength="20" [class.invalid]="bad('mobile')" />
              @if (bad('mobile')) { <span class="error">Enter a 10-digit mobile number.</span> }
            </div>
            <div class="field">
              <label for="d-email">E-mail</label>
              <input id="d-email" type="email" formControlName="email" maxlength="255" [class.invalid]="bad('email')" />
            </div>
          </div>
          <div class="actions">
            <button class="btn btn--primary" type="submit" [disabled]="saving() || form.pristine">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
          </div>
        </form>

        <ecb-address-book [customerId]="c.id" heading="Addresses" />
      } @else {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  styles: [`
    .back { display:inline-flex; align-items:center; gap:6px; font:600 14px var(--font-sans); text-decoration:none; }
    .box { padding:20px; display:flex; flex-direction:column; gap:14px; }
    h2 { margin:0; }
    .actions { display:flex; justify-content:flex-end; }
    .danger { color:var(--danger); }
  `]
})
export class CustomerDetail implements OnInit {
  readonly id = input.required<string>();
  private readonly portal = inject(PortalService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly customer = signal<SubCustomer | null>(null);
  readonly loadError = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.maxLength(100)]],
    companyName: ['', [Validators.maxLength(150)]],
    mobile: ['', [Validators.required, mobileValidator]],
    email: ['', [Validators.email, Validators.maxLength(255)]]
  });

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.portal.customer(this.id()).subscribe({
      next: (c) => {
        this.customer.set(c);
        this.form.reset({ firstName: c.firstName, lastName: c.lastName ?? '', companyName: c.companyName ?? '', mobile: c.mobile, email: c.email ?? '' });
      },
      error: () => this.loadError.set(true)
    });
  }

  bad(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.touched || c.dirty);
  }

  save(): void {
    const c = this.customer();
    if (!c) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);
    this.portal.updateCustomer(c.id, {
      firstName: v.firstName.trim(), lastName: v.lastName.trim() || null, companyName: v.companyName.trim() || null,
      mobile: normaliseMobile(v.mobile), email: v.email.trim() || null, contactPerson: c.contactPerson, expectedVersion: c.version
    }).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.customer.set(saved);
        this.form.markAsPristine();
        this.notify.success('Customer updated.');
      },
      error: async (e: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(await errorMessage(e, 'The customer could not be saved. Please try again.'));
      }
    });
  }

  remove(): void {
    const c = this.customer();
    if (!c || !confirm('Remove this customer? Their addresses are kept but they will no longer be active.')) return;
    this.portal.removeCustomer(c.id).subscribe({
      next: () => { this.notify.success('Customer removed.'); this.router.navigate(['/customers']); },
      error: () => this.notify.error('The customer could not be removed. Please try again.')
    });
  }
}
