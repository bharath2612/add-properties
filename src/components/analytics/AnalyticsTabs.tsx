import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { label: 'Overview', path: '/analytics' },
  { label: 'Search', path: '/analytics/search' },
  { label: 'Properties', path: '/analytics/properties' },
  { label: 'Users', path: '/analytics/users' },
  { label: 'Realtime', path: '/analytics/realtime' },
  { label: 'Deep Research', path: '/analytics/deep-research' },
  { label: 'Chat', path: '/analytics/chat' },
];

const AnalyticsTabs: React.FC = () => {
  const location = useLocation();

  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-800">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              isActive
                ? 'border-black dark:border-white text-black dark:text-white'
                : 'border-transparent text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
};

export default AnalyticsTabs;
