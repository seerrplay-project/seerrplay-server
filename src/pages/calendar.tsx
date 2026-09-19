import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
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

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">
          {intl.formatMessage(messages.title)}
        </h1>
        <Button buttonSize="sm" onClick={() => move(shiftWeek(week, -1))}>
          {intl.formatMessage(messages.previous)}
        </Button>
        <Button buttonSize="sm" onClick={() => move(monday())}>
          {intl.formatMessage(messages.today)}
        </Button>
        <Button buttonSize="sm" onClick={() => move(shiftWeek(week, 1))}>
          {intl.formatMessage(messages.next)}
        </Button>
      </div>
      <div className="mb-5 flex gap-2">
        {(['all', 'movie', 'tv', 'anime'] as const).map((kind) => (
          <Button
            key={kind}
            buttonSize="sm"
            buttonType={filter === kind ? 'primary' : 'default'}
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((day) => (
          <section key={day} className="rounded bg-gray-800 p-3">
            <h2 className="mb-3 font-semibold">{day}</h2>
            {data?.items
              .filter(
                (item) =>
                  item.date === day &&
                  (filter === 'all' || item.type === filter)
              )
              .map((item) => (
                <Link
                  key={item.id}
                  href={`/${item.type === 'movie' ? 'movie' : 'tv'}/${item.tmdbId}`}
                  className="mb-2 block rounded bg-gray-700 p-2 text-sm hover:bg-gray-600"
                >
                  <strong>{item.title}</strong>
                  {item.seasonNumber !== undefined && (
                    <div>
                      S{item.seasonNumber} E{item.episodeNumber} ·{' '}
                      {item.episodeTitle}
                      {item.airDateUtc &&
                        ` · ${new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(item.airDateUtc))}`}
                    </div>
                  )}
                  {item.releaseTypes && (
                    <div>
                      {item.releaseTypes
                        .map((type) => intl.formatMessage(messages[type]))
                        .join(', ')}
                    </div>
                  )}
                </Link>
              ))}
          </section>
        ))}
      </div>
      {data && data.items.length === 0 && (
        <p className="mt-6 text-gray-400">
          {intl.formatMessage(messages.empty)}
        </p>
      )}
    </div>
  );
};

export default Calendar;
