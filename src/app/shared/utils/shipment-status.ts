import { ShipmentStatus } from '@core/models/portal.model';

/** Customer-facing wording and badge tone for each internal shipment status. */
export const STATUS_VIEW: Record<ShipmentStatus, { label: string; tone: 'info' | 'warn' | 'ok' | 'bad' | '' }> = {
  BOOKED: { label: 'Booked', tone: 'info' },
  READY_FOR_MANIFEST: { label: 'Booked', tone: 'info' },
  MANIFEST_CREATED: { label: 'In transit', tone: 'warn' },
  DISPATCHED: { label: 'In transit', tone: 'warn' },
  IN_SCAN: { label: 'In transit', tone: 'warn' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'warn' },
  DELIVERED: { label: 'Delivered', tone: 'ok' },
  RETURNED: { label: 'Returned', tone: 'bad' },
  CANCELLED: { label: 'Cancelled', tone: '' }
};
