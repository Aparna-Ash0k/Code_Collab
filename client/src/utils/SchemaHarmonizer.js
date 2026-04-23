/**
 * SchemaHarmonizer - Reconciles differences between PostgreSQL and Firebase schemas
 * Handles data transformation, field mapping, and ensures consistency across storage layers
 */

import { PathUtils } from './PathUtils';

export class SchemaHarmonizer {
  constructor() {
    console.log('🔄 SchemaHarmonizer initialized');
    
    // Field mapping between PostgreSQL and Firebase
    this.fieldMappings = {
      users: {
        postgres: {
          'id': 'uid',
          'firebase_uid': 'uid',
          'display_name': 'displayName',
          'photo_url': 'photoURL',
          'email_verified': 'emailVerified',
          'created_at': 'createdAt',
          'updated_at': 'updatedAt',
          'last_login_at': 'lastLoginAt',
          'is_online': 'isOnline',
          'collaboration_settings': 'collaborationSettings'
        },
        firebase: {
          'uid': 'id',
          'displayName': 'display_name',
          'photoURL': 'photo_url',
          'emailVerified': 'email_verified',
          'createdAt': 'created_at',
          'updatedAt': 'updated_at',
          'lastLoginAt': 'last_login_at',
          'isOnline': 'is_online',
          'collaborationSettings': 'collaboration_settings'
        }
      },
      projects: {
        postgres: {
          'owner_id': 'ownerId',
          'owner_name': 'ownerName',
          'file_count': 'fileCount',
          'created_at': 'createdAt',
          'updated_at': 'updatedAt',
          'last_activity': 'lastActivity'
        },
        firebase: {
          'ownerId': 'owner_id',
          'ownerName': 'owner_name',
          'fileCount': 'file_count',
          'createdAt': 'created_at',
          'updatedAt': 'updated_at',
          'lastActivity': 'last_activity'
        }
      },
      files: {
        postgres: {
          'project_id': 'projectId',
          'is_directory': 'isDirectory',
          'parent_id': 'parentId',
          'author_id': 'authorId',
          'author_name': 'authorName',
          'created_at': 'createdAt',
          'updated_at': 'updatedAt',
          'last_modified': 'lastModified'
        },
        firebase: {
          'projectId': 'project_id',
          'isDirectory': 'is_directory',
          'parentId': 'parent_id',
          'authorId': 'author_id',
          'authorName': 'author_name',
          'createdAt': 'created_at',
          'updatedAt': 'updated_at',
          'lastModified': 'last_modified'
        }
      },
      activities: {
        postgres: {
          'project_id': 'projectId',
          'user_id': 'userId',
          'user_name': 'userName'
        },
        firebase: {
          'projectId': 'project_id',
          'userId': 'user_id',
          'userName': 'user_name'
        }
      },
      chatMessages: {
        postgres: {
          'project_id': 'projectId',
          'user_id': 'userId',
          'user_name': 'userName',
          'user_avatar': 'userAvatar',
          'edited_at': 'editedAt',
          'reply_to': 'replyTo'
        },
        firebase: {
          'projectId': 'project_id',
          'userId': 'user_id',
          'userName': 'user_name',
          'userAvatar': 'user_avatar',
          'editedAt': 'edited_at',
          'replyTo': 'reply_to'
        }
      },
      collaborationSessions: {
        postgres: {
          'project_id': 'projectId',
          'created_at': 'createdAt',
          'updated_at': 'updatedAt',
          'ended_at': 'endedAt',
          'is_active': 'isActive'
        },
        firebase: {
          'projectId': 'project_id',
          'createdAt': 'created_at',
          'updatedAt': 'updated_at',
          'endedAt': 'ended_at',
          'isActive': 'is_active'
        }
      },
      fileVersions: {
        postgres: {
          'file_id': 'fileId',
          'author_id': 'authorId',
          'author_name': 'authorName',
          'lines_added': 'linesAdded',
          'lines_removed': 'linesRemoved'
        },
        firebase: {
          'fileId': 'file_id',
          'authorId': 'author_id',
          'authorName': 'author_name',
          'linesAdded': 'lines_added',
          'linesRemoved': 'lines_removed'
        }
      }
    };

    // Type transformations
    this.typeTransformations = {
      postgres: {
        // PostgreSQL to Firebase transformations
        JSONB: (value) => {
          if (typeof value === 'string') {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
          return value;
        },
        TIMESTAMP: (value) => {
          if (value instanceof Date) return value;
          if (typeof value === 'string') return new Date(value);
          return value;
        },
        UUID: (value) => value?.toString() || value,
        BOOLEAN: (value) => Boolean(value),
        BIGINT: (value) => typeof value === 'string' ? parseInt(value, 10) : value,
        'TEXT[]': (value) => Array.isArray(value) ? value : []
      },
      firebase: {
        // Firebase to PostgreSQL transformations
        object: (value) => {
          if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
          }
          return value;
        },
        timestamp: (value) => {
          if (value?.toDate) return value.toDate(); // Firestore Timestamp
          if (value instanceof Date) return value;
          if (typeof value === 'string') return new Date(value);
          return value;
        },
        array: (value) => Array.isArray(value) ? value : [value].filter(Boolean)
      }
    };

    // Schema validation rules
    this.validationRules = {
      users: {
        required: ['email'],
        email: ['email'],
        maxLength: {
          'display_name': 255,
          'email': 255
        }
      },
      projects: {
        required: ['name', 'owner_id'],
        maxLength: {
          'name': 255,
          'owner_name': 255
        },
        enum: {
          'visibility': ['private', 'unlisted', 'public']
        }
      },
      files: {
        required: ['name', 'project_id'],
        maxLength: {
          'name': 255,
          'author_name': 255
        }
      }
    };
  }

