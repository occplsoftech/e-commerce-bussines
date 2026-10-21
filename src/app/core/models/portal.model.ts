/** Mirrors courier-service's customer portal API (module customerportal). */
export interface PortalAddress {
  id: string;
  addressType: string | null;
  addressUsage: string | null;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  stateId: string | null;
  districtId: string | null;
  cityId: string | null;
  pincodeId: string | null;
  defaultPickup: boolean;
  defaultDelivery: boolean;
}

export interface PortalProfile {
  customerId: string;
  customerCode: string;
  companyName: string | null;
  contactPerson: string | null;
  mobile: string | null;
  email: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  defaultPaymentMode: string | null;
  billingAddress: { line1: string | null; line2: string | null; city: string | null; state: string | null; pincode: string | null };
  addresses: PortalAddress[];
}

export type ShipmentStatus = 'BOOKED' | 'READY_FOR_MANIFEST' | 'MANIFEST_CREATED' | 'DISPATCHED' | 'IN_SCAN'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';

export interface PortalShipment {
  id: string;
  shipmentNumber: string;
  trackingNumber: string;
  bookingDate: string | null;
  status: ShipmentStatus;
  receiverName: string | null;
  packages: number | null;
  chargeableWeight: number | null;
  expectedDeliveryDate: string | null;
  createdAt: string;
}

export interface PortalDashboard {
  totalShipments: number;
  pendingBookings: number;
  booked: number;
  inTransit: number;
  delivered: number;
  returned: number;
  cancelled: number;
  recentShipments: PortalShipment[];
}

export interface PincodeInfo {
  pincode: string;
  known: boolean;
  area: string | null;
  city: string | null;
  district: string | null;
  serviceable: boolean;
  pickupAvailable: boolean;
  codAvailable: boolean;
  prepaidAvailable: boolean;
  odaApplicable: boolean;
}

export interface BreakdownLine { label: string; component: string; amount: number; }

export interface RateOption {
  optionId: string;
  providerCode: string;
  providerName: string;
  serviceName: string | null;
  transportMode: string | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  chargeableWeightKg: number | null;
  baseFreight: number;
  otherCharges: number;
  markupPercent: number | null;
  markupAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  breakdown: BreakdownLine[];
  validUntil: string | null;
}

export interface UnavailableProvider { providerCode: string; providerName: string; reason: string | null; }

export interface RateQuote {
  quoteId: string;
  status: 'OPEN' | 'BOOKED' | 'EXPIRED';
  expiresAt: string;
  pickupPincode: string;
  deliveryPincode: string;
  actualWeightKg: number;
  volumetricWeightKg: number;
  packageCount: number;
  declaredValue: number;
  paymentMode: string;
  options: RateOption[];
  unavailable: UnavailableProvider[];
}

export type BookingStatus = 'PENDING' | 'SUBMITTING' | 'BOOKED' | 'FAILED' | 'OUTCOME_UNKNOWN';

export interface Booking {
  bookingId: string;
  quoteId: string;
  optionId: string;
  status: BookingStatus;
  providerCode: string;
  providerName: string;
  totalAmount: number;
  currency: string;
  bookingReference: string | null;
  trackingNumber: string | null;
  labelAvailable: boolean;
  message: string | null;
  submittedAt: string | null;
  bookedAt: string | null;
}
