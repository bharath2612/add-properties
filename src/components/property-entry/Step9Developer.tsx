import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { inputClasses, labelClasses, helpTextClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses, cardClasses } from './sharedStyles';

const Step9Overview: React.FC = () => {
  const { formData, updateFormData } = useFormContext();

  return (
    <div className="space-y-8">
      <div className={sectionHeaderClasses}>
        <h2 className={sectionTitleClasses}>Project Overview & Description</h2>
        <p className={sectionDescClasses}>Provide a detailed description of your property</p>
      </div>

      {/* Description Section */}
      <div className="space-y-4">

        <div className={cardClasses}>
          <div className="space-y-2">
            <label className={labelClasses}>
              Overview
            </label>
            <textarea
              value={formData.overview}
              onChange={(e) => updateFormData({ overview: e.target.value })}
              className={inputClasses}
              rows={8}
              placeholder="Detailed project description (markdown supported)...&#10;&#10;Example:&#10;Cello by Taraf is a modern residential development in JVC offering studio, 1BR, and 2BR apartments with world-class amenities."
            />
            <p className={helpTextClasses}>Rich description of the property</p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Step9Overview;
