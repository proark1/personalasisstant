import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CorrelationResult {
  correlationType: string;
  domainA: string;
  domainB: string;
  description: string;
  strength: number;
  confidence: number;
  insight: string;
  dataPoints: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate the user
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let userId: string;
  try {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('No user');
    userId = user.id;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log(`Running life correlator for user: ${userId}`);

    // Fetch last 60 days of data for better correlation analysis
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const dateFilter = sixtyDaysAgo.toISOString();

    // Fetch all relevant data in parallel
    const [
      checkinsResult,
      tasksResult,
      focusResult,
      habitsResult,
      eventsResult,
      expensesResult,
    ] = await Promise.all([
      supabase.from('daily_checkins').select('*').eq('user_id', userId).gte('created_at', dateFilter),
      supabase.from('tasks').select('*').eq('user_id', userId).gte('created_at', dateFilter),
      supabase.from('focus_sessions').select('*').eq('user_id', userId).gte('started_at', dateFilter),
      supabase.from('habit_logs').select('*, habits(name, frequency)').eq('user_id', userId).gte('log_date', sixtyDaysAgo.toISOString().split('T')[0]),
      supabase.from('events').select('*').eq('user_id', userId).gte('start_time', dateFilter),
      supabase.from('family_expenses').select('*').eq('user_id', userId).gte('expense_date', sixtyDaysAgo.toISOString().split('T')[0]),
    ]);

    const checkins = checkinsResult.data || [];
    const tasks = tasksResult.data || [];
    const focusSessions = focusResult.data || [];
    const habitLogs = habitsResult.data || [];
    const events = eventsResult.data || [];
    const expenses = expensesResult.data || [];

    console.log(`Data fetched - Checkins: ${checkins.length}, Tasks: ${tasks.length}, Focus: ${focusSessions.length}, Habits: ${habitLogs.length}, Events: ${events.length}`);

    const correlations: CorrelationResult[] = [];
    const now = new Date();

    // Helper: Group data by date
    const groupByDate = <T extends { [key: string]: any }>(items: T[], dateField: string): Map<string, T[]> => {
      const map = new Map<string, T[]>();
      items.forEach(item => {
        const date = item[dateField]?.split('T')[0];
        if (date) {
          if (!map.has(date)) map.set(date, []);
          map.get(date)!.push(item);
        }
      });
      return map;
    };

    // 1. SLEEP → PRODUCTIVITY Correlation
    if (checkins.length >= 10) {
      const sleepData = checkins.filter(c => c.sleep_hours);
      const tasksByDate = groupByDate(tasks.filter(t => t.completed && t.completed_at), 'completed_at');
      
      if (sleepData.length >= 7) {
        const dataPoints: { sleep: number; tasks: number }[] = [];
        
        sleepData.forEach(checkin => {
          const date = checkin.checkin_date;
          const tasksCompleted = tasksByDate.get(date)?.length || 0;
          dataPoints.push({ sleep: checkin.sleep_hours, tasks: tasksCompleted });
        });

        // Calculate correlation
        const avgSleep = dataPoints.reduce((a, b) => a + b.sleep, 0) / dataPoints.length;
        const avgTasks = dataPoints.reduce((a, b) => a + b.tasks, 0) / dataPoints.length;
        
        let numerator = 0, denomSleep = 0, denomTasks = 0;
        dataPoints.forEach(dp => {
          const sleepDiff = dp.sleep - avgSleep;
          const taskDiff = dp.tasks - avgTasks;
          numerator += sleepDiff * taskDiff;
          denomSleep += sleepDiff ** 2;
          denomTasks += taskDiff ** 2;
        });
        
        const correlation = denomSleep && denomTasks ? numerator / Math.sqrt(denomSleep * denomTasks) : 0;
        
        if (Math.abs(correlation) > 0.2) {
          correlations.push({
            correlationType: 'sleep_productivity',
            domainA: 'health',
            domainB: 'tasks',
            description: correlation > 0 
              ? `Better sleep leads to ${Math.round(Math.abs(correlation) * 100)}% more task completions`
              : `Sleep hours inversely correlate with productivity (possible oversleeping effect)`,
            strength: correlation,
            confidence: Math.min(0.9, 0.5 + dataPoints.length / 60),
            insight: correlation > 0.4
              ? "Prioritize 7-8 hours of sleep for maximum productivity tomorrow"
              : correlation > 0
              ? "Sleep quality matters for your output"
              : "You might be oversleeping - try waking up a bit earlier",
            dataPoints: dataPoints.length,
          });
        }
      }
    }

    // 2. EXERCISE → MOOD Correlation
    if (checkins.length >= 10) {
      const exerciseData = checkins.filter(c => c.exercise_minutes !== null && c.mood);
      
      if (exerciseData.length >= 7) {
        const moodMap: Record<string, number> = { '😊': 5, '🙂': 4, '😐': 3, '😔': 2, '😤': 2, '😰': 1 };
        const dataPoints = exerciseData.map(c => ({
          exercise: c.exercise_minutes,
          mood: moodMap[c.mood] || 3
        }));

        const avgExercise = dataPoints.reduce((a, b) => a + b.exercise, 0) / dataPoints.length;
        const avgMood = dataPoints.reduce((a, b) => a + b.mood, 0) / dataPoints.length;
        
        let numerator = 0, denomEx = 0, denomMood = 0;
        dataPoints.forEach(dp => {
          const exDiff = dp.exercise - avgExercise;
          const moodDiff = dp.mood - avgMood;
          numerator += exDiff * moodDiff;
          denomEx += exDiff ** 2;
          denomMood += moodDiff ** 2;
        });
        
        const correlation = denomEx && denomMood ? numerator / Math.sqrt(denomEx * denomMood) : 0;
        
        if (correlation > 0.25) {
          correlations.push({
            correlationType: 'exercise_mood',
            domainA: 'health',
            domainB: 'health',
            description: `Exercise boosts your mood by ${Math.round(correlation * 100)}%`,
            strength: correlation,
            confidence: Math.min(0.85, 0.5 + dataPoints.length / 50),
            insight: "Even 15 minutes of movement can significantly improve your day",
            dataPoints: dataPoints.length,
          });
        }
      }
    }

    // 3. CALENDAR DENSITY → STRESS Correlation
    if (checkins.length >= 7 && events.length >= 5) {
      const eventsByDate = groupByDate(events, 'start_time');
      const stressData = checkins.filter(c => c.stress_level);
      
      if (stressData.length >= 5) {
        const dataPoints = stressData.map(c => ({
          eventCount: eventsByDate.get(c.checkin_date)?.length || 0,
          stress: c.stress_level
        }));

        const avgEvents = dataPoints.reduce((a, b) => a + b.eventCount, 0) / dataPoints.length;
        const avgStress = dataPoints.reduce((a, b) => a + b.stress, 0) / dataPoints.length;
        
        let numerator = 0, denomEvents = 0, denomStress = 0;
        dataPoints.forEach(dp => {
          const eventDiff = dp.eventCount - avgEvents;
          const stressDiff = dp.stress - avgStress;
          numerator += eventDiff * stressDiff;
          denomEvents += eventDiff ** 2;
          denomStress += stressDiff ** 2;
        });
        
        const correlation = denomEvents && denomStress ? numerator / Math.sqrt(denomEvents * denomStress) : 0;
        
        if (correlation > 0.3) {
          correlations.push({
            correlationType: 'calendar_stress',
            domainA: 'calendar',
            domainB: 'health',
            description: `Days with 5+ events increase stress by ${Math.round(correlation * 100)}%`,
            strength: correlation,
            confidence: Math.min(0.8, 0.4 + dataPoints.length / 40),
            insight: "Consider blocking buffer time between meetings on busy days",
            dataPoints: dataPoints.length,
          });
        }
      }
    }

    // 4. HABITS → FOCUS Correlation
    if (habitLogs.length >= 10 && focusSessions.length >= 5) {
      const habitsByDate = groupByDate(habitLogs, 'log_date');
      const focusByDate = groupByDate(focusSessions.filter(f => f.is_completed), 'started_at');
      
      const dates = [...new Set([...habitsByDate.keys(), ...focusByDate.keys()])];
      const dataPoints = dates.map(date => ({
        habits: habitsByDate.get(date)?.length || 0,
        focusMinutes: (focusByDate.get(date) || []).reduce((acc, s) => acc + s.duration_minutes, 0)
      })).filter(dp => dp.habits > 0 || dp.focusMinutes > 0);

      if (dataPoints.length >= 7) {
        const avgHabits = dataPoints.reduce((a, b) => a + b.habits, 0) / dataPoints.length;
        const avgFocus = dataPoints.reduce((a, b) => a + b.focusMinutes, 0) / dataPoints.length;
        
        let numerator = 0, denomHabits = 0, denomFocus = 0;
        dataPoints.forEach(dp => {
          const habitDiff = dp.habits - avgHabits;
          const focusDiff = dp.focusMinutes - avgFocus;
          numerator += habitDiff * focusDiff;
          denomHabits += habitDiff ** 2;
          denomFocus += focusDiff ** 2;
        });
        
        const correlation = denomHabits && denomFocus ? numerator / Math.sqrt(denomHabits * denomFocus) : 0;
        
        if (correlation > 0.25) {
          correlations.push({
            correlationType: 'habits_focus',
            domainA: 'habits',
            domainB: 'tasks',
            description: `Completing habits leads to ${Math.round(correlation * 100)}% more focus time`,
            strength: correlation,
            confidence: Math.min(0.8, 0.5 + dataPoints.length / 50),
            insight: "Starting with habits creates momentum for deeper work",
            dataPoints: dataPoints.length,
          });
        }
      }
    }

    // 5. SPENDING → MOOD Correlation (Family Financial Health)
    if (expenses.length >= 10 && checkins.length >= 7) {
      const expensesByDate = groupByDate(expenses, 'expense_date');
      const moodData = checkins.filter(c => c.mood);
      const moodMap: Record<string, number> = { '😊': 5, '🙂': 4, '😐': 3, '😔': 2, '😤': 2, '😰': 1 };
      
      if (moodData.length >= 5) {
        const dataPoints = moodData.map(c => {
          const dayExpenses = expensesByDate.get(c.checkin_date) || [];
          return {
            spending: dayExpenses.reduce((acc, e) => acc + Number(e.amount), 0),
            mood: moodMap[c.mood] || 3
          };
        });

        const highSpendDays = dataPoints.filter(dp => dp.spending > 100);
        const normalDays = dataPoints.filter(dp => dp.spending <= 50);
        
        if (highSpendDays.length >= 3 && normalDays.length >= 5) {
          const highSpendMood = highSpendDays.reduce((a, b) => a + b.mood, 0) / highSpendDays.length;
          const normalMood = normalDays.reduce((a, b) => a + b.mood, 0) / normalDays.length;
          const diff = normalMood - highSpendMood;
          
          if (diff > 0.3) {
            correlations.push({
              correlationType: 'spending_mood',
              domainA: 'finances',
              domainB: 'health',
              description: `High spending days correlate with ${Math.round(diff * 20)}% lower mood`,
              strength: -diff / 4,
              confidence: 0.65,
              insight: "Consider if spending reflects stress or if it causes it",
              dataPoints: dataPoints.length,
            });
          }
        }
      }
    }

    // 6. DAY OF WEEK → PRODUCTIVITY Pattern
    if (tasks.length >= 14) {
      const completedTasks = tasks.filter(t => t.completed && t.completed_at);
      const tasksByDay: number[] = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
      
      completedTasks.forEach(t => {
        const day = new Date(t.completed_at).getDay();
        tasksByDay[day]++;
      });

      const maxDay = tasksByDay.indexOf(Math.max(...tasksByDay));
      const minDay = tasksByDay.indexOf(Math.min(...tasksByDay));
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      const avgTasks = tasksByDay.reduce((a, b) => a + b, 0) / 7;
      const variance = tasksByDay.reduce((acc, val) => acc + (val - avgTasks) ** 2, 0) / 7;
      
      if (variance > 2 && completedTasks.length >= 20) {
        correlations.push({
          correlationType: 'weekday_productivity',
          domainA: 'time',
          domainB: 'tasks',
          description: `${dayNames[maxDay]} is your most productive day (${Math.round((tasksByDay[maxDay] / avgTasks - 1) * 100)}% above average)`,
          strength: (tasksByDay[maxDay] - avgTasks) / avgTasks,
          confidence: Math.min(0.85, 0.5 + completedTasks.length / 100),
          insight: `Schedule important work on ${dayNames[maxDay]}s. Protect ${dayNames[minDay]}s for rest or creative tasks.`,
          dataPoints: completedTasks.length,
        });
      }
    }

    // Store correlations in database
    for (const corr of correlations) {
      const { data: existing } = await supabase
        .from('life_correlations')
        .select('id, data_points')
        .eq('user_id', userId)
        .eq('correlation_type', corr.correlationType)
        .eq('is_dismissed', false)
        .single();

      if (existing) {
        await supabase
          .from('life_correlations')
          .update({
            pattern_description: corr.description,
            correlation_strength: corr.strength,
            confidence_score: corr.confidence,
            data_points: corr.dataPoints,
            insight_text: corr.insight,
            last_updated_at: now.toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('life_correlations')
          .insert({
            user_id: userId,
            correlation_type: corr.correlationType,
            domain_a: corr.domainA,
            domain_b: corr.domainB,
            pattern_description: corr.description,
            correlation_strength: corr.strength,
            confidence_score: corr.confidence,
            data_points: corr.dataPoints,
            insight_text: corr.insight,
          });
      }
    }

    console.log(`Life correlator complete: ${correlations.length} correlations found`);

    return new Response(JSON.stringify({ 
      success: true,
      correlations,
      correlationsCount: correlations.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Life correlator error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
