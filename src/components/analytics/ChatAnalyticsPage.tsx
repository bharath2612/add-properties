import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import FunnelChart, { FunnelStep } from './funnels/FunnelChart';
import AnalyticsTabs from './AnalyticsTabs';

interface ChatStats {
  totalMessagesSent: number;
  avgResponseTime: number;
  suggestedQueryClickRate: number;
  errorRate: number;
}

interface DailyVolume {
  date: string;
  messages: number;
}

interface DailyResponseTime {
  date: string;
  avgMs: number;
}

interface SuggestedQuery {
  query: string;
  clickCount: number;
}

const ChatAnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<ChatStats>({
    totalMessagesSent: 0,
    avgResponseTime: 0,
    suggestedQueryClickRate: 0,
    errorRate: 0,
  });
  const [dailyVolume, setDailyVolume] = useState<DailyVolume[]>([]);
  const [dailyResponseTime, setDailyResponseTime] = useState<DailyResponseTime[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [popularQueries, setPopularQueries] = useState<SuggestedQuery[]>([]);
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
    setFunnelLoading(true);
    try {
      const dateFilter = getDateFilter();

      // Fetch all KPI data in parallel
      const [
        messagesSentResult,
        responsesResult,
        sourceClickedResult,
        suggestedClickedResult,
        errorsResult,
        responseEventsResult,
        messageSentEventsResult,
        suggestedClickEventsResult,
      ] = await Promise.all([
        // Total messages sent
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'chat_message_sent')
          .gte('created_at', dateFilter),

        // Total responses received
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'chat_response_received')
          .gte('created_at', dateFilter),

        // Source clicked
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'chat_source_clicked')
          .gte('created_at', dateFilter),

        // Suggested query clicked
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'chat_suggested_query_clicked')
          .gte('created_at', dateFilter),

        // Stream errors
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'chat_stream_error')
          .gte('created_at', dateFilter),

        // Response events with metadata for response time
        supabase
          .from('user_activity_events')
          .select('created_at, metadata')
          .eq('event_type', 'chat_response_received')
          .gte('created_at', dateFilter),

        // Message sent events for daily volume
        supabase
          .from('user_activity_events')
          .select('created_at')
          .eq('event_type', 'chat_message_sent')
          .gte('created_at', dateFilter),

        // Suggested query click events with metadata
        supabase
          .from('user_activity_events')
          .select('metadata')
          .eq('event_type', 'chat_suggested_query_clicked')
          .gte('created_at', dateFilter),
      ]);

      const totalMessages = messagesSentResult.count || 0;
      const totalResponses = responsesResult.count || 0;
      const totalSourceClicked = sourceClickedResult.count || 0;
      const totalSuggestedClicked = suggestedClickedResult.count || 0;
      const totalErrors = errorsResult.count || 0;

      // Calculate avg response time from metadata
      const responseTimes: number[] = [];
      (responseEventsResult.data || []).forEach((event: any) => {
        const responseTimeMs = event.metadata?.responseTimeMs;
        if (typeof responseTimeMs === 'number' && responseTimeMs > 0) {
          responseTimes.push(responseTimeMs);
        }
      });
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

      const suggestedQueryClickRate = totalResponses > 0 ? (totalSuggestedClicked / totalResponses) * 100 : 0;
      const errorRate = totalMessages > 0 ? (totalErrors / totalMessages) * 100 : 0;

      setStats({
        totalMessagesSent: totalMessages,
        avgResponseTime,
        suggestedQueryClickRate,
        errorRate,
      });

      // Funnel data
      setFunnelData([
        { name: 'Message Sent', value: totalMessages, color: '#6366f1' },
        { name: 'Response Received', value: totalResponses, color: '#ec4899' },
        { name: 'Source Clicked', value: totalSourceClicked, color: '#10b981' },
        { name: 'Suggested Query Clicked', value: totalSuggestedClicked, color: '#3b82f6' },
      ]);
      setFunnelLoading(false);

      // Process daily message volume
      const dailyMessages: Record<string, number> = {};
      (messageSentEventsResult.data || []).forEach((event: any) => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        dailyMessages[date] = (dailyMessages[date] || 0) + 1;
      });

      const volumeData = Object.entries(dailyMessages)
        .map(([date, messages]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          messages,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setDailyVolume(volumeData);

      // Process daily average response time
      const dailyResponseTimes: Record<string, number[]> = {};
      (responseEventsResult.data || []).forEach((event: any) => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        const responseTimeMs = event.metadata?.responseTimeMs;
        if (typeof responseTimeMs === 'number' && responseTimeMs > 0) {
          if (!dailyResponseTimes[date]) {
            dailyResponseTimes[date] = [];
          }
          dailyResponseTimes[date].push(responseTimeMs);
        }
      });

      const responseTimeData = Object.entries(dailyResponseTimes)
        .map(([date, times]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setDailyResponseTime(responseTimeData);

      // Process popular suggested queries
      const queryCounts: Record<string, number> = {};
      (suggestedClickEventsResult.data || []).forEach((event: any) => {
        const query = event.metadata?.query || event.metadata?.suggestedQuery || 'Unknown';
        queryCounts[query] = (queryCounts[query] || 0) + 1;
      });

      const queryData = Object.entries(queryCounts)
        .map(([query, clickCount]) => ({ query, clickCount }))
        .sort((a, b) => b.clickCount - a.clickCount)
        .slice(0, 20);

      setPopularQueries(queryData);
    } catch (error) {
      console.error('Error fetching chat analytics:', error);
    } finally {
      setLoading(false);
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
          <h1 className="text-lg font-medium text-black dark:text-white">Chat Analytics</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-500">Chat engagement and performance metrics</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Total Messages Sent</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.totalMessagesSent}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Avg Response Time</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.avgResponseTime > 0 ? `${(stats.avgResponseTime / 1000).toFixed(1)}s` : 'N/A'}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Suggested Query Click Rate</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.suggestedQueryClickRate.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Error Rate</p>
          <p className={`text-2xl font-medium ${stats.errorRate > 5 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{stats.errorRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Chat Engagement Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
        <FunnelChart
          title="Chat Engagement Funnel"
          data={funnelData}
          loading={funnelLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Message Volume */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Daily Message Volume</h3>
          <div className="h-[280px]">
            {dailyVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyVolume} margin={{ top: 10, right: 10, bottom: 5, left: 5 }}>
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
                  <Bar dataKey="messages" fill="#6366f1" name="Messages" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No message data yet
              </div>
            )}
          </div>
        </div>

        {/* Response Time Distribution */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Response Time Distribution (Daily Avg)</h3>
          <div className="h-[280px]">
            {dailyResponseTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyResponseTime} margin={{ top: 10, right: 10, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(value) => `${(value / 1000).toFixed(1)}s`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${(value / 1000).toFixed(2)}s`, 'Avg Response Time']}
                  />
                  <Line type="monotone" dataKey="avgMs" stroke="#ec4899" strokeWidth={2} dot={false} name="Avg Response Time" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No response time data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Popular Suggested Queries Table */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
          <h3 className="text-sm font-medium text-black dark:text-white">Popular Suggested Queries</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-900">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-zinc-500 px-4 py-3">#</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-zinc-500 px-4 py-3">Query</th>
                <th className="text-center text-xs font-medium text-gray-500 dark:text-zinc-500 px-3 py-3">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {popularQueries.length > 0 ? (
                popularQueries.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400 dark:text-zinc-600">{index + 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-black dark:text-white truncate max-w-[400px]">
                        {item.query}
                      </p>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{item.clickCount}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500 dark:text-zinc-500 text-sm">
                    No suggested query data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ChatAnalyticsPage;
