import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { API } from '../config/api-endpoints';
import { Booking, PincodeInfo, PortalDashboard, PortalProfile, RateQuote } from '../models/portal.model';
import { ShipmentDraft } from '@features/booking/booking-draft.service';

/** The customer portal API. The server decides whose data this is — nothing here sends a customer id. */
@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly api = inject(ApiService);

  profile(): Observable<PortalProfile> { return this.api.get<PortalProfile>(API.portal.profile); }
  dashboard(): Observable<PortalDashboard> { return this.api.get<PortalDashboard>(API.portal.dashboard); }
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

  booking(bookingId: string): Observable<Booking> { return this.api.get<Booking>(API.portal.booking(bookingId)); }
}
