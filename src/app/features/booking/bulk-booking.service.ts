import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '@core/config/api-endpoints';
import { ApiService } from '@core/services/api.service';

export interface BulkRow {
  row: number;
  deliveryName: string | null;
  deliveryPincode: string | null;
  weightKg: number | null;
  paymentMode: string;
  ok: boolean;
  error: string | null;
  quoteId: string | null;
  optionId: string | null;
  providerCode: string | null;
  providerName: string | null;
  serviceName: string | null;
  /** BUSINESS_RATE (the customer's own rate) or CHEAPEST. */
  basis: string | null;
  total: number | null;
}

export interface BulkPreview { rows: BulkRow[]; okCount: number; errorCount: number; okTotal: number; }
export interface BulkItem { row: number; quoteId: string; optionId: string; }
export interface BulkResult { row: number; booked: boolean; status: string; awb: string | null; reference: string | null; message: string; }

@Injectable({ providedIn: 'root' })
export class BulkBookingService {
  private readonly api = inject(ApiService);

  template(): Observable<Blob> { return this.api.blob(API.portal.bulkTemplate); }

  preview(file: File): Observable<BulkPreview> {
    const body = new FormData();
    body.append('file', file);
    return this.api.post<BulkPreview>(API.portal.bulkPreview, body);
  }

  book(items: BulkItem[]): Observable<BulkResult[]> { return this.api.post<BulkResult[]>(API.portal.bulkBook, { items }); }
}
