import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { InternationalRates } from './international-rates';

const base = `${environment.apiBaseUrl}/customer-portal`;
const countries = [
  { id: 12, code: 'AU', name: 'AUSTRALIA', region: 'South West Pacific', postcodeRequired: true },
  { id: 2, code: 'AL', name: 'ALBANIA', region: 'Europe', postcodeRequired: false }
];
const opt = (name: string, total: number) => ({ optionId: name, providerCode: 'SKART', providerName: 'sKart International',
  serviceName: name, transportMode: 'AIR', etaMinDays: 4, etaMaxDays: 4, chargeableWeightKg: null, baseFreight: 0,
  otherCharges: 0, markupPercent: 10, markupAmount: 0, taxAmount: 0, totalAmount: total, currency: 'INR',
  breakdown: [{ label: 'Freight', component: 'FREIGHT', amount: total }], validUntil: null });

describe('InternationalRates', () => {
  let http: HttpTestingController;

  function create(list: unknown[] = countries) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(InternationalRates);
    fixture.detectChanges();
    http.expectOne(`${base}/international/countries`).flush({ data: list });
    fixture.detectChanges();
    return fixture;
  }

  it('says so when no international courier is connected', () => {
    const fixture = create([]);
    expect(fixture.nativeElement.textContent).toContain('has not connected an international courier');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('prices a parcel to a country, cheapest first, with the GST-inclusive total', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.form.patchValue({ originPincode: '110049', destinationCountry: 'australia', destinationPostcode: '3001', weightKg: 2, pieces: 2, maxLengthCm: 30 });
    c.check();
    const req = http.expectOne(`${base}/rates/international/estimate`);
    expect(req.request.body).toEqual({ originPincode: '110049', destinationCountry: 'AUSTRALIA', destinationPostcode: '3001',
      kind: 'PARCEL', weightKg: 2, pieces: 2, maxLengthCm: 30 });
    req.flush({ data: { quoteId: null, status: 'OPEN', options: [opt('DHL DEL', 2900), opt('Silver Line', 800)],
      unavailable: [] } });
    fixture.detectChanges();
    const names = Array.from(fixture.nativeElement.querySelectorAll('.rate h2') as NodeListOf<HTMLElement>).map((h) => h.textContent?.trim());
    expect(names).toEqual(['Silver Line', 'DHL DEL']);
    expect(fixture.nativeElement.textContent).toContain('International booking is coming soon');
  });

  it('needs a country from the list, and its postcode where the courier prices by postcode; a document sends one piece', () => {
    const c = create().componentInstance;
    c.form.patchValue({ originPincode: '110049', destinationCountry: 'Narnia', weightKg: 1 });
    c.check();
    expect(c.error()).toContain('Choose the country');
    c.form.patchValue({ destinationCountry: 'AUSTRALIA', destinationPostcode: '' });
    c.check();
    expect(c.error()).toContain('postcode');
    http.expectNone(`${base}/rates/international/estimate`);

    c.form.patchValue({ destinationCountry: 'ALBANIA', kind: 'DOCUMENT', pieces: 5, maxLengthCm: 40 });
    c.check();
    const req = http.expectOne(`${base}/rates/international/estimate`);
    expect(req.request.body).toMatchObject({ kind: 'DOCUMENT', pieces: 1, maxLengthCm: null, destinationPostcode: '' });
    req.flush({ data: { options: [], unavailable: [] } });
  });
});
