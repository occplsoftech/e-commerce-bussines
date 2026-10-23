import { BookingStatus, DeliveryInfo, DeliveryStage } from '@core/models/portal.model';

/** Customer-facing wording and badge tone for each booking status. */
export const BOOKING_STATUS_VIEW: Record<BookingStatus, { label: string; tone: 'info' | 'warn' | 'ok' | 'bad' | '' }> = {
  PENDING: { label: 'Submitting', tone: 'info' },
  SUBMITTING: { label: 'Submitting', tone: 'info' },
  BOOKED: { label: 'Booked', tone: 'ok' },
  FAILED: { label: 'Not booked', tone: 'bad' },
  OUTCOME_UNKNOWN: { label: 'Awaiting confirmation', tone: 'warn' }
};

/** Customer-facing wording and badge tone for each delivery stage of a booked shipment. */
export const DELIVERY_STAGE_VIEW: Record<DeliveryStage, { label: string; tone: 'info' | 'warn' | 'ok' | 'bad' | '' }> = {
  AWAITING_PICKUP: { label: 'Awaiting pickup', tone: 'info' },
  PICKED_UP: { label: 'Picked up', tone: 'info' },
  IN_TRANSIT: { label: 'In transit', tone: 'info' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'warn' },
  DELIVERED: { label: 'Delivered', tone: 'ok' },
  RETURNED: { label: 'Returned', tone: 'bad' },
  CANCELLED: { label: 'Cancelled', tone: 'bad' }
};

/** One badge for a shipment: where it is once booked and its status is known, otherwise the booking's status. */
export function shipmentStatusView(b: { status: BookingStatus; deliveryStatus?: DeliveryInfo | null }) {
  return b.status === 'BOOKED' && b.deliveryStatus ? DELIVERY_STAGE_VIEW[b.deliveryStatus.stage] : BOOKING_STATUS_VIEW[b.status];
}
