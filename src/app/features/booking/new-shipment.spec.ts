import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { NewShipment } from './new-shipment';
import { BookingDraftService } from './booking-draft.service';

describe('NewShipment', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  });

  function fill(c: NewShipment) {
    const party = { name: 'Asha', phone: '+91 98765 43210', address: 'Office 4, Thorat Chowk', pincode: '411016', city: 'Pune', state: 'Maharashtra' };
    c.form.patchValue({
      pickup: party,
      delivery: { ...party, name: 'Ravi', pincode: '110001', city: 'New Delhi', state: 'Delhi' },
      package: { actualWeightKg: 2.5, length: 30, breadth: 20, height: 10, packageCount: 1, contents: 'Garments', declaredValue: 1500 }
    });
  }

  it('does not save an incomplete shipment', () => {
    const c = TestBed.createComponent(NewShipment).componentInstance;
    c.compare();
    expect(c.notice()).toContain('correct');
    expect(TestBed.inject(BookingDraftService).draft()).toBeNull();
  });

  it('saves a valid shipment, asks the server for rates without any price, and opens the comparison', () => {
    const c = TestBed.createComponent(NewShipment).componentInstance;
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fill(c);
    c.compare();
    const draft = TestBed.inject(BookingDraftService).draft()!;
    expect(draft.pickup.phone).toBe('9876543210');
    expect(draft.package.dimensionUnit).toBe('CM');

    const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/customer-portal/rates/compare');
    expect(JSON.stringify(req.request.body)).not.toMatch(/price|total|amount|markup/i);
    expect(req.request.body.pkg.actualWeightKg).toBe(2.5);
    req.flush({ data: { quoteId: 'q1' } });
    expect(navigate).toHaveBeenCalledWith(['/book/rates', 'q1']);
  });

  it('sends the amount to collect only for a COD shipment', () => {
    const c = TestBed.createComponent(NewShipment).componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fill(c);
    c.form.patchValue({ package: { paymentMode: 'COD', codAmount: 1750 } });
    c.compare();
    const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/customer-portal/rates/compare');
    expect(req.request.body.pkg.codAmount).toBe(1750);
    expect(JSON.stringify(req.request.body)).not.toMatch(/price|total|markup/i);
    req.flush({ data: { quoteId: 'q2' } });

    // switching back to prepaid drops it
    c.form.patchValue({ package: { paymentMode: 'PREPAID' } });
    c.compare();
    const again = TestBed.inject(HttpTestingController).expectOne('/api/v1/customer-portal/rates/compare');
    expect('codAmount' in again.request.body.pkg).toBe(false);
  });

  it('shows the server\'s validation message', () => {
    const c = TestBed.createComponent(NewShipment).componentInstance;
    fill(c);
    c.compare();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/customer-portal/rates/compare')
      .flush({ message: 'Delivery pincode must be 6 digits' }, { status: 422, statusText: 'Unprocessable' });
    expect(c.notice()).toBe('Delivery pincode must be 6 digits');
    expect(c.comparing()).toBe(false);
  });
});

describe('NewShipment as a return pickup', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ returnOf: 'b1' }) } } }] });
  });

  it('swaps the addresses of the delivered booking, keeps the parcel, and asks for a prepaid return quote', () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(NewShipment);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/customer-portal/bookings/b1').flush({ data: {
      bookingId: 'b1', status: 'BOOKED',
      pickup: { name: 'Test Shop', phone: '9876543210', address: 'Model Colony, Pune', pincode: '411016', city: 'Pune', state: 'Maharashtra' },
      delivery: { name: 'Ravi', phone: '9800000011', address: '12 Return Lane, Mumbai', pincode: '400001', city: 'Mumbai', state: 'Maharashtra' },
      parcel: { actualWeightKg: 1, length: 10, breadth: 10, height: 10, dimensionUnit: 'CM', packageCount: 1, contents: 'Test', declaredValue: 2000 }
    } });
    http.match(() => true).forEach((r) => r.flush({ data: [] }));
    const c = f.componentInstance;
    expect(c.returnOf()).toBe('b1');
    expect(c.form.getRawValue().pickup.name).toBe('Ravi');
    expect(c.form.getRawValue().delivery.name).toBe('Test Shop');
    expect((f.nativeElement as HTMLElement).textContent).toContain('Book a return pickup');

    c.form.patchValue({ package: { paymentMode: 'COD' } });
    c.compare();
    const req = http.expectOne('/api/v1/customer-portal/rates/compare');
    expect(req.request.body.returnOfBookingId).toBe('b1');
    expect(req.request.body.pkg.paymentMode).toBe('PREPAID');
    expect(req.request.body.pickup.pincode).toBe('400001');
    req.flush({ data: { quoteId: 'q9' } });
  });
});
