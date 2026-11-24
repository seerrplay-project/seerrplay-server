import type { QbittorrentTorrent } from '@server/api/qbittorrent';
import type { QueueItem } from '@server/api/servarr/base';

/**
 * Pipeline step of a queue record, shown to every user next to the progress.
 * waiting: held by a delay profile; queued: waiting in the download client;
 * stalled: no progress; blocked: downloaded but the import needs a hand.
 */
export type DownloadStep =
  | 'waiting'
  | 'queued'
  | 'downloading'
  | 'stalled'
  | 'importing'
  | 'blocked'
  | 'failed';

export type ArrAction =
  | 'grabNow'
  | 'forceStart'
  | 'reannounce'
  | 'import'
  | 'remove'
  | 'blocklistAndSearch'
  | 'interactiveSearch';

export type DiagnosisCode =
  | 'waitingDelay'
  | 'queuedClient'
  | 'pausedClient'
  | 'downloading'
  | 'noSeeds'
  | 'stalled'
  | 'importing'
  | 'blockedById'
  | 'notUpgrade'
  | 'importBlocked'
  | 'failed';

export interface Diagnosis {
  code: DiagnosisCode;
  /** Problem the arr-maintenance job resolves on its own if left alone. */
  automatic: boolean;
  actions: ArrAction[];
}

type StepInput = Pick<
  QueueItem,
  'status' | 'trackedDownloadStatus' | 'trackedDownloadState' | 'errorMessage'
>;

// Same patterns as the arr-maintenance job, so Seerr explains what it fixes.
export const BLOCKED_BY_ID = /matched to (series|movie) by ID/i;
export const NOT_UPGRADE =
  /Not (a Custom Format upgrade|an upgrade) for existing/i;

const lower = (value?: string) => (value ?? '').toLowerCase();

export const getDownloadStep = (item: StepInput): DownloadStep => {
  const status = lower(item.status);
  const state = lower(item.trackedDownloadState);
  const health = lower(item.trackedDownloadStatus);

  if (status === 'delay') return 'waiting';
  if (state === 'failed' || state === 'failedpending' || status === 'failed') {
    return 'failed';
  }
  if (state === 'importblocked') return 'blocked';
  if (
    state === 'importpending' ||
    state === 'importing' ||
    state === 'imported' ||
    status === 'completed'
  ) {
    return 'importing';
  }
  if (status === 'warning' || health === 'warning' || health === 'error') {
    return 'stalled';
  }
  if (
    status === 'queued' ||
    status === 'paused' ||
    status === 'downloadclientunavailable'
  ) {
    return 'queued';
  }
  return 'downloading';
};

export const getQueueMessages = (
  item: Pick<QueueItem, 'statusMessages' | 'errorMessage'>
): string[] => {
  const messages = (item.statusMessages ?? []).flatMap((group) =>
    group.messages.length ? group.messages : [group.title]
  );
  if (item.errorMessage) messages.unshift(item.errorMessage);
  return [...new Set(messages.filter(Boolean))];
};

const RETRY: ArrAction[] = ['blocklistAndSearch', 'interactiveSearch'];

export const diagnose = (
  item: StepInput & Pick<QueueItem, 'statusMessages'>,
  torrent?: Pick<
    QbittorrentTorrent,
    'state' | 'num_seeds' | 'dlspeed' | 'progress'
  >
): Diagnosis => {
  const step = getDownloadStep(item);
  const text = getQueueMessages(item).join(' ');
  const result = (
    code: DiagnosisCode,
    actions: ArrAction[],
    automatic = false
  ): Diagnosis => ({ code, actions, automatic });

  switch (step) {
    case 'waiting':
      return result('waitingDelay', ['grabNow', 'interactiveSearch']);
    case 'failed':
      return result('failed', RETRY);
    case 'importing':
      return result('importing', []);
    case 'blocked':
      if (BLOCKED_BY_ID.test(text)) {
        return result('blockedById', ['import', ...RETRY], true);
      }
      if (NOT_UPGRADE.test(text)) {
        return result('notUpgrade', ['remove'], true);
      }
      return result('importBlocked', ['import', ...RETRY]);
  }

  const state = lower(torrent?.state);
  if (state === 'queueddl') return result('queuedClient', ['forceStart']);
  if (state === 'pauseddl' || state === 'stoppeddl') {
    return result('pausedClient', ['forceStart']);
  }
  const noSeeds = torrent
    ? state === 'stalleddl' ||
      state === 'metadl' ||
      (torrent.num_seeds === 0 && torrent.dlspeed === 0 && torrent.progress < 1)
    : step === 'stalled' && /stalled|bloqué|connexion|connection/i.test(text);
  if (noSeeds) {
    return result('noSeeds', ['reannounce', ...RETRY], true);
  }
  if (step === 'stalled') return result('stalled', RETRY);
  if (step === 'queued') return result('queuedClient', ['forceStart']);
  return result('downloading', []);
};
