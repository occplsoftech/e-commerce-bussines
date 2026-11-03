import { RateOption } from '@core/models/portal.model';

/**
 * "Minimum chargeable weight 20 kg applies" when an option is charged for more than the parcel's own weight (actual or volumetric),
 * which only happens when the rate card has a minimum chargeable weight. Null otherwise.
 */
export function minChargeNote(o: Pick<RateOption, 'chargeableWeightKg'>, actualKg: number | null | undefined, volumetricKg: number | null | undefined): string | null {
  const charged = o.chargeableWeightKg;
  if (charged === null || charged === undefined) return null;
  const own = Math.max(actualKg ?? 0, volumetricKg ?? 0);
  if (own <= 0 || charged <= own + 0.0005) return null;
  return `Minimum chargeable weight ${Number(charged.toFixed(3))} kg applies`;
}
