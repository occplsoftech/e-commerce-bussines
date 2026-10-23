import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { API } from '@core/config/api-endpoints';

export type KycChannel = 'email' | 'mobile';
export type KycReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export interface KycUploaded {
  id: string; fileName: string; contentType: string; sizeBytes: number; uploadedAt: string;
  reviewStatus: KycReviewStatus; reviewNote: string | null; reviewedAt: string | null;
}
export interface KycSlot { code: string; label: string; hint: string; required: boolean; uploaded: KycUploaded | null; }
export interface KycView {
  subjectName: string;
  /** PENDING = steps left; UNDER_REVIEW = all done, waiting for the courier company to approve; COMPLETE = approved. */
  status: 'PENDING' | 'UNDER_REVIEW' | 'COMPLETE';
  email: string | null;
  emailVerified: boolean;
  mobile: string | null;
  mobileVerified: boolean;
  requiredUploaded: number;
  requiredApproved: number;
  requiredTotal: number;
  documents: KycSlot[];
  completedAt: string | null;
}

/** The business customer's own KYC. Keeps the last view so the dashboard can show a reminder. */
@Injectable({ providedIn: 'root' })
export class KycService {
  private readonly api = inject(ApiService);
  readonly current = signal<KycView | null>(null);

  view(): Observable<KycView> { return this.api.get<KycView>(API.portal.kyc).pipe(tap((v) => this.current.set(v))); }
  upload(documentType: string, file: File): Observable<KycView> {
    const body = new FormData();
    body.append('documentType', documentType);
    body.append('file', file);
    return this.api.post<KycView>(`${API.portal.kyc}/documents`, body).pipe(tap((v) => this.current.set(v)));
  }
  remove(documentId: string): Observable<KycView> {
    return this.api.deleteFor<KycView>(`${API.portal.kyc}/documents/${encodeURIComponent(documentId)}`).pipe(tap((v) => this.current.set(v)));
  }
  file(documentId: string): Observable<Blob> { return this.api.blob(`${API.portal.kyc}/documents/${encodeURIComponent(documentId)}/file`); }
  sendCode(channel: KycChannel): Observable<KycView> {
    return this.api.post<KycView>(`${API.portal.kyc}/verify/${channel}/send`, {}).pipe(tap((v) => this.current.set(v)));
  }
  verify(channel: KycChannel, code: string): Observable<KycView> {
    return this.api.post<KycView>(`${API.portal.kyc}/verify/${channel}`, { code }).pipe(tap((v) => this.current.set(v)));
  }
}
