import ReleasePicker from '@app/components/ArrInsights/ReleasePicker';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { formatBytes } from '@app/utils/numberHelpers';
import type {
  ArrDownload,
  ArrInsightsResponse,
} from '@server/interfaces/api/arrInterfaces';
import type { ArrAction, DiagnosisCode } from '@server/lib/arrInsights';
import axios from 'axios';
import { useState } from 'react';
import type { MessageDescriptor } from 'react-intl';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.ArrInsights', {
  loadError: 'Unable to reach {service}.',
  nothingQueued: 'Nothing is downloading right now.',
  notInLibrary: 'This title is not in {service} yet.',
  unmonitored: 'Not monitored in {service}: nothing will be searched.',
  movieMissing: 'Missing, no release grabbed yet.',
  movieNotReleased: 'Not released yet, {service} waits for its availability.',
  movieDone: 'File downloaded.',
  seasonLine:
    'Season {season}: {files}/{episodes} episodes{unmonitored, select, true { (not monitored)} other {}}',
  search: 'Search',
  searchSeason: 'Search season {season}',
  chooseRelease: 'Choose a release',
  chooseSeasonRelease: 'Choose a release for season {season}',
  searchStarted: 'Search started.',
  actionDone: 'Done.',
  actionFailed: 'Something went wrong: {error}',
  importSkipped: '{count} file(s) skipped: {reasons}',
  forceImport: 'Import anyway',
  seeds: 'Seeds {seeds} ({swarm} in swarm) · Peers {peers}',
  speed: '{speed}/s',
  availability: 'Availability {value}',
  lastActivity: 'last activity {time}',
  auto: 'Arr maintenance fixes this on its own if you leave it.',
  rawMessages: 'Messages from {service}',
  action_grabNow: 'Download now',
  action_forceStart: 'Force start',
  action_reannounce: 'Ask trackers for peers',
  action_import: 'Import the files',
  action_remove: 'Remove from queue',
  action_blocklistAndSearch: 'Blocklist and find another',
  action_interactiveSearch: 'Choose another release',
  diag_waitingDelay:
    'Held by the delay profile so a better release (VF, higher score) can show up. It is grabbed automatically when the delay ends.',
  diag_queuedClient:
    'Waiting in qBittorrent: the active downloads limit is reached.',
  diag_pausedClient: 'Paused in qBittorrent.',
  diag_downloading: 'Downloading normally.',
  diag_noSeeds:
    'No seeder is connected: the torrent is dead or the release is too rare.',
  diag_stalled: '{service} reports a problem with this download.',
  diag_importing: 'Download finished, the file is being imported.',
  diag_blockedById:
    'The French release title did not match, but the grab history ties it to this title. Importing is safe.',
  diag_notUpgrade:
    'The download is not better than the file you already have, it will not be imported.',
  diag_importBlocked:
    '{service} could not import the file automatically. Check the messages below.',
  diag_failed: 'The download failed.',
});

const ACTION_LABELS: Record<ArrAction, MessageDescriptor> = {
  grabNow: messages.action_grabNow,
  forceStart: messages.action_forceStart,
  reannounce: messages.action_reannounce,
  import: messages.action_import,
  remove: messages.action_remove,
  blocklistAndSearch: messages.action_blocklistAndSearch,
  interactiveSearch: messages.action_interactiveSearch,
};

const DIAGNOSIS: Record<DiagnosisCode, MessageDescriptor> = {
  waitingDelay: messages.diag_waitingDelay,
  queuedClient: messages.diag_queuedClient,
  pausedClient: messages.diag_pausedClient,
  downloading: messages.diag_downloading,
  noSeeds: messages.diag_noSeeds,
  stalled: messages.diag_stalled,
  importing: messages.diag_importing,
  blockedById: messages.diag_blockedById,
  notUpgrade: messages.diag_notUpgrade,
  importBlocked: messages.diag_importBlocked,
  failed: messages.diag_failed,
};

const DESTRUCTIVE: ArrAction[] = ['remove', 'blocklistAndSearch'];

interface ArrInsightsProps {
  mediaId: number;
  is4k?: boolean;
  onChange?: () => void;
}

