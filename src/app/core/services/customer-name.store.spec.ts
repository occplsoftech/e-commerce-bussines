import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { CustomerNameStore } from './customer-name.store';
import { PortalService } from './portal.service';

describe('CustomerNameStore', () => {
  function make(displayName: string, profile: object) {
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { displayName: signal(displayName) } },
      { provide: PortalService, useValue: { profile: () => of(profile) } }
    ] });
    return TestBed.inject(CustomerNameStore);
  }

  it('never greets with an e-mail address', () => {
    expect(make('it.shubham.rk@gmail.com', {}).name()).toBe('');
  });

  it('uses the contact person from the profile, else the company name', () => {
    const a = make('x@y.test', { contactPerson: ' Shubham ', companyName: 'Acme' });
    a.load();
    expect(a.name()).toBe('Shubham');
    TestBed.resetTestingModule();
    const b = make('x@y.test', { contactPerson: null, companyName: 'Acme' });
    b.load();
    expect(b.name()).toBe('Acme');
  });

  it('keeps a real display name until the profile arrives', () => {
    expect(make('Shubham K', {}).name()).toBe('Shubham K');
  });
});
