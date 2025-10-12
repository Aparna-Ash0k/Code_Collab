import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Plus, FolderOpen, Clock, Users, Trash2, MoreVertical, ArrowLeft, Download } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useProject, Project } from '../hooks/useProject';
import { JoinCollaboration } from './JoinCollaboration';
import { toast } from 'sonner';

interface ProjectSelectorProps {
  onProjectSelect: (project: Project) => void;
  onBackToLanding?: () => void;
}

export function ProjectSelector({ onProjectSelect, onBackToLanding }: ProjectSelectorProps) {
  const { projects, loading, createProject, deleteProject, selectProject, exportProject } = useProject();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
  });

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      const project = await createProject(newProject.name, newProject.description);
      setShowCreateDialog(false);
      setNewProject({ name: '', description: '' });
      await selectProject(project); // Set as current project and load files
      onProjectSelect(project);
      toast.success('Project created successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    }
  };

  const handleProjectJoined = async (joinedProject: Project) => {
    await selectProject(joinedProject); // Set as current project and load files
    onProjectSelect(joinedProject);
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    try {
      setDeletingProjectId(projectId);
      await deleteProject(projectId);
      toast.success(`Project "${projectName}" deleted successfully`);
      setProjectToDelete(null); // Close the dialog
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete project');
    } finally {
      setDeletingProjectId(null);
    }
  };

  const openDeleteDialog = (projectId: string, projectName: string) => {
    setProjectToDelete({ id: projectId, name: projectName });
  };

  const handleExportProject = async (projectId: string, projectName: string) => {
    try {
      await exportProject(projectId, projectName);
    } catch (error: any) {
      // Error is already handled in exportProject function
      console.error('Export failed:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="border-b p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBackToLanding && (
              <Button variant="ghost" size="sm" onClick={onBackToLanding}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold">Collaborative Code Editor</h1>
              <p className="text-muted-foreground mt-1">Select a project to start coding with your team</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <JoinCollaboration 
              onProjectJoined={handleProjectJoined}
              buttonText="Join Project"
            />
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Create a new collaborative coding project to start working with your team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      placeholder="My Awesome Project"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-description">Description (Optional)</Label>
                    <Textarea
                      id="project-description"
                      placeholder="A brief description of your project..."
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    />
                  </div>
                  <Button onClick={handleCreateProject} disabled={loading || !newProject.name.trim()}>
                    {loading ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        {loading && projects.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">Create your first project or join an existing collaboration</p>
            <div className="flex items-center gap-3">
              <JoinCollaboration 
                onProjectJoined={handleProjectJoined}
                buttonText="Join Project"
              />
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="truncate">{project.name}</CardTitle>
                      {project.description && (
                        <CardDescription className="mt-2 line-clamp-2">
                          {project.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={project.userRole === 'owner' ? 'default' : 'secondary'}>
                        {project.userRole}
                      </Badge>
                      {project.userRole !== 'viewer' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="!bg-black !text-white !border-gray-700 min-w-[200px] !opacity-100">
                            <DropdownMenuItem 
                              className="cursor-pointer py-3 px-4 text-base !text-white hover:!bg-gray-800 focus:!bg-gray-800 !opacity-100"
                              onClick={() => handleExportProject(project.id, project.name)}
                            >
                              <Download className="h-5 w-5 mr-3" />
                              Export as ZIP
                            </DropdownMenuItem>
                            {project.userRole === 'owner' && (
                              <DropdownMenuItem 
                                className="!text-red-400 cursor-pointer py-3 px-4 text-base hover:!bg-gray-800 hover:!text-red-300 focus:!bg-gray-800 focus:!text-red-300 !opacity-100"
                                onClick={() => openDeleteDialog(project.id, project.name)}
                              >
                                <Trash2 className="h-5 w-5 mr-3" />
                                Delete Project
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div 
                    className="cursor-pointer"
                    onClick={async () => {
                      await selectProject(project); // Set as current project and load files
                      onProjectSelect(project);
                    }}
                  >
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDate(project.updated_at)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {project.collaborators?.length || 1}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open: boolean) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This action cannot be undone and will permanently delete all files and data associated with this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && handleDeleteProject(projectToDelete.id, projectToDelete.name)}
              disabled={!!deletingProjectId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingProjectId ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}