import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '@env/environment';
import { BookingDraftService } from '@features/booking/booking-draft.service';
import { RateCalculator } from './rate-calculator';

const opt = (code: string, total: number) => ({ optionId: code, providerCode: code, providerName: code, serviceName: 'S', transportMode: 'CARGO',
  etaMinDays: 3, etaMaxDays: 7, chargeableWeightKg: 200, baseFreight: 0, otherCharges: 0, markupPercent: null, markupAmount: 0,
  taxAmount: 0, totalAmount: total, currency: 'INR', breakdown: [], validUntil: null });

describe('RateCalculator', () => {
  let http: HttpTestingController;

  function create() {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RateCalculator);
    fixture.detectChanges();
    return fixture;
  }

  it('asks for rates from pincodes and a package, marks the cheapest, and sends no dimensions when none are given', () => {
    const c = create().componentInstance;
    c.form.patchValue({ pickupPincode: '400001', deliveryPincode: '411016', packageCount: 10, actualWeightKg: 200, declaredValue: 500 });
    c.check();
    const req = http.expectOne(`${environment.apiBaseUrl}/customer-portal/rates/estimate`);
    expect(req.request.body).toMatchObject({ pickupPincode: '400001', deliveryPincode: '411016', packageCount: 10,
      actualWeightKg: 200, declaredValue: 500, length: null, paymentMode: 'PREPAID' });
    req.flush({ success: true, data: { quoteId: 'x', status: 'OPEN', expiresAt: '', pickupPincode: '400001', deliveryPincode: '411016',
      actualWeightKg: 200, volumetricWeightKg: 200, packageCount: 10, declaredValue: 500, paymentMode: 'PREPAID',
      options: [opt('A', 300), opt('B', 250)], unavailable: [] } });
    expect(c.cheapest()?.providerCode).toBe('B');
  });

  it('does not ask while the form is incomplete', () => {
    const c = create().componentInstance;
    c.check();
    http.expectNone(`${environment.apiBaseUrl}/customer-portal/rates/estimate`);
    expect(c.error()).toContain('Enter both pincodes');
  });

  it('Book carries the pincodes and package into the booking form', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.form.patchValue({ pickupPincode: '400001', deliveryPincode: '411016', packageCount: 2, actualWeightKg: 5, declaredValue: 900 });
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.book();
    const d = TestBed.inject(BookingDraftService).draft()!;
    expect(d.pickup.pincode).toBe('400001');
    expect(d.delivery.pincode).toBe('411016');
    expect(d.package.actualWeightKg).toBe(5);
    expect(nav).toHaveBeenCalledWith(['/book']);
  });
});
