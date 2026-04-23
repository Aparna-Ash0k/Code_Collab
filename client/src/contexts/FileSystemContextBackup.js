import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { virtualFileSystem } from '../utils/virtualFileSystem';

const FileSystemContextBackup = createContext(null);

export const useFileSystemBackup = () => {
  const context = useContext(FileSystemContextBackup);
  if (!context) {
    throw new Error('useFileSystemBackup must be used within a FileSystemBackupProvider');
  }
  return context;
};

export const FileSystemBackupProvider = ({ children }) => {
  const [fileTree, setFileTree] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Refresh file tree
  const refreshFileTree = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const tree = virtualFileSystem.getFileTree();
      setFileTree(tree);
    } catch (err) {
      setError(err.message);
      console.error('Error refreshing file tree:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // File operations
  const createFile = useCallback(async (path, content = '') => {
    try {
      virtualFileSystem.createFile(path, content);
      await refreshFileTree();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshFileTree]);

  const createFolder = useCallback(async (path) => {
    try {
      virtualFileSystem.createFolder(path);
      await refreshFileTree();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshFileTree]);

  const deleteFile = useCallback(async (path) => {
    try {
      virtualFileSystem.deleteFile(path);
      await refreshFileTree();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshFileTree]);

  const deleteFolder = useCallback(async (path) => {
    try {
      virtualFileSystem.deleteFolder(path);
      await refreshFileTree();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshFileTree]);

  const renameFile = useCallback(async (oldPath, newPath) => {
    try {
      const file = virtualFileSystem.getFile(oldPath);
      if (file) {
        virtualFileSystem.createFile(newPath, file.content);
        virtualFileSystem.deleteFile(oldPath);
        await refreshFileTree();
      }
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshFileTree]);

  const renameFolder = useCallback(async (oldPath, newPath) => {
    try {
      // Get all files in the folder
      const files = virtualFileSystem.listFiles(oldPath);
      
      // Recreate folder structure
      virtualFileSystem.createFolder(newPath);
      
      // Move all files
      for (const file of files) {
        if (!file.isDirectory) {
          const relativePath = file.path.substring(oldPath.length);
          const newFilePath = newPath + relativePath;
          virtualFileSystem.createFile(newFilePath, file.content);
          virtualFileSystem.deleteFile(file.path);
        }
      }
      
      // Delete old folder
      virtualFileSystem.deleteFolder(oldPath);
      await refreshFileTree();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshFileTree]);

  const getFile = useCallback((path) => {
    return virtualFileSystem.getFile(path);
  }, []);

  const updateFile = useCallback(async (path, content) => {
    try {
      virtualFileSystem.updateFile(path, content);
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Initialize file tree on mount
  useEffect(() => {
    refreshFileTree();
  }, [refreshFileTree]);

  // Listen for file system changes
  useEffect(() => {
    const handleFileSystemChange = () => {
      refreshFileTree();
    };

    const unsubscribe = virtualFileSystem.addListener(handleFileSystemChange);
    return unsubscribe;
  }, [refreshFileTree]);

  const contextValue = {
    fileTree,
    isLoading,
    error,
    refreshFileTree,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameFile,
    renameFolder,
    getFile,
    updateFile,
  };

  return (
    <FileSystemContextBackup.Provider value={contextValue}>
      {children}
    </FileSystemContextBackup.Provider>
  );
};

export default FileSystemContextBackup;
