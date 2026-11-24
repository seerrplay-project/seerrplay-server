import type { QbittorrentTorrent } from '@server/api/qbittorrent';
import QbittorrentAPI from '@server/api/qbittorrent';
import type {
  ManualImportCandidate,
  QueueItem,
} from '@server/api/servarr/base';
import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import type {
  ArrDownload,
  ArrInsightsResponse,
  ArrRelease,
} from '@server/interfaces/api/arrInterfaces';
import type { ArrAction } from '@server/lib/arrInsights';
import {
  diagnose,
  getDownloadStep,
  getQueueMessages,
} from '@server/lib/arrInsights';
import downloadTracker from '@server/lib/downloadtracker';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

type ArrQueueItem = QueueItem & {
  movieId?: number;
  seriesId?: number;
  episode?: { seasonNumber: number; episodeNumber: number };
};

interface ArrContext {
  media: Media;
  isMovie: boolean;
  api: SonarrAPI | RadarrAPI;
  serverName: string;
  externalId?: number;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

const QBIT_ACTIONS: ArrAction[] = ['forceStart', 'reannounce'];

// ids end up in *arr URL paths: accept plain integers only
const toId = (value: unknown, name: string): number => {
  const id = Number(value);
  if (!Number.isSafeInteger(id)) {
    throw new HttpError(400, `${name} must be an integer.`);
  }
  return id;
};

const TORRENT_HASH = /^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/;

const getQbittorrent = (): QbittorrentAPI | undefined => {
  const settings = getSettings().qbittorrent;
  return settings.url ? new QbittorrentAPI(settings) : undefined;
};

const getContext = async (
  mediaId: number,
  is4k: boolean
): Promise<ArrContext> => {
  const media = await getRepository(Media).findOne({ where: { id: mediaId } });
  if (!media) {
    throw new HttpError(404, 'Media not found.');
  }
  const settings = getSettings();
  const isMovie = media.mediaType === MediaType.MOVIE;
  const servers = isMovie ? settings.radarr : settings.sonarr;
  const serviceId = is4k ? media.serviceId4k : media.serviceId;
  const server =
    servers.find((s) => s.id === serviceId) ??
    servers.find((s) => s.isDefault && s.is4k === is4k);
  if (!server) {
    throw new HttpError(
      404,
      `No ${is4k ? '4K ' : ''}${isMovie ? 'Radarr' : 'Sonarr'} server.`
    );
  }

  const options = {
    apiKey: server.apiKey,
    url: SonarrAPI.buildUrl(server, '/api/v3'),
  };
  const api = isMovie ? new RadarrAPI(options) : new SonarrAPI(options);
  let externalId =
    (is4k ? media.externalServiceId4k : media.externalServiceId) ?? undefined;

  if (!externalId) {
    try {
      externalId = isMovie
        ? (await (api as RadarrAPI).getMovieByTmdbId(media.tmdbId)).id
        : media.tvdbId
          ? (await (api as SonarrAPI).getSeriesByTvdbId(media.tvdbId)).id
          : undefined;
    } catch {
      externalId = undefined;
    }
  }

  return { media, isMovie, api, serverName: server.name, externalId };
};

const getQueue = async (ctx: ArrContext): Promise<ArrQueueItem[]> => {
  if (!ctx.externalId) return [];
  const queue = (await ctx.api.getQueue()) as ArrQueueItem[];
  return queue.filter(
    (item) => (ctx.isMovie ? item.movieId : item.seriesId) === ctx.externalId
  );
};

const groupDownloads = (
  queue: ArrQueueItem[],
  torrents: Record<string, QbittorrentTorrent>,
  hasQbittorrent: boolean
): ArrDownload[] => {
  // a season pack shows up once per episode with the same downloadId
  const groups = new Map<string, ArrQueueItem[]>();
  for (const item of queue) {
    const key = item.downloadId || `queue-${item.id}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.values()].map((records) => {
    const item = records[0];
    const torrent = item.downloadId
      ? torrents[item.downloadId.toLowerCase()]
      : undefined;
    const diagnosis = diagnose(item, torrent);
    diagnosis.actions = diagnosis.actions.filter(
      (action) => !QBIT_ACTIONS.includes(action) || (hasQbittorrent && torrent)
    );

    return {
      queueId: item.id,
      downloadId: item.downloadId,
      title: item.title,
      step: getDownloadStep(item),
      diagnosis,
      messages: getQueueMessages(item),
      status: item.status,
      trackedDownloadStatus: item.trackedDownloadStatus,
      trackedDownloadState: item.trackedDownloadState,
      size: item.size,
      sizeLeft: item.sizeleft,
      timeLeft: item.timeleft,
      estimatedCompletionTime: item.estimatedCompletionTime,
      added: item.added,
      indexer: item.indexer,
      downloadClient: item.downloadClient,
      protocol: item.protocol,
      quality: item.quality?.quality.name,
      languages: (item.languages ?? []).map((language) => language.name),
      customFormatScore: item.customFormatScore,
      episodes: records
        .filter((record) => record.episode)
        .map((record) => ({
          seasonNumber: record.episode?.seasonNumber ?? 0,
          episodeNumber: record.episode?.episodeNumber ?? 0,
        })),
      torrent: torrent && {
        state: torrent.state,
        progress: torrent.progress,
        dlspeed: torrent.dlspeed,
        eta: torrent.eta,
        seeds: torrent.num_seeds,
        peers: torrent.num_leechs,
        seedsInSwarm: torrent.num_complete,
        peersInSwarm: torrent.num_incomplete,
        availability: torrent.availability,
        lastActivity: torrent.last_activity,
        seenComplete: torrent.seen_complete,
        forceStart: torrent.force_start,
      },
    };
  });
};

const getTorrents = async (
  qbittorrent: QbittorrentAPI | undefined,
  queue: ArrQueueItem[]
): Promise<Record<string, QbittorrentTorrent>> => {
  const hashes = queue
    .filter((item) => item.protocol === 'torrent' && item.downloadId)
    .map((item) => item.downloadId);
  if (!qbittorrent || !hashes.length) return {};
  try {
    return await qbittorrent.getTorrents([...new Set(hashes)]);
  } catch (e) {
    logger.warn('Unable to read torrents from qBittorrent', {
      label: 'Arr Insights',
      errorMessage: e.message,
    });
    return {};
  }
};

const buildManualImport = (
  ctx: ArrContext,
  candidates: ManualImportCandidate[],
  downloadId: string,
  force: boolean
) => {
  const files: Record<string, unknown>[] = [];
  const skipped: { path: string; reasons: string[] }[] = [];

  for (const candidate of candidates) {
    const target = ctx.isMovie ? candidate.movie : candidate.series;
    const reasons = (candidate.rejections ?? []).map((r) => r.reason);
    if (!target) reasons.push('No matching title');
    if (!ctx.isMovie && !candidate.episodes?.length) {
      reasons.push('No matching episode');
    }
    // rejections can be overridden, a missing mapping cannot
    const blocking = !target || (!ctx.isMovie && !candidate.episodes?.length);
    if (blocking || (reasons.length && !force)) {
      skipped.push({ path: candidate.relativePath ?? candidate.path, reasons });
      continue;
    }
    files.push({
      path: candidate.path,
      folderName: candidate.folderName,
      [ctx.isMovie ? 'movieId' : 'seriesId']: target?.id,
      quality: candidate.quality,
      languages: candidate.languages ?? [],
      releaseGroup: candidate.releaseGroup,
      downloadId,
      indexerFlags: candidate.indexerFlags ?? 0,
      ...(ctx.isMovie
        ? {}
        : {
            episodeIds: candidate.episodes?.map((episode) => episode.id),
            releaseType: candidate.releaseType ?? 'unknown',
          }),
    });
  }

  return { files, skipped };
};

const mediaArrRoutes = Router({ mergeParams: true });

const is4kParam = (value: unknown) => String(value) === 'true';

mediaArrRoutes.get<{ id: string }>('/', async (req, res, next) => {
  try {
    const ctx = await getContext(
      Number(req.params.id),
      is4kParam(req.query.is4k)
    );
    const qbittorrent = getQbittorrent();
    const queue = await getQueue(ctx);
    const torrents = await getTorrents(qbittorrent, queue);

    let library: ArrInsightsResponse['library'];
    if (ctx.externalId) {
      if (ctx.isMovie) {
        const movie = await (ctx.api as RadarrAPI).getMovie({
          id: ctx.externalId,
        });
        library = {
          monitored: movie.monitored,
          hasFile: movie.hasFile,
          isAvailable: movie.isAvailable,
        };
      } else {
        const series = await (ctx.api as SonarrAPI).getSeriesById(
          ctx.externalId
        );
        library = {
          monitored: series.monitored,
          seasons: series.seasons
            .filter((season) => season.seasonNumber > 0)
            .map((season) => ({
              seasonNumber: season.seasonNumber,
              monitored: season.monitored,
              episodeFileCount: season.statistics?.episodeFileCount ?? 0,
              episodeCount: season.statistics?.episodeCount ?? 0,
              totalEpisodeCount: season.statistics?.totalEpisodeCount ?? 0,
            })),
        };
      }
    }

    const response: ArrInsightsResponse = {
      service: ctx.isMovie ? 'radarr' : 'sonarr',
      serverName: ctx.serverName,
      externalId: ctx.externalId,
      qbittorrent: !!qbittorrent,
      downloads: groupDownloads(queue, torrents, !!qbittorrent),
      library,
    };
    return res.status(200).json(response);
  } catch (e) {
    return next({
      status: e instanceof HttpError ? e.status : 500,
      message: e.message,
    });
  }
});

mediaArrRoutes.post<
  { id: string },
  unknown,
  {
    is4k?: boolean;
    action: ArrAction | 'search';
    queueId?: number;
    downloadId?: string;
    seasonNumber?: number;
    force?: boolean;
  }
>('/action', async (req, res, next) => {
  const { action, queueId, downloadId, seasonNumber, force } = req.body;
  try {
    const ctx = await getContext(Number(req.params.id), !!req.body.is4k);
    const needQueue = () => {
      return toId(queueId, 'queueId');
    };
    const needTorrent = () => {
      const qbittorrent = getQbittorrent();
      if (!qbittorrent) {
        throw new HttpError(400, 'qBittorrent is not configured.');
      }
      if (!downloadId || !TORRENT_HASH.test(downloadId)) {
        throw new HttpError(400, 'downloadId must be a torrent hash.');
      }
      return qbittorrent;
    };
    let result: Record<string, unknown> = {};

    switch (action) {
      case 'grabNow':
        await ctx.api.grabQueueItem(needQueue());
        break;
      case 'forceStart':
        await needTorrent().forceStart(downloadId as string);
        break;
      case 'reannounce':
        await needTorrent().reannounce(downloadId as string);
        break;
      case 'remove':
        await ctx.api.removeQueueItem(needQueue(), {
          blocklist: true,
          removeFromClient: true,
          skipRedownload: true,
        });
        break;
      case 'blocklistAndSearch':
        await ctx.api.removeQueueItem(needQueue(), {
          blocklist: true,
          removeFromClient: true,
        });
        break;
      case 'import': {
        if (!downloadId || !ctx.externalId) {
          throw new HttpError(400, 'downloadId is required.');
        }
        const candidates = await ctx.api.getManualImport({
          downloadId,
          [ctx.isMovie ? 'movieId' : 'seriesId']: ctx.externalId,
          filterExistingFiles: !force,
        });
        const { files, skipped } = buildManualImport(
          ctx,
          candidates,
          downloadId,
          !!force
        );
        if (!files.length) {
          return res.status(409).json({ imported: 0, skipped });
        }
        await ctx.api.manualImport(files);
        result = { imported: files.length, skipped };
        break;
      }
      case 'search':
        if (!ctx.externalId) {
          throw new HttpError(409, 'The title is not in the library.');
        }
        if (ctx.isMovie) {
          await (ctx.api as RadarrAPI).searchMovie(ctx.externalId);
        } else if (seasonNumber !== undefined) {
          await (ctx.api as SonarrAPI).searchSeason(
            ctx.externalId,
            toId(seasonNumber, 'seasonNumber')
          );
        } else {
          await (ctx.api as SonarrAPI).searchSeries(ctx.externalId);
        }
        break;
      default:
        throw new HttpError(400, 'Unknown action.');
    }

    logger.info('Ran an *arr action from Seerr', {
      action: String(action).replace(/\W/g, ''),
      label: 'Arr Insights',
      mediaId: ctx.media.id,
      queueId,
      userId: req.user?.id,
    });
    // refresh progress bars without waiting for the next tracker run
    downloadTracker.updateDownloads();
    return res.status(200).json(result);
  } catch (e) {
    return next({
      status: e instanceof HttpError ? e.status : 500,
      message: e.message,
    });
  }
});

mediaArrRoutes.get<{ id: string }>('/releases', async (req, res, next) => {
  try {
    const ctx = await getContext(
      Number(req.params.id),
      is4kParam(req.query.is4k)
    );
    if (!ctx.externalId) {
      throw new HttpError(409, 'The title is not in the library.');
    }
    const seasonNumber =
      req.query.seasonNumber !== undefined
        ? toId(req.query.seasonNumber, 'seasonNumber')
        : undefined;
    const params: Record<string, number> = ctx.isMovie
      ? { movieId: ctx.externalId }
      : req.query.episodeId
        ? { episodeId: toId(req.query.episodeId, 'episodeId') }
        : { seriesId: ctx.externalId, seasonNumber: seasonNumber ?? 1 };

    const releases: ArrRelease[] = (await ctx.api.getReleases(params))
      .map((release) => ({
        guid: release.guid,
        indexerId: release.indexerId,
        indexer: release.indexer,
        title: release.title,
        size: release.size,
        ageHours: release.ageHours ?? release.age * 24,
        protocol: release.protocol,
        seeders: release.seeders,
        leechers: release.leechers,
        approved: release.approved,
        rejections: release.rejections ?? [],
        quality: release.quality?.quality.name,
        languages: (release.languages ?? []).map((language) => language.name),
        customFormatScore: release.customFormatScore ?? 0,
        infoUrl: release.infoUrl,
        fullSeason: release.fullSeason,
        episodeNumbers: release.episodeNumbers,
      }))
      .sort(
        (a, b) =>
          Number(b.approved) - Number(a.approved) ||
          b.customFormatScore - a.customFormatScore ||
          (b.seeders ?? 0) - (a.seeders ?? 0)
      );

    return res.status(200).json({ releases });
  } catch (e) {
    return next({
      status: e instanceof HttpError ? e.status : 500,
      message: e.message,
    });
  }
});

mediaArrRoutes.post<
  { id: string },
  unknown,
  { is4k?: boolean; guid: string; indexerId: number }
>('/releases', async (req, res, next) => {
  try {
    const ctx = await getContext(Number(req.params.id), !!req.body.is4k);
    if (!ctx.externalId) {
      throw new HttpError(409, 'The title is not in the library.');
    }
    // the id maps releases the *arr could not parse (e.g. French titles)
    await ctx.api.grabRelease({
      guid: req.body.guid,
      indexerId: toId(req.body.indexerId, 'indexerId'),
      [ctx.isMovie ? 'movieId' : 'seriesId']: ctx.externalId,
    });
    logger.info('Grabbed release manually from Seerr', {
      label: 'Arr Insights',
      mediaId: ctx.media.id,
      userId: req.user?.id,
    });
    downloadTracker.updateDownloads();
    return res.status(200).json({});
  } catch (e) {
    return next({
      status: e instanceof HttpError ? e.status : 500,
      message: e.message,
    });
  }
});

export default mediaArrRoutes;
