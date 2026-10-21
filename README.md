# e-commerce-business — OCCPL SOFTECH customer shipping portal

Angular 20 web app for a courier company's **business customers**: sign in, enter a shipment, compare courier
rates, book, and follow shipments. The backend is [`courier-service`](https://github.com/occplsoftech/courier-service)
(module `customerportal`); it decides prices, ownership and bookings. Design and phases:
`courier-service/MEMORY/modules/customer-portal.md`.

## Run locally

```bash
npm install -g npm@11   # the lockfile is cut with npm 11
npm ci
npm start               # http://localhost:4300, proxies /api to courier-service on :8081
npx ng test --watch=false
npm run build
```

Sign in with a **customer portal account**: a company admin creates it for a business customer in courier-web
(`POST /api/v1/customers/{id}/portal-access`). Staff accounts are refused here.

## Configuration

Per deployment, at container start (`docker/40-runtime-config.sh` writes `assets/config.json`):

| Variable | Meaning |
|---|---|
| `PORTAL_COMPANY_CODE` | Courier company whose customers sign in here. Blank shows a Company code field. |
| `PORTAL_COMPANY_NAME` | Brand shown in the app (default `OCCPL SOFTECH`). |
| `PORTAL_SUPPORT_EMAIL` | Contact shown on the sign-in page. |

The container's nginx forwards `/api/` to a host named `backend` (resolved per request).

## Structure

`src/app/core` (auth, API client, interceptors, guards, models), `layouts` (auth split screen, signed-in shell),
`features` (auth, dashboard, booking, profile), `shared`. Conventions follow `courier-web`: standalone components,
signals, OnPush, one `ApiService` that unwraps the `ApiResponse` envelope.

## Status

Phase 5 of 6: sign-in, activation, password reset, dashboard, shipment details with pincode checks, rate comparison
(sorting, breakdown, unavailable couriers, expiry), idempotent booking with confirmation and result, shipment history,
live tracking, label download, profile with address book. Phase 6 (hardening, deployment) follows.

## Security

See [docs/SECURITY.md](docs/SECURITY.md): what is enforced where, what is tested, and the residual risks.

## Pipeline

`CI` on every pull request (tests, production build, image build). `Release` on every merge to `main` publishes
`ghcr.io/<owner>/e-commerce-business` (tags: commit SHA and `dev`); deployment is added with the hosting phase.

## Deployment

The portal runs as the `courier-portal` container next to the courier backend (OCCPL repository, `infra/vps`, runbook
section 7a): its nginx serves the app and forwards `/api/` to the backend, so the browser talks to one origin.

Runtime settings (environment variables of the container, read at every start into `assets/config.json`):

| Variable | Meaning |
|---|---|
| `PORTAL_COMPANY_CODE` | Courier company whose customers sign in (blank: the sign-in page asks for a company code) |
| `PORTAL_COMPANY_NAME` | Brand shown in the app (default `OCCPL SOFTECH`) |
| `PORTAL_SUPPORT_EMAIL` | Shown on the sign-in page |

Backend settings (courier-service): `CUSTOMER_PORTAL_BASE_URL` (links in emails), the CORS origin list, and the courier
credentials `SHIPROCKET_*` / `DELHIVERY_*` — see runbook section 7a.

Every merge to `main` runs the **Release** workflow: tests, build, publish `ghcr.io/<owner>/e-commerce-business:<sha>`,
deploy over SSH (`courier-deploy.sh portal <sha>`, which rolls back by itself if the container is not healthy) and smoke-test.
One-time setup in this repository: environment `dev` with variables `VPS_HOST`, `PORTAL_URL` (e.g. `https://portal.dev.occplsoftech.com`)
and secrets `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` (the same values the courier repositories use). Roll back by running the workflow
by hand with an earlier full commit SHA.
