import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import defineMessages from '@app/utils/defineMessages';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilmIcon,
  SparklesIcon,
  TvIcon,
} from '@heroicons/react/24/outline';
import type { CalendarResponse } from '@server/interfaces/api/calendarInterfaces';
import type { NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Calendar', {
  title: 'My releases',
  previous: 'Previous',
  today: 'Today',
  next: 'Next',
  all: 'All',
  movies: 'Movies',
  series: 'Series',
  anime: 'Anime',
  error: 'Unable to load the calendar.',
  degraded: 'Some calendar sources are temporarily unavailable.',
  loading: 'Loading calendar…',
  empty: 'No upcoming releases for this week.',
  noReleases: 'No releases',
  cinema: 'Cinema',
  digital: 'Digital',
  physical: 'Physical',
});

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const monday = (date = new Date()) => {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return localDate(result);
};

const shiftWeek = (week: string, offset: number) => {
  const [year, month, day] = week.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offset * 7);
  return localDate(date);
};

const Calendar: NextPage = () => {
  const router = useRouter();
  const intl = useIntl();
  const week =
    typeof router.query.week === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(router.query.week)
      ? router.query.week
      : monday();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv' | 'anime'>('all');
  const { data, error } = useSWR<CalendarResponse>(
    `/api/v1/calendar?week=${week}&timezone=${encodeURIComponent(timezone)}`,
    { refreshInterval: (data) => (data?.refreshIntervalMinutes ?? 15) * 60000 }
  );
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const [year, month, day] = week.split('-').map(Number);
      const date = new Date(year, month - 1, day + index);
      return localDate(date);
    });
  }, [week]);
  const move = (target: string) =>
    router.push({ pathname: '/calendar', query: { week: target } });
  const today = localDate(new Date());
  const filteredItems = useMemo(
    () =>
      data?.items.filter((item) => filter === 'all' || item.type === filter) ??
      [],
    [data?.items, filter]
  );
  const itemsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarResponse['items']>();
    days.forEach((day) => grouped.set(day, []));
    filteredItems.forEach((item) => grouped.get(item.date)?.push(item));
    return grouped;
  }, [days, filteredItems]);
  const formatDay = (day: string) => {
    const [year, month, date] = day.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(year, month - 1, date, 12));
  };
  const typeLabel = (type: 'movie' | 'tv' | 'anime') =>
    intl.formatMessage(
      messages[type === 'movie' ? 'movies' : type === 'tv' ? 'series' : 'anime']
    );

  return (
    <div className="px-4 py-6 text-gray-100 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {intl.formatMessage(messages.title)}
          </h1>
          <p className="mt-1 text-sm capitalize text-gray-400">
            {formatDay(days[0])} — {formatDay(days[6])}
          </p>
        </div>
        <div className="flex items-center gap-2" role="group">
          <Button
            buttonSize="sm"
            className="h-10 px-3"
            aria-label={intl.formatMessage(messages.previous)}
            onClick={() => move(shiftWeek(week, -1))}
          >
            <ChevronLeftIcon className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">
              {intl.formatMessage(messages.previous)}
            </span>
          </Button>
          <Button
            buttonSize="sm"
            className="h-10 px-3"
            onClick={() => move(monday())}
          >
            <CalendarDaysIcon className="mr-1.5 h-4 w-4" />
            {intl.formatMessage(messages.today)}
          </Button>
          <Button
            buttonSize="sm"
            className="h-10 px-3"
            aria-label={intl.formatMessage(messages.next)}
            onClick={() => move(shiftWeek(week, 1))}
          >
            <span className="hidden sm:inline">
              {intl.formatMessage(messages.next)}
            </span>
            <ChevronRightIcon className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="group">
        {(['all', 'movie', 'tv', 'anime'] as const).map((kind) => (
          <Button
            key={kind}
            buttonSize="md"
            buttonType={filter === kind ? 'primary' : 'default'}
            aria-pressed={filter === kind}
            className="min-h-10 rounded-full px-4"
            onClick={() => setFilter(kind)}
          >
            {intl.formatMessage(
              messages[
                kind === 'all'
                  ? 'all'
                  : kind === 'movie'
                    ? 'movies'
                    : kind === 'tv'
                      ? 'series'
                      : 'anime'
              ]
            )}
          </Button>
        ))}
      </div>
      {error && (
        <p className="text-red-400">{intl.formatMessage(messages.error)}</p>
      )}
      {data?.degraded && (
        <p className="mb-4 text-yellow-300">
          {intl.formatMessage(messages.degraded)}
        </p>
      )}
      {!data && !error && <p>{intl.formatMessage(messages.loading)}</p>}
      {data && (
        <div className="space-y-4">
          {days.map((day) => {
            const dayItems = itemsByDay.get(day) ?? [];
            const isToday = day === today;

            return (
              <section
                key={day}
                className={`overflow-hidden rounded-2xl border bg-gray-900/40 shadow-sm ${
                  isToday ? 'border-indigo-500/60' : 'border-gray-700/70'
                }`}
              >
                <div className="flex items-center gap-3 border-b border-gray-700/60 px-4 py-3 sm:px-5">
                  <time
                    dateTime={day}
                    className="text-base font-semibold capitalize text-white sm:text-lg"
                  >
                    {formatDay(day)}
                  </time>
                  {isToday && (
                    <span className="rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-200 ring-1 ring-inset ring-indigo-400/30">
                      {intl.formatMessage(messages.today)}
                    </span>
                  )}
                  <span className="ml-auto min-w-7 rounded-full bg-gray-800 px-2 py-1 text-center text-xs font-medium tabular-nums text-gray-300">
                    {dayItems.length}
                  </span>
                </div>
                {dayItems.length > 0 ? (
                  <div className="flex snap-x gap-3 overflow-x-auto px-4 py-4 sm:gap-4 sm:px-5">
                    {dayItems.map((item) => {
                      const isMovie = item.type === 'movie';
                      const posterType = item.posterUrl?.includes(
                        'artworks.thetvdb.com'
                      )
                        ? 'tvdb'
                        : 'tmdb';
                      const TypeIcon = isMovie
                        ? FilmIcon
                        : item.type === 'anime'
                          ? SparklesIcon
                          : TvIcon;

                      return (
                        <Link
                          key={item.id}
                          href={`/${item.type === 'movie' ? 'movie' : 'tv'}/${item.tmdbId}`}
                          className="group flex min-h-36 w-[290px] flex-none snap-start overflow-hidden rounded-xl border border-gray-700/80 bg-gray-800/80 shadow-md outline-none transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:border-gray-500 hover:bg-gray-800 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-indigo-400 sm:w-[340px]"
                        >
                          <div className="relative w-24 flex-none overflow-hidden bg-gray-950 sm:w-28">
                            <CachedImage
                              src={
                                item.posterUrl ||
                                '/images/seerr_poster_not_found.png'
                              }
                              type={posterType}
                              alt=""
                              fill
                              sizes="112px"
                              className="object-cover outline outline-1 -outline-offset-1 outline-white/10 transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                            />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col p-3.5">
                            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                              <TypeIcon className="h-4 w-4 flex-none" />
                              <span>{typeLabel(item.type)}</span>
                              {item.has4k && (
                                <span className="ml-auto rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-semibold text-gray-200 ring-1 ring-inset ring-white/10">
                                  4K
                                </span>
                              )}
                            </div>
                            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white [text-wrap:balance] sm:text-base">
                              {item.title}
                            </h3>
                            {item.seasonNumber !== undefined && (
                              <div className="mt-2 text-sm text-gray-300">
                                <p className="font-medium tabular-nums text-indigo-300">
                                  S{item.seasonNumber} · E{item.episodeNumber}
                                </p>
                                {item.episodeTitle && (
                                  <p className="mt-0.5 line-clamp-2 [text-wrap:pretty]">
                                    {item.episodeTitle}
                                  </p>
                                )}
                              </div>
                            )}
                            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3 text-xs text-gray-300">
                              {item.airDateUtc && (
                                <time
                                  dateTime={item.airDateUtc}
                                  className="rounded-md bg-gray-900/70 px-2 py-1 font-medium tabular-nums"
                                >
                                  {new Intl.DateTimeFormat(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }).format(new Date(item.airDateUtc))}
                                </time>
                              )}
                              {item.releaseTypes?.map((releaseType) => (
                                <span
                                  key={releaseType}
                                  className="rounded-md bg-gray-900/70 px-2 py-1 font-medium"
                                >
                                  {intl.formatMessage(messages[releaseType])}
                                </span>
                              ))}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-24 items-center justify-center px-5 py-6 text-sm text-gray-500">
                    {intl.formatMessage(messages.noReleases)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      {data && filteredItems.length === 0 && (
        <p className="mt-6 text-gray-400">
          {intl.formatMessage(messages.empty)}
        </p>
      )}
    </div>
  );
};

export default Calendar;
