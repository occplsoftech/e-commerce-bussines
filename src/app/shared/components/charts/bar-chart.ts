import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartSlice } from './chart-series';

/** A bar per slice, each in its own colour, with grid lines and the value above every bar. Inline SVG, no library. */
@Component({
  selector: 'ecb-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="ariaLabel()" preserveAspectRatio="xMidYMid meet">
      @for (t of ticks(); track t.value) {
        <line [attr.x1]="L" [attr.x2]="W - R" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" />
        <text [attr.x]="L - 8" [attr.y]="t.y + 4" class="axis" text-anchor="end">{{ t.value }}</text>
      }
      @for (b of bars(); track b.label) {
        <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="8" [style.fill]="b.color">
          <title>{{ b.label }}: {{ b.value }}</title>
        </rect>
        <text [attr.x]="b.x + b.w / 2" [attr.y]="b.y - 8" class="val" text-anchor="middle">{{ b.value }}</text>
        <text [attr.x]="b.x + b.w / 2" [attr.y]="H - 12" class="axis" text-anchor="middle">{{ b.label }}</text>
      }
    </svg>
  `,
  styles: [`
    :host { display:block; }
    svg { width:100%; height:auto; display:block; }
    .grid { stroke:var(--surface-border); stroke-dasharray:4 5; }
    .axis { fill:var(--content-muted); font:600 12px var(--font-sans); }
    .val { fill:var(--content-fg); font:800 15px var(--font-sans); }
  `]
})
export class BarChart {
  readonly data = input.required<ChartSlice[]>();
  readonly ariaLabel = input('Bar chart');

  protected readonly W = 560;
  protected readonly H = 280;
  protected readonly L = 40;
  protected readonly R = 12;
  private readonly top = 28;
  private readonly bottom = 40;

  private readonly max = computed(() => {
    const m = Math.max(0, ...this.data().map((d) => d.value));
    return Math.max(4, Math.ceil(m / 4) * 4);
  });

  protected readonly ticks = computed(() => {
    const max = this.max();
    return [0, 1, 2, 3, 4].map((i) => ({ value: (max / 4) * i, y: this.y((max / 4) * i) }));
  });

  protected readonly bars = computed(() => {
    const d = this.data();
    const slot = (this.W - this.L - this.R) / Math.max(1, d.length);
    const w = Math.min(54, slot * 0.6);
    return d.map((s, i) => {
      const y = this.y(s.value);
      return { ...s, x: this.L + slot * i + (slot - w) / 2, w, y, h: Math.max(this.y(0) - y, s.value > 0 ? 3 : 0) };
    });
  });

  private y(v: number): number {
    return this.top + (this.H - this.top - this.bottom) * (1 - v / this.max());
  }
}
