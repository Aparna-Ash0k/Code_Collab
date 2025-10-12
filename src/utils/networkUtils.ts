/**
 * Network utility functions for dynamic IP detection and URL management
 */

interface NetworkConfig {
  baseUrl: string;
  apiUrl: string;
  serverPort: number;
  useLocalhost: boolean;
}

/**
 * Detects the local IP address of the machine
 * Returns the first non-loopback IPv4 address found
 */
export async function getLocalIPAddress(): Promise<string | null> {
  try {
    // Create a temporary RTCPeerConnection to discover local IP
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Create a data channel to trigger ICE candidate gathering
    pc.createDataChannel('');

    // Create offer to start the ICE gathering process
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    return new Promise((resolve) => {
      let resolved = false;
      const validIPs: string[] = [];
      
      pc.onicecandidate = (event) => {
        if (event.candidate && !resolved) {
          const candidate = event.candidate.candidate;
          const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
          
          if (ipMatch) {
            const ip = ipMatch[1];
            
            // Filter to only local network IPs
            if (isLocalNetworkIP(ip)) {
              validIPs.push(ip);
            }
          }
        }
      };

      // Give it some time to collect candidates, then resolve with best IP
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          pc.close();
          
          // Prefer private network IPs over others
          const privateIP = validIPs.find(ip => 
            ip.startsWith('192.168.') || 
            ip.startsWith('10.') || 
            ip.startsWith('172.')
          );
          
          resolve(privateIP || validIPs[0] || null);
        }
      }, 2000);
    });
  } catch (error) {
    console.error('Failed to detect local IP:', error);
    return null;
  }
}

/**
 * Checks if an IP address is a local network IP
 */
function isLocalNetworkIP(ip: string): boolean {
  // Skip loopback and invalid addresses
  if (ip.startsWith('127.') || 
      ip.startsWith('169.254.') || 
      ip.startsWith('0.') ||
      ip === '0.0.0.0') {
    return false;
  }
  
  // Check for private network ranges
  const parts = ip.split('.').map(Number);
  
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;
  
  // 10.0.0.0/8
  if (parts[0] === 10) return true;
  
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  
  // Skip external/public IPs
  return false;
}

/**
 * Alternative method using fetch to the server's network endpoint
 */
export async function getLocalIPAddressAlt(): Promise<string | null> {
  try {
    // Try to make a request to the local network scanner
    const response = await fetch('/api/network/local-ip', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => null);

    if (response && response.ok) {
      const data = await response.json();
      return data.localIp || null;
    }

    return null;
  } catch (error) {
    console.error('Alternative IP detection failed:', error);
    return null;
  }
}

/**
 * Gets the current network configuration with dynamic IP detection
 */
