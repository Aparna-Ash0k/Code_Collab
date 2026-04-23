/**
 * Lazy Loader
 * Implements intelligent lazy loading strategies for files, components, and data
 */

class LazyLoader {
  constructor(performanceOptimizer) {
    this.optimizer = performanceOptimizer;
    
    // Loading queues by priority
    this.loadingQueue = {
      critical: [], // Immediate loading
      high: [],     // Load within 100ms
      medium: [],   // Load within 500ms
      low: [],      // Load when idle
      background: [] // Load during idle time
    };
    
    // Loading state tracking
    this.loadingStates = new Map();
    this.loadedResources = new Set();
    this.failedResources = new Set();
    
    // Intersection Observer for viewport-based loading
    this.intersectionObserver = null;
    this.observedElements = new Map();
    
    // Idle callback management
    this.idleCallbacks = [];
    this.isIdle = false;
    
    // Configuration
    this.config = {
      viewportMargin: '50px',
      idleTimeout: 50,
      maxConcurrentLoads: 3,
      retryAttempts: 3,
      retryDelay: 1000,
      preloadDistance: 2, // Preload items 2 viewport heights away
      batchSize: 5
    };
    
    // Performance tracking
    this.metrics = {
      totalRequests: 0,
      loadedCount: 0,
      cachedCount: 0,
      failedCount: 0,
      averageLoadTime: 0,
      viewportLoads: 0,
      backgroundLoads: 0
    };
    
    this.initializeLazyLoader();
  }

  /**
   * Initialize lazy loading system
   */
  initializeLazyLoader() {
    this.setupIntersectionObserver();
    this.setupIdleDetection();
    this.startLoadingProcessor();
  }

