import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ErrorItem {
  id: string;
  error_fingerprint: string;
  error_title: string;
  error_message: string | null;
  file_path: string | null;
  line_number: number | null;
  status: string;
  priority: number;
  retry_count: number;
  created_at: string;
  processed_at: string | null;
  visitor_fingerprint: string | null;
  session_id: string | null;
}

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  processing: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  skipped: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400' },
};

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Critical',
  3: 'High',
  5: 'Medium',
  7: 'Low',
};

const ErrorsPage: React.FC = () => {
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });

  useEffect(() => {
    fetchErrors();
    fetchStats();
  }, [statusFilter]);

  const fetchErrors = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('fix_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setErrors(data || []);
    } catch (error) {
      console.error('Error fetching errors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('fix_queue')
        .select('status');

      if (error) throw error;

      const counts = {
        total: data?.length || 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      data?.forEach((item) => {
        if (item.status in counts) {
          counts[item.status as keyof typeof counts]++;
        }
      });

      setStats(counts);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-black dark:text-white">Error Queue</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-500">
            Errors captured from Sentry for AI auto-fix processing
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/lasco/settings"
            className="px-3 py-1.5 text-xs rounded bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Total</p>
          <p className="text-xl font-medium text-black dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Pending</p>
          <p className="text-xl font-medium text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Processing</p>
          <p className="text-xl font-medium text-blue-600 dark:text-blue-400">{stats.processing}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Completed</p>
          <p className="text-xl font-medium text-green-600 dark:text-green-400">{stats.completed}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Failed</p>
          <p className="text-xl font-medium text-red-600 dark:text-red-400">{stats.failed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'processing', 'completed', 'failed', 'skipped'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-xs rounded transition-colors capitalize ${
              statusFilter === status
                ? 'bg-black dark:bg-white text-white dark:text-black'
                : 'bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Error List */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
        {errors.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-zinc-900">
            {errors.map((error) => (
              <Link
                key={error.id}
                to={`/lasco/errors/${error.id}`}
                className="block p-4 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] rounded ${STATUS_COLORS[error.status]?.bg} ${STATUS_COLORS[error.status]?.text}`}>
                        {error.status}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-zinc-500">
                        P{error.priority} • {PRIORITY_LABELS[error.priority] || 'Unknown'}
                      </span>
                      {error.retry_count > 0 && (
                        <span className="text-[10px] text-orange-500">
                          Retry #{error.retry_count}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-black dark:text-white truncate">
                      {error.error_title}
                    </h3>
                    {error.error_message && (
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1 truncate">
                        {truncateText(error.error_message, 100)}
                      </p>
                    )}
                    {error.file_path && (
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1 font-mono">
                        {error.file_path}
                        {error.line_number && `:${error.line_number}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600">
                      {formatTimeAgo(error.created_at)}
                    </p>
                    {error.visitor_fingerprint && (
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1 font-mono">
                        {error.visitor_fingerprint.slice(0, 8)}...
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-zinc-500 text-sm">
            No errors found
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorsPage;
