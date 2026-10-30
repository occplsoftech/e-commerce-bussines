import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotificationService } from '@core/services/notification.service';
import { Icon } from '@shared/components/icon';
import { errorMessage, saveBlob } from '@shared/utils/http-error';
import { BulkBookingService, BulkItem, BulkPreview, BulkResult, BulkRow } from './bulk-booking.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Book many shipments from one Excel sheet: download the template, upload it, see every row checked and priced (the customer's own
 * business rate where there is one, otherwise the cheapest courier allowed), tick what to book, confirm. Nothing is booked before the
 * confirm; rows then book independently, with the same wallet / To Pay / credit rules as a single booking.
 */
@Component({
  selector: 'ecb-bulk-booking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, CurrencyPipe, RouterLink, FormsModule],
  template: `
    <section class="page">
      <div class="page__head" data-icon="upload">
        <div>
          <h1 class="text-display">Bulk booking</h1>
          <p class="text-caption">Upload an Excel sheet with one row per shipment. You see every row checked and priced before anything is booked.</p>
        </div>
        <button type="button" class="btn btn--ghost" (click)="downloadTemplate()"><ecb-icon name="download" /> Download template</button>
      </div>

      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }

      @if (!results()) {
        <article class="app-card drop">
          <ecb-icon name="upload" />
          <p><strong>Choose your filled .xlsx file</strong></p>
          <p class="text-caption">Up to 100 shipments. Use the template as it is: do not rename or remove its columns.</p>
          <input #f type="file" [accept]="accept" hidden (change)="pick(f.files)" />
          <button type="button" class="btn btn--primary" [disabled]="busy()" (click)="f.click()">{{ busy() ? 'Checking…' : (preview() ? 'Choose another file' : 'Choose file') }}</button>
        </article>
      }

      @if (preview(); as p) {
        @if (!results()) {
          <article class="app-card box">
            <div class="sum">
              <span><strong>{{ p.okCount }}</strong> ready</span>
              <span [class.bad]="p.errorCount > 0"><strong>{{ p.errorCount }}</strong> with errors</span>
              <span>Selected total <strong class="num-tabular">{{ selectedTotal() | currency: 'INR' : 'symbol' : '1.2-2' }}</strong></span>
            </div>
            <div class="scroll">
              <table>
                <thead><tr><th></th><th>Row</th><th>To</th><th>Pincode</th><th>Weight</th><th>Payment</th><th>Courier</th><th>Priced at</th><th class="r">Total</th><th></th></tr></thead>
                <tbody>
                  @for (r of p.rows; track r.row) {
                    <tr [class.err]="!r.ok">
                      <td>@if (r.ok) { <input type="checkbox" [checked]="picked().has(r.row)" (change)="toggle(r.row)" [attr.aria-label]="'Book row ' + r.row" /> }</td>
                      <td>{{ r.row }}</td>
                      <td class="wrap">{{ r.deliveryName || '—' }}</td>
                      <td>{{ r.deliveryPincode || '—' }}</td>
                      <td>{{ r.weightKg ?? '—' }}</td>
                      <td>{{ r.paymentMode }}</td>
                      @if (r.ok) {
                        <td class="wrap">{{ r.providerName }} · {{ r.serviceName }}</td>
                        <td class="wrap">{{ r.basis === 'BUSINESS_RATE' ? 'Your business rate' : 'Cheapest courier' }}</td>
                        <td class="r num-tabular">{{ r.total | currency: 'INR' : 'symbol' : '1.2-2' }}</td>
                      } @else {
                        <td colspan="3" class="msg">{{ r.error }}</td>
                      }
                      <td><button type="button" class="link" (click)="edit(r)">{{ editing() === r.row ? 'Close' : 'Edit' }}</button></td>
                    </tr>

                  }
                </tbody>
              </table>
            </div>
            @if (editing() !== null) {
              <section class="editor" aria-label="Edit row">
                <h2 class="editor__title">Edit row {{ editing() }}</h2>
                <div class="grid">
                  @for (k of draftKeys(); track k) {
                    <label><span>{{ k }}</span><input type="text" [ngModel]="draft()[k]" (ngModelChange)="setDraft(k, $event)" [name]="k" /></label>
                  }
                </div>
                <div class="actions">
                  <button type="button" class="btn btn--primary" [disabled]="busy()" (click)="recheck(editing()!)">{{ busy() ? 'Checking…' : 'Save and re-check' }}</button>
                  <button type="button" class="btn btn--ghost" (click)="editing.set(null)">Cancel</button>
                </div>
              </section>
            }
            @if (p.errorCount > 0) { <p class="alert alert--warn">Click Edit on a row to fix it here, or fix your sheet and upload it again. Only the ready rows are booked.</p> }
            <div class="actions">
              <button type="button" class="btn btn--primary" [disabled]="busy() || picked().size === 0" (click)="confirm()">
                {{ busy() ? 'Booking…' : 'Book ' + picked().size + ' shipment' + (picked().size === 1 ? '' : 's') }}
              </button>
            </div>
          </article>
        }
      }

      @if (results(); as rs) {
        <article class="app-card box">
          <div class="sum">
            <span><strong>{{ bookedCount() }}</strong> booked</span>
            <span [class.bad]="rs.length - bookedCount() > 0"><strong>{{ rs.length - bookedCount() }}</strong> not booked</span>
          </div>
          <div class="scroll">
            <table class="small">
              <thead><tr><th>Row</th><th>Result</th><th>Tracking number</th><th>Reference</th></tr></thead>
              <tbody>
                @for (r of rs; track r.row) {
                  <tr [class.err]="!r.booked">
                    <td>{{ r.row }}</td>
                    <td>{{ r.booked ? 'Booked' : r.message }}</td>
                    <td>{{ r.awb || '—' }}</td>
                    <td>{{ r.reference || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="actions">
            <a class="btn btn--primary" routerLink="/shipments">View shipments</a>
            <button type="button" class="btn btn--ghost" (click)="reset()">Upload another sheet</button>
          </div>
        </article>
      }
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .box { padding: 18px 20px; min-width: 0; }
    .drop { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 16px; text-align: center; border-style: dashed; }
    .drop p { margin: 0; }
    .sum { display: flex; gap: 8px 24px; flex-wrap: wrap; margin-bottom: 14px; font: 400 14px var(--font-sans); }
    .sum .bad { color: var(--danger); }
    .scroll { overflow-x: auto; border: 1px solid var(--surface-border); border-radius: 10px; }
    table { width: 100%; min-width: 820px; border-collapse: collapse; font: 400 13px var(--font-sans); }
    th, td { padding: 10px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--surface-border); white-space: nowrap; }
    table.small { min-width: 0; }
    tbody tr:last-child td { border-bottom: 0; }
    td.wrap { white-space: normal; min-width: 150px; overflow-wrap: anywhere; }
    td.msg { white-space: normal; color: var(--danger); overflow-wrap: anywhere; }
    .r { text-align: right; }
    tr.err td { background: var(--danger-bg); }
    .link { background: none; border: 0; color: var(--occpl-color-primary); font: 600 13px var(--font-sans); cursor: pointer; padding: 0; }
    .editor { margin-top: 16px; padding: 16px; border: 1px solid var(--surface-border); border-radius: 10px; background: var(--occpl-color-neutral-surface); }
    .editor__title { margin: 0 0 12px; font: 700 15px var(--font-sans); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px 16px; }
    .grid label { display: flex; flex-direction: column; gap: 4px; font: 500 12px var(--font-sans); color: var(--content-muted); min-width: 0; }
    .grid input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--surface-border); border-radius: var(--occpl-radius-md); background: var(--surface); color: var(--content-fg); font: 400 13px var(--font-sans); }
    .actions { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
    .alert { margin-top: 14px; }
  `]
})
export class BulkBooking {
  private readonly service = inject(BulkBookingService);
  private readonly notify = inject(NotificationService);

