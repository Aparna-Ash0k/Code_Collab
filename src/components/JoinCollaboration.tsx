import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Users, Hash, ArrowRight } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { toast } from 'sonner';

interface JoinCollaborationProps {
  onProjectJoined?: (project: any) => void;
  buttonText?: string;
}

export function JoinCollaboration({ onProjectJoined, buttonText = "Join Collaboration" }: JoinCollaborationProps) {
  const { joinProject } = useProject();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinById = async () => {
    if (!projectId.trim()) {
      toast.error('Please enter a project ID');
      return;
    }

    setIsJoining(true);
    try {
      const joinedProject = await joinProject(projectId.trim());
      toast.success(`Successfully joined "${joinedProject.name}"!`);
      setProjectId('');
      setOpen(false);
      
      if (onProjectJoined) {
        onProjectJoined(joinedProject);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to join project');
    } finally {
      setIsJoining(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setProjectId('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="w-4 h-4 mr-2" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Join a Project
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Enter the project ID to join the collaboration directly.
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-id">Project ID</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="project-id"
                  placeholder="e.g., abc123def456"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="pl-10 font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleJoinById();
                    }
                  }}
                />
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Hash className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Project ID Format:</h4>
                  <p className="text-xs text-muted-foreground">
                    A unique identifier like "abc123def456" provided by the project owner.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="sm:flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleJoinById} 
            disabled={isJoining || !projectId.trim()}
            className="sm:flex-1"
          >
            {isJoining ? (
              'Joining...'
            ) : (
              <>
                Join Project
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}