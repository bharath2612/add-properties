import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { PaymentPlan } from '../../types/property.types';
import { inputClasses, labelClasses, helpTextClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses, cardClasses, addButtonClasses, removeButtonClasses } from './sharedStyles';

const Step8PaymentParking: React.FC = () => {
  const { formData, updateFormData } = useFormContext();

  const addPaymentPlan = () => {
    const newPlan: PaymentPlan = {
      id: Date.now().toString(),
      payment_plan_name: '',
      payment_steps: '',
      months_after_handover: null,
    };
    updateFormData({ paymentPlans: [...formData.paymentPlans, newPlan] });
  };

  const updatePaymentPlan = (id: string, field: keyof PaymentPlan, value: any) => {
    const updated = formData.paymentPlans.map((plan) =>
      plan.id === id ? { ...plan, [field]: value } : plan
    );
    updateFormData({ paymentPlans: updated });
  };

  const removePaymentPlan = (id: string) => {
    updateFormData({ paymentPlans: formData.paymentPlans.filter((plan) => plan.id !== id) });
  };

  return (
    <div className="space-y-8">
      <div className={sectionHeaderClasses}>
        <h2 className={sectionTitleClasses}>Payment Plans & Parking</h2>
        <p className={sectionDescClasses}>Define payment options and parking specifications</p>
      </div>

      {/* Payment Plans Section */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-black dark:text-white flex items-center gap-2">
          <span className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-xs">1</span>
          Payment Plans <span className="text-red-500">*</span>
        </h3>
        {formData.paymentPlans.length === 0 && (
          <p className="text-sm text-red-600 dark:text-red-400">
            <span className="text-red-500">*</span> At least one payment plan is required
          </p>
        )}

        {formData.paymentPlans.map((plan, index) => (
          <div key={plan.id} className={cardClasses}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-semibold text-black dark:text-white">Payment Plan {index + 1}</h4>
              <button
                onClick={() => removePaymentPlan(plan.id)}
                className={removeButtonClasses}
              >
                Remove
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className={labelClasses}>
                  Plan Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={plan.payment_plan_name}
                  onChange={(e) => updatePaymentPlan(plan.id, 'payment_plan_name', e.target.value)}
                  className={inputClasses}
                  placeholder="e.g., Standard Payment Plan"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className={labelClasses}>
                  Payment Steps <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={plan.payment_steps}
                  onChange={(e) => updatePaymentPlan(plan.id, 'payment_steps', e.target.value)}
                  className={inputClasses}
                  rows={4}
                  placeholder="Format (separate with | ):&#10;5% On booking|55% During construction|40% Upon Handover"
                  required
                />
                <p className={helpTextClasses}>Separate steps with | (pipe character) - Required</p>
              </div>

              <div className="space-y-2">
                <label className={labelClasses}>
                  Months After Handover
                </label>
                <input
                  type="number"
                  value={plan.months_after_handover || ''}
                  onChange={(e) => updatePaymentPlan(plan.id, 'months_after_handover', e.target.value ? Number(e.target.value) : null)}
                  className={inputClasses}
                  placeholder="e.g., 12"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addPaymentPlan}
          className={addButtonClasses}
        >
          + Add Payment Plan
        </button>
      </div>

      {/* Parking Section */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-black dark:text-white flex items-center gap-2">
          <span className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-xs">2</span>
          Parking Specifications
        </h3>

        <div className={cardClasses}>
          <div className="space-y-2">
            <label className={labelClasses}>
              Parking Details
            </label>
            <textarea
              value={formData.parking_specs}
              onChange={(e) => updateFormData({ parking_specs: e.target.value })}
              className={inputClasses}
              rows={4}
              placeholder="e.g., Studio-2BR: 1 space | 3BR+: 2 spaces"
            />
            <p className={helpTextClasses}>Describe parking allocation per unit type</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step8PaymentParking;
