import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { inputClasses, labelClasses, helpTextClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses } from './sharedStyles';

const Step3Status: React.FC = () => {
  const { formData, updateFormData } = useFormContext();

  return (
    <div className="space-y-6">
      <div className={sectionHeaderClasses}>
        <h2 className={sectionTitleClasses}>Project Status</h2>
        <p className={sectionDescClasses}>Current status and timeline information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className={labelClasses}>
            Status <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.status}
            onChange={(e) => updateFormData({ status: e.target.value })}
            className={inputClasses}
            required
          >
            <option value="">Select status</option>
            <option value="Under construction">Under construction</option>
            <option value="Pre-Launch">Pre-Launch</option>
            <option value="On Sale">On Sale</option>
            <option value="Completed">Completed</option>
            <option value="Sold Out">Sold Out</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
            Sale Status
          </label>
          <input
            type="text"
            value={formData.sale_status}
            onChange={(e) => updateFormData({ sale_status: e.target.value })}
            className={inputClasses}
            placeholder="e.g., Available, Few units left"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
            Completion Date
          </label>
          <input
            type="date"
            value={formData.completion_datetime}
            onChange={(e) => updateFormData({ completion_datetime: e.target.value })}
            className={inputClasses}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
            Readiness (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={formData.readiness || ''}
            onChange={(e) => updateFormData({ readiness: e.target.value ? Number(e.target.value) : null })}
            className={inputClasses}
            placeholder="55"
          />
          <p className={helpTextClasses}>Project completion percentage</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
            RERA Number / Permit ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.permit_id}
            onChange={(e) => updateFormData({ permit_id: e.target.value })}
            className={inputClasses}
            placeholder="e.g., 71/1234/2024"
            required
          />
          <p className={helpTextClasses}>Dubai Land Department registration number</p>
        </div>
      </div>
    </div>
  );
};

export default Step3Status;

