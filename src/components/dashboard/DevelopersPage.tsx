import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PartnerDeveloper } from '../../types/database.types';
import { fetchDevelopers, deleteDeveloper } from '../../utils/developerManagement';
import DeveloperForm from '../developer/DeveloperForm';
import { useToast, ToastContainer } from '../common/Toast';

const DevelopersPage: React.FC = () => {
  const { success, error, toasts, removeToast } = useToast();
  const [developers, setDevelopers] = useState<PartnerDeveloper[]>([]);
  const [filteredDevelopers, setFilteredDevelopers] = useState<PartnerDeveloper[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDeveloper, setEditingDeveloper] = useState<PartnerDeveloper | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDevelopers();
  }, []);

  const loadDevelopers = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await fetchDevelopers(supabase);
      if (fetchError) {
        error(`Failed to load developers: ${fetchError.message}`, 5000);
      } else {
        setDevelopers(data || []);
        setFilteredDevelopers(data || []);
      }
    } catch (err: any) {
      error(`Error loading developers: ${err.message}`, 5000);
    } finally {
      setLoading(false);
    }
  };

  // Filter developers based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDevelopers(developers);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = developers.filter((developer) => {
      const nameMatch = developer.name?.toLowerCase().includes(query);
      const emailMatch = developer.email?.toLowerCase().includes(query);
      const websiteMatch = developer.website?.toLowerCase().includes(query);
      const descriptionMatch = developer.description?.toLowerCase().includes(query);
      const addressMatch = developer.office_address?.toLowerCase().includes(query);
      
      return nameMatch || emailMatch || websiteMatch || descriptionMatch || addressMatch;
    });

    setFilteredDevelopers(filtered);
  }, [searchQuery, developers]);

  const handleDeveloperSaved = (_developer: PartnerDeveloper) => {
    loadDevelopers();
    setShowForm(false);
    setEditingDeveloper(null);
  };

  const handleAddNew = () => {
    setEditingDeveloper(null);
    setShowForm(true);
  };

  const handleEdit = (developer: PartnerDeveloper) => {
    setEditingDeveloper(developer);
    setShowForm(true);
  };

  const handleDelete = async (developer: PartnerDeveloper) => {
    if (!confirm(`Are you sure you want to delete "${developer.name}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(developer.id);
    try {
      const result = await deleteDeveloper(supabase, developer.id);
      if (result.success) {
        success(`Developer "${developer.name}" deleted successfully`, 3000);
        loadDevelopers();
      } else {
        error(result.error || 'Failed to delete developer', 5000);
      }
    } catch (error: any) {
      error(error.message || 'An unexpected error occurred', 5000);
    } finally {
      setDeletingId(null);
    }
  };

  const formatWorkingHours = (workingHours: any): string => {
    if (!workingHours) return 'Not specified';
    if (typeof workingHours === 'string') return workingHours;
    if (typeof workingHours === 'object') {
      // Try to format as readable text
      if (Array.isArray(workingHours)) {
        return workingHours.join(', ');
      }
      return JSON.stringify(workingHours);
    }
    return String(workingHours);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">Developers</h1>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Manage property developers and builders
            </p>
          </div>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Developer
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400 dark:text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
            placeholder="Search developers by name, email, website, description..."
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Search Results Count */}
        {searchQuery && (
          <div className="text-sm text-gray-600 dark:text-zinc-400">
            Found {filteredDevelopers.length} developer{filteredDevelopers.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Developers List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
        </div>
      ) : filteredDevelopers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-zinc-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {searchQuery ? 'No developers found' : 'No developers'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {searchQuery
              ? 'Try adjusting your search query.'
              : 'Get started by creating a new developer.'}
          </p>
          <div className="mt-6">
            <button
              onClick={handleAddNew}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-zinc-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Developer
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevelopers.map((developer) => (
            <div
              key={developer.id}
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-black dark:text-white">
                    {developer.name}
                  </h3>
                  {developer.logo_url && (
                    <img
                      src={developer.logo_url}
                      alt={developer.name}
                      className="mt-2 h-12 w-auto object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(developer)}
                    className="p-1.5 text-gray-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                    title="Edit developer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(developer)}
                    disabled={deletingId === developer.id}
                    className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                    title="Delete developer"
                  >
                    {deletingId === developer.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {developer.description && (
                  <p className="text-gray-600 dark:text-zinc-400 line-clamp-2">
                    {developer.description}
                  </p>
                )}

                <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-zinc-800">
                  {developer.email && (
                    <div className="flex items-center gap-2 text-gray-700 dark:text-zinc-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="truncate">{developer.email}</span>
                    </div>
                  )}

                  {developer.website && (
                    <div className="flex items-center gap-2 text-gray-700 dark:text-zinc-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                        />
                      </svg>
                      <a
                        href={developer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {developer.website}
                      </a>
                    </div>
                  )}

                  {developer.office_address && (
                    <div className="flex items-start gap-2 text-gray-700 dark:text-zinc-300">
                      <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="truncate">{developer.office_address}</span>
                    </div>
                  )}

                  {developer.working_hours && (
                    <div className="flex items-start gap-2 text-gray-700 dark:text-zinc-300">
                      <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="truncate">{formatWorkingHours(developer.working_hours)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Developer Form Modal */}
      {showForm && (
        <DeveloperForm
          supabase={supabase}
          developer={editingDeveloper}
          onSuccess={handleDeveloperSaved}
          onClose={() => {
            setShowForm(false);
            setEditingDeveloper(null);
          }}
        />
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default DevelopersPage;

