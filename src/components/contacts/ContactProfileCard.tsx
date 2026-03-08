import { useState, useEffect } from 'react';
import { Contact } from '@/hooks/useContacts';
import { useContactInteractions, ContactInteraction, InteractionType } from '@/hooks/useContactInteractions';
import { useContactAI, RelationshipInsights } from '@/hooks/useContactAI';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  Phone, Mail, Building, MapPin, Linkedin, Twitter, Globe, 
  Clock, MessageSquare, Calendar, Video, Sparkles, TrendingUp,
  AlertCircle, CheckCircle, Star, Heart
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface ContactProfileCardProps {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkContacted: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  userId?: string;
}

const INTERACTION_ICONS: Record<InteractionType, any> = {
  call: Phone,
  email: Mail,
  meeting: Video,
  message: MessageSquare,
  contact: CheckCircle,
};

export function ContactProfileCard({ 
  contact, 
  open, 
  onOpenChange,
  onMarkContacted,
  onEdit,
  userId
}: ContactProfileCardProps) {
  const { getInteractions, addInteraction, loading: interactionsLoading } = useContactInteractions(userId);
  const { getConversationStarters, getRelationshipInsights, loading: aiLoading } = useContactAI();
  
  const [interactions, setInteractions] = useState<ContactInteraction[]>([]);
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [insights, setInsights] = useState<RelationshipInsights | null>(null);
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (open && userId) {
      loadInteractions();
    }
  }, [open, contact.id, userId]);

  const loadInteractions = async () => {
    const data = await getInteractions(contact.id);
    setInteractions(data);
  };

  const handleLoadStarters = async () => {
    const starters = await getConversationStarters(contact);
    setConversationStarters(starters);
  };

  const handleLoadInsights = async () => {
    const data = await getRelationshipInsights(contact);
    setInsights(data);
  };

  const handleLogInteraction = async (type: InteractionType) => {
    if (!userId) return;
    await addInteraction(contact.id, type, newNote || undefined);
    setNewNote('');
    loadInteractions();
    onMarkContacted(contact);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                {contact.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {contact.company && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    {contact.company}
                    {contact.role && ` • ${contact.role}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="text-primary hover:underline text-sm flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {contact.email}
                  </a>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="ai">AI Insights</TabsTrigger>
            <TabsTrigger value="actions">Quick Actions</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="overview" className="mt-0 space-y-4">
              <GlassCard>
                <GlassCardHeader className="pb-2">
                  <GlassCardTitle className="text-sm">Contact Details</GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent className="space-y-2 text-sm">
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-primary">
                      <Phone className="w-4 h-4" />
                      {contact.phone}
                    </a>
                  )}
                  {(contact.city || contact.country) && (
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {[contact.city, contact.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-3 pt-2">
                    {contact.linkedinUrl && (
                      <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                        <Linkedin className="w-5 h-5" />
                      </a>
                    )}
                    {contact.twitterUrl && (
                      <a href={contact.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                        <Twitter className="w-5 h-5" />
                      </a>
                    )}
                    {contact.websiteUrl && (
                      <a href={contact.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                        <Globe className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </GlassCardContent>
              </GlassCard>

              {contact.tags.length > 0 && (
                <GlassCard>
                  <GlassCardHeader className="pb-2">
                    <GlassCardTitle className="text-sm">Tags</GlassCardTitle>
                  </GlassCardHeader>
                  <GlassCardContent>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </GlassCardContent>
                </GlassCard>
              )}

              {contact.notes && (
                <GlassCard>
                  <GlassCardHeader className="pb-2">
                    <GlassCardTitle className="text-sm">Notes</GlassCardTitle>
                  </GlassCardHeader>
                  <GlassCardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
                  </GlassCardContent>
                </GlassCard>
              )}

              <GlassCard>
                <GlassCardHeader className="pb-2">
                  <GlassCardTitle className="text-sm">Relationship Stats</GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Contact Frequency</p>
                    <p className="font-medium">Every {contact.contactFrequencyDays} days</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Contact</p>
                    <p className="font-medium">
                      {contact.lastContactedAt 
                        ? formatDistanceToNow(contact.lastContactedAt, { addSuffix: true })
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Next Due</p>
                    <p className="font-medium">
                      {contact.nextContactDue 
                        ? format(contact.nextContactDue, 'MMM d, yyyy')
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Interactions</p>
                    <p className="font-medium">{interactions.length}</p>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </TabsContent>

            <TabsContent value="history" className="mt-0 space-y-4">
              <GlassCard>
                <GlassCardHeader className="pb-2">
                  <GlassCardTitle className="text-sm">Log New Interaction</GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent className="space-y-3">
                  <Textarea
                    placeholder="Add notes about this interaction..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleLogInteraction('call')}>
                      <Phone className="w-4 h-4 mr-1" /> Call
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleLogInteraction('email')}>
                      <Mail className="w-4 h-4 mr-1" /> Email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleLogInteraction('meeting')}>
                      <Video className="w-4 h-4 mr-1" /> Meeting
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleLogInteraction('message')}>
                      <MessageSquare className="w-4 h-4 mr-1" /> Message
                    </Button>
                  </div>
                </GlassCardContent>
              </GlassCard>

              <GlassCard>
                <GlassCardHeader className="pb-2">
                  <GlassCardTitle className="text-sm">Interaction History</GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent>
                  {interactionsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : interactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {interactions.map((interaction) => {
                        const Icon = INTERACTION_ICONS[interaction.interactionType];
                        return (
                          <div key={interaction.id} className="flex items-start gap-3 text-sm">
                            <div className="p-2 rounded-full bg-primary/10">
                              <Icon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium capitalize">{interaction.interactionType}</p>
                              {interaction.notes && (
                                <p className="text-muted-foreground">{interaction.notes}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(interaction.interactionDate, 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCardContent>
              </GlassCard>
            </TabsContent>

            <TabsContent value="ai" className="mt-0 space-y-4">
              <GlassCard>
                <GlassCardHeader className="pb-2">
                  <GlassCardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Conversation Starters
                  </GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent>
                  {conversationStarters.length === 0 ? (
                    <Button variant="outline" onClick={handleLoadStarters} disabled={aiLoading}>
                      {aiLoading ? 'Generating...' : 'Generate Starters'}
                    </Button>
                  ) : (
                    <ul className="space-y-2">
                      {conversationStarters.map((starter, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                          {starter}
                        </li>
                      ))}
                    </ul>
                  )}
                </GlassCardContent>
              </GlassCard>

              <GlassCard>
                <GlassCardHeader className="pb-2">
                  <GlassCardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Relationship Insights
                  </GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent>
                  {!insights ? (
                    <Button variant="outline" onClick={handleLoadInsights} disabled={aiLoading}>
                      {aiLoading ? 'Analyzing...' : 'Analyze Relationship'}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Relationship Strength</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${insights.strengthScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{insights.strengthScore}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <AlertCircle className={`w-4 h-4 ${getRiskColor(insights.riskLevel)}`} />
                        <span className="text-sm">Risk Level: <span className="font-medium capitalize">{insights.riskLevel}</span></span>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Insights</p>
                        <ul className="space-y-1">
                          {insights.insights.map((insight, i) => (
                            <li key={i} className="text-sm text-muted-foreground">• {insight}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Recommendations</p>
                        <ul className="space-y-1">
                          {insights.recommendations.map((rec, i) => (
                            <li key={i} className="text-sm text-muted-foreground">• {rec}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Suggested Actions</p>
                        <div className="flex flex-wrap gap-2">
                          {insights.suggestedActions.map((action, i) => (
                            <Badge key={i} variant="outline">{action}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </GlassCardContent>
              </GlassCard>
            </TabsContent>

            <TabsContent value="actions" className="mt-0 space-y-4">
              <GlassCard>
                <GlassCardHeader className="pb-2">
                  <GlassCardTitle className="text-sm">Quick Actions</GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent className="space-y-2">
                  {contact.phone && (
                    <a 
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="p-2 rounded-full bg-green-500/10">
                        <Phone className="w-5 h-5 text-green-500" />
                      </div>
                      <span>Call {contact.name}</span>
                    </a>
                  )}
                  {contact.email && (
                    <a 
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="p-2 rounded-full bg-blue-500/10">
                        <Mail className="w-5 h-5 text-blue-500" />
                      </div>
                      <span>Email {contact.name}</span>
                    </a>
                  )}
                  {contact.phone && (
                    <a 
                      href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="p-2 rounded-full bg-emerald-500/10">
                        <MessageSquare className="w-5 h-5 text-emerald-500" />
                      </div>
                      <span>WhatsApp {contact.name}</span>
                    </a>
                  )}
                  <button 
                    onClick={() => { onMarkContacted(contact); onOpenChange(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="p-2 rounded-full bg-primary/10">
                      <CheckCircle className="w-5 h-5 text-primary" />
                    </div>
                    <span>Mark as Contacted</span>
                  </button>
                  <button 
                    onClick={() => { onEdit(contact); onOpenChange(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="p-2 rounded-full bg-orange-500/10">
                      <Calendar className="w-5 h-5 text-orange-500" />
                    </div>
                    <span>Edit Contact</span>
                  </button>
                </GlassCardContent>
              </GlassCard>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
