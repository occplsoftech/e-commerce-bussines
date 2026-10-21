import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NewShipment } from './new-shipment';
import { BookingDraftService } from './booking-draft.service';

describe('NewShipment', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
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

  it('saves a valid shipment with normalised phone numbers and no price', () => {
    const c = TestBed.createComponent(NewShipment).componentInstance;
    fill(c);
    c.compare();
    const draft = TestBed.inject(BookingDraftService).draft()!;
    expect(draft.pickup.phone).toBe('9876543210');
    expect(draft.package.dimensionUnit).toBe('CM');
    expect(JSON.stringify(draft)).not.toContain('price');
  });
});
