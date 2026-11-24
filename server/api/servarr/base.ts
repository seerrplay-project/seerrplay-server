import ExternalAPI from '@server/api/externalapi';
import type { AvailableCacheIds } from '@server/lib/cache';
import cacheManager from '@server/lib/cache';
import { getSettings, type DVRSettings } from '@server/lib/settings';

export interface SystemStatus {
  version: string;
  buildTime: Date;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
  isNetCore: boolean;
  isMono: boolean;
  isLinux: boolean;
  isOsx: boolean;
  isWindows: boolean;
  isDocker: boolean;
  mode: string;
  branch: string;
  authentication: string;
  sqliteVersion: string;
  migrationVersion: number;
  urlBase: string;
  runtimeVersion: string;
  runtimeName: string;
  startTime: Date;
  packageUpdateMechanism: string;
}

export interface RootFolder {
  id: number;
  path: string;
  freeSpace: number;
  totalSpace: number;
  unmappedFolders: {
    name: string;
    path: string;
  }[];
}

export interface QualityProfile {
  id: number;
  name: string;
}

export interface QueueStatusMessage {
  title: string;
  messages: string[];
}

export interface QueueItem {
  size: number;
  title: string;
  sizeleft: number;
  timeleft: string;
  estimatedCompletionTime: string;
  status: string;
  trackedDownloadStatus: string;
  trackedDownloadState: string;
  downloadId: string;
  protocol: string;
  downloadClient: string;
  indexer: string;
  id: number;
  added?: string;
  errorMessage?: string;
  statusMessages?: QueueStatusMessage[];
  quality?: { quality: { name: string } };
  languages?: { id: number; name: string }[];
  customFormatScore?: number;
}

export interface ServarrRelease {
  guid: string;
  indexerId: number;
  indexer: string;
  title: string;
  size: number;
  age: number;
  ageHours?: number;
  protocol: string;
  seeders?: number;
  leechers?: number;
  approved: boolean;
  rejected: boolean;
  rejections: string[];
  temporarilyRejected?: boolean;
  downloadAllowed: boolean;
  quality: { quality: { name: string } };
  languages?: { id: number; name: string }[];
  customFormatScore?: number;
  infoUrl?: string;
  fullSeason?: boolean;
  seasonNumber?: number;
  episodeNumbers?: number[];
}

export interface ManualImportCandidate {
  path: string;
  relativePath?: string;
  folderName?: string;
  name?: string;
  size?: number;
  series?: { id: number; title: string };
  movie?: { id: number; title: string };
  seasonNumber?: number;
  episodes?: { id: number; seasonNumber: number; episodeNumber: number }[];
  quality: unknown;
  languages?: unknown[];
  releaseGroup?: string;
  releaseType?: string;
  indexerFlags?: number;
  rejections?: { reason: string; type?: string }[];
}

export interface Tag {
  id: number;
  label: string;
}

interface QueueResponse<QueueItemAppendT> {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: (QueueItem & QueueItemAppendT)[];
}

class ServarrBase<QueueItemAppendT> extends ExternalAPI {
  static buildUrl(settings: DVRSettings, path?: string): string {
    return `${settings.useSsl ? 'https' : 'http'}://${settings.hostname}:${
      settings.port
    }${settings.baseUrl ?? ''}${path}`;
  }

  protected apiName: string;

  constructor({
    url,
    apiKey,
    cacheName,
    apiName,
  }: {
    url: string;
    apiKey: string;
    cacheName: AvailableCacheIds;
    apiName: string;
  }) {
    const timeout = getSettings().network.apiRequestTimeout;

    super(
      url,
      {
        apikey: apiKey,
      },
      {
        nodeCache: cacheManager.getCache(cacheName).data,
        timeout,
      }
    );

    this.apiName = apiName;
  }

