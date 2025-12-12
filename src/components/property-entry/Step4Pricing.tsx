import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { inputClasses, labelClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses, checkboxClasses } from './sharedStyles';

const Step4Pricing: React.FC = () => {
  const { formData, updateFormData } = useFormContext();

  return (
    <div className="space-y-6">
      <div className={sectionHeaderClasses}>
        <h2 className={sectionTitleClasses}>Pricing & Buyer Protection</h2>
        <p className={sectionDescClasses}>Set pricing and payment terms</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className={labelClasses}>
            Minimum Price
          </label>
          <input
            type="number"
            value={formData.min_price || ''}
            onChange={(e) => updateFormData({ min_price: e.target.value ? Number(e.target.value) : null })}
            className={inputClasses}
            placeholder="e.g., 850000"
          />
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            Maximum Price
          </label>
          <input
            type="number"
            value={formData.max_price || ''}
            onChange={(e) => updateFormData({ max_price: e.target.value ? Number(e.target.value) : null })}
            className={inputClasses}
            placeholder="e.g., 1500000"
          />
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            Price Currency <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.price_currency}
            onChange={(e) => updateFormData({ price_currency: e.target.value })}
            className={inputClasses}
          >
            <option value="AED">AED</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="INR">INR</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            Service Charge
          </label>
          <input
            type="text"
            value={formData.service_charge}
            onChange={(e) => updateFormData({ service_charge: e.target.value })}
            className={inputClasses}
            placeholder="e.g., 14 AED/sqft"
          />
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            Minimum Area
          </label>
          <input
            type="number"
            value={formData.min_area || ''}
            onChange={(e) => updateFormData({ min_area: e.target.value ? Number(e.target.value) : null })}
            className={inputClasses}
            placeholder="e.g., 400"
          />
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            Maximum Area
          </label>
          <input
            type="number"
            value={formData.max_area || ''}
            onChange={(e) => updateFormData({ max_area: e.target.value ? Number(e.target.value) : null })}
            className={inputClasses}
            placeholder="e.g., 1200"
          />
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            Area Unit <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.area_unit}
            onChange={(e) => updateFormData({ area_unit: e.target.value })}
            className={inputClasses}
          >
            <option value="sqft">Square Feet (sqft)</option>
            <option value="sqm">Square Meters (sqm)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className={labelClasses}>
            Furnishing
          </label>
          <select
            value={formData.furnishing}
            onChange={(e) => updateFormData({ furnishing: e.target.value })}
            className={inputClasses}
          >
            <option value="">Select furnishing</option>
            <option value="Furnished">Furnished</option>
            <option value="Unfurnished">Unfurnished</option>
            <option value="Semi-furnished">Semi-furnished</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.has_escrow}
              onChange={(e) => updateFormData({ has_escrow: e.target.checked })}
              className={checkboxClasses}
            />
            <span className={labelClasses}>Has Escrow Protection</span>
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.post_handover}
              onChange={(e) => updateFormData({ post_handover: e.target.checked })}
              className={checkboxClasses}
            />
            <span className={labelClasses}>Post Handover Payment</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default Step4Pricing;
