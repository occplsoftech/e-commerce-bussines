import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { API } from '../config/api-endpoints';
import {
  AddressRequest, Booking, BookingDetail, BookingStatus, BookingSummary, Page, PincodeInfo, PortalAddress,
  PortalDashboard, PortalProfile, RateQuote, ShipmentTracking, TrackingView
} from '../models/portal.model';
import { ShipmentDraft } from '@features/booking/booking-draft.service';

/** The customer portal API. The server decides whose data this is — nothing here sends a customer id. */
@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly api = inject(ApiService);

  profile(): Observable<PortalProfile> { return this.api.get<PortalProfile>(API.portal.profile); }
  dashboard(): Observable<PortalDashboard> { return this.api.get<PortalDashboard>(API.portal.dashboard); }
  /** The logos the company uploaded for its couriers, by courier code (data URLs). */
  courierLogos(): Observable<Record<string, string>> { return this.api.get<Record<string, string>>(API.portal.courierLogos); }
  pincode(pincode: string): Observable<PincodeInfo> { return this.api.get<PincodeInfo>(API.portal.pincode(pincode)); }

  /** Asks the server to price the draft with every courier. The draft carries no price; the server does all pricing. */
  compareRates(draft: ShipmentDraft): Observable<RateQuote> {
    return this.api.post<RateQuote>(API.portal.compareRates, { pickup: draft.pickup, delivery: draft.delivery, pkg: draft.package });
  }

  quote(quoteId: string): Observable<RateQuote> { return this.api.get<RateQuote>(API.portal.quote(quoteId)); }

  /**
   * Books the chosen service. The same idempotency key must be reused for every retry of one confirmation,
   * so the server returns the first booking instead of creating another.
   */
  book(quoteId: string, optionId: string, idempotencyKey: string): Observable<Booking> {
    return this.api.post<Booking>(API.portal.book, { quoteId, optionId }, { 'Idempotency-Key': idempotencyKey });
  }

  bookings(status: BookingStatus | '' , page: number, size = 20): Observable<Page<BookingSummary>> {
    return this.api.get<Page<BookingSummary>>(API.portal.bookings, { status, page, size });
  }

  booking(bookingId: string): Observable<BookingDetail> { return this.api.get<BookingDetail>(API.portal.booking(bookingId)); }

  /** Asked of the courier on every call; the server limits how often. */
  tracking(bookingId: string): Observable<TrackingView> { return this.api.get<TrackingView>(API.portal.bookingTracking(bookingId)); }

  label(bookingId: string): Observable<Blob> { return this.api.blob(API.portal.bookingLabel(bookingId)); }

  shipmentTracking(shipmentId: string): Observable<ShipmentTracking> {
    return this.api.get<ShipmentTracking>(API.portal.shipmentTracking(shipmentId));
  }

  addresses(): Observable<PortalAddress[]> { return this.api.get<PortalAddress[]>(API.portal.addresses); }
  addAddress(body: AddressRequest): Observable<PortalAddress> { return this.api.post<PortalAddress>(API.portal.addresses, body); }
  updateAddress(id: string, body: AddressRequest): Observable<PortalAddress> { return this.api.put<PortalAddress>(API.portal.address(id), body); }
  removeAddress(id: string): Observable<void> { return this.api.delete(API.portal.address(id)); }
}
