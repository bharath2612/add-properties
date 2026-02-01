import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface LiveEvent {
  id: number;
  eventType: string;
  propertyId: number | null;
  propertyName: string | null;
  createdAt: string;
  deviceType: string;
  browser: string;
  sourcePage: string;
  isLoggedIn: boolean;
}

interface ActiveSession {
  id: string;
  deviceType: string;
  lastActivityAt: string;
  pageViews: number;
  propertyViews: number;
  isLoggedIn: boolean;
}

interface RealtimeStats {
  activeNow: number;
  last5Min: number;
  last15Min: number;
  eventsPerMinute: number;
}

const EVENT_COLORS: Record<string, string> = {
  property_card_click: '#3b82f6',
  property_view_details: '#10b981',
  property_map_marker_click: '#f59e0b',
  property_save: '#ef4444',
  property_unsave: '#6b7280',
  property_share: '#8b5cf6',
  page_view: '#6366f1',
  search_query: '#ec4899',
};

const EVENT_LABELS: Record<string, string> = {
  property_card_click: 'Card Click',
  property_view_details: 'View Details',
  property_map_marker_click: 'Map Marker Click',
  property_save: 'Property Saved',
  property_unsave: 'Property Unsaved',
  property_share: 'Property Shared',
  page_view: 'Page View',
  search_query: 'Search Query',
  property_detail_view_start: 'Started Viewing',
  property_detail_view_end: 'Finished Viewing',
};

