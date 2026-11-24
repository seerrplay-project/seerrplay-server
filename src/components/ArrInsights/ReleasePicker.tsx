import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import { formatBytes } from '@app/utils/numberHelpers';
import type { ArrRelease } from '@server/interfaces/api/arrInterfaces';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.ArrInsights.ReleasePicker', {
  title: 'Choose a release',
  seasonTitle: 'Choose a release for season {season}',
  searching: 'Searching every indexer, this can take a minute…',
  searchError: 'The search failed: {error}',
  empty: 'No indexer returned a release.',
  showRejected: 'Show rejected releases ({count})',
  hideRejected: 'Hide rejected releases',
  grab: 'Download',
  grabAnyway: 'Download anyway',
  grabbed: 'Sent to the download client.',
  grabError: 'Unable to download it: {error}',
  seeders: '{seeders} seeds / {leechers} peers',
  age: '{days} d',
  close: 'Close',
});

interface ReleasePickerProps {
  mediaId: number;
  is4k: boolean;
  seasonNumber?: number;
  onClose: () => void;
  onGrabbed: () => void;
}

const ReleasePicker = ({
  mediaId,
  is4k,
  seasonNumber,
  onClose,
  onGrabbed,
}: ReleasePickerProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [showRejected, setShowRejected] = useState(false);
  const [grabbing, setGrabbing] = useState<string>();
  const query = new URLSearchParams({ is4k: String(is4k) });
  if (seasonNumber !== undefined) {
    query.set('seasonNumber', String(seasonNumber));
  }
  // an interactive search is slow and hits every indexer: never refetch it
  const { data, error } = useSWR<{ releases: ArrRelease[] }>(
    `/api/v1/media/${mediaId}/arr/releases?${query}`,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
    }
  );

  const grab = async (release: ArrRelease) => {
    setGrabbing(release.guid);
    try {
      await axios.post(`/api/v1/media/${mediaId}/arr/releases`, {
        is4k,
        guid: release.guid,
        indexerId: release.indexerId,
      });
      addToast(intl.formatMessage(messages.grabbed), {
        appearance: 'success',
        autoDismiss: true,
      });
      onGrabbed();
    } catch (e) {
      addToast(
        intl.formatMessage(messages.grabError, {
          error:
            (axios.isAxiosError(e) && e.response?.data?.message) ||
            (e as Error).message,
        }),
        { appearance: 'error', autoDismiss: true }
      );
    } finally {
      setGrabbing(undefined);
    }
  };

  const releases = data?.releases ?? [];
  const rejected = releases.filter((release) => !release.approved);
  // with no approved release, the rejected ones are the only options left
  const shown =
    showRejected || rejected.length === releases.length
      ? releases
      : releases.filter((release) => release.approved);

  return (
    <Modal
      title={
        seasonNumber !== undefined
          ? intl.formatMessage(messages.seasonTitle, { season: seasonNumber })
          : intl.formatMessage(messages.title)
      }
      onCancel={onClose}
      cancelText={intl.formatMessage(messages.close)}
      dialogClass="sm:max-w-4xl"
    >
      {!data && !error && (
        <div className="flex flex-col items-center gap-2 py-6 text-sm text-gray-300">
          <LoadingSpinner />
          {intl.formatMessage(messages.searching)}
        </div>
      )}
      {error && (
        <p className="text-sm text-red-400">
          {intl.formatMessage(messages.searchError, {
            error: error.response?.data?.message ?? error.message,
          })}
        </p>
      )}
      {data && !releases.length && (
        <p className="text-sm text-gray-300">
          {intl.formatMessage(messages.empty)}
        </p>
      )}
      <ul className="max-h-[60vh] space-y-2 overflow-y-auto text-sm">
        {shown.map((release) => (
          <li
            key={`${release.indexerId}-${release.guid}`}
            className="space-y-1 rounded-md border border-gray-700 p-3"
          >
            <div className="break-all font-semibold text-white">
              {release.infoUrl ? (
                <a
                  href={release.infoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {release.title}
                </a>
              ) : (
                release.title
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {release.quality && <Badge>{release.quality}</Badge>}
              {release.languages.map((language) => (
                <Badge key={language} badgeType="dark">
                  {language}
                </Badge>
              ))}
              <Badge badgeType="dark">CF {release.customFormatScore}</Badge>
              <Badge badgeType="light">{release.indexer}</Badge>
              <Badge badgeType="light">{formatBytes(release.size)}</Badge>
              {release.protocol === 'torrent' && (
                <Badge badgeType={release.seeders ? 'success' : 'danger'}>
                  {intl.formatMessage(messages.seeders, {
                    seeders: release.seeders ?? 0,
                    leechers: release.leechers ?? 0,
                  })}
                </Badge>
              )}
              <Badge badgeType="light">
                {intl.formatMessage(messages.age, {
                  days: Math.round(release.ageHours / 24),
                })}
              </Badge>
            </div>
            {release.rejections.length > 0 && (
              <ul className="ml-4 list-disc text-xs text-yellow-300">
                {release.rejections.map((rejection) => (
                  <li key={rejection}>{rejection}</li>
                ))}
              </ul>
            )}
            <Button
              buttonSize="sm"
              buttonType={release.approved ? 'primary' : 'warning'}
              disabled={!!grabbing}
              onClick={() => grab(release)}
            >
              {intl.formatMessage(
                release.approved ? messages.grab : messages.grabAnyway
              )}
            </Button>
          </li>
        ))}
      </ul>
      {rejected.length > 0 && rejected.length < releases.length && (
        <div className="mt-3">
          <Button
            buttonSize="sm"
            onClick={() => setShowRejected((value) => !value)}
          >
            {showRejected
              ? intl.formatMessage(messages.hideRejected)
              : intl.formatMessage(messages.showRejected, {
                  count: rejected.length,
                })}
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default ReleasePicker;
