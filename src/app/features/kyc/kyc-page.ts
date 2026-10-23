import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Icon } from '@shared/components/icon';
import { NotificationService } from '@core/services/notification.service';
import { KycChannel, KycReviewStatus, KycService, KycSlot } from './kyc.service';

const REVIEW: Record<KycReviewStatus, string> = { PENDING_REVIEW: 'Waiting for approval', APPROVED: 'Approved', REJECTED: 'Rejected' };
const STATUS = { PENDING: 'KYC pending', UNDER_REVIEW: 'Under review', COMPLETE: 'KYC complete' } as const;

const TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The business customer's KYC: verify e-mail and mobile with a code and upload the business documents. The courier
 * company then approves or rejects each document; KYC is complete once every required one is approved.
 */
@Component({
  selector: 'ecb-kyc-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, DatePipe, DecimalPipe, FormsModule],
  template: `
    <section class="page">
      <div class="page__head">
        <div>
          <h1 class="text-display">KYC</h1>
          <p class="text-caption">Verify your e-mail and mobile and upload your business documents. Your courier company then reviews each document.</p>
        </div>
        @if (view(); as v) {
          <span class="status" [class.ok]="v.status === 'COMPLETE'" [class.info]="v.status === 'UNDER_REVIEW'">
            <ecb-icon [name]="v.status === 'COMPLETE' ? 'verified_user' : 'hourglass_top'" /> {{ statusLabels[v.status] }}</span>
        }
      </div>

      @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }

      @if (view(); as v) {
        <article class="app-card box">
          <div class="progress" role="progressbar" [attr.aria-valuenow]="done()" [attr.aria-valuemax]="total()">
            <span [style.width.%]="(done() / total()) * 100"></span>
          </div>
          <p class="text-caption">{{ done() }} of {{ total() }} steps done
            @if (v.status === 'UNDER_REVIEW') { — everything is in. Your courier company is reviewing your documents. }</p>
          @if (rejected(); as n) {
            <p class="alert alert--error" role="alert">{{ n }} document{{ n > 1 ? 's were' : ' was' }} rejected. See the reason below and upload a new file.</p>
          }

          <h2 class="sec">Contact verification</h2>
          @for (c of channels; track c.key) {
            <div class="row">
              <span class="ico" [class.ok]="verified(c.key)"><ecb-icon [name]="verified(c.key) ? 'check_circle' : c.icon" /></span>
              <div class="main"><strong>{{ c.label }}</strong><span class="muted">{{ (c.key === 'email' ? v.email : v.mobile) || 'Not on record — ask your courier company to add it' }}</span></div>
              @if (verified(c.key)) {
                <span class="badge badge--ok">Verified</span>
              } @else if (sent()[c.key]) {
                <input class="code" inputmode="numeric" maxlength="6" placeholder="6-digit code" [attr.aria-label]="c.label + ' code'"
                       [ngModel]="codes()[c.key]" (ngModelChange)="setCode(c.key, $event)" />
                <button class="btn btn--primary" type="button" [disabled]="busy() === c.key + ':verify' || (codes()[c.key] || '').length !== 6"
                        (click)="verify(c.key)">Verify</button>
                <button class="btn btn--ghost" type="button" [disabled]="busy() === c.key + ':send'" (click)="send(c.key)">Resend</button>
              } @else {
                <button class="btn btn--ghost" type="button" [disabled]="busy() === c.key + ':send' || !(c.key === 'email' ? v.email : v.mobile)"
                        (click)="send(c.key)">{{ busy() === c.key + ':send' ? 'Sending…' : 'Send code' }}</button>
              }
            </div>
          }

          <h2 class="sec">Business documents</h2>
          @for (d of v.documents; track d.code) {
            <div class="row">
              <span class="ico" [class.ok]="d.uploaded?.reviewStatus === 'APPROVED'" [class.bad]="d.uploaded?.reviewStatus === 'REJECTED'"
                    [class.wait]="d.uploaded?.reviewStatus === 'PENDING_REVIEW'">
                <ecb-icon [name]="!d.uploaded ? 'description' : d.uploaded.reviewStatus === 'APPROVED' ? 'task_alt' : d.uploaded.reviewStatus === 'REJECTED' ? 'error' : 'hourglass_top'" /></span>
              <div class="main">
                <strong>{{ d.label }}@if (!d.required) { <em> (optional)</em> }</strong>
                @if (d.uploaded; as u) {
                  <span class="muted">{{ u.fileName }} · {{ u.sizeBytes / 1024 | number: '1.0-0' }} KB · {{ u.uploadedAt | date: 'medium' }}</span>
                  <span class="review" [class.ok]="u.reviewStatus === 'APPROVED'" [class.bad]="u.reviewStatus === 'REJECTED'">
                    {{ reviewLabels[u.reviewStatus] }}@if (u.reviewStatus === 'REJECTED' && u.reviewNote) { — {{ u.reviewNote }} }</span>
                } @else { <span class="muted">{{ d.hint }}</span> }
              </div>
              <div class="acts">
                @if (d.uploaded; as u) {
                  <button class="btn btn--ghost" type="button" (click)="open(u.id)">View</button>
                  <button class="btn btn--ghost danger" type="button" (click)="remove(u.id)">Remove</button>
                }
                <button class="btn" [class.btn--primary]="!d.uploaded" [class.btn--ghost]="!!d.uploaded" type="button"
                        [disabled]="busy() === d.code" (click)="picker.click()">
                  <ecb-icon name="upload" /> {{ busy() === d.code ? 'Uploading…' : d.uploaded ? 'Replace' : 'Upload' }}
                </button>
                <input #picker type="file" hidden accept="application/pdf,image/jpeg,image/png" (change)="pick(d, $event)" [attr.aria-label]="'Choose ' + d.label" />
              </div>
            </div>
          }
          <p class="text-caption">PDF, JPEG or PNG, up to 5 MB each.</p>
        </article>
      } @else if (!error()) {
        <p class="text-caption">Loading…</p>
      }
    </section>
  `,
  styles: [`
    .box { padding:20px 22px; display:flex; flex-direction:column; gap:10px; }
    .status { display:inline-flex; align-items:center; gap:8px; padding:6px 14px; border-radius:999px; font:700 .85rem var(--font-sans);
      background:var(--warning-bg); color:var(--warning); }
    .status.ok { background:var(--success-bg); color:var(--success); }
    .progress { height:10px; border-radius:999px; background:var(--occpl-color-neutral-surface); overflow:hidden; }
    .progress span { display:block; height:100%; background:var(--occpl-gradient-button); transition:width .3s; }
    .sec { margin:14px 0 2px; font:800 .8rem var(--font-sans); letter-spacing:.1em; text-transform:uppercase; color:var(--content-muted); }
    .row { display:flex; align-items:center; gap:14px; padding:12px 0; border-top:1px solid var(--surface-border); flex-wrap:wrap; }
    .ico { display:grid; place-items:center; width:2.5rem; height:2.5rem; border-radius:12px; background:var(--occpl-color-neutral-surface); color:var(--content-muted); font-size:1.2rem; }
    .ico.ok { background:var(--success-bg); color:var(--success); }
    .ico.bad { background:var(--danger-bg); color:var(--danger); } .ico.wait { background:var(--warning-bg); color:var(--warning); }
    .review { font:700 .82rem var(--font-sans); color:var(--warning); }
    .review.ok { color:var(--success); } .review.bad { color:var(--danger); }
    .status.info { background:var(--info-bg); color:var(--info); }
    .main { flex:1; min-width:12rem; display:flex; flex-direction:column; gap:2px; }
    .main em { font-style:normal; font-weight:500; color:var(--content-muted); }
    .muted { color:var(--content-muted); font-size:.9rem; }
    .acts { display:flex; gap:8px; flex-wrap:wrap; }
    .acts .btn, .row > .btn { min-height:2.4rem; padding:0 16px; }
    .danger { color:var(--danger); }
    .code { width:9rem; min-height:2.4rem; padding:0 12px; border:2px solid var(--surface-border); border-radius:10px; font:800 1rem var(--font-sans); letter-spacing:.2em; }
    .badge--ok { background:var(--success-bg); color:var(--success); }
  `]
})
export class KycPage implements OnInit {
  private readonly kyc = inject(KycService);
  private readonly notify = inject(NotificationService);
  readonly view = this.kyc.current;
  readonly error = signal<string | null>(null);
  readonly busy = signal<string | null>(null);
  readonly sent = signal<Record<string, boolean>>({});
  readonly codes = signal<Record<string, string>>({});
  protected readonly channels: { key: KycChannel; label: string; icon: string }[] = [
    { key: 'email', label: 'E-mail address', icon: 'mail' },
    { key: 'mobile', label: 'Mobile number', icon: 'smartphone' }
  ];
  protected readonly reviewLabels = REVIEW;
  protected readonly statusLabels = STATUS;
  /** Each required document counts twice — uploaded, then approved — plus e-mail and mobile. */
  readonly done = computed(() => {
    const v = this.view();
    return v ? v.requiredUploaded + v.requiredApproved + (v.emailVerified ? 1 : 0) + (v.mobileVerified ? 1 : 0) : 0;
  });
  readonly total = computed(() => (this.view()?.requiredTotal ?? 0) * 2 + 2);
  readonly rejected = computed(() => this.view()?.documents.filter((d) => d.uploaded?.reviewStatus === 'REJECTED').length ?? 0);

