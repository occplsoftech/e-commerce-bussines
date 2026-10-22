import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { RuntimeConfigService } from '@core/config/runtime-config.service';
import { CourierLogoStore } from '@core/services/courier-logo.store';
import { ThemeService } from '@core/services/theme.service';
import { Icon } from '@shared/components/icon';

interface NavItem { path: string; label: string; icon: string; }

/**
 * Signed-in shell, same layout as the OCCPL platform portal: a floating crimson sidebar (collapsible to
 * an icon rail, a drawer on phones) beside a glass header and the page.
 */
@Component({
  selector: 'ecb-portal-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  template: `
    <div class="shell" [class.collapsed]="collapsed()" [class.drawer-open]="drawer()">
      <aside class="side" id="main-nav" aria-label="Main">
        <a class="brand" routerLink="/dashboard" (click)="drawer.set(false)">
          <span class="mark">{{ initials() }}</span>
          <span class="name">{{ config().companyName }}</span>
        </a>
        <p class="heading">Shipping</p>
        <nav>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" (click)="drawer.set(false)" [attr.title]="item.label">
              <ecb-icon [name]="item.icon" /><span class="label">{{ item.label }}</span>
            </a>
          }
        </nav>
      </aside>
      <button class="scrim" type="button" tabindex="-1" aria-label="Close menu" (click)="drawer.set(false)"></button>

      <div class="main">
        <header class="top">
          <button class="icon-btn" type="button" (click)="toggleNav()" [attr.aria-expanded]="drawer() || !collapsed()"
                  aria-controls="main-nav" aria-label="Toggle navigation">
            <ecb-icon [name]="drawer() ? 'close' : 'menu'" />
          </button>
          <span class="spacer"></span>
          <button class="icon-btn" type="button" (click)="theme.toggle()"
                  [attr.aria-label]="theme.mode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
            <ecb-icon [name]="theme.mode() === 'dark' ? 'light_mode' : 'dark_mode'" />
          </button>
          <span class="who"><span class="avatar">{{ userInitials() }}</span><span class="who__name">{{ auth.displayName() }}</span></span>
          <button class="btn btn--ghost signout" type="button" (click)="signOut()"><ecb-icon name="logout" /><span>Sign out</span></button>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; }
    .shell { --nav-w: var(--occpl-nav-width); display:flex; gap:16px; padding:16px; min-height:100vh; }
    .shell.collapsed { --nav-w: 5.25rem; }
    .side { position:sticky; top:16px; align-self:flex-start; width:var(--nav-w); flex:none; height:calc(100vh - 32px);
      display:flex; flex-direction:column; gap:8px; padding:20px 14px; border-radius:28px; overflow:hidden auto;
      background:var(--occpl-gradient-brand); color:#fff; box-shadow:var(--occpl-shadow-md); transition:width .2s ease; z-index:30; }
    .brand { display:flex; align-items:center; gap:12px; padding:4px 6px 16px; color:#fff; text-decoration:none; font:700 1.05rem var(--font-sans); }
    .mark { display:grid; place-items:center; flex:none; width:2.4rem; height:2.4rem; border-radius:50%; background:#fff;
      color:var(--occpl-color-primary-strong); font:800 .8rem var(--font-sans); letter-spacing:.02em; }
    .name, .label { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .heading { margin:8px 10px 2px; font:600 .72rem var(--font-sans); letter-spacing:.12em; text-transform:uppercase; opacity:.7; }
    nav { display:flex; flex-direction:column; gap:4px; }
    nav a { display:flex; align-items:center; gap:12px; min-height:2.75rem; padding:0 14px; border-radius:999px;
      color:rgb(255 255 255 / 88%); text-decoration:none; font:600 .95rem var(--font-sans); }
    nav a:hover { background:rgb(255 255 255 / 14%); color:#fff; }
    nav a.active { background:#fff; color:var(--occpl-color-primary-strong); box-shadow:0 4px 14px rgb(0 0 0 / 18%); }
    .collapsed .name, .collapsed .label, .collapsed .heading { display:none; }
    .collapsed nav a { justify-content:center; padding:0; }
    .collapsed .brand { justify-content:center; padding-inline:0; }

    .main { flex:1; min-width:0; display:flex; flex-direction:column; gap:16px; }
    .top { position:sticky; top:16px; z-index:20; display:flex; align-items:center; gap:12px; min-height:var(--occpl-header-height);
      padding:0 16px 0 12px; border-radius:22px; background:var(--occpl-color-surface-glass); backdrop-filter:blur(14px);
      border:1px solid var(--surface-border); border-bottom:3px solid var(--occpl-color-primary); box-shadow:var(--occpl-shadow-sm); }
    .spacer { flex:1; }
    .icon-btn { display:grid; place-items:center; width:2.5rem; height:2.5rem; border:1px solid transparent; border-radius:12px;
      background:transparent; color:var(--content-fg); cursor:pointer; font-size:1.1rem; }
    .icon-btn:hover { background:var(--occpl-color-info-surface); }
    .who { display:flex; align-items:center; gap:10px; font:600 .9rem var(--font-sans); }
    .avatar { display:grid; place-items:center; width:2.25rem; height:2.25rem; border-radius:999px; background:var(--occpl-gradient-button);
      color:#fff; font:700 .8rem var(--font-sans); }
    .signout { min-height:2.25rem; padding:0 16px; }
    .content { width:100%; max-width:var(--occpl-content-max-width); margin:0 auto; padding:4px 4px 24px; }
    .scrim { display:none; }

    @media (max-width: 56rem) {
      .shell { display:block; padding:12px; }
      .side { position:fixed; inset:12px auto 12px 12px; height:auto; width:min(18rem, 84vw); transform:translateX(-120%);
        transition:transform .22s ease; }
      .shell.drawer-open .side { transform:none; }
      .shell.drawer-open .scrim { display:block; position:fixed; inset:0; z-index:25; border:0; background:rgb(20 20 40 / 45%); }
      .collapsed .name, .collapsed .label, .collapsed .heading { display:inline; }
      .collapsed nav a { justify-content:flex-start; padding:0 14px; }
      .shell.collapsed { --nav-w: var(--occpl-nav-width); }
      .top { top:12px; margin-bottom:12px; }
      .who__name, .signout span { display:none; }
      .signout { padding:0 12px; }
    }
  `]
})
export class PortalLayout {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly config = inject(RuntimeConfigService).config;
  private readonly router = inject(Router);
  private readonly logos = inject(CourierLogoStore);
  protected readonly collapsed = signal(false);
  protected readonly drawer = signal(false);
  protected readonly initials = computed(() => initialsOf(this.config().companyName, 2) || 'OC');
  protected readonly userInitials = computed(() => initialsOf(this.auth.displayName() ?? '', 2) || '·');
  protected readonly nav: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { path: '/book', label: 'Book shipment', icon: 'add_box' },
    { path: '/shipments', label: 'Shipments', icon: 'local_shipping' },
    { path: '/profile', label: 'Profile', icon: 'storefront' }
  ];

  constructor() {
    this.logos.load();
  }

  /** One button: on a phone it opens the drawer, on a desktop it collapses the sidebar to an icon rail. */
  protected toggleNav(): void {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 56rem)').matches) {
      this.drawer.update(v => !v);
    } else {
      this.collapsed.update(v => !v);
    }
  }

  protected signOut(): void {
    this.auth.logout().subscribe({ complete: () => this.router.navigateByUrl('/login'), error: () => this.router.navigateByUrl('/login') });
  }
}

function initialsOf(text: string, max: number): string {
  return text.split(/[\s@._-]+/).filter(Boolean).slice(0, max).map(w => w[0]!.toUpperCase()).join('');
}
