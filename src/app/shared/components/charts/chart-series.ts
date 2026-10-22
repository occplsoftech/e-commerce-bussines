/** One bar or slice: a label, its value and a CSS colour (a design token such as `var(--occpl-color-sky)`). */
export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}
