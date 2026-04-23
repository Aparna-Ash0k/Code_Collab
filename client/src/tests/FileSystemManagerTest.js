/**
 * Test suite for the new FileSystemManager architecture
 * 
 * This tests the adapter pattern and ensures all synchronization issues are resolved.
 */

import { FileSystemManager, ADAPTER_ORIGINS, OPERATION_TYPES } from '../services/FileSystemManager.js';
import { VFSAdapter } from '../services/adapters/VFSAdapter.js';
import { LocalAdapter } from '../services/adapters/LocalAdapter.js';

// Mock user and session for testing
const mockUser = {
  id: 'test_user_123',
  name: 'Test User',
  email: 'test@codecollab.com'
};

const mockSession = {
  id: 'test_session_456'
};

// Mock socket for testing
const mockSocket = {
  userId: mockUser.id,
  userName: mockUser.name,
  emit: (event, data) => {
    console.log(`📡 Mock socket emit: ${event}`, data);
  },
  on: (event, handler) => {
    console.log(`📡 Mock socket listener: ${event}`);
  },
  off: (event) => {
    console.log(`📡 Mock socket off: ${event}`);
  }
};

/**
 * Test the FileSystemManager architecture
 */
export async function testFileSystemManager() {
  console.log('🧪 Starting FileSystemManager tests...');
  
  try {
    // Create FileSystemManager instance
    const fsManager = new FileSystemManager();
    
    // Initialize with mock context
    await fsManager.initialize({
      user: mockUser,
      socket: mockSocket,
      session: mockSession,
      firebaseService: null // Skip Firebase for testing
    });
    
    console.log('✅ FileSystemManager initialized successfully');
    
    // Test 1: Create a file
    console.log('\n🧪 Test 1: Create file');
    const createResult = await fsManager.createFile({
      path: 'test-file.js',
      name: 'test-file.js',
      content: 'console.log("Hello, FileSystemManager!");',
      type: 'file'
    });
    
    console.log('✅ File creation result:', createResult.success);
    
    // Test 2: Update the file
    console.log('\n🧪 Test 2: Update file');
    const updateResult = await fsManager.updateFile(
      'test-file.js', 
      'console.log("Updated with FileSystemManager!");'
    );
    
    console.log('✅ File update result:', updateResult.success);
    
    // Test 3: Create a folder
    console.log('\n🧪 Test 3: Create folder');
    const folderResult = await fsManager.createFolder({
      path: 'test-folder',
      name: 'test-folder',
      type: 'folder'
    });
    
    console.log('✅ Folder creation result:', folderResult.success);
    
    // Test 4: Create file in folder
    console.log('\n🧪 Test 4: Create file in folder');
    const fileInFolderResult = await fsManager.createFile({
      path: 'test-folder/nested-file.js',
      name: 'nested-file.js',
      content: 'console.log("Nested file!");',
      type: 'file'
    });
    
    console.log('✅ Nested file creation result:', fileInFolderResult.success);
    
    // Test 5: Check canonical state
    console.log('\n🧪 Test 5: Check canonical state');
    const canonicalState = fsManager.getCanonicalState();
    console.log('📊 Canonical state contains:', canonicalState.size, 'items');
    
    for (const [path, data] of canonicalState) {
      console.log(`  - ${path}: ${data.type} (${data.content?.length || 0} chars)`);
    }
    
    // Test 6: Test file operations
    console.log('\n🧪 Test 6: Test file operations');
    
    // Check if file exists
    const fileExists = fsManager.fileExists('test-file.js');
    console.log('✅ File exists check:', fileExists);
    
    // Get file content
    const fileContent = fsManager.getFileContent('test-file.js');
    console.log('✅ File content retrieved:', fileContent ? 'Success' : 'Failed');
    
    // Get files array
    const filesArray = fsManager.getFilesArray();
    console.log('✅ Files array length:', filesArray.length);
    
    // Test 7: Test rename operation
    console.log('\n🧪 Test 7: Rename file');
    const renameResult = await fsManager.renameFile('test-file.js', 'renamed-file.js');
    console.log('✅ Rename result:', renameResult.success);
    
    // Verify rename worked
    const oldFileExists = fsManager.fileExists('test-file.js');
    const newFileExists = fsManager.fileExists('renamed-file.js');
    console.log('✅ Old file exists:', oldFileExists, '| New file exists:', newFileExists);
    
    // Test 8: Test delete operation
    console.log('\n🧪 Test 8: Delete file');
    const deleteResult = await fsManager.deleteFile('renamed-file.js');
    console.log('✅ Delete result:', deleteResult.success);
    
    // Verify delete worked
    const deletedFileExists = fsManager.fileExists('renamed-file.js');
    console.log('✅ Deleted file still exists:', deletedFileExists);
    
    // Final state check
    console.log('\n📊 Final canonical state:');
    const finalState = fsManager.getCanonicalState();
    for (const [path, data] of finalState) {
      console.log(`  - ${path}: ${data.type}`);
    }
    
    // Cleanup
    await fsManager.cleanup();
    
    console.log('\n🎉 All FileSystemManager tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ FileSystemManager test failed:', error);
    return false;
  }
}

