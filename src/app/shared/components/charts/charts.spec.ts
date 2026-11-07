import { TestBed } from '@angular/core/testing';
import { BarChart } from './bar-chart';
import { DonutChart } from './donut-chart';
import { SpendChart } from './spend-chart';
import { ChartSlice } from './chart-series';

const data: ChartSlice[] = [
  { label: 'Booked', value: 10, color: 'red' }, { label: 'Delivered', value: 30, color: 'green' }, { label: 'Returned', value: 0, color: 'blue' }
];

describe('charts', () => {
  it('draws one bar per slice, tallest for the largest value, none for zero', () => {
    const f = TestBed.createComponent(BarChart);
    f.componentRef.setInput('data', data);
    f.detectChanges();
    const rects = f.nativeElement.querySelectorAll('rect') as NodeListOf<SVGRectElement>;
    expect(rects.length).toBe(3);
    const h = (i: number) => Number(rects[i].getAttribute('height'));
    expect(h(1)).toBeGreaterThan(h(0));
    expect(h(2)).toBe(0);
  });

  it('draws the donut with the total in the middle and a legend share per non-empty slice', () => {
    const f = TestBed.createComponent(DonutChart);
    f.componentRef.setInput('data', data);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.total').textContent).toBe('40');
    expect(f.nativeElement.querySelectorAll('.legend li').length).toBe(2);
    expect(f.nativeElement.querySelector('.legend').textContent).toContain('75%');
  });
});


describe('SpendChart', () => {
  it('draws a bar per day with a rounded rupee scale and the exact figure on hover', () => {
    const f = TestBed.createComponent(SpendChart);
    f.componentRef.setInput('data', [{ date: '2026-11-06', spend: 0, shipments: 0 }, { date: '2026-11-07', spend: 340.5, shipments: 2 }]);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('rect').length).toBe(2);
    expect(el.querySelector('rect:last-of-type title')?.textContent).toContain('₹340.50 · 2 shipments');
    expect(Array.from(el.querySelectorAll('text')).map((t) => t.textContent)).toContain('₹400');
  });
});
