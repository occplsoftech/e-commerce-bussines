/** Backend paths, relative to environment.apiBaseUrl. One place for every URL the portal calls. */
export const API = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    verifyEmail: '/auth/verify-email',
    changePassword: '/auth/change-password'
  },
  portal: {
    profile: '/customer-portal/profile',
    dashboard: '/customer-portal/dashboard',
    pincode: (pincode: string) => `/customer-portal/pincodes/${encodeURIComponent(pincode)}`
  }
} as const;
