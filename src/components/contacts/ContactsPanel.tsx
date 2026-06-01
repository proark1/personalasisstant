import { memo, useCallback, useState, type ReactNode } from 'react';
import { useContacts, Contact, ContactType, ContactInput, PersonalTier, BusinessLevel, FamilyRelationship } from '@/hooks/useContacts';
import { useContactInteractions } from '@/hooks/useContactInteractions';
import { useItemSharing } from '@/hooks/useItemSharing';
import { PanelShell, staggerItem } from '@/components/ui/panel-shell';
import { ShareDialog } from '@/components/sharing/ShareDialog';
import { ContactProfileCard } from '@/components/contacts/ContactProfileCard';
import { ContactNetworkHealth } from '@/components/contacts/ContactNetworkHealth';
import { ContactTimeline } from '@/components/contacts/ContactTimeline';
import { ContactImportExport } from '@/components/contacts/ContactImportExport';
import { EmailTemplateDialog } from '@/components/contacts/EmailTemplateDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { motion } from 'framer-motion';
import { 
  UserPlus, Search, Users, Briefcase, Mail, Building, Clock, Bell, Check, Pencil, Cake, LayoutGrid, List,
  TrendingUp, Calendar, Heart
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow, isPast, differenceInDays } from 'date-fns';
import { Switch } from '@/components/ui/switch';

const PERSONAL_TIERS: { value: PersonalTier; label: string; color: string }[] = [
  { value: 'family', label: 'Family', color: 'bg-red-500' },
  { value: 'close_friend', label: 'Close Friend', color: 'bg-orange-500' },
  { value: 'friend', label: 'Friend', color: 'bg-yellow-500' },
  { value: 'acquaintance', label: 'Acquaintance', color: 'bg-gray-500' },
];

const BUSINESS_LEVELS: { value: BusinessLevel; label: string; color: string }[] = [
  { value: 'very_well', label: 'Know Very Well', color: 'bg-green-500' },
  { value: 'well', label: 'Know Well', color: 'bg-blue-500' },
  { value: 'barely', label: 'Barely Know', color: 'bg-purple-500' },
  { value: 'not_contacted', label: 'Not Contacted Yet', color: 'bg-gray-500' },
];

const FAMILY_RELATIONSHIPS: { value: FamilyRelationship; label: string }[] = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'partner', label: 'Partner' },
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'son', label: 'Son' },
  { value: 'sister', label: 'Sister' },
  { value: 'brother', label: 'Brother' },
  { value: 'grandmother', label: 'Grandmother' },
  { value: 'grandfather', label: 'Grandfather' },
  { value: 'granddaughter', label: 'Granddaughter' },
  { value: 'grandson', label: 'Grandson' },
  { value: 'aunt', label: 'Aunt' },
  { value: 'uncle', label: 'Uncle' },
  { value: 'cousin', label: 'Cousin' },
  { value: 'niece', label: 'Niece' },
  { value: 'nephew', label: 'Nephew' },
  { value: 'mother_in_law', label: 'Mother-in-law' },
  { value: 'father_in_law', label: 'Father-in-law' },
  { value: 'other', label: 'Other' },
];

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  country: string;
  city: string;
  contactType: ContactType;
  personalTier: PersonalTier | '';
  businessLevel: BusinessLevel | '';
  familyRelationship: FamilyRelationship | '';
  contactFrequencyDays: number;
  notes: string;
  tags: string;
  linkedinUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  birthDate: string;
  birthdayReminder: boolean;
}

const defaultFormData: ContactFormData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  role: '',
  country: '',
  city: '',
  contactType: 'personal',
  personalTier: '',
  businessLevel: '',
  familyRelationship: '',
  contactFrequencyDays: 30,
  notes: '',
  tags: '',
  linkedinUrl: '',
  twitterUrl: '',
  websiteUrl: '',
  birthDate: '',
  birthdayReminder: false,
};

