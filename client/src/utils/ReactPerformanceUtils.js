/**
 * React Performance Utilities
 * Utilities for optimizing React components with lazy loading, memoization, and virtualization
 */

import React, { useMemo, useCallback, memo, lazy, Suspense, useRef, useEffect, useState } from 'react';

/**
 * Create a memoized component with deep comparison
 */
export const createMemoComponent = (Component, customCompare = null) => {
  return memo(Component, customCompare || ((prevProps, nextProps) => {
    return JSON.stringify(prevProps) === JSON.stringify(nextProps);
  }));
};

/**
 * Hook for memoizing expensive calculations
 */
export const useDeepMemo = (factory, deps) => {
  const depsRef = useRef();
  const valueRef = useRef();

  // Check if dependencies changed (deep comparison)
  const depsChanged = !depsRef.current || 
    JSON.stringify(deps) !== JSON.stringify(depsRef.current);

  if (depsChanged) {
    depsRef.current = deps;
    valueRef.current = factory();
  }

  return valueRef.current;
};

/**
 * Hook for debounced callbacks
 */
export const useDebouncedCallback = (callback, delay, deps = []) => {
  const timeoutRef = useRef();

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay, ...deps]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

/**
 * Hook for throttled callbacks
 */
export const useThrottledCallback = (callback, delay, deps = []) => {
  const lastRan = useRef(Date.now());

  const throttledCallback = useCallback((...args) => {
    if (Date.now() - lastRan.current >= delay) {
      callback(...args);
      lastRan.current = Date.now();
    }
  }, [callback, delay, ...deps]);

  return throttledCallback;
};

/**
 * Virtual list component for large datasets
 */
export const VirtualList = memo(({ 
  items, 
  itemHeight, 
  containerHeight, 
  renderItem, 
  overscan = 5,
  className = '',
  onScroll
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState(null);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({
        index: i,
        item: items[i],
        style: {
          position: 'absolute',
          top: i * itemHeight,
          height: itemHeight,
          width: '100%'
        }
      });
    }
    return result;
  }, [items, startIndex, endIndex, itemHeight]);

  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(e);
  }, [onScroll]);

  return (
    <div
      ref={setContainerRef}
      className={className}
      style={{
        height: containerHeight,
        overflow: 'auto'
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ index, item, style }) => (
          <div key={index} style={style}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Intersection observer hook for lazy loading
 */
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState(null);
  const elementRef = useRef();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        setEntry(entry);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options.threshold, options.rootMargin]);

  return [elementRef, isIntersecting, entry];
};

/**
 * Lazy image component with placeholder
 */
