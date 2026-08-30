import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';
import { BootstrapStore } from './core/bootstrap/bootstrap.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // R-22 asks a board view to be findable again with the back button, which
      // means the scroll position has to come back with it.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    /**
     * The one call, started before the router resolves anything (R-52, H-4).
     *
     * It is awaited so no route can render against a half-known world, and it
     * never rejects, so a failure becomes an error screen rather than the blank
     * page a rejected initializer would produce.
     */
    provideAppInitializer(() => inject(BootstrapStore).load()),
  ],
};
