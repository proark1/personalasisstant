import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  GraduationCap, 
  Activity, 
  Cake, 
  AlertTriangle,
  Calendar,
  Star,
  ChevronRight,
} from 'lucide-react';
import { useFamilyMembers, FamilyMember } from '@/hooks/useFamilyMembers';
import { useFamilyEvents } from '@/hooks/useFamilyEvents';
import { EditFamilyMemberDialog } from './EditFamilyMemberDialog';
import { format, differenceInYears } from 'date-fns';

export function ChildDashboard() {
  const { members, getChildren, getUpcomingBirthdays, isLoading } = useFamilyMembers();
  const { getEventsByMember } = useFamilyEvents();
  const [selectedChild, setSelectedChild] = useState<FamilyMember | null>(null);
  const [editingChild, setEditingChild] = useState<FamilyMember | null>(null);

  const children = getChildren();
  const upcomingBirthdays = getUpcomingBirthdays(30);

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground mb-2">No children added to your family yet</p>
        <p className="text-sm text-muted-foreground">
          Add a child from the Members tab to see their dashboard here
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upcoming Birthdays Alert */}
      {upcomingBirthdays.length > 0 && (
        <Card className="border-pink-500/20 bg-pink-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-pink-600">
              <Cake className="h-4 w-4" />
              Upcoming Birthdays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {upcomingBirthdays.map((member) => (
                <div key={member.id} className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-pink-500/10 text-pink-600 text-xs">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Turns {member.upcomingAge} on {format(member.birthdayDate, 'MMM d')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Child Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {children.map((child) => {
          const childEvents = getEventsByMember(child.id);
          const age = getAge(child.birth_date);
          
          return (
            <Card 
              key={child.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedChild?.id === child.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedChild(selectedChild?.id === child.id ? null : child)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-blue-500/10 text-blue-600 font-medium">
                      {getInitials(child.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{child.name}</h4>
                      {age !== null && (
                        <Badge variant="outline" className="text-xs">
                          {age} yrs
                        </Badge>
                      )}
                    </div>
                    
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {child.school_name && (
                        <div className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          <span className="truncate">
                            {child.school_name}
                            {child.school_grade && ` • ${child.school_grade}`}
                          </span>
                        </div>
                      )}
                      {child.activities.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          <span>{child.activities.length} activities</span>
                        </div>
                      )}
                      {childEvents.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{childEvents.length} upcoming events</span>
                        </div>
                      )}
                    </div>

                    {/* Allergies warning */}
                    {child.allergies && child.allergies.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Allergies: {child.allergies.join(', ')}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${
                    selectedChild?.id === child.id ? 'rotate-90' : ''
                  }`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selected Child Details */}
      {selectedChild && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">{selectedChild.name}'s Details</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setEditingChild(selectedChild)}>
              Edit Profile
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="school">School</TabsTrigger>
                <TabsTrigger value="activities">Activities</TabsTrigger>
                <TabsTrigger value="milestones">Milestones</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {selectedChild.birth_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Birthday</p>
                      <p className="font-medium">
                        {format(new Date(selectedChild.birth_date), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  {selectedChild.medical_notes && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-muted-foreground">Medical Notes</p>
                      <p>{selectedChild.medical_notes}</p>
                    </div>
                  )}
                  {selectedChild.allergies && selectedChild.allergies.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-muted-foreground mb-1">Allergies</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedChild.allergies.map((allergy) => (
                          <Badge key={allergy} variant="destructive" className="text-xs">
                            {allergy}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="school" className="space-y-4 mt-4">
                {selectedChild.school_name ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">School</p>
                      <p className="font-medium">{selectedChild.school_name}</p>
                    </div>
                    {selectedChild.school_grade && (
                      <div>
                        <p className="text-sm text-muted-foreground">Grade/Class</p>
                        <p className="font-medium">{selectedChild.school_grade}</p>
                      </div>
                    )}
                    {selectedChild.teacher_name && (
                      <div>
                        <p className="text-sm text-muted-foreground">Teacher</p>
                        <p className="font-medium">{selectedChild.teacher_name}</p>
                      </div>
                    )}
                    {selectedChild.teacher_contact && (
                      <div>
                        <p className="text-sm text-muted-foreground">Teacher Contact</p>
                        <p className="font-medium">{selectedChild.teacher_contact}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No school information added yet
                  </p>
                )}
              </TabsContent>

              <TabsContent value="activities" className="space-y-4 mt-4">
                {selectedChild.activities.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedChild.activities.map((activity, index) => (
                      <Card key={index} className="p-3">
                        <div className="flex items-start gap-2">
                          <Activity className="h-4 w-4 text-primary mt-0.5" />
                          <div>
                            <p className="font-medium">{activity.name}</p>
                            <p className="text-sm text-muted-foreground">{activity.schedule}</p>
                            {activity.location && (
                              <p className="text-xs text-muted-foreground">{activity.location}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No activities added yet
                  </p>
                )}
              </TabsContent>

              <TabsContent value="milestones" className="space-y-4 mt-4">
                {selectedChild.milestones.length > 0 ? (
                  <div className="space-y-3">
                    {selectedChild.milestones
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((milestone, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded">
                          <Star className="h-4 w-4 text-amber-500 mt-0.5" />
                          <div>
                            <p className="font-medium">{milestone.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(milestone.date), 'MMMM d, yyyy')}
                            </p>
                            {milestone.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{milestone.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No milestones recorded yet
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {editingChild && (
        <EditFamilyMemberDialog
          member={editingChild}
          open={!!editingChild}
          onOpenChange={(open) => !open && setEditingChild(null)}
        />
      )}
    </div>
  );
}
