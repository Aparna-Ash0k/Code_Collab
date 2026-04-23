/**
 * Unified Path Utilities
 * 
 * Standardizes path formats across all storage layers:
 * - VFS paths: 'src/app.js'
 * - Session paths: 'sessionId/src/app.js'  
 * - Database paths: 'projects/projectId/src/app.js'
 * - Firebase paths: 'userFiles/userId/projectId/src/app.js'
 * 
 * Provides translation between different path formats and ensures consistency.
 */

export class PathUtils {
  static PATH_SEPARATORS = {
    VFS: '/',
    SESSION: '/',
    DATABASE: '/',
    FIREBASE: '/'
  };

  static PATH_PREFIXES = {
    SESSION: (sessionId) => `sessions/${sessionId}`,
    PROJECT: (projectId) => `projects/${projectId}`,
    USER_PROJECT: (userId, projectId) => `users/${userId}/projects/${projectId}`,
    FIREBASE: (userId, projectId) => `userFiles/${userId}/${projectId}`
  };

  /**
   * Normalize a path to standard format
   * - Remove leading/trailing slashes
   * - Convert backslashes to forward slashes
   * - Remove duplicate slashes
   * - Handle empty paths
   */
  static normalize(path) {
    if (!path || typeof path !== 'string') {
      return '';
    }

    return path
      .trim()
      .replace(/\\/g, '/')           // Convert backslashes to forward slashes
      .replace(/\/+/g, '/')          // Replace multiple slashes with single
      .replace(/^\/+|\/+$/g, '');    // Remove leading/trailing slashes
  }

  /**
   * Join path segments safely
   */
  static join(...segments) {
    return this.normalize(
      segments
        .filter(segment => segment && typeof segment === 'string')
        .map(segment => this.normalize(segment))
        .filter(segment => segment.length > 0)
        .join('/')
    );
  }

  /**
   * Get the parent directory of a path
   */
  static dirname(path) {
    const normalized = this.normalize(path);
    if (!normalized) return '';
    
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === -1) return '';
    
