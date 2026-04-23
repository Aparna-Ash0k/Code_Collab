/**
 * Dynamic server URL configuration utility
 * Automatically detects the appropriate server URL based on the current environment
 */

/**
 * Dynamically determine the server URL
 * @returns {string} The server URL to use for API calls and socket connections
 */
export const getServerUrl = () => {
  // First check environment variable (highest priority)
  if (process.env.REACT_APP_SERVER_URL) {
    console.log('🔧 Using environment variable server URL:', process.env.REACT_APP_SERVER_URL);
    return process.env.REACT_APP_SERVER_URL;
  }
  
  // Dynamic detection based on current window location
  try {
    const currentHost = window.location.hostname;
    const currentProtocol = window.location.protocol;
    
    console.log('🔍 Current host detected:', currentHost);
    console.log('🔍 Current protocol:', currentProtocol);
    
    // If accessing via IP address, use the same IP for server with port 5000
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      const serverUrl = `${currentProtocol}//${currentHost}:5000`;
      console.log('🌍 Network access - using server URL:', serverUrl);
      return serverUrl;
    }
    
    // Fallback to localhost for local development
    console.log('🏠 Localhost access - using server URL: http://localhost:5000');
    return 'http://localhost:5000';
  } catch (error) {
    // Fallback in case window is not available (SSR, etc.)
    console.warn('Unable to detect dynamic server URL, using localhost fallback:', error.message);
    return 'http://localhost:5000';
  }
};

/**
 * Get WebSocket URL based on server URL
 * @returns {string} The WebSocket URL to use for real-time connections
 */
export const getWebSocketUrl = () => {
  const serverUrl = getServerUrl();
  return serverUrl.replace(/^http/, 'ws');
};

/**
 * Get the base API URL
 * @returns {string} The base URL for API endpoints
 */
export const getApiUrl = () => {
  return `${getServerUrl()}/api`;
};

/**
 * Configuration object with all URLs
 */
export const serverConfig = {
  get serverUrl() {
    return getServerUrl();
  },
  get wsUrl() {
    return getWebSocketUrl();
  },
  get apiUrl() {
    return getApiUrl();
  }
};

export default { getServerUrl, getWebSocketUrl, getApiUrl, serverConfig };