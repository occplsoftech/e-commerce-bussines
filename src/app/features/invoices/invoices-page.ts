import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Icon } from '@shared/components/icon';
import { errorMessage, saveBlob } from '@shared/utils/http-error';
import { RuntimeConfigService } from '@core/config/runtime-config.service';
import { InvoiceDetail, InvoiceRow, InvoiceSummary, InvoicesService, Statement } from './invoices.service';

const STATUS: Record<InvoiceRow['status'], { label: string; tone: string }> = {
  UNPAID: { label: 'Unpaid', tone: 'bad' }, PARTLY_PAID: { label: 'Partly paid', tone: 'warn' },
  PAID: { label: 'Paid', tone: 'ok' }, CANCELLED: { label: 'Cancelled', tone: '' }
};

/** Invoices: what you owe, your invoices with their shipments and payments, and a statement of account. Read-only. */
@Component({
  selector: 'ecb-invoices-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule, Icon],
  template: `
    <section class="page">
      <div class="page__head" data-icon="receipt_long">
        <div>
          <h1 class="text-display">Invoices</h1>
          <p class="text-caption">Your invoices from {{ company() }}, what you have paid, and your statement of account.</p>
        </div>
      </div>

      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }

      <div class="tabs" role="tablist">
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'invoices'" [class.on]="tab() === 'invoices'" (click)="tab.set('invoices')">Invoices</button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'statement'" [class.on]="tab() === 'statement'" (click)="openStatement()">Statement</button>
      </div>

      @if (tab() === 'invoices') {
        @if (summary(); as s) {
          <div class="cards">
            <article class="app-card stat"><p class="label">Outstanding</p><p class="amount num-tabular" [class.due]="s.outstanding > 0">{{ s.outstanding | currency: 'INR' : 'symbol' : '1.2-2' }}</p></article>
            <article class="app-card stat"><p class="label">Unpaid invoices</p><p class="amount num-tabular">{{ s.unpaidInvoices }}</p></article>
            <article class="app-card stat"><p class="label">Last payment</p>
              <p class="amount num-tabular">@if (s.lastPaymentOn) { {{ s.lastPaymentAmount | currency: 'INR' : 'symbol' : '1.2-2' }} } @else { — }</p>
              @if (s.lastPaymentOn) { <p class="text-caption">on {{ s.lastPaymentOn | date: 'd MMM yyyy' }}</p> }</article>
          </div>
          <article class="app-card box">
            @if (!s.invoices.length) {
              <p class="empty">No invoices yet. Invoices appear here once {{ company() }} bills your shipments.</p>
            } @else {
              <div class="scroll">
                <table>
                  <thead><tr><th>Invoice</th><th>Date</th><th>Period</th><th class="num">Shipments</th><th class="num">Amount due</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (i of s.invoices; track i.id) {
                      <tr class="click" [class.sel]="detail()?.invoice?.id === i.id" (click)="open(i)">
                        <td class="mono">{{ i.invoiceNumber }}</td>
                        <td>{{ i.invoiceDate | date: 'd MMM yyyy' }}</td>
                        <td>{{ i.periodFrom | date: 'd MMM' }} – {{ i.periodTo | date: 'd MMM yyyy' }}</td>
                        <td class="num">{{ i.shipments }}</td>
                        <td class="num num-tabular">{{ i.due | currency: 'INR' : 'symbol' : '1.2-2' }}</td>
                        <td class="num num-tabular">{{ i.paid | currency: 'INR' : 'symbol' : '1.2-2' }}</td>
                        <td class="num num-tabular" [class.due]="i.balance > 0">{{ i.balance | currency: 'INR' : 'symbol' : '1.2-2' }}</td>
                        <td><span [class]="'badge badge--' + status(i).tone">{{ status(i).label }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </article>

          @if (detail(); as d) {
            <article class="app-card box">
              <div class="row">
                <h2 class="text-h2">Invoice {{ d.invoice.invoiceNumber }}</h2>
                <button class="btn btn--primary" type="button" (click)="print(d)"><ecb-icon name="print" /> Print / Save as PDF</button>
              </div>
              <div class="scroll">
                <table class="small">
                  <thead><tr><th>Shipment</th><th>Booked</th><th>Receiver</th><th>To</th><th class="num">Qty</th><th class="num">Weight</th><th>Payment</th><th class="num">GST</th><th class="num">Amount</th></tr></thead>
                  <tbody>
                    @for (l of d.lines; track l.shipmentNumber) {
                      <tr><td class="mono">{{ l.shipmentNumber }}</td><td>{{ l.bookingDate | date: 'd MMM' }}</td><td>{{ l.consignee || '—' }}</td>
                        <td>{{ l.destinationPincode || '—' }}</td><td class="num">{{ l.quantity }}</td><td class="num">{{ l.weight | number: '1.0-3' }}</td>
                        <td>{{ l.paymentMode || '—' }}@if (l.prepaid) { <span class="text-caption"> (paid at booking)</span> }</td>
                        <td class="num num-tabular">{{ l.gst | currency: 'INR' : 'symbol' : '1.2-2' }}</td><td class="num num-tabular">{{ l.amount | currency: 'INR' : 'symbol' : '1.2-2' }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <h3 class="text-h3">Payments</h3>
              @if (!d.payments.length) { <p class="text-caption">No payments recorded yet.</p> } @else {
                <ul class="pays">@for (p of d.payments; track $index) {
                  <li><strong>{{ p.amount | currency: 'INR' : 'symbol' : '1.2-2' }}</strong> on {{ p.paidOn | date: 'd MMM yyyy' }}@if (p.method) { · {{ p.method }} }@if (p.reference) { · {{ p.reference }} }</li>
                }</ul>
              }
            </article>
          }
        } @else {
          <p class="empty">Loading…</p>
        }
      } @else {
        <form class="app-card export" (submit)="$event.preventDefault(); loadStatement()" aria-label="Statement period">
          <label><span>From</span><input type="date" name="from" [ngModel]="from()" (ngModelChange)="from.set($event)" /></label>
          <label><span>To</span><input type="date" name="to" [ngModel]="to()" (ngModelChange)="to.set($event)" /></label>
          <button type="submit" class="btn btn--ghost">Show</button>
          <button type="button" class="btn btn--ghost" (click)="downloadStatement()" [disabled]="downloading()"><ecb-icon name="download" /> {{ downloading() ? 'Preparing…' : 'Download Excel' }}</button>
        </form>
        @if (statement(); as st) {
          <div class="cards">
            <article class="app-card stat"><p class="label">Opening balance</p><p class="amount num-tabular">{{ st.opening | currency: 'INR' : 'symbol' : '1.2-2' }}</p></article>
            <article class="app-card stat"><p class="label">Invoiced</p><p class="amount num-tabular">{{ st.invoiced | currency: 'INR' : 'symbol' : '1.2-2' }}</p></article>
            <article class="app-card stat"><p class="label">Paid</p><p class="amount num-tabular">{{ st.paid | currency: 'INR' : 'symbol' : '1.2-2' }}</p></article>
            <article class="app-card stat"><p class="label">Closing balance</p><p class="amount num-tabular" [class.due]="st.closing > 0">{{ st.closing | currency: 'INR' : 'symbol' : '1.2-2' }}</p></article>
          </div>
          <article class="app-card box">
            @if (!st.lines.length) { <p class="empty">No invoices or payments in this period.</p> } @else {
              <div class="scroll"><table>
                <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th class="num">Invoice</th><th class="num">Payment</th><th class="num">Balance</th></tr></thead>
                <tbody>@for (l of st.lines; track $index) {
                  <tr><td>{{ l.date | date: 'd MMM yyyy' }}</td><td>{{ l.kind === 'INVOICE' ? 'Invoice' : 'Payment' }}</td><td class="mono">{{ l.reference }}</td>
                    <td class="num num-tabular">@if (l.debit) { {{ l.debit | currency: 'INR' : 'symbol' : '1.2-2' }} }</td>
                    <td class="num num-tabular">@if (l.credit) { {{ l.credit | currency: 'INR' : 'symbol' : '1.2-2' }} }</td>
                    <td class="num num-tabular">{{ l.balance | currency: 'INR' : 'symbol' : '1.2-2' }}</td></tr>
                }</tbody>
              </table></div>
            }
          </article>
        }
      }
    </section>
  `,
  styles: [`
    :host { display:block; min-width:0; }
    .tabs { display:flex; gap:8px; margin:0 0 12px; }
    .tabs button { border:1px solid var(--surface-border); background:var(--surface); border-radius:999px; padding:7px 14px; font:600 13px var(--font-sans); cursor:pointer; color:var(--content-fg); }
    .tabs button.on { border-color:var(--occpl-color-primary); color:var(--occpl-color-primary-strong); }
    .cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:12px; }
    .stat { padding:14px 18px; } .stat .label { margin:0; font:600 12px var(--font-sans); color:var(--content-muted); text-transform:uppercase; letter-spacing:.04em; }
    .stat .amount { margin:4px 0 0; font:700 22px var(--font-sans); } .due { color:var(--danger, #b3123a); }
    .box { padding:18px 20px; display:flex; flex-direction:column; gap:12px; margin-bottom:12px; min-width:0; }
    .row { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; } h2, h3 { margin:0; }
    .scroll { overflow-x:auto; } table { width:100%; border-collapse:collapse; font:400 14px var(--font-sans); }
    th { text-align:left; font:600 12px var(--font-sans); color:var(--content-muted); text-transform:uppercase; letter-spacing:.04em; padding:0 10px 8px; white-space:nowrap; }
    td { padding:9px 10px; border-top:1px solid var(--surface-border); } table.small td { font-size:13px; }
    .num { text-align:right; } .mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; }
    tr.click { cursor:pointer; } tr.click:hover, tr.sel { background:color-mix(in srgb, var(--occpl-color-primary) 6%, transparent); }
    .empty { text-align:center; color:var(--content-muted); padding:18px; margin:0; }
    .pays { margin:0; padding-left:18px; display:flex; flex-direction:column; gap:4px; }
    .export { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; padding:14px 18px; margin-bottom:12px; }
    .export label { display:flex; flex-direction:column; gap:4px; font:500 12px var(--font-sans); color:var(--content-muted); }
    .export input { padding:8px 10px; border:1px solid var(--surface-border); border-radius:var(--r-field); background:var(--surface); color:inherit; font:400 14px var(--font-sans); }
  `]
})
export class InvoicesPage implements OnInit {
  private readonly service = inject(InvoicesService);
  protected readonly company = () => this.runtime().companyName;
  private readonly runtime = inject(RuntimeConfigService).config;

