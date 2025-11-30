import React from 'react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps }) => {
  const percentage = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full mb-8">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-gray-600 dark:text-zinc-400">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm font-medium text-black dark:text-white">{Math.round(percentage)}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-2">
        <div
          className="bg-black dark:bg-white h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;

