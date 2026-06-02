import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Clock, AlertTriangle, User } from 'lucide-react';
import { useHouseholdTasks } from '@/hooks/useHouseholdTasks';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { AddHouseholdTaskDialog } from './AddHouseholdTaskDialog';
import { format, isPast, isToday } from 'date-fns';

const categoryColors: Record<string, string> = {
  cleaning: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  cooking: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  shopping: 'bg-green-500/10 text-green-500 border-green-500/20',
  childcare: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  maintenance: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  general: 'bg-muted text-muted-foreground border-border',
};

const priorityColors: Record<string, string> = {
  high: 'text-destructive',
  medium: 'text-amber-500',
  low: 'text-muted-foreground',
};

export function HouseholdTasksList() {
  const { tasks, isLoading, toggleComplete } = useHouseholdTasks();
  const { members } = useFamilyMembers();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return !task.is_completed;
    if (filter === 'completed') return task.is_completed;
    return true;
  });

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return null;
    const member = members.find(m => m.id === memberId);
    return member?.name;
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return isPast(new Date(dueDate)) && !isToday(new Date(dueDate));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pending
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('completed')}
          >
            Completed
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {filteredTasks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">
            {filter === 'pending' 
              ? 'No pending household tasks' 
              : filter === 'completed' 
                ? 'No completed tasks yet'
                : 'No household tasks yet'
            }
          </p>
          {filter !== 'completed' && (
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Task
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <Card key={task.id} className={task.is_completed ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={() => toggleComplete(task.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${task.is_completed ? 'line-through' : ''}`}>
                        {task.title}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs capitalize ${categoryColors[task.category] || categoryColors.general}`}
                      >
                        {task.category}
                      </Badge>
                      {!task.is_completed && task.due_date && isOverdue(task.due_date) && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {task.due_date && (
                        <span className={`flex items-center gap-1 ${isOverdue(task.due_date) && !task.is_completed ? 'text-destructive' : ''}`}>
                          <Clock className="h-3 w-3" />
                          {format(new Date(task.due_date), 'MMM d, h:mm a')}
                        </span>
                      )}
                      {task.assigned_to && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getMemberName(task.assigned_to)}
                        </span>
                      )}
                      <span className={priorityColors[task.priority]}>
                        {task.priority} priority
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddHouseholdTaskDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
      />
    </div>
  );
}
