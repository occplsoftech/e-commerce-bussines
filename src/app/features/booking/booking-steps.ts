import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export const BOOKING_STEPS = ['Shipment details', 'Compare rates', 'Select courier', 'Confirm booking', 'Booking result'] as const;

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
    .steps { list-style:none; margin:0; padding:0; display:flex; gap:8px; flex-wrap:wrap; }
    .steps li { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:var(--r-pill);
      background:var(--surface); border:1px solid var(--surface-border); font:600 13px var(--font-sans); color:var(--content-muted); }
    .steps__n { display:grid; place-items:center; width:22px; height:22px; border-radius:50%; background:var(--surface-muted); font-size:12px; }
    .steps li.current { border-color:var(--brand-300); color:var(--brand-700); background:var(--brand-50); }
    .steps li.current .steps__n { background:var(--brand-600); color:#fff; }
    .steps li.done .steps__n { background:var(--success); color:#fff; }
    @media (max-width: 700px) { .steps__label { display:none; } .steps li.current .steps__label { display:inline; } }
  `]
})
export class BookingSteps {
  readonly current = input.required<number>();
  protected readonly steps = BOOKING_STEPS;
}
