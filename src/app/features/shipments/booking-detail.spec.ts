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

  it('offers Cancel only when the server says the booking can still be cancelled', () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Cancel booking');

    fixture.componentInstance.booking.set({ ...fixture.componentInstance.booking()!, cancellable: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cancel booking');
  });

  it('asks for confirmation, then cancels with the reason and reloads the booking', () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    const c = fixture.componentInstance;
    c.booking.set({ ...c.booking()!, cancellable: true });
    c.confirmingCancel.set(true);
    c.cancelReason.set(' wrong address ');

    c.cancelBooking();
    const post = http.expectOne('/api/v1/customer-portal/bookings/b1/cancel');
    expect(post.request.body).toEqual({ reason: 'wrong address' });
    post.flush({ data: {} });
    http.expectOne('/api/v1/customer-portal/bookings/b1').flush({ data: detail('CANCELLED') });

    expect(c.confirmingCancel()).toBe(false);
    expect(c.booking()!.status).toBe('CANCELLED');
    expect(c.cancelMessage()).toContain('Booking cancelled');
  });

  it('shows the server reason when the parcel was already collected', async () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    const c = fixture.componentInstance;
    c.cancelBooking();
    http.expectOne('/api/v1/customer-portal/bookings/b1/cancel').flush(
      { message: 'This parcel has already been collected, so the booking can no longer be cancelled.' },
      { status: 422, statusText: 'Unprocessable' });
    await new Promise((r) => setTimeout(r, 20));
    expect(c.error()).toContain('already been collected');
    expect(c.cancelling()).toBe(false);
  });

  it('shows the chosen pickup time and offers changing it only while the booking can still be changed', () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    const c = fixture.componentInstance;
    c.booking.set({ ...c.booking()!, pickupDate: '2026-11-09', pickupSlot: 'Morning (9-12)', cancellable: false });
    fixture.detectChanges();
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text()).toContain('Morning (9-12)');
    expect(text()).not.toContain('Change pickup time');

    c.booking.set({ ...c.booking()!, cancellable: true });
    fixture.detectChanges();
    expect(text()).toContain('Change pickup time');
  });

  it('saves the new date and slot and reloads the booking', () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    const c = fixture.componentInstance;
    c.booking.set({ ...c.booking()!, cancellable: true, pickupSlots: ['Morning (9-12)'] });
    c.startReschedule(c.booking()!);
    expect(c.newDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    c.newDate.set('2026-11-10');
    c.newSlot.set('');

    c.saveReschedule();
    const post = http.expectOne('/api/v1/customer-portal/bookings/b1/reschedule');
    expect(post.request.body).toEqual({ date: '2026-11-10', slot: null });
    post.flush({ data: {} });
    http.expectOne('/api/v1/customer-portal/bookings/b1').flush({ data: detail('BOOKED') });
    expect(c.rescheduling()).toBe(false);
    expect(c.pickupMessage()).toContain('Pickup time updated');
  });

  it('keeps the form open and shows the reason when the change is refused', async () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    const c = fixture.componentInstance;
    c.startReschedule(c.booking()!);
    c.saveReschedule();
    http.expectOne('/api/v1/customer-portal/bookings/b1/reschedule').flush(
      { message: 'This parcel has already been collected, so the pickup time can no longer be changed.' }, { status: 422, statusText: 'x' });
    await new Promise((r) => setTimeout(r, 20));
    expect(c.pickupError()).toContain('already been collected');
    expect(c.rescheduling()).toBe(true);
  });

  const issue = { attempts: 1, reason: 'Receiver not available', note: 'door locked', at: '2026-11-06T10:00:00Z', open: true,
    returnFlagged: false, choice: null, choiceLabel: null, choiceDate: null, receiverAddress: 'B-2', receiverPhone: '9123456780' };

  it('shows a failed delivery with its reason and the three choices', () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    fixture.componentInstance.booking.set({ ...fixture.componentInstance.booking()!, deliveryIssue: issue as never });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Delivery attempt failed');
    expect(text).toContain('Receiver not available');
    expect(text).toContain('Deliver again');
    expect(text).toContain('New address');
    expect(text).toContain('Return to me');
  });

  it('sends "deliver again" with the chosen date, and a new address with the phone', () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    const c = fixture.componentInstance;
    c.startChoice('REATTEMPT', issue);
    c.choiceDate.set('2026-11-09');
    c.sendChoice();
    const a = http.expectOne('/api/v1/customer-portal/bookings/b1/delivery-choice');
    expect(a.request.body).toEqual({ choice: 'REATTEMPT', date: '2026-11-09' });
    a.flush({ data: {} });
    http.expectOne('/api/v1/customer-portal/bookings/b1').flush({ data: detail('BOOKED') });
    expect(c.choiceMessage()).toContain('passed this to the branch');

    c.startChoice('CHANGE_ADDRESS', issue);
    expect(c.choiceAddress()).toBe('B-2');
    c.choiceAddress.set(' Flat 4, MG Road, Delhi ');
    c.sendChoice();
    const b = http.expectOne('/api/v1/customer-portal/bookings/b1/delivery-choice');
    expect(b.request.body).toEqual({ choice: 'CHANGE_ADDRESS', address: 'Flat 4, MG Road, Delhi', phone: '9123456780' });
    b.flush({ data: {} });
    http.expectOne('/api/v1/customer-portal/bookings/b1').flush({ data: detail('BOOKED') });
  });

  it('keeps the choice open and shows the reason when the answer is refused', async () => {
    const fixture = create('BOOKED');
    http.expectOne('/api/v1/customer-portal/bookings/b1/tracking').flush({ data: { available: false, events: [], retrievedAt: '' } });
    const c = fixture.componentInstance;
    c.startChoice('RETURN', issue);
    c.sendChoice();
    http.expectOne('/api/v1/customer-portal/bookings/b1/delivery-choice').flush(
      { message: 'There is no failed delivery waiting for your answer on this shipment.' }, { status: 422, statusText: 'x' });
    await new Promise((r) => setTimeout(r, 20));
    expect(c.choiceError()).toContain('no failed delivery');
    expect(c.choosing()).toBe('RETURN');
  });
});
