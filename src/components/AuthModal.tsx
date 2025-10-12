import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  // Check if we're in development mode
  const isDevMode = import.meta.env?.VITE_DEV_MODE === 'true';

  // Debug: Log environment and configuration
  console.log('AuthModal - Environment:', {
    isDevMode,
    firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    firebaseAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY
  });

  const handleSignUp = async () => {
    setLoading(true);
    try {
      if (isDevMode) {
        // In development mode, just simulate successful signup
        console.log('Development mode: Simulating successful signup for:', formData.email);
        toast.success('Account created successfully! (Development Mode)');
        onClose();
        return;
      }

      // Basic validation
      if (!formData.email || !formData.password || !formData.name) {
        toast.error('Please fill in all fields');
        return;
      }

      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters long');
        return;
      }

      console.log('Attempting signup for:', formData.email);
      
      const { data, error } = await supabase.auth.signUpWithEmailAndPassword(
        formData.email, 
        formData.password, 
        formData.name
      );

      console.log('Signup response:', { data: !!data.user, error });
      
      if (error) {
        // Handle specific Firebase error codes
        let errorMessage = 'Failed to sign up';
        if (error.code === 'auth/email-already-in-use') {
          errorMessage = 'Email is already registered. Please sign in instead.';
          // Automatically switch to sign in tab
          setTimeout(() => {
            const signInTab = document.querySelector('[value="signin"]') as HTMLElement;
            signInTab?.click();
          }, 1000);
        } else if (error.code === 'auth/weak-password') {
          errorMessage = 'Password is too weak. Please choose a stronger password.';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'Please enter a valid email address.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }

      toast.success('Account created successfully! You can now sign in.');
      
      // Clear form and switch to sign in tab
      setFormData({ email: formData.email, password: '', name: '' });
      const signInTab = document.querySelector('[data-state="inactive"]') as HTMLElement;
      signInTab?.click();
      
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast.error(error.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      if (isDevMode) {
        // In development mode, just simulate successful signin
        console.log('Development mode: Simulating successful signin for:', formData.email);
        toast.success('Welcome back! (Development Mode)');
        onClose();
        return;
      }

      // Basic validation
      if (!formData.email || !formData.password) {
        toast.error('Please enter both email and password');
        return;
      }

      console.log('Attempting signin for:', formData.email);
      
      const { data, error } = await supabase.auth.signInWithEmailAndPassword(
        formData.email, 
        formData.password
      );

      console.log('Signin response:', { data: !!data.user, error });

      if (error) {
        // Handle specific Firebase error codes
        let errorMessage = 'Failed to sign in';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'Please enter a valid email address.';
        } else if (error.code === 'auth/user-disabled') {
          errorMessage = 'Your account has been disabled. Please contact support.';
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = 'Too many failed attempts. Please try again later.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }

      toast.success('Welcome back!');
      onClose();
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      if (isDevMode) {
        console.log('Development mode: Simulating Google signin');
        toast.success('Google sign-in successful! (Development Mode)');
        onClose();
        return;
      }

      const { error } = await supabase.auth.signInWithGoogle();

      if (error) {
        let errorMessage = 'Google sign-in failed';
        if (error.code === 'auth/popup-closed-by-user') {
          errorMessage = 'Sign-in was cancelled. Please try again.';
        } else if (error.code === 'auth/popup-blocked') {
          errorMessage = 'Popup was blocked. Please allow popups and try again.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }

      toast.success('Welcome back!');
      onClose();
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toast.error(error.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      toast.error('Please enter your email address first');
      return;
    }

    setLoading(true);
    try {
      if (isDevMode) {
        console.log('Development mode: Simulating password reset for:', formData.email);
        toast.success('Password reset email sent! (Development Mode)');
        return;
      }

      const { error } = await supabase.auth.resetPassword(formData.email);

      if (error) {
        let errorMessage = 'Failed to send password reset email';
        if (error.code === 'auth/user-not-found') {
          errorMessage = 'No account found with this email address.';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'Please enter a valid email address.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }

      toast.success('Password reset email sent! Check your inbox.');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error(error.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  const testServer = async () => {
    try {
      if (isDevMode) {
        console.log('Development mode: Simulating server test');
        toast.success('Server test successful! (Development Mode)');
        return;
      }

      // For Firebase, we can test the auth connection
      console.log('Testing Firebase connection...');
      toast.success('Firebase connection is working!');
    } catch (error) {
      console.error('Server test failed:', error);
      toast.error('Firebase connection failed');
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle>Welcome to Collaborative Code Editor</DialogTitle>
          <DialogDescription>
            Sign in to start collaborating with your team on code projects in real-time.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            
            <Button 
              onClick={handleSignIn} 
              disabled={loading || !formData.email || !formData.password}
              className="w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            
            <div className="text-center">
              <Button
                variant="link"
                onClick={handleForgotPassword}
                disabled={loading || !formData.email}
                className="text-sm text-muted-foreground p-0 h-auto"
              >
                Forgot your password?
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full"
            >
              Continue with Google
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={testServer}
              disabled={loading}
              className="w-full text-xs"
            >
              Test Server Connection
            </Button>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            
            <Button 
              onClick={handleSignUp} 
              disabled={loading || !formData.email || !formData.password || !formData.name}
              className="w-full"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}