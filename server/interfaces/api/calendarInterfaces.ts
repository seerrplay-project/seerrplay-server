export type CalendarItemType = 'movie' | 'tv' | 'anime';

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  tmdbId: number;
  title: string;
  posterUrl?: string;
  date: string;
  airDateUtc?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  releaseTypes?: ('cinema' | 'digital' | 'physical')[];
  has4k: boolean;
}

export interface CalendarResponse {
  week: string;
  weeks: number;
  timezone: string;
  items: CalendarItem[];
  degraded: boolean;
  sources: { sonarr: number; radarr: number };
  warnings: string[];
  refreshIntervalMinutes: number;
}
