import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import FunnelChart, { FunnelStep } from './funnels/FunnelChart';
import JourneyExplorer from './journey/JourneyExplorer';
import AnalyticsTabs from './AnalyticsTabs';

interface OverviewStats {
  totalVisitors: number;
  totalSessions: number;
  totalEvents: number;
  totalPropertyViews: number;
  totalSaves: number;
  totalShares: number;
  activeUsersToday: number;
}

interface DailyTrend {
  date: string;
  views: number;
  clicks: number;
  saves: number;
}

// FunnelStep is now imported from ./funnels/FunnelChart

const EVENT_LABELS: Record<string, string> = {
  property_card_click: 'Card Click',
  property_view_details: 'View Details',
  property_map_marker_click: 'Map Click',
  property_save: 'Save',
  property_unsave: 'Unsave',
  property_share: 'Share',
  page_view: 'Page View',
  search_query: 'Search',
};

const COLORS = ['#71717a', '#52525b', '#3f3f46', '#27272a', '#18181b'];

const AnalyticsOverviewPage: React.FC = () => {
  const [stats, setStats] = useState<OverviewStats>({
    totalVisitors: 0,
    totalSessions: 0,
    totalEvents: 0,
    totalPropertyViews: 0,
    totalSaves: 0,
    totalShares: 0,
    activeUsersToday: 0,
  });
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [eventDistribution, setEventDistribution] = useState<{ name: string; value: number }[]>([]);
  const [fullConversionFunnel, setFullConversionFunnel] = useState<FunnelStep[]>([]);
  const [authFunnel, setAuthFunnel] = useState<FunnelStep[]>([]);
  const [funnelLoading, setFunnelLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days'>('7days');

  useEffect(() => {
    fetchAnalytics();
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

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();

      // Fetch all data in parallel
      const [
        visitorsResult,
        sessionsResult,
        eventsResult,
        propertyViewsResult,
        savesResult,
        sharesResult,
        todayActiveResult,
        eventTypesResult,
      ] = await Promise.all([
        // Total unique visitors
        supabase
          .from('visitor_fingerprints')
          .select('id', { count: 'exact', head: true }),

        // Total sessions
        supabase
          .from('user_sessions')
          .select('id', { count: 'exact', head: true })
          .gte('started_at', dateFilter),

        // Total events
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dateFilter),

        // Property views (card clicks + view details)
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dateFilter)
          .in('event_type', ['property_card_click', 'property_view_details']),

        // Saves
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dateFilter)
          .eq('event_type', 'property_save'),

        // Shares
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dateFilter)
          .eq('event_type', 'property_share'),

        // Active users today
        supabase
          .from('user_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .gte('last_activity_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

        // Event type distribution
        supabase
          .from('user_activity_events')
          .select('event_type')
          .gte('created_at', dateFilter),
      ]);

      // Process event type distribution
      const eventCounts: Record<string, number> = {};
      (eventTypesResult.data || []).forEach((event: any) => {
        eventCounts[event.event_type] = (eventCounts[event.event_type] || 0) + 1;
      });

      const eventDistributionData = Object.entries(eventCounts)
        .map(([name, value]) => ({ name: EVENT_LABELS[name] || name, value }))
        .sort((a, b) => b.value - a.value);

      setStats({
        totalVisitors: visitorsResult.count || 0,
        totalSessions: sessionsResult.count || 0,
        totalEvents: eventsResult.count || 0,
        totalPropertyViews: propertyViewsResult.count || 0,
        totalSaves: savesResult.count || 0,
        totalShares: sharesResult.count || 0,
        activeUsersToday: todayActiveResult.count || 0,
      });

      setEventDistribution(eventDistributionData);

      // Fetch daily trends and funnel data
      await Promise.all([
        fetchDailyTrends(dateFilter),
        fetchFunnels(dateFilter),
      ]);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyTrends = async (dateFilter: string) => {
    try {
      const { data, error } = await supabase
        .from('user_activity_events')
        .select('created_at, event_type')
        .gte('created_at', dateFilter)
        .in('event_type', ['property_view_details', 'property_card_click', 'property_save']);

      if (error) throw error;

      // Aggregate by day
      const dailyData: Record<string, { views: number; clicks: number; saves: number }> = {};
      (data || []).forEach((event: any) => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { views: 0, clicks: 0, saves: 0 };
        }
        if (event.event_type === 'property_view_details') {
          dailyData[date].views++;
        }
        if (event.event_type === 'property_card_click') {
          dailyData[date].clicks++;
        }
        if (event.event_type === 'property_save') {
          dailyData[date].saves++;
        }
      });

      const trends = Object.entries(dailyData)
        .map(([date, stats]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ...stats,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setDailyTrends(trends);
    } catch (error) {
      console.error('Error fetching daily trends:', error);
    }
  };

  const fetchFunnels = async (dateFilter: string) => {
    setFunnelLoading(true);
    try {
      // Fetch funnels in parallel
      await Promise.all([
        fetchFullConversionFunnelData(dateFilter),
        fetchAuthFunnelData(dateFilter),
      ]);
    } catch (error) {
      console.error('Error fetching funnels:', error);
    } finally {
      setFunnelLoading(false);
    }
  };

  const fetchFullConversionFunnelData = async (dateFilter: string) => {
    try {
      // 1. Total visitors in period
      const { count: totalVisitors } = await supabase
        .from('visitor_fingerprints')
        .select('id', { count: 'exact', head: true })
        .gte('last_seen_at', dateFilter);

      // 2. Visitors who searched (deduplicated)
      const { data: searchVisitors } = await supabase
        .from('user_activity_events')
        .select('visitor_fingerprint_id')
        .eq('event_type', 'search_query')
        .gte('created_at', dateFilter)
        .not('visitor_fingerprint_id', 'is', null);
      const searchedCount = new Set(searchVisitors?.map((e) => e.visitor_fingerprint_id)).size;

      // 3. Visitors who signed up (have linked_user_id)
      const { count: signedUp } = await supabase
        .from('visitor_fingerprints')
        .select('id', { count: 'exact', head: true })
        .gte('last_seen_at', dateFilter)
        .not('linked_user_id', 'is', null);

      // 4. Visitors who viewed property details (deduplicated)
      const { data: viewVisitors } = await supabase
        .from('user_activity_events')
        .select('visitor_fingerprint_id')
        .eq('event_type', 'property_view_details')
        .gte('created_at', dateFilter)
        .not('visitor_fingerprint_id', 'is', null);
      const viewedCount = new Set(viewVisitors?.map((e) => e.visitor_fingerprint_id)).size;

      // 5. Visitors who saved (deduplicated)
      const { data: saveVisitors } = await supabase
        .from('user_activity_events')
        .select('visitor_fingerprint_id')
        .eq('event_type', 'property_save')
        .gte('created_at', dateFilter)
        .not('visitor_fingerprint_id', 'is', null);
      const savedCount = new Set(saveVisitors?.map((e) => e.visitor_fingerprint_id)).size;

      setFullConversionFunnel([
        { name: 'All Visitors', value: totalVisitors || 0, color: '#6366f1' },
        { name: 'Searched', value: searchedCount, color: '#ec4899' },
        { name: 'Signed Up', value: signedUp || 0, color: '#10b981' },
        { name: 'Viewed Property', value: viewedCount, color: '#3b82f6' },
        { name: 'Saved', value: savedCount, color: '#ef4444' },
      ]);
    } catch (error) {
      console.error('Error fetching full conversion funnel:', error);
    }
  };

  const fetchAuthFunnelData = async (dateFilter: string) => {
    try {
      // All visitors
      const { count: allVisitors } = await supabase
        .from('visitor_fingerprints')
        .select('id', { count: 'exact', head: true })
        .gte('last_seen_at', dateFilter);

      // Authenticated visitors
      const { count: authenticatedUsers } = await supabase
        .from('visitor_fingerprints')
        .select('id', { count: 'exact', head: true })
        .gte('last_seen_at', dateFilter)
        .not('linked_user_id', 'is', null);

      setAuthFunnel([
        { name: 'Anonymous Visitors', value: allVisitors || 0, color: '#6b7280' },
        { name: 'Authenticated Users', value: authenticatedUsers || 0, color: '#10b981' },
      ]);
    } catch (error) {
      console.error('Error fetching auth funnel:', error);
    }
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
      {/* Header with Date Range */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-black dark:text-white">Analytics Overview</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-500">User activity and engagement metrics</p>
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

      <AnalyticsTabs />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Total Visitors</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.totalVisitors}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Sessions</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.totalSessions}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Property Views</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.totalPropertyViews}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Saves</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.totalSaves}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Shares</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.totalShares}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Active Today</p>
          <p className="text-2xl font-medium text-green-600 dark:text-green-400">{stats.activeUsersToday}</p>
        </div>
      </div>

      {/* Conversion Funnels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelChart
          title="Full Conversion Funnel"
          data={fullConversionFunnel}
          loading={funnelLoading}
        />
        <FunnelChart
          title="Auth Journey"
          data={authFunnel}
          loading={funnelLoading}
        />
      </div>

      {/* Journey Explorer */}
      <JourneyExplorer dateFilter={getDateFilter()} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Trends */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Activity Trends</h3>
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
                  <Line type="monotone" dataKey="views" stroke="#10b981" strokeWidth={2} dot={false} name="Views" />
                  <Line type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2} dot={false} name="Clicks" />
                  <Line type="monotone" dataKey="saves" stroke="#ef4444" strokeWidth={2} dot={false} name="Saves" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No activity data yet
              </div>
            )}
          </div>
        </div>

        {/* Event Distribution */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Event Distribution</h3>
          <div className="h-[280px]">
            {eventDistribution.length > 0 ? (
              <div className="flex items-center h-full gap-4">
                {/* Donut chart */}
                <div className="flex-shrink-0 w-[180px] h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={eventDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="none"
                      >
                        {eventDistribution.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#fff',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex-1 min-w-0 space-y-1.5 overflow-y-auto max-h-[260px]">
                  {eventDistribution.map((entry, index) => {
                    const total = eventDistribution.reduce((s, e) => s + e.value, 0);
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : '0';
                    return (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-xs text-gray-700 dark:text-zinc-300 truncate flex-1">
                          {entry.name}
                        </span>
                        <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 tabular-nums flex-shrink-0">
                          {pct}%
                        </span>
                        <span className="text-xs font-bold text-black dark:text-white tabular-nums flex-shrink-0 w-8 text-right">
                          {entry.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No event data yet
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default AnalyticsOverviewPage;
