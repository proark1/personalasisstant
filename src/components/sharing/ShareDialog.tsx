import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { X, Share2, UserPlus, Trash2, Loader2 } from 'lucide-react';

interface ShareDialogProps {
  itemType: 'task' | 'event';
  itemId: string;
  itemTitle: string;
  onShare: (email: string, permission: 'view' | 'edit') => Promise<{ error: string | null }>;
  onGetSharedWith: () => Promise<any[]>;
  onRemoveShare: (shareId: string) => Promise<{ error: any }>;
  onClose: () => void;
}

export function ShareDialog({
  itemType,
  itemId,
  itemTitle,
  onShare,
  onGetSharedWith,
  onRemoveShare,
  onClose,
}: ShareDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [sharedWith, setSharedWith] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadSharedWith();
  }, []);

  const loadSharedWith = async () => {
    setLoading(true);
    const data = await onGetSharedWith();
    setSharedWith(data);
    setLoading(false);
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSharing(true);
    const { error } = await onShare(email.trim(), permission);
    setSharing(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Share Failed',
        description: error,
      });
    } else {
      toast({
        title: 'Shared!',
        description: `${itemType === 'task' ? 'Task' : 'Event'} shared with ${email}`,
      });
      setEmail('');
      loadSharedWith();
    }
  };

  const handleRemove = async (shareId: string, userEmail: string) => {
    const { error } = await onRemoveShare(shareId);
    if (!error) {
      toast({
        title: 'Access Removed',
        description: `Removed access for ${userEmail}`,
      });
      loadSharedWith();
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel-solid w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Share {itemType === 'task' ? 'Task' : 'Event'}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm font-medium">{itemTitle}</p>
          </div>

          {/* Share form */}
          <form onSubmit={handleShare} className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1"
              />
              <Select value={permission} onValueChange={(v: 'view' | 'edit') => setPermission(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={sharing || !email.trim()}>
              {sharing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Share
                </>
              )}
            </Button>
          </form>

          {/* Shared with list */}
          <div>
            <h3 className="text-sm font-medium mb-2">Shared with</h3>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : sharedWith.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Not shared with anyone yet
              </p>
            ) : (
              <div className="space-y-2">
                {sharedWith.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {share.shared_with?.display_name || share.shared_with?.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Can {share.permission}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      onClick={() => handleRemove(share.id, share.shared_with?.email)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
