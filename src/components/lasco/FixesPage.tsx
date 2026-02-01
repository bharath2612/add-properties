import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface AutoFix {
  id: string;
  error_fingerprint: string;
  error_title: string;
  error_message: string | null;
  file_path: string;
  original_code: string | null;
  fixed_code: string | null;
  fix_explanation: string | null;
  test_code: string | null;
  test_file_path: string | null;
  ai_model: string | null;
  status: string;
  pr_number: number | null;
  pr_url: string | null;
  branch_name: string | null;
  commit_sha: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  generated: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400' },
  committed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  pr_created: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
  merged: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

// Simple diff component
const DiffViewer: React.FC<{ original: string; modified: string }> = ({ original, modified }) => {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  // Simple line-by-line diff (not a full diff algorithm, but good enough for display)
  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  const diffLines: Array<{ type: 'unchanged' | 'removed' | 'added'; content: string }> = [];

  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i] || '';
    const modLine = modifiedLines[i] || '';

    if (origLine === modLine) {
      if (origLine) {
        diffLines.push({ type: 'unchanged', content: origLine });
      }
    } else {
      if (origLine) {
        diffLines.push({ type: 'removed', content: origLine });
      }
      if (modLine) {
        diffLines.push({ type: 'added', content: modLine });
      }
    }
  }

  return (
    <div className="font-mono text-xs overflow-x-auto">
      {diffLines.map((line, index) => (
        <div
          key={index}
          className={`px-3 py-0.5 ${
            line.type === 'removed'
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              : line.type === 'added'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'text-gray-600 dark:text-zinc-400'
          }`}
        >
          <span className="inline-block w-4 mr-2 text-gray-400 dark:text-zinc-600 select-none">
            {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
          </span>
          {line.content || ' '}
        </div>
      ))}
    </div>
  );
};

const FixDetailView: React.FC<{ fix: AutoFix }> = ({ fix }) => {
  const [showTest, setShowTest] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[fix.status]?.bg} ${STATUS_COLORS[fix.status]?.text}`}>
                {fix.status.replace('_', ' ')}
              </span>
              {fix.ai_model && (
                <span className="text-xs text-gray-500 dark:text-zinc-500">
                  {fix.ai_model}
                </span>
              )}
            </div>
            <h2 className="text-base font-medium text-black dark:text-white">{fix.error_title}</h2>
            {fix.error_message && (
              <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">{fix.error_message}</p>
            )}
          </div>
          {fix.pr_url && (
            <a
              href={fix.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-xs bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
              </svg>
              PR #{fix.pr_number}
            </a>
          )}
        </div>

        {fix.fix_explanation && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">AI Explanation</p>
            <p className="text-sm text-blue-600 dark:text-blue-300">{fix.fix_explanation}</p>
          </div>
        )}
      </div>

      {/* Code Diff */}
      {fix.original_code && fix.fixed_code && (
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-zinc-900 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-black dark:text-white">Code Changes</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-500 font-mono">{fix.file_path}</p>
            </div>
            {fix.commit_sha && (
              <span className="text-xs text-gray-500 dark:text-zinc-500 font-mono">
                {fix.commit_sha.slice(0, 7)}
              </span>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <DiffViewer original={fix.original_code} modified={fix.fixed_code} />
          </div>
        </div>
      )}

      {/* Test Code */}
      {fix.test_code && (
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowTest(!showTest)}
            className="w-full p-3 flex items-center justify-between text-sm font-medium text-black dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <div>
              <span>Generated Test</span>
              {fix.test_file_path && (
                <span className="text-xs text-gray-500 dark:text-zinc-500 font-mono ml-2">
                  {fix.test_file_path}
                </span>
              )}
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${showTest ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showTest && (
            <div className="p-3 border-t border-gray-200 dark:border-zinc-900">
              <pre className="text-xs font-mono text-gray-600 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap">
                {fix.test_code}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FixesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [fixes, setFixes] = useState<AutoFix[]>([]);
  const [selectedFix, setSelectedFix] = useState<AutoFix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFixes();
  }, []);

  useEffect(() => {
    if (id && fixes.length > 0) {
      const fix = fixes.find((f) => f.id === id);
      if (fix) {
        setSelectedFix(fix);
      }
    }
  }, [id, fixes]);

  const fetchFixes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('auto_fixes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setFixes(data || []);

      // If viewing a specific fix, select it
      if (id && data) {
        const fix = data.find((f: AutoFix) => f.id === id);
        if (fix) setSelectedFix(fix);
      }
    } catch (error) {
      console.error('Error fetching fixes:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 dark:border-zinc-600"></div>
      </div>
    );
  }

  // Show detail view if a fix is selected
  if (selectedFix) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-500 mb-4">
          <Link to="/lasco/fixes" className="hover:text-black dark:hover:text-white transition-colors">
            Fixes
          </Link>
          <span>/</span>
          <span className="text-black dark:text-white truncate max-w-[200px]">{selectedFix.error_title}</span>
        </div>
        <FixDetailView fix={selectedFix} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-medium text-black dark:text-white">Auto-Fixes</h1>
        <p className="text-xs text-gray-500 dark:text-zinc-500">
          AI-generated code fixes and their PR status
        </p>
      </div>

      {/* Fixes List */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
        {fixes.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-zinc-900">
            {fixes.map((fix) => (
              <Link
                key={fix.id}
                to={`/lasco/fixes/${fix.id}`}
                className="block p-4 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] rounded ${STATUS_COLORS[fix.status]?.bg} ${STATUS_COLORS[fix.status]?.text}`}>
                        {fix.status.replace('_', ' ')}
                      </span>
                      {fix.pr_number && (
                        <span className="text-[10px] text-gray-500 dark:text-zinc-500">
                          PR #{fix.pr_number}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-black dark:text-white truncate">
                      {fix.error_title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1 font-mono truncate">
                      {fix.file_path}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600">
                      {formatTimeAgo(fix.created_at)}
                    </p>
                    {fix.ai_model && (
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1">
                        {fix.ai_model}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-zinc-500 text-sm">
            No fixes generated yet
          </div>
        )}
      </div>
    </div>
  );
};

export default FixesPage;
