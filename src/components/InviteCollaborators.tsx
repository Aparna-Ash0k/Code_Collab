import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select';
import { UserPlus, Mail, Shield, Check, Eye, Edit, Hash } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { toast } from 'sonner';
import { copyWithFallback } from '../utils/clipboardUtils';

interface InviteCollaboratorsProps {
  projectId: string;
  projectName: string;
}

export function InviteCollaborators({ projectId, projectName }: InviteCollaboratorsProps) {
  const { inviteCollaborator } = useProject();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [projectIdCopied, setProjectIdCopied] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    if (!email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsInviting(true);
    try {
      await inviteCollaborator(projectId, email.trim(), role);
      toast.success(`Invitation sent to ${email}`);
      setEmail('');
      setRole('editor');
    } catch (error: any) {
      console.error('Invitation error:', error);
      
      // Provide specific error messages based on the error
      if (error.message?.includes('Permission denied')) {
        toast.error('You need editor or owner permissions to invite collaborators');
      } else if (error.message?.includes('already a collaborator')) {
        toast.error('This user is already a collaborator on this project');
      } else if (error.message?.includes('not found')) {
        toast.error('Project not found');
      } else {
        toast.error(error.message || 'Failed to send invitation');
      }
    } finally {
      setIsInviting(false);
    }
  };

  const copyProjectId = async () => {
    try {
      const success = await copyWithFallback(projectId, true);
      if (success) {
        setProjectIdCopied(true);
        toast.success('Project ID copied to clipboard!');
        setTimeout(() => setProjectIdCopied(false), 2000);
      } else {
        toast.error('Failed to copy project ID');
      }
    } catch (error) {
      console.error('Copy project ID error:', error);
      toast.error('Failed to copy project ID');
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEmail('');
      setRole('editor');
      setProjectIdCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Collaborators
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invite to "{projectName}"
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Email Invitation */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3">Send Email Invitation</h4>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleInvite();
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-medium">
                    Role & Permissions
                  </Label>
                  <Select value={role} onValueChange={(value: 'editor' | 'viewer') => setRole(value)}>
                    <SelectTrigger className="h-12 border-2 hover:border-primary/50 transition-colors bg-background">
                      <div className="flex items-center gap-3 w-full">
                        {role === 'editor' ? (
                          <Edit className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Eye className="w-4 h-4 text-orange-500" />
                        )}
                        <div className="flex flex-col items-start flex-1">
                          <span className="font-semibold text-foreground capitalize">{role}</span>
                          <span className="text-xs text-muted-foreground">
                            {role === 'editor' ? 'Full editing access' : 'Full access (same as editor)'}
                          </span>
                        </div>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-background border-2 shadow-lg">
                      <SelectItem value="editor" className="py-3 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Edit className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-foreground">Editor</span>
                            <span className="text-xs text-muted-foreground">Full editing access</span>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="viewer" className="py-3 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Eye className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-foreground">Viewer</span>
                            <span className="text-xs text-muted-foreground">Limited access</span>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="bg-muted/50 p-3 rounded-lg border">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-muted-foreground">
                        Both <strong>Editor</strong> and <strong>Viewer</strong> roles have different collaboration access
                      </div>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleInvite} 
                  disabled={isInviting || !email.trim()}
                  className="w-full"
                >
                  {isInviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </div>
          </div>

          {/* Project ID */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Share Project ID</h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={projectId}
                  readOnly
                  className="flex-1 font-mono text-sm"
                  placeholder="Project ID"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyProjectId}
                  title="Copy Project ID"
                >
                  {projectIdCopied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Hash className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this ID directly for others to join by entering it in the "Join by Project ID" option.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}