  ngOnInit(): void {
    this.kyc.view().subscribe({ error: (e: HttpErrorResponse) => this.error.set(message(e, 'Your KYC could not be loaded.')) });
  }

  verified(c: KycChannel): boolean {
    const v = this.view();
    return !!v && (c === 'email' ? v.emailVerified : v.mobileVerified);
  }

  setCode(c: KycChannel, value: string): void {
    this.codes.update((m) => ({ ...m, [c]: String(value ?? '').replace(/\D/g, '').slice(0, 6) }));
  }

  send(c: KycChannel): void {
    this.busy.set(c + ':send');
    this.kyc.sendCode(c).subscribe({
      next: () => { this.busy.set(null); this.sent.update((m) => ({ ...m, [c]: true })); this.notify.success(c === 'email' ? 'Code sent to your e-mail.' : 'Code sent to your mobile.'); },
      error: (e: HttpErrorResponse) => { this.busy.set(null); this.notify.error(message(e, 'The code could not be sent.')); }
    });
  }

  verify(c: KycChannel): void {
    this.busy.set(c + ':verify');
    this.kyc.verify(c, this.codes()[c] ?? '').subscribe({
      next: () => { this.busy.set(null); this.notify.success(c === 'email' ? 'E-mail verified.' : 'Mobile verified.'); },
      error: (e: HttpErrorResponse) => { this.busy.set(null); this.notify.error(message(e, 'The code could not be checked.')); }
    });
  }

  pick(slot: KycSlot, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) { this.notify.error('Upload a PDF, JPEG or PNG file.'); return; }
    if (file.size > MAX_BYTES) { this.notify.error('The file is larger than 5 MB. Upload a smaller scan or photo.'); return; }
    this.busy.set(slot.code);
    this.kyc.upload(slot.code, file).subscribe({
      next: () => { this.busy.set(null); this.notify.success(`${slot.label} uploaded.`); },
      error: (e: HttpErrorResponse) => { this.busy.set(null); this.notify.error(message(e, 'The document could not be uploaded.')); }
    });
  }

  remove(documentId: string): void {
    if (!confirm('Remove this document? You can upload it again at any time.')) return;
    this.kyc.remove(documentId).subscribe({
      next: () => this.notify.success('Document removed.'),
      error: (e: HttpErrorResponse) => this.notify.error(message(e, 'The document could not be removed.'))
    });
  }

  open(documentId: string): void {
    this.kyc.file(documentId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('The document could not be opened.')
    });
  }
}

function message(e: HttpErrorResponse, fallback: string): string {
  return typeof e.error?.message === 'string' && e.error.message ? e.error.message : fallback;
}
