import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Per-deployment settings, read from /assets/config.json at start-up (written by the container). */
export interface RuntimeConfig {
  /** Courier company whose customers sign in here; blank shows a Company code field on the login page. */
  companyCode: string;
  companyName: string;
  supportEmail: string;
}

const DEFAULTS: RuntimeConfig = { companyCode: '', companyName: 'OCCPL SOFTECH', supportEmail: '' };

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  // HttpBackend, not HttpClient: the config must load without the auth/error interceptors.
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly _config = signal<RuntimeConfig>(DEFAULTS);
  readonly config = this._config.asReadonly();

  async load(): Promise<void> {
    try {
      const loaded = await firstValueFrom(this.http.get<Partial<RuntimeConfig>>('assets/config.json'));
      this._config.set({ ...DEFAULTS, ...loaded });
    } catch {
      this._config.set(DEFAULTS);
    }
  }
}
