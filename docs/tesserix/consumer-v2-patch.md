# Consumer social login on V2

This release branch is based on the deployed upstream v4.19.5 commit
`a618740b578627b7b9acbbb111a6948882d6f5dc`. It does not include the unrelated
changes from the fork's current main branch.

Generic OAuth already maps the provider subject. The patch also maps typed
`given_name`/`first_name`, `family_name`/`last_name`, `name`,
`preferred_username`, and `email` profile values. Missing or non-string fields
stay empty. Email stays unverified even if the generic provider sends a
verification flag; automatic linking must not trust that flag. Existing provider
subject IDs are unchanged.

Login V2 consumes these mapped profile fields from the identity-provider intent,
allowing automatic social account creation when the required profile is present.
Meta must grant email access; the broker may require email verification. This
avoids V1 actions. Products still enforce their own organization, issuer, client
audience, nonce, sessions, and resource authorization.

The fork-only workflow tests the mapper and builds the upstream API and console
with its normal Nx dependency graph, then packages the binary using Tesserix's
pinned shared runtime. It publishes only
`ghcr.io/tesserix/zitadel-api-patched:sha-<full-commit>`. It does not invoke the
upstream release workflow or publish to upstream registries. A failed image scan
blocks release acceptance. Deployment requires a reviewed immutable image digest
in the owning GitOps repository and the normal production rollout approval.
