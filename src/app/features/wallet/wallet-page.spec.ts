import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { CHECKOUT_DISMISSED, RazorpayService } from '@core/services/razorpay.service';
import { WalletPage } from './wallet-page';
import { Wallet, WalletEntry } from './wallet.service';

const base = `${environment.apiBaseUrl}/customer-portal/wallet`;

const wallet: Wallet = {
  id: 'w1', customerId: 'c1', walletNumber: 'WLT2610ABC', status: 'ACTIVE', availableBalance: 1250.5, holdBalance: 0,
  totalBalance: 1250.5, currency: 'INR', createdAt: '2026-10-26T10:00:00Z'
};
const entry = (over: Partial<WalletEntry>): WalletEntry => ({
  id: 'e1', transactionNo: 'TXN-1', transactionType: 'CR', transactionTypeLabel: 'Credit', subTransactionType: 'WRC',
  subTransactionTypeLabel: 'Wallet Recharge', amount: 500, balanceBefore: 750.5, balanceAfter: 1250.5, referenceType: 'PAYMENT',
  referenceId: 'order_1', remarks: null, createdAt: '2026-10-26T10:05:00Z', ...over
});
const page = <T>(content: T[], over: object = {}) =>
  ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1, first: true, last: true, hasNext: false, ...over });
const ok = <T>(data: T) => ({ success: true, message: 'ok', data });

