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
    pincode: (pincode: string) => `/customer-portal/pincodes/${encodeURIComponent(pincode)}`,
    compareRates: '/customer-portal/rates/compare',
    quote: (id: string) => `/customer-portal/quotes/${encodeURIComponent(id)}`,
    book: '/customer-portal/shipments',
    bookings: '/customer-portal/bookings',
    booking: (id: string) => `/customer-portal/bookings/${encodeURIComponent(id)}`,
    bookingTracking: (id: string) => `/customer-portal/bookings/${encodeURIComponent(id)}/tracking`,
    bookingLabel: (id: string) => `/customer-portal/bookings/${encodeURIComponent(id)}/label`,
    shipmentTracking: (id: string) => `/customer-portal/shipments/${encodeURIComponent(id)}/tracking`,
    courierLogos: '/customer-portal/courier-logos',
    customers: '/customer-portal/customers',
    customer: (id: string) => `/customer-portal/customers/${encodeURIComponent(id)}`,
    customerAddresses: (id: string) => `/customer-portal/customers/${encodeURIComponent(id)}/addresses`,
    customerAddress: (id: string, addressId: string) =>
      `/customer-portal/customers/${encodeURIComponent(id)}/addresses/${encodeURIComponent(addressId)}`,
    addresses: '/customer-portal/addresses',
    address: (id: string) => `/customer-portal/addresses/${encodeURIComponent(id)}`
  }
} as const;
