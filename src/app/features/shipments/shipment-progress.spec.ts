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

  it('returning: the flow stops where it got to and ends in amber "Returning to you", with the return charge', () => {
    const steps = shipmentProgress(booking({ rtoCharge: 110 }), tracking('RTO Initiated', [
      ['RTO Initiated', '2026-10-23T10:00:00Z'], ['Out for delivery', '2026-10-22T10:00:00Z']]));
    expect(states(steps)).toEqual(['placed:done', 'booked:done', 'picked:done', 'transit:done', 'ofd:done', 'returned:warn']);
    const last = steps[steps.length - 1];
    expect(last.label).toBe('Returning to you');
    expect(last.note).toBe('Return charge ₹110.00 taken from your wallet');
  });

  it('returned: once the courier (or our branch) says it is back, it ends in red "Returned to you"', () => {
    const courier = shipmentProgress(booking(), tracking('RTO Delivered', [
      ['RTO Delivered', '2026-10-25T10:00:00Z'], ['RTO Initiated', '2026-10-23T10:00:00Z']]));
    expect(courier[courier.length - 1]).toEqual(expect.objectContaining({ label: 'Returned to you', state: 'bad' }));
    const ours = shipmentProgress(booking({ providerCode: 'OCCPL_NETWORK' }), tracking('Returned to you (RTO delivered)', [
      ['Returned', '2026-10-25T10:00:00Z'], ['In Scan', '2026-10-21T10:00:00Z']]));
    expect(ours[ours.length - 1].label).toBe('Returned to you');
  });

  it('without a live answer, uses the status the server last saved', () => {
    const b = booking({ deliveryStatus: { stage: 'OUT_FOR_DELIVERY', text: 'Out for delivery', location: 'Delhi',
      at: '2026-10-22T09:00:00Z', checkedAt: '2026-10-22T09:05:00Z' } });
    const steps = shipmentProgress(b, null);
    expect(states(steps)).toEqual(['placed:done', 'booked:done', 'picked:done', 'transit:done', 'ofd:current', 'delivered:todo']);
    expect(steps.find((s) => s.key === 'ofd')!.at).toBe('2026-10-22T09:00:00Z');
    expect(states(shipmentProgress(booking({ deliveryStatus: { stage: 'AWAITING_PICKUP', text: null, location: null, at: null,
      checkedAt: null } }), undefined))).toEqual(['placed:done', 'booked:current', 'picked:todo', 'transit:todo', 'ofd:todo', 'delivered:todo']);
  });

  it('a booking that did not go through, or is unconfirmed', () => {
    expect(states(shipmentProgress(booking({ status: 'FAILED', message: 'Pincode not serviceable' }), null)))
      .toEqual(['placed:done', 'booked:bad']);
    expect(states(shipmentProgress(booking({ status: 'OUTCOME_UNKNOWN' }), null)))
      .toEqual(['placed:done', 'booked:warn', 'picked:todo', 'transit:todo', 'ofd:todo', 'delivered:todo']);
  });

  const failed = { attempts: 1, reason: 'Receiver not available', note: null, at: '2026-11-06T11:41:00Z', open: true, returnFlagged: false,
    choice: null, choiceLabel: null, choiceDate: null, receiverAddress: null, receiverPhone: null };

  it('shows a red "Delivery failed" step instead of "Out for delivery" while a failed attempt waits', () => {
    const steps = shipmentProgress(booking({ deliveryIssue: failed }), tracking('In scan', [
      ['Out for delivery', '2026-11-06T11:00:00Z'], ['In scan', '2026-11-06T11:41:00Z']]));
    expect(states(steps)).toEqual(['placed:done', 'booked:done', 'picked:done', 'transit:done', 'ofd:bad', 'delivered:todo']);
    const ofd = steps.find((x) => x.key === 'ofd')!;
    expect(ofd.label).toBe('Delivery failed');
    expect(ofd.note).toContain('Receiver not available');
  });

  it('notes the customer\'s answer on the failed step, and goes back to normal once the case is closed', () => {
    const answered = shipmentProgress(booking({ deliveryIssue: { ...failed, attempts: 2, choice: 'REATTEMPT', choiceLabel: 'Deliver again' } }),
      tracking('In scan', [['In scan', '2026-11-06T11:41:00Z']]));
    expect(answered.find((x) => x.key === 'ofd')!.note).toBe('Receiver not available · attempt 2 · you asked: Deliver again');

    const delivered = shipmentProgress(booking({ deliveryIssue: { ...failed, open: false } }),
      tracking('Delivered', [['Delivered', '2026-11-07T10:00:00Z']]));
    expect(delivered.find((x) => x.key === 'ofd')!.label).toBe('Out for delivery');
  });
});
