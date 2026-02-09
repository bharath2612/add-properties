import React from 'react';
import JourneyEventCard, { JourneyEvent } from './JourneyEventCard';

interface JourneyTimelineProps {
  events: JourneyEvent[];
  loading: boolean;
}

const JourneyTimeline: React.FC<JourneyTimelineProps> = ({ events, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
        No events found for this visitor
      </div>
    );
  }

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.createdAt).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, JourneyEvent[]>);

  return (
    <div className="p-3 space-y-4">
      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <div key={date}>
          <div className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 mb-2 sticky top-0 bg-gray-50 dark:bg-zinc-950 py-1 z-10">
            {date}
          </div>
          <div className="relative pl-4 border-l-2 border-gray-200 dark:border-zinc-700 space-y-3">
            {dateEvents.map((event) => (
              <JourneyEventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default JourneyTimeline;
