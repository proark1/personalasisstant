import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useContacts, Contact, ContactType, ContactInput, PersonalTier, BusinessLevel, DEFAULT_FREQUENCIES } from '@/hooks/useContacts';
import { useContactInteractions } from '@/hooks/useContactInteractions';
import { useSmartContactReminders } from '@/hooks/useSmartContactReminders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ContactProfileCard } from '@/components/contacts/ContactProfileCard';
import { ContactNetworkHealth } from '@/components/contacts/ContactNetworkHealth';
import { ContactTimeline } from '@/components/contacts/ContactTimeline';
import { ContactImportExport } from '@/components/contacts/ContactImportExport';
import { EmailTemplateDialog } from '@/components/contacts/EmailTemplateDialog';
import { 
  ArrowLeft, UserPlus, Trash2, Search, Users, Briefcase, Heart, 
  Phone, Mail, Building, Clock, Bell, MessageSquare, Check, Pencil,
  AlertCircle, Linkedin, Twitter, Globe, MapPin, LayoutGrid, List,
  TrendingUp, Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, isPast } from 'date-fns';

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
  contactFrequencyDays: number;
  notes: string;
  tags: string;
  linkedinUrl: string;
  twitterUrl: string;
  websiteUrl: string;
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
  contactFrequencyDays: 30,
  notes: '',
  tags: '',
  linkedinUrl: '',
  twitterUrl: '',
  websiteUrl: '',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getTierBadge(contact: Contact) {
  if (contact.contactType === 'personal' && contact.personalTier) {
    const tier = PERSONAL_TIERS.find(t => t.value === contact.personalTier);
    return tier ? <Badge className={`${tier.color} text-white whitespace-nowrap text-xs`}>{tier.label}</Badge> : null;
  }
  if (contact.contactType === 'business' && contact.businessLevel) {
    const level = BUSINESS_LEVELS.find(l => l.value === contact.businessLevel);
    return level ? <Badge className={`${level.color} text-white whitespace-nowrap text-xs`}>{level.label}</Badge> : null;
  }
  return null;
}

