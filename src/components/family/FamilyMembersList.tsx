import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Edit, Trash2, Phone, Mail, Cake, MapPin } from 'lucide-react';
import { useFamilyMembers, FamilyMember } from '@/hooks/useFamilyMembers';
import { AddFamilyMemberDialog } from './AddFamilyMemberDialog';
import { EditFamilyMemberDialog } from './EditFamilyMemberDialog';
import { format, differenceInYears } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const relationshipColors: Record<string, string> = {
  spouse: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  child: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  parent: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  sibling: 'bg-green-500/10 text-green-500 border-green-500/20',
  grandparent: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  grandchild: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  'aunt': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  'uncle': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  'cousin': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  'in-law': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  other: 'bg-muted text-muted-foreground border-border',
};

export function FamilyMembersList() {
  const { members, isLoading, deleteMember } = useFamilyMembers();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<FamilyMember | null>(null);

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleDelete = async () => {
    if (deletingMember) {
      await deleteMember(deletingMember.id);
      setDeletingMember(null);
    }
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Family Members</h3>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </div>

      {members.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">No family members added yet</p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Family Member
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card key={member.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{member.name}</h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs capitalize ${relationshipColors[member.relationship] || relationshipColors.other}`}
                      >
                        {member.relationship}
                      </Badge>
                    </div>
                    
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {member.birth_date && (
                        <div className="flex items-center gap-1">
                          <Cake className="h-3 w-3" />
                          <span>
                            {format(new Date(member.birth_date), 'MMM d, yyyy')}
                            {getAge(member.birth_date) !== null && ` (${getAge(member.birth_date)} years)`}
                          </span>
                        </div>
                      )}
                      {member.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span className="truncate">{member.phone}</span>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                      {!member.lives_with_user && member.address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{member.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setEditingMember(member)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletingMember(member)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddFamilyMemberDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
      />

      {editingMember && (
        <EditFamilyMemberDialog
          member={editingMember}
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
        />
      )}

      <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Family Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {deletingMember?.name} from your family list. This action can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
