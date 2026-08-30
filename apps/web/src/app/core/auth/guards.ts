import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { BootstrapStore } from '../bootstrap/bootstrap.store';
import { Session } from './session';

/**
 * R-93: hiding a screen is only a kindness. Every one of these decisions is
 * made again on the server, against the saved row, and typing an admin address
 * by hand is refused there (R-70) whatever these guards do.
 *
 * What they are for is the other half: not walking a person into a screen that
 * can only fail, and sending a signed-out person somewhere useful.
 */

export const authGuard: CanActivateFn = (_route, state) => {
  const bootstrap = inject(BootstrapStore);
  const session = inject(Session);

  if (bootstrap.status() === 'ready') {
    return true;
  }

  if (bootstrap.status() === 'signedOut') {
    session.signIn(state.url);
    return false;
  }

  /**
   * 'failed' or still 'loading'. The root component is already showing the
   * error and its Try again button, so we refuse the route and leave it there.
   * Sending them to Keycloak would trade a retryable error for a round trip
   * that cannot fix a server that is down.
   */
  return false;
};

export const adminGuard: CanActivateFn = (route, state) => {
  const bootstrap = inject(BootstrapStore);

  const signedIn = authGuard(route, state);
  if (signedIn !== true) {
    return signedIn;
  }

  if (bootstrap.isAdmin()) {
    return true;
  }

  /**
   * SRS 15.7 wants a person who types an admin address to be told, not silently
   * bounced to the board as though the address never existed.
   */
  return inject(Router).parseUrl('/not-allowed');
};
