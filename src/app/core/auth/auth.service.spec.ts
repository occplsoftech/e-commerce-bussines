import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, NotACustomerAccountError } from './auth.service';
import { TokenService } from './token.service';

function token(roles: string[]): string {
  const payload = btoa(JSON.stringify({ sub: 'u1', cid: 'c1', email: 'a@b.test', roles, exp: Math.floor(Date.now() / 1000) + 600, iat: 0, jti: 'j' }));
  return `x.${payload.replace(/=+$/, '')}.y`;
}

function loginResponse(roles: string[]) {
  return { data: { accessToken: token(roles), refreshToken: 'r1', expiresIn: 600, sessionId: 's', userId: 'u1',
    companyId: 'c1', email: 'a@b.test', displayName: 'Asha', roles } };
}

describe('AuthService', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let tokens: TokenService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    tokens = TestBed.inject(TokenService);
  });

  afterEach(() => http.verify());

  it('keeps a customer session', () => {
    auth.login({ companyCode: 'OCCPL', email: 'a@b.test', password: 'pw' }).subscribe();
    const req = http.expectOne('/api/v1/auth/login');
    expect(req.request.body.companyCode).toBe('OCCPL');
    req.flush(loginResponse(['CUSTOMER']));

    expect(auth.isAuthenticated()).toBe(true);
    expect(tokens.refreshToken).toBe('r1');
  });

  it('signs a staff account straight out and refuses it', () => {
    let error: unknown;
    auth.login({ companyCode: 'OCCPL', email: 'a@b.test', password: 'pw' }).subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/v1/auth/login').flush(loginResponse(['COMPANY_ADMIN']));
    const logout = http.expectOne('/api/v1/auth/logout');
    expect(logout.request.body.refreshToken).toBe('r1');
    logout.flush({ data: null });

    expect(error).toBeInstanceOf(NotACustomerAccountError);
    expect(auth.isAuthenticated()).toBe(false);
    expect(tokens.accessToken).toBeNull();
  });

  it('asks for a reset by company code', () => {
    auth.forgotPassword('OCCPL', 'a@b.test').subscribe();
    expect(http.expectOne('/api/v1/auth/forgot-password').request.body).toEqual({ companyCode: 'OCCPL', email: 'a@b.test' });
  });
});
