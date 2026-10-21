import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { RuntimeConfigService } from '@core/config/runtime-config.service';

/** Requests a reset link. The answer is the same whether or not the address exists. */
@Component({
  selector: 'ecb-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="card app-card">
      <h1 class="text-h1">Reset your password</h1>
      @if (sent()) {
        <p class="alert alert--ok" role="status">If an account exists for that address, a reset link is on its way. Check your inbox.</p>
      } @else {
        <p class="text-caption lead">We'll email you a link to choose a new password.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (askCompany()) {
            <div class="field">
              <label for="companyCode">Company code <span class="req">*</span></label>
              <input id="companyCode" formControlName="companyCode" maxlength="63" />
            </div>
          }
          <div class="field">
            <label for="email">Email <span class="req">*</span></label>
            <input id="email" type="email" formControlName="email" autocomplete="username" maxlength="255"
                   [class.invalid]="form.controls.email.invalid && form.controls.email.touched" />
          </div>
          <button class="btn btn--primary btn--block" type="submit" [disabled]="loading()">Send reset link</button>
        </form>
      }
      <a class="link" routerLink="/login">← Back to sign in</a>
    </div>
  `,
  styles: [`
    .card { width:420px; max-width:100%; padding:32px; }
    .lead { margin:4px 0 20px; }
    form { display:flex; flex-direction:column; gap:16px; }
    .alert { margin-top:16px; }
    .link { display:inline-block; margin-top:18px; font:600 13px var(--font-sans); text-decoration:none; }
  `]
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly config = inject(RuntimeConfigService).config;

  readonly askCompany = computed(() => !this.config().companyCode);
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly form = this.fb.nonNullable.group({
    companyCode: [this.config().companyCode, Validators.required],
    email: ['', [Validators.required, Validators.email]]
  });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    const v = this.form.getRawValue();
    // Same outcome either way: the server never says whether the address is registered.
    const done = () => { this.loading.set(false); this.sent.set(true); };
    this.auth.forgotPassword(v.companyCode.trim(), v.email.trim()).subscribe({ next: done, error: done });
  }
}