export async function getNetworkConfig(serverPort: number = 3002): Promise<NetworkConfig> {
  // Auto-detect if frontend is running on network IP
  const isRunningOnNetworkIP = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1';
  
  // Check if user preference is stored
  const storedConfig = localStorage.getItem('network-config');
  let useLocalhost = !isRunningOnNetworkIP; // Default based on current frontend location
  
  if (storedConfig) {
    try {
      const parsed = JSON.parse(storedConfig);
      // Only use stored preference if not running on network IP
      useLocalhost = isRunningOnNetworkIP ? false : (parsed.useLocalhost ?? true);
    } catch (error) {
      console.error('Failed to parse stored network config:', error);
    }
  }

  console.log(`🌐 Network config: Frontend on ${typeof window !== 'undefined' ? window.location.hostname : 'unknown'}, useLocalhost: ${useLocalhost}`);

  let baseUrl: string;
  
  if (useLocalhost) {
    baseUrl = `http://localhost:${serverPort}`;
  } else {
    // If frontend is running on network IP, use the same IP for backend
    let localIP: string | null = null;
    
    if (isRunningOnNetworkIP && typeof window !== 'undefined') {
      localIP = window.location.hostname;
      console.log('🌐 Using frontend hostname for backend:', localIP);
    } else {
      // Try server-side detection first (more reliable)
      try {
        const response = await fetch('/api/network/local-ip', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          localIP = data.localIp;
          console.log('🌐 Server-side IP detection:', localIP);
        }
      } catch (error) {
        console.log('Server-side IP detection failed, trying client-side');
      }
      
      // Fallback to client-side detection
      if (!localIP) {
        localIP = await getLocalIPAddress();
        console.log('🌐 Client-side IP detection:', localIP);
      }
    }
    
    if (localIP && (isRunningOnNetworkIP || isLocalNetworkIP(localIP))) {
      baseUrl = `http://${localIP}:${serverPort}`;
      console.log('🌐 Using dynamic IP:', localIP);
    } else {
      console.warn('⚠️ No valid local IP found, falling back to localhost');
      baseUrl = `http://localhost:${serverPort}`;
      // Update preference to localhost since dynamic IP failed
      useLocalhost = true;
    }
  }

  const config: NetworkConfig = {
    baseUrl,
    apiUrl: `${baseUrl}/api`,
    serverPort,
    useLocalhost
  };

  // Store the configuration
  localStorage.setItem('network-config', JSON.stringify({
    useLocalhost,
    lastUpdate: new Date().toISOString()
  }));

  return config;
}

/**
 * Forces the use of localhost (for development)
 */
export function forceLocalhost(): void {
  localStorage.setItem('network-config', JSON.stringify({
    useLocalhost: true,
    lastUpdate: new Date().toISOString()
  }));
  console.log('🏠 Forced localhost mode');
}

/**
 * Forces the use of dynamic IP detection
 */
export function forceDynamicIP(): void {
  localStorage.setItem('network-config', JSON.stringify({
    useLocalhost: false,
    lastUpdate: new Date().toISOString()
  }));
  console.log('🌐 Forced dynamic IP mode');
}

/**
 * Gets the current configuration mode
 */
export function getConfigMode(): 'localhost' | 'dynamic' | 'auto' {
  const storedConfig = localStorage.getItem('network-config');
  
  if (!storedConfig) {
    return 'auto';
  }
  
  try {
    const parsed = JSON.parse(storedConfig);
    return parsed.useLocalhost ? 'localhost' : 'dynamic';
  } catch (error) {
    return 'auto';
  }
}

/**
 * Tests connectivity to a given URL
 */
export async function testConnectivity(url: string): Promise<boolean> {
  try {
    const testUrl = `${url}/api/health`;
    console.log('🔗 Testing connectivity to:', testUrl);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      timeout: 5000
    } as RequestInit);
    
    const isOk = response.ok;
    console.log(isOk ? '✅' : '❌', 'Connectivity test for', url, '- Status:', response.status);
    return isOk;
  } catch (error) {
    console.error('❌ Connectivity test failed for', url, error);
    return false;
  }
}

/**
 * Discovers available network interfaces and suggests the best configuration
 */
export async function discoverNetworkConfig(serverPort: number = 3002): Promise<NetworkConfig[]> {
  const configs: NetworkConfig[] = [];
  
  // Always include localhost
  configs.push({
    baseUrl: `http://localhost:${serverPort}`,
    apiUrl: `http://localhost:${serverPort}/api`,
    serverPort,
    useLocalhost: true
  });

  // Try to discover local IP
  const localIP = await getLocalIPAddress();
  if (localIP) {
    configs.push({
      baseUrl: `http://${localIP}:${serverPort}`,
      apiUrl: `http://${localIP}:${serverPort}/api`,
      serverPort,
      useLocalhost: false
    });
  }

  // Test connectivity for each config
  const workingConfigs = [];
  for (const config of configs) {
    const isWorking = await testConnectivity(config.baseUrl);
    if (isWorking) {
      workingConfigs.push({ ...config, working: true });
    } else {
      workingConfigs.push({ ...config, working: false });
    }
  }

  return workingConfigs;
}