import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { API } from '@core/config/api-endpoints';
import { Page } from '@core/models/portal.model';

export type OrderStatus = 'NEW' | 'BOOKED' | 'ARCHIVED';

/** An order that arrived from the customer's own system (API key, Shopify or WooCommerce) and waits to be booked. */
export interface PortalOrder {
  id: string; source: string; orderNumber: string; status: OrderStatus;
  buyer: { name: string; phone: string; address: string; pincode: string; city: string | null; state: string | null };
  parcel: { weightKg: number; lengthCm: number; breadthCm: number; heightCm: number; count: number; contents: string; declaredValue: number };
  payment: { mode: 'PREPAID' | 'COD'; codAmount: number | null };
  items: { name: string; quantity: number; price?: number }[] | null;
  notes: string | null; receivedAt: string; bookingId: string | null; bookedAt: string | null; trackingNumber: string | null; courier: string | null;
  /** SENT / FAILED: the tracking number sent back to the store (Shopify / WooCommerce orders). */
  shopSync: 'SENT' | 'FAILED' | null; shopSyncError: string | null;
}
export interface OrderCounts { newOrders: number; booked: number; archived: number; }
/** One order priced for booking (the business rate, else the cheapest allowed courier). */
export interface OrderQuoteRow {
  orderId: string; orderNumber: string | null; deliveryName: string | null; deliveryPincode: string | null; ok: boolean; error: string | null;
  quoteId: string | null; optionId: string | null; providerCode: string | null; providerName: string | null; serviceName: string | null;
  basis: string | null; total: number | null;
}
export type StorePlatformKey = 'shopify' | 'woocommerce';
export interface ShopSkipped { orderNumber: string; reason: string; at: string; }
export interface ShopConnection {
  id: string; platform: 'SHOPIFY' | 'WOOCOMMERCE'; shopDomain: string; shopName: string | null; paused: boolean; fulfilBack: boolean; connectedAt: string;
  lastImportAt: string | null; importedCount: number; lastError: string | null; skipped: ShopSkipped[];
}
export interface ShopImportResult { checked: number; imported: number; alreadyIn: number; skipped: number; error: string | null; }
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

  store(p: StorePlatformKey): Observable<ShopConnection | null> { return this.api.get<ShopConnection | null>(API.portal.store(p)); }
  connectStore(p: StorePlatformKey, body: { shopDomain?: string; accessToken?: string; storeUrl?: string; consumerKey?: string;
    consumerSecret?: string; fulfilBack: boolean }): Observable<ShopConnection> {
    return this.api.post<ShopConnection>(API.portal.store(p), body);
  }
  storeSettings(p: StorePlatformKey, change: { paused?: boolean; fulfilBack?: boolean }): Observable<ShopConnection> {
    return this.api.patch<ShopConnection>(API.portal.store(p), change);
  }
  importStore(p: StorePlatformKey): Observable<ShopImportResult> { return this.api.post<ShopImportResult>(`${API.portal.store(p)}/import`, {}); }
  disconnectStore(p: StorePlatformKey): Observable<void> { return this.api.deleteFor<void>(API.portal.store(p)); }

  keys(): Observable<ApiKeyView[]> { return this.api.get<ApiKeyView[]>(API.portal.apiKeys); }
  createKey(name: string): Observable<CreatedApiKey> { return this.api.post<CreatedApiKey>(API.portal.apiKeys, { name }); }
  revokeKey(id: string): Observable<ApiKeyView> { return this.api.deleteFor<ApiKeyView>(`${API.portal.apiKeys}/${encodeURIComponent(id)}`); }
}
