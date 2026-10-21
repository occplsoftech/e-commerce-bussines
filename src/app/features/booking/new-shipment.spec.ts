import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
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