const getTierBadge = (contact: Contact): ReactNode => {
  if (contact.contactType === 'personal' && contact.personalTier) {
    const tier = PERSONAL_TIERS.find(t => t.value === contact.personalTier);
    return tier ? <Badge className={`${tier.color} text-white text-[10px] px-1.5 py-0`}>{tier.label}</Badge> : null;
  }
  if (contact.contactType === 'business' && contact.businessLevel) {
    const level = BUSINESS_LEVELS.find(l => l.value === contact.businessLevel);
    return level ? <Badge className={`${level.color} text-white text-[10px] px-1.5 py-0`}>{level.label}</Badge> : null;
  }
  return null;
};

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getUpcomingBirthday = (contact: Contact) => {
  if (!contact.birthDate || !contact.birthdayReminder) return null;
  const now = new Date();
  const birthday = new Date(contact.birthDate);
  birthday.setFullYear(now.getFullYear());
  if (birthday < now) birthday.setFullYear(now.getFullYear() + 1);
  const daysUntil = differenceInDays(birthday, now);
  if (daysUntil >= 0 && daysUntil <= 7) return daysUntil;
  return null;
};

interface ContactRowProps {
  contact: Contact;
  onSelect: (contact: Contact) => void;
  onMarkContacted: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onEmail: (contact: Contact) => void;
}

// Memoized so a contact row only re-renders when its own props change,
// not when a sibling row or unrelated panel state updates.
const ContactRow = memo(function ContactRow({ contact, onSelect, onMarkContacted, onEdit, onEmail }: ContactRowProps) {
  const isDue = contact.nextContactDue && isPast(contact.nextContactDue);
  const birthdayDays = getUpcomingBirthday(contact);
  const isFamily = contact.personalTier === 'family';

  return (
    <motion.div variants={staggerItem}>
      <GlassCard
        pressable
        haptic="light"
        className={`group transition-colors relative ${isDue ? 'border-destructive/50' : ''}`}
        onClick={() => onSelect(contact)}
      >
        {isDue && (
          <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
          </span>
        )}
        <GlassCardContent className="p-3">
          <div className="flex items-start gap-2.5">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-medium text-sm truncate">{contact.name}</p>
                {getTierBadge(contact)}
                {isFamily && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-pink-500/50 text-pink-500">
                    <Heart className="w-2 h-2 mr-0.5" />Family
                  </Badge>
                )}
              </div>

              <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                {contact.company && (
                  <p className="flex items-center gap-1 truncate">
                    <Building className="w-3 h-3 shrink-0" />
                    {contact.company}{contact.role && ` · ${contact.role}`}
                  </p>
                )}
                {contact.lastContactedAt ? (
                  <p className="flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    {formatDistanceToNow(contact.lastContactedAt, { addSuffix: true })}
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-muted-foreground/60">
                    <Clock className="w-3 h-3 shrink-0" />Never contacted
                  </p>
                )}
              </div>

              {birthdayDays !== null && (
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-pink-500/10 text-pink-600">
                    <Cake className="w-2.5 h-2.5 mr-0.5" />
                    {birthdayDays === 0 ? 'Birthday today! 🎂' : `Birthday in ${birthdayDays}d`}
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-0 max-md:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-green-500"
                onClick={(e) => { e.stopPropagation(); onMarkContacted(contact); }}
                title="Mark contacted"
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onEdit(contact); }}
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onEmail(contact); }}
                title="Email"
              >
                <Mail className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
});

interface ContactsPanelProps {
  userId: string;
}

