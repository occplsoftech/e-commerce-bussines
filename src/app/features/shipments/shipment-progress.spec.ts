import { BookingDetail, TrackingView } from '@core/models/portal.model';
import { shipmentProgress, stageOf } from './shipment-progress';

const booking = (over: Partial<BookingDetail> = {}): BookingDetail => ({
  bookingId: 'b1', quoteId: 'q1', status: 'BOOKED', providerCode: 'DELHIVERY', providerName: 'Delhivery', serviceName: 'Surface',
  transportMode: 'SURFACE', etaMinDays: 3, etaMaxDays: 4, bookingReference: null, trackingNumber: 'AWB1', labelDownloadable: true,
  message: null, pickup: { name: 'A', phone: '1', address: 'x', pincode: '411016', city: 'Pune', state: null },
  delivery: { name: 'B', phone: '2', address: 'y', pincode: '110001', city: 'Delhi', state: null }, parcel: null, charges: [],
  totalAmount: 100, currency: 'INR', submittedAt: null, bookedAt: '2026-10-20T05:00:00Z', createdAt: '2026-10-20T04:59:00Z', ...over
} as BookingDetail);
const tracking = (status: string | null, events: [string, string][]): TrackingView => ({
  bookingId: 'b1', providerName: 'Delhivery', trackingNumber: 'AWB1', available: true, status, currentLocation: null,
  retrievedAt: '', message: null, events: events.map(([s, at]) => ({ status: s, at, location: null, description: null }))
});
const states = (steps: { key: string; state: string }[]) => steps.map((s) => `${s.key}:${s.state}`);

describe('shipment progress', () => {
  it('reads common courier wording', () => {
    expect(stageOf('Pickup Scheduled')).toBe('BOOKED');
    expect(stageOf('Not Picked')).toBe('BOOKED');
    expect(stageOf('Picked Up')).toBe('PICKED_UP');
    expect(stageOf('In Transit')).toBe('IN_TRANSIT');
    expect(stageOf('Reached at destination hub')).toBe('IN_TRANSIT');
    expect(stageOf('Out For Delivery')).toBe('OUT_FOR_DELIVERY');
    expect(stageOf('Undelivered - customer not available')).toBe('OUT_FOR_DELIVERY');
    expect(stageOf('Delivered')).toBe('DELIVERED');
    expect(stageOf('RTO Delivered')).toBe('RETURNED');
    expect(stageOf('Cancelled')).toBe('CANCELLED');
    expect(stageOf('Something else')).toBeNull();
  });

  it('just booked: waiting for pickup, the rest to come', () => {
    expect(states(shipmentProgress(booking(), tracking('Manifested', [])))).toEqual(
      ['placed:done', 'booked:current', 'picked:todo', 'transit:todo', 'ofd:todo', 'delivered:todo']);
  });

  it('in transit: earlier steps done with their times, transit current', () => {
    const steps = shipmentProgress(booking(), tracking('In Transit', [
      ['In Transit', '2026-10-21T08:00:00Z'], ['Picked Up', '2026-10-20T12:00:00Z'], ['Manifested', '2026-10-20T06:00:00Z']]));
    expect(states(steps)).toEqual(['placed:done', 'booked:done', 'picked:done', 'transit:current', 'ofd:todo', 'delivered:todo']);
    expect(steps.find((s) => s.key === 'picked')!.at).toBe('2026-10-20T12:00:00Z');
  });

  it('delivered: every step done, even ones the courier never scanned', () => {
    expect(states(shipmentProgress(booking(), tracking('Delivered', [['Delivered', '2026-10-23T10:00:00Z']])))).toEqual(
      ['placed:done', 'booked:done', 'picked:done', 'transit:done', 'ofd:done', 'delivered:done']);
  });

  it('returned: the flow stops where it got to and ends in red', () => {
    expect(states(shipmentProgress(booking(), tracking('RTO Initiated', [
      ['RTO Initiated', '2026-10-23T10:00:00Z'], ['Out for delivery', '2026-10-22T10:00:00Z']])))).toEqual(
      ['placed:done', 'booked:done', 'picked:done', 'transit:done', 'ofd:done', 'returned:bad']);
  });

  it('a booking that did not go through, or is unconfirmed', () => {
    expect(states(shipmentProgress(booking({ status: 'FAILED', message: 'Pincode not serviceable' }), null)))
      .toEqual(['placed:done', 'booked:bad']);
    expect(states(shipmentProgress(booking({ status: 'OUTCOME_UNKNOWN' }), null)))
      .toEqual(['placed:done', 'booked:warn', 'picked:todo', 'transit:todo', 'ofd:todo', 'delivered:todo']);
  });
});
