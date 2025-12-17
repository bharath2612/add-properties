import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Analytics {
  totalProperties: number;
  underConstruction: number;
  completed: number;
  onSale: number;
  avgPrice: number;
  recentProperties: any[];
  developerStats: { name: string; properties: number }[];
  countryStats: { name: string; value: number }[];
}

const COLORS = ['#71717a', '#52525b', '#3f3f46', '#27272a'];
const BAR_COLORS = ['#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937'];

const HomePage: React.FC = () => {
  const location = useLocation();
  const [analytics, setAnalytics] = useState<Analytics>({
    totalProperties: 0,
    underConstruction: 0,
    completed: 0,
    onSale: 0,
    avgPrice: 0,
    recentProperties: [],
    developerStats: [],
    countryStats: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always fetch when on home route
    if (location.pathname === '/') {
      fetchAnalytics();
    }
  }, [location.pathname]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Run all queries in parallel for maximum speed
      const [
        totalResult,
        underConstructionResult,
        completedResult,
        onSaleResult,
        recentResult,
        developerStatsResult,
        countryStatsResult,
      ] = await Promise.all([
        // 1. Total count
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true }),

        // 2. Under construction count
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Under construction'),

        // 3. Completed count
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Completed'),

        // 4. On Sale count
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'On Sale'),

        // 5. Recent 5 properties with developer name (select all to handle schema differences)
        supabase
          .from('properties')
          .select('*, partner_developers(name)')
          .order('created_at', { ascending: false })
          .limit(5),

        // 6. Developer stats - get property counts grouped by developer
        supabase
          .from('properties')
          .select('developer_id, partner_developers(name)')
          .not('developer_id', 'is', null),

        // 7. Country stats - get all properties with country field
        supabase
          .from('properties')
          .select('country'),
      ]);

      // Calculate average price from recent properties if they have price data
      let avgPrice = 0;
      if (recentResult.data && recentResult.data.length > 0) {
        const pricesWithMin = recentResult.data.filter((p: any) => p.min_price && p.min_price > 0);
        if (pricesWithMin.length > 0) {
          const sum = pricesWithMin.reduce((acc: number, p: any) => acc + (p.min_price || 0), 0);
          avgPrice = Math.round(sum / pricesWithMin.length);
        }
      }

      // Process developer stats - count properties per developer
      const developerCounts: Record<string, number> = {};
      if (developerStatsResult.data) {
        developerStatsResult.data.forEach((prop: any) => {
          const devName = prop.partner_developers?.name || 'Unknown';
          developerCounts[devName] = (developerCounts[devName] || 0) + 1;
        });
      }

      // Get top 5 developers
      const developerStats = Object.entries(developerCounts)
        .map(([name, count]) => ({
          name: name.length > 30 ? name.substring(0, 30) + '...' : name,
          properties: count,
        }))
        .sort((a, b) => b.properties - a.properties)
        .slice(0, 5);

      // Process country stats - count properties per country
      const countryCounts: Record<string, number> = {};
      if (countryStatsResult.data) {
        countryStatsResult.data.forEach((prop: any) => {
          const country = prop.country || 'Unknown';
          countryCounts[country] = (countryCounts[country] || 0) + 1;
        });
      }

      // Convert to array format for bar chart - get top 10 countries
      const countryStats = Object.entries(countryCounts)
        .map(([name, value]) => ({
          name: name || 'Unknown',
          value: value,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // Map recent properties with developer names
      const recentProperties = (recentResult.data || []).map((prop: any) => ({
        ...prop,
        developer_name: prop.partner_developers?.name || 'Unknown',
      }));

      setAnalytics({
        totalProperties: totalResult.count || 0,
        underConstruction: underConstructionResult.count || 0,
        completed: completedResult.count || 0,
        onSale: onSaleResult.count || 0,
        avgPrice,
        recentProperties,
        developerStats,
        countryStats,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusData = [
    { name: 'Under Construction', value: analytics.underConstruction },
    { name: 'Completed', value: analytics.completed },
    { name: 'On Sale', value: analytics.onSale },
    { name: 'Others', value: analytics.totalProperties - analytics.underConstruction - analytics.completed - analytics.onSale },
  ].filter(item => item.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 dark:border-zinc-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Total Properties</p>
          <p className="text-2xl font-medium text-black dark:text-white">{analytics.totalProperties}</p>
        </div>

        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Under Construction</p>
          <p className="text-2xl font-medium text-black dark:text-white">{analytics.underConstruction}</p>
        </div>

        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Completed</p>
          <p className="text-2xl font-medium text-black dark:text-white">{analytics.completed}</p>
        </div>

        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Avg. Price</p>
          <p className="text-2xl font-medium text-black dark:text-white">
            {analytics.avgPrice > 0 ? `${(analytics.avgPrice / 1000000).toFixed(1)}M` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Status Distribution */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Status Distribution</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((_entry, index) => (
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
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-gray-500 dark:text-zinc-500 text-sm">
              No data available
            </div>
          )}
        </div>

        {/* Country Distribution */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Top 10 Countries by Properties</h3>
          {analytics.countryStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart 
                data={analytics.countryStats.map(c => ({ name: c.name, properties: c.value }))} 
                layout="vertical" 
                margin={{ left: 10, right: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" />
                <XAxis 
                  type="number"
                  stroke="#6b7280"
                  style={{ fontSize: '11px' }}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name"
                  width={100}
                  stroke="#6b7280"
                  style={{ fontSize: '11px' }}
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value} properties`, 'Count']}
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#000'
                  }}
                  labelStyle={{ color: '#000', fontWeight: '500' }}
                  cursor={false}
                />
                <Bar 
                  dataKey="properties" 
                  name="Properties"
                  radius={[0, 4, 4, 0]}
                >
                  {analytics.countryStats.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-gray-500 dark:text-zinc-500 text-sm">
              No country data available
            </div>
          )}
        </div>

        {/* Developers Chart */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Top 5 Developers by Properties</h3>
          {analytics.developerStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analytics.developerStats} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" />
                <XAxis 
                  type="number"
                  stroke="#6b7280"
                  style={{ fontSize: '11px' }}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name"
                  width={140}
                  stroke="#6b7280"
                  style={{ fontSize: '11px' }}
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value} properties`, 'Count']}
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#000'
                  }}
                  labelStyle={{ color: '#000', fontWeight: '500' }}
                  cursor={false}
                />
                <Bar 
                  dataKey="properties" 
                  name="Properties"
                  radius={[0, 4, 4, 0]}
                >
                  {analytics.developerStats.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-gray-500 dark:text-zinc-500 text-sm">
              No developer data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Properties */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-black dark:text-white">Recent Properties</h3>
          <Link
            to="/properties"
            className="text-xs text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
          >
            View All →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-900">
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 dark:text-zinc-500">Property</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 dark:text-zinc-500">Location</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 dark:text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentProperties.length > 0 ? (
                analytics.recentProperties.map((property) => (
                  <tr key={property.id} className="border-b border-gray-200 dark:border-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-900/50">
                    <td className="py-3 px-3">
                      <div>
                        <p className="text-sm text-black dark:text-white">{property.name || 'N/A'}</p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500">{property.developer_name || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-600 dark:text-zinc-400">{property.area || 'N/A'}</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-zinc-800 text-gray-600 dark:text-zinc-400">
                        {property.status || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500 dark:text-zinc-500 text-sm">
                    No properties found
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

export default HomePage;