  protected readonly accept = `.xlsx,${XLSX}`;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly preview = signal<BulkPreview | null>(null);
  protected readonly picked = signal<Set<number>>(new Set());
  protected readonly results = signal<BulkResult[] | null>(null);
  protected readonly editing = signal<number | null>(null);
  protected readonly draft = signal<Record<string, string>>({});
  protected readonly draftKeys = computed(() => Object.keys(this.draft()));

  protected readonly selectedTotal = computed(() =>
    (this.preview()?.rows ?? []).filter((r) => this.picked().has(r.row)).reduce((sum, r) => sum + (r.total ?? 0), 0));
  protected readonly bookedCount = computed(() => (this.results() ?? []).filter((r) => r.booked).length);

  protected downloadTemplate(): void {
    this.service.template().subscribe({
      next: (b) => saveBlob(b, 'bulk-booking-template.xlsx'),
      error: (e) => void errorMessage(e, 'The template could not be downloaded.').then((m) => this.error.set(m))
    });
  }

  protected pick(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;
    this.error.set('');
    if (!file.name.toLowerCase().endsWith('.xlsx')) { this.error.set('Choose an Excel (.xlsx) file.'); return; }
    if (file.size > MAX_BYTES) { this.error.set('The file is larger than 5 MB.'); return; }
    this.busy.set(true);
    this.preview.set(null);
    this.service.preview(file).subscribe({
      next: (p) => {
        this.preview.set(p);
        this.picked.set(new Set(p.rows.filter((r) => r.ok).map((r) => r.row)));
        this.busy.set(false);
      },
      error: (e) => { this.busy.set(false); void errorMessage(e, 'The file could not be checked.').then((m) => this.error.set(m)); }
    });
  }

