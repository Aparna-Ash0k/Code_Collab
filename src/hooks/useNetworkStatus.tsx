import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: Back online');
      setIsOnline(true);
      if (wasOffline) {
        // Trigger a notification or refresh when coming back online
        console.log('Reconnected - consider refreshing data');
      }
      setWasOffline(false);
    };

    const handleOffline = () => {
      console.log('Network: Gone offline');
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check periodically as a fallback
    const statusCheck = setInterval(() => {
      const currentStatus = navigator.onLine;
      if (currentStatus !== isOnline) {
        setIsOnline(currentStatus);
        if (currentStatus) {
          setWasOffline(false);
        } else {
          setWasOffline(true);
        }
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(statusCheck);
    };
  }, [isOnline, wasOffline]);

  return { isOnline, wasOffline };
}