  public getSystemStatus = async (): Promise<SystemStatus> => {
    try {
      const response = await this.axios.get<SystemStatus>('/system/status');

      return response.data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve system status: ${e.message}`,
        { cause: e }
      );
    }
  };

  public getProfiles = async (): Promise<QualityProfile[]> => {
    try {
      const data = await this.getRolling<QualityProfile[]>(
        `/qualityProfile`,
        undefined,
        3600
      );

      return data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve profiles: ${e.message}`,
        { cause: e }
      );
    }
  };

  public getRootFolders = async (): Promise<RootFolder[]> => {
    try {
      const data = await this.getRolling<RootFolder[]>(
        `/rootfolder`,
        undefined,
        3600
      );

      return data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve root folders: ${e.message}`,
        { cause: e }
      );
    }
  };

  public getQueue = async (): Promise<(QueueItem & QueueItemAppendT)[]> => {
    try {
      const response = await this.axios.get<QueueResponse<QueueItemAppendT>>(
        `/queue`,
        {
          params: {
            includeEpisode: true,
            // The default page holds 10 records, which hid busy queues
            pageSize: 1000,
          },
        }
      );

      return response.data.records;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve queue: ${e.message}`,
        { cause: e }
      );
    }
  };

  public getTags = async (): Promise<Tag[]> => {
    try {
      const response = await this.axios.get<Tag[]>(`/tag`);

      return response.data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve tags: ${e.message}`,
        { cause: e }
      );
    }
  };

  public createTag = async ({ label }: { label: string }): Promise<Tag> => {
    try {
      const response = await this.axios.post<Tag>(`/tag`, {
        label,
      });

      return response.data;
    } catch (e) {
      throw new Error(`[${this.apiName}] Failed to create tag: ${e.message}`, {
        cause: e,
      });
    }
  };

  public renameTag = async ({
    id,
    label,
  }: {
    id: number;
    label: string;
  }): Promise<Tag> => {
    try {
      const response = await this.axios.put<Tag>(`/tag/${id}`, {
        id,
        label,
      });

      return response.data;
    } catch (e) {
      throw new Error(`[${this.apiName}] Failed to rename tag: ${e.message}`, {
        cause: e,
      });
    }
  };

  /**
   * Removes a queue record. With blocklist, the *arr also searches for
   * another release unless skipRedownload is set.
   */
  public async removeQueueItem(
    queueId: number,
    {
      blocklist,
      removeFromClient,
      skipRedownload = false,
    }: {
      blocklist: boolean;
      removeFromClient: boolean;
      skipRedownload?: boolean;
    }
  ): Promise<void> {
    try {
      await this.axios.delete(`/queue/${queueId}`, {
        params: { blocklist, removeFromClient, skipRedownload },
      });
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to remove queue item: ${e.message}`,
        { cause: e }
      );
    }
  }

  /** Grabs a release held back by a delay profile right away. */
  public async grabQueueItem(queueId: number): Promise<void> {
    try {
      await this.axios.post(`/queue/grab/${queueId}`);
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to grab queue item: ${e.message}`,
        { cause: e }
      );
    }
  }

  /** Interactive search: every release the indexers return, with rejections. */
  public async getReleases(
    params: Record<string, number>
  ): Promise<ServarrRelease[]> {
    try {
      const response = await this.axios.get<ServarrRelease[]>('/release', {
        params,
        // indexers can take a while to answer an interactive search
        timeout: 120000,
      });
      return response.data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to search releases: ${e.message}`,
        { cause: e }
      );
    }
  }

  /** Sends a release from the last interactive search to the download client. */
  public async grabRelease(
    release: { guid: string; indexerId: number } & Record<string, unknown>
  ): Promise<void> {
    try {
      await this.axios.post('/release', release);
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to grab release: ${e.message}`,
        { cause: e }
      );
    }
  }

  public async getManualImport(
    params: Record<string, string | number | boolean>
  ): Promise<ManualImportCandidate[]> {
    try {
      const response = await this.axios.get<ManualImportCandidate[]>(
        '/manualimport',
        { params }
      );
      return response.data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to list manual import files: ${e.message}`,
        { cause: e }
      );
    }
  }

  public async manualImport(files: Record<string, unknown>[]): Promise<void> {
    await this.runCommand('ManualImport', { importMode: 'auto', files });
  }

  async refreshMonitoredDownloads(): Promise<void> {
    await this.runCommand('RefreshMonitoredDownloads', {});
  }

  protected async runCommand(
    commandName: string,
    options: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.axios.post(`/command`, {
        name: commandName,
        ...options,
      });
    } catch (e) {
      throw new Error(`[${this.apiName}] Failed to run command: ${e.message}`, {
        cause: e,
      });
    }
  }
}

export default ServarrBase;
