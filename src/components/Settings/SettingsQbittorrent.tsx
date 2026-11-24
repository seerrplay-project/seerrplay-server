import Button from '@app/components/Common/Button';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Settings.SettingsQbittorrent', {
  title: 'qBittorrent',
  description:
    'Optional. Lets admins see seeds, speed and why a torrent is stuck, and force start or reannounce it from the manage panel. Leave the URL empty to disable.',
  url: 'URL',
  username: 'Username',
  password: 'Password',
  passwordKept: 'Leave empty to keep the saved password',
  saved: 'qBittorrent settings saved.',
  saveError: 'Unable to connect to qBittorrent.',
});

interface QbittorrentSettingsResponse {
  url?: string;
  username?: string;
  hasPassword: boolean;
}

const SettingsQbittorrent = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { data, mutate } = useSWR<QbittorrentSettingsResponse>(
    '/api/v1/settings/qbittorrent'
  );
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUrl(data?.url ?? '');
    setUsername(data?.username ?? '');
  }, [data]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/v1/settings/qbittorrent', {
        url,
        username,
        password,
      });
      setPassword('');
      await mutate();
      addToast(intl.formatMessage(messages.saved), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.saveError), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6 mt-10">
        <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
        <p className="description">
          {intl.formatMessage(messages.description)}
        </p>
      </div>
      <form className="section" onSubmit={save}>
        <div className="form-row">
          <label htmlFor="qbittorrentUrl" className="text-label">
            {intl.formatMessage(messages.url)}
          </label>
          <div className="form-input-area">
            <div className="form-input-field">
              <input
                id="qbittorrentUrl"
                type="url"
                placeholder="http://qbittorrent:8080"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="qbittorrentUsername" className="text-label">
            {intl.formatMessage(messages.username)}
          </label>
          <div className="form-input-area">
            <div className="form-input-field">
              <input
                id="qbittorrentUsername"
                type="text"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="qbittorrentPassword" className="text-label">
            {intl.formatMessage(messages.password)}
          </label>
          <div className="form-input-area">
            <div className="form-input-field">
              <input
                id="qbittorrentPassword"
                type="password"
                autoComplete="new-password"
                placeholder={
                  data?.hasPassword
                    ? intl.formatMessage(messages.passwordKept)
                    : undefined
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="actions">
          <div className="flex justify-end">
            <span className="ml-3 inline-flex rounded-md shadow-sm">
              <Button buttonType="primary" type="submit" disabled={saving}>
                <ArrowDownOnSquareIcon />
                <span>
                  {saving
                    ? intl.formatMessage(globalMessages.saving)
                    : intl.formatMessage(globalMessages.save)}
                </span>
              </Button>
            </span>
          </div>
        </div>
      </form>
    </>
  );
};

export default SettingsQbittorrent;
