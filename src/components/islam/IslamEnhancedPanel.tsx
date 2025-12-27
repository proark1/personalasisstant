import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Calendar, Moon, Hand, RotateCcw, Check, Star } from 'lucide-react';
import { useIslamicFeatures } from '@/hooks/useIslamicFeatures';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function IslamEnhancedPanel() {
  const {
    ramadanDays,
    toggleFasting,
    toggleTaraweeh,
    dhikrLogs,
    dhikrTypes,
    incrementDhikr,
    resetDhikr,
    hijriToday,
    islamicEvents,
    loading,
  } = useIslamicFeatures();

  const [activeTab, setActiveTab] = useState('ramadan');

  // Calculate Ramadan stats
  const fastingDays = ramadanDays.filter(d => d.fasting_completed).length;
  const taraweehDays = ramadanDays.filter(d => d.taraweeh_completed).length;

  // Get dhikr progress
  const getDhikrProgress = (type: string) => {
    const log = dhikrLogs.find(d => d.dhikr_type === type);
    if (!log) return { count: 0, target: dhikrTypes.find(t => t.id === type)?.defaultTarget || 33, percentage: 0 };
    return {
      count: log.completed_count,
      target: log.target_count,
      percentage: Math.min(100, (log.completed_count / log.target_count) * 100),
    };
  };

  // Get upcoming events
  const upcomingEvents = islamicEvents.filter(e => e.date >= new Date()).slice(0, 5);

  return (
    <div className="flex flex-col h-full">
      {/* Header with Hijri Date */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Moon className="w-5 h-5 text-amber-500" />
            Islamic Features
          </h2>
          <Badge variant="outline" className="font-arabic">
            {hijriToday.day} {hijriToday.monthName} {hijriToday.year}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 grid grid-cols-3">
          <TabsTrigger value="ramadan" className="gap-1">
            <Star className="w-4 h-4" />
            Ramadan
          </TabsTrigger>
          <TabsTrigger value="dhikr" className="gap-1">
            <Hand className="w-4 h-4" />
            Dhikr
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1">
            <Calendar className="w-4 h-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        {/* Ramadan Tracker */}
        <TabsContent value="ramadan" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 text-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                  <p className="text-3xl font-bold text-emerald-600">{fastingDays}/30</p>
                  <p className="text-sm text-muted-foreground">Fasting Days</p>
                </Card>
                <Card className="p-4 text-center bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                  <p className="text-3xl font-bold text-amber-600">{taraweehDays}/30</p>
                  <p className="text-sm text-muted-foreground">Taraweeh Prayers</p>
                </Card>
              </div>

              {/* Day Grid */}
              <Card className="p-4">
                <h3 className="font-medium mb-3">Track Your Ramadan</h3>
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 30 }, (_, i) => {
                    const day = i + 1;
                    const dayData = ramadanDays.find(d => d.day_number === day);
                    return (
                      <div key={day} className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full h-10 flex flex-col p-1",
                            dayData?.fasting_completed && "bg-emerald-500/20 text-emerald-600"
                          )}
                          onClick={() => toggleFasting(day)}
                        >
                          <span className="text-xs font-medium">{day}</span>
                          {dayData?.fasting_completed && <Check className="w-3 h-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "w-full h-6 mt-0.5",
                            dayData?.taraweeh_completed && "bg-amber-500/20 text-amber-600"
                          )}
                          onClick={() => toggleTaraweeh(day)}
                        >
                          <Moon className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-emerald-500/30 rounded" />
                    Fasting
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-amber-500/30 rounded" />
                    Taraweeh
                  </div>
                </div>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Dhikr Counter */}
        <TabsContent value="dhikr" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {dhikrTypes.map((dhikr) => {
                const progress = getDhikrProgress(dhikr.id);
                const isComplete = progress.count >= progress.target;
                
                return (
                  <Card
                    key={dhikr.id}
                    className={cn(
                      "p-4 cursor-pointer transition-all",
                      isComplete && "border-emerald-500/50 bg-emerald-500/10"
                    )}
                    onClick={() => !isComplete && incrementDhikr(dhikr.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-arabic text-xl">{dhikr.arabic}</p>
                        <p className="text-sm text-muted-foreground">{dhikr.english}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-2xl font-bold", isComplete && "text-emerald-600")}>
                          {progress.count}/{progress.target}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); resetDhikr(dhikr.id); }}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={progress.percentage} className="h-2" />
                    {isComplete && (
                      <Badge className="mt-2 bg-emerald-500">Complete! 🤲</Badge>
                    )}
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Islamic Calendar */}
        <TabsContent value="calendar" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <Card className="p-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                <p className="text-sm text-muted-foreground">Today's Hijri Date</p>
                <p className="text-2xl font-bold font-arabic">
                  {hijriToday.day} {hijriToday.monthName} {hijriToday.year} هـ
                </p>
              </Card>

              <h3 className="font-medium">Upcoming Islamic Events</h3>
              <div className="space-y-2">
                {upcomingEvents.map((event, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{event.name}</p>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{event.hijriDate}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          ~{format(event.date, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
