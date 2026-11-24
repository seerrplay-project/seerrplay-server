import type { QbittorrentSettings } from '@server/lib/settings';
import { proxyRequestInterceptor } from '@server/utils/customProxyAgent';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

export interface QbittorrentTorrent {
  hash: string;
  name: string;
  state: string;
  progress: number;
  dlspeed: number;
  upspeed: number;
  eta: number;
  num_seeds: number;
  num_leechs: number;
  num_complete: number;
  num_incomplete: number;
  availability: number;
  size: number;
  downloaded: number;
  added_on: number;
  last_activity: number;
  seen_complete: number;
  ratio: number;
  category: string;
  tracker: string;
  force_start: boolean;
}

/** Minimal qBittorrent Web API v2 client (cookie session). */
class QbittorrentAPI {
  private axios: AxiosInstance;
  private cookie?: string;

  constructor(private settings: QbittorrentSettings) {
    this.axios = axios.create({
      baseURL: `${settings.url?.replace(/\/+$/, '')}/api/v2`,
      timeout: 15000,
    });
    this.axios.interceptors.request.use(proxyRequestInterceptor);
  }

  public async login(): Promise<void> {
    const response = await this.axios.post<string>(
      '/auth/login',
      new URLSearchParams({
        username: this.settings.username ?? '',
        password: this.settings.password ?? '',
      }),
      // qBittorrent rejects requests whose Referer/Origin is not its own host
      { headers: { Referer: this.settings.url ?? '' } }
    );
    // the cookie is "SID" on 4.x, "QBT_SID_<port>" on recent releases
    const sid = response.headers['set-cookie']?.find((c) =>
      /^[\w-]*SID[\w-]*=/.test(c)
    );
    // "Ok." without a cookie means auth is bypassed for this client subnet
    if (!sid && response.data !== 'Ok.') {
      throw new Error('qBittorrent rejected the credentials');
    }
    this.cookie = sid?.split(';')[0];
  }

  private async request<T>(
    method: 'get' | 'post',
    path: string,
    params: Record<string, string>
  ): Promise<T> {
    if (this.cookie === undefined) {
      await this.login();
    }
    const headers = {
      Referer: this.settings.url ?? '',
      ...(this.cookie ? { Cookie: this.cookie } : {}),
    };
    const response =
      method === 'get'
        ? await this.axios.get<T>(path, { params, headers })
        : await this.axios.post<T>(path, new URLSearchParams(params), {
            headers,
          });
    return response.data;
  }

  /** Torrents keyed by lowercase hash (the *arr downloadId is uppercase). */
  public async getTorrents(
    hashes: string[]
  ): Promise<Record<string, QbittorrentTorrent>> {
    if (!hashes.length) {
      return {};
    }
    const torrents = await this.request<QbittorrentTorrent[]>(
      'get',
      '/torrents/info',
      { hashes: hashes.map((hash) => hash.toLowerCase()).join('|') }
    );
    return Object.fromEntries(torrents.map((t) => [t.hash.toLowerCase(), t]));
  }

  /** Starts a queued or stopped torrent, ignoring the active download limit. */
  public async forceStart(hash: string): Promise<void> {
    await this.request('post', '/torrents/setForceStart', {
      hashes: hash.toLowerCase(),
      value: 'true',
    });
  }

  /** Asks the trackers for fresh peers. */
  public async reannounce(hash: string): Promise<void> {
    await this.request('post', '/torrents/reannounce', {
      hashes: hash.toLowerCase(),
    });
  }

  public async getVersion(): Promise<string> {
    return this.request<string>('get', '/app/version', {});
  }
}

export default QbittorrentAPI;
