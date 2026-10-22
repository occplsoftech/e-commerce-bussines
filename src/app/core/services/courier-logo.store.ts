import { Injectable, inject, signal } from '@angular/core';
import { PortalService } from './portal.service';

/** The company's courier logos, loaded once per session. A failed load just leaves the monogram badges in place. */
@Injectable({ providedIn: 'root' })
export class CourierLogoStore {
  private readonly portal = inject(PortalService);
  private loaded = false;
  readonly logos = signal<Record<string, string>>({});

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.portal.courierLogos().subscribe({
      next: (logos) => this.logos.set(logos ?? {}),
      error: () => { this.loaded = false; }
    });
  }
}
