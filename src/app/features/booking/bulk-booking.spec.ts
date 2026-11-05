import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BulkBooking } from './bulk-booking';
import { BulkResult } from './bulk-booking.service';

const RESULTS: BulkResult[] = [
  { row: 2, booked: true, status: 'BOOKED', awb: '26110000001', reference: 'OC-1', message: 'Booked', bookingId: 'b1' },
  { row: 3, booked: true, status: 'BOOKED', awb: null, reference: 'OC-2', message: 'Booked', bookingId: 'b2' },
  { row: 4, booked: false, status: 'FAILED', awb: null, reference: null, message: 'Pincode not serviceable', bookingId: null }
];

describe('BulkBooking results', () => {
  let http: HttpTestingController;

  function create() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BulkBooking);
    (fixture.componentInstance as any).results.set(RESULTS);
    fixture.detectChanges();
    return fixture;
  }

  it('offers printing every booked label and the Excel download, counting only booked shipments', () => {
    const fixture = create();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Print all labels (2)');
    expect(text).toContain('Download results (Excel)');
  });

  it('loads each booked shipment (not the failed row) before printing', () => {
    const fixture = create();
    (fixture.componentInstance as any).printAll();
    http.expectOne('/api/v1/customer-portal/bookings/b1');
    http.expectOne('/api/v1/customer-portal/bookings/b2');
    http.expectNone('/api/v1/customer-portal/bookings/null');
  });

  it('sends every result row to the Excel endpoint', () => {
    const fixture = create();
    (fixture.componentInstance as any).downloadResults();
    const req = http.expectOne('/api/v1/customer-portal/bulk-bookings/results');
    expect(req.request.body.lines.length).toBe(3);
    expect(req.request.body.lines[2]).toEqual(expect.objectContaining({ row: 4, booked: false, message: 'Pincode not serviceable' }));
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => undefined;
    req.flush(new Blob(['x']));
  });
});
