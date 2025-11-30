import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Property {
  id: number;
  external_id: string;
  name: string;
  slug: string | null;
  developer: string | null;
  developer_id: number | null;
  area: string;
  city: string | null;
  country: string | null;
  status: string;
  min_price: number;
  max_price: number;
  price_currency: string;
  created_at: string;
  partner_developers?: {
    name: string;
  };
}

const PropertiesPage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [developerFilter, setDeveloperFilter] = useState('');
  const [uniqueAreas, setUniqueAreas] = useState<string[]>([]);
  const [uniqueStatuses, setUniqueStatuses] = useState<string[]>([]);
  const [uniqueDevelopers, setUniqueDevelopers] = useState<string[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    filterProperties();
  }, [searchTerm, statusFilter, areaFilter, developerFilter, properties]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      
      // Fetch unique areas, statuses, and developers FIRST using SQL
      const { data: areasData } = await supabase
        .from('properties')
        .select('area')
        .not('area', 'is', null)
        .order('area');
      
      const { data: statusesData } = await supabase
        .from('properties')
        .select('status')
        .not('status', 'is', null)
        .order('status');
      
      // Fetch developers from partner_developers table
      const { data: developersData } = await supabase
        .from('partner_developers')
        .select('name')
        .not('name', 'is', null)
        .order('name');
      
      // Extract unique values
      const uniqueAreasFromDB = Array.from(
        new Set(
          (areasData || [])
            .map(item => item.area)
            .filter(area => area && area.trim() !== '')
        )
      ).sort();
      
      const uniqueStatusesFromDB = Array.from(
        new Set(
          (statusesData || [])
            .map(item => item.status)
            .filter(status => status && status.trim() !== '')
        )
      ).sort();
      
      const uniqueDevelopersFromDB = Array.from(
        new Set(
          (developersData || [])
            .map(item => item.name)
            .filter(dev => dev && dev.trim() !== '')
        )
      ).sort();
      
      // Set filters IMMEDIATELY
      setUniqueAreas(uniqueAreasFromDB);
      setUniqueStatuses(uniqueStatusesFromDB);
      setUniqueDevelopers(uniqueDevelopersFromDB);
      
      // NOW fetch all properties for the table
      let allProperties: Property[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('properties')
          .select('*, partner_developers(name)')
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allProperties = [...allProperties, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setProperties(allProperties);
      setFilteredProperties(allProperties);
      
      console.log('=== PROPERTIES LOADED ===');
      console.log('Total properties:', allProperties.length);
      console.log('========================');
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProperties = () => {
    let filtered = [...properties];

    if (searchTerm) {
      filtered = filtered.filter(
        (prop) =>
          prop.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          prop.developer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          prop.area?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          prop.external_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((prop) => prop.status === statusFilter);
    }

    if (areaFilter) {
      filtered = filtered.filter((prop) => prop.area === areaFilter);
    }

    if (developerFilter) {
      filtered = filtered.filter((prop) => 
        prop.partner_developers?.name === developerFilter
      );
    }

    setFilteredProperties(filtered);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setAreaFilter('');
    setDeveloperFilter('');
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProperties.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Smart pagination with ellipsis
  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 dark:border-zinc-600"></div>
      </div>
    );
  }


  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header with Add Property Button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-500">
            {filteredProperties.length} of {properties.length} properties
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search properties..."
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-400 dark:focus:border-zinc-700"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded text-sm text-black dark:text-white focus:outline-none focus:border-gray-400 dark:focus:border-zinc-700"
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map((status) => (
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
              onChange={(e) => setAreaFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded text-sm text-black dark:text-white focus:outline-none focus:border-gray-400 dark:focus:border-zinc-700"
            >
              <option value="">All Areas</option>
              {uniqueAreas.map((area) => (
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
              onChange={(e) => setDeveloperFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded text-sm text-black dark:text-white focus:outline-none focus:border-gray-400 dark:focus:border-zinc-700"
            >
              <option value="">All Developers</option>
              {uniqueDevelopers.map((developer) => (
                <option key={developer} value={developer}>
                  {developer}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {(searchTerm || statusFilter || areaFilter || developerFilter) && (
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
              {currentItems.length > 0 ? (
                currentItems.map((property) => (
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
                        {property.partner_developers?.name || property.developer || '-'}
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
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-zinc-800 text-gray-600 dark:text-zinc-400">
                        {property.status || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-zinc-500">{formatDate(property.created_at)}</td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/property/${property.slug || property.id}`}
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
                {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, filteredProperties.length)} of {filteredProperties.length}
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
