import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CourierLogoStore } from '@core/services/courier-logo.store';

/** Badge colours per provider code (a monogram on this colour is shown when there is no logo file). */
const BRAND: Record<string, string> = {
  DELHIVERY: '#e2001a',
  SHIPROCKET: '#5b3df5',
  BLUEDART: '#0a4ea3',
  EKART: '#2874f0',
  OCCPL_NETWORK: '#b3123a'
};

/** A courier partner's logo as uploaded by the company, or a coloured monogram badge when there is none. */
@Component({
  selector: 'ecb-courier-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (file(); as f) {
      <img [src]="f" [alt]="name()" />
    } @else {
      <span class="mono" [style.background]="colour()" aria-hidden="true">{{ initials() }}</span>
      <span class="sr-only">{{ name() }}</span>
    }
  `,
  styles: [`
    :host { display:inline-grid; place-items:center; flex:none; width:var(--logo-size, 3rem); height:var(--logo-size, 3rem);
      border-radius:14px; background:#fff; border:1px solid var(--surface-border); overflow:hidden; }
    img { max-width:80%; max-height:80%; object-fit:contain; }
    .mono { display:grid; place-items:center; width:100%; height:100%; color:#fff; font:700 calc(var(--logo-size, 3rem) * .36) var(--font-sans); letter-spacing:.02em; }
  `]
})
export class CourierLogo {
  readonly code = input.required<string>();
  readonly name = input.required<string>();
  private readonly store = inject(CourierLogoStore);
  protected readonly file = computed(() => this.store.logos()[this.code()] ?? null);
  protected readonly colour = computed(() => BRAND[this.code()] ?? 'var(--occpl-color-accent)');
  protected readonly initials = computed(() => {
    const words = this.name().split(/[\s_-]+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : this.name().slice(0, 2)).toUpperCase();
  });
}
