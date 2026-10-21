// Production build. Per-deployment values (company code, support contact) come from
// /assets/config.json at runtime — see core/config/runtime-config.service.ts.
export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
  appName: 'OCCPL SOFTECH',
  accessTokenSkewSeconds: 30
};
