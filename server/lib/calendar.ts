import RadarrAPI, { type RadarrCalendarItem } from '@server/api/servarr/radarr';
import SonarrAPI, { type SonarrCalendarItem } from '@server/api/servarr/sonarr';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import type {
  CalendarItem,
  CalendarResponse,
} from '@server/interfaces/api/calendarInterfaces';
import cacheManager from '@server/lib/cache';
import { getSettings } from '@server/lib/settings';

const zonedDate = (value: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const valueFor = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${valueFor('year')}-${valueFor('month')}-${valueFor('day')}`;
};

export const CALENDAR_PAST_DAYS = 366;
export const CALENDAR_FUTURE_DAYS = 365 * 3;
const DEGRADED_CACHE_TTL_SECONDS = 60;
const inflight = new Map<string, Promise<CalendarResponse>>();

const setCalendarCache = (
  cacheKey: string,
  response: CalendarResponse,
  ttlSeconds: number
) => {
  const cache = cacheManager.getCache('calendar').data;
  cache.set(cacheKey, response, ttlSeconds);
};

export const isCalendarWeekAllowed = (week: string, now = new Date()) => {
  const date = new Date(`${week}T00:00:00.000Z`);
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const delta = (date.getTime() - today.getTime()) / 86400000;
  return delta >= -CALENDAR_PAST_DAYS && delta <= CALENDAR_FUTURE_DAYS;
};

export const getCalendar = async ({
  week,
  timezone,
}: {
  week: string;
  timezone: string;
}): Promise<CalendarResponse> => {
  const cache = cacheManager.getCache('calendar').data;
  const cacheKey = `${week}:${timezone}`;
  const cached = cache.get<CalendarResponse>(cacheKey);
  if (cached) return cached;
  const pending = inflight.get(cacheKey);
  if (pending) return pending;
  const request = buildCalendar({ week, timezone });
  inflight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inflight.delete(cacheKey);
  }
};

const buildCalendar = async ({
  week,
  timezone,
}: {
  week: string;
  timezone: string;
}): Promise<CalendarResponse> => {
  const settings = getSettings();
  const cacheKey = `${week}:${timezone}`;
  const monday = new Date(`${week}T00:00:00.000Z`);
  const end = new Date(monday);
  end.setUTCDate(end.getUTCDate() + 7);
  // Extra UTC day on both sides ensures all local dates are represented for IANA zones.
  const startMargin = new Date(monday);
  startMargin.setUTCDate(startMargin.getUTCDate() - 1);
  const endMargin = new Date(end);
  endMargin.setUTCDate(endMargin.getUTCDate() + 1);
  const start = startMargin.toISOString().slice(0, 10);
  const finish = endMargin.toISOString().slice(0, 10);
  const media = await getRepository(Media).find();
  const movies = new Map(
    media
      .filter((item) => item.mediaType === MediaType.MOVIE)
      .map((item) => [item.tmdbId, item])
  );
  const showsByTvdb = new Map(
    media
      .filter((item) => item.mediaType === MediaType.TV && item.tvdbId)
      .map((item) => [item.tvdbId!, item])
  );
  const showsByService = new Map<string, Media>();
  for (const item of media.filter((item) => item.mediaType === MediaType.TV)) {
    if (item.serviceId != null && item.externalServiceId != null)
      showsByService.set(`${item.serviceId}:${item.externalServiceId}`, item);
    if (item.serviceId4k != null && item.externalServiceId4k != null)
      showsByService.set(
        `${item.serviceId4k}:${item.externalServiceId4k}`,
        item
      );
  }
  const warnings: string[] = [];
  const sonarr = settings.sonarr.map((service) => ({
    id: service.id,
    is4k: service.is4k,
    client: new SonarrAPI({
      apiKey: service.apiKey,
      url: SonarrAPI.buildUrl(service, '/api/v3'),
    }),
  }));
  const radarr = settings.radarr.map((service) => ({
    is4k: service.is4k,
    client: new RadarrAPI({
      apiKey: service.apiKey,
      url: RadarrAPI.buildUrl(service, '/api/v3'),
    }),
  }));
  const [sonarrResults, radarrResults] = await Promise.all([
    Promise.allSettled(
      sonarr.map(({ client }) => client.getCalendar({ start, end: finish }))
    ),
    Promise.allSettled(
      radarr.map(({ client }) => client.getCalendar({ start, end: finish }))
    ),
  ]);
  const items = new Map<string, CalendarItem>();
  const addEpisode = (
    episode: SonarrCalendarItem,
    serviceId: number,
    is4k: boolean
  ) => {
    const mediaItem =
      showsByService.get(`${serviceId}:${episode.seriesId}`) ??
      showsByTvdb.get(episode.series.tvdbId);
    if (!mediaItem || !episode.airDateUtc) return;
    const date = zonedDate(episode.airDateUtc, timezone);
    if (date < week || date >= new Date(end).toISOString().slice(0, 10)) return;
    const type = episode.series.seriesType === 'anime' ? 'anime' : 'tv';
    const key = `${type}:${mediaItem.tmdbId}:${episode.seasonNumber}:${episode.episodeNumber}:${date}`;
    items.set(key, {
      id: key,
      type,
      tmdbId: mediaItem.tmdbId,
      title: episode.series.title,
      date,
      airDateUtc: episode.airDateUtc,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.title,
      has4k: Boolean(items.get(key)?.has4k || is4k),
    });
  };
  const addMovie = (movie: RadarrCalendarItem, is4k: boolean) => {
    const mediaItem = movies.get(movie.tmdbId);
    if (!mediaItem) return;
    const releases: [string, 'cinema' | 'digital' | 'physical'][] = [
      [movie.inCinemas ?? '', 'cinema'],
      [movie.digitalRelease ?? '', 'digital'],
      [movie.physicalRelease ?? '', 'physical'],
    ];
    for (const [release, kind] of releases) {
      if (!release) continue;
      // Radarr release dates are all-day values, not instants. Keeping their
      // calendar date avoids shifting a release across a timezone boundary.
      const date = release.slice(0, 10);
      if (date < week || date >= new Date(end).toISOString().slice(0, 10))
        continue;
      const key = `movie:${movie.tmdbId}:${date}`;
      const prior = items.get(key);
      items.set(key, {
        id: key,
        type: 'movie',
        tmdbId: movie.tmdbId,
        title: movie.title,
        date,
        releaseTypes: [...new Set([...(prior?.releaseTypes ?? []), kind])],
        has4k: Boolean(prior?.has4k || is4k),
      });
    }
  };
  sonarrResults.forEach((result, index) =>
    result.status === 'fulfilled'
      ? result.value.forEach((episode) =>
          addEpisode(episode, sonarr[index].id, sonarr[index].is4k)
        )
      : warnings.push('A TV calendar source is temporarily unavailable.')
  );
  radarrResults.forEach((result, index) =>
    result.status === 'fulfilled'
      ? result.value.forEach((movie) => addMovie(movie, radarr[index].is4k))
      : warnings.push('A movie calendar source is temporarily unavailable.')
  );
  const response: CalendarResponse = {
    week,
    timezone,
    items: [...items.values()].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id)
    ),
    degraded: warnings.length > 0,
    sources: {
      sonarr: sonarrResults.filter((r) => r.status === 'fulfilled').length,
      radarr: radarrResults.filter((r) => r.status === 'fulfilled').length,
    },
    warnings: [...new Set(warnings)],
    refreshIntervalMinutes: settings.main.calendarRefreshIntervalMinutes ?? 15,
  };
  setCalendarCache(
    cacheKey,
    response,
    response.degraded
      ? DEGRADED_CACHE_TTL_SECONDS
      : Math.max(
          1,
          Math.min(1440, settings.main.calendarCacheTtlMinutes ?? 10)
        ) * 60
  );
  return response;
};

export const flushCalendarCache = () =>
  cacheManager.getCache('calendar').flush();
