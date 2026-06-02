import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { X, Share2, UserPlus, Trash2, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Contact {
  userId: string;
  email: string;
  displayName?: string;
}

interface SharedWithEntry {
  id: string;
  shared_with_id?: string;
  permission?: string;
  shared_with?: { display_name?: string | null; email?: string | null } | null;
}

interface ShareDialogProps {
  itemType: 'task' | 'event' | 'contract' | 'contact';
  itemId: string;
  itemTitle: string;
  onShare: (email: string, permission: 'view' | 'edit') => Promise<{ error: string | null }>;
  onGetSharedWith: () => Promise<Record<string, unknown>[]>;
  onRemoveShare: (shareId: string) => Promise<{ error: string | null }>;
  onGetRecentContacts?: () => Promise<Contact[]>;
  onClose: () => void;
}

export function ShareDialog({
  itemType,
  itemId: _itemId,
  itemTitle,
  onShare,
  onGetSharedWith,
  onRemoveShare,
  onGetRecentContacts,
  onClose,
}: ShareDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [sharedWith, setSharedWith] = useState<SharedWithEntry[]>([]);
  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    loadSharedWith();
    loadRecentContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSharedWith = async () => {
    setLoading(true);
    const data = await onGetSharedWith();
    setSharedWith(data as unknown as SharedWithEntry[]);
    setLoading(false);
  };

  const loadRecentContacts = async () => {
    if (onGetRecentContacts) {
      const contacts = await onGetRecentContacts();
      setRecentContacts(contacts);
    }
  };

  // Filter suggestions based on input and exclude already shared users
  const filteredSuggestions = useMemo(() => {
    if (!email.trim()) return recentContacts;
    
    const searchTerm = email.toLowerCase();
    return recentContacts.filter(contact => 
      contact.email.toLowerCase().includes(searchTerm) ||
      contact.displayName?.toLowerCase().includes(searchTerm)
    );
  }, [email, recentContacts]);

  // Filter out contacts already shared with
  const availableSuggestions = useMemo(() => {
    const sharedUserIds = new Set(sharedWith.map(s => s.shared_with_id));
    return filteredSuggestions.filter(c => !sharedUserIds.has(c.userId));
  }, [filteredSuggestions, sharedWith]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSharing(true);
    setShowSuggestions(false);
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

  const handleSelectContact = (contact: Contact) => {
    setEmail(contact.email);
    setShowSuggestions(false);
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
              <div className="relative flex-1">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Enter email address"
                  autoComplete="off"
                />
                
                {/* Autocomplete suggestions */}
                {showSuggestions && availableSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {availableSuggestions.map((contact) => (
                      <button
                        key={contact.userId}
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors",
                          "first:rounded-t-lg last:rounded-b-lg"
                        )}
                        onMouseDown={() => handleSelectContact(contact)}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {contact.displayName && (
                            <p className="text-sm font-medium truncate">{contact.displayName}</p>
                          )}
                          <p className={cn(
                            "text-xs truncate",
                            contact.displayName ? "text-muted-foreground" : "text-sm"
                          )}>
                            {contact.email}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                      onClick={() => handleRemove(share.id, share.shared_with?.email ?? '')}
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