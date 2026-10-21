import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, switchMap, tap, throwError } from 'rxjs';
import { ApiService } from '../services/api.service';
import { TokenService } from './token.service';
import { API } from '../config/api-endpoints';
import { CUSTOMER_ROLE, CurrentUser, LoginRequest, LoginResponse } from '../models/auth.model';
import { decodeJwt } from '../utils/jwt.util';

/** Thrown when a valid staff account tries to use the customer portal. */
export class NotACustomerAccountError extends Error {
  constructor() { super('This is not a customer account. Staff sign in to the courier console instead.'); }
}

/**
 * Session state as signals (same approach as courier-web). Only CUSTOMER accounts are kept: the
 * server would refuse every portal call for anything else, so a staff login is signed out at once.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenService);

  private readonly _user = signal<CurrentUser | null>(this.hydrate());
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null && this.tokens.hasValidAccess());
  readonly displayName = computed(() => this._user()?.displayName ?? '');
  readonly companyName = computed(() => this._user()?.companyName ?? null);

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse>(API.auth.login, request).pipe(
      switchMap((res) => {
        const roles = decodeJwt(res.accessToken)?.roles ?? res.roles ?? [];
        if (!roles.includes(CUSTOMER_ROLE)) {
          // End the server session we just opened, then refuse.
          return this.api.post<void>(API.auth.logout, { refreshToken: res.refreshToken, allDevices: false }).pipe(
            catchError(() => of(null)),
            switchMap(() => throwError(() => new NotACustomerAccountError()))
          );
        }
        this.applySession(res);
        return of(res);
      })
    );
  }

  forgotPassword(companyCode: string, email: string): Observable<void> {
    return this.api.post<void>(API.auth.forgotPassword, { companyCode, email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.api.post<void>(API.auth.resetPassword, { token, newPassword });
  }

  verifyEmail(token: string): Observable<void> {
    return this.api.post<void>(API.auth.verifyEmail, { token });
  }

  logout(): Observable<void> {
    const refreshToken = this.tokens.refreshToken;
    return this.api.post<void>(API.auth.logout, { refreshToken, allDevices: false })
      .pipe(tap({ next: () => this.clearSession(), error: () => this.clearSession() }));
  }

  clearSession(): void {
    this.tokens.clear();
    this._user.set(null);
  }

  private applySession(res: LoginResponse): void {
    this.tokens.setTokens(res.accessToken, res.refreshToken);
    this.tokens.setDisplayName(res.displayName ?? res.email);
    const claims = decodeJwt(res.accessToken);
    this._user.set({
      userId: res.userId, companyId: res.companyId, email: res.email,
      displayName: res.displayName ?? res.email, roles: claims?.roles ?? res.roles,
      companyName: res.companyName ?? claims?.cnm ?? null
    });
  }

  /** Rebuilds the session from the stored access token on a page reload. */
  private hydrate(): CurrentUser | null {
    const token = this.tokens.accessToken;
    if (!token || !this.tokens.hasValidAccess()) return null;
    const c = decodeJwt(token);
    if (!c || !(c.roles ?? []).includes(CUSTOMER_ROLE)) return null;
    return {
      userId: c.sub, companyId: c.cid ?? null, email: c.email,
      displayName: this.tokens.displayName ?? c.email, roles: c.roles, companyName: c.cnm ?? null
    };
  }
}
