import { render, screen } from '@testing-library/angular';
import { SignInProblem } from './sign-in-problem';

const renderWith = (inputs: { problem: string; reason?: string }) =>
  render(SignInProblem, { inputs });

describe('SignInProblem', () => {
  it('offers a plain retry for a failed sign-in', async () => {
    await renderWith({ problem: 'sign_in_failed' });

    const action = screen.getByRole('link', { name: 'Try signing in again' });
    expect(action.getAttribute('href')).toBe('/v1/auth/sign-in');
  });

  it('offers a plain retry when the board is only busy', async () => {
    await renderWith({ problem: 'cannot_join_yet' });

    expect(screen.getByRole('link', { name: 'Try signing in again' })).toBeTruthy();
  });

  it('offers a different account for a refused address, not a pointless retry', async () => {
    await renderWith({ problem: 'cannot_join', reason: 'policy_invite_only' });

    expect(screen.queryByRole('link', { name: 'Try signing in again' })).toBeNull();
    const action = screen.getByRole('link', { name: 'Sign in with a different account' });
    expect(action.getAttribute('href')).toBe('/v1/auth/sign-in');
  });
});