  readonly tab = signal<'invoices' | 'statement'>('invoices');
  readonly summary = signal<InvoiceSummary | null>(null);
  readonly detail = signal<InvoiceDetail | null>(null);
  readonly statement = signal<Statement | null>(null);
  readonly error = signal<string | null>(null);
  readonly downloading = signal(false);
  protected readonly today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  readonly from = signal(this.today.slice(0, 4) + '-01-01');
  readonly to = signal(this.today);

  ngOnInit(): void {
    this.service.summary().subscribe({
      next: (s) => this.summary.set(s),
      error: async (e: HttpErrorResponse) => this.error.set(await errorMessage(e, 'Your invoices could not be loaded.'))
    });
  }

  status(i: InvoiceRow) { return STATUS[i.status] ?? { label: i.status, tone: '' }; }

  open(i: InvoiceRow): void {
    this.service.detail(i.id).subscribe({
      next: (d) => this.detail.set(d),
      error: async (e: HttpErrorResponse) => this.error.set(await errorMessage(e, 'This invoice could not be opened.'))
    });
  }

  openStatement(): void {
    this.tab.set('statement');
    if (!this.statement()) this.loadStatement();
  }

  loadStatement(): void {
    this.error.set(null);
    this.service.statement(this.from(), this.to()).subscribe({
      next: (s) => this.statement.set(s),
      error: async (e: HttpErrorResponse) => this.error.set(await errorMessage(e, 'The statement could not be loaded.'))
    });
  }