  /**
   * Transform data from PostgreSQL format to Firebase format
   */
  postgresqlToFirebase(entityType, data) {
    if (!data || !this.fieldMappings[entityType]) {
      return data;
    }

    const mapping = this.fieldMappings[entityType].postgres;
    const transformed = {};

    Object.entries(data).forEach(([key, value]) => {
      const firebaseKey = mapping[key] || key;
      transformed[firebaseKey] = this.transformValue(value, 'postgres');
    });

    // Handle special cases
    if (entityType === 'users' && transformed.uid && !transformed.id) {
      transformed.id = transformed.uid;
    }

    return this.addFirebaseDefaults(entityType, transformed);
  }

  /**
   * Transform data from Firebase format to PostgreSQL format
   */
  firebaseToPostgresql(entityType, data) {
    if (!data || !this.fieldMappings[entityType]) {
      return data;
    }

    const mapping = this.fieldMappings[entityType].firebase;
    const transformed = {};

    Object.entries(data).forEach(([key, value]) => {
      const postgresKey = mapping[key] || key;
      transformed[postgresKey] = this.transformValue(value, 'firebase');
    });

    // Handle special Firebase fields
    if (data.id && !transformed.id) {
      transformed.id = data.id;
    }

    return this.addPostgresDefaults(entityType, transformed);
  }

