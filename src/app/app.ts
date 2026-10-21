import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingService } from '@core/services/loading.service';

/** Root shell: a top progress bar for in-flight requests, plus the router outlet. */
@Component({
  selector: 'ecb-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    @if (loading.loading()) { <div class="app-progress" role="progressbar" aria-label="Loading"></div> }
    <router-outlet />
  `,
  styles: [`
    .app-progress { position:fixed; top:0; left:0; right:0; height:3px; z-index:100;
      background:linear-gradient(90deg,var(--brand-400),var(--accent-500),var(--brand-600));
      background-size:200% 100%; animation:bar 1s linear infinite; }
    @keyframes bar { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    @media (prefers-reduced-motion: reduce) { .app-progress { animation:none; } }
  `]
})
export class App {
  protected readonly loading = inject(LoadingService);
}
