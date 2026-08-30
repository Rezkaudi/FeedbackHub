import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth/guards';

/**
 * Every feature is lazy, so the board does not carry the admin screens (R-133),
 * and the board's search, filters, sort and page live in the query string so a
 * view can be shared and found again with the back button (R-22).
 *
 * The order matters in one place: `sign-in-problem` sits outside the shell and
 * behind no guard. A person arriving there is by definition not signed in, and
 * guarding it would send them back to the identity provider in a loop.
 */
export const routes: Routes = [
  {
    path: 'sign-in-problem',
    loadComponent: () =>
      import('./features/sign-in-problem/sign-in-problem').then((m) => m.SignInProblem),
    title: 'Sign-in problem · FeedbackHub',
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/board/board').then((m) => m.Board),
        title: 'Board · FeedbackHub',
      },
      {
        path: 'requests/new',
        loadComponent: () =>
          import('./features/request-form/request-form').then((m) => m.RequestForm),
        title: 'New request · FeedbackHub',
      },
      {
        path: 'requests/:id/edit',
        loadComponent: () =>
          import('./features/request-form/request-form').then((m) => m.RequestForm),
        title: 'Edit request · FeedbackHub',
      },
      {
        path: 'requests/:id',
        loadComponent: () =>
          import('./features/request-detail/request-detail').then((m) => m.RequestDetail),
        title: 'Request · FeedbackHub',
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
        title: 'Settings · FeedbackHub',
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
      },
      {
        path: 'not-allowed',
        loadComponent: () => import('./features/not-allowed/not-allowed').then((m) => m.NotAllowed),
        title: 'Not allowed · FeedbackHub',
      },
      {
        path: '**',
        loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
        title: 'Not found · FeedbackHub',
      },
    ],
  },
];
