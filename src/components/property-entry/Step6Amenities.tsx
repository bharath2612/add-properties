import React, { useRef, useState, useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { Building, Facility, MapPoint } from '../../types/property.types';
import { inputClasses, labelClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses, cardClasses, addButtonClasses, removeButtonClasses } from './sharedStyles';
import FileUpload from './FileUpload';
import { uploadToR2 } from '../../utils/r2Upload';
import { supabase } from '../../lib/supabase';

// Compact image upload component for inline use
const CompactImageUpload: React.FC<{
  currentUrl?: string;
  onUploadComplete: (url: string) => void;
}> = ({ currentUrl, onUploadComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadToR2(file, 'image');
      if (result.success && result.url) {
        onUploadComplete(result.url);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (currentUrl) {
    return (
      <div className="relative">
        <img
          src={currentUrl}
          alt="Facility"
          className="w-full h-10 object-cover rounded-lg border border-gray-300 dark:border-zinc-800"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-30 transition-opacity rounded-lg text-white text-xs"
        >
          {uploading ? 'Uploading...' : 'Change'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
      className={`w-full ${inputClasses} flex items-center justify-center gap-2 h-[42px] ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900'}`}
    >
      {uploading ? (
        <span className="text-xs text-gray-600 dark:text-zinc-400">Uploading...</span>
      ) : (
        <>
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-xs text-gray-600 dark:text-zinc-400">Upload</span>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </button>
  );
};

const Step6Amenities: React.FC = () => {
  const { formData, updateFormData } = useFormContext();

  // Buildings
  const addBuilding = () => {
    const newBuilding: Building = {
      id: Date.now().toString(),
      building_name: '',
      building_description: '',
      building_completion_date: '',
      building_image_url: '',
    };
    updateFormData({ buildings: [...formData.buildings, newBuilding] });
  };

  const updateBuilding = (id: string, field: keyof Building, value: any) => {
    const updated = formData.buildings.map((b) =>
      b.id === id ? { ...b, [field]: value } : b
    );
    updateFormData({ buildings: updated });
  };

  const removeBuilding = (id: string) => {
    updateFormData({ buildings: formData.buildings.filter((b) => b.id !== id) });
  };

  // Facilities
  const [facilitySearchTerm, setFacilitySearchTerm] = useState('');
  const [facilityResults, setFacilityResults] = useState<Array<{ id: number; name: string }>>([]);
  const [searchingFacilities, setSearchingFacilities] = useState(false);
  const [facilitySearchError, setFacilitySearchError] = useState<string | null>(null);

  const addFacility = () => {
    const newFacility: Facility = {
      id: Date.now().toString(),
      facility_id: null,
      facility_name: '',
      facility_image_url: '',
      facility_image_source: '',
    };
    updateFormData({ facilities: [...formData.facilities, newFacility] });
  };

  const addExistingFacility = (facility: { id: number; name: string }) => {
    // Avoid duplicates by facility_id
    if (formData.facilities.some(f => f.facility_id === facility.id)) return;
    const newFacility: Facility = {
      id: Date.now().toString(),
      facility_id: facility.id,
      facility_name: facility.name,
      facility_image_url: '',
      facility_image_source: '',
    };
    updateFormData({ facilities: [...formData.facilities, newFacility] });
    // Clear search after selection
    setFacilitySearchTerm('');
    setFacilityResults([]);
    setFacilitySearchError(null);
  };

  const searchFacilities = async (term: string) => {
    setFacilitySearchTerm(term);
    if (term.trim().length < 2) {
      setFacilityResults([]);
      return;
    }
    setSearchingFacilities(true);
    setFacilitySearchError(null);
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('id,name')
        .ilike('name', `%${term}%`)
        .limit(10);
      if (error) throw error;
      setFacilityResults(data || []);
    } catch (err: any) {
      console.error('Error searching facilities', err);
      setFacilitySearchError(err.message || 'Failed to search facilities');
    } finally {
      setSearchingFacilities(false);
    }
  };

  const updateFacility = (id: string, field: keyof Facility, value: any) => {
    const updated = formData.facilities.map((f) =>
      f.id === id ? { ...f, [field]: value } : f
    );
    updateFormData({ facilities: updated });
  };

  const removeFacility = (id: string) => {
    updateFormData({ facilities: formData.facilities.filter((f) => f.id !== id) });
  };

  // Map Points
  const addMapPoint = () => {
    const newMapPoint: MapPoint = {
      id: Date.now().toString(),
      poi_name: '',
      distance_km: null,
    };
    updateFormData({ mapPoints: [...formData.mapPoints, newMapPoint] });
  };

  const updateMapPoint = (id: string, field: keyof MapPoint, value: any) => {
    const updated = formData.mapPoints.map((m) =>
      m.id === id ? { ...m, [field]: value } : m
    );
    updateFormData({ mapPoints: updated });
  };

  const removeMapPoint = (id: string) => {
    const updated = formData.mapPoints.filter((m) => m.id !== id);
    updateFormData({ mapPoints: updated });
    // If removing the last point and it's now empty, add a new empty one
    // (since at least one point is mandatory)
    if (updated.length === 0) {
      const newMapPoint: MapPoint = {
        id: Date.now().toString(),
        poi_name: '',
        distance_km: null,
      };
      updateFormData({ mapPoints: [newMapPoint] });
    }
  };

  // Automatically add an empty map point if the list is empty (since at least one is mandatory)
  useEffect(() => {
    if (formData.mapPoints.length === 0) {
      const newMapPoint: MapPoint = {
        id: Date.now().toString(),
        poi_name: '',
        distance_km: null,
      };
      updateFormData({ mapPoints: [newMapPoint] });
    }
  }, []); // Only run on mount

  return (
    <div className="space-y-8">
      <div className={sectionHeaderClasses}>
        <h2 className={sectionTitleClasses}>Amenities & Locations</h2>
        <p className={sectionDescClasses}>Add buildings, facilities, and nearby points of interest</p>
      </div>

      {/* Buildings Section */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-black dark:text-white flex items-center gap-2">
          <span className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-xs">1</span>
          Buildings
        </h3>

        {formData.buildings.map((building, index) => (
          <div key={building.id} className={cardClasses}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-semibold text-black dark:text-white">Building {index + 1}</h4>
              <button
                onClick={() => removeBuilding(building.id)}
                className={removeButtonClasses}
              >
                Remove
              </button>
            </div>

            <div className="space-y-4">
              {/* First Row: Building Name and Completion Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelClasses}>
                    Building Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={building.building_name}
                    onChange={(e) => updateBuilding(building.id, 'building_name', e.target.value)}
                    className={inputClasses}
                    placeholder="e.g., Tower A"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClasses}>Completion Date</label>
                  <input
                    type="date"
                    value={building.building_completion_date}
                    onChange={(e) => updateBuilding(building.id, 'building_completion_date', e.target.value)}
                    className={inputClasses}
                  />
                </div>
              </div>

              {/* Second Row: Description and Image Upload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelClasses}>Description</label>
                  <textarea
                    value={building.building_description}
                    onChange={(e) => updateBuilding(building.id, 'building_description', e.target.value)}
                    className={inputClasses}
                    rows={6}
                    placeholder="What's in this building"
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClasses}>Building Image</label>
                  <FileUpload
                    label=""
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    category="image"
                    onUploadComplete={(url) => updateBuilding(building.id, 'building_image_url', url)}
                    currentUrl={building.building_image_url}
                    helpText=""
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addBuilding}
          className={addButtonClasses}
        >
          + Add Building
        </button>
      </div>

      {/* Facilities Section */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-black dark:text-white flex items-center gap-2">
          <span className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-xs">2</span>
          Facilities <span className="text-red-500">*</span>
        </h3>

        {/* Search & add existing facilities */}
        <div className={cardClasses}>
          <label className={labelClasses}>Search facilities (from master list)</label>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="text"
              value={facilitySearchTerm}
              onChange={(e) => searchFacilities(e.target.value)}
              className={inputClasses}
              placeholder="Type to search facilities"
            />
          </div>
          {facilitySearchError && <p className="text-xs text-red-500 mt-1">{facilitySearchError}</p>}
          {searchingFacilities && <p className="text-xs text-gray-500 mt-1">Searching...</p>}
          {!searchingFacilities && facilityResults.length > 0 && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              {facilityResults.map((fac) => (
                <button
                  key={fac.id}
                  type="button"
                  onClick={() => addExistingFacility(fac)}
                  className="flex justify-between items-center px-3 py-2 rounded border border-gray-200 dark:border-zinc-800 text-sm text-left text-black dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-900"
                >
                  <span className="text-black dark:text-white">{fac.name}</span>
                  <span className="text-[11px] text-gray-500 dark:text-zinc-500">ID: {fac.id}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={addFacility}
              className="px-3 py-2 rounded bg-indigo-600 dark:bg-indigo-500 text-white text-sm hover:bg-indigo-700 dark:hover:bg-indigo-600"
            >
              + Add Other (create new)
            </button>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Use this to add a new facility if not found.</p>
          </div>
        </div>

        {/* Facilities List */}
        {formData.facilities.map((facility) => (
          <div key={facility.id} className={cardClasses}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end">
              {/* Facility Name */}
              <div className="space-y-2">
                <label className={labelClasses}>
                  Facility Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={facility.facility_name}
                  onChange={(e) => {
                    if (facility.facility_id) return; // lock name for existing facilities
                    updateFacility(facility.id, 'facility_name', e.target.value);
                  }}
                  disabled={!!facility.facility_id}
                  className={inputClasses}
                  placeholder="e.g., Swimming Pool"
                  required
                />
                <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                  Facility ID: {facility.facility_id ?? 'New / Other'}
                </p>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <label className={labelClasses}>Facility Image</label>
                <CompactImageUpload
                  currentUrl={facility.facility_image_url}
                  onUploadComplete={(url: string) => updateFacility(facility.id, 'facility_image_url', url)}
                />
              </div>

              {/* Add Button */}
              <div>
                <button
                  type="button"
                  onClick={addFacility}
                  className="p-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
                  title="Add another facility"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Remove Button (even if it's the only one) */}
              <div>
                <button
                  type="button"
                  onClick={() => removeFacility(facility.id)}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  title="Remove facility"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add First Facility Button (if none exist) */}
        {formData.facilities.length === 0 && (
          <button
            onClick={addFacility}
            className={addButtonClasses}
          >
            + Add Facility
          </button>
        )}
      </div>

      {/* Map Points Section */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-black dark:text-white flex items-center gap-2">
          <span className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-xs">3</span>
          Points of Interest
        </h3>

        {formData.mapPoints.map((point, index) => (
          <div key={point.id} className={cardClasses}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-semibold text-black dark:text-white">Location {index + 1}</h4>
              {/* Only show remove button if there's more than one point (since at least one is mandatory) */}
              {formData.mapPoints.length > 1 && (
                <button
                  onClick={() => removeMapPoint(point.id)}
                  className={removeButtonClasses}
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClasses}>
                  Location Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={point.poi_name}
                  onChange={(e) => updateMapPoint(point.id, 'poi_name', e.target.value)}
                  className={inputClasses}
                  placeholder="e.g., Downtown Dubai"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className={labelClasses}>
                  Distance (km) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={point.distance_km || ''}
                  onChange={(e) => updateMapPoint(point.id, 'distance_km', e.target.value ? Number(e.target.value) : null)}
                  className={inputClasses}
                  placeholder="e.g., 5.2"
                  required
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addMapPoint}
          className={addButtonClasses}
        >
          + Add Point of Interest
        </button>
      </div>
    </div>
  );
};

export default Step6Amenities;
