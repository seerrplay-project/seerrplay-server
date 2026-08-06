<p align="center">
  <a href="https://seerrplay.dev">
    <img
      src="https://raw.githubusercontent.com/seerrplay-project/seerrplay/main/apps/seerrplay/assets/branding/seerrplay_primary_logo.svg"
      alt="SeerrPlay"
      width="440"
    />
  </a>
</p>

<p align="center">
  <strong>Discover, request, and play your self-hosted media from one ecosystem.</strong>
</p>

<p align="center">
  <a href="https://github.com/seerrplay-project/seerrplay-server/actions/workflows/ci.yml"><img src="https://github.com/seerrplay-project/seerrplay-server/actions/workflows/ci.yml/badge.svg?branch=develop" alt="SeerrPlay Server CI" /></a>
  <a href="https://github.com/seerrplay-project/seerrplay-server/actions/workflows/upstream-sync.yml"><img src="https://github.com/seerrplay-project/seerrplay-server/actions/workflows/upstream-sync.yml/badge.svg?branch=develop" alt="Seerr upstream synchronization" /></a>
  <a href="https://github.com/seerrplay-project/seerrplay-server/actions/workflows/codeql.yml"><img src="https://github.com/seerrplay-project/seerrplay-server/actions/workflows/codeql.yml/badge.svg?branch=develop" alt="CodeQL" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/seerrplay-project/seerrplay-server" alt="MIT license" /></a>
</p>

> [!IMPORTANT]
> **SeerrPlay Server is an independent community fork of
> [Seerr](https://github.com/seerr-team/seerr). It is not affiliated with or
> endorsed by the Seerr team.**

## What is SeerrPlay Server?

SeerrPlay Server is the self-hosted server component planned for the SeerrPlay
ecosystem. It starts from Seerr's mature request-management foundation and will
add APIs and playback orchestration designed for the
[SeerrPlay applications](https://github.com/seerrplay-project/seerrplay).

The project remains compatible with Jellyfin, Plex, Emby, Sonarr, and Radarr.
Media stays on infrastructure selected and controlled by the user; SeerrPlay
does not provide or host media content.

## Project status

The fork currently tracks Seerr's `develop` branch while the SeerrPlay-specific
architecture is being introduced. Until the first SeerrPlay Server release,
production users should continue using an official stable Seerr release.

Planned SeerrPlay additions include:

- A typed application API with GraphQL queries, mutations, and subscriptions
- A common playback-session model for Jellyfin, Plex, and Emby
- Real-time request, availability, and download progress
- APIs optimized for mobile, television, and desktop clients
- A redesigned web experience with integrated playback

## Repository family

| Repository | Purpose |
| --- | --- |
| [`seerrplay`](https://github.com/seerrplay-project/seerrplay) | Flutter and native applications for mobile, TV, and desktop |
| [`seerrplay-server`](https://github.com/seerrplay-project/seerrplay-server) | Self-hosted server and Seerr community fork |
| [`seerrplay-website`](https://github.com/seerrplay-project/seerrplay-website) | Public website for the project |

Visit [seerrplay.dev](https://seerrplay.dev) or join the
[SeerrPlay Discord](https://discord.gg/GMunyuG3wg).

## Upstream maintenance

The `upstream-develop` branch is an exact mirror of
`seerr-team/seerr:develop`. A weekly GitHub Actions workflow prepares a tested
merge and opens a pull request into `develop`. It never merges upstream changes
automatically.

See [`docs/UPSTREAM_SYNC.md`](./docs/UPSTREAM_SYNC.md) for branch conventions,
manual conflict resolution, and the process for contributing suitable changes
back to Seerr.

The repository also inherits Seerr's pull-request validation, labelling,
stale-issue management, CodeQL, Renovate configuration, and optional duplicate
issue detection. See [`docs/AUTOMATION.md`](./docs/AUTOMATION.md) for the enabled
bots and their required settings.

## Development

The upstream toolchain currently requires Node.js 22 and pnpm 10.

```bash
git clone https://github.com/seerrplay-project/seerrplay-server.git
cd seerrplay-server
pnpm install
pnpm dev
```

Before opening a pull request, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Pull requests target `develop`, use Conventional Commit titles, complete the PR
template, and keep SeerrPlay-specific changes isolated from upstream code where
practical. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Existing Seerr capabilities

The inherited Seerr foundation includes:

- Jellyfin, Plex, and Emby authentication and library synchronization
- Movie, series, season, and mixed-library requests
- Sonarr and Radarr integration
- SQLite and PostgreSQL support
- Granular permissions and notification agents
- Watchlists, blocklists, localization, and scheduled jobs
- REST API documentation at `/api-docs` on a running server

For documentation about existing Seerr behavior, visit
[docs.seerr.dev](https://docs.seerr.dev).

## Security and privacy

Do not include access tokens, media-server URLs, API keys, or personal library
data in issues. Report security problems privately according to
[`SECURITY.md`](./SECURITY.md).

SeerrPlay clients only access servers configured by the user. The project does
not include torrent, Usenet, indexer, DRM-circumvention, or third-party media
downloading functionality.

## Attribution and license

SeerrPlay Server is based on Seerr and retains Seerr's MIT license and copyright
notice. We are grateful to the Seerr, Overseerr, and Jellyseerr contributors
whose work provides the project's foundation.

SeerrPlay is not affiliated with Jellyfin, Plex, Emby, Sonarr, Radarr, or TMDB.
Their names and trademarks belong to their respective owners.

Licensed under the [MIT License](./LICENSE).
