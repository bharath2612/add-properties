import React, { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { PartnerDeveloper } from '../../types/database.types';
import { DeveloperFormData, createDeveloper, updateDeveloper } from '../../utils/developerManagement';
import { inputClasses, labelClasses, helpTextClasses, cardClasses } from '../property-entry/sharedStyles';
import FileUpload from '../property-entry/FileUpload';
import { useToast } from '../common/Toast';

interface DeveloperFormProps {
  supabase: SupabaseClient;
  developer?: PartnerDeveloper | null; // If provided, edit mode; otherwise, create mode
  onSuccess: (developer: PartnerDeveloper) => void;
  onClose: () => void;
}

const DeveloperForm: React.FC<DeveloperFormProps> = ({
  supabase,
  developer,
  onSuccess,
  onClose,
}) => {
  const { success, error } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<DeveloperFormData>({
    name: '',
    email: null,
    office_address: null,
    website: null,
    logo_url: null,
    description: null,
    working_hours: null,
  });

  useEffect(() => {
    if (developer) {
      // Edit mode - populate form with existing data
      // Convert working_hours from JSONB to string for editing
      let workingHoursString = '';
      if (developer.working_hours) {
        if (typeof developer.working_hours === 'string') {
          workingHoursString = developer.working_hours;
        } else {
          workingHoursString = JSON.stringify(developer.working_hours, null, 2);
        }
      }

      setFormData({
        name: developer.name || '',
        email: developer.email || null,
        office_address: developer.office_address || null,
        website: developer.website || null,
        logo_url: developer.logo_url || null,
        description: developer.description || null,
        working_hours: workingHoursString || null,
      });
    }
  }, [developer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let result;
      if (developer) {
        // Update existing developer
        result = await updateDeveloper(supabase, developer.id, formData);
      } else {
        // Create new developer
        result = await createDeveloper(supabase, formData);
      }

      if (result.success && result.developer) {
        success(
          developer
            ? `Developer "${result.developer.name}" updated successfully!`
            : `Developer "${result.developer.name}" created successfully!`,
          3000
        );
        onSuccess(result.developer);
        onClose();
      } else {
        error(result.error || 'Failed to save developer', 5000);
      }
    } catch (err: any) {
      error(err.message || 'An unexpected error occurred', 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof DeveloperFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-black dark:text-white">
            {developer ? 'Edit Developer' : 'Add New Developer'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Required Fields */}
            <div className={cardClasses}>
              <h3 className="text-base font-semibold text-black dark:text-white mb-4">
                Basic Information
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={labelClasses}>
                    Developer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className={inputClasses}
                    placeholder="e.g., Emaar Developers"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className={cardClasses}>
              <h3 className="text-base font-semibold text-black dark:text-white mb-4">
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelClasses}>Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => updateField('email', e.target.value || null)}
                    className={inputClasses}
                    placeholder="contact@developer.com"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className={labelClasses}>Office Address</label>
                  <input
                    type="text"
                    value={formData.office_address || ''}
                    onChange={(e) => updateField('office_address', e.target.value || null)}
                    className={inputClasses}
                    placeholder="Office address"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className={labelClasses}>Website</label>
                  <input
                    type="url"
                    value={formData.website || ''}
                    onChange={(e) => updateField('website', e.target.value || null)}
                    className={inputClasses}
                    placeholder="https://developer.com"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className={labelClasses}>Working Hours</label>
                  <textarea
                    value={formData.working_hours || ''}
                    onChange={(e) => updateField('working_hours', e.target.value || null)}
                    className={inputClasses}
                    rows={3}
                    placeholder='Enter as text (e.g., "Mon-Sat 9:30 AM - 6:30 PM") or JSON (e.g., {"monday": "9:00-18:00", "tuesday": "9:00-18:00"})'
                  />
                  <p className={helpTextClasses}>
                    Enter working hours as plain text or JSON format. Will be stored as JSONB in the database.
                  </p>
                </div>
              </div>
            </div>

            {/* Logo & Description */}
            <div className={cardClasses}>
              <h3 className="text-base font-semibold text-black dark:text-white mb-4">
                Branding & Description
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <FileUpload
                    label="Developer Logo"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
                    category="image"
                    onUploadComplete={(url) => updateField('logo_url', url)}
                    currentUrl={formData.logo_url || undefined}
                    helpText="Upload developer logo (Max 5MB)"
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClasses}>About Developer</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => updateField('description', e.target.value || null)}
                    className={inputClasses}
                    rows={4}
                    placeholder="Brief description of the developer's background and portfolio..."
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim()}
            className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? 'Saving...'
              : developer
              ? 'Update Developer'
              : 'Create Developer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeveloperForm;

