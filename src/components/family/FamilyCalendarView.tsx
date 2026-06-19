import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Calendar, MapPin, User } from "lucide-react";
import { useFamilyEvents } from "@/hooks/useFamilyEvents";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { AddFamilyEventDialog } from "./AddFamilyEventDialog";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";

const eventTypeColors: Record<string, string> = {
  birthday: "bg-pink-500",
  school: "bg-blue-500",
  medical: "bg-red-500",
  activity: "bg-green-500",
  holiday: "bg-amber-500",
  general: "bg-primary",
};

export function FamilyCalendarView() {
  const { events, isLoading } = useFamilyEvents();
  const { members } = useFamilyMembers();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => isSameDay(new Date(event.start_time), date));
  };

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return null;
    const member = members.find((m) => m.id === memberId);
    return member?.name;
  };

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-medium min-w-[180px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {/* Padding for days before month starts */}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="h-20 bg-muted/30 rounded" />
        ))}

        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`h-20 p-1 rounded border text-left transition-colors ${
                isToday(day)
                  ? "border-primary bg-primary/5"
                  : isSelected
                    ? "border-primary/50 bg-primary/10"
                    : "border-border hover:bg-muted/50"
              }`}
            >
              <span className={`text-xs font-medium ${isToday(day) ? "text-primary" : ""}`}>
                {format(day, "d")}
              </span>
              <div className="space-y-0.5 mt-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    className={`h-1.5 rounded-full ${eventTypeColors[event.event_type] || eventTypeColors.general}`}
                  />
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day events */}
      {selectedDate && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No events scheduled for this day
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-2 rounded bg-muted/50">
                    <div
                      className={`w-1 h-full min-h-[40px] rounded-full ${eventTypeColors[event.event_type] || eventTypeColors.general}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{event.title}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {event.event_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>
                          {event.is_all_day
                            ? "All day"
                            : `${format(new Date(event.start_time), "h:mm a")} - ${format(new Date(event.end_time), "h:mm a")}`}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                        {event.related_member_id && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {getMemberName(event.related_member_id)}
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AddFamilyEventDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        defaultDate={selectedDate}
      />
    </div>
  );
}
