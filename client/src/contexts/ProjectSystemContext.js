// Re-export ProjectSystem from FileSystemContext for backward compatibility
// This file exists to maintain import compatibility

export { 
  ProjectSystemProvider, 
  useProjectSystem, 
  ProjectSystemContext,
  // Keep the original context name as default export
  ProjectSystemContext as default
} from './FileSystemContext';

// Also export the FileSystem aliases for compatibility
export { 
  FileSystemProvider, 
  useFileSystem, 
  FileSystemContext
} from './FileSystemContext';
