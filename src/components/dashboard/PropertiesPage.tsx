import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Property {
  id: number;
  external_id?: string;
  name?: string;
  slug?: string | null;
  developer_id?: number | null;
  area?: string;
  city?: string | null;
  country?: string | null;
  status?: string;
  created_at?: string;
  partner_developers?: {
    name: string;
  };
  [key: string]: any; // Allow any other columns from DB
}

interface FilterOptions {
  areas: string[];
  statuses: string[];
  developers: { id: number; name: string }[];
}

const ITEMS_PER_PAGE = 10;

// Admin-only status for hiding properties from frontend
const HIDDEN_STATUS = 'hidden';

const PropertiesPage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    areas: [],
    statuses: [],
    developers: [],
  });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [developerFilter, setDeveloperFilter] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch filter options once on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch properties when filters or page changes
  useEffect(() => {
    fetchProperties();
  }, [currentPage, searchTerm, statusFilter, areaFilter, developerFilter]);

  const fetchFilterOptions = async () => {
    try {
      // Fetch all filter options in parallel
      const [areasResult, statusesResult, developersResult] = await Promise.all([
        supabase
          .from('properties')
          .select('area')
          .not('area', 'is', null)
          .neq('area', ''),
        supabase
          .from('properties')
          .select('status')
          .not('status', 'is', null)
          .neq('status', ''),
        supabase
          .from('partner_developers')
          .select('id, name')
          .not('name', 'is', null)
          .order('name'),
      ]);

      // Extract unique areas
      const uniqueAreas = Array.from(
        new Set((areasResult.data || []).map(item => item.area).filter(Boolean))
      ).sort();

      // Extract unique statuses
      const uniqueStatuses = Array.from(
        new Set((statusesResult.data || []).map(item => item.status).filter(Boolean))
      ).sort();

      setFilterOptions({
        areas: uniqueAreas as string[],
        statuses: uniqueStatuses as string[],
        developers: developersResult.data || [],
      });
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);

      // Calculate offset
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;

      // Build the query - select all to handle schema differences
      let query = supabase
        .from('properties')
        .select('*, partner_developers(name)', { count: 'exact' });

      // Apply filters
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      if (areaFilter) {
        query = query.eq('area', areaFilter);
      }

      if (developerFilter) {
        query = query.eq('developer_id', parseInt(developerFilter));
      }

      if (searchTerm) {
        // Search across multiple columns
        query = query.or(`name.ilike.%${searchTerm}%,area.ilike.%${searchTerm}%,external_id.ilike.%${searchTerm}%`);
      }

      // Apply ordering and pagination
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

      const { data, count, error } = await query;

      if (error) throw error;

      setProperties(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter, areaFilter, developerFilter]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(debouncedSearch);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);

  const handleFilterChange = (filterType: 'status' | 'area' | 'developer', value: string) => {
    setCurrentPage(1); // Reset to first page when filter changes
    switch (filterType) {
      case 'status':
        setStatusFilter(value);
        break;
      case 'area':
        setAreaFilter(value);
        break;
      case 'developer':
        setDeveloperFilter(value);
        break;
    }
  };

  const clearFilters = () => {
    setDebouncedSearch('');
    setSearchTerm('');
    setStatusFilter('');
    setAreaFilter('');
    setDeveloperFilter('');
    setCurrentPage(1);
  };

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const indexOfFirstItem = (currentPage - 1) * ITEMS_PER_PAGE;
  const indexOfLastItem = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

  const paginate = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Smart pagination with ellipsis
  const getPageNumbers = () => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const hasActiveFilters = searchTerm || statusFilter || areaFilter || developerFilter;

  // Handle status change
  const handleStatusChange = async (propertyId: number, newStatus: string) => {
    try {
      setUpdatingStatus(propertyId);

      const { error } = await supabase
        .from('properties')
        .update({ status: newStatus })
        .eq('id', propertyId);

      if (error) throw error;

      // Update local state
      setProperties(prev =>
        prev.map(p => p.id === propertyId ? { ...p, status: newStatus } : p)
      );

      // Refresh filter options if a new status was added
      if (!filterOptions.statuses.includes(newStatus)) {
        setFilterOptions(prev => ({
          ...prev,
          statuses: [...prev.statuses, newStatus].sort()
        }));
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header with Add Property Button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-500">
            {hasActiveFilters ? `${totalCount} results` : `${totalCount} properties`}
          </p>
        </div>
        <Link
          to="/add-property"
          className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded text-xs font-medium hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap"
        >
          <span className="hidden sm:inline">Add Property</span>
          <span className="sm:hidden">Add</span>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-3 md:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
          {/* Search */}
          <div className="sm:col-span-2">
            <input
              type="text"
              value={debouncedSearch}
              onChange={(e) => setDebouncedSearch(e.target.value)}
              placeholder="Search properties..."
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-400 dark:focus:border-zinc-700"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded text-sm text-black dark:text-white focus:outline-none focus:border-gray-400 dark:focus:border-zinc-700"
            >
              <option value="">All Statuses</option>
              {filterOptions.statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Area Filter */}
          <div>
            <select
              value={areaFilter}
              onChange={(e) => handleFilterChange('area', e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded text-sm text-black dark:text-white focus:outline-none focus:border-gray-400 dark:focus:border-zinc-700"
            >
              <option value="">All Areas</option>
              {filterOptions.areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          {/* Developer Filter */}
          <div>
            <select
              value={developerFilter}
              onChange={(e) => handleFilterChange('developer', e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded text-sm text-black dark:text-white focus:outline-none focus:border-gray-400 dark:focus:border-zinc-700"
            >
              <option value="">All Developers</option>
              {filterOptions.developers.map((developer) => (
                <option key={developer.id} value={developer.id}>
                  {developer.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="mt-3">
            <button
              onClick={clearFilters}
              className="text-xs text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Properties Table */}
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 dark:border-zinc-900">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-zinc-500">ID</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-zinc-500">Property</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-zinc-500">Developer</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-zinc-500">Location</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-zinc-500">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-zinc-500">Created</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 dark:border-zinc-600"></div>
                    </div>
                  </td>
                </tr>
              ) : properties.length > 0 ? (
                properties.map((property) => (
                  <tr 
                    key={property.id} 
                    onClick={() => window.location.href = `/property/${property.slug || property.id}`}
                    className="border-b border-gray-200 dark:border-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono text-gray-500 dark:text-zinc-500">{property.external_id || property.id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-black dark:text-white">{property.name || 'N/A'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600 dark:text-zinc-400">
                        {property.partner_developers?.name || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-zinc-400">{property.area || '-'}</p>
                        {property.country && (
                          <p className="text-xs text-gray-400 dark:text-zinc-600">{property.country}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={property.status || ''}
                        onChange={(e) => handleStatusChange(property.id, e.target.value)}
                        disabled={updatingStatus === property.id}
                        className={`px-2 py-1 text-xs rounded border transition-colors cursor-pointer ${
                          (() => {
                            const s = (property.status || '').toLowerCase();
                            if (s === HIDDEN_STATUS)
                              return 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400';
                            if (s.includes('ready') || s.includes('completed') || s.includes('built') || s.includes('delivered'))
                              return 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400';
                            if (s.includes('off-plan') || s.includes('launch') || s.includes('proposed'))
                              return 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400';
                            if (s.includes('construction') || s.includes('selling'))
                              return 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400';
                            return 'bg-white dark:bg-black border-gray-300 dark:border-zinc-800 text-gray-600 dark:text-zinc-400';
                          })()
                        } focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-600 ${
                          updatingStatus === property.id ? 'opacity-50' : ''
                        }`}
                      >
                        <option value="">Select status</option>
                        {/* Show all actual statuses from database */}
                        {filterOptions.statuses
                          .filter(s => s !== HIDDEN_STATUS)
                          .map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        {/* Always show hidden option */}
                        <option value={HIDDEN_STATUS} className="text-red-600">
                          🚫 {HIDDEN_STATUS} (hide from site)
                        </option>
                        {/* Show current status if not in list */}
                        {property.status &&
                         property.status !== HIDDEN_STATUS &&
                         !filterOptions.statuses.includes(property.status) && (
                          <option value={property.status}>{property.status}</option>
                        )}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-zinc-500">{formatDate(property.created_at || '')}</td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/property/${(property.slug && property.slug.trim() !== '') ? property.slug : property.id}`}
                          className="p-1.5 text-gray-500 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                          title="View details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <p className="text-gray-500 dark:text-zinc-500 text-sm">No properties found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-200 dark:border-zinc-900 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-zinc-500">
                {indexOfFirstItem + 1}–{indexOfLastItem} of {totalCount}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 py-1 text-xs text-gray-400 dark:text-zinc-600">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => paginate(page as number)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        currentPage === page
                          ? 'bg-gray-200 dark:bg-zinc-800 text-black dark:text-white'
                          : 'text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}

                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPage;
