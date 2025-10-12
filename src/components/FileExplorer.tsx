import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, FileText, FolderClosed, FolderOpen, File, FileCode, Image, Settings, Trash2, Edit3 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Project, ProjectFile } from '../hooks/useProject';
import { useProject } from '../hooks/useProject';
import { FileManager } from './FileManager';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from './ui/context-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Input } from './ui/input';
import { toast } from 'sonner';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  isOpen?: boolean;
}

interface FileExplorerProps {
  project: Project;
  selectedFile: string | null;
  onFileSelect: (file: string) => void;
}

export function FileExplorer({ project, selectedFile, onFileSelect }: FileExplorerProps) {
  const { files, currentProject, deleteFile, renameFile } = useProject();
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; path: string; name: string; type: 'file' | 'folder' }>({
    open: false,
    path: '',
    name: '',
    type: 'file'
  });
  const [renamingNode, setRenamingNode] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // Check if user is a viewer (read-only mode)
  const isViewer = project.userRole === 'viewer';

  // Get appropriate icon for file type
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const iconClass = "w-4 h-4";
    
    switch (extension) {
      case 'tsx':
      case 'ts':
      case 'jsx':
      case 'js':
        return <FileCode className={`${iconClass} text-blue-400`} />;
      case 'json':
        return <Settings className={`${iconClass} text-yellow-500`} />;
      case 'md':
        return <FileText className={`${iconClass} text-gray-600`} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <Image className={`${iconClass} text-green-500`} />;
      default:
        return <File className={`${iconClass} text-gray-500`} />;
    }
  };

  // Convert flat file list to tree structure
  useEffect(() => {
    // Only build tree if we have the current project and it matches our project
    if (!currentProject || currentProject.id !== project.id) {
      console.log('FileExplorer: Project mismatch or no current project', {
        currentProject: currentProject?.id,
        expectedProject: project.id
      });
      return;
    }

    console.log('FileExplorer: Building file tree for project', project.id, 'with', files.length, 'files');
    const buildFileTree = (files: ProjectFile[]): FileNode[] => {
      const tree: FileNode[] = [];
      const folderMap = new Map<string, FileNode>();

      // Step 1: Process all folders first (both explicit and implied)
      const allFolderPaths = new Set<string>();
      
      // Collect all folder paths (explicit folders and implied from file paths)
      files.forEach(file => {
        if (file.type === 'folder') {
          allFolderPaths.add(file.path);
        } else {
          const parts = file.path.split('/');
          for (let i = 1; i < parts.length; i++) {
            const folderPath = parts.slice(0, i).join('/');
            if (folderPath) {
              allFolderPaths.add(folderPath);
            }
          }
        }
      });

      // Sort folder paths by depth (shortest paths first) to ensure parents are created before children
      const sortedFolderPaths = Array.from(allFolderPaths).sort((a, b) => {
        const depthA = a.split('/').length;
        const depthB = b.split('/').length;
        return depthA - depthB;
      });

      // Step 2: Create all folders in order
      sortedFolderPaths.forEach(folderPath => {
        if (!folderMap.has(folderPath)) {
          const parts = folderPath.split('/');
          const folderName = parts[parts.length - 1];
          const parentPath = parts.slice(0, -1).join('/');
          
          const folderNode: FileNode = {
            name: folderName,
            type: 'folder',
            path: folderPath,
            children: [],
            isOpen: true
          };
          
          folderMap.set(folderPath, folderNode);
          
          if (parentPath && folderMap.has(parentPath)) {
            folderMap.get(parentPath)!.children!.push(folderNode);
          } else if (!parentPath) {
            tree.push(folderNode);
          }
        }
      });

      // Step 3: Add files to their parent folders
      files.forEach(file => {
        if (file.type === 'file') {
          const parts = file.path.split('/');
          const fileName = parts[parts.length - 1];
          const parentPath = parts.slice(0, -1).join('/');
          
          const fileNode: FileNode = {
            name: fileName,
            type: 'file',
            path: file.path
          };

          if (parentPath && folderMap.has(parentPath)) {
            folderMap.get(parentPath)!.children!.push(fileNode);
          } else if (!parentPath) {
            tree.push(fileNode);
          }
        }
      });

      // Sort tree nodes: folders first, then files, both alphabetically
      const sortNodes = (nodes: FileNode[]): FileNode[] => {
        return nodes.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        }).map(node => ({
          ...node,
          children: node.children ? sortNodes(node.children) : undefined
        }));
      };

      const sortedTree = sortNodes(tree);
      return sortedTree;
    };

    setFileTree(buildFileTree(files));
  }, [files, currentProject, project.id]);

  const toggleFolder = (path: string) => {
    const updateNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === path && node.type === 'folder') {
          return { ...node, isOpen: !node.isOpen };
        }
        if (node.children) {
          return { ...node, children: updateNodes(node.children) };
        }
        return node;
      });
    };
    setFileTree(updateNodes(fileTree));
  };

  const handleDelete = async () => {
    try {
      await deleteFile(project.id, deleteDialog.path);
      toast.success(`${deleteDialog.type === 'file' ? 'File' : 'Folder'} deleted successfully`);
      setDeleteDialog({ open: false, path: '', name: '', type: 'file' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    }
  };

  const handleRename = async (oldPath: string, newName: string) => {
    try {
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');
      
      await renameFile(project.id, oldPath, newPath);
      toast.success('Item renamed successfully');
      setRenamingNode(null);
      setRenameValue('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename item');
    }
  };

  const startRename = (path: string, currentName: string) => {
    setRenamingNode(path);
    setRenameValue(currentName);
  };

  const cancelRename = () => {
    setRenamingNode(null);
    setRenameValue('');
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isSelected = selectedFile === node.path;
    const isRenaming = renamingNode === node.path;
    
    return (
      <div key={`node-${node.type}-${node.path}`}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className={`flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-accent rounded-sm ${
                isSelected ? 'bg-accent' : ''
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={() => {
                if (isRenaming) return;
                if (node.type === 'folder') {
                  toggleFolder(node.path);
                } else {
                  onFileSelect(node.path);
                }
              }}
            >
              {node.type === 'folder' ? (
                <>
                  {node.isOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  {node.isOpen ? (
                    <FolderOpen className="w-4 h-4 text-amber-500" />
                  ) : (
                    <FolderClosed className="w-4 h-4 text-blue-500" />
                  )}
                </>
              ) : (
                <>
                  <div className="w-4" />
                  {getFileIcon(node.name)}
                </>
              )}
              
              {isRenaming ? (
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (renameValue.trim() && renameValue !== node.name) {
                      handleRename(node.path, renameValue.trim());
                    } else {
                      cancelRename();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (renameValue.trim() && renameValue !== node.name) {
                        handleRename(node.path, renameValue.trim());
                      } else {
                        cancelRename();
                      }
                    } else if (e.key === 'Escape') {
                      cancelRename();
                    }
                  }}
                  className="h-6 text-sm flex-1 min-w-0"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm truncate">{node.name}</span>
              )}
              
              {isSelected && node.type === 'file' && !isRenaming && (
                <div className="w-2 h-2 bg-blue-500 rounded-full ml-auto" />
              )}
            </div>
          </ContextMenuTrigger>
          
          {!isViewer && (
            <ContextMenuContent>
              <ContextMenuItem onClick={() => startRename(node.path, node.name)}>
                <Edit3 className="w-4 h-4" />
                Rename
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem 
                variant="destructive"
                onClick={() => setDeleteDialog({ 
                  open: true, 
                  path: node.path, 
                  name: node.name, 
                  type: node.type 
                })}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>
        
        {node.type === 'folder' && node.isOpen && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Files</h3>
            {!isViewer && (
              <div className="flex items-center gap-2">
                <FileManager projectId={project.id} projectName={project.name} userRole={project.userRole} />
              </div>
            )}
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {fileTree.map(node => renderNode(node, 0))}
          </div>
        </ScrollArea>
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open: boolean) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.type === 'file' ? 'File' : 'Folder'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.name}"? This action cannot be undone.
              {deleteDialog.type === 'folder' && ' All files and subfolders will also be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}