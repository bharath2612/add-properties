import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { UnitType } from '../../types/property.types';
import { inputClasses, labelClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses, cardClasses, addButtonClasses, removeButtonClasses } from './sharedStyles';

const Step5UnitTypes: React.FC = () => {
  const { formData, updateFormData } = useFormContext();

  const addUnitType = () => {
    const newUnit: UnitType = {
      id: Date.now().toString(),
      unit_type: '',
      normalized_type: '',
      unit_bedrooms: '',
      units_amount: null,
      units_area_from_m2: null,
      units_area_to_m2: null,
      units_price_from: null,
      units_price_to: null,
      typical_unit_image_url: '',
    };
    updateFormData({ unitTypes: [...formData.unitTypes, newUnit] });
  };

  const updateUnitType = (id: string, field: keyof UnitType, value: any) => {
    const updated = formData.unitTypes.map((unit) =>
      unit.id === id ? { ...unit, [field]: value } : unit
    );
    updateFormData({ unitTypes: updated });
  };

  const removeUnitType = (id: string) => {
    updateFormData({ unitTypes: formData.unitTypes.filter((unit) => unit.id !== id) });
  };

  return (
    <div className="space-y-6">
      <div className={sectionHeaderClasses}>
        <h2 className={sectionTitleClasses}>Unit Types</h2>
        <p className={sectionDescClasses}>Add one or more unit configurations (Studio, 1BR, 2BR, etc.)</p>
      </div>

      {formData.unitTypes.map((unit, index) => (
        <div key={unit.id} className={cardClasses}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-black dark:text-white">Unit Type {index + 1}</h3>
            <button
              onClick={() => removeUnitType(unit.id)}
              className={removeButtonClasses}
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelClasses}>
                Unit Type <span className="text-red-500">*</span>
              </label>
              <select
                value={unit.unit_type}
                onChange={(e) => updateUnitType(unit.id, 'unit_type', e.target.value)}
                className={inputClasses}
              >
                <option value="">Select type</option>
                <option value="Apartments">Apartments</option>
                <option value="Penthouse">Penthouse</option>
                <option value="Villa">Villa</option>
                <option value="Townhouse">Townhouse</option>
                <option value="Studio">Studio</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Normalized Type
              </label>
              <input
                type="text"
                value={unit.normalized_type}
                onChange={(e) => updateUnitType(unit.id, 'normalized_type', e.target.value)}
                className={inputClasses}
                placeholder="e.g., 1BR, 2BR, Studio"
              />
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Bedrooms <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={unit.unit_bedrooms}
                onChange={(e) => updateUnitType(unit.id, 'unit_bedrooms', e.target.value)}
                className={inputClasses}
                placeholder="e.g., Studio, 1 bedroom, 2 bedroom"
              />
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Units Amount
              </label>
              <input
                type="number"
                value={unit.units_amount || ''}
                onChange={(e) => updateUnitType(unit.id, 'units_amount', e.target.value ? Number(e.target.value) : null)}
                className={inputClasses}
                placeholder="Total units"
              />
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Min Area (m²)
              </label>
              <input
                type="number"
                value={unit.units_area_from_m2 || ''}
                onChange={(e) => updateUnitType(unit.id, 'units_area_from_m2', e.target.value ? Number(e.target.value) : null)}
                className={inputClasses}
                placeholder="Min area"
              />
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Max Area (m²)
              </label>
              <input
                type="number"
                value={unit.units_area_to_m2 || ''}
                onChange={(e) => updateUnitType(unit.id, 'units_area_to_m2', e.target.value ? Number(e.target.value) : null)}
                className={inputClasses}
                placeholder="Max area"
              />
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Min Price
              </label>
              <input
                type="number"
                value={unit.units_price_from || ''}
                onChange={(e) => updateUnitType(unit.id, 'units_price_from', e.target.value ? Number(e.target.value) : null)}
                className={inputClasses}
                placeholder="Min price"
              />
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Max Price
              </label>
              <input
                type="number"
                value={unit.units_price_to || ''}
                onChange={(e) => updateUnitType(unit.id, 'units_price_to', e.target.value ? Number(e.target.value) : null)}
                className={inputClasses}
                placeholder="Max price"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className={labelClasses}>
                Unit Image URL
              </label>
              <input
                type="url"
                value={unit.typical_unit_image_url}
                onChange={(e) => updateUnitType(unit.id, 'typical_unit_image_url', e.target.value)}
                className={inputClasses}
                placeholder="https://example.com/unit.jpg"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addUnitType}
        className={addButtonClasses}
      >
        + Add Unit Type
      </button>
    </div>
  );
};

export default Step5UnitTypes;
