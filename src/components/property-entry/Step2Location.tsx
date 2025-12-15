import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { inputClasses, labelClasses, helpTextClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses } from './sharedStyles';

const Step2Location: React.FC = () => {
  const { formData, updateFormData } = useFormContext();

  return (
    <div className="space-y-6">
      <div className={sectionHeaderClasses}>
        <h2 className={sectionTitleClasses}>Location Details</h2>
        <p className={sectionDescClasses}>Specify where the property is located</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className={labelClasses}>
            Area/Neighborhood <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.area}
            onChange={(e) => updateFormData({ area: e.target.value })}
            className={inputClasses}
            placeholder="e.g., Jumeirah Village Circle (JVC)"
            required
          />
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => updateFormData({ city: e.target.value })}
            className={inputClasses}
            placeholder="e.g., Dubai"
            required
          />
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            Country <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => updateFormData({ country: e.target.value })}
            className={inputClasses}
            placeholder="e.g., United Arab Emirates"
            required
          />
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            Coordinates <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.coordinates}
            onChange={(e) => updateFormData({ coordinates: e.target.value })}
            className={inputClasses}
            placeholder="25.051776, 55.198589"
            required
          />
          <p className={helpTextClasses}>Format: latitude, longitude</p>
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className={labelClasses}>
            Website URL
          </label>
          <input
            type="url"
            value={formData.website}
            onChange={(e) => updateFormData({ website: e.target.value })}
            className={inputClasses}
            placeholder="https://example.com"
          />
        </div>
      </div>
    </div>
  );
};

export default Step2Location;
