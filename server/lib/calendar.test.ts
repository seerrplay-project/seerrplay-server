import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import cacheManager from '@server/lib/cache';
import { flushCalendarCache, getCalendar } from '@server/lib/calendar';
import {
  getSettings,
  type RadarrSettings,
  type SonarrSettings,
} from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';

setupTestDb();
afterEach(() => mock.restoreAll());

const configure = () => {
  flushCalendarCache();
  const settings = getSettings();
  settings.sonarr = [
    {
      id: 1,
      name: 'Sonarr',
      hostname: 'localhost',
      port: 8989,
      apiKey: 'test',
      useSsl: false,
      activeProfileId: 1,
      activeProfileName: '',
      activeDirectory: '',
      tags: [],
      is4k: false,
      isDefault: true,
      syncEnabled: false,
      preventSearch: true,
      tagRequests: false,
      overrideRule: [],
      seriesType: 'standard',
      animeSeriesType: 'anime',
      enableSeasonFolders: true,
      monitorNewItems: 'all',
    },
  ] as SonarrSettings[];
  settings.radarr = [
    {
      id: 1,
      name: 'Radarr',
      hostname: 'localhost',
      port: 7878,
      apiKey: 'test',
      useSsl: false,
      activeProfileId: 1,
      activeProfileName: '',
      activeDirectory: '',
      tags: [],
      is4k: false,
      isDefault: true,
      syncEnabled: false,
      preventSearch: true,
      tagRequests: false,
      overrideRule: [],
      minimumAvailability: 'released',
    },
  ] as RadarrSettings[];
};

describe('calendar aggregation', () => {
  it('keeps Radarr all-day dates stable and omits media unknown to Seerr', async () => {
    configure();
    await getRepository(Media).save({ mediaType: MediaType.MOVIE, tmdbId: 1 });
    mock.method(SonarrAPI.prototype, 'getCalendar', async () => []);
    mock.method(
      RadarrAPI.prototype,
      'getCalendar',
      async () =>
        [
          {
            tmdbId: 1,
            title: 'Known',
            inCinemas: '2026-09-14T00:00:00Z',
            images: [
              {
                coverType: 'poster',
                remoteUrl: 'https://image.tmdb.org/t/p/original/poster.jpg',
              },
            ],
          },
          {
            tmdbId: 2,
            title: 'Unknown',
            digitalRelease: '2026-09-14T00:00:00Z',
          },
        ] as never
    );

    const result = await getCalendar({
      week: '2026-09-14',
      timezone: 'Pacific/Honolulu',
    });

    assert.deepStrictEqual(
      result.items.map((item) => [item.tmdbId, item.date, item.releaseTypes]),
      [[1, '2026-09-14', ['cinema']]]
    );
    assert.equal(
      result.items[0].posterUrl,
      'https://image.tmdb.org/t/p/original/poster.jpg'
    );
  });

  it('classifies anime and tolerates a failed source', async () => {
    configure();
    await getRepository(Media).save({
      mediaType: MediaType.TV,
      tmdbId: 10,
      tvdbId: 20,
    });
    mock.method(
      SonarrAPI.prototype,
      'getCalendar',
      async () =>
        [
          {
            series: {
              title: 'Anime',
              tvdbId: 20,
              seriesType: 'anime',
              remotePoster: 'https://artworks.thetvdb.com/banners/poster.jpg',
            },
            seasonNumber: 1,
            episodeNumber: 1,
            title: 'Pilot',
            airDateUtc: '2026-09-14T00:30:00Z',
          },
        ] as never
    );
    mock.method(RadarrAPI.prototype, 'getCalendar', async () => {
      throw new Error('offline');
    });

    const result = await getCalendar({
      week: '2026-09-14',
      timezone: 'Europe/Paris',
    });

    assert.equal(result.items[0].type, 'anime');
    assert.equal(
      result.items[0].posterUrl,
      'https://artworks.thetvdb.com/banners/poster.jpg'
    );
    assert.equal(result.degraded, true);
    assert.equal(result.warnings.length, 1);
  });

  it('deduplicates standard and 4K instances while retaining 4K availability', async () => {
    configure();
    const settings = getSettings();
    settings.sonarr = [
      ...settings.sonarr,
      { ...settings.sonarr[0], id: 2, is4k: true, name: 'Sonarr 4K' },
    ];
    await getRepository(Media).save({
      mediaType: MediaType.TV,
      tmdbId: 10,
      tvdbId: 20,
    });
    mock.method(
      SonarrAPI.prototype,
      'getCalendar',
      async () =>
        [
          {
            series: { title: 'Series', tvdbId: 20, seriesType: 'standard' },
            seasonNumber: 1,
            episodeNumber: 1,
            title: 'Pilot',
            airDateUtc: '2026-09-14T12:00:00Z',
          },
        ] as never
    );
    mock.method(RadarrAPI.prototype, 'getCalendar', async () => []);

    const result = await getCalendar({
      week: '2026-09-14',
      timezone: 'Europe/Paris',
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].has4k, true);
  });

  it('matches Sonarr by service and external series id without a TVDB id', async () => {
    configure();
    await getRepository(Media).save({
      mediaType: MediaType.TV,
      tmdbId: 10,
      serviceId: 1,
      externalServiceId: 99,
    });
    mock.method(
      SonarrAPI.prototype,
      'getCalendar',
      async () =>
        [
          {
            seriesId: 99,
            series: {
              title: 'Mapped series',
              tvdbId: 0,
              seriesType: 'standard',
            },
            seasonNumber: 1,
            episodeNumber: 1,
            title: 'Pilot',
            airDateUtc: '2026-09-14T12:00:00Z',
          },
        ] as never
    );
    mock.method(RadarrAPI.prototype, 'getCalendar', async () => []);

    const result = await getCalendar({ week: '2026-09-14', timezone: 'UTC' });
    assert.equal(result.items[0].tmdbId, 10);
  });

  it('honors the configured one-minute cache TTL', async () => {
    configure();
    const settings = getSettings();
    settings.main.calendarCacheTtlMinutes = 1;
    mock.method(SonarrAPI.prototype, 'getCalendar', async () => []);
    mock.method(RadarrAPI.prototype, 'getCalendar', async () => []);
    await getCalendar({ week: '2026-09-14', timezone: 'UTC' });
    const expiresAt = cacheManager
      .getCache('calendar')
      .data.getTtl('2026-09-14:UTC');
    assert.ok(expiresAt && expiresAt > Date.now() + 50000);
  });
});
