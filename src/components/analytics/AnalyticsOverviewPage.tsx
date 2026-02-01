import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface OverviewStats {
  totalVisitors: number;
  totalSessions: number;
  totalEvents: number;
  totalPropertyViews: number;
  totalSaves: number;
  totalShares: number;
  activeUsersToday: number;
  anonymousVisitors: number;
  loggedInUsers: number;
}

interface DailyTrend {
  date: string;
  views: number;
  clicks: number;
  saves: number;
}

interface TopProperty {
  propertyId: number;
  propertyName: string;
  views: number;
  clicks: number;
  saves: number;
}

interface RecentEvent {
  id: number;
  eventType: string;
  propertyId: number | null;
  createdAt: string;
  deviceType: string;
  isLoggedIn: boolean;
}

const EVENT_COLORS: Record<string, string> = {
  property_card_click: '#3b82f6',
  property_view_details: '#10b981',
  property_map_marker_click: '#f59e0b',
  property_save: '#ef4444',
  property_unsave: '#6b7280',
  property_share: '#8b5cf6',
  page_view: '#6366f1',
  search_query: '#ec4899',
};

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

const BAR_COLORS = ['#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937'];
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
    anonymousVisitors: 0,
    loggedInUsers: 0,
  });
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [topProperties, setTopProperties] = useState<TopProperty[]>([]);
  const [eventDistribution, setEventDistribution] = useState<{ name: string; value: number }[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
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
        recentEventsResult,
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

        // Recent events
        supabase
          .from('user_activity_events')
          .select('id, event_type, property_id, created_at, device_type, user_id')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      // Count logged in vs anonymous
      const loggedInCount = (recentEventsResult.data || []).filter(e => e.user_id).length;
      const anonymousCount = (recentEventsResult.data || []).length - loggedInCount;

      // Process event type distribution
      const eventCounts: Record<string, number> = {};
      (eventTypesResult.data || []).forEach((event: any) => {
        eventCounts[event.event_type] = (eventCounts[event.event_type] || 0) + 1;
      });

      const eventDistributionData = Object.entries(eventCounts)
        .map(([name, value]) => ({ name: EVENT_LABELS[name] || name, value }))
        .sort((a, b) => b.value - a.value);

      // Map recent events
      const mappedEvents = (recentEventsResult.data || []).map((e: any) => ({
        id: e.id,
        eventType: e.event_type,
        propertyId: e.property_id,
        createdAt: e.created_at,
        deviceType: e.device_type || 'unknown',
        isLoggedIn: !!e.user_id,
      }));

      setStats({
        totalVisitors: visitorsResult.count || 0,
        totalSessions: sessionsResult.count || 0,
        totalEvents: eventsResult.count || 0,
        totalPropertyViews: propertyViewsResult.count || 0,
        totalSaves: savesResult.count || 0,
        totalShares: sharesResult.count || 0,
        activeUsersToday: todayActiveResult.count || 0,
        anonymousVisitors: anonymousCount,
        loggedInUsers: loggedInCount,
      });

      setEventDistribution(eventDistributionData);
      setRecentEvents(mappedEvents);

      // Fetch top properties
      await fetchTopProperties(dateFilter);

      // Fetch daily trends
      await fetchDailyTrends(dateFilter);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopProperties = async (dateFilter: string) => {
    try {
      const { data, error } = await supabase
        .from('user_activity_events')
        .select('property_id, event_type')
        .gte('created_at', dateFilter)
        .not('property_id', 'is', null);

      if (error) throw error;

      // Aggregate by property
      const propertyStats: Record<number, { views: number; clicks: number; saves: number }> = {};
      (data || []).forEach((event: any) => {
        if (!propertyStats[event.property_id]) {
          propertyStats[event.property_id] = { views: 0, clicks: 0, saves: 0 };
        }
        if (event.event_type === 'property_view_details') {
          propertyStats[event.property_id].views++;
        }
        if (event.event_type === 'property_card_click') {
          propertyStats[event.property_id].clicks++;
        }
        if (event.event_type === 'property_save') {
          propertyStats[event.property_id].saves++;
        }
      });

      // Get top 5 by total interactions
      const sortedProperties = Object.entries(propertyStats)
        .map(([id, stats]) => ({
          propertyId: parseInt(id),
          propertyName: `Property #${id}`,
          ...stats,
        }))
        .sort((a, b) => (b.views + b.clicks + b.saves) - (a.views + a.clicks + a.saves))
        .slice(0, 5);

      // Fetch property names
      if (sortedProperties.length > 0) {
        const { data: properties } = await supabase
          .from('properties')
          .select('id, name')
          .in('id', sortedProperties.map(p => p.propertyId));

        if (properties) {
          const nameMap: Record<number, string> = {};
          properties.forEach((p: any) => {
            nameMap[p.id] = p.name;
          });
          sortedProperties.forEach(p => {
            p.propertyName = nameMap[p.propertyId] || `Property #${p.propertyId}`;
          });
        }
      }

      setTopProperties(sortedProperties);
    } catch (error) {
      console.error('Error fetching top properties:', error);
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
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eventDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
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
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No event data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Properties */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-black dark:text-white">Top Properties</h3>
            <Link
              to="/analytics/properties"
              className="text-xs text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              View All →
            </Link>
          </div>
          <div className="h-[280px]">
            {topProperties.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProperties}
                  layout="vertical"
                  margin={{ top: 5, right: 10, bottom: 5, left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis
                    type="category"
                    dataKey="propertyName"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    width={95}
                    tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="views" fill="#10b981" name="Views" stackId="a" />
                  <Bar dataKey="clicks" fill="#3b82f6" name="Clicks" stackId="a" />
                  <Bar dataKey="saves" fill="#ef4444" name="Saves" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No property activity yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-black dark:text-white">Recent Activity</h3>
            <Link
              to="/analytics/realtime"
              className="text-xs text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              View Live →
            </Link>
          </div>
          <div className="h-[280px] overflow-y-auto space-y-2">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: EVENT_COLORS[event.eventType] || '#6b7280' }}
                    />
                    <div>
                      <p className="text-xs font-medium text-black dark:text-white">
                        {EVENT_LABELS[event.eventType] || event.eventType}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                        {event.propertyId ? `Property #${event.propertyId}` : 'General'} • {event.deviceType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      event.isLoggedIn
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                    }`}>
                      {event.isLoggedIn ? 'User' : 'Visitor'}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                      {formatTimeAgo(event.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsOverviewPage;
