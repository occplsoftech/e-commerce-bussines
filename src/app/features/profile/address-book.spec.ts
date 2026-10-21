import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AddressBook } from './address-book';

const saved = { id: 'a1', addressType: 'OFFICE', addressUsage: 'BOTH', addressLine1: 'Shop 4', addressLine2: null, landmark: null,
  pincode: '411016', area: null, city: 'Pune', district: 'Pune', defaultPickup: true, defaultDelivery: false, version: 3 };

describe('AddressBook', () => {
  let http: HttpTestingController;

  function create() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AddressBook);
    fixture.detectChanges();
    http.expectOne('/api/v1/customer-portal/addresses').flush({ data: [saved] });
    return fixture.componentInstance;
  }

  it('does not submit an invalid pincode', () => {
    const c = create();
    c.startAdd();
    c.form.patchValue({ addressLine1: 'Warehouse 9', pincode: '012345' });
    c.save();
    http.expectNone('/api/v1/customer-portal/addresses');
  });

  it('edits with the version it loaded and never sends a delivery-only address as default pickup', () => {
    const c = create();
    c.startEdit(saved as never);
    c.form.patchValue({ addressUsage: 'DELIVERY' });
    c.save();

    const req = http.expectOne('/api/v1/customer-portal/addresses/a1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.expectedVersion).toBe(3);
    expect(req.request.body.defaultPickup).toBe(false);
    req.flush({ data: saved });
    http.expectOne('/api/v1/customer-portal/addresses').flush({ data: [saved] });
    expect(c.editing()).toBe(false);
  });

  it('shows the server message when the pincode is not on file', async () => {
    const c = create();
    c.startAdd();
    c.form.patchValue({ addressLine1: 'Warehouse 9', pincode: '999999' });
    c.save();
    http.expectOne('/api/v1/customer-portal/addresses').flush({ message: 'Pincode 999999 is not in our directory.' },
      { status: 422, statusText: 'Unprocessable' });
    await new Promise((r) => setTimeout(r, 0));
    expect(c.formError()).toBe('Pincode 999999 is not in our directory.');
  });
});
