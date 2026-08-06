## Description

This pull request merges the latest changes from
[`seerr-team/seerr:develop`](https://github.com/seerr-team/seerr/tree/develop)
into SeerrPlay Server.

The branch and pull request are maintained automatically. A maintainer must
still review and merge the changes.

## How Has This Been Tested?

The synchronization bot completed the following checks on the merge commit:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Screenshots / Logs (if applicable)

Not applicable to upstream synchronization.

## Checklist:

- [x] I have read and followed the contribution guidelines for this repository.
- [x] Disclosed any use of AI (none used by this synchronization workflow).
- [x] I have kept SeerrPlay-specific changes isolated from upstream code where practical.
- [x] I have updated the documentation accordingly, when required.
- [x] All new and existing tests passed.
- [x] Successful build `pnpm build`
- [x] Translation keys `pnpm i18n:extract` (not applicable unless translations changed)
- [x] Database migration (not applicable unless migrations changed)

Maintainer review:

- [ ] Review upstream release notes and security changes
- [ ] Review changes touching SeerrPlay-specific modules
- [ ] Run targeted playback and provider tests when applicable
- [ ] Merge using a merge commit; do not squash this synchronization PR

See the
[`docs/UPSTREAM_SYNC.md`](https://github.com/seerrplay-project/seerrplay-server/blob/develop/docs/UPSTREAM_SYNC.md)
maintenance guide for the branch strategy and conflict-resolution procedure.
