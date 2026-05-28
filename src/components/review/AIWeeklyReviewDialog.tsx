import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIWeeklyReview } from '@/hooks/useAIWeeklyReview';
import { Task } from '@/types/flux';
import { 
  Sparkles, 
  Trophy, 
  TrendingUp, 
  AlertCircle, 
  Lightbulb, 
  Target,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Flame
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIWeeklyReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
}

export function AIWeeklyReviewDialog({ open, onOpenChange, tasks }: AIWeeklyReviewDialogProps) {
  const { summary, loading, error, generateReview, clearReview } = useAIWeeklyReview();

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !summary && !loading) {
      generateReview(tasks);
    }
    if (!isOpen) {
      clearReview();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent Week! 🌟';
    if (score >= 60) return 'Great Progress! 💪';
    if (score >= 40) return 'Room to Grow 🌱';
    return 'Challenging Week 🤗';
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Weekly Review
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing your week...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => generateReview(tasks)} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : summary ? (
            <div className="space-y-6">
              {/* Weekly Score */}
              <Card className="bg-gradient-to-br from-primary/10 to-accent/5">
                <CardContent className="p-6 text-center">
                  <p className={cn("text-5xl font-bold", getScoreColor(summary.weeklyScore))}>
                    {summary.weeklyScore}
                  </p>
                  <p className="text-sm mt-2">{getScoreLabel(summary.weeklyScore)}</p>
                </CardContent>
              </Card>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{summary.overview.tasksCompleted}</p>
                      <p className="text-xs text-muted-foreground">Tasks Completed</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Target className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{summary.overview.completionRate}%</p>
                      <p className="text-xs text-muted-foreground">Completion Rate</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Clock className="w-8 h-8 text-accent" />
                    <div>
                      <p className="text-2xl font-bold">{summary.overview.focusMinutes}</p>
                      <p className="text-xs text-muted-foreground">Focus Minutes</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Flame className="w-8 h-8 text-warning" />
                    <div>
                      <p className="text-lg font-bold capitalize">{summary.overview.topCategory}</p>
                      <p className="text-xs text-muted-foreground">Top Category</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Achievements */}
              {summary.achievements.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    Achievements
                  </h4>
                  <div className="space-y-1">
                    {summary.achievements.map((achievement, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded-md">
                        <span className="text-green-500">✓</span>
                        <span>{achievement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Patterns */}
              {summary.patterns.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Patterns Noticed
                  </h4>
                  <div className="space-y-1">
                    {summary.patterns.map((pattern, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/50 rounded-md">
                        {pattern}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Areas for Improvement */}
              {summary.areasForImprovement.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    Areas to Focus On
                  </h4>
                  <div className="space-y-1">
                    {summary.areasForImprovement.map((area, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/50 rounded-md">
                        {area}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Personalized Tip */}
              <Card className="bg-gradient-to-r from-accent/20 to-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Personalized Tip</p>
                      <p className="text-sm text-muted-foreground mt-1">{summary.personalizedTip}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Next Week Suggestions */}
              {summary.nextWeekSuggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">For Next Week</h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.nextWeekSuggestions.map((suggestion, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {suggestion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
