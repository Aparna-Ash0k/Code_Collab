import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { FolderClosed, FilePlus, FileCode, Layers3, Settings, Download } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { toast } from 'sonner';

interface FileManagerProps {
  projectId: string;
  projectName?: string;
  userRole?: 'owner' | 'editor' | 'viewer';
}

export function FileManager({ projectId, projectName, userRole }: FileManagerProps) {
  const { 
    createFile, 
    createFolder, 
    createNestedFile, 
    createNestedFolder, 
    createFileStructure,
    exportProject,
    files
  } = useProject();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showStructureDialog, setShowStructureDialog] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    type: 'file' as 'file' | 'folder',
    parentPath: '',
    content: ''
  });

  const handleCreateItem = async () => {
    if (!newItem.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      if (newItem.parentPath) {
        // Creating nested item
        if (newItem.type === 'file') {
          await createNestedFile(projectId, newItem.parentPath, newItem.name, newItem.content);
        } else {
          await createNestedFolder(projectId, newItem.parentPath, newItem.name);
        }
      } else {
        // Creating root level item
        if (newItem.type === 'file') {
          await createFile(projectId, newItem.name, newItem.content, 'file');
        } else {
          await createFolder(projectId, newItem.name);
        }
      }

      toast.success(`${newItem.type === 'file' ? 'File' : 'Folder'} created successfully!`);
      setShowCreateDialog(false);
      setNewItem({ name: '', type: 'file', parentPath: '', content: '' });
    } catch (error: any) {
      toast.error(error.message || `Failed to create ${newItem.type}`);
    }
  };

  const handleCreateStructure = async () => {
    try {
      console.log('📁 Starting project structure creation for project:', projectId);
      
      // Example project structure
      const structure = [
        { path: 'src', type: 'folder' as const },
        { path: 'src/components', type: 'folder' as const },
        { path: 'src/hooks', type: 'folder' as const },
        { path: 'src/utils', type: 'folder' as const },
        { path: 'src/components/App.tsx', type: 'file' as const, content: 'import React from "react";\n\nexport default function App() {\n  return <div>Hello World</div>;\n}' },
        { path: 'src/components/Header.tsx', type: 'file' as const, content: 'import React from "react";\n\nexport function Header() {\n  return <header>My App</header>;\n}' },
        { path: 'src/hooks/useCustomHook.ts', type: 'file' as const, content: 'import { useState } from "react";\n\nexport function useCustomHook() {\n  const [value, setValue] = useState("");\n  return { value, setValue };\n}' },
        { path: 'src/utils/helpers.ts', type: 'file' as const, content: 'export function formatDate(date: Date): string {\n  return date.toLocaleDateString();\n}' },
        { path: 'package.json', type: 'file' as const, content: '{\n  "name": "my-project",\n  "version": "1.0.0",\n  "main": "index.js"\n}' }
      ];

      console.log('📁 Structure to create:', structure.length, 'items');
      
      const createdFiles = await createFileStructure(projectId, structure);
      
      console.log('✅ Project structure created successfully!', createdFiles.length, 'items created');
      toast.success('Project structure created successfully!');
      setShowStructureDialog(false);
    } catch (error: any) {
      console.error('❌ Failed to create project structure:', error);
      toast.error(error.message || 'Failed to create project structure');
    }
  };

  const handleExportProject = async () => {
    try {
      await exportProject(projectId, projectName || 'project');
    } catch (error: any) {
      // Error is already handled in exportProject function
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="flex gap-2">
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <FilePlus className="w-4 h-4 mr-2" />
            New Item
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New {newItem.type === 'file' ? 'File' : 'Folder'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={newItem.type === 'file' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNewItem(prev => ({ ...prev, type: 'file' }))}
              >
                <FileCode className="w-4 h-4 mr-2" />
                File
              </Button>
              <Button
                variant={newItem.type === 'folder' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNewItem(prev => ({ ...prev, type: 'folder' }))}
              >
                <FolderClosed className="w-4 h-4 mr-2" />
                Folder
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="item-name">{newItem.type === 'file' ? 'File' : 'Folder'} Name</Label>
              <Input
                id="item-name"
                placeholder={newItem.type === 'file' ? 'index.js' : 'components'}
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent-path">Parent Path (optional)</Label>
              <Input
                id="parent-path"
                placeholder="src/components"
                value={newItem.parentPath}
                onChange={(e) => setNewItem(prev => ({ ...prev, parentPath: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground">
                Leave empty for root level, or specify folder path like "src/components"
              </p>
            </div>

            {newItem.type === 'file' && (
              <div className="space-y-2">
                <Label htmlFor="content">Initial Content (optional)</Label>
                <textarea
                  id="content"
                  className="w-full h-24 p-2 border rounded-md resize-none"
                  placeholder="// Your code here..."
                  value={newItem.content}
                  onChange={(e) => setNewItem(prev => ({ ...prev, content: e.target.value }))}
                />
              </div>
            )}

            <Button onClick={handleCreateItem} disabled={!newItem.name.trim()}>
              Create {newItem.type === 'file' ? 'File' : 'Folder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {files.length === 0 && (
        <Dialog open={showStructureDialog} onOpenChange={setShowStructureDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Layers3 className="w-4 h-4 mr-2" />
              Create Project Structure
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project Structure</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will create a typical project structure with folders and example files:
              </p>
              <div className="bg-muted p-4 rounded-lg text-sm font-mono">
                <div className="flex items-center gap-2">
                  <FolderClosed className="w-4 h-4 text-blue-500" />
                  <span>src/</span>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <FolderClosed className="w-4 h-4 text-blue-500" />
                  <span>components/</span>
                </div>
                <div className="ml-8 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span>App.tsx</span>
                </div>
                <div className="ml-8 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span>Header.tsx</span>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <FolderClosed className="w-4 h-4 text-blue-500" />
                  <span>hooks/</span>
                </div>
                <div className="ml-8 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span>useCustomHook.ts</span>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <FolderClosed className="w-4 h-4 text-blue-500" />
                  <span>utils/</span>
                </div>
                <div className="ml-8 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span>helpers.ts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-yellow-500" />
                  <span>package.json</span>
                </div>
              </div>
              <Button onClick={handleCreateStructure}>
                Create Structure
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {userRole !== 'viewer' && (
        <Button variant="outline" size="sm" onClick={handleExportProject}>
          <Download className="w-4 h-4 mr-2" />
          Export as ZIP
        </Button>
      )}
    </div>
  );
}