import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '@env/environment';
import { Page } from '@core/models/portal.model';
import { CHECKOUT_DISMISSED, RazorpayService } from '@core/services/razorpay.service';
import { NotificationService } from '@core/services/notification.service';
import { Icon } from '@shared/components/icon';
import { TopupRequest, TopupStatus, Wallet, WalletEntry, WalletService } from './wallet.service';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];
const MAX_AMOUNT = 10_000_000;
const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

const TOPUP_LABEL: Record<TopupStatus, string> = { PENDING: 'Waiting for approval', APPROVED: 'Credited', REJECTED: 'Rejected' };

type Tab = 'statement' | 'requests';

/**
 * The customer's prepaid wallet: balance, adding money (online through Razorpay, or by bank transfer / cash with a proof of payment that
 * the courier company approves), the statement, and the top-up requests. The wallet pays for courier bookings when the courier company
 * has switched that on; nothing on this page moves money except the two ways of adding it.
 */
@Component({
  selector: 'ecb-wallet-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, CurrencyPipe, DatePipe, FormsModule],
  template: `
    <section class="page">
      <div class="page__head" data-icon="account_balance_wallet">
        <div>
          <h1 class="text-display">Wallet</h1>
          <p class="text-caption">Add money once, then pay for your courier bookings from it. Every credit and debit is listed below.</p>
        </div>
        @if (wallet(); as w) {
          <span class="status" [class.ok]="w.status === 'ACTIVE'"><ecb-icon name="account_balance_wallet" /> {{ w.status === 'ACTIVE' ? 'Active' : w.status }}</span>
        }
      </div>

      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }

      @if (wallet(); as w) {
        <div class="top">
          <article class="app-card balance">
            <p class="label">Available balance</p>
            <p class="amount num-tabular" data-testid="available">{{ w.availableBalance | currency: w.currency : 'symbol' : '1.2-2' }}</p>
            <dl>
              @if (w.holdBalance > 0) {
                <div><dt>On hold</dt><dd class="num-tabular">{{ w.holdBalance | currency: w.currency : 'symbol' : '1.2-2' }}</dd></div>
              }
              <div><dt>Wallet number</dt><dd>{{ w.walletNumber }}</dd></div>
            </dl>
            @if (w.status !== 'ACTIVE') {
              <p class="alert alert--warn" role="alert">This wallet is {{ w.status.toLowerCase() }}, so money cannot be added or spent. Contact your courier company.</p>
            }
          </article>

          <article class="app-card add">
            <h2 class="text-h2">Add money</h2>
            <label class="field">
              <span>Amount ({{ w.currency }})</span>
              <input type="number" inputmode="decimal" min="1" step="1" placeholder="0.00" [ngModel]="amount()" (ngModelChange)="amount.set($event)" name="amount"
                     aria-label="Amount to add" />
            </label>
            <div class="quick">
              @for (q of quick; track q) {
                <button type="button" class="chip" (click)="addQuick(q)">+{{ q | currency: w.currency : 'symbol' : '1.0-0' }}</button>
              }
            </div>
            @if (amountError(); as why) { <p class="hint bad">{{ why }}</p> }
            <div class="actions">
              <button class="btn btn--primary" type="button" [disabled]="!canPay()" (click)="payOnline()">
                <ecb-icon name="bolt" /> {{ paying() ? 'Waiting for payment…' : 'Pay online' }}
              </button>
              <button class="btn btn--ghost" type="button" (click)="showRequest.set(!showRequest())" [attr.aria-expanded]="showRequest()">
                Paid by bank transfer or cash?
              </button>
            </div>
            @if (payNote()) { <p class="alert alert--info" role="status">{{ payNote() }}</p> }

            @if (showRequest()) {
              <form class="request" (submit)="$event.preventDefault(); submitRequest()">
                <h3>Ask your courier company to credit your wallet</h3>
                <p class="text-caption">Pay by bank transfer or cash, upload the receipt or a screenshot, and your courier company credits the wallet once they have checked it.</p>
                <label class="field">
                  <span>Amount you paid ({{ w.currency }})</span>
                  <input type="number" inputmode="decimal" min="1" step="1" [ngModel]="requestAmount()" (ngModelChange)="requestAmount.set($event)" name="requestAmount"
                         aria-label="Amount you paid" />
                </label>
                <label class="field">
                  <span>Note (optional)</span>
                  <input type="text" maxlength="500" placeholder="Bank transfer, UTR 123456789" [ngModel]="remarks()" (ngModelChange)="remarks.set($event)" name="remarks"
                         aria-label="Note" />
                </label>
                <div class="proof">
                  <button class="btn btn--ghost" type="button" [disabled]="uploading()" (click)="picker.click()">
                    <ecb-icon name="upload" /> {{ uploading() ? 'Uploading…' : proofName() ? 'Replace proof' : 'Upload proof of payment' }}
                  </button>
                  <input #picker type="file" hidden accept="image/jpeg,image/png,image/webp,image/heic" (change)="pickProof($event)" aria-label="Choose proof of payment" />
                  @if (proofName()) { <span class="text-caption"><ecb-icon name="check_circle" /> {{ proofName() }}</span>
                  } @else { <span class="text-caption">A JPEG, PNG, WEBP or HEIC image, up to 5 MB.</span> }
                </div>
                <div class="actions">
                  <button class="btn btn--primary" type="submit" [disabled]="!canRequest()">{{ requesting() ? 'Sending…' : 'Send request' }}</button>
                </div>
              </form>
            }
          </article>
        </div>

        <div class="tabs" role="tablist">
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'statement'" [class.on]="tab() === 'statement'" (click)="tab.set('statement')">Statement</button>
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'requests'" [class.on]="tab() === 'requests'" (click)="tab.set('requests')">
            Top-up requests @if (pending() > 0) { <span class="count">{{ pending() }}</span> }
          </button>
        </div>

        @if (tab() === 'statement') {
          <article class="app-card table-card">
            @if (!entries()) {
              <p class="empty">Loading…</p>
            } @else if (entries()!.content.length === 0) {
              <p class="empty">No transactions yet. Add money to get started.</p>
            } @else {
              <div class="scroll">
                <table>
                  <thead><tr><th>Date</th><th>Details</th><th class="num">Amount</th><th class="num bal">Balance</th></tr></thead>
                  <tbody>
                    @for (e of entries()!.content; track e.id) {
                      <tr>
                        <td>{{ e.createdAt | date: 'd MMM y, h:mm a' }}</td>
                        <td><strong>{{ e.subTransactionTypeLabel }}</strong>
                          <span class="sub">{{ e.transactionNo }}@if (e.remarks) { · {{ e.remarks }} }</span></td>
                        <td class="num num-tabular" [class.credit]="e.transactionType === 'CR'" [class.debit]="e.transactionType === 'DR'">
                          {{ e.transactionType === 'CR' ? '+' : '−' }}{{ e.amount | currency: w.currency : 'symbol' : '1.2-2' }}</td>
                        <td class="num num-tabular bal">{{ e.balanceAfter | currency: w.currency : 'symbol' : '1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <nav class="pager" aria-label="Statement pages">
                <button class="btn btn--ghost" type="button" [disabled]="entries()!.first" (click)="loadEntries(entries()!.page - 1)">Previous</button>
                <span class="text-caption">Page {{ entries()!.page + 1 }} of {{ entries()!.totalPages || 1 }}</span>
                <button class="btn btn--ghost" type="button" [disabled]="!entries()!.hasNext" (click)="loadEntries(entries()!.page + 1)">Next</button>
              </nav>
            }
          </article>
        } @else {
          <article class="app-card table-card">
            @if (!requests()) {
              <p class="empty">Loading…</p>
            } @else if (requests()!.content.length === 0) {
              <p class="empty">You have not raised any top-up requests.</p>
            } @else {
              <div class="scroll">
                <table>
                  <thead><tr><th>Raised</th><th class="num">Amount</th><th>Status</th><th>Details</th></tr></thead>
                  <tbody>
                    @for (r of requests()!.content; track r.id) {
                      <tr>
                        <td>{{ r.createdAt | date: 'd MMM y, h:mm a' }}</td>
                        <td class="num num-tabular">{{ r.requestedAmount | currency: w.currency : 'symbol' : '1.2-2' }}</td>
                        <td><span class="badge" [class.badge--ok]="r.status === 'APPROVED'" [class.badge--warn]="r.status === 'PENDING'"
                                  [class.badge--bad]="r.status === 'REJECTED'">{{ topupLabel[r.status] }}</span></td>
                        <td><span class="sub">{{ r.remarks }}</span>
                          @if (r.status === 'REJECTED' && r.decisionRemarks) { <span class="sub bad">{{ r.decisionRemarks }}</span> }
                          @if (r.proofImageUrl) { <a [href]="r.proofImageUrl" target="_blank" rel="noopener">View proof</a> }</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <nav class="pager" aria-label="Top-up request pages">
                <button class="btn btn--ghost" type="button" [disabled]="requests()!.first" (click)="loadRequests(requests()!.page - 1)">Previous</button>
                <span class="text-caption">Page {{ requests()!.page + 1 }} of {{ requests()!.totalPages || 1 }}</span>
                <button class="btn btn--ghost" type="button" [disabled]="!requests()!.hasNext" (click)="loadRequests(requests()!.page + 1)">Next</button>
              </nav>
            }
          </article>
        }
      } @else if (!error()) {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  styles: [`
    .status { display:inline-flex; align-items:center; gap:8px; padding:6px 14px; border-radius:999px; font:700 .85rem var(--font-sans);
      background:var(--warning-bg); color:var(--warning); }
    .status.ok { background:var(--success-bg); color:var(--success); }
    .top { display:grid; grid-template-columns:minmax(16rem, 1fr) minmax(18rem, 1.4fr); gap:16px; align-items:start; }
    @media (max-width: 56rem) { .top { grid-template-columns:1fr; } }
    .balance, .add { padding:22px; display:flex; flex-direction:column; gap:12px; }
    .balance { background:var(--occpl-gradient-brand); color:#fff; border:0; }
    .label { margin:0; font:600 .8rem var(--font-sans); letter-spacing:.1em; text-transform:uppercase; opacity:.85; }
    .amount { margin:0; font:800 2.4rem var(--font-sans); letter-spacing:-.02em; }
    .balance dl { margin:0; display:flex; flex-direction:column; gap:6px; }
    .balance dl div { display:flex; justify-content:space-between; gap:12px; font-size:.9rem; }
    .balance dt { opacity:.8; } .balance dd { margin:0; font-weight:600; }
    .balance .alert { background:rgb(255 255 255 / 92%); }
    .add h2 { margin:0; }
    .field { display:flex; flex-direction:column; gap:6px; font:600 .85rem var(--font-sans); }
    .field input { min-height:2.9rem; padding:0 14px; border:2px solid var(--surface-border); border-radius:12px; background:var(--surface);
      color:var(--content-fg); font:600 1.1rem var(--font-sans); }
    .field input:focus { outline:0; border-color:var(--occpl-color-secondary, var(--brand-500)); box-shadow:0 0 0 3px var(--info-bg); }
    .quick { display:flex; flex-wrap:wrap; gap:8px; }
    .chip { border:1px solid var(--surface-border); background:var(--surface); color:var(--content-fg); font:600 .85rem var(--font-sans);
      padding:6px 14px; border-radius:999px; cursor:pointer; }
    .chip:hover { background:var(--occpl-color-info-surface); }
    .hint { margin:0; font:500 .85rem var(--font-sans); } .bad { color:var(--danger); }
    .actions { display:flex; flex-wrap:wrap; gap:10px; }
    .request { display:flex; flex-direction:column; gap:12px; padding-top:14px; border-top:1px solid var(--surface-border); }
    .request h3 { margin:0; font:700 1rem var(--font-sans); }
    .proof { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .tabs { display:flex; gap:6px; border-bottom:1px solid var(--surface-border); }
    .tabs button { border:0; background:transparent; padding:10px 16px; font:700 .95rem var(--font-sans); color:var(--content-muted);
      border-bottom:3px solid transparent; cursor:pointer; display:inline-flex; gap:8px; align-items:center; }
    .tabs button.on { color:var(--occpl-color-primary-strong); border-bottom-color:var(--occpl-color-primary); }
    .count { background:var(--warning-bg); color:var(--warning); border-radius:999px; padding:0 8px; font-size:.75rem; }
    .table-card { padding:0; overflow:hidden; }
    .scroll { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; }
    th, td { padding:12px 16px; text-align:left; vertical-align:top; }
    .num { text-align:right; white-space:nowrap; }
    @media (max-width: 40rem) { .bal { display:none; } th, td { padding:10px 12px; } }
    .sub { display:block; color:var(--content-muted); font-size:.85rem; }
    .credit { color:var(--success); font-weight:700; } .debit { color:var(--danger); font-weight:700; }
    .empty { margin:0; padding:28px 16px; text-align:center; color:var(--content-muted); }
    .pager { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:12px 16px; border-top:1px solid var(--surface-border); }
  `]
})
export class WalletPage implements OnInit {
  private readonly service = inject(WalletService);
  private readonly razorpay = inject(RazorpayService);
  private readonly notify = inject(NotificationService);

  protected readonly quick = QUICK_AMOUNTS;
  protected readonly topupLabel = TOPUP_LABEL;

  readonly wallet = signal<Wallet | null>(null);
  readonly entries = signal<Page<WalletEntry> | null>(null);
  readonly requests = signal<Page<TopupRequest> | null>(null);
  readonly error = signal<string | null>(null);
  readonly tab = signal<Tab>('statement');

  readonly amount = signal<number | null>(null);
  readonly paying = signal(false);
  readonly payNote = signal<string | null>(null);

  readonly showRequest = signal(false);
  readonly requestAmount = signal<number | null>(null);
  readonly remarks = signal('');
  readonly proofUrl = signal<string | null>(null);
  readonly proofName = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly requesting = signal(false);

  readonly pending = computed(() => this.requests()?.content.filter((r) => r.status === 'PENDING').length ?? 0);
  readonly amountError = computed(() => {
    const a = this.amount();
    if (a === null || a === undefined || (a as unknown) === '') return null;
    if (!(Number(a) >= 1)) return 'Enter at least 1.';
    if (Number(a) > MAX_AMOUNT) return 'That is more than can be added at once.';
    return null;
  });
  readonly canPay = computed(() => {
    const a = Number(this.amount());
    return this.wallet()?.status === 'ACTIVE' && a >= 1 && a <= MAX_AMOUNT && !this.paying();
  });
  readonly canRequest = computed(() => {
    const a = Number(this.requestAmount());
    return this.wallet()?.status === 'ACTIVE' && a > 0 && a <= MAX_AMOUNT && !!this.proofUrl() && !this.uploading() && !this.requesting();
  });

  ngOnInit(): void {
    this.service.wallet().subscribe({
      next: (w) => this.wallet.set(w),
      error: (e: HttpErrorResponse) => this.error.set(message(e, 'Your wallet could not be loaded.'))
    });
    this.loadEntries(0);
    this.loadRequests(0);
  }

  loadEntries(page: number): void {
    this.service.transactions(page).subscribe({
      next: (p) => this.entries.set(p),
      error: (e: HttpErrorResponse) => this.error.set(message(e, 'Your statement could not be loaded.'))
    });
  }

  loadRequests(page: number): void {
    this.service.topupRequests(page).subscribe({
      next: (p) => this.requests.set(p),
      error: (e: HttpErrorResponse) => this.error.set(message(e, 'Your top-up requests could not be loaded.'))
    });
  }

  addQuick(by: number): void {
    this.amount.set((Number(this.amount()) || 0) + by);
  }

  /** Open a gateway order, let the customer pay in Razorpay's window, then have the server verify and credit it. */
  payOnline(): void {
    if (!this.canPay()) return;
    this.paying.set(true);
    this.payNote.set(null);
    this.service.openRecharge(Number(this.amount())).subscribe({
      next: (order) => {
        this.razorpay.checkout(order, environment.appName).then(
          (paid) => this.settle(paid.razorpay_order_id, paid.razorpay_payment_id, paid.razorpay_signature),
          (e: Error) => {
            this.paying.set(false);
            if (e?.message !== CHECKOUT_DISMISSED) this.notify.error(e?.message || 'The payment could not be completed.');
          });
      },
      error: (e: HttpErrorResponse) => {
        this.paying.set(false);
        const why = message(e, 'Online payment could not be started.');
        this.notify.error(why);
        if (e.status === 422) {
          // No payment gateway is set up for this courier company: the bank-transfer route is the way in.
          this.payNote.set(`${why} You can still add money by bank transfer or cash.`);
          this.showRequest.set(true);
        }
      }
    });
  }

  private settle(orderId: string, paymentId: string, signature: string): void {
    this.service.completeRecharge(orderId, paymentId, signature).subscribe({
      next: () => {
        this.paying.set(false);
        this.amount.set(null);
        this.notify.success('Money added to your wallet.');
        this.refresh();
      },
      error: (e: HttpErrorResponse) => {
        this.paying.set(false);
        // The customer has paid. The server also hears from the gateway directly, so the credit normally still arrives.
        this.payNote.set(`${message(e, 'We could not confirm your payment yet.')} If money was taken from your account it is added automatically within a few minutes; check the statement before paying again.`);
        this.refresh();
      }
    });
  }

  pickProof(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!PROOF_TYPES.includes(file.type)) { this.notify.error('Upload a JPEG, PNG, WEBP or HEIC image.'); return; }
    if (file.size > MAX_PROOF_BYTES) { this.notify.error('The image is larger than 5 MB. Upload a smaller photo.'); return; }
    this.uploading.set(true);
    this.service.uploadProof(file).subscribe({
      next: (r) => { this.uploading.set(false); this.proofUrl.set(r.url); this.proofName.set(file.name); },
      error: (e: HttpErrorResponse) => { this.uploading.set(false); this.notify.error(message(e, 'The image could not be uploaded.')); }
    });
  }

  submitRequest(): void {
    if (!this.canRequest()) return;
    this.requesting.set(true);
    this.service.requestTopup(Number(this.requestAmount()), this.remarks().trim() || null, this.proofUrl()!).subscribe({
      next: () => {
        this.requesting.set(false);
        this.notify.success('Request sent. Your wallet is credited once your courier company approves it.');
        this.requestAmount.set(null);
        this.remarks.set('');
        this.proofUrl.set(null);
        this.proofName.set(null);
        this.showRequest.set(false);
        this.tab.set('requests');
        this.loadRequests(0);
      },
      error: (e: HttpErrorResponse) => { this.requesting.set(false); this.notify.error(message(e, 'The request could not be sent.')); }
    });
  }

  private refresh(): void {
    this.service.wallet().subscribe({ next: (w) => this.wallet.set(w), error: () => undefined });
    this.loadEntries(0);
  }
}

function message(e: HttpErrorResponse, fallback: string): string {
  return typeof e.error?.message === 'string' && e.error.message ? e.error.message : fallback;
}
