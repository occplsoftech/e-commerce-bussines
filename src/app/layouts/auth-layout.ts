import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@core/services/theme.service';
import { Icon } from '@shared/components/icon';
import { RuntimeConfigService } from '@core/config/runtime-config.service';

/** Split screen: brand panel and the auth form. The brand panel folds away on phones. */
@Component({
  selector: 'ecb-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Icon],
  template: `
    <div class="auth">
      <aside class="auth__brand" aria-hidden="true">
        <div class="auth__logo"><span class="mark">{{ initials() }}</span> {{ config().companyName }}</div>
        <div>
          <h2>Ship smarter, from one place.</h2>
          <p>Compare courier partners, book in a few steps and follow every parcel to the doorstep.</p>
        </div>
        <ul>
          <li><ecb-icon name="compare_arrows" /> Genuine rates from connected couriers</li>
          <li><ecb-icon name="bolt" /> Book once — no duplicate shipments</li>
          <li><ecb-icon name="local_shipping" /> Tracking and labels in your account</li>
        </ul>
      </aside>
      <main class="auth__main">
        <button class="theme" type="button" (click)="theme.toggle()"
                [attr.aria-label]="theme.mode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
          <ecb-icon [name]="theme.mode() === 'dark' ? 'light_mode' : 'dark_mode'" />
        </button>
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .auth { min-height:100vh; display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap:16px; padding:16px; }
    .auth__brand { display:flex; flex-direction:column; justify-content:space-between; gap:32px; padding:48px; border-radius:28px;
      color:#fff; background:var(--occpl-gradient-brand); box-shadow:var(--occpl-shadow-md); }
    .auth__logo { display:flex; align-items:center; gap:12px; font:700 1.1rem var(--font-sans); }
    .mark { display:grid; place-items:center; width:2.4rem; height:2.4rem; border-radius:50%; background:#fff;
      color:var(--occpl-color-primary-strong); font:800 .8rem var(--font-sans); }
    h2 { font:700 2.25rem/1.15 var(--font-display); margin:0 0 12px; letter-spacing:-.02em; }
    p { font:400 1.05rem/1.6 var(--font-sans); opacity:.88; margin:0; max-width:440px; }
    ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:14px; font:500 1rem var(--font-sans); }
    li { display:flex; align-items:center; gap:12px; }
    li ecb-icon { padding:8px; box-sizing:content-box; border-radius:12px; background:rgb(255 255 255 / 16%); }
    .auth__main { position:relative; display:grid; place-items:center; padding:32px 16px; }
    .theme { position:absolute; top:8px; right:8px; display:grid; place-items:center; width:2.5rem; height:2.5rem; border-radius:12px;
      border:1px solid var(--surface-border); background:var(--occpl-color-surface-glass); color:var(--content-fg); cursor:pointer; font-size:1.1rem; }
    .theme:hover { background:var(--occpl-color-info-surface); }
    @media (max-width: 56rem) { .auth { grid-template-columns: minmax(0,1fr); } .auth__brand { display:none; } }
  `]
})
export class AuthLayout {
  protected readonly config = inject(RuntimeConfigService).config;
  protected readonly theme = inject(ThemeService);
  protected readonly initials = computed(() => this.config().companyName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || 'OC');
}
