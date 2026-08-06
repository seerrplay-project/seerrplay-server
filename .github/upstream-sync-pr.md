## Automated upstream synchronization

This pull request merges the latest changes from
[`seerr-team/seerr:develop`](https://github.com/seerr-team/seerr/tree/develop)
into SeerrPlay Server.

The synchronization bot completed the following checks on the merge commit:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Maintainer checklist

- [ ] Review upstream release notes and security changes
- [ ] Review changes touching SeerrPlay-specific modules
- [ ] Run targeted playback and provider tests when applicable
- [ ] Merge using a merge commit; do not squash this synchronization PR

See the
[`docs/UPSTREAM_SYNC.md`](https://github.com/seerrplay-project/seerrplay-server/blob/develop/docs/UPSTREAM_SYNC.md)
maintenance guide for the branch strategy and conflict-resolution procedure.
