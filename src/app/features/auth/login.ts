import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService, NotACustomerAccountError } from '@core/auth/auth.service';
import { RuntimeConfigService } from '@core/config/runtime-config.service';

/** Customer sign-in. The company comes from the deployment's config; the field shows only when it is not set. */
@Component({
  selector: 'ecb-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="card app-card">
      <h1 class="text-h1">Sign in</h1>
      <p class="text-caption lead">Use the email and password from your {{ config().companyName }} account.</p>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (askCompany()) {
          <div class="field">
            <label for="companyCode">Company code <span class="req">*</span></label>
            <input id="companyCode" formControlName="companyCode" autocomplete="organization" maxlength="63"
                   [class.invalid]="invalid('companyCode')" />
            @if (invalid('companyCode')) { <span class="error">Enter the company code you were given.</span> }
          </div>
        }
        <div class="field">
          <label for="email">Email <span class="req">*</span></label>
          <input id="email" type="email" formControlName="email" autocomplete="username" maxlength="255"
                 [class.invalid]="invalid('email')" />
          @if (invalid('email')) { <span class="error">Enter a valid email address.</span> }
        </div>
        <div class="field">
          <label for="password">Password <span class="req">*</span></label>
          <div class="pw">
            <input id="password" [type]="showPassword() ? 'text' : 'password'" formControlName="password"
                   autocomplete="current-password" maxlength="128" [class.invalid]="invalid('password')" />
            <button type="button" class="pw__toggle" (click)="showPassword.set(!showPassword())"
                    [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
              <span class="material-icons">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
          @if (invalid('password')) { <span class="error">Enter your password.</span> }
        </div>
        <label class="remember"><input type="checkbox" formControlName="rememberMe" /> Keep me signed in</label>
        @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
        <button class="btn btn--primary btn--block" type="submit" [disabled]="loading()">
          {{ loading() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <a class="link" routerLink="/forgot-password">Forgot password?</a>
      @if (config().supportEmail) {
        <p class="text-caption help">Need access? Write to <a [href]="'mailto:' + config().supportEmail">{{ config().supportEmail }}</a>.</p>
      }
    </div>
  `,
  styles: [`
    .card { width:420px; max-width:100%; padding:32px; }
    .lead { margin:4px 0 24px; }
    form { display:flex; flex-direction:column; gap:16px; }
    .pw { position:relative; }
    .pw input { padding-right:44px; }
    .pw__toggle { position:absolute; right:6px; top:50%; transform:translateY(-50%); background:none; border:0; cursor:pointer; color:var(--content-muted); }
    .remember { display:flex; align-items:center; gap:8px; font:500 13px var(--font-sans); color:var(--content-muted); }
    .link { display:inline-block; margin-top:18px; font:600 13px var(--font-sans); text-decoration:none; }
    .help { margin-top:16px; }
  `]
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly config = inject(RuntimeConfigService).config;

  readonly askCompany = computed(() => !this.config().companyCode);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    companyCode: [this.config().companyCode, [Validators.required, Validators.maxLength(63)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
    rememberMe: [false]
  });

  invalid(name: 'companyCode' | 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    this.auth.login({ companyCode: v.companyCode.trim(), email: v.email.trim(), password: v.password, rememberMe: v.rememberMe })
      .subscribe({
        next: () => this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'))),
        error: (e: unknown) => {
          this.loading.set(false);
          this.error.set(loginError(e));
        }
      });
  }
}

/** Only same-app paths: never follow an absolute or protocol-relative return URL. */
export function safeReturnUrl(url: string | null): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard';
}

export function loginError(e: unknown): string {
  if (e instanceof NotACustomerAccountError) return e.message;
  if (e instanceof HttpErrorResponse) {
    if (e.status === 401) return 'Email or password is incorrect.';
    if (e.status === 423) return 'Too many attempts. The account is locked for a while — try again later.';
    if (e.status === 0) return 'Cannot reach the server. Check your connection.';
    return e.error?.message ?? 'Sign-in failed. Please try again.';
  }
  return 'Sign-in failed. Please try again.';
}
