import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import FunnelChart, { FunnelStep } from './funnels/FunnelChart';
import AnalyticsTabs from './AnalyticsTabs';

interface DeepResearchStats {
  totalReports: number;
  totalPdfDownloads: number;
  authBlockRate: number;
  completionRate: number;
}

interface DailyTrend {
  date: string;
  reports: number;
  downloads: number;
}

interface PurposeData {
  name: string;
  value: number;
}

interface TopProperty {
  propertyName: string;
  researchCount: number;
  downloadCount: number;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const DeepResearchAnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<DeepResearchStats>({
    totalReports: 0,
    totalPdfDownloads: 0,
    authBlockRate: 0,
    completionRate: 0,
  });
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [purposeDistribution, setPurposeDistribution] = useState<PurposeData[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [topProperties, setTopProperties] = useState<TopProperty[]>([]);
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
        reportsResult,
        pdfDownloadsResult,
        authBlockedResult,
        openedResult,
        reportViewedResult,
        questionnaireEventsResult,
        pdfEventsResult,
      ] = await Promise.all([
        // Total reports generated
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'deep_research_questionnaire_submitted')
          .gte('created_at', dateFilter),

        // Total PDF downloads
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'deep_research_pdf_downloaded')
          .gte('created_at', dateFilter),

        // Auth blocked
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'deep_research_auth_blocked')
          .gte('created_at', dateFilter),

        // Opened
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'deep_research_opened')
          .gte('created_at', dateFilter),

        // Report viewed (for funnel)
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'deep_research_report_viewed')
          .gte('created_at', dateFilter),

        // Questionnaire events with metadata for purpose + daily trends
        supabase
          .from('user_activity_events')
          .select('created_at, metadata')
          .eq('event_type', 'deep_research_questionnaire_submitted')
          .gte('created_at', dateFilter),

        // PDF download events for daily trends + property aggregation
        supabase
          .from('user_activity_events')
          .select('created_at, metadata')
          .eq('event_type', 'deep_research_pdf_downloaded')
          .gte('created_at', dateFilter),
      ]);

      const totalReports = reportsResult.count || 0;
      const totalPdfDownloads = pdfDownloadsResult.count || 0;
      const authBlocked = authBlockedResult.count || 0;
      const opened = openedResult.count || 0;
      const reportViewed = reportViewedResult.count || 0;

      const authBlockRate = opened > 0 ? (authBlocked / opened) * 100 : 0;
      const completionRate = totalReports > 0 ? (totalPdfDownloads / totalReports) * 100 : 0;

      setStats({
        totalReports,
        totalPdfDownloads,
        authBlockRate,
        completionRate,
      });

      // Funnel data
      setFunnelData([
        { name: 'Opened', value: opened, color: '#6366f1' },
        { name: 'Questionnaire Submitted', value: totalReports, color: '#ec4899' },
        { name: 'Report Viewed', value: reportViewed, color: '#10b981' },
        { name: 'PDF Downloaded', value: totalPdfDownloads, color: '#3b82f6' },
      ]);
      setFunnelLoading(false);

      // Process daily trends
      const dailyData: Record<string, { reports: number; downloads: number }> = {};
      (questionnaireEventsResult.data || []).forEach((event: any) => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { reports: 0, downloads: 0 };
        }
        dailyData[date].reports++;
      });
      (pdfEventsResult.data || []).forEach((event: any) => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { reports: 0, downloads: 0 };
        }
        dailyData[date].downloads++;
      });

      const trends = Object.entries(dailyData)
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ...data,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setDailyTrends(trends);

      // Process purpose distribution from questionnaire metadata
      const purposeCounts: Record<string, number> = {};
      (questionnaireEventsResult.data || []).forEach((event: any) => {
        const purpose = event.metadata?.purpose || 'Unknown';
        purposeCounts[purpose] = (purposeCounts[purpose] || 0) + 1;
      });

      const purposeData = Object.entries(purposeCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      setPurposeDistribution(purposeData);

      // Process top researched properties
      const propertyResearch: Record<string, { researchCount: number; downloadCount: number }> = {};

      (questionnaireEventsResult.data || []).forEach((event: any) => {
        const propertyName = event.metadata?.propertyName || event.metadata?.property_name || 'Unknown Property';
        if (!propertyResearch[propertyName]) {
          propertyResearch[propertyName] = { researchCount: 0, downloadCount: 0 };
        }
        propertyResearch[propertyName].researchCount++;
      });

      (pdfEventsResult.data || []).forEach((event: any) => {
        const propertyName = event.metadata?.propertyName || event.metadata?.property_name || 'Unknown Property';
        if (!propertyResearch[propertyName]) {
          propertyResearch[propertyName] = { researchCount: 0, downloadCount: 0 };
        }
        propertyResearch[propertyName].downloadCount++;
      });

      const topProps = Object.entries(propertyResearch)
        .map(([propertyName, data]) => ({ propertyName, ...data }))
        .sort((a, b) => b.researchCount - a.researchCount)
        .slice(0, 20);

      setTopProperties(topProps);
    } catch (error) {
      console.error('Error fetching deep research analytics:', error);
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
          <h1 className="text-lg font-medium text-black dark:text-white">Deep Research Analytics</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-500">Research report generation and engagement metrics</p>
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
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Total Reports Generated</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.totalReports}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Total PDF Downloads</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.totalPdfDownloads}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Auth Block Rate</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.authBlockRate.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Completion Rate</p>
          <p className="text-2xl font-medium text-green-600 dark:text-green-400">{stats.completionRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Deep Research Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelChart
          title="Deep Research Funnel"
          data={funnelData}
          loading={funnelLoading}
        />

        {/* Questionnaire Preferences */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Questionnaire Preferences (Purpose)</h3>
          <div className="h-[280px]">
            {purposeDistribution.length > 0 ? (
              <div className="flex items-center h-full gap-4">
                {/* Donut chart */}
                <div className="flex-shrink-0 w-[180px] h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={purposeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="none"
                      >
                        {purposeDistribution.map((_entry, index) => (
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
                  {purposeDistribution.map((entry, index) => {
                    const total = purposeDistribution.reduce((s, e) => s + e.value, 0);
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
                No questionnaire data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily Trend */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <h3 className="text-sm font-medium text-black dark:text-white mb-4">Daily Trend</h3>
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
                <Line type="monotone" dataKey="reports" stroke="#6366f1" strokeWidth={2} dot={false} name="Reports Generated" />
                <Line type="monotone" dataKey="downloads" stroke="#10b981" strokeWidth={2} dot={false} name="PDFs Downloaded" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
              No trend data yet
            </div>
          )}
        </div>
      </div>

      {/* Top Researched Properties Table */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
          <h3 className="text-sm font-medium text-black dark:text-white">Top Researched Properties</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-900">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-zinc-500 px-4 py-3">Property</th>
                <th className="text-center text-xs font-medium text-gray-500 dark:text-zinc-500 px-3 py-3">Research Count</th>
                <th className="text-center text-xs font-medium text-gray-500 dark:text-zinc-500 px-3 py-3">Download Count</th>
              </tr>
            </thead>
            <tbody>
              {topProperties.length > 0 ? (
                topProperties.map((property, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-black dark:text-white truncate max-w-[300px]">
                        {property.propertyName}
                      </p>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{property.researchCount}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">{property.downloadCount}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500 dark:text-zinc-500 text-sm">
                    No research data available
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

export default DeepResearchAnalyticsPage;
