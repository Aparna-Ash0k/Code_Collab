/**
 * Advanced Security System
 * Comprehensive security audit, threat detection, rate limiting,
 * input validation, and advanced protection measures
 */

import { EventEmitter } from 'events';

class AdvancedSecuritySystem extends EventEmitter {
  constructor() {
    super();
    
    // Security configuration
    this.config = {
      // Rate limiting
      rateLimiting: {
        enabled: true,
        windowMs: 900000, // 15 minutes
        maxRequests: 1000, // per window
        maxRequestsPerIP: 100,
        maxRequestsPerUser: 500,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      },
      
      // Input validation
      inputValidation: {
        enabled: true,
        maxInputLength: 10000,
        allowedFileTypes: ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.css', '.html'],
        maxFileSize: 5 * 1024 * 1024, // 5MB
        sanitizeInput: true,
        preventXSS: true,
        preventSQLInjection: true
      },
      
      // Authentication security
      authentication: {
        enabled: true,
        maxLoginAttempts: 5,
        lockoutDuration: 900000, // 15 minutes
        sessionTimeout: 3600000, // 1 hour
        requireStrongPasswords: true,
        enableTwoFactor: true,
        maxConcurrentSessions: 3
      },
      
      // Encryption settings
      encryption: {
        enabled: true,
        algorithm: 'AES-256-GCM',
        keyRotationInterval: 86400000, // 24 hours
        encryptSensitiveData: true,
        encryptInTransit: true,
        encryptAtRest: true
      },
      
      // Audit logging
      auditLogging: {
        enabled: true,
        logAllActions: true,
        logSensitiveActions: true,
        retentionPeriod: 2592000000, // 30 days
        logLevel: 'detailed'
      },
      
      // Threat detection
      threatDetection: {
        enabled: true,
        detectBruteForce: true,
        detectAnomalous: true,
        detectDataExfiltration: true,
        detectPrivilegeEscalation: true,
        responseMode: 'automatic' // automatic, manual, alert-only
      }
    };
    
    // Security state
    this.rateLimitStore = new Map(); // IP/User -> request data
    this.blockedIPs = new Set();
    this.lockedAccounts = new Map(); // userId -> lockout data
    this.activeSessions = new Map(); // sessionId -> session data
    this.auditLog = []; // Security audit trail
    this.threatAlerts = []; // Active threat alerts
    
    // Security metrics
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      failedLogins: 0,
      successfulLogins: 0,
      threatsDetected: 0,
      threatsBlocked: 0,
      auditEvents: 0,
      securityIncidents: 0
    };
    
