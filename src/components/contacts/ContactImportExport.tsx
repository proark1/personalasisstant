import { useState, useRef } from 'react';
import { Contact, ContactInput } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, FileText, FileSpreadsheet } from 'lucide-react';

interface ContactImportExportProps {
  contacts: Contact[];
  onImport: (contacts: ContactInput[]) => Promise<void>;
}

export function ContactImportExport({ contacts, onImport }: ContactImportExportProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvData, setCsvData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Name', 'Email', 'Phone', 'Company', 'Role', 'Country', 'City',
      'Contact Type', 'Personal Tier', 'Business Level', 'Contact Frequency (Days)',
      'Notes', 'Tags', 'LinkedIn URL', 'Twitter URL', 'Website URL', 'Birth Date'
    ];

    const rows = contacts.map(c => [
      c.name,
      c.email || '',
      c.phone || '',
      c.company || '',
      c.role || '',
      c.country || '',
      c.city || '',
      c.contactType,
      c.personalTier || '',
      c.businessLevel || '',
      c.contactFrequencyDays.toString(),
      c.notes || '',
      c.tags.join('; '),
      c.linkedinUrl || '',
      c.twitterUrl || '',
      c.websiteUrl || '',
      c.birthDate || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contacts-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({ title: 'Contacts exported', description: `${contacts.length} contacts exported to CSV` });
  };

  // Export to vCard
  const exportToVCard = () => {
    const vCards = contacts.map(c => {
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${c.name}`,
        `N:${c.name.split(' ').reverse().join(';')};;;`,
      ];

      if (c.email) lines.push(`EMAIL:${c.email}`);
      if (c.phone) lines.push(`TEL:${c.phone}`);
      if (c.company) lines.push(`ORG:${c.company}`);
      if (c.role) lines.push(`TITLE:${c.role}`);
      if (c.city || c.country) {
        lines.push(`ADR:;;${c.city || ''};${c.country || ''};;;`);
      }
      if (c.linkedinUrl) lines.push(`URL;TYPE=LinkedIn:${c.linkedinUrl}`);
      if (c.twitterUrl) lines.push(`URL;TYPE=Twitter:${c.twitterUrl}`);
      if (c.websiteUrl) lines.push(`URL:${c.websiteUrl}`);
      if (c.birthDate) lines.push(`BDAY:${c.birthDate.replace(/-/g, '')}`);
      if (c.notes) lines.push(`NOTE:${c.notes.replace(/\n/g, '\\n')}`);

      lines.push('END:VCARD');
      return lines.join('\r\n');
    });

    const blob = new Blob([vCards.join('\r\n\r\n')], { type: 'text/vcard;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contacts-export-${new Date().toISOString().split('T')[0]}.vcf`;
    link.click();

    toast({ title: 'Contacts exported', description: `${contacts.length} contacts exported to vCard` });
  };

  // Parse CSV
  const parseCSV = (csv: string): ContactInput[] => {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const contacts: ContactInput[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g)?.map(v => 
        v.replace(/^,?"?|"?$/g, '').replace(/""/g, '"').trim()
      ) || [];

      const getVal = (names: string[]) => {
        for (const name of names) {
          const idx = headers.indexOf(name.toLowerCase());
          if (idx >= 0 && values[idx]) return values[idx];
        }
        return undefined;
      };

      const name = getVal(['name', 'full name', 'fullname']);
      if (!name) continue;

      contacts.push({
        name,
        email: getVal(['email', 'e-mail', 'email address']),
        phone: getVal(['phone', 'telephone', 'mobile', 'cell']),
        company: getVal(['company', 'organization', 'org']),
        role: getVal(['role', 'title', 'job title', 'position']),
        country: getVal(['country']),
        city: getVal(['city']),
        contactType: (getVal(['contact type', 'type']) as any) || 'personal',
        personalTier: getVal(['personal tier', 'tier']) as any,
        businessLevel: getVal(['business level', 'level']) as any,
        contactFrequencyDays: parseInt(getVal(['contact frequency', 'frequency']) || '30') || 30,
        notes: getVal(['notes', 'note', 'comments']),
        tags: getVal(['tags'])?.split(/[;,]/).map(t => t.trim()).filter(Boolean),
        linkedinUrl: getVal(['linkedin', 'linkedin url']),
        twitterUrl: getVal(['twitter', 'twitter url']),
        websiteUrl: getVal(['website', 'website url', 'url']),
        birthDate: getVal(['birth date', 'birthday', 'dob']),
      });
    }

    return contacts;
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvData(content);
    };
    reader.readAsText(file);
  };

  // Import contacts
  const handleImport = async () => {
    if (!csvData.trim()) {
      toast({ title: 'No data to import', variant: 'destructive' });
      return;
    }

    setImporting(true);
    try {
      const parsed = parseCSV(csvData);
      if (parsed.length === 0) {
        toast({ title: 'No valid contacts found', variant: 'destructive' });
        return;
      }

      await onImport(parsed);
      toast({ title: 'Import successful', description: `${parsed.length} contacts imported` });
      setCsvData('');
      setOpen(false);
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: 'Import failed', description: 'Please check your data format', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Import/Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import & Export Contacts</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="export">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export your {contacts.length} contacts to a file.
            </p>
            <div className="flex gap-3">
              <Button onClick={exportToCSV} className="flex-1">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={exportToVCard} variant="outline" className="flex-1">
                <FileText className="w-4 h-4 mr-2" />
                Export vCard
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import contacts from a CSV file. Required column: Name.
            </p>

            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose CSV File
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or paste CSV</span>
                </div>
              </div>

              <Textarea
                placeholder="Name,Email,Phone,Company&#10;John Doe,john@example.com,+1234567890,Acme Inc"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />

              <Button 
                onClick={handleImport} 
                disabled={importing || !csvData.trim()}
                className="w-full"
              >
                {importing ? 'Importing...' : 'Import Contacts'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
