import { BookingStatus } from '@core/models/portal.model';

/** Customer-facing wording and badge tone for each booking status. */
export const BOOKING_STATUS_VIEW: Record<BookingStatus, { label: string; tone: 'info' | 'warn' | 'ok' | 'bad' | '' }> = {
  PENDING: { label: 'Submitting', tone: 'info' },
  SUBMITTING: { label: 'Submitting', tone: 'info' },
  BOOKED: { label: 'Booked', tone: 'ok' },
  FAILED: { label: 'Not booked', tone: 'bad' },
  OUTCOME_UNKNOWN: { label: 'Awaiting confirmation', tone: 'warn' }
};
