import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

export interface TimelineItem { at: string | null; status: string | null; location: string | null; description?: string | null; }

/** A vertical list of tracking events, newest first; the first is highlighted as the latest. */
@Component({
  selector: 'ecb-tracking-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (items().length === 0) {
      <p class="text-caption">No tracking updates yet.</p>
    } @else {
      <ol class="timeline">
        @for (e of items(); track $index) {
          <li [class.latest]="$first">
            <span class="dot" aria-hidden="true"></span>
            <div>
              <div class="status">{{ e.status || 'Update' }}</div>
              <div class="meta">
                @if (e.at) { <time [attr.datetime]="e.at">{{ e.at | date: 'medium' }}</time> }
                @if (e.location) { <span>· {{ e.location }}</span> }
              </div>
              @if (e.description) { <div class="desc">{{ e.description }}</div> }
            </div>
          </li>
        }
      </ol>
    }
  `,
  styles: [`
    .timeline { list-style:none; margin:0; padding:0; }
    li { position:relative; display:flex; gap:14px; padding:0 0 18px 0; }
    li:not(:last-child)::before { content:''; position:absolute; left:6px; top:16px; bottom:0; width:2px; background:var(--surface-border); }
    .dot { flex:none; width:14px; height:14px; margin-top:3px; border-radius:50%; background:var(--surface-border); }
    li.latest .dot { background:var(--brand-600); box-shadow:0 0 0 4px var(--brand-50); }
    .status { font:600 14px var(--font-sans); }
    li.latest .status { color:var(--brand-700); }
    .meta, .desc { font:400 13px var(--font-sans); color:var(--content-muted); display:flex; gap:4px; flex-wrap:wrap; }
  `]
})
export class TrackingTimeline {
  readonly items = input.required<TimelineItem[]>();
}
