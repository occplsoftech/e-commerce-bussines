import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Dashboard } from './dashboard';
import { DashboardInsights } from '@core/models/portal.model';

const insights = (over: Partial<DashboardInsights> = {}): DashboardInsights => ({
  period: 'LAST_30_DAYS', from: '2026-10-09', to: '2026-11-07', shipments: 5, spend: 640, averageSpend: 128,
  onTimePercent: 50, onTimeMeasured: 2, needAttention: 2,
  spendSeries: [{ date: '2026-11-06', spend: 0, shipments: 0 }, { date: '2026-11-07', spend: 60, shipments: 1 }],
  stages: { AWAITING_PICKUP: 1, PICKED_UP: 0, IN_TRANSIT: 1, OUT_FOR_DELIVERY: 0, DELIVERED: 2, RETURNED: 1 },
  couriers: [{ providerCode: 'SHIPROCKET', providerName: 'Shiprocket', shipments: 2, spend: 480, onTimePercent: 0 },
    { providerCode: 'OCCPL_NETWORK', providerName: 'OCCPL Network', shipments: 3, spend: 160, onTimePercent: 100 }],
  late: [{ bookingId: 'b3', trackingNumber: 'AWB3', providerName: 'Shiprocket', deliveryName: 'Ravi', lastStatus: 'In Transit',
    promisedBy: '2026-11-04', daysLate: 3 }], lateCount: 1,
  needAnswer: [{ bookingId: 'b9', trackingNumber: 'AWB9', providerName: 'OCCPL Network', deliveryName: null }], needAnswerCount: 1,
  ...over
});

describe('Dashboard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });

  function open(data = insights()) {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    const req = http.expectOne((r) => r.url.endsWith('/customer-portal/dashboard/insights'));
    expect(req.request.params.get('period')).toBe('LAST_30_DAYS');
    req.flush({ data });
    http.match((r) => r.url.includes('/customer-portal/bookings')).forEach((r) => r.flush({ data: { content: [], totalElements: 0 } }));
    http.match(() => true).forEach((r) => r.flush({ data: null }));
    f.detectChanges();
    return f;
  }

  it('shows the period totals, the courier split with shares, and what needs attention', () => {
    const f = open();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Shipments booked');
    expect(text).toContain('₹640');
    expect(text).toContain('50%');
    expect(text).toContain('Shiprocket');
    expect(f.componentInstance.share(480)).toBe(75);
    expect(text).toContain('3 days late');
    expect(text).toContain('to Ravi');
    expect(text).toContain('Choose what to do');
    expect(f.componentInstance.stages().map((s) => s.value)).toEqual([1, 0, 1, 0, 2, 1]);
  });

  it('switches the period, reloads and remembers it', () => {
    const f = open();
    f.componentInstance.choose('LAST_90_DAYS');
    const req = http.expectOne((r) => r.url.endsWith('/customer-portal/dashboard/insights'));
    expect(req.request.params.get('period')).toBe('LAST_90_DAYS');
    req.flush({ data: insights({ period: 'LAST_90_DAYS' }) });
    expect(localStorage.getItem('ecb.dashboard.period')).toBe('LAST_90_DAYS');
  });

  it('says so when nothing was booked in the period', () => {
    const f = open(insights({ shipments: 0, spend: 0, couriers: [], late: [], lateCount: 0, needAnswer: [], needAnswerCount: 0, needAttention: 0 }));
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No bookings in this period.');
    expect(text).toContain('Nothing late');
  });
});
