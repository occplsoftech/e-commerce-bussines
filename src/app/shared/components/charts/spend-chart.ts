import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One bar: a day or a week, its spend and how many shipments. */
export interface SpendBar { date: string; spend: number; shipments: number; }

/**
 * Spend over time: one thin bar per day (or week), rupee grid lines, a few date labels along the bottom and the exact figure on hover.
 * Inline SVG, no library; the bars stay readable from 7 to 31 of them.
 */
@Component({
  selector: 'ecb-spend-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="ariaLabel()" preserveAspectRatio="xMidYMid meet">
      @for (t of ticks(); track t.value) {
        <line [attr.x1]="L" [attr.x2]="W - R" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" />
        <text [attr.x]="L - 8" [attr.y]="t.y + 4" class="axis" text-anchor="end">{{ t.label }}</text>
      }
      @for (b of bars(); track b.date) {
        <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="3" class="bar">
          <title>{{ b.title }}</title>
        </rect>
        @if (b.showLabel) {
          <text [attr.x]="b.x + b.w / 2" [attr.y]="H - 10" class="axis" text-anchor="middle">{{ b.label }}</text>
        }
      }
    </svg>
  `,
  styles: [`
    :host { display:block; }
    svg { width:100%; height:auto; display:block; }
    .grid { stroke:var(--surface-border); stroke-dasharray:4 5; }
    .axis { fill:var(--content-muted); font:600 11px var(--font-sans); }
    .bar { fill:var(--occpl-color-primary); }
    .bar:hover { fill:var(--occpl-color-accent); }
  `]
})
export class SpendChart {
  readonly data = input.required<SpendBar[]>();
  /** Weekly bars are labelled "w/c 3 Nov". */
  readonly weekly = input(false);
  readonly ariaLabel = input('Spend over time');

  protected readonly W = 600;
  protected readonly H = 240;
  protected readonly L = 56;
  protected readonly R = 8;
  private readonly top = 14;
  private readonly bottom = 30;

  /** A round top for the grid: 1, 2 or 5 times a power of ten, at least ₹100. */
  private readonly max = computed(() => {
    const m = Math.max(0, ...this.data().map((d) => d.spend));
    if (m <= 100) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(m)));
    const step = [1, 2, 5, 10].map((k) => k * p).find((s) => s * 4 >= m) ?? 10 * p;
    return step * 4;
  });

  protected readonly ticks = computed(() => {
    const max = this.max();
    return [0, 1, 2, 3, 4].map((i) => {
      const value = (max / 4) * i;
      return { value, y: this.y(value), label: '₹' + (value >= 1000 ? `${Math.round(value / 100) / 10}k` : Math.round(value)) };
    });
  });

  protected readonly bars = computed(() => {
    const d = this.data();
    const slot = (this.W - this.L - this.R) / Math.max(1, d.length);
    const w = Math.max(3, Math.min(28, slot * 0.7));
    const every = d.length <= 8 ? 1 : d.length <= 16 ? 2 : Math.ceil(d.length / 6);
    return d.map((p, i) => {
      const y = this.y(p.spend);
      const day = new Date(p.date + 'T00:00:00');
      const label = day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const money = '₹' + p.spend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return {
        date: p.date, x: this.L + slot * i + (slot - w) / 2, w, y, h: Math.max(this.y(0) - y, p.spend > 0 ? 2 : 0),
        label: this.weekly() ? 'w/c ' + label : label,
        showLabel: i % every === 0 || i === d.length - 1 && d.length <= 8,
        title: `${this.weekly() ? 'Week of ' : ''}${label}: ${money} · ${p.shipments} shipment${p.shipments === 1 ? '' : 's'}`
      };
    });
  });

  private y(v: number): number {
    return this.top + (this.H - this.top - this.bottom) * (1 - v / this.max());
  }
}
