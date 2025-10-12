import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Crown, Edit, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface RoleSelectorProps {
  currentRole: 'owner' | 'editor' | 'viewer';
  userId: string;
  userName: string;
  onRoleChange: (userId: string, newRole: 'editor' | 'viewer') => Promise<void>;
  isOwner: boolean;
  isCurrentUser: boolean;
}

export function RoleSelector({ currentRole, userId, userName, onRoleChange, isOwner, isCurrentUser }: RoleSelectorProps) {
  const [isChanging, setIsChanging] = useState(false);

  // Don't show selector if not owner, or if this is the owner's own role, or if the user is the current user
  if (!isOwner || currentRole === 'owner' || isCurrentUser) {
    return (
      <Badge variant="secondary" className="text-xs">
        <div className="flex items-center gap-1">
          {currentRole === 'owner' && <Crown className="w-3 h-3 text-yellow-500" />}
          {currentRole === 'editor' && <Edit className="w-3 h-3 text-blue-500" />}
          {currentRole === 'viewer' && <Eye className="w-3 h-3 text-orange-500" />}
          {currentRole}
        </div>
      </Badge>
    );
  }

  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole || isChanging) return;
    
    setIsChanging(true);
    try {
      await onRoleChange(userId, newRole as 'editor' | 'viewer');
      toast.success(`Changed ${userName}'s role to ${newRole}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to change role');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <Select value={currentRole} onValueChange={handleRoleChange} disabled={isChanging}>
      <SelectTrigger className="h-6 w-20 text-xs">
        <SelectValue>
          <div className="flex items-center gap-1">
            {currentRole === 'editor' && <Edit className="w-3 h-3 text-blue-500" />}
            {currentRole === 'viewer' && <Eye className="w-3 h-3 text-orange-500" />}
            {currentRole}
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-background border-border shadow-lg backdrop-blur-none">
        <SelectItem value="editor">
          <div className="flex items-center gap-2">
            <Edit className="w-3 h-3 text-blue-500" />
            <span>Editor</span>
          </div>
        </SelectItem>
        <SelectItem value="viewer">
          <div className="flex items-center gap-2">
            <Eye className="w-3 h-3 text-orange-500" />
            <span>Viewer</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}