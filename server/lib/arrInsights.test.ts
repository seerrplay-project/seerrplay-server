import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { diagnose, getDownloadStep } from '@server/lib/arrInsights';

const item = (overrides: Record<string, unknown> = {}) => ({
  status: 'downloading',
  trackedDownloadStatus: 'ok',
  trackedDownloadState: 'downloading',
  ...overrides,
});

const torrent = (overrides: Record<string, unknown> = {}) => ({
  state: 'downloading',
  num_seeds: 12,
  dlspeed: 1_000_000,
  progress: 0.4,
  ...overrides,
});

describe('getDownloadStep', () => {
  it('maps the queue states to pipeline steps', () => {
    assert.equal(getDownloadStep(item({ status: 'delay' })), 'waiting');
    assert.equal(getDownloadStep(item({ status: 'queued' })), 'queued');
    assert.equal(getDownloadStep(item()), 'downloading');
    assert.equal(getDownloadStep(item({ status: 'warning' })), 'stalled');
    assert.equal(
      getDownloadStep(item({ trackedDownloadState: 'importPending' })),
      'importing'
    );
    assert.equal(
      getDownloadStep(item({ trackedDownloadState: 'importBlocked' })),
      'blocked'
    );
    assert.equal(
      getDownloadStep(item({ trackedDownloadState: 'failedPending' })),
      'failed'
    );
  });
});

describe('diagnose', () => {
  it('offers to skip the delay profile', () => {
    const result = diagnose(item({ status: 'delay' }));
    assert.equal(result.code, 'waitingDelay');
    assert.deepEqual(result.actions, ['grabNow', 'interactiveSearch']);
  });

  it('flags a torrent without seeds, even from a localized *arr message', () => {
    const stalled = item({
      status: 'warning',
      errorMessage: 'Le téléchargement est bloqué sans aucune connexion',
    });
    assert.equal(diagnose(stalled).code, 'noSeeds');
    const result = diagnose(
      stalled,
      torrent({ state: 'stalledDL', num_seeds: 0, dlspeed: 0 })
    );
    assert.equal(result.code, 'noSeeds');
    assert.equal(result.automatic, true);
    assert.ok(result.actions.includes('blocklistAndSearch'));
  });

  it('explains imports blocked by a French title', () => {
    const result = diagnose(
      item({
        status: 'completed',
        trackedDownloadStatus: 'warning',
        trackedDownloadState: 'importBlocked',
        statusMessages: [
          {
            title: 'Frieren.S02E01.VOSTFR.1080p.mkv',
            messages: [
              'Found matching series via grab history, but release was matched to series by ID. Automatic import is not possible.',
            ],
          },
        ],
      })
    );
    assert.equal(result.code, 'blockedById');
    assert.equal(result.automatic, true);
    assert.equal(result.actions[0], 'import');
  });

  it('recognizes non-upgrades and other blocked imports', () => {
    const blocked = (message: string) =>
      diagnose(
        item({
          trackedDownloadState: 'importBlocked',
          statusMessages: [{ title: 'file', messages: [message] }],
        })
      ).code;
    assert.equal(
      blocked('Not a Custom Format upgrade for existing episode file(s)'),
      'notUpgrade'
    );
    assert.equal(blocked('Sample'), 'importBlocked');
  });

  it('suggests force start for torrents held by the client', () => {
    assert.equal(
      diagnose(item({ status: 'queued' }), torrent({ state: 'queuedDL' })).code,
      'queuedClient'
    );
    assert.equal(
      diagnose(item({ status: 'paused' }), torrent({ state: 'stoppedDL' }))
        .code,
      'pausedClient'
    );
  });

  it('leaves healthy downloads alone', () => {
    const result = diagnose(item(), torrent());
    assert.equal(result.code, 'downloading');
    assert.deepEqual(result.actions, []);
  });
});
