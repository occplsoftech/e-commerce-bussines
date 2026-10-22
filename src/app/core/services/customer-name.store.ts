import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { PortalService } from './portal.service';

/**
 * The signed-in customer's name for greetings: the contact person, else the company name, from the profile. The login
 * response's display name is often just the e-mail address, so it is used only when it is not one.
 */
@Injectable({ providedIn: 'root' })
export class CustomerNameStore {
  private readonly portal = inject(PortalService);
  private readonly auth = inject(AuthService);
  private readonly fromProfile = signal<string | null>(null);
  private loaded = false;
  /** The customer's own brand logo (data URL) and website, from the profile. */
  readonly logo = signal<string | null>(null);
  readonly website = signal<string | null>(null);

  readonly name = computed(() => {
    const p = this.fromProfile();
    if (p) return p;
    const d = this.auth.displayName();
    return d && !d.includes('@') ? d : '';
  });

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.portal.profile().subscribe({
      next: (p) => {
        this.fromProfile.set(p.contactPerson?.trim() || p.companyName?.trim() || null);
        this.logo.set(p.logoDataUrl ?? null);
        this.website.set(isWebUrl(p.website) ? p.website : null);
      },
      error: () => { this.loaded = false; }
    });
  }
}

/** Only http(s) addresses become links: the value comes from a form, so never render anything else as an href. */
function isWebUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\/\S+$/.test(url);
}
