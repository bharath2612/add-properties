import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  upcomingCompletions: { name: string; completionDate: string; daysUntil: number; id: number; slug?: string | null }[];
}

const COLORS = ['#71717a', '#52525b', '#3f3f46', '#27272a'];
const BAR_COLORS = ['#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937'];

// Country to flag emoji mapping
const COUNTRY_FLAGS: Record<string, string> = {
  'United Arab Emirates': '🇦🇪',
  'UAE': '🇦🇪',
  'Indonesia': '🇮🇩',
  'Thailand': '🇹🇭',
  'India': '🇮🇳',
  'Unknown': '🏳️',
};

// Get flag for a country name
const getCountryFlag = (countryName: string): string => {
  return COUNTRY_FLAGS[countryName] || '🏳️';
};

// Custom label component for country bars - shows flag on top
const CountryBarLabel = (props: any) => {
  const { x, y, width, payload } = props;
  if (!width || !payload || !payload.name) {
    return <g />;
  }
  
  const countryName = payload.name || '';
  const flag = getCountryFlag(countryName);
  
  // Position label above the bar
  return (
    <g>
      <text
        x={x + (width / 2)}
        y={y - 15}
        fill="#6b7280"
        fontSize={20}
        textAnchor="middle"
        dominantBaseline="hanging"
      >
        {flag}
      </text>
    </g>
  );
};

// Custom label component for developer bars - shows name on top
const DeveloperBarLabel = (props: any) => {
  const { x, y, width, payload } = props;
  if (!width || !payload || !payload.name) {
    return <g />;
  }
  
  const name = payload.name || '';
  // Truncate name if too long
  const displayName = name.length > 18 ? name.substring(0, 15) + '...' : name;
  
  // Position label above the bar
  return (
    <g>
      <text
        x={x + (width / 2)}
        y={y - 15}
        fill="#6b7280"
        fontSize={10}
        fontWeight="500"
        textAnchor="middle"
        dominantBaseline="hanging"
      >
        {displayName}
      </text>
    </g>
  );
};