describe('WalletPage', () => {
  let http: HttpTestingController;
  let razorpay: { checkout: ReturnType<typeof vi.fn> };

  function create(opts: { wallet?: Wallet; entries?: unknown; requests?: unknown } = {}) {
    razorpay = { checkout: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: RazorpayService, useValue: razorpay }]
    });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(WalletPage);
    f.detectChanges();
    http.expectOne(base).flush(ok(opts.wallet ?? wallet));
    http.expectOne((r) => r.url === `${base}/transactions`).flush(ok(opts.entries ?? page([entry({})])));
    http.expectOne((r) => r.url === `${base}/topup-requests`).flush(ok(opts.requests ?? page([])));
    f.detectChanges();
    return f;
  }

  afterEach(() => http.verify());

  it('shows the balance and the statement, with money in and out told apart', () => {
    const f = create({ entries: page([
      entry({}),
      entry({ id: 'e2', transactionNo: 'TXN-2', transactionType: 'DR', subTransactionTypeLabel: 'Shipment Booking', amount: 111.8,
        balanceAfter: 638.7, remarks: 'Courier booking SHIPROCKET' })
    ]) });
    const text = f.nativeElement.textContent as string;
    expect(text).toContain('₹1,250.50');
    expect(text).toContain('WLT2610ABC');
    expect(text).toContain('Wallet Recharge');
    expect(text).toContain('+₹500.00');
    expect(text).toContain('Shipment Booking');
    expect(text).toContain('−₹111.80');
    expect(text).toContain('Courier booking SHIPROCKET');
  });

  it('says so when there are no transactions yet', () => {
    const f = create({ entries: page([]) });
    expect(f.nativeElement.textContent).toContain('No transactions yet');
  });

  it('opens a gateway order for the typed amount, pays in checkout, then has the server settle it', async () => {
    const f = create();
    const c = f.componentInstance;
    razorpay.checkout.mockResolvedValue({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' });
    c.amount.set(500);

    c.payOnline();
    const open = http.expectOne(`${base}/recharge/order`);
    expect(open.request.body).toEqual({ amount: 500 });
    open.flush(ok({ gateway: 'RAZORPAY', orderId: 'order_1', amountMinor: 50000, currency: 'INR', publicKey: 'rzp_test_x',
      walletNumber: 'WLT2610ABC', receipt: 'r1' }));
    await Promise.resolve(); await Promise.resolve();

    const settle = http.expectOne(`${base}/recharge`);
    expect(settle.request.body).toEqual({ gatewayOrderId: 'order_1', paymentReference: 'pay_1', signature: 'sig' });
    settle.flush(ok(entry({})));
    http.expectOne(base).flush(ok({ ...wallet, availableBalance: 1750.5 }));
    http.expectOne((r) => r.url === `${base}/transactions`).flush(ok(page([entry({})])));
    f.detectChanges();

    expect(c.wallet()!.availableBalance).toBe(1750.5);
    expect(c.amount()).toBeNull();
    expect(c.paying()).toBe(false);
  });

  it('never credits anything from the browser: a closed checkout calls no settle endpoint', async () => {
    const c = create().componentInstance;
    razorpay.checkout.mockRejectedValue(new Error(CHECKOUT_DISMISSED));
    c.amount.set(500);

    c.payOnline();
    http.expectOne(`${base}/recharge/order`).flush(ok({ orderId: 'order_1', amountMinor: 50000, currency: 'INR', publicKey: 'k', walletNumber: 'W' }));
    await Promise.resolve(); await Promise.resolve();

    http.expectNone(`${base}/recharge`);
    expect(c.paying()).toBe(false);
  });

  it('after paying, a failed confirmation tells the customer the credit still arrives and does not ask to pay again', async () => {
    const c = create().componentInstance;
    razorpay.checkout.mockResolvedValue({ razorpay_order_id: 'o', razorpay_payment_id: 'p', razorpay_signature: 's' });
    c.amount.set(500);

    c.payOnline();
    http.expectOne(`${base}/recharge/order`).flush(ok({ orderId: 'o', amountMinor: 50000, currency: 'INR', publicKey: 'k', walletNumber: 'W' }));
    await Promise.resolve(); await Promise.resolve();
    http.expectOne(`${base}/recharge`).flush({ message: 'Gateway is slow' }, { status: 503, statusText: 'Unavailable' });
    http.expectOne(base).flush(ok(wallet));
    http.expectOne((r) => r.url === `${base}/transactions`).flush(ok(page([])));

    expect(c.payNote()).toContain('added automatically');
    expect(c.paying()).toBe(false);
  });

  it('with no payment gateway set up, explains it and opens the bank-transfer route', () => {
    const c = create().componentInstance;
    c.amount.set(500);

    c.payOnline();
    http.expectOne(`${base}/recharge/order`).flush({ message: 'No payment gateway is configured' }, { status: 422, statusText: 'Unprocessable' });

    expect(c.payNote()).toContain('No payment gateway is configured');
    expect(c.showRequest()).toBe(true);
  });

  it('will not pay for a missing, tiny or huge amount', () => {
    const c = create().componentInstance;
    c.amount.set(null); expect(c.canPay()).toBe(false);
    c.amount.set(0.5); expect(c.canPay()).toBe(false); expect(c.amountError()).toContain('at least 1');
    c.amount.set(10_000_001); expect(c.canPay()).toBe(false);
    c.amount.set(1000); expect(c.canPay()).toBe(true);
    c.addQuick(500); expect(c.amount()).toBe(1500);
  });

  it('a suspended wallet cannot add money', () => {
    const f = create({ wallet: { ...wallet, status: 'SUSPENDED' } });
    f.componentInstance.amount.set(500);
    expect(f.componentInstance.canPay()).toBe(false);
    expect(f.nativeElement.textContent).toContain('This wallet is suspended');
  });

  it('uploads the proof first, then raises the top-up request with its URL', () => {
    const f = create();
    const c = f.componentInstance;
    c.pickProof({ target: { files: [new File([new Uint8Array(4)], 'receipt.jpg', { type: 'image/jpeg' })], value: '' } } as unknown as Event);
    const up = http.expectOne(`${base}/topup-requests/upload-proof`);
    expect(up.request.body).toBeInstanceOf(FormData);
    up.flush(ok({ url: 'https://files.example/proof.jpg' }));
    expect(c.proofName()).toBe('receipt.jpg');

    c.requestAmount.set(2500);
    c.remarks.set(' UTR 123 ');
    expect(c.canRequest()).toBe(true);
    c.submitRequest();
    const req = http.expectOne(`${base}/topup-requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ amount: 2500, remarks: 'UTR 123', proofImageUrl: 'https://files.example/proof.jpg' });
    req.flush(ok({ id: 'r1', requestedAmount: 2500, status: 'PENDING', createdAt: '2026-10-26T11:00:00Z' }));
    http.expectOne((r) => r.url === `${base}/topup-requests` && r.method === 'GET').flush(ok(page([])));

    expect(c.tab()).toBe('requests');
    expect(c.proofUrl()).toBeNull();
  });

  it('cannot raise a top-up request without proof, and refuses a non-image before uploading', () => {
    const c = create().componentInstance;
    c.requestAmount.set(2500);
    expect(c.canRequest()).toBe(false);

    c.pickProof({ target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })], value: '' } } as unknown as Event);
    c.pickProof({ target: { files: [new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })], value: '' } } as unknown as Event);
    http.expectNone(`${base}/topup-requests/upload-proof`);
    expect(c.proofUrl()).toBeNull();
  });

  it('lists top-up requests with their status and why one was rejected', () => {
    const f = create({ requests: page([
      { id: 'r1', requestedAmount: 1000, remarks: 'UTR 1', proofImageUrl: 'https://f/x.jpg', status: 'PENDING', createdAt: '2026-10-26T09:00:00Z', decidedAt: null, decisionRemarks: null },
      { id: 'r2', requestedAmount: 300, remarks: null, proofImageUrl: null, status: 'REJECTED', createdAt: '2026-10-25T09:00:00Z', decidedAt: '2026-10-25T10:00:00Z', decisionRemarks: 'Amount does not match the receipt' }
    ]) });
    expect(f.componentInstance.pending()).toBe(1);
    f.componentInstance.tab.set('requests');
    f.detectChanges();
    const text = f.nativeElement.textContent as string;
    expect(text).toContain('Waiting for approval');
    expect(text).toContain('Rejected');
    expect(text).toContain('Amount does not match the receipt');
    expect(text).toContain('View proof');
  });

  it('pages through the statement', () => {
    const f = create({ entries: page([entry({})], { totalPages: 3, hasNext: true, last: false }) });
    f.componentInstance.loadEntries(1);
    const r = http.expectOne((x) => x.url === `${base}/transactions`);
    expect(r.request.params.get('page')).toBe('1');
    r.flush(ok(page([entry({ id: 'e9' })], { page: 1, first: false })));
    expect(f.componentInstance.entries()!.page).toBe(1);
  });
});