    // Threat patterns
    this.threatPatterns = {
      bruteForce: /(\d+\.\d+\.\d+\.\d+).*failed.*login/gi,
      sqlInjection: /(union|select|insert|delete|drop|exec|script)/gi,
      xssAttempt: /(<script|javascript:|on\w+\s*=)/gi,
      pathTraversal: /(\.\.\/|\.\.\\)/gi,
      commandInjection: /(;|\||&|`|\$\(|\${)/gi
    };
    
    this.initializeSecurity();
  }

  /**
   * Initialize security system
   */
  initializeSecurity() {
    console.log('🔒 Initializing advanced security system...');
    
    // Setup periodic cleanup
    this.setupPeriodicCleanup();
    
    // Setup threat monitoring
    this.setupThreatMonitoring();
    
    // Initialize encryption keys
    this.initializeEncryption();
    
    console.log('✅ Advanced security system initialized');
  }

  // ==================== RATE LIMITING ====================

  /**
   * Check rate limit for request
   */
  checkRateLimit(identifier, requestType = 'general') {
    if (!this.config.rateLimiting.enabled) {
      return { allowed: true };
    }
    
    const now = Date.now();
    const windowStart = now - this.config.rateLimiting.windowMs;
    
    // Get or create rate limit data
    let rateLimitData = this.rateLimitStore.get(identifier);
    if (!rateLimitData) {
      rateLimitData = {
        requests: [],
        totalRequests: 0,
        firstRequest: now
      };
      this.rateLimitStore.set(identifier, rateLimitData);
    }
    
    // Clean old requests outside window
    rateLimitData.requests = rateLimitData.requests.filter(time => time > windowStart);
    
    // Check limits
    const currentRequests = rateLimitData.requests.length;
    const maxRequests = this.getMaxRequestsForIdentifier(identifier);
    
    if (currentRequests >= maxRequests) {
      this.handleRateLimitExceeded(identifier, requestType);
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        remainingRequests: 0,
        resetTime: rateLimitData.requests[0] + this.config.rateLimiting.windowMs
      };
    }
    
    // Add current request
    rateLimitData.requests.push(now);
    rateLimitData.totalRequests++;
    
    this.metrics.totalRequests++;
    
    return {
      allowed: true,
      remainingRequests: maxRequests - currentRequests - 1,
      resetTime: now + this.config.rateLimiting.windowMs
    };
  }

  /**
   * Get max requests for identifier type
   */
  getMaxRequestsForIdentifier(identifier) {
    if (identifier.includes('::user::')) {
      return this.config.rateLimiting.maxRequestsPerUser;
    } else if (this.isIPAddress(identifier)) {
      return this.config.rateLimiting.maxRequestsPerIP;
    }
    return this.config.rateLimiting.maxRequests;
  }

  /**
   * Handle rate limit exceeded
   */
  handleRateLimitExceeded(identifier, requestType) {
    this.metrics.blockedRequests++;
    
    // Log security event
    this.logSecurityEvent('rate_limit_exceeded', {
      identifier,
      requestType,
      timestamp: Date.now()
    });
    
    // Check for potential DDoS
    const rateLimitData = this.rateLimitStore.get(identifier);
    if (rateLimitData && rateLimitData.totalRequests > this.config.rateLimiting.maxRequests * 5) {
      this.handlePotentialDDoS(identifier);
    }
    
    this.emit('rate_limit_exceeded', { identifier, requestType });
  }

  /**
   * Handle potential DDoS attack
   */
  handlePotentialDDoS(identifier) {
    if (this.isIPAddress(identifier)) {
      this.blockIP(identifier, 'ddos_attempt');
    }
    
    this.logSecurityEvent('ddos_attempt', {
      identifier,
      timestamp: Date.now(),
      severity: 'high'
    });
    
    this.emit('ddos_detected', { identifier });
  }

  // ==================== INPUT VALIDATION ====================

  /**
   * Validate and sanitize input
   */
  validateInput(input, type = 'general', options = {}) {
    if (!this.config.inputValidation.enabled) {
      return { valid: true, sanitized: input };
    }
    
    const validation = {
      valid: true,
      issues: [],
      sanitized: input,
      threats: []
    };
    
    try {
      // Length validation
      if (input.length > this.config.inputValidation.maxInputLength) {
        validation.valid = false;
        validation.issues.push('input_too_long');
      }
      
      // XSS detection and prevention
      if (this.config.inputValidation.preventXSS) {
        const xssDetection = this.detectXSS(input);
        if (xssDetection.detected) {
          validation.threats.push('xss_attempt');
          if (this.config.inputValidation.sanitizeInput) {
            validation.sanitized = this.sanitizeXSS(input);
          } else {
            validation.valid = false;
            validation.issues.push('xss_detected');
          }
        }
      }
      
      // SQL Injection detection
      if (this.config.inputValidation.preventSQLInjection) {
        const sqlDetection = this.detectSQLInjection(input);
        if (sqlDetection.detected) {
          validation.threats.push('sql_injection_attempt');
          validation.valid = false;
          validation.issues.push('sql_injection_detected');
        }
      }
      
      // Path traversal detection
      const pathTraversalDetection = this.detectPathTraversal(input);
      if (pathTraversalDetection.detected) {
        validation.threats.push('path_traversal_attempt');
        validation.valid = false;
        validation.issues.push('path_traversal_detected');
      }
      
      // Command injection detection
      const commandInjectionDetection = this.detectCommandInjection(input);
      if (commandInjectionDetection.detected) {
        validation.threats.push('command_injection_attempt');
        validation.valid = false;
        validation.issues.push('command_injection_detected');
      }
      
      // Type-specific validation
      if (type === 'file') {
        const fileValidation = this.validateFile(input, options);
        if (!fileValidation.valid) {
          validation.valid = false;
          validation.issues.push(...fileValidation.issues);
        }
      }
      
      // Log threats
      if (validation.threats.length > 0) {
        this.logSecurityEvent('threat_detected', {
          input: input.substring(0, 100), // Log first 100 chars
          threats: validation.threats,
          timestamp: Date.now()
        });
        
        this.metrics.threatsDetected++;
      }
      
    } catch (error) {
      console.error('Input validation error:', error);
      validation.valid = false;
      validation.issues.push('validation_error');
    }
    
    return validation;
  }

  /**
   * Detect XSS attempts
   */
  detectXSS(input) {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi
    ];
    
    for (const pattern of xssPatterns) {
      if (pattern.test(input)) {
        return { detected: true, pattern: pattern.toString() };
      }
    }
    
    return { detected: false };
  }

  /**
   * Sanitize XSS content
   */
  sanitizeXSS(input) {
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Detect SQL injection attempts
   */
  detectSQLInjection(input) {
    const sqlPatterns = [
      /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b|\bEXEC\b)/gi,
      /(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/gi,
      /['";][\s]*(\bUNION\b|\bSELECT\b)/gi,
      /\b(EXEC|EXECUTE)\s*\(/gi
    ];
    
    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) {
        return { detected: true, pattern: pattern.toString() };
      }
    }
    
    return { detected: false };
  }

  /**
   * Detect path traversal attempts
   */
  detectPathTraversal(input) {
    const pathPatterns = [
      /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\|%252e%252e%252f/gi,
      /\/etc\/passwd|\/etc\/shadow|C:\\windows\\system32/gi
    ];
    
    for (const pattern of pathPatterns) {
      if (pattern.test(input)) {
        return { detected: true, pattern: pattern.toString() };
      }
    }
    
    return { detected: false };
  }

  /**
   * Detect command injection attempts
   */
  detectCommandInjection(input) {
    const commandPatterns = [
      /[;&|`$(){}[\]]/g,
      /\b(rm|cat|ls|ps|kill|chmod|chown|wget|curl)\b/gi
    ];
    
