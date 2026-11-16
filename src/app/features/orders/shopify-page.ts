import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Icon } from '@shared/components/icon';
import { OrdersService, ShopConnection, ShopImportResult } from './orders.service';

/**
 * Shopify store (13.3b): the customer connects their store with the access token of a custom app made in their own Shopify admin.
 * Open, unfulfilled orders come into "Orders to ship" every 15 minutes (or at once with Import now); after booking, the tracking
 * number goes back to Shopify, which marks the order fulfilled and emails the buyer.
 */
@Component({
  selector: 'ecb-shopify-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, DatePipe],
  template: `
    <section class="page">
      <div class="page__head" data-icon="cart">
        <div>
          <h1 class="text-display">Shopify store</h1>
          <p class="text-caption">Bring your Shopify orders into <a routerLink="/orders">Orders to ship</a> and send tracking numbers back automatically.</p>
        </div>
      </div>

      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }

      @if (loading()) {
        <p class="text-caption">Loading…</p>
      } @else if (conn(); as c) {
        <article class="app-card box">
          <div class="head">
            <div>
              <h2 class="text-h2">{{ c.shopName || c.shopDomain }}</h2>
              <p class="text-caption mono">{{ c.shopDomain }}</p>
            </div>
            @if (c.paused) { <span class="badge badge--warn">Paused</span> } @else { <span class="badge badge--ok">Connected</span> }
          </div>
          @if (c.lastError) { <p class="alert alert--error">{{ c.lastError }}</p> }
          <dl class="facts">
            <div><dt>Last import</dt><dd>{{ c.lastImportAt ? (c.lastImportAt | date: 'd MMM, h:mm a') : 'Not yet' }}</dd></div>
            <div><dt>Orders imported</dt><dd>{{ c.importedCount }}</dd></div>
            <div><dt>Connected</dt><dd>{{ c.connectedAt | date: 'd MMM y' }}</dd></div>
          </dl>
          @if (result(); as r) {
            <p class="alert" [class.alert--error]="r.error" [class.alert--ok]="!r.error" role="status">
              @if (r.error) { {{ r.error }} }
              @else { Checked {{ r.checked }} open order{{ r.checked === 1 ? '' : 's' }}: {{ r.imported }} new, {{ r.alreadyIn }} already in, {{ r.skipped }} could not be imported. }
            </p>
          }
          <label class="check"><input type="checkbox" [checked]="c.fulfilBack" (change)="setFulfil($any($event.target).checked)" />
            Send the tracking number to Shopify when I book (Shopify marks the order fulfilled and emails your buyer)</label>
          <div class="row">
            <button class="btn btn--primary" type="button" (click)="importNow()" [disabled]="busy()"><ecb-icon name="refresh" /> {{ busy() ? 'Importing…' : 'Import now' }}</button>
            <button class="btn btn--ghost" type="button" (click)="setPaused(!c.paused)">{{ c.paused ? 'Resume' : 'Pause' }}</button>
            <button class="btn btn--ghost" type="button" (click)="reconnect.set(!reconnect())">Change token</button>
            <button class="btn btn--ghost danger" type="button" (click)="disconnect()">Disconnect</button>
          </div>
        </article>

        @if (c.skipped.length) {
          <article class="app-card box">
            <h2 class="text-h2">Could not be imported</h2>
            <p class="text-caption">Fix these in Shopify (usually the phone number or PIN code of the shipping address); they are tried again on the next import.</p>
            <table>
              <thead><tr><th>Order</th><th>Reason</th></tr></thead>
              <tbody>@for (s of c.skipped; track s.orderNumber) { <tr><td class="mono">{{ s.orderNumber }}</td><td>{{ s.reason }}</td></tr> }</tbody>
            </table>
          </article>
        }
      }

      @if (!loading() && (!conn() || reconnect())) {
        <article class="app-card box">
          <h2 class="text-h2">{{ conn() ? 'Change store or token' : 'Connect your store' }}</h2>
          <ol class="steps">
            <li>In Shopify admin open <b>Settings → Apps and sales channels → Develop apps</b> (allow custom app development if asked) and click <b>Create an app</b>, name it "OCCPL".</li>
            <li>Under <b>Configuration → Admin API scopes</b> tick <code>read_orders</code>, <code>read_merchant_managed_fulfillment_orders</code> and <code>write_merchant_managed_fulfillment_orders</code>. Save.</li>
            <li>Click <b>Install app</b>, then under <b>API credentials</b> reveal the <b>Admin API access token</b> (starts with <code>shpat_</code>) and copy it. Shopify shows it only once.</li>
            <li>Paste it below with your store address.</li>
          </ol>
          <form class="form" (submit)="$event.preventDefault(); connect()">
            <label>Store address <input type="text" placeholder="yourshop.myshopify.com" [value]="domain()" (input)="domain.set($any($event.target).value)" autocomplete="off" /></label>
            <label>Admin API access token <input type="password" placeholder="shpat_…" [value]="token()" (input)="token.set($any($event.target).value)" autocomplete="off" /></label>
            <label class="check"><input type="checkbox" [checked]="fulfil()" (change)="fulfil.set($any($event.target).checked)" /> Send tracking numbers back to Shopify</label>
            <div><button class="btn btn--primary" type="submit" [disabled]="busy() || !domain().trim() || !token().trim()">{{ busy() ? 'Checking with Shopify…' : 'Connect' }}</button></div>
          </form>
          <p class="text-caption">The token is checked with your store and saved encrypted; it is never shown again. Orders from the last 30 days that are still open and unfulfilled are imported first.</p>
        </article>
      }
    </section>
  `,
  styles: [`
    .box { padding:20px; display:flex; flex-direction:column; gap:14px; }
    .box h2 { margin:0; }
    .head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .head p { margin:2px 0 0; }
    .facts { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin:0; }
    .facts dt { font:600 12px var(--font-sans); text-transform:uppercase; letter-spacing:.04em; color:var(--content-muted); }
    .facts dd { margin:2px 0 0; font:600 16px var(--font-sans); }
    .row { display:flex; gap:10px; flex-wrap:wrap; }
    .danger { color:var(--danger, #c0392b); }
    .check { display:flex; gap:8px; align-items:flex-start; font:400 14px var(--font-sans); }
    .check input { margin-top:3px; }
    .steps { margin:0; padding-left:20px; display:flex; flex-direction:column; gap:6px; font:400 14px/1.5 var(--font-sans); }
    .form { display:flex; flex-direction:column; gap:12px; max-width:520px; }
    .form label:not(.check) { display:flex; flex-direction:column; gap:4px; font:600 13px var(--font-sans); }
    .form input[type=text], .form input[type=password] { height:40px; padding:0 12px; border:1px solid var(--surface-border); border-radius:10px;
      background:var(--occpl-color-surface); color:var(--content-fg); }
    table { width:100%; border-collapse:collapse; font:400 14px var(--font-sans); }
    th { text-align:left; font:600 12px var(--font-sans); text-transform:uppercase; letter-spacing:.04em; color:var(--content-muted); padding:10px 12px; }
    td { padding:10px 12px; border-top:1px solid var(--surface-border); }
    .mono, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    code { font-size:13px; }
  `]
})
export class ShopifyPage implements OnInit {
  private readonly svc = inject(OrdersService);

