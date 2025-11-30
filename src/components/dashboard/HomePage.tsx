import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Analytics {
  totalProperties: number;
  underConstruction: number;
  completed: number;
  onSale: number;
  avgPrice: number;
  recentProperties: any[];
  allProperties: any[];
}

const COLORS = ['#71717a', '#52525b', '#3f3f46', '#27272a'];

// Incremental grey shades from light to dark for bar chart
const BAR_COLORS = ['#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937'];

const HomePage: React.FC = () => {
  const [analytics, setAnalytics] = useState<Analytics>({
    totalProperties: 0,
    underConstruction: 0,
    completed: 0,
    onSale: 0,
    avgPrice: 0,
    recentProperties: [],
    allProperties: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch all developers first
      const { data: developersData, error: developersError } = await supabase
        .from('partner_developers')
        .select('id, name');

      if (developersError) throw developersError;

      const developersMap = new Map<number, string>();
      if (developersData) {
        developersData.forEach(dev => {
          developersMap.set(dev.id, dev.name);
        });
      }

      // Fetch all properties - same batch logic as PropertiesPage
      let allProperties: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          // Map properties with developer names
          const propertiesWithDeveloperNames = data.map(prop => ({
            ...prop,
            developer_name: prop.developer_id ? developersMap.get(prop.developer_id) || 'Unknown' : 'Unknown',
          }));
          allProperties = [...allProperties, ...propertiesWithDeveloperNames];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      if (allProperties.length > 0) {
        const total = allProperties.length;
        const underConstruction = allProperties.filter(p => p.status === 'Under construction').length;
        const completed = allProperties.filter(p => p.status === 'Completed').length;
        const onSale = allProperties.filter(p => p.status === 'On Sale').length;
        
        const pricesWithMin = allProperties.filter(p => p.min_price);
        const avgPrice = pricesWithMin.length > 0
          ? pricesWithMin.reduce((sum, p) => sum + (p.min_price || 0), 0) / pricesWithMin.length
          : 0;

        setAnalytics({
          totalProperties: total,
          underConstruction,
          completed,
          onSale,
          avgPrice: Math.round(avgPrice),
          recentProperties: allProperties.slice(0, 5),
          allProperties: allProperties,
        });
      }
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

  // Developer chart data - count properties by developer from ALL properties
  const developerData = React.useMemo(() => {
    const developerCounts = analytics.allProperties.reduce((acc: any, property) => {
      const dev = property.developer_name || 'Unknown';
      acc[dev] = (acc[dev] || 0) + 1;
      return acc;
    }, {});

    // Get top 5 developers by property count
    return Object.entries(developerCounts)
      .map(([name, count]) => ({ 
        name: name.length > 30 ? name.substring(0, 30) + '...' : name, 
        properties: count 
      }))
      .sort((a: any, b: any) => b.properties - a.properties)
      .slice(0, 5);
  }, [analytics.allProperties]);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
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
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-gray-500 dark:text-zinc-500 text-sm">
              No data available
            </div>
          )}
        </div>

        {/* Developers Chart */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Top 5 Developers by Properties</h3>
          {developerData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={developerData} layout="vertical" margin={{ left: 10 }}>
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
                  {developerData.map((_entry, index) => (
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
