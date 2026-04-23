/**
 * Enhanced File System Manager
 * A robust virtual file system with improved performance and error handling
 */

export class EnhancedFileSystem {
  constructor() {
    this.files = new Map(); // path -> FileNode
    this.folders = new Map(); // path -> FolderNode
    this.listeners = new Set();
    this.watchedPaths = new Set();
    this.isInitialized = false;
    
    // File system state
    this.stats = {
      totalFiles: 0,
      totalFolders: 0,
      totalSize: 0
    };
    
    this.init();
  }

  /**
   * Initialize the file system with clean empty state
   */
  async init() {
    try {
      // Start with completely empty file system
      this.files.clear();
      this.folders.clear();
      
      this.isInitialized = true;
      this.updateStats();
      this.notifyListeners();
      console.log('✅ Enhanced file system initialized with clean state');
    } catch (error) {
      console.error('❌ Failed to initialize file system:', error);
      throw error;
    }
  }

  /**
   * Create default project structure (optional - can be called manually)
   */
  async createDefaultStructure() {
    const defaultStructure = {
      folders: [
        'src',
        'src/components',
        'src/utils',
        'src/styles',
        'src/hooks',
        'src/contexts',
        'src/services',
        'public',
        'docs',
        'tests',
        '.vscode'
      ],
      files: {
        'README.md': {
          content: this.getDefaultReadmeContent(),
          type: 'markdown'
        },
        'package.json': {
          content: this.getDefaultPackageJson(),
          type: 'json'
        },
        'src/index.js': {
          content: this.getDefaultIndexJs(),
          type: 'javascript'
        },
        'src/App.js': {
          content: this.getDefaultAppJs(),
          type: 'javascript'
        },
        'src/styles/index.css': {
          content: this.getDefaultCss(),
          type: 'css'
        },
        '.gitignore': {
          content: this.getDefaultGitignore(),
          type: 'text'
        }
      }
    };

    // Create folders
    for (const folderPath of defaultStructure.folders) {
      await this.createFolder(folderPath, { notify: false });
    }

    // Create files
    for (const [filePath, fileData] of Object.entries(defaultStructure.files)) {
      await this.createFile(filePath, fileData.content, { 
        type: fileData.type, 
        notify: false 
      });
    }

    this.updateStats();
    this.notifyListeners();
  }

  /**
   * Create a file node
   */
  createFileNode(path, content = '', options = {}) {
    const {
      type = this.getFileType(path),
      encoding = 'utf-8',
      metadata = {}
    } = options;

    return {
      path,
      name: this.getFileName(path),
      content: String(content),
      type,
      encoding,
      size: String(content).length,
      created: Date.now(),
      modified: Date.now(),
      accessed: Date.now(),
      isDirty: false,
      isReadonly: false,
      metadata: {
        ...metadata,
        checksum: this.generateChecksum(content)
      }
    };
  }

  /**
   * Create a folder node
   */
  createFolderNode(path, options = {}) {
    const { metadata = {} } = options;

    return {
      path,
      name: this.getFolderName(path),
      type: 'folder',
      created: Date.now(),
      modified: Date.now(),
      accessed: Date.now(),
      isExpanded: false,
      metadata
    };
  }

  /**
   * Create a new file
   */
  async createFile(path, content = '', options = {}) {
    try {
      if (!path || typeof path !== 'string') {
        throw new Error('Invalid file path');
      }

      const normalizedPath = this.normalizePath(path);
      
      if (this.files.has(normalizedPath)) {
        if (!options.overwrite) {
          throw new Error(`File already exists: ${normalizedPath}`);
        }
      }

      // Ensure parent directories exist
      await this.ensureParentDirectories(normalizedPath);

      // Create file node
      const fileNode = this.createFileNode(normalizedPath, content, options);
      this.files.set(normalizedPath, fileNode);

      // Update stats
      this.updateStats();

      // Notify listeners
      if (options.notify !== false) {
        this.notifyListeners();
        this.notifyWatchers('create', normalizedPath, fileNode);
      }

      console.log(`📄 Created file: ${normalizedPath}`);
      return fileNode;
    } catch (error) {
      console.error(`❌ Failed to create file ${path}:`, error);
      throw error;
    }
  }

