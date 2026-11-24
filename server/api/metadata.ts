import type { TvShowProvider } from '@server/api/provider';
import TheMovieDb from '@server/api/themoviedb';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type { TmdbTvDetails } from '@server/api/themoviedb/interfaces';
import Tvdb from '@server/api/tvdb';
import { getSettings, MetadataProviderType } from '@server/lib/settings';
import logger from '@server/logger';

export const getMetadataProvider = async (
  mediaType: 'movie' | 'tv' | 'anime'
): Promise<TvShowProvider> => {
  try {
    const settings = await getSettings();

    if (mediaType == 'movie') {
      return new TheMovieDb();
    }

    if (
      mediaType == 'tv' &&
      settings.metadataSettings.tv == MetadataProviderType.TVDB
    ) {
      return await Tvdb.getInstance();
    }

    if (
      mediaType == 'anime' &&
      settings.metadataSettings.anime == MetadataProviderType.TVDB
    ) {
      return await Tvdb.getInstance();
    }

    return new TheMovieDb();
  } catch (e) {
    logger.error('Failed to get metadata provider', {
      label: 'Metadata',
      message: e.message,
    });
    return new TheMovieDb();
  }
};

// Anime is detected from the TMDB keyword, then follows the anime provider
// setting (TVDB splits cours into the seasons Sonarr uses, TMDB often merges them).
export const getTvMetadataProvider = (
  tmdbShow: Pick<TmdbTvDetails, 'keywords'>
): Promise<TvShowProvider> =>
  getMetadataProvider(
    tmdbShow.keywords?.results?.some(
      (keyword) => keyword.id === ANIME_KEYWORD_ID
    )
      ? 'anime'
      : 'tv'
  );
