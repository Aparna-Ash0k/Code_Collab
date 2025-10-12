import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthWrapper';
import { supabase } from '../utils/supabase/client';
import { getNetworkConfig } from '../utils/networkUtils';
// TODO: Import Firebase Firestore for real-time presence when ready
// import { db } from '../utils/firebase/client';

export interface UserPresence {
  user_id: string;
  user_name: string;
  user_avatar: string;
  file: string | null;
  cursor: { line: number; column: number } | null;
  last_seen: string;
}

export function usePresence(projectId: string) {
  const { session } = useAuth();
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(false);

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    console.log('Making Presence API call to:', endpoint);
    
    // Always get fresh session for each API call
    const sessionResponse = await supabase.auth.getSession() as any;
    const freshSession = sessionResponse?.data?.session;
    
    console.log('Presence API - Fresh session:', freshSession ? 'exists' : 'null');
    
    // Detect and handle fake token
    if (freshSession?.access_token === 'firebase-token') {
      console.log('🚨 DETECTED FAKE TOKEN in Presence API call - using dev-token instead');
      freshSession.access_token = 'dev-token';
    }
    
    // Get dynamic network configuration
    const networkConfig = await getNetworkConfig(3002);
    console.log('🌐 Using network config for presence:', networkConfig);
    
    const response = await fetch(`${networkConfig.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshSession?.access_token || 'dev-token'}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = 'API call failed';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      console.error('Presence API Error:', errorMessage);
      throw new Error(errorMessage);
    }

    return response.json();
  };

  const updatePresence = useCallback(async (file: string | null, cursor: { line: number; column: number } | null = null) => {
    if (!projectId || !session) {
      console.log('Skipping presence update: missing projectId or session');
      return;
    }

    try {
      console.log('Updating presence for project:', projectId, 'file:', file, 'cursor:', cursor);
      await apiCall(`/projects/${projectId}/presence`, {
        method: 'POST',
        body: JSON.stringify({ file, cursor }),
      });
    } catch (error) {
      console.error('Failed to update presence:', error);
      // Don't throw the error to prevent breaking the UI
    }
  }, [projectId, session]);

  const fetchPresence = useCallback(async () => {
    if (!projectId || !session) return;
    
    try {
      setLoading(true);
      const data = await apiCall(`/projects/${projectId}/presence`);
      setActiveUsers(data.presence);
    } catch (error) {
      console.error('Failed to fetch presence:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, session]);

  // Set up polling for presence updates (temporary until Firebase real-time is implemented)
  useEffect(() => {
    if (!projectId || !session) return;

    fetchPresence();

    // Poll for presence updates every 3 seconds
    const presencePolling = setInterval(() => {
      fetchPresence();
    }, 3000);

    // Send periodic presence updates every 15 seconds
    const presenceUpdate = setInterval(() => {
      updatePresence(null); // Just update the last_seen timestamp
    }, 15000);

    return () => {
      clearInterval(presencePolling);
      clearInterval(presenceUpdate);
    };
  }, [projectId, session, updatePresence, fetchPresence]);

  return {
    activeUsers,
    loading,
    updatePresence,
    fetchPresence,
  };
}