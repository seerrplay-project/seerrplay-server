import Badge from '@app/components/Common/Badge';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import type { DownloadStep } from '@server/lib/arrInsights';
import type { DownloadingItem } from '@server/lib/downloadtracker';
import { FormattedRelativeTime, useIntl } from 'react-intl';

const messages = defineMessages('components.DownloadBlock', {
  estimatedtime: 'Estimated {time}',
  startsAt: 'Download starts {time}',
  formattedTitle: '{title}: Season {seasonNumber} Episode {episodeNumber}',
  stepSearch: 'Search',
  stepWaiting: 'Looking for a better release',
  stepQueued: 'Queued',
  stepDownloading: 'Downloading',
  stepStalled: 'Stalled',
  stepImporting: 'Importing',
  stepBlocked: 'Import on hold',
  stepFailed: 'Failed',
  stepAvailable: 'Available',
  stuckHint: 'An admin can see why and fix it from the manage panel.',
});

const STEP_LABELS = {
  waiting: messages.stepWaiting,
  queued: messages.stepQueued,
  downloading: messages.stepDownloading,
  stalled: messages.stepStalled,
  importing: messages.stepImporting,
  blocked: messages.stepBlocked,
  failed: messages.stepFailed,
} as const;

// position of each step on the timeline, problems sit on the step they block
const STEP_INDEX: Record<DownloadStep, number> = {
  waiting: 0,
  queued: 1,
  downloading: 1,
  stalled: 1,
  importing: 2,
  blocked: 2,
  failed: 1,
};

const TIMELINE = [
  messages.stepSearch,
  messages.stepDownloading,
  messages.stepImporting,
  messages.stepAvailable,
];

const isProblem = (step: DownloadStep) =>
  step === 'stalled' || step === 'blocked' || step === 'failed';

interface DownloadBlockProps {
  downloadItem: DownloadingItem;
  is4k?: boolean;
  title?: string;
}

const DownloadBlock = ({
  downloadItem,
  is4k = false,
  title,
}: DownloadBlockProps) => {
  const intl = useIntl();
  const { hasPermission } = useUser();
  // items tracked before the step existed default to downloading
  const step: DownloadStep = downloadItem.step ?? 'downloading';
  const current = STEP_INDEX[step];

  return (
    <div className="p-4">
      <div className="mb-2 w-56 truncate text-sm sm:w-80 md:w-full">
        {hasPermission(Permission.ADMIN)
          ? downloadItem.title
          : downloadItem.episode
            ? intl.formatMessage(messages.formattedTitle, {
                title,
                seasonNumber: downloadItem?.episode?.seasonNumber,
                episodeNumber: downloadItem?.episode?.episodeNumber,
              })
            : title}
      </div>
      <div className="relative mb-2 h-6 min-w-0 overflow-hidden rounded-full bg-gray-700">
        <div
          className="h-8 bg-indigo-600 transition-all duration-200 ease-in-out"
          style={{
            width: `${
              downloadItem.size
                ? Math.round(
                    ((downloadItem.size - downloadItem.sizeLeft) /
                      downloadItem.size) *
                      100
                  )
                : 0
            }%`,
          }}
        />
        <div className="absolute inset-0 flex h-6 w-full items-center justify-center text-xs">
          <span>
            {downloadItem.size
              ? Math.round(
                  ((downloadItem.size - downloadItem.sizeLeft) /
                    downloadItem.size) *
                    100
                )
              : 0}
            %
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>
          {is4k && (
            <Badge badgeType="warning" className="mr-2">
              4K
            </Badge>
          )}
          <Badge badgeType={isProblem(step) ? 'danger' : 'primary'}>
            {intl.formatMessage(STEP_LABELS[step])}
          </Badge>
        </span>
        <span>
          {downloadItem.estimatedCompletionTime && !isProblem(step)
            ? intl.formatMessage(
                step === 'waiting' ? messages.startsAt : messages.estimatedtime,
                {
                  time: (
                    <FormattedRelativeTime
                      value={Math.floor(
                        (new Date(
                          downloadItem.estimatedCompletionTime
                        ).getTime() -
                          Date.now()) /
                          1000
                      )}
                      updateIntervalInSeconds={1}
                      numeric="auto"
                    />
                  ),
                }
              )
            : ''}
        </span>
      </div>
      <ol className="mt-3 flex items-center gap-1 text-[10px] uppercase tracking-wide">
        {TIMELINE.map((label, index) => (
          <li
            key={label.id}
            className={`flex-1 truncate border-t-2 pt-1 ${
              index < current
                ? 'border-indigo-500 text-gray-300'
                : index === current
                  ? isProblem(step)
                    ? 'border-red-500 text-red-300'
                    : 'border-indigo-400 font-bold text-white'
                  : 'border-gray-600 text-gray-500'
            }`}
          >
            {intl.formatMessage(label)}
          </li>
        ))}
      </ol>
      {isProblem(step) && !hasPermission(Permission.ADMIN) && (
        <p className="mt-2 text-xs text-gray-400">
          {intl.formatMessage(messages.stuckHint)}
        </p>
      )}
    </div>
  );
};

export default DownloadBlock;
