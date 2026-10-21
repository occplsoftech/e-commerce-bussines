/** Mirrors the backend auth DTOs (courier-service, module auth). */
export interface LoginRequest {
  email: string;
  password: string;
  companyCode: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
  userId: string;
  companyId: string | null;
  email: string;
  displayName: string;
  roles: string[];
  companyName?: string | null;
  companyLogo?: string | null;
}

/** Decoded access-token claims — read locally for display and expiry only, never trusted for authorization. */
export interface JwtClaims {
  sub: string;
  cid?: string;
  email: string;
  roles: string[];
  cnm?: string;
  exp: number;
  iat: number;
  jti: string;
}

export interface CurrentUser {
  userId: string;
  companyId: string | null;
  email: string;
  displayName: string;
  roles: string[];
  companyName: string | null;
}

/** The only role that may use this portal. */
export const CUSTOMER_ROLE = 'CUSTOMER';
