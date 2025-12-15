import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { Building, Facility, MapPoint } from '../../types/property.types';
import { inputClasses, labelClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses, cardClasses, addButtonClasses, removeButtonClasses } from './sharedStyles';
import FileUpload from './FileUpload';

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
  const addFacility = () => {
    const newFacility: Facility = {
      id: Date.now().toString(),
      facility_name: '',
      facility_image_url: '',
      facility_image_source: '',
    };
    updateFormData({ facilities: [...formData.facilities, newFacility] });
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
    updateFormData({ mapPoints: formData.mapPoints.filter((m) => m.id !== id) });
  };

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

              <div className="md:col-span-2 space-y-2">
                <label className={labelClasses}>Description</label>
                <textarea
                  value={building.building_description}
                  onChange={(e) => updateBuilding(building.id, 'building_description', e.target.value)}
                  className={inputClasses}
                  rows={2}
                  placeholder="What's in this building"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <FileUpload
                  label="Building Image"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  category="image"
                  onUploadComplete={(url) => updateBuilding(building.id, 'building_image_url', url)}
                  currentUrl={building.building_image_url}
                  helpText="Upload building image (Max 5MB)"
                />
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
          Facilities
        </h3>

        {formData.facilities.map((facility, index) => (
          <div key={facility.id} className={cardClasses}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-semibold text-black dark:text-white">Facility {index + 1}</h4>
              <button
                onClick={() => removeFacility(facility.id)}
                className={removeButtonClasses}
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClasses}>
                  Facility Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={facility.facility_name}
                  onChange={(e) => updateFacility(facility.id, 'facility_name', e.target.value)}
                  className={inputClasses}
                  placeholder="e.g., Swimming Pool, Gym"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className={labelClasses}>Image Source</label>
                <input
                  type="text"
                  value={facility.facility_image_source}
                  onChange={(e) => updateFacility(facility.id, 'facility_image_source', e.target.value)}
                  className={inputClasses}
                  placeholder="e.g., Visualisation from developer"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <FileUpload
                  label="Facility Image"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  category="image"
                  onUploadComplete={(url) => updateFacility(facility.id, 'facility_image_url', url)}
                  currentUrl={facility.facility_image_url}
                  helpText="Upload facility image (Max 5MB)"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addFacility}
          className={addButtonClasses}
        >
          + Add Facility
        </button>
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
              <button
                onClick={() => removeMapPoint(point.id)}
                className={removeButtonClasses}
              >
                Remove
              </button>
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
