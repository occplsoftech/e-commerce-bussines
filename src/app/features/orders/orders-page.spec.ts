import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { OrdersPage } from './orders-page';

const order = (id: string, over: Record<string, unknown> = {}) => ({
  id, source: 'API', orderNumber: 'WEB-' + id, status: 'NEW',
  buyer: { name: 'Ravi', phone: '9876543210', address: '12 MG Road, Camp', pincode: '411001', city: 'Pune', state: null },
  parcel: { weightKg: 0.5, lengthCm: 10, breadthCm: 10, heightCm: 10, count: 1, contents: 'Shirts', declaredValue: 998 },
  payment: { mode: 'COD', codAmount: 998 }, items: [{ name: 'Shirt', quantity: 2 }], notes: null, receivedAt: '2026-11-16T05:00:00Z',
  bookingId: null, bookedAt: null, trackingNumber: null, courier: null, ...over
});
const page = (content: unknown[]) => ({ data: { content, page: 0, size: 100, totalElements: content.length, totalPages: 1, first: true, last: true, hasNext: false } });

describe('OrdersPage', () => {
  function open() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(OrdersPage);
    f.detectChanges();
    http.expectOne('/api/v1/customer-portal/orders/counts').flush({ data: { newOrders: 2, booked: 1, archived: 0 } });
    const list = http.expectOne((r) => r.url === '/api/v1/customer-portal/orders');
    expect(list.request.params.get('status')).toBe('NEW');
    list.flush(page([order('1'), order('2')]));
    f.detectChanges();
    return { f, http, c: f.componentInstance };
  }

  it('lists new orders with COD and a Book link that opens the filled-in form', () => {
    const { f } = open();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('WEB-1');
    expect(el.textContent).toContain('COD');
    expect(el.querySelector('a[href*="order=1"]')?.textContent).toContain('Book');
  });

  it('books selected orders: prices them, shows the review, books the ready ones from the wallet', () => {
    const { f, http, c } = open();
    c.pickAll(true);
    c.quote();
    const q = http.expectOne('/api/v1/customer-portal/orders/quote');
    expect(q.request.body).toEqual({ orderIds: ['1', '2'] });
    q.flush({ data: [
      { orderId: '1', orderNumber: 'WEB-1', deliveryName: 'Ravi', deliveryPincode: '411001', ok: true, error: null, quoteId: 'q1', optionId: 'o1',
        providerCode: 'OCCPL_NETWORK', providerName: 'OCCPL Network', serviceName: 'Standard', basis: 'BUSINESS_RATE', total: 59 },
      { orderId: '2', orderNumber: 'WEB-2', deliveryName: 'Ravi', deliveryPincode: '411001', ok: false, error: 'No courier serves it', quoteId: null,
        optionId: null, providerCode: null, providerName: null, serviceName: null, basis: null, total: null }] });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('No courier serves it');
    expect(c.okTotal()).toBe(59);

    c.bookAll();
    const b = http.expectOne('/api/v1/customer-portal/bulk-bookings/book');
    expect(b.request.body).toEqual({ items: [{ row: 1, quoteId: 'q1', optionId: 'o1' }] });
    b.flush({ data: [{ row: 1, booked: true, status: 'BOOKED', awb: 'AWB1', reference: 'PU-1', message: 'Booked', bookingId: 'b1' }] });
    expect(c.results()).toEqual({ booked: 1, total: 1, failed: [] });
    http.expectOne('/api/v1/customer-portal/orders/counts').flush({ data: { newOrders: 1, booked: 2, archived: 0 } });
    http.expectOne((r) => r.url === '/api/v1/customer-portal/orders').flush(page([order('2')]));
  });

  it('archives an order', () => {
    const { http, c } = open();
    c.archive(c.orders()[0]);
    http.expectOne('/api/v1/customer-portal/orders/1/archive').flush({ data: order('1', { status: 'ARCHIVED' }) });
    http.expectOne('/api/v1/customer-portal/orders/counts').flush({ data: { newOrders: 1, booked: 1, archived: 1 } });
    http.expectOne((r) => r.url === '/api/v1/customer-portal/orders').flush(page([order('2')]));
  });
});
