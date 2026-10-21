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

/** Pickup and delivery pincodes may be equal (same-city shipment), so no cross-field rule here. */
