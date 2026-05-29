import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { Lightbulb, Brain, TrendingUp, Mail, FileText, Users, Calendar, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Insight {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: string;
  color: string;
}

interface SmartInsightCardProps {
  tasks?: any[];
  emails?: any[];
  contracts?: any[];
  contacts?: any[];
  events?: any[];
}

export function SmartInsightCard({ tasks = [], emails = [], contracts = [], contacts = [], events = [] }: SmartInsightCardProps) {
  const { user } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [topPattern, setTopPattern] = useState<{ id: string; description: string; confidence_score: number } | null>(null);

  // Surface the user's strongest cross-module life-correlation (e.g. "your
  // worst-sleep weeks have the most evening meetings") as a headline insight —
  // this is the value a single-purpose app can't offer.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_patterns')
        .select('id, description, confidence_score')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gte('confidence_score', 0.6)
        .order('confidence_score', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setTopPattern(data as typeof topPattern);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const baseInsights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];
    const incompleteTasks = tasks.filter((t: any) => !t.completed && !t.trashed);
    const highPriority = incompleteTasks.filter((t: any) => t.priority === 'high');
    const now = new Date();

    // Task insights
    if (highPriority.length > 0) {
      result.push({
        id: 'priority',
        icon: <TrendingUp className="w-5 h-5" />,
        title: 'Priority Focus',
        content: `You have ${highPriority.length} high-priority task${highPriority.length > 1 ? 's' : ''} waiting. Tackling "${highPriority[0].title}" first could set a productive tone.`,
        color: 'from-destructive/10 to-warning/10',
      });
    }

    // Email insights
    const unreadEmails = emails.filter((e: any) => !e.is_read && !e.user_archived);
    const priorityEmails = unreadEmails.filter((e: any) => e.priority_score <= 2);
    if (priorityEmails.length > 0) {
      const sender = priorityEmails[0].from_name || priorityEmails[0].from_email;
      result.push({
        id: 'priority-email',
        icon: <Mail className="w-5 h-5" />,
        title: 'Priority Email',
        content: `${priorityEmails.length} priority email${priorityEmails.length > 1 ? 's' : ''} need${priorityEmails.length === 1 ? 's' : ''} attention. "${priorityEmails[0].subject}" from ${sender} is most urgent.`,
        color: 'from-amber-500/10 to-primary/10',
      });
    } else if (unreadEmails.length > 3) {
      result.push({
        id: 'unread-emails',
        icon: <Mail className="w-5 h-5" />,
        title: 'Email Inbox',
        content: `You have ${unreadEmails.length} unread emails. Consider a quick inbox sweep to stay on top of things.`,
        color: 'from-amber-500/10 to-accent/10',
      });
    }

    // Contract insights
    const urgentContracts = contracts.filter((c: any) => {
      if (!c.renewal_date) return false;
      const days = differenceInDays(new Date(c.renewal_date), now);
      return days >= 0 && days <= 7;
    });
    if (urgentContracts.length > 0) {
      const c = urgentContracts[0];
      const days = differenceInDays(new Date(c.renewal_date), now);
      result.push({
        id: 'contract-alert',
        icon: <FileText className="w-5 h-5" />,
        title: 'Contract Alert',
        content: `"${c.name}" renews in ${days} day${days !== 1 ? 's' : ''}${c.cost_amount ? ` (${c.cost_amount}€)` : ''}. Review or cancel before it auto-renews.`,
        color: 'from-destructive/10 to-amber-500/10',
      });
    }

    // Contact insights
    const overdueContacts = contacts.filter((c: any) => {
      if (!c.last_contacted_at) return true;
      return differenceInDays(now, new Date(c.last_contacted_at)) > 30;
    });
    if (overdueContacts.length > 0) {
      const c = overdueContacts[0];
      const days = c.last_contacted_at ? differenceInDays(now, new Date(c.last_contacted_at)) : null;
      result.push({
        id: 'contact-followup',
        icon: <Users className="w-5 h-5" />,
        title: 'Stay Connected',
        content: days
          ? `You haven't reached out to ${c.name} in ${days} days. A quick message can keep the relationship strong.`
          : `It's been a while since you connected with ${c.name}. Consider reaching out.`,
        color: 'from-emerald-500/10 to-primary/10',
      });
    }

    // Calendar-contact correlation
    if (events.length > 0 && contacts.length > 0) {
      for (const event of events) {
        const matchedContact = contacts.find((c: any) =>
          event.title?.toLowerCase().includes(c.name?.toLowerCase())
        );
        if (matchedContact) {
          result.push({
            id: `meeting-${matchedContact.id}`,
            icon: <Calendar className="w-5 h-5" />,
            title: 'Meeting Prep',
            content: `You have "${event.title}" coming up. Check ${matchedContact.name}'s latest emails and notes to prepare.`,
            color: 'from-accent/10 to-primary/10',
          });
          break;
        }
      }
    }

    // Energy tip
    const hour = now.getHours();
    if (hour >= 14 && hour <= 16) {
      result.push({
        id: 'energy',
        icon: <Brain className="w-5 h-5" />,
        title: 'Energy Tip',
        content: 'Afternoon slump? Try a quick 5-min walk or switch to a lighter task. Your focus will bounce back.',
        color: 'from-primary/10 to-accent/10',
      });
    }

    // Default insight
    result.push({
      id: 'motivate',
      icon: <Lightbulb className="w-5 h-5" />,
      title: 'Daily Insight',
      content: incompleteTasks.length === 0
        ? "All tasks done! Use this momentum to plan ahead or invest in a personal project."
        : `${incompleteTasks.length} task${incompleteTasks.length > 1 ? 's' : ''} remaining. Break the biggest one into smaller steps to get moving.`,
      color: 'from-accent/10 to-primary/10',
    });

    return result;
  }, [tasks, emails, contracts, contacts, events]);

  // Lead with the life-correlation pattern when we have one.
  const insights = useMemo<Insight[]>(() => {
    if (!topPattern) return baseInsights;
    const patternInsight: Insight = {
      id: `pattern-${topPattern.id}`,
      icon: <LineChart className="w-5 h-5" />,
      title: 'Life Pattern',
      content: `${topPattern.description} (${Math.round(topPattern.confidence_score * 100)}% confidence)`,
      color: 'from-primary/10 to-accent/10',
    };
    return [patternInsight, ...baseInsights];
  }, [topPattern, baseInsights]);

  useEffect(() => {
    if (insights.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % insights.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [insights.length]);

  if (insights.length === 0) return null;

  const current = insights[activeIndex % insights.length];

  return (
    <GlassCard className="overflow-hidden">
      <GlassCardContent className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className={cn("rounded-lg p-3 bg-gradient-to-r", current.color)}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-card flex items-center justify-center shrink-0 text-primary">
                {current.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                  {current.title}
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {current.content}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {insights.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {insights.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  i === activeIndex % insights.length
                    ? "bg-primary w-4"
                    : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
