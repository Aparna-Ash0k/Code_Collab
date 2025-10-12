import { useState } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { MessageCircle, Share2, Save, ArrowLeft, LogOut } from 'lucide-react';
import { Separator } from './ui/separator';
import { useAuth } from './AuthWrapper';
import { Project } from '../hooks/useProject';
import { UserPresence } from '../hooks/usePresence';
import { ThemeToggle } from './ThemeToggle';
import { ProfileModal } from './ProfileModal';
import { ShareModal } from './ShareModal';

interface ToolbarProps {
  project: Project;
  selectedFile: string | null;
  activeUsers: UserPresence[];
  onToggleChat: () => void;
  isChatOpen: boolean;
  onBackToLanding?: () => void;
}

export function Toolbar({ project, selectedFile, activeUsers, onToggleChat, isChatOpen, onBackToLanding }: ToolbarProps) {
  const { signOut } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleBackToProjects = () => {
    if (onBackToLanding) {
      onBackToLanding();
    } else {
      window.location.reload(); // Fallback for backward compatibility
    }
  };

  const getRandomColor = (userId: string) => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="h-12 bg-card border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBackToProjects}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="font-medium">{project.name}</span>
          <Badge variant="secondary" className="text-xs">
            Live
          </Badge>
        </div>
        
        <Separator orientation="vertical" className="h-6" />
        
        {selectedFile && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Editing:</span>
            <code className="bg-muted px-2 py-1 rounded text-xs">{selectedFile}</code>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div 
            className="flex -space-x-2 cursor-pointer group"
            onClick={() => setIsProfileModalOpen(true)}
            title="View your profile"
          >
            {activeUsers.slice(0, 3).map((user) => (
              <Avatar key={user.user_id} className="w-8 h-8 border-2 border-background group-hover:scale-105 transition-transform">
                <AvatarFallback 
                  className="text-xs"
                  style={{ backgroundColor: getRandomColor(user.user_id), color: 'white' }}
                >
                  {user.user_avatar}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {activeUsers.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{activeUsers.length - 3}
            </Badge>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm">
            <Save className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onToggleChat}
            className={isChatOpen ? 'bg-accent' : ''}
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsShareModalOpen(true)}>
            <Share2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        project={project}
        activeUsers={activeUsers}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        project={project}
      />
    </div>
  );
}