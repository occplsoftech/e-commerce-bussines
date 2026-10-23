import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Icon } from '@shared/components/icon';
import { BookingDetail, TrackingEvent, TrackingView } from '@core/models/portal.model';

export type StepState = 'done' | 'current' | 'todo' | 'bad' | 'warn';
export interface ProgressStep { key: string; label: string; icon: string; state: StepState; at: string | null; note?: string; }

/** Where a courier's status text puts the shipment. Couriers word statuses differently, so this reads keywords. */
type Stage = 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';
const RANK: Record<Stage, number> = { BOOKED: 1, PICKED_UP: 2, IN_TRANSIT: 3, OUT_FOR_DELIVERY: 4, DELIVERED: 5, RETURNED: 5, CANCELLED: 5 };

export function stageOf(text: string | null | undefined): Stage | null {
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return null;
  if (/\b(rto|return(ed)?( to origin)?|returning)\b/.test(t)) return 'RETURNED';
  if (/cancel/.test(t)) return 'CANCELLED';
  if (/\b(un|not |non[- ]?)delivered\b|delivery (failed|attempt)|undeliver/.test(t)) return 'OUT_FOR_DELIVERY';
  if (/\bdelivered\b/.test(t)) return 'DELIVERED';
  if (/not picked|pickup (failed|pending|scheduled|rescheduled)|awaiting pickup/.test(t)) return 'BOOKED';
  if (/out for delivery|\bofd\b|dispatched for delivery/.test(t)) return 'OUT_FOR_DELIVERY';
  if (/in[- ]?transit|transit|reached|arrived|dispatched|shipped|departed|forwarded|connected|bagged|hub/.test(t)) return 'IN_TRANSIT';
  if (/picked|pickup (done|complete)|collected|received at origin|origin scan/.test(t)) return 'PICKED_UP';
  if (/manifest|pickup|booked|created|scheduled|pending|ready/.test(t)) return 'BOOKED';
  return null;
}

/**
 * The shipment's journey as steps: placed → booked → picked up → in transit → out for delivery → delivered, with the
 * time each was reached when the courier's events say so. A failed booking, a return or a cancellation ends the flow
 * early in red.
 */
export function shipmentProgress(b: BookingDetail, t: TrackingView | null | undefined): ProgressStep[] {
  const steps: ProgressStep[] = [{ key: 'placed', label: 'Order placed', icon: 'description', state: 'done', at: b.createdAt }];

  if (b.status === 'FAILED') {
    steps.push({ key: 'booked', label: 'Not booked', icon: 'error', state: 'bad', at: null, note: b.message ?? undefined });
    return steps;
  }
  if (b.status !== 'BOOKED') {
    const unknown = b.status === 'OUTCOME_UNKNOWN';
    steps.push({ key: 'booked', label: unknown ? 'Awaiting confirmation' : 'Booking with courier', icon: 'hourglass_top',
      state: unknown ? 'warn' : 'current', at: null });
    return [...steps, ...pending(['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'])];
  }

  // Oldest first: the first event that reaches a stage gives that stage its time.
  const events: TrackingEvent[] = [...(t?.events ?? [])].reverse();
  const reachedAt = new Map<Stage, string | null>();
  let top: Stage = 'BOOKED';
  for (const e of events) {
    const s = stageOf(e.status) ?? stageOf(e.description);
    if (!s) continue;
    if (!reachedAt.has(s)) reachedAt.set(s, e.at);
    if (RANK[s] >= RANK[top] || s === 'RETURNED' || s === 'CANCELLED') top = s;
  }
  const current = stageOf(t?.status);
  if (current && (RANK[current] >= RANK[top] || current === 'RETURNED' || current === 'CANCELLED')) top = current;

  steps.push({ key: 'booked', label: 'Booked', icon: 'check_circle', state: 'done', at: b.bookedAt ?? b.createdAt });
  const flow: (keyof typeof META)[] = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const ended = top === 'RETURNED' || top === 'CANCELLED';
  const topRank = ended ? Math.max(1, ...[...reachedAt.keys()].filter((s) => s !== 'RETURNED' && s !== 'CANCELLED').map((s) => RANK[s])) : RANK[top];

  for (const s of flow) {
    if (ended && RANK[s] > topRank) break;
    const reached = RANK[s] <= topRank;
    // Later stages imply the earlier ones even when the courier never sent that scan.
    steps.push({ ...META[s], state: reached ? (RANK[s] === topRank && s !== 'DELIVERED' && !ended ? 'current' : 'done') : 'todo',
      at: reached ? reachedAt.get(s) ?? null : null });
  }
  if (ended) {
    steps.push({ key: top.toLowerCase(), label: top === 'RETURNED' ? 'Returned to origin' : 'Cancelled',
      icon: top === 'RETURNED' ? 'undo' : 'block', state: 'bad', at: reachedAt.get(top) ?? null });
  }
  if (topRank === RANK.BOOKED && !ended) {
    steps[1] = { ...steps[1], state: 'current', note: 'Waiting for pickup' };
  }
  return steps;
}