  /**
   * Create a new folder
   */
  async createFolder(path, options = {}) {
    try {
      if (!path || typeof path !== 'string') {
        throw new Error('Invalid folder path');
      }

      const normalizedPath = this.normalizePath(path);
      
      if (this.folders.has(normalizedPath)) {
        if (!options.overwrite) {
          return this.folders.get(normalizedPath);
        }
      }

      // Create parent directories
      await this.ensureParentDirectories(normalizedPath, true);

      // Create folder node
      const folderNode = this.createFolderNode(normalizedPath, options);
      this.folders.set(normalizedPath, folderNode);

      // Update stats
      this.updateStats();

      // Notify listeners
      if (options.notify !== false) {
        this.notifyListeners();
        this.notifyWatchers('create', normalizedPath, folderNode);
      }

      console.log(`📁 Created folder: ${normalizedPath}`);
      return folderNode;
    } catch (error) {
      console.error(`❌ Failed to create folder ${path}:`, error);
      throw error;
    }
  }

  /**
   * Read a file
   */
  readFile(path) {
    try {
      const normalizedPath = this.normalizePath(path);
      const fileNode = this.files.get(normalizedPath);
      
      if (!fileNode) {
        throw new Error(`File not found: ${normalizedPath}`);
      }

      // Update access time
      fileNode.accessed = Date.now();
      
      return fileNode;
    } catch (error) {
      console.error(`❌ Failed to read file ${path}:`, error);
      throw error;
    }
  }

