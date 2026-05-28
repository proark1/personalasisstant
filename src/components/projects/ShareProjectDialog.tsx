import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  UserPlus, 
  Loader2,
  Crown,
  Trash2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface ProjectMember {
  id: string;
  userId: string;
  role: 'member' | 'admin';
  userEmail?: string;
  userDisplayName?: string;
}

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  members: ProjectMember[];
  onShare: (email: string, role: 'member' | 'admin') => Promise<{ error: string | null }>;
  onRemoveMember: (memberId: string) => Promise<{ error: string | null }>;
  isOwner: boolean;
}

export function ShareProjectDialog({
  open,
  onOpenChange,
  projectName,
  members,
  onShare,
  onRemoveMember,
  isOwner,
}: ShareProjectDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleShare = async () => {
    if (!email.trim()) return;
    setLoading(true);

    const result = await onShare(email.trim(), role);

    if (result.error) {
      toast({
        title: 'Failed to share',
        description: result.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Project shared!',
        description: `${email} can now access "${projectName}"`,
      });
      setEmail('');
    }
    setLoading(false);
  };

  const handleRemove = async (memberId: string, memberName: string) => {
    const result = await onRemoveMember(memberId);
    if (result.error) {
      toast({
        title: 'Failed to remove',
        description: result.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Member removed',
        description: `${memberName} no longer has access`,
      });
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || '??';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Share "{projectName}"
          </DialogTitle>
          <DialogDescription>
            Invite others to collaborate on this project. They'll be able to view and add tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add member form */}
          {isOwner && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="email" className="sr-only">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleShare();
                    }}
                  />
                </div>
                <Select value={role} onValueChange={(v) => setRole(v as 'member' | 'admin')}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleShare} disabled={loading || !email.trim()}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Members can view and add tasks. Admins can also manage other members.
              </p>
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Team members ({members.length})
            </Label>
            <ScrollArea className="h-[200px]">
              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No members yet</p>
                  <p className="text-xs text-muted-foreground/60">
                    Share this project to collaborate
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(member.userDisplayName, member.userEmail)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.userDisplayName || member.userEmail}
                        </p>
                        {member.userDisplayName && (
                          <p className="text-xs text-muted-foreground truncate">
                            {member.userEmail}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {member.role === 'admin' && <Crown className="w-3 h-3 mr-1" />}
                        {member.role}
                      </Badge>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(
                            member.id,
                            member.userDisplayName || member.userEmail || 'Member'
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}