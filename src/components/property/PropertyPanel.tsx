import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Home, Building, MapPin, Plus, FileText, Wrench, CheckSquare, Loader2 } from 'lucide-react';
import { useProperties, Property } from '@/hooks/useProperties';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function PropertyPanel() {
  const {
    properties,
    maintenance,
    checklists,
    loading,
    addProperty,
    updateMaintenance,
    toggleChecklistItem,
  } = useProperties();

  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newProperty, setNewProperty] = useState({ name: '', property_type: 'apartment', city: '', country: 'Turkey' });

  const selectedPropertyData = properties.find(p => p.id === selectedProperty);
  const propertyMaintenance = maintenance.filter(m => m.property_id === selectedProperty);
  const propertyChecklists = checklists.filter(c => c.property_id === selectedProperty);

  const handleAddProperty = async () => {
    await addProperty(newProperty);
    setShowAddDialog(false);
    setNewProperty({ name: '', property_type: 'apartment', city: '', country: 'Turkey' });
  };

  const getPropertyIcon = (type: string) => {
    switch (type) {
      case 'house': return <Home className="w-5 h-5" />;
      case 'land': return <MapPin className="w-5 h-5" />;
      default: return <Building className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building className="w-5 h-5 text-primary" />
          Property Management
        </h2>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Property</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Property Name</Label>
                <Input
                  placeholder="e.g., Kayseri Apartment"
                  value={newProperty.name}
                  onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newProperty.property_type} onValueChange={(v) => setNewProperty({ ...newProperty, property_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input placeholder="Kayseri" value={newProperty.city} onChange={(e) => setNewProperty({ ...newProperty, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={newProperty.country} onChange={(e) => setNewProperty({ ...newProperty, country: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddProperty}>Add Property</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Property List */}
        <div className="w-64 border-r border-border p-3 overflow-y-auto">
          <div className="space-y-2">
            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No properties yet</p>
            ) : (
              properties.map((property) => (
                <Card
                  key={property.id}
                  className={cn(
                    "p-3 cursor-pointer transition-all hover:border-primary/50",
                    selectedProperty === property.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => setSelectedProperty(property.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className="p-2 rounded-lg bg-muted">{getPropertyIcon(property.property_type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{property.name}</p>
                      <p className="text-xs text-muted-foreground">{property.city}, {property.country}</p>
                      <Badge variant="outline" className="text-xs mt-1 capitalize">{property.property_type}</Badge>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Property Detail */}
        <div className="flex-1 overflow-hidden">
          {selectedPropertyData ? (
            <Tabs defaultValue="overview" className="h-full flex flex-col">
              <TabsList className="mx-4 mt-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="documents" className="gap-1"><FileText className="w-3 h-3" />Docs</TabsTrigger>
                <TabsTrigger value="maintenance" className="gap-1"><Wrench className="w-3 h-3" />Maintenance</TabsTrigger>
                <TabsTrigger value="checklists" className="gap-1"><CheckSquare className="w-3 h-3" />Checklists</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4">
                    <Card className="p-4">
                      <h3 className="font-semibold text-xl mb-2">{selectedPropertyData.name}</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-muted-foreground">Type:</span> <span className="capitalize">{selectedPropertyData.property_type}</span></div>
                        <div><span className="text-muted-foreground">Location:</span> {selectedPropertyData.city}, {selectedPropertyData.country}</div>
                        {selectedPropertyData.size_sqm && <div><span className="text-muted-foreground">Size:</span> {selectedPropertyData.size_sqm} m²</div>}
                        {selectedPropertyData.purchase_date && <div><span className="text-muted-foreground">Purchased:</span> {format(new Date(selectedPropertyData.purchase_date), 'MMM yyyy')}</div>}
                      </div>
                      {selectedPropertyData.notes && <p className="mt-3 text-sm text-muted-foreground">{selectedPropertyData.notes}</p>}
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="maintenance" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {propertyMaintenance.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No maintenance tasks</p>
                    ) : (
                      propertyMaintenance.map((task) => (
                        <Card key={task.id} className="p-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {task.scheduled_date && <p className="text-xs text-muted-foreground">{format(new Date(task.scheduled_date), 'MMM d, yyyy')}</p>}
                          </div>
                          <Badge variant={task.status === 'completed' ? 'default' : 'outline'}>{task.status}</Badge>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="checklists" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4">
                    {propertyChecklists.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No checklists</p>
                    ) : (
                      propertyChecklists.map((checklist) => (
                        <Card key={checklist.id} className="p-4">
                          <h4 className="font-medium mb-3">{checklist.name}</h4>
                          <div className="space-y-2">
                            {checklist.items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2">
                                <Checkbox
                                  checked={item.completed}
                                  onCheckedChange={() => toggleChecklistItem(checklist.id, item.id)}
                                />
                                <span className={cn("text-sm", item.completed && "line-through text-muted-foreground")}>{item.text}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="documents" className="flex-1 mt-0">
                <div className="p-4 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Document storage coming soon</p>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Building className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select a property to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
