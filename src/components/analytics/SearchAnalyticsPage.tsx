import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SearchQuery {
  query: string;
  count: number;
  lastSearched: string;
}

interface DailySearchTrend {
  date: string;
  searches: number;
}

interface RecentSearch {
  id: number;
  query: string;
  source: string;
  createdAt: string;
  deviceType: string;
  isLoggedIn: boolean;
}

const SearchAnalyticsPage: React.FC = () => {
  const [topSearches, setTopSearches] = useState<SearchQuery[]>([]);
  const [dailyTrends, setDailyTrends] = useState<DailySearchTrend[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [totalSearches, setTotalSearches] = useState(0);
  const [uniqueQueries, setUniqueQueries] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days'>('7days');

  useEffect(() => {
    fetchSearchAnalytics();
  }, [dateRange]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return new Date(now.setHours(0, 0, 0, 0)).toISOString();
      case '7days':
        return new Date(now.setDate(now.getDate() - 7)).toISOString();
      case '30days':
        return new Date(now.setDate(now.getDate() - 30)).toISOString();
    }
  };

  const fetchSearchAnalytics = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();

      // Fetch all search_query events
      const { data, error } = await supabase
        .from('user_activity_events')
        .select('id, metadata, created_at, device_type, user_id, source_page')
        .eq('event_type', 'search_query')
        .gte('created_at', dateFilter)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const searchEvents = data || [];
      setTotalSearches(searchEvents.length);

      // Extract queries and aggregate
      const queryMap: Record<string, { count: number; lastSearched: string }> = {};
      const dailyMap: Record<string, number> = {};
      const uniqueQueriesSet = new Set<string>();

      searchEvents.forEach((event: any) => {
        const query = event.metadata?.query || 'Unknown';
        const date = new Date(event.created_at).toISOString().split('T')[0];

        // Track unique queries
        uniqueQueriesSet.add(query.toLowerCase().trim());

        // Aggregate by query
        if (!queryMap[query]) {
          queryMap[query] = { count: 0, lastSearched: event.created_at };
        }
        queryMap[query].count++;
        if (new Date(event.created_at) > new Date(queryMap[query].lastSearched)) {
          queryMap[query].lastSearched = event.created_at;
        }

        // Aggregate by day
        dailyMap[date] = (dailyMap[date] || 0) + 1;
      });

      setUniqueQueries(uniqueQueriesSet.size);

      // Top searches
      const topSearchesData = Object.entries(queryMap)
        .map(([query, data]) => ({
          query,
          count: data.count,
          lastSearched: data.lastSearched,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setTopSearches(topSearchesData);

      // Daily trends
      const trendsData = Object.entries(dailyMap)
        .map(([date, searches]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          searches,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setDailyTrends(trendsData);

      // Recent searches
      const recentSearchesData = searchEvents.slice(0, 20).map((event: any) => ({
        id: event.id,
        query: event.metadata?.query || 'Unknown',
        source: event.metadata?.source || event.source_page || 'unknown',
        createdAt: event.created_at,
        deviceType: event.device_type || 'unknown',
        isLoggedIn: !!event.user_id,
      }));

      setRecentSearches(recentSearchesData);
    } catch (error) {
      console.error('Error fetching search analytics:', error);
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

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      hero_search: 'Homepage',
      chat_followup: 'Chat',
      map_chat: 'Map',
    };
    return labels[source] || source;
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      hero_search: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      chat_followup: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      map_chat: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    };
    return colors[source] || 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400';
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
          <h1 className="text-lg font-medium text-black dark:text-white">Search Analytics</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-500">Understand what users are searching for</p>
        </div>
        <div className="flex gap-2">
          {(['today', '7days', '30days'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                dateRange === range
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800'
              }`}
            >
              {range === 'today' ? 'Today' : range === '7days' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Total Searches</p>
          <p className="text-2xl font-medium text-black dark:text-white">{totalSearches}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Unique Queries</p>
          <p className="text-2xl font-medium text-black dark:text-white">{uniqueQueries}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Avg Searches/Query</p>
          <p className="text-2xl font-medium text-black dark:text-white">
            {uniqueQueries > 0 ? (totalSearches / uniqueQueries).toFixed(1) : '0'}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Searches Today</p>
          <p className="text-2xl font-medium text-green-600 dark:text-green-400">
            {dailyTrends.length > 0 ? dailyTrends[dailyTrends.length - 1]?.searches || 0 : 0}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Search Volume Trend */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Search Volume</h3>
          <div className="h-[280px]">
            {dailyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrends} margin={{ top: 10, right: 10, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Line type="monotone" dataKey="searches" stroke="#ec4899" strokeWidth={2} dot={false} name="Searches" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No search data yet
              </div>
            )}
          </div>
        </div>

        {/* Top Searches */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Top Search Queries</h3>
          <div className="h-[280px]">
            {topSearches.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSearches.slice(0, 5)}
                  layout="vertical"
                  margin={{ top: 5, right: 10, bottom: 5, left: 120 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis
                    type="category"
                    dataKey="query"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    width={115}
                    tickFormatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#ec4899" name="Searches" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No search data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* All Top Searches List */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">All Top Queries</h3>
          <div className="h-[280px] overflow-y-auto space-y-2">
            {topSearches.length > 0 ? (
              topSearches.map((search, index) => (
                <div
                  key={search.query}
                  className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 text-[10px] flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-black dark:text-white truncate max-w-[200px]">
                        {search.query}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                        Last: {formatTimeAgo(search.lastSearched)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                    {search.count}x
                  </span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No search queries yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Searches */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Recent Searches</h3>
          <div className="h-[280px] overflow-y-auto space-y-2">
            {recentSearches.length > 0 ? (
              recentSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full bg-pink-500"
                    />
                    <div>
                      <p className="text-xs font-medium text-black dark:text-white truncate max-w-[180px]">
                        "{search.query}"
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                        {search.deviceType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getSourceColor(search.source)}`}>
                      {getSourceLabel(search.source)}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                      {formatTimeAgo(search.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No recent searches
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchAnalyticsPage;
