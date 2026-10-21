import { RateOption } from '@core/models/portal.model';
import { sortOptions } from './compare-rates';

function option(id: string, provider: string, total: number, eta: number | null): RateOption {
  return { optionId: id, providerCode: provider, providerName: provider, serviceName: 'Std', transportMode: 'SURFACE',
    etaMinDays: eta, etaMaxDays: eta, chargeableWeightKg: 1, baseFreight: total, otherCharges: 0, markupPercent: null,
    markupAmount: 0, taxAmount: 0, totalAmount: total, currency: 'INR', breakdown: [], validUntil: null };
}

describe('sortOptions', () => {
  const options = [option('a', 'Shiprocket', 150, 2), option('b', 'Delhivery', 120, null), option('c', 'OCCPL Network', 180, 1)];

  it('sorts by lowest price', () => {
    expect(sortOptions(options, 'price').map((o) => o.optionId)).toEqual(['b', 'a', 'c']);
  });

  it('sorts by fastest delivery and never assumes an unknown estimate is fast', () => {
    expect(sortOptions(options, 'fastest').map((o) => o.optionId)).toEqual(['c', 'a', 'b']);
  });

  it('sorts by courier name', () => {
    expect(sortOptions(options, 'name').map((o) => o.optionId)).toEqual(['b', 'c', 'a']);
  });

  it('does not reorder the input', () => {
    sortOptions(options, 'price');
    expect(options.map((o) => o.optionId)).toEqual(['a', 'b', 'c']);
  });
});