  protected edit(r: BulkRow): void {
    if (this.editing() === r.row) { this.editing.set(null); return; }
    this.draft.set({ ...r.fields });
    this.editing.set(r.row);
  }

  protected setDraft(key: string, value: string): void { this.draft.update((d) => ({ ...d, [key]: value })); }

  /** Sends the edited values back for the same checks and pricing; the row is replaced and, when it is now fine, selected for booking. */
  protected recheck(rowNo: number): void {
    this.busy.set(true);
    this.error.set('');
    this.service.checkRow(rowNo, this.draft()).subscribe({
      next: (fresh) => {
        const p = this.preview();
        if (p) {
          const rows = p.rows.map((r) => (r.row === rowNo ? fresh : r));
          const ok = rows.filter((r) => r.ok);
          this.preview.set({ rows, okCount: ok.length, errorCount: rows.length - ok.length, okTotal: ok.reduce((s, r) => s + (r.total ?? 0), 0) });
          const next = new Set(this.picked());
          if (fresh.ok) next.add(rowNo); else next.delete(rowNo);
          this.picked.set(next);
        }
        this.busy.set(false);
        if (fresh.ok) this.editing.set(null);
      },
      error: (e) => { this.busy.set(false); void errorMessage(e, 'The row could not be checked.').then((m) => this.error.set(m)); }
    });
  }

  protected toggle(row: number): void {
    const next = new Set(this.picked());
    if (!next.delete(row)) next.add(row);
    this.picked.set(next);
  }

  protected confirm(): void {
    const items: BulkItem[] = (this.preview()?.rows ?? [])
      .filter((r: BulkRow) => r.ok && this.picked().has(r.row) && r.quoteId && r.optionId)
      .map((r) => ({ row: r.row, quoteId: r.quoteId!, optionId: r.optionId! }));
    if (!items.length) return;
    this.busy.set(true);
    this.error.set('');
    this.service.book(items).subscribe({
      next: (rs) => { this.results.set(rs); this.busy.set(false); this.notify.success(`${rs.filter((r) => r.booked).length} of ${rs.length} shipments booked.`); },
      error: (e) => { this.busy.set(false); void errorMessage(e, 'The bookings could not be completed. Check Shipments before trying again.').then((m) => this.error.set(m)); }
    });
  }

  protected reset(): void {
    this.results.set(null);
    this.preview.set(null);
    this.picked.set(new Set());
    this.error.set('');
  }
}
