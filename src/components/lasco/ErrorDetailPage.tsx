import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ErrorDetail {
  id: string;
  sentry_event_id: string;
  error_fingerprint: string;
  error_title: string;
  error_message: string | null;
  stack_trace: unknown;
  file_path: string | null;
  line_number: number | null;
  visitor_fingerprint: string | null;
  session_id: string | null;
  status: string;
  priority: number;
  retry_count: number;
  error_details: unknown;
  created_at: string;
  processed_at: string | null;
}

interface TimelineEvent {
  ts: string;
  layer: string;
  event: string;
  message: string;
  severity?: string;
  context?: Record<string, unknown>;
  network?: {
    request_id: string;
    method?: string;
    url?: string;
    status_code?: number;
    duration_ms?: number;
  };
  element?: {
    tagName: string;
    id: string | null;
    className: string | null;
    path: string;
  };
  bug?: {
    is_error: boolean;
    error_type: string;
    severity: string;
    stack?: string;
  };
}

interface AutoFix {
  id: string;
  status: string;
  file_path: string;
  fix_explanation: string | null;
  original_code: string | null;
  fixed_code: string | null;
  test_code: string | null;
  test_file_path: string | null;
  pr_number: number | null;
  pr_url: string | null;
  created_at: string;
}

type LayerFilter = 'all' | 'user' | 'network' | 'frontend' | 'backend';

const LAYER_COLORS: Record<string, string> = {
  user: 'bg-blue-500',
  network: 'bg-purple-500',
  frontend: 'bg-orange-500',
  backend: 'bg-green-500',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  processing: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  skipped: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400' },
  generated: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400' },
  pr_created: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
  merged: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
};

const ErrorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<ErrorDetail | null>(null);
  const [autoFix, setAutoFix] = useState<AutoFix | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [showStackTrace, setShowStackTrace] = useState(false);

  useEffect(() => {
    if (id) {
      fetchErrorDetail();
    }
  }, [id]);

  const fetchErrorDetail = async () => {
    setLoading(true);
    try {
      // Fetch error details
      const { data: errorData, error: errorError } = await supabase
        .from('fix_queue')
        .select('*')
        .eq('id', id)
        .single();

      if (errorError) throw errorError;
      setError(errorData);

      // Fetch associated auto-fix if exists
      if (errorData?.error_fingerprint) {
        const { data: fixData } = await supabase
          .from('auto_fixes')
          .select('*')
          .eq('error_fingerprint', errorData.error_fingerprint)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fixData) {
          setAutoFix(fixData);
        }
      }

      // Mock timeline data for now (will come from event_timelines table)
      // In production, this would be fetched from the database
      setTimeline([]);
    } catch (err) {
      console.error('Error fetching error detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const filteredTimeline = timeline.filter(
    (event) => layerFilter === 'all' || event.layer === layerFilter
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 dark:border-zinc-600"></div>
      </div>
    );
  }

  if (!error) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-gray-500 dark:text-zinc-500">Error not found</p>
        <Link to="/lasco/errors" className="text-sm text-blue-500 hover:underline mt-2 inline-block">
          ← Back to errors
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-500">
        <Link to="/lasco/errors" className="hover:text-black dark:hover:text-white transition-colors">
          Errors
        </Link>
        <span>/</span>
        <span className="text-black dark:text-white truncate max-w-[200px]">{error.error_title}</span>
      </div>

      {/* Error Header */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[error.status]?.bg} ${STATUS_COLORS[error.status]?.text}`}>
                {error.status}
              </span>
              <span className="text-xs text-gray-500 dark:text-zinc-500">
                Priority {error.priority}
              </span>
            </div>
            <h1 className="text-lg font-medium text-black dark:text-white">
              {error.error_title}
            </h1>
          </div>
          <div className="text-right text-xs text-gray-500 dark:text-zinc-500">
            <p>{formatTimeAgo(error.created_at)}</p>
            <p className="font-mono text-[10px] mt-1">{error.error_fingerprint.slice(0, 12)}...</p>
          </div>
        </div>

        {error.error_message && (
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
            {error.error_message}
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {error.file_path && (
            <div>
              <p className="text-gray-500 dark:text-zinc-500 mb-1">File</p>
              <p className="font-mono text-black dark:text-white truncate">
                {error.file_path}
                {error.line_number && `:${error.line_number}`}
              </p>
            </div>
          )}
          {error.visitor_fingerprint && (
            <div>
              <p className="text-gray-500 dark:text-zinc-500 mb-1">Visitor</p>
              <p className="font-mono text-black dark:text-white">{error.visitor_fingerprint.slice(0, 12)}...</p>
            </div>
          )}
          {error.session_id && (
            <div>
              <p className="text-gray-500 dark:text-zinc-500 mb-1">Session</p>
              <p className="font-mono text-black dark:text-white">{error.session_id.slice(0, 12)}...</p>
            </div>
          )}
          <div>
            <p className="text-gray-500 dark:text-zinc-500 mb-1">Sentry Event</p>
            <p className="font-mono text-black dark:text-white">{error.sentry_event_id.slice(0, 12)}...</p>
          </div>
        </div>
      </div>

      {/* Stack Trace */}
      {error.stack_trace && (
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowStackTrace(!showStackTrace)}
            className="w-full p-3 flex items-center justify-between text-sm font-medium text-black dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <span>Stack Trace</span>
            <svg
              className={`w-4 h-4 transition-transform ${showStackTrace ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showStackTrace && (
            <div className="p-3 border-t border-gray-200 dark:border-zinc-900">
              <pre className="text-xs font-mono text-gray-600 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(error.stack_trace, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Auto-Fix Status */}
      {autoFix && (
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-black dark:text-white">AI Auto-Fix</h2>
            <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[autoFix.status]?.bg} ${STATUS_COLORS[autoFix.status]?.text}`}>
              {autoFix.status.replace('_', ' ')}
            </span>
          </div>

          {autoFix.fix_explanation && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Explanation</p>
              <p className="text-sm text-gray-600 dark:text-zinc-400">{autoFix.fix_explanation}</p>
            </div>
          )}

          {autoFix.pr_url && (
            <a
              href={autoFix.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
              </svg>
              View PR #{autoFix.pr_number}
            </a>
          )}

          {autoFix.fixed_code && (
            <div className="mt-4">
              <Link
                to={`/lasco/fixes/${autoFix.id}`}
                className="text-xs text-blue-500 hover:underline"
              >
                View code diff →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Event Timeline */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-black dark:text-white">Event Timeline</h2>
            <div className="flex gap-1">
              {(['all', 'user', 'network', 'frontend'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setLayerFilter(layer)}
                  className={`px-2 py-1 text-[10px] rounded capitalize transition-colors ${
                    layerFilter === layer
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-zinc-900 max-h-[400px] overflow-y-auto">
          {filteredTimeline.length > 0 ? (
            filteredTimeline.map((event, index) => (
              <div key={index} className="p-3 flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${LAYER_COLORS[event.layer] || 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase">
                      {event.layer}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                      {event.event}
                    </span>
                    {event.severity && (
                      <span className={`text-[10px] ${
                        event.severity === 'ERROR' ? 'text-red-500' :
                        event.severity === 'WARN' ? 'text-yellow-500' : 'text-gray-400'
                      }`}>
                        {event.severity}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-black dark:text-white truncate">{event.message}</p>
                  {event.network && (
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-1 font-mono">
                      {event.network.status_code && `${event.network.status_code} • `}
                      {event.network.duration_ms && `${event.network.duration_ms}ms`}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 dark:text-zinc-600 flex-shrink-0">
                  {new Date(event.ts).toLocaleTimeString()}
                </span>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-zinc-500 text-sm">
              No timeline events available.
              <br />
              <span className="text-xs">Timeline data will appear here when errors are captured with timeline context.</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Details JSON (for debugging) */}
      {error.error_details && (
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h2 className="text-sm font-medium text-black dark:text-white mb-3">Processing Details</h2>
          <pre className="text-xs font-mono text-gray-600 dark:text-zinc-400 overflow-x-auto">
            {JSON.stringify(error.error_details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ErrorDetailPage;
