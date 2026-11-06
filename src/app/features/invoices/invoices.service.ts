import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '@core/config/api-endpoints';
import { ApiService } from '@core/services/api.service';

export interface InvoiceRow {
  id: string; invoiceNumber: string; invoiceDate: string; periodFrom: string | null; periodTo: string | null; shipments: number;
  total: number; prepaid: number; due: number; paid: number; balance: number; status: 'UNPAID' | 'PARTLY_PAID' | 'PAID' | 'CANCELLED';
}
export interface InvoiceSummary { outstanding: number; unpaidInvoices: number; lastPaymentOn: string | null; lastPaymentAmount: number | null; invoices: InvoiceRow[]; }
export interface InvoiceLine {
  shipmentNumber: string; bookingDate: string | null; consignee: string | null; destinationPincode: string | null; quantity: number;
  weight: number | null; paymentMode: string | null; prepaid: boolean; gst: number; amount: number;
}
export interface InvoicePayment { paidOn: string | null; amount: number; method: string | null; reference: string | null; }
export interface InvoiceDetail { invoice: InvoiceRow; gst: number; customerName: string | null; lines: InvoiceLine[]; payments: InvoicePayment[]; }
export interface StatementLine { date: string | null; kind: 'INVOICE' | 'PAYMENT'; reference: string; debit: number; credit: number; balance: number; }
export interface Statement { from: string; to: string; opening: number; invoiced: number; paid: number; closing: number; lines: StatementLine[]; }

/** The customer's own invoices, payments and statement (read-only). */
@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private readonly api = inject(ApiService);

  summary(): Observable<InvoiceSummary> { return this.api.get<InvoiceSummary>(API.portal.invoices); }
  detail(id: string): Observable<InvoiceDetail> { return this.api.get<InvoiceDetail>(API.portal.invoice(id)); }
  statement(from: string, to: string): Observable<Statement> { return this.api.get<Statement>(API.portal.invoiceStatement, { from: from || null, to: to || null }); }
  statementExcel(from: string, to: string): Observable<Blob> { return this.api.blob(API.portal.invoiceStatementExport, { from: from || null, to: to || null }); }
}
