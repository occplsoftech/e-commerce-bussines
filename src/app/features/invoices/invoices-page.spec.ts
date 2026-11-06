import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { InvoicesPage } from './invoices-page';

const base = '/api/v1/customer-portal/invoices';
const row = { id: 'i1', invoiceNumber: 'INV-1', invoiceDate: '2026-10-31', periodFrom: '2026-10-01', periodTo: '2026-10-31', shipments: 3,
  total: 1000, prepaid: 100, due: 900, paid: 600, balance: 300, status: 'PARTLY_PAID' };

describe('InvoicesPage', () => {
  let http: HttpTestingController;

  function create() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(InvoicesPage);
    fixture.detectChanges();
    http.expectOne(base).flush({ data: { outstanding: 300, unpaidInvoices: 1, lastPaymentOn: '2026-11-02', lastPaymentAmount: 600, invoices: [row] } });
    fixture.detectChanges();
    return fixture;
  }

  it('shows what is outstanding and each invoice with its balance and status', () => {
    const fixture = create();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Outstanding');
    expect(text).toContain('INV-1');
    expect(text).toContain('Partly paid');
  });

  it('opens an invoice with its shipments and payments', () => {
    const fixture = create();
    fixture.componentInstance.open(row as never);
    http.expectOne(`${base}/i1`).flush({ data: { invoice: row, gst: 50, customerName: 'Acme', payments: [{ paidOn: '2026-11-02', amount: 600, method: 'UPI', reference: 'UTR9' }],
      lines: [{ shipmentNumber: 'PUN-000001', bookingDate: '2026-10-05', consignee: 'Ravi', destinationPincode: '400001', quantity: 1, weight: 1, paymentMode: 'Credit', prepaid: false, gst: 50, amount: 1000 }] } });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Invoice INV-1');
    expect(text).toContain('PUN-000001');
    expect(text).toContain('UTR9');
  });

  it('loads the statement for the chosen period and downloads it as Excel', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.from.set('2026-01-01');
    c.to.set('2026-11-06');
    c.openStatement();
    const req = http.expectOne((r) => r.url === `${base}/statement`);
    expect(req.request.params.get('from')).toBe('2026-01-01');
    req.flush({ data: { from: '2026-01-01', to: '2026-11-06', opening: 0, invoiced: 900, paid: 600, closing: 300,
      lines: [{ date: '2026-10-31', kind: 'INVOICE', reference: 'INV-1', debit: 900, credit: 0, balance: 900 }] } });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Closing balance');

    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => undefined;
    c.downloadStatement();
    const x = http.expectOne((r) => r.url === `${base}/statement/export`);
    expect(x.request.responseType).toBe('blob');
    x.flush(new Blob(['x']));
  });
});
