import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { PanelShell, staggerContainer, staggerItem } from '@/components/ui/panel-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Briefcase, Gamepad, Brain, TrendingUp, Users, DollarSign, BarChart3,
  Plus, MoreVertical, Pencil, Archive, Lightbulb, Trash2, Tag, ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { useStartupWorkspaces, StartupWorkspace, StartupMetric } from '@/hooks/useStartupWorkspaces';
import { useStartupIdeas, StartupIdea, StartupIdeaInput } from '@/hooks/useStartupIdeas';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const WORKSPACE_ICONS: Record<string, React.ReactNode> = {
  gaming: <Gamepad className="w-5 h-5" />,
  ai: <Brain className="w-5 h-5" />,
  agency: <TrendingUp className="w-5 h-5" />,
  custom: <Briefcase className="w-5 h-5" />,
};

const WORKSPACE_TYPES = [
  { value: 'gaming', label: 'Gaming', icon: Gamepad },
  { value: 'ai', label: 'AI / Tech', icon: Brain },
  { value: 'agency', label: 'Agency', icon: TrendingUp },
  { value: 'custom', label: 'Custom', icon: Briefcase },
];

const STATUS_COLORS: Record<string, string> = {
  brainstorming: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  researching: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  validating: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  building: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  launched: 'bg-green-500/15 text-green-600 dark:text-green-400',
  archived: 'bg-muted text-muted-foreground',
};

const PRESET_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#f97316', '#ec4899', '#6366f1'];

const METRIC_PRESETS = [
  { value: 'mrr', label: 'MRR' },
  { value: 'arr', label: 'ARR' },
  { value: 'team_size', label: 'Team Size' },
  { value: 'users', label: 'Users' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'growth_rate', label: 'Growth Rate (%)' },
  { value: 'churn_rate', label: 'Churn Rate (%)' },
  { value: 'burn_rate', label: 'Burn Rate' },
  { value: 'runway_months', label: 'Runway (months)' },
  { value: 'custom', label: 'Custom...' },
];

const IDEA_STATUSES: StartupIdea['status'][] = ['brainstorming', 'researching', 'validating', 'building', 'launched', 'archived'];

// ─── Workspace Dialog ───────────────────────────────────────────────

function WorkspaceDialog({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<StartupWorkspace>;
  onSave: (data: { name: string; workspace_type: string; color: string; icon: string; description?: string }) => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.workspace_type || 'custom');
  const [color, setColor] = useState(initial?.color || PRESET_COLORS[0]);
  const [desc, setDesc] = useState(initial?.description || '');
  const isEdit = !!initial?.id;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), workspace_type: type, color, icon: type, description: desc || undefined });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Workspace' : 'New Workspace'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update workspace details.' : 'Create a new startup workspace.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Startup" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WORKSPACE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-1">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  className={cn('w-7 h-7 rounded-full border-2 transition-transform', color === c ? 'border-foreground scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this workspace about?" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>{isEdit ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Metric Dialog ──────────────────────────────────────────────────

