import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export const BOOKING_STEPS = ['Shipment details', 'Compare & select', 'Confirm booking', 'Booking result'] as const;

/** The five-step booking progress bar. On phones only the current step's label is shown. */
@Component({
  selector: 'ecb-booking-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="steps" aria-label="Booking steps">
      @for (s of steps; track s; let i = $index) {
        <li [class.current]="i === current()" [class.done]="i < current()" [attr.aria-current]="i === current() ? 'step' : null">
          <span class="steps__n">{{ i < current() ? '✓' : i + 1 }}</span><span class="steps__label">{{ s }}</span>
        </li>
      }
    </ol>
  `,
  styles: [`
    :host { display:block; }
    .steps { list-style:none; margin:0; padding:14px 20px; display:flex; align-items:center; gap:0; overflow-x:auto;
      background:var(--occpl-color-surface-glass); backdrop-filter:blur(10px); border:1px solid var(--surface-border);
      border-radius:var(--r-card); box-shadow:var(--shadow-sm); }
    .steps li { display:flex; align-items:center; gap:10px; flex:1 1 auto; min-width:0; font:600 .9rem var(--font-sans); color:var(--content-muted); white-space:nowrap; }
    .steps li:last-child { flex:0 0 auto; }
    .steps li:not(:last-child)::after { content:''; flex:1 1 24px; min-width:20px; height:3px; margin:0 12px; border-radius:3px; background:var(--surface-border); }
    .steps li.done:not(:last-child)::after { background:var(--occpl-gradient-button); }
    .steps__n { display:grid; place-items:center; flex:none; width:2rem; height:2rem; border-radius:50%; background:var(--occpl-color-neutral-surface);
      border:1px solid var(--surface-border); font:700 .85rem var(--font-sans); }
    .steps li.current { color:var(--content-fg); }
    .steps li.current .steps__n { background:var(--occpl-gradient-button); border-color:transparent; color:#fff; box-shadow:0 0 0 4px var(--occpl-color-info-surface); }
    .steps li.done { color:var(--content-fg); }
    .steps li.done .steps__n { background:var(--success-bg); border-color:var(--success); color:var(--success); }
    @media (max-width: 56rem) { .steps__label { display:none; } .steps li.current .steps__label { display:inline; } .steps li:not(:last-child)::after { margin:0 8px; } }
  `]
})
export class BookingSteps {
  readonly current = input.required<number>();
  protected readonly steps = BOOKING_STEPS;
}
