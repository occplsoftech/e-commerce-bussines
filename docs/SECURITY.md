# Security review — customer shipping portal (2026-10-21)

Scope: this app (`e-commerce-bussines`) and the `customerportal` module of `courier-service`. A code and configuration
review plus unit tests; **no penetration test, no run against a live server or database**.

## What the design guarantees, and where it is enforced

| Concern | Control | Where | Tested by |
|---|---|---|---|
| A customer sees another customer's data | The customer is never sent by the browser: it comes from `users.customer_id`, read fresh on every request; the account must be ACTIVE and the customer an ACTIVE business customer of the same company. Every booking, quote, label and tracking lookup also filters by company **and** customer; someone else's id answers 404. | `CurrentCustomerResolver`, `PortalBookingRepository.findOwned`, `RateQuoteRepository.findOwned` | `CurrentCustomerResolverTest`, `PortalShipmentServiceTest` (not-owned), `CustomerPortalAddressBookTest` (ownership) |
| A customer token used on staff APIs | `CUSTOMER` principals may call only `/api/v1/customer-portal/**` and `/api/v1/auth/**`; fail-closed when `CUSTOMER` is combined with another role; path tricks (`..`, `//`, `;`, `%`) refused. Impersonation endpoints are also role-gated twice. | `CustomerScopeFilter`, `SecurityConfig`, `AuthService` | `CustomerScopeFilterTest` |
| Price tampering | The browser sends no price. Amounts come from the stored quote option; a booking uses the frozen total. | `PortalBookingStore.start` | `PortalBookingStoreTest` |
| Double booking | `Idempotency-Key` unique per (company, customer); the quote row is locked; one active booking per quote; an ambiguous provider outcome is never retried. | `PortalBookingService/Store`, V128 unique key | `PortalBookingServiceTest`, `PortalBookingStoreTest` |
| Label download as a request forwarder (SSRF) | The browser never supplies or sees a URL. The server downloads only `https` URLs on the provider's own label hosts, no redirects, ≤ 10 MB, body must be a PDF. | `LabelFetcher` | `LabelFetcherTest` |
| Abuse of provider APIs / cost | Compare 20/min and tracking+label 30/min per account (in memory, per instance). | `CompareRateLimiter`, `ProviderCallLimiter` | `SlidingWindowLimiterTest`, `RateComparisonServiceTest` |
| Secrets | Provider credentials only in environment variables on the server; never in the image, the database or the browser; configuration classes have no `toString`; adapters log status codes and exception types only. | `CustomerPortalProperties` | review |
| Browser-side injection | Strict `Content-Security-Policy` (scripts only from this origin, no inline scripts; `frame-ancestors 'none'`), `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; Angular escapes all bindings; no `innerHTML`/`bypassSecurityTrust` in the app. | `docker/security-headers.conf`, `angular.json` (`inlineCritical: false`) | release smoke test checks the header is present |
| Caching of personal data | `/api/` answers `Cache-Control: no-store`; the label response also sets it; hashed assets are immutable, the shell is `no-cache`. | `nginx.conf` | — |

## Residual risks and decisions

1. **Tokens are kept in `localStorage`** (same as `courier-web`). An XSS would expose them; the CSP and Angular's escaping are
   the mitigation. Moving to HttpOnly cookies needs a backend change and is not done.
2. **Rate limits are in memory per backend instance.** Fine for the single-container VPS; use a shared store (Redis) before running
   several backend instances.
3. **Label hosts include `.amazonaws.com`** (Shiprocket and Delhivery serve labels from S3). A provider-supplied URL pointing at any
   S3 bucket would be fetched; the URL comes from the provider's own API response, not from a customer.
4. **Dependency audit:** `npm audit --omit=dev` (what ships) reports 0 vulnerabilities. The full audit reports 14 in
   development tooling only (vitest/vite dev server, Angular CLI's MCP helper, Tailwind's file watcher); none is in the image.
   Upgrading vitest 3→4 conflicts with `@angular/build` 20 peers, so it waits for the next Angular upgrade.
5. **Customer accounts appear in staff User Management** (they live in `users`). The scope gate keeps them in the portal even if a
   staff role were added; hiding them from staff screens is a follow-up.
6. **Unverified against live providers:** Shiprocket and Delhivery request/response fields are as documented and read defensively;
   confirm with each account (staging) before enabling `SHIPROCKET_ENABLED` / `DELHIVERY_ENABLED`.
7. **No staff reconciliation screen** for bookings in `OUTCOME_UNKNOWN` yet; operations resolve them with the provider by hand.
8. **GST rates** on the markup and on OCCPL network prices default to 18 % and must be confirmed with the accountant.
9. **nginx and the image were not built here** (no Docker in the review environment); the first CI run is their first test.
