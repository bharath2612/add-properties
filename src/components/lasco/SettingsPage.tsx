import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface LascoConfig {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

const SettingsPage: React.FC = () => {
  const [configs, setConfigs] = useState<LascoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState('anthropic');
  const [workerStatus, setWorkerStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');

  useEffect(() => {
    fetchConfigs();
    checkWorkerStatus();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lasco_config')
        .select('*')
        .order('key');

      if (error) throw error;
      setConfigs(data || []);

      // Extract enabled state
      const enabledConfig = data?.find((c) => c.key === 'enabled');
      setEnabled(enabledConfig?.value === true);

      // Extract AI provider
      const providerConfig = data?.find((c) => c.key === 'ai_provider');
      if (providerConfig?.value) {
        setAiProvider(String(providerConfig.value).replace(/"/g, ''));
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkWorkerStatus = async () => {
    try {
      // Try to reach the worker health endpoint
      const workerUrl = import.meta.env.VITE_LASCO_WORKER_URL || 'https://lasco-api.prop8t.ai';
      const response = await fetch(`${workerUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        setWorkerStatus('online');
      } else {
        setWorkerStatus('offline');
      }
    } catch {
      setWorkerStatus('offline');
    }
  };

  const toggleEnabled = async () => {
    setSaving(true);
    try {
      const newValue = !enabled;
      const { error } = await supabase
        .from('lasco_config')
        .upsert({
          key: 'enabled',
          value: newValue,
          description: 'Master kill switch for LASCO auto-fix pipeline',
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setEnabled(newValue);
    } catch (error) {
      console.error('Error toggling enabled:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateAiProvider = async (provider: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('lasco_config')
        .upsert({
          key: 'ai_provider',
          value: provider,
          description: 'Primary AI provider (anthropic or openai)',
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setAiProvider(provider);
    } catch (error) {
      console.error('Error updating AI provider:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 dark:border-zinc-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-medium text-black dark:text-white">LASCO Settings</h1>
        <p className="text-xs text-gray-500 dark:text-zinc-500">
          Configure AI auto-fix system settings
        </p>
      </div>

      {/* Worker Status */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-black dark:text-white">Worker Status</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
              LASCO worker running on Hetzner VPS
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                workerStatus === 'online'
                  ? 'bg-green-500'
                  : workerStatus === 'offline'
                  ? 'bg-red-500'
                  : 'bg-gray-400'
              }`}
            />
            <span
              className={`text-sm capitalize ${
                workerStatus === 'online'
                  ? 'text-green-600 dark:text-green-400'
                  : workerStatus === 'offline'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-zinc-500'
              }`}
            >
              {workerStatus}
            </span>
            <button
              onClick={checkWorkerStatus}
              className="ml-2 p-1 text-gray-500 hover:text-black dark:hover:text-white transition-colors"
              title="Refresh status"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Kill Switch */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-black dark:text-white">Auto-Fix Pipeline</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
              Master kill switch for AI auto-fix processing
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={saving}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'
            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : ''
              }`}
            />
          </button>
        </div>
        {!enabled && (
          <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-400">
            LASCO is disabled. Errors will be received but not processed.
          </div>
        )}
      </div>

      {/* AI Provider */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <h2 className="text-sm font-medium text-black dark:text-white mb-3">AI Provider</h2>
        <p className="text-xs text-gray-500 dark:text-zinc-500 mb-3">
          Select the primary AI provider for generating fixes. Falls back to the other if unavailable.
        </p>
        <div className="flex gap-2">
          {['anthropic', 'openai'].map((provider) => (
            <button
              key={provider}
              onClick={() => updateAiProvider(provider)}
              disabled={saving}
              className={`px-4 py-2 text-sm rounded transition-colors capitalize ${
                aiProvider === provider
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {provider === 'anthropic' ? 'Claude (Anthropic)' : 'GPT-4 (OpenAI)'}
            </button>
          ))}
        </div>
      </div>

      {/* All Configs Table */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-900">
          <h2 className="text-sm font-medium text-black dark:text-white">All Configuration</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-900 bg-gray-100 dark:bg-zinc-900">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-500">
                  Key
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-500">
                  Value
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-500">
                  Description
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-500">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-zinc-900">
              {configs.map((config) => (
                <tr key={config.key} className="hover:bg-gray-100 dark:hover:bg-zinc-900">
                  <td className="px-4 py-3 text-xs font-mono text-black dark:text-white">
                    {config.key}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600 dark:text-zinc-400">
                    {typeof config.value === 'object'
                      ? JSON.stringify(config.value)
                      : String(config.value)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-zinc-500">
                    {config.description || '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 dark:text-zinc-600">
                    {formatDate(config.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <h2 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Danger Zone</h2>
        <p className="text-xs text-red-600 dark:text-red-400 mb-3">
          These actions are irreversible. Use with caution.
        </p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (confirm('Clear all pending errors from the queue? This cannot be undone.')) {
                try {
                  await supabase.from('fix_queue').delete().eq('status', 'pending');
                  alert('Pending queue cleared');
                } catch {
                  alert('Failed to clear queue');
                }
              }
            }}
            className="px-3 py-1.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
          >
            Clear Pending Queue
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
