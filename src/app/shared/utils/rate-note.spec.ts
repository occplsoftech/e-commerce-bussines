import { minChargeNote } from './rate-note';

describe('minChargeNote', () => {
  it('names the minimum when the charged weight is above the parcel weight', () => {
    expect(minChargeNote({ chargeableWeightKg: 20 }, 5, 0.2)).toBe('Minimum chargeable weight 20 kg applies');
  });
  it('says nothing when the parcel weighs at least the charged weight', () => {
    expect(minChargeNote({ chargeableWeightKg: 5 }, 5, 0.2)).toBeNull();
    expect(minChargeNote({ chargeableWeightKg: 7.5 }, 2, 7.5)).toBeNull();
  });
  it('says nothing when the weights are unknown', () => {
    expect(minChargeNote({ chargeableWeightKg: null }, 5, 1)).toBeNull();
    expect(minChargeNote({ chargeableWeightKg: 20 }, null, null)).toBeNull();
  });
});
