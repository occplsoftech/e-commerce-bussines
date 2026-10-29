import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '@shared/components/icon';

export interface BannerChip { icon: string; text: string; }

/** Where the parcel starts and ends: two pincodes joined by a dashed road with a truck on it, and a few facts underneath. */
@Component({
  selector: 'ecb-route-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="rb" role="img" [attr.aria-label]="'Route from ' + (fromPin() || 'pickup') + ' to ' + (toPin() || 'delivery')">
      <div class="rb__end">
        <span class="rb__dot"><ecb-icon name="location_on" /></span>
        <span class="rb__label">Pickup</span>
        <strong class="rb__pin">{{ fromPin() || '······' }}</strong>
        <span class="rb__place">{{ fromPlace() || 'Enter the pincode' }}</span>
      </div>
      <div class="rb__road" aria-hidden="true">
        <span class="rb__line"></span>
        <span class="rb__truck"><ecb-icon name="local_shipping" /></span>
      </div>
      <div class="rb__end rb__end--to">
        <span class="rb__dot rb__dot--to"><ecb-icon name="home" /></span>
        <span class="rb__label">Delivery</span>
        <strong class="rb__pin">{{ toPin() || '······' }}</strong>
        <span class="rb__place">{{ toPlace() || 'Enter the pincode' }}</span>
      </div>
      @if (chips().length) {
        <ul class="rb__chips">
          @for (c of chips(); track c.text) { <li><ecb-icon [name]="c.icon" /> {{ c.text }}</li> }
        </ul>
      }
    </div>
  `,
  styles: [`
    :host { display:block; }
    .rb { position:relative; overflow:hidden; color:#fff; border-radius:var(--r-card); padding:22px 28px 18px;
      background:var(--occpl-gradient-brand); box-shadow:var(--shadow-md);
      display:grid; grid-template-columns:minmax(0,1fr) minmax(80px,2fr) minmax(0,1fr); align-items:center; gap:8px 18px; }
    .rb::before { content:''; position:absolute; inset:0; pointer-events:none;
      background:radial-gradient(420px 220px at 85% -10%, rgb(255 255 255 / 20%), transparent 70%), radial-gradient(360px 200px at 0% 110%, rgb(255 255 255 / 12%), transparent 70%); }
    .rb > * { position:relative; }
    .rb__end { display:flex; flex-direction:column; gap:2px; min-width:0; }
    .rb__end--to { text-align:right; align-items:flex-end; }
    .rb__dot { display:grid; place-items:center; width:2.4rem; height:2.4rem; border-radius:50%; background:rgb(255 255 255 / 20%); border:1px solid rgb(255 255 255 / 40%); font-size:1.1rem; margin-bottom:4px; }
    .rb__label { font:600 .72rem var(--font-sans); letter-spacing:.1em; text-transform:uppercase; opacity:.8; }
    .rb__pin { font:800 clamp(1.5rem, 3.4vw, 2.2rem)/1.1 var(--font-display); letter-spacing:.06em; }
    .rb__place { font:500 .85rem var(--font-sans); opacity:.9; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
    .rb__road { position:relative; height:2.4rem; }
    .rb__line { position:absolute; left:0; right:0; top:50%; border-top:3px dashed rgb(255 255 255 / 55%); transform:translateY(-50%); }
    .rb__truck { position:absolute; top:50%; left:0; transform:translateY(-50%); display:grid; place-items:center; width:2.4rem; height:2.4rem; border-radius:50%;
      background:#fff; color:var(--occpl-color-primary-strong); font-size:1.15rem; box-shadow:0 4px 14px rgb(0 0 0 / 25%); animation:rb-drive 5s ease-in-out infinite alternate; }
    @keyframes rb-drive { from { left:0; } to { left:calc(100% - 2.4rem); } }
    .rb__chips { grid-column:1 / -1; list-style:none; margin:8px 0 0; padding:12px 0 0; display:flex; flex-wrap:wrap; gap:8px; border-top:1px solid rgb(255 255 255 / 22%); }
    .rb__chips li { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:999px; background:rgb(255 255 255 / 16%); font:600 .8rem var(--font-sans); }
    @media (prefers-reduced-motion: reduce) { .rb__truck { animation:none; left:calc(50% - 1.2rem); } }
    @media (max-width: 560px) { .rb { padding:18px 16px 14px; grid-template-columns:minmax(0,1fr) minmax(40px,1fr) minmax(0,1fr); gap:6px 8px; } .rb__place { display:none; } }
  `]
})
export class RouteBanner {
  readonly fromPin = input<string | null | undefined>('');
  readonly fromPlace = input<string | null | undefined>('');
  readonly toPin = input<string | null | undefined>('');
  readonly toPlace = input<string | null | undefined>('');
  readonly chips = input<BannerChip[]>([]);
}
