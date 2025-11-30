import React, { useState } from 'react';
import { useFormContext } from '../../context/FormContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { submitProperty } from '../../utils/propertySubmission';
import { validateFormData, formatValidationErrors } from '../../utils/validation';
import ProgressBar from './ProgressBar';
import StepNavigation from './StepNavigation';
import Step1Basic from './Step1Basic';
import Step2Location from './Step2Location';
import Step3Status from './Step3Status';
import Step4Pricing from './Step4Pricing';
import Step5UnitTypes from './Step5UnitTypes';
import Step6Amenities from './Step6Amenities';
import Step7Media from './Step7Media';
import Step8PaymentParking from './Step8PaymentParking';
import Step9Developer from './Step9Developer';

const TOTAL_STEPS = 9;

const PropertyEntryForm: React.FC = () => {
  const { formData, currentStep, setCurrentStep, resetFormData } = useFormContext();
  const { theme, toggleTheme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.external_id && formData.name && formData.developer);
      case 2:
        return !!formData.area;
      case 3:
        return !!formData.status && !!formData.permit_id;
      case 4:
        return !!formData.price_currency && !!formData.area_unit;
      case 5:
        // Unit types are optional but if added, they need required fields
        return formData.unitTypes.every(
          (unit) => unit.unit_type && unit.unit_bedrooms
        );
      case 6:
        return true; // All optional
      case 7:
        return true; // All optional
      case 8:
        // Payment plans if added need name
        return formData.paymentPlans.every((plan) => plan.payment_plan_name);
      case 9:
        return true; // All optional
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // First validate all data
      const validationErrors = validateFormData(formData);
      if (validationErrors.length > 0) {
        const errorMessage = formatValidationErrors(validationErrors);
        setSubmitStatus({
          type: 'error',
          message: errorMessage,
        });
        setIsSubmitting(false);
        return;
      }

      // Submit property and all related data
      const result = await submitProperty(supabase, formData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit property');
      }

      setSubmitStatus({
        type: 'success',
        message: `Property "${formData.name}" has been successfully added! Property ID: ${result.propertyId}. All related data has been saved.`,
      });

      // Reset form after 5 seconds
      setTimeout(() => {
        resetFormData();
        setCurrentStep(1);
        setSubmitStatus(null);
      }, 5000);
    } catch (error: any) {
      console.error('Submission error:', error);
      setSubmitStatus({
        type: 'error',
        message: error.message || 'Failed to submit property. Please check your data and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove form-level authentication since it's now handled at dashboard level
  // if (!isAuthenticated) {
  //   return <AuthStep onAuthenticated={() => setIsAuthenticated(true)} />;
  // }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Basic />;
      case 2:
        return <Step2Location />;
      case 3:
        return <Step3Status />;
      case 4:
        return <Step4Pricing />;
      case 5:
        return <Step5UnitTypes />;
      case 6:
        return <Step6Amenities />;
      case 7:
        return <Step7Media />;
      case 8:
        return <Step8PaymentParking />;
      case 9:
        return <Step9Developer />;
      default:
        return <Step1Basic />;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black py-4 md:py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-black dark:text-white">Property Entry System</h1>
            {formData.name && (
              <p className="text-gray-500 dark:text-zinc-500 mt-1 text-sm">
                Currently editing: <span className="font-medium">{formData.name}</span>
              </p>
            )}
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* Main Form Card */}
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-900 rounded-lg p-4 md:p-8">
          <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

          {/* Success/Error Messages */}
          {submitStatus && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                submitStatus.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {submitStatus.type === 'success' ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <p className="font-medium text-sm md:text-base">{submitStatus.message}</p>
              </div>
            </div>
          )}

          {/* Step Content */}
          <div className="mb-8">{renderStep()}</div>

          {/* Navigation */}
          <StepNavigation
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSubmit={handleSubmit}
            canProceed={validateStep(currentStep)}
            isSubmitting={isSubmitting}
          />
        </div>

        {/* Help Text */}
        <div className="mt-4 md:mt-6 text-center text-xs md:text-sm text-gray-600 dark:text-zinc-400">
          <p>
            All data is automatically saved to your browser session. You can safely close and return later.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PropertyEntryForm;

