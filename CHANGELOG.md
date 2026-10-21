# Changelog

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
