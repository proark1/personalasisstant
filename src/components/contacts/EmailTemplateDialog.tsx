import { useState } from 'react';
import { Contact } from '@/hooks/useContacts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Copy, Mail, Send } from 'lucide-react';

interface EmailTemplateDialogProps {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEMPLATES = {
  followup: {
    name: 'Follow-up',
    subject: 'Following up',
    body: `Hi {{name}},

I hope this message finds you well! I wanted to reach out and see how things are going with you.

It's been a while since we last connected, and I'd love to catch up.

Let me know if you have some time for a quick call or coffee.

Best regards`,
  },
  introduction: {
    name: 'Introduction',
    subject: 'Nice to meet you',
    body: `Hi {{name}},

It was great meeting you recently! I really enjoyed our conversation about {{company}}.

I'd love to stay in touch and explore how we might collaborate in the future.

Looking forward to connecting again soon.

Best`,
  },
  thankyou: {
    name: 'Thank You',
    subject: 'Thank you!',
    body: `Hi {{name}},

I just wanted to take a moment to thank you for your time and support.

Your insights about {{role}} were incredibly valuable, and I really appreciate you sharing them with me.

Please let me know if there's ever anything I can do to help you.

Best regards`,
  },
  reconnect: {
    name: 'Reconnect',
    subject: 'Long time no see!',
    body: `Hi {{name}},

I was thinking about you recently and realized it's been too long since we caught up!

I'd love to hear what you've been up to at {{company}}.

Are you free for a call sometime this week or next?

Best`,
  },
  birthday: {
    name: 'Birthday',
    subject: 'Happy Birthday! 🎂',
    body: `Hi {{name}},

Happy Birthday! 🎉

I hope you have an amazing day filled with joy and celebration.

Wishing you all the best for the year ahead!

Cheers`,
  },
};

export function EmailTemplateDialog({ contact, open, onOpenChange }: EmailTemplateDialogProps) {
  const { toast } = useToast();
  const [activeTemplate, setActiveTemplate] = useState<keyof typeof TEMPLATES>('followup');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const applyTemplate = (templateKey: keyof typeof TEMPLATES) => {
    const template = TEMPLATES[templateKey];
    const replacements: Record<string, string> = {
      '{{name}}': contact.name.split(' ')[0],
      '{{fullname}}': contact.name,
      '{{company}}': contact.company || 'your work',
      '{{role}}': contact.role || 'your field',
      '{{city}}': contact.city || 'your area',
    };

    let processedSubject = template.subject;
    let processedBody = template.body;

    Object.entries(replacements).forEach(([placeholder, value]) => {
      processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), value);
      processedBody = processedBody.replace(new RegExp(placeholder, 'g'), value);
    });

    setSubject(processedSubject);
    setBody(processedBody);
    setActiveTemplate(templateKey);
  };

  const handleCopy = () => {
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullEmail);
    toast({ title: 'Copied to clipboard' });
  };

  const handleSendEmail = () => {
    if (!contact.email) {
      toast({ title: 'No email address', variant: 'destructive' });
      return;
    }

    const mailtoLink = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
  };

  // Initialize with first template
  useState(() => {
    applyTemplate('followup');
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Templates for {contact.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Template Selection */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(TEMPLATES).map(([key, template]) => (
              <Button
                key={key}
                variant={activeTemplate === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyTemplate(key as keyof typeof TEMPLATES)}
              >
                {template.name}
              </Button>
            ))}
          </div>

          {/* Email Composer */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>

            <div>
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                placeholder="Email body..."
                className="font-sans"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
          <Button onClick={handleSendEmail} disabled={!contact.email}>
            <Send className="w-4 h-4 mr-2" />
            Open in Email Client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
