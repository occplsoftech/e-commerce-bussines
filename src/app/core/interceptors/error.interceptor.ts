import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { API } from '../config/api-endpoints';
import { LoginResponse } from '../models/auth.model';

/**
 * On a 401 with a refresh token: rotate once and replay; a failed refresh signs out. Other errors
 * become a toast, except 400/422, which forms show next to their fields.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const tokens = inject(TokenService);
  const api = inject(ApiService);
  const notify = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthCall = req.url.endsWith(API.auth.login) || req.url.endsWith(API.auth.refresh)
        || req.url.endsWith(API.auth.logout);

      if (err.status === 401 && !isAuthCall && tokens.refreshToken) {
        return api.post<LoginResponse>(API.auth.refresh, { refreshToken: tokens.refreshToken }).pipe(
          switchMap((res) => {
            tokens.setTokens(res.accessToken, res.refreshToken);
            return next(req.clone({ headers: req.headers.set('Authorization', `Bearer ${res.accessToken}`) }));
          }),
          catchError(() => {
            auth.clearSession();
            router.navigate(['/login']);
            return EMPTY;
          })
        );
      }

      const message = err.error?.message as string | undefined;
      if (err.status === 401 && !isAuthCall) {
        auth.clearSession();
        router.navigate(['/login']);
      } else if (err.status === 403) {
        notify.error(message ?? 'This action is not available for your account.');
      } else if (err.status === 0) {
        notify.error('Cannot reach the server. Check your connection and try again.');
      } else if (err.status >= 500) {
        notify.error(message ?? 'Something went wrong. Please try again.');
      } else if (err.status !== 400 && err.status !== 422 && !isAuthCall) {
        notify.error(message ?? `Request failed (${err.status}).`);
      }
      return throwError(() => err);
    })
  );
};
