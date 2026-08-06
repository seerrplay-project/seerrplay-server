# Maintaining the Seerr upstream relationship

SeerrPlay Server is a long-lived fork of
[`seerr-team/seerr`](https://github.com/seerr-team/seerr). The repository keeps
upstream changes and SeerrPlay-specific development deliberately separated.

## Branches

- `upstream-develop` is an automated, exact mirror of `seerr-team/seerr:develop`.
- `develop` contains the current SeerrPlay Server integration state.
- `automation/upstream-sync` is recreated by automation for synchronization PRs.
- Feature work uses focused branches created from `develop`.

Never commit SeerrPlay changes directly to `upstream-develop`.

## Automated synchronization

The `Sync Seerr Upstream` workflow runs weekly and can also be started manually.
It refreshes `upstream-develop`, merges upstream into a temporary synchronization
branch, runs the complete validation suite, and opens or updates a PR into
`develop`.

GitHub Actions must be allowed to create pull requests in the organization
settings. Alternatively, configure a fine-grained repository secret named
`UPSTREAM_SYNC_TOKEN` with read/write access to repository contents, issues,
and pull requests.

The workflow never merges its own PR. A maintainer must review the upstream
changes and merge them using a merge commit. Squash merging an upstream sync PR
would make later synchronizations harder to audit.

If Git reports conflicts, the workflow leaves `develop` unchanged and opens an
issue labelled `upstream-conflict` containing the affected file paths.

## Resolving conflicts locally

```bash
git fetch origin
git fetch upstream develop
git switch develop
git pull --ff-only origin develop
git switch -C sync/upstream-manual
git merge upstream/develop
```

Resolve the files, run the project checks, commit the merge, and open a PR into
`develop`.

## Sending a change upstream

Changes intended for the official Seerr project must not include SeerrPlay-only
code. Create those branches directly from `upstream/develop`, follow Seerr's
contribution guide, and open the PR against `seerr-team/seerr:develop`.
