import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { StorePage } from './store-page';

function setup(platform: string) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
    { provide: ActivatedRoute, useValue: { snapshot: { data: { platform } } } }] });
  const f = TestBed.createComponent(StorePage);
  f.detectChanges();
  return { f, http: TestBed.inject(HttpTestingController) };
}

describe('StorePage', () => {
  it('connects a WooCommerce store with key and secret', () => {
    const { f, http } = setup('woocommerce');
    http.expectOne('/api/v1/customer-portal/connections/woocommerce').flush({ data: null });
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('WooCommerce store');
    expect(text).toContain('Consumer secret');
    const c = f.componentInstance;
    c.address.set('https://myshop.in'); c.token.set('ck_x'); c.secret.set('cs_y');
    c.connect();
    const req = http.expectOne('/api/v1/customer-portal/connections/woocommerce');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ storeUrl: 'https://myshop.in', consumerKey: 'ck_x', consumerSecret: 'cs_y', fulfilBack: true });
  });

  it('shows Shopify with the token field', () => {
    const { f, http } = setup('shopify');
    http.expectOne('/api/v1/customer-portal/connections/shopify').flush({ data: null });
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Shopify store');
    expect(text).toContain('Admin API access token');
    expect(text).not.toContain('Consumer secret');
  });
});
