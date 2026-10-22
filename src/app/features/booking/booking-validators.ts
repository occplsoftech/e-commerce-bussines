import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Indian PIN code: six digits, first not zero. */
export const PINCODE = /^[1-9][0-9]{5}$/;
/** Indian mobile number: ten digits starting 6-9 (an optional +91 / 0 prefix is stripped first). */
export const MOBILE = /^[6-9][0-9]{9}$/;

export function normaliseMobile(value: string): string {
  return value.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=[6-9][0-9]{9}$)/, '');
}

export const pincodeValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  !c.value || PINCODE.test(String(c.value).trim()) ? null : { pincode: true };

export const mobileValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  !c.value || MOBILE.test(normaliseMobile(String(c.value))) ? null : { mobile: true };

/** A positive number with at most `decimals` decimal places and at most `max`. */
export function positiveNumber(max: number, decimals: number): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    if (c.value === null || c.value === undefined || c.value === '') return null;
    const n = Number(c.value);
    if (!Number.isFinite(n) || n <= 0) return { positive: true };
    if (n > max) return { max: { max } };
    const [, frac = ''] = String(c.value).split('.');
    return frac.length > decimals ? { decimals: { decimals } } : null;
  };
}

/** A whole number from `min` to `max`. */
export function wholeNumber(min: number, max: number): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    if (c.value === null || c.value === undefined || c.value === '') return null;
    const n = Number(c.value);
    return Number.isInteger(n) && n >= min && n <= max ? null : { whole: { min, max } };
  };
}

/** Letters and digits only, lower case: so "Office 4, Thorat Chowk." and "office 4 thorat  chowk" compare equal. */
function squash(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Pickup and delivery must be two different places. The same pincode is fine (same-city shipment); the same pincode with
 * the same address text is not. The server enforces this too.
 */
export const differentAddresses: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const pickup = group.get('pickup');
  const delivery = group.get('delivery');
  if (!pickup || !delivery) return null;
  const a = squash(pickup.get('address')?.value);
  const b = squash(delivery.get('address')?.value);
  if (!a || !b) return null;
  return a === b && squash(pickup.get('pincode')?.value) === squash(delivery.get('pincode')?.value) ? { sameAddress: true } : null;
};
