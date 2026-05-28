import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type EventCategory = 
  | 'navigation' 
  | 'task' 
  | 'event' 
  | 'habit' 
  | 'goal' 
  | 'note' 
  | 'contact' 
  | 'contract' 
  | 'call' 
  | 'chat' 
  | 'ai' 
  | 'search' 
  | 'auth'
  | 'settings'
  | 'project';

type EventType = 
  // Navigation
  | 'page_view' | 'panel_open' | 'panel_close'
  // CRUD
  | 'create' | 'update' | 'delete' | 'complete' | 'archive'
  // Interactions
  | 'click' | 'search' | 'filter' | 'sort' | 'export' | 'import'
  // AI
  | 'ai_chat' | 'ai_assistant' | 'ai_breakdown' | 'ai_voice'
  // Auth
  | 'login' | 'logout' | 'signup'
  // Special
  | 'focus_start' | 'focus_complete' | 'habit_checkin' | 'call_start' | 'call_end';

interface TrackEventOptions {
  category: EventCategory;
  action: EventType;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
}

// Generate a session ID that persists for the browser session
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

export function useAnalytics() {
  const { user } = useAuth();
  const sessionId = useRef(getSessionId());
  const lastPageView = useRef<string>('');

  // Track page view on route change
  const trackPageView = useCallback(async (path: string) => {
    if (!user || path === lastPageView.current) return;
    lastPageView.current = path;

    try {
      await supabase.from('analytics_events').insert({
        user_id: user.id,
        event_type: 'page_view',
        event_category: 'navigation',
        page_path: path,
        session_id: sessionId.current,
        event_data: {
          referrer: document.referrer,
          screen_width: window.innerWidth,
          screen_height: window.innerHeight,
        }
      });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }, [user]);

  // Generic event tracking
  const trackEvent = useCallback(async ({
    category,
    action,
    label,
    value,
    metadata = {}
  }: TrackEventOptions) => {
    if (!user) return;

    try {
      await supabase.from('analytics_events').insert({
        user_id: user.id,
        event_type: action,
        event_category: category,
        page_path: window.location.pathname,
        session_id: sessionId.current,
        event_data: {
          label,
          value,
          ...metadata
        }
      });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }, [user]);

  // Convenience methods for common actions
  const trackCreate = useCallback((category: EventCategory, itemId: string, metadata?: Record<string, unknown>) => {
    trackEvent({ category, action: 'create', label: itemId, metadata });
  }, [trackEvent]);

  const trackUpdate = useCallback((category: EventCategory, itemId: string, metadata?: Record<string, unknown>) => {
    trackEvent({ category, action: 'update', label: itemId, metadata });
  }, [trackEvent]);

  const trackDelete = useCallback((category: EventCategory, itemId: string, metadata?: Record<string, unknown>) => {
    trackEvent({ category, action: 'delete', label: itemId, metadata });
  }, [trackEvent]);

  const trackComplete = useCallback((category: EventCategory, itemId: string, metadata?: Record<string, unknown>) => {
    trackEvent({ category, action: 'complete', label: itemId, metadata });
  }, [trackEvent]);

  const trackAIUsage = useCallback((functionName: string, metadata?: Record<string, unknown>) => {
    trackEvent({ category: 'ai', action: 'ai_chat', label: functionName, metadata });
  }, [trackEvent]);

  const trackPanelOpen = useCallback((panelName: string) => {
    trackEvent({ category: 'navigation', action: 'panel_open', label: panelName });
  }, [trackEvent]);

  const trackSearch = useCallback((query: string, resultCount: number) => {
    trackEvent({ category: 'search', action: 'search', label: query, value: resultCount });
  }, [trackEvent]);

  return {
    trackPageView,
    trackEvent,
    trackCreate,
    trackUpdate,
    trackDelete,
    trackComplete,
    trackAIUsage,
    trackPanelOpen,
    trackSearch,
  };
}
