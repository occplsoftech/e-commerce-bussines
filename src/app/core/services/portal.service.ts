import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { API } from '../config/api-endpoints';
import { PincodeInfo, PortalDashboard, PortalProfile } from '../models/portal.model';

/** The customer portal API. The server decides whose data this is — nothing here sends a customer id. */
@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly api = inject(ApiService);

  profile(): Observable<PortalProfile> { return this.api.get<PortalProfile>(API.portal.profile); }
  dashboard(): Observable<PortalDashboard> { return this.api.get<PortalDashboard>(API.portal.dashboard); }
  pincode(pincode: string): Observable<PincodeInfo> { return this.api.get<PincodeInfo>(API.portal.pincode(pincode)); }
}
