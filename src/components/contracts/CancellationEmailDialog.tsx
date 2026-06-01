import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Contract } from '@/hooks/useContracts';
import { useContractAI } from '@/hooks/useContractAI';
import { useLanguage } from '@/contexts/LanguageContext';
import { Copy, Mail, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CancellationEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract | null;
}

export function CancellationEmailDialog({
  open,
  onOpenChange,
  contract
}: CancellationEmailDialogProps) {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const { generateCancellationEmail, isGeneratingEmail } = useContractAI();
  
  const [userName, setUserName] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [templates, setTemplates] = useState<{
    formalLetter: string;
    emailVersion: string;
    briefVersion: string;
  } | null>(null);

  const handleGenerate = async () => {
    if (!contract) return;

    const result = await generateCancellationEmail({
      name: contract.name,
      provider: contract.provider,
      contractNumber: contract.contractNumber,
      renewalDate: contract.renewalDate ? format(contract.renewalDate, 'yyyy-MM-dd') : undefined,
      userName: userName || undefined,
      userAddress: userAddress || undefined,
      language: language as 'en' | 'de'
    });

    if (result) {
      setTemplates(result);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: t('contracts.toast.copied'),
        description: t('contracts.toast.copiedDesc')
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('contracts.toast.copyFailed'),
        description: t('contracts.toast.copyFailedDesc')
      });
    }
  };

  const openInEmailClient = (emailText: string) => {
    const subject = encodeURIComponent(`Contract Cancellation - ${contract?.name || ''}`);
    const body = encodeURIComponent(emailText);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Generate Cancellation Letter
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contract Info */}
          {contract && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium">{contract.name}</p>
              {contract.provider && <p className="text-muted-foreground">{contract.provider}</p>}
              {contract.contractNumber && (
                <p className="text-muted-foreground">Contract #: {contract.contractNumber}</p>
              )}
            </div>
          )}

          {/* User Info (optional) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="userName">Your Name (optional)</Label>
              <Input
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userAddress">Your Address (optional)</Label>
              <Input
                id="userAddress"
                value={userAddress}
                onChange={(e) => setUserAddress(e.target.value)}
                placeholder="123 Main St, City"
              />
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate} 
            disabled={isGeneratingEmail}
            className="w-full"
          >
            {isGeneratingEmail ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Cancellation Letter
              </>
            )}
          </Button>

          {/* Templates */}
          {templates && (
            <Tabs defaultValue="email" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="formal">Formal Letter</TabsTrigger>
                <TabsTrigger value="brief">Brief</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-3">
                <Textarea
                  value={templates.emailVersion}
                  readOnly
                  className="min-h-[300px] font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(templates.emailVersion)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openInEmailClient(templates.emailVersion)}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Open in Email
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="formal" className="space-y-3">
                <Textarea
                  value={templates.formalLetter}
                  readOnly
                  className="min-h-[300px] font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(templates.formalLetter)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </TabsContent>

              <TabsContent value="brief" className="space-y-3">
                <Textarea
                  value={templates.briefVersion}
                  readOnly
                  className="min-h-[150px] font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(templates.briefVersion)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
