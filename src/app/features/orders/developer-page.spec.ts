import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DeveloperPage } from './developer-page';

describe('DeveloperPage', () => {
  it('shows a new key once, lists keys by their first characters only, and revokes', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(DeveloperPage);
    f.detectChanges();
    http.expectOne('/api/v1/customer-portal/api-keys').flush({ data: [] });
    const c = f.componentInstance;
    c.name.set('Website');
    c.create();
    const post = http.expectOne((r) => r.url === '/api/v1/customer-portal/api-keys' && r.method === 'POST');
    expect(post.request.body).toEqual({ name: 'Website' });
    const view = { id: 'k1', name: 'Website', keyPrefix: 'occ_abcdefgh', createdAt: '2026-11-16T05:00:00Z', lastUsedAt: null, revokedAt: null };
    post.flush({ data: { view, key: 'occ_abcdefghSECRETSECRETSECRETSECRETSECRET' } });
    http.expectOne('/api/v1/customer-portal/api-keys').flush({ data: [view] });
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('occ_abcdefghSECRETSECRETSECRETSECRETSECRET');
    expect(text).toContain('not shown again');
    expect(text).toContain('occ_abcdefgh…');
    expect(text).toContain('/public/orders');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    c.revoke(view);
    http.expectOne((r) => r.url === '/api/v1/customer-portal/api-keys/k1' && r.method === 'DELETE').flush({ data: { ...view, revokedAt: '2026-11-16T06:00:00Z' } });
    http.expectOne('/api/v1/customer-portal/api-keys').flush({ data: [] });
  });
});
