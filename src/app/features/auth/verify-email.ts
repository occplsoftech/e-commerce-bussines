import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '@core/auth/auth.service';

/** The activation link from the welcome email (`?token=`). Activates the account, then offers sign-in. */
@Component({
  selector: 'ecb-verify-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="card app-card">
      <h1 class="text-h1">Activate your account</h1>
      @switch (state()) {
        @case ('working') { <p class="text-caption">Activating…</p> }
        @case ('done') {
          <p class="alert alert--ok" role="status">Your account is active. Sign in with the temporary password you were given, then change it under Profile.</p>
          <a class="btn btn--primary btn--block" routerLink="/login">Sign in</a>
        }
        @case ('failed') {
          <p class="alert alert--error" role="alert">{{ error() }}</p>
          <a class="link" routerLink="/login">Go to sign in</a>
        }
      }
    </div>
  `,
  styles: [`
    .card { width:420px; max-width:100%; padding:32px; display:flex; flex-direction:column; gap:16px; }
    .link { font:600 13px var(--font-sans); text-decoration:none; }
  `]
})
export class VerifyEmail implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  readonly state = signal<'working' | 'done' | 'failed'>('working');
  readonly error = signal('This activation link is invalid or has expired. Ask your account manager for a new one.');

  ngOnInit(): void {
    if (!this.token) { this.state.set('failed'); return; }
    this.auth.verifyEmail(this.token).subscribe({
      next: () => this.state.set('done'),
      error: (e: HttpErrorResponse) => {
        if (e.error?.message) this.error.set(e.error.message);
        this.state.set('failed');
      }
    });
  }
}