  /**
   * Update file content
   */
  async updateFile(path, content, options = {}) {
    try {
      const normalizedPath = this.normalizePath(path);
      const fileNode = this.files.get(normalizedPath);
      
      if (!fileNode) {
        return await this.createFile(normalizedPath, content, options);
      }

      if (fileNode.isReadonly) {
        throw new Error(`File is readonly: ${normalizedPath}`);
      }

      // Update content and metadata
      const oldContent = fileNode.content;
      fileNode.content = String(content);
      fileNode.modified = Date.now();
      fileNode.size = fileNode.content.length;
      fileNode.isDirty = options.markDirty !== false;
      fileNode.metadata.checksum = this.generateChecksum(content);

      // Update stats
      this.updateStats();

      // Notify listeners
      if (options.notify !== false) {
        this.notifyListeners();
        this.notifyWatchers('update', normalizedPath, fileNode, { oldContent });
      }

      console.log(`📝 Updated file: ${normalizedPath}`);
      return fileNode;
    } catch (error) {
      console.error(`❌ Failed to update file ${path}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file or folder
   */
  async delete(path, options = {}) {
    try {
      const normalizedPath = this.normalizePath(path);
      let deletedItems = [];

      // Check if it's a folder
      if (this.folders.has(normalizedPath)) {
        deletedItems = await this.deleteFolder(normalizedPath, options);
      } else if (this.files.has(normalizedPath)) {
        deletedItems = await this.deleteFile(normalizedPath, options);
      } else {
        throw new Error(`Path not found: ${normalizedPath}`);
      }

      // Update stats
      this.updateStats();

      // Notify listeners
      if (options.notify !== false) {
        this.notifyListeners();
        deletedItems.forEach(item => {
          this.notifyWatchers('delete', item.path, item);
        });
      }

      console.log(`🗑️ Deleted: ${normalizedPath} (${deletedItems.length} items)`);
      return deletedItems;
    } catch (error) {
      console.error(`❌ Failed to delete ${path}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(path, options = {}) {
    const fileNode = this.files.get(path);
    if (!fileNode) {
      throw new Error(`File not found: ${path}`);
    }

    this.files.delete(path);
    return [fileNode];
  }

  /**
   * Delete a folder and all its contents
   */
  async deleteFolder(path, options = {}) {
    const deletedItems = [];
    
    // Delete all files in folder
    for (const [filePath, fileNode] of this.files.entries()) {
      if (filePath.startsWith(path + '/') || filePath === path) {
        this.files.delete(filePath);
        deletedItems.push(fileNode);
      }
    }

    // Delete all subfolders
    for (const [folderPath, folderNode] of this.folders.entries()) {
      if (folderPath.startsWith(path + '/') || folderPath === path) {
        this.folders.delete(folderPath);
        deletedItems.push(folderNode);
      }
    }

    return deletedItems;
  }

  /**
   * Rename/move a file or folder
   */
  async rename(oldPath, newPath, options = {}) {
    try {
      const normalizedOldPath = this.normalizePath(oldPath);
      const normalizedNewPath = this.normalizePath(newPath);

      if (normalizedOldPath === normalizedNewPath) {
        return; // Nothing to do
      }

      if (this.exists(normalizedNewPath) && !options.overwrite) {
        throw new Error(`Target path already exists: ${normalizedNewPath}`);
      }

      let renamedItems = [];

      if (this.folders.has(normalizedOldPath)) {
        renamedItems = await this.renameFolder(normalizedOldPath, normalizedNewPath, options);
      } else if (this.files.has(normalizedOldPath)) {
        renamedItems = await this.renameFile(normalizedOldPath, normalizedNewPath, options);
      } else {
        throw new Error(`Path not found: ${normalizedOldPath}`);
      }

      // Update stats
      this.updateStats();

      // Notify listeners
      if (options.notify !== false) {
        this.notifyListeners();
        renamedItems.forEach(({ oldPath, newPath, item }) => {
          this.notifyWatchers('rename', newPath, item, { oldPath });
        });
      }

      console.log(`📝 Renamed: ${normalizedOldPath} → ${normalizedNewPath}`);
      return renamedItems;
    } catch (error) {
      console.error(`❌ Failed to rename ${oldPath} to ${newPath}:`, error);
      throw error;
    }
  }

  /**
   * Rename a file
   */
  async renameFile(oldPath, newPath, options = {}) {
    const fileNode = this.files.get(oldPath);
    if (!fileNode) {
      throw new Error(`File not found: ${oldPath}`);
    }

    // Ensure parent directory exists for new path
    await this.ensureParentDirectories(newPath);

    // Update file node
    fileNode.path = newPath;
    fileNode.name = this.getFileName(newPath);
    fileNode.modified = Date.now();

    // Move in storage
    this.files.delete(oldPath);
    this.files.set(newPath, fileNode);

    return [{ oldPath, newPath, item: fileNode }];
  }

  /**
   * Rename a folder and all its contents
   */
  async renameFolder(oldPath, newPath, options = {}) {
    const renamedItems = [];

    // Ensure parent directory exists for new path
    await this.ensureParentDirectories(newPath, true);

    // Rename folder itself
    const folderNode = this.folders.get(oldPath);
    if (folderNode) {
      folderNode.path = newPath;
      folderNode.name = this.getFolderName(newPath);
      folderNode.modified = Date.now();
      
      this.folders.delete(oldPath);
      this.folders.set(newPath, folderNode);
      renamedItems.push({ oldPath, newPath, item: folderNode });
    }

    // Rename all files in folder
    for (const [filePath, fileNode] of this.files.entries()) {
      if (filePath.startsWith(oldPath + '/')) {
        const newFilePath = filePath.replace(oldPath, newPath);
        fileNode.path = newFilePath;
        fileNode.name = this.getFileName(newFilePath);
        fileNode.modified = Date.now();
        
        this.files.delete(filePath);
        this.files.set(newFilePath, fileNode);
        renamedItems.push({ oldPath: filePath, newPath: newFilePath, item: fileNode });
      }
    }

    // Rename all subfolders
    for (const [folderPath, folderNode] of this.folders.entries()) {
      if (folderPath.startsWith(oldPath + '/')) {
        const newFolderPath = folderPath.replace(oldPath, newPath);
        folderNode.path = newFolderPath;
        folderNode.name = this.getFolderName(newFolderPath);
        folderNode.modified = Date.now();
        
        this.folders.delete(folderPath);
        this.folders.set(newFolderPath, folderNode);
        renamedItems.push({ oldPath: folderPath, newPath: newFolderPath, item: folderNode });
      }
    }

    return renamedItems;
  }

  /**
   * Check if a path exists
   */
  exists(path) {
    const normalizedPath = this.normalizePath(path);
    return this.files.has(normalizedPath) || this.folders.has(normalizedPath);
  }

  /**
   * Get file tree structure
   */
  getFileTree() {
    const tree = {
      name: 'Root',
      path: '',
      type: 'folder',
      children: {},
      isExpanded: true
    };

    // Add folders first
    const sortedFolders = Array.from(this.folders.keys()).sort();
    for (const folderPath of sortedFolders) {
      this.addToTree(tree, folderPath, this.folders.get(folderPath));
    }

    // Add files
    const sortedFiles = Array.from(this.files.keys()).sort();
    for (const filePath of sortedFiles) {
      this.addToTree(tree, filePath, this.files.get(filePath));
    }

    return tree;
  }

  /**
   * Get file tree as array (for backward compatibility)
   */
  getFileTreeArray() {
    const tree = this.getFileTree();
    return this.treeToArray(tree);
  }

  /**
   * Add item to tree structure
   */
  addToTree(tree, path, item) {
    const parts = path.split('/').filter(Boolean);
    let current = tree;

    // Navigate to parent
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          type: 'folder',
          children: {},
          isExpanded: false
        };
      }
      current = current.children[part];
    }

    // Add item
    const itemName = parts[parts.length - 1] || item.name;
    current.children[itemName] = {
      ...item,
      children: item.type === 'folder' ? {} : undefined
    };
  }

