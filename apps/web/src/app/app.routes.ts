import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth/guards';

export const routes: Routes = [
  {
    path: 'sign-in-problem',
    loadComponent: () =>
      import('./features/sign-in-problem/sign-in-problem').then((m) => m.SignInProblem),
    title: 'Sign-in problem · FeedbackHub',
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
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
          import('./features/request-form/request-form-page').then((m) => m.RequestFormPage),
        title: 'New request · FeedbackHub',
      },
      {
        path: 'requests/:id',
        loadComponent: () =>
          import('./features/request-detail/request-detail').then((m) => m.RequestDetail),
        title: 'Request · FeedbackHub',
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
        title: 'Profile · FeedbackHub',
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
