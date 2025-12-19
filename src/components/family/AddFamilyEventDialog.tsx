import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useFamilyEvents } from '@/hooks/useFamilyEvents';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { format } from 'date-fns';

const eventTypes = [
  { value: 'general', label: 'General' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'school', label: 'School' },
  { value: 'medical', label: 'Medical' },
  { value: 'activity', label: 'Activity' },
  { value: 'holiday', label: 'Holiday' },
];

interface AddFamilyEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date | null;
}

export function AddFamilyEventDialog({ open, onOpenChange, defaultDate }: AddFamilyEventDialogProps) {
  const { addEvent } = useFamilyEvents();
  const { members } = useFamilyMembers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'general',
    related_member_id: '',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '10:00',
    location: '',
    is_all_day: false,
    notes: '',
  });

  useEffect(() => {
    if (defaultDate) {
      const dateStr = format(defaultDate, 'yyyy-MM-dd');
      setFormData(prev => ({ 
        ...prev, 
        start_date: dateStr,
        end_date: dateStr,
      }));
    }
  }, [defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.start_date) return;
    
    setIsSubmitting(true);
    
    let startTime: Date;
    let endTime: Date;
    
    if (formData.is_all_day) {
      startTime = new Date(formData.start_date);
      startTime.setHours(0, 0, 0, 0);
      endTime = new Date(formData.end_date || formData.start_date);
      endTime.setHours(23, 59, 59, 999);
    } else {
      const [startHours, startMinutes] = formData.start_time.split(':');
      startTime = new Date(formData.start_date);
      startTime.setHours(parseInt(startHours), parseInt(startMinutes));
      
      const [endHours, endMinutes] = formData.end_time.split(':');
      endTime = new Date(formData.end_date || formData.start_date);
      endTime.setHours(parseInt(endHours), parseInt(endMinutes));
    }
    
    const result = await addEvent({
      title: formData.title,
      description: formData.description || null,
      event_type: formData.event_type,
      related_member_id: formData.related_member_id || null,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      location: formData.location || null,
      is_all_day: formData.is_all_day,
      recurrence_rule: null,
      reminder_before: null,
      notes: formData.notes || null,
    });

    setIsSubmitting(false);
    
    if (result) {
      setFormData({
        title: '',
        description: '',
        event_type: 'general',
        related_member_id: '',
        start_date: '',
        start_time: '09:00',
        end_date: '',
        end_time: '10:00',
        location: '',
        is_all_day: false,
        notes: '',
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Family Event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Event name"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select
                value={formData.event_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, event_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Related To</Label>
              <Select
                value={formData.related_member_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, related_member_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select family member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_all_day">All Day Event</Label>
            <Switch
              id="is_all_day"
              checked={formData.is_all_day}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_all_day: checked }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  start_date: e.target.value,
                  end_date: prev.end_date || e.target.value,
                }))}
                required
              />
            </div>
            {!formData.is_all_day && (
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                min={formData.start_date}
              />
            </div>
            {!formData.is_all_day && (
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Event location"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Event details..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title || !formData.start_date}>
              {isSubmitting ? 'Adding...' : 'Add Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
