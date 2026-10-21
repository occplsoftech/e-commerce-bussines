import { Injectable } from '@angular/core';
import { storage } from '../utils/storage.util';
import { isExpired } from '../utils/jwt.util';
import { environment } from '@env/environment';

// Own key prefix: this app may share a browser (and an origin, in development) with courier-web.
const ACCESS = 'ecb.access';
const REFRESH = 'ecb.refresh';
const DISPLAY_NAME = 'ecb.dname';

/** Token store. The only thing that knows where tokens live. */
@Injectable({ providedIn: 'root' })
export class TokenService {
  get accessToken(): string | null { return storage.get(ACCESS); }
  get refreshToken(): string | null { return storage.get(REFRESH); }
  get displayName(): string | null { return storage.get(DISPLAY_NAME); }

  setTokens(access: string, refresh: string): void {
    storage.set(ACCESS, access);
    storage.set(REFRESH, refresh);
  }
  setDisplayName(name: string | null): void {
    name ? storage.set(DISPLAY_NAME, name) : storage.remove(DISPLAY_NAME);
  }
  clear(): void {
    storage.remove(ACCESS);
    storage.remove(REFRESH);
    storage.remove(DISPLAY_NAME);
  }
  hasValidAccess(): boolean {
    const t = this.accessToken;
    return !!t && !isExpired(t, environment.accessTokenSkewSeconds);
  }
}
