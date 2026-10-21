import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('@layouts/auth-layout').then((m) => m.AuthLayout),
    children: [
      { path: 'login', canActivate: [guestGuard], loadComponent: () => import('@features/auth/login').then((m) => m.Login), title: 'Sign in · OCCPL SOFTECH' },
      { path: 'forgot-password', loadComponent: () => import('@features/auth/forgot-password').then((m) => m.ForgotPassword), title: 'Forgot password · OCCPL SOFTECH' },
      { path: 'reset-password', loadComponent: () => import('@features/auth/reset-password').then((m) => m.ResetPassword), title: 'Reset password · OCCPL SOFTECH' },
      { path: 'verify-email', loadComponent: () => import('@features/auth/verify-email').then((m) => m.VerifyEmail), title: 'Activate account · OCCPL SOFTECH' }
    ]
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('@layouts/portal-layout').then((m) => m.PortalLayout),
    children: [
      { path: 'dashboard', loadComponent: () => import('@features/dashboard/dashboard').then((m) => m.Dashboard), title: 'Dashboard · OCCPL SOFTECH' },
      { path: 'book', loadComponent: () => import('@features/booking/new-shipment').then((m) => m.NewShipment), title: 'Book a shipment · OCCPL SOFTECH' },
      { path: 'book/confirm/:quoteId/:optionId', loadComponent: () => import('@features/booking/confirm-booking').then((m) => m.ConfirmBooking), title: 'Confirm booking · OCCPL SOFTECH' },
      { path: 'book/result/:bookingId', loadComponent: () => import('@features/booking/booking-result').then((m) => m.BookingResult), title: 'Booking result · OCCPL SOFTECH' },
      { path: 'book/rates/:quoteId', loadComponent: () => import('@features/booking/compare-rates').then((m) => m.CompareRates), title: 'Compare rates · OCCPL SOFTECH' },
      { path: 'shipments', loadComponent: () => import('@features/shipments/shipments').then((m) => m.Shipments), title: 'Shipments · OCCPL SOFTECH' },
      { path: 'shipments/track/:shipmentId', loadComponent: () => import('@features/shipments/shipment-tracking').then((m) => m.ShipmentTracking), title: 'Track shipment · OCCPL SOFTECH' },
      { path: 'shipments/:bookingId', loadComponent: () => import('@features/shipments/booking-detail').then((m) => m.BookingDetail), title: 'Shipment · OCCPL SOFTECH' },
      { path: 'profile', loadComponent: () => import('@features/profile/profile').then((m) => m.Profile), title: 'Profile · OCCPL SOFTECH' },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
