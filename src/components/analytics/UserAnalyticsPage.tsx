import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface UserStats {
  totalVisitors: number;
  totalLoggedInUsers: number;
  newVisitorsToday: number;
  returningVisitors: number;
  avgSessionDuration: number;
  avgPagesPerSession: number;
}

interface VisitorData {
  id: string;
  fingerprintHash: string;
  firstSeen: string;
  lastSeen: string;
  platform: string;
  browser: string;
  linkedUserId: string | null;
  sessionCount: number;
  totalEvents: number;
}

interface DeviceStats {
  name: string;
  value: number;
}

const COLORS = ['#71717a', '#52525b', '#3f3f46', '#27272a', '#18181b'];
const DEVICE_COLORS = {
  desktop: '#3b82f6',
  mobile: '#10b981',
  tablet: '#f59e0b',
};

const UserAnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<UserStats>({
    totalVisitors: 0,
    totalLoggedInUsers: 0,
    newVisitorsToday: 0,
    returningVisitors: 0,
    avgSessionDuration: 0,
    avgPagesPerSession: 0,
  });
  const [visitors, setVisitors] = useState<VisitorData[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStats[]>([]);
  const [browserStats, setBrowserStats] = useState<DeviceStats[]>([]);
  const [dailyVisitors, setDailyVisitors] = useState<{ date: string; new: number; returning: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'all'>('30days');

  useEffect(() => {
    fetchUserAnalytics();
  }, [dateRange]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case '7days':
        return new Date(now.setDate(now.getDate() - 7)).toISOString();
      case '30days':
        return new Date(now.setDate(now.getDate() - 30)).toISOString();
      case 'all':
        return null;
    }
  };

  const fetchUserAnalytics = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Fetch all data in parallel
      const [
        visitorsResult,
        loggedInUsersResult,
        newTodayResult,
        sessionsResult,
        eventsResult,
        fingerprintsResult,
      ] = await Promise.all([
        // Total unique visitors
        supabase
          .from('visitor_fingerprints')
          .select('id', { count: 'exact', head: true }),

        // Logged in users (visitors with linked user)
        supabase
          .from('visitor_fingerprints')
          .select('id', { count: 'exact', head: true })
          .not('linked_user_id', 'is', null),

        // New visitors today
        supabase
          .from('visitor_fingerprints')
          .select('id', { count: 'exact', head: true })
          .gte('first_seen_at', todayStart.toISOString()),

        // Sessions for duration calculation
        supabase
          .from('user_sessions')
          .select('started_at, ended_at, page_views')
          .not('ended_at', 'is', null)
          .limit(1000),

        // Events for device stats
        supabase
          .from('user_activity_events')
          .select('device_type, browser')
          .limit(5000),

        // Recent visitors with details
        supabase
          .from('visitor_fingerprints')
          .select('id, fingerprint_hash, first_seen_at, last_seen_at, platform, language, linked_user_id')
          .order('last_seen_at', { ascending: false })
          .limit(50),
      ]);

      // Calculate average session duration
      let totalDuration = 0;
      let totalPages = 0;
      let sessionCount = 0;
      (sessionsResult.data || []).forEach((session: any) => {
        if (session.ended_at && session.started_at) {
          const duration = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime();
          totalDuration += duration / 1000; // in seconds
          totalPages += session.page_views || 0;
          sessionCount++;
        }
      });

      const avgSessionDuration = sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0;
      const avgPagesPerSession = sessionCount > 0 ? Math.round((totalPages / sessionCount) * 10) / 10 : 0;

      // Calculate device stats
      const deviceCounts: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0 };
      const browserCounts: Record<string, number> = {};
      (eventsResult.data || []).forEach((event: any) => {
        if (event.device_type) {
          deviceCounts[event.device_type] = (deviceCounts[event.device_type] || 0) + 1;
        }
        if (event.browser) {
          browserCounts[event.browser] = (browserCounts[event.browser] || 0) + 1;
        }
      });

      const deviceData = Object.entries(deviceCounts)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

      const browserData = Object.entries(browserCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Map visitors
      const visitorsData: VisitorData[] = (fingerprintsResult.data || []).map((v: any) => ({
        id: v.id,
        fingerprintHash: v.fingerprint_hash?.substring(0, 8) + '...' || 'Unknown',
        firstSeen: v.first_seen_at,
        lastSeen: v.last_seen_at,
        platform: v.platform || 'Unknown',
        browser: v.language || 'Unknown',
        linkedUserId: v.linked_user_id,
        sessionCount: 0, // Would need to join with sessions
        totalEvents: 0, // Would need to join with events
      }));

      // Calculate returning visitors
      const totalVisitors = visitorsResult.count || 0;
      const newToday = newTodayResult.count || 0;
      const returning = totalVisitors - newToday;

      setStats({
        totalVisitors,
        totalLoggedInUsers: loggedInUsersResult.count || 0,
        newVisitorsToday: newToday,
        returningVisitors: returning > 0 ? returning : 0,
        avgSessionDuration,
        avgPagesPerSession,
      });

      setDeviceStats(deviceData);
      setBrowserStats(browserData);
      setVisitors(visitorsData);

      // Fetch daily visitor trends
      await fetchDailyVisitors(dateFilter);
    } catch (error) {
      console.error('Error fetching user analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyVisitors = async (dateFilter: string | null) => {
    try {
      let query = supabase
        .from('visitor_fingerprints')
        .select('first_seen_at, last_seen_at');

      if (dateFilter) {
        query = query.gte('last_seen_at', dateFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aggregate by day
      const dailyData: Record<string, { new: number; returning: number }> = {};
      (data || []).forEach((visitor: any) => {
        const lastSeenDate = new Date(visitor.last_seen_at).toISOString().split('T')[0];
        const firstSeenDate = new Date(visitor.first_seen_at).toISOString().split('T')[0];

        if (!dailyData[lastSeenDate]) {
          dailyData[lastSeenDate] = { new: 0, returning: 0 };
        }

        if (firstSeenDate === lastSeenDate) {
          dailyData[lastSeenDate].new++;
        } else {
          dailyData[lastSeenDate].returning++;
        }
      });

      const trends = Object.entries(dailyData)
        .map(([date, stats]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ...stats,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-14); // Last 14 data points

      setDailyVisitors(trends);
    } catch (error) {
      console.error('Error fetching daily visitors:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-black dark:text-white">User Analytics</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-500">Visitor behavior and user engagement</p>
        </div>
        <div className="flex gap-2">
          {(['7days', '30days', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                dateRange === range
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800'
              }`}
            >
              {range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : 'All Time'}
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
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Logged In Users</p>
          <p className="text-2xl font-medium text-green-600 dark:text-green-400">{stats.totalLoggedInUsers}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">New Today</p>
          <p className="text-2xl font-medium text-blue-600 dark:text-blue-400">{stats.newVisitorsToday}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Returning</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.returningVisitors}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Avg Session</p>
          <p className="text-2xl font-medium text-black dark:text-white">{formatDuration(stats.avgSessionDuration)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Pages/Session</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.avgPagesPerSession}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Visitors */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Visitor Trends</h3>
          <div className="h-[280px]">
            {dailyVisitors.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyVisitors} margin={{ top: 10, right: 10, bottom: 5, left: 5 }}>
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
                  <Bar dataKey="new" fill="#3b82f6" name="New Visitors" stackId="a" />
                  <Bar dataKey="returning" fill="#10b981" name="Returning" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No visitor data yet
              </div>
            )}
          </div>
        </div>

        {/* Device Distribution */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Device Distribution</h3>
          <div className="h-[280px]">
            {deviceStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {deviceStats.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={DEVICE_COLORS[entry.name.toLowerCase() as keyof typeof DEVICE_COLORS] || COLORS[index % COLORS.length]}
                      />
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
                No device data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Browser Stats & Recent Visitors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Browser Stats */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Top Browsers</h3>
          <div className="h-[280px]">
            {browserStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={browserStats} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    width={75}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="value" fill="#6b7280" name="Sessions" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No browser data yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Visitors */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Recent Visitors</h3>
          <div className="h-[280px] overflow-y-auto space-y-2">
            {visitors.length > 0 ? (
              visitors.map((visitor) => (
                <div
                  key={visitor.id}
                  className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      visitor.linkedUserId
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                    }`}>
                      {visitor.linkedUserId ? 'U' : 'V'}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-black dark:text-white">
                        {visitor.fingerprintHash}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                        {visitor.platform} • First seen {formatTimeAgo(visitor.firstSeen)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600">
                      Last active
                    </p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">
                      {formatTimeAgo(visitor.lastSeen)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No visitor data yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAnalyticsPage;