  downloadStatement(): void {
    this.downloading.set(true);
    this.service.statementExcel(this.from(), this.to()).subscribe({
      next: (b) => { this.downloading.set(false); saveBlob(b, `statement-${this.from()}-to-${this.to()}.xlsx`); },
      error: async (e: HttpErrorResponse) => { this.downloading.set(false); this.error.set(await errorMessage(e, 'The statement could not be downloaded.')); }
    });
  }

  /** An A4 invoice in a new window with the print dialog ("Save as PDF" keeps a file). */
  print(d: InvoiceDetail): void {
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const inr = (n: number) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const i = d.invoice;
    const rows = d.lines.map((l) => `<tr><td>${esc(l.shipmentNumber)}</td><td>${esc(l.bookingDate ?? '')}</td><td>${esc(l.consignee ?? '')}</td>`
      + `<td>${esc(l.destinationPincode ?? '')}</td><td class="n">${l.quantity}</td><td>${esc(l.paymentMode ?? '')}${l.prepaid ? ' (paid)' : ''}</td>`
      + `<td class="n">${inr(l.gst)}</td><td class="n">${inr(l.amount)}</td></tr>`).join('');
    const pays = d.payments.map((p) => `<li>${inr(p.amount)} on ${esc(p.paidOn ?? '')}${p.method ? ' · ' + esc(p.method) : ''}${p.reference ? ' · ' + esc(p.reference) : ''}</li>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(i.invoiceNumber)}</title><style>
body{font:13px/1.45 Arial,sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0}.muted{color:#555}table{width:100%;border-collapse:collapse;margin:14px 0}
th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}th{background:#f3f3f3;font-size:12px}.n{text-align:right}.tot td{font-weight:700}@page{size:A4;margin:12mm}</style></head><body>
<h1>Tax invoice ${esc(i.invoiceNumber)}</h1><div class="muted">${esc(this.company())}</div>
<p><b>Billed to:</b> ${esc(d.customerName ?? '')}<br><b>Date:</b> ${esc(i.invoiceDate)} &nbsp; <b>Period:</b> ${esc(i.periodFrom ?? '')} to ${esc(i.periodTo ?? '')}</p>
<table><thead><tr><th>Shipment</th><th>Booked</th><th>Receiver</th><th>To</th><th class="n">Qty</th><th>Payment</th><th class="n">GST</th><th class="n">Amount</th></tr></thead>
<tbody>${rows}<tr class="tot"><td colspan="6">Total</td><td class="n">${inr(d.gst)}</td><td class="n">${inr(i.total)}</td></tr></tbody></table>
<p>Paid at booking: ${inr(i.prepaid)} &nbsp; · &nbsp; Amount due: ${inr(i.due)} &nbsp; · &nbsp; Paid: ${inr(i.paid)} &nbsp; · &nbsp; <b>Balance: ${inr(i.balance)}</b></p>
${pays ? '<p><b>Payments</b></p><ul>' + pays + '</ul>' : ''}
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { this.error.set('Allow pop-ups for this site to print the invoice.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}
