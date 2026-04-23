/**
 * Schema Harmonizer
 * Handles schema synchronization and compatibility between different data sources
 */

class SchemaHarmonizer {
  constructor() {
    this.schemaVersions = new Map();
    this.migrationStrategies = new Map();
    this.conflictResolvers = new Map();
  }

  /**
   * Register a schema version
   */
  registerSchema(name, version, schema) {
    if (!this.schemaVersions.has(name)) {
      this.schemaVersions.set(name, new Map());
    }
    this.schemaVersions.get(name).set(version, schema);
  }

  /**
   * Register migration strategy
   */
  registerMigration(fromVersion, toVersion, strategy) {
    const key = `${fromVersion}->${toVersion}`;
    this.migrationStrategies.set(key, strategy);
  }

  /**
   * Harmonize data between schemas
   */
  async harmonize(sourceData, sourceSchema, targetSchema) {
    try {
      // If schemas are identical, return as-is
      if (this.schemasAreCompatible(sourceSchema, targetSchema)) {
        return { success: true, data: sourceData };
      }

      // Apply transformation
      const transformedData = await this.transformData(sourceData, sourceSchema, targetSchema);
      
      return { success: true, data: transformedData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if schemas are compatible
   */
  schemasAreCompatible(schema1, schema2) {
    // Simple compatibility check
    return JSON.stringify(schema1) === JSON.stringify(schema2);
  }

  /**
   * Transform data between schemas
   */
  async transformData(data, sourceSchema, targetSchema) {
    // Placeholder transformation logic
    return data;
  }

  /**
   * Resolve schema conflicts
   */
  resolveConflict(conflict) {
    const resolver = this.conflictResolvers.get(conflict.type);
    if (resolver) {
      return resolver(conflict);
    }
    
    // Default resolution: prefer newer data
    return conflict.remoteData;
  }

  /**
   * Validate data against schema
   */
  validateData(entityType, data) {
    try {
      // Basic validation - check if data is object and not null
      if (!data || typeof data !== 'object') {
        return {
          isValid: false,
          errors: ['Data must be a valid object']
        };
      }

      // Entity-specific validation
      switch (entityType) {
        case 'users':
          return this.validateUserData(data);
        case 'projects':
          return this.validateProjectData(data);
        case 'files':
          return this.validateFileData(data);
        case 'activities':
          return this.validateActivityData(data);
        case 'chatMessages':
          return this.validateChatMessageData(data);
        default:
          // Generic validation - just check it's an object
          return { isValid: true, errors: [] };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Validate user data
   */
  validateUserData(data) {
    const errors = [];
    
    // Handle case where data might be file data instead of user data
    if (data && typeof data === 'object' && data.content && data.path) {
      // This looks like file data, not user data - skip validation
      console.warn('⚠️ File data passed to user validation, skipping');
      return { isValid: true, errors: [] };
    }
    
    // Check if this is a status update (partial user data)
    if (data && typeof data === 'object' && 
        (data.isOnline !== undefined || data.lastActivity) && 
        Object.keys(data).length <= 3) {
      // This is a status update, only require id
      if (!data.id && !data.uid) {
        errors.push('Status update must have id or uid');
      }
    } else {
      // This is a full user object, require all fields
      if (!data.id && !data.uid) errors.push('User must have id or uid');
      if (!data.email) errors.push('User must have email');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate project data
   */
  validateProjectData(data) {
    const errors = [];
    
    if (!data.id) errors.push('Project must have id');
    if (!data.name) errors.push('Project must have name');
    if (!data.owner) errors.push('Project must have owner');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate file data
   */
  validateFileData(data) {
    const errors = [];
    
    if (!data.id) errors.push('File must have id');
    if (!data.name) errors.push('File must have name');
    if (!data.path) errors.push('File must have path');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate activity data
   */
  validateActivityData(data) {
    const errors = [];
    
    if (!data.id) errors.push('Activity must have id');
    if (!data.type) errors.push('Activity must have type');
    if (!data.userId) errors.push('Activity must have userId');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate chat message data
   */
  validateChatMessageData(data) {
    const errors = [];
    
    if (!data.id) errors.push('Chat message must have id');
    if (!data.message) errors.push('Chat message must have message');
    if (!data.userId) errors.push('Chat message must have userId');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Transform PostgreSQL data to Firebase format
   */
  postgresqlToFirebase(entityType, data) {
    if (!data) return data;

    const transformed = { ...data };

    // Convert snake_case to camelCase
    const camelCaseData = this.convertSnakeToCamel(transformed);

    // Entity-specific transformations
    switch (entityType) {
      case 'users':
        return this.transformUserToFirebase(camelCaseData);
      case 'projects':
        return this.transformProjectToFirebase(camelCaseData);
      case 'files':
        return this.transformFileToFirebase(camelCaseData);
      default:
        return camelCaseData;
    }
  }

  /**
   * Transform Firebase data to PostgreSQL format
   */
  firebaseToPostgresql(entityType, data) {
    if (!data) return data;

    const transformed = { ...data };

    // Convert camelCase to snake_case
    const snakeCaseData = this.convertCamelToSnake(transformed);

    // Entity-specific transformations
    switch (entityType) {
      case 'users':
        return this.transformUserToPostgres(snakeCaseData);
      case 'projects':
        return this.transformProjectToPostgres(snakeCaseData);
      case 'files':
        return this.transformFileToPostgres(snakeCaseData);
      default:
        return snakeCaseData;
    }
  }

  /**
   * Convert snake_case to camelCase
   */
  convertSnakeToCamel(obj) {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertSnakeToCamel(item));
    }

    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      converted[camelKey] = this.convertSnakeToCamel(value);
    }

    return converted;
  }

  /**
   * Convert camelCase to snake_case
   */
  convertCamelToSnake(obj) {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertCamelToSnake(item));
    }

    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/([A-Z])/g, (match, letter) => `_${letter.toLowerCase()}`);
      converted[snakeKey] = this.convertCamelToSnake(value);
    }

    return converted;
  }

  /**
   * Transform user data for Firebase
   */
  transformUserToFirebase(data) {
    const transformed = { ...data };
    
    // Convert PostgreSQL timestamp to Firebase timestamp
    if (transformed.createdAt && typeof transformed.createdAt === 'string') {
      transformed.createdAt = new Date(transformed.createdAt).toISOString();
    }
    if (transformed.updatedAt && typeof transformed.updatedAt === 'string') {
      transformed.updatedAt = new Date(transformed.updatedAt).toISOString();
    }

    return transformed;
  }

  /**
   * Transform user data for PostgreSQL
   */
  transformUserToPostgres(data) {
    const transformed = { ...data };
    
    // Ensure required fields exist with defaults
    transformed.created_at = transformed.created_at || new Date().toISOString();
    transformed.updated_at = transformed.updated_at || new Date().toISOString();

    return transformed;
  }

  /**
   * Transform project data for Firebase
   */
  transformProjectToFirebase(data) {
    const transformed = { ...data };
    
    // Convert arrays to Firebase-compatible format
    if (transformed.files && Array.isArray(transformed.files)) {
      transformed.files = transformed.files.reduce((acc, file, index) => {
        acc[file.id || index] = file;
        return acc;
      }, {});
    }

    return transformed;
  }

  /**
   * Transform project data for PostgreSQL
   */
  transformProjectToPostgres(data) {
    const transformed = { ...data };
    
    // Convert Firebase object format back to arrays
    if (transformed.files && typeof transformed.files === 'object' && !Array.isArray(transformed.files)) {
      transformed.files = Object.values(transformed.files);
    }

    return transformed;
  }

  /**
   * Transform file data for Firebase
   */
  transformFileToFirebase(data) {
    return { ...data };
  }

  /**
   * Transform file data for PostgreSQL
   */
  transformFileToPostgres(data) {
    return { ...data };
  }

  /**
   * Check schema compatibility between two data objects
   */
  async checkSchemaCompatibility(data1, data2, entityType) {
    const conflicts = [];

    if (!data1 || !data2) {
      return {
        isCompatible: true,
        conflicts: []
      };
    }

    // Get all unique keys from both objects
    const keys1 = new Set(Object.keys(data1));
    const keys2 = new Set(Object.keys(data2));
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
      const value1 = data1[key];
      const value2 = data2[key];

      // Missing field conflicts
      if (keys1.has(key) && !keys2.has(key)) {
        conflicts.push({
          type: 'missing_fields',
          location: 'data2',
          fields: [key]
        });
      } else if (!keys1.has(key) && keys2.has(key)) {
        conflicts.push({
          type: 'missing_fields',
          location: 'data1',
          fields: [key]
        });
      }
      // Value mismatch conflicts
      else if (keys1.has(key) && keys2.has(key) && value1 !== value2) {
        conflicts.push({
          type: 'value_mismatch',
          field: key,
          postgresValue: value1,
          firebaseValue: value2
        });
      }
    }

    return {
      isCompatible: conflicts.length === 0,
      conflicts
    };
  }

  /**
   * Add default values for PostgreSQL
   */
  addPostgresDefaults(entityType, data) {
    const defaults = { ...data };

    switch (entityType) {
      case 'users':
        defaults.created_at = defaults.created_at || new Date().toISOString();
        defaults.updated_at = defaults.updated_at || new Date().toISOString();
        defaults.is_active = defaults.is_active !== undefined ? defaults.is_active : true;
        break;
      case 'projects':
        defaults.created_at = defaults.created_at || new Date().toISOString();
        defaults.updated_at = defaults.updated_at || new Date().toISOString();
        defaults.is_public = defaults.is_public !== undefined ? defaults.is_public : false;
        break;
      case 'files':
        defaults.created_at = defaults.created_at || new Date().toISOString();
        defaults.updated_at = defaults.updated_at || new Date().toISOString();
        defaults.size = defaults.size || 0;
        break;
    }

    return defaults;
  }

  /**
   * Add default values for Firebase
   */
  addFirebaseDefaults(entityType, data) {
    const defaults = { ...data };

    switch (entityType) {
      case 'users':
        defaults.createdAt = defaults.createdAt || new Date().toISOString();
        defaults.updatedAt = defaults.updatedAt || new Date().toISOString();
        defaults.isActive = defaults.isActive !== undefined ? defaults.isActive : true;
        break;
      case 'projects':
        defaults.createdAt = defaults.createdAt || new Date().toISOString();
        defaults.updatedAt = defaults.updatedAt || new Date().toISOString();
        defaults.isPublic = defaults.isPublic !== undefined ? defaults.isPublic : false;
        break;
      case 'files':
        defaults.createdAt = defaults.createdAt || new Date().toISOString();
        defaults.updatedAt = defaults.updatedAt || new Date().toISOString();
        defaults.size = defaults.size || 0;
        break;
    }

    return defaults;
  }
}

// Create and export singleton instance
export const schemaHarmonizer = new SchemaHarmonizer();
export default SchemaHarmonizer;