export const LazyImage = memo(({ 
  src, 
  alt, 
  placeholder = null, 
  className = '',
  onLoad,
  onError,
  ...props 
}) => {
  const [imageRef, isIntersecting] = useIntersectionObserver();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleLoad = useCallback((e) => {
    setIsLoaded(true);
    onLoad?.(e);
  }, [onLoad]);

  const handleError = useCallback((e) => {
    setIsError(true);
    onError?.(e);
  }, [onError]);

  if (!isIntersecting) {
    return (
      <div 
        ref={imageRef} 
        className={className}
        style={{ minHeight: '100px', backgroundColor: '#f0f0f0' }}
      >
        {placeholder}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={className} style={{ minHeight: '100px', backgroundColor: '#ffe6e6' }}>
        Failed to load image
      </div>
    );
  }

  return (
    <>
      {!isLoaded && placeholder && (
        <div className={className}>
          {placeholder}
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        onLoad={handleLoad}
        onError={handleError}
        style={{ 
          display: isLoaded ? 'block' : 'none',
          ...props.style 
        }}
        {...props}
      />
    </>
  );
});

/**
 * Code splitting utility with retry logic
 */
export const createLazyComponent = (importFunc, options = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    fallback = <div>Loading...</div>,
    errorFallback = <div>Failed to load component</div>
  } = options;

  let retryCount = 0;

  const retryImport = () => {
    return importFunc().catch((error) => {
      if (retryCount < maxRetries) {
        retryCount++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(retryImport());
          }, retryDelay * retryCount);
        });
      }
      throw error;
    });
  };

  const LazyComponent = lazy(retryImport);

  return (props) => (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

/**
 * Performance monitoring hook
 */
export const usePerformanceMonitor = (componentName) => {
  const renderCount = useRef(0);
  const renderTimes = useRef([]);
  const startTime = useRef();

  useEffect(() => {
    startTime.current = performance.now();
    renderCount.current++;

    return () => {
      if (startTime.current) {
        const renderTime = performance.now() - startTime.current;
        renderTimes.current.push(renderTime);

        // Keep only last 10 render times
        if (renderTimes.current.length > 10) {
          renderTimes.current.shift();
        }

        // Log performance if render time is high
        if (renderTime > 16) { // More than one frame at 60fps
          console.warn(`Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
        }
      }
    };
  });

  const getAverageRenderTime = useCallback(() => {
    if (renderTimes.current.length === 0) return 0;
    return renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length;
  }, []);

  const getPerformanceStats = useCallback(() => ({
    renderCount: renderCount.current,
    averageRenderTime: getAverageRenderTime(),
    lastRenderTime: renderTimes.current[renderTimes.current.length - 1] || 0
  }), [getAverageRenderTime]);

  return getPerformanceStats;
};

/**
 * Hook for optimizing re-renders with dependency tracking
 */
export const useOptimizedEffect = (effect, deps, options = {}) => {
  const { 
    skipFirstRender = false,
    deepCompare = false,
    debounce = 0 
  } = options;

  const isFirstRender = useRef(true);
  const prevDeps = useRef();
  const timeoutRef = useRef();

  const depsChanged = useMemo(() => {
    if (!prevDeps.current) return true;

    if (deepCompare) {
      return JSON.stringify(deps) !== JSON.stringify(prevDeps.current);
    }

    return deps.some((dep, index) => dep !== prevDeps.current[index]);
  }, deps);

  useEffect(() => {
    if (skipFirstRender && isFirstRender.current) {
      isFirstRender.current = false;
      prevDeps.current = deps;
      return;
    }

    if (!depsChanged) return;

    if (debounce > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        effect();
        prevDeps.current = deps;
      }, debounce);
    } else {
      effect();
      prevDeps.current = deps;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [depsChanged, effect, debounce]);
};

/**
 * Bundle analyzer utility for development
 */
export const analyzeBundleSize = () => {
  if (process.env.NODE_ENV !== 'development') return;

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (window.performance && window.performance.getEntriesByType) {
    const resources = window.performance.getEntriesByType('resource');
    const jsResources = resources.filter(r => r.name.includes('.js'));
    
    console.group('Bundle Analysis');
    jsResources.forEach(resource => {
      console.log(`${resource.name}: ${formatBytes(resource.transferSize || 0)}`);
    });
    console.groupEnd();
  }
};

/**
 * React error boundary for performance monitoring
 */
export class PerformanceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log performance context with error
    const performanceData = {
      memory: window.performance?.memory,
      timing: window.performance?.timing,
      navigation: window.performance?.navigation
    };

    console.error('Performance Error Boundary caught an error:', {
      error,
      errorInfo,
      performance: performanceData
    });

    // Send to error tracking service if available
    if (this.props.onError) {
      this.props.onError(error, errorInfo, performanceData);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: '20px', border: '1px solid #ff6b6b', backgroundColor: '#ffe0e0' }}>
          <h2>Something went wrong</h2>
          <p>A performance error occurred while rendering this component.</p>
          {process.env.NODE_ENV === 'development' && (
            <details>
              <summary>Error Details</summary>
              <pre>{this.state.error && this.state.error.toString()}</pre>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default {
  createMemoComponent,
  useDeepMemo,
  useDebouncedCallback,
  useThrottledCallback,
  VirtualList,
  useIntersectionObserver,
  LazyImage,
  createLazyComponent,
  usePerformanceMonitor,
  useOptimizedEffect,
  analyzeBundleSize,
  PerformanceErrorBoundary
};
