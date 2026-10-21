import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BookingDetail } from './booking-detail';

const detail = (status: string, labelDownloadable = true) => ({
  bookingId: 'b1', quoteId: 'q1', status, providerCode: 'SHIPROCKET', providerName: 'Shiprocket', serviceName: 'Xpress Air',
  transportMode: 'AIR', etaMinDays: 2, etaMaxDays: 3, bookingReference: 'SR-1', trackingNumber: null, labelDownloadable,
  message: null, pickup: { name: 'Shop', phone: '9876543210', address: 'A-1', pincode: '411016', city: 'Pune', state: null },
  delivery: { name: 'Ravi', phone: '9123456780', address: 'B-2', pincode: '110001', city: 'Delhi', state: null },
  parcel: null, charges: [{ label: 'Freight', component: 'FREIGHT', amount: 200 }], totalAmount: 250, currency: 'INR',
  submittedAt: null, bookedAt: null, createdAt: new Date().toISOString()
});

describe('BookingDetail', () => {
  let http: HttpTestingController;

  function create(status: string, labelDownloadable = true) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BookingDetail);
    fixture.componentRef.setInput('bookingId', 'b1');
    fixture.detectChanges();
    http.expectOne('/api/v1/customer-portal/bookings/b1').flush({ data: detail(status, labelDownloadable) });
    return fixture;
  }

  it('asks the courier for tracking of a booked shipment and picks up a new tracking number', () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: {
      bookingId: 'b1', providerName: 'Shiprocket', trackingNumber: 'AWB9', available: true, status: 'In Transit',
      currentLocation: 'Delhi', events: [{ at: new Date().toISOString(), status: 'In Transit', location: 'Delhi', description: null }],
      message: null, retrievedAt: new Date().toISOString() } });
    fixture.detectChanges();

    expect(fixture.componentInstance.booking()!.trackingNumber).toBe('AWB9');
    expect(fixture.nativeElement.textContent).toContain('In Transit');
  });

  it('does not ask for tracking before the booking is confirmed', () => {
    const fixture = create('OUTCOME_UNKNOWN');
    fixture.detectChanges();
    http.expectNone('/api/v1/customer-portal/bookings/b1/tracking');
    expect(fixture.nativeElement.textContent).toContain('please do not book it again');
  });

  it('shows the server message when no label is available yet', async () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    const c = fixture.componentInstance;

    c.downloadLabel(c.booking()!);
    http.expectOne('/api/v1/customer-portal/bookings/b1/label').flush(
      new Blob([JSON.stringify({ message: 'The label is available once a tracking number is assigned.' })]),
      { status: 422, statusText: 'Unprocessable' });
    await new Promise((r) => setTimeout(r, 20));

    expect(c.labelError()).toBe('The label is available once a tracking number is assigned.');
    expect(c.downloading()).toBe(false);
  });

  it('offers no label download for OCCPL network bookings', () => {
    const fixture = create('BOOKED', false);
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Download label');
  });
});
