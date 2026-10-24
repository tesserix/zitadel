# Optional consumer email sign-in

Email OTP is an additional, explicitly enabled sign-in method for an
operator-owned consumer organization. Existing organizations are not opted in.
An authorized owner can request enablement or disablement through the owning
`ZitadelProject` claim (`consumerOrganization.emailOtp`). There is no tenant
settings UI in this change. Hospital tenants sharing a consumer organization
cannot independently configure this organization-wide policy; they need an
explicit verified organization binding before independent settings are exposed.

| Claim setting | Behavior |
| --- | --- |
| Omitted | No opt-in; existing social sign-in remains unchanged |
| `true` | Show the email option when current ownership and OIDC scope match |
| `false` | Hide the option and reject pending email sign-in completion |

A tenant must be able to continue using its existing supported methods without
configuring this option. Disabling an already configured option uses explicit
`false`; deleting the field is rejected by operator admission. SMS is disabled,
including fallback. WhatsApp is not implemented here. Staff password, passkey,
social login and MFA flows retain their existing behavior. This email flow rejects
accounts with other enrolled methods and organizations requiring MFA.

## Trust and storage boundaries

Zitadel owns users, email verification, OTP delivery and verification, sessions,
and OIDC authorization requests. The login service checks the current operator
ownership marker and policy on each attempt and again before callback creation.
Browser-supplied organization IDs are not authorization. A mailbox is not a
patient identifier and does not grant clinical access.

`CONSUMER_EMAIL_VALKEY_URL` configures the shared Valkey store used by every login
replica. Use an OpenBao-managed credential, an ACL restricted to
`consumer-email:v1:*`, and protected transport/network access. Never expose this
URL to the browser. Five-minute flows contain a native session token, the mailbox
and identity binding; treat the store as credential-bearing infrastructure.
Cookies contain only an opaque handle (HttpOnly, Secure in production,
SameSite=Strict). Codes and session tokens are not returned to the client.

Valkey enforces a shared one-minute cooldown, five sends per mailbox per hour,
and 100 sends per organization per minute. Flow handles are consumed atomically
once. Cache outages fail closed, with no process-local bypass. A wrong code or
an interrupted attempt requires restarting after the cooldown. The native API
calls made by the login engine have five-second deadlines and are not blindly
retried: a timeout can occur after an email has already been sent.

New users prove ownership of their email before a separate native sign-in
challenge is issued. The challenge remains bound to the original email, user,
organization, instance and authorization request. Verification rejects changed
mailboxes, disabled accounts, other authentication factors, revoked policy,
expired sessions and mismatched native session identities.

## Release verification

Deploy the compatible login and operator releases before enabling a claim.
Preserve the deployed consumer organization-scope parsing fix and existing broker
social-provider patches. Do not promote unrelated Helivanta application or
schema changes as part of this release.

Tests exercise the engine with native API fixtures and a real disposable Valkey
process. They do not prove native API compatibility, SMTP delivery, or a product
callback. Before rollout, run the real signup, mailbox verification, returning
login, wrong/reused/expired code and cross-organization cases against an isolated
Zitadel instance, then verify the authorized production test mailbox and the
product OIDC callback. A Ready claim or passing unit suite is not that evidence.

## Repeatable native integration test

Prerequisites are Node 24, pnpm, Go, local PostgreSQL tools (`initdb`, `pg_ctl`),
`valkey-server` and `uv`. The runner installs pinned `aiosmtpd==1.4.6` into its
private temporary environment. It uses synthetic accounts and captures mail
locally; it never sends mail to a real inbox.

From the repository root:

```sh
pnpm nx run @zitadel/api:generate
GOMAXPROCS=2 go build -p 2 -o /tmp/consumer-email-zitadel .
CONSUMER_EMAIL_ZITADEL_BINARY=/tmp/consumer-email-zitadel \
  node apps/login/scripts/test-consumer-email-native.mjs
```

The runner creates an isolated database, identity instance, consumer organization,
login-client credential and PKCE client. It exercises native SMTP verification,
OTP verification, authorization-code exchange, userinfo, single-use consumption,
invalid-code rejection, organization opt-out, re-enablement and pending-flow
revocation. Processes are stopped afterward; successful fixtures are deleted.
Failed fixture directories are protected and retained for diagnosis. They contain
local credentials and captured codes and must never be published or committed.
The fixture checks engine/native integration; production browser and mailbox
verification remain a separate release gate.