  /**
   * Setup intersection observer for viewport-based loading
   */
  setupIntersectionObserver() {
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const element = entry.target;
          const resourceId = this.observedElements.get(element);
          
          if (resourceId) {
            if (entry.isIntersecting) {
              this.handleElementInView(resourceId, element);
            } else {
              this.handleElementOutOfView(resourceId, element);
            }
          }
        });
      },
      {
        rootMargin: this.config.viewportMargin,
        threshold: [0, 0.1, 0.5, 1.0]
      }
    );
  }

  /**
   * Setup idle detection for background loading
   */
  setupIdleDetection() {
    if (typeof window === 'undefined') return;

    // Use requestIdleCallback if available
    if (window.requestIdleCallback) {
      const scheduleIdleWork = () => {
        window.requestIdleCallback((deadline) => {
          this.isIdle = deadline.timeRemaining() > this.config.idleTimeout;
          if (this.isIdle) {
            this.processBackgroundLoads(deadline);
          }
          scheduleIdleWork();
        });
      };
      scheduleIdleWork();
    } else {
      // Fallback using setTimeout
      setInterval(() => {
        this.processBackgroundLoads({ timeRemaining: () => 50 });
      }, 100);
    }
  }

  /**
   * Start the loading processor
   */
  startLoadingProcessor() {
    setInterval(() => {
      this.processLoadingQueues();
    }, 10);
  }

  /**
   * Load resource with lazy loading strategy
   */
  async load(resourceId, loader, options = {}) {
    const {
      priority = 'medium',
      dependencies = [],
      element = null,
      viewport = false,
      cache = true,
      timeout = 10000,
      retries = this.config.retryAttempts
    } = options;

    this.metrics.totalRequests++;

    // Check if already loaded
    if (this.loadedResources.has(resourceId)) {
      const cached = await this.getCachedResource(resourceId);
      if (cached) {
        this.metrics.cachedCount++;
        return cached;
      }
    }

    // Check if currently loading
    if (this.loadingStates.has(resourceId)) {
      return this.loadingStates.get(resourceId);
    }

    // Create loading promise
    const loadingPromise = this.createLoadingPromise(
      resourceId, 
      loader, 
      { ...options, retries, timeout }
    );
    
    this.loadingStates.set(resourceId, loadingPromise);

    // Handle viewport-based loading
    if (viewport && element) {
      return this.scheduleViewportLoad(resourceId, element, loadingPromise, options);
    }

    // Add to appropriate queue based on priority
    this.addToQueue(resourceId, loadingPromise, priority, dependencies);

    return loadingPromise;
  }

  /**
   * Schedule viewport-based loading
   */
  scheduleViewportLoad(resourceId, element, loadingPromise, options) {
    if (this.intersectionObserver) {
      this.observedElements.set(element, resourceId);
      this.intersectionObserver.observe(element);
      
      // Store the loading promise for when element comes into view
      element._lazyLoadPromise = loadingPromise;
      element._lazyLoadOptions = options;
      
      return loadingPromise;
    }
    
    // Fallback: load immediately if no intersection observer
    return this.addToQueue(resourceId, loadingPromise, 'high', options.dependencies || []);
  }

  /**
   * Handle element coming into view
   */
  handleElementInView(resourceId, element) {
    if (element._lazyLoadPromise) {
      // Promote to high priority when in viewport
      this.promoteToHighPriority(resourceId);
      this.metrics.viewportLoads++;
    }
    
    // Preload nearby content
    this.preloadNearbyContent(element);
  }

  /**
   * Handle element going out of view
   */
  handleElementOutOfView(resourceId, element) {
    // Could implement viewport exit logic here
    // For now, we continue loading as it's likely needed soon
  }

  /**
   * Preload content near the current viewport
   */
  preloadNearbyContent(element) {
    if (!element.parentElement) return;

    // Find sibling elements to preload
    const siblings = Array.from(element.parentElement.children);
    const currentIndex = siblings.indexOf(element);
    
    // Preload next few elements
    for (let i = 1; i <= this.config.preloadDistance; i++) {
      const nextElement = siblings[currentIndex + i];
      if (nextElement && this.observedElements.has(nextElement)) {
        const resourceId = this.observedElements.get(nextElement);
        this.promoteToMediumPriority(resourceId);
      }
    }
  }

  /**
   * Create loading promise with error handling and retries
   */
  createLoadingPromise(resourceId, loader, options) {
    const startTime = Date.now();
    
    return new Promise(async (resolve, reject) => {
      let lastError;
      
      for (let attempt = 0; attempt <= options.retries; attempt++) {
        try {
          // Add timeout handling
          const timeoutPromise = new Promise((_, timeoutReject) => {
            setTimeout(() => {
              timeoutReject(new Error(`Load timeout for ${resourceId}`));
            }, options.timeout);
          });
          
          const result = await Promise.race([
            loader(),
            timeoutPromise
          ]);
          
          // Cache the result
          if (options.cache) {
            await this.cacheResource(resourceId, result);
          }
          
          // Update metrics
          const loadTime = Date.now() - startTime;
          this.updateLoadMetrics(loadTime);
          this.loadedResources.add(resourceId);
          this.metrics.loadedCount++;
          
          // Clean up
          this.loadingStates.delete(resourceId);
          
          this.optimizer.emit('lazy:loaded', { 
            resourceId, 
            attempt: attempt + 1, 
            loadTime 
          });
          
          resolve(result);
          return;
          
        } catch (error) {
          lastError = error;
          
          if (attempt < options.retries) {
            // Wait before retry with exponential backoff
            const delay = this.config.retryDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            this.optimizer.emit('lazy:retry', { 
              resourceId, 
              attempt: attempt + 1, 
              error 
            });
          }
        }
      }
      
      // All retries failed
      this.failedResources.add(resourceId);
      this.metrics.failedCount++;
      this.loadingStates.delete(resourceId);
      
      this.optimizer.emit('lazy:failed', { 
        resourceId, 
        error: lastError 
      });
      
      reject(lastError);
    });
  }

  /**
   * Add loading promise to appropriate queue
   */
  addToQueue(resourceId, loadingPromise, priority, dependencies) {
    const queueItem = {
      resourceId,
      loadingPromise,
      dependencies,
      addedAt: Date.now()
    };
    
    if (this.loadingQueue[priority]) {
      this.loadingQueue[priority].push(queueItem);
    } else {
      this.loadingQueue.medium.push(queueItem);
    }
    
    return loadingPromise;
  }

  /**
   * Process loading queues by priority
   */
  async processLoadingQueues() {
    const priorities = ['critical', 'high', 'medium', 'low'];
    
    for (const priority of priorities) {
      await this.processQueue(priority);
    }
  }

  /**
   * Process specific priority queue
   */
  async processQueue(priority) {
    const queue = this.loadingQueue[priority];
    if (!queue || queue.length === 0) return;

    // Check concurrent load limit
    const activeLoads = Array.from(this.loadingStates.values()).length;
    if (activeLoads >= this.config.maxConcurrentLoads) return;

    // Find ready items (dependencies satisfied)
    const readyItems = queue.filter(item => 
      item.dependencies.every(dep => this.loadedResources.has(dep))
    );

    if (readyItems.length === 0) return;

    // Process items in batches
    const batchSize = Math.min(
      this.config.batchSize,
      this.config.maxConcurrentLoads - activeLoads,
      readyItems.length
    );

    const toProcess = readyItems.slice(0, batchSize);
    
    // Remove from queue
    toProcess.forEach(item => {
      const index = queue.indexOf(item);
      if (index !== -1) queue.splice(index, 1);
    });

    // Start loading (don't await - let them load concurrently)
    toProcess.forEach(item => {
      this.startLoading(item);
    });
  }

  /**
   * Start loading for queue item
   */
  async startLoading(queueItem) {
    try {
      await queueItem.loadingPromise;
    } catch (error) {
      // Error already handled in createLoadingPromise
    }
  }

  /**
   * Process background loads during idle time
   */
  async processBackgroundLoads(deadline) {
    const queue = this.loadingQueue.background;
    
    while (queue.length > 0 && deadline.timeRemaining() > this.config.idleTimeout) {
      const item = queue.shift();
      
      if (item.dependencies.every(dep => this.loadedResources.has(dep))) {
        this.metrics.backgroundLoads++;
        await this.startLoading(item);
      }
    }
  }

  /**
   * Promote resource to higher priority
   */
  promoteToHighPriority(resourceId) {
    this.moveItemBetweenQueues(resourceId, 'high');
  }

  promoteToMediumPriority(resourceId) {
    this.moveItemBetweenQueues(resourceId, 'medium');
  }

  /**
   * Move item between priority queues
   */
  moveItemBetweenQueues(resourceId, targetPriority) {
    for (const [priority, queue] of Object.entries(this.loadingQueue)) {
      const index = queue.findIndex(item => item.resourceId === resourceId);
      if (index !== -1) {
        const item = queue.splice(index, 1)[0];
        this.loadingQueue[targetPriority].push(item);
        break;
      }
    }
  }

  // ==================== CACHING METHODS ====================

  async cacheResource(resourceId, data) {
    const cacheKey = `lazy:${resourceId}`;
    await this.optimizer.setCached(cacheKey, data, {
      ttl: 10 * 60 * 1000, // 10 minutes
      priority: 2
    });
  }

  async getCachedResource(resourceId) {
    const cacheKey = `lazy:${resourceId}`;
    return await this.optimizer.getCached(cacheKey);
  }

  // ==================== PRELOADING STRATEGIES ====================

  /**
   * Preload critical resources immediately
   */
  async preloadCritical(resources) {
    const preloadPromises = resources.map(resource => {
      const { id, loader, dependencies = [] } = resource;
      return this.load(id, loader, { 
        priority: 'critical', 
        dependencies 
      });
    });
    
    await Promise.all(preloadPromises);
  }

  /**
   * Preload resources based on user patterns
   */
  async preloadUserPatterns(userActivity) {
    // Analyze user activity to predict next resources
    const predictions = this.predictNextResources(userActivity);
    
    predictions.forEach(prediction => {
      this.load(prediction.resourceId, prediction.loader, {
        priority: 'background',
        cache: true
      });
    });
  }

  /**
   * Predict next resources based on user activity
   */
  predictNextResources(userActivity) {
    // Simple prediction based on recent activity
    const recentFiles = userActivity.recentFiles || [];
    const currentFile = userActivity.currentFile;
    
    const predictions = [];
    
    // Predict related files in same directory
    if (currentFile) {
      const directory = currentFile.split('/').slice(0, -1).join('/');
      recentFiles
        .filter(file => file.startsWith(directory))
        .slice(0, 3)
        .forEach(file => {
          predictions.push({
            resourceId: `file:${file}`,
            loader: () => this.loadFile(file),
            confidence: 0.7
          });
        });
    }
    
    // Predict frequently accessed files
    const frequentFiles = userActivity.frequentFiles || [];
    frequentFiles.slice(0, 2).forEach(file => {
      predictions.push({
        resourceId: `file:${file}`,
        loader: () => this.loadFile(file),
        confidence: 0.5
      });
    });
    
    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  // ==================== COMPONENT LAZY LOADING ====================

  /**
   * Create lazy-loaded React component
   */
  createLazyComponent(importFunction, options = {}) {
    const {
      fallback = null,
      errorBoundary = null,
      preload = false,
      delay = 0
    } = options;

    // React.lazy equivalent
    const LazyComponent = React.lazy(async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return importFunction();
    });

    // Enhanced wrapper with preloading
    const EnhancedLazyComponent = (props) => {
      React.useEffect(() => {
        if (preload) {
          // Preload the component
          importFunction();
        }
      }, []);

      return React.createElement(
        React.Suspense,
        { fallback },
        React.createElement(LazyComponent, props)
      );
    };

    // Add preload method
    EnhancedLazyComponent.preload = importFunction;

    return EnhancedLazyComponent;
  }

  // ==================== UTILITY METHODS ====================

  updateLoadMetrics(loadTime) {
    const currentAvg = this.metrics.averageLoadTime;
    const loadedCount = this.metrics.loadedCount;
    
    this.metrics.averageLoadTime = 
      (currentAvg * loadedCount + loadTime) / (loadedCount + 1);
  }

  /**
   * Cleanup expired and failed resources
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    // Clean up old queue items
    Object.values(this.loadingQueue).forEach(queue => {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (now - queue[i].addedAt > maxAge) {
          queue.splice(i, 1);
        }
      }
    });
    
    // Clean up failed resources (allow retry after time)
    const failedResourcesArray = Array.from(this.failedResources);
    failedResourcesArray.forEach(resourceId => {
      // Remove from failed set after some time to allow retry
      this.failedResources.delete(resourceId);
    });
  }

  /**
   * Get lazy loading statistics
   */
  getStats() {
    return {
      ...this.metrics,
      queueSizes: Object.fromEntries(
        Object.entries(this.loadingQueue).map(([priority, queue]) => 
          [priority, queue.length]
        )
      ),
      loadingStates: this.loadingStates.size,
      loadedResources: this.loadedResources.size,
      failedResources: this.failedResources.size,
      observedElements: this.observedElements.size
    };
  }

  /**
   * Reset lazy loading statistics
   */
  resetStats() {
    this.metrics = {
      totalRequests: 0,
      loadedCount: 0,
      cachedCount: 0,
      failedCount: 0,
      averageLoadTime: 0,
      viewportLoads: 0,
      backgroundLoads: 0
    };
  }

  /**
   * Configure lazy loader
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  // ==================== INTEGRATION PLACEHOLDERS ====================

  async loadFile(filePath) {
    throw new Error('loadFile must be implemented by integrating service');
  }

  /**
   * Shutdown lazy loader
   */
  shutdown() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    // Clear all queues
    Object.keys(this.loadingQueue).forEach(priority => {
      this.loadingQueue[priority] = [];
    });
    
    this.loadingStates.clear();
    this.observedElements.clear();
    
    this.optimizer.emit('lazy:shutdown');
  }
}

export default LazyLoader;