    for (const pattern of commandPatterns) {
      if (pattern.test(input)) {
        return { detected: true, pattern: pattern.toString() };
      }
    }
    
    return { detected: false };
  }

  // ==================== AUTHENTICATION SECURITY ====================

  /**
   * Validate login attempt
   */
  validateLoginAttempt(userId, password, clientInfo = {}) {
    const result = {
      allowed: true,
      reason: null,
      requiresTwoFactor: false,
      lockoutTime: null
    };
    
    // Check if account is locked
    const lockoutData = this.lockedAccounts.get(userId);
    if (lockoutData && Date.now() < lockoutData.unlockTime) {
      result.allowed = false;
      result.reason = 'account_locked';
      result.lockoutTime = lockoutData.unlockTime;
      return result;
    }
    
    // Check concurrent sessions
    const activeSessions = this.getActiveSessionsForUser(userId);
    if (activeSessions.length >= this.config.authentication.maxConcurrentSessions) {
      result.allowed = false;
      result.reason = 'max_sessions_exceeded';
      return result;
    }
    
    // Rate limit login attempts
    const rateLimitCheck = this.checkRateLimit(`${userId}::login`, 'login');
    if (!rateLimitCheck.allowed) {
      result.allowed = false;
      result.reason = 'login_rate_limit';
      return result;
    }
    
    // If 2FA is enabled, require it
    if (this.config.authentication.enableTwoFactor) {
      result.requiresTwoFactor = true;
    }
    
    return result;
  }

  /**
   * Handle failed login attempt
   */
  handleFailedLogin(userId, clientInfo = {}) {
    this.metrics.failedLogins++;
    
    // Track failed attempts
    let attempts = this.rateLimitStore.get(`${userId}::failed_login`) || { count: 0, firstAttempt: Date.now() };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.rateLimitStore.set(`${userId}::failed_login`, attempts);
    
    // Lock account if too many attempts
    if (attempts.count >= this.config.authentication.maxLoginAttempts) {
      this.lockAccount(userId, 'too_many_failed_attempts');
    }
    
    // Log security event
    this.logSecurityEvent('failed_login', {
      userId,
      clientInfo,
      attemptCount: attempts.count,
      timestamp: Date.now()
    });
    
    // Check for brute force attack
    if (attempts.count > this.config.authentication.maxLoginAttempts * 2) {
      this.handleBruteForceDetection(userId, clientInfo);
    }
    
    this.emit('failed_login', { userId, attempts: attempts.count });
  }

  /**
   * Handle successful login
   */
  handleSuccessfulLogin(userId, sessionId, clientInfo = {}) {
    this.metrics.successfulLogins++;
    
    // Clear failed attempts
    this.rateLimitStore.delete(`${userId}::failed_login`);
    
    // Create session
    this.createSecureSession(userId, sessionId, clientInfo);
    
    // Log security event
    this.logSecurityEvent('successful_login', {
      userId,
      sessionId,
      clientInfo,
      timestamp: Date.now()
    });
    
    this.emit('successful_login', { userId, sessionId });
  }

  // ==================== THREAT DETECTION ====================

  /**
   * Setup threat monitoring
   */
  setupThreatMonitoring() {
    // Monitor for anomalous patterns
    setInterval(() => {
      this.analyzeAnomalousActivity();
    }, 60000); // Every minute
    
    // Monitor for data exfiltration
    setInterval(() => {
      this.detectDataExfiltration();
    }, 300000); // Every 5 minutes
  }

  /**
   * Analyze anomalous activity
   */
  analyzeAnomalousActivity() {
    const recentEvents = this.getRecentAuditEvents(900000); // Last 15 minutes
    
    // Detect unusual access patterns
    const accessPatterns = this.analyzeAccessPatterns(recentEvents);
    if (accessPatterns.anomalous) {
      this.handleThreatDetection('anomalous_access', accessPatterns);
    }
    
    // Detect privilege escalation attempts
    const privilegeEvents = recentEvents.filter(e => e.type === 'privilege_change');
    if (privilegeEvents.length > 5) {
      this.handleThreatDetection('privilege_escalation', { events: privilegeEvents });
    }
  }

  /**
   * Detect data exfiltration attempts
   */
  detectDataExfiltration() {
    const dataEvents = this.getRecentAuditEvents(1800000) // Last 30 minutes
      .filter(e => e.type === 'data_access' || e.type === 'file_download');
    
    // Check for unusual download volumes
    const downloadVolume = dataEvents.reduce((sum, event) => sum + (event.size || 0), 0);
    if (downloadVolume > 50 * 1024 * 1024) { // 50MB threshold
      this.handleThreatDetection('data_exfiltration', {
        volume: downloadVolume,
        events: dataEvents.length
      });
    }
  }

  /**
   * Handle threat detection
   */
  handleThreatDetection(threatType, details) {
    this.metrics.threatsDetected++;
    
    const threat = {
      id: this.generateThreatId(),
      type: threatType,
      details,
      timestamp: Date.now(),
      severity: this.calculateThreatSeverity(threatType, details),
      status: 'active'
    };
    
    this.threatAlerts.push(threat);
    
    // Log threat
    this.logSecurityEvent('threat_detected', threat);
    
    // Automatic response
    if (this.config.threatDetection.responseMode === 'automatic') {
      this.handleAutomaticThreatResponse(threat);
    }
    
    this.emit('threat_detected', threat);
  }

  /**
   * Handle automatic threat response
   */
  handleAutomaticThreatResponse(threat) {
    switch (threat.type) {
      case 'brute_force':
        if (threat.details.sourceIP) {
          this.blockIP(threat.details.sourceIP, 'brute_force_detection');
        }
        break;
        
      case 'anomalous_access':
        // Increase monitoring for affected users
        break;
        
      case 'data_exfiltration':
        // Temporarily restrict download capabilities
        break;
        
      case 'privilege_escalation':
        // Alert administrators immediately
        break;
    }
    
    this.metrics.threatsBlocked++;
  }

  // ==================== AUDIT LOGGING ====================

  /**
   * Log security event
   */
  logSecurityEvent(eventType, data) {
    if (!this.config.auditLogging.enabled) return;
    
    const auditEvent = {
      id: this.generateAuditId(),
      type: eventType,
      timestamp: Date.now(),
      data: this.sanitizeAuditData(data),
      severity: this.calculateEventSeverity(eventType)
    };
    
    this.auditLog.push(auditEvent);
    this.metrics.auditEvents++;
    
    // Trim old events
    this.trimAuditLog();
    
    // Emit for external logging systems
    this.emit('audit_event', auditEvent);
  }

  /**
   * Get recent audit events
   */
  getRecentAuditEvents(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.auditLog.filter(event => event.timestamp > cutoff);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Block IP address
   */
  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    
    this.logSecurityEvent('ip_blocked', {
      ip,
      reason,
      timestamp: Date.now()
    });
    
    // Auto-unblock after 24 hours
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      this.logSecurityEvent('ip_unblocked', { ip, reason: 'auto_unblock' });
    }, 86400000);
    
    this.emit('ip_blocked', { ip, reason });
  }

  /**
   * Lock user account
   */
  lockAccount(userId, reason) {
    const unlockTime = Date.now() + this.config.authentication.lockoutDuration;
    
    this.lockedAccounts.set(userId, {
      reason,
      lockedAt: Date.now(),
      unlockTime
    });
    
    this.logSecurityEvent('account_locked', {
      userId,
      reason,
      unlockTime
    });
    
    // Auto-unlock
    setTimeout(() => {
      this.lockedAccounts.delete(userId);
      this.logSecurityEvent('account_unlocked', { userId, reason: 'auto_unlock' });
    }, this.config.authentication.lockoutDuration);
    
    this.emit('account_locked', { userId, reason, unlockTime });
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  /**
   * Get security statistics
   */
  getSecurityStats() {
    return {
      ...this.metrics,
      blockedIPs: this.blockedIPs.size,
      lockedAccounts: this.lockedAccounts.size,
      activeSessions: this.activeSessions.size,
      activeThreats: this.threatAlerts.filter(t => t.status === 'active').length,
      auditLogSize: this.auditLog.length
    };
  }

  // ==================== PLACEHOLDER METHODS ====================

  isIPAddress(identifier) {
    return /^\d+\.\d+\.\d+\.\d+$/.test(identifier);
  }

  validateFile(input, options) {
    return { valid: true, issues: [] };
  }

  setupPeriodicCleanup() {
    setInterval(() => {
      this.cleanupExpiredData();
    }, 3600000); // Every hour
  }

  cleanupExpiredData() {
    // Cleanup rate limit data
    const now = Date.now();
    for (const [key, data] of this.rateLimitStore) {
      if (now - data.firstRequest > this.config.rateLimiting.windowMs * 2) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  initializeEncryption() {
    // Initialize encryption keys and setup
  }

  getActiveSessionsForUser(userId) {
    return Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId);
  }

  createSecureSession(userId, sessionId, clientInfo) {
    this.activeSessions.set(sessionId, {
      userId,
      sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      clientInfo
    });
  }

  handleBruteForceDetection(userId, clientInfo) {
    this.handleThreatDetection('brute_force', {
      userId,
      sourceIP: clientInfo.ip,
      userAgent: clientInfo.userAgent
    });
  }

  analyzeAccessPatterns(events) {
    return { anomalous: false };
  }

  calculateThreatSeverity(threatType, details) {
    const severityMap = {
      brute_force: 'high',
      data_exfiltration: 'critical',
      privilege_escalation: 'critical',
      anomalous_access: 'medium',
      xss_attempt: 'medium',
      sql_injection_attempt: 'high'
    };
    
    return severityMap[threatType] || 'low';
  }

  calculateEventSeverity(eventType) {
    const severityMap = {
      failed_login: 'low',
      successful_login: 'info',
      account_locked: 'medium',
      threat_detected: 'high',
      ip_blocked: 'medium'
    };
    
    return severityMap[eventType] || 'info';
  }

  sanitizeAuditData(data) {
    // Remove sensitive information from audit data
    const sanitized = { ...data };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.key;
    return sanitized;
  }

  trimAuditLog() {
    const cutoff = Date.now() - this.config.auditLogging.retentionPeriod;
    this.auditLog = this.auditLog.filter(event => event.timestamp > cutoff);
  }

  generateThreatId() {
    return `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAuditId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown security system
   */
  shutdown() {
    this.rateLimitStore.clear();
    this.blockedIPs.clear();
    this.lockedAccounts.clear();
    this.activeSessions.clear();
    this.auditLog = [];
    this.threatAlerts = [];
    
    this.emit('shutdown');
  }
}

export default AdvancedSecuritySystem;