const ArrInsights = ({ mediaId, is4k = false, onChange }: ArrInsightsProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [busy, setBusy] = useState<string>();
  const [picker, setPicker] = useState<{ seasonNumber?: number }>();
  const [skipped, setSkipped] = useState<{
    download: ArrDownload;
    text: string;
  }>();
  const url = `/api/v1/media/${mediaId}/arr?is4k=${is4k}`;
  const { data, error, mutate } = useSWR<ArrInsightsResponse>(url, {
    refreshInterval: 5000,
  });

  if (!data && !error) return null;

  const service = data?.service === 'radarr' ? 'Radarr' : 'Sonarr';
  if (error || !data) {
    return (
      <p className="text-sm text-red-400">
        {intl.formatMessage(messages.loadError, { service })}
      </p>
    );
  }

  const post = async (
    key: string,
    body: Record<string, unknown>,
    successMessage = messages.actionDone
  ) => {
    setBusy(key);
    try {
      await axios.post(`/api/v1/media/${mediaId}/arr/action`, {
        is4k,
        ...body,
      });
      addToast(intl.formatMessage(successMessage), {
        appearance: 'success',
        autoDismiss: true,
      });
      setSkipped(undefined);
      await mutate();
      onChange?.();
      return true;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        return e.response.data as {
          skipped: { path: string; reasons: string[] }[];
        };
      }
      addToast(
        intl.formatMessage(messages.actionFailed, {
          error:
            (axios.isAxiosError(e) && e.response?.data?.message) ||
            (e as Error).message,
        }),
        { appearance: 'error', autoDismiss: true }
      );
      return false;
    } finally {
      setBusy(undefined);
    }
  };

  const runAction = async (download: ArrDownload, action: ArrAction) => {
    if (action === 'interactiveSearch') {
      setPicker({ seasonNumber: download.episodes[0]?.seasonNumber });
      return;
    }
    const result = await post(`${download.queueId}-${action}`, {
      action,
      queueId: download.queueId,
      downloadId: download.downloadId,
    });
    if (action === 'import' && typeof result === 'object') {
      setSkipped({
        download,
        text: intl.formatMessage(messages.importSkipped, {
          count: result.skipped.length,
          reasons: [
            ...new Set(result.skipped.flatMap((file) => file.reasons)),
          ].join(', '),
        }),
      });
    }
  };

  const actionButton = (download: ArrDownload, action: ArrAction) => {
    const key = `${download.queueId}-${action}`;
    const label = intl.formatMessage(ACTION_LABELS[action]);
    return DESTRUCTIVE.includes(action) ? (
      <ConfirmButton
        key={key}
        onClick={() => runAction(download, action)}
        confirmText={intl.formatMessage(globalMessages.areyousure)}
        className="w-auto"
      >
        {label}
      </ConfirmButton>
    ) : (
      <Button
        key={key}
        buttonSize="sm"
        buttonType={
          action === download.diagnosis.actions[0] ? 'primary' : 'default'
        }
        disabled={busy === key}
        onClick={() => runAction(download, action)}
      >
        {label}
      </Button>
    );
  };

  const library = data.library;

  return (
    <div className="space-y-3 text-sm">
      {data.downloads.map((download) => (
        <div
          key={download.downloadId || download.queueId}
          className="space-y-2 rounded-md border border-gray-700 p-3"
        >
          <div className="break-all font-semibold text-white">
            {download.title}
          </div>
          <div className="flex flex-wrap gap-1">
            {download.quality && <Badge>{download.quality}</Badge>}
            {download.languages.map((language) => (
              <Badge key={language} badgeType="dark">
                {language}
              </Badge>
            ))}
            {download.customFormatScore !== undefined && (
              <Badge badgeType="dark">CF {download.customFormatScore}</Badge>
            )}
            {download.indexer && (
              <Badge badgeType="light">{download.indexer}</Badge>
            )}
            <Badge badgeType="light">
              {formatBytes(download.size - download.sizeLeft)} /{' '}
              {formatBytes(download.size)}
            </Badge>
          </div>
          <p
            className={
              download.diagnosis.actions.length
                ? 'text-yellow-300'
                : 'text-gray-300'
            }
          >
            {intl.formatMessage(DIAGNOSIS[download.diagnosis.code], {
              service,
            })}
          </p>
          {download.diagnosis.automatic && (
            <p className="text-xs text-gray-400">
              {intl.formatMessage(messages.auto)}
            </p>
          )}
          {download.torrent && (
            <p className="text-xs text-gray-400">
              {intl.formatMessage(messages.seeds, {
                seeds: download.torrent.seeds,
                swarm: download.torrent.seedsInSwarm,
                peers: download.torrent.peers,
              })}
              {' · '}
              {intl.formatMessage(messages.speed, {
                speed: formatBytes(download.torrent.dlspeed, 1),
              })}
              {' · '}
              {intl.formatMessage(messages.availability, {
                value: download.torrent.availability.toFixed(2),
              })}
              {download.torrent.lastActivity > 0 && (
                <>
                  {' · '}
                  {intl.formatMessage(messages.lastActivity, {
                    time: intl.formatRelativeTime(
                      Math.round(
                        (download.torrent.lastActivity - Date.now() / 1000) /
                          3600
                      ),
                      'hours',
                      { numeric: 'auto', style: 'narrow' }
                    ),
                  })}
                </>
              )}
            </p>
          )}
          {download.messages.length > 0 && (
            <details className="text-xs text-gray-400">
              <summary className="cursor-pointer">
                {intl.formatMessage(messages.rawMessages, { service })}
              </summary>
              <ul className="ml-4 mt-1 list-disc">
                {download.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </details>
          )}
          {skipped?.download.queueId === download.queueId && (
            <div className="space-y-2 text-xs text-yellow-300">
              <p>{skipped.text}</p>
              <ConfirmButton
                onClick={() =>
                  post(`${download.queueId}-force`, {
                    action: 'import',
                    force: true,
                    queueId: download.queueId,
                    downloadId: download.downloadId,
                  })
                }
                confirmText={intl.formatMessage(globalMessages.areyousure)}
                className="w-auto"
              >
                {intl.formatMessage(messages.forceImport)}
              </ConfirmButton>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {download.diagnosis.actions.map((action) =>
              actionButton(download, action)
            )}
            {!download.diagnosis.actions.includes('interactiveSearch') &&
              actionButton(download, 'interactiveSearch')}
          </div>
        </div>
      ))}

      {!data.downloads.length && (
        <p className="text-gray-300">
          {intl.formatMessage(messages.nothingQueued)}
        </p>
      )}

      {!data.externalId && (
        <p className="text-yellow-300">
          {intl.formatMessage(messages.notInLibrary, { service })}
        </p>
      )}

      {library && !library.monitored && (
        <p className="text-yellow-300">
          {intl.formatMessage(messages.unmonitored, { service })}
        </p>
      )}

      {library && data.service === 'radarr' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-gray-300">
            {intl.formatMessage(
              library.hasFile
                ? messages.movieDone
                : library.isAvailable
                  ? messages.movieMissing
                  : messages.movieNotReleased,
              { service }
            )}
          </span>
          <Button
            buttonSize="sm"
            disabled={busy === 'search'}
            onClick={() =>
              post('search', { action: 'search' }, messages.searchStarted)
            }
          >
            {intl.formatMessage(messages.search)}
          </Button>
          <Button buttonSize="sm" onClick={() => setPicker({})}>
            {intl.formatMessage(messages.chooseRelease)}
          </Button>
        </div>
      )}

      {library?.seasons
        ?.filter(
          (season) =>
            season.episodeFileCount < season.episodeCount || !season.monitored
        )
        .map((season) => (
          <div
            key={season.seasonNumber}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-gray-300">
              {intl.formatMessage(messages.seasonLine, {
                season: season.seasonNumber,
                files: season.episodeFileCount,
                episodes: season.episodeCount,
                unmonitored: String(!season.monitored),
              })}
            </span>
            <Button
              buttonSize="sm"
              disabled={busy === `search-${season.seasonNumber}`}
              onClick={() =>
                post(
                  `search-${season.seasonNumber}`,
                  { action: 'search', seasonNumber: season.seasonNumber },
                  messages.searchStarted
                )
              }
            >
              {intl.formatMessage(messages.searchSeason, {
                season: season.seasonNumber,
              })}
            </Button>
            <Button
              buttonSize="sm"
              onClick={() => setPicker({ seasonNumber: season.seasonNumber })}
            >
              {intl.formatMessage(messages.chooseSeasonRelease, {
                season: season.seasonNumber,
              })}
            </Button>
          </div>
        ))}

      {picker && (
        <ReleasePicker
          mediaId={mediaId}
          is4k={is4k}
          seasonNumber={
            data.service === 'sonarr' ? (picker.seasonNumber ?? 1) : undefined
          }
          onClose={() => setPicker(undefined)}
          onGrabbed={() => {
            setPicker(undefined);
            mutate();
            onChange?.();
          }}
        />
      )}
    </div>
  );
};

export default ArrInsights;
