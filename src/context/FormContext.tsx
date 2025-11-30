import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { FormData, initialFormData } from '../types/property.types';

interface FormContextType {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  resetFormData: () => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

const STORAGE_KEY = 'property_entry_form_data';
const AUTH_STORAGE_KEY = 'property_entry_auth';

export const FormProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [formData, setFormData] = useState<FormData>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : initialFormData;
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, isAuthenticated.toString());
  }, [isAuthenticated]);

  const updateFormData = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const resetFormData = () => {
    setFormData(initialFormData);
    setCurrentStep(0);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <FormContext.Provider
      value={{
        formData,
        updateFormData,
        resetFormData,
        currentStep,
        setCurrentStep,
        isAuthenticated,
        setIsAuthenticated,
      }}
    >
      {children}
    </FormContext.Provider>
  );
};

export const useFormContext = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within FormProvider');
  }
  return context;
};