const RealtimePage: React.FC = () => {
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [stats, setStats] = useState<RealtimeStats>({
    activeNow: 0,
    last5Min: 0,
    last15Min: 0,
    eventsPerMinute: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const eventsRef = useRef<LiveEvent[]>([]);

  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(() => {
      if (!isPaused) {
        fetchRealtimeStats();
        fetchLiveEvents();
      }
    }, 5000); // Refresh every 5 seconds

    // Set up realtime subscription
    const channel = supabase
      .channel('realtime-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activity_events',
        },
        (payload) => {
          if (!isPaused) {
            handleNewEvent(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isPaused]);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchRealtimeStats(), fetchLiveEvents(), fetchActiveSessions()]);
    setLoading(false);
  };

  const fetchRealtimeStats = async () => {
    try {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
      const oneMinAgo = new Date(now.getTime() - 60 * 1000).toISOString();

      const [activeNowResult, last5MinResult, last15MinResult, eventsLastMinResult] = await Promise.all([
        // Active sessions (last 2 minutes)
        supabase
          .from('user_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .gte('last_activity_at', new Date(now.getTime() - 2 * 60 * 1000).toISOString()),

        // Events in last 5 minutes
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', fiveMinAgo),

        // Events in last 15 minutes
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', fifteenMinAgo),

        // Events per minute
        supabase
          .from('user_activity_events')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', oneMinAgo),
      ]);

      setStats({
        activeNow: activeNowResult.count || 0,
        last5Min: last5MinResult.count || 0,
        last15Min: last15MinResult.count || 0,
        eventsPerMinute: eventsLastMinResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching realtime stats:', error);
    }
  };

  const fetchLiveEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity_events')
        .select('id, event_type, property_id, created_at, device_type, browser, source_page, user_id')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get property names
      const propertyIds = [...new Set((data || []).filter(e => e.property_id).map(e => e.property_id))];
      let propertyNames: Record<number, string> = {};

      if (propertyIds.length > 0) {
        const { data: properties } = await supabase
          .from('properties')
          .select('id, name')
          .in('id', propertyIds);

        if (properties) {
          properties.forEach((p: any) => {
            propertyNames[p.id] = p.name;
          });
        }
      }

      const events: LiveEvent[] = (data || []).map((e: any) => ({
        id: e.id,
        eventType: e.event_type,
        propertyId: e.property_id,
        propertyName: e.property_id ? propertyNames[e.property_id] || `Property #${e.property_id}` : null,
        createdAt: e.created_at,
        deviceType: e.device_type || 'unknown',
        browser: e.browser || 'unknown',
        sourcePage: e.source_page || '/',
        isLoggedIn: !!e.user_id,
      }));

      eventsRef.current = events;
      setLiveEvents(events);
    } catch (error) {
      console.error('Error fetching live events:', error);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('user_sessions')
        .select('id, device_type, last_activity_at, page_views, property_views, user_id')
        .eq('is_active', true)
        .gte('last_activity_at', twoMinAgo)
        .order('last_activity_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const sessions: ActiveSession[] = (data || []).map((s: any) => ({
        id: s.id,
        deviceType: s.device_type || 'unknown',
        lastActivityAt: s.last_activity_at,
        pageViews: s.page_views || 0,
        propertyViews: s.property_views || 0,
        isLoggedIn: !!s.user_id,
      }));

      setActiveSessions(sessions);
    } catch (error) {
      console.error('Error fetching active sessions:', error);
    }
  };

  const handleNewEvent = async (newRecord: any) => {
    // Get property name if needed
    let propertyName = null;
    if (newRecord.property_id) {
      const { data } = await supabase
        .from('properties')
        .select('name')
        .eq('id', newRecord.property_id)
        .single();
      propertyName = data?.name || `Property #${newRecord.property_id}`;
    }

    const newEvent: LiveEvent = {
      id: newRecord.id,
      eventType: newRecord.event_type,
      propertyId: newRecord.property_id,
      propertyName,
      createdAt: newRecord.created_at,
      deviceType: newRecord.device_type || 'unknown',
      browser: newRecord.browser || 'unknown',
      sourcePage: newRecord.source_page || '/',
      isLoggedIn: !!newRecord.user_id,
    };

    // Add to beginning and keep last 50
    eventsRef.current = [newEvent, ...eventsRef.current.slice(0, 49)];
    setLiveEvents([...eventsRef.current]);

    // Update stats
    setStats((prev) => ({
      ...prev,
      eventsPerMinute: prev.eventsPerMinute + 1,
      last5Min: prev.last5Min + 1,
    }));
  };

  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'tablet':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 dark:border-zinc-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
          </div>
          <div>
            <h1 className="text-lg font-medium text-black dark:text-white">Realtime Activity</h1>
            <p className="text-xs text-gray-500 dark:text-zinc-500">Live user activity feed</p>
          </div>
        </div>
        <button
          onClick={() => setIsPaused(!isPaused)}
          className={`px-4 py-2 text-xs font-medium rounded transition-colors ${
            isPaused
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-700'
          }`}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Realtime Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-xs text-gray-500 dark:text-zinc-500">Active Now</p>
          </div>
          <p className="text-2xl font-medium text-green-600 dark:text-green-400">{stats.activeNow}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Last 5 Min</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.last5Min}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Last 15 Min</p>
          <p className="text-2xl font-medium text-black dark:text-white">{stats.last15Min}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Events/Min</p>
          <p className="text-2xl font-medium text-blue-600 dark:text-blue-400">{stats.eventsPerMinute}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Event Feed */}
        <div className="lg:col-span-2 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-black dark:text-white">Live Events</h3>
            <span className="text-[10px] text-gray-500 dark:text-zinc-500">
              {liveEvents.length} events shown
            </span>
          </div>
          <div className="h-[500px] overflow-y-auto space-y-2">
            {liveEvents.length > 0 ? (
              liveEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 p-3 bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800 transition-all ${
                    index === 0 ? 'ring-2 ring-green-500/20' : ''
                  }`}
                >
                  <div
                    className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: EVENT_COLORS[event.eventType] || '#6b7280' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-black dark:text-white">
                        {EVENT_LABELS[event.eventType] || event.eventType}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        event.isLoggedIn
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                      }`}>
                        {event.isLoggedIn ? 'User' : 'Visitor'}
                      </span>
                    </div>
                    {event.propertyName && (
                      <p className="text-xs text-gray-600 dark:text-zinc-400 truncate mb-1">
                        {event.propertyName}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-600">
                      <span className="flex items-center gap-1">
                        {getDeviceIcon(event.deviceType)}
                        {event.deviceType}
                      </span>
                      <span>•</span>
                      <span className="truncate">{event.sourcePage}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-600 whitespace-nowrap">
                    {formatTimeAgo(event.createdAt)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                Waiting for events...
              </div>
            )}
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-black dark:text-white">Active Sessions</h3>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600 dark:text-green-400">{activeSessions.length}</span>
            </div>
          </div>
          <div className="h-[500px] overflow-y-auto space-y-2">
            {activeSessions.length > 0 ? (
              activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3 bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-zinc-400">
                        {getDeviceIcon(session.deviceType)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        session.isLoggedIn
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                      }`}>
                        {session.isLoggedIn ? 'User' : 'Visitor'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                      {formatTimeAgo(session.lastActivityAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <div>
                      <span className="text-gray-400 dark:text-zinc-600">Pages: </span>
                      <span className="text-black dark:text-white font-medium">{session.pageViews}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-zinc-600">Properties: </span>
                      <span className="text-black dark:text-white font-medium">{session.propertyViews}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-zinc-500 text-sm">
                No active sessions
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimePage;
