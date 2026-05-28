import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  'X-Content-Type-Options': 'nosniff',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
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
    console.log(`Generating weekly coach report for user: ${userId}`);

    // Calculate week boundaries (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Check if report already exists
    const { data: existingReport } = await supabase
      .from('weekly_coach_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStartStr)
      .single();

    if (existingReport) {
      return new Response(JSON.stringify({ 
        success: true,
        report: existingReport,
        cached: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch week's data in parallel
    const [
      tasksResult,
      focusResult,
      habitsResult,
      checkinsResult,
      goalsResult,
      correlationsResult,
    ] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', userId)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString()),
      supabase.from('focus_sessions').select('*').eq('user_id', userId)
        .gte('started_at', weekStart.toISOString())
        .lte('started_at', weekEnd.toISOString()),
      supabase.from('habit_logs').select('*, habits(name)').eq('user_id', userId)
        .gte('log_date', weekStartStr)
        .lte('log_date', weekEndStr),
      supabase.from('daily_checkins').select('*').eq('user_id', userId)
        .gte('checkin_date', weekStartStr)
        .lte('checkin_date', weekEndStr),
      supabase.from('goals').select('*').eq('user_id', userId).eq('is_completed', false),
      supabase.from('life_correlations').select('*').eq('user_id', userId).eq('is_dismissed', false),
    ]);

    const tasks = tasksResult.data || [];
    const focusSessions = focusResult.data || [];
    const habitLogs = habitsResult.data || [];
    const checkins = checkinsResult.data || [];
    const goals = goalsResult.data || [];
    const correlations = correlationsResult.data || [];

    // Calculate metrics
    const tasksCompleted = tasks.filter(t => t.completed).length;
    const tasksCreated = tasks.length;
    const focusMinutes = focusSessions.filter(f => f.is_completed).reduce((acc, s) => acc + s.duration_minutes, 0);
    const habitsCompleted = habitLogs.length;

    // Get unique habits that should have been done this week
    const { data: activeHabits } = await supabase
      .from('habits')
      .select('id, frequency')
      .eq('user_id', userId)
      .eq('is_active', true);

    let expectedHabits = 0;
    (activeHabits || []).forEach(h => {
      if (h.frequency === 'daily') expectedHabits += 7;
      else if (h.frequency === 'weekly') expectedHabits += 1;
    });
    const habitsMissed = Math.max(0, expectedHabits - habitsCompleted);

    // Calculate averages from check-ins
    const moodMap: Record<string, number> = { '😊': 5, '🙂': 4, '😐': 3, '😔': 2, '😤': 2, '😰': 1 };
    const energyMap: Record<string, number> = { 'high': 5, 'medium': 3, 'low': 1 };

    const moodCheckins = checkins.filter(c => c.mood);
    const energyCheckins = checkins.filter(c => c.energy_level);
    const sleepCheckins = checkins.filter(c => c.sleep_hours);

    const averageMood = moodCheckins.length > 0 
      ? moodCheckins.reduce((acc, c) => acc + (moodMap[c.mood] || 3), 0) / moodCheckins.length 
      : null;
    const averageEnergy = energyCheckins.length > 0 
      ? energyCheckins.reduce((acc, c) => acc + (energyMap[c.energy_level] || 3), 0) / energyCheckins.length 
      : null;
    const averageSleep = sleepCheckins.length > 0 
      ? sleepCheckins.reduce((acc, c) => acc + c.sleep_hours, 0) / sleepCheckins.length 
      : null;

    // Calculate scores (0-100)
    const taskCompletionRate = tasksCreated > 0 ? (tasksCompleted / tasksCreated) * 100 : 50;
    const habitCompletionRate = expectedHabits > 0 ? (habitsCompleted / expectedHabits) * 100 : 50;
    const focusScore = Math.min(100, (focusMinutes / 300) * 100); // 5 hours = 100%

    const productivityScore = Math.round((taskCompletionRate * 0.4 + focusScore * 0.3 + habitCompletionRate * 0.3));
    const wellbeingScore = Math.round(((averageMood || 3) / 5 * 40) + ((averageSleep || 7) / 8 * 30) + ((averageEnergy || 3) / 5 * 30));
    const balanceScore = Math.round((productivityScore + wellbeingScore) / 2);

    // Generate AI-powered insights if API key available
    let wins: string[] = [];
    let improvements: string[] = [];
    let recommendations: string[] = [];
    let summaryText = "";

    // Build summary data for AI
    const summaryData = {
      tasksCompleted,
      tasksCreated,
      focusMinutes,
      habitsCompleted,
      habitsMissed,
      averageMood,
      averageEnergy,
      averageSleep,
      productivityScore,
      wellbeingScore,
      goals: goals.slice(0, 5).map(g => ({ name: g.name, progress: g.current_value / g.target_value * 100 })),
      correlations: correlations.slice(0, 3).map(c => c.insight_text),
    };

    if (geminiApiKey) {
      try {
        const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${geminiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a supportive AI life coach analyzing a user's weekly performance. Be encouraging but honest. Focus on actionable insights.`
              },
              {
                role: "user",
                content: `Analyze this week's data and provide coaching insights:
                
${JSON.stringify(summaryData, null, 2)}

Respond with a JSON object containing:
- summary: A 2-3 sentence personalized summary of the week
- wins: Array of 2-3 specific wins/accomplishments to celebrate
- improvements: Array of 2-3 areas that need attention (be constructive)
- recommendations: Array of 3 specific, actionable recommendations for next week`
              }
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            summaryText = parsed.summary || "";
            wins = parsed.wins || [];
            improvements = parsed.improvements || [];
            recommendations = parsed.recommendations || [];
          }
        }
      } catch (aiError) {
        console.error("AI generation failed, using fallback:", aiError);
      }
    }

    // Fallback insights if AI didn't generate
    if (!summaryText) {
      if (productivityScore >= 70) {
        summaryText = `Strong week! You completed ${tasksCompleted} tasks and logged ${Math.round(focusMinutes / 60)} hours of focused work.`;
        wins = ["Great task completion rate", "Consistent focus sessions"];
      } else if (productivityScore >= 50) {
        summaryText = `Steady week with ${tasksCompleted} tasks done. There's room to build more consistency.`;
        wins = ["You showed up and made progress"];
        improvements = ["Try to complete more of the tasks you create"];
      } else {
        summaryText = `Challenging week. Let's identify what blocked you and reset for next week.`;
        improvements = ["Task completion was low", "Focus time needs attention"];
      }

      if (averageSleep && averageSleep >= 7) {
        wins.push("Excellent sleep habits");
      } else if (averageSleep && averageSleep < 6) {
        improvements.push("Sleep is below optimal levels");
      }

      recommendations = [
        "Set 3 must-do tasks each morning",
        "Block 2 hours for deep work daily",
        "Do a 5-minute check-in before bed",
      ];
    }

    // Create the report
    const report = {
      user_id: userId,
      week_start: weekStartStr,
      week_end: weekEndStr,
      tasks_completed: tasksCompleted,
      tasks_created: tasksCreated,
      focus_minutes: focusMinutes,
      habits_completed: habitsCompleted,
      habits_missed: habitsMissed,
      average_mood: averageMood,
      average_energy: averageEnergy,
      average_sleep: averageSleep,
      summary_text: summaryText,
      wins,
      improvements,
      recommendations,
      correlations_found: correlations.slice(0, 5).map(c => ({
        type: c.correlation_type,
        insight: c.insight_text,
      })),
      goal_progress: goals.slice(0, 5).reduce((acc, g) => {
        acc[g.name] = Math.round((g.current_value / g.target_value) * 100);
        return acc;
      }, {} as Record<string, number>),
      productivity_score: productivityScore,
      wellbeing_score: wellbeingScore,
      balance_score: balanceScore,
    };

    const { data: savedReport, error: saveError } = await supabase
      .from('weekly_coach_reports')
      .insert(report)
      .select()
      .single();

    if (saveError) throw saveError;

    console.log(`Weekly coach report created for ${weekStartStr} to ${weekEndStr}`);

    return new Response(JSON.stringify({ 
      success: true,
      report: savedReport,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Weekly coach error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
