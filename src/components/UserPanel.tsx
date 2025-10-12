import { useState, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Code, Crown, MoreHorizontal, Trash2, RefreshCw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '../hooks/useProject';
import { ShareModal } from './ShareModal';
import { JoinCollaboration } from './JoinCollaboration';
import { RoleSelector } from './RoleSelector';
import { useAuth } from './AuthWrapper';
import { Project } from '../hooks/useProject';

interface UserPresence {
  user_id: string;
  user_name: string;
  user_avatar: string;
  file: string | null;
  cursor: any;
  last_seen: string;
}

interface UserPanelProps {
  users: UserPresence[];
  project?: Project;
  projectId?: string;
  projectName?: string;
  isOwner?: boolean;
}

export function UserPanel({ users, project, projectId, projectName, isOwner = false }: UserPanelProps) {
  const { removeCollaborator, updateCollaboratorRole, getProjectCollaborators, selectProject, syncWorkspaceState } = useProject();
  const { session } = useAuth();
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [syncingWorkspace, setSyncingWorkspace] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const getRandomColor = (userId: string) => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const formatLastSeen = (lastSeenString: string) => {
    const lastSeen = new Date(lastSeenString);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const loadCollaborators = async () => {
    if (!projectId) {
      console.log('UserPanel: No projectId, skipping collaborator load');
      return;
    }
    
    setLoadingCollaborators(true);
    try {
      console.log('UserPanel: Loading collaborators for project', projectId);
      const projectCollaborators = await getProjectCollaborators(projectId);
      console.log('UserPanel: Loaded collaborators:', projectCollaborators);
      setCollaborators(projectCollaborators || []);
    } catch (error) {
      console.error('Failed to load collaborators:', error);
      setCollaborators([]); // Set empty array on error to prevent undefined state
    } finally {
      setLoadingCollaborators(false);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string, collaboratorName: string) => {
    if (!projectId || !isOwner) return;
    
    try {
      await removeCollaborator(projectId, collaboratorId);
      toast.success(`Removed ${collaboratorName} from project`);
      // Immediately refresh the collaborators list
      await loadCollaborators();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove collaborator');
    }
  };

  const handleRoleChange = async (collaboratorId: string, newRole: 'editor' | 'viewer') => {
    if (!projectId || !isOwner) return;
    
    try {
      await updateCollaboratorRole(projectId, collaboratorId, newRole);
      // Immediately refresh the collaborators list
      await loadCollaborators();
    } catch (error: any) {
      console.error('Failed to update role:', error);
      throw error; // Re-throw so RoleSelector can handle the error display
    }
  };

  const handleProjectJoined = async (joinedProject: any) => {
    // Switch to the newly joined project
    await selectProject(joinedProject);
    toast.success(`Switched to "${joinedProject.name}"`);
  };

  const handleSyncWorkspace = async () => {
    if (!projectId) return;
    
    setSyncingWorkspace(true);
    try {
      await syncWorkspaceState(projectId);
      toast.success('Workspace synchronized successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync workspace');
    } finally {
      setSyncingWorkspace(false);
    }
  };

  // Load collaborators when component mounts or projectId changes
  useEffect(() => {
    if (projectId) {
      console.log('UserPanel: projectId changed, loading collaborators immediately');
      loadCollaborators();
    } else {
      console.log('UserPanel: No projectId, clearing collaborators');
      setCollaborators([]);
    }
  }, [projectId]);

  // Set up polling to refresh collaborators list every 10 seconds
  useEffect(() => {
    if (!projectId) {
      console.log('UserPanel: No projectId, skipping polling setup');
      return;
    }

    console.log('UserPanel: Setting up collaborator polling for project', projectId);
    const collaboratorPolling = setInterval(() => {
      console.log('UserPanel: Polling collaborators...');
      loadCollaborators();
    }, 10000); // Poll every 10 seconds

    return () => {
      console.log('UserPanel: Cleaning up collaborator polling');
      clearInterval(collaboratorPolling);
    };
  }, [projectId]);

  return (
    <div className="border-t">
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Collaborators</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{users.length} online</span>
            {projectId && !isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSyncWorkspace}
                disabled={syncingWorkspace}
                className="h-6 w-6 p-0"
                title="Sync workspace with latest changes"
              >
                <RefreshCw className={`w-3 h-3 ${syncingWorkspace ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="max-h-64">
        <div className="p-2 space-y-2">
          {loadingCollaborators && collaborators.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Loading collaborators...
            </div>
          ) : (
            <>
              {/* Active Users (Real-time presence) */}
              {users
                .filter((user) => {
                  // Only show users who are actual collaborators
                  return collaborators.some(collab => collab.user_id === user.user_id);
                })
                .map((user) => {
            // Find the user's role from collaborators list
            const userRole = collaborators.find(collab => collab.user_id === user.user_id)?.role || 'viewer';
            const isCurrentUserSelf = session?.user?.id === user.user_id;
            
            return (
              <div key={`active-${user.user_id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
                <div className="relative">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback 
                      className="text-xs"
                      style={{ backgroundColor: getRandomColor(user.user_id), color: 'white' }}
                    >
                      {user.user_avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{user.user_name}</span>
                    {userRole === 'owner' && (
                      <Crown className="w-3 h-3 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatLastSeen(user.last_seen)}</span>
                    {user.file && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <code className="text-xs text-muted-foreground">{user.file.split('/').pop()}</code>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Code className="w-3 h-3 text-blue-500" />
                  
                  <RoleSelector
                    currentRole={userRole}
                    userId={user.user_id}
                    userName={user.user_name}
                    onRoleChange={handleRoleChange}
                    isOwner={isOwner}
                    isCurrentUser={isCurrentUserSelf}
                  />
                  
                  {isOwner && userRole !== 'owner' && !isCurrentUserSelf && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreHorizontal className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleRemoveCollaborator(user.user_id, user.user_name)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove from project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}

          {/* Project Collaborators (not currently active) */}
          {collaborators
            .filter(collab => !users.some(user => user.user_id === collab.user_id))
            .map((collaborator) => (
            <div key={`collab-${collaborator.user_id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent opacity-75">
              <div className="relative">
                <Avatar className="w-8 h-8">
                  <AvatarFallback 
                    className="text-xs"
                    style={{ backgroundColor: getRandomColor(collaborator.user_id), color: 'white' }}
                  >
                    {collaborator.user_name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-400 border-2 border-background rounded-full" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{collaborator.user_name || 'Unknown User'}</span>
                  {collaborator.role === 'owner' && (
                    <Crown className="w-3 h-3 text-yellow-500" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Offline</div>
              </div>

              <div className="flex items-center gap-2">
                <RoleSelector
                  currentRole={collaborator.role}
                  userId={collaborator.user_id}
                  userName={collaborator.user_name}
                  onRoleChange={handleRoleChange}
                  isOwner={isOwner}
                  isCurrentUser={session?.user?.id === collaborator.user_id}
                />
                
                {isOwner && collaborator.role !== 'owner' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => handleRemoveCollaborator(collaborator.user_id, collaborator.user_name)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove from project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}

              {!loadingCollaborators && users.length === 0 && collaborators.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No collaborators yet
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-3 space-y-2">
        {(project || (projectId && projectName)) ? (
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsShareModalOpen(true)}
              className="w-full"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Invite Collabrators 
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <JoinCollaboration onProjectJoined={handleProjectJoined} />
            <div className="text-xs text-muted-foreground text-center">
              Select a project to share
            </div>
          </div>
        )}
      </div>

      {(project || (projectId && projectName)) && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            // Refresh collaborators when modal closes in case someone was invited
            loadCollaborators();
          }}
          project={project || { 
            id: projectId!, 
            name: projectName!,
            owner_id: '',
            created_at: '',
            updated_at: '',
            collaborators: []
          }}
        />
      )}
    </div>
  );
}