import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Icon } from '@shared/components/icon';
import { environment } from '@env/environment';
import { ApiKeyView, CreatedApiKey, OrdersService } from './orders.service';

/**
 * Developer API (13.3): keys the customer's own website or system uses to send orders into "Orders to ship", with a short how-to. A key
 * is shown once when created; only its first characters are listed afterwards.
 */
@Component({
  selector: 'ecb-developer-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, DatePipe],
  template: `
    <section class="page">
      <div class="page__head" data-icon="key">
        <div>
          <h1 class="text-display">Developer API</h1>
          <p class="text-caption">Let your website or system send its orders to <a routerLink="/orders">Orders to ship</a>, so you never re-type them.</p>
        </div>
      </div>

      <article class="app-card box">
        <h2 class="text-h2">API keys</h2>
        <form class="create" (submit)="$event.preventDefault(); create()">
          <label>Name <input type="text" maxlength="60" placeholder="e.g. Website" [value]="name()" (input)="name.set($any($event.target).value)" aria-label="Key name" /></label>
          <button class="btn btn--primary" type="submit" [disabled]="creating()"><ecb-icon name="add" /> {{ creating() ? 'Creating…' : 'Create key' }}</button>
        </form>
        @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
        @if (created(); as c) {
          <div class="once" role="status">
            <strong>Your new key "{{ c.view.name }}". Copy it now: it is not shown again.</strong>
            <div class="keyline"><code>{{ c.key }}</code>
              <button class="btn btn--ghost" type="button" (click)="copy(c.key)"><ecb-icon name="content_copy" /> {{ copied() ? 'Copied' : 'Copy' }}</button></div>
            <p class="text-caption">Keep it secret, like a password. Anyone with it can send orders to your inbox. Revoke it below if it leaks.</p>
          </div>
        }
        @if (keys().length) {
          <table>
            <thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th></th></tr></thead>
            <tbody>
              @for (k of keys(); track k.id) {
                <tr [class.off]="k.revokedAt">
                  <td>{{ k.name }}</td>
                  <td class="mono">{{ k.keyPrefix }}…</td>
                  <td>{{ k.createdAt | date: 'd MMM y' }}</td>
                  <td>{{ k.lastUsedAt ? (k.lastUsedAt | date: 'd MMM, h:mm a') : 'Never' }}</td>
                  <td class="right">@if (k.revokedAt) { <span class="text-caption">Revoked {{ k.revokedAt | date: 'd MMM' }}</span> }
                    @else { <button class="btn btn--ghost" type="button" (click)="revoke(k)">Revoke</button> }</td>
                </tr>
              }
            </tbody>
          </table>
        } @else if (!loading()) { <p class="text-caption">No keys yet.</p> }
      </article>

      <article class="app-card box docs">
        <h2 class="text-h2">Send an order</h2>
        <p><code>POST {{ base() }}</code> with the header <code>X-Api-Key: your key</code> and a JSON body:</p>
        <pre>{{ example }}</pre>
        <ul>
          <li><b>Required:</b> orderNumber, buyer (name, phone, address, pincode), parcel.declaredValue.</li>
          <li><b>Optional:</b> city and state, weight and size (0.5 kg and 10 × 10 × 10 cm if left out), number of packages, contents,
            payment (PREPAID, or COD with the amount to collect), items, notes.</li>
          <li>Sending the same orderNumber again is safe: you get the order already received, not a second one.</li>
          <li>Up to {{ perMinute }} requests a minute per key.</li>
        </ul>
        <h2 class="text-h2">Check an order</h2>
        <p><code>GET {{ base() }}/&#123;orderNumber&#125;</code> (same header) returns its status: NEW, BOOKED (with the courier and tracking number) or ARCHIVED.</p>
      </article>
    </section>
  `,
  styles: [`
    .box { padding:20px; display:flex; flex-direction:column; gap:14px; }
    .box h2 { margin:0; }
    .create { display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; }
    .create label { display:flex; flex-direction:column; gap:4px; font:600 13px var(--font-sans); }
    .create input { height:40px; padding:0 12px; border:1px solid var(--surface-border); border-radius:10px; min-width:240px; background:var(--occpl-color-surface); color:var(--content-fg); }
    .once { padding:14px 16px; border-radius:14px; background:var(--warning-bg); border:1px solid color-mix(in srgb, var(--warning) 40%, transparent); display:flex; flex-direction:column; gap:8px; }
    .keyline { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    .keyline code { font-size:14px; padding:8px 10px; background:var(--occpl-color-surface); border-radius:8px; word-break:break-all; }
    table { width:100%; border-collapse:collapse; font:400 14px var(--font-sans); }
    th { text-align:left; font:600 12px var(--font-sans); text-transform:uppercase; letter-spacing:.04em; color:var(--content-muted); padding:10px 12px; }
    td { padding:10px 12px; border-top:1px solid var(--surface-border); }
    tr.off td { color:var(--content-muted); }
    .right { text-align:right; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .docs pre { margin:0; padding:14px; border-radius:12px; background:var(--surface-muted); overflow-x:auto; font:12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .docs code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:13px; }
    .docs ul { margin:0; padding-left:18px; display:flex; flex-direction:column; gap:4px; }
  `]
})
export class DeveloperPage implements OnInit {
  private readonly svc = inject(OrdersService);

  readonly perMinute = 120;
  readonly keys = signal<ApiKeyView[]>([]);
  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly name = signal('');
  readonly created = signal<CreatedApiKey | null>(null);
  readonly copied = signal(false);
  readonly error = signal<string | null>(null);
  readonly base = computed(() => `${typeof location === 'undefined' ? '' : location.origin}${environment.apiBaseUrl}/public/orders`);
  readonly example = JSON.stringify({
    orderNumber: 'WEB-1001',
    buyer: { name: 'Ravi Kumar', phone: '9876543210', address: '12 MG Road, Camp', pincode: '411001', city: 'Pune', state: 'Maharashtra' },
    parcel: { weightKg: 0.8, lengthCm: 20, breadthCm: 15, heightCm: 10, count: 1, contents: 'Cotton T-shirts', declaredValue: 998 },
    payment: { mode: 'COD', codAmount: 998 },
    items: [{ name: 'T-shirt (M)', quantity: 2, price: 499 }],
    notes: 'Call before delivery'
  }, null, 2);

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.svc.keys().subscribe({
      next: (k) => { this.keys.set(k); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Your keys could not be loaded.'); }
    });
  }

  create(): void {
    this.creating.set(true);
    this.error.set(null);
    this.copied.set(false);
    this.svc.createKey(this.name().trim() || 'API key').subscribe({
      next: (c) => { this.creating.set(false); this.created.set(c); this.name.set(''); this.load(); },
      error: (e: HttpErrorResponse) => { this.creating.set(false); this.error.set(e.error?.message ?? 'The key could not be created.'); }
    });
  }

  revoke(k: ApiKeyView): void {
    if (!confirm(`Revoke "${k.name}"? Systems using it stop sending orders at once.`)) return;
    this.svc.revokeKey(k.id).subscribe({ next: () => this.load(), error: (e: HttpErrorResponse) => this.error.set(e.error?.message ?? 'Could not revoke.') });
  }

  copy(key: string): void {
    navigator.clipboard?.writeText(key).then(() => this.copied.set(true), () => undefined);
  }
}
