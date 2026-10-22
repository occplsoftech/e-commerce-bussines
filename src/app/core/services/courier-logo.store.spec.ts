import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { CourierLogoStore } from './courier-logo.store';

describe('CourierLogoStore', () => {
  const url = `${environment.apiBaseUrl}/customer-portal/courier-logos`;
  let http: HttpTestingController;
  let store: CourierLogoStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(CourierLogoStore);
  });

  it('loads the company logos once', () => {
    store.load();
    store.load();
    http.expectOne(url).flush({ success: true, data: { DELHIVERY: 'data:image/png;base64,AA==' } });
    expect(store.logos()['DELHIVERY']).toContain('data:image/png');
    store.load();
    http.expectNone(url);
  });

  it('keeps the badges and tries again later when the load fails', () => {
    store.load();
    http.expectOne(url).flush({ success: false }, { status: 500, statusText: 'err' });
    expect(store.logos()).toEqual({});
    store.load();
    http.expectOne(url).flush({ success: true, data: {} });
  });
});
