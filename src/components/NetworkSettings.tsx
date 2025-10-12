import { useState, useEffect } from 'react';
import { Settings, Wifi, Home, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { getNetworkSettings, refreshAppConfig } from '../config/appConfig';
import { forceLocalhost, forceDynamicIP, testConnectivity, getConfigMode } from '../utils/networkUtils';

interface NetworkOption {
  label: string;
  value: string;
  url: string;
  description: string;
  working?: boolean;
}

interface NetworkSettings {
  currentMode: string;
  availableOptions: NetworkOption[];
  localIP: string | null;
  currentUrl: string;
}

export function NetworkSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<NetworkSettings | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<string>('auto');

  useEffect(() => {
    loadSettings();
    setCurrentMode(getConfigMode());
  }, []);

  const loadSettings = async () => {
    try {
      const networkSettings = await getNetworkSettings();
      
      // Test connectivity for each option
      const optionsWithStatus = await Promise.all(
        networkSettings.availableOptions.map(async (option) => {
          if (option.value === 'auto' || option.url === 'auto') {
            return { ...option, working: true };
          }
          
          const isWorking = await testConnectivity(option.url);
          return { ...option, working: isWorking };
        })
      );

      setSettings({
        ...networkSettings,
        availableOptions: optionsWithStatus
      });
    } catch (error) {
      console.error('Failed to load network settings:', error);
    }
  };

  const handleModeChange = async (mode: string) => {
    setTesting(mode);
    
    try {
      if (mode === 'localhost') {
        forceLocalhost();
      } else if (mode === 'dynamic-ip') {
        forceDynamicIP();
      }
      
      // Refresh config and reload settings
      refreshAppConfig();
      await loadSettings();
      setCurrentMode(mode);
      
      // Show success message
      console.log(`✅ Switched to ${mode} mode`);
    } catch (error) {
      console.error('Failed to change network mode:', error);
    } finally {
      setTesting(null);
    }
  };

  const getIcon = (value: string) => {
    switch (value) {
      case 'localhost':
        return <Home className="w-4 h-4" />;
      case 'dynamic-ip':
        return <Wifi className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (working?: boolean) => {
    if (working === undefined) return null;
    return working ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <AlertCircle className="w-4 h-4 text-red-500" />;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md transition-colors"
        title="Network Settings"
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline">Network</span>
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <h3 className="text-lg font-semibold">Network Settings</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Choose how to connect to the development server:
              </p>
              
              {settings?.availableOptions.map((option) => (
                <div
                  key={option.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    currentMode === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => handleModeChange(option.value)}
                >
                  <div className="flex items-center gap-2">
                    {getIcon(option.value)}
                    {testing === option.value && <RefreshCw className="w-4 h-4 animate-spin" />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{option.label}</span>
                      {getStatusIcon(option.working)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                    {option.url !== 'auto' && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {option.url}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="radio"
                      checked={currentMode === option.value}
                      onChange={() => handleModeChange(option.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Current Status */}
            <div className="pt-3 border-t dark:border-gray-700">
              <div className="text-sm">
                <p className="text-gray-600 dark:text-gray-400">Current API URL:</p>
                <p className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                  {settings?.currentUrl || 'Loading...'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={loadSettings}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}