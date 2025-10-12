import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase, AuthState } from '../utils/supabase/client';
import { AuthModal } from './AuthModal';

const AuthContext = createContext<AuthState & {
  signOut: () => Promise<void>;
}>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthWrapperProps {
  children: ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isDevMode = import.meta.env?.VITE_DEV_MODE === 'true';

  console.log('🔍 Environment check:', {
    VITE_DEV_MODE: import.meta.env?.VITE_DEV_MODE,
    isDevMode: isDevMode,
    envType: typeof import.meta.env?.VITE_DEV_MODE
  });

  useEffect(() => {
    // In dev mode, skip real authentication
    if (isDevMode) {
      console.log('Dev mode: Simulating authenticated user');
      setAuthState({
        user: { 
          id: 'dev-user-123', 
          email: 'dev@example.com',
          user_metadata: { name: 'Dev User' }
        } as any,
        session: { 
          access_token: 'dev-token',
          user: { id: 'dev-user-123', email: 'dev@example.com' }
        } as any,
        loading: false,
      });
      setShowAuthModal(false);
      return;
    }

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔄 Getting initial session...');
        const sessionResponse = await supabase.auth.getSession() as any;
        const session = sessionResponse.data?.session || null;
        
        console.log('Initial session check:', { 
          hasSession: !!session, 
          hasUser: !!session?.user,
          sessionKeys: session ? Object.keys(session) : [],
          accessToken: session?.access_token ? `${session.access_token.substring(0, 50)}...` : 'missing',
          tokenLength: session?.access_token?.length || 0
        });
        
        if (session?.access_token === 'firebase-token') {
          console.log('🚨 DETECTED FAKE TOKEN - Clearing session and forcing re-auth');
          // Force clear the fake session
          setAuthState({
            user: null,
            session: null,
            loading: false,
          });
          setShowAuthModal(true);
          return;
        }
        
        if (session) {
          console.log('Session object structure:', session);
        }
        
        setAuthState({
          user: session?.user || null,
          session,
          loading: false,
        });

        if (!session) {
          setShowAuthModal(true);
        }
      } catch (error) {
        console.error('Session initialization error:', error);
        setAuthState({ user: null, session: null, loading: false });
        setShowAuthModal(true);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setAuthState({
          user: session?.user || null,
          session,
          loading: false,
        });

        if (event === 'SIGNED_OUT' || !session) {
          setShowAuthModal(true);
        } else {
          setShowAuthModal(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (authState.loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...authState, signOut }}>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {authState.user && children}
    </AuthContext.Provider>
  );
}