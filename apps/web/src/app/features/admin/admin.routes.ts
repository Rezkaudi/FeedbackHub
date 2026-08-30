import { Routes } from '@angular/router';

/**
 * Filled in with feature 6. The route exists now so the admin guard has
 * something to guard and the nav link has somewhere to go.
 */
export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-home').then((m) => m.AdminHome),
    title: 'Admin · FeedbackHub',
  },
];