  /**
   * Convert tree to array format
   */
  treeToArray(tree) {
    if (!tree.children) return [];

    const result = [];
    
    for (const [name, child] of Object.entries(tree.children)) {
      const item = {
        name: child.name,
        path: child.path,
        type: child.type,
        isDirty: child.isDirty || false,
        lastModified: child.modified,
        size: child.size
      };

      if (child.type === 'folder' && child.children) {
        item.children = this.treeToArray(child);
      } else if (child.type === 'file') {
        item.content = child.content;
      }

      result.push(item);
    }

    return result.sort((a, b) => {
      // Folders first, then files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Search files and folders
   */
  search(query, options = {}) {
    const {
      caseSensitive = false,
      includeContent = false,
      fileTypes = [],
      maxResults = 100
    } = options;

    const results = [];
    const searchTerm = caseSensitive ? query : query.toLowerCase();

    // Search files
    for (const [path, fileNode] of this.files.entries()) {
      if (results.length >= maxResults) break;

      const fileName = caseSensitive ? fileNode.name : fileNode.name.toLowerCase();
      const fileContent = caseSensitive ? fileNode.content : fileNode.content.toLowerCase();

      // Filter by file type
      if (fileTypes.length > 0 && !fileTypes.includes(fileNode.type)) {
        continue;
      }

      // Check name match
      if (fileName.includes(searchTerm)) {
        results.push({
          type: 'name',
          path,
          node: fileNode,
          match: fileNode.name
        });
        continue;
      }

      // Check content match
      if (includeContent && fileContent.includes(searchTerm)) {
        const lines = fileNode.content.split('\n');
        const matchingLines = lines
          .map((line, index) => ({ line: line.trim(), number: index + 1 }))
          .filter(({ line }) => 
            caseSensitive ? line.includes(query) : line.toLowerCase().includes(searchTerm)
          );

        if (matchingLines.length > 0) {
          results.push({
            type: 'content',
            path,
            node: fileNode,
            matches: matchingLines.slice(0, 5) // Limit to 5 matches per file
          });
        }
      }
    }

    // Search folders
    for (const [path, folderNode] of this.folders.entries()) {
      if (results.length >= maxResults) break;

      const folderName = caseSensitive ? folderNode.name : folderNode.name.toLowerCase();

      if (folderName.includes(searchTerm)) {
        results.push({
          type: 'name',
          path,
          node: folderNode,
          match: folderNode.name
        });
      }
    }

    return results;
  }

  /**
   * Get file statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Update statistics
   */
  updateStats() {
    this.stats.totalFiles = this.files.size;
    this.stats.totalFolders = this.folders.size;
    this.stats.totalSize = Array.from(this.files.values())
      .reduce((total, file) => total + file.size, 0);
  }

  /**
   * Add change listener
   */
  addListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
  }

  /**
   * Remove change listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners() {
    const tree = this.getFileTreeArray();
    this.listeners.forEach(callback => {
      try {
        callback(tree);
      } catch (error) {
        console.error('Error in file system listener:', error);
      }
    });
  }

  /**
   * Add path watcher
   */
  watch(path, callback) {
    this.watchedPaths.add({ path: this.normalizePath(path), callback });
  }

  /**
   * Remove path watcher
   */
  unwatch(path, callback) {
    this.watchedPaths.forEach(watcher => {
      if (watcher.path === this.normalizePath(path) && watcher.callback === callback) {
        this.watchedPaths.delete(watcher);
      }
    });
  }

  /**
   * Notify watchers
   */
  notifyWatchers(action, path, item, metadata = {}) {
    this.watchedPaths.forEach(watcher => {
      if (path.startsWith(watcher.path)) {
        try {
          watcher.callback(action, path, item, metadata);
        } catch (error) {
          console.error('Error in file system watcher:', error);
        }
      }
    });
  }

  /**
   * Serialize file system state
   */
  serialize() {
    const filesData = {};
    const foldersData = [];

    for (const [path, fileNode] of this.files.entries()) {
      filesData[path] = {
        content: fileNode.content,
        type: fileNode.type,
        lastModified: fileNode.modified,
        isDirty: fileNode.isDirty,
        metadata: fileNode.metadata
      };
    }

    for (const [path] of this.folders.entries()) {
      foldersData.push(path);
    }

    return {
      files: filesData,
      folders: foldersData,
      stats: this.stats,
      timestamp: Date.now()
    };
  }

  /**
   * Load from serialized data
   */
  loadFromData(data) {
    try {
      if (!data || typeof data !== 'object') {
        console.warn('Invalid data provided to loadFromData');
        return;
      }

      // Clear existing data
      this.files.clear();
      this.folders.clear();

      // Load folders
      if (Array.isArray(data.folders)) {
        data.folders.forEach(folderPath => {
          this.folders.set(folderPath, this.createFolderNode(folderPath));
        });
      }

      // Load files
      if (data.files && typeof data.files === 'object') {
        for (const [path, fileData] of Object.entries(data.files)) {
          const fileNode = this.createFileNode(path, fileData.content, {
            type: fileData.type,
            metadata: fileData.metadata
          });
          fileNode.modified = fileData.lastModified || Date.now();
          fileNode.isDirty = fileData.isDirty || false;
          this.files.set(path, fileNode);
        }
      }

      // Update stats
      this.updateStats();

      // Notify listeners
      this.notifyListeners();

      console.log('✅ File system data loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load file system data:', error);
      throw error;
    }
  }

  /**
   * Utility methods
   */
  normalizePath(path) {
    if (!path) return '';
    return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  }

  getFileName(path) {
    const normalized = this.normalizePath(path);
    return normalized.split('/').pop() || '';
  }

  getFolderName(path) {
    const normalized = this.normalizePath(path);
    return normalized.split('/').pop() || '';
  }

  getFileType(path) {
    const ext = path.split('.').pop()?.toLowerCase();
    const typeMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      json: 'json',
      md: 'markdown',
      txt: 'text',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      xml: 'xml',
      yml: 'yaml',
      yaml: 'yaml'
    };
    return typeMap[ext] || 'text';
  }

  generateChecksum(content) {
    // Simple hash function for content verification
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  async ensureParentDirectories(path, isFolder = false) {
    const parts = this.normalizePath(path).split('/');
    const partsToCreate = isFolder ? parts : parts.slice(0, -1);
    
    for (let i = 0; i < partsToCreate.length; i++) {
      const folderPath = partsToCreate.slice(0, i + 1).join('/');
      if (!this.folders.has(folderPath)) {
        this.folders.set(folderPath, this.createFolderNode(folderPath));
      }
    }
  }

  /**
   * Default content generators
   */
  getDefaultReadmeContent() {
    return `# CodeCollab Project

Welcome to your new collaborative coding project!

## Features
- 🚀 Real-time collaboration
- 📁 Advanced file management
- 🔄 Live synchronization
- 💻 Multi-language support
- 🎨 Modern interface

## Getting Started

1. **Create files**: Use the file explorer to create new files and folders
2. **Start coding**: Open any file and start writing code
3. **Collaborate**: Share your session with others for real-time collaboration
4. **Save**: Your work is automatically saved

## Project Structure

\`\`\`
├── src/
│   ├── components/    # React components
│   ├── utils/         # Utility functions
│   ├── styles/        # CSS styles
│   ├── hooks/         # Custom React hooks
│   ├── contexts/      # React contexts
│   └── services/      # API services
├── public/            # Static assets
├── docs/              # Documentation
└── tests/             # Test files
\`\`\`

## Technologies

- React.js
- Node.js
- Socket.io
- Modern ES6+

Happy coding! 🎉
`;
  }

  getDefaultPackageJson() {
    return JSON.stringify({
      "name": "codecollab-project",
      "version": "1.0.0",
      "description": "A collaborative coding project",
      "main": "src/index.js",
      "scripts": {
        "start": "react-scripts start",
        "build": "react-scripts build",
        "test": "react-scripts test",
        "eject": "react-scripts eject"
      },
      "dependencies": {
        "react": "^18.2.0",
        "react-dom": "^18.2.0"
      },
      "devDependencies": {
        "react-scripts": "^5.0.1"
      },
      "keywords": ["collaboration", "coding", "real-time"],
      "author": "CodeCollab Team",
      "license": "MIT"
    }, null, 2);
  }

  getDefaultIndexJs() {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  }

  getDefaultAppJs() {
    return `import React, { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('Welcome to CodeCollab!');

  const handleClick = () => {
    setCount(count + 1);
    setMessage(\`Button clicked \${count + 1} time\${count + 1 === 1 ? '' : 's'}!\`);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚀 CodeCollab Project</h1>
        <p>{message}</p>
        
        <div className="interactive-section">
          <button 
            onClick={handleClick}
            className="action-button"
          >
            Click me! ({count})
          </button>
        </div>
        
        <div className="features">
          <h2>Features</h2>
          <ul>
            <li>✅ Real-time collaboration</li>
            <li>✅ File management</li>
            <li>✅ Live synchronization</li>
            <li>✅ Multi-language support</li>
          </ul>
        </div>
      </header>
    </div>
  );
}

export default App;
`;
  }

  getDefaultCss() {
    return `.app {
  text-align: center;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px;
  color: white;
  border-radius: 12px;
  margin-bottom: 20px;
}

.app-header h1 {
  margin: 0 0 20px 0;
  font-size: 2.5em;
}

.app-header p {
  font-size: 1.2em;
  margin-bottom: 30px;
}

.interactive-section {
  margin: 30px 0;
}

.action-button {
  background: #ff6b6b;
  color: white;
  border: none;
  padding: 12px 24px;
  font-size: 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.action-button:hover {
  background: #ff5252;
}

.features {
  margin-top: 30px;
  text-align: left;
  display: inline-block;
}

.features h2 {
  margin-bottom: 15px;
}

.features ul {
  list-style: none;
  padding: 0;
}

.features li {
  margin: 10px 0;
  font-size: 1.1em;
}

/* Responsive design */
@media (max-width: 768px) {
  .app-header {
    padding: 20px;
  }
  
  .app-header h1 {
    font-size: 2em;
  }
}
`;
  }

  getDefaultGitignore() {
    return `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production builds
build/
dist/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Temporary files
tmp/
temp/
`;
  }
}

// Create and export default instance
export const enhancedFileSystem = new EnhancedFileSystem();
export default enhancedFileSystem;
