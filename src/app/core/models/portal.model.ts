/** Mirrors courier-service's customer portal API (module customerportal). */
export type AddressType = 'HOME' | 'OFFICE' | 'WAREHOUSE';
export type AddressUsage = 'PICKUP' | 'DELIVERY' | 'BOTH';

/** One saved address. City and district come from the pincode master. */
export interface PortalAddress {
  id: string;
  addressType: AddressType | null;
  addressUsage: AddressUsage | null;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  pincode: string | null;
  area: string | null;
  city: string | null;
  district: string | null;
  defaultPickup: boolean;
  defaultDelivery: boolean;
  version: number | null;
}

export interface AddressRequest {
  addressType: AddressType;
  addressUsage: AddressUsage;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  pincode: string;
  defaultPickup: boolean;
  defaultDelivery: boolean;
  expectedVersion: number | null;
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
  website: string | null;
  /** The customer's own brand logo as a data URL, or null. */
  logoDataUrl: string | null;
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

/** Shipment history filter; an empty value means "all". Dates are yyyy-MM-dd, both inclusive. */
export interface BookingFilter {
  /** One status, or several comma-separated. */
  status: string;
  /** One delivery stage (booked shipments only), or several comma-separated. */
  delivery: string;
  provider: string;
  from: string;
  to: string;
}

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

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
}

/** One row of the booking history. */
/** Where a booked shipment is, as last reported by its courier (kept fresh by the server). */
export type DeliveryStage = 'AWAITING_PICKUP' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';
export interface DeliveryInfo {
  stage: DeliveryStage;
  /** The courier's own words, e.g. "Reached at destination hub". */
  text: string | null;
  location: string | null;
  at: string | null;
  /** When the server last asked the courier. */
  checkedAt: string | null;
}

export interface BookingSummary {
  bookingId: string;
  status: BookingStatus;
  providerCode: string;
  providerName: string;
  serviceName: string | null;
  transportMode: string | null;
  bookingReference: string | null;
  trackingNumber: string | null;
  pickupCity: string | null;
  pickupPincode: string | null;
  deliveryName: string | null;
  deliveryCity: string | null;
  deliveryPincode: string | null;
  packageCount: number | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
  bookedAt: string | null;
  deliveryStatus?: DeliveryInfo | null;
}

export interface BookingParty { name: string | null; phone: string | null; address: string | null; pincode: string | null; city: string | null; state: string | null; }

export interface BookingParcel {
  actualWeightKg: number | null;
  volumetricWeightKg: number | null;
  chargeableWeightKg: number | null;
  packageCount: number | null;
  length: number | null;
  breadth: number | null;
  height: number | null;
  dimensionUnit: string | null;
  contents: string | null;
  declaredValue: number | null;
  paymentMode: string | null;
}

/** One booking in full: as quoted and booked. Amounts are the frozen quote's. */
export interface BookingDetail {
  bookingId: string;
  quoteId: string;
  status: BookingStatus;
  providerCode: string;
  providerName: string;
  serviceName: string | null;
  transportMode: string | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  bookingReference: string | null;
  trackingNumber: string | null;
  labelDownloadable: boolean;
  message: string | null;
  pickup: BookingParty;
  delivery: BookingParty;
  parcel: BookingParcel | null;
  charges: BreakdownLine[];
  totalAmount: number;
  currency: string;
  submittedAt: string | null;
  bookedAt: string | null;
  createdAt: string;
  deliveryStatus?: DeliveryInfo | null;
}

export interface TrackingEvent { at: string | null; status: string | null; location: string | null; description: string | null; }

export interface TrackingView {
  bookingId: string;
  providerName: string;
  trackingNumber: string | null;
  available: boolean;
  status: string | null;
  currentLocation: string | null;
  events: TrackingEvent[];
  message: string | null;
  retrievedAt: string;
}

/** A counter-booked shipment's history, newest first. */
export interface ShipmentTracking {
  shipment: PortalShipment;
  steps: { status: ShipmentStatus; at: string; location: string | null }[];
}

/** The rate calculator's input: two pincodes and a package. Dimensions are optional. */
export interface EstimateRequest {
  pickupPincode: string;
  deliveryPincode: string;
  packageCount: number;
  actualWeightKg: number;
  declaredValue: number;
  length: number | null;
  breadth: number | null;
  height: number | null;
  dimensionUnit: 'CM' | 'IN';
  paymentMode: 'PREPAID' | 'COD';
}

/** A customer this customer registered (the server records the registering customer as its parent). */
export interface SubCustomer {
  id: string;
  customerCode: string;
  displayName: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  mobile: string;
  email: string | null;
  contactPerson: string | null;
  status: string;
  version: number;
}

export interface SubCustomerRequest {
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  mobile: string;
  email: string | null;
  contactPerson: string | null;
  expectedVersion: number | null;
}
