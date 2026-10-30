import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { PortalService } from '@core/services/portal.service';
import { PortalProfile } from '@core/models/portal.model';
import { AddressBook } from './address-book';

/** The customer's company details (read-only, held by the courier) and their own address book. */
@Component({
  selector: 'ecb-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <div class="page__head" data-icon="storefront">
        <div>
          <h1 class="text-display">Profile</h1>
          <p class="text-caption">To change your company details, contact your account manager. You can manage your saved addresses below.</p>
        </div>
      </div>
      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
      @if (profile(); as p) {
        <article class="app-card box">
          <h2 class="text-h2">{{ p.companyName || p.contactPerson }}</h2>
          <dl class="grid-3">
            <div><dt>Customer code</dt><dd>{{ p.customerCode }}</dd></div>
            <div><dt>Contact person</dt><dd>{{ p.contactPerson || '—' }}</dd></div>
            <div><dt>Mobile</dt><dd>{{ p.mobile || '—' }}</dd></div>
            <div><dt>Email</dt><dd>{{ p.email || '—' }}</dd></div>
            <div><dt>GSTIN</dt><dd>{{ p.gstNumber || '—' }}</dd></div>
            <div><dt>PAN</dt><dd>{{ p.panNumber || '—' }}</dd></div>
          </dl>
          <h3 class="text-h3">Billing address</h3>
          <p class="addr">{{ billing(p) || '—' }}</p>
        </article>
        <ecb-address-book />
      } @else if (!error()) {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  imports: [AddressBook],
  styles: [`
    .box { padding:20px; display:flex; flex-direction:column; gap:12px; }
    h2, h3 { margin:0; }
    dl { margin:0; }
    dt { font:600 12px var(--font-sans); color:var(--content-muted); text-transform:uppercase; letter-spacing:.04em; }
    dd { margin:4px 0 0; font:500 14px var(--font-sans); overflow-wrap:anywhere; }
    .addr { margin:0; font:400 14px/1.5 var(--font-sans); }
  `]
})
export class Profile implements OnInit {
  private readonly portal = inject(PortalService);
  readonly profile = signal<PortalProfile | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.portal.profile().subscribe({
      next: (p) => this.profile.set(p),
      error: () => this.error.set('Could not load your profile.')
    });
  }

  billing(p: PortalProfile): string {
    const b = p.billingAddress;
    return [b.line1, b.line2, b.city, b.state, b.pincode].filter((x) => !!x).join(', ');
  }
}
