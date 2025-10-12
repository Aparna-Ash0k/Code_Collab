import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { 
  Share2, 
  Mail, 
  Plus, 
  X, 
  Send,
  Users,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import emailjs from '@emailjs/browser';
import { Project } from '../hooks/useProject';
import { useAuth } from './AuthWrapper';
import { EMAILJS_CONFIG } from '../config/emailjs';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

interface EmailRecipient {
  id: string;
  email: string;
  name?: string;
}

export function ShareModal({ isOpen, onClose, project }: ShareModalProps) {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [subject, setSubject] = useState(`Invitation to collaborate on "${project.name}"`);
  const [message, setMessage] = useState(
    `Hi there!\n\nI'd like to invite you to collaborate on my project "${project.name}".\n\nInvited by: ${user?.user_metadata?.name || user?.email || 'A colleague'}\n\nTo join:\n1. Go to CodeCollab platform\n2. Click "Join by Project ID"\n3. Enter the Project ID shown below\n4. Start coding together!\n\n================\nPROJECT ID: ${project.id}\n================\n\nBest regards`
  );
  const [isSending, setIsSending] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const isEmailJSConfigured = EMAILJS_CONFIG.PUBLIC_KEY && EMAILJS_CONFIG.PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY';

  const addRecipient = () => {
    if (!emailInput.trim()) return;
    
    const email = emailInput.trim().toLowerCase();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check for duplicates
    if (recipients.some(r => r.email === email)) {
      toast.error('This email is already added');
      return;
    }

    const newRecipient: EmailRecipient = {
      id: Date.now().toString(),
      email,
      name: email.split('@')[0] // Use part before @ as name
    };

    setRecipients(prev => [...prev, newRecipient]);
    setEmailInput('');
    toast.success('Email added to recipients');
  };

  const removeRecipient = (id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
  };

  const sendInvitations = async () => {
    if (recipients.length === 0) {
      toast.error('Please add at least one email recipient');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please enter a subject line');
      return;
    }

    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSending(true);
    setSendingStatus('sending');

    try {
      // Check if EmailJS is configured
      if (!EMAILJS_CONFIG.PUBLIC_KEY || EMAILJS_CONFIG.PUBLIC_KEY === 'YOUR_EMAILJS_PUBLIC_KEY') {
        // Fallback to manual mode if EmailJS not configured
        const emailList = recipients.map(r => r.email).join(', ');
        const emailContent = `Subject: ${subject}\n\n${message}\n\n================\nPROJECT ID: ${project.id}\n================`;
        
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(`Recipients: ${emailList}\n\n${emailContent}`);
          toast.success('Email content copied to clipboard!');
          toast.info('Configure EmailJS for automatic sending - check src/config/emailjs.ts');
        } else {
          toast.info('Please manually send invitations to the following emails:');
          console.log('Email Recipients:', emailList);
          console.log('Email Content:', emailContent);
        }
      } else {
        // Use EmailJS for automatic email sending
        const sendPromises = recipients.map(async (recipient) => {
          const templateParams = {
            to_email: recipient.email,
            from_name: user?.user_metadata?.name || user?.email || 'CodeCollab User',
            project_name: project.name,
            project_id: project.id,
            custom_message: message,
            subject: subject
          };

          return emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams,
            EMAILJS_CONFIG.PUBLIC_KEY
          );
        });

        await Promise.all(sendPromises);
        toast.success(`Successfully sent ${recipients.length} email invitation${recipients.length > 1 ? 's' : ''}!`);
      }
      
      setSendingStatus('success');
      
      // Reset form after successful send
      setTimeout(() => {
        setRecipients([]);
        setEmailInput('');
        setSendingStatus('idle');
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Error sending invitations:', error);
      setSendingStatus('error');
      toast.error('Failed to send invitations. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleEmailInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Share2 className="h-5 w-5" />
            Invite Collaborators to Project: {project.name}
          </DialogTitle>
          <DialogDescription>
            Invite others to collaborate on your project by sending them an email invitation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Email Invitations */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Send Email Invitations
              </h4>
              <div className={`px-2 py-1 text-xs rounded ${
                isEmailJSConfigured 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              }`}>
                {isEmailJSConfigured ? 'Auto Mode' : 'Manual Mode'}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {isEmailJSConfigured 
                ? 'Emails will be sent automatically via EmailJS service.'
                : 'Email content will be copied to your clipboard for manual sending. Configure EmailJS for auto-sending.'
              }
            </p>

            {/* Add Recipients */}
            <div className="space-y-3">
              <Label htmlFor="email-input">Add Recipients</Label>
              <div className="flex gap-2">
                <Input
                  id="email-input"
                  type="email"
                  placeholder="Enter email address..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyPress={handleEmailInputKeyPress}
                  className="flex-1"
                />
                <Button onClick={addRecipient} variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Recipients List */}
            {recipients.length > 0 && (
              <div className="space-y-2">
                <Label>Recipients ({recipients.length})</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {recipients.map((recipient) => (
                    <div key={recipient.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{recipient.name}</div>
                          <div className="text-xs text-muted-foreground">{recipient.email}</div>
                        </div>
                      </div>
                      <Button
                        onClick={() => removeRecipient(recipient.id)}
                        variant="ghost"
                        size="sm"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
              />
            </div>

            {/* Email Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your invitation message..."
                rows={8}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                The project ID is automatically included in the email. Recipients will need to use "Join by Project ID" feature.
              </p>
            </div>
          </div>

          {/* Send Button */}
          <div className="flex justify-between items-center pt-4">
            <div className="flex items-center gap-2">
              {sendingStatus === 'sending' && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">
                    {isEmailJSConfigured ? 'Sending emails...' : 'Preparing email content...'}
                  </span>
                </div>
              )}
              {sendingStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {isEmailJSConfigured ? 'Emails sent successfully!' : 'Email content copied to clipboard!'}
                  </span>
                </div>
              )}
              {sendingStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {isEmailJSConfigured ? 'Failed to send emails' : 'Failed to copy email content'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={isSending}>
                Cancel
              </Button>
              <Button 
                onClick={sendInvitations} 
                disabled={isSending || recipients.length === 0}
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isEmailJSConfigured ? 'Send Emails' : 'Copy to Clipboard'} {recipients.length > 0 && `(${recipients.length})`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}