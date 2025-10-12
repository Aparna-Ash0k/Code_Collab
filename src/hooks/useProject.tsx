import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../components/AuthWrapper';
import { supabase } from '../utils/supabase/client';
import { getNetworkConfig } from '../utils/networkUtils';
import { toast } from 'sonner';
import { exportProjectAsZip } from '../utils/exportProject';

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  collaborators: string[];
  userRole?: 'owner' | 'editor' | 'viewer';
}

export interface ProjectFile {
  path: string;
  content: string;
  type: 'file' | 'folder';
  created_at: string;
  updated_at: string;
  created_by: string;
  version: number;
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  files: ProjectFile[];
  loading: boolean;
  createProject: (name: string, description?: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  fetchProjects: () => Promise<void>;
  selectProject: (project: Project) => Promise<void>;
  createFile: (projectId: string, path: string, content: string, type?: 'file' | 'folder') => Promise<ProjectFile>;
  createFolder: (projectId: string, folderPath: string) => Promise<ProjectFile>;
  createNestedFile: (projectId: string, parentFolder: string, fileName: string, content?: string) => Promise<ProjectFile>;
  createNestedFolder: (projectId: string, parentFolder: string, folderName: string) => Promise<ProjectFile>;
  createFileStructure: (projectId: string, structure: { path: string; type: 'file' | 'folder'; content?: string }[]) => Promise<ProjectFile[]>;
  updateFile: (projectId: string, path: string, content: string) => Promise<ProjectFile>;
  deleteFile: (projectId: string, path: string) => Promise<void>;
  renameFile: (projectId: string, oldPath: string, newPath: string) => Promise<ProjectFile>;
  inviteCollaborator: (projectId: string, email: string, role: 'editor' | 'viewer') => Promise<void>;
  joinProject: (projectCode: string) => Promise<Project>;
  removeCollaborator: (projectId: string, collaboratorId: string) => Promise<void>;
  updateCollaboratorRole: (projectId: string, collaboratorId: string, newRole: 'editor' | 'viewer') => Promise<void>;
  getProjectCollaborators: (projectId: string) => Promise<any[]>;
  syncWorkspaceState: (projectId: string) => Promise<ProjectFile[]>;
  exportProject: (projectId: string, projectName: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    console.log('Making API call to:', endpoint);
    
    // Always get fresh session for each API call
    const sessionResponse = await supabase.auth.getSession() as any;
    const freshSession = sessionResponse?.data?.session;
    
    console.log('Fresh session:', freshSession ? 'exists' : 'null');
    console.log('Access token preview:', freshSession?.access_token ? `${freshSession.access_token.substring(0, 50)}...` : 'undefined');
    console.log('Access token length:', freshSession?.access_token?.length || 0);
    
    // Detect and handle fake token
    if (freshSession?.access_token === 'firebase-token') {
      console.log('🚨 DETECTED FAKE TOKEN in API call - using dev-token instead');
      freshSession.access_token = 'dev-token';
    }
    
    // Get dynamic network configuration
    const networkConfig = await getNetworkConfig(3002);
    console.log('🌐 Using network config:', networkConfig);
    
    const response = await fetch(`${networkConfig.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshSession?.access_token || 'dev-token'}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = 'API call failed';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      console.error('API Error:', errorMessage);
      throw new Error(errorMessage);
    }

    return response.json();
  };

  const createProject = async (name: string, description?: string) => {
    try {
      setLoading(true);
      const data = await apiCall('/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      
      setProjects((prev: Project[]) => [...prev, data.project]);
      return data.project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      setLoading(true);
      await apiCall(`/projects/${projectId}`, {
        method: 'DELETE',
      });
      
      // Remove project from state
      setProjects((prev: Project[]) => prev.filter(p => p.id !== projectId));
      
      // If the deleted project was the current project, clear it
      if (currentProject && currentProject.id === projectId) {
        setCurrentProject(null);
        setFiles([]);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching projects for user...');
      const data = await apiCall('/projects');
      console.log('📋 Received projects:', data.projects?.length || 0, 'projects');
      console.log('📋 Projects data:', data.projects);
      
      // Debug each project's userRole
      data.projects?.forEach((project: Project) => {
        console.log(`📋 Project ${project.name} (${project.id}) has userRole: ${project.userRole}`);
      });
      
      setProjects(data.projects);
      
      // If there's a current project, update it with the refreshed data
      if (currentProject) {
        const updatedCurrentProject = data.projects.find((p: Project) => p.id === currentProject.id);
        if (updatedCurrentProject) {
          console.log(`🔄 Updating current project ${currentProject.id} with new userRole: ${updatedCurrentProject.userRole}`);
          setCurrentProject(updatedCurrentProject);
        }
      }
      
      return data.projects;
    } catch (error) {
      console.error('❌ Failed to fetch projects:', error);
      // Set empty array in case of error to show \"No projects yet\"
      setProjects([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const selectProject = async (project: Project) => {
    console.log('useProject: Selecting project', project.id);
    console.log('useProject: Project userRole', project.userRole);
    
    // Ensure the project has the correct userRole by finding it in the projects list
    const projectWithRole = projects.find(p => p.id === project.id) || project;
    console.log('useProject: Using project with role', projectWithRole.userRole);
    
    setCurrentProject(projectWithRole);
    await fetchFiles(project.id);
  };

  const fetchFiles = async (projectId: string) => {
    try {
      console.log('useProject: Fetching files for project', projectId);
      const data = await apiCall(`/projects/${projectId}/files`);
      console.log('useProject: Received files', data.files);
      setFiles(data.files);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  const createFile = async (projectId: string, path: string, content: string, type: 'file' | 'folder' = 'file') => {
    try {
      console.log('useProject: Creating file', { projectId, path, type });
      
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      
      if (!path || path.trim() === '') {
        throw new Error('File path is required');
      }

      const data = await apiCall(`/projects/${projectId}/files`, {
        method: 'POST',
        body: JSON.stringify({ path: path.trim(), content, type }),
      });
      
      console.log('useProject: File created, updating state', data.file);
      setFiles((prev: ProjectFile[]) => {
        const newFiles = [...prev, data.file];
        console.log('useProject: New files array length', newFiles.length);
        return newFiles;
      });
      return data.file;
    } catch (error) {
      console.error('Failed to create file:', error);
      throw error;
    }
  };

  const createFolder = async (projectId: string, folderPath: string) => {
    try {
      const data = await apiCall(`/projects/${projectId}/files`, {
        method: 'POST',
        body: JSON.stringify({ 
          path: folderPath,
          content: '',
          type: 'folder'
        }),
      });
      
      setFiles((prev: ProjectFile[]) => [...prev, data.file]);
      return data.file;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  };

  const createNestedFile = async (projectId: string, parentFolder: string, fileName: string, content: string = '') => {
    const fullPath = parentFolder.endsWith('/') 
      ? `${parentFolder}${fileName}` 
      : `${parentFolder}/${fileName}`;
    
    return createFile(projectId, fullPath, content, 'file');
  };

  const createNestedFolder = async (projectId: string, parentFolder: string, folderName: string) => {
    const fullPath = parentFolder.endsWith('/') 
      ? `${parentFolder}${folderName}` 
      : `${parentFolder}/${folderName}`;
    
    return createFolder(projectId, fullPath);
  };

  const createFileStructure = async (projectId: string, structure: { path: string; type: 'file' | 'folder'; content?: string }[]) => {
    try {
      console.log('📦 createFileStructure: Starting for project', projectId, 'with', structure.length, 'items');
      const createdItems = [];
      
      // Sort to ensure folders are created before their contents
      const sortedStructure = structure.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.path.localeCompare(b.path);
      });

      console.log('📦 createFileStructure: Creating items in order:');
      for (const item of sortedStructure) {
        console.log(`  ${item.type === 'folder' ? '📁' : '📄'} ${item.path}`);
        const createdItem = await createFile(projectId, item.path, item.content || '', item.type);
        createdItems.push(createdItem);
        console.log(`  ✅ Created: ${item.path}`);
      }
      
      console.log('✅ createFileStructure: All items created successfully:', createdItems.length);
      return createdItems;
    } catch (error) {
      console.error('❌ createFileStructure: Failed to create file structure:', error);
      throw error;
    }
  };

  const deleteFile = async (projectId: string, path: string) => {
    try {
      await apiCall(`/projects/${projectId}/files/${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });
      
      setFiles((prev: ProjectFile[]) => prev.filter((file: ProjectFile) => file.path !== path));
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  };

  const updateFile = async (projectId: string, path: string, content: string) => {
    try {
      const data = await apiCall(`/projects/${projectId}/files/${encodeURIComponent(path)}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
      
      setFiles((prev: ProjectFile[]) => prev.map((file: ProjectFile) => 
        file.path === path ? data.file : file
      ));
      return data.file;
    } catch (error) {
      console.error('Failed to update file:', error);
      throw error;
    }
  };

  const renameFile = async (projectId: string, oldPath: string, newPath: string) => {
    try {
      const data = await apiCall(`/projects/${projectId}/files/${encodeURIComponent(oldPath)}/rename`, {
        method: 'PUT',
        body: JSON.stringify({ newPath }),
      });
      
      setFiles((prev: ProjectFile[]) => prev.map((file: ProjectFile) => 
        file.path === oldPath ? { ...file, path: newPath } : file
      ));
      return data.file;
    } catch (error) {
      console.error('Failed to rename file:', error);
      throw error;
    }
  };

  const inviteCollaborator = async (projectId: string, email: string, role: 'editor' | 'viewer') => {
    try {
      await apiCall(`/projects/${projectId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
      
      // Refresh project data to get updated collaborators list
      if (currentProject && currentProject.id === projectId) {
        await fetchProjects();
      }
    } catch (error) {
      console.error('Failed to invite collaborator:', error);
      throw error;
    }
  };

  const joinProject = async (projectCode: string) => {
    try {
      const data = await apiCall('/projects/join', {
        method: 'POST',
        body: JSON.stringify({ projectCode }),
      });
      
      // Add the joined project to the projects list
      setProjects((prev: Project[]) => [...prev, data.project]);
      
      // If workspace state was provided, sync it locally
      if (data.workspaceState && data.workspaceState.files) {
        console.log(`Syncing workspace state: ${data.workspaceState.files.length} files received`);
        
        // Update the files state with the complete workspace from the creator
        setFiles(data.workspaceState.files);
        
        // Optionally store sync timestamp for debugging
        console.log(`Workspace synced at: ${data.workspaceState.syncedAt}`);
      }
      
      return data.project;
    } catch (error) {
      console.error('Failed to join project:', error);
      throw error;
    }
  };

  const removeCollaborator = async (projectId: string, collaboratorId: string) => {
    try {
      await apiCall(`/projects/${projectId}/collaborators/${collaboratorId}`, {
        method: 'DELETE',
      });
      
      // Refresh project data to get updated collaborators list
      if (currentProject && currentProject.id === projectId) {
        await fetchProjects();
      }
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
      throw error;
    }
  };

  const updateCollaboratorRole = async (projectId: string, collaboratorId: string, newRole: 'editor' | 'viewer') => {
    try {
      await apiCall(`/projects/${projectId}/collaborators/${collaboratorId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      
      // Refresh all project data - this will update both the projects list and currentProject
      await fetchProjects();
    } catch (error) {
      console.error('Failed to update collaborator role:', error);
      throw error;
    }
  };

  const getProjectCollaborators = async (projectId: string) => {
    try {
      const data = await apiCall(`/projects/${projectId}/collaborators`);
      return data.collaborators;
    } catch (error) {
      console.error('Failed to get collaborators:', error);
      throw error;
    }
  };

  const syncWorkspaceState = async (projectId: string) => {
    try {
      console.log('Syncing workspace state for project:', projectId);
      const data = await apiCall(`/projects/${projectId}/files`);
      
      if (data.files) {
        console.log(`Workspace sync: ${data.files.length} files received`);
        setFiles(data.files);
      }
      
      return data.files;
    } catch (error) {
      console.error('Failed to sync workspace state:', error);
      throw error;
    }
  };

  const exportProject = async (projectId: string, projectName: string) => {
    try {
      console.log('Exporting project:', projectId);
      
      // Fetch the latest files for the project
      const data = await apiCall(`/projects/${projectId}/files`);
      
      if (!data.files || data.files.length === 0) {
        toast.error('No files to export');
        return;
      }
      
      // Export as ZIP
      await exportProjectAsZip(projectName, data.files);
      toast.success('Project exported successfully!');
    } catch (error) {
      console.error('Failed to export project:', error);
      toast.error('Failed to export project');
      throw error;
    }
  };

  useEffect(() => {
    if (session) {
      fetchProjects();
    }
  }, [session]);

  // Set up polling for file changes when a project is selected
  useEffect(() => {
    if (!currentProject) return;

    console.log('Setting up file sync polling for project:', currentProject.id);
    
    // Poll for file changes every 5 seconds
    const filePolling = setInterval(async () => {
      try {
        console.log('Polling for file changes...');
        const data = await apiCall(`/projects/${currentProject.id}/files`);
        
        // Compare by checking if any file has a newer timestamp or different content
        if (data.files) {
          const hasChanges = data.files.some((newFile: ProjectFile) => {
            const existingFile = files.find(f => f.path === newFile.path);
            return !existingFile || 
                   existingFile.updated_at !== newFile.updated_at ||
                   existingFile.content !== newFile.content ||
                   existingFile.version !== newFile.version;
          }) || data.files.length !== files.length;
          
          if (hasChanges) {
            console.log('File changes detected, updating state');
            setFiles(data.files);
          }
        }
      } catch (error) {
        console.error('Error polling for file changes:', error);
      }
    }, 5000);

    return () => {
      console.log('Cleaning up file sync polling');
      clearInterval(filePolling);
    };
  }, [currentProject, files]);

  // Set up polling for project role changes every 10 seconds
  useEffect(() => {
    if (!currentProject) return;

    console.log('Setting up project role polling for project:', currentProject.id);
    
    const rolePolling = setInterval(async () => {
      try {
        console.log('Polling for project role changes...');
        const data = await apiCall('/projects');
        
        if (data.projects) {
          const updatedCurrentProject = data.projects.find((p: Project) => p.id === currentProject.id);
          
          if (updatedCurrentProject && updatedCurrentProject.userRole !== currentProject.userRole) {
            console.log(`Role change detected: ${currentProject.userRole} -> ${updatedCurrentProject.userRole}`);
            setProjects(data.projects);
            setCurrentProject(updatedCurrentProject);
            toast.info(`Your role has been changed to ${updatedCurrentProject.userRole}`);
          }
        }
      } catch (error) {
        console.error('Error polling for project role changes:', error);
      }
    }, 10000); // Poll every 10 seconds

    return () => {
      console.log('Cleaning up project role polling');
      clearInterval(rolePolling);
    };
  }, [currentProject]);

  const contextValue: ProjectContextType = {
    projects,
    currentProject,
    files,
    loading,
    createProject,
    deleteProject,
    fetchProjects,
    selectProject,
    createFile,
    createFolder,
    createNestedFile,
    createNestedFolder,
    createFileStructure,
    updateFile,
    deleteFile,
    renameFile,
    inviteCollaborator,
    joinProject,
    removeCollaborator,
    updateCollaboratorRole,
    getProjectCollaborators,
    syncWorkspaceState,
    exportProject,
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}