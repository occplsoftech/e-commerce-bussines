import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Stroke paths (24×24 grid) for every icon the portal uses — inline SVG, no icon font or external request. */
const PATHS: Record<string, string> = {
  add: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  arrow_forward: 'M5 12h14M13 6l6 6-6 6',
  arrow_back: 'M19 12H5M11 6l-6 6 6 6',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  print: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
  visibility: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  visibility_off: 'M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.7A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  local_shipping: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  inventory_2: 'M4 7l2-3h12l2 3M4 7h16v13H4zM9 11h6',
  hourglass_top: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
  task_alt: 'M21 11.1V12a9 9 0 1 1-5.3-8.2M8 11.5l3.5 3.5L21 5.5',
  error: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5v.5',
  sentiment_dissatisfied: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 10v.5M15 10v.5M8.5 16c1-1.3 2.2-2 3.5-2s2.5.7 3.5 2',
  compare_arrows: 'M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  space_dashboard: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
  add_box: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM12 8v8M8 12h8',
  storefront: 'M4 9l1.5-5h13L20 9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M5 12v8h14v-8M10 20v-5h4v5',
  event_available: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 3v4M16 3v4M4 10h16M9 15l2 2 4-4',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  block: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
  light_mode: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  dark_mode: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10',
  calculate: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  check_circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6',
  schedule: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  group: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5',
  chevron_left: 'M15 6l-6 6 6 6',
  chevron_right: 'M9 6l6 6-6 6'
};

@Component({
  selector: 'ecb-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path [attr.d]="path()" /></svg>`,
  styles: [`
    :host { display:inline-flex; width:1.25em; height:1.25em; flex:none; vertical-align:middle; }
    svg { width:100%; height:100%; }
  `]
})
export class Icon {
  readonly name = input.required<string>();
  protected readonly path = computed(() => PATHS[this.name()] ?? '');
}