const META: Record<'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED', { key: string; label: string; icon: string }> = {
  PICKED_UP: { key: 'picked', label: 'Picked up', icon: 'inventory_2' },
  IN_TRANSIT: { key: 'transit', label: 'In transit', icon: 'local_shipping' },
  OUT_FOR_DELIVERY: { key: 'ofd', label: 'Out for delivery', icon: 'location_on' },
  DELIVERED: { key: 'delivered', label: 'Delivered', icon: 'home' }
};

function pending(stages: (keyof typeof META)[]): ProgressStep[] {
  return stages.map((s) => ({ ...META[s], state: 'todo' as const, at: null }));
}

/** The status flow as a horizontal stepper (vertical on phones). */
@Component({
  selector: 'ecb-shipment-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, DatePipe],
  template: `
    <ol class="flow" aria-label="Shipment status">
      @for (s of steps(); track s.key) {
        <li [class]="'step step--' + s.state" [attr.aria-current]="s.state === 'current' ? 'step' : null">
          <span class="dot"><ecb-icon [name]="s.state === 'done' && s.key !== 'delivered' ? 'check_circle' : s.icon" /></span>
          <span class="label">{{ s.label }}</span>
          @if (s.at) { <time class="at" [attr.datetime]="s.at">{{ s.at | date: 'd MMM, h:mm a' }}</time> }
          @else if (s.note) { <span class="at">{{ s.note }}</span> }
        </li>
      }
    </ol>
  `,
  styles: [`
    .flow { list-style:none; margin:0; padding:4px 0 0; display:flex; }
    .step { position:relative; flex:1 1 0; min-width:0; display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px; }
    .step:not(:first-child)::before { content:''; position:absolute; top:20px; right:50%; left:-50%; height:3px; border-radius:2px;
      background:var(--surface-border); z-index:0; }
    .step--done::before, .step--current::before { background:var(--success) !important; }
    .step--bad::before { background:var(--danger) !important; }
    .step--warn::before { background:var(--warning) !important; }
    .dot { position:relative; z-index:1; display:grid; place-items:center; width:42px; height:42px; border-radius:50%; font-size:20px;
      background:var(--surface-muted); color:var(--content-muted); border:2px solid var(--surface-border); }
    .step--done .dot { background:var(--success-bg); color:var(--success); border-color:var(--success); }
    .step--current .dot { background:var(--occpl-gradient-button); color:#fff; border-color:transparent;
      box-shadow:0 0 0 5px color-mix(in srgb, var(--brand-500) 20%, transparent); }
    .step--bad .dot { background:var(--danger-bg); color:var(--danger); border-color:var(--danger); }
    .step--warn .dot { background:var(--warning-bg); color:var(--warning); border-color:var(--warning); }
    .label { font:700 13px var(--font-sans); color:var(--content-fg); }
    .step--todo .label { color:var(--content-muted); font-weight:600; }
    .step--bad .label { color:var(--danger); } .step--current .label { color:var(--brand-700); }
    .at { font:500 12px var(--font-sans); color:var(--content-muted); }
    @media (max-width: 640px) {
      .flow { flex-direction:column; gap:0; }
      .step { flex-direction:row; text-align:left; gap:12px; padding-bottom:18px; align-items:center; flex-wrap:wrap; }
      .step:not(:first-child)::before { top:-18px; bottom:auto; left:19px; right:auto; width:3px; height:18px; }
      .dot { width:40px; height:40px; }
      .at { flex-basis:100%; padding-left:52px; margin-top:-14px; }
    }
  `]
})
export class ShipmentProgress {
  readonly booking = input.required<BookingDetail>();
  readonly tracking = input<TrackingView | null | undefined>(undefined);
  readonly steps = computed(() => shipmentProgress(this.booking(), this.tracking()));
}
