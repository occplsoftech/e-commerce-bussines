import { FormControl } from '@angular/forms';
import { mobileValidator, normaliseMobile, pincodeValidator, positiveNumber, wholeNumber } from './booking-validators';

describe('booking validators', () => {
  it('accepts Indian pincodes and rejects malformed ones', () => {
    for (const ok of ['411016', '110001', ' 560001 ']) expect(pincodeValidator(new FormControl(ok))).toBeNull();
    for (const bad of ['011016', '41101', '4110160', '41A016']) expect(pincodeValidator(new FormControl(bad))).toEqual({ pincode: true });
  });

  it('accepts 10-digit mobiles with or without a +91 / 0 prefix', () => {
    for (const ok of ['9876543210', '+91 98765 43210', '09876543210', '91-9876543210']) {
      expect(mobileValidator(new FormControl(ok))).toBeNull();
    }
    for (const bad of ['5876543210', '98765', '98765432101']) expect(mobileValidator(new FormControl(bad))).toEqual({ mobile: true });
    expect(normaliseMobile('+91 98765-43210')).toBe('9876543210');
  });

  it('checks positive numbers, their maximum and decimal places', () => {
    const weight = positiveNumber(1000, 3);
    expect(weight(new FormControl(0.5))).toBeNull();
    expect(weight(new FormControl('12.125'))).toBeNull();
    expect(weight(new FormControl(0))).toEqual({ positive: true });
    expect(weight(new FormControl(-2))).toEqual({ positive: true });
    expect(weight(new FormControl(1001))).toEqual({ max: { max: 1000 } });
    expect(weight(new FormControl('1.2345'))).toEqual({ decimals: { decimals: 3 } });
  });

  it('checks whole package counts', () => {
    const count = wholeNumber(1, 999);
    expect(count(new FormControl(1))).toBeNull();
    expect(count(new FormControl(0))).not.toBeNull();
    expect(count(new FormControl(1.5))).not.toBeNull();
    expect(count(new FormControl(1000))).not.toBeNull();
  });
});