  /**
   * Transform individual values based on type
   */
  transformValue(value, sourceType) {
    if (value === null || value === undefined) {
      return value;
    }

    const transformations = this.typeTransformations[sourceType];
    
    if (sourceType === 'postgres') {
      // PostgreSQL to Firebase
      if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
        return transformations.JSONB(value);
      }
      if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
        return transformations.TIMESTAMP(value);
      }
      if (Array.isArray(value)) {
        return value;
      }
    } else if (sourceType === 'firebase') {
      // Firebase to PostgreSQL
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        return transformations.object(value);
      }
      if (value?.toDate) {
        return transformations.timestamp(value);
      }
    }

    return value;
  }

  /**
   * Add Firebase-specific defaults
   */
  addFirebaseDefaults(entityType, data) {
    const now = new Date();
    
    if (!data.createdAt) {
      data.createdAt = now;
    }
    if (!data.updatedAt) {
      data.updatedAt = now;
    }

    // Entity-specific defaults
    switch (entityType) {
      case 'users':
        if (!data.isOnline) data.isOnline = false;
        if (!data.emailVerified) data.emailVerified = false;
        if (!data.profile) data.profile = {};
        if (!data.preferences) data.preferences = {};
        if (!data.collaborationSettings) data.collaborationSettings = {};
        break;
      
      case 'projects':
        if (!data.visibility) data.visibility = 'private';
        if (!data.language) data.language = 'javascript';
        if (!data.collaborators) data.collaborators = [];
        if (!data.fileCount) data.fileCount = 0;
        if (!data.settings) data.settings = {};
        break;
      
      case 'files':
        if (data.isDirectory === undefined) data.isDirectory = false;
        if (!data.permissions) data.permissions = { read: true, write: true, share: true };
        if (!data.tags) data.tags = [];
        if (data.starred === undefined) data.starred = false;
        break;
    }

    return data;
  }

  /**
   * Add PostgreSQL-specific defaults
   */
  addPostgresDefaults(entityType, data) {
    // PostgreSQL handles most defaults in the schema
    // Just ensure critical fields are present
    
    switch (entityType) {
      case 'users':
        if (!data.firebase_uid && data.uid) {
          data.firebase_uid = data.uid;
        }
        break;
    }

    return data;
  }

  /**
   * Validate data against schema rules
   */
  validateData(entityType, data) {
    const rules = this.validationRules[entityType];
    if (!rules) return { isValid: true, errors: [] };

    const errors = [];

    // Special handling for user status updates
    if (entityType === 'users' && data && typeof data === 'object') {
      // Check if this is a status update (partial user data)
      if ((data.isOnline !== undefined || data.lastActivity) && 
          Object.keys(data).length <= 3) {
        // This is a status update, only validate the id
        if (!data.id && !data.uid) {
          errors.push('Status update must have id or uid');
        }
        return {
          isValid: errors.length === 0,
          errors
        };
      }
    }

    // Check required fields
    if (rules.required) {
      rules.required.forEach(field => {
        if (!data[field]) {
          errors.push(`Required field '${field}' is missing`);
        }
      });
    }

    // Check email format
    if (rules.email) {
      rules.email.forEach(field => {
        if (data[field] && !this.isValidEmail(data[field])) {
          errors.push(`Field '${field}' must be a valid email address`);
        }
      });
    }

    // Check max length
    if (rules.maxLength) {
      Object.entries(rules.maxLength).forEach(([field, maxLen]) => {
        if (data[field] && typeof data[field] === 'string' && data[field].length > maxLen) {
          errors.push(`Field '${field}' exceeds maximum length of ${maxLen} characters`);
        }
      });
    }

    // Check enum values
    if (rules.enum) {
      Object.entries(rules.enum).forEach(([field, allowedValues]) => {
        if (data[field] && !allowedValues.includes(data[field])) {
          errors.push(`Field '${field}' must be one of: ${allowedValues.join(', ')}`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if schemas are compatible
   */
  async checkSchemaCompatibility(postgresData, firebaseData, entityType) {
    const compatibility = {
      isCompatible: true,
      conflicts: [],
      suggestions: []
    };

    const pgTransformed = this.firebaseToPostgresql(entityType, firebaseData);
    const fbTransformed = this.postgresqlToFirebase(entityType, postgresData);

    // Compare field presence
    const pgFields = new Set(Object.keys(postgresData));
    const fbFields = new Set(Object.keys(firebaseData));

    const missingInPostgres = [...fbFields].filter(field => !pgFields.has(field));
    const missingInFirebase = [...pgFields].filter(field => !fbFields.has(field));

    if (missingInPostgres.length > 0) {
      compatibility.conflicts.push({
        type: 'missing_fields',
        location: 'postgresql',
        fields: missingInPostgres,
        severity: 'warning'
      });
    }

    if (missingInFirebase.length > 0) {
      compatibility.conflicts.push({
        type: 'missing_fields',
        location: 'firebase',
        fields: missingInFirebase,
        severity: 'warning'
      });
    }

    // Compare values for common fields
    const commonFields = [...pgFields].filter(field => fbFields.has(field));
    
    for (const field of commonFields) {
      const pgValue = postgresData[field];
      const fbValue = firebaseData[field];

      if (!this.areValuesEquivalent(pgValue, fbValue)) {
        compatibility.isCompatible = false;
        compatibility.conflicts.push({
          type: 'value_mismatch',
          field: field,
          postgresValue: pgValue,
          firebaseValue: fbValue,
          severity: 'error'
        });
      }
    }

    return compatibility;
  }

  /**
   * Check if two values are equivalent across schemas
   */
  areValuesEquivalent(value1, value2) {
    // Handle null/undefined
    if (value1 == null && value2 == null) return true;
    if (value1 == null || value2 == null) return false;

    // Handle dates
    if (value1 instanceof Date && value2 instanceof Date) {
      return Math.abs(value1.getTime() - value2.getTime()) < 1000; // 1 second tolerance
    }

    // Handle objects
    if (typeof value1 === 'object' && typeof value2 === 'object') {
      return JSON.stringify(value1) === JSON.stringify(value2);
    }

    // Handle arrays
    if (Array.isArray(value1) && Array.isArray(value2)) {
      return value1.length === value2.length && 
             value1.every((item, index) => this.areValuesEquivalent(item, value2[index]));
    }

    // Handle primitive types
    return String(value1) === String(value2);
  }

  /**
   * Generate migration script for schema differences
   */
  generateMigrationScript(conflicts) {
    const script = {
      postgresql: [],
      firebase: [],
      manual: []
    };

    conflicts.forEach(conflict => {
      switch (conflict.type) {
        case 'missing_fields':
          if (conflict.location === 'postgresql') {
            script.postgresql.push(
              `-- Add missing fields: ${conflict.fields.join(', ')}\n` +
              `-- TODO: Add appropriate ALTER TABLE statements`
            );
          } else {
            script.firebase.push(
              `// Add missing fields to Firebase documents: ${conflict.fields.join(', ')}\n` +
              `// TODO: Update Firestore documents to include these fields`
            );
          }
          break;

        case 'value_mismatch':
          script.manual.push(
            `// Manual resolution required for field '${conflict.field}'\n` +
            `// PostgreSQL value: ${JSON.stringify(conflict.postgresValue)}\n` +
            `// Firebase value: ${JSON.stringify(conflict.firebaseValue)}\n` +
            `// Decide which value to keep and update accordingly`
          );
          break;
      }
    });

    return script;
  }

  /**
   * Utility function to validate email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Normalize data for consistent comparison
   */
  normalizeData(entityType, data, targetFormat = 'firebase') {
    if (targetFormat === 'firebase') {
      return this.postgresqlToFirebase(entityType, data);
    } else {
      return this.firebaseToPostgresql(entityType, data);
    }
  }

  /**
   * Merge data from multiple sources with conflict resolution
   */
  mergeData(entityType, sources, strategy = 'latest') {
    if (!sources || sources.length === 0) return null;
    if (sources.length === 1) return sources[0];

    let merged = {};

    switch (strategy) {
      case 'latest':
        // Use the most recently updated data
        const sorted = sources.sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.updated_at || 0);
          const bTime = new Date(b.updatedAt || b.updated_at || 0);
          return bTime.getTime() - aTime.getTime();
        });
        merged = { ...sorted[0] };
        break;

      case 'merge':
        // Merge all sources, with later sources overriding earlier ones
        sources.forEach(source => {
          merged = { ...merged, ...source };
        });
        break;

      case 'conflict_preserve':
        // Preserve original and mark conflicts
        merged = { ...sources[0] };
        for (let i = 1; i < sources.length; i++) {
          Object.entries(sources[i]).forEach(([key, value]) => {
            if (merged[key] !== undefined && !this.areValuesEquivalent(merged[key], value)) {
              merged[`${key}_conflict`] = {
                original: merged[key],
                conflicting: value,
                sources: sources.map((s, idx) => ({ index: idx, value: s[key] }))
              };
            } else if (merged[key] === undefined) {
              merged[key] = value;
            }
          });
        }
        break;
    }

    return merged;
  }
}

// Create singleton instance
export const schemaHarmonizer = new SchemaHarmonizer();

export default SchemaHarmonizer;
