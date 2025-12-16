import React, { useState, useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { supabase } from '../../lib/supabase';
import { submitProperty } from '../../utils/propertySubmission';
// Legacy validation kept for backward compatibility
// import { validateFormData, formatValidationErrors } from '../../utils/validation';
import { buildPropertyPayload, validatePropertyForm } from '../../utils/propertyFormHelpers';
import { convertToPropertyFormData, convertToOldFormData } from '../../utils/formDataAdapter';
import { ValidationIssue } from '../../types/property-form.types';
import { useToast, ToastContainer } from '../common/Toast';
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
const TOTAL_STEPS = 8;

const PropertyEntryForm: React.FC = () => {
  const { formData, currentStep, setCurrentStep, resetFormData } = useFormContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [showDryRunModal, setShowDryRunModal] = useState(false);
  const [dryRunPayload, setDryRunPayload] = useState<any>(null);
  const [dryRunIssues, setDryRunIssues] = useState<ValidationIssue[]>([]);
  const { toasts, removeToast, success, error: showError } = useToast();

  // Ensure currentStep stays within [1, TOTAL_STEPS]
  useEffect(() => {
    if (currentStep < 1) {
      setCurrentStep(1);
    } else if (currentStep > TOTAL_STEPS) {
      setCurrentStep(TOTAL_STEPS);
    }
  }, [currentStep, setCurrentStep]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(
          formData.external_id?.trim() && 
          formData.name?.trim() && 
          formData.developer_id &&
          formData.overview?.trim() &&
          formData.overview.trim().length >= 150
        );
      case 2:
        return !!formData.area?.trim();
      case 3:
        return !!(formData.status?.trim() && formData.permit_id?.trim());
      case 4:
        return !!(formData.price_currency?.trim() && formData.area_unit?.trim());
      case 5:
        // Unit types are optional but if added, they need required fields
        return formData.unitTypes.every(
          (unit) => unit.unit_type?.trim() && unit.unit_bedrooms?.trim()
        );
      case 6:
        return true; // All optional
      case 7:
        return true; // All optional
      case 8:
        // Payment plans if added need name
        return formData.paymentPlans.every((plan) => plan.payment_plan_name?.trim());
      case 9:
        return true; // All optional
      default:
        return true;
    }
  };

  const handleNext = () => {
    // Validate current step before proceeding
    if (!validateStep(currentStep)) {
      return;
    }
    
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
      // Convert old FormData to new PropertyFormData structure
      const propertyFormData = convertToPropertyFormData(formData);

      // Build payload using the new helper
      const payload = buildPropertyPayload(propertyFormData);

      // Validate using the new validation function
      const issues = validatePropertyForm(propertyFormData);

      // Check for errors (block submission if any)
      const errors = issues.filter(issue => issue.severity === 'error');
      if (errors.length > 0) {
        const errorMessages = errors.map(e => `${e.path}: ${e.message}`).join('\n');
        showError(`Please fix the following errors:\n${errorMessages}`, 8000);
        setIsSubmitting(false);
        return;
      }

      // If dry run mode, show modal instead of submitting
      if (dryRun) {
        setDryRunPayload(payload);
        setDryRunIssues(issues);
        setShowDryRunModal(true);
        setIsSubmitting(false);
        return;
      }

      // Show warnings if any (but allow submission)
      const warnings = issues.filter(issue => issue.severity === 'warning');
      if (warnings.length > 0) {
        const warningMessages = warnings.map(w => `${w.path}: ${w.message}`).join('\n');
        console.warn('Validation warnings:', warningMessages);
        // Optionally show warnings in UI
      }

      // Convert back to old FormData for backward compatibility with submitProperty
      // TODO: Update submitProperty to accept new payload structure
      const oldFormData = convertToOldFormData(propertyFormData);

      // Check for blob URLs that need to be uploaded first.
      // In production we block submission; in development we only warn,
      // because the R2 dev mock intentionally uses blob: URLs.
      const blobUrlFields: string[] = [];
      
      // Check main property media fields
      if (oldFormData.video_url && oldFormData.video_url.startsWith('blob:')) {
        blobUrlFields.push('Video URL');
      }
      if (oldFormData.brochure_url && oldFormData.brochure_url.startsWith('blob:')) {
        blobUrlFields.push('Brochure PDF');
      }
      if (oldFormData.layouts_pdf && oldFormData.layouts_pdf.startsWith('blob:')) {
        blobUrlFields.push('Floor Plans PDF');
      }
      if (oldFormData.cover_url && oldFormData.cover_url.startsWith('blob:')) {
        blobUrlFields.push('Cover Image');
      }
      
      // Check additional images
      if (oldFormData.image_urls) {
        const imageUrls = oldFormData.image_urls.split(',').map(url => url.trim());
        const blobImages = imageUrls.filter(url => url.startsWith('blob:'));
        if (blobImages.length > 0) {
          blobUrlFields.push(`${blobImages.length} Additional Image(s)`);
        }
      }
      
      // Check building images
      oldFormData.buildings?.forEach((building, index) => {
        if (building.building_image_url && building.building_image_url.startsWith('blob:')) {
          blobUrlFields.push(`Building "${building.building_name || `#${index + 1}`}" Image`);
        }
      });
      
      // Check unit block images
      oldFormData.unitTypes?.forEach((unit, index) => {
        if (unit.typical_unit_image_url && unit.typical_unit_image_url.startsWith('blob:')) {
          blobUrlFields.push(`Unit Type "${unit.unit_type || `#${index + 1}`}" Image`);
        }
      });
      
      // Check facility images
      oldFormData.facilities?.forEach((facility, index) => {
        if (facility.facility_image_url && facility.facility_image_url.startsWith('blob:')) {
          blobUrlFields.push(`Facility "${facility.facility_name || `#${index + 1}`}" Image`);
        }
      });

      if (blobUrlFields.length > 0) {
        if (import.meta.env.PROD) {
          // In production, block submission to ensure files are actually uploaded to storage.
          showError(
            `Please upload the following files properly (they are currently temporary blob URLs):\n${blobUrlFields.join('\n')}\n\nFiles must be uploaded to storage before submission.`,
            15000
          );
          setIsSubmitting(false);
          return;
        } else {
          // In dev, just log a warning so you can still test the flow
          // when using the R2 mock (which returns blob: URLs).
          console.warn(
            '⚠️ Submitting with blob: URLs in development mode (from R2 mock upload). Fields:',
            blobUrlFields
          );
          // Show a warning toast but allow submission in dev
          showError(
            `Warning: ${blobUrlFields.length} file(s) still have blob URLs. In production, these would be blocked.`,
            5000
          );
        }
      }

      // Submit property and all related data
      const result = await submitProperty(supabase, oldFormData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit property');
      }

      success(`Property "${formData.name}" has been successfully added! Property ID: ${result.propertyId}. All related data has been saved.`, 5000);

      // Reset form after 5 seconds
      setTimeout(() => {
        resetFormData();
        setSubmitStatus(null);
      }, 5000);
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage = error.message || 'Failed to submit property. Please check your data and try again.';
      showError(errorMessage, 8000);
      setSubmitStatus({
        type: 'error',
        message: errorMessage,
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
      default:
        return <Step1Basic />;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black py-4 md:py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-black dark:text-white">Add Property</h1>
          {formData.name && (
            <p className="text-gray-500 dark:text-zinc-500 mt-1 text-sm">
              Currently editing: <span className="font-medium">{formData.name}</span>
            </p>
          )}
        </div>

        {/* Main Form Card */}
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-900 rounded-lg p-4 md:p-8">
          {/* Dry Run Checkbox */}
          <div className="mb-6 flex items-center gap-2">
            <input
              type="checkbox"
              id="dry-run"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="dry-run" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              Dry run (do NOT save, just show what will be stored)
            </label>
          </div>

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

      {/* Dry Run Modal */}
      {showDryRunModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-black dark:text-white">Dry Run Results</h2>
                <button
                  onClick={() => setShowDryRunModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Validation Issues */}
              {dryRunIssues.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-black dark:text-white">Validation Issues</h3>
                  <div className="space-y-2">
                    {dryRunIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                          issue.severity === 'error'
                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                            : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`font-semibold ${
                              issue.severity === 'error'
                                ? 'text-red-800 dark:text-red-300'
                                : 'text-yellow-800 dark:text-yellow-300'
                            }`}
                          >
                            {issue.severity === 'error' ? '❌' : '⚠️'}
                          </span>
                          <div className="flex-1">
                            <p
                              className={`font-medium ${
                                issue.severity === 'error'
                                  ? 'text-red-800 dark:text-red-300'
                                  : 'text-yellow-800 dark:text-yellow-300'
                              }`}
                            >
                              {issue.path}
                            </p>
                            <p
                              className={`text-sm ${
                                issue.severity === 'error'
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-yellow-700 dark:text-yellow-400'
                              }`}
                            >
                              {issue.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payload JSON */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-black dark:text-white">Payload (JSON)</h3>
                <pre className="bg-gray-100 dark:bg-zinc-800 p-4 rounded-lg overflow-x-auto text-xs text-gray-800 dark:text-gray-200">
                  {JSON.stringify(dryRunPayload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => setShowDryRunModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default PropertyEntryForm;

