import React, { useState, useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { sectionHeaderClasses, sectionTitleClasses, sectionDescClasses, cardClasses } from './sharedStyles';
import FileUpload from './FileUpload';

const Step7Media: React.FC = () => {
  const { formData, updateFormData } = useFormContext();
  const [additionalImages, setAdditionalImages] = useState<string[]>(
    formData.image_urls ? formData.image_urls.split(',').map(url => url.trim()).filter(Boolean) : []
  );

  // Sync local state with formData when it changes externally
  useEffect(() => {
    const images = formData.image_urls 
      ? formData.image_urls.split(',').map(url => url.trim()).filter(Boolean)
      : [];
    setAdditionalImages(images);
  }, [formData.image_urls]);

  const handleAdditionalImagesUpload = (urls: string[]) => {
    const allImages = [...additionalImages, ...urls];
    setAdditionalImages(allImages);
    const imageUrlsString = allImages.join(',');
    updateFormData({ image_urls: imageUrlsString });
  };

  const removeImage = (index: number) => {
    const newImages = additionalImages.filter((_, i) => i !== index);
    setAdditionalImages(newImages);
    updateFormData({ image_urls: newImages.join(',') });
  };

  return (
    <div className="space-y-8">
      <div className={sectionHeaderClasses}>
        <h2 className={sectionTitleClasses}>Media & Documents</h2>
        <p className={sectionDescClasses}>Upload images, videos, and documents for your property</p>
      </div>

      <div className="space-y-8">
        {/* Cover Image */}
        <div className={cardClasses}>
          <FileUpload
            label="Cover Image"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            category="image"
            currentUrl={formData.cover_url}
            onUploadComplete={(url) => updateFormData({ cover_url: url })}
            helpText="Main property cover image (Max 5MB) - Required"
            hidePreview={true}
          />
          {!formData.cover_url && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              <span className="text-red-500">*</span> Cover image is required
            </p>
          )}

          {formData.cover_url && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">
                Uploaded Cover Image:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div key="cover" className="relative group">
                  <div className="aspect-video w-full overflow-hidden rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
                    <img
                      src={formData.cover_url}
                      alt="Cover Image"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 text-sm">Failed to load image</div>';
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateFormData({ cover_url: '' })}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    title="Remove cover image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Additional Images */}
        <div className={cardClasses}>
          <FileUpload
            label="Additional Images"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            category="image"
            multiple
            onMultipleUploadComplete={handleAdditionalImagesUpload}
            onUploadComplete={(url) => handleAdditionalImagesUpload([url])}
            helpText="Upload at least one additional property image (Max 5MB each) - Required"
            hidePreview={true}
          />
          {additionalImages.length === 0 && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              <span className="text-red-500">*</span> At least one additional image is required
            </p>
          )}

          {additionalImages.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">
                Uploaded Images ({additionalImages.length}):
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {additionalImages.map((url, index) => (
                  <div key={`additional-${index}-${url}`} className="relative group">
                    <div className="aspect-video w-full overflow-hidden rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
                      <img
                        src={url}
                        alt={`Additional Image ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 text-sm">Failed to load image</div>';
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      title="Remove image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Video Upload */}
        <div className={cardClasses}>
          <FileUpload
            label="Property Video"
            accept="video/mp4,video/webm,video/quicktime"
            category="video"
            onUploadComplete={(url) => updateFormData({ video_url: url })}
            currentUrl={formData.video_url}
            helpText="Upload property tour or promotional video (Max 50MB)"
          />
        </div>

        {/* Documents */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={cardClasses}>
            <FileUpload
              label="Brochure PDF"
              accept="application/pdf"
              category="document"
              onUploadComplete={(url) => updateFormData({ brochure_url: url })}
              currentUrl={formData.brochure_url}
              helpText="Property brochure (Max 50MB)"
            />
          </div>

          <div className={cardClasses}>
            <FileUpload
              label="Floor Plans PDF"
              accept="application/pdf"
              category="document"
              onUploadComplete={(url) => updateFormData({ layouts_pdf: url })}
              currentUrl={formData.layouts_pdf}
              helpText="Floor plans and layouts (Max 50MB)"
            />
          </div>
        </div>

        {/* Summary */}
        {(formData.cover_url || formData.video_url || formData.brochure_url || formData.layouts_pdf || additionalImages.length > 0) && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
              Uploaded Media Summary
            </h3>
            <ul className="space-y-1 text-sm text-indigo-800 dark:text-indigo-200">
              {formData.cover_url && <li>✓ Cover Image</li>}
              {additionalImages.length > 0 && <li>✓ {additionalImages.length} Additional Image{additionalImages.length > 1 ? 's' : ''}</li>}
              {formData.video_url && <li>✓ Property Video</li>}
              {formData.brochure_url && <li>✓ Brochure PDF</li>}
              {formData.layouts_pdf && <li>✓ Floor Plans PDF</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Step7Media;
