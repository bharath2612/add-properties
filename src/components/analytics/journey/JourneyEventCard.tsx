import React from 'react';

export interface JourneyEvent {
  id: number;
  eventType: string;
  propertyId: number | null;
  propertyName: string | null;
  createdAt: string;
  sourcePage: string;
  metadata: Record<string, unknown>;
}

const EVENT_COLORS: Record<string, string> = {
  session_start: '#6366f1',
  page_view: '#8b5cf6',
  search_query: '#ec4899',
  property_card_click: '#3b82f6',
  property_view_details: '#10b981',
  property_map_marker_click: '#f59e0b',
  property_save: '#ef4444',
  property_unsave: '#6b7280',
  property_share: '#a855f7',
  property_detail_view_start: '#14b8a6',
  property_detail_view_end: '#0d9488',
  session_end: '#71717a',
};

const EVENT_LABELS: Record<string, string> = {
  session_start: 'Session Started',
  page_view: 'Viewed Page',
  search_query: 'Searched',
  property_card_click: 'Clicked Property Card',
  property_view_details: 'Viewed Property Details',
  property_map_marker_click: 'Clicked Map Marker',
  property_save: 'Saved Property',
  property_unsave: 'Unsaved Property',
  property_share: 'Shared Property',
  property_detail_view_start: 'Started Viewing',
  property_detail_view_end: 'Finished Viewing',
  session_end: 'Session Ended',
};

interface JourneyEventCardProps {
  event: JourneyEvent;
}

const JourneyEventCard: React.FC<JourneyEventCardProps> = ({ event }) => {
  const color = EVENT_COLORS[event.eventType] || '#6b7280';
  const time = new Date(event.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="relative">
      {/* Timeline dot */}
      <div
        className="absolute -left-[21px] w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900"
        style={{ backgroundColor: color }}
      />

      <div className="bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800 p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-black dark:text-white">
            {EVENT_LABELS[event.eventType] || event.eventType}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-zinc-600">{time}</span>
        </div>

        {event.propertyName && (
          <p className="text-[11px] text-gray-600 dark:text-zinc-400 truncate">
            {event.propertyName}
          </p>
        )}

        {event.sourcePage && event.eventType === 'page_view' && (
          <p className="text-[10px] text-gray-500 dark:text-zinc-500 truncate">
            {event.sourcePage}
          </p>
        )}

        {typeof event.metadata.query === 'string' && event.metadata.query ? (
          <p className="text-[10px] text-pink-600 dark:text-pink-400 truncate mt-1">
            "{event.metadata.query}"
          </p>
        ) : null}

        {typeof event.metadata.durationSeconds === 'number' && event.metadata.durationSeconds ? (
          <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-1">
            Duration: {event.metadata.durationSeconds}s
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default JourneyEventCard;
