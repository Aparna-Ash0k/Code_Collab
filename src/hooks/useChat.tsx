import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthWrapper';
import { supabase } from '../utils/supabase/client';
import { getNetworkConfig } from '../utils/networkUtils';
// TODO: Import Firebase Firestore for real-time messaging when ready
// import { db } from '../utils/firebase/client';

export interface ChatMessage {
  id: string;
  content: string;
  type: 'text' | 'code' | 'file';
  user_id: string;
  user_name: string;
  created_at: string;
  project_id: string;
}

export function useChat(projectId: string) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    console.log('Making Chat API call to:', endpoint);
    
    // Always get fresh session for each API call
    const sessionResponse = await supabase.auth.getSession() as any;
    const freshSession = sessionResponse?.data?.session;
    
    console.log('Chat API - Fresh session:', freshSession ? 'exists' : 'null');
    
    // Detect and handle fake token
    if (freshSession?.access_token === 'firebase-token') {
      console.log('🚨 DETECTED FAKE TOKEN in Chat API call - using dev-token instead');
      freshSession.access_token = 'dev-token';
    }
    
    // Get dynamic network configuration
    const networkConfig = await getNetworkConfig(3002);
    console.log('🌐 Using network config for chat:', networkConfig);
    
    const response = await fetch(`${networkConfig.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshSession?.access_token || 'dev-token'}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API call failed');
    }

    return response.json();
  };

  const fetchMessages = useCallback(async () => {
    if (!projectId || !session) return;
    
    try {
      setLoading(true);
      const data = await apiCall(`/projects/${projectId}/messages`);
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, session]);

  const sendMessage = async (content: string, type: 'text' | 'code' | 'file' = 'text') => {
    if (!projectId || !session) return;

    try {
      const data = await apiCall(`/projects/${projectId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type }),
      });
      
      setMessages(prev => [...prev, data.message]);
      return data.message;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  // Set up polling for new messages (temporary until Firebase real-time is implemented)
  useEffect(() => {
    if (!projectId || !session) return;

    fetchMessages();

    // Poll for new messages every 3 seconds
    const messagePolling = setInterval(() => {
      fetchMessages();
    }, 3000);

    return () => {
      clearInterval(messagePolling);
    };
  }, [projectId, session, fetchMessages]);

  return {
    messages,
    loading,
    sendMessage,
    fetchMessages,
  };
}