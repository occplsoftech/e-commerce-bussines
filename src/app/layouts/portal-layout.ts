import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { RuntimeConfigService } from '@core/config/runtime-config.service';

interface NavItem { path: string; label: string; icon: string; }

/** Signed-in shell: top bar with navigation (a drawer on phones), then the page. */
@Component({
  selector: 'ecb-portal-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="bar">
      <a class="bar__brand" routerLink="/dashboard"><span class="mark">OC</span><span class="name">{{ config().companyName }}</span></a>
      <button class="bar__menu" type="button" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-controls="main-nav">
        <span class="material-icons">{{ open() ? 'close' : 'menu' }}</span><span class="sr-only">Menu</span>
      </button>
      <nav id="main-nav" class="bar__nav" [class.open]="open()" aria-label="Main">
        @for (item of nav; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" (click)="open.set(false)">
            <span class="material-icons">{{ item.icon }}</span>{{ item.label }}
          </a>
        }
        <div class="bar__user">
          <span class="who">{{ auth.displayName() }}</span>
          <button class="btn btn--ghost" type="button" (click)="signOut()">Sign out</button>
        </div>
      </nav>
    </header>
    <main class="content"><router-outlet /></main>
  `,
  styles: [`
    .bar { position:sticky; top:0; z-index:20; height:var(--header-h); display:flex; align-items:center; gap:16px;
      padding:0 24px; background:var(--surface); border-bottom:1px solid var(--surface-border); }
    .bar__brand { display:flex; align-items:center; gap:10px; text-decoration:none; color:var(--content-fg); font:700 16px var(--font-sans); white-space:nowrap; }
    .mark { display:grid; place-items:center; width:32px; height:32px; border-radius:50%;
      background:linear-gradient(135deg,var(--brand-600),var(--accent-600)); color:#fff; font:800 12px var(--font-sans); }
    .bar__menu { display:none; margin-left:auto; background:none; border:0; cursor:pointer; color:var(--content-fg); }
    .bar__nav { display:flex; align-items:center; gap:4px; flex:1; }
    .bar__nav a { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:var(--r-field);
      font:600 14px var(--font-sans); color:var(--content-muted); text-decoration:none; }
    .bar__nav a .material-icons { font-size:18px; }
    .bar__nav a:hover { background:var(--surface-muted); color:var(--content-fg); }
    .bar__nav a.active { background:var(--brand-50); color:var(--brand-700); }
    .bar__user { margin-left:auto; display:flex; align-items:center; gap:12px; }
    .who { font:500 13px var(--font-sans); color:var(--content-muted); }
    .content { padding:24px; }
    @media (max-width: 820px) {
      .bar { padding:0 16px; }
      .bar__menu { display:block; }
      .bar__nav { display:none; position:absolute; top:var(--header-h); left:0; right:0; flex-direction:column; align-items:stretch;
        padding:12px 16px 16px; background:var(--surface); border-bottom:1px solid var(--surface-border); box-shadow:var(--shadow-hover); }
      .bar__nav.open { display:flex; }
      .bar__user { margin:8px 0 0; justify-content:space-between; }
      .content { padding:16px; }
    }
  `]
})
export class PortalLayout {
  protected readonly auth = inject(AuthService);
  protected readonly config = inject(RuntimeConfigService).config;
  private readonly router = inject(Router);
  protected readonly open = signal(false);
  protected readonly nav: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { path: '/book', label: 'Book shipment', icon: 'add_box' },
    { path: '/shipments', label: 'Shipments', icon: 'local_shipping' },
    { path: '/profile', label: 'Profile', icon: 'storefront' }
  ];

  signOut(): void {
    this.auth.logout().subscribe({ complete: () => this.router.navigateByUrl('/login'), error: () => this.router.navigateByUrl('/login') });
  }
}
