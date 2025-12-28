import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Languages, Copy, Check } from 'lucide-react';
import { useChatAI } from '@/hooks/useChatAI';
import { toast } from 'sonner';

interface TranslateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
}

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
];

export function TranslateDialog({ open, onOpenChange, message }: TranslateDialogProps) {
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [translatedText, setTranslatedText] = useState('');
  const [copied, setCopied] = useState(false);
  const { translateMessage, loading } = useChatAI();

  const handleTranslate = async () => {
    const langName = languages.find(l => l.code === targetLanguage)?.name || targetLanguage;
    const result = await translateMessage(message, langName);
    setTranslatedText(result);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(translatedText);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5" />
            Translate Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Original:</p>
            <p className="text-sm">{message}</p>
          </div>

          <div className="flex gap-2">
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleTranslate} disabled={loading}>
              {loading ? 'Translating...' : 'Translate'}
            </Button>
          </div>

          {translatedText && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">Translation:</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm">{translatedText}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