export function ContactsPanel({ userId }: ContactsPanelProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const {
    contacts,
    personalContacts,
    businessContacts,
    loading,
    addContact,
    updateContact,
    deleteContact,
    markContacted,
    getContactsDue,
    refetch,
  } = useContacts(userId);

  const { shareItem, getSharedWith, removeShare, getRecentContacts } = useItemSharing(userId);
  const { getInteractions } = useContactInteractions(userId);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(defaultFormData);
  const [activeTab, setActiveTab] = useState<'personal' | 'business' | 'due' | 'insights' | 'timeline'>('personal');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [shareDialog, setShareDialog] = useState<{ id: string; name: string } | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);
  const [emailTemplateContact, setEmailTemplateContact] = useState<Contact | null>(null);

  const contactsDue = getContactsDue();

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingContact(null);
  };

  const openEditDialog = useCallback((contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      role: contact.role || '',
      country: contact.country || '',
      city: contact.city || '',
      contactType: contact.contactType,
      personalTier: contact.personalTier || '',
      businessLevel: contact.businessLevel || '',
      familyRelationship: contact.familyRelationship || '',
      contactFrequencyDays: contact.contactFrequencyDays,
      notes: contact.notes || '',
      tags: contact.tags.join(', '),
      linkedinUrl: contact.linkedinUrl || '',
      twitterUrl: contact.twitterUrl || '',
      websiteUrl: contact.websiteUrl || '',
      birthDate: contact.birthDate || '',
      birthdayReminder: contact.birthdayReminder ?? false,
    });
    setShowAddDialog(true);
  }, []);

  const handleSubmit = async () => {
    if (saving) return;

    if (!formData.name.trim()) {
      toast({ title: t('contacts.toast.nameRequired'), variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const tags = formData.tags.split(',').map((t) => t.trim()).filter(Boolean);

      if (editingContact) {
        const success = await updateContact(editingContact.id, {
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          company: formData.company || undefined,
          role: formData.role || undefined,
          country: formData.country || undefined,
          city: formData.city || undefined,
          contactType: formData.contactType,
          personalTier: formData.personalTier || undefined,
          businessLevel: formData.businessLevel || undefined,
          familyRelationship:
            formData.personalTier === 'family' ? (formData.familyRelationship || undefined) : undefined,
          contactFrequencyDays: formData.contactFrequencyDays,
          notes: formData.notes || undefined,
          tags,
          linkedinUrl: formData.linkedinUrl || undefined,
          twitterUrl: formData.twitterUrl || undefined,
          websiteUrl: formData.websiteUrl || undefined,
          birthDate: formData.birthDate || undefined,
          birthdayReminder: formData.birthdayReminder,
        });

        if (success) {
          toast({ title: t('contacts.toast.contactUpdated') });
          setShowAddDialog(false);
          resetForm();
        } else {
          toast({ title: t('contacts.toast.updateFailed'), description: t('contacts.toast.tryAgain'), variant: 'destructive' });
        }
      } else {
        const result = await addContact({
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          company: formData.company || undefined,
          role: formData.role || undefined,
          country: formData.country || undefined,
          city: formData.city || undefined,
          contactType: formData.contactType,
          personalTier: formData.personalTier || undefined,
          businessLevel: formData.businessLevel || undefined,
          familyRelationship:
            formData.personalTier === 'family' ? (formData.familyRelationship || undefined) : undefined,
          contactFrequencyDays: formData.contactFrequencyDays,
          notes: formData.notes || undefined,
          tags,
          linkedinUrl: formData.linkedinUrl || undefined,
          twitterUrl: formData.twitterUrl || undefined,
          websiteUrl: formData.websiteUrl || undefined,
          birthDate: formData.birthDate || undefined,
          birthdayReminder: formData.birthdayReminder,
        });

        if (result) {
          toast({ title: t('contacts.toast.contactAdded') });
          setShowAddDialog(false);
          resetForm();
        } else {
          toast({ title: t('contacts.toast.addFailed'), description: t('contacts.toast.tryAgain'), variant: 'destructive' });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!contactToDelete) return;
    const success = await deleteContact(contactToDelete.id);
    if (success) {
      toast({ title: t('contacts.toast.contactDeleted') });
    }
    setContactToDelete(null);
  };

  const handleMarkContacted = useCallback(async (contact: Contact) => {
    const success = await markContacted(contact.id);
    if (success) {
      toast({ title: t('contacts.toast.markedContacted').replace('{name}', () => contact.name) });
    }
  }, [markContacted, toast, t]);

  const handleImportContacts = async (contactsToImport: ContactInput[]) => {
    let imported = 0;
    for (const c of contactsToImport) {
      const result = await addContact(c);
      if (result) imported++;
    }
    toast({ title: t(imported === 1 ? 'contacts.toast.importedContacts.one' : 'contacts.toast.importedContacts.other').replace('{count}', String(imported)) });
  };

  const handleOpenEmailTemplate = useCallback((contact: Contact) => {
    setEmailTemplateContact(contact);
    setShowEmailTemplate(true);
  }, []);

  const handleSelectContact = useCallback((contact: Contact) => {
    setSelectedContact(contact);
  }, []);

  const filterContacts = (contactsList: Contact[]) => {
    if (!searchQuery) return contactsList;
    const query = searchQuery.toLowerCase();
    return contactsList.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.company?.toLowerCase().includes(query) ||
      c.notes?.toLowerCase().includes(query) ||
      c.tags.some(t => t.toLowerCase().includes(query))
    );
  };

  const displayContacts = activeTab === 'personal'
    ? filterContacts(personalContacts)
    : activeTab === 'business'
    ? filterContacts(businessContacts)
    : activeTab === 'due'
    ? filterContacts(contactsDue)
    : [];

  const getEmptyMessage = () => {
    if (searchQuery) return { title: 'No matches', description: 'No contacts match your search' };
    if (activeTab === 'due') return { title: "All caught up! 🎉", description: 'No contacts due for follow-up' };
    if (activeTab === 'personal') return { title: 'No personal contacts', description: 'Add family, friends, or acquaintances' };
    if (activeTab === 'business') return { title: 'No business contacts', description: 'Build your professional network' };
    return { title: 'No contacts yet', description: 'Get started by adding a contact' };
  };

  const headerActions = (
    <div className="flex items-center gap-1.5">
      <ContactImportExport contacts={contacts} onImport={handleImportContacts} />
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1">
            <UserPlus className="w-4 h-4" />
            Add
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Company</Label>
                <Input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={formData.contactType} onValueChange={(v: ContactType) => setFormData({ ...formData, contactType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.contactType === 'personal' && (
              <div>
                <Label>Tier</Label>
                <Select value={formData.personalTier || undefined} onValueChange={(v: PersonalTier) => setFormData({ ...formData, personalTier: v, familyRelationship: v !== 'family' ? '' : formData.familyRelationship })}>
                  <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                  <SelectContent>
                    {PERSONAL_TIERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.personalTier === 'family' && (
              <div>
                <Label>Relationship</Label>
                <Select value={formData.familyRelationship || undefined} onValueChange={(v: FamilyRelationship) => setFormData({ ...formData, familyRelationship: v })}>
                  <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                  <SelectContent>
                    {FAMILY_RELATIONSHIPS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.contactType === 'business' && (
              <div>
                <Label>Level</Label>
                <Select value={formData.businessLevel || undefined} onValueChange={(v: BusinessLevel) => setFormData({ ...formData, businessLevel: v })}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {BUSINESS_LEVELS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Contact Frequency (days)</Label>
              <Input type="number" value={formData.contactFrequencyDays} onChange={(e) => setFormData({ ...formData, contactFrequencyDays: parseInt(e.target.value) || 30 })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} />
            </div>
            
            <div className="border-t border-border pt-3 mt-3">
              <Label className="flex items-center gap-2 mb-2">
                <Cake className="w-4 h-4 text-primary" />
                Birthday
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input 
                    type="date" 
                    value={formData.birthDate} 
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })} 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.birthdayReminder}
                    onCheckedChange={(checked) => setFormData({ ...formData, birthdayReminder: checked })}
                  />
                  <Label className="text-xs">Remind me</Label>
                </div>
              </div>
            </div>
            
            <Button onClick={handleSubmit} className="w-full" disabled={saving}>
              {saving ? 'Saving…' : editingContact ? 'Update' : 'Add'} Contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  const headerExtra = (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'cards' | 'table')} className="shrink-0">
          <ToggleGroupItem value="cards" size="sm" className="h-9 w-9 p-0">
            <LayoutGrid className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" size="sm" className="h-9 w-9 p-0">
            <List className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="personal" className="gap-1 text-[10px] px-1">
          <Users className="w-3 h-3" />
          <span className="hidden sm:inline">Personal</span>
          <span className="sm:hidden">{personalContacts.length}</span>
          <span className="hidden sm:inline">({personalContacts.length})</span>
        </TabsTrigger>
        <TabsTrigger value="business" className="gap-1 text-[10px] px-1">
          <Briefcase className="w-3 h-3" />
          <span className="hidden sm:inline">Business</span>
          <span className="sm:hidden">{businessContacts.length}</span>
          <span className="hidden sm:inline">({businessContacts.length})</span>
        </TabsTrigger>
        <TabsTrigger value="due" className="gap-1 text-[10px] px-1">
          <Bell className="w-3 h-3" />
          <span className="hidden sm:inline">Due</span>
          <span className="sm:hidden">{contactsDue.length}</span>
          <span className="hidden sm:inline">({contactsDue.length})</span>
        </TabsTrigger>
        <TabsTrigger value="insights" className="gap-1 text-[10px] px-1">
          <TrendingUp className="w-3 h-3" />
          <span className="hidden sm:inline">Insights</span>
        </TabsTrigger>
        <TabsTrigger value="timeline" className="gap-1 text-[10px] px-1">
          <Calendar className="w-3 h-3" />
          <span className="hidden sm:inline">Timeline</span>
        </TabsTrigger>
      </TabsList>
    </div>
  );

  return (
    <>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="h-full flex flex-col">
        <PanelShell
          icon={Users}
          title="Contacts"
          subtitle={`${contacts.length} contacts · ${contactsDue.length} due`}
          actions={headerActions}
          loading={loading}
          loadingVariant="list"
          empty={activeTab !== 'insights' && activeTab !== 'timeline' && displayContacts.length === 0 && !loading}
          emptyIcon={activeTab === 'due' ? Bell : Users}
          emptyTitle={getEmptyMessage().title}
          emptyDescription={getEmptyMessage().description}
          emptyAction={
            activeTab !== 'due' ? (
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <UserPlus className="w-4 h-4 mr-1" />
                Add Contact
              </Button>
            ) : undefined
          }
          headerExtra={headerExtra}
          noPadding
        >
          {(['personal', 'business', 'due'] as const).map(tab => (
            <TabsContent key={tab} value={tab} className="flex-1 min-h-0 overflow-hidden mt-0 px-3 md:px-4">
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-2 pb-4">
                  {displayContacts.map(contact => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      onSelect={handleSelectContact}
                      onMarkContacted={handleMarkContacted}
                      onEdit={openEditDialog}
                      onEmail={handleOpenEmailTemplate}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}

          <TabsContent value="insights" className="flex-1 min-h-0 overflow-hidden mt-0 px-3 md:px-4">
            <ScrollArea className="h-full">
              <div className="pr-2 pb-4">
                <ContactNetworkHealth contacts={contacts} />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="timeline" className="flex-1 min-h-0 overflow-hidden mt-0 px-3 md:px-4">
            <ScrollArea className="h-full">
              <div className="pr-2 pb-4">
                <ContactTimeline contacts={contacts} />
              </div>
            </ScrollArea>
          </TabsContent>
        </PanelShell>
      </Tabs>

      {selectedContact && (
        <ContactProfileCard
          contact={selectedContact}
          open={!!selectedContact}
          onOpenChange={(open) => { if (!open) setSelectedContact(null); }}
          onMarkContacted={handleMarkContacted}
          onEdit={(contact) => { setSelectedContact(null); openEditDialog(contact); }}
          userId={userId}
        />
      )}

      <AlertDialog open={!!contactToDelete} onOpenChange={() => setContactToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contactToDelete?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {shareDialog && (
        <ShareDialog
          itemType="contact"
          itemId={shareDialog.id}
          itemTitle={shareDialog.name}
          onShare={(email, permission) => shareItem('contact', shareDialog.id, email, permission)}
          onGetSharedWith={() => getSharedWith('contact', shareDialog.id)}
          onRemoveShare={removeShare}
          onGetRecentContacts={getRecentContacts}
          onClose={() => setShareDialog(null)}
        />
      )}

      {emailTemplateContact && (
        <EmailTemplateDialog
          contact={emailTemplateContact}
          open={showEmailTemplate}
          onOpenChange={(open) => { setShowEmailTemplate(open); if (!open) setEmailTemplateContact(null); }}
        />
      )}
    </>
  );
}
