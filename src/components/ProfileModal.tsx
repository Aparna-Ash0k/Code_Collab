import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Separator } from './ui/separator';
import { 
  User, 
  Mail, 
  Calendar, 
  Crown, 
  Users, 
  LogOut,
  FileText,
  Activity
} from 'lucide-react';
import { useAuth } from './AuthWrapper';
import { Project } from '../hooks/useProject';
import { UserPresence } from '../hooks/usePresence';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  activeUsers: UserPresence[];
}

export function ProfileModal({ isOpen, onClose, project, activeUsers }: ProfileModalProps) {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const getRandomColor = (userId: string) => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const isOwner = project.owner_id === user.id;
  const userColor = getRandomColor(user.id);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarFallback 
                className="text-lg font-medium"
                style={{ backgroundColor: userColor, color: 'white' }}
              >
                {user.user_metadata?.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-lg font-semibold">{user.user_metadata?.name || 'Anonymous User'}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Your profile information and project details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Display Name</div>
                <div className="text-sm text-muted-foreground">
                  {user.user_metadata?.name || 'Not set'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Email</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Member Since</div>
                <div className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Project Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Current Project
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{project.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Created {formatDate(project.created_at)}
                  </div>
                </div>
                {isOwner && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Crown className="h-3 w-3" />
                    Owner
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">
                    {activeUsers.length} Active User{activeUsers.length !== 1 ? 's' : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Currently collaborating
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Last Activity</div>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(project.updated_at)} today
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Active Collaborators */}
          {activeUsers.length > 1 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Active Collaborators</h4>
              <div className="space-y-2">
                {activeUsers.filter(activeUser => activeUser.user_id !== user.id).map((activeUser) => (
                  <div key={activeUser.user_id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback 
                        className="text-xs"
                        style={{ 
                          backgroundColor: getRandomColor(activeUser.user_id), 
                          color: 'white' 
                        }}
                      >
                        {activeUser.user_avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{activeUser.user_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {activeUser.file ? `Editing: ${activeUser.file}` : 'Online'}
                      </div>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={signOut} className="flex-1">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}