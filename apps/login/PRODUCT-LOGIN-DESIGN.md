# Product login on the shared ZITADEL UI

Roamie uses the existing public native clients, authorization code with PKCE,
and exact `roamie:/auth/callback` redirect. Its hosted page should show genuine
Roamie branding and collect the login name and password together.

The deployed Login V2 UI already checks a login name and password together in
`sendPassword`, then applies password expiry, email verification and MFA before
completing the original authorization request. Reuse that path. Do not introduce
a password grant, a mobile client secret, another identity store or new roles.

Resolve branding on the server using the client ID returned by ZITADEL for the
pending OIDC request. Strip incoming product headers in the existing proxy and
derive the request ID from the URL. Query strings cannot choose a product. A
small checked-in catalog maps registered clients to product presentation; clients
without a profile retain the existing UI. Each request resolves independently so
two tabs for different products cannot overwrite each other's branding.

The server layout passes only public product presentation to a React provider.
The shared theme uses it on sign-in, registration, recovery and verification/MFA
pages. The username form uses the combined credential form only for configured
products; existing products retain their current form and policy decisions.

Assets are existing Roamie artwork, served locally with the login app's base path.
Passwords exist only in the form and the existing server action; they are never
stored, included in URLs, logged or returned in errors. ZITADEL owns credentials,
lockout, verification and factors. The assets at risk are login credentials,
sessions and authorization codes; untrusted browsers and other product users
cross the existing login-server/ZITADEL boundary. Branding never authorizes a
session or bypasses an upstream factor check.

Planning assumptions, not measured load: 10 login starts/second, credential
payloads below 4 KiB, and one extra read per rendered authentication page. Bound
the branding lookup at two seconds; leave unrelated clients unaffected when it
fails. The catalog adds no datastore or recurring infrastructure cost. Existing
credential and MFA services remain critical dependencies. OIDC request records
remain owned by ZITADEL and are not cached by the theme resolver.

Release from the deployed `v4.15.3-aurora.4` baseline. Publish an immutable login
image, then pin it in GitOps. Enable Login V2 only for the two Roamie native apps
using the existing bootstrap application's `loginBaseUri` reconciliation. Capture
their pre-change configuration privately before activation. Rollback restores
those app login settings and the previous immutable login image through GitOps.
No database migration or user-account change is needed.
