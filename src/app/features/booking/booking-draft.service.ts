import { Injectable, signal } from '@angular/core';

export interface PartyDetails {
  name: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
}

export interface PackageDetails {
  actualWeightKg: number | null;
  length: number | null;
  breadth: number | null;
  height: number | null;
  dimensionUnit: 'CM' | 'IN';
  packageCount: number | null;
  contents: string;
  declaredValue: number | null;
  paymentMode: 'PREPAID' | 'COD' | 'TOPAY';
  /** COD only: the amount to collect from the receiver (empty means the shipment value). It is paid into the wallet after delivery. */
  codAmount?: number | null;
}

export interface ShipmentDraft {
  pickup: PartyDetails;
  delivery: PartyDetails;
  package: PackageDetails;
  /** A return pickup of this delivered booking (OCCPL Network, prepaid). */
  returnOfBookingId?: string | null;
}

const KEY = 'ecb.booking.draft';

/**
 * The shipment being prepared, kept across the booking steps and a page reload (sessionStorage:
 * gone when the tab closes). It holds only what the customer typed — prices always come from the server.
 */
@Injectable({ providedIn: 'root' })
export class BookingDraftService {
  private readonly _draft = signal<ShipmentDraft | null>(read());
  readonly draft = this._draft.asReadonly();

  save(draft: ShipmentDraft): void {
    this._draft.set(draft);
    try { sessionStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* storage unavailable */ }
  }

  clear(): void {
    this._draft.set(null);
    try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  }
}

function read(): ShipmentDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ShipmentDraft) : null;
  } catch {
    return null;
  }
}