// Calendar component for upcoming completions
const CalendarView: React.FC<{ completions: { name: string; completionDate: string; daysUntil: number; fullDate: string; id: number; slug?: string | null }[] }> = ({ completions }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCompletions, setSelectedCompletions] = useState<typeof completions>([]);
  const navigate = useNavigate();
  
  const today = new Date();
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  
  // Navigation functions
  const goToPreviousMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };
  
  const goToNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };
  
  // Get first day of displayed month and number of days
  const firstDay = new Date(displayYear, displayMonth, 1);
  const lastDay = new Date(displayYear, displayMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  // Group completions by date
  const completionsByDate: Record<string, typeof completions> = {};
  completions.forEach(completion => {
    const date = new Date(completion.fullDate);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!completionsByDate[dateKey]) {
      completionsByDate[dateKey] = [];
    }
    completionsByDate[dateKey].push(completion);
  });
  
  // Generate calendar days
  const days: Array<{ day: number; date: string; isToday: boolean; isPast: boolean; completions: typeof completions }> = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push({ day: 0, date: '', isToday: false, isPast: false, completions: [] });
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(displayYear, displayMonth, day);
    const dateKey = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = date.toDateString() === today.toDateString();
    const isPast = date < today && !isToday;
    days.push({
      day,
      date: dateKey,
      isToday,
      isPast,
      completions: completionsByDate[dateKey] || []
    });
  }
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  return (
    <div className="w-full flex flex-col">
      <div className="sticky top-0 bg-gray-50 dark:bg-zinc-950 z-10 pb-2 mb-2 flex items-center justify-between border-b border-gray-200 dark:border-zinc-800">
        <button
          onClick={goToPreviousMonth}
          className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-4 h-4 text-gray-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h4 className="text-xs font-semibold text-black dark:text-white">
          {monthNames[displayMonth]} {displayYear}
        </h4>
        <button
          onClick={goToNextMonth}
          className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Next month"
        >
          <svg className="w-4 h-4 text-gray-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
        <div className="grid grid-cols-7 gap-0.5">
          {/* Day headers */}
          {dayNames.map(day => (
            <div key={day} className="text-center text-[10px] font-medium text-gray-500 dark:text-zinc-500 py-1">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {days.map((dayData, index) => {
            if (dayData.day === 0) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }
            
            const urgencyColor = dayData.completions.length > 0
              ? dayData.completions[0].daysUntil < 90
                ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'
                : dayData.completions[0].daysUntil < 180
                ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700'
                : 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
              : '';
            
            return (
              <div
                key={dayData.date}
                className={`aspect-square border rounded p-1 ${
                  dayData.isToday
                    ? 'border-2 border-black dark:border-white bg-gray-100 dark:bg-zinc-800'
                    : dayData.isPast
                    ? 'border-gray-200 dark:border-zinc-800 opacity-50'
                    : 'border-gray-200 dark:border-zinc-800'
                } ${urgencyColor} overflow-y-auto`}
              >
                <div className={`text-[10px] font-medium mb-0.5 ${
                  dayData.isToday
                    ? 'text-black dark:text-white'
                    : dayData.isPast
                    ? 'text-gray-400 dark:text-zinc-600'
                    : 'text-gray-700 dark:text-zinc-300'
                }`}>
                  {dayData.day}
                </div>
                {dayData.completions.length > 0 && (
                  <div className="space-y-0.5">
                    {dayData.completions.slice(0, 2).map((completion, idx) => (
                      <div
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          const propertySlug = completion.slug && completion.slug.trim() !== '' 
                            ? completion.slug 
                            : completion.id;
                          navigate(`/property/${propertySlug}`);
                        }}
                        className={`text-[9px] px-0.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${
                          completion.daysUntil < 90
                            ? 'bg-red-500 text-white'
                            : completion.daysUntil < 180
                            ? 'bg-orange-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}
                        title={completion.name}
                      >
                        {completion.name.length > 10 ? completion.name.substring(0, 10) + '...' : completion.name}
                      </div>
                    ))}
                    {dayData.completions.length > 2 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(dayData.date);
                          setSelectedCompletions(dayData.completions);
                        }}
                        className="text-[9px] text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                      >
                        +{dayData.completions.length - 2} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Legend */}
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-zinc-800 flex flex-wrap items-center gap-3 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-red-500"></div>
          <span className="text-gray-600 dark:text-zinc-400">&lt; 90 days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-orange-500"></div>
          <span className="text-gray-600 dark:text-zinc-400">90-180 days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-blue-500"></div>
          <span className="text-gray-600 dark:text-zinc-400">&gt; 180 days</span>
        </div>
      </div>
      
      {/* Sidebar for showing all properties on a date */}
      {selectedDate && selectedCompletions.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70" onClick={() => setSelectedDate(null)}>
          <div 
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-black dark:text-white">
                Projects Completing on {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {selectedCompletions.map((completion, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    const propertySlug = completion.slug && completion.slug.trim() !== '' 
                      ? completion.slug 
                      : completion.id;
                    navigate(`/property/${propertySlug}`);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    completion.daysUntil < 90
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                      : completion.daysUntil < 180
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-black dark:text-white mb-1">
                        {completion.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-zinc-400">
                        {completion.daysUntil} {completion.daysUntil === 1 ? 'day' : 'days'} until completion
                      </p>
                    </div>
                    <div className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                      completion.daysUntil < 90
                        ? 'bg-red-500 text-white'
                        : completion.daysUntil < 180
                        ? 'bg-orange-500 text-white'
                        : 'bg-blue-500 text-white'
                    }`}>
                      {completion.completionDate}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
    upcomingCompletions: [],
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
        upcomingCompletionsResult,
      ] = await Promise.all([
        // 1. Total count - using id to ensure accurate count
        // Note: If count is inaccurate, check RLS policies in Supabase dashboard
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true }),

        // 2. Under construction count - using id for consistency and efficiency
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Under construction'),

        // 3. Completed count - using id for consistency and efficiency
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Completed'),

        // 4. On Sale count - using id for consistency and efficiency
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'On Sale'),

        // 5. Recent 5 properties with developer name (select all to handle schema differences)
        supabase
          .from('properties')
          .select('*, partner_developers(name)')
          .order('created_at', { ascending: false })
          .limit(5),

        // 6. Upcoming completions - get properties with future completion dates
        supabase
          .from('properties')
          .select('id, name, slug, completion_datetime')
          .not('completion_datetime', 'is', null)
          .gte('completion_datetime', new Date().toISOString())
          .order('completion_datetime', { ascending: true })
          .limit(500), // Increased limit to show completions across multiple months
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


      // Helper function to normalize country names
      const normalizeCountryName = (country: string | null | undefined): string => {
        if (!country || typeof country !== 'string') return 'Unknown';
        
        const trimmed = country.trim();
        if (!trimmed || trimmed.length < 2) return 'Unknown';
        
        // Filter out obvious junk data (very short, random characters, etc.)
        if (trimmed.length < 3 || /^[^a-zA-Z]+$/.test(trimmed)) {
          return 'Unknown';
        }
        
        // Normalize common variations
        const lower = trimmed.toLowerCase();
        
        // Handle UAE variations
        if (lower === 'uae' || lower === 'united arab emirates' || lower === 'united arab emirate') {
          return 'United Arab Emirates';
        }
        
        // Handle other common variations - capitalize first letter of each word
        return trimmed
          .split(/\s+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      };

      // Process upcoming completions
      const now = new Date();
      const upcomingCompletions = (upcomingCompletionsResult.data || [])
        .map((prop: any) => {
          const completionDate = new Date(prop.completion_datetime);
          const daysUntil = Math.ceil((completionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const dateStr = completionDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          return {
            name: prop.name || 'Unknown',
            completionDate: dateStr,
            daysUntil,
            fullDate: completionDate.toISOString(),
            id: prop.id,
            slug: prop.slug || null,
          };
        })
        .sort((a, b) => a.daysUntil - b.daysUntil);

      // Map recent properties with developer names
      const recentProperties = (recentResult.data || []).map((prop: any) => ({
        ...prop,
        developer_name: prop.partner_developers?.name || 'Unknown',
      }));

      // Log count for debugging
      if (totalResult.error) {
        console.error('❌ Error fetching total count:', totalResult.error);
      }
      
      // Get the total count
      let totalCount = totalResult.count ?? 0;
      
      // Process country stats - fetch all properties in pages to avoid Supabase row limits
      const countryCounts: Record<string, number> = {};
      
      // Fetch countries in pages of 1000
      for (let from = 0; from < totalCount; from += 1000) {
        const to = Math.min(from + 999, totalCount - 1);
        const countryPageResult = await supabase
          .from('properties')
          .select('country')
          .range(from, to);
        
        if (countryPageResult.data) {
          countryPageResult.data.forEach((prop: any) => {
            const normalizedCountry = normalizeCountryName(prop.country);
            countryCounts[normalizedCountry] = (countryCounts[normalizedCountry] || 0) + 1;
          });
        }
      }
      
      // Log country stats for debugging
      const totalProcessed = Object.values(countryCounts).reduce((sum, count) => sum + count, 0);
      const sumOfCountryCounts = totalProcessed;
      
      console.log('🌍 Country Stats:');
      console.log(`  Total properties processed: ${totalProcessed}`);
      console.log(`  Expected total (from main query): ${totalCount}`);
      console.log(`  Sum of country counts: ${sumOfCountryCounts}`);
      
      // Warn if we're not getting all the data
      if (totalProcessed < totalCount) {
        console.warn(
          `⚠️ Country stats only processed ${totalProcessed} properties, but total count is ${totalCount}. ` +
          `Missing ${totalCount - totalProcessed} properties. This might be due to Supabase query limits or RLS filtering.`
        );
      }
      
      console.log(`  Unique countries (after normalization): ${Object.keys(countryCounts).length}`);
      const uaeCount = countryCounts['United Arab Emirates'] || 0;
      console.log(`  United Arab Emirates count: ${uaeCount}`);
      if (uaeCount < 1459) {
        console.warn(
          `⚠️ UAE count (${uaeCount}) is lower than expected (1459). ` +
          `This might indicate RLS filtering or data issues.`
        );
      }

      // Convert to array format for bar chart - get top 5 countries only
      // Filter out 'Unknown' from top results if there are real countries
      const countryStats = Object.entries(countryCounts)
        .map(([name, value]) => ({
          name: name || 'Unknown',
          value: value,
        }))
        .filter(item => {
          // Keep Unknown only if it's significant, otherwise prefer real countries
          if (item.name === 'Unknown' && item.value < 50) return false;
          return true;
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      
      // Log top countries
      console.log('  Top countries:', countryStats.slice(0, 5).map(c => `${c.name}: ${c.value}`).join(', '));
      
      // Process developer stats - fetch all properties with developers in pages to avoid Supabase row limits
      const developerCounts: Record<string, number> = {};
      
      // Fetch developers in pages of 1000
      for (let from = 0; from < totalCount; from += 1000) {
        const to = Math.min(from + 999, totalCount - 1);
        const developerPageResult = await supabase
          .from('properties')
          .select('developer_id, partner_developers(name)')
          .not('developer_id', 'is', null)
          .range(from, to);
        
        if (developerPageResult.data) {
          developerPageResult.data.forEach((prop: any) => {
            const devName = prop.partner_developers?.name || 'Unknown';
            developerCounts[devName] = (developerCounts[devName] || 0) + 1;
          });
        }
      }
      
      // Get top 5 developers
      const developerStats = Object.entries(developerCounts)
        .map(([name, count]) => ({
          name: name.length > 30 ? name.substring(0, 30) + '...' : name,
          properties: count,
        }))
        .sort((a, b) => b.properties - a.properties)
        .slice(0, 5);
      
      // Verify count by checking UAE properties specifically
      // This helps identify if RLS is filtering properties
      const uaeCountResult = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('country', 'United Arab Emirates');
      
      // Also try getting count without any filters to verify
      const allPropertiesCount = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true });
      
      // Try a different approach - get a sample to verify access
      const sampleCheck = await supabase
        .from('properties')
        .select('id, country')
        .limit(5);
      
      console.group('🔍 Property Count Diagnostics');
      console.log('Total properties count (query 1):', totalCount);
      console.log('Total properties count (query 2):', allPropertiesCount.count);
      console.log('UAE properties count:', uaeCountResult.count);
      console.log('UAE count error:', uaeCountResult.error);
      console.log('Sample properties accessible:', sampleCheck.data?.length || 0);
      console.log('Sample check error:', sampleCheck.error);
      
      // If UAE count is lower than expected (1459), RLS is definitely filtering
      if (uaeCountResult.count !== null && uaeCountResult.count < 1459) {
        const missing = 1459 - uaeCountResult.count;
        console.error(
          `❌ RLS POLICY ISSUE: Database has 1459 UAE properties, but query returns only ${uaeCountResult.count}. ` +
          `${missing} properties are being filtered by RLS policies.`
        );
        console.error('👉 ACTION REQUIRED: Check Supabase RLS policies for the "properties" table.');
        console.error('👉 Run this SQL in Supabase SQL Editor:');
        console.error(`
CREATE POLICY "Allow public read access to all properties"
ON public.properties
FOR SELECT
TO anon, authenticated
USING (true);
        `);
      } else if (uaeCountResult.count === 1459) {
        console.log('✅ UAE count is correct (1459)');
      }
      
      // If total count is significantly lower than UAE count alone, RLS is filtering
      if (totalCount < (uaeCountResult.count || 0)) {
        console.error(
          `❌ Total count (${totalCount}) is less than UAE count (${uaeCountResult.count}). ` +
          `This indicates RLS policies are filtering properties globally.`
        );
      }
      
      // Check if counts match between queries
      if (totalCount !== allPropertiesCount.count) {
        console.warn(`⚠️ Count mismatch: Query 1 = ${totalCount}, Query 2 = ${allPropertiesCount.count}`);
      }
      
      console.groupEnd();
      
      // Use the higher count if there's a discrepancy
      if (allPropertiesCount.count && allPropertiesCount.count > totalCount) {
        console.warn(`Using higher count: ${allPropertiesCount.count} instead of ${totalCount}`);
        totalCount = allPropertiesCount.count;
      }

      // Verify counts add up correctly (with some tolerance for other statuses)
      const statusCounts = {
        underConstruction: underConstructionResult.count || 0,
        completed: completedResult.count || 0,
        onSale: onSaleResult.count || 0,
      };
      
      const sumOfStatusCounts = statusCounts.underConstruction + statusCounts.completed + statusCounts.onSale;
      const otherStatuses = totalCount - sumOfStatusCounts;
      
      console.log('📊 Count Verification:');
      console.log(`  Total: ${totalCount}`);
      console.log(`  Under Construction: ${statusCounts.underConstruction}`);
      console.log(`  Completed: ${statusCounts.completed}`);
      console.log(`  On Sale: ${statusCounts.onSale}`);
      console.log(`  Other statuses: ${otherStatuses}`);
      console.log(`  Sum check: ${sumOfStatusCounts} + ${otherStatuses} = ${totalCount}`);
      
      // Warn if counts don't add up (might indicate RLS filtering or data issues)
      if (otherStatuses < 0) {
        console.warn(
          `⚠️ Count mismatch: Status counts (${sumOfStatusCounts}) exceed total (${totalCount}). ` +
          `This might indicate RLS filtering or data inconsistencies.`
        );
      }
      
      // Log any errors from status queries
      if (underConstructionResult.error) {
        console.error('❌ Error fetching under construction count:', underConstructionResult.error);
      }
      if (completedResult.error) {
        console.error('❌ Error fetching completed count:', completedResult.error);
      }
      if (onSaleResult.error) {
        console.error('❌ Error fetching on sale count:', onSaleResult.error);
      }

      setAnalytics({
        totalProperties: totalCount,
        underConstruction: statusCounts.underConstruction,
        completed: statusCounts.completed,
        onSale: statusCounts.onSale,
        avgPrice,
        recentProperties,
        developerStats,
        countryStats,
        upcomingCompletions,
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
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4 flex flex-col">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Status Distribution</h3>
          <div className="h-[280px] lg:h-[320px] w-full">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
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
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Country Distribution */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4 flex flex-col">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Top 5 Countries by Properties</h3>
          <div className="h-[280px] lg:h-[320px] w-full">
            {analytics.countryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={analytics.countryStats.map(c => ({ name: c.name, properties: c.value }))} 
                  margin={{ top: 50, right: 10, bottom: 5, left: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" />
                  <XAxis 
                    type="category"
                    dataKey="name"
                    hide={true}
                  />
                  <YAxis 
                    type="number"
                    stroke="#6b7280"
                    style={{ fontSize: '11px' }}
                    tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [
                      `${value} properties`,
                      props.payload.name
                    ]}
                    labelFormatter={(label) => ''}
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
                    radius={[4, 4, 0, 0]}
                    label={CountryBarLabel}
                  >
                    {analytics.countryStats.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No country data available
              </div>
            )}
          </div>
        </div>

        {/* Developers Chart */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4 flex flex-col">
          <h3 className="text-sm font-medium text-black dark:text-white mb-4">Top 5 Developers by Properties</h3>
          <div className="h-[280px] lg:h-[320px] w-full">
            {analytics.developerStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.developerStats} margin={{ top: 50, right: 10, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" />
                  <XAxis 
                    type="category"
                    dataKey="name"
                    hide={true}
                  />
                  <YAxis 
                    type="number"
                    stroke="#6b7280"
                    style={{ fontSize: '11px' }}
                    tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [
                      `${value} properties`,
                      props.payload.name
                    ]}
                    labelFormatter={(label) => ''}
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
                    radius={[4, 4, 0, 0]}
                    label={DeveloperBarLabel}
                  >
                    {analytics.developerStats.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No developer data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Completions Calendar */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-black dark:text-white">Upcoming Project Completions</h3>
          <Link
            to="/properties"
            className="text-xs text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
          >
            View All →
          </Link>
        </div>
        {analytics.upcomingCompletions.length > 0 ? (
          <div className="max-h-[520px] overflow-y-auto">
            <CalendarView completions={analytics.upcomingCompletions} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-60 text-gray-500 dark:text-zinc-500 text-sm">
            No upcoming completions found
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;

