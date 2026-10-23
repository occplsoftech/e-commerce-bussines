import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Shipments } from './shipments';

const base = '/api/v1/customer-portal/bookings';
const empty = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true, hasNext: false };
const row = {
  bookingId: 'b1', status: 'BOOKED', providerCode: 'DELHIVERY', providerName: 'Delhivery', serviceName: 'Surface',
  transportMode: 'SURFACE', bookingReference: 'D-1', trackingNumber: 'AWB1', pickupCity: 'Pune', pickupPincode: '411016',
  deliveryName: 'Ravi', deliveryCity: 'Delhi', deliveryPincode: '110001', packageCount: 1, totalAmount: 120, currency: 'INR',
  createdAt: new Date().toISOString(), bookedAt: null
};

describe('Shipments', () => {
  let http: HttpTestingController;

  function create(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }]
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Shipments);
    fixture.detectChanges();
    http.expectOne(`${base}/couriers`).flush({ data: [{ code: 'DELHIVERY', name: 'Delhivery' }, { code: 'SHIPROCKET', name: 'Shiprocket' }] });
    return fixture;
  }
  const list = (): TestRequest => http.expectOne((r) => r.url === base);

  it('offers every status and the couriers booked with, and sends no filter by default', () => {
    const fixture = create();
    const req = list();
    expect(req.request.params.keys()).toEqual(['page', 'size']);
    req.flush({ data: { ...empty, content: [row], totalElements: 1, totalPages: 1 } });
    fixture.detectChanges();
    const options = (id: string) => Array.from(fixture.nativeElement.querySelectorAll(`#${id} option`) as NodeListOf<HTMLOptionElement>)
      .map((o) => o.textContent?.trim());
    expect(options('status-filter')).toEqual(['All statuses', 'Booked', 'Awaiting confirmation', 'Submitting', 'Not booked']);
    expect(options('courier-filter')).toEqual(['All couriers', 'Delhivery', 'Shiprocket']);
    expect(fixture.nativeElement.textContent).toContain('AWB1');
  });

  it('sends status, courier and date range, and keeps the range valid', () => {
    const c = create().componentInstance;
    list().flush({ data: empty });
    c.set('status', 'PENDING,SUBMITTING');
    list().flush({ data: empty });
    c.set('provider', 'DELHIVERY');
    list().flush({ data: empty });
    c.set('to', '2026-10-10');
    list().flush({ data: empty });
    c.set('from', '2026-10-20');
    const req = list();
    expect(req.request.params.get('status')).toBe('PENDING,SUBMITTING');
    expect(req.request.params.get('provider')).toBe('DELHIVERY');
    expect(req.request.params.get('from')).toBe('2026-10-20');
    expect(req.request.params.get('to')).toBe('2026-10-20');
    req.flush({ data: empty });
  });

  it('reads the filter from the address, and Clear filters removes it', () => {
    const fixture = create({ status: 'FAILED', provider: 'shiprocket', from: '2026-10-01', to: 'nonsense' });
    const req = list();
    expect(req.request.params.get('status')).toBe('FAILED');
    expect(req.request.params.get('provider')).toBe('SHIPROCKET');
    expect(req.request.params.get('from')).toBe('2026-10-01');
    expect(req.request.params.has('to')).toBe(false);
    req.flush({ data: empty });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No shipments match these filters.');

    fixture.componentInstance.clear();
    expect(list().request.params.keys()).toEqual(['page', 'size']);
  });
});
