import type { Diagnosis, DownloadStep } from '@server/lib/arrInsights';

export interface ArrTorrent {
  state: string;
  progress: number;
  dlspeed: number;
  eta: number;
  seeds: number;
  peers: number;
  seedsInSwarm: number;
  peersInSwarm: number;
  availability: number;
  lastActivity: number;
  seenComplete: number;
  forceStart: boolean;
}

export interface ArrDownload {
  queueId: number;
  downloadId: string;
  title: string;
  step: DownloadStep;
  diagnosis: Diagnosis;
  messages: string[];
  status: string;
  trackedDownloadStatus: string;
  trackedDownloadState: string;
  size: number;
  sizeLeft: number;
  timeLeft: string;
  estimatedCompletionTime: string;
  added?: string;
  indexer: string;
  downloadClient: string;
  protocol: string;
  quality?: string;
  languages: string[];
  customFormatScore?: number;
  episodes: { seasonNumber: number; episodeNumber: number }[];
  torrent?: ArrTorrent;
}

export interface ArrInsightsResponse {
  service: 'sonarr' | 'radarr';
  serverName: string;
  externalId?: number;
  qbittorrent: boolean;
  downloads: ArrDownload[];
  library?: {
    monitored: boolean;
    hasFile?: boolean;
    isAvailable?: boolean;
    seasons?: {
      seasonNumber: number;
      monitored: boolean;
      episodeFileCount: number;
      episodeCount: number;
      totalEpisodeCount: number;
    }[];
  };
}

export interface ArrRelease {
  guid: string;
  indexerId: number;
  indexer: string;
  title: string;
  size: number;
  ageHours: number;
  protocol: string;
  seeders?: number;
  leechers?: number;
  approved: boolean;
  rejections: string[];
  quality?: string;
  languages: string[];
  customFormatScore: number;
  infoUrl?: string;
  fullSeason?: boolean;
  episodeNumbers?: number[];
}
