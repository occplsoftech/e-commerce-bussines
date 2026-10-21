import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '@core/auth/auth.service';
import { NotificationService } from '@core/services/notification.service';

/** Completes a reset with the token from the emailed link (`?token=`). */
@Component({
  selector: 'ecb-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="card app-card">
      <h1 class="text-h1">Choose a new password</h1>
      @if (!token) {
        <p class="alert alert--error">This link is invalid or has expired.</p>
        <a class="link" routerLink="/forgot-password">Request a new link</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="pw">New password <span class="req">*</span></label>
            <input id="pw" type="password" formControlName="newPassword" autocomplete="new-password" maxlength="72" />
            <span class="hint">At least 10 characters, with upper and lower case, a number and a symbol.</span>
          </div>
          <div class="field">
            <label for="pw2">Confirm password <span class="req">*</span></label>
            <input id="pw2" type="password" formControlName="confirm" autocomplete="new-password" maxlength="72" />
          </div>
          @if (form.hasError('mismatch') && form.controls.confirm.touched) { <p class="alert alert--error">Passwords do not match.</p> }
          @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
          <button class="btn btn--primary btn--block" type="submit" [disabled]="loading()">Save password</button>
        </form>
      }
    </div>
  `,
  styles: [`
    .card { width:420px; max-width:100%; padding:32px; }
    form { display:flex; flex-direction:column; gap:16px; margin-top:16px; }
    .link { display:inline-block; margin-top:18px; font:600 13px var(--font-sans); text-decoration:none; }
  `]
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(72)]],
    confirm: ['', Validators.required]
  }, { validators: [matchPasswords] });

  submit(): void {
    if (this.form.invalid || !this.token) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set(null);
    this.auth.resetPassword(this.token, this.form.getRawValue().newPassword).subscribe({
      next: () => { this.notify.success('Password saved. Sign in with your new password.'); this.router.navigateByUrl('/login'); },
      error: (e: HttpErrorResponse) => { this.loading.set(false); this.error.set(e.error?.message ?? 'The link may have expired. Request a new one.'); }
    });
  }
}

export function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const a = group.get('newPassword')?.value;
  const b = group.get('confirm')?.value;
  return a && b && a !== b ? { mismatch: true } : null;
}
