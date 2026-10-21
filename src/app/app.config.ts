import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { RuntimeConfigService } from '@core/config/runtime-config.service';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { requestIdInterceptor } from '@core/interceptors/request-id.interceptor';
import { loadingInterceptor } from '@core/interceptors/loading.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Order matters: request-id, auth header, loading, then error (outermost catch) — as in courier-web.
    provideHttpClient(withInterceptors([requestIdInterceptor, authInterceptor, loadingInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    provideAppInitializer(() => inject(RuntimeConfigService).load())
  ]
};
