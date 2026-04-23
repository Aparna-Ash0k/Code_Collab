import React from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Users, 
  FileText,
  MessageCircle,
  GitBranch,
  Download,
  Upload
} from 'lucide-react';

// Custom toast notification functions
export const showToast = {
  success: (message, options = {}) => {
    toast.success(message, {
      icon: '✅',
      duration: 3000,
      style: {
        background: '#1e1e1e',
        color: '#fff',
        border: '1px solid #007acc',
      },
      ...options
    });
  },

  error: (message, options = {}) => {
    toast.error(message, {
      icon: '❌',
      duration: 4000,
      style: {
        background: '#1e1e1e',
        color: '#fff',
        border: '1px solid #f14c4c',
      },
      ...options
    });
  },

  info: (message, options = {}) => {
    toast(message, {
      icon: 'ℹ️',
      duration: 3000,
      style: {
        background: '#1e1e1e',
        color: '#fff',
        border: '1px solid #007acc',
      },
      ...options
    });
  },

  warning: (message, options = {}) => {
    toast(message, {
      icon: '⚠️',
      duration: 3000,
      style: {
        background: '#1e1e1e',
        color: '#fff',
        border: '1px solid #ffcc02',
      },
      ...options
    });
  },

  // Specialized notifications for CodeCollab events
  fileCreated: (fileName) => {
    toast.success(`Created ${fileName}`, {
      icon: '📄',
      duration: 2000,
    });
  },

  fileSaved: (fileName) => {
    toast.success(`Saved ${fileName}`, {
      icon: '💾',
      duration: 2000,
    });
  },

  userJoined: (userName) => {
    toast(`${userName} joined the project`, {
      icon: '👋',
      duration: 3000,
      style: {
        background: '#1e1e1e',
        color: '#fff',
        border: '1px solid #4caf50',
      },
    });
  },

  userLeft: (userName) => {
    toast(`${userName} left the project`, {
      icon: '👋',
      duration: 3000,
      style: {
        background: '#1e1e1e',
        color: '#fff',
        border: '1px solid #ff9800',
      },
    });
  },

  messageReceived: (userName, preview) => {
    toast(`${userName}: ${preview}`, {
      icon: '💬',
      duration: 4000,
      style: {
        background: '#1e1e1e',
        color: '#fff',
        border: '1px solid #2196f3',
      },
    });
  },

  versionSaved: (commitMessage) => {
    toast.success(`Version saved: ${commitMessage}`, {
      icon: '🔄',
      duration: 3000,
    });
  },

  connectionStatus: (isConnected) => {
    if (isConnected) {
      toast.success('Connected to server', {
        icon: '🔗',
        duration: 2000,
      });
    } else {
      toast.error('Disconnected from server', {
        icon: '🔌',
        duration: 3000,
      });
    }
  },

  collaboratorInvited: (email) => {
    toast.success(`Invitation sent to ${email}`, {
      icon: '📧',
      duration: 3000,
    });
  },

  fileShared: () => {
    toast.success('File shared successfully', {
      icon: '🔗',
      duration: 2000,
    });
  },

  extensionInstalled: (extensionName) => {
    toast.success(`${extensionName} installed`, {
      icon: '🧩',
      duration: 3000,
    });
  },

  // Custom toast with action button
  withAction: (message, actionLabel, onAction, options = {}) => {
    toast.custom((t) => (
      <div className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-vscode-panel border border-vscode-border rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 shadow-lg`}>
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-vscode-text">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-vscode-border">
          <button
            onClick={() => {
              onAction();
              toast.dismiss(t.id);
            }}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-vscode-accent hover:text-vscode-accent-hover focus:outline-none"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
      ...options
    });
  }
};

// Toast Container Component
const ToastContainer = () => {
  return (
    <Toaster
      position="bottom-right"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        // Default options for all toasts
        className: '',
        duration: 3000,
        style: {
          background: '#1e1e1e',
          color: '#fff',
          border: '1px solid #3c3c3c',
          borderRadius: '6px',
          fontSize: '14px',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        },

        // Default styles for different types
        success: {
          iconTheme: {
            primary: '#4caf50',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#f44336',
            secondary: '#fff',
          },
        },
      }}
    />
  );
};

export default ToastContainer;
