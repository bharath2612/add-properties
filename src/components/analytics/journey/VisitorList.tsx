import React from 'react';

export interface VisitorSummary {
  visitorId: string;
  fingerprintHash: string;
  firstSeen: string;
  lastSeen: string;
  isAuthenticated: boolean;
  platform: string;
  totalEvents: number;
  propertiesViewed: number;
}

interface VisitorListProps {
  visitors: VisitorSummary[];
  selectedId: string | null;
  onSelect: (visitorId: string) => void;
  loading: boolean;
}

const VisitorList: React.FC<VisitorListProps> = ({
  visitors,
  selectedId,
  onSelect,
  loading,
}) => {
  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getDeviceIcon = (platform: string) => {
    const p = platform?.toLowerCase() || '';
    if (p.includes('iphone') || p.includes('android') || p.includes('mobile')) return '📱';
    if (p.includes('ipad') || p.includes('tablet')) return '📱';
    return '🖥️';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  if (visitors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
        No visitors found
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-zinc-800">
      {visitors.map((visitor) => (
        <button
          key={visitor.visitorId}
          onClick={() => onSelect(visitor.visitorId)}
          className={`w-full text-left p-3 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 ${
            selectedId === visitor.visitorId
              ? 'bg-gray-100 dark:bg-zinc-800 border-l-2 border-blue-500'
              : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm">{getDeviceIcon(visitor.platform)}</span>
              <span className="text-xs font-mono text-black dark:text-white">
                {visitor.fingerprintHash}
              </span>
            </div>
            {visitor.isAuthenticated && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                User
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500">
            <span>
              {visitor.totalEvents} events • {visitor.propertiesViewed} properties
            </span>
            <span>{formatTimeAgo(visitor.lastSeen)}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default VisitorList;
