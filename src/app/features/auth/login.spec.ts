import { HttpErrorResponse } from '@angular/common/http';
import { NotACustomerAccountError } from '@core/auth/auth.service';
import { loginError, safeReturnUrl } from './login';

describe('login helpers', () => {
  it('follows only same-app return URLs', () => {
    expect(safeReturnUrl('/book')).toBe('/book');
    expect(safeReturnUrl('https://evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('//evil.example')).toBe('/dashboard');
    expect(safeReturnUrl(null)).toBe('/dashboard');
  });

  it('turns failures into plain messages', () => {
    expect(loginError(new HttpErrorResponse({ status: 401 }))).toBe('Email or password is incorrect.');
    expect(loginError(new NotACustomerAccountError())).toContain('not a customer account');
    expect(loginError(new HttpErrorResponse({ status: 403, error: { message: 'Email address has not been verified' } })))
      .toBe('Email address has not been verified');
  });
});
