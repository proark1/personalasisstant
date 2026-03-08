import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Home, Building, MapPin, Plus, FileText, Wrench, CheckSquare, Pencil, Trash2, TrendingUp, TrendingDown, Check, X, Ruler } from 'lucide-react';
import { useProperties, Property, PropertyMaintenance } from '@/hooks/useProperties';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { PanelShell } from '@/components/ui/panel-shell';
import { useIsMobile } from '@/hooks/use-mobile';

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

const emptyPropertyForm = {
  name: '', property_type: 'apartment', address: '', city: '', country: 'Turkey',
  size_sqm: '', purchase_date: '', purchase_price: '', current_value: '', notes: '',
};

const emptyMaintenanceForm = {
  title: '', description: '', category: 'general', cost: '', scheduled_date: '', is_recurring: false,
};

const emptyChecklistForm = {
  name: '', checklist_type: 'general', items: [{ id: crypto.randomUUID(), text: '', completed: false }],
};

export function PropertyPanel() {
  const {
    properties, maintenance, checklists, loading,
    addProperty, updateProperty, deleteProperty,
    addMaintenance, updateMaintenance,
    addChecklist, toggleChecklistItem,
  } = useProperties();

  const isMobile = useIsMobile();
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [propertyForm, setPropertyForm] = useState(emptyPropertyForm);
  const [maintenanceForm, setMaintenanceForm] = useState(emptyMaintenanceForm);
  const [checklistForm, setChecklistForm] = useState(emptyChecklistForm);

  const selectedPropertyData = properties.find(p => p.id === selectedProperty);
  const propertyMaintenance = maintenance.filter(m => m.property_id === selectedProperty);
  const propertyChecklists = checklists.filter(c => c.property_id === selectedProperty);

  const handleAddProperty = async () => {
    await addProperty({
      ...propertyForm,
      size_sqm: propertyForm.size_sqm ? Number(propertyForm.size_sqm) : undefined,
      purchase_price: propertyForm.purchase_price ? Number(propertyForm.purchase_price) : undefined,
      current_value: propertyForm.current_value ? Number(propertyForm.current_value) : undefined,
      purchase_date: propertyForm.purchase_date || undefined,
      address: propertyForm.address || undefined,
      notes: propertyForm.notes || undefined,
    });
    setShowAddDialog(false);
    setPropertyForm(emptyPropertyForm);
  };

  const handleEditProperty = async () => {
    if (!selectedProperty) return;
    await updateProperty(selectedProperty, {
      ...propertyForm,
      size_sqm: propertyForm.size_sqm ? Number(propertyForm.size_sqm) : undefined,
      purchase_price: propertyForm.purchase_price ? Number(propertyForm.purchase_price) : undefined,
      current_value: propertyForm.current_value ? Number(propertyForm.current_value) : undefined,
      purchase_date: propertyForm.purchase_date || undefined,
      address: propertyForm.address || undefined,
      notes: propertyForm.notes || undefined,
    });
    setShowEditDialog(false);
  };

  const openEditDialog = () => {
    if (!selectedPropertyData) return;
    setPropertyForm({
      name: selectedPropertyData.name,
      property_type: selectedPropertyData.property_type,
      address: selectedPropertyData.address || '',
      city: selectedPropertyData.city || '',
      country: selectedPropertyData.country || '',
      size_sqm: selectedPropertyData.size_sqm?.toString() || '',
      purchase_date: selectedPropertyData.purchase_date || '',
      purchase_price: selectedPropertyData.purchase_price?.toString() || '',
      current_value: selectedPropertyData.current_value?.toString() || '',
      notes: selectedPropertyData.notes || '',
    });
    setShowEditDialog(true);
  };

  const handleDeleteProperty = async () => {
    if (!selectedProperty) return;
    await deleteProperty(selectedProperty);
    setSelectedProperty(null);
  };

  const handleAddMaintenance = async () => {
    if (!selectedProperty) return;
    await addMaintenance({
      property_id: selectedProperty,
      title: maintenanceForm.title,
      description: maintenanceForm.description || undefined,
      category: maintenanceForm.category || undefined,
      cost: maintenanceForm.cost ? Number(maintenanceForm.cost) : undefined,
      scheduled_date: maintenanceForm.scheduled_date || undefined,
      is_recurring: maintenanceForm.is_recurring,
    });
    setShowMaintenanceDialog(false);
    setMaintenanceForm(emptyMaintenanceForm);
  };

  const handleToggleMaintenanceStatus = async (task: PropertyMaintenance) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateMaintenance(task.id, {
      status: newStatus,
      completed_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : undefined,
    });
  };

  const handleAddChecklist = async () => {
    if (!selectedProperty) return;
    const validItems = checklistForm.items.filter(i => i.text.trim());
    if (validItems.length === 0) return;
    await addChecklist({
      property_id: selectedProperty,
      name: checklistForm.name,
      checklist_type: checklistForm.checklist_type || undefined,
      items: validItems,
    });
    setShowChecklistDialog(false);
    setChecklistForm(emptyChecklistForm);
  };

  const addChecklistItem = () => {
    setChecklistForm(f => ({
      ...f,
      items: [...f.items, { id: crypto.randomUUID(), text: '', completed: false }],
    }));
  };

  const removeChecklistItem = (id: string) => {
    setChecklistForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));
  };

  const updateChecklistItemText = (id: string, text: string) => {
    setChecklistForm(f => ({
      ...f,
      items: f.items.map(i => i.id === id ? { ...i, text } : i),
    }));
  };

  const getPropertyIcon = (type: string) => {
    switch (type) {
      case 'house': return <Home className="w-5 h-5" />;
      case 'land': return <MapPin className="w-5 h-5" />;
      default: return <Building className="w-5 h-5" />;
    }
  };

  const formatCurrency = (val?: number) => val != null ? `$${val.toLocaleString()}` : null;

  const valueChange = selectedPropertyData?.purchase_price && selectedPropertyData?.current_value
    ? selectedPropertyData.current_value - selectedPropertyData.purchase_price
    : null;

  // --- Property Form Dialog (shared for add/edit) ---
  const propertyFormContent = (
    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
      <div className="space-y-2">
        <Label>Property Name *</Label>
        <Input placeholder="e.g., Kayseri Apartment" value={propertyForm.name} onChange={e => setPropertyForm({ ...propertyForm, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={propertyForm.property_type} onValueChange={v => setPropertyForm({ ...propertyForm, property_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apartment">Apartment</SelectItem>
              <SelectItem value="house">House</SelectItem>
              <SelectItem value="land">Land</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Size (m²)</Label>
          <Input type="number" placeholder="120" value={propertyForm.size_sqm} onChange={e => setPropertyForm({ ...propertyForm, size_sqm: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Input placeholder="Street address" value={propertyForm.address} onChange={e => setPropertyForm({ ...propertyForm, address: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>City</Label>
          <Input placeholder="Kayseri" value={propertyForm.city} onChange={e => setPropertyForm({ ...propertyForm, city: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Country</Label>
          <Input value={propertyForm.country} onChange={e => setPropertyForm({ ...propertyForm, country: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Purchase Price</Label>
          <Input type="number" placeholder="250000" value={propertyForm.purchase_price} onChange={e => setPropertyForm({ ...propertyForm, purchase_price: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Current Value</Label>
          <Input type="number" placeholder="300000" value={propertyForm.current_value} onChange={e => setPropertyForm({ ...propertyForm, current_value: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Purchase Date</Label>
        <Input type="date" value={propertyForm.purchase_date} onChange={e => setPropertyForm({ ...propertyForm, purchase_date: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea placeholder="Any additional notes..." value={propertyForm.notes} onChange={e => setPropertyForm({ ...propertyForm, notes: e.target.value })} rows={3} />
      </div>
    </div>
  );

  // --- Mobile property selector ---
  const mobilePropertySelector = (
    <div className="px-3 pt-3 pb-1">
      <Select value={selectedProperty || ''} onValueChange={v => setSelectedProperty(v)}>
        <SelectTrigger>
          <SelectValue placeholder="Select a property..." />
        </SelectTrigger>
        <SelectContent>
          {properties.map(p => (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex items-center gap-2">
                {getPropertyIcon(p.property_type)}
                {p.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const addButton = (
    <Dialog open={showAddDialog} onOpenChange={v => { setShowAddDialog(v); if (v) setPropertyForm(emptyPropertyForm); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add New Property</DialogTitle></DialogHeader>
        {propertyFormContent}
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddProperty} disabled={!propertyForm.name.trim()}>Add Property</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <PanelShell icon={Building} title="Property Management" loading={loading} loadingVariant="cards" actions={addButton} noPadding>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — hidden on mobile, replaced by dropdown */}
        {!isMobile && (
          <div className="w-64 border-r border-border p-3 overflow-y-auto">
            {properties.length === 0 ? (
              <EmptyState icon={Building} title="No properties yet" description="Add your first property to get started" />
            ) : (
              <motion.div className="space-y-2" variants={staggerContainer} initial="hidden" animate="show">
                {properties.map(property => (
                  <motion.div key={property.id} variants={staggerItem}>
                    <GlassCard
                      pressable
                      haptic="light"
                      className={cn(
                        "p-3 transition-all",
                        selectedProperty === property.id && "border-primary bg-primary/5 shadow-sm"
                      )}
                      onClick={() => setSelectedProperty(property.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="p-2 rounded-lg bg-muted">{getPropertyIcon(property.property_type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{property.name}</p>
                          <p className="text-xs text-muted-foreground">{[property.city, property.country].filter(Boolean).join(', ')}</p>
                          <Badge variant="outline" className="text-xs mt-1 capitalize">{property.property_type}</Badge>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Detail area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isMobile && properties.length > 0 && mobilePropertySelector}

          {isMobile && properties.length === 0 && (
            <EmptyState icon={Building} title="No properties yet" description="Add your first property to get started" />
          )}

          {selectedPropertyData ? (
            <Tabs defaultValue="overview" className="flex-1 flex flex-col">
              <TabsList className="mx-3 mt-2 sm:mx-4 sm:mt-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="maintenance" className="gap-1"><Wrench className="w-3 h-3" />Tasks</TabsTrigger>
                <TabsTrigger value="checklists" className="gap-1"><CheckSquare className="w-3 h-3" />Lists</TabsTrigger>
                <TabsTrigger value="documents" className="gap-1"><FileText className="w-3 h-3" />Docs</TabsTrigger>
              </TabsList>

              {/* ===== OVERVIEW ===== */}
              <TabsContent value="overview" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <motion.div className="p-3 sm:p-4 space-y-4" variants={staggerContainer} initial="hidden" animate="show">
                    <motion.div variants={staggerItem}>
                      <GlassCard className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-xl">{selectedPropertyData.name}</h3>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={openEditDialog}><Pencil className="w-4 h-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete property?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete "{selectedPropertyData.name}" and all associated data.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDeleteProperty} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div><span className="text-muted-foreground">Type:</span> <span className="capitalize">{selectedPropertyData.property_type}</span></div>
                          {selectedPropertyData.city && <div><span className="text-muted-foreground">Location:</span> {[selectedPropertyData.city, selectedPropertyData.country].filter(Boolean).join(', ')}</div>}
                          {selectedPropertyData.address && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {selectedPropertyData.address}</div>}
                          {selectedPropertyData.size_sqm && (
                            <div className="flex items-center gap-1">
                              <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{selectedPropertyData.size_sqm} m²</span>
                            </div>
                          )}
                          {selectedPropertyData.purchase_date && <div><span className="text-muted-foreground">Purchased:</span> {format(new Date(selectedPropertyData.purchase_date), 'MMM yyyy')}</div>}
                        </div>
                        {selectedPropertyData.notes && <p className="mt-3 text-sm text-muted-foreground border-t border-border pt-3">{selectedPropertyData.notes}</p>}
                      </GlassCard>
                    </motion.div>

                    {/* Value card */}
                    {(selectedPropertyData.purchase_price || selectedPropertyData.current_value) && (
                      <motion.div variants={staggerItem}>
                        <GlassCard className="p-4">
                          <h4 className="text-sm font-medium text-muted-foreground mb-3">Financials</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {selectedPropertyData.purchase_price != null && (
                              <div>
                                <p className="text-xs text-muted-foreground">Purchase Price</p>
                                <p className="text-lg font-semibold">{formatCurrency(selectedPropertyData.purchase_price)}</p>
                              </div>
                            )}
                            {selectedPropertyData.current_value != null && (
                              <div>
                                <p className="text-xs text-muted-foreground">Current Value</p>
                                <p className="text-lg font-semibold">{formatCurrency(selectedPropertyData.current_value)}</p>
                              </div>
                            )}
                          </div>
                          {valueChange != null && (
                            <div className={cn("mt-3 flex items-center gap-1 text-sm font-medium", valueChange >= 0 ? "text-primary" : "text-destructive")}>
                              {valueChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              {valueChange >= 0 ? '+' : ''}{formatCurrency(valueChange)} ({((valueChange / selectedPropertyData.purchase_price!) * 100).toFixed(1)}%)
                            </div>
                          )}
                        </GlassCard>
                      </motion.div>
                    )}
                  </motion.div>
                </ScrollArea>
              </TabsContent>

              {/* ===== MAINTENANCE ===== */}
              <TabsContent value="maintenance" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className="p-3 sm:p-4">
                    <div className="flex justify-end mb-3">
                      <Dialog open={showMaintenanceDialog} onOpenChange={v => { setShowMaintenanceDialog(v); if (v) setMaintenanceForm(emptyMaintenanceForm); }}>
                        <DialogTrigger asChild>
                          <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Task</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Add Maintenance Task</DialogTitle></DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="space-y-2">
                              <Label>Title *</Label>
                              <Input placeholder="e.g., Fix leaking faucet" value={maintenanceForm.title} onChange={e => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea placeholder="Details..." value={maintenanceForm.description} onChange={e => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })} rows={2} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={maintenanceForm.category} onValueChange={v => setMaintenanceForm({ ...maintenanceForm, category: v })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="general">General</SelectItem>
                                    <SelectItem value="plumbing">Plumbing</SelectItem>
                                    <SelectItem value="electrical">Electrical</SelectItem>
                                    <SelectItem value="hvac">HVAC</SelectItem>
                                    <SelectItem value="exterior">Exterior</SelectItem>
                                    <SelectItem value="interior">Interior</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Est. Cost</Label>
                                <Input type="number" placeholder="500" value={maintenanceForm.cost} onChange={e => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Scheduled Date</Label>
                              <Input type="date" value={maintenanceForm.scheduled_date} onChange={e => setMaintenanceForm({ ...maintenanceForm, scheduled_date: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox checked={maintenanceForm.is_recurring} onCheckedChange={v => setMaintenanceForm({ ...maintenanceForm, is_recurring: !!v })} />
                              <Label className="cursor-pointer">Recurring task</Label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowMaintenanceDialog(false)}>Cancel</Button>
                            <Button onClick={handleAddMaintenance} disabled={!maintenanceForm.title.trim()}>Add Task</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {propertyMaintenance.length === 0 ? (
                      <EmptyState icon={Wrench} title="No maintenance tasks" description="Track repairs, inspections, and upkeep" />
                    ) : (
                      <motion.div className="space-y-2" variants={staggerContainer} initial="hidden" animate="show">
                        {propertyMaintenance.map(task => (
                          <motion.div key={task.id} variants={staggerItem}>
                            <GlassCard pressable haptic="light" className="p-3 flex items-center justify-between gap-3" onClick={() => handleToggleMaintenanceStatus(task)}>
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={cn(
                                  "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                  task.status === 'completed' ? "bg-primary border-primary" : "border-muted-foreground/30"
                                )}>
                                  {task.status === 'completed' && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                                </div>
                                <div className="min-w-0">
                                  <p className={cn("font-medium truncate", task.status === 'completed' && "line-through text-muted-foreground")}>{task.title}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {task.scheduled_date && <span>{format(new Date(task.scheduled_date), 'MMM d, yyyy')}</span>}
                                    {task.cost != null && <span>• {formatCurrency(task.cost)}</span>}
                                    {task.category && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{task.category}</Badge>}
                                  </div>
                                </div>
                              </div>
                            </GlassCard>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* ===== CHECKLISTS ===== */}
              <TabsContent value="checklists" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className="p-3 sm:p-4">
                    <div className="flex justify-end mb-3">
                      <Dialog open={showChecklistDialog} onOpenChange={v => { setShowChecklistDialog(v); if (v) setChecklistForm(emptyChecklistForm); }}>
                        <DialogTrigger asChild>
                          <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Checklist</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Add Checklist</DialogTitle></DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="space-y-2">
                              <Label>Checklist Name *</Label>
                              <Input placeholder="e.g., Move-in Checklist" value={checklistForm.name} onChange={e => setChecklistForm({ ...checklistForm, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Select value={checklistForm.checklist_type} onValueChange={v => setChecklistForm({ ...checklistForm, checklist_type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="general">General</SelectItem>
                                  <SelectItem value="move-in">Move-in</SelectItem>
                                  <SelectItem value="move-out">Move-out</SelectItem>
                                  <SelectItem value="inspection">Inspection</SelectItem>
                                  <SelectItem value="seasonal">Seasonal</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Items</Label>
                              <div className="space-y-2">
                                {checklistForm.items.map((item, i) => (
                                  <div key={item.id} className="flex gap-2">
                                    <Input
                                      placeholder={`Item ${i + 1}`}
                                      value={item.text}
                                      onChange={e => updateChecklistItemText(item.id, e.target.value)}
                                      className="flex-1"
                                    />
                                    {checklistForm.items.length > 1 && (
                                      <Button size="icon" variant="ghost" onClick={() => removeChecklistItem(item.id)}>
                                        <X className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                <Button size="sm" variant="outline" onClick={addChecklistItem} className="w-full">
                                  <Plus className="w-4 h-4 mr-1" /> Add Item
                                </Button>
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowChecklistDialog(false)}>Cancel</Button>
                            <Button onClick={handleAddChecklist} disabled={!checklistForm.name.trim()}>Create</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {propertyChecklists.length === 0 ? (
                      <EmptyState icon={CheckSquare} title="No checklists" description="Create checklists for inspections, move-ins, and more" />
                    ) : (
                      <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="show">
                        {propertyChecklists.map(checklist => (
                          <motion.div key={checklist.id} variants={staggerItem}>
                            <GlassCard className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium">{checklist.name}</h4>
                                {checklist.checklist_type && <Badge variant="outline" className="text-xs capitalize">{checklist.checklist_type}</Badge>}
                              </div>
                              <div className="space-y-2">
                                {checklist.items.map(item => (
                                  <div key={item.id} className="flex items-center gap-2">
                                    <Checkbox checked={item.completed} onCheckedChange={() => toggleChecklistItem(checklist.id, item.id)} />
                                    <span className={cn("text-sm", item.completed && "line-through text-muted-foreground")}>{item.text}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {checklist.items.filter(i => i.completed).length}/{checklist.items.length} completed
                              </div>
                            </GlassCard>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* ===== DOCUMENTS ===== */}
              <TabsContent value="documents" className="flex-1 mt-0">
                <EmptyState icon={FileText} title="Document storage" description="Coming soon — store deeds, contracts, and receipts" />
              </TabsContent>
            </Tabs>
          ) : (
            !isMobile && (
              <EmptyState
                icon={Building}
                title="Select a property"
                description="Choose a property from the sidebar to view details"
              />
            )
          )}
        </div>
      </div>

      {/* Edit property dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Property</DialogTitle></DialogHeader>
          {propertyFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEditProperty} disabled={!propertyForm.name.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}
