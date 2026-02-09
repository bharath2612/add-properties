import React from 'react';

export interface FunnelStep {
  name: string;
  value: number;
  color: string;
}

interface FunnelChartProps {
  title: string;
  data: FunnelStep[];
  loading?: boolean;
}

const FunnelChart: React.FC<FunnelChartProps> = ({ title, data, loading }) => {
  // Calculate percentages and drop-off rates
  const processedData = data.map((step, index) => {
    const maxValue = data[0]?.value || 1;
    const prevValue = index > 0 ? data[index - 1].value : step.value;
    const percentage = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
    const dropOffRate = index > 0 && prevValue > 0
      ? ((prevValue - step.value) / prevValue * 100)
      : 0;

    return { ...step, percentage, dropOffRate };
  });

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <h3 className="text-sm font-medium text-black dark:text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
        <h3 className="text-sm font-medium text-black dark:text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-zinc-500 text-sm">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
      <h3 className="text-sm font-medium text-black dark:text-white mb-4">{title}</h3>
      <div className="space-y-3">
        {processedData.map((step, index) => (
          <div key={step.name} className="relative">
            {/* Step header with value and drop-off */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium"
                  style={{ backgroundColor: step.color + '20', color: step.color }}
                >
                  {index + 1}
                </span>
                <span className="text-xs font-medium text-black dark:text-white">{step.name}</span>
                <span className="text-xs text-gray-500 dark:text-zinc-500">
                  ({step.value.toLocaleString()})
                </span>
              </div>
              {index > 0 && step.dropOffRate > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  -{step.dropOffRate.toFixed(1)}% drop
                </span>
              )}
            </div>
            {/* Funnel bar */}
            <div className="relative h-7 bg-gray-200 dark:bg-zinc-800 rounded overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full rounded transition-all duration-500"
                style={{
                  width: `${Math.max(step.percentage, step.value > 0 ? 2 : 0)}%`,
                  backgroundColor: step.color,
                }}
              />
              {/* Percentage label */}
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-gray-600 dark:text-zinc-400">
                {step.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FunnelChart;