    return normalized.substring(0, lastSlash);
  }

  /**
   * Get the filename from a path
   */
  static basename(path, removeExtension = false) {
    const normalized = this.normalize(path);
    if (!normalized) return '';
    
    const lastSlash = normalized.lastIndexOf('/');
    const filename = lastSlash === -1 ? normalized : normalized.substring(lastSlash + 1);
    
    if (removeExtension) {
      const lastDot = filename.lastIndexOf('.');
      return lastDot === -1 ? filename : filename.substring(0, lastDot);
    }
    
    return filename;
  }

  /**
   * Get the file extension
   */
  static extname(path) {
    const filename = this.basename(path);
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.substring(lastDot);
  }

  /**
   * Check if a path is absolute (starts with /)
   */
  static isAbsolute(path) {
    return path && path.startsWith('/');
  }

  /**
   * Check if a path is relative
   */
  static isRelative(path) {
    return path && !this.isAbsolute(path);
  }

  /**
   * Convert VFS path to session path
   */
  static vfsToSession(vfsPath, sessionId) {
    const normalized = this.normalize(vfsPath);
    if (!sessionId) return normalized;
    
    return this.join(this.PATH_PREFIXES.SESSION(sessionId), normalized);
  }

  /**
   * Convert session path to VFS path
   */
  static sessionToVFS(sessionPath, sessionId) {
    const normalized = this.normalize(sessionPath);
    if (!sessionId) return normalized;
    
    const prefix = this.PATH_PREFIXES.SESSION(sessionId) + '/';
    if (normalized.startsWith(prefix)) {
      return normalized.substring(prefix.length);
    }
    
    return normalized;
  }

  /**
   * Convert VFS path to project path
   */
  static vfsToProject(vfsPath, projectId) {
    const normalized = this.normalize(vfsPath);
    if (!projectId) return normalized;
    
    return this.join(this.PATH_PREFIXES.PROJECT(projectId), normalized);
  }

  /**
   * Convert project path to VFS path
   */
  static projectToVFS(projectPath, projectId) {
    const normalized = this.normalize(projectPath);
    if (!projectId) return normalized;
    
    const prefix = this.PATH_PREFIXES.PROJECT(projectId) + '/';
    if (normalized.startsWith(prefix)) {
      return normalized.substring(prefix.length);
    }
    
    return normalized;
  }

  /**
   * Convert VFS path to Firebase path
   */
  static vfsToFirebase(vfsPath, userId, projectId) {
    const normalized = this.normalize(vfsPath);
    if (!userId || !projectId) return normalized;
    
    return this.join(this.PATH_PREFIXES.FIREBASE(userId, projectId), normalized);
  }

  /**
   * Convert Firebase path to VFS path
   */
  static firebaseToVFS(firebasePath, userId, projectId) {
    const normalized = this.normalize(firebasePath);
    if (!userId || !projectId) return normalized;
    
    const prefix = this.PATH_PREFIXES.FIREBASE(userId, projectId) + '/';
    if (normalized.startsWith(prefix)) {
      return normalized.substring(prefix.length);
    }
    
    return normalized;
  }

  /**
   * Convert database path to VFS path
   */
  static databaseToVFS(databasePath, projectId) {
    // Database paths might include project prefixes
    const normalized = this.normalize(databasePath);
    if (!projectId) return normalized;
    
    const prefix = this.PATH_PREFIXES.PROJECT(projectId) + '/';
    if (normalized.startsWith(prefix)) {
      return normalized.substring(prefix.length);
    }
    
    return normalized;
  }

  /**
   * Convert VFS path to database path
   */
  static vfsToDatabase(vfsPath, projectId) {
    const normalized = this.normalize(vfsPath);
    if (!projectId) return normalized;
    
    return this.join(this.PATH_PREFIXES.PROJECT(projectId), normalized);
  }

  /**
   * Parse a complex path and extract components
   */
  static parse(path) {
    const normalized = this.normalize(path);
    
    return {
      full: normalized,
      dir: this.dirname(normalized),
      base: this.basename(normalized),
      name: this.basename(normalized, true),
      ext: this.extname(normalized)
    };
  }

  /**
   * Check if a path is within another path (security check)
   */
  static isWithin(childPath, parentPath) {
    const normalizedChild = this.normalize(childPath);
    const normalizedParent = this.normalize(parentPath);
    
    if (!normalizedParent) return true; // Root contains everything
    
    return normalizedChild.startsWith(normalizedParent + '/') || 
           normalizedChild === normalizedParent;
  }

  /**
   * Get relative path from one path to another
   */
  static relative(from, to) {
    const normalizedFrom = this.normalize(from);
    const normalizedTo = this.normalize(to);
    
    if (!normalizedFrom) return normalizedTo;
    if (!normalizedTo) return '';
    
    const fromParts = normalizedFrom.split('/');
    const toParts = normalizedTo.split('/');
    
    // Find common prefix
    let commonLength = 0;
    const minLength = Math.min(fromParts.length, toParts.length);
    
    for (let i = 0; i < minLength; i++) {
      if (fromParts[i] === toParts[i]) {
        commonLength++;
      } else {
        break;
      }
    }
    
    // Build relative path
    const upLevels = fromParts.length - commonLength;
    const downParts = toParts.slice(commonLength);
    
    const relativeParts = [];
    for (let i = 0; i < upLevels; i++) {
      relativeParts.push('..');
    }
    relativeParts.push(...downParts);
    
    return this.normalize(relativeParts.join('/'));
  }

  /**
   * Resolve a relative path against a base path
   */
  static resolve(basePath, relativePath) {
    const normalizedBase = this.normalize(basePath);
    const normalizedRelative = this.normalize(relativePath);
    
    if (!normalizedRelative) return normalizedBase;
    if (this.isAbsolute(normalizedRelative)) return normalizedRelative;
    
    const baseParts = normalizedBase ? normalizedBase.split('/') : [];
    const relativeParts = normalizedRelative.split('/');
    
    for (const part of relativeParts) {
      if (part === '..') {
        if (baseParts.length > 0) {
          baseParts.pop();
        }
      } else if (part !== '.' && part !== '') {
        baseParts.push(part);
      }
    }
    
    return this.normalize(baseParts.join('/'));
  }

  /**
   * Validate path format and security
   */
  static validate(path, options = {}) {
    const {
      allowAbsolute = true,
      allowRelative = true,
      maxLength = 1000,
      allowedExtensions = null,
      disallowedPatterns = [/\.\./g, /[<>:"|?*]/g]
    } = options;

    if (!path || typeof path !== 'string') {
      return { valid: false, error: 'Path must be a non-empty string' };
    }

    if (path.length > maxLength) {
      return { valid: false, error: `Path too long (max ${maxLength} characters)` };
    }

    const normalized = this.normalize(path);

    if (!allowAbsolute && this.isAbsolute(normalized)) {
      return { valid: false, error: 'Absolute paths not allowed' };
    }

    if (!allowRelative && this.isRelative(normalized)) {
      return { valid: false, error: 'Relative paths not allowed' };
    }

    // Check for disallowed patterns
    for (const pattern of disallowedPatterns) {
      if (pattern.test(path)) {
        return { valid: false, error: `Path contains invalid pattern: ${pattern}` };
      }
    }

    // Check file extension if specified
    if (allowedExtensions && allowedExtensions.length > 0) {
      const ext = this.extname(normalized).toLowerCase();
      if (ext && !allowedExtensions.includes(ext)) {
        return { valid: false, error: `File extension ${ext} not allowed` };
      }
    }

    return { valid: true, normalized };
  }

  /**
   * Generate a unique path if the given path already exists
   */
  static makeUnique(path, existsCallback) {
    let normalized = this.normalize(path);
    let counter = 1;
    let uniquePath = normalized;

    while (existsCallback(uniquePath)) {
      const parsed = this.parse(normalized);
      const baseName = parsed.name;
      const extension = parsed.ext;
      const dir = parsed.dir;
      
      const newName = `${baseName} (${counter})${extension}`;
      uniquePath = dir ? this.join(dir, newName) : newName;
      counter++;
    }

    return uniquePath;
  }

  /**
   * Convert a path to a safe filename (remove invalid characters)
   */
  static toSafeFilename(path) {
    return this.normalize(path)
      .replace(/[<>:"|?*]/g, '_')     // Replace invalid filename characters
      .replace(/\s+/g, '_')           // Replace spaces with underscores
      .replace(/_{2,}/g, '_')         // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '');       // Remove leading/trailing underscores
  }

  /**
   * Get the depth of a path (number of directory levels)
   */
  static depth(path) {
    const normalized = this.normalize(path);
    if (!normalized) return 0;
    
    return normalized.split('/').length;
  }

  /**
   * Check if two paths refer to the same location
   */
  static equal(path1, path2) {
    return this.normalize(path1) === this.normalize(path2);
  }

  /**
   * Sort paths in a logical order (directories first, then files)
   */
  static sort(paths, options = {}) {
    const { 
      directoriesFirst = true,
      caseInsensitive = true 
    } = options;

    return paths.slice().sort((a, b) => {
      const normalizedA = this.normalize(a);
      const normalizedB = this.normalize(b);
      
      // If one is a directory and the other isn't, directories come first
      if (directoriesFirst) {
        const aIsDir = normalizedA.endsWith('/') || !this.extname(normalizedA);
        const bIsDir = normalizedB.endsWith('/') || !this.extname(normalizedB);
        
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
      }
      
      // Regular string comparison
      const compareA = caseInsensitive ? normalizedA.toLowerCase() : normalizedA;
      const compareB = caseInsensitive ? normalizedB.toLowerCase() : normalizedB;
      
      return compareA.localeCompare(compareB);
    });
  }
}

// Export as default for convenience
export default PathUtils;
