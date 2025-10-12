/**
 * Dynamic configuration for development environment
 * This file is used to configure URLs and endpoints based on network detection
 */

import { getNetworkConfig, getLocalIPAddress } from '../utils/networkUtils';

export interface AppConfig {
  apiBaseUrl: string;
  serverPort: number;
  mode: 'localhost' | 'dynamic-ip' | 'auto';
  environment: 'development' | 'production';
}

let cachedConfig: AppConfig | null = null;

/**
 * Gets the application configuration with dynamic network detection
 */
export async function getAppConfig(): Promise<AppConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  const serverPort = 3002;
  const isDevelopment = import.meta.env.DEV;
  
  if (!isDevelopment) {
    // Production configuration
    cachedConfig = {
      apiBaseUrl: '/api', // Use relative path in production
      serverPort,
      mode: 'auto',
      environment: 'production'
    };
    return cachedConfig;
  }

  // Development configuration with dynamic IP detection
  try {
    const networkConfig = await getNetworkConfig(serverPort);
    
    cachedConfig = {
      apiBaseUrl: networkConfig.apiUrl,
      serverPort,
      mode: networkConfig.useLocalhost ? 'localhost' : 'dynamic-ip',
      environment: 'development'
    };

    console.log('📱 App Config Initialized:', cachedConfig);
    return cachedConfig;
  } catch (error) {
    console.error('Failed to initialize app config, falling back to localhost:', error);
    
    // Fallback to localhost
    const isRunningOnNetworkIP = typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1';
    
    const fallbackUrl = isRunningOnNetworkIP && typeof window !== 'undefined'
      ? `http://${window.location.hostname}:${serverPort}/api`
      : `http://localhost:${serverPort}/api`;
    
    cachedConfig = {
      apiBaseUrl: fallbackUrl,
      serverPort,
      mode: 'localhost',
      environment: 'development'
    };
    return cachedConfig;
  }
}

/**
 * Forces a config refresh (useful for network changes)
 */
export function refreshAppConfig(): void {
  cachedConfig = null;
  console.log('🔄 App config cache cleared');
}

/**
 * Gets a quick config for immediate use (synchronous)
 * Uses cached value or returns localhost fallback
 */
export function getQuickConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Fallback for immediate use with smart detection
  const isRunningOnNetworkIP = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1';
  
  const fallbackUrl = isRunningOnNetworkIP && typeof window !== 'undefined'
    ? `http://${window.location.hostname}:3002/api`
    : `http://localhost:3002/api`;
  
  return {
    apiBaseUrl: fallbackUrl,
    serverPort: 3002,
    mode: 'localhost',
    environment: import.meta.env.DEV ? 'development' : 'production'
  };
}

/**
 * Creates a network configuration UI component data
 */
export async function getNetworkSettings() {
  // If frontend is running on network IP, use that IP for consistency
  const isRunningOnNetworkIP = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1';
  
  const localIP = isRunningOnNetworkIP && typeof window !== 'undefined'
    ? window.location.hostname
    : await getLocalIPAddress();
    
  const currentConfig = await getAppConfig();
  
  // Determine the correct localhost URL based on current frontend location
  const localhostUrl = isRunningOnNetworkIP && typeof window !== 'undefined'
    ? `http://${window.location.hostname}:${currentConfig.serverPort}`
    : `http://localhost:${currentConfig.serverPort}`;
  
  return {
    currentMode: currentConfig.mode,
    availableOptions: [
      {
        label: 'Localhost (127.0.0.1)',
        value: 'localhost',
        url: localhostUrl,
        description: 'Use localhost - works only on this device'
      },
      ...(localIP ? [{
        label: `Dynamic IP (${localIP})`,
        value: 'dynamic-ip',
        url: `http://${localIP}:${currentConfig.serverPort}`,
        description: 'Use local network IP - accessible from other devices on the same network'
      }] : []),
      {
        label: 'Auto-detect',
        value: 'auto',
        url: 'auto',
        description: 'Automatically choose the best option'
      }
    ],
    localIP,
    currentUrl: currentConfig.apiBaseUrl
  };
}