import { useState, useEffect, useRef, useMemo } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, X, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface ComposeEmailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (to: string, subject: string, body: string, threadId?: string | null, gmailMessageId?: string | null) => Promise<boolean>;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  threadId?: string | null;
  gmailMessageId?: string | null;
}

export function ComposeEmailSheet({ open, onOpenChange, onSend, initialTo, initialSubject, initialBody, threadId, gmailMessageId }: ComposeEmailSheetProps) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useAuth();
  const { contacts } = useContacts(user?.id);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.filter(c => c.email);
    const q = contactSearch.toLowerCase();
    return contacts.filter(c =>
      c.email && (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
    );
  }, [contacts, contactSearch]);

  useEffect(() => {
    if (open) {
      if (initialTo !== undefined) { setTo(initialTo); setContactSearch(initialTo); }
      if (initialSubject !== undefined) setSubject(initialSubject);
      if (initialBody !== undefined) setBody(initialBody);
    }
  }, [open, initialTo, initialSubject, initialBody]);

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) return;
    setSending(true);
    const success = await onSend(to.trim(), subject.trim(), body.trim(), threadId, gmailMessageId);
    setSending(false);
    if (success) {
      setTo('');
      setCc('');
      setBcc('');
      setSubject('');
      setBody('');
      setContactSearch('');
      setShowCcBcc(false);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setTo('');
    setCc('');
    setBcc('');
    setSubject('');
    setBody('');
    setContactSearch('');
    setShowContacts(false);
    setShowCcBcc(false);
    onOpenChange(false);
  };

  const handleSelectContact = (email: string) => {
    setTo(email);
    setContactSearch(email);
    setShowContacts(false);
  };

  const handleToChange = (value: string) => {
    setContactSearch(value);
    setTo(value);
    setShowContacts(true);
  };

  const handleToFocus = () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setShowContacts(true);
  };

  const handleToBlur = () => {
    blurTimeout.current = setTimeout(() => setShowContacts(false), 200);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] bg-background">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 my-3" />
        <div className="px-4 pb-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{threadId ? 'Reply' : 'New Email'}</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-xs text-muted-foreground gap-1"
              >
                CC/BCC
                {showCcBcc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleClose}><X className="w-4 h-4" /></Button>
            </div>
          </div>

          {/* To field with contact search */}
          <div className="relative">
            <Input
              placeholder="To (search contacts or type email)"
              type="email"
              value={contactSearch}
              onChange={e => handleToChange(e.target.value)}
              onFocus={handleToFocus}
              onBlur={handleToBlur}
              className="h-10 text-sm"
            />
            {showContacts && filteredContacts.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                {filteredContacts.slice(0, 8).map(contact => (
                  <button
                    key={contact.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectContact(contact.email!)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CC / BCC fields */}
          {showCcBcc && (
            <div className="space-y-2">
              <Input
                placeholder="CC"
                type="email"
                value={cc}
                onChange={e => setCc(e.target.value)}
                className="h-9 text-sm"
              />
              <Input
                placeholder="BCC"
                type="email"
                value={bcc}
                onChange={e => setBcc(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          )}

          <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} className="h-10 text-sm" />
          <Textarea placeholder="Write your message..." value={body} onChange={e => setBody(e.target.value)} className="min-h-[150px] text-sm" />
          <Button className="w-full gap-2" onClick={handleSend} disabled={sending || !to.trim() || !body.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