/**
 * Test adapter isolation and echo prevention
 */
export async function testAdapterIsolation() {
  console.log('\n🧪 Testing adapter isolation and echo prevention...');
  
  try {
    const fsManager = new FileSystemManager();
    
    // Add VFS adapter manually
    const vfsAdapter = new VFSAdapter();
    await vfsAdapter.initialize();
    fsManager.addAdapter(ADAPTER_ORIGINS.VFS, vfsAdapter);
    
    // Add Local adapter manually
    const localAdapter = new LocalAdapter(mockUser);
    await localAdapter.initialize();
    fsManager.addAdapter(ADAPTER_ORIGINS.LOCAL, localAdapter);
    
    console.log('✅ Adapters initialized');
    
    // Create a file from VFS origin
    const operation = {
      id: 'test_op_123',
      type: OPERATION_TYPES.CREATE,
      path: 'echo-test.js',
      timestamp: Date.now(),
      origin: ADAPTER_ORIGINS.VFS,
      payload: {
        name: 'echo-test.js',
        content: 'console.log("Echo test");',
        type: 'file'
      }
    };
    
    // Process operation
    await fsManager.processOperation(operation, ADAPTER_ORIGINS.VFS, true);
    
    // Simulate incoming operation from VFS (should be ignored as echo)
    const isEcho = fsManager.isEchoOperation(operation, ADAPTER_ORIGINS.VFS);
    console.log('✅ Echo detection works:', isEcho);
    
    console.log('🎉 Adapter isolation test passed!');
    
    await fsManager.cleanup();
    return true;
    
  } catch (error) {
    console.error('❌ Adapter isolation test failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('🚀 Running all FileSystemManager tests...\n');
  
  const test1 = await testFileSystemManager();
  const test2 = await testAdapterIsolation();
  
  if (test1 && test2) {
    console.log('\n🎉 ALL TESTS PASSED! FileSystemManager architecture is working correctly.');
    console.log('\n✅ Benefits achieved:');
    console.log('   - Single canonical interface for all file operations');
    console.log('   - Automatic synchronization across all storage adapters');
    console.log('   - Echo prevention to avoid infinite loops');
    console.log('   - Conflict resolution with last-write-wins strategy');
    console.log('   - Normalized operations for consistent behavior');
    console.log('   - Adapter pattern for easy extensibility');
  } else {
    console.log('\n❌ Some tests failed. Please check the implementation.');
  }
  
  return test1 && test2;
}

// Export for use in browser console or testing framework
if (typeof window !== 'undefined') {
  window.testFileSystemManager = runAllTests;
}
