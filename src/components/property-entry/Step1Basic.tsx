import React, { useState, useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { supabase } from '../../lib/supabase';
import { PartnerDeveloper } from '../../types/database.types';
import { fetchDevelopers } from '../../utils/developerManagement';
import DeveloperForm from '../developer/DeveloperForm';
import { inputClasses, labelClasses, helpTextClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses } from './sharedStyles';

const Step1Basic: React.FC = () => {
  const { formData, updateFormData } = useFormContext();
  const [developers, setDevelopers] = useState<PartnerDeveloper[]>([]);
  const [loadingDevelopers, setLoadingDevelopers] = useState(true);
  const [showDeveloperForm, setShowDeveloperForm] = useState(false);
  const [editingDeveloper, setEditingDeveloper] = useState<PartnerDeveloper | null>(null);

  // Fetch developers on mount
  useEffect(() => {
    loadDevelopers();
  }, []);

  const loadDevelopers = async () => {
    setLoadingDevelopers(true);
    try {
      const { data, error } = await fetchDevelopers(supabase);
      if (error) {
        console.error('Error fetching developers:', error);
      } else {
        setDevelopers(data || []);
      }
    } catch (error) {
      console.error('Error fetching developers:', error);
    } finally {
      setLoadingDevelopers(false);
    }
  };

  const handleDeveloperCreated = (developer: PartnerDeveloper) => {
    // Refresh developers list
    loadDevelopers();
    // Auto-select the newly created developer
    updateFormData({ developer_id: developer.id });
    setShowDeveloperForm(false);
    setEditingDeveloper(null);
  };

  const handleAddDeveloper = () => {
    setEditingDeveloper(null);
    setShowDeveloperForm(true);
  };

  const handleEditDeveloper = (developer: PartnerDeveloper) => {
    setEditingDeveloper(developer);
    setShowDeveloperForm(true);
  };

  const selectedDeveloper = developers.find((d) => d.id === formData.developer_id);

  return (
    <div className="space-y-6">
      <div className={sectionHeaderClasses}>
        <h2 className={sectionTitleClasses}>Project Identity</h2>
        <p className={sectionDescClasses}>Enter basic property information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className={labelClasses}>
            External ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.external_id}
            onChange={(e) => updateFormData({ external_id: e.target.value })}
            className={inputClasses}
            placeholder="e.g., 1007"
            required
          />
          <p className={helpTextClasses}>Unique property identifier</p>
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            Property Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateFormData({ name: e.target.value })}
            className={inputClasses}
            placeholder="e.g., Cello by Taraf"
            required
          />
          <p className={helpTextClasses}>Full property name</p>
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            URL Slug
          </label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => updateFormData({ slug: e.target.value })}
            className={inputClasses}
            placeholder="e.g., cello-by-taraf-jvc"
          />
          <p className={helpTextClasses}>URL-friendly slug (optional)</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={labelClasses}>
              Developer <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleAddDeveloper}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              + Add Developer
            </button>
          </div>
          {loadingDevelopers ? (
            <div className={inputClasses}>
              <span className="text-gray-500 dark:text-zinc-400">Loading developers...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                value={formData.developer_id || ''}
                onChange={(e) => updateFormData({ developer_id: e.target.value ? Number(e.target.value) : null })}
                className={inputClasses}
                required
              >
                <option value="">Select a developer</option>
                {developers.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.name}
                  </option>
                ))}
              </select>
              {selectedDeveloper && (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
                  <span>Selected: {selectedDeveloper.name}</span>
                  {selectedDeveloper.email && <span>• {selectedDeveloper.email}</span>}
                  <button
                    type="button"
                    onClick={() => handleEditDeveloper(selectedDeveloper)}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline ml-auto"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          )}
          <p className={helpTextClasses}>Select an existing developer or add a new one</p>
        </div>
      </div>

      {/* Developer Form Modal */}
      {showDeveloperForm && (
        <DeveloperForm
          supabase={supabase}
          developer={editingDeveloper}
          onSuccess={handleDeveloperCreated}
          onClose={() => {
            setShowDeveloperForm(false);
            setEditingDeveloper(null);
          }}
        />
      )}
    </div>
  );
};

export default Step1Basic;

