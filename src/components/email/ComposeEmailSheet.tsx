import { useState, useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, X } from 'lucide-react';

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
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Populate fields when initial values change (e.g. AI draft)
  useEffect(() => {
    if (open) {
      if (initialTo !== undefined) setTo(initialTo);
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
      setSubject('');
      setBody('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setTo('');
    setSubject('');
    setBody('');
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] bg-background">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 my-3" />
        <div className="px-4 pb-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{threadId ? 'Reply' : 'New Email'}</h3>
            <Button variant="ghost" size="icon" onClick={handleClose}><X className="w-4 h-4" /></Button>
          </div>
          <Input placeholder="To" type="email" value={to} onChange={e => setTo(e.target.value)} className="h-10 text-sm" />
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
