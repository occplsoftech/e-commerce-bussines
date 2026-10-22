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
      next: (p) => this.fromProfile.set(p.contactPerson?.trim() || p.companyName?.trim() || null),
      error: () => { this.loaded = false; }
    });
  }
}
