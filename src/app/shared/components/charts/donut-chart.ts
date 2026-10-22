import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ChartSlice } from './chart-series';

/** A donut (pie with a hole) with the total in the middle and a legend with each share. Inline SVG, no library. */
@Component({
  selector: 'ecb-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <div class="donut">
      <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="ariaLabel()">
        <circle cx="60" cy="60" r="44" class="track" />
        @for (a of arcs(); track a.label) {
          <circle cx="60" cy="60" r="44" class="arc" [style.stroke]="a.color"
                  [attr.stroke-dasharray]="a.dash + ' ' + (C - a.dash)" [attr.stroke-dashoffset]="-a.offset" transform="rotate(-90 60 60)">
            <title>{{ a.label }}: {{ a.value }} ({{ a.pct | number: '1.0-0' }}%)</title>
          </circle>
        }
        <text x="60" y="58" text-anchor="middle" class="total">{{ total() }}</text>
        <text x="60" y="74" text-anchor="middle" class="caption">{{ centerLabel() }}</text>
      </svg>
      <ul class="legend">
        @for (a of arcs(); track a.label) {
          <li><span class="swatch" [style.background]="a.color"></span><span class="name">{{ a.label }}</span>
            <span class="num">{{ a.value }} <small>{{ a.pct | number: '1.0-0' }}%</small></span></li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .donut { display:flex; align-items:center; gap:24px; flex-wrap:wrap; justify-content:center; }
    svg { width:min(12rem, 100%); flex:none; }
    .track { fill:none; stroke:var(--occpl-color-neutral-surface); stroke-width:16; }
    .arc { fill:none; stroke-width:16; stroke-linecap:butt; }
    .total { fill:var(--content-fg); font:800 24px var(--font-display); }
    .caption { fill:var(--content-muted); font:600 8px var(--font-sans); letter-spacing:.08em; text-transform:uppercase; }
    .legend { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; min-width:11rem; flex:1; }
    .legend li { display:flex; align-items:center; gap:10px; font:500 .95rem var(--font-sans); }
    .swatch { width:.8rem; height:.8rem; border-radius:4px; flex:none; }
    .name { flex:1; }
    .num { font:800 1rem var(--font-sans); } .num small { font-weight:600; color:var(--content-muted); margin-left:4px; }
  `]
})
export class DonutChart {
  readonly data = input.required<ChartSlice[]>();
  readonly ariaLabel = input('Donut chart');
  readonly centerLabel = input('Total');

  protected readonly C = 2 * Math.PI * 44;
  protected readonly total = computed(() => this.data().reduce((n, s) => n + s.value, 0));

  protected readonly arcs = computed(() => {
    const total = this.total();
    let offset = 0;
    return this.data().filter((s) => s.value > 0).map((s) => {
      const dash = total ? (s.value / total) * this.C : 0;
      const arc = { ...s, dash, offset, pct: total ? (s.value / total) * 100 : 0 };
      offset += dash;
      return arc;
    });
  });
}
