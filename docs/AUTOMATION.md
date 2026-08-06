# Repository automation

SeerrPlay Server keeps the useful automation inherited from Seerr while making
credentials and publishing targets specific to this fork.

## Enabled without additional secrets

- `SeerrPlay Server CI` validates linting, types, tests, builds, and container
  creation on pull requests and pushes.
- `PR Validation` checks Conventional Commit titles and completed pull request
  templates.
- `SeerrPlay Labeller` labels issues and pull requests from their content and
  changed paths.
- `CodeQL` and dependency review check source and dependency changes.
- `Stale` manages inactive issues and pull requests.
- `Sync Seerr Upstream` maintains the `upstream-develop` mirror and prepares a
  reviewed synchronization pull request.
- `Cypress Tests` still runs and reports failures, but remains advisory while
  the inherited Seerr modal-state failures are unresolved. Set
  `ENFORCE_CYPRESS` to `true` when the suite is stable to make failures block
  the workflow.

## Optional automation

### Upstream pull requests

Enable **Allow GitHub Actions to create and approve pull requests** in the
organization's Actions settings. If that organization-level option must remain
disabled, add a fine-grained `UPSTREAM_SYNC_TOKEN` repository secret with
read/write access to contents, issues, and pull requests.

### Renovate

Install the Renovate GitHub App for `seerrplay-project/seerrplay-server`. The
local `.github/renovate.json5` presets will then create dependency update pull
requests. Dependabot vulnerability alerts remain enabled, but its automatic
security pull requests are disabled because its current updater runs Node.js 24
while the inherited Seerr project requires Node.js 22. Set the repository
variable `ENABLE_HELM_AUTOMATION` to `true` only after adding
`APP_SEERR_HELM_CLIENT_ID` and
`APP_SEERR_HELM_PRIVATE_KEY` for a GitHub App allowed to update Renovate chart
branches.

### Duplicate issue detector

Add the `GROQ_API_KEY` secret, set the `EMBEDDING_MODEL` and `GROQ_MODEL`
repository variables, then set `ENABLE_DUPLICATE_DETECTOR` to `true`. Until
then, both duplicate-detection workflows remain safely skipped.

### Container releases

Container publishing targets only
`ghcr.io/seerrplay-project/seerrplay-server`. After the first `latest` image is
published, set `ENABLE_CONTAINER_RELEASES` to `true` to enable the scheduled
Trivy scan. Release signing uses GitHub's OIDC identity and does not require a
stored Cosign private key.

### Documentation website

Set `ENABLE_DOCS_PAGES` to `true` only after GitHub Pages is configured for the
repository. Until then, documentation builds and link checks still run on pull
requests, while deployment remains safely skipped.

### Notifications

Add `DISCORD_WEBHOOK` to receive CI failure notifications. CI continues
normally when this secret is absent.

## Branch protection

Protect `develop` against force pushes and deletion, require pull requests, and
require successful CI and PR-validation checks. Do not protect
`upstream-develop` against force pushes: synchronization deliberately replaces
that mirror with the exact current upstream commit.
