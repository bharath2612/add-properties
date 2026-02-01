import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface PropertyStats {
  id: number;
  name: string;
  slug: string | null;
  totalViews: number;
  cardClicks: number;
  detailViews: number;
  mapClicks: number;
  saves: number;
  shares: number;
  uniqueVisitors: number;
  avgViewDuration: number;
}

const BAR_COLORS = ['#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937'];

const PropertyAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'views' | 'saves' | 'clicks'>('views');
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'all'>('30days');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPropertyAnalytics();
  }, [dateRange, sortBy]);

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

  const fetchPropertyAnalytics = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();

      // Build query for events
      let eventsQuery = supabase
        .from('user_activity_events')
        .select('property_id, event_type, visitor_fingerprint_id, duration_seconds')
        .not('property_id', 'is', null);

      if (dateFilter) {
        eventsQuery = eventsQuery.gte('created_at', dateFilter);
      }

      const { data: events, error } = await eventsQuery;

      if (error) throw error;

      // Aggregate by property
      const propertyStats: Record<number, {
        totalViews: number;
        cardClicks: number;
        detailViews: number;
        mapClicks: number;
        saves: number;
        shares: number;
        visitors: Set<string>;
        viewDurations: number[];
      }> = {};

      (events || []).forEach((event: any) => {
        if (!propertyStats[event.property_id]) {
          propertyStats[event.property_id] = {
            totalViews: 0,
            cardClicks: 0,
            detailViews: 0,
            mapClicks: 0,
            saves: 0,
            shares: 0,
            visitors: new Set(),
            viewDurations: [],
          };
        }

        const stats = propertyStats[event.property_id];

        if (event.visitor_fingerprint_id) {
          stats.visitors.add(event.visitor_fingerprint_id);
        }

        switch (event.event_type) {
          case 'property_card_click':
            stats.cardClicks++;
            stats.totalViews++;
            break;
          case 'property_view_details':
            stats.detailViews++;
            stats.totalViews++;
            break;
          case 'property_map_marker_click':
            stats.mapClicks++;
            stats.totalViews++;
            break;
          case 'property_save':
            stats.saves++;
            break;
          case 'property_share':
            stats.shares++;
            break;
          case 'property_detail_view_end':
            if (event.duration_seconds) {
              stats.viewDurations.push(event.duration_seconds);
            }
            break;
        }
      });

      // Get property IDs
      const propertyIds = Object.keys(propertyStats).map(Number);

      if (propertyIds.length === 0) {
        setProperties([]);
        setLoading(false);
        return;
      }

      // Fetch property names
      const { data: propertiesData } = await supabase
        .from('properties')
        .select('id, name, slug')
        .in('id', propertyIds);

      const nameMap: Record<number, { name: string; slug: string | null }> = {};
      (propertiesData || []).forEach((p: any) => {
        nameMap[p.id] = { name: p.name, slug: p.slug };
      });

      // Build final array
      const propertyList: PropertyStats[] = propertyIds.map((id) => {
        const stats = propertyStats[id];
        const avgDuration = stats.viewDurations.length > 0
          ? stats.viewDurations.reduce((a, b) => a + b, 0) / stats.viewDurations.length
          : 0;

        return {
          id,
          name: nameMap[id]?.name || `Property #${id}`,
          slug: nameMap[id]?.slug || null,
          totalViews: stats.totalViews,
          cardClicks: stats.cardClicks,
          detailViews: stats.detailViews,
          mapClicks: stats.mapClicks,
          saves: stats.saves,
          shares: stats.shares,
          uniqueVisitors: stats.visitors.size,
          avgViewDuration: Math.round(avgDuration),
        };
      });

      // Sort
      propertyList.sort((a, b) => {
        switch (sortBy) {
          case 'views':
            return b.totalViews - a.totalViews;
          case 'saves':
            return b.saves - a.saves;
          case 'clicks':
            return b.cardClicks - a.cardClicks;
          default:
            return b.totalViews - a.totalViews;
        }
      });

      setProperties(propertyList);
    } catch (error) {
      console.error('Error fetching property analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = properties.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const topProperties = filteredProperties.slice(0, 10);

  const exportToCSV = () => {
    const headers = ['Property Name', 'Total Views', 'Card Clicks', 'Detail Views', 'Map Clicks', 'Saves', 'Shares', 'Unique Visitors', 'Avg View Duration (s)'];
    const rows = filteredProperties.map((p) => [
      p.name,
      p.totalViews,
      p.cardClicks,
      p.detailViews,
      p.mapClicks,
      p.saves,
      p.shares,
      p.uniqueVisitors,
      p.avgViewDuration,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
          <h1 className="text-lg font-medium text-black dark:text-white">Property Analytics</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-500">Track engagement metrics per property</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 rounded hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search properties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-700 text-black dark:text-white"
        />
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 text-sm bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded focus:outline-none text-black dark:text-white"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded focus:outline-none text-black dark:text-white"
          >
            <option value="views">Sort by Views</option>
            <option value="saves">Sort by Saves</option>
            <option value="clicks">Sort by Clicks</option>
          </select>
        </div>
      </div>

      {/* Top Properties Chart */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <h3 className="text-sm font-medium text-black dark:text-white mb-4">Top 10 Properties by Engagement</h3>
        <div className="h-[350px]">
          {topProperties.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topProperties}
                layout="vertical"
                margin={{ top: 5, right: 30, bottom: 5, left: 120 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  width={115}
                  tickFormatter={(value) => value.length > 18 ? value.substring(0, 18) + '...' : value}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="cardClicks" fill="#3b82f6" name="Card Clicks" stackId="a" />
                <Bar dataKey="detailViews" fill="#10b981" name="Detail Views" stackId="a" />
                <Bar dataKey="mapClicks" fill="#f59e0b" name="Map Clicks" stackId="a" />
                <Bar dataKey="saves" fill="#ef4444" name="Saves" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
              No property data available
            </div>
          )}
        </div>
      </div>

      {/* Properties Table */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-900">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-zinc-500 px-4 py-3">Property</th>
                <th className="text-center text-xs font-medium text-gray-500 dark:text-zinc-500 px-3 py-3">Views</th>
                <th className="text-center text-xs font-medium text-gray-500 dark:text-zinc-500 px-3 py-3">Card</th>
                <th className="text-center text-xs font-medium text-gray-500 dark:text-zinc-500 px-3 py-3">Details</th>
                <th className="text-center text-xs font-medium text-gray-500 dark:text-zinc-500 px-3 py-3">Map</th>
                <th className="text-center text-xs font-medium text-gray-500 dark:text-zinc-500 px-3 py-3">Saves</th>
                <th className="text-center text-xs font-medium text-gray-500 dark:text-zinc-500 px-3 py-3">Shares</th>
                <th className="text-center text-xs font-medium text-gray-500 dark:text-zinc-500 px-3 py-3">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {filteredProperties.length > 0 ? (
                filteredProperties.slice(0, 50).map((property) => (
                  <tr
                    key={property.id}
                    onClick={() => navigate(`/property/${property.slug || property.id}`)}
                    className="border-b border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-900 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-black dark:text-white truncate max-w-[200px]">
                        {property.name}
                      </p>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm font-medium text-black dark:text-white">{property.totalViews}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-blue-600 dark:text-blue-400">{property.cardClicks}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-green-600 dark:text-green-400">{property.detailViews}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-amber-600 dark:text-amber-400">{property.mapClicks}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-red-600 dark:text-red-400">{property.saves}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-purple-600 dark:text-purple-400">{property.shares}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-gray-600 dark:text-zinc-400">{property.uniqueVisitors}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500 dark:text-zinc-500 text-sm">
                    No properties with activity data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredProperties.length > 50 && (
          <div className="px-4 py-2 text-center text-xs text-gray-500 dark:text-zinc-500 border-t border-gray-200 dark:border-zinc-800">
            Showing 50 of {filteredProperties.length} properties
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyAnalyticsPage;
