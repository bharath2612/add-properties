import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { inputClasses, labelClasses, helpTextClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses } from './sharedStyles';

const Step1Basic: React.FC = () => {
  const { formData, updateFormData } = useFormContext();

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
          <label className={labelClasses}>
            Developer <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.developer}
            onChange={(e) => updateFormData({ developer: e.target.value })}
            className={inputClasses}
            placeholder="e.g., Taraf Holding"
            required
          />
          <p className={helpTextClasses}>Developer/Builder name</p>
        </div>
      </div>
    </div>
  );
};

export default Step1Basic;