function MetricDialog({
  open, onOpenChange, workspaceId, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  onSave: (data: { workspace_id: string; metric_name: string; metric_value: number; metric_date: string; notes?: string }) => void;
}) {
  const [preset, setPreset] = useState('mrr');
  const [customName, setCustomName] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const metricName = preset === 'custom' ? customName : preset;

  const handleSave = () => {
    if (!metricName.trim() || !value) return;
    onSave({ workspace_id: workspaceId, metric_name: metricName, metric_value: Number(value), metric_date: date, notes: notes || undefined });
    onOpenChange(false);
    setPreset('mrr');
    setCustomName('');
    setValue('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Metric</DialogTitle>
          <DialogDescription>Track a key metric for this workspace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Metric</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRIC_PRESETS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' && (
            <div>
              <Label>Custom Name</Label>
              <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. NPS Score" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Value</Label>
              <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!metricName.trim() || !value}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Idea Dialog ────────────────────────────────────────────────────

function IdeaDialog({
  open, onOpenChange, initial, workspaceId, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<StartupIdea>;
  workspaceId: string;
  onSave: (data: Partial<StartupIdeaInput>) => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [desc, setDesc] = useState(initial?.description || '');
  const [problem, setProblem] = useState(initial?.problem_statement || '');
  const [audience, setAudience] = useState(initial?.target_audience || '');
  const [uvp, setUvp] = useState(initial?.unique_value_proposition || '');
  const [status, setStatus] = useState<StartupIdea['status']>(initial?.status || 'brainstorming');
  const [tagsStr, setTagsStr] = useState((initial?.tags || []).join(', '));
  const isEdit = !!initial?.id;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: desc || undefined,
      problem_statement: problem || undefined,
      target_audience: audience || undefined,
      unique_value_proposition: uvp || undefined,
      status,
      tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
      workspace_id: workspaceId,
      key_features: initial?.key_features || [],
      ai_insights: initial?.ai_insights || {},
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Idea' : 'New Startup Idea'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Refine your startup idea.' : 'Capture a new startup idea.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="SaaS for X" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What does it do?" rows={2} />
          </div>
          <div>
            <Label>Problem Statement</Label>
            <Textarea value={problem} onChange={e => setProblem(e.target.value)} placeholder="What problem does it solve?" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target Audience</Label>
              <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="SMBs, developers..." />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as StartupIdea['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IDEA_STATUSES.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Unique Value Proposition</Label>
            <Input value={uvp} onChange={e => setUvp(e.target.value)} placeholder="Why is this better?" />
          </div>
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="ai, saas, b2b" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>{isEdit ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Idea Detail View ───────────────────────────────────────────────

function IdeaDetailView({
  idea, onBack, onEdit, onDelete, onStatusChange,
}: {
  idea: StartupIdea;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: StartupIdea['status']) => void;
}) {
  const fields = [
    { label: 'Description', value: idea.description },
    { label: 'Problem Statement', value: idea.problem_statement },
    { label: 'Target Audience', value: idea.target_audience },
    { label: 'Unique Value Proposition', value: idea.unique_value_proposition },
    { label: 'Business Model', value: idea.business_model },
    { label: 'Competitive Advantage', value: idea.competitive_advantage },
    { label: 'Notes', value: idea.notes },
  ].filter(f => f.value);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4 p-3 md:p-4">
      <motion.div variants={staggerItem} className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <h3 className="text-lg font-semibold flex-1 truncate">{idea.name}</h3>
        <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
        <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center gap-2 flex-wrap">
        <Select value={idea.status} onValueChange={v => onStatusChange(v as StartupIdea['status'])}>
          <SelectTrigger className="w-auto h-8">
            <Badge className={cn('text-xs', STATUS_COLORS[idea.status])}>{idea.status}</Badge>
          </SelectTrigger>
          <SelectContent>
            {IDEA_STATUSES.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {idea.tags.map(tag => (
          <Badge key={tag} variant="outline" className="text-xs gap-1"><Tag className="w-3 h-3" />{tag}</Badge>
        ))}
      </motion.div>

      {fields.map(f => (
        <motion.div key={f.label} variants={staggerItem}>
          <GlassCard className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">{f.label}</p>
            <p className="text-sm">{f.value}</p>
          </GlassCard>
        </motion.div>
      ))}

      {idea.key_features.length > 0 && (
        <motion.div variants={staggerItem}>
          <GlassCard className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Key Features</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {idea.key_features.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────

export function StartupWorkspacePanel() {
  const _isMobile = useIsMobile();
  const {
    workspaces, activeWorkspace, setActiveWorkspace, loading,
    addWorkspace, updateWorkspace, deleteWorkspace,
    addMetric, getWorkspaceMetrics, getLatestMetric, metrics,
  } = useStartupWorkspaces();
  const {
    createIdea, updateIdea, deleteIdea, getIdeasForWorkspace,
  } = useStartupIdeas();

  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [editingWs, setEditingWs] = useState<StartupWorkspace | null>(null);
  const [archiveWs, setArchiveWs] = useState<string | null>(null);
  const [metricDialogOpen, setMetricDialogOpen] = useState(false);
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<StartupIdea | null>(null);
  const [viewingIdea, setViewingIdea] = useState<StartupIdea | null>(null);
  const [deleteIdeaId, setDeleteIdeaId] = useState<string | null>(null);

  const currentWorkspace = workspaces.find(w => w.id === activeWorkspace);
  const workspaceIdeas = activeWorkspace ? getIdeasForWorkspace(activeWorkspace) : [];
  const workspaceMetrics = activeWorkspace ? getWorkspaceMetrics(activeWorkspace) : [];

  // Live stats
  const mrrMetric = activeWorkspace ? getLatestMetric(activeWorkspace, 'mrr') : undefined;
  const teamMetric = activeWorkspace ? getLatestMetric(activeWorkspace, 'team_size') : undefined;

  const growthPct = useMemo(() => {
    if (!activeWorkspace) return null;
    const mrrAll = metrics
      .filter(m => m.workspace_id === activeWorkspace && m.metric_name === 'mrr')
      .sort((a, b) => new Date(b.metric_date).getTime() - new Date(a.metric_date).getTime());
    if (mrrAll.length < 2) return null;
    const prev = mrrAll[1].metric_value;
    if (prev === 0) return null;
    return ((mrrAll[0].metric_value - prev) / prev * 100).toFixed(1);
  }, [activeWorkspace, metrics]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleAddWorkspace = async (data: Omit<StartupWorkspace, 'id' | 'created_at' | 'is_active'>) => {
    await addWorkspace(data);
  };

  const handleEditWorkspace = async (data: Omit<StartupWorkspace, 'id' | 'created_at' | 'is_active'>) => {
    if (!editingWs) return;
    await updateWorkspace(editingWs.id, data);
    setEditingWs(null);
  };

  const handleArchiveWorkspace = async () => {
    if (!archiveWs) return;
    await deleteWorkspace(archiveWs);
    setArchiveWs(null);
  };

  const handleAddMetric = async (data: Omit<StartupMetric, 'id' | 'created_at'>) => {
    await addMetric(data);
  };

  const handleSaveIdea = async (data: Partial<StartupIdeaInput>) => {
    if (editingIdea) {
      await updateIdea(editingIdea.id, data);
      setEditingIdea(null);
      if (viewingIdea?.id === editingIdea.id) {
        setViewingIdea({ ...viewingIdea, ...data } as StartupIdea);
      }
    } else {
      await createIdea(data);
    }
  };

  const handleDeleteIdea = async () => {
    if (!deleteIdeaId) return;
    await deleteIdea(deleteIdeaId);
    if (viewingIdea?.id === deleteIdeaId) setViewingIdea(null);
    setDeleteIdeaId(null);
  };

  // ─── Workspace tabs (horizontal scroll) ─────────────────────────

  const workspaceTabs = (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {workspaces.map(ws => (
        <Button
          key={ws.id}
          variant={activeWorkspace === ws.id ? 'secondary' : 'ghost'}
          size="sm"
          className={cn('gap-2 shrink-0', activeWorkspace === ws.id && 'shadow-sm')}
          onClick={() => { setActiveWorkspace(ws.id); setViewingIdea(null); }}
        >
          <span style={{ color: ws.color }}>
            {WORKSPACE_ICONS[ws.workspace_type] || WORKSPACE_ICONS.custom}
          </span>
          {ws.name}
        </Button>
      ))}
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <>
      <PanelShell
        icon={Briefcase}
        title="Startup Workspaces"
        loading={loading}
        loadingVariant="cards"
        headerExtra={workspaceTabs}
        noPadding
        empty={!currentWorkspace && !loading}
        emptyIcon={Briefcase}
        emptyTitle="No workspaces"
        emptyDescription="Create a workspace to start tracking your startups."
        emptyAction={<Button size="sm" onClick={() => setWsDialogOpen(true)}><Plus className="w-4 h-4 mr-1" />New Workspace</Button>}
        actions={
          <Button variant="ghost" size="icon" onClick={() => setWsDialogOpen(true)} title="New Workspace">
            <Plus className="w-4 h-4" />
          </Button>
        }
      >
        {currentWorkspace && !viewingIdea && (
          <Tabs defaultValue="overview" className="flex-1 flex flex-col">
            <TabsList className="mx-3 mt-2 sm:mx-4 sm:mt-3 w-fit">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ideas" className="gap-1"><Lightbulb className="w-3 h-3" />Ideas</TabsTrigger>
              <TabsTrigger value="metrics" className="gap-1"><BarChart3 className="w-3 h-3" />Metrics</TabsTrigger>
            </TabsList>

            {/* ─── Overview Tab ──────────────────────────────── */}
            <TabsContent value="overview" className="flex-1 overflow-y-auto">
              <ScrollArea className="flex-1">
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="p-3 md:p-4 space-y-4">
                  {/* Header with actions */}
                  <motion.div variants={staggerItem} className="flex items-center gap-3">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: currentWorkspace.color + '20' }}>
                      <span style={{ color: currentWorkspace.color }}>
                        {WORKSPACE_ICONS[currentWorkspace.workspace_type] || WORKSPACE_ICONS.custom}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold truncate">{currentWorkspace.name}</h3>
                      {currentWorkspace.description && (
                        <p className="text-sm text-muted-foreground truncate">{currentWorkspace.description}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingWs(currentWorkspace)}>
                          <Pencil className="w-4 h-4 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setArchiveWs(currentWorkspace.id)}>
                          <Archive className="w-4 h-4 mr-2" />Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>

                  {/* Stats */}
                  <motion.div variants={staggerItem} className="grid grid-cols-3 gap-3">
                    <GlassCard pressable haptic="light" className="p-4 text-center" onClick={() => setMetricDialogOpen(true)}>
                      <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                      <p className="text-2xl font-bold">{teamMetric ? teamMetric.metric_value : '—'}</p>
                      <p className="text-xs text-muted-foreground">Team Size</p>
                    </GlassCard>
                    <GlassCard pressable haptic="light" className="p-4 text-center" onClick={() => setMetricDialogOpen(true)}>
                      <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-500" />
                      <p className="text-2xl font-bold">{mrrMetric ? `$${mrrMetric.metric_value.toLocaleString()}` : '—'}</p>
                      <p className="text-xs text-muted-foreground">MRR</p>
                    </GlassCard>
                    <GlassCard pressable haptic="light" className="p-4 text-center" onClick={() => setMetricDialogOpen(true)}>
                      <BarChart3 className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                      <p className={cn('text-2xl font-bold', growthPct && Number(growthPct) >= 0 ? 'text-primary' : growthPct ? 'text-destructive' : '')}>
                        {growthPct ? `${growthPct}%` : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">Growth</p>
                    </GlassCard>
                  </motion.div>

                  {/* Quick summary */}
                  <motion.div variants={staggerItem}>
                    <GlassCard className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium flex items-center gap-2"><Lightbulb className="w-4 h-4" />Ideas</h4>
                        <Badge variant="secondary">{workspaceIdeas.length}</Badge>
                      </div>
                      {workspaceIdeas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No ideas yet — switch to the Ideas tab to add one.</p>
                      ) : (
                        <div className="space-y-2">
                          {workspaceIdeas.slice(0, 3).map(idea => (
                            <div key={idea.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
                              onClick={() => setViewingIdea(idea)}
                            >
                              <span className="text-sm truncate flex-1">{idea.name}</span>
                              <Badge className={cn('text-[10px] ml-2', STATUS_COLORS[idea.status])}>{idea.status}</Badge>
                              <ChevronRight className="w-3 h-3 ml-1 text-muted-foreground" />
                            </div>
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  </motion.div>

                  {/* Recent metrics */}
                  <motion.div variants={staggerItem}>
                    <GlassCard className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium flex items-center gap-2"><BarChart3 className="w-4 h-4" />Recent Metrics</h4>
                        <Button variant="ghost" size="sm" onClick={() => setMetricDialogOpen(true)}><Plus className="w-3 h-3 mr-1" />Add</Button>
                      </div>
                      {workspaceMetrics.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">Tap a stat card or click Add to track metrics.</p>
                      ) : (
                        <div className="space-y-2">
                          {workspaceMetrics.slice(0, 5).map(m => (
                            <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                              <span className="text-sm capitalize">{m.metric_name.replace(/_/g, ' ')}</span>
                              <div className="text-right">
                                <Badge variant="outline">{m.metric_value}</Badge>
                                <p className="text-[10px] text-muted-foreground">{new Date(m.metric_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  </motion.div>
                </motion.div>
              </ScrollArea>
            </TabsContent>

            {/* ─── Ideas Tab ─────────────────────────────────── */}
            <TabsContent value="ideas" className="flex-1 overflow-y-auto">
              <ScrollArea className="flex-1">
                <div className="p-3 md:p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Startup Ideas</h4>
                    <Button size="sm" onClick={() => { setEditingIdea(null); setIdeaDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-1" />New Idea
                    </Button>
                  </div>

                  {workspaceIdeas.length === 0 ? (
                    <EmptyState
                      icon={Lightbulb}
                      title="No ideas yet"
                      description="Capture your startup ideas here — brainstorm, validate, and track progress."
                      action={<Button size="sm" onClick={() => { setEditingIdea(null); setIdeaDialogOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add Idea</Button>}
                    />
                  ) : (
                    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
                      {workspaceIdeas.map(idea => (
                        <motion.div key={idea.id} variants={staggerItem}>
                          <GlassCard
                            pressable
                            haptic="light"
                            className="p-4"
                            onClick={() => setViewingIdea(idea)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{idea.name}</p>
                                {idea.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{idea.description}</p>
                                )}
                              </div>
                              <Badge className={cn('text-[10px] shrink-0', STATUS_COLORS[idea.status])}>{idea.status}</Badge>
                            </div>
                            {idea.tags.length > 0 && (
                              <div className="flex gap-1 mt-2 flex-wrap">
                                {idea.tags.slice(0, 4).map(tag => (
                                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                                ))}
                              </div>
                            )}
                          </GlassCard>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ─── Metrics Tab ───────────────────────────────── */}
            <TabsContent value="metrics" className="flex-1 overflow-y-auto">
              <ScrollArea className="flex-1">
                <div className="p-3 md:p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">All Metrics</h4>
                    <Button size="sm" onClick={() => setMetricDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-1" />Add Metric
                    </Button>
                  </div>

                  {workspaceMetrics.length === 0 ? (
                    <EmptyState
                      icon={BarChart3}
                      title="No metrics tracked"
                      description="Start tracking MRR, team size, growth, and more."
                      action={<Button size="sm" onClick={() => setMetricDialogOpen(true)}><Plus className="w-4 h-4 mr-1" />Add Metric</Button>}
                    />
                  ) : (
                    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
                      {workspaceMetrics.map(m => (
                        <motion.div key={m.id} variants={staggerItem}>
                          <GlassCard className="p-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium capitalize">{m.metric_name.replace(/_/g, ' ')}</p>
                              <p className="text-xs text-muted-foreground">{new Date(m.metric_date).toLocaleDateString()}</p>
                              {m.notes && <p className="text-xs text-muted-foreground mt-0.5">{m.notes}</p>}
                            </div>
                            <span className="text-lg font-bold">{m.metric_value.toLocaleString()}</span>
                          </GlassCard>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {/* Idea detail view */}
        {currentWorkspace && viewingIdea && (
          <ScrollArea className="flex-1">
            <IdeaDetailView
              idea={viewingIdea}
              onBack={() => setViewingIdea(null)}
              onEdit={() => { setEditingIdea(viewingIdea); setIdeaDialogOpen(true); }}
              onDelete={() => setDeleteIdeaId(viewingIdea.id)}
              onStatusChange={async (status) => {
                await updateIdea(viewingIdea.id, { status });
                setViewingIdea({ ...viewingIdea, status });
              }}
            />
          </ScrollArea>
        )}
      </PanelShell>

      {/* ─── Dialogs ───────────────────────────────────────────── */}

      <WorkspaceDialog
        open={wsDialogOpen}
        onOpenChange={setWsDialogOpen}
        onSave={handleAddWorkspace}
      />

      {editingWs && (
        <WorkspaceDialog
          open={!!editingWs}
          onOpenChange={() => setEditingWs(null)}
          initial={editingWs}
          onSave={handleEditWorkspace}
        />
      )}

      {activeWorkspace && (
        <MetricDialog
          open={metricDialogOpen}
          onOpenChange={setMetricDialogOpen}
          workspaceId={activeWorkspace}
          onSave={handleAddMetric}
        />
      )}

      {activeWorkspace && (
        <IdeaDialog
          open={ideaDialogOpen}
          onOpenChange={v => { if (!v) setEditingIdea(null); setIdeaDialogOpen(v); }}
          initial={editingIdea || undefined}
          workspaceId={activeWorkspace}
          onSave={handleSaveIdea}
        />
      )}

      {/* Archive workspace confirm */}
      <AlertDialog open={!!archiveWs} onOpenChange={() => setArchiveWs(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive workspace?</AlertDialogTitle>
            <AlertDialogDescription>This workspace will be hidden. You can restore it later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveWorkspace}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete idea confirm */}
      <AlertDialog open={!!deleteIdeaId} onOpenChange={() => setDeleteIdeaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete idea?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDeleteIdea}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