  readonly conn = signal<ShopConnection | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<ShopImportResult | null>(null);
  readonly reconnect = signal(false);
  readonly domain = signal('');
  readonly token = signal('');
  readonly fulfil = signal(true);

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.svc.shopify().subscribe({
      next: (c) => { this.conn.set(c); this.loading.set(false); if (c) { this.domain.set(c.shopDomain); this.fulfil.set(c.fulfilBack); } },
      error: () => { this.loading.set(false); this.error.set('Your Shopify connection could not be loaded.'); }
    });
  }

  private fail(fallback: string) {
    return (e: HttpErrorResponse) => { this.busy.set(false); this.error.set(e.error?.message ?? fallback); };
  }

  connect(): void {
    this.busy.set(true);
    this.error.set(null);
    this.svc.connectShopify(this.domain().trim(), this.token().trim(), this.fulfil()).subscribe({
      next: (c) => { this.busy.set(false); this.conn.set(c); this.token.set(''); this.reconnect.set(false); this.result.set(null); },
      error: this.fail('Your store could not be connected.')
    });
  }

  importNow(): void {
    this.busy.set(true);
    this.error.set(null);
    this.svc.importShopify().subscribe({
      next: (r) => { this.busy.set(false); this.result.set(r); this.load(); },
      error: this.fail('The import could not be started.')
    });
  }

  setPaused(paused: boolean): void {
    this.svc.shopifySettings({ paused }).subscribe({ next: (c) => this.conn.set(c), error: this.fail('Could not save.') });
  }

  setFulfil(fulfilBack: boolean): void {
    this.svc.shopifySettings({ fulfilBack }).subscribe({ next: (c) => this.conn.set(c), error: this.fail('Could not save.') });
  }

  disconnect(): void {
    if (!confirm('Disconnect your Shopify store? Orders already imported stay in Orders to ship.')) return;
    this.svc.disconnectShopify().subscribe({
      next: () => { this.conn.set(null); this.result.set(null); this.domain.set(''); },
      error: this.fail('Could not disconnect.')
    });
  }
}
