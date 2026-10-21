# Changelog

## 0.3.0 — 2026-10-21 (customer portal phase 4)

- Confirm booking: courier, full price breakdown, shipment summary, confirmation checkbox, "Book for ₹…".
  One idempotency key per confirmation, reused on every retry, and the button is locked while a request is in flight,
  so repeated clicks or a lost response never create a second booking.
- Booking result: Booked (courier reference, tracking number or "issued when collected"), Not booked (nothing payable,
  choose another courier) or Awaiting confirmation (do not book again; OCCPL confirms with the courier).
- Expired rates and an already-booked quote are explained. Tests: 20.

## 0.2.0 — 2026-10-21 (customer portal phase 3)

- "Compare rates" sends the shipment to courier-service and opens the comparison: every priced courier service
  with delivery estimate (when the courier gives one), chargeable weight, total payable and a full breakdown
  (freight, charges, OCCPL service charge, taxes). Sort by lowest price, fastest delivery or courier name.
- Couriers that could not price the shipment are listed with the reason; an empty result says so.
- Rates show their validity; an expired comparison must be refreshed before a service can be selected.
- Selecting a service keeps the choice for the confirmation step (next phase). The browser never sends a price.
- Shared five-step progress bar. Tests: 16 (sorting, compare request, validation message).

## 0.1.0 — 2026-10-21 (customer portal phase 2)

- New Angular 20 app, same conventions as courier-web, OCCPL indigo/crimson brand, responsive down to phone width.
- Sign-in for customer portal accounts only (a staff login is signed out at once with a clear message), keep-me-signed-in,
  token refresh, sign-out; account activation (`/verify-email`), forgot/reset password by company code.
- Dashboard: total, pending bookings, booked, in transit, delivered, returned, cancelled; recent shipments; Book action.
- Book a shipment, step 1: pickup, delivery and package details with validation (pincode, Indian mobile, weight,
  dimensions, count, value, prepaid/COD); a valid pincode fills the city and shows whether OCCPL's network serves it.
  The draft is kept for the rate comparison step; no prices are shown until the server provides them.
- Profile: company details, billing address and saved addresses (read-only).
- Runtime config (`PORTAL_COMPANY_CODE`, `PORTAL_COMPANY_NAME`, `PORTAL_SUPPORT_EMAIL`), nginx with per-request
  backend resolution and security headers, CI and Release workflows.
- Tests: 11 unit tests (validators, login helpers, auth service incl. staff refusal, booking form).
