import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { ConfirmBooking, newIdempotencyKey } from './confirm-booking';

const quote = {
  quoteId: 'q1', status: 'OPEN', expiresAt: new Date(Date.now() + 600_000).toISOString(), pickupPincode: '411016',
  deliveryPincode: '110001', actualWeightKg: 2.5, volumetricWeightKg: 1.2, packageCount: 1, declaredValue: 1500,
  paymentMode: 'PREPAID', unavailable: [],
  options: [{ optionId: 'o1', providerCode: 'SHIPROCKET', providerName: 'Shiprocket', serviceName: 'Air', transportMode: 'AIR',
    etaMinDays: 2, etaMaxDays: 2, chargeableWeightKg: 2.5, baseFreight: 90, otherCharges: 0, markupPercent: 10, markupAmount: 9,
    taxAmount: 1.62, totalAmount: 100.62, currency: 'INR', breakdown: [], validUntil: null }]
};

describe('ConfirmBooking', () => {
  let http: HttpTestingController;

  function create() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ConfirmBooking);
    fixture.componentRef.setInput('quoteId', 'q1');
    fixture.componentRef.setInput('optionId', 'o1');
    fixture.detectChanges();
    http.expectOne('/api/v1/customer-portal/quotes/q1').flush({ data: quote });
    return fixture.componentInstance;
  }

  it('makes unique keys', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
    expect(newIdempotencyKey().length).toBeGreaterThanOrEqual(16);
  });

  it('reuses the same Idempotency-Key when the customer retries after a network error', () => {
    const c = create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    c.confirm();
    const first = http.expectOne('/api/v1/customer-portal/shipments');
    const key = first.request.headers.get('Idempotency-Key');
    expect(first.request.body).toEqual({ quoteId: 'q1', optionId: 'o1' });
    first.error(new ProgressEvent('error'), { status: 0 });
    expect(c.error()).toContain('not be booked twice');

    c.confirm();
    const second = http.expectOne('/api/v1/customer-portal/shipments');
    expect(second.request.headers.get('Idempotency-Key')).toBe(key);
    second.flush({ data: { bookingId: 'b1' } });
    expect(navigate).toHaveBeenCalledWith(['/book/result', 'b1']);
  });

  it('ignores a second click while the first is in flight', () => {
    const c = create();
    c.confirm();
    c.confirm();
    expect(http.match('/api/v1/customer-portal/shipments').length).toBe(1);
  });

  it('explains an expired quote', () => {
    const c = create();
    c.confirm();
    http.expectOne('/api/v1/customer-portal/shipments')
      .flush({ errorCode: 'QUOTE_EXPIRED', message: 'expired' }, { status: 409, statusText: 'Conflict' });
    expect(c.error()).toContain('refresh');
  });
});
