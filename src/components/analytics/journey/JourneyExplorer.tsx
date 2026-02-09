import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import VisitorList, { VisitorSummary } from './VisitorList';
import JourneyTimeline from './JourneyTimeline';
import { JourneyEvent } from './JourneyEventCard';

interface JourneyExplorerProps {
  dateFilter: string;
}

const JourneyExplorer: React.FC<JourneyExplorerProps> = ({ dateFilter }) => {
  const [visitors, setVisitors] = useState<VisitorSummary[]>([]);
  const [selectedVisitor, setSelectedVisitor] = useState<string | null>(null);
  const [journeyEvents, setJourneyEvents] = useState<JourneyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [journeyLoading, setJourneyLoading] = useState(false);

  useEffect(() => {
    fetchRecentVisitors();
  }, [dateFilter]);

  const fetchRecentVisitors = async () => {
    setLoading(true);
    try {
      // Fetch recent visitors
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitor_fingerprints')
        .select('id, fingerprint_hash, first_seen_at, last_seen_at, linked_user_id, platform')
        .gte('last_seen_at', dateFilter)
        .order('last_seen_at', { ascending: false })
        .limit(50);

      if (visitorError) throw visitorError;
      if (!visitorData || visitorData.length === 0) {
        setVisitors([]);
        setLoading(false);
        return;
      }

      const visitorIds = visitorData.map((v) => v.id);

      // Get event counts for each visitor
      const { data: eventCounts } = await supabase
        .from('user_activity_events')
        .select('visitor_fingerprint_id, event_type')
        .in('visitor_fingerprint_id', visitorIds)
        .gte('created_at', dateFilter);

      // Aggregate counts
      const countsMap: Record<string, { total: number; propertyViews: number }> = {};
      eventCounts?.forEach((e) => {
        if (!countsMap[e.visitor_fingerprint_id]) {
          countsMap[e.visitor_fingerprint_id] = { total: 0, propertyViews: 0 };
        }
        countsMap[e.visitor_fingerprint_id].total++;
        if (e.event_type === 'property_view_details') {
          countsMap[e.visitor_fingerprint_id].propertyViews++;
        }
      });

      const mappedVisitors: VisitorSummary[] = visitorData.map((v) => ({
        visitorId: v.id,
        fingerprintHash: v.fingerprint_hash?.substring(0, 8) + '...' || 'Unknown',
        firstSeen: v.first_seen_at,
        lastSeen: v.last_seen_at,
        isAuthenticated: !!v.linked_user_id,
        platform: v.platform || 'Unknown',
        totalEvents: countsMap[v.id]?.total || 0,
        propertiesViewed: countsMap[v.id]?.propertyViews || 0,
      }));

      setVisitors(mappedVisitors);
    } catch (error) {
      console.error('Error fetching visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVisitorClick = async (visitorId: string) => {
    setSelectedVisitor(visitorId);
    setJourneyLoading(true);
    try {
      // Fetch all events for this visitor
      const { data: events, error } = await supabase
        .from('user_activity_events')
        .select('id, event_type, property_id, created_at, source_page, metadata')
        .eq('visitor_fingerprint_id', visitorId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!events || events.length === 0) {
        setJourneyEvents([]);
        setJourneyLoading(false);
        return;
      }

      // Get property names for events with property_id
      const propertyIds = [...new Set(events.filter((e) => e.property_id).map((e) => e.property_id))];
      let propertyNames: Record<number, string> = {};

      if (propertyIds.length > 0) {
        const { data: properties } = await supabase
          .from('properties')
          .select('id, name')
          .in('id', propertyIds);

        if (properties) {
          properties.forEach((p: { id: number; name: string }) => {
            propertyNames[p.id] = p.name;
          });
        }
      }

      const mappedEvents: JourneyEvent[] = events.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        propertyId: e.property_id,
        propertyName: e.property_id
          ? propertyNames[e.property_id] || `Property #${e.property_id}`
          : null,
        createdAt: e.created_at,
        sourcePage: e.source_page || '',
        metadata: (e.metadata as Record<string, unknown>) || {},
      }));

      setJourneyEvents(mappedEvents);
    } catch (error) {
      console.error('Error fetching journey:', error);
    } finally {
      setJourneyLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
      <h3 className="text-sm font-medium text-black dark:text-white mb-4">Journey Explorer</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Visitor List */}
        <div className="h-[400px] overflow-y-auto border border-gray-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900">
          <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-3 py-2 z-10">
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-500">
              Recent Visitors ({visitors.length})
            </span>
          </div>
          <VisitorList
            visitors={visitors}
            selectedId={selectedVisitor}
            onSelect={handleVisitorClick}
            loading={loading}
          />
        </div>

        {/* Journey Timeline */}
        <div className="h-[400px] overflow-y-auto border border-gray-200 dark:border-zinc-800 rounded bg-gray-50 dark:bg-zinc-950">
          <div className="sticky top-0 bg-gray-50 dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-3 py-2 z-10">
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-500">
              {selectedVisitor ? `Events (${journeyEvents.length})` : 'Select a visitor'}
            </span>
          </div>
          {selectedVisitor ? (
            <JourneyTimeline events={journeyEvents} loading={journeyLoading} />
          ) : (
            <div className="flex items-center justify-center h-[350px] text-gray-500 dark:text-zinc-500 text-sm">
              Select a visitor to view their journey
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JourneyExplorer;
