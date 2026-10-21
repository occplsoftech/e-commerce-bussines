# Changelog

## 0.6.0 — 2026-10-21

- Branding now matches the OCCPL platform portal: crimson primary (#d61f45 / #b3123a) with the indigo accent (#4338ca),
  the platform's neutrals and status colours (previously indigo primary with a crimson accent). The favicon set is the
  platform's (`favicon.ico`, 32 px, 192 px, Apple touch icon), served from the site root; theme colour is crimson.
- nginx: only hashed build files are cached for a year; the favicon and other unhashed files revalidate.
- Fixed: opening the bare address (`/`) showed the sign-in side panel with no form; it now redirects to the dashboard
  (and to sign-in when signed out).

## 0.5.0 — 2026-10-21 (customer portal phase 6)

- Security headers from one shared include (CSP without inline scripts, Permissions-Policy, COOP), correctly repeated in every
  nginx location; `no-store` on `/api/`; immutable caching for hashed assets; production build no longer inlines critical CSS
  (it needed an inline `onload`).
- Release workflow deploys to the dev server (`courier-deploy.sh portal <sha>`), smoke-tests it (app, config, CSP header,
  backend reachable through `/api`) and can roll back by SHA.
- `docs/SECURITY.md` (controls, tests, residual risks), README deployment section.

## 0.4.0 — 2026-10-21 (customer portal phase 5)

- Shipments: every booking made in the portal, newest first, filter (all, booked, awaiting confirmation, not booked),
  paging; a table on desktop and cards on phones.
- Shipment page: courier and service, tracking number, courier reference, estimated delivery, pickup and delivery,
  parcel, the price confirmed at booking, live tracking from the courier (refresh) and "Download label" (PDF fetched
  through the server; OCCPL network labels are printed at the branch, so none is offered). Clear messages for
  awaiting-confirmation and not-booked bookings, and when the courier has no label or tracking yet.
- Dashboard: tracking numbers open the shipment's status history.
- Profile: address book — add, edit, remove; pincode-based (city and district shown from the pincode); default pickup and
  delivery address. Booking form: "Use a saved address", and the default pickup/delivery address fills an empty form.
- Booking result links to the shipment page. Tests: 30.

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
