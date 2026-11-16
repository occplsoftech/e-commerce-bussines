import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { API } from '@core/config/api-endpoints';
import { Page } from '@core/models/portal.model';

export type OrderStatus = 'NEW' | 'BOOKED' | 'ARCHIVED';

/** An order that arrived from the customer's own system (API key; Shopify / WooCommerce later) and waits to be booked. */
export interface PortalOrder {
  id: string; source: string; orderNumber: string; status: OrderStatus;
  buyer: { name: string; phone: string; address: string; pincode: string; city: string | null; state: string | null };
  parcel: { weightKg: number; lengthCm: number; breadthCm: number; heightCm: number; count: number; contents: string; declaredValue: number };
  payment: { mode: 'PREPAID' | 'COD'; codAmount: number | null };
  items: { name: string; quantity: number; price?: number }[] | null;
  notes: string | null; receivedAt: string; bookingId: string | null; bookedAt: string | null; trackingNumber: string | null; courier: string | null;
}
export interface OrderCounts { newOrders: number; booked: number; archived: number; }
/** One order priced for booking (the business rate, else the cheapest allowed courier). */
export interface OrderQuoteRow {
  orderId: string; orderNumber: string | null; deliveryName: string | null; deliveryPincode: string | null; ok: boolean; error: string | null;
  quoteId: string | null; optionId: string | null; providerCode: string | null; providerName: string | null; serviceName: string | null;
  basis: string | null; total: number | null;
}
export interface ApiKeyView { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; }
export interface CreatedApiKey { view: ApiKeyView; key: string; }

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly api = inject(ApiService);

  list(status: OrderStatus | 'ALL', page = 0, size = 20): Observable<Page<PortalOrder>> {
    return this.api.get<Page<PortalOrder>>(API.portal.orders, { status, page, size });
  }
  counts(): Observable<OrderCounts> { return this.api.get<OrderCounts>(`${API.portal.orders}/counts`); }
  get(id: string): Observable<PortalOrder> { return this.api.get<PortalOrder>(API.portal.order(id)); }
  archive(id: string): Observable<PortalOrder> { return this.api.post<PortalOrder>(`${API.portal.order(id)}/archive`, {}); }
  restore(id: string): Observable<PortalOrder> { return this.api.post<PortalOrder>(`${API.portal.order(id)}/restore`, {}); }
  quote(orderIds: string[]): Observable<OrderQuoteRow[]> { return this.api.post<OrderQuoteRow[]>(`${API.portal.orders}/quote`, { orderIds }); }

  keys(): Observable<ApiKeyView[]> { return this.api.get<ApiKeyView[]>(API.portal.apiKeys); }
  createKey(name: string): Observable<CreatedApiKey> { return this.api.post<CreatedApiKey>(API.portal.apiKeys, { name }); }
  revokeKey(id: string): Observable<ApiKeyView> { return this.api.deleteFor<ApiKeyView>(`${API.portal.apiKeys}/${encodeURIComponent(id)}`); }
}
