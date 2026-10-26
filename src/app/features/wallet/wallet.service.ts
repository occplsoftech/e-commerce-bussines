import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '@core/config/api-endpoints';
import { Page } from '@core/models/portal.model';
import { ApiService } from '@core/services/api.service';
import { CheckoutOrder } from '@core/services/razorpay.service';

export type WalletStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'CLOSED';
export type TopupStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Wallet {
  id: string;
  customerId: string;
  walletNumber: string;
  status: WalletStatus;
  /** Spendable now. */
  availableBalance: number;
  /** Reserved against in-flight work; not spendable. */
  holdBalance: number;
  totalBalance: number;
  currency: string;
  createdAt: string;
}

/** One line of the statement. `transactionType` is CR (money in) or DR (money out). */
export interface WalletEntry {
  id: string;
  transactionNo: string;
  transactionType: 'CR' | 'DR';
  transactionTypeLabel: string;
  subTransactionType: string;
  subTransactionTypeLabel: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface TopupRequest {
  id: string;
  requestedAmount: number;
  remarks: string | null;
  proofImageUrl: string | null;
  status: TopupStatus;
  createdAt: string;
  decidedAt: string | null;
  decisionRemarks: string | null;
}

/** The gateway order for checkout, as the server returns it. */
export interface RechargeOrder extends CheckoutOrder {
  gateway: string;
  receipt: string;
}

/** The signed-in customer's own wallet. The server derives the customer from the sign-in; nothing here names one. */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly api = inject(ApiService);

  wallet(): Observable<Wallet> { return this.api.get<Wallet>(API.portal.wallet); }

  transactions(page: number, size = 20): Observable<Page<WalletEntry>> {
    return this.api.get<Page<WalletEntry>>(API.portal.walletTransactions, { page, size });
  }

  topupRequests(page: number, size = 20): Observable<Page<TopupRequest>> {
    return this.api.get<Page<TopupRequest>>(API.portal.walletTopupRequests, { page, size });
  }

  /** Step one of an online recharge: the server fixes the amount at the gateway. Nothing is credited yet. */
  openRecharge(amount: number): Observable<RechargeOrder> {
    return this.api.post<RechargeOrder>(API.portal.walletRechargeOrder, { amount });
  }

  /** Step two: the server verifies the signature, asks the gateway what was paid and credits that. Safe to repeat. */
  completeRecharge(gatewayOrderId: string, paymentReference: string, signature: string): Observable<WalletEntry> {
    return this.api.post<WalletEntry>(API.portal.walletRecharge, { gatewayOrderId, paymentReference, signature });
  }

  uploadProof(file: File): Observable<{ url: string }> {
    const body = new FormData();
    body.append('file', file);
    return this.api.post<{ url: string }>(API.portal.walletTopupProof, body);
  }

  requestTopup(amount: number, remarks: string | null, proofImageUrl: string): Observable<TopupRequest> {
    return this.api.post<TopupRequest>(API.portal.walletTopupRequests, { amount, remarks, proofImageUrl });
  }
}
