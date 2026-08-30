import { TestBed } from '@angular/core/testing';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { adminGuard, authGuard } from './guards';
import { BootstrapStore } from '../bootstrap/bootstrap.store';
import { Session } from './session';

/**
 * The guards decide what a person may open. They are a courtesy, not a
 * protection: R-93 says every "can this person do this" runs on the server,
 * against the saved row, and hiding a screen is only a kindness. Typing an
 * admin address by hand must still be refused by the API (R-70), and the E2E
 * suite proves that separately by calling the endpoint directly.
 *
 * What these are actually for: not showing a person a screen that will only
 * fail, and sending a signed-out person somewhere useful instead of a blank.
 */
describe('what a person may open', () => {
  const route = {} as ActivatedRouteSnapshot;
  const stateAt = (url: string): RouterStateSnapshot => ({ url }) as RouterStateSnapshot;

  function setUp(options: {
    status: 'loading' | 'ready' | 'signedOut' | 'failed';
    isAdmin?: boolean;
  }) {
    const session = { signIn: vi.fn(), markSignedOut: vi.fn() };
    const store = {
      status: signal(options.status),
      isAdmin: signal(options.isAdmin ?? false),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BootstrapStore, useValue: store },
        { provide: Session, useValue: session },
      ],
    });

    return { session, router: TestBed.inject(Router) };
  }

  describe('the sign-in guard', () => {
    it('lets a signed-in person through', () => {
      setUp({ status: 'ready' });

      expect(TestBed.runInInjectionContext(() => authGuard(route, stateAt('/')))).toBe(true);
    });

    /**
     * SRS 15.8: "back to sign-in, and we remember which page they wanted".
     * A person who followed a link to a request should land on that request
     * after signing in, not on the board.
     */
    it('sends a signed-out person to the identity provider, remembering the page', () => {
      const { session } = setUp({ status: 'signedOut' });

      const allowed = TestBed.runInInjectionContext(() =>
        authGuard(route, stateAt('/requests/abc')),
      );

      expect(allowed).toBe(false);
      expect(session.signIn).toHaveBeenCalledWith('/requests/abc');
    });

    /**
     * The start-up call failed. The root component is already showing the error
     * with its Try again button, so the guard must not also send the person to
     * sign in — that would replace a retryable error with a pointless round
     * trip to Keycloak.
     */
    it('does not send them to sign in when the start-up call merely failed', () => {
      const { session } = setUp({ status: 'failed' });

      const allowed = TestBed.runInInjectionContext(() => authGuard(route, stateAt('/')));

      expect(allowed).toBe(false);
      expect(session.signIn).not.toHaveBeenCalled();
    });
  });

  describe('the admin guard', () => {
    it('lets an admin through', () => {
      setUp({ status: 'ready', isAdmin: true });

      expect(TestBed.runInInjectionContext(() => adminGuard(route, stateAt('/admin')))).toBe(true);
    });

    /**
     * SRS 15.7: "a normal person types the admin address -> the server refuses.
     * The screen is not just hidden." So we send them somewhere that says so,
     * rather than silently bouncing them to the board as though the address
     * never existed.
     */
    it('sends a normal person to a page that explains, not to the board', () => {
      const { router } = setUp({ status: 'ready', isAdmin: false });

      const result = TestBed.runInInjectionContext(() => adminGuard(route, stateAt('/admin')));

      expect(result).toEqual(router.parseUrl('/not-allowed'));
    });

    it('does not let a signed-out person through either', () => {
      const { session } = setUp({ status: 'signedOut', isAdmin: true });

      const result = TestBed.runInInjectionContext(() => adminGuard(route, stateAt('/admin')));

      expect(result).toBe(false);
      expect(session.signIn).toHaveBeenCalledWith('/admin');
    });
  });
});
