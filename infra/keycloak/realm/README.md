# The FeedbackHub realm

`feedbackhub-realm.json` is imported by Keycloak on every start
(`start-dev --import-realm`), so the reviewer has a working sign-in with no step
to perform (R-80).

**Do not put comments in that file.** Keycloak's importer rejects any field it
does not recognise, including `_comment` keys, and the whole realm import fails
with `Unrecognized field`. That is why the notes live here instead.

## What is in it, and why

**Token lifetimes.** `accessTokenLifespan: 86400` and
`ssoSessionIdleTimeout: 604800` (with `ssoSessionMaxLifespan: 604800`) implement
R-9a: the access token lives one day and the refresh token one week. These
**must** match `AUTH_COOKIE_ACCESS_MAX_AGE` and `AUTH_COOKIE_REFRESH_MAX_AGE` in
the API's environment. If they drift, a cookie outlives its token or dies before
it. `revokeRefreshToken: true` with `refreshTokenMaxReuse: 0` is the rotation
R-9a relies on. When the refresh token is finally spent, the web app renews
once, sees the renewal fail, and sends the person to sign in — it never shows
the raw 401.

**The client.** `feedbackhub-api` is a *confidential* client (R-3b): its secret
lives only on our server, in an environment variable, and never in the front-end
build. PKCE with S256 is required. The secret here
(`local-development-only-secret`) is a development value and matches
`docker-compose.yml`; a real deployment sets its own (R-102).

**Email.** `smtpServer` points at the Mailpit container (`mailpit:1025`, no TLS,
no auth). Without it "Forgot password?" fails with *"Failed to send email"*,
because `resetPasswordAllowed` only shows the link — Keycloak still needs a mail
server to send it through. Nothing here reaches the internet: read the mail at
http://localhost:8025.

**Social sign-in.** R-2 asks for email/password *and* at least one social
account. One identity provider is defined, **Google**, `enabled: true`, but its
`clientId`/`clientSecret` are left **empty** because real credentials cannot be
committed (R-102). The Google button therefore renders on the Keycloak login
page but does not work: clicking it fails on Keycloak's side (an empty client
id), and the e2e suite's `01-08-google-idp.cy.ts` documents this as a known gap
rather than pretending to test a real social login. To make it real: Keycloak
admin console → Identity providers → Google → set the client id and secret. The
email and password flow works out of the box with no setup.

The redirect URI to register with the provider is
`http://localhost:8080/realms/feedbackhub/broker/google/endpoint`. It points at
Keycloak, never at our API: the API only ever sees the end of the handshake.

Google has `trustEmail: true`, so once real credentials are set, a Google
sign-in is treated as having a verified email — relevant because the
`domain_restricted` sign-up rule refuses an unchecked email even on an allowed
domain (R-67).

## The test accounts

| Email | Password | Role in FeedbackHub |
|---|---|---|
| `admin@feedbackhub.local` | `password` | Admin |
| `bo@feedbackhub.local` | `password` | Admin |
| `sam@feedbackhub.local` | `password` | User |
| `rae@feedbackhub.local` | `password` | User |

Bo is a second admin, added so e2e can prove admin-vs-admin cases (one admin
undoing another admin's change) and the "last admin cannot leave" invariant
without ever touching Ada, who every other spec assumes is present and an
admin.

Their Keycloak ids are **pinned** in this file, and
`apps/api/prisma/seed/seed.ts` uses those same ids as `external_id`. That is
what keeps the two in step: R-4 matches people by external id, so without
pinning, signing in as the seeded admin would create a *new* record as an
ordinary user and there would be no admin at all. See DECISIONS.md D-26.

Changing a user's id here means changing it in the seed too.
