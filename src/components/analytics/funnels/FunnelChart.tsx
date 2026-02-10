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
  const maxValue = data[0]?.value || 1;

  const processedData = data.map((step, index) => {
    const percentage = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
    const prevValue = index > 0 ? data[index - 1].value : step.value;
    const dropOffRate =
      index > 0 && prevValue > 0
        ? ((prevValue - step.value) / prevValue) * 100
        : 0;
    return { ...step, percentage, dropOffRate };
  });

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-black dark:text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-black dark:text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-zinc-500 text-sm">
          No data available
        </div>
      </div>
    );
  }

  // Build SVG funnel shape
  const stepCount = processedData.length;
  const funnelWidth = 160;
  const funnelHeight = stepCount * 64;
  const centerX = funnelWidth / 2;
  const minWidth = 24; // narrowest part of the funnel

  // Calculate widths for each step (top = full width, bottom = narrow)
  const stepWidths = processedData.map((step) => {
    const ratio = step.value / maxValue;
    return Math.max(minWidth, ratio * funnelWidth);
  });

  // Build the funnel path with smooth curves
  const buildFunnelPath = () => {
    const points: string[] = [];
    const stepH = funnelHeight / stepCount;

    // Left side (top to bottom)
    for (let i = 0; i <= stepCount; i++) {
      const y = i * stepH;
      const w = i < stepCount ? stepWidths[i] : stepWidths[stepCount - 1];
      const x = centerX - w / 2;
      if (i === 0) {
        points.push(`M ${x} ${y}`);
      } else {
        const prevW = stepWidths[Math.max(0, i - 1)];
        const prevX = centerX - prevW / 2;
        const midY = y - stepH / 2;
        points.push(`C ${prevX} ${midY}, ${x} ${midY}, ${x} ${y}`);
      }
    }

    // Right side (bottom to top)
    for (let i = stepCount; i >= 0; i--) {
      const y = i * (funnelHeight / stepCount);
      const w = i < stepCount ? stepWidths[i] : stepWidths[stepCount - 1];
      const x = centerX + w / 2;
      if (i === stepCount) {
        points.push(`L ${x} ${y}`);
      } else {
        const nextW = stepWidths[Math.min(stepCount - 1, i + 1)];
        const nextX = centerX + nextW / 2;
        const nextY = (i + 1) * stepH;
        const midY = nextY - stepH / 2;
        points.push(`C ${nextX} ${midY}, ${x} ${midY}, ${x} ${y}`);
      }
    }

    points.push('Z');
    return points.join(' ');
  };

  return (
    <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-black dark:text-white mb-5">{title}</h3>

      <div className="flex items-start gap-4">
        {/* Funnel SVG */}
        <div className="flex-shrink-0">
          <svg
            width={funnelWidth}
            height={funnelHeight}
            viewBox={`0 0 ${funnelWidth} ${funnelHeight}`}
          >
            <defs>
              <linearGradient id={`grad-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                {processedData.map((step, i) => (
                  <stop
                    key={i}
                    offset={`${(i / (stepCount - 1)) * 100}%`}
                    stopColor={step.color}
                    stopOpacity={0.85}
                  />
                ))}
              </linearGradient>
              {/* Glass highlight */}
              <linearGradient id={`highlight-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                <stop offset="40%" stopColor="white" stopOpacity="0.08" />
                <stop offset="60%" stopColor="white" stopOpacity="0" />
                <stop offset="100%" stopColor="white" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            {/* Funnel body */}
            <path
              d={buildFunnelPath()}
              fill={`url(#grad-${title.replace(/\s/g, '')})`}
            />
            {/* Glass-like highlight overlay */}
            <path
              d={buildFunnelPath()}
              fill={`url(#highlight-${title.replace(/\s/g, '')})`}
            />
            {/* Step divider lines */}
            {processedData.slice(1).map((_, i) => {
              const y = (i + 1) * (funnelHeight / stepCount);
              const w1 = stepWidths[i];
              const w2 = stepWidths[i + 1];
              const avgW = (w1 + w2) / 2;
              return (
                <line
                  key={i}
                  x1={centerX - avgW / 2}
                  y1={y}
                  x2={centerX + avgW / 2}
                  y2={y}
                  stroke="white"
                  strokeOpacity="0.25"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
        </div>

        {/* Stats table */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 pb-2 mb-1 border-b border-gray-200 dark:border-zinc-800">
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Stage
            </span>
            <span className="w-16 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Conv.
            </span>
            <span className="w-14 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Count
            </span>
          </div>

          {/* Rows */}
          {processedData.map((step, index) => {
            const stepH = funnelHeight / stepCount;
            const rowHeight = stepH;

            return (
              <div
                key={step.name}
                className="flex items-center gap-2 border-b border-gray-100 dark:border-zinc-800/50 last:border-0"
                style={{ height: rowHeight }}
              >
                {/* Stage name + drop-off */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: step.color }}
                    />
                    <span className="text-xs font-medium text-black dark:text-white truncate">
                      {step.name}
                    </span>
                  </div>
                  {index > 0 && step.dropOffRate > 0 && (
                    <span className="ml-3.5 text-[10px] text-red-500 dark:text-red-400">
                      -{step.dropOffRate.toFixed(0)}% drop
                    </span>
                  )}
                </div>

                {/* Conversion % */}
                <span className="w-16 text-right text-xs font-medium text-gray-600 dark:text-zinc-400">
                  {step.percentage.toFixed(0)}%
                </span>

                {/* Count */}
                <span className="w-14 text-right text-sm font-bold text-black dark:text-white tabular-nums">
                  {step.value.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FunnelChart;
