import React from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, required, helpText, children }) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {helpText && (
        <p className="text-xs text-gray-500 dark:text-zinc-500">{helpText}</p>
      )}
    </div>
  );
};

export default FormField;

