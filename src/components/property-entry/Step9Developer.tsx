import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { inputClasses, labelClasses, helpTextClasses, sectionHeaderClasses, sectionTitleClasses, sectionDescClasses, cardClasses } from './sharedStyles';

const Step9Developer: React.FC = () => {
  const { formData, updateFormData } = useFormContext();

  const disabledInputClasses = "w-full px-3 py-2.5 bg-gray-100 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg outline-none cursor-not-allowed text-gray-500 dark:text-zinc-500 text-sm";

  return (
    <div className="space-y-8">
      <div className={sectionHeaderClasses}>
        <h2 className={sectionTitleClasses}>Developer Details & Description</h2>
        <p className={sectionDescClasses}>Optional but recommended information</p>
      </div>

      {/* Description Section */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-black dark:text-white flex items-center gap-2">
          <span className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-xs">1</span>
          Project Description
        </h3>

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

      {/* Developer Information Section */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-black dark:text-white flex items-center gap-2">
          <span className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-xs">2</span>
          Developer Information
        </h3>

        <div className={cardClasses}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelClasses}>
                Developer Name
              </label>
              <input
                type="text"
                value={formData.developer}
                className={disabledInputClasses}
                disabled
              />
              <p className={helpTextClasses}>From Step 1</p>
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Email
              </label>
              <input
                type="email"
                value={formData.developer_email}
                onChange={(e) => updateFormData({ developer_email: e.target.value })}
                className={inputClasses}
                placeholder="contact@developer.com"
              />
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Phone
              </label>
              <input
                type="tel"
                value={formData.developer_phone}
                onChange={(e) => updateFormData({ developer_phone: e.target.value })}
                className={inputClasses}
                placeholder="+971 4 XXX XXXX"
              />
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Working Hours
              </label>
              <input
                type="text"
                value={formData.developer_working_hours}
                onChange={(e) => updateFormData({ developer_working_hours: e.target.value })}
                className={inputClasses}
                placeholder="Mon-Sat 9:30 AM - 6:30 PM"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className={labelClasses}>
                Office Address
              </label>
              <input
                type="text"
                value={formData.developer_office}
                onChange={(e) => updateFormData({ developer_office: e.target.value })}
                className={inputClasses}
                placeholder="Office address"
              />
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Website
              </label>
              <input
                type="url"
                value={formData.developer_website}
                onChange={(e) => updateFormData({ developer_website: e.target.value })}
                className={inputClasses}
                placeholder="https://developer.com"
              />
            </div>

            <div className="space-y-2">
              <label className={labelClasses}>
                Logo URL
              </label>
              <input
                type="url"
                value={formData.developer_logo_url}
                onChange={(e) => updateFormData({ developer_logo_url: e.target.value })}
                className={inputClasses}
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className={labelClasses}>
                About Developer
              </label>
              <textarea
                value={formData.developer_description}
                onChange={(e) => updateFormData({ developer_description: e.target.value })}
                className={inputClasses}
                rows={4}
                placeholder="Brief description of the developer's background and portfolio..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step9Developer;
