import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RuntimeConfigService } from '@core/config/runtime-config.service';

/** Split screen: brand panel and the auth form. The brand panel folds away on phones. */
@Component({
  selector: 'ecb-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <div class="auth">
      <aside class="auth__brand" aria-hidden="true">
        <div class="auth__logo"><span class="mark">OC</span> {{ config().companyName }}</div>
        <div>
          <h2>Ship smarter, from one place.</h2>
          <p>Compare courier partners, book in a few steps and follow every parcel to the doorstep.</p>
        </div>
        <ul>
          <li><span class="material-icons">compare_arrows</span> Genuine rates from connected couriers</li>
          <li><span class="material-icons">bolt</span> Book once — no duplicate shipments</li>
          <li><span class="material-icons">local_shipping</span> Tracking and labels in your account</li>
        </ul>
      </aside>
      <main class="auth__main"><router-outlet /></main>
    </div>
  `,
  styles: [`
    .auth { min-height:100vh; display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
    .auth__brand { display:flex; flex-direction:column; justify-content:space-between; gap:32px; padding:48px;
      color:#fff; background: radial-gradient(1200px 600px at 0% 0%, var(--brand-500), transparent),
      linear-gradient(150deg, var(--brand-800), var(--brand-900) 55%, var(--accent-600)); }
    .auth__logo { display:flex; align-items:center; gap:10px; font:700 18px var(--font-sans); }
    .mark { display:grid; place-items:center; width:36px; height:36px; border-radius:50%; background:#fff;
      color:var(--brand-700); font:800 14px var(--font-sans); }
    h2 { font:700 32px/1.2 var(--font-display); margin:0 0 12px; letter-spacing:-.02em; }
    p { font:400 15px/1.6 var(--font-sans); opacity:.85; margin:0; max-width:440px; }
    ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px; font:500 14px var(--font-sans); }
    li { display:flex; align-items:center; gap:10px; opacity:.92; }
    .auth__main { display:grid; place-items:center; padding:32px 16px; }
    @media (max-width: 900px) { .auth { grid-template-columns: minmax(0,1fr); } .auth__brand { display:none; } }
  `]
})
export class AuthLayout {
  protected readonly config = inject(RuntimeConfigService).config;
}
