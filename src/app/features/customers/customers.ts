import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '@shared/components/icon';
import { PortalService } from '@core/services/portal.service';
import { NotificationService } from '@core/services/notification.service';
import { SubCustomer } from '@core/models/portal.model';
import { mobileValidator, normaliseMobile } from '@features/booking/booking-validators';
import { errorMessage } from '@shared/utils/http-error';

/** The customers this customer has registered. Each one is linked to this customer and keeps its own addresses. */
@Component({
  selector: 'ecb-customers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page">
      <div class="page__head" data-icon="group">
        <div>
          <h1 class="text-display">My customers</h1>
          <p class="text-caption">Customers you register here are linked to your account. Each can have as many addresses as you need.</p>
        </div>
        <div class="page__actions">
          @if (!adding()) { <button class="btn btn--primary" type="button" (click)="adding.set(true)"><ecb-icon name="add" /> Add customer</button> }
        </div>
      </div>

      @if (adding()) {
        <form class="app-card box" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <h2 class="text-h2">New customer</h2>
          @if (formError()) { <p class="alert alert--error" role="alert">{{ formError() }}</p> }
          <div class="grid-2">
            <div class="field">
              <label for="c-first">First name <span class="req">*</span></label>
              <input id="c-first" formControlName="firstName" maxlength="100" [class.invalid]="bad('firstName')" />
              @if (bad('firstName')) { <span class="error">Required.</span> }
            </div>
            <div class="field">
              <label for="c-last">Last name</label>
              <input id="c-last" formControlName="lastName" maxlength="100" />
            </div>
            <div class="field">
              <label for="c-company">Company</label>
              <input id="c-company" formControlName="companyName" maxlength="150" />
            </div>
            <div class="field">
              <label for="c-mobile">Mobile <span class="req">*</span></label>
              <input id="c-mobile" formControlName="mobile" inputmode="tel" maxlength="20" [class.invalid]="bad('mobile')" />
              @if (bad('mobile')) { <span class="error">Enter a 10-digit mobile number.</span> }
            </div>
            <div class="field">
              <label for="c-email">E-mail</label>
              <input id="c-email" type="email" formControlName="email" maxlength="255" [class.invalid]="bad('email')" />
              @if (bad('email')) { <span class="error">Enter a valid e-mail address.</span> }
            </div>
          </div>
          <div class="actions">
            <button class="btn btn--ghost" type="button" (click)="cancel()">Cancel</button>
            <button class="btn btn--primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save customer' }}</button>
          </div>
        </form>
      }

      <article class="app-card">
        @if (customers() === null) {
          <p class="text-caption pad">Loading…</p>
        } @else if (customers()!.length === 0) {
          <div class="empty">
            <ecb-icon name="storefront" />
            <p>You have not registered any customers yet.</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Code</th><th>Mobile</th><th>E-mail</th><th>Status</th><th></th></tr></thead>
              <tbody>
                @for (c of customers(); track c.id) {
                  <tr>
                    <td><a [routerLink]="['/customers', c.id]">{{ c.displayName }}</a></td>
                    <td class="mono">{{ c.customerCode }}</td>
                    <td>{{ c.mobile }}</td>
                    <td>{{ c.email || '—' }}</td>
                    <td><span class="badge" [class.badge--ok]="c.status === 'ACTIVE'">{{ c.status === 'ACTIVE' ? 'Active' : 'Inactive' }}</span></td>
                    <td class="end"><a class="btn btn--ghost" [routerLink]="['/customers', c.id]">Addresses</a></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </article>
    </section>
  `,
  styles: [`
    .box { padding:20px; display:flex; flex-direction:column; gap:14px; }
    h2 { margin:0; }
    .actions { display:flex; justify-content:flex-end; gap:8px; }
    .pad { padding:20px; }
    .empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:40px 20px; text-align:center; color:var(--content-muted); font-size:2rem; }
    .empty p { font-size:1rem; margin:0; }
    .table-wrap { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; font:400 14px var(--font-sans); }
    th, td { padding:12px 16px; text-align:left; border-bottom:1px solid var(--surface-border); }
    th { font:600 12px var(--font-sans); text-transform:uppercase; letter-spacing:.04em; }
    tbody tr:last-child td { border-bottom:0; }
    .end { text-align:right; }
  `]
})
export class Customers implements OnInit {
  private readonly portal = inject(PortalService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly customers = signal<SubCustomer[] | null>(null);
  readonly adding = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.maxLength(100)]],
    companyName: ['', [Validators.maxLength(150)]],
    mobile: ['', [Validators.required, mobileValidator]],
    email: ['', [Validators.email, Validators.maxLength(255)]]
  });

  ngOnInit(): void {
    this.portal.customers().subscribe({ next: (list) => this.customers.set(list), error: () => this.customers.set([]) });
  }

  bad(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.touched || c.dirty);
  }

  cancel(): void {
    this.adding.set(false);
    this.form.reset();
    this.formError.set(null);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);
    this.portal.addCustomer({
      firstName: v.firstName.trim(), lastName: v.lastName.trim() || null, companyName: v.companyName.trim() || null,
      mobile: normaliseMobile(v.mobile), email: v.email.trim() || null, contactPerson: null, expectedVersion: null
    }).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.notify.success('Customer saved. Add their addresses next.');
        this.router.navigate(['/customers', created.id]);
      },
      error: async (e: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(await errorMessage(e, 'The customer could not be saved. Please try again.'));
      }
    });
  }
}
