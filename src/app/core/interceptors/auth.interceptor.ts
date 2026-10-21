import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenService } from '../auth/token.service';
import { API } from '../config/api-endpoints';

/** Attaches the bearer token; login and refresh go out unauthenticated. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenService);
  const isAuthCall = req.url.endsWith(API.auth.login) || req.url.endsWith(API.auth.refresh);
  const access = tokens.accessToken;
  if (!access || isAuthCall) return next(req);
  return next(req.clone({ headers: req.headers.set('Authorization', `Bearer ${access}`) }));
};
