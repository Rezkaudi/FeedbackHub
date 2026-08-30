import { Routes } from '@angular/router';
import { AdminStore } from './admin.store';

/**
 * The admin screens. The store is provided here rather than per screen, so
 * moving between the tabs keeps what has already been read.
 *
 * Every one of these is also refused by the server to a non-admin (R-70); the
 * guard on the parent route is a courtesy, and the E2E suite proves the server
 * half by calling the endpoints directly.
 */
export const adminRoutes: Routes = [
  {
    path: '',
    providers: [AdminStore],
    loadComponent: () => import('./admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'taxonomy' },
      {
        path: 'taxonomy',
        loadComponent: () => import('./taxonomy/taxonomy-admin').then((m) => m.TaxonomyAdmin),
        title: 'Categories and statuses · FeedbackHub',
      },
      {
        path: 'settings',
        loadComponent: () => import('./app-settings/app-settings').then((m) => m.AppSettings),
        title: 'Application settings · FeedbackHub',
      },
      {
        path: 'comments',
        loadComponent: () => import('./moderation/pending-comments').then((m) => m.PendingComments),
        title: 'Waiting comments · FeedbackHub',
      },
      {
        path: 'invitations',
        loadComponent: () => import('./invitations/invitations').then((m) => m.Invitations),
        title: 'Invitations · FeedbackHub',
      },
    ],
  },
];
