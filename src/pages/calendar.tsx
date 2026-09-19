import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import {
  getCalendarDateRange,
  getCalendarQueryStart,
} from '@app/utils/calendarDateRange';
import defineMessages from '@app/utils/defineMessages';
import {
  CalendarDaysIcon,
  FilmIcon,
  SparklesIcon,
  TvIcon,
} from '@heroicons/react/24/outline';
import type { CalendarResponse } from '@server/interfaces/api/calendarInterfaces';
import type { NextPage } from 'next';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Calendar', {
  title: 'My releases',
  today: 'Today',
  yesterday: 'Yesterday',
  tomorrow: 'Tomorrow',
  nextWeekday: 'Next {weekday}',
  lastWeekday: 'Last {weekday}',
  all: 'All',
  movies: 'Movies',
  series: 'Series',
  anime: 'Anime',
  error: 'Unable to load the calendar.',
  degraded: 'Some calendar sources are temporarily unavailable.',
  loading: 'Loading calendar…',
  empty: 'No releases for this period.',
  noReleases: 'No releases',
  cinema: 'Cinema',
  digital: 'Digital',
  physical: 'Physical',
});

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseCalendarDate = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12);
};

const calendarDayOffset = (day: string, reference: string) => {
  const [year, month, date] = day.split('-').map(Number);
  const [referenceYear, referenceMonth, referenceDate] = reference
    .split('-')
    .map(Number);

  return (
    (Date.UTC(year, month - 1, date) -
      Date.UTC(referenceYear, referenceMonth - 1, referenceDate)) /
    86400000
  );
};

const getPosterType = (posterUrl?: string) => {
  if (!posterUrl) return 'tmdb';

  try {
    return new URL(posterUrl).hostname === 'artworks.thetvdb.com'
      ? 'tvdb'
      : 'tmdb';
  } catch {
    return 'tmdb';
  }
};

const Calendar: NextPage = () => {
  const intl = useIntl();
  const today = localDate(new Date());
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const startWeek = getCalendarQueryStart(parseCalendarDate(today));
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv' | 'anime'>('all');
  const todaySectionRef = useRef<HTMLElement>(null);
  const didInitialScroll = useRef(false);
  const { data, error } = useSWR<CalendarResponse>(
    `/api/v1/calendar?week=${startWeek}&weeks=3&timezone=${encodeURIComponent(timezone)}`,
    { refreshInterval: (data) => (data?.refreshIntervalMinutes ?? 15) * 60000 }
  );
  const days = useMemo(
    () => getCalendarDateRange(parseCalendarDate(today)),
    [today]
  );

  useEffect(() => {
    if (!data || didInitialScroll.current) return;

    const frame = window.requestAnimationFrame(() => {
      if (todaySectionRef.current) {
        todaySectionRef.current.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
        didInitialScroll.current = true;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [data]);

  const scrollToToday = () =>
    todaySectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
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
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(parseCalendarDate(day));
  };
  const formatDayHeading = (day: string) => {
    const offset = calendarDayOffset(day, today);
    const exactDate = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'long',
      ...(day.slice(0, 4) !== today.slice(0, 4) && {
        year: 'numeric',
      }),
    }).format(parseCalendarDate(day));

    if (offset === -1) {
      return {
        label: intl.formatMessage(messages.yesterday),
        detail: exactDate,
      };
    }
    if (offset >= -7 && offset <= -2) {
      const weekday = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
      }).format(parseCalendarDate(day));

      return {
        label: intl.formatMessage(messages.lastWeekday, { weekday }),
        detail: exactDate,
      };
    }
    if (offset === 0) {
      return {
        label: intl.formatMessage(messages.today),
        detail: exactDate,
      };
    }
    if (offset === 1) {
      return {
        label: intl.formatMessage(messages.tomorrow),
        detail: exactDate,
      };
    }
    if (offset >= 2 && offset <= 7) {
      const weekday = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
      }).format(parseCalendarDate(day));

      return {
        label: intl.formatMessage(messages.nextWeekday, { weekday }),
        detail: exactDate,
      };
    }

    return { label: formatDay(day) };
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
          <p className="mt-1 text-sm text-gray-400 first-letter:uppercase">
            {formatDay(days[0])} — {formatDay(days[14])}
          </p>
        </div>
        <div className="flex items-center gap-2" role="group">
          <Button buttonSize="sm" className="h-10 px-3" onClick={scrollToToday}>
            <CalendarDaysIcon className="mr-1.5 h-4 w-4" />
            {intl.formatMessage(messages.today)}
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
        <div className="space-y-8">
          {days.map((day) => {
            const dayItems = itemsByDay.get(day) ?? [];
            const isToday = day === today;
            const dayHeading = formatDayHeading(day);

            return (
              <section
                key={day}
                ref={isToday ? todaySectionRef : undefined}
                style={
                  isToday
                    ? {
                        scrollMarginTop:
                          'calc(5rem + env(safe-area-inset-top))',
                      }
                    : undefined
                }
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="min-w-0">
                    <time
                      dateTime={day}
                      className={`block text-xl font-bold leading-7 first-letter:uppercase sm:text-2xl sm:leading-9 ${
                        isToday ? 'text-white' : 'text-gray-300'
                      }`}
                    >
                      {dayHeading.label}
                    </time>
                    {dayHeading.detail && (
                      <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">
                        {dayHeading.detail}
                      </p>
                    )}
                  </div>
                  <span className="ml-auto text-xs font-medium tabular-nums text-gray-500">
                    {dayItems.length}
                  </span>
                </div>
                {dayItems.length > 0 ? (
                  <div className="hide-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:gap-4">
                    {dayItems.map((item) => {
                      const isMovie = item.type === 'movie';
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
                              type={getPosterType(item.posterUrl)}
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
                  <div className="py-2 text-sm text-gray-500">
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