interface ContactCardProps {
  contact: Contact;
  onSelect: (contact: Contact) => void;
  onMarkContacted: (contact: Contact) => void;
  onEmailTemplate: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

const ContactCard = memo(function ContactCard({ contact, onSelect, onMarkContacted, onEmailTemplate, onEdit, onDelete }: ContactCardProps) {
  const isDue = contact.nextContactDue && isPast(contact.nextContactDue);

  return (
    <GlassCard
      pressable
      haptic="light"
      className={`transition-colors ${isDue ? 'border-destructive/50' : ''}`}
      onClick={() => onSelect(contact)}
    >
      <GlassCardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar className="shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium truncate">{contact.name}</p>
                {getTierBadge(contact)}
                {isDue && (
                  <Badge variant="outline" className="text-orange-500 border-orange-500">
                    <Bell className="w-3 h-3 mr-1" />
                    Due
                  </Badge>
                )}
              </div>

              <div className="text-sm text-muted-foreground space-y-1 mt-1">
                {contact.email && (
                  <p className="flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 shrink-0" />
                    {contact.email}
                  </p>
                )}
                {contact.phone && (
                  <p className="flex items-center gap-1">
                    <Phone className="w-3 h-3 shrink-0" />
                    {contact.phone}
                  </p>
                )}
                {contact.company && (
                  <p className="flex items-center gap-1 truncate">
                    <Building className="w-3 h-3 shrink-0" />
                    {contact.company}{contact.role && ` • ${contact.role}`}
                  </p>
                )}
                {(contact.city || contact.country) && (
                  <p className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {[contact.city, contact.country].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              {/* Social Links */}
              {(contact.linkedinUrl || contact.twitterUrl || contact.websiteUrl) && (
                <div className="flex items-center gap-2 mt-2">
                  {contact.linkedinUrl && (
                    <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
                       className="text-muted-foreground hover:text-primary transition-colors"
                       onClick={(e) => e.stopPropagation()}>
                      <Linkedin className="w-4 h-4" />
                    </a>
                  )}
                  {contact.twitterUrl && (
                    <a href={contact.twitterUrl} target="_blank" rel="noopener noreferrer"
                       className="text-muted-foreground hover:text-primary transition-colors"
                       onClick={(e) => e.stopPropagation()}>
                      <Twitter className="w-4 h-4" />
                    </a>
                  )}
                  {contact.websiteUrl && (
                    <a href={contact.websiteUrl} target="_blank" rel="noopener noreferrer"
                       className="text-muted-foreground hover:text-primary transition-colors"
                       onClick={(e) => e.stopPropagation()}>
                      <Globe className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}

              {contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {contact.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {contact.notes && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  <MessageSquare className="w-3 h-3 inline mr-1" />
                  {contact.notes}
                </p>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Every {contact.contactFrequencyDays}d
                </span>
                {contact.lastContactedAt && (
                  <span>
                    Last: {formatDistanceToNow(contact.lastContactedAt, { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onMarkContacted(contact); }}
              className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
              title="Mark as contacted"
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onEmailTemplate(contact); }}
              className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
              title="Email template"
            >
              <Mail className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onEdit(contact); }}
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onDelete(contact); }}
              className="text-destructive hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
});

interface ContactTableProps {
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
  onMarkContacted: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

const ContactTable = memo(function ContactTable({ contacts, onSelect, onMarkContacted, onDelete }: ContactTableProps) {
  if (contacts.length === 0) {
    return (
      <EmptyState icon={Users} title="No contacts found" description="Try a different search term" />
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Company / Role</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            const isDue = contact.nextContactDue && isPast(contact.nextContactDue);
            return (
              <TableRow
                key={contact.id}
                className="cursor-pointer"
                onClick={() => onSelect(contact)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium">{contact.name}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {getTierBadge(contact)}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {contact.company && <p>{contact.company}</p>}
                    {contact.role && <p className="text-muted-foreground">{contact.role}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {[contact.city, contact.country].filter(Boolean).join(', ') || '-'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{contact.email || '-'}</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.slice(0, 2).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {contact.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{contact.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {isDue ? (
                    <Badge variant="outline" className="text-orange-500 border-orange-500">
                      <Bell className="w-3 h-3 mr-1" />
                      Due
                    </Badge>
                  ) : contact.lastContactedAt ? (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(contact.lastContactedAt, { addSuffix: true })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-500 hover:text-green-600"
                      onClick={(e) => { e.stopPropagation(); onMarkContacted(contact); }}
                      title="Mark as contacted"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete(contact); }}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});

export default function Contacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
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
  } = useContacts(user?.id);

  const { getRecentContacts } = useContactInteractions(user?.id);
  const { syncToCalendar } = useSmartContactReminders({ contacts, userId: user?.id });

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(defaultFormData);
  const [activeTab, setActiveTab] = useState<'personal' | 'business' | 'due' | 'insights' | 'timeline'>('personal');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);
  const [emailTemplateContact, setEmailTemplateContact] = useState<Contact | null>(null);
  const [recentContactIds, setRecentContactIds] = useState<string[]>([]);

  // Load recent contacts on mount
  useEffect(() => {
    if (user?.id) {
      getRecentContacts(5).then(setRecentContactIds);
    }
  }, [user?.id, getRecentContacts]);

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
      contactFrequencyDays: contact.contactFrequencyDays,
      notes: contact.notes || '',
      tags: contact.tags.join(', '),
      linkedinUrl: contact.linkedinUrl || '',
      twitterUrl: contact.twitterUrl || '',
      websiteUrl: contact.websiteUrl || '',
    });
    setShowAddDialog(true);
  }, []);

  const handleSubmit = async () => {
    if (saving) return;

    if (!formData.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
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
          contactFrequencyDays: formData.contactFrequencyDays,
          notes: formData.notes || undefined,
          tags,
          linkedinUrl: formData.linkedinUrl || undefined,
          twitterUrl: formData.twitterUrl || undefined,
          websiteUrl: formData.websiteUrl || undefined,
        });

        if (success) {
          toast({ title: 'Contact updated' });
          setShowAddDialog(false);
          resetForm();
        } else {
          toast({
            title: 'Update failed',
            description: 'Please try again in a moment.',
            variant: 'destructive',
          });
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
          contactFrequencyDays: formData.contactFrequencyDays,
          notes: formData.notes || undefined,
          tags,
          linkedinUrl: formData.linkedinUrl || undefined,
          twitterUrl: formData.twitterUrl || undefined,
          websiteUrl: formData.websiteUrl || undefined,
        });

        if (result) {
          toast({ title: 'Contact added' });
          setShowAddDialog(false);
          resetForm();
        } else {
          toast({
            title: 'Add failed',
            description: 'Please try again in a moment.',
            variant: 'destructive',
          });
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
      toast({ title: 'Contact deleted' });
    }
    setContactToDelete(null);
  };

  const handleMarkContacted = useCallback(async (contact: Contact) => {
    const success = await markContacted(contact.id);
    if (success) {
      toast({ title: `Marked ${contact.name} as contacted` });
    }
  }, [markContacted, toast]);

  const handleImportContacts = async (contactsToImport: ContactInput[]) => {
    let imported = 0;
    for (const c of contactsToImport) {
      const result = await addContact(c);
      if (result) imported++;
    }
    toast({ title: `Imported ${imported} contacts` });
  };

  const handleOpenEmailTemplate = useCallback((contact: Contact) => {
    setEmailTemplateContact(contact);
    setShowEmailTemplate(true);
  }, []);

  const recentContacts = contacts.filter(c => recentContactIds.includes(c.id));

  const filterContacts = (contactList: Contact[]) => {
    if (!searchQuery) return contactList;
    const query = searchQuery.toLowerCase();
    return contactList.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.company?.toLowerCase().includes(query) ||
      c.country?.toLowerCase().includes(query) ||
      c.city?.toLowerCase().includes(query) ||
      c.notes?.toLowerCase().includes(query) ||
      c.tags.some(t => t.toLowerCase().includes(query))
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          
          <div className="flex items-center gap-2">
            <ContactImportExport contacts={contacts} onImport={handleImportContacts} />
            <Button 
              variant="outline" 
              size="sm"
              onClick={syncToCalendar}
              title="Sync upcoming contacts to calendar"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Sync Calendar
            </Button>
            <Dialog open={showAddDialog} onOpenChange={(open) => {
              setShowAddDialog(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingContact ? 'Edit Contact' : 'Add New Contact'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="John Doe"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                      placeholder="john@example.com"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 234 567 890"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input
                      value={formData.company}
                      onChange={(e) => setFormData(p => ({ ...p, company: e.target.value }))}
                      placeholder="Acme Inc."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input
                      value={formData.role}
                      onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))}
                      placeholder="CEO, Investor, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                      placeholder="Munich, Berlin, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      value={formData.country}
                      onChange={(e) => setFormData(p => ({ ...p, country: e.target.value }))}
                      placeholder="Germany, USA, etc."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Contact Type</Label>
                  <Select
                    value={formData.contactType}
                    onValueChange={(v: ContactType) => setFormData(p => ({ 
                      ...p, 
                      contactType: v,
                      personalTier: '',
                      businessLevel: '',
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4" />
                          Personal
                        </div>
                      </SelectItem>
                      <SelectItem value="business">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4" />
                          Business / Network
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.contactType === 'personal' && (
                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <Select
                      value={formData.personalTier}
                      onValueChange={(v: PersonalTier) => setFormData(p => ({ 
                        ...p, 
                        personalTier: v,
                        contactFrequencyDays: DEFAULT_FREQUENCIES[v],
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PERSONAL_TIERS.map(tier => (
                          <SelectItem key={tier.value} value={tier.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${tier.color}`} />
                              {tier.label}
                              <span className="text-muted-foreground text-xs">
                                (~{DEFAULT_FREQUENCIES[tier.value]}d)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.contactType === 'business' && (
                  <div className="space-y-2">
                    <Label>How well do you know them?</Label>
                    <Select
                      value={formData.businessLevel}
                      onValueChange={(v: BusinessLevel) => setFormData(p => ({ 
                        ...p, 
                        businessLevel: v,
                        contactFrequencyDays: DEFAULT_FREQUENCIES[v],
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select level..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_LEVELS.map(level => (
                          <SelectItem key={level.value} value={level.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${level.color}`} />
                              {level.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Contact Frequency (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.contactFrequencyDays}
                    onChange={(e) => setFormData(p => ({ ...p, contactFrequencyDays: parseInt(e.target.value) || 30 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    How often should you reach out to this person?
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input
                    value={formData.tags}
                    onChange={(e) => setFormData(p => ({ ...p, tags: e.target.value }))}
                    placeholder="investor, tech, mentor, etc."
                  />
                  <p className="text-xs text-muted-foreground">
                    Add tags to help AI find relevant contacts (e.g., "investor", "developer")
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Any important details, connections, expertise..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    AI will use these notes to suggest this contact when relevant
                  </p>
                </div>

                {/* Social Links Section */}
                <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                  <Label className="text-sm font-medium">Social Links</Label>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-2">
                      <Linkedin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Input
                        value={formData.linkedinUrl}
                        onChange={(e) => setFormData(p => ({ ...p, linkedinUrl: e.target.value }))}
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Twitter className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Input
                        value={formData.twitterUrl}
                        onChange={(e) => setFormData(p => ({ ...p, twitterUrl: e.target.value }))}
                        placeholder="https://twitter.com/..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Input
                        value={formData.websiteUrl}
                        onChange={(e) => setFormData(p => ({ ...p, websiteUrl: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSubmit} className="w-full" disabled={saving}>
                  {saving ? 'Saving…' : editingContact ? 'Update Contact' : 'Add Contact'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        <GlassCard className="mb-6">
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Contact Relationship Manager
            </GlassCardTitle>
            <p className="text-sm text-muted-foreground">
              Manage your personal and business network with smart follow-up reminders
            </p>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, company, tags, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </GlassCardContent>
        </GlassCard>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <TabsList className="grid grid-cols-5">
              <TabsTrigger value="personal" className="gap-1 text-xs sm:text-sm">
                <Heart className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Personal</span> ({personalContacts.length})
              </TabsTrigger>
              <TabsTrigger value="business" className="gap-1 text-xs sm:text-sm">
                <Briefcase className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Business</span> ({businessContacts.length})
              </TabsTrigger>
              <TabsTrigger value="due" className="gap-1 text-xs sm:text-sm">
                <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Due</span> ({contactsDue.length})
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-1 text-xs sm:text-sm">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Insights</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1 text-xs sm:text-sm">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
            </TabsList>

            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'cards' | 'table')}>
              <ToggleGroupItem value="cards" aria-label="Card view">
                <LayoutGrid className="w-4 h-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view">
                <List className="w-4 h-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading contacts...
            </div>
          ) : (
            <>
              <TabsContent value="personal">
                {viewMode === 'cards' ? (
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pr-4">
                      {filterContacts(personalContacts).length === 0 ? (
                        <div className="col-span-full">
                          <EmptyState icon={Heart} title="No personal contacts" description="Add family, friends, or acquaintances" />
                        </div>
                      ) : (
                        filterContacts(personalContacts).map(contact => (
                          <ContactCard
                            key={contact.id}
                            contact={contact}
                            onSelect={setSelectedContact}
                            onMarkContacted={handleMarkContacted}
                            onEmailTemplate={handleOpenEmailTemplate}
                            onEdit={openEditDialog}
                            onDelete={setContactToDelete}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <ContactTable
                    contacts={filterContacts(personalContacts)}
                    onSelect={setSelectedContact}
                    onMarkContacted={handleMarkContacted}
                    onDelete={setContactToDelete}
                  />
                )}
              </TabsContent>

              <TabsContent value="business">
                {viewMode === 'cards' ? (
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pr-4">
                      {filterContacts(businessContacts).length === 0 ? (
                        <div className="col-span-full">
                          <EmptyState icon={Briefcase} title="No business contacts" description="Build your professional network" />
                        </div>
                      ) : (
                        filterContacts(businessContacts).map(contact => (
                          <ContactCard
                            key={contact.id}
                            contact={contact}
                            onSelect={setSelectedContact}
                            onMarkContacted={handleMarkContacted}
                            onEmailTemplate={handleOpenEmailTemplate}
                            onEdit={openEditDialog}
                            onDelete={setContactToDelete}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <ContactTable
                    contacts={filterContacts(businessContacts)}
                    onSelect={setSelectedContact}
                    onMarkContacted={handleMarkContacted}
                    onDelete={setContactToDelete}
                  />
                )}
              </TabsContent>

              <TabsContent value="due">
                {viewMode === 'cards' ? (
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pr-4">
                      {contactsDue.length === 0 ? (
                        <div className="col-span-full">
                          <EmptyState icon={Bell} title="All caught up! 🎉" description="No contacts due for follow-up" />
                        </div>
                      ) : (
                        contactsDue.map(contact => (
                          <ContactCard
                            key={contact.id}
                            contact={contact}
                            onSelect={setSelectedContact}
                            onMarkContacted={handleMarkContacted}
                            onEmailTemplate={handleOpenEmailTemplate}
                            onEdit={openEditDialog}
                            onDelete={setContactToDelete}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <ContactTable
                    contacts={contactsDue}
                    onSelect={setSelectedContact}
                    onMarkContacted={handleMarkContacted}
                    onDelete={setContactToDelete}
                  />
                )}
              </TabsContent>

              <TabsContent value="insights">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ContactNetworkHealth contacts={contacts} />
                  
                  {/* Recent Contacts */}
                  {recentContacts.length > 0 && (
                    <GlassCard>
                      <GlassCardHeader className="pb-2">
                        <GlassCardTitle className="text-lg flex items-center gap-2">
                          <Clock className="w-5 h-5" />
                          Recently Contacted
                        </GlassCardTitle>
                      </GlassCardHeader>
                      <GlassCardContent>
                        <div className="space-y-2">
                          {recentContacts.map(contact => (
                            <div 
                              key={contact.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                              onClick={() => setSelectedContact(contact)}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {getInitials(contact.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{contact.name}</p>
                                {contact.company && (
                                  <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </GlassCardContent>
                    </GlassCard>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="timeline">
                <ContactTimeline contacts={contacts} showUpcoming />
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Contact Profile Card */}
        {selectedContact && (
          <ContactProfileCard
            contact={selectedContact}
            open={!!selectedContact}
            onOpenChange={(open) => !open && setSelectedContact(null)}
            onMarkContacted={handleMarkContacted}
            onEdit={openEditDialog}
            userId={user?.id}
          />
        )}

        {/* Email Template Dialog */}
        {emailTemplateContact && (
          <EmailTemplateDialog
            contact={emailTemplateContact}
            open={showEmailTemplate}
            onOpenChange={(open) => {
              setShowEmailTemplate(open);
              if (!open) setEmailTemplateContact(null);
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!contactToDelete} onOpenChange={(open) => !open && setContactToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {contactToDelete?.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
